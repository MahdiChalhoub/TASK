import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { reportsAPI } from '../services/api';
import ReportSubmission from '../components/reports/ReportSubmission';
import ReportHistory from '../components/reports/ReportHistory';
import ReportDetail from '../components/reports/ReportDetail';
import './Reports.css';

export default function Reports() {
    const [orgId] = useState(localStorage.getItem('selectedOrgId'));
    const [orgName] = useState(localStorage.getItem('selectedOrgName'));
    const [userRole] = useState(localStorage.getItem('userRole'));
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [reportStatus, setReportStatus] = useState({ hasReport: false, report: null });
    const [reportHistory, setReportHistory] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!orgId) {
            navigate('/select-org');
            return;
        }
        loadData();
    }, [orgId, navigate]);

    useEffect(() => {
        loadReportStatus();
    }, [selectedDate]);

    const loadData = async () => {
        try {
            const [statusRes, historyRes] = await Promise.all([
                reportsAPI.getStatus(orgId, selectedDate),
                reportsAPI.getHistory(orgId)
            ]);

            setReportStatus(statusRes.data);
            setReportHistory(historyRes.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load reports data:', err);
            setLoading(false);
        }
    };

    const loadReportStatus = async () => {
        try {
            const response = await reportsAPI.getStatus(orgId, selectedDate);
            setReportStatus(response.data);
        } catch (err) {
            console.error('Failed to load report status:', err);
        }
    };

    const refreshData = () => {
        loadData();
    };

    const handleChangeOrg = () => {
        localStorage.removeItem('selectedOrgId');
        localStorage.removeItem('selectedOrgName');
        localStorage.removeItem('userRole');
        navigate('/select-org');
    };

    const handleViewReport = (reportId) => {
        setSelectedReport(reportId);
    };

    const handleCloseDetail = () => {
        setSelectedReport(null);
        refreshData();
    };

    if (loading) {
        return <div className="loading-screen"><div className="spinner"></div></div>;
    }

    return (
        <div className="reports-page">
            <header className="reports-header">
                <div className="header-left">
                    <h1>🏢 {orgName}</h1>
                    <span className="role-badge">{userRole}</span>
                </div>
                <div className="header-right">
                    <button onClick={() => navigate('/dashboard')} className="btn-nav">Dashboard</button>
                    <button onClick={() => navigate('/tasks')} className="btn-nav">Tasks</button>
                    <button onClick={() => navigate('/time')} className="btn-nav">Time</button>
                    <span className="user-name">{user?.name || user?.email}</span>
                    <button onClick={handleChangeOrg} className="btn-change-org">Change Org</button>
                    <button onClick={logout} className="btn-logout">Logout</button>
                </div>
            </header>

            <div className="reports-container">
                <main className="reports-main">
                    <div className="reports-toolbar">
                        <h2>📝 Daily Reports</h2>
                        <div className="date-selector">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                max={(() => {
                                    const now = new Date();
                                    const year = now.getFullYear();
                                    const month = String(now.getMonth() + 1).padStart(2, '0');
                                    const day = String(now.getDate()).padStart(2, '0');
                                    return `${year}-${month}-${day}`;
                                })()}
                            />
                        </div>
                    </div>

                    <ReportSubmission
                        orgId={orgId}
                        selectedDate={selectedDate}
                        reportStatus={reportStatus}
                        onUpdate={refreshData}
                    />

                    <ReportHistory
                        reports={reportHistory}
                        onViewReport={handleViewReport}
                        orgId={orgId}
                        onUpdate={refreshData}
                    />
                </main>
            </div>

            {selectedReport && (
                <ReportDetail
                    reportId={selectedReport}
                    orgId={orgId}
                    onClose={handleCloseDetail}
                />
            )}
        </div>
    );
}
