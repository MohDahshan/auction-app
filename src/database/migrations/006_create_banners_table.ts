import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
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

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('banners');
}
