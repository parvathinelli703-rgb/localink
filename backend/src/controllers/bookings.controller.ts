import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query, getConnection } from '../config/database';
import { success, error } from '../utils/response';
import { createRequestSchema, updateBookingStatusSchema } from '../utils/validation';
import { findNearestProviders } from '../config/redis';
import { config } from '../config';
import { emitToUser, emitToAllProviders, emitToBooking } from '../sockets';

// Allowed transitions
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  searching: ['accepted', 'cancelled', 'expired'],
  accepted: ['on_the_way', 'cancelled'],
  on_the_way: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  expired: [],
};
// ==================== REVIEWS ====================

export async function getReview(req: AuthRequest, res: Response) {
  try {
    const bookingId = Number(req.params.id);

    if (isNaN(bookingId)) {
      return error(res, 'VALIDATION_ERROR', 'Invalid booking id', 400);
    }

    const reviews: any[] = await query(
      `SELECT r.id, r.booking_id, r.rating, r.comment, r.created_at,
              u.full_name as customer_name
       FROM reviews r
       LEFT JOIN users u ON u.id = r.reviewer_id
       WHERE r.booking_id = ?
       LIMIT 1`,
      [bookingId]
    );

    return success(res, {
      review: reviews.length > 0 ? reviews[0] : null
    });
  } catch (err: any) {
    console.error('Get review error:', err);
    return success(res, { review: null });
  }
}

export async function createReview(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'customer') {
      return error(res, 'FORBIDDEN', 'Only customers can leave reviews', 403);
    }

    const bookingId = Number(req.params.id);
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return error(res, 'VALIDATION_ERROR', 'Rating must be between 1 and 5', 400);
    }

    const bookings: any[] = await query(
      `SELECT * FROM bookings WHERE id = ? AND customer_id = ?`,
      [bookingId, req.user.userId]
    );

    if (bookings.length === 0) {
      return error(res, 'NOT_FOUND', 'Booking not found', 404);
    }

    const booking = bookings[0];

    if (booking.status !== 'completed') {
      return error(res, 'INVALID_STATUS', 'You can only review completed jobs', 400);
    }

    const existing: any[] = await query(
      'SELECT id FROM reviews WHERE booking_id = ?',
      [bookingId]
    );
    if (existing.length > 0) {
      return error(res, 'CONFLICT', 'You already reviewed this job', 409);
    }

    const result: any = await query(
      `INSERT INTO reviews (booking_id, reviewer_id, provider_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [bookingId, req.user.userId, booking.provider_id, rating, comment || null]
    );

    try {
      await query(
        `UPDATE providers 
         SET rating_avg = (SELECT AVG(rating) FROM reviews WHERE provider_id = ?),
             rating_count = (SELECT COUNT(*) FROM reviews WHERE provider_id = ?)
         WHERE id = ?`,
        [booking.provider_id, booking.provider_id, booking.provider_id]
      );
    } catch (e) {
      console.log('Could not update provider rating');
    }

    return success(res, {
      review: {
        id: result.insertId,
        bookingId,
        rating,
        comment,
      },
    }, 201);
  } catch (err: any) {
    console.error('Create review error:', err);
    return error(res, 'INTERNAL_ERROR', err.message || 'Failed to create review', 500);
  }
}
export async function getProviderReviews(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'provider') {
      return error(res, 'FORBIDDEN', 'Only providers can view their reviews', 403);
    }

    // Get provider id
    const providers: any[] = await query(
      'SELECT id FROM providers WHERE user_id = ?',
      [req.user.userId]
    );

    if (providers.length === 0) {
      return error(res, 'NOT_FOUND', 'Provider profile not found', 404);
    }

    const providerId = providers[0].id;

    const reviews = await query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.full_name as customer_name,
              b.id as booking_id
       FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       LEFT JOIN bookings b ON b.id = r.booking_id
       WHERE r.provider_id = ?
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [providerId]
    );

    // Also get average
    const stats: any[] = await query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
       FROM reviews WHERE provider_id = ?`,
      [providerId]
    );

    return success(res, {
      reviews,
      stats: {
        average: stats[0]?.avg_rating ? Number(stats[0].avg_rating).toFixed(1) : null,
        total: stats[0]?.total_reviews || 0,
      },
    });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get reviews', 500);
  }
}
export async function createRequest(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'customer') {
      return error(res, 'FORBIDDEN', 'Only customers can create requests', 403);
    }

    const body = createRequestSchema.parse(req.body);

    const services: any[] = await query(
      'SELECT id FROM services WHERE id = ? AND is_active = 1',
      [body.serviceId]
    );
    if (services.length === 0) {
      return error(res, 'NOT_FOUND', 'Service not found', 404);
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + config.dispatch.requestTimeoutMinutes);

    const result: any = await query(
      `INSERT INTO requests
         (customer_id, service_id, title, description, location, address, preferred_time, budget_max, status, expires_at)
       VALUES (?, ?, ?, ?, ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326), ?, ?, ?, 'searching', ?)`,
      [
        req.user.userId,
        body.serviceId,
        body.title,
        body.description || null,
        body.lng,
        body.lat,
        body.address,
        body.preferredTime || null,
        body.budgetMax || null,
        expiresAt,
      ]
    );

    const requestId = result.insertId;

    const nearest = await findNearestProviders(
      body.lng,
      body.lat,
      config.dispatch.initialRadiusKm,
      config.dispatch.providersPerBatch
    );

    emitToAllProviders('request:new', {
      id: requestId,
      title: body.title,
      address: body.address,
    });

    return success(
      res,
      {
        request: {
          id: requestId,
          status: 'searching',
          expiresAt,
        },
        notifiedProviders: nearest.length,
      },
      201
    );
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return error(res, 'VALIDATION_ERROR', 'Invalid input', 400, err.errors);
    }
    console.error('Create request error:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to create request', 500);
  }
}

export async function acceptRequest(req: AuthRequest, res: Response) {
  const connection = await getConnection();
  try {
    if (!req.user || req.user.role !== 'provider') {
      return error(res, 'FORBIDDEN', 'Only providers can accept requests', 403);
    }

    const requestId = Number(req.params.id);
    if (isNaN(requestId)) {
      return error(res, 'VALIDATION_ERROR', 'Invalid request id', 400);
    }

    const providers: any[] = await query(
      'SELECT id FROM providers WHERE user_id = ? AND is_approved = 1 AND is_online = 1',
      [req.user.userId]
    );
    if (providers.length === 0) {
      return error(res, 'NOT_AVAILABLE', 'Provider not online or not approved', 403);
    }
    const providerId = providers[0].id;

    await connection.beginTransaction();

    const [updateResult]: any = await connection.execute(
      `UPDATE requests SET status = 'accepted' WHERE id = ? AND status = 'searching'`,
      [requestId]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return error(res, 'CONFLICT', 'Request already taken or no longer available', 409);
    }

    const [reqRows]: any = await connection.execute(
      'SELECT customer_id FROM requests WHERE id = ?',
      [requestId]
    );
    const customerId = reqRows[0].customer_id;

    const [bookingResult]: any = await connection.execute(
      `INSERT INTO bookings (request_id, provider_id, customer_id, status)
       VALUES (?, ?, ?, 'accepted')`,
      [requestId, providerId, customerId]
    );

    await connection.commit();

    emitToUser(customerId, 'request:taken', {
      requestId,
      bookingId: bookingResult.insertId,
    });
    emitToAllProviders('request:taken', { requestId });

    return success(res, {
      booking: {
        id: bookingResult.insertId,
        requestId,
        providerId,
        customerId,
        status: 'accepted',
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error('Accept error:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to accept request', 500);
  } finally {
    connection.release();
  }
}

export async function updateBookingStatus(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return error(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    const bookingId = Number(req.params.id);
    const body = updateBookingStatusSchema.parse(req.body);

    const bookings: any[] = await query(
      `SELECT b.*, r.status as request_status
       FROM bookings b
       JOIN requests r ON r.id = b.request_id
       WHERE b.id = ?`,
      [bookingId]
    );

    if (bookings.length === 0) {
      return error(res, 'NOT_FOUND', 'Booking not found', 404);
    }

    const booking = bookings[0];

    if (req.user.role === 'provider') {
      const providers: any[] = await query(
        'SELECT id FROM providers WHERE user_id = ?',
        [req.user.userId]
      );
      if (providers.length === 0 || providers[0].id !== booking.provider_id) {
        return error(res, 'FORBIDDEN', 'Not your booking', 403);
      }
    } else if (req.user.role !== 'admin') {
      return error(res, 'FORBIDDEN', 'Only provider can update status', 403);
    }

    const current = booking.status;
    const next = body.status;

    if (!ALLOWED_TRANSITIONS[current]?.includes(next)) {
      return error(res, 'INVALID_TRANSITION', `Cannot transition from ${current} to ${next}`, 400);
    }

    let extraSql = '';
    const params: any[] = [next];

    if (next === 'in_progress') {
      extraSql = ', started_at = NOW()';
    } else if (next === 'completed') {
      extraSql = ', completed_at = NOW()';
    } else if (next === 'cancelled') {
      extraSql = ', cancelled_at = NOW(), cancel_reason = ?';
      params.push(body.cancelReason || null);
    }

    params.push(bookingId);

    await query(`UPDATE bookings SET status = ?${extraSql} WHERE id = ?`, params);

    if (next === 'completed' || next === 'cancelled') {
      await query(`UPDATE requests SET status = ? WHERE id = ?`, [next, booking.request_id]);
    } else if (next === 'on_the_way' || next === 'in_progress') {
      await query(`UPDATE requests SET status = ? WHERE id = ?`, [next, booking.request_id]);
    }

    if (next === 'completed') {
      await query(
        `UPDATE providers SET completed_jobs = completed_jobs + 1 WHERE id = ?`,
        [booking.provider_id]
      );
    }

    emitToBooking(bookingId, 'booking:status', { bookingId, status: next });
    emitToUser(booking.customer_id, 'booking:status', { bookingId, status: next });

    return success(res, { bookingId, status: next });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return error(res, 'VALIDATION_ERROR', 'Invalid input', 400, err.errors);
    }
    console.error('Update status error:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update status', 500);
  }
}

export async function getBooking(req: AuthRequest, res: Response) {
  try {
    const bookingId = Number(req.params.id);
    const bookings: any[] = await query(
      `SELECT b.*, 
              r.title, r.description, r.address, r.budget_max,
              ST_X(r.location) as request_lng, ST_Y(r.location) as request_lat,
              cu.full_name as customer_name,
              pr.business_name, pu.full_name as provider_name
       FROM bookings b
       JOIN requests r ON r.id = b.request_id
       JOIN users cu ON cu.id = b.customer_id
       JOIN providers pr ON pr.id = b.provider_id
       JOIN users pu ON pu.id = pr.user_id
       WHERE b.id = ?`,
      [bookingId]
    );

    if (bookings.length === 0) {
      return error(res, 'NOT_FOUND', 'Booking not found', 404);
    }

    const booking = bookings[0];

    if (req.user?.role === 'customer' && booking.customer_id !== req.user.userId) {
      return error(res, 'FORBIDDEN', 'Not your booking', 403);
    }
    if (req.user?.role === 'provider') {
      const providers: any[] = await query(
        'SELECT id FROM providers WHERE user_id = ?',
        [req.user.userId]
      );
      if (providers.length === 0 || providers[0].id !== booking.provider_id) {
        return error(res, 'FORBIDDEN', 'Not your booking', 403);
      }
    }

    return success(res, { booking });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to fetch booking', 500);
  }
}

export async function listMyBookings(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return error(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    let sql = `
      SELECT b.id, b.status, b.created_at, b.started_at, b.completed_at,
             r.title, r.address,
             cu.full_name as customer_name,
             pr.business_name, pu.full_name as provider_name
      FROM bookings b
      JOIN requests r ON r.id = b.request_id
      JOIN users cu ON cu.id = b.customer_id
      JOIN providers pr ON pr.id = b.provider_id
      JOIN users pu ON pu.id = pr.user_id
      WHERE `;
    const params: any[] = [];

    if (req.user.role === 'customer') {
      sql += 'b.customer_id = ?';
      params.push(req.user.userId);
    } else if (req.user.role === 'provider') {
      sql += 'b.provider_id = (SELECT id FROM providers WHERE user_id = ?)';
      params.push(req.user.userId);
    } else {
      sql += '1=1';
    }

    sql += ' ORDER BY b.created_at DESC LIMIT 50';

    const bookings = await query(sql, params);
    return success(res, { bookings });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list bookings', 500);
  }
}

export async function listOpenRequests(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'provider') {
      return error(res, 'FORBIDDEN', 'Only providers can view open requests', 403);
    }

    const requests = await query(
      `SELECT r.id, r.title, r.description, r.address, r.status, r.created_at,
              s.name as service_name,
              u.full_name as customer_name
       FROM requests r
       JOIN services s ON s.id = r.service_id
       JOIN users u ON u.id = r.customer_id
       WHERE r.status = 'searching'
       ORDER BY r.created_at DESC
       LIMIT 20`
    );

    return success(res, { requests });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list open requests', 500);
  }
}

// ==================== CHAT ====================

export async function getMessages(req: AuthRequest, res: Response) {
  try {
    const bookingId = Number(req.params.id);
    if (isNaN(bookingId)) {
      return error(res, 'VALIDATION_ERROR', 'Invalid booking id', 400);
    }

    const bookings: any[] = await query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (bookings.length === 0) {
      return error(res, 'NOT_FOUND', 'Booking not found', 404);
    }
    const booking = bookings[0];

    if (req.user?.role === 'customer' && booking.customer_id !== req.user.userId) {
      return error(res, 'FORBIDDEN', 'Not your booking', 403);
    }
    if (req.user?.role === 'provider') {
      const providers: any[] = await query(
        'SELECT id FROM providers WHERE user_id = ?',
        [req.user.userId]
      );
      if (providers.length === 0 || providers[0].id !== booking.provider_id) {
        return error(res, 'FORBIDDEN', 'Not your booking', 403);
      }
    }

    const messages = await query(
      `SELECT m.id, m.body, m.sender_id, m.created_at, u.full_name as sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.booking_id = ?
       ORDER BY m.created_at ASC`,
      [bookingId]
    );

    return success(res, { messages });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get messages', 500);
  }
}

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return error(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    const bookingId = Number(req.params.id);
    const { body } = req.body;

    if (!body || body.trim().length === 0) {
      return error(res, 'VALIDATION_ERROR', 'Message cannot be empty', 400);
    }

    const bookings: any[] = await query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (bookings.length === 0) {
      return error(res, 'NOT_FOUND', 'Booking not found', 404);
    }
    const booking = bookings[0];

    if (req.user.role === 'customer' && booking.customer_id !== req.user.userId) {
      return error(res, 'FORBIDDEN', 'Not your booking', 403);
    }
    if (req.user.role === 'provider') {
      const providers: any[] = await query(
        'SELECT id FROM providers WHERE user_id = ?',
        [req.user.userId]
      );
      if (providers.length === 0 || providers[0].id !== booking.provider_id) {
        return error(res, 'FORBIDDEN', 'Not your booking', 403);
      }
    }

    const result: any = await query(
      `INSERT INTO messages (booking_id, sender_id, body) VALUES (?, ?, ?)`,
      [bookingId, req.user.userId, body.trim()]
    );

    const message = {
      id: result.insertId,
      booking_id: bookingId,
      sender_id: req.user.userId,
      body: body.trim(),
      created_at: new Date().toISOString(),
      sender_name: req.user.email,
    };

    emitToBooking(bookingId, 'chat:message', message);

    return success(res, { message }, 201);
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to send message', 500);
  }
}
export async function listMyRequests(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'customer') {
      return error(res, 'FORBIDDEN', 'Only customers can view their requests', 403);
    }

    const requests = await query(
      `SELECT r.id, r.title, r.address, r.status, r.created_at, r.expires_at,
              s.name as service_name
       FROM requests r
       JOIN services s ON s.id = r.service_id
       WHERE r.customer_id = ?
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [req.user.userId]
    );

    return success(res, { requests });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list requests', 500);
  }
}
export async function cancelRequest(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return error(res, 'UNAUTHORIZED', 'Not authenticated', 401);

    const requestId = Number(req.params.id);

    const rows: any[] = await query(
      'SELECT * FROM requests WHERE id = ?',
      [requestId]
    );
    if (rows.length === 0) return error(res, 'NOT_FOUND', 'Request not found', 404);

    const request = rows[0];

    // Only customer who created it can cancel, and only if still searching
    if (req.user.role === 'customer') {
      if (request.customer_id !== req.user.userId) {
        return error(res, 'FORBIDDEN', 'Not your request', 403);
      }
      if (request.status !== 'searching') {
        return error(res, 'INVALID_STATUS', 'Only searching requests can be cancelled', 400);
      }
    }

    await query(
      `UPDATE requests SET status = 'cancelled' WHERE id = ?`,
      [requestId]
    );

    return success(res, { message: 'Request cancelled' });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to cancel request', 500);
  }
}

export async function cancelBooking(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return error(res, 'UNAUTHORIZED', 'Not authenticated', 401);

    const bookingId = Number(req.params.id);
    const { reason } = req.body;

    const rows: any[] = await query(
      'SELECT * FROM bookings WHERE id = ?',
      [bookingId]
    );
    if (rows.length === 0) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    const booking = rows[0];

    // Ownership check
    if (req.user.role === 'customer' && booking.customer_id !== req.user.userId) {
      return error(res, 'FORBIDDEN', 'Not your booking', 403);
    }
    if (req.user.role === 'provider') {
      const providers: any[] = await query(
        'SELECT id FROM providers WHERE user_id = ?',
        [req.user.userId]
      );
      if (providers.length === 0 || providers[0].id !== booking.provider_id) {
        return error(res, 'FORBIDDEN', 'Not your booking', 403);
      }
    }

    if (['completed', 'cancelled'].includes(booking.status)) {
      return error(res, 'INVALID_STATUS', 'Cannot cancel this booking', 400);
    }

    await query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = ? WHERE id = ?`,
      [reason || null, bookingId]
    );
    await query(
      `UPDATE requests SET status = 'cancelled' WHERE id = ?`,
      [booking.request_id]
    );

    emitToBooking(bookingId, 'booking:status', { bookingId, status: 'cancelled' });

    return success(res, { message: 'Booking cancelled' });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to cancel booking', 500);
  }
}