import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupAPI, orgAPI } from '../services/api';
import './Groups.css';

export default function Groups() {
    const [orgId] = useState(localStorage.getItem('selectedOrgId'));
    const [orgName] = useState(localStorage.getItem('selectedOrgName'));
    const [groups, setGroups] = useState([]);
    const [orgMembers, setOrgMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null); // For managing members
    const [groupMembers, setGroupMembers] = useState([]);
    const [showManageModal, setShowManageModal] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        if (!orgId) return;
        loadData();
    }, [orgId]);

    const loadData = async () => {
        try {
            const [groupsRes, membersRes] = await Promise.all([
                groupAPI.getAll(orgId),
                orgAPI.getMembers(orgId)
            ]);
            setGroups(groupsRes.data);
            setOrgMembers(membersRes.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load data:', err);
            setLoading(false);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        try {
            await groupAPI.create(orgId, newGroupName);
            setNewGroupName('');
            setShowCreateModal(false);
            loadData();
        } catch (err) {
            alert('Failed to create group');
        }
    };

    const handleDeleteGroup = async (id) => {
        if (!window.confirm('Delete this group?')) return;
        try {
            await groupAPI.delete(orgId, id);
            loadData();
        } catch (err) {
            alert('Failed to delete group');
        }
    };

    const handleManageMembers = async (group) => {
        setSelectedGroup(group);
        try {
            const res = await groupAPI.getMembers(orgId, group.id);
            setGroupMembers(res.data);
            setShowManageModal(true);
        } catch (err) {
            alert('Failed to load group members');
        }
    };

    const [selectedUserIds, setSelectedUserIds] = useState([]);

    const handleAddSelectedMembers = async () => {
        try {
            await Promise.all(selectedUserIds.map(userId =>
                groupAPI.addMember(orgId, selectedGroup.id, userId)
            ));

            // Refresh members
            const res = await groupAPI.getMembers(orgId, selectedGroup.id);
            setGroupMembers(res.data);
            setSelectedUserIds([]); // Reset selection
            loadData();
        } catch (err) {
            alert('Failed to add some members');
            console.error(err);
        }
    };

    // Keep single add for compatibility/fallback if needed, but UI uses bulk now
    const handleAddMember = async (userId) => {
        try {
            await groupAPI.addMember(orgId, selectedGroup.id, userId);
            // Refresh members
            const res = await groupAPI.getMembers(orgId, selectedGroup.id);
            setGroupMembers(res.data);
            loadData(); // To update group member count
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to add member');
        }
    };

    const handleRemoveMember = async (userId) => {
        try {
            await groupAPI.removeMember(orgId, selectedGroup.id, userId);
            // Refresh members
            const res = await groupAPI.getMembers(orgId, selectedGroup.id);
            setGroupMembers(res.data);
            loadData(); // To update group member count
        } catch (err) {
            alert('Failed to remove member');
        }
    };

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="groups-page">
            <header className="page-header">
                <div className="header-left">
                    <h1>👥 User Groups</h1>
                    <p className="subtitle">{orgName}</p>
                </div>
                <div className="header-actions">
                    <button onClick={() => navigate('/dashboard')} className="btn-secondary">Dashboard</button>
                    <button onClick={() => setShowCreateModal(true)} className="btn-primary">➕ Create Group</button>
                </div>
            </header>

            <div className="groups-grid">
                {groups.map(group => (
                    <div key={group.id} className="group-card">
                        <div className="group-info">
                            <h3>{group.name}</h3>
                            <span className="member-count">{group.member_count} members</span>
                        </div>
                        <div className="group-actions">
                            <button onClick={() => handleManageMembers(group)} className="btn-outline">Manage Members</button>
                            <button onClick={() => handleDeleteGroup(group.id)} className="btn-danger-text">Delete</button>
                        </div>
                    </div>
                ))}
            </div>

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>Create New Group</h2>
                        <form onSubmit={handleCreateGroup}>
                            <div className="form-group">
                                <label>Group Name</label>
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showManageModal && selectedGroup && (
                <div className="modal-overlay" onClick={() => setShowManageModal(false)}>
                    <div className="modal-content manage-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Manage {selectedGroup.name}</h2>
                            <button className="btn-close" onClick={() => setShowManageModal(false)}>✕</button>
                        </div>

                        <div className="manage-body">
                            <div className="current-members">
                                <h3>Current Members</h3>
                                {groupMembers.length === 0 ? <p className="empty-text">No members yet</p> : (
                                    <ul className="member-list">
                                        {groupMembers.map(m => (
                                            <li key={m.id}>
                                                <span>{m.name} <span className="email-text">({m.email})</span></span>
                                                <button onClick={() => handleRemoveMember(m.id)} className="btn-sm-danger">Remove</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="add-members">
                                <h3>Add Members</h3>
                                <div className="member-select-list multi-select">
                                    {orgMembers
                                        .filter(om => !groupMembers.find(gm => gm.id === om.id))
                                        .map(m => (
                                            <div key={m.id} className="member-option checkbox-option">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUserIds.includes(m.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedUserIds(prev => [...prev, m.id]);
                                                            } else {
                                                                setSelectedUserIds(prev => prev.filter(id => id !== m.id));
                                                            }
                                                        }}
                                                    />
                                                    <span>{m.name}</span>
                                                </label>
                                            </div>
                                        ))
                                    }
                                    {orgMembers.filter(om => !groupMembers.find(gm => gm.id === om.id)).length === 0 && (
                                        <p className="empty-text">All users are already in this group</p>
                                    )}
                                </div>
                                <button
                                    className="btn-primary btn-block"
                                    disabled={selectedUserIds.length === 0}
                                    onClick={handleAddSelectedMembers}
                                >
                                    Add Selected ({selectedUserIds.length})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
