import { useState, useEffect } from 'react';
import { reportsAPI, formsAPI } from '../../services/api';
import './ReportSubmission.css';

// Helper functions
function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function getDateLabel(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

export default function ReportSubmission({ orgId, selectedDate, reportStatus, onUpdate }) {
    const [reportData, setReportData] = useState({ tasks: [], timeEntries: [], totalMinutes: 0, assignedForms: [] });
    const [fullForms, setFullForms] = useState([]); // Forms with questions
    const [formAnswers, setFormAnswers] = useState({}); // { [questionId]: answer }
    const [extraWorkItems, setExtraWorkItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [selectedForm, setSelectedForm] = useState(null);

    useEffect(() => {
        if (showForm && !reportStatus.hasReport) {
            loadReportData();
        }
    }, [showForm, selectedDate]);

    const loadReportData = async () => {
        try {
            const response = await reportsAPI.getReportData(orgId, selectedDate);
            setReportData(response.data);

            // Fetch details for assigned forms
            if (response.data.assignedForms && response.data.assignedForms.length > 0) {
                const formPromises = response.data.assignedForms.map(f => formsAPI.getOne(orgId, f.id));
                const formsRes = await Promise.all(formPromises);
                setFullForms(formsRes.map(res => res.data));
            } else {
                setFullForms([]);
            }
        } catch (err) {
            console.error('Failed to load report data:', err);
        }
    };

    const handleAddExtraWork = () => {
        setExtraWorkItems([...extraWorkItems, { description: '', duration_minutes: 0 }]);
    };

    const handleRemoveExtraWork = (index) => {
        setExtraWorkItems(extraWorkItems.filter((_, i) => i !== index));
    };

    const handleExtraWorkChange = (index, field, value) => {
        const updated = [...extraWorkItems];
        updated[index][field] = value;
        setExtraWorkItems(updated);
    };

    const handleAnswerChange = (questionId, value, isMulti = false) => {
        if (isMulti) {
            // value is { selected: boolean, text: string }
            // For multi-choice, we might store JSON array
            // But let's simplify: JSON storage.
            // Actually, server expects `answer_choices_json`.
            // Let's store current selection as array of strings
            setFormAnswers(prev => {
                const current = prev[questionId]?.answer_choices_json || [];
                let newChoices;
                if (value.selected) {
                    newChoices = [...current, value.text];
                } else {
                    newChoices = current.filter(c => c !== value.text);
                }
                return {
                    ...prev,
                    [questionId]: { ...prev[questionId], question_id: questionId, answer_choices_json: newChoices }
                };
            });
        } else {
            // Text or Single Choice
            setFormAnswers(prev => ({
                ...prev,
                [questionId]: { ...prev[questionId], question_id: questionId, answer_text: value }
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // VALIDATION: Check for required questions
        const missing = [];
        fullForms.forEach(form => {
            if (!form.questions) return;
            form.questions.forEach(q => {
                if (q.required === 1) {
                    const answer = formAnswers[q.id];
                    // Check if answer exists and has content (text or choices)
                    const hasText = answer?.answer_text && answer.answer_text.trim() !== '';
                    const hasChoice = answer?.answer_choices_json && answer.answer_choices_json.length > 0;

                    if (!hasText && !hasChoice) {
                        missing.push(`${form.title}: ${q.question_text}`);
                    }
                }
            });
        });

        if (missing.length > 0) {
            alert(`Please answer the following required questions:\n\n${missing.join('\n')}`);
            return;
        }

        setLoading(true);

        const answersArray = Object.values(formAnswers);

        try {
            await reportsAPI.submit(orgId, {
                report_date: selectedDate,
                extra_work_items: extraWorkItems.filter(item => item.description),
                form_answers: answersArray
            });
            setShowForm(false);
            setExtraWorkItems([]);
            setFormAnswers({});
            onUpdate();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to submit report');
        } finally {
            setLoading(false);
        }
    };

    const isFormComplete = (form) => {
        if (!form.questions) return true;
        return form.questions.every(q => {
            if (q.required !== 1) return true;
            const answer = formAnswers[q.id];
            const hasText = answer?.answer_text && answer.answer_text.trim() !== '';
            const hasChoice = answer?.answer_choices_json && answer.answer_choices_json.length > 0;
            return hasText || hasChoice;
        });
    };

    const handleFormClick = (form) => {
        setSelectedForm(form);
    };

    const handleModalClose = () => {
        setSelectedForm(null);
    };

    if (reportStatus.hasReport) {
        return (
            <div className="report-submission submitted">
                <div className="submission-header">
                    <h3>✅ Report Submitted for {getDateLabel(selectedDate)}</h3>
                    <span className="status-badge status-submitted">Submitted</span>
                </div>
                <p className="submission-message">Your daily report has been submitted and is pending review.</p>
            </div>
        );
    }

    if (!showForm) {
        return (
            <div className="report-submission">
                <div className="submission-header">
                    <h3>📝 Daily Report for {getDateLabel(selectedDate)}</h3>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                    Create Report
                </button>
            </div>
        );
    }

    return (
        <div className="report-submission active">
            <div className="submission-header">
                <h3>📝 Daily Report for {getDateLabel(selectedDate)}</h3>
                <button className="btn-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="report-section">
                    <h4>Completed Tasks ({reportData.tasks.length})</h4>
                    {reportData.tasks.length === 0 ? (
                        <p className="empty-message">No tasks completed today</p>
                    ) : (
                        <ul className="task-list">
                            {reportData.tasks.map(task => (
                                <li key={task.id}>
                                    <div className="task-info">
                                        <span className="task-title">{task.title}</span>
                                        {task.category_name && <span className="task-category">{task.category_name}</span>}
                                    </div>
                                    <div className="task-metrics">
                                        <span className="metric" title="Estimated Time">Est: {formatDuration(task.estimated_minutes || 0)}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="report-section">
                    <h4>Time Summary</h4>
                    <div className="time-summary">
                        <div className="summary-item">
                            <span className="label">Total Entries:</span>
                            <span className="value">{reportData.timeEntries.length}</span>
                        </div>
                        <div className="summary-item">
                            <span className="label">Total Time:</span>
                            <span className="value">{formatDuration(reportData.totalMinutes)}</span>
                        </div>
                    </div>
                </div>

                {fullForms.length > 0 && (
                    <div className="report-section forms-section">
                        <h4>Assigned Forms</h4>
                        <div className="forms-grid">
                            {fullForms.map(form => {
                                const complete = isFormComplete(form);
                                return (
                                    <div
                                        key={form.id}
                                        className={`form-card ${complete ? 'complete' : 'pending'}`}
                                        onClick={() => handleFormClick(form)}
                                    >
                                        <div className="form-card-header">
                                            <h5>{form.title}</h5>
                                            {complete && <span className="completion-badge">✓ Done</span>}
                                        </div>
                                        {form.description && <p className="form-desc-short">{form.description}</p>}
                                        <span className="click-hint">Click to fill</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="report-section">
                    <div className="section-header">
                        <h4>Extra Work (Optional)</h4>
                        <button type="button" className="btn-add" onClick={handleAddExtraWork}>
                            ➕ Add
                        </button>
                    </div>
                    {extraWorkItems.map((item, index) => (
                        <div key={index} className="extra-work-item">
                            <input
                                type="text"
                                value={item.description}
                                onChange={(e) => handleExtraWorkChange(index, 'description', e.target.value)}
                                placeholder="What did you work on?"
                                required
                            />
                            <input
                                type="number"
                                value={item.duration_minutes}
                                onChange={(e) => handleExtraWorkChange(index, 'duration_minutes', parseInt(e.target.value) || 0)}
                                placeholder="Minutes"
                                min="0"
                            />
                            <button type="button" className="btn-remove" onClick={() => handleRemoveExtraWork(index)}>
                                🗑️
                            </button>
                        </div>
                    ))}
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Submitting...' : '✓ Submit Report'}
                </button>
            </form>

            {/* Modal for Form Entry */}
            {selectedForm && (
                <div className="modal-overlay">
                    <div className="modal-content form-entry-modal">
                        <div className="modal-header">
                            <h3>{selectedForm.title}</h3>
                            <button className="btn-close" onClick={handleModalClose}>✕</button>
                        </div>
                        <div className="modal-body">
                            {selectedForm.description && <p className="form-description">{selectedForm.description}</p>}

                            <div className="form-questions">
                                {selectedForm.questions?.map(q => (
                                    <div key={q.id} className="question-item">
                                        <label className="question-label">
                                            {q.question_text}
                                            {q.required === 1 && <span className="required">*</span>}
                                        </label>

                                        {q.type === 'text' && (
                                            <input
                                                type="text"
                                                value={formAnswers[q.id]?.answer_text || ''}
                                                onChange={e => handleAnswerChange(q.id, e.target.value)}
                                                placeholder="Enter your answer..."
                                            />
                                        )}

                                        {q.type === 'single_choice' && (
                                            <div className="choices-list">
                                                {(q.choices_json || ['Yes', 'No']).map((choice, i) => (
                                                    <label key={i} className="radio-label">
                                                        <input
                                                            type="radio"
                                                            name={`q_${q.id}`}
                                                            value={choice}
                                                            checked={formAnswers[q.id]?.answer_text === choice}
                                                            onChange={e => handleAnswerChange(q.id, e.target.value)}
                                                        />
                                                        {choice}
                                                    </label>
                                                ))}
                                            </div>
                                        )}

                                        {q.type === 'multi_choice' && (
                                            <div className="choices-list">
                                                {(q.choices_json || []).map((choice, i) => {
                                                    const currentChoices = formAnswers[q.id]?.answer_choices_json || [];
                                                    const isChecked = currentChoices.includes(choice);
                                                    return (
                                                        <label key={i} className="checkbox-label">
                                                            <input
                                                                type="checkbox"
                                                                value={choice}
                                                                checked={isChecked}
                                                                onChange={e => handleAnswerChange(q.id, { selected: e.target.checked, text: choice }, true)}
                                                            />
                                                            {choice}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={handleModalClose}>Close & Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
