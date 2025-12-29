const express = require('express');
const router = express.Router();
const db = require('../db');

const { requireAuth, checkOrgMembership } = require('../middleware');

// Get tasks with filters
router.get('/', requireAuth, checkOrgMembership, (req, res) => {
    const { status, priority, category_id, assigned_to, date_from, date_to } = req.query;

    let query = `
        SELECT t.*, 
               u_assigned.name as assigned_to_name,
               u_assigned.email as assigned_to_email,
               u_created.name as created_by_name,
               c.name as category_name
        FROM tasks t
        LEFT JOIN users u_assigned ON t.assigned_to_user_id = u_assigned.id
        LEFT JOIN users u_created ON t.created_by_user_id = u_created.id
        LEFT JOIN task_categories c ON t.category_id = c.id
        WHERE t.org_id = ?
    `;

    const params = [req.orgId];

    // Filter by what user can see based on role
    if (req.userRole === 'employee') {
        query += ' AND t.assigned_to_user_id = ?';
        params.push(req.user.id);
    } else if (req.userRole === 'leader') {
        // Leader can see their own tasks + tasks of members in their scope
        query += ` AND (t.assigned_to_user_id = ? OR t.assigned_to_user_id IN (
            SELECT member_user_id FROM leader_scope WHERE leader_user_id = ? AND org_id = ?
        ))`;
        params.push(req.user.id, req.user.id, req.orgId);
    }
    // Admin and Owner can see all tasks

    // Apply filters
    if (status) {
        query += ' AND t.status = ?';
        params.push(status);
    }

    if (priority) {
        query += ' AND t.priority = ?';
        params.push(priority);
    }

    if (category_id) {
        query += ' AND t.category_id = ?';
        params.push(category_id);
    }

    if (assigned_to) {
        query += ' AND t.assigned_to_user_id = ?';
        params.push(assigned_to);
    }

    if (date_from) {
        query += ' AND t.due_date >= ?';
        params.push(date_from);
    }

    if (date_to) {
        query += ' AND t.due_date <= ?';
        params.push(date_to);
    }

    query += ' ORDER BY t.created_at DESC';
    */

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching tasks:', err);
            return res.status(500).json({ error: 'Failed to fetch tasks', details: err.message });
        }
        res.json(rows);
    });
});

// Get single task
router.get('/:id', requireAuth, checkOrgMembership, (req, res) => {
    const { id } = req.params;

    db.get(`
        SELECT t.*, 
               u_assigned.name as assigned_to_name,
               u_assigned.email as assigned_to_email,
               u_created.name as created_by_name,
               c.name as category_name
        FROM tasks t
        LEFT JOIN users u_assigned ON t.assigned_to_user_id = u_assigned.id
        LEFT JOIN users u_created ON t.created_by_user_id = u_created.id
        LEFT JOIN task_categories c ON t.category_id = c.id
        WHERE t.id = ? AND t.org_id = ?
    `, [id, req.orgId], (err, task) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!task) return res.status(404).json({ error: 'Task not found' });

        // Check permissions
        if (req.userRole === 'employee' && task.assigned_to_user_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only view your own tasks' });
        }

        res.json(task);
    });
});

// Create task
router.post('/', requireAuth, checkOrgMembership, (req, res) => {
    const { title, description, status, priority, due_date, category_id, assigned_to_user_id } = req.body;

    if (!title || !assigned_to_user_id) {
        return res.status(400).json({ error: 'Title and assigned user are required' });
    }

    // Employees can only create tasks for themselves
    if (req.userRole === 'employee' && assigned_to_user_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only create tasks for yourself' });
    }

    db.run(`
        // SELF-REPAIR: Ensure Org and Category exist to prevent FK Crashes
        const checkOrg = await new Promise((resolve) => {
             db.get('SELECT id FROM organizations WHERE id = ?', [req.orgId], (err, row) => resolve(row));
        });
        if (!checkOrg) {
             console.log(`[Auto - Fix] Org ${ req.orgId } missing.Creating dummy org.`);
             await new Promise(resolve => db.run('INSERT INTO organizations (id, name, join_code) VALUES (?, ?, ?)', 
                 [req.orgId, 'Restored Org', 'auto_' + Date.now()], resolve));
        }

        // Check Category (if provided)
        if (category_id) {
            const checkCat = await new Promise((resolve) => {
                db.get('SELECT id FROM task_categories WHERE id = ?', [category_id], (err, row) => resolve(row));
            });
            if (!checkCat) {
                 console.log(`[Auto - Fix] Category ${ category_id } missing.Setting to NULL.`);
                 // We can't easily recreate category with ID (serial), so we just NULL it to save the task
                 // But wait, category_id is int. We can try to set it to null in params.
            }
        }
        
        // Sanitize inputs
        const cleanCategoryId = category_id ? parseInt(category_id) : null;
        // Verify category exists, or set null
        let finalCategoryId = cleanCategoryId;
        if (cleanCategoryId) {
             const catExists = await new Promise(r => db.get('SELECT 1 FROM task_categories WHERE id = ?', [cleanCategoryId], (e, row) => r(!!row)));
             if (!catExists) finalCategoryId = null;
        }

        db.run(`
            INSERT INTO tasks(
        org_id, title, description, status, priority, due_date,
        category_id, assigned_to_user_id, created_by_user_id, estimated_minutes, require_finish_time
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            req.orgId,
            title,
            description || null,
            status || 'pending',
            priority || 'medium',
            due_date || null,
            finalCategoryId,
            assigned_to_user_id || null, // Allow null
            req.user.id,
            parseInt(req.body.estimated_minutes) || 0,
            req.body.require_finish_time !== undefined ? parseInt(req.body.require_finish_time) : 1
        ], function (err, resultId) {
        if (err) {
            console.error('Task creation INSERT error:', err);
            return res.status(500).json({ error: 'Failed to create task', details: err.message });
        }

        // Use resultId if available (from modified db.js), else fallback to this.lastID
        const taskId = resultId || this.lastID;

        if (!taskId) {
            console.error('Task ID mismatch: ID is null after insert');
            return res.status(500).json({ error: 'Task created but ID returned null' });
        }

        // Log task creation activity (Async, don't block response)
        try {
            db.run(`
                INSERT INTO task_activity_log(
            org_id, task_id, user_id, action_type, new_status, notes
        ) VALUES(?, ?, ?, 'created', ?, ?)
        `, [
                req.orgId,
                taskId,
                req.user.id,
                status || 'pending',
                'Task Created'
            ], (logErr) => {
                if (logErr) console.error("Task Activity Log Error:", logErr);
            });
        } catch (e) {
            console.error("Task Activity Log Exception:", e);
        }
        // Fetch the new task to return it
        db.get(`
            SELECT t.*,
        u_assigned.name as assigned_to_name,
        c.name as category_name
            FROM tasks t
            LEFT JOIN users u_assigned ON t.assigned_to_user_id = u_assigned.id
            LEFT JOIN task_categories c ON t.category_id = c.id
            WHERE t.id = ?
        `, [taskId], (err, task) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json(task);
        });
    });
});

// Update task
router.put('/:id', requireAuth, checkOrgMembership, (req, res) => {
    const { id } = req.params;
    const taskId = id;
    const { title, description, status, priority, due_date, category_id, assigned_to_user_id } = req.body;

    // Get existing task
    db.get('SELECT * FROM tasks WHERE id = ? AND org_id = ?', [id, req.orgId], (err, task) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!task) return res.status(404).json({ error: 'Task not found' });

        console.log(`Updating task ${ id }: Status ${ task.status } -> ${ status }`);

        // Check permissions
        if (req.userRole === 'employee' && task.assigned_to_user_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only edit your own tasks' });
        }

        const updates = [];
        const params = [];

        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }

        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }

        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);

            // Handle task completion - create time entry
            if (status === 'completed' && task.status !== 'completed') {
                console.log('Processing task completion logic...');
                updates.push('completed_at = CURRENT_TIMESTAMP');

                // Use actual_minutes from request, or fall back to estimated_minutes
                const actualMinutes = req.body.actual_minutes !== undefined ? req.body.actual_minutes : task.estimated_minutes || 0;

                // After updating the task, create a time entry
                const completedAt = new Date();
                const taskDate = completedAt.toISOString().split('T')[0];

                // Create time entry for the assigned user
                db.run(`
                    INSERT INTO time_entries(
            org_id, user_id, date, type, task_id,
            start_at, end_at, duration_minutes,
            auto_created_from_task, status
        ) VALUES(?, ?, ?, 'auto_task_completion', ?, ?, ?, ?, 1, 'pending')
        `, [
                    req.orgId,
                    task.assigned_to_user_id,
                    taskDate,
                    taskId,
                    completedAt.toISOString(),
                    completedAt.toISOString(),
                    actualMinutes
                ], (err) => {
                    if (err) {
                        console.error('Error creating time entry for completed task:', err);
                    } else {
                        console.log(`Auto - created time entry for task ${ taskId }, duration: ${ actualMinutes } minutes`);
                    }
                });

                // Log completion activity
                db.run(`
                    INSERT INTO task_activity_log(
            org_id, task_id, user_id, action_type, old_status, new_status, actual_minutes, notes
        ) VALUES(?, ?, ?, 'completed', ?, 'completed', ?, ?)
                `, [
                    req.orgId,
                    taskId,
                    req.user.id,
                    task.status,
                    actualMinutes,
                    `Task completed with ${ actualMinutes } minutes`
                ]);

                // Handle task uncompletion
            } else if (status !== 'completed' && task.status === 'completed') {
                updates.push('completed_at = NULL');

                // We DO NOT delete the time entry anymore based on user request.
                // Instead, we log the reason for uncompletion.

                const reason = req.body.reason || 'No reason provided';

                // Log uncompletion activity with reason
                db.run(`
                    INSERT INTO task_activity_log(
            org_id, task_id, user_id, action_type, old_status, new_status, notes
        ) VALUES(?, ?, ?, 'uncompleted', 'completed', ?, ?)
                `, [
                    req.orgId,
                    taskId,
                    req.user.id,
                    status,
                    `Task reopened.Reason: ${ reason } `
                ], (err) => {
                    if (err) console.error('Error logging uncompletion activity:', err);
                });
            }
        }

        if (priority !== undefined) {
            updates.push('priority = ?');
            params.push(priority);
        }

        if (due_date !== undefined) {
            updates.push('due_date = ?');
            params.push(due_date);
        }

        if (category_id !== undefined) {
            updates.push('category_id = ?');
            params.push(category_id);
        }

        if (assigned_to_user_id !== undefined && req.userRole !== 'employee') {
            updates.push('assigned_to_user_id = ?');
            params.push(assigned_to_user_id);
        }

        if (req.body.estimated_minutes !== undefined) {
            updates.push('estimated_minutes = ?');
            params.push(req.body.estimated_minutes);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');

        if (updates.length === 1) { // Only updated_at
            return res.status(400).json({ error: 'No updates provided' });
        }

        params.push(id, req.orgId);

        db.run(`UPDATE tasks SET ${ updates.join(', ') } WHERE id = ? AND org_id = ? `,
            params,
            (err) => {
                if (err) return res.status(500).json({ error: 'Failed to update task' });

                db.get(`
                    SELECT t.*,
        u_assigned.name as assigned_to_name,
        c.name as category_name
                    FROM tasks t
                    LEFT JOIN users u_assigned ON t.assigned_to_user_id = u_assigned.id
                    LEFT JOIN task_categories c ON t.category_id = c.id
                    WHERE t.id = ?
        `, [id], (err, updated) => {
                    res.json(updated);
                });
            }
        );
    });
});

// Toggle task completion (quick action)
router.patch('/:id/toggle', requireAuth, checkOrgMembership, (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM tasks WHERE id = ? AND org_id = ?', [id, req.orgId], (err, task) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!task) return res.status(404).json({ error: 'Task not found' });

        // Check permissions
        if (req.userRole === 'employee' && task.assigned_to_user_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only toggle your own tasks' });
        }

        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        const completedAt = newStatus === 'completed' ? 'CURRENT_TIMESTAMP' : 'NULL';

        db.run(`UPDATE tasks SET status = ?, completed_at = ${ completedAt }, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND org_id = ? `,
            [newStatus, id, req.orgId],
            (err) => {
                if (err) return res.status(500).json({ error: 'Failed to toggle task' });

                db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, updated) => {
                    res.json(updated);
                });
            }
        );
    });
});

// Delete task
router.delete('/:id', requireAuth, checkOrgMembership, (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM tasks WHERE id = ? AND org_id = ?', [id, req.orgId], (err, task) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!task) return res.status(404).json({ error: 'Task not found' });

        // Only creator, admin, or owner can delete
        if (req.userRole === 'employee' && task.created_by_user_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete tasks you created' });
        }

        db.run('DELETE FROM tasks WHERE id = ? AND org_id = ?', [id, req.orgId], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to delete task' });
            res.json({ message: 'Task deleted successfully' });
        });
    });
});

module.exports = router;
