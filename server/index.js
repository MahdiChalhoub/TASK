console.log('!!! I AM THE NEW SERVER !!!');
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.set('trust proxy', 1); // Enable proxy trust for Render

app.use(cors({
    origin: true, // Allow dynamic origin for debugging
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-org-id']
}));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'virtual-office-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true, // Required for SameSite=None
        sameSite: 'none', // Required for Cross-Site Cookies
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'your-client-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-client-secret',
    callbackURL: '/api/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
    // Find or create user
    const email = profile.emails[0].value;
    const name = profile.displayName;
    const googleId = profile.id;

    db.get('SELECT * FROM users WHERE google_id = ?', [googleId], (err, user) => {
        if (err) return done(err);

        if (user) {
            return done(null, user);
        } else {
            // Create new user
            db.run('INSERT INTO users (email, name, google_id) VALUES (?, ?, ?)',
                [email, name, googleId],
                function (err) {
                    if (err) return done(err);
                    db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
                        return done(err, newUser);
                    });
                }
            );
        }
    });
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
        done(err, user);
    });
});

// Routes
const authRoutes = require('./routes/auth');
const orgRoutes = require('./routes/organizations');
const taskRoutes = require('./routes/tasks');
const categoryRoutes = require('./routes/categories');
const timeRoutes = require('./routes/time');
const reportRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboards');
const formRoutes = require('./routes/forms');
const groupRoutes = require('./routes/groups');
const settingsRoutes = require('./routes/settings');
const taskActivityRoutes = require('./routes/task-activity');

// Inline Task Activity Routes for Debugging
const taskActivityRouter = express.Router();

taskActivityRouter.get('/test', (req, res) => {
    res.send('Activity Router Working');
});

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

taskActivityRouter.get('/date/:date', requireAuth, checkOrgMembership, (req, res) => {
    console.log('Task Activity Date Route Hit:', req.params.date);
    const { date } = req.params;
    const query = `
        SELECT tal.*, t.title as task_title, u.name as user_name
        FROM task_activity_log tal
        LEFT JOIN tasks t ON tal.task_id = t.id
        LEFT JOIN users u ON tal.user_id = u.id
        WHERE tal.org_id = ? AND DATE(tal.created_at) = ?
        ORDER BY tal.created_at DESC
    `;
    db.all(query, [req.orgId, date], (err, activities) => {
        if (err) {
            console.error('Error:', err);
            return res.status(500).json({ error: 'Failed' });
        }
        res.json(activities);
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/activity', taskActivityRouter); // Renamed and moved up
app.use('/api/orgs', orgRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/forms', formRoutes);
app.get('/api/test-direct', (req, res) => {
    res.send('Direct working');
});

console.log('Group Routes type:', typeof groupRoutes);
console.log('Group Routes stack:', groupRoutes && groupRoutes.stack && groupRoutes.stack.length);

console.log('Task Activity Routes type:', typeof taskActivityRouter);

app.use('/api/groups', groupRoutes);
app.use('/api/settings', settingsRoutes);
// app.use('/api/task-activity', taskActivityRoutes); // Commented out old one

app.get('/api', (req, res) => {
    res.send('Virtual Office API is running');
});

app.get('/api', (req, res) => {
    res.send('Virtual Office API is running');
});

// app.use(express.static(...)) and app.get('*') removed for API-only deployment



app.listen(PORT, () => {
    console.log(`🚀 Virtual Office server running on port ${PORT}`);
    console.log(`Test URL: http://localhost:${PORT}/api/activity/test`);
});
