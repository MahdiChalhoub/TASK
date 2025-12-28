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

                <select
                    value={filters.date_filter_type || ''}
                    onChange={(e) => {
                        const type = e.target.value;
                        const today = new Date();
                        const tomorrow = new Date(today);
                        tomorrow.setDate(tomorrow.getDate() + 1);

                        let from = '', to = '';

                        // Helper to format YYYY-MM-DD
                        const format = (d) => d.toISOString().split('T')[0];

                        if (type === 'today') {
                            from = format(today);
                            to = format(today);
                        } else if (type === 'tomorrow') {
                            from = format(tomorrow);
                            to = format(tomorrow);
                        } else if (type === 'next_7') {
                            from = format(today);
                            const next7 = new Date(today);
                            next7.setDate(today.getDate() + 7);
                            to = format(next7);
                        } else if (type === 'overdue') {
                            to = format(today); // Valid tasks before today should likely be filtered differently? 
                            // Actually overdue means due_date < today AND status != completed.
                            // The API just filters by date. 'Overdue' is complex with just date_from/to unless API supports it.
                            // Let's stick to "This Week", "Next Week", etc for now.
                            // For 'overdue' specifically, we might need a status check. 
                            // Let's do simple date ranges first as specificed ("NEXT DAYS").
                        } else if (type === 'next_30') {
                            from = format(today);
                            const next30 = new Date(today);
                            next30.setDate(today.getDate() + 30);
                            to = format(next30);
                        }

                        // We update the filters with the raw range AND the UI type
                        const newFilters = { ...filters };
                        if (type === '') {
                            delete newFilters.date_filter_type;
                            delete newFilters.date_from;
                            delete newFilters.date_to;
                        } else {
                            newFilters.date_filter_type = type;
                            newFilters.date_from = from;
                            newFilters.date_to = to;
                        }
                        onFiltersChange(newFilters);
                    }}
                    className="filter-select"
                >
                    <option value="">Any Date</option>
                    <option value="today">Today</option>
                    <option value="tomorrow">Tomorrow</option>
                    <option value="next_7">Next 7 Days</option>
                    <option value="next_30">Next 30 Days</option>
                </select>

                {hasFilters && (
                    <button className="btn-clear-filters" onClick={clearFilters}>
                        ✕ Clear
                    </button>
                )}
            </div>
        </div>
    );
}
