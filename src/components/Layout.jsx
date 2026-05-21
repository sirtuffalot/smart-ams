import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserSquare2, UserCircle, HelpCircle, Settings, LogOut, Bell, Search, BarChart3, Menu, X, ChevronLeft, ChevronRight, BookOpen, QrCode } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../utils/db';

const Layout = ({ children }) => {
  const { currentUser, userRole, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [notifications, setNotifications] = React.useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = React.useState(false);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  React.useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeToNotifications(currentUser.uid, (data) => {
      setNotifications(data);
    });
    return () => unsubscribe();
  }, [currentUser]);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProfileClick = () => {
    if (userRole === 'student') navigate('/profile');
    if (userRole === 'lecturer') navigate('/lecturer/profile');
  };

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  if (!currentUser) {
    return <div className="app-unauth-container">{children}</div>;
  }

  return (
    <div className={`app-container role-${userRole || 'lecturer'}`}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} 
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="logo-area">
          <div className="logo-icon" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-color)', flexShrink: 0, boxShadow: '0 3px 10px rgba(0,0,0,0.15)' }}>
            <QrCode size={17} color="#fff" strokeWidth={2.5} />
          </div>
          <span className="logo-text">Beacon</span>
        </div>
        <nav className="nav-links">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={() => setSidebarOpen(false)} end>
            <LayoutDashboard size={20} /><span className="nav-link-text">Overview</span>
          </NavLink>
          {userRole === 'lecturer' && (
            <>
              <NavLink to="/lecturer/courses" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={() => setSidebarOpen(false)}>
                <BookOpen size={20} /><span className="nav-link-text">My Courses</span>
              </NavLink>
              <NavLink to="/lecturer/profile" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={() => setSidebarOpen(false)}>
                <UserCircle size={20} /><span className="nav-link-text">My Profile</span>
              </NavLink>
            </>
          )}
          {userRole === 'student' && (
            <>
              <NavLink to="/profile" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={() => setSidebarOpen(false)}>
                <UserCircle size={20} /><span className="nav-link-text">My Profile</span>
              </NavLink>
              <NavLink to="/reports" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={() => setSidebarOpen(false)}>
                <BarChart3 size={20} /><span className="nav-link-text">My Progress</span>
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <a href="#" className="nav-link"><HelpCircle size={20} /><span className="nav-link-text">Help</span></a>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')} onClick={() => setSidebarOpen(false)}>
            <Settings size={20} /><span className="nav-link-text">Settings</span>
          </NavLink>
          <a href="#" onClick={handleLogout} className="nav-link"><LogOut size={20} /><span className="nav-link-text">Sign Out</span></a>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="main-wrapper">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Desktop: toggles sidebar collapse. Mobile: opens overlay sidebar */}
            <button
              className="sidebar-toggle-btn topbar-toggle"
              onClick={() => {
                if (window.innerWidth <= 768) setSidebarOpen(true);
                else setCollapsed(!collapsed);
              }}
              title={collapsed ? 'Expand menu' : 'Collapse menu'}
            >
              <Menu size={20} />
            </button>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.3px' }}>
              Beacon Portal
            </div>
          </div>
          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', 
              fontSize: '11px', fontWeight: 600, 
              color: isOnline ? '#10b981' : '#d97706',
              background: isOnline ? '#ecfdf5' : '#fffbeb',
              padding: '4px 10px', borderRadius: '12px',
              border: `1px solid ${isOnline ? '#a7f3d0' : '#fde68a'}`
            }}>
              <span style={{ fontSize: '10px' }}>●</span>
              {isOnline ? 'Sync Active' : 'Offline Mode'}
            </div>
            
            {/* Bell button with Notification Dropdown */}
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button 
                className="icon-btn" 
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Bell size={20} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span style={{ 
                    position: 'absolute', top: -2, right: -2, 
                    background: '#ef4444', color: 'white', 
                    fontSize: '9px', fontWeight: 800, 
                    borderRadius: '50%', width: 15, height: 15, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)'
                  }}>
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 12px)', right: 0,
                  width: 360, background: 'white', borderRadius: 16,
                  boxShadow: '0 12px 30px rgba(0,0,0,0.15)', border: '1px solid var(--border-color)',
                  zIndex: 2000, display: 'flex', flexDirection: 'column',
                  animation: 'dropdownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  overflow: 'hidden'
                }}>
                  {/* Dropdown Header */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8faff' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Notifications</span>
                    {notifications.filter(n => !n.read).length > 0 && (
                      <button 
                        onClick={() => markAllNotificationsAsRead(currentUser.uid)}
                        style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {/* Dropdown Body */}
                  <div style={{ maxHeight: 320, overflowY: 'auto' }} className="notif-list">
                    {notifications.length === 0 ? (
                      <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>No notifications yet</div>
                        <div style={{ fontSize: 11, marginTop: 2 }}>We'll alert you when updates arrive.</div>
                      </div>
                    ) : (
                      notifications.map(notif => {
                        const dateStr = notif.createdAt ? new Date(notif.createdAt.toDate ? notif.createdAt.toDate() : notif.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
                        const timeStr = notif.createdAt ? new Date(notif.createdAt.toDate ? notif.createdAt.toDate() : notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        return (
                          <div 
                            key={notif.id}
                            onClick={() => {
                              markNotificationAsRead(notif.id);
                              if (userRole === 'lecturer' && notif.courseId) {
                                navigate(`/lecturer/courses?courseId=${notif.courseId}&tab=disputes`);
                              } else if (userRole === 'student' && notif.courseId) {
                                navigate(`/reports?courseId=${notif.courseId}`);
                              } else if (userRole === 'student') {
                                navigate(`/reports`);
                              }
                              setShowNotifDropdown(false);
                            }}
                            style={{ 
                              padding: '14px 20px', 
                              borderBottom: '1px solid #f3f4f6', 
                              background: notif.read ? 'white' : '#f0fdf4',
                              cursor: 'pointer',
                              display: 'flex',
                              gap: 12,
                              transition: 'background 0.2s',
                              position: 'relative'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = notif.read ? '#f9fafb' : '#ecfdf5'}
                            onMouseLeave={e => e.currentTarget.style.background = notif.read ? 'white' : '#f0fdf4'}
                          >
                            {!notif.read && (
                              <div style={{ position: 'absolute', top: 18, left: 8, width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-color)' }} />
                            )}
                            <div style={{ flex: 1, paddingLeft: 4 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', marginBottom: 2 }}>{notif.title}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{notif.message}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>
                                {dateStr} • {timeStr}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <div 
              className="user-profile" 
              onClick={handleProfileClick}
              style={{ cursor: 'pointer' }}
              title="View My Profile"
            >
              <div className="user-info">
                <span className="user-name">{userProfile?.name || currentUser.email}</span>
                <span className="user-role">{userRole || 'User'}</span>
              </div>
              <div className="avatar">
                <img 
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.name || currentUser.email)}&background=${userRole === 'lecturer' ? 'ede9fe&color=7c3aed' : 'ccfbf1&color=0d9488'}`} 
                  alt="User" 
                />
              </div>
            </div>
          </div>
        </header>

        <main className="main-content">
          {children}
        </main>
        <style>{`
          @keyframes dropdownFadeIn {
            from { opacity: 0; transform: translateY(-8px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          .notif-list::-webkit-scrollbar { width: 5px; }
          .notif-list::-webkit-scrollbar-track { background: transparent; }
          .notif-list::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        `}</style>
      </div>
    </div>
  );
};

export default Layout;

