import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('auction_id').references('id').inTable('auctions').onDelete('SET NULL');
    table.enum('type', ['purchase', 'bid', 'refund', 'win', 'entry_fee']).notNullable();
    table.integer('amount').notNullable();
    table.text('description');
    table.enum('status', ['pending', 'completed', 'failed', 'cancelled']).defaultTo('completed');
    table.string('stripe_payment_intent_id');
    table.json('metadata');
    table.timestamps(true, true);
    
    // Indexes
    table.index('user_id');
    table.index('auction_id');
    table.index('type');
    table.index('status');
    table.index('created_at');
    table.index('stripe_payment_intent_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('transactions');
}
