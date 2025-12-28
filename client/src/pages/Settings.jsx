import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { settingsAPI } from '../services/api';
import './Settings.css';

export default function Settings() {
    const [orgId] = useState(localStorage.getItem('selectedOrgId'));
    const [orgName] = useState(localStorage.getItem('selectedOrgName'));
    const [settings, setSettings] = useState(null);
    const [cutoffHour, setCutoffHour] = useState(15);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!orgId) {
            navigate('/select-org');
            return;
        }
        loadSettings();
    }, [orgId, navigate]);

    const loadSettings = async () => {
        try {
            const response = await settingsAPI.get(orgId);
            setSettings(response.data);
            setCutoffHour(response.data.task_due_date_cutoff_hour || 15);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load settings:', err);
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');

        try {
            await settingsAPI.update(orgId, {
                task_due_date_cutoff_hour: cutoffHour
            });
            setMessage('Settings saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setMessage('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleChangeOrg = () => {
        localStorage.removeItem('selectedOrgId');
        localStorage.removeItem('selectedOrgName');
        localStorage.removeItem('userRole');
        navigate('/select-org');
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    if (loading) {
        return <div className="loading-screen"><div className="spinner"></div></div>;
    }

    return (
        <div className="settings-page">
            <header className="settings-header">
                <div className="header-left">
                    <h1>⚙️ Settings</h1>
                    <span className="org-name">{orgName}</span>
                </div>
                <div className="header-right">
                    <span className="user-name">{user?.name}</span>
                    <button className="btn-nav" onClick={() => navigate('/dashboard')}>
                        🏠 Dashboard
                    </button>
                    <button className="btn-nav" onClick={handleChangeOrg}>
                        🔄 Change Org
                    </button>
                    <button className="btn-nav" onClick={handleLogout}>
                        🚪 Logout
                    </button>
                </div>
            </header>

            <main className="settings-main">
                <div className="settings-card">
                    <h2>📅 Task Due Date Settings</h2>
                    <p className="settings-description">
                        Configure when new tasks should be due by default based on the time you create them.
                    </p>

                    <div className="setting-item">
                        <label htmlFor="cutoffHour">
                            <strong>Cutoff Hour</strong>
                            <span className="label-description">
                                Tasks created before this hour will be due today, after this hour will be due tomorrow
                            </span>
                        </label>
                        <div className="cutoff-hour-input">
                            <input
                                type="number"
                                id="cutoffHour"
                                min="0"
                                max="23"
                                value={cutoffHour}
                                onChange={(e) => setCutoffHour(parseInt(e.target.value))}
                            />
                            <span className="hour-display">:00 ({cutoffHour === 0 ? '12' : cutoffHour > 12 ? cutoffHour - 12 : cutoffHour} {cutoffHour >= 12 ? 'PM' : 'AM'})</span>
                        </div>
                    </div>

                    <div className="example-box">
                        <h4>📝 Example:</h4>
                        <p>With cutoff hour set to <strong>{cutoffHour}:00</strong>:</p>
                        <ul>
                            <li>✅ Task created at {cutoffHour - 1}:30 → Due date: <strong>Today</strong></li>
                            <li>⏰ Task created at {cutoffHour}:30 → Due date: <strong>Tomorrow</strong></li>
                        </ul>
                    </div>

                    <div className="settings-actions">
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : '💾 Save Settings'}
                        </button>
                        {message && (
                            <span className={`message ${message.includes('success') ? 'success' : 'error'}`}>
                                {message}
                            </span>
                        )}
                    </div>
                </div>

                <div className="settings-card">
                    <h2>ℹ️ About This Feature</h2>
                    <p>
                        The smart due date feature helps you manage tasks more efficiently by automatically
                        setting appropriate due dates based on when you create them.
                    </p>
                    <ul className="feature-list">
                        <li>🎯 <strong>Automatic</strong>: No need to manually select due dates for every task</li>
                        <li>⏰ <strong>Time-aware</strong>: Considers the current time when setting defaults</li>
                        <li>✏️ <strong>Flexible</strong>: You can always change the due date when creating a task</li>
                        <li>👤 <strong>Personal</strong>: Each user can set their own cutoff hour preference</li>
                    </ul>
                </div>
            </main>
        </div>
    );
}
