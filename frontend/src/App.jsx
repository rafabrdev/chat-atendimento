import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useSocket } from './hooks/useSocket';

// Context
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

// Components
import PrivateRoute from './components/PrivateRoute.jsx';
import PublicRoute from './components/PublicRoute.jsx';
import MainLayout from './components/Layout/MainLayout.jsx';
import RoleBasedRedirect from './components/RoleBasedRedirect.jsx';

// Pages
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SimpleDashboard from './pages/SimpleDashboard.jsx';
import Conversations from './pages/Conversations.jsx';
import History from './pages/History.jsx';
import NotFound from './pages/NotFound.jsx';
import Unauthorized from './pages/Unauthorized.jsx';
import TestMode from './pages/TestMode.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import MasterDashboard from './pages/MasterDashboard.jsx';
import Pricing from './pages/Pricing.jsx';
import CheckoutSuccess from './pages/CheckoutSuccess.jsx';
import UserManagement from './pages/UserManagement.jsx';

// Components for Sprint 3
import AgentManagement from './components/Agent/AgentManagement.jsx';
import AnalyticsDashboard from './components/Analytics/AnalyticsDashboard.jsx';

// Componente wrapper para inicializar socket
function SocketWrapper({ children }) {
  const { token, user } = useAuth();
  useSocket(token, user);
  
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Rotas públicas */}
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />
            {/* Registro com suporte a convites */}
            <Route 
              path="/register" 
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } 
            />
            <Route 
              path="/pricing" 
              element={<Pricing />} 
            />
            <Route 
              path="/checkout/success" 
              element={<CheckoutSuccess />} 
            />

            {/* Rotas privadas */}
            <Route 
              path="/dashboard" 
              element={
                <PrivateRoute roles={['client', 'agent', 'admin']}>
                <SocketWrapper>
                  <MainLayout>
                    <Dashboard />
                  </MainLayout>
                </SocketWrapper>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/conversations" 
              element={
                <PrivateRoute roles={['client', 'agent', 'admin']}>
                  <SocketWrapper>
                    <MainLayout>
                      <Conversations />
                    </MainLayout>
                  </SocketWrapper>
                </PrivateRoute>
              }
            />
            <Route 
              path="/history" 
              element={
                <PrivateRoute>
                  <SocketWrapper>
                    <MainLayout>
                      <History />
                    </MainLayout>
                  </SocketWrapper>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/agents" 
              element={
                <PrivateRoute roles={['agent', 'admin']}>
                  <SocketWrapper>
                    <MainLayout>
                      <AgentManagement />
                    </MainLayout>
                  </SocketWrapper>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/analytics" 
              element={
                <PrivateRoute>
                  <SocketWrapper>
                    <MainLayout>
                      <AnalyticsDashboard />
                    </MainLayout>
                  </SocketWrapper>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <PrivateRoute roles={['admin']}>
                  <SocketWrapper>
                    <MainLayout>
                      <AdminDashboard />
                    </MainLayout>
                  </SocketWrapper>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/users" 
              element={
                <PrivateRoute roles={['admin']}>
                  <SocketWrapper>
                    <MainLayout>
                      <UserManagement />
                    </MainLayout>
                  </SocketWrapper>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/master" 
              element={
                <PrivateRoute roles={['master']}>
                  <SocketWrapper>
                    <MainLayout>
                      <MasterDashboard />
                    </MainLayout>
                  </SocketWrapper>
                </PrivateRoute>
              } 
            />
            <Route 
              path="/test-mode" 
              element={
                <PrivateRoute>
                  <TestMode />
                </PrivateRoute>
              } 
            />

            {/* Rotas de erro */}
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Redirecionamentos */}
            <Route path="/" element={
              <PrivateRoute>
                <RoleBasedRedirect />
              </PrivateRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>

          {/* Toast notifications */}
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App
