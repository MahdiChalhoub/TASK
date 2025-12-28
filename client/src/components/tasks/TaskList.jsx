import './TaskList.css';

export default function TaskList({ tasks, onToggle, onEdit, onDelete, userRole }) {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const pendingTasks = tasks.filter(t => t.status !== 'completed');

    const getPriorityColor = (priority) => {
        const colors = {
            urgent: '#ef4444',
            high: '#f59e0b',
            medium: '#3b82f6',
            low: '#6b7280'
        };
        return colors[priority] || colors.medium;
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: { text: 'Pending', class: 'status-pending' },
            in_progress: { text: 'In Progress', class: 'status-progress' },
            completed: { text: 'Completed', class: 'status-completed' },
            failed: { text: 'Failed', class: 'status-failed' },
            cancelled: { text: 'Cancelled', class: 'status-cancelled' }
        };
        return badges[status] || badges.pending;
    };

    const formatDate = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
        return date.toLocaleDateString();
    };

    const renderTask = (task) => {
        const statusBadge = getStatusBadge(task.status);
        const dueDate = formatDate(task.due_date);
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

        return (
            <div key={task.id} className={`task-card ${task.status === 'completed' ? 'completed' : ''}`}>
                <div className="task-checkbox" onClick={() => onToggle(task)}>
                    <div className={`checkbox ${task.status === 'completed' ? 'checked' : ''}`}>
                        {task.status === 'completed' && '✓'}
                    </div>
                </div>

                <div className="task-content" onClick={() => onEdit(task)}>
                    <div className="task-header">
                        <h3 className="task-title">{task.title}</h3>
                        <div className="task-badges">
                            {task.category_name && (
                                <span className="badge-category">{task.category_name}</span>
                            )}
                            <span className={`badge-status ${statusBadge.class}`}>
                                {statusBadge.text}
                            </span>
                        </div>
                    </div>

                    {task.description && (
                        <p className="task-description">{task.description}</p>
                    )}

                    <div className="task-meta">
                        <div className="task-meta-left">
                            <span
                                className="task-priority"
                                style={{ backgroundColor: getPriorityColor(task.priority) }}
                            >
                                {task.priority}
                            </span>
                            {task.assigned_to_name && (
                                <span className="task-assignee">👤 {task.assigned_to_name}</span>
                            )}
                        </div>
                        {dueDate && (
                            <span className={`task-due ${isOverdue ? 'overdue' : ''}`}>
                                📅 {dueDate}
                            </span>
                        )}
                    </div>
                </div>

                <div className="task-actions">
                    <button
                        className="btn-icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(task);
                        }}
                        title="Edit task"
                    >
                        ✏️
                    </button>
                    <button
                        className="btn-icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(task.id);
                        }}
                        title="Delete task"
                    >
                        🗑️
                    </button>
                </div>
            </div>
        );
    };

    if (tasks.length === 0) {
        return (
            <div className="empty-state">
                <p>📭 No tasks found</p>
                <p className="empty-subtitle">Create a new task to get started!</p>
            </div>
        );
    }

    return (
        <div className="task-list">
            {pendingTasks.length > 0 && (
                <div className="task-section">
                    <h3 className="section-title">Active Tasks ({pendingTasks.length})</h3>
                    {pendingTasks.map(renderTask)}
                </div>
            )}

            {completedTasks.length > 0 && (
                <div className="task-section completed-section">
                    <h3 className="section-title">Completed Tasks ({completedTasks.length})</h3>
                    {completedTasks.map(renderTask)}
                </div>
            )}
        </div>
    );
}
