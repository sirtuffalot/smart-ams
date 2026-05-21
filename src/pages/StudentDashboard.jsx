import React, { useEffect, useState, useRef } from 'react';
import { QrCode, MapPin, CheckCircle, XCircle, AlertCircle, ArrowLeft, Clock, X, UserCircle, User, BookOpen, CalendarCheck, TrendingUp, GraduationCap, Percent, Award, Flame } from 'lucide-react';
import { checkLocation } from '../utils/geolocation';
import { Html5Qrcode } from 'html5-qrcode';
import { getActiveSessions, markAttendance, getSession, getStudentAttendedSessionIds, getStudentAttendanceStats, isSessionExpired, isSessionUpcoming } from '../utils/db';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

const StudentDashboard = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [sessions, setSessions] = useState([]);
  const [attendedIds, setAttendedIds] = useState(new Set());
  const [stats, setStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendanceConfirmed, setAttendanceConfirmed] = useState(null);
  const [qrValidated, setQrValidated] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [bannerLeaving, setBannerLeaving] = useState(false);
  
  const profileIncomplete = userProfile && (
    !userProfile.matricNumber || !userProfile.courseOfStudy || !userProfile.college || !userProfile.level
  );

  const handleDismissBanner = () => {
    setBannerLeaving(true);
    setTimeout(() => setBannerDismissed(true), 400);
  };
  
  const [gpsStatus, setGpsStatus] = useState({ state: 'pending', message: 'Waiting...' });
  const [locationValid, setLocationValid] = useState(false);
  const [showFailsafe, setShowFailsafe] = useState(false);
  const [password, setPassword] = useState('');
  const [permStatus, setPermStatus] = useState({ cam: 'unknown', loc: 'unknown' });
  const scannerRef = useRef(null);
  const isProcessingScan = useRef(false);
  
  const handleTestGPS = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    showToast('Testing GPS permissions...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => showToast('GPS is active and permissions are granted.', 'success'),
      (err) => showToast(`GPS Error: ${err.message}`, 'error'),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    const primePermissions = async () => {
      const primed = localStorage.getItem('permissions_primed');
      if (!primed) {
        try {
          // Request Camera (Camera usually allows priming because we use mediaDevices)
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
          }
          localStorage.setItem('permissions_primed', 'true');
        } catch (e) {
          console.log('Permission priming skipped or denied', e);
          localStorage.setItem('permissions_primed', 'true');
        }
      }
    };
    primePermissions();
  }, []);

  // Check permission status on mount and keep live
  useEffect(() => {
    const checkPerms = async () => {
      if (!navigator.permissions) return;
      try {
        const cam = await navigator.permissions.query({ name: 'camera' });
        const loc = await navigator.permissions.query({ name: 'geolocation' });
        setPermStatus({ cam: cam.state, loc: loc.state });
        cam.onchange = () => setPermStatus(p => ({ ...p, cam: cam.state }));
        loc.onchange = () => setPermStatus(p => ({ ...p, loc: loc.state }));
      } catch {}
    };
    checkPerms();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [active, ids, attStats] = await Promise.all([
          getActiveSessions(),
          getStudentAttendedSessionIds(currentUser.uid),
          getStudentAttendanceStats(currentUser.uid)
        ]);
        setSessions(active);
        setAttendedIds(ids);
        setStats(attStats);
      } catch (err) {
        console.error('Failed to load sessions', err);
      } finally {
        setStatsLoading(false);
      }
    };
    if (currentUser) loadData();
  }, [currentUser]);

  useEffect(() => {
    const checkExpiration = () => {
      if (selectedSession && isSessionExpired(selectedSession)) {
        showToast('This session has reached its scheduled end time and is now closed.', 'warning');
        setSelectedSession(null);
        return;
      }

      if (sessions.length === 0) return;
      
      let changed = false;
      const filtered = sessions.filter(s => {
        const expired = isSessionExpired(s);
        if (expired) changed = true;
        return !expired;
      });
      if (changed) {
        setSessions(filtered);
      }
    };
    
    checkExpiration();
    const interval = setInterval(checkExpiration, 5000);
    return () => clearInterval(interval);
  }, [sessions, selectedSession, showToast]);

  useEffect(() => {
    if (!selectedSession) return;

    setGpsStatus({ state: 'pending', message: 'Checking Location...' });

    const verifyLocation = async () => {
      try {
        const result = await checkLocation(selectedSession.location.lat, selectedSession.location.lng, 50000);
        if (result.isWithinRange) {
          setGpsStatus({ state: 'success', message: 'Location Verified' });
          setLocationValid(true);
          if (selectedSession.isStrict) setShowFailsafe(true);
        } else {
          throw new Error(`Too far (${Math.round(result.distance)}m away)`);
        }
      } catch (error) {
        setGpsStatus({ state: 'error', message: `Location Failed: ${error.message || error}` });
        setLocationValid(false);
        setShowFailsafe(true);
      }
    };

    verifyLocation();

    // Init Scanner
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(
        "reader",
        { formatsToSupport: [ 0 ] } // 0 = QR_CODE
      );

      const prefCamera = localStorage.getItem('pref_camera') 
        ? JSON.parse(localStorage.getItem('pref_camera')) 
        : undefined;

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      const startScanner = async () => {
        try {
          if (prefCamera) {
            await scannerRef.current.start({ deviceId: { exact: prefCamera } }, config, onScanSuccess, onScanFailure);
          } else {
            await scannerRef.current.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure);
          }
        } catch (err) {
          console.warn("Camera start failed, falling back", err);
          try {
            await scannerRef.current.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure);
          } catch (e) {
            console.error(e);
            showToast('Failed to start camera. Please check permissions.', 'error');
            setShowFailsafe(true);
          }
        }
      };
      
      startScanner();
    }

    return () => {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().then(() => {
            scannerRef.current.clear();
            scannerRef.current = null;
          }).catch(console.error);
        } else {
          scannerRef.current.clear();
          scannerRef.current = null;
        }
      }
    };
  }, [selectedSession]);

  const onScanSuccess = async (decodedText) => {
    if (isProcessingScan.current) return;
    isProcessingScan.current = true;
    
    const resumeScanning = (delay = 2000) => {
      setTimeout(() => { isProcessingScan.current = false; }, delay);
    };

    if (!selectedSession) {
      resumeScanning(500);
      return;
    }
    let data;
    try {
      data = JSON.parse(decodedText);
      if (data.sId !== selectedSession.id) {
        showToast('Invalid QR code for this session.', 'error');
        resumeScanning();
        return;
      }
    } catch(e) {
      showToast('Invalid QR format.', 'error');
      resumeScanning();
      return;
    }

    const liveSession = await getSession(selectedSession.id);
    if (!liveSession || liveSession.status !== 'active') {
      showToast('This session has already ended.', 'warning');
      setSelectedSession(null);
      isProcessingScan.current = false;
      return;
    }
    if (isSessionUpcoming(liveSession)) {
      showToast(`This session has not started yet. Scheduled start time is ${liveSession.startTime}.`, 'warning');
      setSelectedSession(null);
      isProcessingScan.current = false;
      return;
    }
    if (liveSession.attendanceLocked) {
      showToast('Attendance is currently paused by the lecturer.', 'warning');
      resumeScanning();
      return;
    }

    // Cryptographic Dynamic QR Verification
    if (data.ts && data.sig) {
      const now = Date.now();
      const age = now - data.ts;
      
      if (age > 90000 || age < -30000) {
        showToast('QR Code Expired. Please scan the live code on the screen.', 'error');
        resumeScanning();
        return;
      }
      
      const secret = liveSession.qrSecret || 'legacy-secret';
      const msg = `${data.sId}|${data.ts}|${secret}`;
      const encoder = new TextEncoder();
      const msgData = encoder.encode(msg);
      
      try {
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgData);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const expectedSig = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        
        if (expectedSig !== data.sig) {
          showToast('Security Alert: QR Code Tampering Detected.', 'error');
          resumeScanning();
          return;
        }
      } catch (err) {
        console.error('Crypto error:', err);
      }
    }

    // If strict mode is on, or location was invalid, we require the backup password.
    if (selectedSession.isStrict || !locationValid) {
      showToast('QR Validated! Please enter the backup password to complete attendance.', 'success');
      if (scannerRef.current && scannerRef.current.isScanning) {
        try { scannerRef.current.pause(true); } catch (e) { /* ignore */ }
      }
      setQrValidated(true); 
    } else {
      markAttendanceComplete();
    }
  };

  const onScanFailure = (error) => { /* ignore */ };

  const handlePasswordSubmit = () => {
    if (!password) {
      showToast('Please enter the backup password.', 'warning');
      return;
    }
    
    if (password === selectedSession.pwd) {
      // If strict mode is ON, they MUST scan the QR code first
      if (selectedSession.isStrict && !qrValidated) {
        showToast('Strict Mode is active: You must scan the QR code FIRST before entering the password.', 'error');
        return;
      }
      
      // If strict mode is OFF, entering the password is fundamentally enough
      // OR if they already scanned the QR code (qrValidated is true), they can proceed
      markAttendanceComplete();
    } else {
      showToast('Incorrect backup password. Try again.', 'error');
    }
  };

  const markAttendanceComplete = async () => {
    try {
      const liveSession = await getSession(selectedSession.id);
      if (!liveSession || liveSession.status !== 'active') {
        showToast('This session has already ended.', 'warning');
        setSelectedSession(null);
        return;
      }
      if (isSessionUpcoming(liveSession)) {
        showToast(`This session has not started yet. Scheduled start time is ${liveSession.startTime}.`, 'warning');
        setSelectedSession(null);
        return;
      }

      await markAttendance(
        selectedSession.id,
        currentUser.uid,
        { verified: locationValid },
        userProfile?.name || currentUser.email,
        userProfile?.matricNumber || '',
        selectedSession.courseId || null,
        userProfile?.courseOfStudy || ''
      );

      const confirmedSession = { ...selectedSession };

      setGpsStatus({ state: 'success', message: 'Attendance Marked' });
      setShowFailsafe(false);

      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }

      // Mark this session as attended locally so card updates immediately
      setAttendedIds(prev => new Set([...prev, confirmedSession.id]));
      setSelectedSession(null);
      setAttendanceConfirmed(confirmedSession); // Show confirmation screen
    } catch (err) {
      console.error(err);
      showToast('Failed to mark attendance. Please try again.', 'error');
      isProcessingScan.current = false;
    }
  };

  const getStatusIcon = () => {
    if (gpsStatus.state === 'success') return <CheckCircle size={16} />;
    if (gpsStatus.state === 'error') return <XCircle size={16} />;
    if (gpsStatus.state === 'pending') return <MapPin size={16} />;
    return <AlertCircle size={16} />;
  };

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateString = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // ── CONFIRMATION SCREEN ───────────────────────────────────────────────────
  if (attendanceConfirmed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', animation: 'fadeIn 0.5s ease' }}>
        <div style={{ background: 'white', padding: '48px 40px', borderRadius: '24px', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)', textAlign: 'center', animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
          {/* Animated checkmark */}
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
            animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <CheckCircle size={48} color="white" />
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'var(--text-main)' }}>
            Attendance Marked!
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '15px' }}>
            Your attendance has been recorded successfully.
          </p>

          {/* Session details summary */}
          <div style={{
            background: '#f8faff', border: '1px solid var(--border-color)',
            borderRadius: '16px', padding: '24px', marginBottom: '32px', textAlign: 'left'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={18} color="var(--primary-color)" />
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Course</div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{attendanceConfirmed.courseName}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={18} color="var(--primary-color)" />
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Venue</div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{attendanceConfirmed.venue}</div>
                </div>
              </div>

              {attendanceConfirmed.lecturerName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={18} color="var(--primary-color)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lecturer</div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{attendanceConfirmed.lecturerName}</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarCheck size={18} color="var(--primary-color)" />
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recorded At</div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{timeString} &nbsp;·&nbsp; <span style={{ fontWeight: 400, fontSize: '13px', color: 'var(--text-muted)' }}>{dateString}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Student badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: '#d1fae5', color: '#065f46', borderRadius: '20px',
            padding: '8px 18px', fontSize: '13px', fontWeight: 600, marginBottom: '32px'
          }}>
            <CheckCircle size={14} />
            {userProfile?.name || currentUser.email} 
            {userProfile?.matricNumber && <span style={{ opacity: 0.7 }}>— {userProfile.matricNumber}</span>}
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px', fontSize: '16px' }}
            onClick={() => setAttendanceConfirmed(null)}
          >
            Back to Classes
          </button>
        </div>

        <style>{`
          @keyframes popIn {
            from { transform: scale(0.5); opacity: 0; }
            to   { transform: scale(1);   opacity: 1; }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes emptyStatePulse {
            0% { transform: scale(0.95); opacity: 0.6; }
            50% { transform: scale(1.2); opacity: 0.15; }
            100% { transform: scale(0.95); opacity: 0.6; }
          }
        `}</style>
      </div>
    );
  }

  // ── SESSION LIST ─────────────────────────────────────────────────────────
  if (!selectedSession) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        {/* Welcome greeting */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
            {(() => {
              const hour = new Date().getHours();
              return hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
            })()}, {(() => {
              const name = userProfile?.name?.split(' ')[0] || 'Student';
              return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
            })()}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            Here's what's happening with your courses today.
          </p>
        </div>

        <div className="breadcrumbs">
          <span style={{ color: 'var(--primary-color)', fontWeight: 600, fontSize: 14 }}>My Overview</span>
        </div>

        {/* Profile incomplete banner */}
        {profileIncomplete && !bannerDismissed && (
          <div 
            className="profile-banner"
            style={{
              animation: bannerLeaving 
                ? 'bannerSlideOut 0.4s ease forwards' 
                : 'bannerSlideIn 0.4s ease'
            }}
          >
            <UserCircle size={20} style={{ flexShrink: 0, color: '#92400e' }} />
            <div style={{ flex: 1 }}>
              <strong>Complete your profile</strong> — your matric number and course details are missing. 
              <span 
                onClick={() => navigate('/profile')} 
                style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 600, marginLeft: 4, textDecoration: 'underline' }}
              >
                Update now
              </span>
            </div>
            <button 
              onClick={handleDismissBanner}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Permission warning banner */}
        {(permStatus.cam !== 'granted' || permStatus.loc !== 'granted') && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16,
            background: 'linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)',
            border: '1px solid #fed7aa', borderRadius: 14, padding: '14px 18px',
            boxShadow: '0 4px 16px rgba(251,146,60,0.12)', animation: 'bannerSlideIn 0.4s ease',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11, background: '#fef3c7',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              border: '1px solid #fde68a',
            }}>
              <AlertCircle size={18} color="#d97706" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#92400e', marginBottom: 2 }}>
                Beacon needs permission to work properly
              </div>
              <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>
                {permStatus.cam !== 'granted' && <span>📷 Camera </span>}
                {permStatus.cam !== 'granted' && permStatus.loc !== 'granted' && <span>and </span>}
                {permStatus.loc !== 'granted' && <span>📍 Location </span>}
                access is required to scan QR codes and verify your attendance.
              </div>
            </div>
            <button
              onClick={() => navigate('/settings')}
              style={{
                flexShrink: 0, padding: '8px 16px', borderRadius: 9,
                background: '#d97706', color: 'white', border: 'none',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 3px 8px rgba(217,119,6,0.3)', transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#b45309'}
              onMouseLeave={e => e.currentTarget.style.background = '#d97706'}
            >
              Fix in Settings →
            </button>
          </div>
        )}

        {/* ── STAT CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
          {statsLoading ? (
            [1,2,3,4].map(i => (
              <div key={i} style={{ height: 88, borderRadius: 14, background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ebee 50%,#f3f4f6 75%)', backgroundSize: '400% 100%', animation: 'skeleton-shimmer 1.4s ease infinite' }} />
            ))
          ) : (() => {
            const totalAttended = stats.reduce((a, s) => a + (s.attendedCount || 0), 0);
            const totalPossible = stats.reduce((a, s) => a + (s.totalSessions || 0), 0);
            const avgPct = totalPossible > 0 ? Math.round((totalAttended / totalPossible) * 100) : 0;
            const missedSessions = totalPossible > totalAttended ? totalPossible - totalAttended : 0;
            return [
              { label: 'Attendance Rate', value: `${avgPct}%`, sub: avgPct >= 75 ? 'On track' : 'Needs attention', color: avgPct >= 75 ? '#16a34a' : '#dc2626', icon: <TrendingUp size={20} />, onClick: () => navigate('/reports') },
              { label: 'Missed Classes', value: missedSessions, sub: `of ${totalPossible} total sessions`, color: missedSessions > 0 ? '#dc2626' : '#0d9488', icon: <XCircle size={20} /> },
              { label: 'Active Classes', value: sessions.length, sub: sessions.length > 0 ? 'Available now' : 'Check back later', color: sessions.length > 0 ? '#7c3aed' : 'var(--text-muted)', icon: <BookOpen size={20} />, pulse: sessions.length > 0 },
              { label: 'Current Streak', value: totalAttended > 0 ? Math.max(1, totalAttended - missedSessions) : 0, sub: 'Classes attended in a row', color: '#f59e0b', icon: <Flame size={20} color="#f59e0b" fill="#f59e0b" /> },
            ].map(({ label, value, sub, color, icon, pulse, onClick }) => (
              <div 
                key={label} 
                onClick={onClick}
                style={{ 
                  background: '#ffffff', borderRadius: 14, border: '1px solid #f3f4f6', 
                  padding: '18px 20px', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.02), 0 1px 3px rgba(0, 0, 0, 0.01)',
                  cursor: onClick ? 'pointer' : 'default',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                className={onClick ? "clickable-card" : ""}
              >
                {/* Left accent bar */}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: color }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>{value}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 6 }}>{label}</div>
                  </div>
                  <div style={{ fontSize: 18, width: 34, height: 34, borderRadius: '50%', background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                  {pulse && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, animation: 'pulse 2s infinite' }} />}
                  <span>{sub}</span>
                </div>
              </div>
            ));
          })()}
        </div>

        {/* ── Sleek Premium Membership Pass Widget ── */}
        <div style={{ 
          background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #0f172a 100%)',
          borderRadius: 16, 
          border: '1px solid rgba(255,255,255,0.08)', 
          padding: '20px 24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 28, 
          gap: 16, 
          flexWrap: 'wrap',
          boxShadow: '0 12px 24px rgba(30, 27, 75, 0.2)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle glow sphere */}
          <div style={{ position: 'absolute', right: '-10%', top: '-20%', width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, zIndex: 1 }}>
            <div style={{ 
              width: 48, height: 48, borderRadius: '50%', 
              background: 'rgba(255,255,255,0.08)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.15)'
            }}>
              <UserCircle size={28} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
                {userProfile?.name || currentUser.email}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>Matric: <strong style={{ color: '#ffffff' }}>{userProfile?.matricNumber || 'N/A'}</strong></span>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
                <span>{userProfile?.courseOfStudy ? (userProfile.courseOfStudy.match(/\(([^)]+)\)/)?.[1] || userProfile.courseOfStudy) : 'Course not set'}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, zIndex: 1 }}>
            <button 
              onClick={handleTestGPS} 
              style={{ 
                background: 'rgba(255,255,255,0.06)', 
                border: '1px solid rgba(255,255,255,0.12)', 
                color: 'white', 
                fontSize: 12, 
                fontWeight: 600, 
                cursor: 'pointer', 
                padding: '8px 16px', 
                borderRadius: 9, 
                whiteSpace: 'nowrap', 
                flexShrink: 0,
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            >
              Test GPS
            </button>
            <button 
              onClick={() => navigate('/profile')} 
              style={{ 
                background: '#ffffff', 
                border: 'none', 
                color: '#1e1b4b', 
                fontSize: 12, 
                fontWeight: 700, 
                cursor: 'pointer', 
                padding: '8px 18px', 
                borderRadius: 9, 
                whiteSpace: 'nowrap', 
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(255,255,255,0.15)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              Edit Profile →
            </button>
          </div>
        </div>

        {/* ── Live Classes header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px', margin: 0 }}>Live Classes</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '3px 0 0', fontWeight: 500 }}>Tap a card to mark your attendance</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: sessions.length > 0 ? '#ecfdf5' : '#f3f4f6', border: `1px solid ${sessions.length > 0 ? '#a7f3d0' : '#e5e7eb'}`, color: sessions.length > 0 ? '#065f46' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: sessions.length > 0 ? '#10b981' : '#d1d5db', animation: sessions.length > 0 ? 'pulse 2s infinite' : 'none' }} />
            {sessions.length > 0 ? `${sessions.length} Active` : 'No active sessions'}
          </div>
        </div>

        <div style={{ marginTop: '8px' }}>
          {sessions.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: 20, padding: '56px 40px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', border: '1px solid #a7f3d0' }}>
                <QrCode size={28} color="#10b981" />
              </div>
              <h3 style={{ color: 'var(--text-main)', marginBottom: 8, fontSize: 18, fontWeight: 800 }}>No active classes right now</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>Your lecturer hasn't started a session yet. Sessions will appear here automatically.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {sessions.map(s => {
                const attended = attendedIds.has(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => !attended && setSelectedSession(s)}
                    style={{
                      position: 'relative', cursor: attended ? 'default' : 'pointer',
                      background: 'white', borderRadius: 20,
                      border: `1px solid ${attended ? '#d1fae5' : 'rgba(20,184,166,0.2)'}`,
                      boxShadow: attended ? '0 2px 8px rgba(0,0,0,0.04)' : '0 4px 20px rgba(20,184,166,0.08)',
                      overflow: 'hidden',
                      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={e => { if (!attended) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(20,184,166,0.18)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = attended ? '0 2px 8px rgba(0,0,0,0.04)' : '0 4px 20px rgba(20,184,166,0.08)'; }}
                  >
                    {/* Top gradient bar */}
                    <div style={{ height: 5, background: attended ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #14b8a6, #0d9488)' }} />

                    <div style={{ padding: '22px 24px 24px' }}>
                      {/* Header row: course name + status badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: attended ? '#6b7280' : isSessionUpcoming(s) ? '#b45309' : '#0d9488', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>
                            {s.courseCode || 'CLASS'}
                          </div>
                          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: attended ? '#9ca3af' : 'var(--text-main)', lineHeight: 1.3, letterSpacing: '-0.2px', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.courseName}
                          </h3>
                        </div>
                        {attended ? (
                          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, background: '#ecfdf5', color: '#065f46', padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>
                            <CheckCircle size={12} /> Attended
                          </span>
                        ) : isSessionUpcoming(s) ? (
                          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fffbeb', color: '#b45309', padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>
                            Upcoming
                          </span>
                        ) : (
                          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ecfdf5', color: '#059669', padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                            Live
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
                        {s.lecturerName && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: attended ? '#f9fafb' : '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${attended ? '#f3f4f6' : '#ccfbf1'}` }}>
                              <User size={15} color={attended ? '#9ca3af' : '#14b8a6'} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: attended ? '#9ca3af' : '#374151' }}>{s.lecturerName}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: attended ? '#f9fafb' : '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${attended ? '#f3f4f6' : '#ccfbf1'}` }}>
                            <MapPin size={15} color={attended ? '#9ca3af' : '#14b8a6'} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: attended ? '#9ca3af' : '#374151' }}>{s.venue}</span>
                        </div>
                        {s.startTime && s.endTime && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: attended ? '#f9fafb' : '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${attended ? '#f3f4f6' : '#ccfbf1'}` }}>
                              <Clock size={15} color={attended ? '#9ca3af' : '#14b8a6'} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: attended ? '#9ca3af' : '#374151' }}>{s.startTime} – {s.endTime}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer CTA */}
                      {attended ? (
                        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>Attendance Recorded</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ height: 6, width: 60, background: '#bbf7d0', borderRadius: 4 }}>
                              <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: 4 }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>100%</span>
                          </div>
                        </div>
                      ) : isSessionUpcoming(s) ? (
                        <button
                          disabled
                          style={{
                            width: '100%', padding: '13px', border: 'none', borderRadius: 12,
                            background: '#f3f4f6',
                            color: '#9ca3af', fontSize: 14, fontWeight: 800,
                            cursor: 'not-allowed', letterSpacing: '-0.1px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                          }}
                        >
                          <Clock size={16} /> Starts at {s.startTime}
                        </button>
                      ) : (
                        <button
                          style={{
                            width: '100%', padding: '13px', border: 'none', borderRadius: 12,
                            background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                            color: 'white', fontSize: 14, fontWeight: 800,
                            cursor: 'pointer', letterSpacing: '-0.1px',
                            boxShadow: '0 4px 16px rgba(20,184,166,0.3)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                          }}
                          onClick={() => setSelectedSession(s)}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(20,184,166,0.4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(20,184,166,0.3)'; }}
                        >
                          <QrCode size={16} /> Mark My Attendance
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
          @keyframes skeleton-shimmer { 0%{background-position:100% 50%;} 100%{background-position:0% 50%;} }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes bannerSlideIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes bannerSlideOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-12px); } }
        `}</style>
      </div>
    );
  }

  // ── SCANNER VIEW ─────────────────────────────────────────────────────────
  return (
    <div>
      <div className="breadcrumbs" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setSelectedSession(null)}>
        <ArrowLeft size={16} />
        <span>Back to Classes</span>
      </div>

      <div style={{
        background: '#f8fafc',
        padding: '20px', 
        borderRadius: '24px', 
        border: '1px solid rgba(0,0,0,0.04)', 
        marginBottom: '24px',
        display: 'flex', 
        gap: '16px', 
        alignItems: 'center',
        boxShadow: '0 8px 30px rgba(0,0,0,0.02)'
      }}>
        <div style={{ 
          width: 64, 
          height: 64, 
          borderRadius: '16px', 
          background: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flexShrink: 0,
          border: '1px solid #99f6e4',
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)'
        }}>
          <QrCode size={30} color="#0d9488" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.8px', background: '#f0fdfa', padding: '4px 10px', borderRadius: '8px', border: '1px solid #ccfbf1' }}>
              {selectedSession.courseCode || 'CLASS'}
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 10px 0', color: 'var(--text-main)', letterSpacing: '-0.5px', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedSession.courseName}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, alignItems: 'center' }}>
            {selectedSession.lecturerName && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <User size={14} color="#9ca3af" /> {selectedSession.lecturerName}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <MapPin size={14} color="#9ca3af" /> {selectedSession.venue}
            </span>
            {selectedSession.startTime && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={14} color="#9ca3af" /> {selectedSession.startTime} – {selectedSession.endTime}
              </span>
            )}
          </div>
          <div style={{ marginTop: '16px' }}>
            <span className={`status-badge ${gpsStatus.state}`}>
              {getStatusIcon()} {gpsStatus.message}
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* Scanner Card */}
        <div style={{ 
          flex: '1 1 340px', 
          background: 'white', 
          padding: '24px', 
          borderRadius: '32px', 
          boxShadow: '0 20px 40px rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.03)',
          display: 'flex', 
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>Scan QR Code</h3>
            {isProcessingScan.current && <span style={{ fontSize: '13px', fontWeight: 600, color: '#14b8a6', background: '#f0fdfa', padding: '4px 10px', borderRadius: '12px' }}>Processing...</span>}
          </div>
          
          <div style={{
            position: 'relative', width: '100%', maxWidth: '100%', margin: '0 auto',
            borderRadius: '28px', overflow: 'hidden', backgroundColor: '#f3f4f6',
            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.05)',
            aspectRatio: '1 / 1'
          }}>
            {/* The actual video feed */}
            <div id="reader" style={{ width: '100%', height: '100%' }}></div>
            
            {/* Apple-like Glassmorphic Overlay */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              pointerEvents: 'none',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              background: 'rgba(0,0,0,0.2)', // Very light dim
              backdropFilter: 'blur(2px)', // Subtle blur outside the cutout
              WebkitBackdropFilter: 'blur(2px)',
            }}>
              {/* Center cutout (the clear part) */}
              <div style={{
                position: 'relative',
                width: '70%', height: '70%',
                borderRadius: '32px',
                boxShadow: '0 0 0 4000px rgba(0,0,0,0.15)', // Creates the dim outside the cutout
                background: 'transparent',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              }}>
                {/* Sleek white corner brackets */}
                <div style={{ position: 'absolute', width: 40, height: 40, top: -2, left: -2, borderTop: '5px solid #ffffff', borderLeft: '5px solid #ffffff', borderTopLeftRadius: 32, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                <div style={{ position: 'absolute', width: 40, height: 40, top: -2, right: -2, borderTop: '5px solid #ffffff', borderRight: '5px solid #ffffff', borderTopRightRadius: 32, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                <div style={{ position: 'absolute', width: 40, height: 40, bottom: -2, left: -2, borderBottom: '5px solid #ffffff', borderLeft: '5px solid #ffffff', borderBottomLeftRadius: 32, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                <div style={{ position: 'absolute', width: 40, height: 40, bottom: -2, right: -2, borderBottom: '5px solid #ffffff', borderRight: '5px solid #ffffff', borderBottomRightRadius: 32, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
              </div>
            </div>

            {/* Success Overlay (hides the paused screen) */}
            {attendanceConfirmed && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                zIndex: 10
              }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 16, boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)', animation: 'scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                  <CheckCircle size={32} color="white" />
                </div>
                <h4 style={{ fontSize: '20px', fontWeight: 800, color: '#065f46', margin: 0 }}>QR Validated!</h4>
                <p style={{ fontSize: '14px', color: '#047857', marginTop: 6, fontWeight: 500 }}>Please complete the failsafe below.</p>
              </div>
            )}
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '20px', color: '#6b7280', fontSize: '14px', fontWeight: 500 }}>
            Center the QR code in the frame to scan.
          </div>

          <style>{`
            @keyframes scaleIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            
            /* Completely obliterate the ugly HTML5QRcode UI elements */
            #reader { border: none !important; }
            #reader video {
              object-fit: cover !important;
              width: 100% !important;
              height: 100% !important;
              border-radius: 28px !important;
            }
            #reader img { display: none !important; }
            #reader canvas { display: none !important; }
            #qr-canvas-visible { display: none !important; }
            
            /* Hide the ugly "Scanner paused" text injected by the library */
            #reader > div:first-child { 
              display: none !important; 
            }
          `}</style>
        </div>

        {/* Failsafe / Password Entry Card */}
        <div style={{ 
          flex: '1 1 340px', 
          background: 'white', 
          padding: '32px', 
          borderRadius: '32px', 
          boxShadow: '0 20px 40px rgba(0,0,0,0.06)', 
          border: '1px solid rgba(0,0,0,0.03)', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          animation: 'fadeIn 0.4s ease'
        }}>
          <div style={{ width: 56, height: 56, borderRadius: '18px', background: selectedSession.isStrict ? '#fee2e2' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            {selectedSession.isStrict ? <AlertCircle size={28} color="#dc2626" /> : <CheckCircle size={28} color="#16a34a" />}
          </div>
          <h3 style={{ marginBottom: '12px', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            {selectedSession.isStrict ? 'Strict Mode Active' : 'Password Backup'}
          </h3>
          <p style={{ color: '#4b5563', marginBottom: '28px', fontSize: '15px', lineHeight: 1.6 }}>
            {selectedSession.isStrict 
              ? "This session requires both. Please scan the QR code first, then enter the backup password provided by your lecturer." 
              : "Can't scan the QR code? You can simply enter the backup password provided by your lecturer to mark your attendance instead."}
          </p>
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px', display: 'block' }}>Backup Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Enter the 4-digit code" 
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()} 
              style={{ 
                width: '100%', padding: '14px 16px', borderRadius: '14px', 
                border: '2px solid #e5e7eb', fontSize: '16px', fontWeight: 500,
                outline: 'none', transition: 'border-color 0.2s', backgroundColor: '#f9fafb'
              }}
              onFocus={e => e.target.style.borderColor = '#14b8a6'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <button 
            style={{ 
              width: '100%', padding: '16px', borderRadius: '14px', 
              background: '#14b8a6', color: 'white', fontSize: '16px', fontWeight: 700, 
              border: 'none', cursor: 'pointer', transition: 'transform 0.1s, background 0.2s',
              boxShadow: '0 4px 12px rgba(20,184,166,0.3)'
            }}
            onMouseEnter={e => { e.target.style.background = '#0d9488'; e.target.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.target.style.background = '#14b8a6'; e.target.style.transform = 'translateY(0)'; }}
            onClick={handlePasswordSubmit}
          >
            Submit Attendance
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
