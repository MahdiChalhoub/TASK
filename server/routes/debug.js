const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/migrate', (req, res) => {
    const migrations = [
        "ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER DEFAULT 0",
        "ALTER TABLE tasks ADD COLUMN require_finish_time INTEGER DEFAULT 1",
        "CREATE TABLE IF NOT EXISTS user_settings (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, org_id INTEGER NOT NULL, task_due_date_cutoff_hour INTEGER DEFAULT 15, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, org_id))",
        "ALTER TABLE users ADD COLUMN password_hash TEXT",
        "ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE"
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
