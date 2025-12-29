import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import './Login.css';

export default function Login() {
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Destructure login/signup from context
    const { login, signup } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isSignup) {
                await signup(name, email, password);
            } else {
                await login(email, password);
            }
            // App.jsx will handle redirect based on user state
        } catch (err) {
            console.error('Auth error:', err);
            setError(err.response?.data?.error || err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        // Redirects to backend Google Auth Flow
        authAPI.googleLogin();
    };

    const toggleMode = () => {
        setIsSignup(!isSignup);
        setError('');
        setPassword('');
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <h1>🏢 Virtual Office</h1>
                    <p>Task Management • Time Tracking • Daily Reports</p>
                </div>

                <div className="login-card">
                    <h2>{isSignup ? 'Create Account' : 'Welcome Back'}</h2>
                    <p className="login-subtitle">
                        {isSignup
                            ? 'Get started with your free workspace'
                            : 'Sign in to continue to your workspace'}
                    </p>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {isSignup && (
                            <div className="form-group">
                                <label htmlFor="name">Full Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Jane Doe"
                                    required={isSignup}
                                    disabled={loading}
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                disabled={loading}
                            />
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading
                                ? (isSignup ? 'Creating Account...' : 'Signing in...')
                                : (isSignup ? 'Sign Up' : 'Sign In')}
                        </button>
                    </form>

                    <div className="auth-toggle-container">
                        <p>
                            {isSignup ? 'Already have an account?' : "Don't have an account?"}
                            <button
                                type="button"
                                onClick={toggleMode}
                                className="auth-toggle-btn"
                                disabled={loading}
                            >
                                {isSignup ? 'Sign In' : 'Sign Up'}
                            </button>
                        </p>
                    </div>

                    <div className="login-divider">
                        <span>or</span>
                    </div>

                    <button
                        type="button"
                        className="btn btn-google"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                    >
                        <svg width="18" height="18" viewBox="0 0 18 18">
                            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" />
                            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" />
                            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z" />
                            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z" />
                        </svg>
                        Continue with Google
                    </button>
                </div>

                <div className="login-footer">
                    <p>Virtual Office • Task Management System</p>
                </div>
            </div>
        </div>
    );
}
