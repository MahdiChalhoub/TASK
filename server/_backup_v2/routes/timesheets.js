const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all timesheets
router.get('/', (req, res) => {
    db.all(`SELECT t.*, u.username, ta.title as task_title 
            FROM timesheets t 
            LEFT JOIN users u ON t.user_id = u.id 
            LEFT JOIN tasks ta ON t.task_id = ta.id 
            ORDER BY t.created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create timesheet entry
router.post('/', (req, res) => {
    const { user_id, task_id, start_time, end_time, duration, description } = req.body;
    db.run(`INSERT INTO timesheets (user_id, task_id, start_time, end_time, duration, description) VALUES (?, ?, ?, ?, ?, ?)`,
        [user_id, task_id, start_time, end_time, duration, description],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, success: true });
        }
    );
});

module.exports = router;
