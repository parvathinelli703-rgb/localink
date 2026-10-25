import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  fullName: z.string().min(2).max(150),
  phone: z.string().optional(),
  role: z.enum(['customer', 'provider']).default('customer'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createRequestSchema = z.object({
  serviceId: z.number().int().positive(),
  title: z.string().min(5).max(200),
  description: z.string().max(2000).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(5).max(500),
  preferredTime: z.string().datetime().optional(),
  budgetMax: z.number().positive().optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['on_the_way', 'in_progress', 'completed', 'cancelled']),
  cancelReason: z.string().max(500).optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(2000),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});
