import { useState, useEffect } from 'react';
import { reportsAPI } from '../../services/api';
import './ReportDetail.css';

export default function ReportDetail({ reportId, orgId, onClose }) {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadReport();
    }, [reportId]);

    const loadReport = async () => {
        try {
            const response = await reportsAPI.getReport(orgId, reportId);
            setReport(response.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load report:', err);
            alert('Failed to load report');
            onClose();
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatTime = (isoString) => {
        if (!isoString) return '--:--';
        return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const getStatusBadge = (status) => {
        const badges = {
            submitted: { text: 'Pending Review', class: 'status-pending' },
            approved: { text: 'Approved', class: 'status-approved' },
            rejected: { text: 'Rejected', class: 'status-rejected' }
        };
        return badges[status] || badges.submitted;
    };

    if (loading) {
        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="loading-screen"><div className="spinner"></div></div>
                </div>
            </div>
        );
    }

    const statusBadge = getStatusBadge(report.status);
    const totalTime = report.time_entries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content report-detail" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2>📝 Daily Report</h2>
                        <p className="report-date">{formatDate(report.report_date)}</p>
                    </div>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <div className="detail-content">
                    <div className="detail-status">
                        <span className={`status-badge-large ${statusBadge.class}`}>
                            {statusBadge.text}
                        </span>
                        <span className="submitted-info">
                            Submitted: {formatDate(report.submitted_at)}
                        </span>
                    </div>

                    <div className="detail-section">
                        <h3>✅ Completed Tasks ({report.tasks.length})</h3>
                        {report.tasks.length === 0 ? (
                            <p className="empty-message">No tasks completed</p>
                        ) : (
                            <ul className="detail-task-list">
                                {report.tasks.map(task => (
                                    <li key={task.id}>
                                        <span className="task-title">{task.title}</span>
                                        {task.category_name && (
                                            <span className="task-category">{task.category_name}</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="detail-section">
                        <h3>⏱️ Time Entries</h3>
                        <div className="time-entries-list">
                            {report.time_entries.map(entry => (
                                <div key={entry.id} className="time-entry-item">
                                    <div className="entry-type">
                                        {entry.type === 'day_session' && '📅 Day Session'}
                                        {entry.type === 'task_timer' && '⏲️ Task Timer'}
                                        {entry.type === 'manual' && '⚡ Manual Log'}
                                    </div>
                                    <div className="entry-details">
                                        {entry.task_title && <span className="entry-task">{entry.task_title}</span>}
                                        {entry.start_at && (
                                            <span className="entry-time">
                                                {formatTime(entry.start_at)}
                                                {entry.end_at && ` → ${formatTime(entry.end_at)}`}
                                            </span>
                                        )}
                                    </div>
                                    <div className="entry-duration">
                                        {formatDuration(entry.duration_minutes)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="time-total">
                            <strong>Total Time:</strong> {formatDuration(totalTime)}
                        </div>
                    </div>

                    {report.extra_work && report.extra_work.length > 0 && (
                        <div className="detail-section">
                            <h3>➕ Extra Work</h3>
                            <ul className="extra-work-list">
                                {report.extra_work.map(item => (
                                    <li key={item.id}>
                                        <span className="work-description">{item.description}</span>
                                        <span className="work-duration">{formatDuration(item.duration_minutes)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
