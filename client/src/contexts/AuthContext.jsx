import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const response = await authAPI.getMe();
            setUser(response.data);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const response = await authAPI.login({ email, password });
            setUser(response.data);
            return response.data;
        } catch (error) {
            throw error;
        }
    };

    const signup = async (name, email, password) => {
        try {
            const response = await authAPI.signup({ name, email, password });
            setUser(response.data);
            return response.data;
        } catch (error) {
            throw error;
        }
    };

    const devLogin = async (email) => {
        try {
            const response = await authAPI.devLogin(email);
            setUser(response.data);
            return response.data;
        } catch (error) {
            throw error;
        }
    };

    const logout = async () => {
        try {
            await authAPI.logout();
            setUser(null);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const value = {
        user,
        loading,
        login,
        signup,
        devLogin,
        logout,
        checkAuth
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
