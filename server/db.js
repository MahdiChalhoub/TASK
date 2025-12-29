const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { Pool } = require('pg');

// Check if we are in production (Postgres) or development (SQLite)
const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;

let db;

if (isProduction) {
    console.log('🔌 Connecting to PostgreSQL...');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    // Wrapper to make Postgres behave like sqlite3
    db = {
        pool,
        serialize: (cb) => cb(), // No-op for PG
        run: function (sql, params = [], callback) {
            // Convert ? to $1, $2...
            let i = 0;
            const pgSql = sql.replace(/\?/g, () => `$${++i}`);

            // Handle INSERT for lastID
            const isInsert = /^\s*INSERT/i.test(pgSql);
            const queryToRun = isInsert ? `${pgSql} RETURNING id` : pgSql;

            pool.query(queryToRun, params, (err, res) => {
                if (err) {
                    console.error('PG Error (Run):', err.message, queryToRun);
                    if (callback) callback(err);
                    return;
                }

                // Emulate 'this' context for sqlite3 callbacks
                const context = {
                    lastID: isInsert && res.rows[0] ? res.rows[0].id : null,
                    changes: res.rowCount
                };

                if (callback) {
                    // Pass lastID as second arg just in case 'this' fails
                    callback.call(context, null, context.lastID);
                }
            });
        },
        get: function (sql, params = [], callback) {
            let i = 0;
            const pgSql = sql.replace(/\?/g, () => `$${++i}`);

            pool.query(pgSql, params, (err, res) => {
                if (err) {
                    console.error('PG Error (Get):', err.message, pgSql);
                    if (callback) callback(err);
                } else {
                    if (callback) callback(null, res.rows[0]);
                }
            });
        },
        all: function (sql, params = [], callback) {
            let i = 0;
            const pgSql = sql.replace(/\?/g, () => `$${++i}`);

            pool.query(pgSql, params, (err, res) => {
                if (err) {
                    console.error('PG Error (All):', err.message, pgSql);
                    if (callback) callback(err);
                } else {
                    if (callback) callback(null, res.rows);
                }
            });
        }
    };

    // Initialize Schema for Postgres
    initDbPostgres(db);

} else {
    // SQLite (Development)
    const dbPath = path.resolve(__dirname, 'virtualoffice.db');
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database', err.message);
        } else {
            console.log('Connected to the SQLite database.');
            initDbSqlite(db);
        }
    });
}

function initDbSqlite(database) {
    database.serialize(() => {
        database.run(`CREATE TABLE IF NOT EXISTS organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            join_code TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        database.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            google_id TEXT UNIQUE,
            password_hash TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Migration: Add password_hash if detailed auth is enabled later
        database.all("PRAGMA table_info(users)", [], (err, rows) => {
            if (!err && rows) {
                const hasPassword = rows.some(r => r.name === 'password_hash');
                if (!hasPassword) {
                    database.run("ALTER TABLE users ADD COLUMN password_hash TEXT");
                }
            }
        });

        database.run(`CREATE TABLE IF NOT EXISTS organization_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT CHECK(role IN ('owner', 'admin', 'leader', 'employee')) DEFAULT 'employee',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(org_id, user_id)
        )`);

        database.run(`CREATE TABLE IF NOT EXISTS task_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            leader_user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(leader_user_id) REFERENCES users(id)
        )`);

        database.run(`CREATE TABLE IF NOT EXISTS leader_scope (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            leader_user_id INTEGER NOT NULL,
            member_user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(leader_user_id) REFERENCES users(id),
            FOREIGN KEY(member_user_id) REFERENCES users(id),
            UNIQUE(org_id, leader_user_id, member_user_id)
        )`);

        database.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
            priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
            due_date DATE,
            category_id INTEGER,
            assigned_to_user_id INTEGER NOT NULL,
            created_by_user_id INTEGER NOT NULL,
            estimated_minutes INTEGER DEFAULT 0,
            completed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(category_id) REFERENCES task_categories(id),
            FOREIGN KEY(assigned_to_user_id) REFERENCES users(id),
            FOREIGN KEY(created_by_user_id) REFERENCES users(id)
        )`);

        database.run(`CREATE TABLE IF NOT EXISTS time_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            type TEXT CHECK(type IN ('day_session', 'task_timer', 'manual', 'auto_task_completion')) NOT NULL,
            task_id INTEGER,
            start_at DATETIME,
            end_at DATETIME,
            duration_minutes INTEGER,
            status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
            reviewer_user_id INTEGER,
            review_note TEXT,
            auto_created_from_task BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(task_id) REFERENCES tasks(id),
            FOREIGN KEY(reviewer_user_id) REFERENCES users(id)
        )`);

        database.run(`CREATE TABLE IF NOT EXISTS holidays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(org_id, user_id, date)
        )`);

        database.run(`CREATE TABLE IF NOT EXISTS task_activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            task_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            action_type TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            actual_minutes INTEGER,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(task_id) REFERENCES tasks(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);
    });
}

async function initDbPostgres(dbWrapper) {
    // Postgres DDL
    const createTableQueries = [
        `CREATE TABLE IF NOT EXISTS organizations (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            join_code TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            google_id TEXT UNIQUE,
            password_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS organization_members (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL REFERENCES organizations(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            role TEXT CHECK(role IN ('owner', 'admin', 'leader', 'employee')) DEFAULT 'employee',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(org_id, user_id)
        )`,
        `CREATE TABLE IF NOT EXISTS leader_scope (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL REFERENCES organizations(id),
            leader_user_id INTEGER NOT NULL REFERENCES users(id),
            member_user_id INTEGER NOT NULL REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(org_id, leader_user_id, member_user_id)
        )`,
        `CREATE TABLE IF NOT EXISTS task_categories (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL REFERENCES organizations(id),
            name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            leader_user_id INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL REFERENCES organizations(id),
            title TEXT NOT NULL,
            description TEXT,
            status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
            priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
            due_date DATE,
            category_id INTEGER REFERENCES task_categories(id),
            assigned_to_user_id INTEGER NOT NULL REFERENCES users(id),
            created_by_user_id INTEGER NOT NULL REFERENCES users(id),
            estimated_minutes INTEGER DEFAULT 0,
            require_finish_time INTEGER DEFAULT 1,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS task_activity_log (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL REFERENCES organizations(id),
            task_id INTEGER NOT NULL REFERENCES tasks(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            action_type TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            actual_minutes INTEGER,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS time_entries (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL REFERENCES organizations(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            date DATE NOT NULL,
            type TEXT CHECK(type IN ('day_session', 'task_timer', 'manual', 'auto_task_completion')) NOT NULL,
            task_id INTEGER REFERENCES tasks(id),
            start_at TIMESTAMP,
            end_at TIMESTAMP,
            duration_minutes INTEGER,
            status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
            reviewer_user_id INTEGER REFERENCES users(id),
            review_note TEXT,
            auto_created_from_task BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS user_settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            org_id INTEGER NOT NULL REFERENCES organizations(id),
            task_due_date_cutoff_hour INTEGER DEFAULT 15,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, org_id)
        )`,
        `CREATE TABLE IF NOT EXISTS holidays (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL REFERENCES organizations(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            date DATE NOT NULL,
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(org_id, user_id, date)
        )`,
        `CREATE TABLE IF NOT EXISTS report_forms (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL REFERENCES organizations(id),
            title TEXT NOT NULL,
            is_published BOOLEAN DEFAULT FALSE,
            created_by_user_id INTEGER NOT NULL REFERENCES users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS report_fields (
            id SERIAL PRIMARY KEY,
            form_id INTEGER NOT NULL REFERENCES report_forms(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            label TEXT NOT NULL,
            options TEXT,
            required BOOLEAN DEFAULT FALSE,
            sort_order INTEGER DEFAULT 0
        )`,
        `CREATE TABLE IF NOT EXISTS report_params (
            id SERIAL PRIMARY KEY,
            form_id INTEGER NOT NULL REFERENCES report_forms(id) ON DELETE CASCADE,
            param_type TEXT NOT NULL,
            param_key TEXT NOT NULL,
            param_value TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS daily_reports (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL REFERENCES organizations(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            form_id INTEGER NOT NULL REFERENCES report_forms(id),
            report_date DATE NOT NULL,
            status TEXT CHECK(status IN ('pending', 'submitted', 'reviewed')) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS report_answers (
             id SERIAL PRIMARY KEY,
             report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
             field_id INTEGER NOT NULL REFERENCES report_fields(id),
             answer_text TEXT
        )`
    ];

    console.log("🛠️ Starting Sequential Database Initialization...");

    try {
        for (const query of createTableQueries) {
            await dbWrapper.pool.query(query);
        }
        console.log("✅ All tables initialized successfully.");

        // Migration Checks
        // 1. Password Hash
        const checkPassColumnQuery = `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash'`;
        const passRes = await dbWrapper.pool.query(checkPassColumnQuery);
        if (passRes.rowCount === 0) {
            console.log("Migrating: Adding password_hash to users");
            await dbWrapper.pool.query("ALTER TABLE users ADD COLUMN password_hash TEXT");
        }

        // 2. Google ID
        const checkGoogleColumnQuery = `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='google_id'`;
        const googleRes = await dbWrapper.pool.query(checkGoogleColumnQuery);
        if (googleRes.rowCount === 0) {
            console.log("Migrating: Adding google_id to users");
            await dbWrapper.pool.query("ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE");
        }

        // 3. Tasks Columns
        const checkTasksColumnsQuery = `SELECT column_name FROM information_schema.columns WHERE table_name='tasks'`;
        const taskColsRes = await dbWrapper.pool.query(checkTasksColumnsQuery);
        const columns = taskColsRes.rows.map(r => r.column_name);

        const requiredColumns = [
            { name: 'estimated_minutes', type: 'INTEGER DEFAULT 0' },
            { name: 'require_finish_time', type: 'INTEGER DEFAULT 1' },
            { name: 'assigned_to_user_id', type: 'INTEGER REFERENCES users(id)' },
            { name: 'category_id', type: 'INTEGER REFERENCES task_categories(id)' },
            { name: 'created_by_user_id', type: 'INTEGER REFERENCES users(id)' }
        ];

        for (const col of requiredColumns) {
            if (!columns.includes(col.name)) {
                console.log(`Migrating: Adding ${col.name} to tasks`);
                try {
                    await dbWrapper.pool.query(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.type}`);
                    console.log(`✅ Added column ${col.name}`);
                } catch (e) {
                    console.error(`Error adding column ${col.name}:`, e.message);
                }
            }
        }

        // 3a. Tasks Constraints (Relaxing for Debug/Flexibility)
        try {
            await dbWrapper.pool.query("ALTER TABLE tasks ALTER COLUMN assigned_to_user_id DROP NOT NULL");
            console.log("Migrating: Made assigned_to_user_id Nullable");
        } catch (e) {
            // Ignore if already nullable
        }

        // 4. Seed Task Categories
        try {
            await dbWrapper.pool.query(`
            INSERT INTO task_categories (org_id, name, sort_order) 
            SELECT 1, 'General', 0 
            WHERE NOT EXISTS (SELECT 1 FROM task_categories WHERE org_id = 1 AND name = 'General')
        `);
            console.log("✅ General Category Verified.");
        } catch (e) {
            console.error("Warning: Seeding Category Failed:", e.message);
        }

    } catch (err) {
        console.error("❌ Database Initialization Error:", err);
    }
}; // End initDbPostgres

module.exports = db;
