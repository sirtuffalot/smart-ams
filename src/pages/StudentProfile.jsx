import React, { useState, useEffect } from 'react';
import { UserCircle, Hash, BookOpen, Building2, GraduationCap, Mail, Save, CheckCircle, AlertCircle, Edit3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const LEVELS = ['100', '200', '300', '400', '500', '600'];
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

const StudentProfile = () => {
  const { currentUser, userProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error'

  const [form, setForm] = useState({
    name: '',
    matricNumber: '',
    courseOfStudy: '',
    college: '',
    level: '',
  });

  useEffect(() => {
    if (userProfile) {
      setForm({
        name: userProfile.name || '',
        matricNumber: userProfile.matricNumber || '',
        courseOfStudy: userProfile.courseOfStudy || '',
        college: userProfile.college || '',
        level: userProfile.level || '',
      });
    }
  }, [userProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'college') {
      setForm(prev => ({ ...prev, college: value, courseOfStudy: '' }));
    } else if (name === 'matricNumber') {
      setForm(prev => ({ ...prev, matricNumber: value.toUpperCase() }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: form.name,
        matricNumber: form.matricNumber,
        courseOfStudy: form.courseOfStudy,
        college: form.college,
        level: form.level,
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

  const completionFields = ['name', 'matricNumber', 'courseOfStudy', 'college', 'level'];
  const filled = completionFields.filter(f => form[f]).length;
  const completionPct = Math.round((filled / completionFields.length) * 100);

  return (
    <div>
      <div className="breadcrumbs">
        <span>My Profile</span>
      </div>

      {/* Hero Banner */}
      <div className="profile-hero">
        <div className="profile-avatar-wrap">
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(form.name || currentUser.email)}&background=4f46e5&color=fff&size=128`}
            alt="avatar"
            className="profile-avatar"
          />
          <div className="profile-avatar-ring" />
        </div>
        <div className="profile-hero-info">
          <h1>{form.name || 'Student'}</h1>
          <p>{currentUser.email}</p>
          <div className="profile-tags">
            {form.level && <span className="profile-tag">{form.level} Level</span>}
            {form.college && <span className="profile-tag">{form.college.match(/\(([^)]+)\)/)?.[1] || form.college}</span>}
            {form.courseOfStudy && <span className="profile-tag">{form.courseOfStudy.match(/\(([^)]+)\)/)?.[1] || form.courseOfStudy}</span>}
          </div>
        </div>
        <div className="profile-completion-wrap">
          <div className="profile-completion-label">Profile Completion</div>
          <div className="profile-completion-bar-bg">
            <div className="profile-completion-bar-fill" style={{ width: `${completionPct}%` }} />
          </div>
          <div className="profile-completion-pct">{completionPct}%</div>
        </div>
      </div>

      {/* Save status banner */}
      {saveStatus === 'success' && (
        <div className="save-banner save-banner-success">
          <CheckCircle size={16} /> Profile updated successfully!
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="save-banner save-banner-error">
          <AlertCircle size={16} /> Failed to save. Please try again.
        </div>
      )}

      {/* Profile Details Card */}
      <div className="profile-card">
        <div className="profile-card-header">
          <h3>Personal Information</h3>
          {!isEditing ? (
            <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setIsEditing(true)}>
              <Edit3 size={16} /> Edit Profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} disabled={saving} onClick={handleSave}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        <div className="profile-fields-grid">
          {/* Full Name */}
          <div className="profile-field">
            <div className="profile-field-icon"><UserCircle size={20} /></div>
            <div className="profile-field-body">
              <label>Full Name</label>
              {isEditing ? (
                <input name="name" value={form.name} onChange={handleChange} placeholder="Your full name" />
              ) : (
                <span className={form.name ? '' : 'empty-field'}>{form.name || 'Not set'}</span>
              )}
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="profile-field">
            <div className="profile-field-icon"><Mail size={20} /></div>
            <div className="profile-field-body">
              <label>Email Address</label>
              <span className="field-readonly">{currentUser.email}</span>
            </div>
          </div>

          {/* Matric Number */}
          <div className="profile-field">
            <div className="profile-field-icon"><Hash size={20} /></div>
            <div className="profile-field-body">
              <label>Matric Number</label>
              {isEditing ? (
                <input name="matricNumber" value={form.matricNumber} onChange={handleChange} placeholder="e.g. 20/52CB/01234" />
              ) : (
                <span className={form.matricNumber ? '' : 'empty-field'}>{form.matricNumber || 'Not set'}</span>
              )}
            </div>
          </div>

          {/* College */}
          <div className="profile-field">
            <div className="profile-field-icon"><Building2 size={20} /></div>
            <div className="profile-field-body">
              <label>College / Faculty</label>
              {isEditing ? (
                <select name="college" value={form.college} onChange={handleChange}>
                  <option value="">-- Select College --</option>
                  {Object.keys(UNIVERSITY_STRUCTURE).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <span className={form.college ? '' : 'empty-field'}>{form.college || 'Not set'}</span>
              )}
            </div>
          </div>

          {/* Course of Study */}
          <div className="profile-field">
            <div className="profile-field-icon"><BookOpen size={20} /></div>
            <div className="profile-field-body">
              <label>Course of Study (Department)</label>
              {isEditing ? (
                <select name="courseOfStudy" value={form.courseOfStudy} onChange={handleChange} disabled={!form.college}>
                  <option value="">-- Select Course of Study --</option>
                  {form.college && UNIVERSITY_STRUCTURE[form.college]?.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : (
                <span className={form.courseOfStudy ? '' : 'empty-field'}>{form.courseOfStudy || 'Not set'}</span>
              )}
            </div>
          </div>

          {/* Level */}
          <div className="profile-field">
            <div className="profile-field-icon"><GraduationCap size={20} /></div>
            <div className="profile-field-body">
              <label>Level</label>
              {isEditing ? (
                <select name="level" value={form.level} onChange={handleChange}>
                  <option value="">-- Select Level --</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l} Level</option>)}
                </select>
              ) : (
                <span className={form.level ? '' : 'empty-field'}>{form.level ? `${form.level} Level` : 'Not set'}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Incomplete profile nudge */}
      {completionPct < 100 && (
        <div className="profile-nudge">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Your profile is incomplete.</strong> A complete profile ensures your name and matric number appear correctly on attendance records.
            {!isEditing && (
              <span className="nudge-link" onClick={() => setIsEditing(true)}> Click "Edit Profile" to complete it.</span>
            )}
          </div>
        </div>
      )}

      <style>{`
        .profile-hero {
          display: flex;
          align-items: center;
          gap: 32px;
          background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%);
          border-radius: 20px;
          padding: 32px 40px;
          margin-bottom: 32px;
          color: white;
          position: relative;
          overflow: hidden;
        }
        .profile-hero::before {
          content: '';
          position: absolute;
          top: -60px; right: -60px;
          width: 200px; height: 200px;
          background: rgba(255,255,255,0.07);
          border-radius: 50%;
        }
        .profile-avatar-wrap { position: relative; flex-shrink: 0; }
        .profile-avatar { width: 88px; height: 88px; border-radius: 50%; border: 4px solid rgba(255,255,255,0.5); display: block; }
        .profile-avatar-ring {
          position: absolute; top: -4px; left: -4px;
          width: 96px; height: 96px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
        }
        .profile-hero-info { flex: 1; }
        .profile-hero-info h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
        .profile-hero-info p { font-size: 14px; opacity: 0.8; margin-bottom: 12px; }
        .profile-tags { display: flex; gap: 8px; flex-wrap: wrap; }
        .profile-tag {
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.3);
          padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
        }
        .profile-completion-wrap { text-align: right; flex-shrink: 0; min-width: 160px; }
        .profile-completion-label { font-size: 12px; opacity: 0.8; margin-bottom: 8px; }
        .profile-completion-bar-bg { height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; margin-bottom: 6px; }
        .profile-completion-bar-fill { height: 100%; background: white; border-radius: 4px; transition: width 0.6s ease; }
        .profile-completion-pct { font-size: 24px; font-weight: 700; }

        .save-banner {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 20px; border-radius: 10px; margin-bottom: 20px;
          font-size: 14px; font-weight: 500;
        }
        .save-banner-success { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
        .save-banner-error { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

        .profile-card {
          background: white; border-radius: 16px;
          border: 1px solid var(--border-color);
          padding: 28px 32px;
          margin-bottom: 24px;
        }
        .profile-card-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 28px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border-color);
        }
        .profile-card-header h3 { font-size: 18px; font-weight: 700; }

        .profile-fields-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
        }
        .profile-field {
          display: flex; align-items: flex-start; gap: 16px;
          padding: 20px 0;
          border-bottom: 1px solid var(--border-color);
        }
        .profile-field:nth-last-child(-n+2) { border-bottom: none; }
        .profile-field-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: var(--primary-light);
          display: flex; align-items: center; justify-content: center;
          color: var(--primary-color); flex-shrink: 0;
        }
        .profile-field-body { flex: 1; }
        .profile-field-body label {
          display: block; font-size: 12px; font-weight: 600;
          color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .profile-field-body span { font-size: 15px; font-weight: 500; color: var(--text-main); }
        .profile-field-body .empty-field { color: var(--text-muted); font-style: italic; }
        .profile-field-body .field-readonly { color: var(--text-muted); font-size: 14px; }
        .profile-field-body input,
        .profile-field-body select {
          width: 100%; padding: 8px 12px;
          border: 1px solid var(--border-color); border-radius: 8px;
          font-size: 14px; outline: none; margin-right: 16px;
          transition: border-color 0.2s;
        }
        .profile-field-body input:focus,
        .profile-field-body select:focus { border-color: var(--primary-color); }

        .profile-nudge {
          display: flex; gap: 12px; align-items: flex-start;
          background: #fffbeb; border: 1px solid #fde68a;
          padding: 16px 20px; border-radius: 12px; color: #92400e;
          font-size: 14px;
        }
        .nudge-link { color: var(--primary-color); cursor: pointer; font-weight: 600; text-decoration: underline; }

        @media (max-width: 768px) {
          .profile-hero { 
            flex-direction: column; 
            text-align: center; 
            padding: 24px;
            gap: 20px;
          }
          .profile-avatar { width: 72px; height: 72px; }
          .profile-avatar-ring { width: 80px; height: 80px; }
          .profile-hero-info h1 { font-size: 24px; }
          .profile-tags { justify-content: center; }
          .profile-completion-wrap { text-align: center; width: 100%; min-width: unset; }
          
          .profile-card { padding: 20px; }
          .profile-card-header { flex-direction: column; gap: 16px; align-items: stretch; text-align: center; }
          .profile-card-header div { justify-content: center; }
          
          .profile-fields-grid { grid-template-columns: 1fr; }
          .profile-field { padding: 16px 0; }
          .profile-field:nth-last-child(-n+2) { border-bottom: 1px solid var(--border-color); }
          .profile-field:last-child { border-bottom: none; }
        }
      `}</style>
    </div>
  );
};

export default StudentProfile;
