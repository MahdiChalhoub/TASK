import { useState, useMemo } from 'react';
import './CalendarTaskView.css';

export default function CalendarTaskView({ tasks, onEditTask }) {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Helper: Get days in month
    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    // Helper: Get day of week for first day (0-6)
    const getFirstDayOfMonth = (year, month) => {
        return new Date(year, month, 1).getDay();
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    // Previous month padding
    const prevMonthDays = getDaysInMonth(year, month - 1);
    const paddingDays = firstDay;

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const changeMonth = (offset) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setCurrentDate(newDate);
    };

    // Group tasks by date
    const tasksByDate = useMemo(() => {
        const grouped = {};
        tasks.forEach(task => {
            if (task.due_date) {
                const dateKey = task.due_date.split('T')[0]; // Format: YYYY-MM-DD
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(task);
            }
        });
        return grouped;
    }, [tasks]);

    // Render calendar grid
    const renderCalendarDays = () => {
        const days = [];

        // Previous month padding
        for (let i = 0; i < paddingDays; i++) {
            const day = prevMonthDays - paddingDays + i + 1;
            days.push(
                <div key={`prev-${i}`} className="calendar-cell different-month">
                    <span className="day-number">{day}</span>
                </div>
            );
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayTasks = tasksByDate[dateStr] || [];

            const isToday = new Date().toDateString() === new Date(year, month, i).toDateString();

            days.push(
                <div key={`curr-${i}`} className={`calendar-cell ${isToday ? 'today' : ''}`}>
                    <span className="day-number">{i}</span>
                    <div className="calendar-tasks">
                        {dayTasks.map(task => (
                            <div
                                key={task.id}
                                className={`calendar-task priority-${task.priority} status-${task.status}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEditTask(task);
                                }}
                                title={`${task.title} (${task.status})`}
                            >
                                {task.title}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Next month padding (to fill 42 grid cells usually, or just end of row)
        // Let's just fill the last row
        const totalSlots = paddingDays + daysInMonth;
        const remainingSlots = 7 - (totalSlots % 7);

        if (remainingSlots < 7) {
            for (let i = 1; i <= remainingSlots; i++) {
                days.push(
                    <div key={`next-${i}`} className="calendar-cell different-month">
                        <span className="day-number">{i}</span>
                    </div>
                );
            }
        }

        return days;
    };

    return (
        <div className="calendar-view">
            <div className="calendar-header">
                <h2>{monthNames[month]} {year}</h2>
                <div className="calendar-nav">
                    <button onClick={() => changeMonth(-1)}>← Previous</button>
                    <button onClick={() => changeMonth(0)}>Today</button>
                    <button onClick={() => changeMonth(1)}>Next →</button>
                </div>
            </div>

            <div className="calendar-grid">
                <div className="calendar-day-header">Sun</div>
                <div className="calendar-day-header">Mon</div>
                <div className="calendar-day-header">Tue</div>
                <div className="calendar-day-header">Wed</div>
                <div className="calendar-day-header">Thu</div>
                <div className="calendar-day-header">Fri</div>
                <div className="calendar-day-header">Sat</div>

                {renderCalendarDays()}
            </div>
        </div>
    );
}
