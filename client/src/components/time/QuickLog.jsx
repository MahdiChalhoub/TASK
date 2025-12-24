import { useState } from 'react';
import { timeAPI } from '../../services/api';
import './QuickLog.css';

export default function QuickLog({ tasks, selectedDate, onUpdate, orgId }) {
    const [taskId, setTaskId] = useState('');
    const [hours, setHours] = useState('');
    const [minutes, setMinutes] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);

        if (totalMinutes <= 0) {
            alert('Please enter a valid duration');
            return;
        }

        setLoading(true);
        try {
            await timeAPI.quickLog(orgId, {
                task_id: taskId || undefined,
                duration_minutes: totalMinutes,
                date: selectedDate,
                description: description || undefined
            });

            // Reset form
            setTaskId('');
            setHours('');
            setMinutes('');
            setDescription('');
            onUpdate();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to log time');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="time-block quick-log">
            <div className="block-header">
                <h3>⚡ Quick Log</h3>
                <span className="hint">Manual time entry</span>
            </div>

            <div className="block-content">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Task (Optional)</label>
                        <select
                            value={taskId}
                            onChange={(e) => setTaskId(e.target.value)}
                        >
                            <option value="">No task (general work)</option>
                            {tasks.map(task => (
                                <option key={task.id} value={task.id}>
                                    {task.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="duration-inputs">
                        <div className="form-group">
                            <label>Hours</label>
                            <input
                                type="number"
                                min="0"
                                max="23"
                                value={hours}
                                onChange={(e) => setHours(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                        <div className="form-group">
                            <label>Minutes</label>
                            <input
                                type="number"
                                min="0"
                                max="59"
                                value={minutes}
                                onChange={(e) => setMinutes(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Note (Optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What did you work on?"
                            rows="2"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Logging...' : '✓ Log Time'}
                    </button>
                </form>
            </div>
        </div>
    );
}
