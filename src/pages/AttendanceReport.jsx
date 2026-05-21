import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, BookOpen, CheckCircle, Clock, AlertCircle, ArrowLeft, Calendar, MapPin, XCircle, X, Upload, Loader2 } from 'lucide-react';
import { getStudentAttendanceStats, getSessionsForCourse, getStudentAttendanceForCourse, getDisputesForStudent, createDispute } from '../utils/db';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const CourseDetailView = ({ course, studentId, onBack }) => {
  const [sessions, setSessions] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  // Dispute Modal state
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeSession, setDisputeSession] = useState(null);
  const [disputeNote, setDisputeNote] = useState('');
  const [disputePhoto, setDisputePhoto] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [courseSessions, studentAttendance, studentDisputes] = await Promise.all([
          getSessionsForCourse(course.courseId),
          getStudentAttendanceForCourse(studentId, course.courseId),
          getDisputesForStudent(studentId, course.courseId)
        ]);
        
        // Find the earliest attendance record to determine enrollment date
        let firstAttDate = null;
        studentAttendance.forEach(record => {
          const recDate = record.timestamp?.toDate?.() || new Date();
          if (!firstAttDate || recDate < firstAttDate) {
            firstAttDate = recDate;
          }
        });

        const firstAttDay = firstAttDate ? new Date(firstAttDate).setHours(0,0,0,0) : 0;

        // Filter sessions that occurred before enrollment and sort descending
        const applicableSessions = courseSessions.filter(session => {
          if (!firstAttDate) return false; // If no attendance ever, they have no applicable sessions
          const sessionDay = new Date(session.createdAt?.toDate?.() || new Date(0)).setHours(0,0,0,0);
          return sessionDay >= firstAttDay;
        }).sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });

        setSessions(applicableSessions);
        setAttendanceRecords(studentAttendance);
        setDisputes(studentDisputes);
      } catch (err) {
        console.error("Failed to fetch detailed records", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [course.courseId, studentId]);

  // Create maps for O(1) lookup
  const attendanceMap = {};
  attendanceRecords.forEach(record => {
    attendanceMap[record.sessionId] = record;
  });

  const disputesMap = {};
  disputes.forEach(d => {
    disputesMap[d.sessionId] = d;
  });

  const msOf = (ts) => {
    if (!ts) return 0;
    if (ts.toMillis) return ts.toMillis();
    if (ts.toDate) return ts.toDate().getTime();
    return new Date(ts).getTime();
  };

  const handleOpenDisputeModal = (session) => {
    setDisputeSession(session);
    setDisputeNote('');
    setDisputePhoto('');
    setDisputeModalOpen(true);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress/resize image to fit inside Firestore document (max size 500KB)
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        if (dataUrl.length > 500000) {
          showToast('Image is too large. Please choose a smaller image.', 'warning');
          return;
        }
        setDisputePhoto(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitDispute = async () => {
    if (!disputeNote.trim() && !disputePhoto) {
      showToast('Please enter an explanation or attach photo evidence.', 'warning');
      return;
    }

    setSubmittingDispute(true);
    try {
      const sessionDate = disputeSession.createdAt?.toDate?.() || new Date();
      const dateString = sessionDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      
      await createDispute(
        studentId,
        disputeSession.id,
        course.courseId,
        userProfile?.name || studentId,
        userProfile?.matricNumber || '',
        userProfile?.courseOfStudy || '',
        course.courseCode,
        course.courseName,
        dateString,
        disputeSession.venue || '',
        disputeNote,
        disputePhoto
      );

      showToast('Dispute submitted successfully!', 'success');
      setDisputeModalOpen(false);

      // Refresh disputes data
      const studentDisputes = await getDisputesForStudent(studentId, course.courseId);
      setDisputes(studentDisputes);
    } catch (err) {
      console.error(err);
      showToast('Failed to submit dispute. Please try again.', 'error');
    } finally {
      setSubmittingDispute(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 600, fontSize: 14 }} onClick={onBack}>
        <ArrowLeft size={16} /> Back to My Progress
      </div>

      <div 
        style={{ 
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '24px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 24,
          boxShadow: '0 12px 24px rgba(15, 23, 42, 0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', right: '-5%', top: '-20%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }} />
        
        <div style={{ 
          width: 56, 
          height: 56, 
          borderRadius: '50%', 
          background: 'rgba(255,255,255,0.08)', 
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <BookOpen size={28} color="#38bdf8" />
        </div>
        <div style={{ flex: 1, zIndex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{course.courseCode}</div>
          <h1 style={{ color: 'white', fontSize: 24, margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>{course.courseName}</h1>
          <div style={{ display: 'flex', gap: 16, color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 8 }}>
            <span>Total Classes: <strong>{course.totalSessions}</strong></span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
            <span>Attended: <strong style={{ color: '#10b981' }}>{course.attendedCount}</strong></span>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: '#f8faff' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Class History</h3>
        </div>
        
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '12px' }}>
            <Loader2 size={24} color="#7c3aed" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>Fetching course history...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No sessions have been held for this course yet.</div>
        ) : (
          <div>
            {sessions.map((session, index) => {
              const record = attendanceMap[session.id];
              const dispute = disputesMap[session.id];
              const isAttended = !!record;
              
              const sessionDate = session.createdAt?.toDate?.() || new Date();
              const dateString = sessionDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
              const timeString = record?.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '--:--';

              return (
                <div key={session.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: index < sessions.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: isAttended ? '#d1fae5' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isAttended ? '#059669' : '#b91c1c' }}>
                      {isAttended ? <CheckCircle size={24} /> : <XCircle size={24} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-main)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={14} color="var(--text-muted)" /> {dateString}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {session.venue}</span>
                        {session.startTime && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {session.startTime} - {session.endTime}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: isAttended ? '#d1fae5' : '#fee2e2', color: isAttended ? '#065f46' : '#991b1b', marginBottom: 4 }}>
                      {isAttended ? 'Present' : 'Missed'}
                    </div>
                    {isAttended ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Signed in at {timeString}</div>
                    ) : (
                      <div style={{ marginTop: 6 }}>
                        {dispute ? (
                          <span style={{
                            display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                            background: dispute.status === 'pending' ? '#fffbeb' : dispute.status === 'approved' ? '#d1fae5' : '#fee2e2',
                            color: dispute.status === 'pending' ? '#d97706' : dispute.status === 'approved' ? '#065f46' : '#991b1b',
                            border: `1px solid ${dispute.status === 'pending' ? '#fde68a' : dispute.status === 'approved' ? '#bbf7d0' : '#fecaca'}`
                          }}>
                            Dispute {dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleOpenDisputeModal(session)}
                            style={{
                              background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '12px', fontWeight: 700,
                              cursor: 'pointer', padding: 0, textDecoration: 'underline'
                            }}
                          >
                            Report Issue
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Issue Modal */}
      {disputeModalOpen && disputeSession && (
        <>
          <div 
            onClick={() => !submittingDispute && setDisputeModalOpen(false)} 
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' }} 
          />
          
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '90%', maxWidth: '500px', background: 'white', zIndex: 2001,
            borderRadius: '20px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            overflow: 'hidden', animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8faff' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Report Attendance Issue</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{course.courseCode} · {course.courseName}</span>
              </div>
              <button 
                disabled={submittingDispute}
                onClick={() => setDisputeModalOpen(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ background: '#f0f4ff', border: '1px solid #e0e7ff', borderRadius: '12px', padding: '14px 16px', fontSize: '13px', color: '#1e293b' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Session Details:</div>
                <div>Date: <strong>{disputeSession.createdAt ? new Date(msOf(disputeSession.createdAt)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown'}</strong></div>
                <div>Venue: <strong>{disputeSession.venue || 'N/A'}</strong></div>
                {disputeSession.startTime && <div>Time: <strong>{disputeSession.startTime} - {disputeSession.endTime}</strong></div>}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Explanation / Evidence Note</label>
                <textarea
                  value={disputeNote}
                  onChange={e => setDisputeNote(e.target.value)}
                  placeholder="Describe why you are disputing this record (e.g. 'I was in class but my location check failed due to GPS drift')"
                  style={{ width: '100%', minHeight: '100px', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '13px', outline: 'none', resize: 'vertical' }}
                  disabled={submittingDispute}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>Attach Photo Evidence (Optional)</label>
                {disputePhoto ? (
                  <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', width: '100%', height: '180px' }}>
                    <img src={disputePhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Evidence preview" />
                    <button
                      onClick={() => setDisputePhoto('')}
                      style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', padding: '6px', color: 'white', cursor: 'pointer', display: 'flex' }}
                      disabled={submittingDispute}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100px', border: '2px dashed var(--border-color)', borderRadius: '12px', cursor: 'pointer', gap: '8px', background: '#fafafa' }} className="image-upload-zone">
                    <Upload size={20} color="var(--text-muted)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Click to upload screenshot or photo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoChange} 
                      style={{ display: 'none' }}
                      disabled={submittingDispute}
                    />
                  </label>
                )}
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', justifyContent: 'flex-end', background: '#f8faff' }}>
              <button
                className="btn"
                style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600, background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                onClick={() => setDisputeModalOpen(false)}
                disabled={submittingDispute}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={handleSubmitDispute}
                disabled={submittingDispute}
              >
                {submittingDispute ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </div>
          </div>

          <style>{`
            @keyframes scaleIn {
              from { transform: translate(-50%, -40%) scale(0.95); opacity: 0; }
              to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
            .image-upload-zone:hover {
              background-color: #f3f4f6 !important;
              border-color: var(--primary-color) !important;
            }
          `}</style>
        </>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
};

const COURSE_THEMES = [
  { primary: '#7c3aed', light: '#f5f3ff', border: '#ddd6fe', gradient: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }, // Purple
  { primary: '#0ea5e9', light: '#f0f9ff', border: '#bae6fd', gradient: 'linear-gradient(90deg, #0ea5e9, #38bdf8)' }, // Blue
  { primary: '#ec4899', light: '#fdf2f8', border: '#fbcfe8', gradient: 'linear-gradient(90deg, #ec4899, #f472b6)' }, // Pink/Rose
  { primary: '#10b981', light: '#f0fdf4', border: '#bbf7d0', gradient: 'linear-gradient(90deg, #10b981, #34d399)' }, // Emerald Green
  { primary: '#f59e0b', light: '#fef3c7', border: '#fde68a', gradient: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }, // Amber/Orange
  { primary: '#6366f1', light: '#e0e7ff', border: '#c7d2fe', gradient: 'linear-gradient(90deg, #6366f1, #818cf8)' }  // Indigo
];

const AttendanceReport = () => {
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const qCourseId = searchParams.get('courseId');
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!currentUser) return;
      try {
        const data = await getStudentAttendanceStats(currentUser.uid);
        setStats(data);
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [currentUser]);

  useEffect(() => {
    if (stats.length > 0 && qCourseId) {
      const target = stats.find(s => s.courseId === qCourseId);
      if (target) {
        setSelectedCourse(target);
      }
    }
  }, [stats, qCourseId]);

  const handleBack = () => {
    setSelectedCourse(null);
    setSearchParams({});
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '320px',
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #f3f4f6',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.015), 0 1px 3px rgba(0, 0, 0, 0.005)',
        padding: '48px',
        textAlign: 'center',
        margin: '20px 0'
      }}>
        <div style={{ marginBottom: '16px', display: 'inline-flex' }}>
          <Loader2 
            size={36} 
            color="#7c3aed" 
            style={{ 
              animation: 'spin 1s linear infinite', 
            }} 
          />
        </div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', margin: '0 0 4px 0' }}>
          Loading your attendance data...
        </h3>
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
          Preparing dynamic progress metrics and courses.
        </p>
        
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (selectedCourse) {
    return <CourseDetailView course={selectedCourse} studentId={currentUser.uid} onBack={handleBack} />;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Student Portal</div>
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px', margin: 0 }}>My Progress</h2>
      </div>

      <div 
        style={{ 
          background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #0f172a 100%)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '24px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 28,
          boxShadow: '0 12px 24px rgba(30, 27, 75, 0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Subtle glow sphere */}
        <div style={{ position: 'absolute', right: '-5%', top: '-20%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none' }} />
        
        <div style={{ 
          width: 56, 
          height: 56, 
          borderRadius: '50%', 
          background: 'rgba(255,255,255,0.08)', 
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <BarChart3 size={28} color="#c084fc" />
        </div>
        <div style={{ flex: 1, zIndex: 1 }}>
          <h1 style={{ color: 'white', fontSize: 24, margin: 0, fontWeight: 800, letterSpacing: '-0.5px' }}>Attendance Report</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: '6px 0 0', lineHeight: 1.4 }}>
            Track your performance and cumulative attendance across all courses.
          </p>
        </div>
      </div>

      <div style={{ marginTop: '32px' }}>
        {stats.length === 0 ? (
          <div style={{ padding: '48px 32px', textAlign: 'center', background: 'white', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <AlertCircle size={40} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>No records found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Once you start marking attendance in new sessions, your progress will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {stats.map((s, idx) => {
              const percentage = s.totalSessions > 0 ? Math.round((s.attendedCount / s.totalSessions) * 100) : 0;
              const isLow = percentage < 75;
              const theme = COURSE_THEMES[idx % COURSE_THEMES.length];

              return (
                <div 
                  key={s.courseId} 
                  onClick={() => setSelectedCourse(s)} 
                  style={{ 
                    background: 'white', 
                    padding: '24px', 
                    borderRadius: '16px', 
                    border: '1px solid #f3f4f6', 
                    borderLeft: `3px solid ${isLow ? '#ef4444' : theme.primary}`,
                    overflow: 'hidden',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.015), 0 1px 3px rgba(0, 0, 0, 0.005)', 
                    cursor: 'pointer', 
                    transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
                    position: 'relative'
                  }} 
                  onMouseEnter={e => {e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.06)'}} 
                  onMouseLeave={e => {e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.015), 0 1px 3px rgba(0, 0, 0, 0.005)'}}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: theme.primary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{s.courseCode}</div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.25, textTransform: 'capitalize' }}>{s.courseName}</h3>
                    </div>
                    <div style={{ 
                      padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                      background: isLow ? '#fef2f2' : theme.light,
                      color: isLow ? '#ef4444' : theme.primary,
                      border: `1px solid ${isLow ? '#fee2e2' : theme.border}`
                    }}>
                      {percentage}%
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 500 }}>Progress</span>
                      <span><strong>{s.attendedCount}</strong> / {s.totalSessions} classes</span>
                    </div>
                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '100px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${percentage}%`, 
                        background: isLow ? 'linear-gradient(90deg, #ef4444, #f87171)' : theme.gradient,
                        borderRadius: '100px',
                        transition: 'width 1s ease-out'
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '1px solid #f9fafb' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <CheckCircle size={14} color="#10b981" />
                      <span>Present: <strong>{s.attendedCount}</strong></span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <Clock size={14} color="#6b7280" />
                      <span>Total Held: <strong>{s.totalSessions}</strong></span>
                    </div>
                  </div>
                  
                  {isLow && (
                    <div style={{ marginTop: '16px', padding: '10px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={14} color="#d97706" />
                      <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 500 }}>Warning: Low attendance. Minimum 75% required.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceReport;
