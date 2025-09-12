import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data
  await knex('transactions').del();
  await knex('bids').del();
  await knex('auctions').del();
  await knex('products').del();
  await knex('users').del();

  // Insert sample users
  const users = await knex('users').insert([
    {
      email: 'admin@auction.com',
      password_hash: '$2a$12$6Ed4EUtaTNiWgz5MHv32C.gMQBe4TqVLIBhzJwr1p8FVOeyxiU5v.', // password: admin123
      name: 'Admin User',
      phone: '+1234567890',
      wallet_balance: 10000,
      is_active: true,
      email_verified: true
    },
    {
      email: 'john@example.com',
      password_hash: '$2a$12$6Ed4EUtaTNiWgz5MHv32C.gMQBe4TqVLIBhzJwr1p8FVOeyxiU5v.', // password: admin123
      name: 'John Doe',
      phone: '+1234567891',
      wallet_balance: 1500,
      is_active: true,
      email_verified: true
    },
    {
      email: 'jane@example.com',
      password_hash: '$2a$12$6Ed4EUtaTNiWgz5MHv32C.gMQBe4TqVLIBhzJwr1p8FVOeyxiU5v.', // password: admin123
      name: 'Jane Smith',
      phone: '+1234567892',
      wallet_balance: 2000,
      is_active: true,
      email_verified: true
    },
    {
      email: 'mike@example.com',
      password_hash: '$2a$12$6Ed4EUtaTNiWgz5MHv32C.gMQBe4TqVLIBhzJwr1p8FVOeyxiU5v.', // password: admin123
      name: 'Mike Johnson',
      phone: '+1234567893',
      wallet_balance: 800,
      is_active: true,
      email_verified: true
    }
  ]).returning('*');

  // Insert sample products
  const products = await knex('products').insert([
    {
      name: 'iPhone 15 Pro Max',
      description: 'Latest Apple iPhone with advanced camera system and A17 Pro chip',
      image_url: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500',
      market_price: 1199,
      category: 'Electronics',
      brand: 'Apple',
      specifications: JSON.stringify({
        storage: '256GB',
        color: 'Natural Titanium',
        display: '6.7-inch Super Retina XDR',
        camera: '48MP Main + 12MP Ultra Wide + 12MP Telephoto'
      }),
      is_active: true
    },
    {
      name: 'MacBook Pro 16"',
      description: 'Powerful laptop with M3 Pro chip, perfect for professionals',
      image_url: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=500',
      market_price: 2499,
      category: 'Electronics',
      brand: 'Apple',
      specifications: JSON.stringify({
        processor: 'M3 Pro chip',
        memory: '18GB unified memory',
        storage: '512GB SSD',
        display: '16.2-inch Liquid Retina XDR'
      }),
      is_active: true
    },
    {
      name: 'Gaming PC Setup',
      description: 'High-end gaming computer with RTX 4080 and latest components',
      image_url: 'https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=500',
      market_price: 3500,
      category: 'Electronics',
      brand: 'Custom Build',
      specifications: JSON.stringify({
        cpu: 'Intel i7-13700K',
        gpu: 'NVIDIA RTX 4080',
        ram: '32GB DDR5',
        storage: '1TB NVMe SSD'
      }),
      is_active: true
    },
    {
      name: 'Sony WH-1000XM5',
      description: 'Premium noise-canceling wireless headphones',
      image_url: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=500',
      market_price: 399,
      category: 'Electronics',
      brand: 'Sony',
      specifications: JSON.stringify({
        type: 'Over-ear wireless',
        battery: '30 hours',
        features: 'Active Noise Canceling, Quick Charge',
        connectivity: 'Bluetooth 5.2'
      }),
      is_active: true
    },
    {
      name: 'iPad Pro 12.9"',
      description: 'Professional tablet with M2 chip and Liquid Retina XDR display',
      image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500',
      market_price: 1099,
      category: 'Electronics',
      brand: 'Apple',
      specifications: JSON.stringify({
        processor: 'M2 chip',
        storage: '256GB',
        display: '12.9-inch Liquid Retina XDR',
        connectivity: 'Wi-Fi 6E + 5G'
      }),
      is_active: true
    }
  ]).returning('*');

  // Calculate auction times
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Insert sample auctions
  const auctions = await knex('auctions').insert([
    {
      product_id: products[0].id, // iPhone 15 Pro Max
      title: 'iPhone 15 Pro Max - Natural Titanium',
      description: 'Brand new iPhone 15 Pro Max in pristine condition. Get the latest Apple technology at an unbeatable price!',
      entry_fee: 50,
      min_wallet: 100,
      starting_bid: 50,
      start_time: now,
      end_time: oneHourFromNow,
      status: 'live',
      total_participants: 3,
      total_bids: 5
    },
    {
      product_id: products[1].id, // MacBook Pro
      title: 'MacBook Pro 16" - M3 Pro Chip',
      description: 'Professional-grade laptop perfect for developers and creators. Includes original packaging and warranty.',
      entry_fee: 100,
      min_wallet: 200,
      starting_bid: 100,
      start_time: now,
      end_time: twoHoursFromNow,
      status: 'live',
      total_participants: 2,
      total_bids: 3
    },
    {
      product_id: products[2].id, // Gaming PC
      title: 'Ultimate Gaming PC - RTX 4080',
      description: 'Custom-built gaming powerhouse. Ready to handle any game at maximum settings. Includes RGB lighting setup.',
      entry_fee: 150,
      min_wallet: 300,
      starting_bid: 150,
      start_time: now,
      end_time: twoHoursFromNow,
      status: 'live',
      total_participants: 4,
      total_bids: 8
    },
    {
      product_id: products[3].id, // Sony Headphones
      title: 'Sony WH-1000XM5 - Premium Audio',
      description: 'Industry-leading noise cancellation with exceptional sound quality. Perfect for music lovers and professionals.',
      entry_fee: 25,
      min_wallet: 50,
      starting_bid: 25,
      start_time: threeDaysFromNow,
      end_time: new Date(threeDaysFromNow.getTime() + 2 * 60 * 60 * 1000),
      status: 'upcoming',
      total_participants: 0,
      total_bids: 0
    },
    {
      product_id: products[4].id, // iPad Pro
      title: 'iPad Pro 12.9" - M2 Chip',
      description: 'Professional tablet with stunning display and powerful performance. Includes Apple Pencil compatibility.',
      entry_fee: 75,
      min_wallet: 150,
      starting_bid: 75,
      start_time: oneDayAgo,
      end_time: new Date(oneDayAgo.getTime() + 2 * 60 * 60 * 1000),
      status: 'ended',
      winner_id: users[1].id, // John Doe wins
      final_bid: 245,
      total_participants: 3,
      total_bids: 7
    }
  ]).returning('*');

  // Insert sample bids for live auctions
  await knex('bids').insert([
    // iPhone auction bids
    {
      auction_id: auctions[0].id,
      user_id: users[1].id, // John Doe
      amount: 75,
      is_winning: false,
      bid_time: new Date(now.getTime() - 30 * 60 * 1000) // 30 minutes ago
    },
    {
      auction_id: auctions[0].id,
      user_id: users[2].id, // Jane Smith
      amount: 95,
      is_winning: false,
      bid_time: new Date(now.getTime() - 20 * 60 * 1000) // 20 minutes ago
    },
    {
      auction_id: auctions[0].id,
      user_id: users[3].id, // Mike Johnson
      amount: 120,
      is_winning: true,
      bid_time: new Date(now.getTime() - 10 * 60 * 1000) // 10 minutes ago
    },

    // MacBook auction bids
    {
      auction_id: auctions[1].id,
      user_id: users[1].id, // John Doe
      amount: 150,
      is_winning: false,
      bid_time: new Date(now.getTime() - 45 * 60 * 1000) // 45 minutes ago
    },
    {
      auction_id: auctions[1].id,
      user_id: users[2].id, // Jane Smith
      amount: 200,
      is_winning: true,
      bid_time: new Date(now.getTime() - 25 * 60 * 1000) // 25 minutes ago
    },

    // Gaming PC auction bids
    {
      auction_id: auctions[2].id,
      user_id: users[1].id, // John Doe
      amount: 200,
      is_winning: false,
      bid_time: new Date(now.getTime() - 50 * 60 * 1000) // 50 minutes ago
    },
    {
      auction_id: auctions[2].id,
      user_id: users[2].id, // Jane Smith
      amount: 250,
      is_winning: false,
      bid_time: new Date(now.getTime() - 35 * 60 * 1000) // 35 minutes ago
    },
    {
      auction_id: auctions[2].id,
      user_id: users[3].id, // Mike Johnson
      amount: 300,
      is_winning: false,
      bid_time: new Date(now.getTime() - 20 * 60 * 1000) // 20 minutes ago
    },
    {
      auction_id: auctions[2].id,
      user_id: users[0].id, // Admin User
      amount: 350,
      is_winning: true,
      bid_time: new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes ago
    },

    // Ended iPad auction bids
    {
      auction_id: auctions[4].id,
      user_id: users[1].id, // John Doe (winner)
      amount: 245,
      is_winning: true,
      bid_time: new Date(oneDayAgo.getTime() + 90 * 60 * 1000) // 1.5 hours after start
    },
    {
      auction_id: auctions[4].id,
      user_id: users[2].id, // Jane Smith
      amount: 200,
      is_winning: false,
      bid_time: new Date(oneDayAgo.getTime() + 60 * 60 * 1000) // 1 hour after start
    },
    {
      auction_id: auctions[4].id,
      user_id: users[3].id, // Mike Johnson
      amount: 150,
      is_winning: false,
      bid_time: new Date(oneDayAgo.getTime() + 30 * 60 * 1000) // 30 minutes after start
    }
  ]);

  // Insert sample transactions
  await knex('transactions').insert([
    // Entry fees for live auctions
    {
      user_id: users[1].id,
      auction_id: auctions[0].id,
      type: 'entry_fee',
      amount: -50,
      description: 'Entry fee for iPhone 15 Pro Max auction',
      status: 'completed'
    },
    {
      user_id: users[2].id,
      auction_id: auctions[0].id,
      type: 'entry_fee',
      amount: -50,
      description: 'Entry fee for iPhone 15 Pro Max auction',
      status: 'completed'
    },
    {
      user_id: users[3].id,
      auction_id: auctions[0].id,
      type: 'entry_fee',
      amount: -50,
      description: 'Entry fee for iPhone 15 Pro Max auction',
      status: 'completed'
    },

    // Bid transactions
    {
      user_id: users[3].id,
      auction_id: auctions[0].id,
      type: 'bid',
      amount: -120,
      description: 'Bid placed in iPhone 15 Pro Max auction',
      status: 'completed'
    },
    {
      user_id: users[2].id,
      auction_id: auctions[1].id,
      type: 'bid',
      amount: -200,
      description: 'Bid placed in MacBook Pro auction',
      status: 'completed'
    },
    {
      user_id: users[0].id,
      auction_id: auctions[2].id,
      type: 'bid',
      amount: -350,
      description: 'Bid placed in Gaming PC auction',
      status: 'completed'
    },

    // Sample coin purchases
    {
      user_id: users[1].id,
      type: 'purchase',
      amount: 500,
      description: 'Purchase 500 coins',
      status: 'completed',
      stripe_payment_intent_id: 'pi_sample_123456789'
    },
    {
      user_id: users[2].id,
      type: 'purchase',
      amount: 1000,
      description: 'Purchase 1000 coins',
      status: 'completed',
      stripe_payment_intent_id: 'pi_sample_987654321'
    }
  ]);

  console.log('✅ Sample data seeded successfully!');
  console.log('📧 Test user credentials:');
  console.log('   Email: admin@auction.com | Password: admin123');
  console.log('   Email: john@example.com | Password: admin123');
  console.log('   Email: jane@example.com | Password: admin123');
  console.log('   Email: mike@example.com | Password: admin123');
}
