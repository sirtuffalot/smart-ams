import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Search, ArrowLeft, ChevronRight, Download, Play, Pause, Edit2, Power, MapPin, Clock, Monitor, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { subscribeToAttendees, updateSession, getExpectedStudentsForSession, getStudentRecentAttendance, manualCheckInByMatric, isSessionExpired, isSessionUpcoming, linkBoardToSession } from '../utils/db';
import StudentDrawer from './StudentDrawer';
import ConfirmModal from './ConfirmModal';

// ── Sparkline SVG ─────────────────────────────────────────────
const Sparkline = ({ data, width = 48, height = 20 }) => {
  if (!data || data.length < 2) return null;
  const max = 1, min = 0, pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / (max - min)) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const color = data[data.length - 1] === 1 ? '#10b981' : '#ef4444';
  return (
    <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = pad + (i / (data.length - 1)) * (width - pad * 2);
        const y = pad + (1 - v) * (height - pad * 2);
        return <circle key={i} cx={x} cy={y} r="2" fill={v === 1 ? '#10b981' : '#ef4444'} />;
      })}
    </svg>
  );
};

// ── Animated Counter ─────────────────────────────────────────
const AnimatedCount = ({ value }) => {
  const [display, setDisplay] = useState(value);
  const [pop, setPop] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value !== prev.current) {
      setPop(true);
      const t = setTimeout(() => { setDisplay(value); setPop(false); }, 300);
      prev.current = value;
      return () => clearTimeout(t);
    }
    setDisplay(value);
  }, [value]);
  return (
    <span style={{ display: 'inline-block', transition: 'transform 0.3s, color 0.3s', transform: pop ? 'scale(1.4)' : 'scale(1)', color: pop ? '#10b981' : 'inherit' }}>
      {display}
    </span>
  );
};

// ── Late detection helper ────────────────────────────────────
const LATE_MINUTES = 10;
const isLate = (timestamp, sessionStartTime) => {
  if (!timestamp || !sessionStartTime) return false;
  try {
    const ts = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const [h, m] = sessionStartTime.split(':').map(Number);
    const cutoff = new Date(ts);
    cutoff.setHours(h, m + LATE_MINUTES, 0, 0);
    return ts > cutoff;
  } catch { return false; }
};

// ── CSV Export ───────────────────────────────────────────────
const exportCSV = (students, session) => {
  const rows = [
    ['Name', 'Matric No', 'Status', 'Arrival Time'],
    ...students.map(s => [
      s.studentName || s.studentId,
      s.matricNumber || '',
      s.status === 'Present' ? (isLate(s.timestamp, session.startTime) ? 'Late' : 'Present') : 'Absent',
      s.timestamp ? new Date(s.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    ]),
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${session.courseCode || session.courseName}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`;
  a.click();
};



// ── Main Component ────────────────────────────────────────────
const SessionView = ({ session, onLeave, onSessionUpdate, onEnd }) => {
  const [attendees, setAttendees] = useState([]);
  const [expectedStudents, setExpectedStudents] = useState([]);
  const [loadingExpected, setLoadingExpected] = useState(true);
  const [search, setSearch] = useState('');
  const [showFullQR, setShowFullQR] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [liveSession, setLiveSession] = useState(session);
  const [startTime, setStartTime] = useState(session.startTime || '');
  const [endTime, setEndTime] = useState(session.endTime || '');
  const [pwd, setPwd] = useState(session.pwd || '');
  const [sparklines, setSparklines] = useState({});
  const [newJoinFlash, setNewJoinFlash] = useState(null);
  const [manualMatric, setManualMatric] = useState('');
  const [isManualCheckingIn, setIsManualCheckingIn] = useState(false);
  const [manualError, setManualError] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  
  // Casting State
  const [showCastModal, setShowCastModal] = useState(false);
  const [castCode, setCastCode] = useState('');
  const [castError, setCastError] = useState('');
  const [isCasting, setIsCasting] = useState(false);
  const [castSuccess, setCastSuccess] = useState(false);
  
  const prevCountRef = useRef(0);
  
  // Dynamic QR Code State
  const [qrPayload, setQrPayload] = useState(JSON.stringify({ sId: session.id }));
  const [qrProgress, setQrProgress] = useState(100);

  // Dynamic QR Code Generator
  useEffect(() => {
    if (!liveSession || liveSession.status !== 'active' || isSessionUpcoming(liveSession)) return;
    
    let intervalId;
    let progressIntervalId;
    
    const generatePayload = async () => {
      const ts = Date.now();
      const secret = liveSession.qrSecret || 'legacy-secret';
      const msg = `${session.id}|${ts}|${secret}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(msg);
      
      try {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        setQrPayload(JSON.stringify({
          sId: session.id,
          ts: ts,
          sig: signature.substring(0, 16) // use first 16 chars to keep QR code less dense
        }));
        setQrProgress(100);
      } catch (err) {
        console.error('QR Hash generation failed:', err);
        setQrPayload(JSON.stringify({ sId: session.id }));
      }
    };
    
    generatePayload();
    intervalId = setInterval(generatePayload, 20000);
    progressIntervalId = setInterval(() => {
      setQrProgress(prev => Math.max(0, prev - 0.5)); // 0.5% per 100ms = 20 seconds total
    }, 100);

    return () => {
      clearInterval(intervalId);
      clearInterval(progressIntervalId);
    };
  }, [liveSession, session.id]);

  // Auto-end checks
  useEffect(() => {
    if (liveSession.status !== 'active') return;

    const checkExpiration = () => {
      if (isSessionExpired(liveSession)) {
        if (onEnd) {
          onEnd(liveSession.id);
        }
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 5000);
    return () => clearInterval(interval);
  }, [liveSession, onEnd]);

  const isActive = liveSession.status === 'active';
  const isUpcoming = isSessionUpcoming(liveSession);

  // Live attendees subscription
  useEffect(() => {
    const unsub = subscribeToAttendees(session.id, (incoming) => {
      setAttendees(incoming);
      if (incoming.length > prevCountRef.current) {
        const newest = incoming[incoming.length - 1];
        setNewJoinFlash(newest?.studentName || 'A student');
        const t = setTimeout(() => setNewJoinFlash(null), 3000);
        prevCountRef.current = incoming.length;
        return () => clearTimeout(t);
      }
      prevCountRef.current = incoming.length;
    });
    return unsub;
  }, [session.id]);

  // Expected students
  useEffect(() => {
    const fetchExpected = async () => {
      try {
        const d = session.createdAt?.toDate?.() || new Date();
        const expected = await getExpectedStudentsForSession(session.courseId, d);
        setExpectedStudents(expected);
      } catch (e) { console.error(e); }
      finally { setLoadingExpected(false); }
    };
    if (session.courseId) fetchExpected();
    else setLoadingExpected(false);
  }, [session.courseId, session.createdAt]);

  // Merge roster
  const mergedMap = {};
  expectedStudents.forEach(s => {
    mergedMap[s.studentId] = { id: s.studentId, studentId: s.studentId, studentName: s.studentName, matricNumber: s.matricNumber, status: 'Absent', timestamp: null };
  });
  attendees.forEach(a => {
    mergedMap[a.studentId] = { id: a.studentId, studentId: a.studentId, studentName: a.studentName, matricNumber: a.matricNumber, status: 'Present', timestamp: a.timestamp };
  });
  const allStudents = Object.values(mergedMap).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Present' ? -1 : 1;
    return (a.studentName || '').localeCompare(b.studentName || '');
  });
  const filtered = allStudents.filter(a =>
    a.status === 'Present' &&
    ((a.studentName || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.matricNumber || '').toLowerCase().includes(search.toLowerCase()))
  );
  const presentCount = allStudents.filter(s => s.status === 'Present').length;
  const lateCount = allStudents.filter(s => s.status === 'Present' && isLate(s.timestamp, liveSession.startTime)).length;
  const absentCount = allStudents.filter(s => s.status === 'Absent').length;

  // Fetch sparklines lazily when a student becomes present
  useEffect(() => {
    if (!session.courseId) return;
    attendees.forEach(async (a) => {
      if (!sparklines[a.studentId]) {
        try {
          const recs = await getStudentRecentAttendance(a.studentId, session.courseId, 5);
          const vals = recs.map(() => 1);
          setSparklines(prev => ({ ...prev, [a.studentId]: vals.length ? vals : [1] }));
        } catch { /* noop */ }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendees.length]);

  const handleTogglePause = async () => {
    const newStatus = !liveSession.attendanceLocked;
    await updateSession(session.id, { attendanceLocked: newStatus });
    const updated = { ...liveSession, attendanceLocked: newStatus };
    setLiveSession(updated);
    if (onSessionUpdate) onSessionUpdate(updated);
  };

  const handleSaveEdit = async () => {
    await updateSession(session.id, { startTime, endTime, pwd });
    const updated = { ...liveSession, startTime, endTime, pwd };
    setLiveSession(updated);
    if (onSessionUpdate) onSessionUpdate(updated);
    setIsEditing(false);
  };

  const handleEndSession = () => {
    setConfirmModalOpen(true);
  };

  const executeEndSession = () => {
    setConfirmModalOpen(false);
    if (onEnd) onEnd(session.id);
  };

  const handleManualCheckIn = async () => {
    if (!manualMatric.trim()) return;
    setIsManualCheckingIn(true);
    setManualError('');
    try {
      await manualCheckInByMatric(session.id, session.courseId, manualMatric);
      setManualMatric('');
    } catch (err) {
      setManualError(err.message || 'Failed to check in student manually.');
    } finally {
      setIsManualCheckingIn(false);
    }
  };

  const handleCastSubmit = async () => {
    if (!castCode || castCode.length !== 4) {
      setCastError('Please enter a 4-character code.');
      return;
    }
    setIsCasting(true);
    setCastError('');
    try {
      await linkBoardToSession(castCode, session.id);
      setCastSuccess(true);
      setTimeout(() => {
        setShowCastModal(false);
        setCastCode('');
        setCastSuccess(false);
      }, 2000);
    } catch (err) {
      setCastError(err.message || 'Failed to connect. Check code and try again.');
    } finally {
      setIsCasting(false);
    }
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 600, fontSize: 14 }} onClick={onLeave}>
        <ArrowLeft size={16} /> Back
      </div>

      {/* New-join flash notification */}
      {newJoinFlash && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 3000, background: '#10b981', color: 'white', padding: '10px 18px', borderRadius: 12, fontWeight: 600, fontSize: 14, boxShadow: '0 8px 24px rgba(16,185,129,0.35)', animation: 'slideInRight 0.3s ease' }}>
          ✓ {newJoinFlash} just scanned in
        </div>
      )}

      {/* Premium Hero Card */}
      <div style={{ 
        marginBottom: 24, padding: '32px', borderRadius: 24, color: 'white', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15)'
      }}>
        {/* Glow Spheres */}
        <div style={{ position: 'absolute', top: '-20%', right: '-5%', width: 200, height: 200, background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(30px)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '10%', width: 150, height: 150, background: 'radial-gradient(circle, rgba(45,212,191,0.3) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(30px)' }} />
        
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.7)' }}>
                  Live Session Control
                </div>
                {liveSession.courseCode && (
                  <span style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', backdropFilter: 'blur(10px)', color: '#e2e8f0' }}>
                    {liveSession.courseCode.toUpperCase()}
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', margin: 0, textTransform: 'capitalize', lineHeight: 1.1 }}>
                {liveSession.courseName}
              </h1>
              <div style={{ display: 'flex', gap: 12, fontSize: 13, opacity: 0.9, marginTop: 16, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 16, backdropFilter: 'blur(10px)' }}>
                  <MapPin size={14} style={{ color: '#fb7185' }} /> {liveSession.venue}
                </span>
                {liveSession.startTime && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 16, backdropFilter: 'blur(10px)' }}>
                    <Clock size={14} style={{ color: '#94a3b8' }} /> {liveSession.startTime} – {liveSession.endTime}
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 16, backdropFilter: 'blur(10px)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: isUpcoming ? '#f59e0b' : isActive ? (liveSession.attendanceLocked ? '#f59e0b' : '#34d399') : '#9ca3af', boxShadow: !isUpcoming && isActive && !liveSession.attendanceLocked ? '0 0 8px #34d399' : 'none' }} />
                  {isUpcoming ? 'Scheduled' : !isActive ? 'Ended' : liveSession.attendanceLocked ? 'Paused' : 'Receiving'}
                </span>
              </div>
            </div>
            {isActive && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button 
                  onClick={handleTogglePause}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.2)', background: liveSession.attendanceLocked ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.1)', color: liveSession.attendanceLocked ? '#fcd34d' : 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = liveSession.attendanceLocked ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = liveSession.attendanceLocked ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {liveSession.attendanceLocked ? <Play size={16} /> : <Pause size={16} />}
                  {liveSession.attendanceLocked ? 'Resume' : 'Pause'}
                </button>
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <Edit2 size={16} />
                  Edit Details
                </button>
                <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
                <button 
                  onClick={handleEndSession}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 14, border: '1px solid rgba(239, 68, 68, 0.5)', background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
                  onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.3)'; }}
                >
                  <Power size={16} />
                  End Session
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Panel */}
      {isEditing && isActive && (
        <div style={{ background: 'white', padding: 24, borderRadius: 16, border: '1px solid var(--border-color)', marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Edit Session Details</h3>
          <div className="form-group row">
            <div className="col"><label>Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
            <div className="col"><label>End Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Backup Password</label><input type="text" value={pwd} onChange={e => setPwd(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
        </div>
      )}

      {/* Main Grid */}
      <div className="responsive-flex">
        {/* QR Panel */}
        {isActive && (
          <div className="qr-panel" style={{ background: 'white', padding: 24, borderRadius: 16, border: '1px solid var(--border-color)', width: 280, flexShrink: 0 }}>
            <h3 style={{ marginBottom: 16, fontSize: 15, textAlign: 'center' }}>{isUpcoming ? 'Scheduled Session' : 'Scan to Attend'}</h3>
            {isUpcoming ? (
              <div style={{ padding: '24px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, marginBottom: 12 }}>
                <Clock size={32} color="#d97706" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>Awaiting Start Time</span>
                <p style={{ fontSize: 11, color: '#78350f', margin: 0, lineHeight: 1.4 }}>This session starts at <strong>{liveSession.startTime}</strong>.<br />The QR Code and check-ins will unlock automatically.</p>
              </div>
            ) : (
              <div style={{ padding: 12, background: 'white', border: '1px solid #eee', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'inline-block', width: '100%', textAlign: 'center', position: 'relative' }}>
                <QRCodeSVG value={qrPayload} size={200} />
                <div style={{ marginTop: 12, height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${qrProgress}%`, background: qrProgress < 20 ? '#ef4444' : '#3b82f6', transition: 'width 0.1s linear, background 0.3s ease' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, fontWeight: 600 }}>Secured & Rotating</div>
              </div>
            )}

            {/* Live ticker */}
            <div style={{ marginTop: 20, background: 'var(--primary-light)', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary-color)', marginBottom: 6 }}>Live Attendance</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                <AnimatedCount value={presentCount} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                of {allStudents.length} expected
                {lateCount > 0 && <span style={{ color: '#d97706', marginLeft: 6 }}>· {lateCount} late</span>}
              </div>
              <div style={{ marginTop: 10, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${allStudents.length > 0 ? (presentCount / allStudents.length) * 100 : 0}%`, background: 'linear-gradient(90deg, var(--primary-color), #2dd4bf)', borderRadius: 3, transition: 'width 0.6s ease' }} />
              </div>
            </div>

            <button className="btn btn-secondary" style={{ marginTop: 12, width: '100%', cursor: isUpcoming ? 'not-allowed' : 'pointer', opacity: isUpcoming ? 0.6 : 1 }} disabled={isUpcoming} onClick={() => setShowFullQR(true)}>
              Present / Print QR
            </button>
            <button className="btn" style={{ marginTop: 8, width: '100%', cursor: isUpcoming ? 'not-allowed' : 'pointer', opacity: isUpcoming ? 0.6 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, background: 'var(--primary-color)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: 8, fontWeight: 700 }} disabled={isUpcoming} onClick={() => setShowCastModal(true)}>
              <Monitor size={16} /> Cast to Smart Board
            </button>
            <p style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all', textAlign: 'center' }}>ID: {session.id}</p>
            
            {/* Manual Check-in Widget */}
            <div style={{ marginTop: 24, background: '#f8fafc', borderRadius: 12, padding: '16px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-main)', letterSpacing: '0.5px', marginBottom: 6 }}>Manual Check-in</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.4 }}>If student lacks device, enter Matric No. to auto-enroll & mark present.</div>
              {manualError && <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 10, fontWeight: 600 }}>{manualError}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <input 
                  type="text" 
                  placeholder="e.g. 22CH032024"
                  value={manualMatric}
                  onChange={e => { setManualMatric(e.target.value.toUpperCase()); setManualError(''); }}
                  disabled={isUpcoming}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, outline: 'none', width: '100%' }}
                />
                <button 
                  disabled={isManualCheckingIn || !manualMatric.trim() || isUpcoming}
                  onClick={handleManualCheckIn}
                  style={{ background: 'var(--text-main)', color: 'white', border: 'none', borderRadius: 8, padding: '0 14px', fontWeight: 600, fontSize: 12, cursor: isManualCheckingIn || !manualMatric.trim() || isUpcoming ? 'not-allowed' : 'pointer', opacity: isManualCheckingIn || !manualMatric.trim() || isUpcoming ? 0.6 : 1 }}
                >
                  {isManualCheckingIn ? '...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Roster Panel */}
        <div style={{ background: 'white', padding: 24, borderRadius: 16, border: '1px solid var(--border-color)', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>Class Roster</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, padding: '4px 10px', background: '#d1fae5', color: '#065f46', borderRadius: 12, fontWeight: 600 }}>
                  <AnimatedCount value={presentCount} /> Present
                </span>
                {lateCount > 0 && (
                  <span style={{ fontSize: 12, padding: '4px 10px', background: '#fef3c7', color: '#92400e', borderRadius: 12, fontWeight: 600 }}>
                    {lateCount} Late
                  </span>
                )}
                <span style={{ fontSize: 12, padding: '4px 10px', background: '#fee2e2', color: '#991b1b', borderRadius: 12, fontWeight: 600 }}>
                  {absentCount} Absent
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="search-bar" style={{ width: 200 }}>
                <Search size={15} color="var(--text-muted)" />
                <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button
                onClick={() => exportCSV(allStudents, liveSession)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--primary-light)', color: 'var(--primary-color)', border: '1px solid var(--border-color)', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                <Download size={14} /> CSV
              </button>
            </div>
          </div>

          {loadingExpected ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading roster...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p>{search ? 'No matching students.' : (isActive ? 'Waiting for students to join...' : 'No students attended.')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(student => {
                const late = student.status === 'Present' && isLate(student.timestamp, liveSession.startTime);
                const spark = sparklines[student.studentId];
                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', border: '1px solid var(--border-color)', cursor: 'pointer', borderRadius: 12, transition: 'all 0.15s', background: student.status === 'Absent' ? '#fef2f2' : late ? '#fffbeb' : 'white' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(student.studentName || 'S')}&background=${student.status === 'Absent' ? 'fca5a5' : late ? 'fde68a' : 'e0e7ff'}&color=${student.status === 'Absent' ? '991b1b' : late ? '92400e' : '4f46e5'}&size=40`}
                        style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} alt=""
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{student.studentName || student.studentId}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {student.matricNumber && <span style={{ marginRight: 8 }}>#{student.matricNumber}</span>}
                          {student.status === 'Present' && student.timestamp &&
                            <span>{new Date(student.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {spark && spark.length > 1 && (
                        <div title="Last 5 sessions attendance">
                          <Sparkline data={spark} />
                        </div>
                      )}
                      {student.status === 'Present' ? (
                        late ? (
                          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>Late</span>
                        ) : (
                          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#d1fae5', color: '#065f46' }}>Present</span>
                        )
                      ) : (
                        <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b' }}>Absent</span>
                      )}
                      <ChevronRight size={14} color="var(--text-muted)" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen QR */}
      {showFullQR && isActive && (
        <div style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} className="fullscreen-qr">
          <h1 style={{ fontSize: '3rem', marginBottom: 40, textAlign: 'center' }}>{liveSession.courseName}</h1>
          <div style={{ padding: 24, border: '2px solid #eee', borderRadius: 24, boxShadow: '0 12px 32px rgba(0,0,0,0.1)' }}>
            <QRCodeSVG value={qrPayload} size={400} />
            <div style={{ marginTop: 24, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${qrProgress}%`, background: qrProgress < 20 ? '#ef4444' : '#3b82f6', transition: 'width 0.1s linear, background 0.3s ease' }} />
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center', fontWeight: 600 }}>Dynamic Cryptographic Code • Refreshes every 20s</div>
          </div>
          <h2 style={{ marginTop: 40, fontSize: '2rem' }}>Scan to Mark Attendance</h2>
          <p style={{ marginTop: 12, fontSize: '1.4rem', color: 'var(--text-muted)' }}>Venue: {liveSession.venue}</p>
          <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', gap: 12 }} className="no-print">
            <button className="btn btn-secondary" onClick={() => window.print()}>Print</button>
            <button className="btn btn-primary" onClick={() => setShowFullQR(false)}>Close</button>
          </div>
          <style>{`@media print { body * { visibility:hidden } .fullscreen-qr,.fullscreen-qr * { visibility:visible } .no-print { display:none!important } }`}</style>
        </div>
      )}

      {selectedStudent && <StudentDrawer student={selectedStudent} onClose={() => setSelectedStudent(null)} />}

      <style>{`
        @keyframes slideInRight { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
      `}</style>

      <ConfirmModal
        isOpen={confirmModalOpen}
        title="End Session?"
        message="Are you sure you want to end this session? Students will no longer be able to mark attendance."
        confirmText="End Session"
        cancelText="Cancel"
        onConfirm={executeEndSession}
        onCancel={() => setConfirmModalOpen(false)}
        isDanger={true}
      />

      {/* Cast Modal */}
      {showCastModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: 32, borderRadius: 24, width: 400, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', position: 'relative' }}>
            <button onClick={() => setShowCastModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            
            <div style={{ textAlign: 'center' }}>
              <Monitor size={48} style={{ color: 'var(--primary-color)', marginBottom: 16 }} />
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Cast to Board</h2>
              <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>Open <strong>your-app.com/board</strong> on the Smart Board and enter the 4-digit pairing code shown.</p>
              
              {castSuccess ? (
                <div style={{ padding: 24, background: '#dcfce7', color: '#166534', borderRadius: 16, fontWeight: 700, fontSize: 18 }}>
                  Successfully Connected!
                </div>
              ) : (
                <>
                  <input 
                    type="text" 
                    placeholder="e.g. A4X9" 
                    maxLength={4}
                    value={castCode}
                    onChange={e => { setCastCode(e.target.value.toUpperCase()); setCastError(''); }}
                    style={{ width: '100%', padding: '16px', fontSize: 24, letterSpacing: 8, textAlign: 'center', borderRadius: 12, border: '2px solid #cbd5e1', marginBottom: 12, fontWeight: 800, textTransform: 'uppercase' }}
                  />
                  {castError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, fontWeight: 600 }}>{castError}</div>}
                  
                  <button 
                    onClick={handleCastSubmit}
                    disabled={isCasting || castCode.length !== 4}
                    style={{ width: '100%', padding: 16, borderRadius: 12, background: 'var(--primary-color)', color: 'white', border: 'none', fontSize: 16, fontWeight: 700, cursor: isCasting || castCode.length !== 4 ? 'not-allowed' : 'pointer', opacity: isCasting || castCode.length !== 4 ? 0.7 : 1 }}
                  >
                    {isCasting ? 'Connecting...' : 'Connect to Board'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionView;
