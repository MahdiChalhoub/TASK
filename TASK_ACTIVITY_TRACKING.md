# Task Activity Tracking System

## Overview
Comprehensive activity logging system that tracks ALL changes to tasks and displays them in daily reports and time tracking.

## What Gets Tracked

### 1. **Task Creation**
- Action: `created`
- Logged when: New task is created
- Information: Task title, initial status
- Who: Creator

### 2. **Completion & Uncompletion**
   - Marking a task as **Completed** prompts for "Actual Time" and logs a "Completed" activity.
   - **Uncompleting** a task (moving back to Pending) will:
     - **KEEP** the associated time entry (it is NOT deleted).
     - **Prompt** the user for a reason ("Why are you reopening this?").
     - Log a status change back to "pending" with the provided reason.

### 3. **Task Completion**
- Action: `completed`
- Logged when: Task status changes to "completed"
- Information: Old status → completed, actual time spent
- Who: User who completed it

### 4. **Task Uncompletion**
- Action: `uncompleted`
- Logged when: Task status changes FROM "completed" to anything else
- Information: completed → new status
- Who: User who uncompleted it
- **Important**: Time entry is removed, but activity log remains

### 4. **Status Changes**
- Action: `status_changed`
- Logged when: Any other status change (pending → in_progress, etc.)
- Information: Old status → new status
- Who: User who changed it

### 5. **Task Updates**
- Action: `updated`
- Logged when: Task details are modified (title, description, etc.)
- Information: What was changed
- Who: User who updated it

### 6. **Task Deletion**
- Action: `deleted`
- Logged when: Task is deleted
- Information: Task details before deletion
- Who: User who deleted it

## Database Schema

### Table: `task_activity_log`

```sql
CREATE TABLE task_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action_type TEXT CHECK(action_type IN (
        'created', 
        'status_changed', 
        'completed', 
        'uncompleted', 
        'updated', 
        'deleted'
    )) NOT NULL,
    old_status TEXT,
    new_status TEXT,
    actual_minutes INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(org_id) REFERENCES organizations(id),
    FOREIGN KEY(task_id) REFERENCES tasks(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);
```

### Fields Explanation

- **id**: Unique activity log entry ID
- **org_id**: Organization ID
- **task_id**: Related task ID
- **user_id**: User who performed the action
- **action_type**: Type of action (see above)
- **old_status**: Previous status (for status changes)
- **new_status**: New status (for status changes)
- **actual_minutes**: Time spent (for completions)
- **notes**: Additional information about the action
- **created_at**: When the action occurred

## API Endpoints

### 1. Get Activities for a Date
```
GET /api/task-activity/date/:date
```

**Parameters:**
- `date`: Date in YYYY-MM-DD format

**Response:**
```json
[
  {
    "id": 1,
    "task_id": 5,
    "task_title": "Fix login bug",
    "user_name": "John Doe",
    "action_type": "completed",
    "old_status": "in_progress",
    "new_status": "completed",
    "actual_minutes": 105,
    "notes": "Task completed with 105 minutes",
    "created_at": "2025-12-27T10:30:00.000Z"
  },
  {
    "id": 2,
    "task_id": 5,
    "task_title": "Fix login bug",
    "user_name": "Jane Smith",
    "action_type": "uncompleted",
    "old_status": "completed",
    "new_status": "in_progress",
    "notes": "Task uncompleted: changed from completed to in_progress",
    "created_at": "2025-12-27T14:15:00.000Z"
  }
]
```

### 2. Get Activities for a User and Date
```
GET /api/task-activity/user/:userId/date/:date
```

**Parameters:**
- `userId`: User ID
- `date`: Date in YYYY-MM-DD format

**Response:** Same as above, filtered by user

### 3. Get Activity History for a Task
```
GET /api/task-activity/task/:taskId
```

**Parameters:**
- `taskId`: Task ID

**Response:** Complete history of all changes to the task

## Use Cases

### 1. Daily Reports
Show all task activities for the day:

```
Today's Task Activity:
✅ 10:30 AM - Completed "Fix login bug" (105 minutes)
🔄 2:15 PM - Uncompleted "Fix login bug" (back to in progress)
📝 3:45 PM - Created "Update documentation"
✅ 4:30 PM - Completed "Update documentation" (45 minutes)
```

### 2. Time Tracking
Show task-related time entries:

```
Time Tracking for 2025-12-27:
- Fix login bug: 105 minutes (completed, then uncompleted)
- Update documentation: 45 minutes (completed)
Total: 150 minutes
```

### 3. Task History
Show complete history of a task:

```
Task: Fix login bug
History:
1. Created by John Doe (Dec 27, 9:00 AM)
2. Status changed: pending → in_progress (Dec 27, 9:30 AM)
3. Completed with 105 minutes (Dec 27, 10:30 AM)
4. Uncompleted: completed → in_progress (Dec 27, 2:15 PM)
5. Completed with 120 minutes (Dec 27, 4:00 PM)
```

## Integration Points

### Time Tracking Page
- Shows all task completions for the day
- Displays actual time spent
- Shows if task was uncompleted (with note)

### Daily Reports Page
- Lists all task activities
- Groups by action type
- Shows time spent on completed tasks
- Highlights uncompleted tasks

### Task Detail View
- Shows complete activity history
- Timeline of all changes
- Who did what and when

## Example Scenarios

### Scenario 1: Complete a Task
```
1. User completes task "Fix bug"
2. System logs:
   - action_type: "completed"
   - old_status: "in_progress"
   - new_status: "completed"
   - actual_minutes: 120
   - notes: "Task completed with 120 minutes"
3. Creates time entry (120 min)
4. Shows in daily report
5. Shows in time tracking
```

### Scenario 2: Uncomplete a Task
```
1. User uncompletes task "Fix bug"
2. System logs:
   - action_type: "uncompleted"
   - old_status: "completed"
   - new_status: "in_progress"
   - notes: "Task uncompleted: changed from completed to in_progress"
3. Removes time entry
4. Activity log remains (shows it was completed then uncompleted)
5. Daily report shows: "Task was completed, then uncompleted"
```

### Scenario 3: Multiple Status Changes
```
1. Create task (pending)
2. Start task (pending → in_progress)
3. Complete task (in_progress → completed, 90 min)
4. Uncomplete task (completed → in_progress)
5. Complete again (in_progress → completed, 120 min)

Activity Log:
- Created (pending)
- Status changed (pending → in_progress)
- Completed (90 min)
- Uncompleted (completed → in_progress)
- Completed (120 min)

Final time entry: 120 minutes
```

## Benefits

### For Users
✅ **Complete history** - See all changes to tasks
✅ **Accountability** - Know who did what
✅ **Time tracking** - Accurate time records
✅ **Transparency** - Nothing is hidden

### For Managers
✅ **Audit trail** - Complete record of all activities
✅ **Performance tracking** - See task completion patterns
✅ **Issue detection** - Identify tasks that are uncompleted frequently
✅ **Time analysis** - Compare estimated vs actual time

### For Reports
✅ **Comprehensive data** - All task activities in one place
✅ **Daily summaries** - Easy to generate reports
✅ **Time accuracy** - Actual time spent on tasks
✅ **Change tracking** - See what changed and when

## Implementation Status

### ✅ Completed
- [x] Database table created
- [x] Activity logging for task creation
- [x] Activity logging for task completion
- [x] Activity logging for task uncompletion
- [x] API endpoints created
- [x] Server routes registered

### ⏳ In Progress
- [ ] Add logging for general status changes
- [ ] Add logging for task updates
- [ ] Add logging for task deletion

### 📋 To Do
- [ ] Frontend API integration
- [ ] Display in Time Tracking page
- [ ] Display in Daily Reports page
- [ ] Task history timeline component
- [ ] Activity filtering and search

## Next Steps

1. **Complete Backend Logging**
   - Add remaining activity types
   - Test all scenarios

2. **Frontend Integration**
   - Create API service
   - Build activity display components
   - Integrate with Time Tracking
   - Integrate with Daily Reports

3. **UI Components**
   - Activity timeline
   - Activity cards
   - Filters and search
   - Export functionality

---

**Task activity tracking is now partially implemented and ready for frontend integration! 🚀**
