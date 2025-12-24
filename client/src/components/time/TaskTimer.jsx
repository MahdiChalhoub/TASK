import { useState, useEffect } from 'react';
import { timeAPI } from '../../services/api';
import './TaskTimer.css';

export default function TaskTimer({ tasks, activeTimers, daySessionActive, onUpdate, orgId }) {
    const [selectedTask, setSelectedTask] = useState('');
    const [runningTimers, setRunningTimers] = useState({});

    useEffect(() => {
        // Initialize running timer displays
        const timers = {};
        activeTimers.filter(t => t.type === 'task_timer').forEach(timer => {
            timers[timer.task_id] = {
                start: new Date(timer.start_at),
                interval: null
            };
        });
        setRunningTimers(timers);

        // Set up interval to update timer displays
        const intervals = {};
        Object.keys(timers).forEach(taskId => {
            intervals[taskId] = setInterval(() => {
                setRunningTimers(prev => ({ ...prev }));
            }, 1000);
        });

        return () => {
            Object.values(intervals).forEach(clearInterval);
        };
    }, [activeTimers]);

    const getRunningTime = (taskId) => {
        const timer = runningTimers[taskId];
        if (!timer) return '0:00:00';

        const now = new Date();
        const diffMs = now - timer.start;
        const hours = Math.floor(diffMs / 1000 / 60 / 60);
        const minutes = Math.floor((diffMs / 1000 / 60) % 60);
        const seconds = Math.floor((diffMs / 1000) % 60);
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const isTaskRunning = (taskId) => {
        return activeTimers.some(t => t.type === 'task_timer' && t.task_id === taskId);
    };

    const handleStartTimer = async () => {
        if (!selectedTask) return;

        try {
            await timeAPI.startTaskTimer(orgId, selectedTask);
            setSelectedTask('');
            onUpdate();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to start timer');
        }
    };

    const handleStopTimer = async (taskId) => {
        try {
            await timeAPI.stopTaskTimer(orgId, taskId);
            onUpdate();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to stop timer');
        }
    };

    return (
        <div className="time-block task-timer">
            <div className="block-header">
                <h3>⏲️ Task Timers</h3>
                {!daySessionActive && (
                    <span className="warning-badge">⚠️ Clock in required</span>
                )}
            </div>

            <div className="block-content">
                {!daySessionActive ? (
                    <p className="warning-message">You must clock in for the day before starting task timers</p>
                ) : (
                    <>
                        <div className="timer-selector">
                            <select
                                value={selectedTask}
                                onChange={(e) => setSelectedTask(e.target.value)}
                                disabled={!daySessionActive}
                            >
                                <option value="">Select a task to time...</option>
                                {tasks.filter(t => !isTaskRunning(t.id)).map(task => (
                                    <option key={task.id} value={task.id}>
                                        {task.title}
                                    </option>
                                ))}
                            </select>
                            <button
                                className="btn btn-primary"
                                onClick={handleStartTimer}
                                disabled={!selectedTask || !daySessionActive}
                            >
                                ▶️ Start
                            </button>
                        </div>

                        {activeTimers.filter(t => t.type === 'task_timer').length > 0 && (
                            <div className="active-timers">
                                <h4>Running Timers</h4>
                                {activeTimers.filter(t => t.type === 'task_timer').map(timer => (
                                    <div key={timer.id} className="timer-item">
                                        <div className="timer-info">
                                            <span className="timer-task">{timer.task_title}</span>
                                            <span className="timer-duration">{getRunningTime(timer.task_id)}</span>
                                        </div>
                                        <button
                                            className="btn btn-sm btn-danger"
                                            onClick={() => handleStopTimer(timer.task_id)}
                                        >
                                            ⏹️ Stop
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {tasks.length === 0 && (
                            <p className="info-message">No in-progress tasks available. Create tasks first!</p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
