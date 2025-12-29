import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Auth APIs
export const authAPI = {
    devLogin: (email) => api.post('/auth/dev-login', { email }),
    getMe: () => api.get('/auth/me'),
    logout: () => api.post('/auth/logout'),
    googleLogin: () => window.location.href = `${API_URL}/auth/google`
};

// Organization APIs
export const orgAPI = {
    create: (name) => api.post('/orgs', { name }),
    join: (joinCode) => api.post('/orgs/join', { joinCode }),
    getMyOrgs: () => api.get('/orgs/my-orgs'),
    getOrg: (id) => api.get(`/orgs/${id}`),
    getMembers: (id) => api.get(`/orgs/${id}/members`),
    updateMemberRole: (orgId, userId, role) =>
        api.put(`/orgs/${orgId}/members/${userId}/role`, { role }),
    devCreateUser: (orgId, email, name) => api.post(`/orgs/${orgId}/dev-users`, { email, name })
};

// Category APIs
export const categoryAPI = {
    getAll: (orgId) => api.get('/categories', { headers: { 'x-org-id': orgId } }),
    create: (orgId, data) => api.post('/categories', { ...data, orgId }),
    update: (orgId, id, data) => api.put(`/categories/${id}`, { ...data, orgId }),
    delete: (orgId, id) => api.delete(`/categories/${id}`, { headers: { 'x-org-id': orgId } }),
    reorder: (orgId, categoryIds) => api.put('/categories/reorder/update', { categoryIds, orgId })
};

// Task APIs
export const taskAPI = {
    getAll: (orgId, filters = {}) => {
        const params = new URLSearchParams({ orgId, ...filters });
        return api.get(`/tasks?${params}`);
    },
    getOne: (orgId, id) => api.get(`/tasks/${id}`, { headers: { 'x-org-id': orgId } }),
    create: (orgId, data) => api.post('/tasks', { ...data, orgId }),
    update: (orgId, id, data) => api.put(`/tasks/${id}`, { ...data, orgId }),
    toggle: (orgId, id) => api.patch(`/tasks/${id}/toggle`, { orgId }),
    delete: (orgId, id) => api.delete(`/tasks/${id}`, { headers: { 'x-org-id': orgId } })
};

// Time Tracking APIs
export const timeAPI = {
    // Day session
    getSessionStatus: (orgId) => api.get('/time/day-session/status', { headers: { 'x-org-id': orgId } }),
    clockIn: (orgId) => api.post('/time/day-session/start', { orgId }),
    clockOut: (orgId) => api.post('/time/day-session/end', { orgId }),

    // Task timers
    startTaskTimer: (orgId, taskId) => api.post('/time/task-timer/start', { orgId, task_id: taskId }),
    stopTaskTimer: (orgId, taskId) => api.post('/time/task-timer/stop', { orgId, task_id: taskId }),
    getActiveTimers: (orgId) => api.get('/time/active-timers', { headers: { 'x-org-id': orgId } }),

    // Manual logging
    quickLog: (orgId, data) => api.post('/time/quick-log', { ...data, orgId }),

    // History
    getHistory: (orgId, date) => api.get(`/time/history/${date}`, { headers: { 'x-org-id': orgId } }),
    deleteEntry: (orgId, id) => api.delete(`/time/${id}`, { headers: { 'x-org-id': orgId } })
};

// Reports APIs
export const reportsAPI = {
    getStatus: (orgId, date) => api.get(`/reports/status/${date}`, { headers: { 'x-org-id': orgId } }),
    getReportData: (orgId, date) => api.get(`/reports/data/${date}`, { headers: { 'x-org-id': orgId } }),
    submit: (orgId, data) => api.post('/reports/submit', { ...data, orgId }),
    getHistory: (orgId, limit = 30) => api.get('/reports/history', {
        headers: { 'x-org-id': orgId },
        params: { limit }
    }),
    getReport: (orgId, id) => api.get(`/reports/${id}`, { headers: { 'x-org-id': orgId } }),
    deleteReport: (orgId, id) => api.delete(`/reports/${id}`, { headers: { 'x-org-id': orgId } })
};

// Forms APIs (Admin Only)
export const formsAPI = {
    getAll: (orgId) => api.get('/forms', { headers: { 'x-org-id': orgId } }),
    getOne: (orgId, id) => api.get(`/forms/${id}`, { headers: { 'x-org-id': orgId } }),
    create: (orgId, data) => api.post('/forms', { ...data, orgId }),
    update: (orgId, id, data) => api.put(`/forms/${id}`, { ...data, orgId }),
    delete: (orgId, id) => api.delete(`/forms/${id}`, { headers: { 'x-org-id': orgId } }),
    updateStatus: (orgId, id, isActive) => api.patch(`/forms/${id}/status`, { is_active: isActive, orgId }),
    addQuestion: (orgId, formId, question) => api.post(`/forms/${formId}/questions`, { ...question, orgId }),
    updateQuestion: (orgId, questionId, question) => api.put(`/forms/questions/${questionId}`, { ...question, orgId }),
    deleteQuestion: (orgId, questionId) => api.delete(`/forms/questions/${questionId}`, { headers: { 'x-org-id': orgId } }),

    // Assignments
    getAssignments: (orgId, formId) => api.get(`/forms/${formId}/assignments`, { headers: { 'x-org-id': orgId } }),
    assign: (orgId, formId, data) => api.post(`/forms/${formId}/assignments`, { ...data, orgId }),
    removeAssignment: (orgId, formId, assignmentId) => api.delete(`/forms/${formId}/assignments/${assignmentId}`, { headers: { 'x-org-id': orgId } })
};



// Group APIs
export const groupAPI = {
    getAll: (orgId) => api.get('/groups', { headers: { 'x-org-id': orgId } }),
    create: (orgId, name) => api.post('/groups', { orgId, name }),
    delete: (orgId, id) => api.delete(`/groups/${id}`, { headers: { 'x-org-id': orgId } }),
    getMembers: (orgId, id) => api.get(`/groups/${id}/members`, { headers: { 'x-org-id': orgId } }),
    addMember: (orgId, id, userId) => api.post(`/groups/${id}/members`, { orgId, userId }),
    removeMember: (orgId, id, userId) => api.delete(`/groups/${id}/members/${userId}`, { headers: { 'x-org-id': orgId } })
};

// Settings APIs
export const settingsAPI = {
    get: (orgId) => api.get('/settings', { headers: { 'x-org-id': orgId } }),
    update: (orgId, data) => api.put('/settings', { ...data, orgId })
};

// Task Activity APIs
export const taskActivityAPI = {
    getByDate: (orgId, date) => api.get(`/activity/date/${date}`, { headers: { 'x-org-id': orgId } }),
    getByUserAndDate: (orgId, userId, date) => api.get(`/activity/user/${userId}/date/${date}`, { headers: { 'x-org-id': orgId } }),
    getByTask: (orgId, taskId) => api.get(`/activity/task/${taskId}`, { headers: { 'x-org-id': orgId } })
};

export default api;
