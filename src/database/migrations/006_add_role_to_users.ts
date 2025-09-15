import { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function up(knex: Knex): Promise<void> {
  // Add role column to users table
  await knex.schema.alterTable('users', (table) => {
    table.string('role', 50).defaultTo('user');
    table.index('role');
  });

  // Create admin user if not exists
  const existingAdmin = await knex('users').where('email', 'admin@auction.com').first();
  
  if (!existingAdmin) {
    const adminPassword = await bcrypt.hash('admin123', 12);
    
    await knex('users').insert({
      email: 'admin@auction.com',
      password_hash: adminPassword,
      name: 'Admin User',
      phone: '+1234567890',
      wallet_balance: 10000,
      role: 'admin',
      is_active: true,
      email_verified: true
    });
  } else {
    // Update existing user to admin role
    await knex('users')
      .where('email', 'admin@auction.com')
      .update({ role: 'admin' });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Remove admin user
  await knex('users').where('email', 'admin@auction.com').del();
  
  // Remove role column
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('role');
  });
}
