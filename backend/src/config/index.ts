import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  jwt: {
    secret: process.env.JWT_SECRET || 'localink-super-secret-change-in-production-2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  db: {
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: parseInt(process.env.DATABASE_PORT || '3306', 10),
    user: process.env.DATABASE_USER || 'localink',
    password: process.env.DATABASE_PASSWORD || 'localinkpass',
    database: process.env.DATABASE_NAME || 'localink',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  // Dispatch settings
  dispatch: {
    initialRadiusKm: 5,
    maxRadiusKm: 20,
    providersPerBatch: 5,
    requestTimeoutMinutes: 15,
  },
};
