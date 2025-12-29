const db = require('./db');

const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

const checkOrgMembership = (req, res, next) => {
    const orgIdRaw = req.headers['x-org-id'] || req.body.orgId || req.query.orgId;

    if (!orgIdRaw) {
        return res.status(400).json({ error: 'Organization ID required' });
    }

    const orgId = parseInt(orgIdRaw, 10);
    if (isNaN(orgId)) {
        return res.status(400).json({ error: 'Invalid Organization ID' });
    }

    db.get('SELECT role FROM organization_members WHERE org_id = ? AND user_id = ?',
        [orgId, req.user.id],
        (err, member) => {
            if (err) {
                console.error("Middleware DB Error:", err);
                return res.status(500).json({ error: 'Database error checking membership' });
            }
            if (!member) {
                return res.status(403).json({ error: 'Not a member of this organization' });
            }

            req.orgId = orgId;
            req.userRole = member.role;
            next();
        }
    );
};

module.exports = { requireAuth, checkOrgMembership };
