import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import LecturerDashboard from './pages/LecturerDashboard';
import LecturerCourses from './pages/LecturerCourses';
import LecturerProfile from './pages/LecturerProfile';
import StudentDashboard from './pages/StudentDashboard';
import StudentProfile from './pages/StudentProfile';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AttendanceReport from './pages/AttendanceReport';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import SmartBoard from './pages/SmartBoard';
import Settings from './pages/Settings';

function App() {
  const [activeSession, setActiveSession] = useState(null);

  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Standalone Route (No Layout) */}
            <Route path="/board" element={<SmartBoard />} />

            {/* Layout Routes */}
            <Route path="*" element={
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/lecturer" element={<ProtectedRoute allowedRole="lecturer"><LecturerDashboard /></ProtectedRoute>} />
                  <Route path="/lecturer/courses" element={<ProtectedRoute allowedRole="lecturer"><LecturerCourses /></ProtectedRoute>} />
                  <Route path="/lecturer/profile" element={<ProtectedRoute allowedRole="lecturer"><LecturerProfile /></ProtectedRoute>} />
                  <Route path="/student" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute allowedRole="student"><AttendanceReport /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute allowedRole="student"><StudentProfile /></ProtectedRoute>} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
