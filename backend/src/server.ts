import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketServer } from 'socket.io';
import { config } from './config';
import { testConnection } from './config/database';
import { testRedis } from './config/redis';
import routes from './routes';
import { setupSockets } from './sockets';

async function bootstrap() {
  // Test infrastructure
  const dbOk = await testConnection();
  const redisOk = await testRedis();

  if (!dbOk) {
    console.error('Cannot start without MySQL. Make sure Docker is running: docker compose up -d');
    process.exit(1);
  }

  const app = express();
  const server = http.createServer(app);

  // Socket.IO
  const io = new SocketServer(server, {
    cors: {
      origin: "*", // Allow all origins for development
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  setupSockets(io);

  // Middleware
  app.use(helmet({
    crossOriginResourcePolicy: false, // Important for CORS
  }));

  // CORS - Allow frontend to talk to backend
  app.use(
    cors({
      origin: "*", // Change to "http://localhost:3000" in production
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '1mb' }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Routes
  app.use('/api/v1', routes);

  // 404
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // Global error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  });

  server.listen(config.port, () => {
    console.log(`
🚀 Localink API running
   → http://localhost:${config.port}
   → API base: http://localhost:${config.port}/api/v1
   → Health:   http://localhost:${config.port}/api/v1/health
   → MySQL:    ${dbOk ? 'OK' : 'FAILED'}
   → Redis:    ${redisOk ? 'OK' : 'FAILED (optional for basic API)'}
    `);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});