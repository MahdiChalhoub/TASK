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
    const orgId = req.headers['x-org-id'] || req.query.orgId || (req.body && req.body.orgId);

    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID required' });
    }

    if (!req.user || !req.user.id) {
        console.error('[DEBUG] checkOrgMembership: req.user is missing');
        return res.status(401).json({ error: 'User not authenticated' });
    }

    db.get('SELECT role FROM organization_members WHERE org_id = ? AND user_id = ?',
        [orgId, req.user.id],
        (err, member) => {
            if (err) {
                console.error('[DEBUG] Database error in checkOrgMembership:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (!member) return res.status(403).json({ error: 'Not a member of this organization' });

            req.orgId = orgId;
            req.userRole = member.role;
            next();
        }
    );
};

// Get report status for a date
router.get('/status/:date', requireAuth, checkOrgMembership, (req, res) => {
    const { date } = req.params;

    db.get(`
        SELECT * FROM daily_reports
        WHERE user_id = ? AND org_id = ? AND report_date = ?
    `, [req.user.id, req.orgId, date], (err, report) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        res.json({
            hasReport: !!report,
            report: report || null
        });
    });
});

// Get report data for submission (tasks + time)
router.get('/data/:date', requireAuth, checkOrgMembership, (req, res) => {
    const { date } = req.params;

    // Get completed tasks for the day
    console.log(`[DEBUG] GET /data/${date} - User: ${req.user.id}, Org: ${req.orgId}`);
    db.all(`
        SELECT t.*, c.name as category_name
        FROM tasks t
        LEFT JOIN task_categories c ON t.category_id = c.id
        WHERE t.assigned_to_user_id = ? AND t.org_id = ?
        AND DATE(t.completed_at) = ?
        AND t.status = 'completed'
    `, [req.user.id, req.orgId, date], (err, tasks) => {
        if (err) {
            console.error('[DEBUG] Error fetching tasks:', err);
            return res.status(500).json({ error: 'Failed to fetch tasks' });
        }

        // Get time entries for the day
        db.all(`
            SELECT te.*, t.title as task_title
            FROM time_entries te
            LEFT JOIN tasks t ON te.task_id = t.id
            WHERE te.user_id = ? AND te.org_id = ? AND te.date = ?
            ORDER BY te.created_at ASC
        `, [req.user.id, req.orgId, date], (err2, timeEntries) => {
            if (err2) {
                console.error('[DEBUG] Error fetching time entries:', err2);
                return res.status(500).json({ error: 'Failed to fetch time entries' });
            }

            const totalMinutes = timeEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);

            // Log before fetching assignments
            console.log('[DEBUG] Fetching assigned forms...');

            // Fetch active forms for user
            db.all(`
                SELECT DISTINCT rf.*
                FROM report_forms rf
                LEFT JOIN report_form_assignments rfa ON rf.id = rfa.form_id
                WHERE rf.org_id = ? AND rf.is_active = 1
                AND (
                    rfa.id IS NULL
                    OR (rfa.target_type = 'user' AND rfa.target_id = ?)
                    OR (rfa.target_type = 'role' AND rfa.target_role = ?)
                    OR (rfa.target_type = 'group' AND rfa.target_id IN (
                        SELECT group_id FROM user_group_members WHERE user_id = ?
                    ))
                )
                ORDER BY rf.created_at DESC
            `, [req.orgId, req.user.id, req.userRole, req.user.id], (err3, assignedForms) => {
                if (err3) {
                    console.error('[DEBUG] Error fetching assigned forms:', err3);
                    return res.status(500).json({ error: 'Failed to fetch assigned forms' });
                }

                res.json({
                    tasks,
                    timeEntries,
                    totalMinutes,
                    assignedForms
                });
            });
        });
    });
});

// Submit daily report
router.post('/submit', requireAuth, checkOrgMembership, (req, res) => {
    const { report_date, extra_work_items } = req.body;

    if (!report_date) {
        return res.status(400).json({ error: 'Report date required' });
    }

    // Check if day session exists
    db.get(`
        SELECT * FROM time_entries
        WHERE user_id = ? AND org_id = ? AND date = ? AND type = 'day_session'
    `, [req.user.id, req.orgId, report_date], (err, daySession) => {
        if (!daySession) {
            return res.status(400).json({ error: 'Must clock in for the day before submitting report' });
        }

        // Check if report already exists
        db.get(`
            SELECT * FROM daily_reports
            WHERE user_id = ? AND org_id = ? AND report_date = ?
        `, [req.user.id, req.orgId, report_date], (err, existing) => {
            if (existing) {
                return res.status(400).json({ error: 'Report already submitted for this date' });
            }

            // Create the report
            console.log(`[DEBUG] Creating report for User: ${req.user.id}, Date: ${report_date}`);
            db.run(`
                INSERT INTO daily_reports (org_id, user_id, report_date, status)
                VALUES (?, ?, ?, 'submitted')
            `, [req.orgId, req.user.id, report_date], function (err) {
                if (err) {
                    console.error('[DEBUG] Error creating report:', err);
                    return res.status(500).json({ error: 'Failed to create report' });
                }

                const reportId = this.lastID;

                // Add extra work items if provided
                if (extra_work_items && extra_work_items.length > 0) {
                    const stmt = db.prepare(`
                        INSERT INTO daily_report_extra_work (report_id, description, duration_minutes)
                        VALUES (?, ?, ?)
                    `);

                    extra_work_items.forEach(item => {
                        stmt.run(reportId, item.description, item.duration_minutes || 0);
                    });

                    stmt.finalize();
                }

                // Add form answers if provided
                if (req.body.form_answers && req.body.form_answers.length > 0) {
                    const stmtAnswers = db.prepare(`
                        INSERT INTO daily_report_answers (daily_report_id, question_id, answer_text, answer_choices_json)
                        VALUES (?, ?, ?, ?)
                    `);

                    req.body.form_answers.forEach(ans => {
                        stmtAnswers.run(
                            reportId,
                            ans.question_id,
                            ans.answer_text || null,
                            ans.answer_choices_json ? JSON.stringify(ans.answer_choices_json) : null
                        );
                    });

                    stmtAnswers.finalize();
                }

                // Return the created report with full data
                db.get(`
                    SELECT dr.*, u.name as user_name, u.email as user_email
                    FROM daily_reports dr
                    LEFT JOIN users u ON dr.user_id = u.id
                    WHERE dr.id = ?
                `, [reportId], (err, report) => {
                    res.json(report);
                });
            });
        });
    });
});

// Get report history
router.get('/history', requireAuth, checkOrgMembership, (req, res) => {
    const { limit = 30 } = req.query;

    db.all(`
        SELECT dr.*, u.name as user_name
        FROM daily_reports dr
        LEFT JOIN users u ON dr.user_id = u.id
        WHERE dr.user_id = ? AND dr.org_id = ?
        ORDER BY dr.report_date DESC
        LIMIT ?
    `, [req.user.id, req.orgId, limit], (err, reports) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(reports);
    });
});

// Get single report with details
router.get('/:id', requireAuth, checkOrgMembership, (req, res) => {
    const { id } = req.params;

    db.get(`
        SELECT dr.*, u.name as user_name, u.email as user_email
        FROM daily_reports dr
        LEFT JOIN users u ON dr.user_id = u.id
        WHERE dr.id = ? AND dr.org_id = ?
    `, [id, req.orgId], (err, report) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!report) return res.status(404).json({ error: 'Report not found' });

        // Check permissions
        if (report.user_id !== req.user.id && !['admin', 'owner', 'leader'].includes(req.userRole)) {
            return res.status(403).json({ error: 'Cannot view other users reports' });
        }

        // Get extra work items
        db.all(`
            SELECT * FROM daily_report_extra_work
            WHERE report_id = ?
        `, [id], (err2, extraWork) => {
            if (err2) return res.status(500).json({ error: 'Failed to fetch extra work' });

            // Get tasks completed that day
            db.all(`
                SELECT t.*, c.name as category_name
                FROM tasks t
                LEFT JOIN task_categories c ON t.category_id = c.id
                WHERE t.assigned_to_user_id = ? AND t.org_id = ?
                AND DATE(t.completed_at) = ?
                AND t.status = 'completed'
            `, [report.user_id, req.orgId, report.report_date], (err3, tasks) => {
                if (err3) return res.status(500).json({ error: 'Failed to fetch tasks' });

                // Get time entries
                db.all(`
                    SELECT te.*, t.title as task_title
                    FROM time_entries te
                    LEFT JOIN tasks t ON te.task_id = t.id
                    WHERE te.user_id = ? AND te.org_id = ? AND te.date = ?
                    ORDER BY te.created_at ASC
                `, [report.user_id, req.orgId, report.report_date], (err4, timeEntries) => {
                    if (err4) return res.status(500).json({ error: 'Failed to fetch time entries' });

                    res.json({
                        ...report,
                        extra_work: extraWork,
                        tasks,
                        time_entries: timeEntries
                    });
                });
            });
        });
    });
});

// Delete report (only if status is 'draft' or user is admin/owner)
router.delete('/:id', requireAuth, checkOrgMembership, (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM daily_reports WHERE id = ? AND org_id = ?', [id, req.orgId], (err, report) => {
        if (!report) return res.status(404).json({ error: 'Report not found' });

        // Check permissions
        if (report.user_id !== req.user.id && !['admin', 'owner'].includes(req.userRole)) {
            return res.status(403).json({ error: 'Cannot delete other users reports' });
        }

        if (report.status === 'approved' && !['admin', 'owner'].includes(req.userRole)) {
            return res.status(403).json({ error: 'Cannot delete approved reports' });
        }

        // Delete extra work items first
        db.run('DELETE FROM daily_report_extra_work WHERE report_id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to delete extra work' });

            // Delete report
            db.run('DELETE FROM daily_reports WHERE id = ? AND org_id = ?', [id, req.orgId], (err) => {
                if (err) return res.status(500).json({ error: 'Failed to delete report' });
                res.json({ message: 'Report deleted' });
            });
        });
    });
});

module.exports = router;
