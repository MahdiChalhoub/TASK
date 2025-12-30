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

// Get user settings
router.get('/', requireAuth, checkOrgMembership, (req, res) => {
    const query = `
        SELECT * FROM user_settings 
        WHERE user_id = ? AND org_id = ?
    `;

    db.get(query, [req.user.id, req.orgId], (err, settings) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch settings' });
        }

        // If no settings exist, return defaults
        if (!settings) {
            return res.json({
                task_due_date_cutoff_hour: 15
            });
        }

        res.json(settings);
    });
});

// Update user settings
router.put('/', requireAuth, checkOrgMembership, (req, res) => {
    const { task_due_date_cutoff_hour } = req.body;

    // Validate cutoff hour (0-23)
    if (task_due_date_cutoff_hour !== undefined) {
        if (task_due_date_cutoff_hour < 0 || task_due_date_cutoff_hour > 23) {
            return res.status(400).json({ error: 'Cutoff hour must be between 0 and 23' });
        }
    }

    // Check if settings exist
    db.get(
        'SELECT id FROM user_settings WHERE user_id = ? AND org_id = ?',
        [req.user.id, req.orgId],
        (err, existing) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (existing) {
                // Update existing settings
                const updates = [];
                const params = [];

                if (task_due_date_cutoff_hour !== undefined) {
                    updates.push('task_due_date_cutoff_hour = ?');
                    params.push(task_due_date_cutoff_hour);
                }

                updates.push('updated_at = CURRENT_TIMESTAMP');
                params.push(existing.id);

                const query = `UPDATE user_settings SET ${updates.join(', ')} WHERE id = ?`;

                db.run(query, params, function (err) {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to update settings' });
                    }

                    // Fetch and return updated settings
                    db.get(
                        'SELECT * FROM user_settings WHERE id = ?',
                        [existing.id],
                        (err, updated) => {
                            if (err) {
                                return res.status(500).json({ error: 'Failed to fetch updated settings' });
                            }
                            res.json(updated);
                        }
                    );
                });
            } else {
                // Create new settings
                db.run(
                    `INSERT INTO user_settings (user_id, org_id, task_due_date_cutoff_hour)
                     VALUES (?, ?, ?)`,
                    [req.user.id, req.orgId, task_due_date_cutoff_hour || 15],
                    function (err) {
                        if (err) {
                            return res.status(500).json({ error: 'Failed to create settings' });
                        }

                        // Fetch and return new settings
                        db.get(
                            'SELECT * FROM user_settings WHERE id = ?',
                            [this.lastID],
                            (err, newSettings) => {
                                if (err) {
                                    return res.status(500).json({ error: 'Failed to fetch new settings' });
                                }
                                res.json(newSettings);
                            }
                        );
                    }
                );
            }
        }
    );
});

module.exports = router;
