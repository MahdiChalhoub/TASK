const express = require('express');
const passport = require('passport');
const router = express.Router();

// Google OAuth routes
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication
        res.redirect('http://localhost:5173/dashboard');
    }
);

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

// Development-only: simple login (remove in production)
router.post('/dev-login', (req, res) => {
    const { email } = req.body;
    const db = require('../db');

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (!user) {
            // Create dev user
            db.run('INSERT INTO users (email, name) VALUES (?, ?)',
                [email, email.split('@')[0]],
                function (err) {
                    if (err) return res.status(500).json({ error: 'Failed to create user' });
                    db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
                        req.login(newUser, (err) => {
                            if (err) return res.status(500).json({ error: 'Login failed' });
                            res.json(newUser);
                        });
                    });
                }
            );
        } else {
            req.login(user, (err) => {
                if (err) return res.status(500).json({ error: 'Login failed' });
                res.json(user);
            });
        }
    });
});

module.exports = router;
