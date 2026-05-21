import React, { useState, useEffect } from 'react';
import { UserCircle, Building2, BookOpen, MapPin, Mail, Save, CheckCircle, AlertCircle, Edit3, GraduationCap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const TITLES = ['Dr.', 'Prof.', 'Mr.', 'Mrs.', 'Ms.'];

const UNIVERSITY_STRUCTURE = {
  'College of Engineering (CoE)': [
    'Chemical Engineering',
    'Civil Engineering',
    'Computer Engineering',
    'Electrical and Electronics Engineering',
    'Information and Communication Engineering (ICE)',
    'Mechanical Engineering',
    'Petroleum Engineering'
  ],
  'College of Science and Technology (CST)': [
    'Computer Science',
    'Management Information Systems (MIS)',
    'Architecture',
    'Building Technology',
    'Estate Management',
    'Biochemistry',
    'Microbiology',
    'Biology (Applied Biology and Biotechnology)',
    'Industrial Chemistry',
    'Industrial Mathematics',
    'Industrial Physics'
  ],
  'College of Management and Social Sciences (CMSS)': [
    'Accounting',
    'Banking and Finance',
    'Business Administration',
    'Industrial Relations and Human Resource Management (IRHRM)',
    'Marketing',
    'Economics',
    'Demography and Social Statistics',
    'Mass Communication',
    'Sociology'
  ],
  'College of Leadership and Development Studies (CLDS)': [
    'International Relations',
    'Political Science',
    'Policy and Strategic Studies',
    'English',
    'Psychology'
  ]
};

const LecturerProfile = () => {
  const { currentUser, userProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error'

  const [form, setForm] = useState({
    title: '',
    name: '',
    college: '',
    department: '',
    office: '',
  });

  useEffect(() => {
    if (userProfile) {
      setForm({
        title: userProfile.title || '',
        name: userProfile.name || '',
        college: userProfile.college || '',
        department: userProfile.department || '',
        office: userProfile.office || '',
      });
    }
  }, [userProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'college') {
      // Reset department when college changes
      setForm(prev => ({ ...prev, college: value, department: '' }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        title: form.title,
        name: form.name,
        college: form.college,
        department: form.department,
        office: form.office,
      });
      setSaveStatus('success');
      setIsEditing(false);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const completionFields = ['title', 'name', 'college', 'department', 'office'];
  const filled = completionFields.filter(f => form[f]).length;
  const completionPct = Math.round((filled / completionFields.length) * 100);

  const formattedName = `${form.title ? form.title + ' ' : ''}${form.name || 'Lecturer'}`;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
      <div className="breadcrumbs" style={{ marginBottom: 24 }}>
        <span style={{ color: 'var(--primary-color)', fontWeight: 600, fontSize: 14 }}>My Profile</span>
      </div>

      {/* Hero Banner */}
      <div className="profile-hero" style={{
        display: 'flex', alignItems: 'center', gap: 32,
        background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
        borderRadius: 20, padding: '36px 40px', marginBottom: 32,
        color: 'white', position: 'relative', overflow: 'hidden',
        boxShadow: '0 10px 25px rgba(124, 58, 237, 0.2)'
      }}>
        <div style={{
          position: 'absolute', top: -80, right: -40, width: 250, height: 250,
          background: 'rgba(255,255,255,0.06)', borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute', bottom: -60, right: 120, width: 150, height: 150,
          background: 'rgba(255,255,255,0.04)', borderRadius: '50%'
        }} />
        
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(form.name || currentUser.email)}&background=ffffff&color=7c3aed&size=128&bold=true`}
            alt="avatar"
            style={{ width: 96, height: 96, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.4)', display: 'block' }}
          />
        </div>
        
        <div style={{ flex: 1, zIndex: 1 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.5px' }}>{formattedName}</h1>
          <p style={{ fontSize: 15, opacity: 0.9, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mail size={16} /> {currentUser.email}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {form.college && <span style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{form.college.match(/\(([^)]+)\)/)?.[1] || form.college}</span>}
            {form.department && <span style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{form.department.match(/\(([^)]+)\)/)?.[1] || form.department}</span>}
            {form.office && <span style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{form.office}</span>}
          </div>
        </div>
        
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 160, zIndex: 1 }}>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Profile Completion</div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 4, marginBottom: 8 }}>
            <div style={{ width: `${completionPct}%`, height: '100%', background: 'white', borderRadius: 4, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>{completionPct}%</div>
        </div>
      </div>

      {/* Save status banner */}
      {saveStatus === 'success' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderRadius: 12, marginBottom: 24, fontSize: 14, fontWeight: 600, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
          <CheckCircle size={18} /> Profile updated successfully!
        </div>
      )}
      {saveStatus === 'error' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderRadius: 12, marginBottom: 24, fontSize: 14, fontWeight: 600, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
          <AlertCircle size={18} /> Failed to save. Please try again.
        </div>
      )}

      {/* Incomplete profile nudge */}
      {completionPct < 100 && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fde68a', padding: '16px 20px', borderRadius: 14, color: '#b45309', fontSize: 14, marginBottom: 24, boxShadow: '0 2px 8px rgba(251,191,36,0.1)' }}>
          <AlertCircle size={20} style={{ flexShrink: 0, color: '#d97706' }} />
          <div style={{ lineHeight: 1.5 }}>
            <strong style={{ color: '#92400e', fontSize: 15 }}>Your profile is incomplete.</strong><br/> A complete profile ensures your accurate title and department appear for your students during live sessions.
            {!isEditing && (
              <span onClick={() => setIsEditing(true)} style={{ color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 700, marginLeft: 6 }}>Click here to complete it.</span>
            )}
          </div>
        </div>
      )}

      {/* Profile Details Card */}
      <div style={{ background: 'white', borderRadius: 18, border: '1px solid var(--border-color)', padding: '32px 36px', boxShadow: '0 4px 14px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>Academic Profile</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Manage your personal and academic information.</p>
          </div>
          {!isEditing ? (
            <button 
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--bg-page)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: 50, fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#d1d5db'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-page)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
              onClick={() => setIsEditing(true)}
            >
              <Edit3 size={16} /> Edit Profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                style={{ padding: '10px 20px', background: 'white', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 50, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                onClick={() => {
                  setIsEditing(false);
                  setForm({
                    title: userProfile?.title || '',
                    name: userProfile?.name || '',
                    college: userProfile?.college || '',
                    department: userProfile?.department || '',
                    office: userProfile?.office || '',
                  });
                }}
              >
                Cancel
              </button>
              <button 
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', color: 'white', border: 'none', borderRadius: 50, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)', opacity: saving ? 0.7 : 1 }}
                disabled={saving} 
                onClick={handleSave}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', flexShrink: 0 }}>
              <GraduationCap size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Academic Title</label>
              {isEditing ? (
                <select 
                  name="title" value={form.title} onChange={handleChange} 
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 10, fontSize: 14, outline: 'none', background: 'white' }}
                >
                  <option value="">-- Select Title --</option>
                  {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 600, color: form.title ? 'var(--text-main)' : 'var(--text-muted)' }}>{form.title || 'Not set'}</div>
              )}
            </div>
          </div>

          {/* Full Name */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', flexShrink: 0 }}>
              <UserCircle size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Full Name</label>
              {isEditing ? (
                <input 
                  name="name" value={form.name} onChange={handleChange} placeholder="e.g. John Doe"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 10, fontSize: 14, outline: 'none' }}
                />
              ) : (
                <div style={{ fontSize: 16, fontWeight: 600, color: form.name ? 'var(--text-main)' : 'var(--text-muted)' }}>{form.name || 'Not set'}</div>
              )}
            </div>
          </div>

          {/* College */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', flexShrink: 0 }}>
              <Building2 size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>College</label>
              {isEditing ? (
                <select 
                  name="college" value={form.college} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 10, fontSize: 14, outline: 'none', background: 'white' }}
                >
                  <option value="">-- Select College --</option>
                  {Object.keys(UNIVERSITY_STRUCTURE).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 600, color: form.college ? 'var(--text-main)' : 'var(--text-muted)' }}>{form.college || 'Not set'}</div>
              )}
            </div>
          </div>

          {/* Department */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', flexShrink: 0 }}>
              <BookOpen size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Department</label>
              {isEditing ? (
                <select 
                  name="department" value={form.department} onChange={handleChange} disabled={!form.college}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 10, fontSize: 14, outline: 'none', background: !form.college ? 'var(--bg-page)' : 'white' }}
                >
                  <option value="">-- Select Department --</option>
                  {form.college && UNIVERSITY_STRUCTURE[form.college]?.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 600, color: form.department ? 'var(--text-main)' : 'var(--text-muted)' }}>{form.department || 'Not set'}</div>
              )}
            </div>
          </div>

          {/* Office Location */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, gridColumn: '1 / -1' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', flexShrink: 0 }}>
              <MapPin size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Office Location</label>
              {isEditing ? (
                <input 
                  name="office" value={form.office} onChange={handleChange} placeholder="e.g. Room 304, CST Building"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 10, fontSize: 14, outline: 'none' }}
                />
              ) : (
                <div style={{ fontSize: 16, fontWeight: 600, color: form.office ? 'var(--text-main)' : 'var(--text-muted)' }}>{form.office || 'Not set'}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LecturerProfile;
