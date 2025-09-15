"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    return knex.schema.createTable('products', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('name', 255).notNullable();
        table.text('description');
        table.string('image_url', 500);
        table.integer('market_price').notNullable();
        table.string('category', 100);
        table.string('brand', 100);
        table.json('specifications');
        table.boolean('is_active').defaultTo(true);
        table.timestamps(true, true);
        table.index('category');
        table.index('brand');
        table.index('market_price');
        table.index('created_at');
    });
}
async function down(knex) {
    return knex.schema.dropTable('products');
}
//# sourceMappingURL=002_create_products_table.js.map