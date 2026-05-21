import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { createBoardSession, subscribeToBoard, subscribeToSession } from '../utils/db';
import { Monitor, Smartphone, CheckCircle, Clock, Wifi, WifiOff } from 'lucide-react';

const CACHE_KEY = 'beacon_board_session';

const SmartBoard = () => {
  const [boardId, setBoardId] = useState(null);
  const [pairingCode, setPairingCode] = useState('');
  const [session, setSession] = useState(null);
  const [qrPayload, setQrPayload] = useState('');
  const [qrProgress, setQrProgress] = useState(100);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInitializing, setIsInitializing] = useState(true);
  // Ref to hold the latest session data for use in offline QR generation
  const sessionRef = useRef(null);

  // Track online/offline status
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // On mount: try to restore a cached session first
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Restore the minimal data needed for offline QR generation
        if (parsed.id && parsed.qrSecret) {
          sessionRef.current = parsed;
          setSession(parsed);
          setIsInitializing(false);
          return; // Don't create a new board session – we already have one
        }
      } catch (e) {
        localStorage.removeItem(CACHE_KEY);
      }
    }

    // No cache – initialize a fresh board pairing session
    const initBoard = async () => {
      try {
        const board = await createBoardSession();
        setBoardId(board.id);
        setPairingCode(board.pairingCode);
      } catch (err) {
        console.error('Failed to initialize board:', err);
      } finally {
        setIsInitializing(false);
      }
    };
    initBoard();
  }, []);

  // Listen for linking (only when we have a boardId – i.e. NOT restoring from cache)
  useEffect(() => {
    if (!boardId) return;

    let unsubSession = null;

    const unsubBoard = subscribeToBoard(boardId, (boardData) => {
      if (boardData.linked && boardData.sessionId) {
        // Subscribe to the live session
        unsubSession = subscribeToSession(boardData.sessionId, (sessionData) => {
          if (sessionData) {
            // Cache the minimal fields needed for offline QR generation
            const toCache = {
              id:               sessionData.id,
              courseName:       sessionData.courseName,
              courseCode:       sessionData.courseCode,
              venue:            sessionData.venue,
              qrSecret:         sessionData.qrSecret,
              status:           sessionData.status,
              attendanceLocked: sessionData.attendanceLocked,
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
            sessionRef.current = toCache;
            setSession(toCache);
          } else {
            // Session deleted – clear cache
            localStorage.removeItem(CACHE_KEY);
            setSession(null);
          }
        });
      }
    });

    return () => {
      unsubBoard();
      if (unsubSession) unsubSession();
    };
  }, [boardId]);

  // ── Dynamic QR Generator ─────────────────────────────────────
  // Runs entirely in the browser – no internet required once sessionRef is set
  useEffect(() => {
    const currentSession = session;
    if (!currentSession) return;
    if (currentSession.status !== 'active') return;
    if (currentSession.attendanceLocked) {
      setQrPayload(''); // clear so the pause overlay takes over
      return;
    }

    let intervalId;
    let progressId;

    const generate = async () => {
      const ts     = Date.now();
      const secret = currentSession.qrSecret || 'legacy-secret';
      const msg    = `${currentSession.id}|${ts}|${secret}`;
      const data   = new TextEncoder().encode(msg);

      try {
        const buf  = await crypto.subtle.digest('SHA-256', data);
        const hex  = Array.from(new Uint8Array(buf))
                          .map(b => b.toString(16).padStart(2, '0'))
                          .join('');
        setQrPayload(JSON.stringify({
          sId: currentSession.id,
          ts,
          sig: hex.substring(0, 16),
        }));
        setQrProgress(100);
      } catch {
        setQrPayload(JSON.stringify({ sId: currentSession.id }));
      }
    };

    generate();
    intervalId = setInterval(generate, 20000);
    progressId = setInterval(() => {
      setQrProgress(p => Math.max(0, p - 0.5)); // 0.5 % / 100 ms → 20 s
    }, 100);

    return () => {
      clearInterval(intervalId);
      clearInterval(progressId);
    };
  }, [session]);

  // ── Clear cache button (for when lecturer starts a new class) ─
  const handleClearAndReset = () => {
    localStorage.removeItem(CACHE_KEY);
    window.location.reload();
  };

  // ── Loading spinner ───────────────────────────────────────────
  if (isInitializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontSize: 18 }}>Initialising board…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ── Waiting / Pairing Screen ──────────────────────────────────
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 640, width: '100%', padding: '0 24px' }}>
          <Monitor size={72} style={{ opacity: 0.85, marginBottom: 28, color: '#3b82f6' }} />
          <h1 style={{ fontSize: 52, fontWeight: 800, marginBottom: 16, letterSpacing: '-1px' }}>Ready to Cast</h1>
          <p style={{ fontSize: 22, color: '#94a3b8', marginBottom: 48, lineHeight: 1.5 }}>
            Open <strong style={{ color: '#e2e8f0' }}>Beacon</strong> on your phone, start a session, tap <strong style={{ color: '#e2e8f0' }}>"Cast to Smart Board"</strong> and enter the code below.
          </p>

          <div style={{ background: 'rgba(255,255,255,0.08)', padding: '36px 48px', borderRadius: 28, display: 'inline-block', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3, color: '#64748b', marginBottom: 16 }}>Pairing Code</div>
            <div style={{ fontSize: 96, fontWeight: 900, letterSpacing: 16, color: 'white', textShadow: '0 4px 30px rgba(59,130,246,0.7)', lineHeight: 1 }}>
              {pairingCode || '....'}
            </div>
          </div>

          <p style={{ marginTop: 32, fontSize: 14, color: '#475569' }}>
            Once paired, this display works even if the classroom WiFi drops.
          </p>
        </div>
      </div>
    );
  }

  // ── Linked / Active Display ───────────────────────────────────
  const isPaused = session.attendanceLocked;
  const isEnded  = session.status !== 'active';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'white', color: '#0f172a', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '24px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>{session.courseName}</h1>
          <div style={{ fontSize: 18, color: '#64748b', fontWeight: 600, marginTop: 6, display: 'flex', gap: 16 }}>
            {session.courseCode && <span>{session.courseCode.toUpperCase()}</span>}
            {session.courseCode && <span>•</span>}
            <span>Venue: {session.venue}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Online / Offline pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 50, background: isOnline ? '#dcfce7' : '#fef3c7', color: isOnline ? '#166534' : '#92400e', fontSize: 13, fontWeight: 700 }}>
            {isOnline
              ? <><Wifi size={16} /> Synced</>
              : <><WifiOff size={16} /> Offline – QR still active</>}
          </div>

          {/* Status pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 50, background: isEnded ? '#fee2e2' : isPaused ? '#fef3c7' : '#dcfce7', color: isEnded ? '#991b1b' : isPaused ? '#92400e' : '#166534', fontWeight: 700, fontSize: 14 }}>
            {isEnded ? 'Session Ended' : isPaused ? 'Attendance Paused' : 'Receiving Check-ins'}
          </div>

          {/* New session button */}
          {isEnded && (
            <button
              onClick={handleClearAndReset}
              style={{ padding: '8px 18px', borderRadius: 50, background: '#3b82f6', color: 'white', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              New Session
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 48px' }}>
        <div style={{ display: 'flex', gap: 80, alignItems: 'center', maxWidth: 1300, width: '100%' }}>

          {/* Instructions */}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 52, fontWeight: 800, marginBottom: 20, lineHeight: 1.1, letterSpacing: '-1px' }}>
              Mark your<br />attendance now.
            </h2>
            <p style={{ fontSize: 22, color: '#64748b', marginBottom: 52, lineHeight: 1.5 }}>
              Open your <strong>Beacon</strong> app, tap <strong>"Scan QR"</strong>, and point your camera at the code on the right.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 20, fontWeight: 600, color: '#334155' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
                  <WifiOff size={24} />
                </div>
                Works even without classroom WiFi
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 20, fontWeight: 600, color: '#334155' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', flexShrink: 0 }}>
                  <Smartphone size={24} />
                </div>
                Scan from any distance using your phone
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 20, fontWeight: 600, color: '#334155' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fdf4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea', flexShrink: 0 }}>
                  <CheckCircle size={24} />
                </div>
                Cryptographically secured – no photo cheating
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div style={{ width: 480, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 440, height: 440, background: 'white', borderRadius: 32, padding: 20, boxShadow: '0 25px 60px -12px rgba(0,0,0,0.2)', border: '2px solid #e2e8f0' }}>

              {/* Pause / Ended overlay */}
              {(isEnded || isPaused) && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.96)', borderRadius: 30, backdropFilter: 'blur(10px)', zIndex: 10 }}>
                  <Clock size={72} style={{ color: isEnded ? '#ef4444' : '#f59e0b', marginBottom: 20 }} />
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>
                    {isEnded ? 'Session Ended' : 'Paused by Lecturer'}
                  </div>
                  {isPaused && (
                    <p style={{ fontSize: 16, color: '#64748b', marginTop: 8 }}>Attendance will resume shortly</p>
                  )}
                </div>
              )}

              <div style={{ width: '100%', height: '100%', opacity: (isEnded || isPaused) ? 0.05 : 1, transition: 'opacity 0.4s' }}>
                {qrPayload
                  ? <QRCodeSVG value={qrPayload} size="100%" level="H" />
                  : <div style={{ width: '100%', height: '100%', background: '#f1f5f9', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Generating…</div>
                }
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: 28, width: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 15, fontWeight: 700, color: '#64748b' }}>
                <span>🔐 Cryptographic Code</span>
                <span>Refreshes every 20s</span>
              </div>
              <div style={{ height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${qrProgress}%`, background: qrProgress < 20 ? '#ef4444' : '#3b82f6', transition: 'width 0.1s linear, background 0.3s ease', borderRadius: 5 }} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SmartBoard;
