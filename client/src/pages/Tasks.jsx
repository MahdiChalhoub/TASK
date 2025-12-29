import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { taskAPI, categoryAPI, orgAPI } from '../services/api';
import CategorySidebar from '../components/tasks/CategorySidebar';
import TaskList from '../components/tasks/TaskList';
import TaskFilters from '../components/tasks/TaskFilters';
import TaskModal from '../components/tasks/TaskModal';
import TaskCompletionModal from '../components/tasks/TaskCompletionModal';
import TaskReopenModal from '../components/tasks/TaskReopenModal';
import CategoryTaskView from '../components/tasks/CategoryTaskView';
import CalendarTaskView from '../components/tasks/CalendarTaskView';
import './Tasks.css';

export default function Tasks() {
    const [orgId] = useState(localStorage.getItem('selectedOrgId'));
    const [orgName] = useState(localStorage.getItem('selectedOrgName'));
    const [userRole] = useState(localStorage.getItem('userRole'));
    const [tasks, setTasks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [members, setMembers] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [filters, setFilters] = useState({});
    const [loading, setLoading] = useState(true);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // 'list', 'hierarchy', 'calendar'
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completingTask, setCompletingTask] = useState(null);
    const [showReopenModal, setShowReopenModal] = useState(false);
    const [reopeningTask, setReopeningTask] = useState(null);
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
        loadTasks();
    }, [filters, selectedCategory]);

    const loadData = async () => {
        try {
            // Load Tasks
            try {
                const tasksRes = await taskAPI.getAll(orgId);
                setTasks(tasksRes.data);
            } catch (e) {
                console.error("Tasks Load Failed:", e);
                alert(`Tasks Load Failed: ${e.response?.data?.details || e.message}`);
            }

            // Load Categories
            try {
                const categoriesRes = await categoryAPI.getAll(orgId);
                setCategories(categoriesRes.data);
            } catch (e) {
                console.error("Categories Load Failed:", e);
                alert(`Categories Load Failed: ${e.response?.data?.details || e.message}`);
            }

            // Load Members
            try {
                const membersRes = await orgAPI.getMembers(orgId);
                setMembers(membersRes.data);
            } catch (e) {
                console.error("Members Load Failed:", e);
                alert(`Members Load Failed: ${e.response?.data?.details || e.message}`);
            }

            setLoading(false);
        } catch (err) {
            console.error('Fatal Data Load Error:', err);
            // Should not happen due to inner try/catch
            setLoading(false);
        }
    };

    const loadTasks = async () => {
        try {
            const queryFilters = { ...filters };
            if (selectedCategory) {
                queryFilters.category_id = selectedCategory;
            }
            const response = await taskAPI.getAll(orgId, queryFilters);
            setTasks(response.data);
        } catch (err) {
            console.error("Tasks Load Error:", err);
            const msg = err.response?.data?.details || err.response?.data?.error || err.message;
            alert(`Tasks Load Failed: ${msg}`); // Using alert as per existing error handling pattern
        }
    };

    const handleToggleTask = async (task) => {
        // If task is being completed and requires finish time, show modal
        if (task.status !== 'completed' && task.require_finish_time) {
            setCompletingTask(task);
            setShowCompletionModal(true);
        } else {
            // If uncompleting a task, show reopen modal
            if (task.status === 'completed') {
                setReopeningTask(task);
                setShowReopenModal(true);
                return;
            }

            // Otherwise just toggle normally
            try {
                await taskAPI.toggle(orgId, task.id);
                loadTasks();
            } catch (err) {
                console.error('Failed to toggle task:', err);
            }
        }
    };

    const handleReopenTask = async (reason) => {
        try {
            await taskAPI.update(orgId, reopeningTask.id, {
                status: 'pending',
                reason: reason
            });
            setShowReopenModal(false);
            setReopeningTask(null);
            loadTasks();
        } catch (err) {
            console.error('Failed to reopen task:', err);
        }
    };

    const handleCompleteWithTime = async (actualMinutes) => {
        try {
            await taskAPI.update(orgId, completingTask.id, {
                status: 'completed',
                actual_minutes: actualMinutes
            });
            setShowCompletionModal(false);
            setCompletingTask(null);
            loadTasks();
        } catch (err) {
            console.error('Failed to complete task:', err);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;

        try {
            await taskAPI.delete(orgId, taskId);
            loadTasks();
        } catch (err) {
            console.error('Failed to delete task:', err);
        }
    };

    const handleEditTask = (task) => {
        setEditingTask(task);
        setShowTaskModal(true);
    };

    const handleCreateTask = () => {
        setEditingTask(null);
        setShowTaskModal(true);
    };

    const handleSaveTask = async (taskData) => {
        try {
            if (editingTask) {
                // Logic for prompting is inside TaskModal (via Reason field)
                await taskAPI.update(orgId, editingTask.id, taskData);
            } else {
                await taskAPI.create(orgId, taskData);
            }
            setShowTaskModal(false);
            setEditingTask(null);
            loadTasks();
        } catch (err) {
            console.error('Failed to save task:', err);
            throw err;
        }
    };

    const handleCategorySelect = (categoryId) => {
        setSelectedCategory(categoryId === selectedCategory ? null : categoryId);
    };

    const handleUserSelect = (user) => {
        setSelectedUser(user);
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
        <div className="tasks-page">
            <header className="tasks-header">
                <div className="header-left">
                    <h1>🏢 {orgName}</h1>
                    <span className="role-badge">{userRole}</span>
                </div>
                <div className="header-right">
                    <button onClick={() => navigate('/dashboard')} className="btn-nav">Dashboard</button>
                    <button onClick={() => navigate('/settings')} className="btn-nav">⚙️ Settings</button>
                    <span className="user-name">{user?.name || user?.email}</span>
                    <button onClick={handleChangeOrg} className="btn-change-org">Change Org</button>
                    <button onClick={logout} className="btn-logout">Logout</button>
                </div>
            </header>

            <div className="tasks-container">
                <CategorySidebar
                    categories={categories}
                    selectedCategory={selectedCategory}
                    selectedUser={selectedUser}
                    onSelectCategory={handleCategorySelect}
                    onSelectUser={handleUserSelect}
                    onCategoriesChange={loadData}
                    orgId={orgId}
                    userRole={userRole}
                />

                <main className="tasks-main">
                    <div className="tasks-toolbar">
                        <h2>📋 Tasks</h2>
                        <div className="toolbar-actions">
                            <div className="view-toggle">
                                <button
                                    className={`btn-view ${viewMode === 'list' ? 'active' : ''}`}
                                    onClick={() => setViewMode('list')}
                                >
                                    📋 List
                                </button>
                                <button
                                    className={`btn-view ${viewMode === 'hierarchy' ? 'active' : ''}`}
                                    onClick={() => setViewMode('hierarchy')}
                                >
                                    🌳 Hierarchy
                                </button>
                                <button
                                    className={`btn-view ${viewMode === 'calendar' ? 'active' : ''}`}
                                    onClick={() => setViewMode('calendar')}
                                >
                                    📅 Calendar
                                </button>
                            </div>
                            <button className="btn btn-primary" onClick={handleCreateTask}>
                                ➕ New Task
                            </button>
                        </div>
                    </div>

                    {viewMode === 'list' ? (
                        <>
                            <TaskFilters
                                filters={filters}
                                onFiltersChange={setFilters}
                                members={members}
                                userRole={userRole}
                            />

                            <TaskList
                                tasks={tasks}
                                onToggle={handleToggleTask}
                                onEdit={handleEditTask}
                                onDelete={handleDeleteTask}
                                userRole={userRole}
                            />
                        </>
                    ) : viewMode === 'calendar' ? (
                        <CalendarTaskView
                            tasks={tasks}
                            onEditTask={handleEditTask}
                        />
                    ) : (
                        <CategoryTaskView
                            orgId={orgId}
                            categories={categories}
                            selectedCategory={selectedCategory}
                            selectedUser={selectedUser}
                            userRole={userRole}
                            onEditTask={handleEditTask}
                        />
                    )}
                </main>
            </div>

            {showTaskModal && (
                <TaskModal
                    task={editingTask}
                    categories={categories}
                    members={members}
                    onSave={handleSaveTask}
                    onClose={() => {
                        setShowTaskModal(false);
                        setEditingTask(null);
                    }}
                    userRole={userRole}
                    orgId={orgId}
                />
            )}

            {showCompletionModal && completingTask && (
                <TaskCompletionModal
                    task={completingTask}
                    onComplete={handleCompleteWithTime}
                    onCancel={() => {
                        setShowCompletionModal(false);
                        setCompletingTask(null);
                    }}
                />
            )}

            {showReopenModal && reopeningTask && (
                <TaskReopenModal
                    task={reopeningTask}
                    onReopen={handleReopenTask}
                    onCancel={() => {
                        setShowReopenModal(false);
                        setReopeningTask(null);
                    }}
                />
            )}
        </div>
    );
}
