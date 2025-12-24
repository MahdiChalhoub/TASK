import { useState, useEffect } from 'react';
import { formsAPI } from '../../services/api';
import FormAssignments from './FormAssignments';
import './FormBuilder.css';

export default function FormBuilder({ form, orgId, teamMembers, onClose }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [createdForm, setCreatedForm] = useState(null); // For wizard flow

    useEffect(() => {
        if (form) {
            // Load existing form
            loadFormData();
        }
    }, [form]);

    const loadFormData = async () => {
        try {
            const response = await formsAPI.getOne(orgId, form.id);
            setTitle(response.data.title);
            setDescription(response.data.description || '');
            setQuestions(response.data.questions || []);
        } catch (err) {
            console.error('Failed to load form:', err);
        }
    };

    const handleAddQuestion = () => {
        setQuestions([...questions, {
            question_text: '',
            question_type: 'text',
            is_required: false,
            options_json: null
        }]);
    };

    const handleRemoveQuestion = (index) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const handleQuestionChange = (index, field, value) => {
        const updated = [...questions];
        updated[index][field] = value;

        // Clear options if changing away from multiple_choice
        if (field === 'question_type' && value !== 'multiple_choice') {
            updated[index].options_json = null;
        }

        setQuestions(updated);
    };

    const handleOptionsChange = (index, optionsText) => {
        const updated = [...questions];
        // Split by newlines or commas
        const options = optionsText.split(/[\n,]/).map(o => o.trim()).filter(o => o);
        updated[index].options_json = options.length > 0 ? options : null;
        setQuestions(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim()) {
            alert('Form title is required');
            return;
        }

        if (questions.length === 0) {
            alert('Add at least one question');
            return;
        }

        // Validate questions
        for (let i = 0; i < questions.length; i++) {
            if (!questions[i].question_text.trim()) {
                alert(`Question ${i + 1} text is required`);
                return;
            }
            if (questions[i].question_type === 'multiple_choice' && (!questions[i].options_json || questions[i].options_json.length === 0)) {
                alert(`Question ${i + 1} needs multiple choice options`);
                return;
            }
        }

        setLoading(true);
        try {
            let savedFormId = form?.id;
            if (form) {
                // Update existing
                await formsAPI.update(orgId, form.id, {
                    title,
                    description,
                    is_active: true
                });
                // ... question updates ...
            } else {
                // Create new
                const res = await formsAPI.create(orgId, {
                    title,
                    description,
                    questions
                });
                savedFormId = res.data.id;
            }

            if (!form) {
                // If creating new, move to assignment step
                const newForm = { id: savedFormId, title, description };
                setCreatedForm(newForm);
            } else {
                onClose();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to save form');
        } finally {
            setLoading(false);
        }
    };

    if (createdForm) {
        return (
            <div className="modal-overlay">
                <FormAssignments
                    form={createdForm}
                    orgId={orgId}
                    onClose={onClose}
                    title="🎉 Form Created! Now Assign It"
                />
            </div>
        );
    }


    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content form-builder" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{form ? '✏️ Edit Form' : '➕ Create New Form'}</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="builder-form">
                    <div className="form-group">
                        <label>Form Title *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Daily Standup Questions"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description of this form"
                            rows="2"
                        />
                    </div>

                    <div className="questions-section">
                        <div className="section-header">
                            <h3>Questions</h3>
                            <button type="button" className="btn-add-question" onClick={handleAddQuestion}>
                                ➕ Add Question
                            </button>
                        </div>

                        {questions.length === 0 && (
                            <p className="empty-message">No questions yet. Click "Add Question" to get started.</p>
                        )}

                        {questions.map((q, index) => (
                            <div key={index} className="question-item">
                                <div className="question-header">
                                    <span className="question-number">Q{index + 1}</span>
                                    <button
                                        type="button"
                                        className="btn-remove-question"
                                        onClick={() => handleRemoveQuestion(index)}
                                    >
                                        🗑️
                                    </button>
                                </div>

                                <div className="form-group">
                                    <label>Question Text *</label>
                                    <input
                                        type="text"
                                        value={q.question_text}
                                        onChange={(e) => handleQuestionChange(index, 'question_text', e.target.value)}
                                        placeholder="Enter your question"
                                        required
                                    />
                                </div>

                                <div className="question-settings">
                                    <div className="form-group">
                                        <label>Type</label>
                                        <select
                                            value={q.question_type}
                                            onChange={(e) => handleQuestionChange(index, 'question_type', e.target.value)}
                                        >
                                            <option value="text">Text Answer</option>
                                            <option value="yes_no">Yes/No</option>
                                            <option value="multiple_choice">Multiple Choice</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={q.is_required}
                                                onChange={(e) => handleQuestionChange(index, 'is_required', e.target.checked)}
                                            />
                                            Required
                                        </label>
                                    </div>
                                </div>

                                {q.question_type === 'multiple_choice' && (
                                    <div className="form-group">
                                        <label>Options (one per line)</label>
                                        <textarea
                                            value={q.options_json ? q.options_json.join('\n') : ''}
                                            onChange={(e) => handleOptionsChange(index, e.target.value)}
                                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                                            rows="4"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : (form ? 'Update Form' : 'Create Form')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
