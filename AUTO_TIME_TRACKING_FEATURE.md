# Automatic Time Tracking from Task Completion

## Overview

The system now automatically tracks time when tasks are completed and removes it when tasks are uncompleted.

## How It Works

### When a Task is Completed

1. **User marks task as "Completed"**
   - Task status changes from any status → `completed`
   - `completed_at` timestamp is set

2. **Automatic Time Entry Created**
   - A time entry is automatically created for the assigned user
   - **Duration**: Uses the task's `estimated_minutes`
   - **Date**: Current date when task was completed
   - **Type**: `auto_task_completion`
   - **Status**: `pending` (awaiting approval)
   - **Marked**: `auto_created_from_task = 1` (for tracking)

3. **Appears in User's Timesheet**
   - Shows up in the user's time tracking history
   - Linked to the specific task
   - Can be approved/rejected by reviewers
   - Duration matches the estimated time for the task

### When a Task is Uncompleted

1. **User changes status from "Completed" to anything else**
   - Task status changes from `completed` → any other status
   - `completed_at` is cleared (set to NULL)

2. **Automatic Time Entry Removed**
   - The auto-created time entry is deleted
   - Only removes entries marked with `auto_created_from_task = 1`
   - Manual time entries are NOT affected

3. **Removed from Timesheet**
   - Entry disappears from user's time tracking
   - No longer counts toward their hours
   - Clean removal - no trace left

## Database Changes

### New Field in `time_entries` Table

```sql
auto_created_from_task BOOLEAN DEFAULT 0
```

- `1` = Auto-created when task was completed
- `0` = Manually created by user

### New Type in `time_entries.type`

```sql
type TEXT CHECK(type IN ('day_session', 'task_timer', 'manual', 'auto_task_completion'))
```

- `auto_task_completion` = Entry created automatically from task completion

## Benefits

### For Employees
✅ **Automatic tracking**: No need to manually log time for completed tasks
✅ **Accurate records**: Time is logged immediately when task is done
✅ **Less work**: One click to complete task = automatic time entry

### For Managers/Leaders
✅ **Better visibility**: See exactly when tasks were completed
✅ **Accurate reporting**: Time entries match task completions
✅ **Easy auditing**: Can see which entries were auto-created

### For Reports
✅ **Automatic inclusion**: Completed tasks appear in daily reports
✅ **Time tracking**: Shows how long each task took (estimated time)
✅ **Clean data**: Uncompleting a task removes the entry cleanly

## Example Flow

### Scenario 1: Complete a Task

```
1. Task: "Fix login bug"
   - Estimated time: 120 minutes
   - Assigned to: Alice
   - Status: In Progress

2. Alice clicks "Mark as Completed"
   
3. System automatically:
   ✅ Sets task status = "completed"
   ✅ Sets completed_at = "2025-12-25 14:30:00"
   ✅ Creates time entry:
      - User: Alice
      - Date: 2025-12-25
      - Duration: 120 minutes
      - Type: auto_task_completion
      - Task: "Fix login bug"
      - Status: pending

4. Alice's timesheet now shows:
   📋 Fix login bug - 120 min (Auto) - Pending Approval
```

### Scenario 2: Uncomplete a Task

```
1. Task was marked completed yesterday
   - Time entry exists: 120 minutes

2. Manager realizes task needs more work
   - Changes status from "Completed" to "In Progress"

3. System automatically:
   ✅ Clears completed_at
   ✅ Deletes the auto-created time entry
   
4. Alice's timesheet:
   ❌ Entry removed (no longer shows 120 minutes)
```

## Important Notes

### Multiple Assignments
- Currently, tasks are assigned to ONE user
- Future enhancement: Support multiple users per task
- Each user would get their own time entry

### Estimated Time
- If task has NO estimated time (`estimated_minutes = 0`):
  - Time entry is still created
  - Duration = 0 minutes
  - User can manually edit if needed

### Manual Time Entries
- Users can still create manual time entries
- Manual entries are NEVER deleted automatically
- Only auto-created entries (`auto_created_from_task = 1`) are removed

### Approval Workflow
- Auto-created entries start as "pending"
- Require approval like any other time entry
- Can be rejected if time seems incorrect

## Future Enhancements

### Planned Features
1. **Multiple Users per Task**
   - Assign tasks to multiple people
   - Each gets their own time entry when task completes

2. **Actual Time vs Estimated**
   - Track actual time spent (from timers)
   - Compare with estimated time
   - Show variance in reports

3. **Smart Time Allocation**
   - If task took longer than estimated
   - Suggest splitting time across multiple days
   - Better accuracy for long-running tasks

4. **Report Integration**
   - Completed tasks auto-added to daily reports
   - Show task completion summary
   - Include time spent per task

## Technical Implementation

### Files Modified

1. **`server/db.js`**
   - Added `auto_created_from_task` field
   - Added `auto_task_completion` type

2. **`server/routes/tasks.js`**
   - Added logic in PUT `/tasks/:id` route
   - Creates time entry on completion
   - Deletes time entry on uncompletion

### Code Logic

```javascript
// On task completion
if (status === 'completed' && task.status !== 'completed') {
    // Create time entry
    INSERT INTO time_entries (
        org_id, user_id, date, type, task_id,
        duration_minutes, auto_created_from_task
    ) VALUES (?, ?, ?, 'auto_task_completion', ?, ?, 1)
}

// On task uncompletion
if (status !== 'completed' && task.status === 'completed') {
    // Remove auto-created time entry
    DELETE FROM time_entries
    WHERE task_id = ? AND auto_created_from_task = 1
}
```

---

**This feature makes time tracking seamless and automatic! 🎯**
