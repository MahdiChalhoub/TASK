const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/migrate', (req, res) => {
    const migrations = [
        "ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER DEFAULT 0",
        "ALTER TABLE tasks ADD COLUMN require_finish_time INTEGER DEFAULT 1",
        "CREATE TABLE IF NOT EXISTS user_settings (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, org_id INTEGER NOT NULL, task_due_date_cutoff_hour INTEGER DEFAULT 15, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, org_id))",
        "ALTER TABLE users ADD COLUMN password_hash TEXT",
        "ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE",
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
        `CREATE TABLE IF NOT EXISTS holidays (
            id SERIAL PRIMARY KEY,
            org_id INTEGER NOT NULL REFERENCES organizations(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            date DATE NOT NULL,
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(org_id, user_id, date)
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

    let results = [];
    let completed = 0;

    migrations.forEach((sql, index) => {
        db.pool.query(sql, (err) => {
            if (err) {
                results.push({ sql: sql.substring(0, 30) + "...", status: "failed", error: err.message });
            } else {
                results.push({ sql: sql.substring(0, 30) + "...", status: "success" });
            }
            completed++;
            if (completed === migrations.length) {
                res.json({ results });
            }
        });
    });
});

router.get('/schema', (req, res) => {
    db.pool.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        ORDER BY table_name, ordinal_position;
    `, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result.rows);
    });
});

module.exports = router;
