import { useState } from 'react';
import { timeAPI } from '../../services/api';
import './DaySession.css';

export default function DaySession({ status, onUpdate, orgId }) {
    const [loading, setLoading] = useState(false);

    const formatTime = (isoString) => {
        if (!isoString) return '--:--';
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const getElapsedTime = () => {
        if (!status.session || !status.session.start_at) return '0h 0m';

        const start = new Date(status.session.start_at);
        const now = new Date();
        const diffMs = now - start;
        const hours = Math.floor(diffMs / 1000 / 60 / 60);
        const minutes = Math.floor((diffMs / 1000 / 60) % 60);
        return `${hours}h ${minutes}m`;
    };

    const handleClockIn = async () => {
        setLoading(true);
        try {
            await timeAPI.clockIn(orgId);
            onUpdate();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to clock in');
        } finally {
            setLoading(false);
        }
    };

    const handleClockOut = async () => {
        if (!window.confirm('End your work day? All active timers will remain running.')) return;

        setLoading(true);
        try {
            await timeAPI.clockOut(orgId);
            onUpdate();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to clock out');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`time-block day-session ${status.isClockedIn ? 'active' : ''}`}>
            <div className="block-header">
                <h3>📅 Day Session</h3>
                <div className={`status-indicator ${status.isClockedIn ? 'on' : 'off'}`}>
                    {status.isClockedIn ? 'Clocked In' : 'Clocked Out'}
                </div>
            </div>

            <div className="block-content">
                {status.isClockedIn ? (
                    <>
                        <div className="session-info">
                            <div className="info-item">
                                <span className="label">Started At</span>
                                <span className="value">{formatTime(status.session.start_at)}</span>
                            </div>
                            <div className="info-item">
                                <span className="label">Elapsed Time</span>
                                <span className="value elapsed">{getElapsedTime()}</span>
                            </div>
                        </div>
                        <button
                            className="btn btn-danger"
                            onClick={handleClockOut}
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : '🔴 Clock Out'}
                        </button>
                    </>
                ) : (
                    <>
                        <p className="session-message">Start your work day to track time and use task timers</p>
                        <button
                            className="btn btn-success"
                            onClick={handleClockIn}
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : '🟢 Clock In'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
