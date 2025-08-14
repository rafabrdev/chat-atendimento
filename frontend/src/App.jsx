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

// Pages
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Conversations from './pages/Conversations.jsx';
import History from './pages/History.jsx';
import NotFound from './pages/NotFound.jsx';
import Unauthorized from './pages/Unauthorized.jsx';
import TestMode from './pages/TestMode.jsx';

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
            <Route 
              path="/register" 
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } 
            />

            {/* Rotas privadas */}
            <Route 
              path="/dashboard" 
              element={
                <PrivateRoute>
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
                <PrivateRoute>
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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
