import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formsAPI, orgAPI } from '../services/api';
import FormBuilder from '../components/forms/FormBuilder';
import FormList from '../components/forms/FormList';
import FormAssignments from '../components/forms/FormAssignments';
import './Forms.css';

export default function Forms() {
    const [orgId] = useState(localStorage.getItem('selectedOrgId'));
    const [orgName] = useState(localStorage.getItem('selectedOrgName'));
    const [userRole] = useState(localStorage.getItem('userRole'));
    const [forms, setForms] = useState([]);
    const [selectedForm, setSelectedForm] = useState(null);
    const [showBuilder, setShowBuilder] = useState(false);
    const [showAssignments, setShowAssignments] = useState(false);
    const [loading, setLoading] = useState(true);
    const [teamMembers, setTeamMembers] = useState([]);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Check if user is admin/owner
    const isAdmin = ['admin', 'owner'].includes(userRole);

    useEffect(() => {
        if (!orgId) {
            navigate('/select-org');
            return;
        }

        if (!isAdmin) {
            alert('Admin or Owner access required for Forms management');
            navigate('/dashboard');
            return;
        }

        loadData();
    }, [orgId, navigate, isAdmin]);

    const loadData = async () => {
        try {
            const [formsRes, membersRes] = await Promise.all([
                formsAPI.getAll(orgId),
                orgAPI.getMembers(orgId)
            ]);

            setForms(formsRes.data);
            setTeamMembers(membersRes.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load forms data:', err);
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        setSelectedForm(null);
        setShowBuilder(true);
    };

    const handleEditForm = (form) => {
        setSelectedForm(form);
        setShowBuilder(true);
    };

    const handleAssignForm = (form) => {
        setSelectedForm(form);
        setShowAssignments(true);
    };

    const handleCloseBuilder = () => {
        setShowBuilder(false);
        setSelectedForm(null);
        loadData();
    };

    const handleCloseAssignments = () => {
        setShowAssignments(false);
        setSelectedForm(null);
    };

    const handleDeleteForm = async (formId) => {
        if (!window.confirm('Delete this form? This cannot be undone.')) return;

        try {
            await formsAPI.delete(orgId, formId);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete form');
        }
    };

    const handleToggleStatus = async (form) => {
        try {
            const nextStatus = !form.is_active;
            await formsAPI.updateStatus(orgId, form.id, nextStatus);
            // Optimistic update
            setForms(forms.map(f => f.id === form.id ? { ...f, is_active: nextStatus } : f));
        } catch (err) {
            console.error('Failed to toggle status:', err);
            alert('Failed to update form status');
            // Revert on error
            loadData();
        }
    };

    const handleChangeOrg = () => {
        localStorage.removeItem('selectedOrgId');
        localStorage.removeItem('selectedOrgName');
        localStorage.removeItem('userRole');
        navigate('/select-org');
    };

    if (loading) {
        return <div className="loading-screen"><div className="spinner"></div></div>;
    }

    return (
        <div className="forms-page">
            <header className="forms-header">
                <div className="header-left">
                    <h1>🏢 {orgName}</h1>
                    <span className="role-badge">{userRole}</span>
                </div>
                <div className="header-right">
                    <button onClick={() => navigate('/dashboard')} className="btn-nav">Dashboard</button>
                    <button onClick={() => navigate('/tasks')} className="btn-nav">Tasks</button>
                    <button onClick={() => navigate('/time')} className="btn-nav">Time</button>
                    <button onClick={() => navigate('/reports')} className="btn-nav">Reports</button>
                    <span className="user-name">{user?.name || user?.email}</span>
                    <button onClick={handleChangeOrg} className="btn-change-org">Change Org</button>
                    <button onClick={logout} className="btn-logout">Logout</button>
                </div>
            </header>

            <div className="forms-container">
                <main className="forms-main">
                    <div className="forms-toolbar">
                        <h2>📋 Form Builder</h2>
                        <button className="btn btn-primary" onClick={handleCreateNew}>
                            ➕ Create New Form
                        </button>
                    </div>

                    <FormList
                        forms={forms}
                        onEdit={handleEditForm}
                        onDelete={handleDeleteForm}
                        onAssign={handleAssignForm}
                        onToggleStatus={handleToggleStatus}
                    />
                </main>
            </div>

            {showBuilder && (
                <FormBuilder
                    form={selectedForm}
                    orgId={orgId}
                    teamMembers={teamMembers}
                    onClose={handleCloseBuilder}
                />
            )}

            {showAssignments && selectedForm && (
                <FormAssignments
                    form={selectedForm}
                    orgId={orgId}
                    onClose={handleCloseAssignments}
                />
            )}
        </div>
    );
}
