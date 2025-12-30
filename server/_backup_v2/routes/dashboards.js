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

// Middleware to require manager role (leader, admin, owner)
const requireManager = (req, res, next) => {
    if (!['leader', 'admin', 'owner'].includes(req.userRole)) {
        return res.status(403).json({ error: 'Manager access required' });
    }
    next();
};

// Get manager dashboard overview
router.get('/overview', requireAuth, checkOrgMembership, requireManager, (req, res) => {
    // Get team members based on role
    let teamQuery = '';
    if (req.userRole === 'leader') {
        // Leaders see their scope
        teamQuery = `
            SELECT DISTINCT u.id, u.name, u.email, om.role
            FROM users u
            JOIN organization_members om ON u.id = om.user_id
            JOIN leader_scope ls ON u.id = ls.member_user_id
            WHERE ls.leader_user_id = ? AND om.org_id = ?
        `;
    } else {
        // Admin/Owner see everyone
        teamQuery = `
            SELECT u.id, u.name, u.email, om.role
            FROM users u
            JOIN organization_members om ON u.id = om.user_id
            WHERE om.org_id = ?
        `;
    }

    const params = req.userRole === 'leader' ? [req.user.id, req.orgId] : [req.orgId];

    db.all(teamQuery, params, (err, teamMembers) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch team' });

        const memberIds = teamMembers.map(m => m.id);
        if (memberIds.length === 0) {
            return res.json({
                team_members: [],
                pending_time_entries: 0,
                pending_reports: 0,
                active_tasks: 0
            });
        }

        const placeholders = memberIds.map(() => '?').join(',');

        // Count pending time entries
        db.get(`
            SELECT COUNT(*) as count
            FROM time_entries
            WHERE org_id = ? AND user_id IN (${placeholders}) AND status = 'pending'
        `, [req.orgId, ...memberIds], (err, timeCount) => {

            // Count pending reports
            db.get(`
                SELECT COUNT(*) as count
                FROM daily_reports
                WHERE org_id = ? AND user_id IN (${placeholders}) AND status = 'submitted'
            `, [req.orgId, ...memberIds], (err, reportCount) => {

                // Count active tasks
                db.get(`
                    SELECT COUNT(*) as count
                    FROM tasks
                    WHERE org_id = ? AND assigned_to_user_id IN (${placeholders}) 
                    AND status IN ('pending', 'in_progress')
                `, [req.orgId, ...memberIds], (err, taskCount) => {

                    res.json({
                        team_members: teamMembers,
                        pending_time_entries: timeCount?.count || 0,
                        pending_reports: reportCount?.count || 0,
                        active_tasks: taskCount?.count || 0
                    });
                });
            });
        });
    });
});

// Get pending time entries for approval
router.get('/time-entries/pending', requireAuth, checkOrgMembership, requireManager, (req, res) => {
    let query = '';
    let params = [];

    if (req.userRole === 'leader') {
        query = `
            SELECT te.*, u.name as user_name, t.title as task_title
            FROM time_entries te
            JOIN users u ON te.user_id = u.id
            LEFT JOIN tasks t ON te.task_id = t.id
            JOIN leader_scope ls ON te.user_id = ls.member_user_id
            WHERE te.org_id = ? AND ls.leader_user_id = ? AND te.status = 'pending'
            ORDER BY te.date DESC, te.created_at DESC
        `;
        params = [req.orgId, req.user.id];
    } else {
        query = `
            SELECT te.*, u.name as user_name, t.title as task_title
            FROM time_entries te
            JOIN users u ON te.user_id = u.id
            LEFT JOIN tasks t ON te.task_id = t.id
            WHERE te.org_id = ? AND te.status = 'pending'
            ORDER BY te.date DESC, te.created_at DESC
        `;
        params = [req.orgId];
    }

    db.all(query, params, (err, entries) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(entries);
    });
});

// Approve time entry
router.post('/time-entries/:id/approve', requireAuth, checkOrgMembership, requireManager, (req, res) => {
    const { id } = req.params;

    db.run(`
        UPDATE time_entries
        SET status = 'approved', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP
        WHERE id = ? AND org_id = ? AND status = 'pending'
    `, [req.user.id, id, req.orgId], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to approve' });
        if (this.changes === 0) return res.status(404).json({ error: 'Entry not found or already processed' });

        db.get('SELECT * FROM time_entries WHERE id = ?', [id], (err, entry) => {
            res.json(entry);
        });
    });
});

// Reject time entry
router.post('/time-entries/:id/reject', requireAuth, checkOrgMembership, requireManager, (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    db.run(`
        UPDATE time_entries
        SET status = 'rejected', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP, review_note = ?
        WHERE id = ? AND org_id = ? AND status = 'pending'
    `, [req.user.id, reason || null, id, req.orgId], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to reject' });
        if (this.changes === 0) return res.status(404).json({ error: 'Entry not found or already processed' });

        db.get('SELECT * FROM time_entries WHERE id = ?', [id], (err, entry) => {
            res.json(entry);
        });
    });
});

// Get pending reports for approval
router.get('/reports/pending', requireAuth, checkOrgMembership, requireManager, (req, res) => {
    let query = '';
    let params = [];

    if (req.userRole === 'leader') {
        query = `
            SELECT dr.*, u.name as user_name, u.email as user_email
            FROM daily_reports dr
            JOIN users u ON dr.user_id = u.id
            JOIN leader_scope ls ON dr.user_id = ls.member_user_id
            WHERE dr.org_id = ? AND ls.leader_user_id = ? AND dr.status = 'submitted'
            ORDER BY dr.report_date DESC
        `;
        params = [req.orgId, req.user.id];
    } else {
        query = `
            SELECT dr.*, u.name as user_name, u.email as user_email
            FROM daily_reports dr
            JOIN users u ON dr.user_id = u.id
            WHERE dr.org_id = ? AND dr.status = 'submitted'
            ORDER BY dr.report_date DESC
        `;
        params = [req.orgId];
    }

    db.all(query, params, (err, reports) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(reports);
    });
});

// Approve report
router.post('/reports/:id/approve', requireAuth, checkOrgMembership, requireManager, (req, res) => {
    const { id } = req.params;

    db.run(`
        UPDATE daily_reports
        SET status = 'approved', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP
        WHERE id = ? AND org_id = ? AND status = 'submitted'
    `, [req.user.id, id, req.orgId], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to approve' });
        if (this.changes === 0) return res.status(404).json({ error: 'Report not found or already processed' });

        db.get('SELECT * FROM daily_reports WHERE id = ?', [id], (err, report) => {
            res.json(report);
        });
    });
});

// Reject report
router.post('/reports/:id/reject', requireAuth, checkOrgMembership, requireManager, (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    db.run(`
        UPDATE daily_reports
        SET status = 'rejected', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP, rejection_reason = ?
        WHERE id = ? AND org_id = ? AND status = 'submitted'
    `, [req.user.id, reason || null, id, req.orgId], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to reject' });
        if (this.changes === 0) return res.status(404).json({ error: 'Report not found or already processed' });

        db.get('SELECT * FROM daily_reports WHERE id = ?', [id], (err, report) => {
            res.json(report);
        });
    });
});

// Get team activity summary
router.get('/team-activity', requireAuth, checkOrgMembership, requireManager, (req, res) => {
    const { start_date, end_date } = req.query;

    let teamQuery = '';
    let params = [];

    if (req.userRole === 'leader') {
        teamQuery = `
            SELECT DISTINCT u.id
            FROM users u
            JOIN leader_scope ls ON u.id = ls.member_user_id
            WHERE ls.leader_user_id = ? AND ls.org_id = ?
        `;
        params = [req.user.id, req.orgId];
    } else {
        teamQuery = `
            SELECT u.id
            FROM users u
            JOIN organization_members om ON u.id = om.user_id
            WHERE om.org_id = ?
        `;
        params = [req.orgId];
    }

    db.all(teamQuery, params, (err, members) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch team' });

        const memberIds = members.map(m => m.id);
        if (memberIds.length === 0) {
            return res.json([]);
        }

        const placeholders = memberIds.map(() => '?').join(',');

        // Get activity for each member
        const activityQuery = `
            SELECT 
                u.id as user_id,
                u.name as user_name,
                COUNT(DISTINCT dr.id) as reports_count,
                COUNT(DISTINCT te.id) as time_entries_count,
                SUM(te.duration_minutes) as total_minutes,
                COUNT(DISTINCT t.id) as completed_tasks
            FROM users u
            LEFT JOIN daily_reports dr ON u.id = dr.user_id AND dr.org_id = ? 
                ${start_date ? 'AND dr.report_date >= ?' : ''}
                ${end_date ? 'AND dr.report_date <= ?' : ''}
            LEFT JOIN time_entries te ON u.id = te.user_id AND te.org_id = ?
                ${start_date ? 'AND te.date >= ?' : ''}
                ${end_date ? 'AND te.date <= ?' : ''}
            LEFT JOIN tasks t ON u.id = t.assigned_to_user_id AND t.org_id = ? AND t.status = 'completed'
                ${start_date ? 'AND DATE(t.completed_at) >= ?' : ''}
                ${end_date ? 'AND DATE(t.completed_at) <= ?' : ''}
            WHERE u.id IN (${placeholders})
            GROUP BY u.id, u.name
        `;

        const activityParams = [req.orgId];
        if (start_date) activityParams.push(start_date);
        if (end_date) activityParams.push(end_date);
        activityParams.push(req.orgId);
        if (start_date) activityParams.push(start_date);
        if (end_date) activityParams.push(end_date);
        activityParams.push(req.orgId);
        if (start_date) activityParams.push(start_date);
        if (end_date) activityParams.push(end_date);
        activityParams.push(...memberIds);

        db.all(activityQuery, activityParams, (err, activity) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json(activity);
        });
    });
});

module.exports = router;
