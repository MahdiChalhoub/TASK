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

const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

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
            // Check if user exists with same email (Account Linking)
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, existingUser) => {
                if (err) return done(err);

                if (existingUser) {
                    // Link Google ID to existing user
                    db.run('UPDATE users SET google_id = ? WHERE id = ?', [googleId, existingUser.id], (err) => {
                        if (err) return done(err);
                        existingUser.google_id = googleId; // Update local object
                        return done(null, existingUser);
                    });
                } else {
                    // Create new user (No existing email)
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
        }
    });
}));

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, (email, password, done) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return done(err);
        if (!user) return done(null, false, { message: 'Incorrect email.' });

        // If user exists but has no password (e.g. Google user attempting password login)
        if (!user.password_hash) {
            return done(null, false, { message: 'This account uses Google Login. Please sign in with Google.' });
        }

        bcrypt.compare(password, user.password_hash, (err, isMatch) => {
            if (err) return done(err);
            if (isMatch) {
                return done(null, user);
            } else {
                return done(null, false, { message: 'Incorrect password.' });
            }
        });
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
const debugRoutes = require('./routes/debug'); // Added this line

// Inline Task Activity Routes for Debugging
const taskActivityRouter = express.Router();

taskActivityRouter.get('/test', (req, res) => {
    res.send('Activity Router Working');
});

// Middleware
const { requireAuth, checkOrgMembership } = require('./middleware');

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
app.use('/api/activities', taskActivityRoutes);
app.use('/api/debug', debugRoutes); // Renamed and moved up
app.use('/api/orgs', orgRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/forms', formRoutes);
app.get('/api/test-direct', (req, res) => {
    console.log('[Test Probe] Checking DB Schema...');
    const results = {};

    // 1. Get Table List
    db.pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'", (err, tableRes) => {
        if (err) return res.status(500).json({ step: 'tables', error: err.message });
        results.tables = tableRes.rows.map(r => r.table_name);

        // 2. Get Tasks Columns
        db.pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tasks'", (err, colRes) => {
            if (err) return res.status(500).json({ step: 'columns', error: err.message });
            results.tasks_columns = colRes.rows.map(r => r.column_name);

            // 3. Try Basic Select
            db.pool.query("SELECT * FROM tasks LIMIT 1", (err, selectRes) => {
                if (err) return res.status(500).json({ step: 'select_test', error: err.message });
                results.select_test = 'Success';
                results.row_count = selectRes.rowCount;

                // 4. Check specific columns existence
                results.has_estimated = results.tasks_columns.includes('estimated_minutes');
                results.has_require_finish = results.tasks_columns.includes('require_finish_time');

                res.json(results);
            });
        });
    });
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
