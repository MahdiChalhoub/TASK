const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Middleware to check if user is member of org
const checkOrgMembership = (req, res, next) => {
    const orgId = req.headers['x-org-id'] || req.query.orgId || req.body.orgId;

    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID required' });
    }

    db.get('SELECT role FROM organization_members WHERE org_id = ? AND user_id = ?',
        [orgId, req.user.id],
        (err, member) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!member) return res.status(403).json({ error: 'Not a member of this organization' });

            req.orgId = orgId;
            req.userRole = member.role;
            next();
        }
    );
};

// Get current day session status
router.get('/day-session/status', requireAuth, checkOrgMembership, (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    db.get(`
        SELECT * FROM time_entries
        WHERE user_id = ? AND org_id = ? AND date = ? AND type = 'day_session'
        ORDER BY id DESC LIMIT 1
    `, [req.user.id, req.orgId, today], (err, session) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        const isClockedIn = session && !session.end_at;
        res.json({
            isClockedIn,
            session: session || null
        });
    });
});

// Clock in (start day)
router.post('/day-session/start', requireAuth, checkOrgMembership, (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    // Check if already clocked in
    db.get(`
        SELECT * FROM time_entries
        WHERE user_id = ? AND org_id = ? AND date = ? AND type = 'day_session' AND end_at IS NULL
    `, [req.user.id, req.orgId, today], (err, existing) => {
        if (existing) {
            return res.status(400).json({ error: 'Already clocked in for today' });
        }

        db.run(`
            INSERT INTO time_entries (org_id, user_id, date, type, start_at, status)
            VALUES (?, ?, ?, 'day_session', CURRENT_TIMESTAMP, 'pending')
        `, [req.orgId, req.user.id, today], function (err) {
            if (err) return res.status(500).json({ error: 'Failed to clock in' });

            db.get('SELECT * FROM time_entries WHERE id = ?', [this.lastID], (err, entry) => {
                res.json(entry);
            });
        });
    });
});

// Clock out (end day)
router.post('/day-session/end', requireAuth, checkOrgMembership, (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    db.get(`
        SELECT * FROM time_entries
        WHERE user_id = ? AND org_id = ? AND date = ? AND type = 'day_session' AND end_at IS NULL
        ORDER BY id DESC LIMIT 1
    `, [req.user.id, req.orgId, today], (err, session) => {
        if (!session) {
            return res.status(400).json({ error: 'No active day session found' });
        }

        // Calculate duration in minutes
        const startTime = new Date(session.start_at);
        const endTime = new Date();
        const durationMinutes = Math.round((endTime - startTime) / 1000 / 60);

        db.run(`
            UPDATE time_entries 
            SET end_at = CURRENT_TIMESTAMP, duration_minutes = ?
            WHERE id = ?
        `, [durationMinutes, session.id], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to clock out' });

            db.get('SELECT * FROM time_entries WHERE id = ?', [session.id], (err, updated) => {
                res.json(updated);
            });
        });
    });
});

// Start task timer
router.post('/task-timer/start', requireAuth, checkOrgMembership, (req, res) => {
    const { task_id } = req.body;
    const today = new Date().toISOString().split('T')[0];

    if (!task_id) {
        return res.status(400).json({ error: 'Task ID required' });
    }

    // Check if day session is active
    db.get(`
        SELECT * FROM time_entries
        WHERE user_id = ? AND org_id = ? AND date = ? AND type = 'day_session' AND end_at IS NULL
    `, [req.user.id, req.orgId, today], (err, daySession) => {
        if (!daySession) {
            return res.status(400).json({ error: 'Must clock in for the day first' });
        }

        // Check if task belongs to user or user has permission
        db.get('SELECT * FROM tasks WHERE id = ? AND org_id = ?', [task_id, req.orgId], (err, task) => {
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }

            if (req.userRole === 'employee' && task.assigned_to_user_id !== req.user.id) {
                return res.status(403).json({ error: 'Cannot track time for tasks not assigned to you' });
            }

            // Check if ANY task timer is already active for this user today, and stop it
            db.get(`
                SELECT * FROM time_entries
                WHERE user_id = ? AND org_id = ? AND date = ? 
                AND type = 'task_timer' AND end_at IS NULL
            `, [req.user.id, req.orgId, today], (err, activeTimer) => {

                const startNewTimer = () => {
                    // Check if already tracking THIS task (edge case if we didn't stop it above, but we stop ALL now)
                    // Actually, if we just stopped the active timer, we are clear to start.
                    // But if the active timer was THIS task, we stopped it and will restart it (effectively a pause/resume or just continued segments).
                    // Ideally we don't want to spin up a million segments if they spam click, but the UI should handle that.
                    // Let's just proceed to insert.

                    db.run(`
                        INSERT INTO time_entries (org_id, user_id, date, type, task_id, start_at, status)
                        VALUES (?, ?, ?, 'task_timer', ?, CURRENT_TIMESTAMP, 'pending')
                    `, [req.orgId, req.user.id, today, task_id], function (err) {
                        if (err) return res.status(500).json({ error: 'Failed to start timer' });

                        db.get(`
                            SELECT te.*, t.title as task_title
                            FROM time_entries te
                            LEFT JOIN tasks t ON te.task_id = t.id
                            WHERE te.id = ?
                        `, [this.lastID], (err, entry) => {
                            res.json(entry);
                        });
                    });
                };

                if (activeTimer) {
                    // Stop the active timer
                    const startTime = new Date(activeTimer.start_at);
                    const endTime = new Date();
                    const durationMinutes = Math.round((endTime - startTime) / 1000 / 60);

                    db.run(`
                        UPDATE time_entries 
                        SET end_at = CURRENT_TIMESTAMP, duration_minutes = ?
                        WHERE id = ?
                    `, [durationMinutes, activeTimer.id], (err) => {
                        if (err) return res.status(500).json({ error: 'Failed to stop previous timer' });
                        // Now start the new one
                        startNewTimer();
                    });
                } else {
                    // No active timer, just start
                    startNewTimer();
                }
            });
        });
    });
});

// Stop task timer
router.post('/task-timer/stop', requireAuth, checkOrgMembership, (req, res) => {
    const { task_id } = req.body;
    const today = new Date().toISOString().split('T')[0];

    db.get(`
        SELECT * FROM time_entries
        WHERE user_id = ? AND org_id = ? AND date = ? AND task_id = ? 
        AND type = 'task_timer' AND end_at IS NULL
        ORDER BY id DESC LIMIT 1
    `, [req.user.id, req.orgId, today, task_id], (err, timer) => {
        if (!timer) {
            return res.status(400).json({ error: 'No active timer found for this task' });
        }

        const startTime = new Date(timer.start_at);
        const endTime = new Date();
        const durationMinutes = Math.round((endTime - startTime) / 1000 / 60);

        db.run(`
            UPDATE time_entries 
            SET end_at = CURRENT_TIMESTAMP, duration_minutes = ?
            WHERE id = ?
        `, [durationMinutes, timer.id], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to stop timer' });

            db.get(`
                SELECT te.*, t.title as task_title
                FROM time_entries te
                LEFT JOIN tasks t ON te.task_id = t.id
                WHERE te.id = ?
            `, [timer.id], (err, updated) => {
                res.json(updated);
            });
        });
    });
});

// Quick log manual time
router.post('/quick-log', requireAuth, checkOrgMembership, (req, res) => {
    const { task_id, duration_minutes, date, description } = req.body;

    if (!duration_minutes || duration_minutes <= 0) {
        return res.status(400).json({ error: 'Valid duration required' });
    }

    const logDate = date || new Date().toISOString().split('T')[0];

    // If task_id provided, verify access
    if (task_id) {
        db.get('SELECT * FROM tasks WHERE id = ? AND org_id = ?', [task_id, req.orgId], (err, task) => {
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }

            if (req.userRole === 'employee' && task.assigned_to_user_id !== req.user.id) {
                return res.status(403).json({ error: 'Cannot log time for tasks not assigned to you' });
            }

            createManualEntry();
        });
    } else {
        createManualEntry();
    }

    function createManualEntry() {
        db.run(`
            INSERT INTO time_entries (
                org_id, user_id, date, type, task_id, duration_minutes, 
                review_note, status
            ) VALUES (?, ?, ?, 'manual', ?, ?, ?, 'pending')
        `, [req.orgId, req.user.id, logDate, task_id || null, duration_minutes, description || null],
            function (err) {
                if (err) return res.status(500).json({ error: 'Failed to log time' });

                db.get(`
                SELECT te.*, t.title as task_title
                FROM time_entries te
                LEFT JOIN tasks t ON te.task_id = t.id
                WHERE te.id = ?
            `, [this.lastID], (err, entry) => {
                    res.json(entry);
                });
            });
    }
});

// Get time history for a date
router.get('/history/:date', requireAuth, checkOrgMembership, (req, res) => {
    const { date } = req.params;

    db.all(`
        SELECT te.*, t.title as task_title, t.status as task_status
        FROM time_entries te
        LEFT JOIN tasks t ON te.task_id = t.id
        WHERE te.user_id = ? AND te.org_id = ? AND te.date = ?
        ORDER BY te.created_at DESC
    `, [req.user.id, req.orgId, date], (err, entries) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(entries);
    });
});

// Get active timers
router.get('/active-timers', requireAuth, checkOrgMembership, (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    db.all(`
        SELECT te.*, t.title as task_title
        FROM time_entries te
        LEFT JOIN tasks t ON te.task_id = t.id
        WHERE te.user_id = ? AND te.org_id = ? AND te.date = ? 
        AND te.end_at IS NULL
        ORDER BY te.created_at DESC
    `, [req.user.id, req.orgId, today], (err, timers) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(timers);
    });
});

// Delete time entry (own entries only, or admin/owner can delete any)
router.delete('/:id', requireAuth, checkOrgMembership, (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM time_entries WHERE id = ? AND org_id = ?', [id, req.orgId], (err, entry) => {
        if (!entry) return res.status(404).json({ error: 'Time entry not found' });

        // Check permissions
        if (entry.user_id !== req.user.id && !['admin', 'owner'].includes(req.userRole)) {
            return res.status(403).json({ error: 'Cannot delete other users time entries' });
        }

        db.run('DELETE FROM time_entries WHERE id = ? AND org_id = ?', [id, req.orgId], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to delete entry' });
            res.json({ message: 'Time entry deleted' });
        });
    });
});

module.exports = router;
