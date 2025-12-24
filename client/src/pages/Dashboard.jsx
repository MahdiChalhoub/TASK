import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

export default function Dashboard() {
    const [orgName] = useState(localStorage.getItem('selectedOrgName'));
    const [userRole] = useState(localStorage.getItem('userRole'));
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!localStorage.getItem('selectedOrgId')) {
            navigate('/select-org');
        }
    }, [navigate]);

    const handleChangeOrg = () => {
        localStorage.removeItem('selectedOrgId');
        localStorage.removeItem('selectedOrgName');
        localStorage.removeItem('userRole');
        navigate('/select-org');
    };

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <div className="header-left">
                    <h1>🏢 {orgName}</h1>
                    <span className="role-badge">{userRole}</span>
                </div>
                <div className="header-right">
                    <span className="user-name">{user?.name || user?.email}</span>
                    <button onClick={handleChangeOrg} className="btn-change-org">Change Org</button>
                    <button onClick={logout} className="btn-logout">Logout</button>
                </div>
            </header>

            <main className="dashboard-main">
                <div className="welcome-section">
                    <h2>✅ Phase 1 Complete!</h2>
                    <p>Authentication and Organization Management is working</p>
                </div>

                <div className="features-grid">
                    <div className="feature-card active" onClick={() => navigate('/tasks')}>
                        <div className="feature-icon">📋</div>
                        <h3>Tasks</h3>
                        <p>Manage tasks & categories</p>
                        <span className="badge success">Phase 2 ✓</span>
                    </div>

                    <div className="feature-card active" onClick={() => navigate('/time')}>
                        <div className="feature-icon">⏱️</div>
                        <h3>Time Tracking</h3>
                        <p>Track work hours & timers</p>
                        <span className="badge success">Phase 3 ✓</span>
                    </div>

                    <div className="feature-card active" onClick={() => navigate('/reports')}>
                        <div className="feature-icon">📝</div>
                        <h3>Daily Reports</h3>
                        <p>Submit & view daily reports</p>
                        <span className="badge success">Phase 4 ✓</span>
                    </div>

                    <div className="feature-card active" onClick={() => navigate('/forms')}>
                        <div className="feature-icon">📋</div>
                        <h3>Forms Builder</h3>
                        <p>Create custom forms (Admin)</p>
                        <span className="badge success">Phase 5 ✓</span>
                    </div>

                    <div className="feature-card active" onClick={() => navigate('/team')}>
                        <div className="feature-icon">👥</div>
                        <h3>Team & Roles</h3>
                        <p>Manage members and roles</p>
                        <span className="badge success">Phase 5.1 ✓</span>
                    </div>

                    <div className="feature-card active" onClick={() => navigate('/groups')}>
                        <div className="feature-icon">🏘️</div>
                        <h3>User Groups</h3>
                        <p>Create groups for assignments</p>
                        <span className="badge success">Phase 5.2 ✓</span>
                    </div>

                    <div className="feature-card disabled">
                        <div className="feature-icon">📈</div>
                        <h3>Dashboards</h3>
                        <p>Coming in Phase 6</p>
                        <span className="badge">Phase 6</span>
                    </div>

                    <div className="feature-card disabled">
                        <div className="feature-icon">🤖</div>
                        <h3>AI Summary</h3>
                        <p>Coming in Phase 7</p>
                        <span className="badge">Phase 7</span>
                    </div>
                </div>

                <div className="info-panel">
                    <h3>🎉 What's Working Now (Phase 1)</h3>
                    <ul>
                        <li>✅ Google OAuth authentication (backend ready)</li>
                        <li>✅ Development email login</li>
                        <li>✅ Create organizations with unique join codes</li>
                        <li>✅ Join organizations by code</li>
                        <li>✅ Role-based access control (Owner/Admin/Leader/Employee)</li>
                        <li>✅ Organization switching</li>
                        <li>✅ Complete database schema for all phases</li>
                    </ul>
                </div>
            </main>
        </div>
    );
}
