import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { BookOpen, MapPin, Clock, Calendar, ArrowLeft, Search, ChevronUp, ChevronDown, Filter, Plus, Download, Check, X, Eye, AlertCircle, QrCode, Loader2 } from 'lucide-react';
import { getLecturerCourses, getSessionsForCourse, getCourseAttendanceRecords, getDisputesForCourse, resolveDispute, createSession, endSession } from '../utils/db';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import SessionView from '../components/SessionView';
import StudentDrawer from '../components/StudentDrawer';
import ConfirmModal from '../components/ConfirmModal';
import { SkeletonMetricCards, SkeletonTableRow, SkeletonCourseCards } from '../components/Skeleton';

// ── SVG Bar Chart ──────────────────────────────────────────────────────────
const BarChart = ({ data }) => {
  const W = 340, H = 160, PAD = { top: 16, right: 16, bottom: 32, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const max = Math.max(...data.map(d => Math.max(d.present, d.absent)), 1);
  const barW = Math.floor(innerW / data.length / 2.6);
  const gap = Math.floor(innerW / data.length);

  const yTicks = [0, Math.round(max / 2), max];

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      {/* Y-axis ticks */}
      {yTicks.map(t => {
        const y = PAD.top + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{t}</text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const x = PAD.left + i * gap;
        const pH = (d.present / max) * innerH;
        const aH = (d.absent / max) * innerH;
        return (
          <g key={i}>
            <rect x={x} y={PAD.top + innerH - pH} width={barW} height={Math.max(pH, 1)} rx={3} fill="#4f46e5" opacity={0.85} />
            <rect x={x + barW + 3} y={PAD.top + innerH - aH} width={barW} height={Math.max(aH, 1)} rx={3} fill="#f87171" opacity={0.75} />
            <text x={x + barW} y={H - 6} fontSize={9} fill="#9ca3af" textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Helpers ────────────────────────────────────────────────────────────────
const msOf = (ts) => {
  if (!ts) return 0;
  if (ts.toMillis) return ts.toMillis();
  if (ts.toDate) return ts.toDate().getTime();
  return new Date(ts).getTime();
};

const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(msOf(ts));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(msOf(ts));
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const PERIODS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'All Time', days: 0 },
];

// ── Course Detail View ─────────────────────────────────────────────────────
const CourseDetail = ({ course, onBack }) => {
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const qTab = searchParams.get('tab');
  const [sessions, setSessions] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [activeTab, setActiveTab] = useState(qTab || 'dashboard');

  // Session creation states
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [venue, setVenue] = useState('');
  const [pwd, setPwd] = useState('');
  const [isStrict, setIsStrict] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loadingLoc, setLoadingLoc] = useState(false);

  const handleStartSession = () => {
    if (!venue) { showToast('Please enter a venue.', 'warning'); return; }
    setLoadingLoc(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude: lat, longitude: lng } = pos.coords;
        const sessionId = await createSession(
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
          createdAt: new Date(),
        };
        setSessions(prev => [newSession, ...prev]);
        setViewingSession(newSession);
        setIsSettingUp(false);
        setVenue(''); setPwd(''); setStartTime(''); setEndTime(''); setIsStrict(false);
        showToast('Session started successfully!', 'success');
      } catch (err) { console.error(err); showToast('Failed to start session.', 'error'); }
      finally { setLoadingLoc(false); }
    }, () => { setLoadingLoc(false); showToast('Location access denied. Please enable GPS.', 'error'); });
  };

  const [confirmModalOpen, setConfirmModalOpen] = useState({ isOpen: false, sessionId: null });

  const handleEndSession = (sessionId) => {
    setConfirmModalOpen({ isOpen: true, sessionId });
  };

  const executeEndSession = async () => {
    const sessionId = confirmModalOpen.sessionId;
    setConfirmModalOpen({ isOpen: false, sessionId: null });
    if (!sessionId) return;
    try {
      await endSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (viewingSession?.id === sessionId) setViewingSession(null);
      showToast('Session ended.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to end session.', 'error');
    }
  };

  useEffect(() => {
    if (qTab) {
      setActiveTab(qTab);
    }
  }, [qTab]);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [processingDisputeId, setProcessingDisputeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewingSession, setViewingSession] = useState(null);
  const [selectedDate, setSelectedDate] = useState('all');
  const [chartPeriod, setChartPeriod] = useState(0); // index into PERIODS
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    setFilterStatus('all');
  }, [selectedDate]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [sess, recs, courseDisputes] = await Promise.all([
          getSessionsForCourse(course.id),
          getCourseAttendanceRecords(course.id),
          getDisputesForCourse(course.id),
        ]);
        sess.sort((a, b) => msOf(b.createdAt) - msOf(a.createdAt));
        setSessions(sess);
        setAttendanceRecords(recs);
        setDisputes(courseDisputes);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [course.id]);

  // Sessions for the date dropdown
  const sessionOptions = useMemo(() => [
    { id: 'all', label: 'All Sessions' },
    ...sessions.map(s => ({
      id: s.id,
      label: fmtDate(s.createdAt),
    })),
  ], [sessions]);

  // Filter records by selected session date
  const baseRecords = useMemo(() => {
    if (selectedDate === 'all') return attendanceRecords;
    return attendanceRecords.filter(r => r.sessionId === selectedDate);
  }, [attendanceRecords, selectedDate]);

  // Enrolled unique students across all records
  const enrolledStudentIds = useMemo(() => {
    const ids = new Set(attendanceRecords.map(r => r.studentId));
    return ids;
  }, [attendanceRecords]);

  // Present count in filtered records
  const presentIds = useMemo(() => new Set(baseRecords.map(r => r.studentId)), [baseRecords]);
  const presentCount = presentIds.size;

  // Absent = enrolled but not present in the filtered set
  const absentCount = [...enrolledStudentIds].filter(id => !presentIds.has(id)).length;

  // Chart data — group by day/week within chosen period
  const chartData = useMemo(() => {
    const { days } = PERIODS[chartPeriod];
    const cutoff = days === 0 ? 0 : Date.now() - days * 86400000;

    // Group sessions within period
    const filtered = sessions.filter(s => msOf(s.createdAt) >= cutoff);
    return filtered.slice().reverse().map(s => {
      const sessionRecs = attendanceRecords.filter(r => r.sessionId === s.id);
      const presentSet = new Set(sessionRecs.map(r => r.studentId));
      const totalEnrolled = [...enrolledStudentIds].filter(id => {
        const firstRec = attendanceRecords
          .filter(r => r.studentId === id)
          .sort((a, b) => msOf(a.timestamp) - msOf(b.timestamp))[0];
        if (!firstRec) return false;
        return msOf(firstRec.timestamp) <= msOf(s.createdAt);
      }).length;
      return {
        label: fmtDate(s.createdAt).slice(0, 6),
        present: presentSet.size,
        absent: Math.max(totalEnrolled - presentSet.size, 0),
      };
    });
  }, [sessions, attendanceRecords, enrolledStudentIds, chartPeriod]);

  // Calculate average attendance % across all sessions
  const totalAttendedSlots = useMemo(() => {
    const pairs = new Set(attendanceRecords.map(r => `${r.studentId}_${r.sessionId}`));
    return pairs.size;
  }, [attendanceRecords]);

  const totalPossibleSlots = useMemo(() => {
    return enrolledStudentIds.size * sessions.length;
  }, [enrolledStudentIds.size, sessions.length]);

  const totalMissedSlots = useMemo(() => {
    return Math.max(totalPossibleSlots - totalAttendedSlots, 0);
  }, [totalPossibleSlots, totalAttendedSlots]);

  const avgAttendance = useMemo(() => {
    if (totalPossibleSlots === 0) return 0;
    return Math.round((totalAttendedSlots / totalPossibleSlots) * 100);
  }, [totalAttendedSlots, totalPossibleSlots]);

  const activeRate = useMemo(() => {
    if (selectedDate === 'all') return avgAttendance;
    if (enrolledStudentIds.size === 0) return 0;
    return Math.round((presentCount / enrolledStudentIds.size) * 100);
  }, [selectedDate, avgAttendance, enrolledStudentIds.size, presentCount]);

  // Latest session stats for Option B anchoring
  const latestSession = sessions[0];
  const latestSessionStats = useMemo(() => {
    if (!latestSession) return null;
    const latestRecs = attendanceRecords.filter(r => r.sessionId === latestSession.id);
    const presentSet = new Set(latestRecs.map(r => r.studentId));
    const present = presentSet.size;
    const absent = Math.max(enrolledStudentIds.size - present, 0);
    const rate = enrolledStudentIds.size > 0 ? Math.round((present / enrolledStudentIds.size) * 100) : 0;
    return { present, absent, rate, label: fmtDate(latestSession.createdAt) };
  }, [latestSession, attendanceRecords, enrolledStudentIds.size]);

  // Determine what to display on the summary panel
  const summaryData = useMemo(() => {
    if (selectedDate === 'all') {
      if (!latestSessionStats) {
        return {
          title: 'Last Class Attendance',
          isEmpty: true,
          rate: 0,
          present: 0,
          absent: 0,
          subText: 'No sessions hosted yet.'
        };
      }
      return {
        title: 'Last Class Attendance',
        isEmpty: false,
        rate: latestSessionStats.rate,
        present: latestSessionStats.present,
        absent: latestSessionStats.absent,
        subText: `Last class: ${latestSessionStats.label}`
      };
    } else {
      // Find selected session label
      const option = sessionOptions.find(o => o.id === selectedDate);
      return {
        title: 'Session Attendance',
        isEmpty: false,
        rate: enrolledStudentIds.size > 0 ? Math.round((presentCount / enrolledStudentIds.size) * 100) : 0,
        present: presentCount,
        absent: absentCount,
        subText: option ? option.label : ''
      };
    }
  }, [selectedDate, latestSessionStats, enrolledStudentIds.size, presentCount, absentCount, sessionOptions]);

  // Table data
  const tableData = useMemo(() => {
    let rows = [];
    if (selectedDate === 'all') {
      const totalSessions = sessions.length;
      [...enrolledStudentIds].forEach(id => {
        const studentRecs = attendanceRecords.filter(r => r.studentId === id);
        const attendedCount = new Set(studentRecs.map(r => r.sessionId)).size;
        const rate = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 0;
        let status = 'Critical';
        if (rate >= 75) status = 'Good';
        else if (rate >= 50) status = 'Warning';
        
        const anyRec = studentRecs[0];
        
        rows.push({
          id: `roster-${id}`,
          studentId: id,
          studentName: anyRec?.studentName || id,
          matricNumber: anyRec?.matricNumber || '',
          courseOfStudy: anyRec?.courseOfStudy || '',
          attendedCount,
          totalSessions,
          attendanceRate: rate,
          status,
          isRosterMode: true
        });
      });
    } else {
      // Deduplicate baseRecords by studentId to prevent duplicate rows for the same student
      const uniqueBaseMap = {};
      baseRecords.forEach(r => {
        const existing = uniqueBaseMap[r.studentId];
        if (!existing || msOf(r.timestamp) < msOf(existing.timestamp)) {
          uniqueBaseMap[r.studentId] = r;
        }
      });
      const uniqueBaseRecords = Object.values(uniqueBaseMap);

      rows = uniqueBaseRecords.map(r => ({
        ...r,
        status: 'Present',
        isRosterMode: false
      }));

      const presentSet = new Set(uniqueBaseRecords.map(r => r.studentId));
      [...enrolledStudentIds].forEach(id => {
        if (!presentSet.has(id)) {
          const anyRec = attendanceRecords.find(r => r.studentId === id);
          rows.push({
            id: `absent-${id}`,
            studentId: id,
            studentName: anyRec?.studentName || id,
            matricNumber: anyRec?.matricNumber || '',
            courseOfStudy: anyRec?.courseOfStudy || '',
            timestamp: null,
            status: 'Absent',
            isRosterMode: false
          });
        }
      });
    }

    if (filterStatus !== 'all') {
      rows = rows.filter(r => r.status.toLowerCase() === filterStatus.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.studentName.toLowerCase().includes(q) ||
        r.matricNumber.toLowerCase().includes(q) ||
        (r.courseOfStudy || '').toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      let av, bv;
      if (sortField === 'timestamp') { 
        if (a.isRosterMode) { av = a.attendanceRate; bv = b.attendanceRate; } 
        else { av = msOf(a.timestamp); bv = msOf(b.timestamp); }
      }
      else if (sortField === 'studentName') { av = a.studentName; bv = b.studentName; }
      else if (sortField === 'matricNumber') { av = a.matricNumber; bv = b.matricNumber; }
      else { av = a.courseOfStudy || ''; bv = b.courseOfStudy || ''; }
      
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return rows;
  }, [baseRecords, enrolledStudentIds, attendanceRecords, sessions.length, selectedDate, search, sortField, sortDir, filterStatus]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp size={12} color="#d1d5db" />;
    return sortDir === 'asc' ? <ChevronUp size={12} color="var(--primary-color)" /> : <ChevronDown size={12} color="var(--primary-color)" />;
  };

  const handleResolveDispute = async (dispute, status) => {
    setProcessingDisputeId(dispute.id);
    try {
      await resolveDispute(dispute.id, dispute, status);
      showToast(`Dispute ${status} successfully!`, 'success');
      
      // Reload disputes and attendance records
      const [recs, courseDisputes] = await Promise.all([
        getCourseAttendanceRecords(course.id),
        getDisputesForCourse(course.id),
      ]);
      setAttendanceRecords(recs);
      setDisputes(courseDisputes);
    } catch (e) {
      console.error(e);
      showToast('Failed to resolve dispute. Please try again.', 'error');
    } finally {
      setProcessingDisputeId(null);
    }
  };

  if (viewingSession) {
    return (
      <SessionView
        session={viewingSession}
        onLeave={() => {
          setViewingSession(null);
          const load = async () => {
            try {
              const sess = await getSessionsForCourse(course.id);
              sess.sort((a, b) => msOf(b.createdAt) - msOf(a.createdAt));
              setSessions(sess);
              const recs = await getCourseAttendanceRecords(course.id);
              setAttendanceRecords(recs);
            } catch(e) { console.error(e); }
          };
          load();
        }}
        onSessionUpdate={(u) => {
          setSessions(prev => prev.map(s => s.id === u.id ? u : s));
          setViewingSession(u);
        }}
        onEnd={async (sessionId) => {
          try {
            await endSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            setViewingSession(null);
            showToast('Session ended.', 'info');
          } catch (err) {
            console.error(err);
            showToast('Failed to end session.', 'error');
          }
        }}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Back */}
      <div onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 600, fontSize: 14 }}>
        <ArrowLeft size={16} /> Back to Courses
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 24, gap: 24 }}>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            padding: '12px 4px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, color: activeTab === 'dashboard' ? 'var(--primary-color)' : 'var(--text-muted)',
            borderBottom: activeTab === 'dashboard' ? '2px solid var(--primary-color)' : '2px solid transparent',
            transition: 'all 0.2s', outline: 'none'
          }}
        >
          Attendance Dashboard
        </button>
        <button
          onClick={() => setActiveTab('disputes')}
          style={{
            padding: '12px 4px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, color: activeTab === 'disputes' ? 'var(--primary-color)' : 'var(--text-muted)',
            borderBottom: activeTab === 'disputes' ? '2px solid var(--primary-color)' : '2px solid transparent',
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, outline: 'none'
          }}
        >
          Disputes
          {disputes.filter(d => d.status === 'pending').length > 0 && (
            <span style={{ background: '#ef4444', color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '2px 8px' }}>
              {disputes.filter(d => d.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <>
          {/* ── Section 1: Attendance Summary header ── */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Attendance Summary</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{course.courseCode} · {course.courseName}</p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Date Dropdown */}
                <select
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, background: 'white', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  {sessionOptions.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                {/* Create Session */}
                <button
                  onClick={() => setIsSettingUp(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  <Plus size={15} /> Create Session
                </button>
              </div>
            </div>

            {/* ── Section 2: Metrics + Chart ── */}
            {loading ? (
              <SkeletonMetricCards />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24 }}>
                {/* Left Column: Stat Cards & Chart */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  
                  {/* Stat Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 12 }}>Total Students</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{enrolledStudentIds.size}</div>
                      <div style={{ fontSize: 11, color: '#ef4444', marginTop: 12, fontWeight: 600 }}>Number of Registered Students</div>
                    </div>
                    
                    <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 12 }}>Total Sessions</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{sessions.length}</div>
                      <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 12, fontWeight: 600 }}>Classes Hosted in Total</div>
                    </div>

                    <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 12 }}>Avg. Class Attendance</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: avgAttendance >= 75 ? '#16a34a' : '#ea580c', lineHeight: 1 }}>{avgAttendance}%</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, fontWeight: 600 }}>Historical Attendance Rate</div>
                    </div>
                  </div>

                  {/* Bar chart */}
                  <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: '24px 24px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1e293b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Calendar size={16}/>
                        </div> 
                        Attendance Statistics
                      </h3>
                      <select
                        value={chartPeriod}
                        onChange={e => setChartPeriod(Number(e.target.value))}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, background: 'white', color: 'var(--text-main)', cursor: 'pointer' }}
                      >
                        {PERIODS.map((p, idx) => (
                          <option key={idx} value={idx}>{p.label}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      {chartData.length === 0 ? (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No data for selected period</div>
                      ) : (
                        <BarChart data={chartData} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Attendance Summary Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: '24px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 240 }}>
                    <div style={{ width: '100%' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px 0', textAlign: 'left' }}>
                        {summaryData.title}
                      </h3>
                      
                      {summaryData.isEmpty ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
                          No sessions hosted yet.
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
                            <span style={{ fontSize: 44, fontWeight: 800, color: '#111827', letterSpacing: '-1px', lineHeight: 1 }}>
                              {summaryData.rate}%
                            </span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
                              Present
                            </span>
                          </div>

                          {/* Side-by-side Progress Bar Pills */}
                          <div style={{ display: 'flex', width: '100%', height: 22, gap: 8, margin: '16px 0 20px' }}>
                            {summaryData.rate > 0 && (
                              <div style={{
                                width: summaryData.rate > 0 && summaryData.rate < 100 ? `calc(${summaryData.rate}% - 4px)` : `${summaryData.rate}%`,
                                height: '100%',
                                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)',
                                backgroundColor: '#bef264',
                                backgroundSize: '12px 12px',
                                borderRadius: 12,
                                transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                                animation: 'progressBarStripes 1s linear infinite'
                              }} />
                            )}
                            {summaryData.rate < 100 && (
                              <div style={{
                                width: summaryData.rate > 0 && summaryData.rate < 100 ? `calc(${100 - summaryData.rate}% - 4px)` : `${100 - summaryData.rate}%`,
                                height: '100%',
                                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
                                backgroundColor: '#0f172a',
                                backgroundSize: '12px 12px',
                                borderRadius: 12,
                                transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                                animation: 'progressBarStripes 1s linear infinite'
                              }} />
                            )}
                          </div>

                          {/* Labels */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13.5, color: '#374151', margin: '8px 0 16px 0' }}>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#bef264', display: 'inline-block' }}></span>
                              Present : {summaryData.present}
                            </span>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0f172a', display: 'inline-block' }}></span>
                              Absent : {summaryData.absent}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ width: '100%', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12, fontWeight: 500 }}>
                      {summaryData.subText || 'Track Student Attendance Easily!'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 3: Student Attendance Table ── */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>Student Attendance</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* CSV Export */}
                <button
                  onClick={() => {
                    if (tableData.length === 0) { showToast('No data to export.', 'warning'); return; }
                    const headers = ['Student Name', 'Matric Number', 'Course of Study', 'Date', 'Time', 'Status'];
                    const rows = tableData.map(r => [
                      `"${r.studentName || ''}"`,
                      r.matricNumber || '',
                      `"${r.courseOfStudy || ''}"`,
                      r.timestamp ? fmtDate(r.timestamp) : '',
                      r.timestamp ? fmtTime(r.timestamp) : '',
                      r.status
                    ].join(','));
                    const csv = [headers.join(','), ...rows].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `${course.courseCode}-attendance.csv`; a.click();
                    URL.revokeObjectURL(url);
                    showToast(`Exported ${tableData.length} records.`, 'success');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--primary-light)', color: 'var(--primary-color)', border: '1px solid var(--border-color)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  <Download size={14} /> Export CSV
                </button>

                {/* Filter Status */}
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 8, padding: '2px 8px', background: 'white' }}>
                  <Filter size={13} color="var(--text-muted)" style={{ marginRight: 6 }} />
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    style={{ border: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-main)', outline: 'none', cursor: 'pointer', padding: '6px 0' }}
                  >
                    <option value="all">All statuses</option>
                    {selectedDate === 'all' ? (
                      <>
                        <option value="Good">{"Good (>=75%)"}</option>
                        <option value="Warning">Warning (50%-74%)</option>
                        <option value="Critical">{"Critical (<50%)"}</option>
                      </>
                    ) : (
                      <>
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Search */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10 }} />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, background: 'white', color: 'var(--text-main)', width: 180, outline: 'none' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: '#f8faff' }}>
                    <th onClick={() => toggleSort('studentName')} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        Student Name <SortIcon field="studentName" />
                      </div>
                    </th>
                    {selectedDate === 'all' ? (
                      <>
                        <th onClick={() => toggleSort('matricNumber')} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Matric Number <SortIcon field="matricNumber" />
                          </div>
                        </th>
                        <th onClick={() => toggleSort('attendedCount')} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Attended <SortIcon field="attendedCount" />
                          </div>
                        </th>
                        <th onClick={() => toggleSort('attendanceRate')} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Rate <SortIcon field="attendanceRate" />
                          </div>
                        </th>
                        <th onClick={() => toggleSort('status')} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Status <SortIcon field="status" />
                          </div>
                        </th>
                      </>
                    ) : (
                      <>
                        <th onClick={() => toggleSort('timestamp')} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Signed In <SortIcon field="timestamp" />
                          </div>
                        </th>
                        <th onClick={() => toggleSort('matricNumber')} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Matric Number <SortIcon field="matricNumber" />
                          </div>
                        </th>
                        <th onClick={() => toggleSort('courseOfStudy')} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Course of Study <SortIcon field="courseOfStudy" />
                          </div>
                        </th>
                        <th onClick={() => toggleSort('status')} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            Status <SortIcon field="status" />
                          </div>
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonTableRow cols={selectedDate === 'all' ? 5 : 5} rows={3} />
                  ) : tableData.length === 0 ? (
                    <tr>
                      <td colSpan={selectedDate === 'all' ? 5 : 5} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                        No records match the filter criteria.
                      </td>
                    </tr>
                  ) : tableData.map((row, idx) => (
                    <tr
                      key={row.studentId}
                      onClick={() => setSelectedStudent({ ...row, id: row.studentId, name: row.studentName })}
                      style={{ background: idx % 2 === 0 ? 'white' : '#fafbff', transition: 'background 0.2s', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#fafbff'}
                    >
                      <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 13.5, fontWeight: 600, color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(row.studentName || 'S')}&background=f3f4f6&color=6b7280&size=28`} style={{ width: 28, height: 28, borderRadius: '50%' }} alt="" />
                          {row.studentName}
                        </div>
                      </td>
                      {selectedDate === 'all' ? (
                        <>
                          <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {row.matricNumber || '—'}
                          </td>
                          <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 13, color: 'var(--text-main)', fontWeight: 600 }}>
                            {row.attendedCount} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>/ {row.totalSessions}</span>
                          </td>
                          <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 13, fontWeight: 700, color: row.attendanceRate >= 75 ? '#16a34a' : row.attendanceRate >= 50 ? '#ca8a04' : '#dc2626' }}>
                            {row.attendanceRate}%
                          </td>
                          <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: row.status === 'Good' ? '#d1fae5' : row.status === 'Warning' ? '#fef08a' : '#fee2e2', color: row.status === 'Good' ? '#065f46' : row.status === 'Warning' ? '#854d0e' : '#991b1b' }}>
                              {row.status}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 13, color: 'var(--text-muted)' }}>
                            {row.timestamp ? (
                              <div>
                                <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{fmtDate(row.sessionDate || row.timestamp)}</div>
                                <div style={{ fontSize: 11 }}>{fmtTime(row.timestamp)}</div>
                              </div>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {row.matricNumber || '—'}
                          </td>
                          <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 13, color: 'var(--text-muted)' }}>
                            {row.courseOfStudy || '—'}
                          </td>
                          <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: row.status === 'Present' ? '#d1fae5' : '#fee2e2', color: row.status === 'Present' ? '#065f46' : '#991b1b' }}>
                              {row.status}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Showing {tableData.length} record{tableData.length !== 1 ? 's' : ''}</span>
              <span>{presentCount} present · {absentCount} absent · {enrolledStudentIds.size} enrolled</span>
            </div>
          </div>
        </>
      )}

      {activeTab === 'disputes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.3s ease' }}>
          {/* Pending Disputes Section */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
              Pending Disputes ({disputes.filter(d => d.status === 'pending').length})
            </h3>
            
            {disputes.filter(d => d.status === 'pending').length === 0 ? (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 12px', color: '#9ca3af' }} />
                <div style={{ fontSize: 15, fontWeight: 600 }}>No pending disputes</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>All student absence reports have been resolved.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: 20 }}>
                {disputes.filter(d => d.status === 'pending').map(dispute => (
                  <div key={dispute.id} style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Student Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(dispute.studentName || 'S')}&background=e0e7ff&color=4f46e5&size=40`} style={{ width: 40, height: 40, borderRadius: '50%' }} alt="" />
                        <div>
                          <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{dispute.studentName}</h4>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dispute.matricNumber} · {dispute.courseOfStudy}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {dispute.timestamp ? fmtDate(dispute.timestamp) : 'Just now'}
                      </span>
                    </div>

                    {/* Session Info Details */}
                    <div style={{ background: '#f8faff', borderRadius: 12, border: '1px solid var(--border-color)', padding: '12px 16px', fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Session:</span> <strong>{dispute.sessionDate}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Venue:</span> <strong>{dispute.venue}</strong>
                      </div>
                    </div>

                    {/* Note / Explanation */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Explanation</div>
                      <div style={{ fontSize: 13.5, background: '#fafafa', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px', lineHeight: 1.5, color: 'var(--text-main)' }}>
                        {dispute.evidence || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No written note provided.</span>}
                      </div>
                    </div>

                    {/* Photo Evidence (if any) */}
                    {dispute.photo && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Evidence Photo</div>
                        <div 
                          onClick={() => setLightboxPhoto(dispute.photo)}
                          style={{ position: 'relative', width: 120, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                        >
                          <img src={dispute.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Thumb" />
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', hover: { opacity: 1 } }} className="photo-overlay">
                            <Eye size={16} color="white" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Resolution Controls */}
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button
                        disabled={processingDisputeId === dispute.id}
                        onClick={() => handleResolveDispute(dispute, 'rejected')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                          background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 8,
                          fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        <X size={14} /> Reject
                      </button>
                      <button
                        disabled={processingDisputeId === dispute.id}
                        onClick={() => handleResolveDispute(dispute, 'approved')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                          background: '#d1fae5', color: '#065f46', border: 'none', borderRadius: 8,
                          fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        <Check size={14} /> Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolved Disputes Section */}
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9ca3af' }} />
              Resolution History ({disputes.filter(d => d.status !== 'pending').length})
            </h3>
            
            {disputes.filter(d => d.status !== 'pending').length === 0 ? (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5, fontStyle: 'italic' }}>
                No disputes resolved yet.
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ background: '#f8faff' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)' }}>Student</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)' }}>Session</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)' }}>Explanation</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border-color)' }}>Resolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disputes.filter(d => d.status !== 'pending').map((dispute, index) => (
                      <tr key={dispute.id} style={{ background: index % 2 === 0 ? 'white' : '#fafbff' }}>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(dispute.studentName || 'S')}&background=e0e7ff&color=4f46e5&size=28`} style={{ width: 28, height: 28, borderRadius: '50%' }} alt="" />
                            <div>
                              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{dispute.studentName}</span>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dispute.matricNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                          <div style={{ fontWeight: 500 }}>{dispute.sessionDate}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dispute.venue}</div>
                        </td>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 13, maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {dispute.evidence || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No note</span>}
                          {dispute.photo && (
                            <span 
                              onClick={() => setLightboxPhoto(dispute.photo)}
                              style={{ marginLeft: 8, color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600, fontSize: 11 }}
                            >
                              [View Photo]
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: dispute.status === 'approved' ? '#d1fae5' : '#fee2e2',
                            color: dispute.status === 'approved' ? '#065f46' : '#991b1b'
                          }}>
                            {dispute.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <>
          <div 
            onClick={() => setLightboxPhoto(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease', backdropFilter: 'blur(5px)' }}
          >
            <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setLightboxPhoto(null)}
                style={{ position: 'absolute', top: -45, right: 0, background: 'white', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', display: 'flex', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}
              >
                <X size={20} color="#1f2937" />
              </button>
              <img src={lightboxPhoto} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px', border: '3px solid white', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', objectFit: 'contain' }} alt="Evidence Lightbox" />
            </div>
          </div>
        </>
      )}

      {/* Student info drawer */}
      {selectedStudent && (
        <StudentDrawer
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          courseHistory={{ sessions, attendanceRecords }}
        />
      )}

      {/* Create Session Modal */}
      {isSettingUp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: 'white',
            borderRadius: 20,
            width: '100%',
            maxWidth: 480,
            padding: 28,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            border: '1px solid var(--border-color)',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4, letterSpacing: '-0.3px' }}>Start Attendance Session</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Create a new QR session for this course.</p>
              </div>
              <button 
                onClick={() => setIsSettingUp(false)} 
                style={{ background: 'var(--bg-page)', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28 }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Course Info (Locked) */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Selected Course</label>
                <div style={{ background: 'var(--bg-page)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>
                  {course.courseCode} — {course.courseName}
                </div>
              </div>

              {/* Venue */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Venue</label>
                <input 
                  type="text" 
                  value={venue} 
                  onChange={e => setVenue(e.target.value)} 
                  placeholder="e.g. Lecture Hall 1" 
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none' }}
                />
              </div>

              {/* Times */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Start Time</label>
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={e => setStartTime(e.target.value)} 
                    onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', cursor: 'pointer' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>End Time</label>
                  <input 
                    type="time" 
                    value={endTime} 
                    onChange={e => setEndTime(e.target.value)} 
                    onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Backup Password <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <input 
                  type="text" 
                  value={pwd} 
                  onChange={e => setPwd(e.target.value)} 
                  placeholder="Used if student GPS fails" 
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 14, outline: 'none' }}
                />
              </div>

              {/* Strict Mode */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-main)', cursor: 'pointer', marginTop: 4 }}>
                <input 
                  type="checkbox" 
                  checked={isStrict} 
                  onChange={e => setIsStrict(e.target.checked)} 
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary-color)' }}
                />
                <div>
                  <span style={{ fontWeight: 700 }}>Strict Geofencing</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>Require both GPS verification and backup password</span>
                </div>
              </label>
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                onClick={() => setIsSettingUp(false)} 
                style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleStartSession} 
                disabled={loadingLoc} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  padding: '10px 20px', 
                  background: 'var(--primary-color)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 10, 
                  fontWeight: 600, 
                  fontSize: 13.5, 
                  cursor: loadingLoc ? 'not-allowed' : 'pointer',
                  opacity: loadingLoc ? 0.7 : 1,
                }}
              >
                {loadingLoc ? (
                  <>
                    <Loader2 size={15} className="spin" />
                    Fetching Location...
                  </>
                ) : (
                  <>
                    <QrCode size={15} />
                    Start Session
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* End Session Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModalOpen.isOpen}
        title="End Session?"
        message="Are you sure you want to end this session? Students will no longer be able to mark attendance."
        confirmText="End Session"
        cancelText="Cancel"
        onConfirm={executeEndSession}
        onCancel={() => setConfirmModalOpen({ isOpen: false, sessionId: null })}
        isDanger={true}
      />
    </div>
  );
};

// ── Course List View ───────────────────────────────────────────────────────

// Auto-assign a unique palette per course so each card is visually distinct
const COURSE_PALETTES = [
  { bg: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', light: '#ede9fe', text: '#4f46e5', dot: '#7c3aed' },
  { bg: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', light: '#e0f2fe', text: '#0284c7', dot: '#0ea5e9' },
  { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', light: '#d1fae5', text: '#059669', dot: '#10b981' },
  { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', light: '#fef3c7', text: '#d97706', dot: '#f59e0b' },
  { bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', light: '#fee2e2', text: '#dc2626', dot: '#ef4444' },
  { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', light: '#ede9fe', text: '#6d28d9', dot: '#8b5cf6' },
];

const CourseCard = ({ course, index, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const palette = COURSE_PALETTES[index % COURSE_PALETTES.length];
  const code = (course.courseCode || '').toUpperCase();
  const initials = code.replace(/[^A-Z0-9]/g, '').slice(0, 3);
  
  // Derive a status based on sessions
  const sessions = course.totalSessions || 0;
  const status = sessions === 0 
    ? { label: 'No Sessions Yet', bg: '#f3f4f6', color: '#6b7280' }
    : sessions < 3 
      ? { label: 'Just Started', bg: '#fef3c7', color: '#d97706' }
      : { label: 'Active', bg: '#d1fae5', color: '#065f46' };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        borderRadius: 20,
        border: `1px solid ${hovered ? palette.dot + '55' : 'var(--border-color)'}`,
        overflow: 'hidden',
        boxShadow: hovered
          ? `0 20px 50px ${palette.dot}22, 0 4px 16px rgba(0,0,0,0.06)`
          : '0 2px 12px rgba(0,0,0,0.05)',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Color Header Banner */}
      <div style={{
        background: palette.bg,
        padding: '28px 24px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circle blobs */}
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', top: 30, right: 30, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
          {/* Course Initials Avatar */}
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: '0.5px'
          }}>
            {initials}
          </div>
          {/* Status Pill */}
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 700,
            color: 'white',
            letterSpacing: '0.3px'
          }}>
            {status.label}
          </div>
        </div>

        <div style={{ marginTop: 20, position: 'relative', zIndex: 1 }}>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 4, letterSpacing: '-0.3px' }}>{code}</h3>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500, lineHeight: 1.4 }}>{course.courseName || '—'}</p>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Sessions</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)' }}>{sessions}</div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Department</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {course.department || course.courseCode?.slice(0, 3)?.toUpperCase() || 'N/A'}
          </div>
        </div>
      </div>

      {/* CTA Footer */}
      <div style={{
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: hovered ? palette.light : 'white',
        transition: 'background 0.25s ease',
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>View attendance & details</span>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: palette.bg,
          color: 'white',
          padding: '7px 16px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: `0 4px 12px ${palette.dot}44`,
          transform: hovered ? 'scale(1.04)' : 'scale(1)',
          transition: 'transform 0.2s ease',
        }}>
          Open →
        </div>
      </div>
    </div>
  );
};

const LecturerCourses = () => {
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const qCourseId = searchParams.get('courseId');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(location.state?.initialCourse || null);

  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      try {
        const list = await getLecturerCourses(currentUser.uid);
        setCourses(list);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [currentUser]);

  useEffect(() => {
    if (courses.length > 0 && qCourseId) {
      const target = courses.find(c => c.id === qCourseId);
      if (target) {
        setSelectedCourse(target);
      }
    }
  }, [courses, qCourseId]);

  const handleBack = () => {
    setSelectedCourse(null);
    setSearchParams({});
  };

  if (selectedCourse) {
    return <CourseDetail course={selectedCourse} onBack={handleBack} />;
  }

  return (
    <div>
      <div className="breadcrumbs">
        <span style={{ color: 'var(--primary-color)', fontWeight: 600, fontSize: 14 }}>Course Management</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>My Courses</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>{courses.length} course{courses.length !== 1 ? 's' : ''} registered this semester</p>
        </div>
      </div>

      {loading ? (
        <SkeletonCourseCards />
      ) : courses.length === 0 ? (
        <div className="empty-state-premium">
          <div className="empty-state-icon-wrapper"><BookOpen size={36} color="var(--primary-color)" /></div>
          <h3 style={{ marginBottom: 8, fontSize: 18 }}>No courses found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Register a course from your Overview to see it here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {courses.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              index={index}
              onClick={() => setSelectedCourse(course)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LecturerCourses;

