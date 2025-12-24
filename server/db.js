const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'virtualoffice.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Organizations
        db.run(`CREATE TABLE IF NOT EXISTS organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            join_code TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Users
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            google_id TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Organization Members
        db.run(`CREATE TABLE IF NOT EXISTS organization_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT CHECK(role IN ('owner', 'admin', 'leader', 'employee')) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(org_id, user_id)
        )`);

        // Task Categories
        db.run(`CREATE TABLE IF NOT EXISTS task_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            leader_user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(leader_user_id) REFERENCES users(id)
        )`);

        // Leader Scope
        db.run(`CREATE TABLE IF NOT EXISTS leader_scope (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            leader_user_id INTEGER NOT NULL,
            member_user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(leader_user_id) REFERENCES users(id),
            FOREIGN KEY(member_user_id) REFERENCES users(id),
            UNIQUE(org_id, leader_user_id, member_user_id)
        )`);

        // Tasks
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
            priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
            due_date DATE,
            category_id INTEGER,
            assigned_to_user_id INTEGER NOT NULL,
            created_by_user_id INTEGER NOT NULL,
            estimated_minutes INTEGER DEFAULT 0,
            completed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(category_id) REFERENCES task_categories(id),
            FOREIGN KEY(assigned_to_user_id) REFERENCES users(id),
            FOREIGN KEY(created_by_user_id) REFERENCES users(id)
        )`);

        // Time Entries
        db.run(`CREATE TABLE IF NOT EXISTS time_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            type TEXT CHECK(type IN ('day_session', 'task_timer', 'manual')) NOT NULL,
            task_id INTEGER,
            start_at DATETIME,
            end_at DATETIME,
            duration_minutes INTEGER,
            status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
            reviewer_user_id INTEGER,
            review_note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(task_id) REFERENCES tasks(id),
            FOREIGN KEY(reviewer_user_id) REFERENCES users(id)
        )`);

        // Holidays
        db.run(`CREATE TABLE IF NOT EXISTS holidays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(org_id, user_id, date)
        )`);

        // Report Forms
        db.run(`CREATE TABLE IF NOT EXISTS report_forms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id)
        )`);

        // Report Form Questions
        db.run(`CREATE TABLE IF NOT EXISTS report_form_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            form_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            type TEXT CHECK(type IN ('text', 'single_choice', 'multi_choice')) NOT NULL,
            required BOOLEAN DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY(form_id) REFERENCES report_forms(id) ON DELETE CASCADE
        )`);

        // Report Form Choices
        db.run(`CREATE TABLE IF NOT EXISTS report_form_choices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY(question_id) REFERENCES report_form_questions(id) ON DELETE CASCADE
        )`);

        // User Groups
        db.run(`CREATE TABLE IF NOT EXISTS user_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id)
        )`);

        // User Group Members
        db.run(`CREATE TABLE IF NOT EXISTS user_group_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            FOREIGN KEY(group_id) REFERENCES user_groups(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(group_id, user_id)
        )`);

        // Report Form Assignments
        db.run(`CREATE TABLE IF NOT EXISTS report_form_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            form_id INTEGER NOT NULL,
            target_type TEXT CHECK(target_type IN ('user', 'group', 'role')) NOT NULL,
            target_id INTEGER NOT NULL,
            target_role TEXT,
            active_from_date DATE,
            active_to_date DATE,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(form_id) REFERENCES report_forms(id) ON DELETE CASCADE
        )`);

        // Daily Reports
        db.run(`CREATE TABLE IF NOT EXISTS daily_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            submitted_at DATETIME,
            status TEXT CHECK(status IN ('submitted', 'returned_for_edit', 'approved')) DEFAULT 'submitted',
            reviewer_user_id INTEGER,
            reviewer_note TEXT,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(reviewer_user_id) REFERENCES users(id),
            UNIQUE(org_id, user_id, date)
        )`);

        // Daily Report Answers
        db.run(`CREATE TABLE IF NOT EXISTS daily_report_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            daily_report_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            answer_text TEXT,
            answer_choices_json TEXT,
            FOREIGN KEY(daily_report_id) REFERENCES daily_reports(id) ON DELETE CASCADE,
            FOREIGN KEY(question_id) REFERENCES report_form_questions(id)
        )`);

        // Daily Report Extra Work
        db.run(`CREATE TABLE IF NOT EXISTS daily_report_extra_work (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            daily_report_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            minutes INTEGER NOT NULL,
            note TEXT,
            FOREIGN KEY(daily_report_id) REFERENCES daily_reports(id) ON DELETE CASCADE
        )`);

        // Daily Report AI Summaries
        db.run(`CREATE TABLE IF NOT EXISTS daily_report_ai_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            date DATE NOT NULL,
            model_version TEXT NOT NULL,
            summary_json TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(org_id, user_id, date, model_version)
        )`);

        console.log('Database tables initialized for Virtual Office Application.');
    });
}

module.exports = db;
