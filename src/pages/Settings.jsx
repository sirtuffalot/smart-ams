import React, { useState, useEffect, useCallback } from 'react';
import { Camera, MapPin, CheckCircle, XCircle, AlertCircle, Moon, Sun, Monitor, Vibrate, Zap, Bell, Mail, Shield, LogOut, Trash2, Lock, ChevronRight, RefreshCw, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

// ── Helpers ──────────────────────────────────────────────────────────────────
const getFromStorage = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const saveToStorage = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

// ── Toggle Switch Component ──────────────────────────────────────────────────
const Toggle = ({ checked, onChange, disabled = false, color = 'var(--primary-color)' }) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => !disabled && onChange(!checked)}
    style={{
      width: 48, height: 26, borderRadius: 13, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      background: checked ? color : '#d1d5db', position: 'relative', transition: 'background 0.25s ease',
      flexShrink: 0, opacity: disabled ? 0.5 : 1, padding: 0,
    }}
  >
    <span style={{
      position: 'absolute', top: 3, left: checked ? 25 : 3, width: 20, height: 20,
      borderRadius: '50%', background: 'white', transition: 'left 0.25s ease',
      boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
    }} />
  </button>
);

// ── Permission Status Badge ──────────────────────────────────────────────────
const PermBadge = ({ status }) => {
  const map = {
    granted: { label: 'Granted', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: <CheckCircle size={12} /> },
    denied:  { label: 'Denied',  color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: <XCircle size={12} /> },
    prompt:  { label: 'Not Set', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: <AlertCircle size={12} /> },
    unknown: { label: 'Unknown', color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', icon: <AlertCircle size={12} /> },
  };
  const s = map[status] || map.unknown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {s.icon} {s.label}
    </span>
  );
};

// ── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, subtitle }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
    <div style={{
      width: 38, height: 38, borderRadius: 11, background: 'var(--primary-light)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', flexShrink: 0,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.2px' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>}
    </div>
  </div>
);

// ── Main Settings Page ───────────────────────────────────────────────────────
const Settings = () => {
  const { currentUser, userProfile, userRole, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // ── Permission States ────────────────────────────────────────────────────
  const [camStatus, setCamStatus]  = useState('unknown');
  const [locStatus, setLocStatus]  = useState('unknown');
  const [requestingCam, setRequestingCam] = useState(false);
  const [requestingLoc, setRequestingLoc] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(() => getFromStorage('pref_camera', ''));

  // ── App Preferences ──────────────────────────────────────────────────────
  const [theme,      setTheme]      = useState(() => getFromStorage('pref_theme', 'system'));
  const [haptics,    setHaptics]    = useState(() => getFromStorage('pref_haptics', true));
  const [animations, setAnimations] = useState(() => getFromStorage('pref_animations', true));

  // ── Notification Prefs ───────────────────────────────────────────────────
  const [classReminders, setClassReminders] = useState(() => getFromStorage('pref_class_reminders', true));
  const [attendanceReceipts, setAttendanceReceipts] = useState(() => getFromStorage('pref_att_receipts', false));

  // ── Account ──────────────────────────────────────────────────────────────
  const [sendingReset, setSendingReset] = useState(false);

  // Check actual browser permission state
  const refreshPermissions = useCallback(async () => {
    if (navigator.permissions) {
      try {
        const cam = await navigator.permissions.query({ name: 'camera' });
        setCamStatus(cam.state);
        cam.onchange = () => {
          setCamStatus(cam.state);
          if (cam.state === 'granted') loadCameras();
        };
      } catch { setCamStatus('unknown'); }
      try {
        const loc = await navigator.permissions.query({ name: 'geolocation' });
        setLocStatus(loc.state);
        loc.onchange = () => setLocStatus(loc.state);
      } catch { setLocStatus('unknown'); }
    }
  }, []);

  const loadCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (e) {
      console.warn('Could not load cameras', e);
    }
  };

  useEffect(() => { 
    refreshPermissions();
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop());
        loadCameras();
      }).catch(() => {});
  }, [refreshPermissions]);

  useEffect(() => { saveToStorage('pref_camera', selectedCamera); }, [selectedCamera]);

  // Save preferences when they change
  useEffect(() => { saveToStorage('pref_haptics', haptics); }, [haptics]);
  useEffect(() => { saveToStorage('pref_animations', animations); }, [animations]);
  useEffect(() => { saveToStorage('pref_class_reminders', classReminders); }, [classReminders]);
  useEffect(() => { saveToStorage('pref_att_receipts', attendanceReceipts); }, [attendanceReceipts]);
  useEffect(() => {
    saveToStorage('pref_theme', theme);
    document.documentElement.setAttribute('data-theme',
      theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme
    );
  }, [theme]);

  const handleRequestCamera = async () => {
    setRequestingCam(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      setCamStatus('granted');
      showToast('Camera access granted! 🎉', 'success');
    } catch (e) {
      setCamStatus('denied');
      showToast('Camera access denied. Please enable it in your device settings.', 'error');
    } finally { setRequestingCam(false); }
  };

  const handleRequestLocation = () => {
    setRequestingLoc(true);
    navigator.geolocation.getCurrentPosition(
      () => { setLocStatus('granted'); showToast('Location access granted! 🎉', 'success'); setRequestingLoc(false); },
      () => { setLocStatus('denied');  showToast('Location access denied. Please enable it in your device settings.', 'error'); setRequestingLoc(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePasswordReset = async () => {
    if (!currentUser?.email) return;
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      showToast(`Password reset email sent to ${currentUser.email}`, 'success');
    } catch (e) {
      showToast('Failed to send reset email. Try again.', 'error');
    } finally { setSendingReset(false); }
  };

  const cardStyle = {
    background: 'white', borderRadius: 16, border: '1px solid var(--border-color)',
    padding: '22px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
    marginBottom: 20,
  };

  const rowStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 0', borderBottom: '1px solid #f3f4f6',
  };
  const lastRowStyle = { ...rowStyle, borderBottom: 'none', paddingBottom: 0 };

  // Determine if permissions need attention (for the top banner)
  const needsPermissions = camStatus !== 'granted' || locStatus !== 'granted';

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', animation: 'settingsFadeIn 0.35s ease' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
          Settings
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
          Manage your permissions, preferences, and account security.
        </p>
      </div>

      {/* ── PERMISSION ATTENTION BANNER ── */}
      {needsPermissions && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
          border: '1px solid #fde68a', borderRadius: 14, padding: '16px 20px',
          marginBottom: 24, display: 'flex', gap: 14, alignItems: 'flex-start',
          boxShadow: '0 4px 16px rgba(251,191,36,0.15)',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: '#fef9c3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, border: '1px solid #fde68a',
          }}>
            <AlertCircle size={20} color="#d97706" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#92400e', marginBottom: 4 }}>
              Action Required — Permissions Missing
            </div>
            <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.55 }}>
              Beacon needs <strong>Camera</strong> and <strong>Location</strong> access to mark attendance.
              Use the toggles below to grant access. Without these, QR scanning and GPS verification will not work.
            </div>
          </div>
        </div>
      )}

      {/* ── DEVICE PERMISSIONS ── */}
      <div style={cardStyle}>
        <SectionHeader
          icon={<Shield size={18} />}
          title="Device Permissions"
          subtitle="Required for attendance marking to function"
        />

        {/* Camera Row */}
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 13,
              background: camStatus === 'granted' ? '#ecfdf5' : camStatus === 'denied' ? '#fef2f2' : '#f0f9ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              border: `1px solid ${camStatus === 'granted' ? '#a7f3d0' : camStatus === 'denied' ? '#fecaca' : '#bae6fd'}`,
            }}>
              <Camera size={20} color={camStatus === 'granted' ? '#059669' : camStatus === 'denied' ? '#dc2626' : '#0284c7'} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Camera</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Required to scan QR codes for attendance</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <PermBadge status={camStatus} />
            {camStatus !== 'granted' && (
              <button
                onClick={handleRequestCamera}
                disabled={requestingCam}
                style={{
                  padding: '7px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: 'var(--primary-color)', color: 'white', border: 'none',
                  opacity: requestingCam ? 0.7 : 1, transition: 'all 0.2s ease',
                  boxShadow: '0 3px 10px rgba(124,58,237,0.25)',
                }}
              >
                {requestingCam ? 'Requesting…' : 'Allow Access'}
              </button>
            )}
          </div>
        </div>

        {/* Camera Selector */}
        {camStatus === 'granted' && availableCameras.length > 0 && (
          <div style={rowStyle}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Default Camera</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Choose which camera to use for scanning</div>
            </div>
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: 'var(--bg-page)', border: '1px solid var(--border-color)',
                color: 'var(--text-main)', outline: 'none', maxWidth: 180, cursor: 'pointer'
              }}
            >
              {availableCameras.map(cam => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label || `Camera ${cam.deviceId.substring(0,5)}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Location Row */}
        <div style={lastRowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 13,
              background: locStatus === 'granted' ? '#ecfdf5' : locStatus === 'denied' ? '#fef2f2' : '#fff7ed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              border: `1px solid ${locStatus === 'granted' ? '#a7f3d0' : locStatus === 'denied' ? '#fecaca' : '#fed7aa'}`,
            }}>
              <MapPin size={20} color={locStatus === 'granted' ? '#059669' : locStatus === 'denied' ? '#dc2626' : '#ea580c'} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Location Services</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Used to verify you're physically in class</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <PermBadge status={locStatus} />
            {locStatus !== 'granted' && (
              <button
                onClick={handleRequestLocation}
                disabled={requestingLoc}
                style={{
                  padding: '7px 16px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: 'var(--primary-color)', color: 'white', border: 'none',
                  opacity: requestingLoc ? 0.7 : 1, transition: 'all 0.2s ease',
                  boxShadow: '0 3px 10px rgba(124,58,237,0.25)',
                }}
              >
                {requestingLoc ? 'Requesting…' : 'Allow Access'}
              </button>
            )}
          </div>
        </div>

        {/* iOS instruction if denied */}
        {(camStatus === 'denied' || locStatus === 'denied') && (
          <div style={{
            marginTop: 16, padding: '14px 16px', borderRadius: 10, background: '#fef2f2',
            border: '1px solid #fecaca', fontSize: 12, color: '#991b1b', lineHeight: 1.6,
          }}>
            <strong>📱 To fix on iPad/iPhone:</strong> Open your iPad's <strong>Settings → Privacy & Security →
            {camStatus === 'denied' ? ' Camera' : ''}{camStatus === 'denied' && locStatus === 'denied' ? ' / ' : ''}
            {locStatus === 'denied' ? ' Location Services' : ''}</strong> and enable access for <strong>Safari</strong> or <strong>Beacon</strong>.
            Then come back and tap "Allow Access" again.
          </div>
        )}

        {/* Refresh button */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={refreshPermissions}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              background: 'var(--bg-page)', border: '1px solid var(--border-color)',
              borderRadius: 9, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
          >
            <RefreshCw size={12} /> Refresh Status
          </button>
        </div>
      </div>

      {/* ── APPEARANCE ── */}
      <div style={cardStyle}>
        <SectionHeader icon={<Sun size={18} />} title="Appearance" subtitle="Personalise how Beacon looks" />

        {/* Theme selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 10 }}>Theme</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { value: 'light',  icon: <Sun size={18} />,     label: 'Light' },
              { value: 'dark',   icon: <Moon size={18} />,    label: 'Dark'  },
              { value: 'system', icon: <Monitor size={18} />, label: 'Auto'  },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 12, border: '2px solid',
                  borderColor: theme === opt.value ? 'var(--primary-color)' : 'var(--border-color)',
                  background: theme === opt.value ? 'var(--primary-light)' : 'var(--bg-page)',
                  color: theme === opt.value ? 'var(--primary-color)' : 'var(--text-muted)',
                  cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: 'all 0.2s ease',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Haptics */}
        <div style={rowStyle}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Haptic Feedback</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Subtle vibrations on scan success or failure</div>
          </div>
          <Toggle checked={haptics} onChange={setHaptics} color="#7c3aed" />
        </div>

        {/* Animations */}
        <div style={lastRowStyle}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Reduce Animations</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Disable transitions for a faster, simpler look</div>
          </div>
          <Toggle checked={!animations} onChange={v => setAnimations(!v)} color="#7c3aed" />
        </div>
      </div>

      {/* ── NOTIFICATIONS ── (student only) */}
      {userRole === 'student' && (
        <div style={cardStyle}>
          <SectionHeader icon={<Bell size={18} />} title="Notifications & Alerts" subtitle="Control when Beacon alerts you" />

          <div style={rowStyle}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Class Reminders</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Get notified 15 mins before a scheduled session</div>
            </div>
            <Toggle checked={classReminders} onChange={setClassReminders} color="#0d9488" />
          </div>

          <div style={lastRowStyle}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Attendance Receipts</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Receive an email when your attendance is recorded</div>
            </div>
            <Toggle checked={attendanceReceipts} onChange={setAttendanceReceipts} color="#0d9488" />
          </div>
        </div>
      )}

      {/* ── ACCOUNT & SECURITY ── */}
      <div style={cardStyle}>
        <SectionHeader icon={<Lock size={18} />} title="Account & Security" subtitle="Manage your credentials and data" />

        {/* Account info row */}
        <div style={{ ...rowStyle, cursor: 'default' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Signed In As</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{currentUser?.email}</div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: userRole === 'lecturer' ? 'var(--primary-light)' : '#f0fdfa',
            color: userRole === 'lecturer' ? 'var(--primary-color)' : '#0d9488',
            border: `1px solid ${userRole === 'lecturer' ? 'rgba(124,58,237,0.2)' : '#99f6e4'}`,
            textTransform: 'capitalize',
          }}>
            {userRole}
          </span>
        </div>

        {/* Change password */}
        <div
          style={{ ...rowStyle, cursor: 'pointer' }}
          onClick={handlePasswordReset}
          onMouseEnter={e => e.currentTarget.style.background = '#f8faff'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
              {sendingReset ? 'Sending Reset Email…' : 'Change Password'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              We'll send a reset link to your email address
            </div>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </div>

        {/* Edit Profile */}
        <div
          style={{ ...rowStyle, cursor: 'pointer' }}
          onClick={() => navigate(userRole === 'lecturer' ? '/lecturer/profile' : '/profile')}
          onMouseEnter={e => e.currentTarget.style.background = '#f8faff'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>Edit Profile</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Update your name, matric number, and course details</div>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </div>

        {/* Sign out */}
        <div style={lastRowStyle}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#dc2626' }}>Sign Out</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>You'll need to sign in again to use Beacon</div>
          </div>
          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 9, border: '1.5px solid #fecaca',
              background: 'white', color: '#dc2626', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* ── APP INFO ── */}
      <div style={{ ...cardStyle, background: 'var(--bg-page)', boxShadow: 'none' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', marginBottom: 4 }}>Beacon</div>
          <div>Smart Attendance Management System</div>
          <div style={{ marginTop: 4 }}>Version 1.0.0 · Built for education</div>
        </div>
      </div>

      <style>{`
        @keyframes settingsFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Settings;
