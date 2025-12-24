import { reportsAPI } from '../../services/api';
import './ReportHistory.css';

export default function ReportHistory({ reports, onViewReport, orgId, onUpdate }) {
    const getStatusBadge = (status) => {
        const badges = {
            submitted: { text: 'Pending', class: 'status-pending' },
            approved: { text: 'Approved', class: 'status-approved' },
            rejected: { text: 'Rejected', class: 'status-rejected' }
        };
        return badges[status] || badges.submitted;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const handleDelete = async (reportId) => {
        if (!window.confirm('Delete this report?')) return;

        try {
            await reportsAPI.deleteReport(orgId, reportId);
            onUpdate();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete report');
        }
    };

    if (reports.length === 0) {
        return (
            <div className="report-history">
                <h3>📊 Report History</h3>
                <div className="empty-state">
                    <p>📭 No reports submitted yet</p>
                    <p className="empty-subtitle">Create your first daily report!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="report-history">
            <h3>📊 Report History</h3>
            <div className="history-list">
                {reports.map(report => {
                    const statusBadge = getStatusBadge(report.status);

                    return (
                        <div key={report.id} className="history-item">
                            <div className="item-content" onClick={() => onViewReport(report.id)}>
                                <div className="item-header">
                                    <span className="item-date">{formatDate(report.report_date)}</span>
                                    <span className={`item-status ${statusBadge.class}`}>
                                        {statusBadge.text}
                                    </span>
                                </div>
                                <div className="item-meta">
                                    <span>Submitted: {formatDate(report.submitted_at)}</span>
                                </div>
                            </div>
                            {report.status !== 'approved' && (
                                <button
                                    className="btn-delete-item"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(report.id);
                                    }}
                                    title="Delete report"
                                >
                                    🗑️
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
