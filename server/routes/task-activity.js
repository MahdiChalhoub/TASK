const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware
const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

const checkOrgMembership = (req, res, next) => {
    const orgId = req.headers['x-org-id'] || req.body.orgId || req.query.orgId;
    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID required' });
    }

    db.get(
        'SELECT role FROM organization_members WHERE org_id = ? AND user_id = ?',
        [orgId, req.user.id],
        (err, member) => {
            if (err || !member) {
                return res.status(403).json({ error: 'Not a member of this organization' });
            }
            req.orgId = parseInt(orgId);
            req.userRole = member.role;
            next();
        }
    );
};

// Get task activity log for a specific date
router.get('/date/:date', requireAuth, checkOrgMembership, (req, res) => {
    const { date } = req.params;

    const query = `
        SELECT 
            tal.*,
            t.title as task_title,
            t.description as task_description,
            t.category_id,
            t.assigned_to_user_id,
            u.name as user_name,
            u_assigned.name as assigned_to_name,
            c.name as category_name
        FROM task_activity_log tal
        LEFT JOIN tasks t ON tal.task_id = t.id
        LEFT JOIN users u ON tal.user_id = u.id
        LEFT JOIN users u_assigned ON t.assigned_to_user_id = u_assigned.id
        LEFT JOIN task_categories c ON t.category_id = c.id
        WHERE tal.org_id = ?
        AND DATE(tal.created_at) = ?
        ORDER BY tal.created_at DESC
    `;

    db.all(query, [req.orgId, date], (err, activities) => {
        if (err) {
            console.error('Error fetching task activities:', err);
            return res.status(500).json({ error: 'Failed to fetch task activities' });
        }
        res.json(activities);
    });
});

// Get task activity log for a specific user and date
router.get('/user/:userId/date/:date', requireAuth, checkOrgMembership, (req, res) => {
    const { userId, date } = req.params;

    const query = `
        SELECT 
            tal.*,
            t.title as task_title,
            t.description as task_description,
            t.category_id,
            u.name as user_name,
            c.name as category_name
        FROM task_activity_log tal
        LEFT JOIN tasks t ON tal.task_id = t.id
        LEFT JOIN users u ON tal.user_id = u.id
        LEFT JOIN task_categories c ON t.category_id = c.id
        WHERE tal.org_id = ?
        AND t.assigned_to_user_id = ?
        AND DATE(tal.created_at) = ?
        ORDER BY tal.created_at DESC
    `;

    db.all(query, [req.orgId, userId, date], (err, activities) => {
        if (err) {
            console.error('Error fetching user task activities:', err);
            return res.status(500).json({ error: 'Failed to fetch task activities' });
        }
        res.json(activities);
    });
});

// Get task activity log for a specific task
router.get('/task/:taskId', requireAuth, checkOrgMembership, (req, res) => {
    const { taskId } = req.params;

    const query = `
        SELECT 
            tal.*,
            u.name as user_name
        FROM task_activity_log tal
        LEFT JOIN users u ON tal.user_id = u.id
        WHERE tal.org_id = ?
        AND tal.task_id = ?
        ORDER BY tal.created_at DESC
    `;

    db.all(query, [req.orgId, taskId], (err, activities) => {
        if (err) {
            console.error('Error fetching task history:', err);
            return res.status(500).json({ error: 'Failed to fetch task history' });
        }
        res.json(activities);
    });
});

module.exports = router;
