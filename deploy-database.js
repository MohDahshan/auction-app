const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// This script will set up your database on Neon PostgreSQL
// Usage: node deploy-database.js <NEON_DATABASE_URL>

async function deployDatabase() {
  const databaseUrl = process.argv[2];
  
  if (!databaseUrl) {
    console.error('❌ Please provide the Neon database URL as an argument');
    console.error('Usage: node deploy-database.js "postgresql://username:password@host/database?sslmode=require"');
    process.exit(1);
  }

  console.log('🚀 Starting database deployment to Neon...');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon PostgreSQL');

    // Read and execute migrations in order
    const migrationsDir = path.join(__dirname, 'src/database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    console.log('📋 Running migrations...');
    for (const file of migrationFiles) {
      if (file.endsWith('.ts')) {
        console.log(`  Running ${file}...`);
        
        // Convert TypeScript migration to SQL
        const migrationPath = path.join(migrationsDir, file);
        const migrationContent = fs.readFileSync(migrationPath, 'utf8');
        
        // Extract SQL from TypeScript migration files
        const sql = extractSQLFromMigration(file, migrationContent);
        
        if (sql) {
          await client.query(sql);
          console.log(`  ✅ ${file} completed`);
        }
      }
    }

    // Run seed data
    console.log('🌱 Seeding database...');
    const seedData = generateSeedSQL();
    await client.query(seedData);
    console.log('✅ Database seeded successfully');

    console.log('🎉 Database deployment completed successfully!');
    console.log('📝 Your database is ready at:', databaseUrl.split('@')[1].split('?')[0]);

  } catch (error) {
    console.error('❌ Database deployment failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

function extractSQLFromMigration(filename, content) {
  // Convert TypeScript migrations to SQL
  switch (filename) {
    case '001_create_users_table.ts':
      return `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          wallet_balance INTEGER DEFAULT 500,
          avatar_url VARCHAR(500),
          is_active BOOLEAN DEFAULT true,
          email_verified BOOLEAN DEFAULT false,
          last_login_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
      `;

    case '002_create_products_table.ts':
      return `
        CREATE TABLE IF NOT EXISTS products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          image_url VARCHAR(500),
          market_price INTEGER NOT NULL,
          category VARCHAR(100),
          brand VARCHAR(100),
          specifications JSON,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
        CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
        CREATE INDEX IF NOT EXISTS idx_products_market_price ON products(market_price);
        CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
      `;

    case '003_create_auctions_table.ts':
      return `
        CREATE TABLE IF NOT EXISTS auctions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          product_id UUID REFERENCES products(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          entry_fee INTEGER NOT NULL,
          min_wallet INTEGER NOT NULL,
          starting_bid INTEGER DEFAULT 50,
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP NOT NULL,
          status VARCHAR(50) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'ended', 'cancelled')),
          winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
          final_bid INTEGER,
          total_participants INTEGER DEFAULT 0,
          total_bids INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_auctions_product_id ON auctions(product_id);
        CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
        CREATE INDEX IF NOT EXISTS idx_auctions_start_time ON auctions(start_time);
        CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions(end_time);
        CREATE INDEX IF NOT EXISTS idx_auctions_winner_id ON auctions(winner_id);
        CREATE INDEX IF NOT EXISTS idx_auctions_created_at ON auctions(created_at);
      `;

    case '004_create_bids_table.ts':
      return `
        CREATE TABLE IF NOT EXISTS bids (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL,
          is_winning BOOLEAN DEFAULT false,
          bid_time TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_bids_auction_id ON bids(auction_id);
        CREATE INDEX IF NOT EXISTS idx_bids_user_id ON bids(user_id);
        CREATE INDEX IF NOT EXISTS idx_bids_amount ON bids(amount);
        CREATE INDEX IF NOT EXISTS idx_bids_created_at ON bids(created_at);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_bids_auction_user ON bids(auction_id, user_id);
      `;

    case '005_create_transactions_table.ts':
      return `
        CREATE TABLE IF NOT EXISTS transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          auction_id UUID REFERENCES auctions(id) ON DELETE SET NULL,
          type VARCHAR(50) NOT NULL CHECK (type IN ('purchase', 'bid', 'refund', 'win', 'entry_fee')),
          amount INTEGER NOT NULL,
          description TEXT,
          status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
          stripe_payment_intent_id VARCHAR(255),
          metadata JSON,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_auction_id ON transactions(auction_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
        CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
        CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
      `;

    default:
      return null;
  }
}

function generateSeedSQL() {
  return `
    -- Insert sample users
    INSERT INTO users (id, email, password_hash, name, phone, wallet_balance) VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'admin@auction.com', '$2a$12$6Ed4EUtaTNiWgz5MHv32C.gMQBe4TqVLIBhzJwr1p8FVOeyxiU5v.', 'Admin User', '+1234567890', 1000),
    ('550e8400-e29b-41d4-a716-446655440001', 'john@example.com', '$2a$12$6Ed4EUtaTNiWgz5MHv32C.gMQBe4TqVLIBhzJwr1p8FVOeyxiU5v.', 'John Doe', '+1234567891', 750),
    ('550e8400-e29b-41d4-a716-446655440002', 'jane@example.com', '$2a$12$6Ed4EUtaTNiWgz5MHv32C.gMQBe4TqVLIBhzJwr1p8FVOeyxiU5v.', 'Jane Smith', '+1234567892', 500)
    ON CONFLICT (email) DO NOTHING;

    -- Insert sample products
    INSERT INTO products (id, name, description, image_url, market_price, category, brand) VALUES
    ('660e8400-e29b-41d4-a716-446655440000', 'iPhone 15 Pro', 'Latest iPhone with advanced features', 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400', 999, 'Electronics', 'Apple'),
    ('660e8400-e29b-41d4-a716-446655440001', 'MacBook Air M2', 'Powerful laptop for professionals', 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400', 1299, 'Electronics', 'Apple'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Sony WH-1000XM4', 'Premium noise-canceling headphones', 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400', 349, 'Electronics', 'Sony'),
    ('660e8400-e29b-41d4-a716-446655440003', 'Nike Air Jordan 1', 'Classic basketball sneakers', 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400', 170, 'Fashion', 'Nike'),
    ('660e8400-e29b-41d4-a716-446655440004', 'Rolex Submariner', 'Luxury diving watch', 'https://images.unsplash.com/photo-1523170335258-f5c6c6bd6eaf?w=400', 8500, 'Luxury', 'Rolex')
    ON CONFLICT (id) DO NOTHING;

    -- Insert sample auctions
    INSERT INTO auctions (id, product_id, title, description, entry_fee, min_wallet, starting_bid, start_time, end_time, status) VALUES
    ('770e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 'iPhone 15 Pro Auction', 'Brand new iPhone 15 Pro in original packaging', 50, 100, 50, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 'live'),
    ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'MacBook Air M2 Auction', 'Latest MacBook Air with M2 chip', 75, 150, 75, NOW() + INTERVAL '1 hour', NOW() + INTERVAL '4 hours', 'upcoming'),
    ('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', 'Sony Headphones Auction', 'Premium noise-canceling headphones', 25, 50, 25, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour', 'ended')
    ON CONFLICT (id) DO NOTHING;

    -- Insert sample bids
    INSERT INTO bids (auction_id, user_id, amount, is_winning) VALUES
    ('770e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', 75, true),
    ('770e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440002', 60, false),
    ('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 45, true)
    ON CONFLICT (auction_id, user_id) DO NOTHING;

    -- Insert sample transactions
    INSERT INTO transactions (user_id, auction_id, type, amount, description, status) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440000', 'entry_fee', -50, 'Entry fee for iPhone 15 Pro Auction', 'completed'),
    ('550e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440000', 'bid', -75, 'Bid placed in iPhone 15 Pro Auction', 'completed'),
    ('550e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440000', 'entry_fee', -50, 'Entry fee for iPhone 15 Pro Auction', 'completed')
    ON CONFLICT DO NOTHING;
  `;
}

// Run the deployment
deployDatabase().catch(console.error);
