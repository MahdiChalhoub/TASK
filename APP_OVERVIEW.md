# Virtual Office - Application Overview

## 🎯 Objective
**Virtual Office** is a comprehensive workspace management platform designed to streamline remote and hybrid work. Its primary goal is to provide a "single pane of glass" for teams to manage tasks, track time, and visualize productivity without the friction of disparate tools.

It combines **Project Management** (Tasks) with **HR/Operations** (Time Tracking, Reports) and **Organization Management** (Teams, Roles) into one cohesive experience.

## 🔄 Core Workflows

### 1. The Daily Routine (Employee)
This workflow is designed to minimize friction for team members:
1.  **Clock In**: detailed session tracking starts when the user "Clocks In" on the Time Tracking page.
2.  **Task Execution**:
    *   User views "My Tasks".
    *   User updates status (Pending → In Progress).
    *   **Activity Logging**: System automatically tracks these changes.
3.  **Completion**:
    *   User marks task as "Completed".
    *   **Actual Time Entry**: System prompts for the *actual* time spent (vs estimated).
    *   **Auto-Log**: A time entry is automatically created in the timesheet.
4.  **End of Day**:
    *   User reviews their daily activity log.
    *   Clocks out.

### 2. The Manager Workflow
Focused on oversight and resource allocation:
1.  **Organization Management**: Create organization, invite members, assign roles (Admin/Employee).
2.  **Task Assignment**:
    *   Create tasks with rich details (Priority, Category, Due Date).
    *   Assign to specific team members.
    *   "Require Finish Time" option ensures accurate billing/tracking.
3.  **Monitoring**:
    *   **Dashboard**: High-level view of open tasks and active sessions.
    *   **Task Activity Log**: Granular view of *who* changed *what* and *when* (e.g., "John changed status to In Progress").
    *   **Daily Reports**: aggregated view of team performance.

### 3. The Organization Structure (Multi-Tenancy)
*   **Users** can belong to multiple Organizations.
*   **Context Switching**: Users switch between organizations (e.g., "Dev Team", "Design Agency") with isolated data.
*   **Roles**:
    *   **Admin**: Full access to settings, invites, and all data.
    *   **Employee**: Restricted to their tasks and own time entries (configurable).

## 🧩 Key Features & Modules

### 📋 Task Management
*   **Smart Due Dates**: Auto-calculates deadlines based on user preferences.
*   **Categories**: Organize work (e.g., "Frontend", "Backend", "Design").
*   **Activity Tracking**: Audit trail of every action (Created, Updated, Completed, Deleted).
*   **Hierarchy**: 3-panel view for browsing tasks by Category -> User -> Details.

### ⏱️ Time & Attendance
*   **Active Timer**: stopwatch-style tracking.
*   **Manual Entry**: adjustment of time logs.
*   **Task Integration**: Completion of a task automatically logs time.
*   **Visual History**: Daily timeline of activities.

### 📊 Reporting
*   **Daily Reports**: Automated summaries.
*   **Filterable Logs**: View history by User, Date, or Task.

---
**Current Version**: 2.0 (Includes recent updates: Task Activity Logging, Redesigned Hierarchy View, and Smart Time Entry)
