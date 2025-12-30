const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, checkOrgMembership } = require('../middleware');

// Get Members
router.get('/:id/members', requireAuth, checkOrgMembership, (req, res) => {
    const orgId = req.params.id;

    const sql = `
        SELECT u.id, u.name, u.email, m.role
        FROM organization_members m
        JOIN users u ON m.user_id = u.id
        WHERE m.org_id = ?
    `;

    db.all(sql, [orgId], (err, rows) => {
        if (err) {
            console.error('[GET Members] Error:', err);
            return res.json([]); // Fail safe
        }
        res.json(rows);
    });
});

// Get Categories
router.get('/:id/categories', requireAuth, checkOrgMembership, (req, res) => {
    const orgId = req.params.id;
    db.all('SELECT * FROM task_categories WHERE org_id = ? ORDER BY sort_order', [orgId], (err, rows) => {
        if (err) return res.json([]);
        res.json(rows);
    });
});

module.exports = router;
