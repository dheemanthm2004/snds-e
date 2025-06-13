'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { apiClient, authApi } from '../lib/api';
import { User, AuthState, LoginCredentials, RegisterData } from '../types';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          apiClient.setToken(token);
          
          // Verify token and get user data
          const response = await authApi.verifyToken(token);
          if (response.success && response.data?.user) {
            setState({
              user: response.data.user,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            // Token is invalid, clear it
            localStorage.removeItem('auth_token');
            apiClient.clearToken();
            setState({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } else {
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        // Clear invalid token
        localStorage.removeItem('auth_token');
        apiClient.clearToken();
        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authApi.login(credentials);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        // Store token
        localStorage.setItem('auth_token', token);
        apiClient.setToken(token);
        
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
        
        toast.success('Login successful!');
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error: any) {
      setState(prev => ({ ...prev, isLoading: false }));
      const message = error.response?.data?.error || error.message || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authApi.register(data);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        // Store token
        localStorage.setItem('auth_token', token);
        apiClient.setToken(token);
        
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
        
        toast.success('Registration successful!');
      } else {
        throw new Error(response.error || 'Registration failed');
      }
    } catch (error: any) {
      setState(prev => ({ ...prev, isLoading: false }));
      const message = error.response?.data?.error || error.message || 'Registration failed';
      toast.error(message);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    apiClient.clearToken();
    
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    
    toast.success('Logged out successfully');
  };

  const updateUser = (user: User) => {
    setState(prev => ({
      ...prev,
      user,
    }));
  };

  const refreshUser = async () => {
    try {
      if (!state.isAuthenticated) return;
      
      const response = await authApi.getProfile();
      if (response.success && response.data?.user) {
        updateUser(response.data.user);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      // If refresh fails, user might need to re-login
      logout();
    }
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;