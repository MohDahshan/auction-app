import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('auctions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('product_id').references('id').inTable('products').onDelete('CASCADE');
    table.string('title', 255).notNullable();
    table.text('description');
    table.integer('entry_fee').notNullable();
    table.integer('min_wallet').notNullable();
    table.integer('starting_bid').defaultTo(50);
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').notNullable();
    table.enum('status', ['upcoming', 'live', 'ended', 'cancelled']).defaultTo('upcoming');
    table.uuid('winner_id').references('id').inTable('users').onDelete('SET NULL');
    table.integer('final_bid');
    table.integer('total_participants').defaultTo(0);
    table.integer('total_bids').defaultTo(0);
    table.timestamps(true, true);
    
    // Indexes
    table.index('product_id');
    table.index('status');
    table.index('start_time');
    table.index('end_time');
    table.index('winner_id');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('auctions');
}
