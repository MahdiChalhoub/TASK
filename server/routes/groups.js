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

// Middleware to check org membership and admin/owner role (since grouping is usually admin task)
// Or should team leaders be able to create groups? Let's say Admins/Owners/Leaders for now.
const requireOrgAccess = (req, res, next) => {
    const orgId = req.headers['x-org-id'] || req.query.orgId || req.body.orgId;
    if (!orgId) return res.status(400).json({ error: 'Organization ID required' });

    db.get('SELECT role FROM organization_members WHERE org_id = ? AND user_id = ?',
        [orgId, req.user.id],
        (err, member) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!member) return res.status(403).json({ error: 'Not a member' });

            req.orgId = orgId;
            req.userRole = member.role;
            next();
        }
    );
};

// Get all groups for org
router.get('/', requireAuth, requireOrgAccess, (req, res) => {
    db.all(`
        SELECT ug.*, 
            (SELECT COUNT(*) FROM user_group_members WHERE group_id = ug.id) as member_count
        FROM user_groups ug
        WHERE ug.org_id = ?
        ORDER BY ug.name
    `, [req.orgId], (err, groups) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(groups);
    });
});

// Create group
router.post('/', requireAuth, requireOrgAccess, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    db.run('INSERT INTO user_groups (org_id, name) VALUES (?, ?)',
        [req.orgId, name],
        function (err) {
            if (err) return res.status(500).json({ error: 'Failed to create group' });

            const groupId = this.lastID;
            db.get('SELECT * FROM user_groups WHERE id = ?', [groupId], (err, group) => {
                res.json({ ...group, member_count: 0 });
            });
        }
    );
});

// Delete group
router.delete('/:id', requireAuth, requireOrgAccess, (req, res) => {
    const { id } = req.params;

    // Check ownership/permissions? assuming admin/writer access to org is enough for now

    db.run('DELETE FROM user_groups WHERE id = ? AND org_id = ?', [id, req.orgId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to delete group' });
        res.json({ message: 'Group deleted' });
    });
});

// Get group members
router.get('/:id/members', requireAuth, requireOrgAccess, (req, res) => {
    db.all(`
        SELECT u.id, u.name, u.email
        FROM users u
        JOIN user_group_members ugm ON u.id = ugm.user_id
        WHERE ugm.group_id = ?
    `, [req.params.id], (err, members) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(members);
    });
});

// Add member to group
router.post('/:id/members', requireAuth, requireOrgAccess, (req, res) => {
    const { userId } = req.body;
    const groupId = req.params.id;

    db.run('INSERT INTO user_group_members (group_id, user_id) VALUES (?, ?)',
        [groupId, userId],
        (err) => {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'User already in group' });
                }
                return res.status(500).json({ error: 'Failed to add member' });
            }
            res.json({ message: 'Member added' });
        }
    );
});

// Remove member from group
router.delete('/:id/members/:userId', requireAuth, requireOrgAccess, (req, res) => {
    const { id, userId } = req.params;

    db.run('DELETE FROM user_group_members WHERE group_id = ? AND user_id = ?',
        [id, userId],
        (err) => {
            if (err) return res.status(500).json({ error: 'Failed to remove member' });
            res.json({ message: 'Member removed' });
        }
    );
});

module.exports = router;
