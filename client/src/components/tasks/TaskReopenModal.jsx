import { useState } from 'react';
import './TaskModal.css';

export default function TaskReopenModal({ task, onReopen, onCancel }) {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!reason.trim()) {
            setError('Please provide a reason for reopening this task.');
            return;
        }

        onReopen(reason);
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content completion-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Reopen Task</h2>
                    <button className="btn-close" onClick={onCancel}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="completion-info">
                        <p>You are reopening the task: <strong>{task.title}</strong></p>
                        <p className="text-muted">Please provide a reason. This will be logged in the task activity.</p>
                    </div>

                    <div className="form-group">
                        <label>Reason for Reopening *</label>
                        <textarea
                            value={reason}
                            onChange={(e) => {
                                setReason(e.target.value);
                                setError('');
                            }}
                            placeholder="e.g. Client requested rework, Requirements changed..."
                            rows="3"
                            required
                            autoFocus
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onCancel}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Reopen Task
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
