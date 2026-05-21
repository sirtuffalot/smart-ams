import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Fingerprint, Lock, Mail, Loader2, ArrowRight, Eye, EyeOff, CheckCircle2, BookOpen, QrCode, BarChart3 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, currentUser, resetPassword } = useAuth();
  const navigate = useNavigate();

  if (currentUser) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Incorrect email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetEmail) { setResetError('Please enter your email address.'); return; }
    try {
      setResetError('');
      setLoading(true);
      await resetPassword(resetEmail);
      setResetSent(true);
    } catch (err) {
      setResetError('Could not send reset email. Check the address and try again.');
    } finally {
      setLoading(false);
    }
  }

  const features = [
    { icon: <QrCode size={16} />, text: 'QR-based attendance in seconds' },
    { icon: <BarChart3 size={16} />, text: 'Real-time analytics & reports' },
    { icon: <BookOpen size={16} />, text: 'Multi-course session management' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', sans-serif", background: '#f0f4f3' }}>

      {/* ── LEFT PANEL (branding) ── */}
      <div style={{
        flex: '0 0 420px', background: 'linear-gradient(160deg, #0d9488 0%, #14b8a6 45%, #2dd4bf 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 44px', color: 'white',
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
            ATTENDANCE MANAGEMENT
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.5px' }}>
            Smart attendance,<br />smarter campus.
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.85, marginBottom: 36 }}>
            Frictionless QR-based check-ins, live session tracking, and powerful analytics — all in one place.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {features.map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, opacity: 0.9 }}>
                <div style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {f.icon}
                </div>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ fontSize: 12, opacity: 0.6 }}>© {new Date().getFullYear()} Beacon. Built for modern campuses.</p>
      </div>

      {/* ── RIGHT PANEL (form) ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {!isResetting ? (
            <>
              <div style={{ marginBottom: 36 }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#111827', marginBottom: 6, letterSpacing: '-0.3px' }}>Welcome back</h2>
                <p style={{ color: '#6b7280', fontSize: 14 }}>Sign in to your Beacon account</p>
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 14px', borderRadius: 10, marginBottom: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>⚠</span> {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* Email */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      type="email"
                      placeholder="you@university.edu"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      style={{ width: '100%', padding: '12px 14px 12px 42px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, background: '#f9fafb', color: '#111827', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                      onFocus={e => { e.target.style.borderColor = '#14b8a6'; e.target.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      style={{ width: '100%', padding: '12px 44px 12px 42px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, background: '#f9fafb', color: '#111827', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                      onFocus={e => { e.target.style.borderColor = '#14b8a6'; e.target.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
                  <button type="button" onClick={() => setIsResetting(true)} style={{ background: 'none', border: 'none', color: '#14b8a6', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', padding: '13px', background: loading ? '#5eead4' : '#14b8a6', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s, transform 0.15s', transform: 'translateY(0)' }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#0d9488'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = loading ? '#5eead4' : '#14b8a6'; }}
                >
                  {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><ArrowRight size={16} /> Sign In</>}
                </button>
              </form>

              <p style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: '#6b7280' }}>
                Don't have an account?{' '}
                <Link to="/signup" style={{ color: '#14b8a6', fontWeight: 700, textDecoration: 'none' }}>Create one here</Link>
              </p>
            </>
          ) : (
            <>
              <button onClick={() => { setIsResetting(false); setResetSent(false); setResetError(''); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 32, padding: 0 }}>
                ← Back to sign in
              </button>

              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Reset password</h2>
                <p style={{ color: '#6b7280', fontSize: 14 }}>Enter your email and we'll send you a reset link.</p>
              </div>

              {resetSent ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 24, textAlign: 'center' }}>
                  <CheckCircle2 size={40} color="#16a34a" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontWeight: 700, color: '#15803d', marginBottom: 4 }}>Email sent!</p>
                  <p style={{ color: '#6b7280', fontSize: 13 }}>Check your inbox for the password reset link.</p>
                </div>
              ) : (
                <form onSubmit={handleResetPassword}>
                  {resetError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                      {resetError}
                    </div>
                  )}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}>Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                      <input
                        type="email"
                        placeholder="you@university.edu"
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: '12px 14px 12px 42px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, background: '#f9fafb', color: '#111827', outline: 'none' }}
                        onFocus={e => { e.target.style.borderColor = '#14b8a6'; e.target.style.boxShadow = '0 0 0 3px rgba(20,184,166,0.12)'; }}
                        onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ width: '100%', padding: '13px', background: '#14b8a6', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Send Reset Link'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .auth-left-panel { display: none !important; } }
      `}</style>
    </div>
  );
}
