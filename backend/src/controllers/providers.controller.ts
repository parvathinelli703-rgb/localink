import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { setProviderLocation, removeProviderLocation } from '../config/redis';

export async function listCategories(_req: AuthRequest, res: Response) {
  try {
    const categories = await query(
      `SELECT c.id, c.name, c.slug, c.icon,
              (SELECT COUNT(*) FROM services s WHERE s.category_id = c.id AND s.is_active = 1) as service_count
       FROM categories c
       WHERE c.is_active = 1
       ORDER BY c.sort_order`
    );
    return success(res, { categories });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list categories', 500);
  }
}

export async function listServices(req: AuthRequest, res: Response) {
  try {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    let sql = `SELECT s.id, s.name, s.description, s.base_price, s.category_id, c.name as category_name
               FROM services s
               JOIN categories c ON c.id = s.category_id
               WHERE s.is_active = 1`;
    const params: any[] = [];
    if (categoryId) {
      sql += ' AND s.category_id = ?';
      params.push(categoryId);
    }
    sql += ' ORDER BY s.name';
    const services = await query(sql, params);
    return success(res, { services });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list services', 500);
  }
}

export async function updateProviderProfile(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'provider') {
      return error(res, 'FORBIDDEN', 'Only providers can update profile', 403);
    }

    const { businessName, bio, experienceYears, address, serviceRadiusKm, lat, lng } = req.body;

    const providers: any[] = await query(
      'SELECT id FROM providers WHERE user_id = ?',
      [req.user.userId]
    );
    if (providers.length === 0) {
      return error(res, 'NOT_FOUND', 'Provider profile not found', 404);
    }

    const providerId = providers[0].id;

    if (lat !== undefined && lng !== undefined) {
      await query(
        `UPDATE providers SET
           business_name = COALESCE(?, business_name),
           bio = COALESCE(?, bio),
           experience_years = COALESCE(?, experience_years),
           address = COALESCE(?, address),
           service_radius_km = COALESCE(?, service_radius_km),
           location = ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326)
         WHERE id = ?`,
        [
          businessName ?? null,
          bio ?? null,
          experienceYears ?? null,
          address ?? null,
          serviceRadiusKm ?? null,
          lng,
          lat,
          providerId,
        ]
      );
    } else {
      await query(
        `UPDATE providers SET
           business_name = COALESCE(?, business_name),
           bio = COALESCE(?, bio),
           experience_years = COALESCE(?, experience_years),
           address = COALESCE(?, address),
           service_radius_km = COALESCE(?, service_radius_km)
         WHERE id = ?`,
        [
          businessName ?? null,
          bio ?? null,
          experienceYears ?? null,
          address ?? null,
          serviceRadiusKm ?? null,
          providerId,
        ]
      );
    }

    return success(res, { message: 'Profile updated' });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update profile', 500);
  }
}

export async function setOnlineStatus(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'provider') {
      return error(res, 'FORBIDDEN', 'Only providers can change online status', 403);
    }

    const { isOnline, lat, lng } = req.body;
    if (typeof isOnline !== 'boolean') {
      return error(res, 'VALIDATION_ERROR', 'isOnline must be boolean', 400);
    }

    const providers: any[] = await query(
      'SELECT id FROM providers WHERE user_id = ? AND is_approved = 1',
      [req.user.userId]
    );
    if (providers.length === 0) {
      return error(res, 'NOT_APPROVED', 'Provider not approved yet', 403);
    }

    const providerId = providers[0].id;

    await query('UPDATE providers SET is_online = ? WHERE id = ?', [
      isOnline ? 1 : 0,
      providerId,
    ]);

    if (isOnline) {
      if (lat === undefined || lng === undefined) {
        return error(res, 'VALIDATION_ERROR', 'lat and lng required when going online', 400);
      }
      await setProviderLocation(providerId, lng, lat);
      // Also update permanent location
      await query(
        `UPDATE providers SET location = ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326) WHERE id = ?`,
        [lng, lat, providerId]
      );
    } else {
      await removeProviderLocation(providerId);
    }

    return success(res, { isOnline, providerId });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update online status', 500);
  }
}

export async function geoSearch(req: AuthRequest, res: Response) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Number(req.query.radiusKm || 10);
    const serviceId = req.query.serviceId ? Number(req.query.serviceId) : null;

    if (isNaN(lat) || isNaN(lng)) {
      return error(res, 'VALIDATION_ERROR', 'lat and lng are required', 400);
    }

    // Bounding box pre-filter + exact distance
    // 1 degree ≈ 111 km
    const delta = radiusKm / 111;

    let sql = `
      SELECT p.id, p.business_name, p.bio, p.experience_years,
             p.rating_avg, p.rating_count, p.completed_jobs,
             p.service_radius_km, p.address,
             ST_X(p.location) as lng, ST_Y(p.location) as lat,
             ST_Distance_Sphere(p.location, ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326)) / 1000 as distance_km,
             u.full_name, u.avatar_url
      FROM providers p
      JOIN users u ON u.id = p.user_id
      WHERE p.is_approved = 1
        AND p.is_online = 1
        AND ST_Y(p.location) BETWEEN ? AND ?
        AND ST_X(p.location) BETWEEN ? AND ?
        AND ST_Distance_Sphere(p.location, ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326)) <= ?
    `;

    const params: any[] = [lng, lat, lat - delta, lat + delta, lng - delta, lng + delta, lng, lat, radiusKm * 1000];

    if (serviceId) {
      sql += ` AND EXISTS (
        SELECT 1 FROM provider_services ps WHERE ps.provider_id = p.id AND ps.service_id = ?
      )`;
      params.push(serviceId);
    }

    sql += ' ORDER BY distance_km ASC LIMIT 50';

    const providers = await query(sql, params);
    return success(res, { providers, count: (providers as any[]).length });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Geo search failed', 500);
  }
}
export async function getMyProfile(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'provider') {
      return error(res, 'FORBIDDEN', 'Only providers', 403);
    }

    const rows: any[] = await query(
      `SELECT p.*, u.full_name, u.email, u.phone
       FROM providers p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ?`,
      [req.user.userId]
    );

    if (rows.length === 0) {
      return error(res, 'NOT_FOUND', 'Provider profile not found', 404);
    }

    return success(res, { profile: rows[0] });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get profile', 500);
  }
}

export async function updateMyProfile(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'provider') {
      return error(res, 'FORBIDDEN', 'Only providers', 403);
    }

    const { businessName, bio, phone } = req.body;

    await query(
      `UPDATE providers SET business_name = ?, bio = ? WHERE user_id = ?`,
      [businessName || null, bio || null, req.user.userId]
    );

    if (phone) {
      await query(`UPDATE users SET phone = ? WHERE id = ?`, [phone, req.user.userId]);
    }

    return success(res, { message: 'Profile updated' });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to update profile', 500);
  }
}
export async function listPendingProviders(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return error(res, 'FORBIDDEN', 'Admin only', 403);
    }

    const providers = await query(
      `SELECT p.id, p.business_name, p.is_approved, p.created_at,
              u.full_name, u.email, u.phone
       FROM providers p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`
    );

    return success(res, { providers });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list providers', 500);
  }
}

export async function approveProvider(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return error(res, 'FORBIDDEN', 'Admin only', 403);
    }

    const providerId = Number(req.params.id);

    await query(
      `UPDATE providers SET is_approved = 1 WHERE id = ?`,
      [providerId]
    );

    return success(res, { message: 'Provider approved' });
  } catch (err) {
    console.error(err);
    return error(res, 'INTERNAL_ERROR', 'Failed to approve', 500);
  }
}