"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    return knex.schema.createTable('bids', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('auction_id').references('id').inTable('auctions').onDelete('CASCADE');
        table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
        table.integer('amount').notNullable();
        table.boolean('is_winning').defaultTo(false);
        table.timestamp('bid_time').defaultTo(knex.fn.now());
        table.timestamps(true, true);
        table.index('auction_id');
        table.index('user_id');
        table.index('amount');
        table.index('bid_time');
        table.index(['auction_id', 'amount']);
        table.index(['auction_id', 'user_id']);
        table.unique(['auction_id', 'user_id']);
    });
}
async function down(knex) {
    return knex.schema.dropTable('bids');
}
//# sourceMappingURL=004_create_bids_table.js.map