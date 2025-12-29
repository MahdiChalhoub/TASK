const express = require('express');
const router = express.Router();
const db = require('../db');
const { nanoid } = require('nanoid');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Create organization
router.post('/', requireAuth, (req, res) => {
    const { name } = req.body;
    const joinCode = nanoid(10); // Generate unique 10-character join code

    db.run('INSERT INTO organizations (name, join_code) VALUES (?, ?)',
        [name, joinCode],
        function (err) {
            if (err) {
                console.error('Create Org Error:', err);
                return res.status(500).json({ error: 'Failed to create organization: ' + err.message });
            }

            const orgId = this.lastID;

            // Add creator as owner
            db.run('INSERT INTO organization_members (org_id, user_id, role) VALUES (?, ?, ?)',
                [orgId, req.user.id, 'owner'],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to add owner' });
                    }

                    db.get('SELECT * FROM organizations WHERE id = ?', [orgId], (err, org) => {
                        res.json(org);
                    });
                }
            );
        }
    );
});

// Join organization by code
router.post('/join', requireAuth, (req, res) => {
    const { joinCode } = req.body;

    db.get('SELECT * FROM organizations WHERE join_code = ?', [joinCode], (err, org) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!org) return res.status(404).json({ error: 'Invalid join code' });

        // Check if already a member
        db.get('SELECT * FROM organization_members WHERE org_id = ? AND user_id = ?',
            [org.id, req.user.id],
            (err, existingMember) => {
                if (existingMember) {
                    return res.status(400).json({ error: 'Already a member of this organization' });
                }

                // Add as employee by default
                db.run('INSERT INTO organization_members (org_id, user_id, role) VALUES (?, ?, ?)',
                    [org.id, req.user.id, 'employee'],
                    (err) => {
                        if (err) {
                            return res.status(500).json({ error: 'Failed to join organization' });
                        }
                        res.json(org);
                    }
                );
            }
        );
    });
});

// Get user's organizations
router.get('/my-orgs', requireAuth, (req, res) => {
    db.all(`
        SELECT o.*, om.role 
        FROM organizations o
        JOIN organization_members om ON o.id = om.org_id
        WHERE om.user_id = ?
    `, [req.user.id], (err, orgs) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(orgs);
    });
});

// Get organization details
router.get('/:id', requireAuth, (req, res) => {
    const orgId = req.params.id;

    // Check if user is member
    db.get('SELECT role FROM organization_members WHERE org_id = ? AND user_id = ?',
        [orgId, req.user.id],
        (err, member) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!member) return res.status(403).json({ error: 'Not a member of this organization' });

            db.get('SELECT * FROM organizations WHERE id = ?', [orgId], (err, org) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                res.json({ ...org, userRole: member.role });
            });
        }
    );
});

// Get organization members
router.get('/:id/members', requireAuth, (req, res) => {
    const orgId = req.params.id;

    // Check if user is member
    db.get('SELECT role FROM organization_members WHERE org_id = ? AND user_id = ?',
        [orgId, req.user.id],
        (err, member) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!member) return res.status(403).json({ error: 'Not a member' });

            db.all(`
                SELECT u.id, u.name, u.email, om.role, om.created_at
                FROM users u
                JOIN organization_members om ON u.id = om.user_id
                WHERE om.org_id = ?
                ORDER BY om.created_at
            `, [orgId], (err, members) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                res.json(members);
            });
        }
    );
});

// Update member role (admin/owner only)
router.put('/:id/members/:userId/role', requireAuth, (req, res) => {
    const { id: orgId, userId } = req.params;
    const { role } = req.body;

    // Check if requester is admin or owner
    db.get('SELECT role FROM organization_members WHERE org_id = ? AND user_id = ?',
        [orgId, req.user.id],
        (err, requester) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!requester || !['admin', 'owner'].includes(requester.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            // Don't allow changing owner role
            db.get('SELECT role FROM organization_members WHERE org_id = ? AND user_id = ?',
                [orgId, userId],
                (err, target) => {
                    if (target && target.role === 'owner') {
                        return res.status(403).json({ error: 'Cannot change owner role' });
                    }

                    db.run('UPDATE organization_members SET role = ? WHERE org_id = ? AND user_id = ?',
                        [role, orgId, userId],
                        (err) => {
                            if (err) return res.status(500).json({ error: 'Failed to update role' });
                            res.json({ message: 'Role updated successfully' });
                        }
                    );
                }
            );
        }
    );
});

// Dev: Create user and add to org
router.post('/:id/dev-users', requireAuth, (req, res) => {
    const { id: orgId } = req.params;
    const { email, name } = req.body;

    // Check if requester is admin/owner
    db.get('SELECT role FROM organization_members WHERE org_id = ? AND user_id = ?',
        [orgId, req.user.id],
        (err, requester) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!requester || !['admin', 'owner'].includes(requester.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            // Check if user exists
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
                const afterUserFound = (targetUserId) => {
                    // Add to org
                    db.run('INSERT INTO organization_members (org_id, user_id, role) VALUES (?, ?, ?)',
                        [orgId, targetUserId, 'employee'],
                        (err) => {
                            if (err) {
                                // Ignore duplicate error
                                if (err.message.includes('UNIQUE constraint failed')) {
                                    return res.status(400).json({ error: 'User is already in this organization' });
                                }
                                return res.status(500).json({ error: 'Failed to add user to org' });
                            }
                            res.json({ message: 'User added successfully' });
                        }
                    );
                };

                if (!user) {
                    // Create user
                    db.run('INSERT INTO users (email, name) VALUES (?, ?)', [email, name || email.split('@')[0]], function (err) {
                        if (err) return res.status(500).json({ error: 'Failed to create user' });
                        afterUserFound(this.lastID);
                    });
                } else {
                    afterUserFound(user.id);
                }
            });
        }
    );
});

module.exports = router;
