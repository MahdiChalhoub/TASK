# Smart Default Due Dates Feature

## Overview

Tasks now automatically get smart default due dates based on the time they are created and user preferences.

## How It Works

### Default Behavior

When creating a new task:
- **Before cutoff hour** (default: 15:00 / 3:00 PM) → Due date = **Today**
- **After cutoff hour** → Due date = **Tomorrow**

### Example with Default Settings (15:00 cutoff)

| Creation Time | Default Due Date |
|--------------|------------------|
| 10:00 AM     | Today           |
| 2:00 PM      | Today           |
| 3:00 PM      | Tomorrow        |
| 5:00 PM      | Tomorrow        |
| 11:00 PM     | Tomorrow        |

## User Settings

Each user can customize their cutoff hour in **Settings** page.

### Accessing Settings

1. Navigate to `/settings` or click ⚙️ Settings from any page
2. Find "Task Due Date Settings" section
3. Adjust the "Cutoff Hour" (0-23)
4. Click "Save Settings"

### Cutoff Hour Options

- **Range**: 0 to 23 (24-hour format)
- **Default**: 15 (3:00 PM)
- **Examples**:
  - `9` = 9:00 AM
  - `12` = 12:00 PM (Noon)
  - `15` = 3:00 PM
  - `18` = 6:00 PM
  - `21` = 9:00 PM

## Implementation Details

### Database

**New Table: `user_settings`**
```sql
CREATE TABLE user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    org_id INTEGER NOT NULL,
    task_due_date_cutoff_hour INTEGER DEFAULT 15,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, org_id)
)
```

### Backend API

**Endpoints:**
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings

**Files:**
- `server/routes/settings.js` - Settings API routes
- `server/db.js` - Database schema

### Frontend

**Components:**
- `client/src/pages/Settings.jsx` - Settings page
- `client/src/components/tasks/TaskModal.jsx` - Updated to use smart defaults

**API Service:**
- `client/src/services/api.js` - Added `settingsAPI`

### Logic Flow

1. User opens "Create Task" modal
2. TaskModal loads user settings from API
3. If no due date set (new task):
   - Get current hour
   - Compare with cutoff hour
   - Set due date to today or tomorrow
4. User can still manually change the due date

### Code Example

```javascript
// Calculate smart default due date
const calculateDefaultDueDate = (cutoffHour) => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // If before cutoff hour, use today; otherwise use tomorrow
    if (currentHour < cutoffHour) {
        return now.toISOString().split('T')[0];
    } else {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }
};
```

## Benefits

### For Users
✅ **No manual date selection** - Dates set automatically
✅ **Time-aware** - Considers when you're creating the task
✅ **Customizable** - Set your own cutoff hour
✅ **Flexible** - Can still override the default

### For Teams
✅ **Consistency** - Everyone follows same logic
✅ **Realistic deadlines** - No more "due today" at 11 PM
✅ **Better planning** - Tasks created late get next-day deadlines

## Use Cases

### Morning Worker (Cutoff: 12:00)
- Works 8 AM - 4 PM
- Creates tasks in morning → due same day
- Creates tasks after lunch → due next day

### Night Owl (Cutoff: 18:00)
- Works 12 PM - 8 PM
- Has until 6 PM to create same-day tasks
- After 6 PM → tasks due tomorrow

### Standard Office (Cutoff: 15:00)
- Standard 9-5 workday
- 3 PM cutoff gives time to complete same-day tasks
- Late afternoon tasks → next day

## Settings Page Features

### Task Due Date Settings Card
- Cutoff hour input (number 0-23)
- Real-time 12-hour format display
- Example scenarios
- Save button with feedback

### About Section
- Feature explanation
- Benefits list
- Usage tips

## Future Enhancements

### Planned Features
1. **Weekend Handling**
   - Skip weekends for due dates
   - Option to include/exclude weekends

2. **Holiday Awareness**
   - Integrate with holiday calendar
   - Skip holidays when setting due dates

3. **Working Hours**
   - Define start/end of workday
   - More sophisticated time calculations

4. **Team Defaults**
   - Organization-wide default cutoff
   - Individual overrides

5. **Multiple Cutoffs**
   - Different cutoffs for different priorities
   - Urgent tasks: same day always
   - Low priority: next week

## Technical Notes

### Per-User, Per-Organization
- Settings are unique per user AND organization
- Same user can have different settings in different orgs
- Useful for users in multiple organizations

### Fallback Behavior
- If settings fail to load: uses default (15:00)
- If user has no settings: uses default (15:00)
- Always graceful degradation

### Performance
- Settings loaded once when modal opens
- Cached for the session
- No performance impact on task creation

---

**This feature makes task creation faster and more intelligent! ⚡**
