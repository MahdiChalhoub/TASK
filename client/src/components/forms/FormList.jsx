import './FormList.css';

export default function FormList({ forms, onEdit, onDelete, onAssign, onToggleStatus }) {
    if (!forms || forms.length === 0) {
        return (
            <div className="form-list empty">
                <div className="empty-state">
                    <p>📭 No forms created yet</p>
                    <p className="empty-subtitle">Create your first form to collect information from team members</p>
                </div>
            </div>
        );
    }

    return (
        <div className="form-list">
            {forms.map(form => (
                <div key={form.id} className="form-card">
                    <div className="form-card-header">
                        <div>
                            <h3>{form.title}</h3>
                            {form.description && <p className="form-description">{form.description}</p>}
                        </div>
                        <button
                            className={`status-badge ${form.is_active ? 'active' : 'inactive'} btn-status-toggle`}
                            onClick={() => onToggleStatus(form)}
                            title="Click to toggle status"
                        >
                            {form.is_active ? '✓ Active' : '✕ Inactive'}
                        </button>
                    </div>

                    <div className="form-card-meta">
                        <span className="question-count">
                            {form.question_count || 0} question{form.question_count !== 1 ? 's' : ''}
                        </span>
                        <span className="created-date">
                            Created {new Date(form.created_at).toLocaleDateString()}
                        </span>
                    </div>

                    <div className="form-card-actions">
                        <button className="btn-action btn-edit" onClick={() => onEdit(form)}>
                            ✏️ Edit
                        </button>
                        <button className="btn-action btn-assign" onClick={() => onAssign(form)}>
                            👤 Assign
                        </button>
                        <button className="btn-action btn-delete" onClick={() => onDelete(form.id)}>
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
