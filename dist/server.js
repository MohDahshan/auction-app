"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketService = exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const config_1 = require("./config");
const database_1 = require("./config/database");
const socketService_1 = require("./services/socketService");
const auth_1 = __importDefault(require("./routes/auth"));
const auctions_1 = __importDefault(require("./routes/auctions"));
const payments_1 = __importDefault(require("./routes/payments"));
const products_1 = __importDefault(require("./routes/products"));
const banners_1 = __importDefault(require("./routes/banners"));
const debug_1 = __importDefault(require("./routes/debug"));
const users_1 = __importDefault(require("./routes/users"));
const transactions_1 = __importDefault(require("./routes/transactions"));
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
exports.server = server;
app.set('trust proxy', 1);
const socketService = new socketService_1.SocketService(server);
exports.socketService = socketService;
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use((0, cors_1.default)({
    origin: [
        config_1.config.server.frontendUrl,
        "https://auction-app-full.vercel.app",
        /^http:\/\/localhost:\d+$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.rateLimit.windowMs,
    max: config_1.config.rateLimit.maxRequests,
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Auction API is running',
        timestamp: new Date().toISOString(),
        environment: config_1.config.server.env
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/auctions', auctions_1.default);
app.use('/api/payments', payments_1.default);
app.use('/api/products', products_1.default);
app.use('/api/banners', banners_1.default);
app.use('/api/users', users_1.default);
app.use('/api/transactions', transactions_1.default);
app.use('/api/debug', debug_1.default);
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(err.status || 500).json({
        success: false,
        error: config_1.config.server.env === 'production'
            ? 'Internal server error'
            : err.message || 'Something went wrong'
    });
});
const gracefulShutdown = async (signal) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
        console.log('HTTP server closed');
        try {
            await (0, database_1.closeConnection)();
            console.log('Database connection closed');
            process.exit(0);
        }
        catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    });
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
const startServer = async () => {
    try {
        const dbConnected = await (0, database_1.testConnection)();
        if (!dbConnected) {
            console.error('Failed to connect to database. Exiting...');
            process.exit(1);
        }
        server.listen(config_1.config.server.port, () => {
            console.log(`
🚀 Auction API Server Started Successfully!

📊 Server Details:
   • Port: ${config_1.config.server.port}
   • Environment: ${config_1.config.server.env}
   • Frontend URL: ${config_1.config.server.frontendUrl}

🔗 API Endpoints:
   • Health Check: http://localhost:${config_1.config.server.port}/health
   • Authentication: http://localhost:${config_1.config.server.port}/api/auth
   • Auctions: http://localhost:${config_1.config.server.port}/api/auctions
   • Payments: http://localhost:${config_1.config.server.port}/api/payments

⚡ Real-time Features:
   • Socket.IO: Enabled for live bidding
   • CORS Origin: ${config_1.config.socket.corsOrigin}

🛡️ Security:
   • Rate Limiting: ${config_1.config.rateLimit.maxRequests} requests per ${config_1.config.rateLimit.windowMs / 60000} minutes
   • Helmet: Security headers enabled
   • CORS: Configured for frontend

📝 Ready to accept connections!
      `);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
startServer();
//# sourceMappingURL=server.js.map