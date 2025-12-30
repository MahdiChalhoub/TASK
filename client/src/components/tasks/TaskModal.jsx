import { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';
import './TaskModal.css';

export default function TaskModal({ task, categories, members, onSave, onClose, userRole, orgId }) {
    const [userSettings, setUserSettings] = useState(null);
    const [formData, setFormData] = useState({
        title: task?.title || '',
        description: task?.description || '',
        type: task?.type || 'normal', // fast, normal, action
        status: task?.status || 'pending',
        priority: task?.priority || 'medium',
        due_date: task?.due_date || '',
        category_id: task?.category_id || '',
        assigned_to_user_id: task?.assigned_to_user_id || '',
        estimated_minutes: task?.estimated_minutes || 0,
        is_alarmed: task?.is_alarmed || false,
        require_finish_time: task?.require_finish_time !== undefined ? task.require_finish_time : true
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Load user settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const response = await settingsAPI.get(orgId);
                setUserSettings(response.data);

                // Set smart default due date for new tasks only
                if (!task && !formData.due_date) {
                    const defaultDate = calculateDefaultDueDate(response.data.task_due_date_cutoff_hour || 15);
                    setFormData(prev => ({ ...prev, due_date: defaultDate }));
                }
            } catch (err) {
                console.error('Failed to load settings:', err);
                // Use default cutoff hour if settings fail to load
                if (!task && !formData.due_date) {
                    const defaultDate = calculateDefaultDueDate(15);
                    setFormData(prev => ({ ...prev, due_date: defaultDate }));
                }
            }
        };

        if (orgId) {
            loadSettings();
        }
    }, [orgId, task]);

    // Calculate smart default due date
    const calculateDefaultDueDate = (cutoffHour) => {
        const now = new Date();
        const currentHour = now.getHours();

        // If before cutoff hour, use today; otherwise use tomorrow
        if (currentHour < cutoffHour) {
            return now.toISOString().split('T')[0];
        } else {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toISOString().split('T')[0];
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            await onSave(formData);
        } catch (err) {
            const msg = err.response?.data?.details || err.response?.data?.error || 'Failed to save task';
            setError(msg);
            setSaving(false);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{task ? 'Edit Task' : 'Create New Task'}</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Title *</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            placeholder="What need to be done?"
                            required
                            autoFocus
                        />
                    </div>

                    {/* Task Type Selector */}
                    <div className="form-group">
                        <label>Task Type</label>
                        <div className="task-type-grid">
                            <button
                                type="button"
                                className={`type-card ${formData.type === 'fast' ? 'active fast' : ''}`}
                                onClick={() => handleChange('type', 'fast')}
                            >
                                <span className="icon">⚡</span>
                                <div className="info">
                                    <strong>Fast Task</strong>
                                    <small>&le; 1 min • Auto-Log</small>
                                </div>
                            </button>
                            <button
                                type="button"
                                className={`type-card ${formData.type === 'normal' ? 'active normal' : ''}`}
                                onClick={() => handleChange('type', 'normal')}
                            >
                                <span className="icon">📅</span>
                                <div className="info">
                                    <strong>Normal</strong>
                                    <small>Planned • Tracked</small>
                                </div>
                            </button>
                            <button
                                type="button"
                                className={`type-card ${formData.type === 'action' ? 'active action' : ''}`}
                                onClick={() => handleChange('type', 'action')}
                            >
                                <span className="icon">🎯</span>
                                <div className="info">
                                    <strong>Action</strong>
                                    <small>Requires Result</small>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Alarm Toggle */}
                    <div className="form-group checkbox-group">
                        <label className="toggle-label">
                            <input
                                type="checkbox"
                                checked={formData.is_alarmed}
                                onChange={(e) => handleChange('is_alarmed', e.target.checked)}
                            />
                            <span className="toggle-switch"></span>
                            <span className="label-text">
                                {formData.is_alarmed ? '🔔 Alarm Enabled (Repeats 30m)' : '🔕 No Alarm'}
                            </span>
                        </label>
                    </div>

                    {formData.type !== 'fast' && (
                        <div className="form-row">
                            <div className="form-group">
                                <label>Due Date</label>
                                <input
                                    type="date"
                                    value={formData.due_date ? formData.due_date.split('T')[0] : ''}
                                    onChange={(e) => handleChange('due_date', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Estimated Min</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.estimated_minutes}
                                    onChange={(e) => handleChange('estimated_minutes', parseInt(e.target.value))}
                                />
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="Add task description (optional)"
                            rows="3"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Status *</label>
                            <select
                                value={formData.status}
                                onChange={(e) => handleChange('status', e.target.value)}
                                required
                            >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="failed">Failed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Priority *</label>
                            <select
                                value={formData.priority}
                                onChange={(e) => handleChange('priority', e.target.value)}
                                required
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                    </div>

                    {/* Show Reason field if reopening a task */}
                    {task && task.status === 'completed' && formData.status !== 'completed' && (
                        <div className="form-group reason-group fade-in">
                            <label>Reason for Reopening *</label>
                            <textarea
                                value={formData.reason || ''}
                                onChange={(e) => handleChange('reason', e.target.value)}
                                placeholder="Why is this task being reopened? (Required)"
                                rows="2"
                                required
                                className="reason-input"
                            />
                        </div>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label>Category</label>
                            <select
                                value={formData.category_id}
                                onChange={(e) => handleChange('category_id', e.target.value)}
                            >
                                <option value="">No Category</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Due Date</label>
                            <input
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => handleChange('due_date', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Est. Time (mins)</label>
                            <input
                                type="number"
                                min="0"
                                step="15"
                                value={formData.estimated_minutes}
                                onChange={(e) => handleChange('estimated_minutes', parseInt(e.target.value) || 0)}
                                placeholder="e.g. 60"
                            />
                        </div>

                        <div className="form-group checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={formData.require_finish_time}
                                    onChange={(e) => handleChange('require_finish_time', e.target.checked)}
                                />
                                <span>⏱️ Require actual time when completing (recommended)</span>
                            </label>
                            <p className="field-hint">When enabled, user must enter actual time spent when marking task as complete</p>
                        </div>
                    </div>

                    {userRole !== 'employee' && (
                        <div className="form-group">
                            <label>Assigned To (Optional)</label>
                            <select
                                name="assigned_to_user_id"
                                value={formData.assigned_to_user_id}
                                onChange={(e) => handleChange('assigned_to_user_id', e.target.value)}
                                className="form-control"
                            >
                                <option value="">-- Unassigned --</option>
                                {members.map(member => (
                                    <option key={member.id} value={member.id}>
                                        {member.name} ({member.email})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {error && <div className="error-message">{error}</div>}

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : (task ? 'Update Task' : 'Create Task')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
