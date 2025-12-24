import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SelectOrganization from './pages/SelectOrganization'
import Tasks from './pages/Tasks'
import TimeTracking from './pages/TimeTracking'
import Reports from './pages/Reports'
import Forms from './pages/Forms'
import Groups from './pages/Groups'
import Team from './pages/Team'
import './App.css'

function App() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading Virtual Office...</p>
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/select-org" />} />
            <Route path="/select-org" element={user ? <SelectOrganization /> : <Navigate to="/login" />} />
            <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="/tasks" element={user ? <Tasks /> : <Navigate to="/login" />} />
            <Route path="/time" element={user ? <TimeTracking /> : <Navigate to="/login" />} />
            <Route path="/reports" element={user ? <Reports /> : <Navigate to="/login" />} />
            <Route path="/forms" element={user ? <Forms /> : <Navigate to="/login" />} />
            <Route path="/groups" element={user ? <Groups /> : <Navigate to="/login" />} />
            <Route path="/team" element={user ? <Team /> : <Navigate to="/login" />} />
            <Route path="/" element={<Navigate to={user ? "/select-org" : "/login"} />} />
        </Routes>
    )
}

export default App
