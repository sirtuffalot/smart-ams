import React, { useState, useEffect, useCallback } from 'react';
import { QrCode, MapPin, Clock, X, BookOpen, Users, TrendingUp, Activity, ChevronRight } from 'lucide-react';
import { createSession, endSession, getLecturerSessions, createCourse, getLecturerCourses, getCourseAttendanceRecords, isSessionExpired, isSessionUpcoming } from '../utils/db';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import SessionView from '../components/SessionView';
import ConfirmModal from '../components/ConfirmModal';


const LecturerDashboard = () => {
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [viewingSession, setViewingSession] = useState(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [venue, setVenue] = useState('');
  const [pwd, setPwd] = useState('');
  const [isStrict, setIsStrict] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [totalStudents, setTotalStudents] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState(null);

  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isManagingCourses, setIsManagingCourses] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, sessionId: null });
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [creatingCourse, setCreatingCourse] = useState(false);


  const fetchSessions = useCallback(async () => {
    if (!currentUser) return;
    setLoadingSessions(true);
    try {
      const list = await getLecturerSessions(currentUser.uid);
      setSessions(list);
    } catch (e) { console.error(e); }
    finally { setLoadingSessions(false); }
  }, [currentUser]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    const loadCourses = async () => {
      if (!currentUser) return;
      try {
        const list = await getLecturerCourses(currentUser.uid);
        setCourses(list);

        // Aggregate total unique students and avg attendance across all courses
        let totalUniqueStudents = new Set();
        let ratesSum = 0;
        let ratesCount = 0;

        await Promise.all(list.map(async (course) => {
          try {
            const recs = await getCourseAttendanceRecords(course.id);
            recs.forEach(r => totalUniqueStudents.add(r.studentId));
            const totalSess = course.totalSessions || 0;
            if (totalSess > 0 && recs.length > 0) {
              const uniqueStudentsInCourse = new Set(recs.map(r => r.studentId)).size;
              const rate = Math.round((recs.length / (uniqueStudentsInCourse * totalSess)) * 100);
              ratesSum += Math.min(rate, 100);
              ratesCount++;
            }
          } catch (e) { /* skip */ }
        }));

        setTotalStudents(totalUniqueStudents.size);
        setAvgAttendance(ratesCount > 0 ? Math.round(ratesSum / ratesCount) : null);
      } catch (e) { console.error(e); }
    };
    loadCourses();
  }, [currentUser]);



  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourseCode || !newCourseName) return;
    setCreatingCourse(true);
    try {
      await createCourse(currentUser.uid, newCourseCode, newCourseName);
      setNewCourseCode(''); setNewCourseName('');
      const list = await getLecturerCourses(currentUser.uid);
      setCourses(list);
      setIsManagingCourses(false);
      showToast('Course registered successfully!', 'success');
    } catch (err) {
      showToast('Failed to create course', 'error');
    } finally { setCreatingCourse(false); }
  };

  const handleStartSession = () => {
    const course = courses.find(c => c.id === selectedCourseId);
    if (!selectedCourseId || !venue) { showToast('Please select a course and enter a venue.', 'warning'); return; }
    setLoadingLoc(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude: lat, longitude: lng } = pos.coords;
        const { id: sessionId, qrSecret } = await createSession(
          currentUser.uid, userProfile?.name || currentUser.email,
          course.id, course.courseCode, course.courseName,
          venue, lat, lng, pwd, isStrict, startTime, endTime
        );
        const newSession = {
          id: sessionId, courseId: course.id,
          courseCode: course.courseCode, courseName: course.courseName,
          venue, location: { lat, lng }, pwd, isStrict,
          startTime, endTime, attendanceLocked: false, status: 'active',
          lecturerName: userProfile?.name || currentUser.email,
          qrSecret,
        };
        setSessions(prev => [newSession, ...prev]);
        setViewingSession(newSession);
        setIsSettingUp(false);
        setVenue(''); setPwd(''); setStartTime(''); setEndTime(''); setSelectedCourseId('');
        showToast('Session started!', 'success');
      } catch (err) { console.error(err); showToast('Failed to start session.', 'error'); }
      finally { setLoadingLoc(false); }
    }, () => { setLoadingLoc(false); showToast('Location access denied. Please enable GPS.', 'error'); });
  };

  const handleEndSession = (sessionId) => {
    setConfirmModal({ isOpen: true, sessionId });
  };

  const executeEndSession = async () => {
    const sessionId = confirmModal.sessionId;
    setConfirmModal({ isOpen: false, sessionId: null });
    if (!sessionId) return;
    await endSession(sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (viewingSession?.id === sessionId) setViewingSession(null);
    showToast('Session ended.', 'info');
  };

  const handleSessionUpdate = (updated) => {
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
    setViewingSession(updated);
  };

  if (viewingSession) {
    return (
      <SessionView
        session={viewingSession}
        onLeave={() => { setViewingSession(null); fetchSessions(); }}
        onSessionUpdate={handleSessionUpdate}
        onEnd={async (sessionId) => {
          await endSession(sessionId);
          setSessions(prev => prev.filter(s => s.id !== sessionId));
          setViewingSession(null);
          showToast('Session ended.', 'info');
        }}
      />
    );
  }

  const totalSessions = courses.reduce((a, c) => a + (c.totalSessions || 0), 0);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Welcome greeting */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
          {(() => {
            const hour = new Date().getHours();
            return hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
          })()}, {(() => {
            const name = userProfile?.name?.split(' ')[0] || 'Lecturer';
            return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
          })()}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
          Manage your classes, track active sessions, and resolve disputes.
        </p>
      </div>

      <div className="breadcrumbs">
        <span style={{ color: 'var(--primary-color)', fontWeight: 600, fontSize: 14 }}>Lecturer Overview</span>
      </div>

      {/* ── LIVE HERO BANNER (shown when there's an active session) ── */}
      {sessions.length > 0 && (
        <div 
          onClick={() => setViewingSession(sessions[0])}
          style={{ cursor: 'pointer', marginBottom: 24, borderRadius: 20, background: 'linear-gradient(135deg, #064e3b 0%, #166534 50%, #15803d 100%)', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 12px 36px rgba(22,163,74,0.2)', animation: 'fadeIn 0.3s ease', flexWrap: 'wrap', gap: 16, position: 'relative', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(22,163,74,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(22,163,74,0.2)'; }}
        >
          <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: 250, height: 250, background: 'radial-gradient(circle, rgba(74,222,128,0.2) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(30px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Activity size={24} color="white" />
              <div style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: '#4ade80', border: '2px solid #064e3b', animation: 'pulse 2s infinite' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#86efac', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Active Now</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 19, fontWeight: 800, color: 'white', textTransform: 'capitalize', letterSpacing: '-0.3px' }}>{sessions[0].courseName}</span>
                <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 6, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#f0fdf4', backdropFilter: 'blur(4px)' }}>
                  {sessions[0].courseCode}
                </span>
                <span style={{ opacity: 0.9, fontWeight: 600, fontSize: 14, color: '#dcfce7', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ opacity: 0.5 }}>•</span> {sessions[0].venue}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', position: 'relative', zIndex: 1 }}>
            {sessions.length > 1 && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>+{sessions.length - 1} more</span>}
            <button onClick={() => setViewingSession(sessions[0])} style={{ padding: '10px 22px', background: 'white', color: '#166534', borderRadius: 12, fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.2s, box-shadow 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}>Open Session →</button>
          </div>
        </div>
      )}

      {/* ── STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 16, marginBottom: 28 }}>
        {[
          {
            label: 'My Courses', value: courses.length,
            icon: <BookOpen size={20} />, color: 'var(--primary-color)', onClick: () => navigate('/lecturer/courses')
          },
          {
            label: 'Total Students', value: totalStudents,
            sub: 'Across all courses',
            icon: <Users size={20} />, color: '#0284c7'
          },
          {
            label: 'Avg. Attendance',
            value: avgAttendance !== null ? `${avgAttendance}%` : '—',
            sub: 'Historical across courses',
            icon: <TrendingUp size={20} />,
            color: avgAttendance === null ? 'var(--text-muted)' : avgAttendance >= 75 ? '#16a34a' : avgAttendance >= 50 ? '#d97706' : '#dc2626',
          },
          {
            label: 'Live Now', value: sessions.length,
            icon: <QrCode size={20} />,
            color: sessions.length > 0 ? '#16a34a' : 'var(--text-muted)',
            pulse: sessions.length > 0
          },
        ].map(({ label, value, sub, icon, color, pulse, onClick }) => (
          <div 
            key={label} 
            onClick={onClick} 
            style={{ 
              cursor: onClick ? 'pointer' : 'default', 
              transition: 'transform 0.2s ease, box-shadow 0.2s ease', 
              background: '#ffffff', 
              borderRadius: 14, 
              border: '1px solid #f3f4f6', 
              padding: '18px 20px', 
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.02), 0 1px 3px rgba(0, 0, 0, 0.01)',
              position: 'relative',
              overflow: 'hidden'
            }}
            className={onClick ? "clickable-card" : ""}
          >
            {/* Left accent bar */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: color }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>{value}</div>
                <div style={{ fontSize: 11, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 6 }}>{label}</div>
              </div>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                {icon}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
              {pulse && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, animation: 'pulse 2s infinite' }} />}
              <span>{sub || (pulse ? 'Active session running' : 'System ready')}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── TWO-COLUMN LAYOUT ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Quick Actions */}
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid var(--border-color)', padding: '14px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginRight: 6, letterSpacing: '0.2px' }}>Quick Actions</span>
            <button
              onClick={() => setIsSettingUp(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', color: 'white', border: 'none', borderRadius: 50, fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.1px', boxShadow: '0 4px 14px rgba(124,58,237,0.3)', transition: 'all 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,58,237,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(124,58,237,0.3)'; }}
            >
              <QrCode size={15} strokeWidth={2.5} /> Start Session
            </button>
            <button
              onClick={() => setIsManagingCourses(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: 'transparent', color: 'var(--primary-color)', border: '1.5px solid rgba(124,58,237,0.35)', borderRadius: 50, fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.1px', transition: 'all 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.borderColor = 'var(--primary-color)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <BookOpen size={15} strokeWidth={2.5} /> Register Course
            </button>
          </div>

          {/* Create Session Form */}
          {isSettingUp && (
            <div style={{ background: 'white', padding: 24, borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', animation: 'fadeIn 0.2s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 3 }}>New Attendance Session</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>GPS location captured automatically on confirm.</p>
                </div>
                <button onClick={() => setIsSettingUp(false)} style={{ background: 'var(--bg-page)', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8 }}>
                  <X size={18} color="var(--text-muted)" />
                </button>
              </div>
              {courses.length === 0 && (
                <div style={{ marginBottom: 16, fontSize: 13, color: '#b45309', background: '#fef3c7', padding: '10px 14px', borderRadius: 8, border: '1px solid #fde68a' }}>
                  ⚠️ Register a course first before starting a session.
                </div>
              )}
              <div className="form-group row">
                <div className="col">
                  <label>Select Course</label>
                  <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }}>
                    <option value="">— Choose a course —</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.courseCode} – {c.courseName}</option>)}
                  </select>
                </div>
                <div className="col"><label>Venue</label><input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. H107" /></div>
              </div>
              <div className="form-group row">
                <div className="col">
                  <label>Start Time</label>
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={e => setStartTime(e.target.value)} 
                    onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <div className="col">
                  <label>End Time</label>
                  <input 
                    type="time" 
                    value={endTime} 
                    onChange={e => setEndTime(e.target.value)} 
                    onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Backup Password <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                <input type="text" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Students use this if GPS fails" />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', marginBottom: 20 }}>
                <input type="checkbox" checked={isStrict} onChange={e => setIsStrict(e.target.checked)} />
                Strict Mode — require both GPS and password
              </label>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={loadingLoc || courses.length === 0} onClick={handleStartSession}>
                {loadingLoc ? '📍 Fetching Location...' : 'Confirm & Start Session'}
              </button>
            </div>
          )}

          {/* Live Sessions Panel */}
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Live Sessions</h3>
                {sessions.length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '2px 9px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                    {sessions.length} active
                  </span>
                )}
              </div>
              <button 
                onClick={fetchSessions} 
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 50, transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 6 }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
              >
                ↻ Refresh
              </button>
            </div>

            {loadingSessions ? (
              <div style={{ padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{ height: 76, borderRadius: 10, background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ebee 50%,#f3f4f6 75%)', backgroundSize: '400% 100%', animation: 'skeleton-shimmer 1.4s ease infinite' }} />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--primary-color)' }}>
                  <QrCode size={26} />
                </div>
                <h4 style={{ fontWeight: 700, marginBottom: 6 }}>No active sessions</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Start a session to begin taking attendance in real time.</p>
                <button 
                  onClick={() => setIsSettingUp(true)} 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', color: 'white', border: 'none', borderRadius: 50, fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.1px', boxShadow: '0 4px 14px rgba(124,58,237,0.3)', transition: 'all 0.2s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,58,237,0.4)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(124,58,237,0.3)'; }}
                >
                  <QrCode size={15} strokeWidth={2.5} /> Start Session
                </button>
              </div>
            ) : (
              <div>
                {sessions.map((s, i) => (
                  <div
                    key={s.id}
                    onClick={() => setViewingSession(s)}
                    style={{ padding: '20px', borderBottom: i < sessions.length - 1 ? '1px solid var(--border-color)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', background: 'white' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
                  >
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 12, background: s.attendanceLocked ? '#fef2f2' : isSessionUpcoming(s) ? '#fffbeb' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${s.attendanceLocked ? '#fee2e2' : isSessionUpcoming(s) ? '#fde68a' : '#dcfce7'}` }}>
                        <QrCode size={20} color={s.attendanceLocked ? '#dc2626' : isSessionUpcoming(s) ? '#d97706' : '#16a34a'} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.3px' }}>{s.courseName}</span>
                          <span style={{ fontSize: 10, background: 'var(--primary-light)', color: 'var(--primary-color)', padding: '3px 8px', borderRadius: 8, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{s.courseCode}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} color="#94a3b8" /> {s.venue}</span>
                          {s.startTime && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} color="#94a3b8" /> {s.startTime}–{s.endTime}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', background: s.attendanceLocked ? '#fef2f2' : isSessionUpcoming(s) ? '#fffbeb' : '#ecfdf5', color: s.attendanceLocked ? '#991b1b' : isSessionUpcoming(s) ? '#b45309' : '#059669', border: `1px solid ${s.attendanceLocked ? '#fecaca' : isSessionUpcoming(s) ? '#fde68a' : '#a7f3d0'}` }}>
                        {isSessionUpcoming(s) ? (
                          <>Upcoming</>
                        ) : (
                          <>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.attendanceLocked ? '#dc2626' : '#10b981', animation: s.attendanceLocked ? 'none' : 'pulse 2s infinite' }} />
                            {s.attendanceLocked ? 'Paused' : 'Live'}
                          </>
                        )}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 16px', background: 'var(--primary-light)', color: 'var(--primary-color)', borderRadius: 10, fontSize: 13, fontWeight: 700, transition: 'all 0.2s', border: '1px solid transparent' }}>
                        View <ChevronRight size={14} />
                      </span>
                      <button 
                        onClick={e => { e.stopPropagation(); handleEndSession(s.id); }} 
                        style={{ background: 'white', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 10, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.05)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        End
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* My Courses */}
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid var(--border-color)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>My Courses</h3>
              <button 
                onClick={() => setIsManagingCourses(true)} 
                style={{ background: 'var(--primary-light)', border: 'none', color: 'var(--primary-color)', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease', padding: 0 }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.background = 'var(--primary-color)'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary-color)'; }}
                title="Add Course"
              >
                <BookOpen size={14} strokeWidth={2.5} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {courses.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-page)', borderRadius: 12 }}>No courses registered yet.</div>
              ) : courses.map((c, i) => (
                <div 
                  key={c.id} 
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-page)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.querySelector('.chevron-icon').style.opacity = '1'; e.currentTarget.querySelector('.chevron-icon').style.transform = 'translateX(0)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.querySelector('.chevron-icon').style.opacity = '0'; e.currentTarget.querySelector('.chevron-icon').style.transform = 'translateX(-5px)'; }}
                  onClick={() => navigate(`/lecturer/courses?courseId=${c.id}`, { state: { initialCourse: c } })}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', fontWeight: 800, fontSize: 11, flexShrink: 0, border: '1px solid rgba(124,58,237,0.1)' }}>
                    {(c.courseCode || '').slice(0, 3).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>{(c.courseCode || '').toUpperCase()}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{c.courseName}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-page)', padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border-color)', letterSpacing: '0.2px' }}>
                      {c.totalSessions || 0} Session{(c.totalSessions || 0) !== 1 && 's'}
                    </span>
                    <div className="chevron-icon" style={{ opacity: 0, transform: 'translateX(-5px)', transition: 'all 0.2s ease', color: 'var(--primary-color)' }}>
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>



          {/* Pro Tip */}
          <div style={{ background: 'linear-gradient(135deg, var(--primary-light) 0%, white 100%)', borderRadius: 14, border: '1px solid var(--border-color)', padding: '18px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-color)', marginBottom: 6 }}>💡 Pro Tip</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
              Use <strong>Strict Mode</strong> to require GPS + password — great for large halls where students might scan remotely.
            </p>
          </div>
        </div>
      </div>

      {/* Course Registry Modal */}
      {isManagingCourses && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: 32, borderRadius: 20, maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'fadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Course Registry</h2>
              <button onClick={() => setIsManagingCourses(false)} style={{ background: 'var(--bg-page)', border: 'none', cursor: 'pointer', padding: 7, borderRadius: 8 }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateCourse} style={{ marginBottom: 24, padding: 18, background: 'var(--bg-page)', borderRadius: 14, border: '1px solid var(--border-color)' }}>
              <h4 style={{ marginBottom: 14, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Register New Course</h4>
              <div className="form-group"><label>Course Code</label><input type="text" placeholder="e.g. CSC 224" value={newCourseCode} onChange={e => setNewCourseCode(e.target.value)} required /></div>
              <div className="form-group"><label>Course Name</label><input type="text" placeholder="e.g. Data Structures" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} required /></div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={creatingCourse}>{creatingCourse ? 'Registering...' : 'Register Course'}</button>
            </form>
            <h4 style={{ marginBottom: 12, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>Existing Courses</h4>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {courses.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No courses registered yet.</p>
              ) : courses.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: 'var(--bg-page)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{c.courseCode}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.courseName}</div>
                  </div>
                  <div style={{ fontSize: 11, background: 'var(--primary-light)', color: 'var(--primary-color)', padding: '3px 9px', borderRadius: 12, fontWeight: 600 }}>{c.totalSessions} sessions</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        @keyframes skeleton-shimmer { 0%{background-position:100% 50%;} 100%{background-position:0% 50%;} }
      `}</style>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="End Session?"
        message="Are you sure you want to end this session? Students will no longer be able to mark attendance."
        confirmText="End Session"
        cancelText="Keep Open"
        onConfirm={executeEndSession}
        onCancel={() => setConfirmModal({ isOpen: false, sessionId: null })}
        isDanger={true}
      />
    </div>
  );
};

export default LecturerDashboard;