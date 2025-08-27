import React, { createContext, useContext, useReducer, useEffect } from 'react';
import api, { setupAuthAutoRefresh, clearAuthAutoRefresh } from '../config/api';
import authService from '../services/authService';
import toast from 'react-hot-toast';

// Estado inicial
const initialState = {
  user: null,
  token: null,
  tenantId: null,
  isAuthenticated: false,
  isLoading: true,
};

// Tipos de ações
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  LOAD_USER: 'LOAD_USER',
  UPDATE_USER: 'UPDATE_USER',
  SET_LOADING: 'SET_LOADING',
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
      };
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        tenantId: action.payload.user?.tenantId || null,
        isAuthenticated: true,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        tenantId: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false,
      };
    case AUTH_ACTIONS.LOAD_USER:
      return {
        ...state,
        user: action.payload,
        isLoading: false,
      };
    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
};

// Criar contexto
const AuthContext = createContext();

// Provider
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Carregar usuário do localStorage na inicialização
  useEffect(() => {
    const token = authService.getAccessToken();
    const user = authService.getUser();

    if (token && user) {
      // Check if token is expired
      if (authService.isTokenExpired(token)) {
        // Try to refresh
        authService.refreshAccessToken(api)
          .then((newToken) => {
            dispatch({
              type: AUTH_ACTIONS.LOGIN_SUCCESS,
              payload: { user: authService.getUser(), token: newToken },
            });
            setupAuthAutoRefresh();
            loadUser();
          })
          .catch(() => {
            // Refresh failed, clear auth
            authService.clearAuthData();
            dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
          });
      } else {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user, token },
        });
        setupAuthAutoRefresh();
        loadUser();
      }
    } else {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  }, []);

  // Carregar dados atualizados do usuário
  const loadUser = async () => {
    try {
      const response = await api.get('/auth/profile');
      dispatch({
        type: AUTH_ACTIONS.LOAD_USER,
        payload: response.data.data.user,
      });
    } catch (error) {
      console.error('Error loading user:', error);
      logout();
    }
  };

  // Login
  const login = async (email, password) => {
    console.log('[AuthContext] Starting login for:', email);
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      console.log('[AuthContext] Making login request...');
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      console.log('[AuthContext] Login response:', response.data);
      const { user, token, refreshToken } = response.data.data;

      // Use authService to store auth data
      authService.storeAuthData({ token, refreshToken, user });

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user, token },
      });

      // Setup auto-refresh
      setupAuthAutoRefresh();

      toast.success('Login realizado com sucesso!');
      console.log('[AuthContext] Login successful, returning:', { success: true, user });
      return { success: true, user };
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      console.error('[AuthContext] Error response:', error.response);
      console.error('[AuthContext] Error message:', error.message);
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAILURE });
      
      const message = error.response?.data?.message || 'Erro no login';
      toast.error(message);
      
      return { success: false, message };
    }
  };

  // Registro
  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      const response = await api.post('/auth/register', userData);
      const { user, token, refreshToken } = response.data.data;

      // Use authService to store auth data
      authService.storeAuthData({ token, refreshToken, user });

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user, token },
      });

      // Setup auto-refresh
      setupAuthAutoRefresh();

      toast.success('Conta criada com sucesso!');
      return { success: true };
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAILURE });
      
      const message = error.response?.data?.message || 'Erro no registro';
      toast.error(message);
      
      return { success: false, message };
    }
  };

  // Logout
  const logout = () => {
    // Clear auto-refresh timer
    clearAuthAutoRefresh();
    
    // Clear all auth data
    authService.clearAuthData();
    
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
    toast.success('Logout realizado com sucesso!');
  };

  // Atualizar perfil
  const updateProfile = async (updateData) => {
    try {
      const response = await api.patch('/auth/profile', updateData);
      const updatedUser = response.data.data.user;

      // Update user in authService
      authService.setUser(updatedUser);

      dispatch({
        type: AUTH_ACTIONS.UPDATE_USER,
        payload: updatedUser,
      });

      toast.success('Perfil atualizado com sucesso!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Erro ao atualizar perfil';
      toast.error(message);
      return { success: false, message };
    }
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    loadUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar o contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

export default AuthContext;
