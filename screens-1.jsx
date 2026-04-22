/* Time Warp — screens: Onboarding, Demographics, Profile */

const { useState: useStateS1, useEffect: useEffectS1 } = React;

// -------- Onboarding --------
const ONBOARD_STEPS = [
  {
    eyebrow: 'INDEX: 01 / 03',
    title: ['Time is not', 'a flat line.'],
    body: 'Some hours vanish like a breath. Others drag like wet cement. You already know this.',
    cta: 'Continue',
  },
  {
    eyebrow: 'INDEX: 02 / 03',
    title: ['Once a day,', "we'll ask."],
    body: 'A notification at a random hour. No charts. No streaks. Just one question, and an orb.',
    cta: 'Continue',
  },
  {
    eyebrow: 'INDEX: 03 / 03',
    title: ['You pull it', 'like taffy.'],
    body: 'Compress if the hour flew. Stretch if it dragged. The world sees how it felt, together.',
    cta: 'Begin',
  },
];

function Onboarding({ onDone }) {
  const [step, setStep] = useStateS1(0);
  const totalSteps = ONBOARD_STEPS.length + 1; // +1 for demographics
  const isDemographics = step === ONBOARD_STEPS.length;

  if (isDemographics) {
    return <DemographicsStep stepIndex={step} totalSteps={totalSteps} onDone={onDone}/>;
  }

  const d = ONBOARD_STEPS[step];

  return (
    <div className="screen" style={{
      background: `
        radial-gradient(ellipse at 70% 10%, rgba(255, 62, 165, 0.18) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 90%, rgba(123, 44, 255, 0.18) 0%, transparent 50%),
        #050008
      `,
    }}>
      <div className="starfield" style={{ opacity: 0.5 }}/>

      {/* illustration */}
      <div style={{
        position: 'absolute',
        top: 90, left: 0, right: 0,
        height: 280,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {step === 0 && <OnboardIllo1/>}
        {step === 1 && <OnboardIllo2/>}
        {step === 2 && <OnboardIllo3/>}
      </div>

      {/* text */}
      <div style={{
        position: 'absolute',
        left: 32, right: 32, top: 420,
      }}>
        <div className="eyebrow" key={step + 'e'} style={{ marginBottom: 20, animation: 'float-up 0.6s both' }}>
          {d.eyebrow}
        </div>
        <h1
          key={step + 't'}
          className="serif enter"
          style={{
            fontSize: 48, fontWeight: 400,
            lineHeight: 1.05, letterSpacing: '-0.02em',
            color: '#fff', marginBottom: 20,
          }}>
          {d.title.map((l, i) => <div key={i}>{l}</div>)}
        </h1>
        <p
          key={step + 'b'}
          className="enter"
          style={{
            animationDelay: '0.1s',
            fontSize: 15, lineHeight: 1.55,
            color: 'rgba(255,255,255,0.62)', maxWidth: 300,
          }}>
          {d.body}
        </p>
      </div>

      {/* progress */}
      <div style={{
        position: 'absolute', bottom: 150, left: 32,
        display: 'flex', gap: 6,
      }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{
            width: i === step ? 28 : 6,
            height: 6, borderRadius: 100,
            background: i === step ? '#ff3ea5' : 'rgba(255,255,255,0.15)',
            boxShadow: i === step ? '0 0 10px #ff3ea5' : 'none',
            transition: 'all 0.4s',
          }}/>
        ))}
      </div>

      {/* CTA */}
      <div style={{ position: 'absolute', bottom: 56, left: 32, right: 32 }}>
        <button
          className="btn-primary"
          style={{ width: '100%' }}
          onClick={() => setStep(step + 1)}>
          {d.cta}
        </button>
        <button
          className="btn-ghost"
          onClick={onDone}
          style={{
            background: 'transparent', border: 0, color: 'var(--ink-faint)',
            marginTop: 14, width: '100%', padding: 12,
            fontFamily: 'var(--mono)', fontSize: 11,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}>
          skip intro
        </button>
      </div>

    </div>
  );
}

// -------- Demographics (final onboarding step) --------
// Captured once, sent with every submission. Hemisphere is auto-derived from
// the browser timezone; everything else is optional. This is the only place
// we surface the public-dataset note.
function DemographicsStep({ stepIndex, totalSteps, onDone }) {
  const P = window.TWProfile;
  const initial = P.getProfile();
  const [ageBucket, setAge] = useStateS1(initial.ageBucket || '');
  const [gender, setGender] = useStateS1(initial.gender || '');
  const [interests, setInterests] = useStateS1(initial.interests || []);

  const toggleInterest = (tag) => {
    setInterests((prev) => prev.includes(tag)
      ? prev.filter((t) => t !== tag)
      : [...prev, tag]);
  };

  const save = () => {
    P.setProfile({
      ageBucket: ageBucket || null,
      gender: gender || null,
      interests,
      hemisphere: P.getHemisphere(),
      tz: P.getTimezone(),
      onboardedAt: Date.now(),
    });
    if (window.TWNotifications) {
      window.TWNotifications.requestAndSchedule().catch(() => {});
    }
    onDone?.();
  };

  return (
    <div className="screen" style={{
      background: `
        radial-gradient(ellipse at 70% 10%, rgba(255, 62, 165, 0.18) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 90%, rgba(123, 44, 255, 0.18) 0%, transparent 50%),
        #050008
      `,
    }}>
      <div className="starfield" style={{ opacity: 0.5 }}/>

      <div style={{ position: 'absolute', top: 70, left: 32, right: 32 }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>
          INDEX: 0{stepIndex + 1} / 0{totalSteps}
        </div>
        <h1 className="serif" style={{
          fontSize: 40, fontWeight: 400, lineHeight: 1.05,
          letterSpacing: '-0.02em', color: '#fff', marginBottom: 10,
        }}>
          A few rough shapes<br/>about you.
        </h1>
        <p style={{
          fontSize: 13, lineHeight: 1.55,
          color: 'rgba(255,255,255,0.6)',
        }}>
          Optional. Pooled anonymously so patterns can surface — hemisphere, age, rhythm.
          Never tied to an identity. <a href="DATA.md" style={{ color: '#ff3ea5', textDecoration: 'none' }}>See what's public →</a>
        </p>
      </div>

      <div style={{
        position: 'absolute', top: 230, left: 24, right: 24, bottom: 160,
        overflowY: 'auto',
      }} className="no-scrollbar">
        <DemoRow label="AGE">
          <div className="chip-row">
            {P.AGE_BUCKETS.map((b) => (
              <button key={b} className="chip"
                data-active={ageBucket === b}
                onClick={() => setAge(ageBucket === b ? '' : b)}>{b}</button>
            ))}
          </div>
        </DemoRow>

        <DemoRow label="GENDER">
          <div className="chip-row">
            {P.GENDERS.map((g) => (
              <button key={g} className="chip"
                data-active={gender === g}
                onClick={() => setGender(gender === g ? '' : g)}>{g}</button>
            ))}
          </div>
        </DemoRow>

        <DemoRow label="INTERESTS · RHYTHMS">
          <div className="chip-row">
            {P.INTERESTS.map((t) => (
              <button key={t} className="chip"
                data-active={interests.includes(t)}
                onClick={() => toggleInterest(t)}>{t}</button>
            ))}
          </div>
        </DemoRow>

        <div style={{
          marginTop: 8, fontFamily: 'var(--mono)', fontSize: 10,
          letterSpacing: '0.12em', color: 'var(--ink-faint)',
        }}>
          HEMISPHERE · {P.getHemisphere()} (auto from timezone)
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 150, left: 32,
        display: 'flex', gap: 6,
      }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{
            width: i === stepIndex ? 28 : 6,
            height: 6, borderRadius: 100,
            background: i === stepIndex ? '#ff3ea5' : 'rgba(255,255,255,0.15)',
            boxShadow: i === stepIndex ? '0 0 10px #ff3ea5' : 'none',
            transition: 'all 0.4s',
          }}/>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 56, left: 32, right: 32 }}>
        <button className="btn-primary" style={{ width: '100%' }} onClick={save}>
          Begin
        </button>
        <button
          onClick={save}
          style={{
            background: 'transparent', border: 0, color: 'var(--ink-faint)',
            marginTop: 14, width: '100%', padding: 12,
            fontFamily: 'var(--mono)', fontSize: 11,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}>
          skip — no demographics
        </button>
      </div>

    </div>
  );
}

function DemoRow({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

// -------- Notification settings block (used inside ProfileScreen) --------
function NotifyRow({ mode, setMode, wakeStart, setWakeStart, wakeEnd, setWakeEnd }) {
  const fmt = (h) => {
    if (h === 0) return '12 am';
    if (h === 12) return '12 pm';
    if (h < 12) return `${h} am`;
    return `${h - 12} pm`;
  };
  const muted = mode === 'off';

  // Test-ping state — fires an immediate notification so the user can
  // confirm permissions + delivery before waiting for a real schedule.
  const [pingState, setPingState] = useStateS1('idle'); // idle | sending | sent | blocked | unsupported | error
  const [pingErr, setPingErr] = useStateS1('');
  const runTestPing = async () => {
    if (!window.TWNotifications) { setPingState('unsupported'); return; }
    setPingState('sending'); setPingErr('');
    try {
      const r = await window.TWNotifications.testPing();
      if (r.ok) setPingState('sent');
      else if (r.reason === 'denied') setPingState('blocked');
      else if (r.reason === 'unsupported') setPingState('unsupported');
      else { setPingState('error'); setPingErr(r.error || ''); }
    } catch (e) { setPingState('error'); setPingErr(String(e && e.message || e)); }
    setTimeout(() => setPingState('idle'), 4000);
  };
  const pingLabel = {
    idle: 'Send test ping',
    sending: 'Sending…',
    sent: '✓ Ping sent — check your system tray',
    blocked: 'Blocked — enable notifications in browser settings',
    unsupported: 'Not supported on this browser',
    error: 'Couldn\'t send' + (pingErr ? ` · ${pingErr}` : ''),
  }[pingState];
  const pingColor = pingState === 'sent' ? '#4fe9ff'
    : (pingState === 'blocked' || pingState === 'error' || pingState === 'unsupported') ? '#ff6a86'
    : '#fff';
  return (
    <div style={{
      marginTop: 24, padding: '16px 16px 14px',
      borderRadius: 14,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>NOTIFICATIONS</div>
      <div className="chip-row" style={{ marginBottom: 12 }}>
        {[
          { id: 'daily',  label: 'once a day · random' },
          { id: 'hourly', label: 'every wake hour' },
          { id: 'off',    label: 'off' },
        ].map((m) => (
          <button key={m.id} className="chip"
            data-active={mode === m.id}
            onClick={() => setMode(m.id)}>{m.label}</button>
        ))}
      </div>

      <div style={{
        opacity: muted ? 0.35 : 1,
        pointerEvents: muted ? 'none' : 'auto',
        transition: 'opacity 0.2s',
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--ink-faint)', letterSpacing: '0.12em',
          marginBottom: 6,
        }}>
          WAKE WINDOW · <span style={{ color: 'var(--ink-dim)' }}>{fmt(wakeStart)} → {fmt(wakeEnd)}</span>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.15em', color: 'var(--ink-faint)', marginBottom: 4 }}>START</div>
          <input
            type="range" min={0} max={22} step={1} value={wakeStart}
            onChange={(e) => {
              const v = Number(e.target.value);
              setWakeStart(v);
              if (wakeEnd <= v) setWakeEnd(Math.min(24, v + 1));
            }}
            style={{ width: '100%', accentColor: '#ff3ea5' }}/>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.15em', color: 'var(--ink-faint)', marginBottom: 4 }}>END</div>
          <input
            type="range" min={wakeStart + 1} max={24} step={1} value={wakeEnd}
            onChange={(e) => setWakeEnd(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#ff3ea5' }}/>
        </div>
      </div>

      <div style={{
        marginTop: 12, fontFamily: 'var(--serif)', fontStyle: 'italic',
        fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5,
      }}>
        {mode === 'off' && 'No reminders — log whenever you remember.'}
        {mode === 'daily' && `One gentle ping at a random time between ${fmt(wakeStart)} and ${fmt(wakeEnd)}.`}
        {mode === 'hourly' && `A ping at the top of every hour from ${fmt(wakeStart)} until ${fmt(wakeEnd)}. That's ${wakeEnd - wakeStart} a day.`}
      </div>

      <button
        onClick={runTestPing}
        disabled={pingState === 'sending'}
        style={{
          marginTop: 12, width: '100%',
          padding: '11px 14px', borderRadius: 12,
          background: 'rgba(79, 233, 255, 0.08)',
          border: '1px solid rgba(79, 233, 255, 0.28)',
          color: pingColor, cursor: pingState === 'sending' ? 'wait' : 'pointer',
          fontFamily: 'var(--mono)', fontSize: 11,
          letterSpacing: '0.15em', textAlign: 'center',
          transition: 'color 0.2s',
        }}>
        {pingLabel.toUpperCase()}
      </button>
    </div>
  );
}

function OnboardIllo1() {
  // Wavy timeline
  return (
    <svg width="360" height="260" viewBox="0 0 360 260">
      <defs>
        <linearGradient id="wave-g" x1="0" x2="1">
          <stop offset="0%" stopColor="#4fe9ff" stopOpacity="0"/>
          <stop offset="30%" stopColor="#4fe9ff"/>
          <stop offset="60%" stopColor="#ff3ea5"/>
          <stop offset="100%" stopColor="#ff9500" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <g>
        {[...Array(5)].map((_, i) => (
          <path
            key={i}
            d={`M 20 130 Q 80 ${80 + i*8} 140 ${140 - i*3} T 260 ${120 + i*5} T 340 130`}
            stroke="url(#wave-g)"
            strokeWidth="1.5"
            fill="none"
            opacity={0.3 + i * 0.15}
          />
        ))}
        {/* tick marks */}
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <g key={i}>
            <line
              x1={30 + i * 52} y1="170"
              x2={30 + i * 52} y2="180"
              stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
            <text
              x={30 + i * 52} y="200"
              fill="rgba(255,255,255,0.45)"
              fontFamily="JetBrains Mono" fontSize="10"
              textAnchor="middle">
              {['12','1','2','3','4','5','6'][i]}
            </text>
          </g>
        ))}
        {/* floating dots */}
        <circle cx="90" cy="105" r="3" fill="#4fe9ff"/>
        <circle cx="180" cy="145" r="4" fill="#ff3ea5"/>
        <circle cx="270" cy="120" r="3" fill="#ff9500"/>
      </g>
    </svg>
  );
}

function OnboardIllo2() {
  // Clock with random notification pings
  return (
    <div style={{ position: 'relative', width: 280, height: 280 }}>
      {/* clock face */}
      <div style={{
        position: 'absolute', inset: 40,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.12)',
      }}/>
      <div style={{
        position: 'absolute', inset: 60,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.06)',
      }}/>
      {/* ticks */}
      {[...Array(12)].map((_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: '50%', top: '50%',
            width: 2, height: i % 3 === 0 ? 10 : 5,
            background: 'rgba(255,255,255,0.3)',
            transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-${105}px)`,
            transformOrigin: 'center',
          }}/>
        );
      })}
      {/* random bell */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: `translate(-50%, -50%) translate(60px, -50px)`,
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: 14,
          background: 'radial-gradient(circle at 35% 35%, #ff3ea5, #7b2cff 70%)',
          boxShadow: '0 0 30px rgba(255, 62, 165, 0.6), inset 0 1px 0 rgba(255,255,255,0.3)',
          animation: 'breathe 2s ease-in-out infinite',
        }}/>
        {/* ripples */}
        <div style={{
          position: 'absolute', inset: -10,
          borderRadius: 20,
          border: '1px solid #ff3ea5',
          animation: 'breathe 2s ease-in-out infinite',
          opacity: 0.4,
        }}/>
      </div>
      {/* question mark */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        fontFamily: 'Instrument Serif',
        fontSize: 64, fontStyle: 'italic',
        color: 'rgba(255,255,255,0.8)',
      }}>?</div>
    </div>
  );
}

function OnboardIllo3() {
  // Orb being pulled
  return (
    <div style={{ position: 'relative', width: 280, height: 260 }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
        <Orb size={180} stretch={0.4} interactive={false} material="plasma"/>
      </div>
      {/* pinch indicators */}
      <svg width="280" height="260" style={{ position: 'absolute', inset: 0 }}>
        <g opacity="0.5">
          <circle cx="140" cy="50" r="14" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="3 3"/>
          <circle cx="140" cy="210" r="14" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="3 3"/>
          <path d="M 140 64 L 140 82" stroke="#fff" strokeWidth="1"/>
          <path d="M 140 178 L 140 196" stroke="#fff" strokeWidth="1"/>
          {/* arrows */}
          <path d="M 135 45 L 140 40 L 145 45" stroke="#fff" strokeWidth="1" fill="none"/>
          <path d="M 135 215 L 140 220 L 145 215" stroke="#fff" strokeWidth="1" fill="none"/>
        </g>
      </svg>
    </div>
  );
}

// -------- Profile (edit demographics, replay intro, reset device) --------
function ProfileScreen({ onBack, onReplayIntro }) {
  const P = window.TWProfile;
  const initial = P.getProfile();
  const initialNotify = P.getNotifyPrefs();
  const [ageBucket, setAge] = useStateS1(initial.ageBucket || '');
  const [gender, setGender] = useStateS1(initial.gender || '');
  const [interests, setInterests] = useStateS1(initial.interests || []);
  const [notifyMode, setNotifyMode] = useStateS1(initialNotify.mode);
  const [wakeStart, setWakeStart] = useStateS1(initialNotify.wakeStart);
  const [wakeEnd, setWakeEnd] = useStateS1(initialNotify.wakeEnd);
  const [saved, setSaved] = useStateS1(false);

  const anonId = P.getAnonId();
  const hemisphere = P.getHemisphere();
  const tz = P.getTimezone();

  const toggleInterest = (tag) => {
    setInterests((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  // Autosave on change — profile edits should feel immediate, with a brief
  // "saved" confirmation rather than a modal commit step.
  useEffectS1(() => {
    P.setProfile({
      ageBucket: ageBucket || null,
      gender: gender || null,
      interests,
    });
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 900);
    return () => clearTimeout(t);
  }, [ageBucket, gender, interests]);

  // Notification preferences autosave too, and reschedule the triggers
  // so changes take effect without a settings-save button.
  useEffectS1(() => {
    P.setNotifyPrefs({ mode: notifyMode, wakeStart, wakeEnd });
    if (window.TWNotifications) {
      window.TWNotifications.requestAndSchedule().catch(() => {});
    }
  }, [notifyMode, wakeStart, wakeEnd]);

  const resetDevice = () => {
    if (!confirm('Reset this device? This clears your anonymous ID, demographics, and local history. Your server submissions stay.')) return;
    try {
      localStorage.removeItem('tw_anon_id');
      localStorage.removeItem('tw_profile');
      localStorage.removeItem('tw_pending');
      localStorage.removeItem('tw_screen');
      localStorage.removeItem('tw_tweaks');
      localStorage.removeItem('tw_last_submit');
      localStorage.removeItem('tw_demo');
      localStorage.removeItem('tw_next_ping');
    } catch (e) {}
    window.location.hash = '';
    window.location.reload();
  };

  return (
    <div className="screen" style={{
      background: `
        radial-gradient(ellipse at 70% 0%, rgba(123, 44, 255, 0.18) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 100%, rgba(255, 62, 165, 0.14) 0%, transparent 50%),
        #050008
      `,
    }}>
      <div className="starfield" style={{ opacity: 0.3 }}/>

      <div style={{
        position: 'absolute', top: 52, left: 0, right: 0,
        padding: '0 24px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', zIndex: 5,
      }}>
        <button onClick={onBack} aria-label="Back" style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#fff', cursor: 'pointer',
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L3 7l6 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="eyebrow">PROFILE</div>
        <div style={{
          width: 38, height: 38, display: 'grid', placeItems: 'center',
          fontFamily: 'var(--mono)', fontSize: 10, color: saved ? '#4fe9ff' : 'transparent',
          letterSpacing: '0.12em', transition: 'color 0.3s',
        }}>SAVED</div>
      </div>

      <div style={{
        position: 'absolute', top: 108, left: 24, right: 24, bottom: 24,
        overflowY: 'auto', paddingBottom: 40,
      }} className="no-scrollbar">

        <h1 className="serif" style={{
          fontSize: 34, fontWeight: 400, lineHeight: 1.05,
          letterSpacing: '-0.02em', color: '#fff', margin: '0 0 8px',
        }}>
          An anonymous<br/>shape of you.
        </h1>
        <p style={{
          fontSize: 13, lineHeight: 1.55,
          color: 'rgba(255,255,255,0.55)', marginBottom: 24,
        }}>
          Change anything any time. Nothing here ties back to you — only a random device ID.
        </p>

        <DemoRow label="AGE">
          <div className="chip-row">
            {P.AGE_BUCKETS.map((b) => (
              <button key={b} className="chip"
                data-active={ageBucket === b}
                onClick={() => setAge(ageBucket === b ? '' : b)}>{b}</button>
            ))}
          </div>
        </DemoRow>

        <DemoRow label="GENDER">
          <div className="chip-row">
            {P.GENDERS.map((g) => (
              <button key={g} className="chip"
                data-active={gender === g}
                onClick={() => setGender(gender === g ? '' : g)}>{g}</button>
            ))}
          </div>
        </DemoRow>

        <DemoRow label="INTERESTS · RHYTHMS">
          <div className="chip-row">
            {P.INTERESTS.map((t) => (
              <button key={t} className="chip"
                data-active={interests.includes(t)}
                onClick={() => toggleInterest(t)}>{t}</button>
            ))}
          </div>
        </DemoRow>

        <div style={{
          marginTop: 6, padding: '12px 14px', borderRadius: 12,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--ink-faint)', letterSpacing: '0.1em', lineHeight: 1.7,
        }}>
          <div>HEMISPHERE · <span style={{ color: 'var(--ink-dim)' }}>{hemisphere}</span> (auto)</div>
          <div>TIMEZONE · <span style={{ color: 'var(--ink-dim)' }}>{tz}</span></div>
          <div>DEVICE ID · <span style={{ color: 'var(--ink-dim)' }}>{anonId.slice(0, 8)}…</span></div>
        </div>

        <NotifyRow
          mode={notifyMode} setMode={setNotifyMode}
          wakeStart={wakeStart} setWakeStart={setWakeStart}
          wakeEnd={wakeEnd} setWakeEnd={setWakeEnd}/>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onReplayIntro} style={{
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff', cursor: 'pointer', textAlign: 'left',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 2 }}>INTRO</div>
              <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 15 }}>
                Replay the opening →
              </div>
            </div>
          </button>

          <a href="DATA.md" style={{
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff', cursor: 'pointer', textDecoration: 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 2 }}>DATA</div>
              <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 15 }}>
                What's public →
              </div>
            </div>
          </a>

          <button onClick={resetDevice} style={{
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(255, 62, 100, 0.08)',
            border: '1px solid rgba(255, 62, 100, 0.22)',
            color: '#ff6a86', cursor: 'pointer', textAlign: 'left',
            fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.15em',
          }}>
            RESET THIS DEVICE
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Onboarding, DemographicsStep, ProfileScreen });
