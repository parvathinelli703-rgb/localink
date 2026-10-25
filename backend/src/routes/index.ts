import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import * as authCtrl from '../controllers/auth.controller';
import * as providersCtrl from '../controllers/providers.controller';
import * as bookingsCtrl from '../controllers/bookings.controller';

const router = Router();

// -------------------- Auth --------------------
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authenticate, authCtrl.me);

// -------------------- Categories & Services --------------------
router.get('/categories', providersCtrl.listCategories);
router.get('/services', providersCtrl.listServices);

// -------------------- Providers --------------------
router.put('/providers/me', authenticate, requireRole('provider'), providersCtrl.updateProviderProfile);
router.post('/providers/online', authenticate, requireRole('provider'), providersCtrl.setOnlineStatus);
router.get('/providers/search', providersCtrl.geoSearch);
router.get('/providers/me/reviews', authenticate, requireRole('provider'), bookingsCtrl.getProviderReviews);
router.get('/providers/me', authenticate, requireRole('provider'), providersCtrl.getMyProfile);
router.put('/providers/me', authenticate, requireRole('provider'), providersCtrl.updateMyProfile);
// -------------------- Requests & Bookings --------------------
router.post('/requests', authenticate, requireRole('customer'), bookingsCtrl.createRequest);
router.get('/requests/open', authenticate, requireRole('provider'), bookingsCtrl.listOpenRequests);
router.post('/requests/:id/accept', authenticate, requireRole('provider'), bookingsCtrl.acceptRequest);

router.get('/bookings', authenticate, bookingsCtrl.listMyBookings);
router.get('/bookings/:id', authenticate, bookingsCtrl.getBooking);
router.patch('/bookings/:id/status', authenticate, bookingsCtrl.updateBookingStatus);
router.get('/requests/my', authenticate, requireRole('customer'), bookingsCtrl.listMyRequests);
router.post('/requests/:id/cancel', authenticate, bookingsCtrl.cancelRequest);
router.post('/bookings/:id/cancel', authenticate, bookingsCtrl.cancelBooking);
// -------------------- Chat --------------------
router.get('/bookings/:id/messages', authenticate, bookingsCtrl.getMessages);
router.post('/bookings/:id/messages', authenticate, bookingsCtrl.sendMessage);

router.post('/bookings/:id/review', authenticate, requireRole('customer'), bookingsCtrl.createReview);
router.get('/bookings/:id/review', authenticate, bookingsCtrl.getReview);
//-------------------------admin--------------------------------
router.get('/admin/providers', authenticate, requireRole('admin'), providersCtrl.listPendingProviders);
router.post('/admin/providers/:id/approve', authenticate, requireRole('admin'), providersCtrl.approveProvider);
// Health
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;