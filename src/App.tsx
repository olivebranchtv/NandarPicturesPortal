import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { AuthPage } from './components/auth/AuthPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { FilmmakerDashboard } from './pages/FilmmakerDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { supabase } from './lib/supabase';

function App() {
  const { user, profile, loading } = useAuth();

  // Show connection prompt if Supabase is not configured
  if (!supabase) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Connect to Supabase
            </h1>
            <p className="text-gray-600 mb-6">
              Please click the "Connect to Supabase" button in the top right to set up your database connection.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                Once connected, the database schema will be automatically created for your Nandar Pictures distribution portal.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthPage />;
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route
            path="/"
            element={
              <Navigate 
                to={profile.role === 'admin' ? '/admin/dashboard' : '/filmmaker/dashboard'} 
                replace 
              />
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              profile.role === 'admin' ? (
                <ErrorBoundary><AdminDashboard /></ErrorBoundary>
              ) : (
                <Navigate to="/filmmaker/dashboard" replace />
              )
            }
          />
          <Route
            path="/filmmaker/dashboard"
            element={
              profile.role === 'filmmaker' ? (
                <ErrorBoundary><FilmmakerDashboard /></ErrorBoundary>
              ) : (
                <Navigate to="/admin/dashboard" replace />
              )
            }
          />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;