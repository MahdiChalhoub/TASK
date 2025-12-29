const db = require('./db');

const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

const checkOrgMembership = (req, res, next) => {
    // DEBUG LOGGING
    console.log(`[Middleware] Checking Org Membership. URL: ${req.url}`);
    console.log(`[Middleware] Auth Status: ${req.isAuthenticated()}`);
    console.log(`[Middleware] User: ${JSON.stringify(req.user)}`);
    console.log(`[Middleware] Headers: ${JSON.stringify(req.headers)}`);

    const orgIdRaw = req.headers['x-org-id'] || req.body.orgId || req.query.orgId;

    if (!orgIdRaw) {
        console.error('[Middleware] Missing Org ID');
        return res.status(400).json({ error: 'Organization ID required' });
    }

    // Sanitize Org ID
    const orgId = parseInt(orgIdRaw, 10);
    if (isNaN(orgId)) {
        return res.status(400).json({ error: 'Invalid Organization ID' });
    }

    // STRICT PARAMETER HANDLING FOR POSTGRES
    const userId = req.user ? req.user.id : null;

    if (!userId) {
        console.error('[Middleware] User ID missing despite isAuthenticated');
        return res.status(401).json({ error: 'User context missing' });
    }


    req.orgId = orgId;
    req.userRole = member.role;
    console.log(`[Middleware] Success. Org: ${orgId}, Role: ${member.role}`);
    next();
}
);
};

module.exports = { requireAuth, checkOrgMembership };
