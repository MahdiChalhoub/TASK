import { useState, useEffect } from 'react';
import { taskAPI } from '../../services/api';
import './CategoryTaskView.css';

export default function CategoryTaskView({ orgId, categories, selectedCategory, selectedUser, userRole, onEditTask }) {
    const [allTasks, setAllTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTasks();
    }, [orgId]);

    const loadTasks = async () => {
        try {
            const response = await taskAPI.getAll(orgId);
            setAllTasks(response.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load tasks:', err);
            setLoading(false);
        }
    };

    // Get tasks filtered by selected category and user
    const getFilteredTasks = () => {
        let filtered = allTasks;

        // Filter by category
        if (selectedCategory) {
            filtered = filtered.filter(t => t.category_id === selectedCategory);
        }

        // Filter by user
        if (selectedUser) {
            filtered = filtered.filter(t => t.assigned_to_user_id === selectedUser.userId);
        }

        return filtered;
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '🔄';
            case 'failed': return '❌';
            case 'cancelled': return '🚫';
            default: return '⏳';
        }
    };

    const getPriorityClass = (priority) => {
        switch (priority) {
            case 'urgent': return 'priority-urgent';
            case 'high': return 'priority-high';
            case 'medium': return 'priority-medium';
            case 'low': return 'priority-low';
            default: return '';
        }
    };

    if (loading) {
        return <div className="loading">Loading tasks...</div>;
    }

    const userTasks = getFilteredTasks();
    const displayTitle = selectedUser
        ? `📋 Tasks for ${selectedUser.userName}`
        : selectedCategory
            ? `📋 Tasks in ${categories.find(c => c.id === selectedCategory)?.name || 'Category'}`
            : '📋 All Tasks';

    return (
        <div className="tasks-panel-full">
            <div className="panel-header">
                <h3>{displayTitle}</h3>
                <span className="task-count">{userTasks.length} task{userTasks.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="tasks-grid">
                {userTasks.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <h3>No Tasks Found</h3>
                        <p>
                            {selectedUser
                                ? `${selectedUser.userName} has no tasks in this category`
                                : selectedCategory
                                    ? 'No tasks in this category'
                                    : 'Create a task to get started'}
                        </p>
                    </div>
                ) : (
                    userTasks.map(task => (
                        <div
                            key={task.id}
                            className={`task-card ${getPriorityClass(task.priority)}`}
                            onClick={() => onEditTask && onEditTask(task)}
                        >
                            <div className="task-card-header">
                                <span className="task-status-icon">
                                    {getStatusIcon(task.status)}
                                </span>
                                <span className={`task-priority-badge ${task.priority}`}>
                                    {task.priority}
                                </span>
                            </div>

                            <div className="task-card-body">
                                <h4 className="task-title">{task.title}</h4>
                                {task.description && (
                                    <p className="task-description">{task.description}</p>
                                )}
                            </div>

                            <div className="task-card-footer">
                                <div className="task-meta-row">
                                    {task.category_name && (
                                        <span className="task-category">
                                            📁 {task.category_name}
                                        </span>
                                    )}
                                    <span className={`task-status-text ${task.status}`}>
                                        {task.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="task-meta-row">
                                    {!selectedUser && task.assigned_to_name && (
                                        <span className="task-assignee">
                                            👤 {task.assigned_to_name}
                                        </span>
                                    )}
                                    {task.due_date && (
                                        <span className="task-due-date">
                                            📅 {new Date(task.due_date).toLocaleDateString()}
                                        </span>
                                    )}
                                    {task.estimated_minutes > 0 && (
                                        <span className="task-estimate">
                                            ⏱️ {task.estimated_minutes} min
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
