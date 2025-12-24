import './TaskFilters.css';

export default function TaskFilters({ filters, onFiltersChange, members, userRole }) {
    const handleFilterChange = (key, value) => {
        const newFilters = { ...filters };
        if (value === '') {
            delete newFilters[key];
        } else {
            newFilters[key] = value;
        }
        onFiltersChange(newFilters);
    };

    const clearFilters = () => {
        onFiltersChange({});
    };

    const hasFilters = Object.keys(filters).length > 0;

    return (
        <div className="task-filters">
            <div className="filters-row">
                <select
                    value={filters.status || ''}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="filter-select"
                >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                </select>

                <select
                    value={filters.priority || ''}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                    className="filter-select"
                >
                    <option value="">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                </select>

                {(userRole === 'admin' || userRole === 'owner' || userRole === 'leader') && (
                    <select
                        value={filters.assigned_to || ''}
                        onChange={(e) => handleFilterChange('assigned_to', e.target.value)}
                        className="filter-select"
                    >
                        <option value="">All Users</option>
                        {members.map(member => (
                            <option key={member.id} value={member.id}>
                                {member.name}
                            </option>
                        ))}
                    </select>
                )}

                {hasFilters && (
                    <button className="btn-clear-filters" onClick={clearFilters}>
                        ✕ Clear
                    </button>
                )}
            </div>
        </div>
    );
}
