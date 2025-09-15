"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    return knex.schema.createTable('banners', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('title').notNullable();
        table.string('subtitle');
        table.text('description').notNullable();
        table.string('image_url').notNullable();
        table.string('gradient').defaultTo('from-blue-600 to-purple-700');
        table.string('accent').defaultTo('text-blue-300');
        table.string('button_text').defaultTo('Start Bidding 🚀');
        table.string('button_link');
        table.boolean('is_active').defaultTo(true);
        table.integer('order_index').defaultTo(0);
        table.timestamps(true, true);
    });
}
async function down(knex) {
    return knex.schema.dropTable('banners');
}
//# sourceMappingURL=006_create_banners_table.js.map