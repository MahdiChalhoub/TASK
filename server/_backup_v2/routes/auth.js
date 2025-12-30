const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db');
const router = express.Router();

// ==========================================
// Passport Config
// ==========================================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const googleId = profile.id;
        const name = profile.displayName;

        // Check if user exists
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
            if (err) return done(err);

            if (user) {
                // Update Google ID if missing
                if (!user.google_id) {
                    db.run('UPDATE users SET google_id = ? WHERE id = ?', [googleId, user.id]);
                }
                return done(null, user);
            } else {
                // Create User
                db.run('INSERT INTO users (email, name, google_id) VALUES (?, ?, ?)',
                    [email, name, googleId],
                    function (err) {
                        if (err) return done(err);
                        const newUser = { id: this.lastID, email, name, google_id: googleId };
                        return done(null, newUser);
                    }
                );
            }
        });
    } catch (err) {
        done(err);
    }
}));

// ==========================================
// Routes
// ==========================================

// Google Auth Trigger
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

// Google Auth Callback
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication
        res.redirect(process.env.CLIENT_URL || '/');
    }
);

// Logout
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

// Current User (For Frontend Session Check)
router.get('/me', (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: req.user
        });
    } else {
        res.json({ authenticated: false });
    }
});

module.exports = router;
