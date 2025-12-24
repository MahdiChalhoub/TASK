import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export default function Login() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { devLogin } = useAuth();

    const handleDevLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await devLogin(email);
        } catch (err) {
            console.error('Login error:', err);
            setError(err.response?.data?.error || err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <h1>🏢 Virtual Office</h1>
                    <p>Task Management • Time Tracking • Daily Reports</p>
                </div>

                <div className="login-card">
                    <h2>Welcome Back</h2>
                    <p className="login-subtitle">Sign in to continue to your workspace</p>

                    {/* Development Login */}
                    <form onSubmit={handleDevLogin} className="dev-login-form">
                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your.email@company.com"
                                required
                                disabled={loading}
                            />
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Signing in...' : 'Continue with Email'}
                        </button>
                    </form>

                    <div className="login-divider">
                        <span>or</span>
                    </div>

                    {/* Google OAuth - Coming soon */}
                    <button className="btn btn-google" disabled>
                        <svg width="18" height="18" viewBox="0 0 18 18">
                            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" />
                            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" />
                            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z" />
                            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z" />
                        </svg>
                        Continue with Google (Coming Soon)
                    </button>

                    <p className="login-note">
                        📝 <strong>Dev Mode:</strong> Just enter any email to create/login
                    </p>
                </div>

                <div className="login-footer">
                    <p>Virtual Office • Phase 1: Authentication & Organization</p>
                </div>
            </div>
        </div>
    );
}
