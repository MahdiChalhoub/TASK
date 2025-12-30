const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

let db;
const isProd = !!process.env.DATABASE_URL;

console.log(`[DB] Initializing Database Mode: ${isProd ? 'PostgreSQL' : 'SQLite'}`);

if (isProd) {
    // ==========================================
    // PostgreSQL (Production)
    // ==========================================
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    // Test Connection
    pool.connect((err, client, release) => {
        if (err) {
            console.error('[DB] PostgreSQL Connection Error:', err.message);
        } else {
            console.log('[DB] PostgreSQL Connected Successfully');
            release();
            initDbPostgres(db);
        }
    });

    db = {
        pool: pool,
        // Wrapper for db.run (Execute)
        run: function (sql, params = [], callback) {
            if (!pool) return callback(new Error("DB Pool Not Ready"));

            // Convert ? to $1, $2, etc.
            let i = 0;
            const pgSql = sql.replace(/\?/g, () => `$${++i}`);
            const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
            const query = isInsert ? `${pgSql} RETURNING id` : pgSql;

            pool.query(query, params, (err, res) => {
                if (err) {
                    console.error('[DB] Query Error:', err.message);
                    if (callback) callback(err);
                    return;
                }

                // Emulate sqlite 'this' context for lastID
                const context = {
                    lastID: (isInsert && res.rows[0]) ? res.rows[0].id : 0,
                    changes: res.rowCount
                };
                if (callback) callback.call(context, null, context.lastID);
            });
        },
        // Wrapper for db.all (Select Many)
        all: function (sql, params = [], callback) {
            if (!pool) return callback(new Error("DB Pool Not Ready"));

            let i = 0;
            const pgSql = sql.replace(/\?/g, () => `$${++i}`);

            pool.query(pgSql, params, (err, res) => {
                if (err) {
                    console.error('[DB] Query Error:', err.message);
                    if (callback) callback(err);
                } else {
                    if (callback) callback(null, res.rows);
                }
            });
        },
        // Wrapper for db.get (Select One)
        get: function (sql, params = [], callback) {
            if (!pool) return callback(new Error("DB Pool Not Ready"));

            let i = 0;
            const pgSql = sql.replace(/\?/g, () => `$${++i}`);

            pool.query(pgSql, params, (err, res) => {
                if (err) {
                    console.error('[DB] Query Error:', err.message);
                    if (callback) callback(err);
                } else {
                    if (callback) callback(null, res.rows[0]);
                }
            });
        }
    };

} else {
    // ==========================================
    // SQLite (Development)
    // ==========================================
    const dbPath = path.resolve(__dirname, 'virtualoffice.db');
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('[DB] SQLite Error:', err.message);
        else {
            console.log('[DB] SQLite Connected.');
            initDbSqlite(db);
        }
    });
}

// ==========================================
// Initialization Logic (create tables)
// ==========================================
async function initDbPostgres(database) {
    try {
        console.log('[DB] Starting Schema Sync...');

        // Users
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                google_id VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Organizations
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS organizations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                join_code VARCHAR(50) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Members
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS organization_members (
                id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organizations(id),
                user_id INTEGER REFERENCES users(id),
                role VARCHAR(50) DEFAULT 'employee',
                UNIQUE(org_id, user_id)
            )
        `);

        // Categories
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS task_categories (
                id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organizations(id),
                name VARCHAR(255) NOT NULL,
                sort_order INTEGER DEFAULT 0,
                leader_user_id INTEGER REFERENCES users(id)
            )
        `);

        // Tasks
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organizations(id),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                priority VARCHAR(20) DEFAULT 'medium',
                due_date TIMESTAMP,
                category_id INTEGER,
                assigned_to_user_id INTEGER,
                created_by_user_id INTEGER,
                estimated_minutes INTEGER DEFAULT 0,
                require_finish_time INTEGER DEFAULT 0,
                completed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('[DB] Schema Sync Complete.');

        // Ensure 'assigned_to_user_id' is nullable (Fix for strict setups)
        try {
            await database.pool.query('ALTER TABLE tasks ALTER COLUMN assigned_to_user_id DROP NOT NULL');
            console.log('[DB] Enforced nullable assigned_to_user_id');
        } catch (e) { /* ignore */ }

    } catch (err) {
        console.error('[DB] Schema Init Failed:', err);
    }
}

function initDbSqlite(database) {
    database.serialize(() => {
        database.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, name TEXT, google_id TEXT, password_hash TEXT)`);
        database.run(`CREATE TABLE IF NOT EXISTS organizations (id INTEGER PRIMARY KEY, name TEXT, join_code TEXT)`);
        database.run(`CREATE TABLE IF NOT EXISTS organization_members (id INTEGER PRIMARY KEY, org_id INTEGER, user_id INTEGER, role TEXT)`);
        database.run(`CREATE TABLE IF NOT EXISTS task_categories (id INTEGER PRIMARY KEY, org_id INTEGER, name TEXT, sort_order INTEGER)`);
        database.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY, org_id INTEGER, title TEXT, description TEXT, status TEXT, 
            priority TEXT, due_date TEXT, category_id INTEGER, assigned_to_user_id INTEGER, 
            created_by_user_id INTEGER, estimated_minutes INTEGER, require_finish_time INTEGER, 
            completed_at TEXT, created_at TEXT, updated_at TEXT
        )`);
    });
}

module.exports = db;
