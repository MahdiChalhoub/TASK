import { useState, useEffect } from 'react';
import { formsAPI, groupAPI, orgAPI } from '../../services/api';
import './FormAssignments.css';

export default function FormAssignments({ form, orgId, onClose }) {
    const [assignments, setAssignments] = useState([]);
    const [targetType, setTargetType] = useState('user'); // user, group, role
    const [targetId, setTargetId] = useState('');
    const [targetRole, setTargetRole] = useState(''); // admin, leader, employee
    const [loading, setLoading] = useState(true);

    // Options
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);

    useEffect(() => {
        loadData();
    }, [form]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [assignRes, usersRes, groupsRes] = await Promise.all([
                formsAPI.getAssignments(orgId, form.id),
                orgAPI.getMembers(orgId),
                groupAPI.getAll(orgId)
            ]);

            setAssignments(assignRes.data);
            setUsers(usersRes.data);
            setGroups(groupsRes.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load assignments:', err);
            setLoading(false);
        }
    };

    const handleAssign = async (e) => {
        e.preventDefault();
        try {
            await formsAPI.assign(orgId, form.id, {
                target_type: targetType,
                target_id: targetType === 'role' ? 0 : targetId,
                target_role: targetType === 'role' ? targetRole : null
            });

            // Reset and reload
            setTargetId('');
            setTargetRole('');
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to assign');
        }
    };

    const handleRemove = async (assignmentId) => {
        if (!window.confirm('Remove this assignment?')) return;
        try {
            await formsAPI.removeAssignment(orgId, form.id, assignmentId);
            loadData();
        } catch (err) {
            alert('Failed to remove assignment');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content assignments-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Assign "{form.title}"</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <div className="assignments-body">
                    <div className="assign-form-section">
                        <h3>Add Assignment</h3>
                        <form onSubmit={handleAssign} className="assign-form">
                            <div className="form-group">
                                <label>Assign To</label>
                                <select value={targetType} onChange={e => {
                                    setTargetType(e.target.value);
                                    setTargetId('');
                                    setTargetRole('');
                                }}>
                                    <option value="user">Specific User</option>
                                    <option value="group">User Group</option>
                                    <option value="role">Role</option>
                                </select>
                            </div>

                            {targetType === 'user' && (
                                <div className="form-group">
                                    <label>Select User</label>
                                    <select value={targetId} onChange={e => setTargetId(e.target.value)} required>
                                        <option value="">-- Select User --</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {targetType === 'group' && (
                                <div className="form-group">
                                    <label>Select Group</label>
                                    <select value={targetId} onChange={e => setTargetId(e.target.value)} required>
                                        <option value="">-- Select Group --</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name} ({g.member_count} members)</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {targetType === 'role' && (
                                <div className="form-group">
                                    <label>Select Role</label>
                                    <select value={targetRole} onChange={e => setTargetRole(e.target.value)} required>
                                        <option value="">-- Select Role --</option>
                                        <option value="owner">Owner</option>
                                        <option value="admin">Admin</option>
                                        <option value="leader">Leader</option>
                                        <option value="employee">Employee</option>
                                    </select>
                                </div>
                            )}

                            <button type="submit" className="btn-primary" disabled={
                                (targetType !== 'role' && !targetId) ||
                                (targetType === 'role' && !targetRole)
                            }>
                                Assign
                            </button>
                        </form>
                    </div>

                    <div className="current-assignments">
                        <h3>Current Assignments</h3>
                        {assignments.length === 0 ? (
                            <p className="empty-text">
                                No assignments. <br />
                                <small>Usually this means everyone can see this form.</small>
                            </p>
                        ) : (
                            <ul className="assignment-list">
                                {assignments.map(a => (
                                    <li key={a.id} className="assignment-item">
                                        <div className="assignment-info">
                                            <span className={`type-badge type-${a.target_type}`}>{a.target_type}</span>
                                            <span className="target-name">
                                                {a.target_name || (a.target_type === 'role' ? a.target_role : 'Unknown')}
                                            </span>
                                        </div>
                                        <button onClick={() => handleRemove(a.id)} className="btn-icon-danger">✕</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
