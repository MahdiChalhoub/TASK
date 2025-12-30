const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

let db;
const isProd = !!process.env.DATABASE_URL;

console.log(`[DB] Initializing Database Mode: ${isProd ? 'PostgreSQL' : 'SQLite'}`);

if (isProd) {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    pool.connect((err, client, release) => {
        if (err) console.error('[DB] PostgreSQL Connection Error:', err.message);
        else {
            console.log('[DB] PostgreSQL Connected Successfully');
            release();
            initDbPostgres(db);
        }
    });

    db = {
        pool,
        run: function (sql, params = [], callback) {
            if (!pool) return callback(new Error("DB Pool Not Ready"));
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
                const context = {
                    lastID: (isInsert && res.rows[0]) ? res.rows[0].id : 0,
                    changes: res.rowCount
                };
                if (callback) callback.call(context, null, context.lastID);
            });
        },
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
// DB RESET & INIT (Production)
// ==========================================
async function initDbPostgres(database) {
    try {
        console.log('[DB] Syncing Schema for NEW Architecture...');

        // --- HARD RESET FOR SCHEMA UPDATE (User Requested "Delete All Tasks") ---
        // We preserve USERS and ORGANIZATIONS so logins still work.
        await database.pool.query('DROP TABLE IF EXISTS tasks CASCADE');
        await database.pool.query('DROP TABLE IF EXISTS time_sheets CASCADE');
        await database.pool.query('DROP TABLE IF EXISTS time_entries CASCADE');
        await database.pool.query('DROP TABLE IF EXISTS daily_reports CASCADE');
        await database.pool.query('DROP TABLE IF EXISTS checklists CASCADE');
        await database.pool.query('DROP TABLE IF EXISTS checklist_submissions CASCADE');
        await database.pool.query('DROP TABLE IF EXISTS crm_contacts CASCADE');
        console.log('[DB] Dropped volatile tables for Schema Reset.');
        // -----------------------------------------------------------------------

        // 1. Users & Hierarchy
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                google_id VARCHAR(255) UNIQUE,
                role VARCHAR(50) DEFAULT 'employee', 
                reports_to_user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Organizations
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS organizations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                join_code VARCHAR(50) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Members
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS organization_members (
                id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organizations(id),
                user_id INTEGER REFERENCES users(id),
                role VARCHAR(50) DEFAULT 'employee',
                UNIQUE(org_id, user_id)
            )
        `);

        // 4. Task Categories
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS task_categories (
                id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organizations(id),
                name VARCHAR(255) NOT NULL,
                sort_order INTEGER DEFAULT 0
            )
        `);

        // 5. TASKS (The Core)
        // Types: 'fast', 'normal', 'action'
        // Status: 'pending', 'in_progress', 'waiting', 'completed', 'failed'
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organizations(id),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                
                type VARCHAR(20) DEFAULT 'normal', 
                status VARCHAR(20) DEFAULT 'pending',
                priority VARCHAR(20) DEFAULT 'medium',
                
                -- Planning & Timing
                planned_date DATE,
                due_date TIMESTAMP,
                estimated_minutes INTEGER DEFAULT 0,
                
                -- Task Assignment
                assigned_to_user_id INTEGER REFERENCES users(id),
                created_by_user_id INTEGER REFERENCES users(id),
                
                -- Action Task Results
                result_text TEXT,
                result_attachment_url TEXT,
                
                -- Alarm Settings (JSON for start/end/interval)
                is_alarmed BOOLEAN DEFAULT FALSE,
                alarm_config JSONB,

                -- State Tracking
                is_late BOOLEAN DEFAULT FALSE,
                completed_at TIMESTAMP,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 6. TIME SHEETS (Daily Log)
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS time_sheets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                date DATE NOT NULL,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                rest_minutes INTEGER DEFAULT 0,
                idle_minutes INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'active', -- active, submitted, approved
                notes TEXT,
                UNIQUE(user_id, date)
            )
        `);

        // 7. TIME ENTRIES (Granular Task Timing)
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS time_entries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                task_id INTEGER REFERENCES tasks(id),
                date DATE NOT NULL,
                start_at TIMESTAMP,
                end_at TIMESTAMP,
                duration_minutes INTEGER,
                type VARCHAR(20) DEFAULT 'task' -- task, manual, break
            )
        `);

        // 8. DAILY REPORTS
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS daily_reports (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                date DATE NOT NULL,
                content JSONB, -- Answers to daily questions
                status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed
                reviewed_by_user_id INTEGER REFERENCES users(id),
                ai_summary TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 9. CHECKLISTS (Tache List)
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS checklists (
                id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organizations(id),
                title VARCHAR(255) NOT NULL,
                is_template BOOLEAN DEFAULT TRUE,
                items JSONB -- Array of items like ["Turn on lamp", "Check AC"]
            )
        `);

        // 10. CHECKLIST SUBMISSIONS
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS checklist_submissions (
                id SERIAL PRIMARY KEY,
                checklist_id INTEGER REFERENCES checklists(id),
                user_id INTEGER REFERENCES users(id),
                date DATE,
                items_completed JSONB, -- Array of indices or item names completed
                evidence_photo_url TEXT,
                status VARCHAR(20) DEFAULT 'submitted'
            )
        `);

        // 11. CRM CONTACTS
        await database.pool.query(`
            CREATE TABLE IF NOT EXISTS crm_contacts (
                id SERIAL PRIMARY KEY,
                org_id INTEGER REFERENCES organizations(id),
                name VARCHAR(255) NOT NULL,
                type VARCHAR(20), -- client, supplier
                stage VARCHAR(50) DEFAULT 'new', -- new, contacted, deal, lost
                last_contact_date DATE,
                next_follow_up_date DATE,
                assigned_to_user_id INTEGER REFERENCES users(id),
                notes TEXT
            )
        `);

        console.log('[DB] Schema Sync Complete. System Ready.');

    } catch (err) {
        console.error('[DB] Schema Init Failed:', err);
    }
}

function initDbSqlite(database) {
    // SQLite Development Schema ( Simplified/Corresponding to Postgres)
    database.serialize(() => {
        database.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT, name TEXT, google_id TEXT, role TEXT, reports_to_user_id INTEGER)`);
        database.run(`CREATE TABLE IF NOT EXISTS organizations (id INTEGER PRIMARY KEY, name TEXT, join_code TEXT)`);
        database.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, org_id INTEGER, title TEXT, type TEXT, status TEXT, priority TEXT, assigned_to_user_id INTEGER)`);
        // ... (Other tables would be added here for dev parity)
    });
}

module.exports = db;
