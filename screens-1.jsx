/* Time Warp — screens: Lock, Onboarding */

const { useState: useStateS1, useEffect: useEffectS1 } = React;

// -------- shared chrome --------
function StatusBar({ variant = 'light' }) {
  const c = variant === 'light' ? '#fff' : '#000';
  return (
    <div className="status-bar">
      <div style={{ color: c }}>9:41</div>
      <div className="glyphs">
        <svg width="18" height="12" viewBox="0 0 18 12">
          <rect x="0" y="7" width="3" height="5" rx="0.5" fill={c}/>
          <rect x="5" y="5" width="3" height="7" rx="0.5" fill={c}/>
          <rect x="10" y="2.5" width="3" height="9.5" rx="0.5" fill={c}/>
          <rect x="15" y="0" width="3" height="12" rx="0.5" fill={c}/>
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke={c} strokeOpacity="0.5" fill="none"/>
          <rect x="2" y="2" width="19" height="8" rx="1.5" fill={c}/>
        </svg>
      </div>
    </div>
  );
}

function HomeIndicator() {
  return <div className="home-indicator"/>;
}

// -------- Lock screen with notification --------
function LockScreen({ onTap }) {
  const [banner, setBanner] = useStateS1(false);
  useEffectS1(() => {
    const t = setTimeout(() => setBanner(true), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="screen" style={{
      background: `
        radial-gradient(ellipse at 50% 40%, rgba(123, 44, 255, 0.35) 0%, transparent 50%),
        radial-gradient(ellipse at 30% 80%, rgba(255, 62, 165, 0.25) 0%, transparent 50%),
        #000
      `,
    }}>
      <div className="starfield"/>

      {/* lockscreen time */}
      <div style={{
        position: 'absolute', top: 90, left: 0, right: 0,
        textAlign: 'center', color: '#fff',
      }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: '0.2em', opacity: 0.7 }}>
          MONDAY · APRIL 20
        </div>
        <div style={{
          fontFamily: 'var(--serif)',
          fontSize: 112,
          fontWeight: 300,
          lineHeight: 1,
          marginTop: 6,
          letterSpacing: '-0.04em',
          fontStyle: 'italic',
        }}>
          2:47
        </div>
      </div>

      {/* floating orb in background, small */}
      <div style={{
        position: 'absolute',
        left: '50%', top: 330,
        transform: 'translateX(-50%)',
        opacity: 0.35,
        pointerEvents: 'none',
      }}>
        <Orb size={140} interactive={false} material="plasma" showGlow={false}/>
      </div>

      {/* notification */}
      {banner && (
        <div
          onClick={onTap}
          className="enter"
          style={{
            position: 'absolute',
            left: 12, right: 12, top: 360,
            padding: 16,
            borderRadius: 24,
            background: 'rgba(20, 10, 40, 0.65)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            cursor: 'pointer',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}>
          {/* app icon */}
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: `radial-gradient(circle at 35% 35%, #ff3ea5, #7b2cff 60%, #1a0020)`,
            boxShadow: '0 4px 12px rgba(255, 62, 165, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
            flexShrink: 0,
          }}/>
          <div style={{ flex: 1, color: '#fff' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--mono)', fontSize: 10,
              letterSpacing: '0.15em', opacity: 0.6,
              textTransform: 'uppercase', marginBottom: 4,
            }}>
              <span>TIME WARP</span>
              <span>now</span>
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic', lineHeight: 1.25 }}>
              How long did the last hour take?
            </div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
              Hold the orb. Tell us.
            </div>
          </div>
        </div>
      )}

      {/* bottom glyphs */}
      <div style={{
        position: 'absolute', bottom: 60, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', padding: '0 44px',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15 8L21 9L16.5 13.5L18 20L12 17L6 20L7.5 13.5L3 9L9 8L12 2Z" fill="#fff" opacity="0.8"/>
          </svg>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 8L12 4L20 8V18C20 19 19 20 18 20H6C5 20 4 19 4 18V8Z" stroke="#fff" strokeWidth="2" opacity="0.8"/>
            <circle cx="12" cy="13" r="3" stroke="#fff" strokeWidth="2" opacity="0.8"/>
          </svg>
        </div>
      </div>

    </div>
  );
}

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

Object.assign(window, { LockScreen, Onboarding, DemographicsStep, StatusBar, HomeIndicator });
