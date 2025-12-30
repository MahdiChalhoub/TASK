const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Middleware to check if user is member of org
const checkOrgMembership = (req, res, next) => {
    const orgId = req.headers['x-org-id'] || req.query.orgId || req.body.orgId;

    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID required' });
    }

    db.get('SELECT role FROM organization_members WHERE org_id = ? AND user_id = ?',
        [orgId, req.user.id],
        (err, member) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!member) return res.status(403).json({ error: 'Not a member of this organization' });

            req.orgId = orgId;
            req.userRole = member.role;
            next();
        }
    );
};

// Middleware to require admin or owner
const requireAdmin = (req, res, next) => {
    if (!['admin', 'owner'].includes(req.userRole)) {
        return res.status(403).json({ error: 'Admin or Owner access required' });
    }
    next();
};

// Get all forms for organization
router.get('/', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    db.all(`
        SELECT rf.id, rf.org_id, rf.name as title, rf.description, rf.is_active, rf.created_at,
            (SELECT COUNT(*) FROM report_form_questions WHERE form_id = rf.id) as question_count
        FROM report_forms rf
        WHERE rf.org_id = ?
        ORDER BY rf.created_at DESC
    `, [req.orgId], (err, forms) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(forms);
    });
});

// Get single form with questions
router.get('/:id', requireAuth, checkOrgMembership, (req, res) => {
    const { id } = req.params;

    db.get('SELECT id, org_id, name as title, description, is_active, created_at FROM report_forms WHERE id = ? AND org_id = ?', [id, req.orgId], (err, form) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!form) return res.status(404).json({ error: 'Form not found' });

        // Get questions for this form
        db.all(`
            SELECT * FROM report_form_questions 
            WHERE form_id = ? 
            ORDER BY sort_order ASC
        `, [id], async (err, questions) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch questions' });

            // Fetch choices for each question
            const questionsWithChoices = await Promise.all(questions.map(async (q) => {
                if (['single_choice', 'multi_choice'].includes(q.type)) {
                    return new Promise((resolve) => {
                        db.all('SELECT text FROM report_form_choices WHERE question_id = ? ORDER BY sort_order ASC', [q.id], (err, choices) => {
                            if (err || !choices) resolve({ ...q, choices_json: [] });
                            else resolve({ ...q, choices_json: choices.map(c => c.text) });
                        });
                    });
                }
                return q;
            }));

            res.json({
                ...form,
                questions: questionsWithChoices
            });
        });
    });
});

// Create new form
router.post('/', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { title, description, questions } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'Title required' });
    }

    db.run(`
        INSERT INTO report_forms (org_id, name, description, is_active)
        VALUES (?, ?, ?, 1)
    `, [req.orgId, title, description || null], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to create form' });

        const formId = this.lastID;

        // Add questions if provided
        if (questions && questions.length > 0) {
            const insertQuestions = async () => {
                for (let i = 0; i < questions.length; i++) {
                    const q = questions[i];
                    let dbType = 'text';
                    if (q.question_type === 'multiple_choice') dbType = 'multi_choice';
                    if (q.question_type === 'yes_no') dbType = 'single_choice';
                    // Allow direct type passthrough if it matches schema
                    if (['text', 'single_choice', 'multi_choice'].includes(q.question_type)) dbType = q.question_type;

                    await new Promise((resolve, reject) => {
                        db.run(`INSERT INTO report_form_questions (form_id, text, type, required, sort_order) VALUES (?, ?, ?, ?, ?)`,
                            [formId, q.question_text, dbType, q.is_required ? 1 : 0, i],
                            function (err) {
                                if (err) {
                                    console.error('Error inserting question:', err);
                                    return resolve(); // Continue even if one fails
                                }
                                const questionId = this.lastID;

                                // Handle choices
                                let choices = [];
                                if ((dbType === 'multi_choice' || dbType === 'single_choice') && q.options_json) {
                                    choices = q.options_json;
                                } else if (q.question_type === 'yes_no') {
                                    choices = ['Yes', 'No'];
                                }

                                if (choices.length > 0) {
                                    const stmt = db.prepare("INSERT INTO report_form_choices (question_id, text, sort_order) VALUES (?, ?, ?)");
                                    choices.forEach((c, cIdx) => {
                                        stmt.run(questionId, c, cIdx);
                                    });
                                    stmt.finalize(() => resolve());
                                } else {
                                    resolve();
                                }
                            }
                        );
                    });
                }
            };

            // Calculate question count for response since we can't count immediately
            insertQuestions().then(() => {
                // Return created form
                db.get(`
                    SELECT rf.id, rf.org_id, rf.name as title, rf.description, rf.is_active, rf.created_at,
                        (SELECT COUNT(*) FROM report_form_questions WHERE form_id = rf.id) as question_count
                    FROM report_forms rf
                    WHERE rf.id = ?
                `, [formId], (err, form) => {
                    res.json(form);
                });
            });
        } else {
            // Return created form immediately if no questions
            db.get(`
                SELECT rf.id, rf.org_id, rf.name as title, rf.description, rf.is_active, rf.created_at,
                    0 as question_count
                FROM report_forms rf
                WHERE rf.id = ?
            `, [formId], (err, form) => {
                res.json(form);
            });
        }
    });
});

// Update form status (PATCH)
router.patch('/:id/status', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    db.run(
        'UPDATE report_forms SET is_active = ? WHERE id = ? AND org_id = ?',
        [is_active ? 1 : 0, id, req.orgId],
        (err) => {
            if (err) return res.status(500).json({ error: 'Failed to update status' });
            res.json({ id, is_active: !!is_active });
        }
    );
});

// Update form (PUT)
router.put('/:id', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { title, description, is_active } = req.body;

    db.run(`
        UPDATE report_forms
        SET name = ?, description = ?, is_active = ?
        WHERE id = ? AND org_id = ?
    `, [title, description, is_active ? 1 : 0, id, req.orgId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to update form' });

        db.get('SELECT id, org_id, name as title, description, is_active, created_at FROM report_forms WHERE id = ?', [id], (err, form) => {
            res.json(form);
        });
    });
});

// Delete form
router.delete('/:id', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { id } = req.params;

    // Delete assignments first
    db.run('DELETE FROM report_form_assignments WHERE form_id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to delete assignments' });

        // Delete questions
        db.run('DELETE FROM report_form_questions WHERE form_id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to delete questions' });

            // Delete form
            db.run('DELETE FROM report_forms WHERE id = ? AND org_id = ?', [id, req.orgId], (err) => {
                if (err) return res.status(500).json({ error: 'Failed to delete form' });
                res.json({ message: 'Form deleted' });
            });
        });
    });
});

// Add question to form
router.post('/:id/questions', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { question_text, question_type, options_json, is_required } = req.body;

    // Get current max sort_order
    db.get('SELECT MAX(sort_order) as max_order FROM report_form_questions WHERE form_id = ?', [id], (err, result) => {
        const nextOrder = (result?.max_order || 0) + 1;

        let dbType = 'text';
        if (question_type === 'multiple_choice') dbType = 'multi_choice';
        if (question_type === 'yes_no') dbType = 'single_choice';
        if (['text', 'single_choice', 'multi_choice'].includes(question_type)) dbType = question_type;


        db.run(`
            INSERT INTO report_form_questions (form_id, text, type, required, sort_order)
            VALUES (?, ?, ?, ?, ?)
        `, [id, question_text, dbType, is_required ? 1 : 0, nextOrder],
            function (err) {
                if (err) return res.status(500).json({ error: 'Failed to add question' });

                const questionId = this.lastID;
                const afterCreate = () => {
                    db.get('SELECT * FROM report_form_questions WHERE id = ?', [questionId], (err, question) => {
                        res.json(question);
                    });
                }

                // Handle choices
                let choices = [];
                if ((dbType === 'multi_choice' || dbType === 'single_choice') && options_json) {
                    choices = options_json;
                } else if (question_type === 'yes_no') {
                    choices = ['Yes', 'No'];
                }

                if (choices.length > 0) {
                    const stmt = db.prepare("INSERT INTO report_form_choices (question_id, text, sort_order) VALUES (?, ?, ?)");
                    choices.forEach((c, cIdx) => {
                        stmt.run(questionId, c, cIdx);
                    });
                    stmt.finalize(() => afterCreate());
                } else {
                    afterCreate();
                }
            });
    });
});

// Update question
router.put('/questions/:questionId', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { questionId } = req.params;
    const { question_text, question_type, options_json, is_required } = req.body;

    let dbType = 'text';
    if (question_type === 'multiple_choice') dbType = 'multi_choice';
    else if (question_type === 'yes_no') dbType = 'single_choice';
    else if (['text', 'single_choice', 'multi_choice'].includes(question_type)) dbType = question_type;


    db.run(`
        UPDATE report_form_questions
        SET text = ?, type = ?, required = ?
        WHERE id = ?
    `, [question_text, dbType, is_required ? 1 : 0, questionId],
        (err) => {
            if (err) return res.status(500).json({ error: 'Failed to update question: ' + err.message });

            // Update choices if needed (simplest is delete all and recreate)
            // But for now, let's just return updated question
            db.get('SELECT * FROM report_form_questions WHERE id = ?', [questionId], (err, question) => {
                res.json(question);
            });
        });
});

// Delete question
router.delete('/questions/:questionId', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { questionId } = req.params;

    db.run('DELETE FROM report_form_questions WHERE id = ?', [questionId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to delete question' });
        res.json({ message: 'Question deleted' });
    });
});

// Get assignments for form
router.get('/:id/assignments', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { id } = req.params;

    db.all(`
        SELECT rfa.*,
            CASE 
                WHEN rfa.target_type = 'user' THEN u.name
                WHEN rfa.target_type = 'group' THEN ug.name
                WHEN rfa.target_type = 'role' THEN rfa.target_role
            END as target_name
        FROM report_form_assignments rfa
        LEFT JOIN users u ON rfa.target_type = 'user' AND rfa.target_id = u.id
        LEFT JOIN user_groups ug ON rfa.target_type = 'group' AND rfa.target_id = ug.id
        WHERE rfa.form_id = ? AND rfa.org_id = ?
    `, [id, req.orgId], (err, assignments) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(assignments);
    });
});

// Create assignment
router.post('/:id/assignments', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { target_type, target_id, target_role } = req.body;

    if (!['user', 'group', 'role'].includes(target_type)) {
        return res.status(400).json({ error: 'Invalid target type' });
    }

    // Prepare values based on type
    let finalTargetId = target_id;
    let finalTargetRole = null;

    if (target_type === 'role') {
        finalTargetId = 0; // Or dummy ID
        finalTargetRole = target_role;
        if (!target_role) return res.status(400).json({ error: 'Role required for role assignment' });
    } else {
        if (!target_id) return res.status(400).json({ error: 'Target ID required' });
    }

    db.run(`
        INSERT INTO report_form_assignments (org_id, form_id, target_type, target_id, target_role)
        VALUES (?, ?, ?, ?, ?)
    `, [req.orgId, id, target_type, finalTargetId, finalTargetRole], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to create assignment' });

        const assignmentId = this.lastID;
        db.get('SELECT * FROM report_form_assignments WHERE id = ?', [assignmentId], (err, assignment) => {
            res.json(assignment);
        });
    });
});

// Delete assignment
router.delete('/:id/assignments/:assignmentId', requireAuth, checkOrgMembership, requireAdmin, (req, res) => {
    const { assignmentId } = req.params;

    db.run('DELETE FROM report_form_assignments WHERE id = ? AND org_id = ?',
        [assignmentId, req.orgId],
        (err) => {
            if (err) return res.status(500).json({ error: 'Failed to delete assignment' });
            res.json({ message: 'Assignment deleted' });
        }
    );
});

// Get active forms for user (based on role/assignment)
router.get('/active/for-user', requireAuth, checkOrgMembership, (req, res) => {
    // Logic: Form is active IF:
    // 1. Form is active (is_active = 1)
    // 2. AND (
    //      User matches direct assignment
    //      OR User is in an assigned group
    //      OR User has an assigned role
    //      OR Form has NO assignments (optional: maybe default to everyone if no assignments? 
    //         Or separate "public" flag? For now, let's say NO assignments = Not visible to anyone?
    //         Actually, simpler for "Daily Report": usually everyone sees it.
    //         Let's assume: If 0 assignments, visible to everyone. If >0 assignments, filtering applies.
    //    )

    // First, check if strict assignment is needed
    // Actually, typical RBAC: defaults to deny unless allowed.
    // BUT for this legacy app transition, previously everyone saw everything.
    // Let's implement: Visible if assigned OR (count(assignments) == 0)

    db.all(`
        SELECT DISTINCT rf.*
        FROM report_forms rf
        LEFT JOIN report_form_assignments rfa ON rf.id = rfa.form_id
        WHERE rf.org_id = ? AND rf.is_active = 1
        AND (
            rfa.id IS NULL -- No assignments for this form
            OR (rfa.target_type = 'user' AND rfa.target_id = ?)
            OR (rfa.target_type = 'role' AND rfa.target_role = ?)
            OR (rfa.target_type = 'group' AND rfa.target_id IN (
                SELECT group_id FROM user_group_members WHERE user_id = ?
            ))
        )
        ORDER BY rf.created_at DESC
    `, [req.orgId, req.user.id, req.userRole, req.user.id], (err, forms) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(forms);
    });
});

module.exports = router;
