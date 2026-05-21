import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Fingerprint, Lock, Mail, User, GraduationCap, BookOpen, Loader2, ArrowRight, Eye, EyeOff, Hash, QrCode, BarChart3, Shield } from 'lucide-react';

// Role colour palettes
const PALETTES = {
  student: {
    gradient: 'linear-gradient(160deg, #0d9488 0%, #14b8a6 45%, #2dd4bf 100%)',
    bg: '#f0f4f3',
    accent: '#14b8a6',
    accentHover: '#0d9488',
    accentShadow: 'rgba(20,184,166,0.18)',
    accentFocus: 'rgba(20,184,166,0.12)',
    label: 'Student',
    headline: 'Learn smarter,\nnot harder.',
    tagline: 'Mark attendance in seconds with QR codes, track your record and never miss a class.',
    features: [
      { icon: <QrCode size={16} />, text: 'QR check-in in under 5 seconds' },
      { icon: <BarChart3 size={16} />, text: 'Track your attendance history' },
      { icon: <Shield size={16} />, text: 'Secure, GPS-verified presence' },
    ],
  },
  lecturer: {
    gradient: 'linear-gradient(160deg, #4338ca 0%, #6366f1 50%, #818cf8 100%)',
    bg: '#f0f0ff',
    accent: '#6366f1',
    accentHover: '#4338ca',
    accentShadow: 'rgba(99,102,241,0.18)',
    accentFocus: 'rgba(99,102,241,0.12)',
    label: 'Lecturer',
    headline: 'Run your class,\nyour way.',
    tagline: 'Launch live sessions, track attendance in real time and export reports instantly.',
    features: [
      { icon: <QrCode size={16} />, text: 'Live session QR broadcasting' },
      { icon: <BarChart3 size={16} />, text: 'Real-time analytics & exports' },
      { icon: <BookOpen size={16} />, text: 'Multi-course management' },
    ],
  },
};

export default function Signup() {
  const [name, setName] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPwC, setShowPwC] = useState(false);
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, currentUser } = useAuth();
  const navigate = useNavigate();

  const p = PALETTES[role];

  if (currentUser && !loading) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== passwordConfirm) return setError('Passwords do not match');
    try {
      setError('');
      setLoading(true);
      await signup(email, password, role, name, matricNumber);
      navigate('/');
    } catch (err) {
      setError('Failed to create an account: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (focused) => ({
    width: '100%',
    padding: '12px 14px 12px 42px',
    border: `1.5px solid ${focused ? p.accent : '#e5e7eb'}`,
    borderRadius: 10,
    fontSize: 14,
    background: '#f9fafb',
    color: '#111827',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', sans-serif", background: p.bg, transition: 'background 0.5s ease' }}>

      {/* ── LEFT PANEL (branding) ── */}
      <div style={{
        flex: '0 0 420px',
        background: p.gradient,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 44px', color: 'white',
        transition: 'background 0.5s ease',
      }} className="auth-left-panel">

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
            <QrCode size={22} color="white" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>Beacon</span>
        </div>

        {/* Main Copy */}
        <div>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', marginBottom: 20, backdropFilter: 'blur(10px)' }}>
            {role.toUpperCase()} PORTAL
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.5px', whiteSpace: 'pre-line' }}>
            {p.headline}
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.85, marginBottom: 36 }}>
            {p.tagline}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {p.features.map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, opacity: 0.9 }}>
                <div style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {f.icon}
                </div>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12, opacity: 0.6 }}>© {new Date().getFullYear()} Beacon. Built for modern campuses.</p>
      </div>

      {/* ── RIGHT PANEL (form) ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: '#111827', marginBottom: 6, letterSpacing: '-0.3px' }}>Create your account</h2>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Join Beacon and start today</p>
          </div>

          {/* Role Toggle */}
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 28, gap: 4 }}>
            {['student', 'lecturer'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 14,
                  background: role === r ? PALETTES[r].accent : 'transparent',
                  color: role === r ? 'white' : '#6b7280',
                  transition: 'all 0.25s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  boxShadow: role === r ? `0 4px 12px ${PALETTES[r].accentShadow}` : 'none',
                }}
              >
                {r === 'student' ? <GraduationCap size={15} /> : <BookOpen size={15} />}
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 14px', borderRadius: 10, marginBottom: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input type="text" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} required
                  style={inputStyle(false)}
                  onFocus={e => { e.target.style.borderColor = p.accent; e.target.style.boxShadow = `0 0 0 3px ${p.accentFocus}`; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input type="email" placeholder="you@university.edu" value={email} onChange={e => setEmail(e.target.value)} required
                  style={inputStyle(false)}
                  onFocus={e => { e.target.style.borderColor = p.accent; e.target.style.boxShadow = `0 0 0 3px ${p.accentFocus}`; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input type={showPw ? 'text' : 'password'} placeholder="Create a password" value={password} onChange={e => setPassword(e.target.value)} required
                  style={{ ...inputStyle(false), paddingRight: 44 }}
                  onFocus={e => { e.target.style.borderColor = p.accent; e.target.style.boxShadow = `0 0 0 3px ${p.accentFocus}`; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input type={showPwC ? 'text' : 'password'} placeholder="Repeat your password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} required
                  style={{ ...inputStyle(false), paddingRight: 44 }}
                  onFocus={e => { e.target.style.borderColor = p.accent; e.target.style.boxShadow = `0 0 0 3px ${p.accentFocus}`; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPwC(v => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}>
                  {showPwC ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Matric Number (students only) */}
            {role === 'student' && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Matric Number</label>
                <div style={{ position: 'relative' }}>
                  <Hash size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input type="text" placeholder="e.g. 20/0123" value={matricNumber} onChange={e => setMatricNumber(e.target.value.toUpperCase())} required
                    style={inputStyle(false)}
                    onFocus={e => { e.target.style.borderColor = p.accent; e.target.style.boxShadow = `0 0 0 3px ${p.accentFocus}`; }}
                    onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '13px', background: loading ? p.accentHover : p.accent, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.3s, box-shadow 0.3s', boxShadow: `0 4px 14px ${p.accentShadow}`, marginTop: 4 }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = p.accentHover; e.currentTarget.style.boxShadow = `0 6px 20px ${p.accentShadow}`; } }}
              onMouseLeave={e => { e.currentTarget.style.background = p.accent; e.currentTarget.style.boxShadow = `0 4px 14px ${p.accentShadow}`; }}
            >
              {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><ArrowRight size={16} /> Create Account</>}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: '#6b7280' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: p.accent, fontWeight: 700, textDecoration: 'none', transition: 'color 0.3s' }}>Sign in here</Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .auth-left-panel { display: none !important; } }
      `}</style>
    </div>
  );
}
