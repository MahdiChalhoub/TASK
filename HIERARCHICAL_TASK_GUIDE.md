# Hierarchical Task Management - User Guide

## Overview

The hierarchical task management system allows you to organize tasks by **categories** and **users**, with the ability to assign **category leaders** who can manage tasks and track progress within their assigned categories.

## Structure

```
Task Management
├── Category 1
│   ├── Leader: John Doe
│   ├── User 1
│   │   ├── Task 1
│   │   ├── Task 2
│   │   └── Task 3
│   └── User 2
│       ├── Task 4
│       └── Task 5
├── Category 2
│   ├── Leader: Jane Smith
│   ├── User 3
│   │   └── Task 6
│   └── User 4
│       ├── Task 7
│       └── Task 8
└── Uncategorized
    └── User 5
        └── Task 9
```

## Features

### 1. **Category Leaders**

Category leaders are users with special permissions to manage tasks within their assigned categories:

- **Who can be a leader?** Only users with `Admin`, `Owner`, or `Leader` roles
- **What can they do?**
  - View all tasks in their category
  - Assign tasks to team members
  - Track progress of all tasks in their category
  - See tasks grouped by assigned user

### 2. **Hierarchical View**

The new **Hierarchy View** provides a tree-like structure showing:

- **Categories** at the top level
  - Shows category name and assigned leader
  - Displays total task count and completion progress
  - Expandable/collapsible sections

- **Users** within each category
  - Shows user name and email
  - Displays task count and completion progress for that user
  - Expandable/collapsible sections

- **Tasks** under each user
  - Shows task title, status, priority
  - Displays due date and estimated time
  - Click to edit task details

### 3. **View Modes**

Toggle between two view modes:

- **📋 List View**: Traditional flat list of all tasks with filters
- **🌳 Hierarchy View**: Tree structure grouped by category and user

## How to Use

### Assigning a Category Leader

1. Navigate to the **Tasks** page
2. In the left sidebar, find the category you want to assign a leader to
3. Hover over the category item
4. Click the **👤** (person) icon that appears
5. Select a leader from the dropdown (only Admin/Owner/Leader roles shown)
6. Click **Assign Leader**

### Viewing Tasks by Category & User

1. Click the **🌳 Hierarchy View** button in the toolbar
2. Click on a category to expand and see users
3. Click on a user to expand and see their tasks
4. Click on a task to edit it

### Quick Actions

- **Expand All Categories**: Click to expand all categories at once
- **Collapse All**: Click to collapse all categories and users
- **Progress Bars**: Visual indicators show completion percentage for each category and user

### Task Organization

Tasks are automatically organized based on:
- **Category**: The category assigned to the task
- **Assigned User**: The user the task is assigned to

If a task has no category, it appears under "Uncategorized".

## Permissions

### Admin & Owner
- Can assign category leaders
- Can create, edit, and delete categories
- Can view all tasks across all categories
- Can assign tasks to any user

### Leader (Category Leader)
- Can view all tasks in their assigned category
- Can assign tasks to team members in their scope
- Can track progress of their team members
- Cannot manage categories

### Employee
- Can only view their own tasks
- Cannot assign tasks to others
- Cannot manage categories or leaders

## Benefits

1. **Better Organization**: Tasks are grouped logically by category and assignee
2. **Clear Ownership**: Each category has a designated leader responsible for oversight
3. **Progress Tracking**: Visual progress bars show completion status at both category and user levels
4. **Scalability**: Works well for small teams and large organizations
5. **Flexibility**: Switch between list and hierarchy views based on your needs

## Tips

- Use categories to represent different projects, departments, or work streams
- Assign leaders who are responsible for specific areas of work
- Use the hierarchy view for planning and progress reviews
- Use the list view for day-to-day task management with filters

## Example Use Cases

### Project Management
```
Projects
├── Website Redesign (Leader: Sarah)
│   ├── Designer (3 tasks)
│   └── Developer (5 tasks)
└── Mobile App (Leader: Mike)
    ├── iOS Developer (4 tasks)
    └── Android Developer (4 tasks)
```

### Department Organization
```
Departments
├── Marketing (Leader: Emma)
│   ├── Content Writer (6 tasks)
│   └── Social Media Manager (4 tasks)
└── Sales (Leader: David)
    ├── Sales Rep 1 (8 tasks)
    └── Sales Rep 2 (7 tasks)
```

### Sprint Planning
```
Sprint 5
├── Frontend (Leader: Alex)
│   ├── React Developer 1 (5 tasks)
│   └── React Developer 2 (4 tasks)
└── Backend (Leader: Jordan)
    ├── API Developer (6 tasks)
    └── Database Admin (3 tasks)
```
