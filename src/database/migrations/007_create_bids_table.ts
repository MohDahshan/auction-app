exports.up = async function(knex) {
  await knex.schema.createTable('bids', (table) => {
    table.increments('id').primary();
    table.integer('auction_id').unsigned().notNullable().references('id').inTable('auctions').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.decimal('amount', 12, 2).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['auction_id']);
    table.index(['user_id']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('bids');
};
