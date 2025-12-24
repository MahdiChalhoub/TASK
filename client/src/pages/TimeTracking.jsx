import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { timeAPI, taskAPI } from '../services/api';
import DaySession from '../components/time/DaySession';
import TaskTimer from '../components/time/TaskTimer';
import QuickLog from '../components/time/QuickLog';
import TimeHistory from '../components/time/TimeHistory';
import './TimeTracking.css';

export default function TimeTracking() {
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
    const [daySessionStatus, setDaySessionStatus] = useState({ isClockedIn: false, session: null });
    const [activeTimers, setActiveTimers] = useState([]);
    const [timeHistory, setTimeHistory] = useState([]);
    const [tasks, setTasks] = useState([]);
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
        loadTimeHistory();
    }, [selectedDate]);

    const loadData = async () => {
        try {
            const [sessionRes, timersRes, tasksRes, historyRes] = await Promise.all([
                timeAPI.getSessionStatus(orgId),
                timeAPI.getActiveTimers(orgId),
                taskAPI.getAll(orgId, { status: 'in_progress' }),
                timeAPI.getHistory(orgId, selectedDate)
            ]);

            setDaySessionStatus(sessionRes.data);
            setActiveTimers(timersRes.data);
            setTasks(tasksRes.data);
            setTimeHistory(historyRes.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load time tracking data:', err);
            setLoading(false);
        }
    };

    const loadTimeHistory = async () => {
        try {
            const response = await timeAPI.getHistory(orgId, selectedDate);
            setTimeHistory(response.data);
        } catch (err) {
            console.error('Failed to load time history:', err);
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

    if (loading) {
        return <div className="loading-screen"><div className="spinner"></div></div>;
    }

    return (
        <div className="time-tracking-page">
            <header className="time-header">
                <div className="header-left">
                    <h1>🏢 {orgName}</h1>
                    <span className="role-badge">{userRole}</span>
                </div>
                <div className="header-right">
                    <button onClick={() => navigate('/dashboard')} className="btn-nav">Dashboard</button>
                    <button onClick={() => navigate('/tasks')} className="btn-nav">Tasks</button>
                    <span className="user-name">{user?.name || user?.email}</span>
                    <button onClick={handleChangeOrg} className="btn-change-org">Change Org</button>
                    <button onClick={logout} className="btn-logout">Logout</button>
                </div>
            </header>

            <div className="time-container">
                <main className="time-main">
                    <div className="time-toolbar">
                        <h2>⏱️ Time Tracking</h2>
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

                    <div className="time-blocks">
                        <DaySession
                            status={daySessionStatus}
                            onUpdate={refreshData}
                            orgId={orgId}
                        />

                        <TaskTimer
                            tasks={tasks}
                            activeTimers={activeTimers}
                            daySessionActive={daySessionStatus.isClockedIn}
                            onUpdate={refreshData}
                            orgId={orgId}
                        />

                        <QuickLog
                            tasks={tasks}
                            selectedDate={selectedDate}
                            onUpdate={refreshData}
                            orgId={orgId}
                        />
                    </div>

                    <TimeHistory
                        entries={timeHistory}
                        selectedDate={selectedDate}
                        onUpdate={refreshData}
                        orgId={orgId}
                    />
                </main>
            </div>
        </div>
    );
}
