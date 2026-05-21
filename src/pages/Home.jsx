import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const { currentUser, userRole } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (userRole === 'lecturer') {
    return <Navigate to="/lecturer" replace />;
  } else if (userRole === 'student') {
    return <Navigate to="/student" replace />;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Welcome to Smart-AMS</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Select a view from the sidebar to continue.</p>
      </div>
    </div>
  );
};

export default Home;
