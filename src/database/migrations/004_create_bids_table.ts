import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('bids', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('auction_id').references('id').inTable('auctions').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.integer('amount').notNullable();
    table.boolean('is_winning').defaultTo(false);
    table.timestamp('bid_time').defaultTo(knex.fn.now());
    table.timestamps(true, true);
    
    // Indexes
    table.index('auction_id');
    table.index('user_id');
    table.index('amount');
    table.index('bid_time');
    table.index(['auction_id', 'amount']);
    table.index(['auction_id', 'user_id']);
    
    // Unique constraint to prevent duplicate bids from same user in same auction
    table.unique(['auction_id', 'user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('bids');
}
