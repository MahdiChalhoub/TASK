const express = require('express');
const passport = require('passport');
const router = express.Router();

const bcrypt = require('bcryptjs');
const db = require('../db');

// Google OAuth routes
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        res.redirect(`${clientUrl}/dashboard`);
    }
);

// Email/Password Login
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ error: info.message || 'Login failed' });

        req.login(user, (err) => {
            if (err) return next(err);
            return res.json(user);
        });
    })(req, res, next);
});

// Email/Password Signup
router.post('/signup', (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (user) return res.status(400).json({ error: 'Email already exists' });

        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);

        db.run('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
            [email, name || email.split('@')[0], passwordHash],
            function (err) {
                if (err) return res.status(500).json({ error: 'Failed to create user' });

                db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
                    req.login(newUser, (err) => {
                        if (err) return res.status(500).json({ error: 'Login failed after signup' });
                        res.json(newUser);
                    });
                });
            }
        );
    });
});
// Get current user
router.get('/me', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json(req.user);
});

// Logout
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});


module.exports = router;
