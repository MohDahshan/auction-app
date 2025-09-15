"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    return knex.schema.createTable('users', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('email', 255).unique().notNullable();
        table.string('password_hash', 255).notNullable();
        table.string('name', 255).notNullable();
        table.string('phone', 50);
        table.integer('wallet_balance').defaultTo(500);
        table.string('avatar_url', 500);
        table.boolean('is_active').defaultTo(true);
        table.boolean('email_verified').defaultTo(false);
        table.timestamp('last_login_at');
        table.timestamps(true, true);
        table.index('email');
        table.index('created_at');
    });
}
async function down(knex) {
    return knex.schema.dropTable('users');
}
//# sourceMappingURL=001_create_users_table.js.map