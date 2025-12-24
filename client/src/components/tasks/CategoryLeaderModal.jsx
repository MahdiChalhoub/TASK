import { useState } from 'react';
import { categoryAPI } from '../../services/api';
import './CategoryLeaderModal.css';

export default function CategoryLeaderModal({ category, members, orgId, onClose, onUpdate }) {
    const [selectedLeader, setSelectedLeader] = useState(category.leader_user_id || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            await categoryAPI.update(orgId, category.id, {
                leader_user_id: selectedLeader || null
            });
            onUpdate();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update category leader');
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content category-leader-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>👤 Assign Category Leader</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    <div className="category-info">
                        <h3>📁 {category.name}</h3>
                        <p>Assign a leader who can manage tasks and team members for this category.</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Select Leader</label>
                            <select
                                value={selectedLeader}
                                onChange={(e) => setSelectedLeader(e.target.value)}
                                className="leader-select"
                            >
                                <option value="">No Leader</option>
                                {members
                                    .filter(m => ['admin', 'owner', 'leader'].includes(m.role))
                                    .map(member => (
                                        <option key={member.id} value={member.id}>
                                            {member.name} ({member.email}) - {member.role}
                                        </option>
                                    ))
                                }
                            </select>
                            <small className="help-text">
                                Only Admin, Owner, and Leader roles can be assigned as category leaders.
                            </small>
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <div className="modal-actions">
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? 'Saving...' : 'Assign Leader'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
