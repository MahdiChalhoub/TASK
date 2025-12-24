import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { orgAPI } from '../services/api';
import './SelectOrganization.css';

export default function SelectOrganization() {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('select'); // 'select', 'create', 'join'
    const [newOrgName, setNewOrgName] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [error, setError] = useState('');
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        loadOrganizations();
    }, []);

    const loadOrganizations = async () => {
        try {
            const response = await orgAPI.getMyOrgs();
            setOrganizations(response.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load organizations:', err);
            setLoading(false);
        }
    };

    const handleCreateOrg = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await orgAPI.create(newOrgName);
            setNewOrgName('');
            setMode('select');
            loadOrganizations();
        } catch (err) {
            setError('Failed to create organization');
        }
    };

    const handleJoinOrg = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await orgAPI.join(joinCode);
            setJoinCode('');
            setMode('select');
            loadOrganizations();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to join organization');
        }
    };

    const selectOrg = (org) => {
        localStorage.setItem('selectedOrgId', org.id);
        localStorage.setItem('selectedOrgName', org.name);
        localStorage.setItem('userRole', org.role);
        navigate('/dashboard');
    };

    if (loading) {
        return <div className="loading-screen"><div className="spinner"></div></div>;
    }

    return (
        <div className="select-org-page">
            <header className="page-header">
                <div className="header-content">
                    <h1>🏢 Virtual Office</h1>
                    <div className="user-info">
                        <span>{user?.name || user?.email}</span>
                        <button onClick={logout} className="btn-logout">Logout</button>
                    </div>
                </div>
            </header>

            <main className="page-main">
                {mode === 'select' && (
                    <div className="org-selector">
                        <h2>Select Your Organization</h2>

                        {organizations.length === 0 ? (
                            <div className="empty-state">
                                <p>📭 You're not part of any organization yet</p>
                                <p>Create a new organization or join an existing one</p>
                            </div>
                        ) : (
                            <div className="org-grid">
                                {organizations.map(org => (
                                    <div key={org.id} className="org-card" onClick={() => selectOrg(org)}>
                                        <div className="org-icon">🏢</div>
                                        <h3>{org.name}</h3>
                                        <p className="org-role">{org.role}</p>
                                        <p className="org-code">Code: {org.join_code}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="action-buttons">
                            <button className="btn btn-primary" onClick={() => setMode('create')}>
                                ➕ Create Organization
                            </button>
                            <button className="btn btn-secondary" onClick={() => setMode('join')}>
                                🔗 Join Organization
                            </button>
                        </div>
                    </div>
                )}

                {mode === 'create' && (
                    <div className="org-form">
                        <h2>Create New Organization</h2>
                        <form onSubmit={handleCreateOrg}>
                            <div className="form-group">
                                <label>Organization Name</label>
                                <input
                                    type="text"
                                    value={newOrgName}
                                    onChange={(e) => setNewOrgName(e.target.value)}
                                    placeholder="Acme Corp"
                                    required
                                    autoFocus
                                />
                            </div>
                            {error && <div className="error-message">{error}</div>}
                            <div className="form-actions">
                                <button type="submit" className="btn btn-primary">Create</button>
                                <button type="button" className="btn btn-secondary" onClick={() => setMode('select')}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {mode === 'join' && (
                    <div className="org-form">
                        <h2>Join Organization</h2>
                        <form onSubmit={handleJoinOrg}>
                            <div className="form-group">
                                <label>Join Code</label>
                                <input
                                    type="text"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                    placeholder="Enter 10-character code"
                                    required
                                    autoFocus
                                />
                            </div>
                            {error && <div className="error-message">{error}</div>}
                            <div className="form-actions">
                                <button type="submit" className="btn btn-primary">Join</button>
                                <button type="button" className="btn btn-secondary" onClick={() => setMode('select')}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}
