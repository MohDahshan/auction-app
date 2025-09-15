"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeConnection = exports.testConnection = exports.db = void 0;
const knex_1 = __importDefault(require("knex"));
const index_1 = require("./index");
const knexConfig = {
    client: 'postgresql',
    connection: index_1.config.database.url,
    pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 60000,
        idleTimeoutMillis: 600000,
    },
    migrations: {
        directory: './src/database/migrations',
        tableName: 'knex_migrations',
    },
    seeds: {
        directory: './src/database/seeds',
    },
};
exports.db = (0, knex_1.default)(knexConfig);
const testConnection = async () => {
    try {
        await exports.db.raw('SELECT 1');
        console.log('✅ Database connection successful');
        return true;
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
};
exports.testConnection = testConnection;
const closeConnection = async () => {
    try {
        await exports.db.destroy();
        console.log('✅ Database connection closed');
    }
    catch (error) {
        console.error('❌ Error closing database connection:', error);
    }
};
exports.closeConnection = closeConnection;
//# sourceMappingURL=database.js.map