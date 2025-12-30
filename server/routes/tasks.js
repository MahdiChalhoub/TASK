const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, checkOrgMembership } = require('../middleware');

// ==========================================
// UTILS
// ==========================================
const PLANNING_CUTOFF_HOUR = 14; // 2pm cutoff for auto-scheduling

function calculateDueDate(reqDate) {
    const now = new Date();
    // If current time > 14:00, plan for tomorrow?
    // User requirement: "tasks added after that are auto-planned for the next day"
    if (now.getHours() >= PLANNING_CUTOFF_HOUR) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0); // Start of next day
        return tomorrow;
    }
    return now; // Today
}

// ==========================================
// GET /api/tasks - List Tasks
// ==========================================
router.get('/', requireAuth, checkOrgMembership, (req, res) => {
    const { status, type, priority, assigned_to, date_from, date_to } = req.query;
    const orgId = req.orgId;

    let query = `
        SELECT t.*, 
               u.name as assigned_to_name, 
               c.name as category_name
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to_user_id = u.id
        LEFT JOIN task_categories c ON t.category_id = c.id
        WHERE t.org_id = ?
    `;
    const params = [orgId];

    if (status) { query += ' AND t.status = ?'; params.push(status); }
    if (type) { query += ' AND t.type = ?'; params.push(type); }
    if (priority) { query += ' AND t.priority = ?'; params.push(priority); }
    if (assigned_to) { query += ' AND t.assigned_to_user_id = ?'; params.push(assigned_to); }

    // Sort by Due Date (Planning Rule: By Date)
    query += ' ORDER BY t.due_date ASC, t.priority DESC'; // Oldest due first (Urgent)

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('[GET Tasks] Error:', err);
            return res.json([]);
        }
        res.json(rows);
    });
});

// ==========================================
// POST /api/tasks - Create Task
// ==========================================
router.post('/', requireAuth, checkOrgMembership, (req, res) => {
    try {
        const {
            title, description, type = 'normal', priority = 'medium',
            assigned_to_user_id, category_id,
            is_alarmed, alarm_config, estimated_minutes
        } = req.body;

        if (!title) return res.status(400).json({ error: 'Title required' });

        // Logic 1: Planning Rules
        // If not Fast Task, check Auto-Schedule
        let finalDueDate = req.body.due_date;
        if (!finalDueDate && type !== 'fast') {
            finalDueDate = calculateDueDate().toISOString();
        }

        // Logic 2: Fast Task (Auto-Complete)
        let finalStatus = 'pending';
        let completedAt = null;
        let finalEstMinutes = estimated_minutes || 0;

        if (type === 'fast') {
            finalStatus = 'completed';
            completedAt = new Date().toISOString();
            finalEstMinutes = 1; // "<= 1 minute"
        }

        const safeOrgId = parseInt(req.orgId) || 1;
        const safeAssignedTo = assigned_to_user_id ? parseInt(assigned_to_user_id) : parseInt(req.user.id); // Default to self

        const sql = `
            INSERT INTO tasks (
                org_id, title, description, 
                type, status, priority, 
                due_date, estimated_minutes,
                category_id, assigned_to_user_id, created_by_user_id,
                is_alarmed, alarm_config,
                completed_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        const params = [
            safeOrgId,
            title,
            description || '',
            type,
            finalStatus,
            priority,
            finalDueDate,
            finalEstMinutes,
            category_id || null,
            safeAssignedTo,
            req.user.id,
            !!is_alarmed,
            alarm_config ? JSON.stringify(alarm_config) : null,
            completedAt
        ];

        db.run(sql, params, function (err) {
            if (err) {
                console.error('[Create Task] Error:', err);
                return res.status(500).json({ error: 'Create Failed', details: err.message });
            }

            const newTaskId = this.lastID;

            // Logic 3: If Fast Task -> Create Time Entry Instantly
            if (type === 'fast') {
                const now = new Date();
                const today = now.toISOString().split('T')[0];
                db.run(`
                    INSERT INTO time_entries (
                        user_id, task_id, date, start_at, end_at, duration_minutes, type
                    ) VALUES (?, ?, ?, ?, ?, 1, 'task')
                `, [safeAssignedTo, newTaskId, today, now.toISOString(), now.toISOString()]);

                // Also update User's Daily TimeSheet? (Optional, usually aggregated)
            }

            // Return Task
            db.get('SELECT * FROM tasks WHERE id = ?', [newTaskId], (err, task) => {
                res.status(201).json(task || { id: newTaskId });
            });
        });

    } catch (e) {
        console.error('[Create Task] Crash:', e);
        res.status(500).json({ error: 'Server Crash' });
    }
});

// ==========================================
// PATCH /api/tasks/:id/complete - Smart Complete
// ==========================================
router.patch('/:id/complete', requireAuth, checkOrgMembership, (req, res) => {
    const taskId = req.params.id;
    const { actual_minutes, result_text, result_attachment_url } = req.body; // For Normal/Action tasks

    db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
        if (!task) return res.status(404).json({ error: 'Not found' });

        // Logic: Action Task requires Result
        if (task.type === 'action' && (!result_text && !result_attachment_url)) {
            // But we allow partial updates? 
            // Strict rule: "User must submit reply/result text"
            if (!result_text) return res.status(400).json({ error: 'Action Tasks require a result text.' });
        }

        const now = new Date();
        const updates = [
            'status = \'completed\'',
            'completed_at = CURRENT_TIMESTAMP',
            'updated_at = CURRENT_TIMESTAMP'
        ];
        const params = [];

        if (result_text) { updates.push('result_text = ?'); params.push(result_text); }
        if (result_attachment_url) { updates.push('result_attachment_url = ?'); params.push(result_attachment_url); }

        params.push(taskId);

        db.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
            if (err) return res.status(500).json({ error: 'Update Failed' });

            // Log Time Entry
            if (actual_minutes > 0) {
                const today = now.toISOString().split('T')[0];
                db.run(`
                    INSERT INTO time_entries (
                        user_id, task_id, date, start_at, end_at, duration_minutes, type
                    ) VALUES (?, ?, ?, ?, ?, ?, 'task')
                `, [req.user.id, taskId, today, now.toISOString(), now.toISOString(), actual_minutes]);
            }

            res.json({ success: true, taskId });
        });
    });
});

// ==========================================
// DELETE
// ==========================================
router.delete('/:id', requireAuth, checkOrgMembership, (req, res) => {
    db.run('DELETE FROM tasks WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Delete Failed' });
        res.json({ success: true });
    });
});

module.exports = router;
