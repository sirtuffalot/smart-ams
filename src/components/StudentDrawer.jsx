import React, { useState, useEffect } from 'react';
import { X, BookOpen, Hash, GraduationCap, Building2, Mail, Calendar } from 'lucide-react';
import { getUserProfile } from '../utils/db';

const StudentDrawer = ({ student, onClose, courseHistory }) => {
  const studentId = student.studentId || student.id;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(courseHistory ? 'timeline' : 'profile');

  useEffect(() => {
    const fetch = async () => {
      if (!studentId) return;
      try {
        const p = await getUserProfile(studentId);
        setProfile(p);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, [studentId]);

  const Field = ({ icon, label, value }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px', background: '#f8faff', borderRadius: 12, border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: value ? 'var(--text-main)' : 'var(--text-muted)', fontStyle: value ? 'normal' : 'italic', wordBreak: 'break-all' }}>{value || 'Not provided'}</div>
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1000, backdropFilter: 'blur(3px)', animation: 'fadeIn 0.2s ease' }} />
      <div className="student-drawer" style={{ position: 'fixed', top: 16, right: 16, bottom: 16, width: 500, background: 'white', zIndex: 1001, boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)', borderRadius: 20, display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)', overflow: 'hidden' }}>
        
        {/* Drawer Header */}
        <div style={{ padding: '36px 32px 24px', background: 'white', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', transition: 'all 0.2s' }}>
            <X size={18} />
          </button>
          
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(student.studentName || 'S')}&background=e0e7ff&color=4f46e5&size=80`} style={{ width: 80, height: 80, borderRadius: '50%', border: '4px solid #f8faff' }} alt="" />
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: 'var(--text-main)' }}>{student.studentName || 'Student'}</h2>
              {student.matricNumber && <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 12 }}>{student.matricNumber}</div>}
              
              {student.isRosterMode ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: student.status === 'Good' ? '#d1fae5' : student.status === 'Warning' ? '#fef08a' : '#fee2e2', color: student.status === 'Good' ? '#065f46' : student.status === 'Warning' ? '#854d0e' : '#991b1b', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>
                  {student.status === 'Good' ? '⭐' : student.status === 'Warning' ? '⚠️' : '🚨'} Overall Attendance: {student.attendanceRate}%
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: student.status === 'Present' ? '#d1fae5' : '#fee2e2', color: student.status === 'Present' ? '#065f46' : '#991b1b', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>
                  {student.status === 'Present' ? `✓ Signed in` : '✗ Missed Class'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', padding: '0 32px', borderBottom: '1px solid var(--border-color)', background: '#fafbff' }}>
          {courseHistory && (
            <button onClick={() => setActiveTab('timeline')} style={{ flex: 1, padding: '16px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: activeTab === 'timeline' ? 'var(--primary-color)' : 'var(--text-muted)', borderBottom: activeTab === 'timeline' ? '2px solid var(--primary-color)' : '2px solid transparent', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Attendance Timeline
            </button>
          )}
          <button onClick={() => setActiveTab('profile')} style={{ flex: 1, padding: '16px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: activeTab === 'profile' ? 'var(--primary-color)' : 'var(--text-muted)', borderBottom: activeTab === 'profile' ? '2px solid var(--primary-color)' : '2px solid transparent', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Profile Details
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          
          {/* Timeline Tab */}
          {activeTab === 'timeline' && courseHistory && (
            <div style={{ padding: '32px' }}>
              {courseHistory.sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontStyle: 'italic' }}>No sessions hosted yet.</div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: 14 }}>
                  {/* Vertical Line */}
                  <div style={{ position: 'absolute', top: 16, bottom: 30, left: 21, width: 2, background: 'var(--border-color)', zIndex: 1 }} />
                  
                  {courseHistory.sessions.map((sess) => {
                    const rec = courseHistory.attendanceRecords.find(r => r.sessionId === sess.id && r.studentId === studentId);
                    const isPresent = !!rec;
                    
                    const msOf = (ts) => {
                      if (!ts) return 0;
                      if (ts.toMillis) return ts.toMillis();
                      if (ts.toDate) return ts.toDate().getTime();
                      return new Date(ts).getTime();
                    };
                    const dateStr = sess.createdAt ? new Date(msOf(sess.createdAt)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown Date';
                    const timeStr = rec?.timestamp ? new Date(msOf(rec.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    
                    return (
                      <div key={sess.id} style={{ position: 'relative', marginBottom: 24, zIndex: 2 }}>
                        {/* Dot */}
                        <div style={{ position: 'absolute', left: 0, top: 12, width: 14, height: 14, borderRadius: '50%', background: isPresent ? '#10b981' : '#ef4444', border: '3px solid white', boxShadow: '0 0 0 1px var(--border-color)' }} />
                        
                        {/* Content Card */}
                        <div style={{ marginLeft: 36, padding: '16px 20px', background: isPresent ? '#f0fdf4' : '#fef2f2', border: `1px solid ${isPresent ? '#bbf7d0' : '#fecaca'}`, borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: isPresent ? '#166534' : '#991b1b', marginBottom: 4 }}>{dateStr}</div>
                            {isPresent && timeStr ? (
                              <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Signed in at {timeStr}</div>
                            ) : (
                              <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>Missed class</div>
                            )}
                          </div>
                          <div>
                            {isPresent ? (
                              <div style={{ background: '#d1fae5', color: '#065f46', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Present</div>
                            ) : (
                              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Absent</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div style={{ padding: '32px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading profile...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field icon={<Mail size={16} color="var(--primary-color)" />} label="Email" value={profile?.email} />
                  </div>
                  <Field icon={<Hash size={16} color="var(--primary-color)" />} label="Matric Number" value={profile?.matricNumber} />
                  <Field icon={<GraduationCap size={16} color="var(--primary-color)" />} label="Level" value={profile?.level ? `${profile.level} Level` : null} />
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field icon={<BookOpen size={16} color="var(--primary-color)" />} label="Course of Study" value={profile?.courseOfStudy} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Field icon={<Building2 size={16} color="var(--primary-color)" />} label="College / Faculty" value={profile?.college} />
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      <style>{`
        @keyframes slideInRight { from { transform:translateX(calc(100% + 16px)); opacity: 0; } to { transform:translateX(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        .student-drawer::-webkit-scrollbar { width: 5px; }
        .student-drawer::-webkit-scrollbar-track { background: transparent; }
        .student-drawer::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>
    </>
  );
};

export default StudentDrawer;
