import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { orgAPI } from '../services/api';
import './Team.css';

export default function Team() {
    const [orgId] = useState(localStorage.getItem('selectedOrgId'));
    const [orgName] = useState(localStorage.getItem('selectedOrgName'));
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUserRole] = useState(localStorage.getItem('userRole'));
    const navigate = useNavigate();

    const isAdmin = ['admin', 'owner'].includes(currentUserRole);

    useEffect(() => {
        if (!orgId) return;
        loadData();
    }, [orgId]);

    const loadData = async () => {
        try {
            const res = await orgAPI.getMembers(orgId);
            setMembers(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load members:', err);
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            await orgAPI.updateMemberRole(orgId, userId, newRole);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update role');
        }
    };

    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [bulkRole, setBulkRole] = useState('');

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedMemberIds(members.map(m => m.id));
        } else {
            setSelectedMemberIds([]);
        }
    };

    const handleSelectMember = (id) => {
        setSelectedMemberIds(prev =>
            prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
        );
    };

    const handleBulkRoleUpdate = async () => {
        if (!bulkRole || selectedMemberIds.length === 0) return;

        if (!window.confirm(`Update role to ${bulkRole} for ${selectedMemberIds.length} users?`)) return;

        try {
            await Promise.all(selectedMemberIds.map(userId =>
                orgAPI.updateMemberRole(orgId, userId, bulkRole)
            ));
            loadData();
            setSelectedMemberIds([]);
            setBulkRole('');
        } catch (err) {
            alert('Failed to update some roles');
        }
    };

    const handleInvite = () => {
        const link = `${window.location.origin}/join/${orgId}`; // Mock link
        navigator.clipboard.writeText(link);
        alert('Invite link copied to clipboard: ' + link);
    };

    const handleDevCreateUser = async () => {
        const email = prompt("Enter email for new user:");
        if (!email) return;
        const name = email.split('@')[0];

        try {
            // Using a new dev-only endpoint we will create
            await orgAPI.devCreateUser(orgId, email, name);
            alert(`User ${email} created and added to organization!`);
            loadData();
        } catch (err) {
            alert('Failed to create user: ' + (err.response?.data?.error || err.message));
        }
    };

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="team-page">
            <header className="page-header">
                <div className="header-left">
                    <h1>👥 Team Members</h1>
                    <p className="subtitle">{orgName}</p>
                </div>
                <div className="header-actions">
                    <button onClick={handleInvite} className="btn-primary">🔗 Invite Users</button>
                    <button onClick={handleDevCreateUser} className="btn-secondary" style={{ backgroundColor: '#f0f0f0', color: '#333' }}>👤 Dev: Create User</button>
                    <button onClick={() => navigate('/groups')} className="btn-secondary">Manage Groups</button>
                    <button onClick={() => navigate('/dashboard')} className="btn-secondary">Dashboard</button>
                </div>
            </header>

            {/* Dev Create User Modal - simplified as prompt for now or custom UI */}

            {selectedMemberIds.length > 0 && isAdmin && (
                <div className="bulk-actions-bar">
                    <span>{selectedMemberIds.length} users selected</span>
                    <div className="bulk-controls">
                        <select
                            value={bulkRole}
                            onChange={(e) => setBulkRole(e.target.value)}
                            className="role-select"
                        >
                            <option value="">Select Role...</option>
                            <option value="admin">Admin</option>
                            <option value="leader">Leader</option>
                            <option value="employee">Employee</option>
                        </select>
                        <button
                            onClick={handleBulkRoleUpdate}
                            className="btn-primary"
                            disabled={!bulkRole}
                        >
                            Update Roles
                        </button>
                    </div>
                </div>
            )}

            <div className="members-table-container">
                <table className="members-table">
                    <thead>
                        <tr>
                            {isAdmin && (
                                <th style={{ width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        onChange={handleSelectAll}
                                        checked={selectedMemberIds.length === members.length && members.length > 0}
                                    />
                                </th>
                            )}
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Joined</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.map(member => (
                            <tr key={member.id} className={selectedMemberIds.includes(member.id) ? 'selected-row' : ''}>
                                {isAdmin && (
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedMemberIds.includes(member.id)}
                                            onChange={() => handleSelectMember(member.id)}
                                            disabled={member.role === 'owner'}
                                        />
                                    </td>
                                )}
                                <td>{member.name}</td>
                                <td>{member.email}</td>
                                <td>
                                    {isAdmin && member.role !== 'owner' ? (
                                        <select
                                            value={member.role}
                                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                            className="role-select"
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="leader">Leader</option>
                                            <option value="employee">Employee</option>
                                        </select>
                                    ) : (
                                        <span className={`role-badge role-${member.role}`}>{member.role}</span>
                                    )}
                                </td>
                                <td>{new Date(member.created_at).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
