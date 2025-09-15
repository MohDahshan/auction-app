const knex = require('knex');

const knexConfig = {
  client: 'postgresql',
  connection: process.env.DATABASE_URL || 'postgresql://dahshan@localhost:5432/auction_app',
  pool: {
    min: 2,
    max: 10,
  },
};

const db = knex(knexConfig);

const banners = [
  {
    id: '1',
    title: 'Get Your Favorite iPhone',
    subtitle: 'At Unbeatable Prices!',
    description: 'Bid smart and win the latest iPhone 15 Pro for up to 80% off retail price',
    image_url: 'https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg',
    gradient: 'from-blue-600 to-purple-700',
    accent: 'text-blue-300',
    button_text: 'Start Bidding 🚀',
    button_link: '',
    is_active: true,
    order_index: 0,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: '2',
    title: 'Premium Gaming Setup',
    subtitle: 'Power Up Your Gaming!',
    description: 'Win high-end gaming PCs and accessories at incredible auction prices',
    image_url: 'https://images.pexels.com/photos/2047905/pexels-photo-2047905.jpeg',
    gradient: 'from-green-600 to-emerald-700',
    accent: 'text-green-300',
    button_text: 'Start Bidding 🚀',
    button_link: '',
    is_active: true,
    order_index: 1,
    created_at: new Date(),
    updated_at: new Date()
  }
];

async function insertBanners() {
  try {
    console.log('🔄 Connecting to database...');
    await db.raw('SELECT 1');
    console.log('✅ Database connected successfully');
    
    console.log('🔄 Deleting existing banners...');
    await db('banners').del();
    
    console.log('🔄 Inserting new banners...');
    await db('banners').insert(banners);
    
    console.log('✅ Banners inserted successfully into PostgreSQL database');
    
    // Verify insertion
    const insertedBanners = await db('banners').select('*');
    console.log(`📊 Total banners in database: ${insertedBanners.length}`);
    insertedBanners.forEach(banner => {
      console.log(`   - ${banner.title} (Active: ${banner.is_active})`);
    });
    
    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error inserting banners:', error);
    await db.destroy();
    process.exit(1);
  }
}

insertBanners();
