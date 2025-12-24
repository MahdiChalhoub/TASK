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

// Middleware to check admin/owner role
const requireAdmin = (req, res, next) => {
    if (!['admin', 'owner'].includes(req.userRole)) {
        return res.status(403).json({ error: 'Admin or Owner role required' });
    }
    next();
};

// Get all categories for organization
router.get('/', requireAuth, checkOrgMembership, (req, res) => {
    db.all(`
        SELECT c.*, u.name as leader_name
        FROM task_categories c
        LEFT JOIN users u ON c.leader_user_id = u.id
        WHERE c.org_id = ?
        ORDER BY c.sort_order, c.id
    `, [req.orgId], (err, categories) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(categories);
    });
});

// Create category (Admin/Owner only)
router.post('/', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { name, leader_user_id } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Category name required' });
    }

    // Get max sort_order
    db.get('SELECT MAX(sort_order) as max_order FROM task_categories WHERE org_id = ?',
        [req.orgId],
        (err, result) => {
            const sortOrder = (result?.max_order || 0) + 1;

            db.run(`INSERT INTO task_categories (org_id, name, leader_user_id, sort_order)
                    VALUES (?, ?, ?, ?)`,
                [req.orgId, name, leader_user_id || null, sortOrder],
                function (err) {
                    if (err) return res.status(500).json({ error: 'Failed to create category' });

                    db.get('SELECT * FROM task_categories WHERE id = ?', [this.lastID], (err, category) => {
                        res.json(category);
                    });
                }
            );
        }
    );
});

// Update category (Admin/Owner only)
router.put('/:id', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, leader_user_id } = req.body;

    // Verify category belongs to org
    db.get('SELECT * FROM task_categories WHERE id = ? AND org_id = ?',
        [id, req.orgId],
        (err, category) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!category) return res.status(404).json({ error: 'Category not found' });

            const updates = [];
            const params = [];

            if (name !== undefined) {
                updates.push('name = ?');
                params.push(name);
            }

            if (leader_user_id !== undefined) {
                updates.push('leader_user_id = ?');
                params.push(leader_user_id || null);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No updates provided' });
            }

            params.push(id, req.orgId);

            db.run(`UPDATE task_categories SET ${updates.join(', ')} WHERE id = ? AND org_id = ?`,
                params,
                (err) => {
                    if (err) return res.status(500).json({ error: 'Failed to update category' });

                    db.get('SELECT * FROM task_categories WHERE id = ?', [id], (err, updated) => {
                        res.json(updated);
                    });
                }
            );
        }
    );
});

// Delete category (Admin/Owner only)
router.delete('/:id', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { id } = req.params;

    // Verify category belongs to org
    db.get('SELECT * FROM task_categories WHERE id = ? AND org_id = ?',
        [id, req.orgId],
        (err, category) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!category) return res.status(404).json({ error: 'Category not found' });

            // Check if category has tasks
            db.get('SELECT COUNT(*) as count FROM tasks WHERE category_id = ?', [id], (err, result) => {
                if (result.count > 0) {
                    return res.status(400).json({ error: 'Cannot delete category with existing tasks' });
                }

                db.run('DELETE FROM task_categories WHERE id = ? AND org_id = ?',
                    [id, req.orgId],
                    (err) => {
                        if (err) return res.status(500).json({ error: 'Failed to delete category' });
                        res.json({ message: 'Category deleted successfully' });
                    }
                );
            });
        }
    );
});

// Reorder categories (Admin/Owner only)
router.put('/reorder/update', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { categoryIds } = req.body; // Array of category IDs in new order

    if (!Array.isArray(categoryIds)) {
        return res.status(400).json({ error: 'categoryIds must be an array' });
    }

    // Update sort_order for each category
    const updates = categoryIds.map((id, index) => {
        return new Promise((resolve, reject) => {
            db.run('UPDATE task_categories SET sort_order = ? WHERE id = ? AND org_id = ?',
                [index, id, req.orgId],
                (err) => err ? reject(err) : resolve()
            );
        });
    });

    Promise.all(updates)
        .then(() => res.json({ message: 'Categories reordered successfully' }))
        .catch(() => res.status(500).json({ error: 'Failed to reorder categories' }));
});

module.exports = router;
