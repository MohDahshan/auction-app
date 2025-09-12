# Auction App Backend

A complete backend API for the auction application built with Node.js, Express, TypeScript, PostgreSQL, and Socket.IO.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with refresh tokens
- **Real-time Bidding**: Socket.IO for live auction updates
- **Payment Processing**: Stripe integration for coin purchases
- **Database**: PostgreSQL with Knex.js ORM
- **Security**: Helmet, CORS, rate limiting, input validation
- **TypeScript**: Full type safety throughout the application

## 📋 Prerequisites

Before running the backend, make sure you have:

- **Node.js** (v18 or higher)
- **PostgreSQL** (v13 or higher)
- **Redis** (optional, for caching)
- **Stripe Account** (for payments)

## 🛠️ Installation

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/auction_app
   
   # JWT Secrets (IMPORTANT: Change these in production!)
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-refresh-token-secret
   
   # Stripe (Get from your Stripe dashboard)
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   
   # Server
   PORT=3001
   FRONTEND_URL=http://localhost:5173
   ```

3. **Set up the database**:
   ```bash
   # Create database
   createdb auction_app
   
   # Run migrations
   npm run migrate
   
   # Seed sample data
   npm run seed
   ```

## 🏃‍♂️ Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

The server will start on `http://localhost:3001`

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "phone": "+1234567890"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

### Auction Endpoints

#### Get All Auctions
```http
GET /api/auctions?status=live&page=1&limit=20
```

#### Get Single Auction
```http
GET /api/auctions/:id
```

#### Join Auction
```http
POST /api/auctions/:id/join
Authorization: Bearer <access_token>
```

#### Place Bid
```http
POST /api/auctions/:id/bid
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "amount": 150
}
```

### Payment Endpoints

#### Create Payment Intent
```http
POST /api/payments/create-intent
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "amount": 500,
  "currency": "usd"
}
```

#### Get Coin Packages
```http
GET /api/payments/packages
```

#### Get Payment History
```http
GET /api/payments/history?page=1&limit=20
Authorization: Bearer <access_token>
```

## 🔌 Socket.IO Events

### Client to Server Events

#### Join Auction
```javascript
socket.emit('auction:join', { auctionId: 'auction-uuid' });
```

#### Place Bid
```javascript
socket.emit('auction:bid', { 
  auctionId: 'auction-uuid', 
  amount: 150 
});
```

#### Leave Auction
```javascript
socket.emit('auction:leave', { auctionId: 'auction-uuid' });
```

### Server to Client Events

#### Auction Joined
```javascript
socket.on('auction:joined', (auctionData) => {
  // Handle auction data
});
```

#### New Bid
```javascript
socket.on('auction:new_bid', ({ bid, auction }) => {
  // Update UI with new bid
});
```

#### User Outbid
```javascript
socket.on('user:outbid', ({ auctionId, newBidAmount, message }) => {
  // Show outbid notification
});
```

#### Auction Ended
```javascript
socket.on('auction:ended', ({ auction, winner }) => {
  // Handle auction end
});
```

## 🗄️ Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `password_hash` (String)
- `name` (String)
- `phone` (String, Optional)
- `wallet_balance` (Integer, Default: 500)
- `is_active` (Boolean, Default: true)
- `email_verified` (Boolean, Default: false)
- `created_at`, `updated_at` (Timestamps)

### Products Table
- `id` (UUID, Primary Key)
- `name` (String)
- `description` (Text)
- `image_url` (String)
- `market_price` (Integer)
- `category` (String)
- `brand` (String)
- `specifications` (JSON)
- `is_active` (Boolean, Default: true)
- `created_at`, `updated_at` (Timestamps)

### Auctions Table
- `id` (UUID, Primary Key)
- `product_id` (UUID, Foreign Key)
- `title` (String)
- `description` (Text)
- `entry_fee` (Integer)
- `min_wallet` (Integer)
- `starting_bid` (Integer, Default: 50)
- `start_time`, `end_time` (Timestamps)
- `status` (Enum: upcoming, live, ended, cancelled)
- `winner_id` (UUID, Foreign Key, Optional)
- `final_bid` (Integer, Optional)
- `total_participants`, `total_bids` (Integer, Default: 0)
- `created_at`, `updated_at` (Timestamps)

### Bids Table
- `id` (UUID, Primary Key)
- `auction_id` (UUID, Foreign Key)
- `user_id` (UUID, Foreign Key)
- `amount` (Integer)
- `is_winning` (Boolean, Default: false)
- `bid_time` (Timestamp)
- `created_at`, `updated_at` (Timestamps)

### Transactions Table
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `auction_id` (UUID, Foreign Key, Optional)
- `type` (Enum: purchase, bid, refund, win, entry_fee)
- `amount` (Integer)
- `description` (Text)
- `status` (Enum: pending, completed, failed, cancelled)
- `stripe_payment_intent_id` (String, Optional)
- `metadata` (JSON)
- `created_at`, `updated_at` (Timestamps)

## 🧪 Sample Data

The seed file creates sample data including:

### Test Users
- **Admin**: `admin@auction.com` / `admin123`
- **John Doe**: `john@example.com` / `admin123`
- **Jane Smith**: `jane@example.com` / `admin123`
- **Mike Johnson**: `mike@example.com` / `admin123`

### Sample Auctions
- **Live Auctions**: iPhone 15 Pro Max, MacBook Pro 16", Gaming PC
- **Upcoming Auctions**: Sony WH-1000XM5 Headphones
- **Ended Auctions**: iPad Pro 12.9" (with winner)

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start           # Start production server

# Database
npm run migrate     # Run database migrations
npm run seed        # Seed sample data
npm run migrate:rollback  # Rollback last migration

# Testing
npm test           # Run tests (when implemented)
```

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with configurable rounds
- **Rate Limiting**: Prevents API abuse
- **CORS**: Configured for frontend domain
- **Helmet**: Security headers
- **Input Validation**: express-validator for request validation
- **SQL Injection Protection**: Knex.js query builder

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_URL=postgresql://prod-user:prod-pass@prod-host:5432/auction_prod
JWT_SECRET=your-production-jwt-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
STRIPE_SECRET_KEY=sk_live_your_live_stripe_key
FRONTEND_URL=https://your-frontend-domain.com
```

### Deployment Steps

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Set up production database**:
   ```bash
   npm run migrate
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

## 📝 Development Notes

### Adding New Features

1. **Database Changes**: Create migrations in `src/database/migrations/`
2. **API Routes**: Add routes in `src/routes/`
3. **Types**: Update interfaces in `src/types/index.ts`
4. **Socket Events**: Extend `src/services/socketService.ts`

### Code Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── database/        # Migrations and seeds
│   ├── middleware/      # Express middleware
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic services
│   ├── types/           # TypeScript type definitions
│   └── server.ts        # Main server file
├── dist/                # Compiled JavaScript (generated)
└── package.json
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**:
   - Check PostgreSQL is running
   - Verify DATABASE_URL in .env
   - Ensure database exists

2. **TypeScript Errors**:
   - Run `npm install` to ensure all dependencies are installed
   - Check tsconfig.json configuration

3. **Socket.IO Connection Issues**:
   - Verify CORS settings
   - Check frontend Socket.IO client configuration

4. **Stripe Webhook Issues**:
   - Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3001/api/payments/webhook`
   - Verify webhook secret in environment variables

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the API documentation
3. Check server logs for detailed error messages

## 🔄 Next Steps

To complete the full-stack application:

1. **Connect Frontend**: Update your React app to use these API endpoints
2. **Real-time Integration**: Implement Socket.IO client in your frontend
3. **Payment Integration**: Set up Stripe Elements in your payment components
4. **Testing**: Add comprehensive test coverage
5. **Monitoring**: Set up logging and monitoring for production

The backend is now fully functional and ready to power your auction application! 🎉
