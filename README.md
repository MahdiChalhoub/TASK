# Virtual Office - Task Management System

A comprehensive workspace management application with hierarchical task organization, time tracking, and team collaboration features.

## 🌟 Features

### Task Management
- **Hierarchical Organization**: Tasks organized by categories with assigned leaders
- **Category Leaders**: Assign leaders to oversee specific categories
- **User-Based Filtering**: View tasks by category and user
- **Priority & Status Tracking**: Color-coded priorities (urgent, high, medium, low)
- **Task Details**: Title, description, due dates, estimated time, and status

### Hierarchy View
- **Expandable Categories**: Click categories to see assigned users
- **Nested User Lists**: Users displayed under their categories with task counts
- **Smart Filtering**: Select user to see only their tasks in that category
- **Visual Progress**: Progress bars showing completion percentage

### Time Tracking
- **Day Sessions**: Track daily work hours
- **Task Timers**: Time individual tasks
- **Manual Entries**: Add time entries manually
- **Approval Workflow**: Submit time for review and approval

### Reporting
- **Daily Reports**: Customizable report forms with questions
- **Form Builder**: Create custom report forms with different question types
- **Assignment System**: Assign forms to users, groups, or roles
- **Report History**: View and manage submitted reports

### Team Management
- **Organizations**: Multi-organization support
- **Role-Based Access**: Owner, Admin, Leader, Employee roles
- **User Groups**: Organize users into groups
- **Team Invitations**: Invite members with join codes

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/virtual-office.git
   cd virtual-office
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

4. **Set up environment variables**
   
   Create a `.env` file in the `server` directory:
   ```env
   PORT=5000
   SESSION_SECRET=your-secret-key-here
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
   CLIENT_URL=http://localhost:5173
   ```

### Running the Application

1. **Start the server**
   ```bash
   cd server
   node index.js
   ```
   Server runs on `http://localhost:5000`

2. **Start the client** (in a new terminal)
   ```bash
   cd client
   npm run dev
   ```
   Client runs on `http://localhost:5173`

3. **Access the application**
   
   Open your browser and navigate to `http://localhost:5173`

## 📖 User Guide

### Creating an Organization
1. Sign in with Google
2. Create a new organization or join existing one with a join code
3. Set up your team by inviting members

### Managing Tasks

#### As Admin/Owner:
1. **Create Categories**: Click ➕ in the category sidebar
2. **Assign Leaders**: Click 👤 icon next to category to assign a leader
3. **Create Tasks**: Click "New Task" and assign to team members
4. **View Hierarchy**: Switch to "🌳 Hierarchy View" to see tasks by category and user

#### As Leader:
1. **View Your Category**: Expand your assigned category
2. **See Team Tasks**: View tasks assigned to your team members
3. **Assign Tasks**: Create and assign tasks within your category
4. **Track Progress**: Monitor completion rates

#### As Employee:
1. **View Your Tasks**: See all tasks assigned to you
2. **Update Status**: Mark tasks as in progress or completed
3. **Track Time**: Use timers to track time spent on tasks
4. **Submit Reports**: Fill out daily reports

### Using Hierarchy View

1. **Select Category**: Click on a category in the sidebar
   - Category expands to show users with tasks
   - Each user shows their task count

2. **Select User**: Click on a user under the category
   - Tasks panel shows only that user's tasks in the selected category
   - Tasks displayed as cards with all details

3. **View All**: Click "All Tasks" to see everything

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 19 with Vite
- React Router for navigation
- Axios for API calls
- CSS for styling

**Backend:**
- Node.js with Express
- SQLite database
- Passport.js for authentication (Google OAuth)
- Session-based authentication

### Database Schema

Key tables:
- `organizations` - Organization details
- `users` - User accounts
- `organization_members` - User-organization relationships with roles
- `task_categories` - Task categories with leaders
- `tasks` - Task details and assignments
- `time_entries` - Time tracking records
- `daily_reports` - Report submissions
- `report_forms` - Custom report forms

## 🎨 Features in Detail

### Hierarchical Task Management

The system uses a three-level hierarchy:
```
Organization
├── Category (with Leader)
│   ├── User 1 (with tasks)
│   ├── User 2 (with tasks)
│   └── User 3 (with tasks)
└── Category 2
    └── ...
```

**Benefits:**
- Clear ownership and accountability
- Easy progress tracking
- Scalable for large teams
- Flexible organization structure

### Role-Based Permissions

| Role | Permissions |
|------|------------|
| **Owner** | Full access, manage organization |
| **Admin** | Manage categories, users, and tasks |
| **Leader** | Manage tasks in assigned categories |
| **Employee** | View and update own tasks |

## 🔧 Development

### Project Structure
```
virtual-office/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React contexts
│   │   └── services/      # API services
│   └── package.json
├── server/                # Express backend
│   ├── routes/           # API routes
│   ├── db.js             # Database setup
│   ├── index.js          # Server entry point
│   └── package.json
└── README.md
```

### API Endpoints

**Authentication:**
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `GET /auth/logout` - Logout
- `GET /auth/user` - Get current user

**Tasks:**
- `GET /api/tasks` - Get all tasks (with filters)
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

**Categories:**
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category (including leader)
- `DELETE /api/categories/:id` - Delete category

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For support, please open an issue in the GitHub repository.

## 🙏 Acknowledgments

- Built with React and Express
- Icons from emoji
- Inspired by modern task management tools

---

**Made with ❤️ for better team collaboration**
