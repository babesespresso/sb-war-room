'use client';

/**
 * War Room — Login (V4 Boot Terminal)
 *
 * Drop-in replacement for src/app/login/page.tsx.
 * Auth logic is byte-identical to the shipping version:
 *   - Supabase signInWithPassword with captchaToken
 *   - Cloudflare Turnstile gate (blur + overlay until verified)
 *   - Invite flow (?flow=invite + PASSWORD_RECOVERY event → set-password form)
 *   - Error / success states
 *
 * Only the visual chrome changes: CRT window, boot log, laser scanline with
 * spark bursts, rising embers, uplink progress beam. Requires the Instrument
 * Serif, Space Grotesk, and JetBrains Mono Google Fonts (or swap the CSS var
 * names for your existing stack).
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { Shield, Loader2, Lock, CheckCircle2, KeyRound } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';

export default function LoginPage() {
  // ── Auth state (unchanged from original) ──────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cfVerified, setCfVerified] = useState(false);
  const [cfToken, setCfToken] = useState<string | null>(null);
  const router = useRouter();

  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('flow') === 'invite') {
        setIsInviteFlow(true);
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsInviteFlow(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setSettingPassword(true);
    const supabase = createBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError(updateError.message);
      setSettingPassword(false);
    } else {
      setPasswordSuccess(true);
      setSettingPassword(false);
      setTimeout(() => { router.push('/'); router.refresh(); }, 1500);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfVerified) return;
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email, password,
      options: { captchaToken: cfToken || undefined },
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  // ── deterministic ember field (SSR-safe) ──────────────────────
  const embers = Array.from({ length: 24 }).map((_, i) => {
    const r = (n: number) => { const s = Math.sin(i * 9301 + n * 49297) * 233280; return s - Math.floor(s); };
    return { left: r(1) * 100, bottom: -10 + r(2) * 25, dur: 5 + r(3) * 5, delay: -r(4) * 8 };
  });

  return (
    <div className="wr-login">
      <WarRoomCSS/>

      {/* Background layers */}
      <div className="wr-grid"/>
      <div className="wr-embers">
        {embers.map((e, i) => (
          <span key={i} className="wr-ember" style={{
            left: `${e.left}%`, bottom: `${e.bottom}%`,
            animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s`,
          }}/>
        ))}
      </div>
      <LaserScanline/>
      <div className="wr-vignette"/>
      <div className="wr-noise"/>

      {/* Cloudflare gate overlay */}
      {!cfVerified && (
        <div className="wr-cf-gate">
          <Turnstile
            siteKey={process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY || '0x4AAAAAAC1lwdgcu4JQOl7U'}
            onSuccess={(token) => { setCfToken(token); setCfVerified(true); }}
            options={{ theme: 'dark' }}
          />
          <p className="wr-cf-caption">Awaiting Clearance</p>
        </div>
      )}

      {/* CRT Window */}
      <div className="wr-crt" style={{ filter: cfVerified ? 'none' : 'blur(4px)', opacity: cfVerified ? 1 : 0.6 }}>
        {/* Titlebar */}
        <div className="wr-title">
          <div className="wr-title-left">
            <span className="wr-lights">
              <span style={{ background: '#ef4444' }}/>
              <span style={{ background: '#f59e0b' }}/>
              <span style={{ background: '#10b981' }}/>
            </span>
            <span>war_room :: secure_uplink</span>
          </div>
          <span className="wr-title-right">
            {cfVerified ? <CheckCircle2 size={11} style={{ color: '#10b981' }}/> : <Loader2 size={11} className="wr-spin" style={{ color: '#f59e0b' }}/>}
            TTY/4 · {cfVerified ? 'SECURE' : 'VERIFYING'}
          </span>
        </div>

        {/* Body */}
        <div className="wr-body">
          <BootLog/>

          {/* Auth form */}
          <div className="wr-form-block">
            <CornerBrackets/>

            <div className="wr-form-head">
              <div className="wr-sb">SB</div>
              <div>
                <div className="wr-eyebrow">War Room · CO 2026</div>
                <div className="wr-h2">{isInviteFlow ? 'Activate your credentials' : 'Operator sign-in'}</div>
              </div>
            </div>

            {error && (
              <div className="wr-alert wr-alert-err">
                <Shield size={14}/>
                <span>{error}</span>
              </div>
            )}

            {isInviteFlow ? (
              <form onSubmit={handleSetPassword}>
                <div className="wr-alert wr-alert-ok">
                  <KeyRound size={14}/>
                  <span>Welcome, Operative. Set your cipher key to activate credentials.</span>
                </div>

                {passwordSuccess && (
                  <div className="wr-alert wr-alert-ok">
                    <CheckCircle2 size={14}/>
                    <span>Credentials established. Redirecting to HQ…</span>
                  </div>
                )}

                <LabeledInput
                  label="new_cipher_key"
                  type="password" mono
                  value={newPassword}
                  onChange={(v) => setNewPassword(v)}
                  placeholder="MIN 6 CHARACTERS"
                  required minLength={6}
                  icon={<Lock size={14}/>}
                  tone="green"
                />
                <LabeledInput
                  label="confirm_cipher_key"
                  type="password" mono
                  value={confirmPassword}
                  onChange={(v) => setConfirmPassword(v)}
                  placeholder="REPEAT CIPHER KEY"
                  required minLength={6}
                  icon={<Lock size={14}/>}
                  tone="green"
                />

                <button
                  type="submit"
                  disabled={settingPassword || passwordSuccess || !newPassword || !confirmPassword}
                  className="wr-btn wr-btn-green"
                >
                  {settingPassword ? (<><Loader2 size={14} className="wr-spin"/> <span>Establishing…</span></>)
                    : passwordSuccess ? (<><CheckCircle2 size={14}/> <span>Credentials Set</span></>)
                    : 'activate --credentials'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin}>
                <LabeledInput
                  label="email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="operative@campaign.hq"
                  required
                />
                <LabeledInput
                  label="cipher_key"
                  type="password" mono
                  value={password}
                  onChange={setPassword}
                  placeholder="CLASSIFIED"
                  required
                  icon={<Lock size={14}/>}
                />

                <button
                  type="submit"
                  disabled={loading || !cfVerified}
                  className="wr-btn"
                >
                  {loading ? (<><Loader2 size={14} className="wr-spin"/> <span>Decrypting…</span></>) : 'auth --login'}
                </button>
              </form>
            )}

            <div className="wr-form-foot">
              <span>caps lock off</span>
              <span className="wr-foot-ok">
                <span className="wr-dot-green"/>
                tls · turnstile {cfVerified ? 'ok' : '…'}
              </span>
            </div>
          </div>

          {/* Uplink progress beam */}
          <div className="wr-uplink">
            <div className="wr-uplink-label">
              <span>uplink integrity</span>
              <span style={{ color: '#fca5a5' }}>99.4%</span>
            </div>
            <div className="wr-uplink-bar">
              <div className="wr-uplink-fill"/>
              <div className="wr-uplink-tip"/>
            </div>
          </div>

          {/* Classified footer */}
          <div className="wr-classified">
            <div>WARNING · UNITED STATES CAMPAIGN SYSTEM</div>
            <div style={{ color: 'rgba(120,30,30,0.7)' }}>Unauthorized access strictly prohibited</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function BootLog() {
  const lines = [
    { t: '[00:00]', body: 'powering secure uplink...', c: '#fca5a5' },
    { t: '[00:00]', body: 'verifying cloudflare turnstile    ok', c: '#86efac' },
    { t: '[00:01]', body: 'establishing tls 1.3 session     ok', c: '#86efac' },
    { t: '[00:01]', body: 'locating nearest node         DEN-03', c: '#fbbf24' },
    { t: '[00:02]', body: 'handshake complete · awaiting credentials', c: '#fca5a5' },
  ];
  return (
    <div className="wr-boot">
      {lines.map((l, i) => (
        <div key={i} className="wr-boot-line">
          <span style={{ color: 'rgba(200,200,200,0.4)' }}>{l.t} </span>
          <span style={{ color: l.c }}>{l.body}</span>
        </div>
      ))}
      <div className="wr-boot-caret">
        <span>&gt;</span>
        <span className="wr-caret-block"/>
      </div>
    </div>
  );
}

type LabeledInputProps = {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  mono?: boolean;
  icon?: React.ReactNode;
  tone?: 'red' | 'green';
};
function LabeledInput({ label, type = 'text', value, onChange, placeholder, required, minLength, mono, icon, tone = 'red' }: LabeledInputProps) {
  return (
    <div className="wr-field">
      <div className={`wr-label wr-label-${tone}`}>
        <span className={`wr-dot wr-dot-${tone}`}/>
        {label}
      </div>
      <div className="wr-input-wrap">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          className={`wr-input ${mono ? 'wr-input-mono' : ''} wr-input-${tone}`}
        />
        {icon && <span className="wr-input-icon">{icon}</span>}
      </div>
    </div>
  );
}

function CornerBrackets() {
  return (
    <>
      <span className="wr-cb wr-cb-tl"/>
      <span className="wr-cb wr-cb-tr"/>
      <span className="wr-cb wr-cb-bl"/>
      <span className="wr-cb wr-cb-br"/>
    </>
  );
}

function LaserScanline() {
  return (
    <div className="wr-laser-wrap">
      <div className="wr-laser">
        <div className="wr-laser-beam"/>
        <SparkBurst side="left"/>
        <SparkBurst side="right"/>
      </div>
    </div>
  );
}

function SparkBurst({ side }: { side: 'left' | 'right' }) {
  const isL = side === 'left';
  const shards = [
    { w: 12, h: 1.5, c: '#fdba74', rot: isL ? -15 : 15,  dx: isL ? -32 : 32,  dy: -18, dur: 0.6,  delay: 0 },
    { w: 8,  h: 2,   c: '#fde047', rot: isL ? 12  : -12, dx: isL ? -26 : 26,  dy: 14,  dur: 0.8,  delay: 0.2 },
    { w: 18, h: 1,   c: '#f87171', rot: isL ? -35 : 35,  dx: isL ? -44 : 44,  dy: -8,  dur: 0.55, delay: 0.1 },
    { w: 9,  h: 1,   c: '#fff',    rot: isL ? 25  : -25, dx: isL ? -22 : 22,  dy: 24,  dur: 0.7,  delay: 0.4 },
    { w: 22, h: 1.5, c: '#fed7aa', rot: isL ? -5  : 5,   dx: isL ? -52 : 52,  dy: -4,  dur: 0.9,  delay: 0.3 },
    { w: 26, h: 1.5, c: '#fb923c', rot: isL ? -25 : 25,  dx: isL ? -80 : 80,  dy: -38, dur: 0.7,  delay: 0.15 },
    { w: 18, h: 2,   c: '#fbbf24', rot: isL ? 40  : -40, dx: isL ? -72 : 72,  dy: 48,  dur: 0.65, delay: 0.35 },
    { w: 14, h: 1,   c: '#fff',    rot: isL ? -10 : 10,  dx: isL ? -90 : 90,  dy: 0,   dur: 0.55, delay: 0.05 },
  ];
  const anim = isL ? 'wr-spark-l' : 'wr-spark-r';
  return (
    <div className={`wr-spark-root wr-spark-${side}`}>
      <div className="wr-spark-core"/>
      <div className="wr-spark-core-white"/>
      {shards.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', top: 0,
          [isL ? 'left' : 'right']: 0,
          width: s.w, height: s.h, background: s.c, borderRadius: s.h,
          transform: `rotate(${s.rot}deg)`,
          transformOrigin: isL ? 'left center' : 'right center',
          animation: `${anim} ${s.dur}s ease-out infinite`,
          animationDelay: `${s.delay}s`,
          ['--dx' as never]: `${s.dx}px`,
          ['--dy' as never]: `${s.dy}px`,
        } as React.CSSProperties}/>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles — scoped with .wr- prefix so they don't touch app CSS
// ─────────────────────────────────────────────────────────────
function WarRoomCSS() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700;800&family=Instrument+Serif:ital@1&display=swap');

      @keyframes wr-scan { 0% { transform: translateY(-40px); } 100% { transform: translateY(var(--wr-scan-end, 100vh)); } }
      @keyframes wr-ember { 0%{transform:translateY(0)translateX(0)scale(1);opacity:0;background:#f97316}10%{opacity:.95}40%{transform:translateY(-180px)translateX(12px)scale(1.3);opacity:.8;background:#fb923c}70%{transform:translateY(-320px)translateX(-14px)scale(.9);opacity:.55;background:#b91c1c}100%{transform:translateY(-460px)translateX(18px)scale(.4);opacity:0;background:#450a0a} }
      @keyframes wr-spark-l { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(var(--dx,-40px),var(--dy,-10px)) scale(0);opacity:0} }
      @keyframes wr-spark-r { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(var(--dx,40px),var(--dy,-10px)) scale(0);opacity:0} }
      @keyframes wr-caret { 0%,49%{opacity:1} 50%,100%{opacity:0} }
      @keyframes wr-pulse { 0%,100%{opacity:.45} 50%{opacity:1} }
      @keyframes wr-bgpan { 0%{background-position:0% 50%} 100%{background-position:100% 50%} }
      @keyframes wr-spin { to { transform: rotate(360deg); } }

      .wr-login {
        position: relative;
        min-height: 100vh;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: #070404;
        color: #fef2f2;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        overflow: hidden;
        --wr-scan-end: 100vh;
      }

      .wr-spin { animation: wr-spin 1s linear infinite; }

      /* Background layers */
      .wr-grid {
        position: absolute; inset: 0; pointer-events: none;
        background-image:
          linear-gradient(to right, rgba(220,38,38,0.06) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(220,38,38,0.06) 1px, transparent 1px);
        background-size: 40px 40px;
        opacity: 0.18;
      }
      .wr-embers { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
      .wr-ember {
        position: absolute; width: 3px; height: 3px; border-radius: 50%;
        background: #f97316; box-shadow: 0 0 6px #ea580c, 0 0 14px rgba(249,115,22,0.6);
        opacity: 0; animation: wr-ember 8s ease-out infinite;
      }
      .wr-vignette {
        position: absolute; inset: 0; pointer-events: none;
        background:
          radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%),
          linear-gradient(180deg, rgba(40,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(40,0,0,0.4) 100%);
      }
      .wr-noise {
        position: absolute; inset: 0; pointer-events: none; opacity: .06; mix-blend-mode: overlay;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.5'/></svg>");
      }

      /* Laser scanline (masked to CRT) */
      .wr-laser-wrap {
        position: absolute; inset: 64px; pointer-events: none; overflow: hidden;
        border-radius: 6px;
      }
      .wr-laser {
        position: absolute; top: 0; left: 0; right: 0; height: 60px;
        animation: wr-scan 6s linear infinite;
      }
      .wr-laser-beam {
        position: absolute; top: 50%; left: 40px; right: 40px; height: 2px;
        transform: translateY(-50%);
        background: linear-gradient(to right, rgba(255,120,60,0) 0%, rgba(255,180,100,0.6) 30%, rgba(255,255,255,0.95) 50%, rgba(255,180,100,0.6) 70%, rgba(255,120,60,0) 100%);
        box-shadow: 0 0 8px rgba(255,140,60,0.8), 0 0 20px rgba(220,38,38,0.5);
      }
      .wr-spark-root { position: absolute; top: 50%; transform: translateY(-50%); width: 0; height: 0; }
      .wr-spark-left { left: 40px; }
      .wr-spark-right { right: 40px; }
      .wr-spark-core {
        position: absolute; top: -5px; left: 0; width: 2px; height: 10px;
        background: #fb923c; border-radius: 2px;
        box-shadow: 0 0 10px 2px #ea580c, 0 0 20px 4px rgba(249,115,22,0.6);
        filter: blur(0.5px);
      }
      .wr-spark-right .wr-spark-core { left: auto; right: 0; }
      .wr-spark-core-white {
        position: absolute; top: -3px; left: 0; width: 1px; height: 6px;
        background: #fff; border-radius: 1px;
      }
      .wr-spark-right .wr-spark-core-white { left: auto; right: 0; }

      /* Cloudflare gate */
      .wr-cf-gate {
        position: absolute; inset: 64px; z-index: 50;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.7); backdrop-filter: blur(12px);
        border-radius: 6px; border: 1px solid rgba(229,72,77,0.3);
      }
      .wr-cf-caption {
        margin-top: 20px; font-size: 10px; letter-spacing: 0.3em;
        color: #f59e0b; text-transform: uppercase;
        text-shadow: 0 0 8px rgba(245,158,11,0.8);
        animation: wr-pulse 1.8s ease-in-out infinite;
      }

      /* CRT window */
      .wr-crt {
        position: relative; z-index: 2;
        width: min(720px, calc(100vw - 48px));
        max-height: calc(100vh - 48px);
        background: linear-gradient(180deg, rgba(8,0,0,0.92) 0%, rgba(14,4,4,0.86) 100%);
        border: 1px solid rgba(229,72,77,0.3);
        border-radius: 6px;
        box-shadow:
          0 0 0 1px rgba(0,0,0,0.6) inset,
          0 0 120px rgba(220,38,38,0.12),
          0 60px 100px rgba(0,0,0,0.8);
        display: flex; flex-direction: column;
        overflow: hidden;
        transition: filter .6s, opacity .6s;
      }

      .wr-title {
        padding: 10px 16px;
        display: flex; align-items: center; justify-content: space-between;
        background: rgba(229,72,77,0.08);
        border-bottom: 1px solid rgba(229,72,77,0.22);
        font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: #fca5a5;
      }
      .wr-title-left { display: flex; align-items: center; gap: 10px; }
      .wr-title-right { display: flex; align-items: center; gap: 6px; opacity: 0.6; font-size: 9px; }
      .wr-lights { display: inline-flex; gap: 6px; }
      .wr-lights > span { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

      .wr-body { padding: 28px 36px 24px; display: flex; flex-direction: column; gap: 18px; }

      /* Boot log */
      .wr-boot { font-size: 12px; line-height: 1.85; color: rgba(220,220,220,0.85); }
      .wr-boot-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .wr-boot-caret { display: flex; align-items: center; gap: 6px; margin-top: 4px; color: #f87171; }
      .wr-caret-block { display: inline-block; width: 8px; height: 14px; background: #f87171; animation: wr-caret 1s infinite; }

      /* Form block */
      .wr-form-block {
        position: relative;
        padding: 22px 24px;
        border-radius: 4px;
        border: 1px solid rgba(229,72,77,0.25);
        background: rgba(0,0,0,0.4);
      }
      .wr-cb { position: absolute; width: 14px; height: 14px; border: 1px solid rgba(229,72,77,0.55); }
      .wr-cb-tl { top: -1px; left: -1px; border-right: 0; border-bottom: 0; border-top-left-radius: 4px; }
      .wr-cb-tr { top: -1px; right: -1px; border-left: 0; border-bottom: 0; border-top-right-radius: 4px; }
      .wr-cb-bl { bottom: -1px; left: -1px; border-right: 0; border-top: 0; border-bottom-left-radius: 4px; }
      .wr-cb-br { bottom: -1px; right: -1px; border-left: 0; border-top: 0; border-bottom-right-radius: 4px; }

      .wr-form-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
      .wr-sb {
        width: 42px; height: 42px; border-radius: 4px;
        background: linear-gradient(135deg, #7f1d1d, #450a0a);
        border: 1px solid rgba(229,72,77,0.5);
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: 800; color: #fca5a5; letter-spacing: 0.05em;
      }
      .wr-eyebrow { font-size: 9px; letter-spacing: 0.3em; color: rgba(248,113,113,0.7); text-transform: uppercase; }
      .wr-h2 {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 20px; font-weight: 700; color: #fef2f2; letter-spacing: -0.01em; margin-top: 2px;
      }

      .wr-field { margin-bottom: 14px; }
      .wr-label {
        font-size: 9px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase;
        margin-bottom: 6px; display: flex; align-items: center; gap: 8px;
      }
      .wr-label-red { color: rgba(229,72,77,0.75); }
      .wr-label-green { color: rgba(16,185,129,0.75); }
      .wr-dot { width: 6px; height: 6px; border-radius: 50%; animation: wr-pulse 2s ease-in-out infinite; }
      .wr-dot-red { background: rgba(229,72,77,0.7); }
      .wr-dot-green { background: rgba(16,185,129,0.7); }

      .wr-input-wrap { position: relative; }
      .wr-input {
        width: 100%; padding: 12px 14px; border-radius: 8px;
        background: rgba(0,0,0,0.5); color: #fee;
        border: 1px solid rgba(127,29,29,0.45);
        font-size: 13px; outline: none;
        transition: border-color .15s, background .15s;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        font-family: inherit;
      }
      .wr-input-green { border-color: rgba(5,95,70,0.45); }
      .wr-input:focus { border-color: rgba(229,72,77,0.9); background: rgba(0,0,0,0.7); }
      .wr-input-green:focus { border-color: rgba(16,185,129,0.9); }
      .wr-input-mono { font-family: 'JetBrains Mono', monospace; letter-spacing: 0.2em; }
      .wr-input::placeholder { color: rgba(180,60,60,0.45); }
      .wr-input-green::placeholder { color: rgba(60,180,120,0.45); }
      .wr-input-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: rgba(127,29,29,0.6); pointer-events: none; }

      .wr-alert {
        display: flex; align-items: flex-start; gap: 8px;
        padding: 10px 12px; border-radius: 6px; margin-bottom: 12px;
        font-size: 12px; line-height: 1.4;
      }
      .wr-alert-err { background: rgba(127,29,29,0.35); border: 1px solid rgba(229,72,77,0.35); color: #fecaca; }
      .wr-alert-ok  { background: rgba(5,95,70,0.3);   border: 1px solid rgba(16,185,129,0.35); color: #a7f3d0; }

      .wr-btn {
        width: 100%; padding: 13px 16px; border-radius: 8px;
        font-size: 12px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
        color: #fff; cursor: pointer; border: 1px solid rgba(229,72,77,0.45);
        background: linear-gradient(135deg, rgba(185,28,28,0.75), rgba(127,29,29,0.55));
        text-shadow: 0 2px 4px rgba(0,0,0,0.6);
        box-shadow: inset 0 1px 1px rgba(255,255,255,0.18), 0 10px 30px rgba(220,38,38,0.15);
        position: relative; overflow: hidden;
        transition: transform .12s, border-color .12s, box-shadow .12s, opacity .2s;
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        font-family: 'JetBrains Mono', monospace;
        margin-top: 4px;
      }
      .wr-btn:hover:not(:disabled) { border-color: rgba(229,72,77,0.9); box-shadow: inset 0 1px 1px rgba(255,255,255,0.22), 0 14px 36px rgba(220,38,38,0.28); }
      .wr-btn:active:not(:disabled) { transform: translateY(1px); }
      .wr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .wr-btn-green {
        border-color: rgba(16,185,129,0.45);
        background: linear-gradient(135deg, rgba(5,150,105,0.7), rgba(4,120,87,0.5));
        box-shadow: inset 0 1px 1px rgba(255,255,255,0.2), 0 10px 30px rgba(16,185,129,0.15);
      }
      .wr-btn-green:hover:not(:disabled) { border-color: rgba(16,185,129,0.9); box-shadow: inset 0 1px 1px rgba(255,255,255,0.22), 0 14px 36px rgba(16,185,129,0.28); }
      .wr-btn::after {
        content: ''; position: absolute; inset: 0;
        background: linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%);
        background-size: 250% 250%;
        animation: wr-bgpan 3s linear infinite;
        opacity: 0; transition: opacity .2s;
      }
      .wr-btn:hover::after { opacity: 1; }

      .wr-form-foot {
        margin-top: 14px; display: flex; align-items: center; justify-content: space-between;
        font-size: 9px; letter-spacing: 0.2em; color: rgba(180,180,180,0.5); text-transform: uppercase;
      }
      .wr-foot-ok { display: inline-flex; align-items: center; gap: 6px; }
      .wr-dot-green {
        width: 6px; height: 6px; border-radius: 50%; background: #10b981;
        box-shadow: 0 0 6px #10b981;
      }

      /* Uplink */
      .wr-uplink {}
      .wr-uplink-label {
        font-size: 9px; letter-spacing: 0.25em; color: rgba(180,180,180,0.45);
        text-transform: uppercase; margin-bottom: 8px;
        display: flex; justify-content: space-between;
      }
      .wr-uplink-bar {
        position: relative; height: 2px; background: rgba(127,29,29,0.35);
        border-radius: 1px; overflow: hidden;
      }
      .wr-uplink-fill {
        position: absolute; inset: 0; width: 99.4%;
        background: linear-gradient(to right, rgba(229,72,77,0.5), #ff8a3d, #fff, #ff8a3d);
        box-shadow: 0 0 10px rgba(255,140,60,0.8);
      }
      .wr-uplink-tip {
        position: absolute; left: 99.4%; top: -4px; width: 2px; height: 10px;
        background: #fff; box-shadow: 0 0 8px #fff, 0 0 14px rgba(255,180,80,0.9);
        animation: wr-pulse 0.6s infinite;
      }

      /* Classified footer */
      .wr-classified {
        text-align: center; font-size: 9px; letter-spacing: 0.25em; text-transform: uppercase;
        color: rgba(229,72,77,0.55); line-height: 1.7;
        padding-top: 4px;
      }

      /* Small screens */
      @media (max-width: 540px) {
        .wr-login { padding: 12px; }
        .wr-laser-wrap, .wr-cf-gate { inset: 12px; }
        .wr-body { padding: 22px 20px 20px; }
        .wr-boot { font-size: 11px; }
        .wr-form-block { padding: 18px 18px; }
      }
    `}}/>
  );
}
