ي const knex = require('knex');

// استخدام الـ production database URL من Railway/Neon
const knexConfig = {
  client: 'postgresql',
  connection: 'postgresql://neondb_owner:npg_mt9YAcrDJ1dV@ep-gentle-wildflower-ad2entot-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  pool: {
    min: 2,
    max: 10,
  },
  ssl: {
    rejectUnauthorized: false
  }
};

const db = knex(knexConfig);

const banners = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
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
    id: '550e8400-e29b-41d4-a716-446655440002',
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
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    title: 'Luxury Watches Collection',
    subtitle: 'Time for Great Deals!',
    description: 'Discover premium watches from top brands at auction prices',
    image_url: 'https://images.pexels.com/photos/190819/pexels-photo-190819.jpeg',
    gradient: 'from-purple-600 to-pink-700',
    accent: 'text-purple-300',
    button_text: 'Start Bidding 🚀',
    button_link: '',
    is_active: true,
    order_index: 2,
    created_at: new Date(),
    updated_at: new Date()
  }
];

async function insertBanners() {
  try {
    console.log('🔄 Connecting to production database (Neon)...');
    await db.raw('SELECT 1');
    console.log('✅ Database connected successfully');
    
    console.log('🔄 Creating banners table if not exists...');
    await db.schema.createTable('banners', (table) => {
      table.uuid('id').primary();
      table.string('title').notNullable();
      table.string('subtitle');
      table.text('description');
      table.string('image_url');
      table.string('gradient');
      table.string('accent');
      table.string('button_text');
      table.string('button_link');
      table.boolean('is_active').defaultTo(true);
      table.integer('order_index').defaultTo(0);
      table.timestamps(true, true);
    }).catch(() => {
      console.log('ℹ️ Table banners already exists');
    });
    
    console.log('🔄 Deleting existing banners...');
    await db('banners').del();
    
    console.log('🔄 Inserting new banners...');
    await db('banners').insert(banners);
    
    console.log('✅ Banners inserted successfully into production database');
    
    // Verify insertion
    const insertedBanners = await db('banners').select('*').orderBy('order_index');
    console.log(`📊 Total banners in database: ${insertedBanners.length}`);
    insertedBanners.forEach(banner => {
      console.log(`   - ${banner.title} (Active: ${banner.is_active}, Order: ${banner.order_index})`);
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
