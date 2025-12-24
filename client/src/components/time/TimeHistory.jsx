import { timeAPI } from '../../services/api';
import './TimeHistory.css';

export default function TimeHistory({ entries, selectedDate, onUpdate, orgId }) {
    const formatTime = (isoString) => {
        if (!isoString) return '--:--';
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (minutes) => {
        if (!minutes) return '0m';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const getTypeLabel = (type) => {
        const labels = {
            day_session: '📅 Day Session',
            task_timer: '⏲️ Task Timer',
            manual: '⚡ Manual Log'
        };
        return labels[type] || type;
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: { text: 'Pending', class: 'status-pending' },
            approved: { text: 'Approved', class: 'status-approved' },
            rejected: { text: 'Rejected', class: 'status-rejected' }
        };
        return badges[status] || badges.pending;
    };

    const handleDelete = async (entryId) => {
        if (!window.confirm('Delete this time entry?')) return;

        try {
            await timeAPI.deleteEntry(orgId, entryId);
            onUpdate();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete entry');
        }
    };

    const getTotalTime = () => {
        const total = entries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
        return formatDuration(total);
    };

    const getSelectedDateLabel = () => {
        const today = new Date().toISOString().split('T')[0];
        if (selectedDate === today) return 'Today';

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (selectedDate === yesterday.toISOString().split('T')[0]) return 'Yesterday';

        return new Date(selectedDate).toLocaleDateString();
    };

    return (
        <div className="time-history">
            <div className="history-header">
                <h3>📊 Time History - {getSelectedDateLabel()}</h3>
                {entries.length > 0 && (
                    <div className="total-time">
                        Total: <strong>{getTotalTime()}</strong>
                    </div>
                )}
            </div>

            {entries.length === 0 ? (
                <div className="empty-state">
                    <p>📭 No time entries for this date</p>
                    <p className="empty-subtitle">Start tracking time or log manually!</p>
                </div>
            ) : (
                <div className="history-list">
                    {entries.map(entry => {
                        const statusBadge = getStatusBadge(entry.status);
                        const isActive = !entry.end_at;

                        return (
                            <div key={entry.id} className={`history-item ${isActive ? 'active' : ''}`}>
                                <div className="item-header">
                                    <span className="item-type">{getTypeLabel(entry.type)}</span>
                                    <span className={`item-status ${statusBadge.class}`}>
                                        {statusBadge.text}
                                    </span>
                                </div>

                                <div className="item-content">
                                    {entry.task_title && (
                                        <div className="item-task">📋 {entry.task_title}</div>
                                    )}

                                    <div className="item-time">
                                        {entry.start_at && (
                                            <span>
                                                {formatTime(entry.start_at)}
                                                {entry.end_at && ` → ${formatTime(entry.end_at)}`}
                                                {isActive && <span className="running-badge">● Running</span>}
                                            </span>
                                        )}
                                        <span className="duration">
                                            {formatDuration(entry.duration_minutes)}
                                        </span>
                                    </div>

                                    {entry.review_note && (
                                        <div className="item-note">💬 {entry.review_note}</div>
                                    )}
                                </div>

                                {!isActive && (
                                    <button
                                        className="btn-delete-entry"
                                        onClick={() => handleDelete(entry.id)}
                                        title="Delete entry"
                                    >
                                        🗑️
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
