import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { config } from './config';
import { testConnection, closeConnection } from './config/database';
import { SocketService } from './services/socketService';

// Import routes
import authRoutes from './routes/auth';
import auctionRoutes from './routes/auctions';
import paymentRoutes from './routes/payments';
import productRoutes from './routes/products';
import debugRoutes from './routes/debug';

const app = express();
const server = createServer(app);

// ✅ Fix: Trust proxy for Railway/Render/Heroku
app.set('trust proxy', 1);

// Initialize Socket.IO service
const socketService = new SocketService(server);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: [
    config.server.frontendUrl,                     // اللي جاي من ملف config (ممكن يفضل localhost)
    "https://auction-app-full.vercel.app",         // رابط الفرونت اند اللي شغال لايف
    /^http:\/\/localhost:\d+$/                     // أي localhost مع أي بورت
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auction API is running',
    timestamp: new Date().toISOString(),
    environment: config.server.env
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/debug', debugRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);

  res.status(err.status || 500).json({
    success: false,
    error: config.server.env === 'production'
      ? 'Internal server error'
      : err.message || 'Something went wrong'
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('HTTP server closed');

    try {
      await closeConnection();
      console.log('Database connection closed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start HTTP server
    server.listen(config.server.port, () => {
      console.log(`
🚀 Auction API Server Started Successfully!

📊 Server Details:
   • Port: ${config.server.port}
   • Environment: ${config.server.env}
   • Frontend URL: ${config.server.frontendUrl}

🔗 API Endpoints:
   • Health Check: http://localhost:${config.server.port}/health
   • Authentication: http://localhost:${config.server.port}/api/auth
   • Auctions: http://localhost:${config.server.port}/api/auctions
   • Payments: http://localhost:${config.server.port}/api/payments

⚡ Real-time Features:
   • Socket.IO: Enabled for live bidding
   • CORS Origin: ${config.socket.corsOrigin}

🛡️ Security:
   • Rate Limiting: ${config.rateLimit.maxRequests} requests per ${config.rateLimit.windowMs / 60000} minutes
   • Helmet: Security headers enabled
   • CORS: Configured for frontend

📝 Ready to accept connections!
      `);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

export { app, server, socketService };
