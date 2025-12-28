import { useState } from 'react';
import './TaskCompletionModal.css';

export default function TaskCompletionModal({ task, onComplete, onCancel }) {
    const [actualMinutes, setActualMinutes] = useState(task.estimated_minutes || 0);
    const [hours, setHours] = useState(Math.floor((task.estimated_minutes || 0) / 60));
    const [minutes, setMinutes] = useState((task.estimated_minutes || 0) % 60);

    const handleHoursChange = (value) => {
        const h = parseInt(value) || 0;
        setHours(h);
        setActualMinutes(h * 60 + minutes);
    };

    const handleMinutesChange = (value) => {
        const m = parseInt(value) || 0;
        setMinutes(m);
        setActualMinutes(hours * 60 + m);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onComplete(actualMinutes);
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="completion-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="completion-modal-header">
                    <h2>✅ Complete Task</h2>
                    <button className="btn-close" onClick={onCancel}>✕</button>
                </div>

                <div className="completion-modal-body">
                    <div className="task-info">
                        <h3>{task.title}</h3>
                        {task.estimated_minutes > 0 && (
                            <p className="estimated-time">
                                📊 Estimated: {Math.floor(task.estimated_minutes / 60)}h {task.estimated_minutes % 60}m
                            </p>
                        )}
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="time-input-section">
                            <label>⏱️ How long did this task actually take?</label>
                            <div className="time-inputs">
                                <div className="time-input-group">
                                    <input
                                        type="number"
                                        min="0"
                                        value={hours}
                                        onChange={(e) => handleHoursChange(e.target.value)}
                                        placeholder="0"
                                    />
                                    <span>hours</span>
                                </div>
                                <div className="time-input-group">
                                    <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={minutes}
                                        onChange={(e) => handleMinutesChange(e.target.value)}
                                        placeholder="0"
                                    />
                                    <span>minutes</span>
                                </div>
                            </div>
                            <p className="total-time">
                                Total: <strong>{actualMinutes} minutes</strong>
                            </p>
                        </div>

                        <div className="completion-modal-actions">
                            <button type="button" className="btn btn-secondary" onClick={onCancel}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary">
                                ✅ Mark as Complete
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
