'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { Shield, Loader2, Lock, Crosshair, CheckCircle2, KeyRound } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { Black_Ops_One } from 'next/font/google';

const blackOpsOne = Black_Ops_One({ weight: '400', subsets: ['latin'] });

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cfVerified, setCfVerified] = useState(false);
  const [cfToken, setCfToken] = useState<string | null>(null);
  const router = useRouter();

  // Invite flow state
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Detect invite flow — listen for PASSWORD_RECOVERY event and #invited hash
  useEffect(() => {
    const supabase = createBrowserClient();

    // Check URL for ?flow=invite (set by our /auth/callback route)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('flow') === 'invite') {
        setIsInviteFlow(true);
        // Clean the query param from the URL without triggering a navigation
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    // Listen for Supabase auth events — PASSWORD_RECOVERY fires for both invite and reset flows
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsInviteFlow(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle setting password for invited user
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSettingPassword(true);
    const supabase = createBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
      setError(updateError.message);
      setSettingPassword(false);
    } else {
      setPasswordSuccess(true);
      setSettingPassword(false);
      // Brief pause so user sees the success, then redirect
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1500);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfVerified) return;
    
    setLoading(true);
    setError(null);

    const supabase = createBrowserClient();
    
    // We pass the captchaToken so if Supabase is configured with it, it securely checks.
    // If not, it just logs in normally via Supabase payload, but the frontend was already gated!
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken: cfToken || undefined
      }
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-black text-white">
      {/* Tactical Styles & Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes radarSweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes flicker {
          0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { opacity: .99; text-shadow: 0 0 10px rgba(220,38,38,0.5); }
          20%, 21.999%, 63%, 63.999%, 65%, 69.999% { opacity: 0.4; text-shadow: none; }
        }
        @keyframes fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10% { opacity: 0.15; }
          90% { opacity: 0.15; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        @keyframes emberFloat {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          20% { opacity: 0.9; transform: translateY(-30px) translateX(10px) scale(1.5); background: #fff; box-shadow: 0 0 15px #f97316, 0 0 30px #ea580c; }
          50% { opacity: 0.8; transform: translateY(-80px) translateX(-15px) scale(1.0); background: #f97316; }
          100% { opacity: 0; transform: translateY(-200px) translateX(20px) scale(0.5); background: #991b1b; }
        }
        @keyframes distantExplosion {
          0% { opacity: 0; transform: scale(1); background: transparent; }
          5% { opacity: 0.4; transform: scale(3); background: rgba(255, 150, 50, 0.2); }
          15% { opacity: 0; transform: scale(4); background: rgba(220, 38, 38, 0.1); }
          100% { opacity: 0; }
        }
        @keyframes bg-pan {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        @keyframes sparkLeft1 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-30px, -20px) scale(0); opacity: 0; } }
        @keyframes sparkLeft2 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-25px, 15px) scale(0); opacity: 0; } }
        @keyframes sparkLeft3 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-40px, -10px) scale(0); opacity: 0; } }
        @keyframes sparkLeft4 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-20px, 25px) scale(0); opacity: 0; } }
        @keyframes sparkLeft5 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-50px, -5px) scale(0); opacity: 0; } }
        @keyframes sparkLeft6 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-80px, -40px) scale(0); opacity: 0; } }
        @keyframes sparkLeft7 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-70px, 50px) scale(0); opacity: 0; } }
        @keyframes sparkLeft8 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(-90px, 0px) scale(0); opacity: 0; } }
        @keyframes sparkRight1 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(30px, -20px) scale(0); opacity: 0; } }
        @keyframes sparkRight2 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(25px, 15px) scale(0); opacity: 0; } }
        @keyframes sparkRight3 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(40px, -10px) scale(0); opacity: 0; } }
        @keyframes sparkRight4 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(20px, 25px) scale(0); opacity: 0; } }
        @keyframes sparkRight5 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(50px, -5px) scale(0); opacity: 0; } }
        @keyframes sparkRight6 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(80px, -40px) scale(0); opacity: 0; } }
        @keyframes sparkRight7 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(70px, 50px) scale(0); opacity: 0; } }
        @keyframes sparkRight8 { 0% { transform: translate(0,0) scale(1); opacity: 1; } 100% { transform: translate(90px, 0px) scale(0); opacity: 0; } }

        .scanline-overlay {
          background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(220,38,38,0.05) 50%, rgba(220,38,38,0.05));
          background-size: 100% 4px;
        }
        .crt-flicker {
          animation: flicker 4s infinite alternate;
        }
        .tactical-grid {
          background-size: 40px 40px;
          background-image: 
            linear-gradient(to right, rgba(220,38,38,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(220,38,38,0.05) 1px, transparent 1px);
        }
        .bullet {
          position: absolute;
          width: 2px;
          height: 12px;
          background: #ca8a04;
          border-radius: 2px;
          box-shadow: 0 0 4px #ca8a04;
          opacity: 0;
          animation: fall linear infinite;
        }
        .ember {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #ea580c;
          box-shadow: 0 0 8px #ea580c, 0 0 15px #f97316;
          opacity: 0;
          z-index: 2;
        }
        .explosion {
          position: absolute;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          filter: blur(40px);
          pointer-events: none;
          z-index: 0;
        }
      `}} />

      {/* Background Decor & War Effects */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 tactical-grid opacity-50" />
        <div className="absolute inset-0 scanline-overlay pointer-events-none opacity-40 mix-blend-overlay" />
        
        {/* Animated Scanline */}
        <div className="absolute top-0 left-0 w-full h-[5vh] bg-gradient-to-b from-transparent via-red-500/10 to-transparent pointer-events-none" style={{ animation: 'scanline 8s linear infinite' }} />
        
        {/* Radar Background Element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-red-900/20 opacity-20 hidden md:block">
           <div className="absolute top-0 left-1/2 w-1/2 h-1/2 bg-gradient-to-r from-transparent to-red-500/10 origin-bottom-left" style={{ animation: 'radarSweep 4s linear infinite' }} />
           <div className="absolute top-1/2 left-0 w-full h-[1px] bg-red-900/30" />
           <div className="absolute top-0 left-1/2 w-[1px] h-full bg-red-900/30" />
           <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 border border-red-900/20 rounded-full" />
           <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] -translate-x-1/2 -translate-y-1/2 border border-red-900/20 rounded-full" />
        </div>

        {/* Explosions */}
        {[...Array(6)].map((_, i) => (
          <div key={`exp-${i}`} className="explosion" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `distantExplosion ${4 + Math.random() * 8}s infinite ease-out ${Math.random() * 10}s`
          }} />
        ))}

        {/* Floating Embers */}
        {[...Array(25)].map((_, i) => (
          <div key={`ember-${i}`} className="ember" style={{
            left: `${Math.random() * 100}%`,
            bottom: `${-10 + Math.random() * 30}%`,
            animation: `emberFloat ${4 + Math.random() * 6}s infinite ease-out ${Math.random() * 8}s`
          }} />
        ))}

        {/* Falling Bullet Casings */}
        {[...Array(12)].map((_, i) => (
          <div key={`bul-${i}`} className="bullet" style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${2 + Math.random() * 3}s`,
            animationDelay: `${Math.random() * 5}s`
          }} />
        ))}
      </div>

      {/* Global Spark Effects synced with scanline */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden" style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent calc(50vh - 285px), black calc(50vh - 275px), black calc(50vh + 275px), transparent calc(50vh + 285px))', maskImage: 'linear-gradient(to bottom, transparent calc(50vh - 285px), black calc(50vh - 275px), black calc(50vh + 275px), transparent calc(50vh + 285px))' }}>
         <div className="absolute top-0 left-0 w-full h-[5vh]" style={{ animation: 'scanline 8s linear infinite' }}>
            <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-[420px] flex justify-between">
              
              {/* Left Sparks */}
              <div className="relative -translate-x-1">
                {/* Glowing Core */}
                <div className="absolute top-1/2 -translate-y-1/2 left-0 w-[2px] h-[10px] bg-orange-400 rounded-full blur-[1px] shadow-[0_0_10px_2px_#ea580c]" />
                <div className="absolute top-1/2 -translate-y-1/2 left-0 w-[1px] h-[6px] bg-white rounded-full" />
                
                {/* Flying Particles - Group 1 */}
                <div className="absolute top-1/2 left-0 w-3 h-[1.5px] bg-orange-400 origin-left rotate-[-15deg]" style={{ animation: 'sparkLeft1 0.6s ease-out infinite' }} />
                <div className="absolute top-1/2 left-0 w-2 h-[2px] bg-yellow-300 origin-left rotate-[10deg]" style={{ animation: 'sparkLeft2 0.8s ease-out infinite 0.2s' }} />
                <div className="absolute top-1/2 left-0 w-4 h-[1px] bg-red-400 origin-left rotate-[-35deg]" style={{ animation: 'sparkLeft3 0.5s ease-out infinite 0.1s' }} />
                <div className="absolute top-1/2 left-0 w-2 h-[1px] bg-white origin-left rotate-[25deg]" style={{ animation: 'sparkLeft4 0.7s ease-out infinite 0.4s' }} />
                <div className="absolute top-1/2 left-0 w-5 h-[1.5px] bg-orange-300 origin-left rotate-[-5deg]" style={{ animation: 'sparkLeft5 0.9s ease-out infinite 0.3s' }} />
                
                {/* Flying Particles - Group 2 (Further/Faster) */}
                <div className="absolute top-1/2 left-0 w-6 h-[1.5px] bg-orange-500 origin-left rotate-[-25deg]" style={{ animation: 'sparkLeft6 0.7s ease-out infinite 0.15s' }} />
                <div className="absolute top-1/2 left-0 w-4 h-[2px] bg-yellow-400 origin-left rotate-[40deg]" style={{ animation: 'sparkLeft7 0.65s ease-out infinite 0.35s' }} />
                <div className="absolute top-1/2 left-0 w-3 h-[1px] bg-white origin-left rotate-[-10deg]" style={{ animation: 'sparkLeft8 0.55s ease-out infinite 0.05s' }} />
                <div className="absolute top-1/2 left-0 w-4 h-[1px] bg-red-500 origin-left rotate-[15deg]" style={{ animation: 'sparkLeft1 0.8s ease-out infinite 0.5s' }} />
                <div className="absolute top-1/2 left-0 w-2 h-[1px] bg-orange-300 origin-left rotate-[-45deg]" style={{ animation: 'sparkLeft3 0.75s ease-out infinite 0.25s' }} />

                {/* Random Flicker Shards */}
                <div className="absolute top-1/2 left-0 w-4 h-[1px] bg-orange-500 origin-left -rotate-45" style={{ animation: 'flicker 0.1s infinite alternate' }} />
                <div className="absolute top-1/2 left-0 w-3 h-[1px] bg-yellow-200 origin-left rotate-12" style={{ animation: 'flicker 0.15s infinite alternate-reverse' }} />
              </div>
              
              {/* Right Sparks */}
              <div className="relative translate-x-1">
                {/* Glowing Core */}
                <div className="absolute top-1/2 -translate-y-1/2 right-0 w-[2px] h-[10px] bg-orange-400 rounded-full blur-[1px] shadow-[0_0_10px_2px_#ea580c]" />
                <div className="absolute top-1/2 -translate-y-1/2 right-0 w-[1px] h-[6px] bg-white rounded-full" />
                
                {/* Flying Particles - Group 1 */}
                <div className="absolute top-1/2 right-0 w-3 h-[1.5px] bg-orange-400 origin-right rotate-[15deg]" style={{ animation: 'sparkRight1 0.6s ease-out infinite 0.1s' }} />
                <div className="absolute top-1/2 right-0 w-2 h-[2px] bg-yellow-300 origin-right rotate-[-10deg]" style={{ animation: 'sparkRight2 0.8s ease-out infinite 0.3s' }} />
                <div className="absolute top-1/2 right-0 w-4 h-[1px] bg-red-400 origin-right rotate-[35deg]" style={{ animation: 'sparkRight3 0.5s ease-out infinite' }} />
                <div className="absolute top-1/2 right-0 w-2 h-[1px] bg-white origin-right rotate-[-25deg]" style={{ animation: 'sparkRight4 0.7s ease-out infinite 0.2s' }} />
                <div className="absolute top-1/2 right-0 w-5 h-[1.5px] bg-orange-300 origin-right rotate-[5deg]" style={{ animation: 'sparkRight5 0.9s ease-out infinite 0.4s' }} />
                
                {/* Flying Particles - Group 2 (Further/Faster) */}
                <div className="absolute top-1/2 right-0 w-6 h-[1.5px] bg-orange-500 origin-right rotate-[25deg]" style={{ animation: 'sparkRight6 0.7s ease-out infinite 0.15s' }} />
                <div className="absolute top-1/2 right-0 w-4 h-[2px] bg-yellow-400 origin-right rotate-[-40deg]" style={{ animation: 'sparkRight7 0.65s ease-out infinite 0.35s' }} />
                <div className="absolute top-1/2 right-0 w-3 h-[1px] bg-white origin-right rotate-[10deg]" style={{ animation: 'sparkRight8 0.55s ease-out infinite 0.05s' }} />
                <div className="absolute top-1/2 right-0 w-4 h-[1px] bg-red-500 origin-right rotate-[-15deg]" style={{ animation: 'sparkRight1 0.8s ease-out infinite 0.5s' }} />
                <div className="absolute top-1/2 right-0 w-2 h-[1px] bg-orange-300 origin-right rotate-[45deg]" style={{ animation: 'sparkRight3 0.75s ease-out infinite 0.25s' }} />

                {/* Random Flicker Shards */}
                <div className="absolute top-1/2 right-0 w-4 h-[1px] bg-orange-500 origin-right rotate-45" style={{ animation: 'flicker 0.1s infinite alternate' }} />
                <div className="absolute top-1/2 right-0 w-3 h-[1px] bg-yellow-200 origin-right -rotate-12" style={{ animation: 'flicker 0.15s infinite alternate-reverse' }} />
              </div>

            </div>
         </div>
      </div>

      <div className="w-full max-w-[420px] z-10 relative">
        {/* Glassmorphism Container */}
        <div className="p-8 rounded-2xl border border-red-500/20 relative overflow-hidden backdrop-blur-2xl shadow-[0_0_50px_rgba(220,38,38,0.15)]"
             style={{ 
               background: 'linear-gradient(135deg, rgba(20,0,0,0.6) 0%, rgba(40,0,0,0.4) 100%)',
               boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05), border-box 0 20px 40px rgba(0,0,0,0.8)'
             }}>


          {/* Internal Corner Accents */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-red-500/50 rounded-tl-xl m-2" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-red-500/50 rounded-tr-xl m-2" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-red-500/50 rounded-bl-xl m-2" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-red-500/50 rounded-br-xl m-2" />

          {/* Cloudflare Physical Widget Overlay */}
          {!cfVerified && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-xl rounded-2xl border border-red-500/20">
              <Turnstile
                siteKey={process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY || '0x4AAAAAAC1lwdgcu4JQOl7U'}
                onSuccess={(token) => {
                  setCfToken(token);
                  setCfVerified(true);
                }}
                options={{ theme: 'dark' }}
              />
              <p className="mt-6 text-[10px] uppercase tracking-[0.3em] font-mono text-amber-500 animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]">
                Awaiting Clearance
              </p>
            </div>
          )}

          {/* Cloudflare Verification Badge */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 border border-white/5 backdrop-blur-md z-20">
            {cfVerified ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            ) : (
              <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
            )}
            <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase">
              {cfVerified ? 'Connection Secure' : 'Cloudflare Verifying...'}
            </span>
          </div>

          <div className="relative z-10 flex flex-col items-center mb-10 mt-6 transition-all duration-1000" style={{ filter: cfVerified ? 'none' : 'blur(4px)', opacity: cfVerified ? 1 : 0.6 }}>
            {/* Target Reticle Logo Container */}
            <div className="relative w-28 h-28 mb-4 flex items-center justify-center p-2">
              <Crosshair className="absolute inset-0 w-full h-full text-red-500/20 rotate-45" strokeWidth={1} />
              <div className="absolute inset-2 border border-red-500/20 rounded-full border-dashed animate-[spin_30s_linear_infinite]" />
              <img 
                src="https://assets.cdn.filesafe.space/aOaqJlyUINf9VfPvp0hw/media/6853458d1f9cb46e714d6bfa.png" 
                alt="HQ Logo" 
                className="w-20 h-20 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
              />
            </div>
            
            <h1 className={`text-5xl tracking-widest text-center uppercase crt-flicker text-red-50 ${blackOpsOne.className}`} style={{ textShadow: '0 4px 20px rgba(220,38,38,0.6)' }}>
              War Room
            </h1>
            <div className="flex items-center gap-2 mt-3 opacity-70">
              <span className="h-px w-8 bg-red-500/50 block" />
              <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-red-400">Tactical Command</p>
              <span className="h-px w-8 bg-red-500/50 block" />
            </div>
          </div>

          {isInviteFlow ? (
            /* ── Invite Flow: Set Password Form ── */
            <form onSubmit={handleSetPassword} className="relative z-10 space-y-5 transition-all duration-500">
              {/* Invite Banner */}
              <div className="p-3 rounded-lg flex items-start gap-2 bg-emerald-950/40 border border-emerald-500/30 backdrop-blur-md">
                <KeyRound className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-emerald-200 leading-snug">
                  Welcome, Operative. Set your cipher key to activate your credentials.
                </p>
              </div>

              {passwordSuccess && (
                <div className="p-3 rounded-lg flex items-start gap-2 bg-emerald-950/60 border border-emerald-500/30 backdrop-blur-md">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-emerald-200 leading-snug">Credentials established. Redirecting to HQ...</p>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg flex items-start gap-2 bg-red-950/60 border border-red-500/30 backdrop-blur-md">
                  <Shield className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-200 leading-snug">{error}</p>
                </div>
              )}

              <div className="space-y-1.5 relative group">
                <label className="text-[9px] uppercase tracking-[0.2em] font-bold text-emerald-500/70 pl-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-pulse" />
                  New Cipher Key (Password)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 rounded-lg text-sm transition-all outline-none border border-emerald-900/30 bg-black/40 text-emerald-100 placeholder:text-emerald-900/50 focus:border-emerald-500 focus:bg-black/60 font-mono tracking-widest shadow-inner"
                    placeholder="MIN 6 CHARACTERS"
                  />
                  <Lock className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-emerald-900/50" />
                </div>
              </div>

              <div className="space-y-1.5 relative group">
                <label className="text-[9px] uppercase tracking-[0.2em] font-bold text-emerald-500/70 pl-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full" />
                  Confirm Cipher Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 rounded-lg text-sm transition-all outline-none border border-emerald-900/30 bg-black/40 text-emerald-100 placeholder:text-emerald-900/50 focus:border-emerald-500 focus:bg-black/60 font-mono tracking-widest shadow-inner"
                    placeholder="REPEAT CIPHER KEY"
                  />
                  <Lock className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-emerald-900/50" />
                </div>
              </div>

              <button
                type="submit"
                disabled={settingPassword || passwordSuccess || !newPassword || !confirmPassword}
                className="w-full mt-6 py-4 rounded-lg text-sm font-black tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 relative overflow-hidden group border border-emerald-500/30 hover:border-emerald-400 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.7), rgba(4,120,87,0.5))', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)' }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-[bg-pan_3s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity" />
                {settingPassword ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Establishing Credentials...</span>
                  </>
                ) : passwordSuccess ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Credentials Set</span>
                  </>
                ) : (
                  'Activate Credentials'
                )}
              </button>
            </form>
          ) : (
            /* ── Normal Login Form ── */
            <form onSubmit={handleLogin} className="relative z-10 space-y-5 transition-all duration-1000" style={{ filter: cfVerified ? 'none' : 'blur(4px)', opacity: cfVerified ? 1 : 0.6, pointerEvents: cfVerified ? 'auto' : 'none' }}>
              {error && (
                <div className="p-3 rounded-lg flex items-start gap-2 bg-red-950/60 border border-red-500/30 backdrop-blur-md">
                  <Shield className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-200 leading-snug">{error}</p>
                </div>
              )}
            
              <div className="space-y-1.5 relative group">
                <label className="text-[9px] uppercase tracking-[0.2em] font-bold text-red-500/70 pl-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500/50 rounded-full animate-pulse" />
                  Operator Clearance Code (Email)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg text-sm transition-all outline-none border border-red-900/30 bg-black/40 text-red-100 placeholder:text-red-900/50 focus:border-red-500 focus:bg-black/60 shadow-inner"
                  placeholder="operatives@campaign.hq"
                />
              </div>
            
              <div className="space-y-1.5 relative group">
                <label className="text-[9px] uppercase tracking-[0.2em] font-bold text-red-500/70 pl-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500/50 rounded-full" />
                  Cipher Key (Password)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg text-sm transition-all outline-none border border-red-900/30 bg-black/40 text-red-100 placeholder:text-red-900/50 focus:border-red-500 focus:bg-black/60 font-mono tracking-widest shadow-inner"
                    placeholder="CLASSIFIED"
                  />
                  <Lock className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-red-900/50" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !cfVerified}
                className="w-full mt-6 py-4 rounded-lg text-sm font-black tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 relative overflow-hidden group border border-red-500/30 hover:border-red-400"
                style={{ background: 'linear-gradient(135deg, rgba(185,28,28,0.7), rgba(153,27,27,0.5))', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)' }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-[bg-pan_3s_linear_infinite] opacity-0 group-hover:opacity-100 transition-opacity" />
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Decrypting...</span>
                  </>
                ) : (
                  'Log In'
                )}
              </button>
            </form>
          )}
          
          <div className="mt-8 pt-4 border-t border-red-900/30 transition-all duration-1000" style={{ filter: cfVerified ? 'none' : 'blur(2px)', opacity: cfVerified ? 1 : 0.6 }}>
            <p className="text-[9px] text-center text-red-500/50 font-mono uppercase tracking-widest flex flex-col gap-1">
              <span>Warning: United States Government System</span>
              <span className="text-red-900/40">Unauthorized access strictly prohibited</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
