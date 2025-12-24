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
const PORT = process.env.PORT || 5001;

// Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'virtual-office-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
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

app.use('/api/auth', authRoutes);
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

app.use('/api/groups', groupRoutes);

app.get('/api', (req, res) => {
    res.send('Virtual Office API is running');
});

app.get('/', (req, res) => {
    res.send('Virtual Office API is running');
});

app.listen(PORT, () => {
    console.log(`🚀 Virtual Office server running on port ${PORT}`);
});
