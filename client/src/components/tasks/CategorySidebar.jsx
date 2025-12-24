import { useState, useEffect } from 'react';
import { categoryAPI, orgAPI, taskAPI } from '../../services/api';
import CategoryLeaderModal from './CategoryLeaderModal';
import './CategorySidebar.css';

export default function CategorySidebar({
    categories,
    selectedCategory,
    selectedUser,
    onSelectCategory,
    onSelectUser,
    onCategoriesChange,
    orgId,
    userRole
}) {
    const [isCreating, setIsCreating] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [error, setError] = useState('');
    const [editingLeader, setEditingLeader] = useState(null);
    const [members, setMembers] = useState([]);
    const [expandedCategories, setExpandedCategories] = useState(new Set());
    const [categoryUsers, setCategoryUsers] = useState({});
    const [allTasks, setAllTasks] = useState([]);

    const canManageCategories = ['admin', 'owner'].includes(userRole);

    useEffect(() => {
        loadTasks();
    }, [orgId]);

    useEffect(() => {
        // Calculate users per category when tasks change
        if (allTasks.length > 0) {
            const usersPerCategory = {};

            allTasks.forEach(task => {
                const catId = task.category_id || 'uncategorized';
                if (!usersPerCategory[catId]) {
                    usersPerCategory[catId] = {};
                }
                const userId = task.assigned_to_user_id;
                if (!usersPerCategory[catId][userId]) {
                    usersPerCategory[catId][userId] = {
                        userId,
                        userName: task.assigned_to_name || 'Unassigned',
                        userEmail: task.assigned_to_email,
                        taskCount: 0
                    };
                }
                usersPerCategory[catId][userId].taskCount++;
            });

            setCategoryUsers(usersPerCategory);
        }
    }, [allTasks]);

    const loadTasks = async () => {
        try {
            const response = await taskAPI.getAll(orgId);
            setAllTasks(response.data);
        } catch (err) {
            console.error('Failed to load tasks:', err);
        }
    };

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        setError('');

        try {
            await categoryAPI.create(orgId, { name: newCategoryName });
            setNewCategoryName('');
            setIsCreating(false);
            onCategoriesChange();
        } catch (err) {
            setError('Failed to create category');
        }
    };

    const handleDeleteCategory = async (categoryId) => {
        if (!window.confirm('Delete this category? Tasks in this category will not be deleted.')) {
            return;
        }

        try {
            await categoryAPI.delete(orgId, categoryId);
            onCategoriesChange();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete category');
        }
    };

    const handleEditLeader = async (category) => {
        // Load members if not already loaded
        if (members.length === 0) {
            try {
                const response = await orgAPI.getMembers(orgId);
                setMembers(response.data);
            } catch (err) {
                console.error('Failed to load members:', err);
            }
        }
        setEditingLeader(category);
    };

    const toggleCategory = (categoryId) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

    const handleCategoryClick = (categoryId) => {
        onSelectCategory(categoryId);
        onSelectUser(null); // Clear user selection when category changes
        toggleCategory(categoryId);
    };

    const handleUserClick = (e, userId, userName) => {
        e.stopPropagation();
        onSelectUser({ userId, userName });
    };

    const getUsersForCategory = (categoryId) => {
        const users = categoryUsers[categoryId] || {};
        return Object.values(users).sort((a, b) => a.userName.localeCompare(b.userName));
    };

    return (
        <aside className="category-sidebar">
            <div className="sidebar-header">
                <h3>📁 Categories</h3>
                {canManageCategories && (
                    <button
                        className="btn-add-category"
                        onClick={() => setIsCreating(true)}
                        title="Add category"
                    >
                        ➕
                    </button>
                )}
            </div>

            {isCreating && (
                <form onSubmit={handleCreateCategory} className="create-category-form">
                    <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Category name"
                        autoFocus
                        required
                    />
                    <div className="form-actions-inline">
                        <button type="submit" className="btn-save">✓</button>
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => {
                                setIsCreating(false);
                                setNewCategoryName('');
                                setError('');
                            }}
                        >
                            ✕
                        </button>
                    </div>
                    {error && <p className="error-text">{error}</p>}
                </form>
            )}

            <div className="categories-list">
                <div
                    className={`category-item ${!selectedCategory && !selectedUser ? 'active' : ''}`}
                    onClick={() => {
                        onSelectCategory(null);
                        onSelectUser(null);
                    }}
                >
                    <span className="category-name">📋 All Tasks</span>
                </div>

                {categories.map(category => {
                    const isExpanded = expandedCategories.has(category.id);
                    const users = getUsersForCategory(category.id);
                    const isActive = selectedCategory === category.id && !selectedUser;

                    return (
                        <div key={category.id} className="category-group">
                            <div className={`category-item ${isActive ? 'active' : ''}`}>
                                <span
                                    className="category-name-wrapper"
                                    onClick={() => handleCategoryClick(category.id)}
                                >
                                    <span className="expand-icon">
                                        {users.length > 0 ? (isExpanded ? '▼' : '▶') : ''}
                                    </span>
                                    <span className="category-name">
                                        📁 {category.name}
                                        {category.leader_name && (
                                            <span className="category-leader">👤 {category.leader_name}</span>
                                        )}
                                    </span>
                                </span>
                                <div className="category-actions">
                                    {canManageCategories && (
                                        <>
                                            <button
                                                className="btn-edit-leader"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditLeader(category);
                                                }}
                                                title="Assign leader"
                                            >
                                                👤
                                            </button>
                                            <button
                                                className="btn-delete-category"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteCategory(category.id);
                                                }}
                                                title="Delete category"
                                            >
                                                🗑️
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {isExpanded && users.length > 0 && (
                                <div className="users-list-nested">
                                    {users.map(user => (
                                        <div
                                            key={user.userId}
                                            className={`user-item ${selectedUser?.userId === user.userId ? 'active' : ''}`}
                                            onClick={(e) => handleUserClick(e, user.userId, user.userName)}
                                        >
                                            <span className="user-icon">👤</span>
                                            <span className="user-name">{user.userName}</span>
                                            <span className="user-task-count">{user.taskCount}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {editingLeader && (
                <CategoryLeaderModal
                    category={editingLeader}
                    members={members}
                    orgId={orgId}
                    onClose={() => setEditingLeader(null)}
                    onUpdate={onCategoriesChange}
                />
            )}
        </aside>
    );
}
