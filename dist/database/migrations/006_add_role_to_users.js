"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function up(knex) {
    await knex.schema.alterTable('users', (table) => {
        table.string('role', 50).defaultTo('user');
        table.index('role');
    });
    const existingAdmin = await knex('users').where('email', 'admin@auction.com').first();
    if (!existingAdmin) {
        const adminPassword = await bcryptjs_1.default.hash('admin123', 12);
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
    }
    else {
        await knex('users')
            .where('email', 'admin@auction.com')
            .update({ role: 'admin' });
    }
}
async function down(knex) {
    await knex('users').where('email', 'admin@auction.com').del();
    await knex.schema.alterTable('users', (table) => {
        table.dropColumn('role');
    });
}
//# sourceMappingURL=006_add_role_to_users.js.map