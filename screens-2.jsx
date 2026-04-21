/* Time Warp — capture screen (the hero interaction) */

const { useState: useStateS2, useEffect: useEffectS2, useRef: useRefS2 } = React;

// Top-left circular glyph button — used for the calendar entry-point into
// the week-history screen. Matches the round back-button style in screens-3.
function CalendarButton({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Open week" style={{
      position: 'absolute', top: 18, left: 18, zIndex: 6,
      width: 40, height: 40, borderRadius: '50%',
      background: 'rgba(255,255,255,0.06)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#fff', cursor: 'pointer',
      display: 'grid', placeItems: 'center',
    }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="#fff" strokeWidth="1.3"/>
        <path d="M1.5 6h13" stroke="#fff" strokeWidth="1.3"/>
        <path d="M5 1.5v2M11 1.5v2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    </button>
  );
}

function CaptureScreen({ onSubmit, onOpenHistory, material = 'plasma' }) {
  const [stretch, setStretch] = useStateS2(0);
  const [phase, setPhase] = useStateS2('ask'); // ask -> pulling -> submitting -> done
  const [hasDragged, setHasDragged] = useStateS2(false);

  const [label, sub] = stretchToLabel(stretch);
  const minutes = stretchToMinutes(stretch);
  const hue = stretchToHue(stretch);

  useEffectS2(() => {
    if (Math.abs(stretch) > 0.05 && !hasDragged) {
      setHasDragged(true);
      setPhase('pulling');
    }
  }, [stretch, hasDragged]);

  const [queued, setQueued] = useStateS2(false);
  const handleSubmit = async () => {
    setPhase('submitting');
    const payload = { stretch, minutes, label };
    try {
      const r = await window.TWApi.submitHour(payload);
      setQueued(Boolean(r && r.queued));
    } catch (e) { setQueued(true); }
    // Keep the ripple visible long enough to feel intentional.
    setTimeout(() => onSubmit?.(payload), 800);
  };

  return (
    <div className="screen" style={{
      background: `
        radial-gradient(ellipse 110% 70% at 50% 45%, oklch(0.28 0.22 ${hue} / 0.5) 0%, transparent 60%),
        radial-gradient(ellipse at 20% 0%, rgba(123, 44, 255, 0.15) 0%, transparent 50%),
        #030006
      `,
      transition: 'background 0.6s ease',
    }}>
      <div className="starfield" style={{ opacity: 0.4 }}/>

      {/* Calendar -> week history */}
      {onOpenHistory && <CalendarButton onClick={onOpenHistory}/>}

      {/* TOP: mirror prompt */}
      <div style={{
        position: 'absolute', top: 72, left: 28, right: 28,
        textAlign: 'center',
        opacity: phase === 'submitting' ? 0 : 1,
        transition: 'opacity 0.6s',
      }}>
        <div className="serif" style={{
          fontSize: 30, lineHeight: 1.15,
          color: '#fff', letterSpacing: '-0.02em',
        }}>
          How long did
          <br/>
          <span style={{ opacity: 0.65 }}>the last hour</span>
          <br/>
          take?
        </div>
      </div>

      {/* CENTER: the orb */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 40,
      }}>
        <Orb
          size={260}
          stretch={stretch}
          onStretchChange={setStretch}
          material={material}
          interactive={phase !== 'submitting'}
        />
      </div>

      {/* Ticks / scale indicators */}
      <div style={{
        position: 'absolute',
        left: 28, right: 28, top: 470,
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--mono)', fontSize: 10,
        color: 'var(--ink-faint)',
        letterSpacing: '0.15em',
        pointerEvents: 'none',
      }}>
        <span>↑ FLEW</span>
        <span style={{ opacity: Math.abs(stretch) < 0.1 ? 1 : 0.3, transition: 'opacity 0.3s' }}>· 60 ·</span>
        <span>↓ DRAGGED</span>
      </div>

      {/* BOTTOM: the read-out */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 140,
        textAlign: 'center',
        opacity: phase === 'submitting' ? 0 : 1,
        transition: 'opacity 0.6s',
      }}>
        {/* Felt like */}
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          FELT LIKE
        </div>
        <div style={{
          fontFamily: 'var(--serif)',
          fontStyle: 'italic',
          fontSize: 64,
          lineHeight: 1,
          color: '#fff',
          letterSpacing: '-0.03em',
          marginBottom: 4,
        }}>
          <span style={{
            color: `oklch(0.85 0.22 ${hue})`,
            filter: `drop-shadow(0 0 20px oklch(0.7 0.3 ${hue} / 0.6))`,
            transition: 'color 0.3s',
          }}>
            {minutes}
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 18, opacity: 0.5,
            fontStyle: 'normal', marginLeft: 6,
          }}>min</span>
        </div>
        <div style={{
          fontFamily: 'var(--sans)',
          fontSize: 14,
          color: 'var(--ink-dim)',
          fontWeight: 400,
        }}>
          {label.toLowerCase()} · <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontSize: 16 }}>{sub}</span>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: 'absolute',
        bottom: 56, left: 28, right: 28,
        display: 'flex', flexDirection: 'column', gap: 12,
        alignItems: 'center',
      }}>
        {!hasDragged ? (
          <div style={{
            color: 'var(--ink-faint)',
            fontFamily: 'var(--mono)', fontSize: 11,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            animation: 'breathe 3s ease-in-out infinite',
          }}>
            ✹ hold & pull the orb
          </div>
        ) : (
          <button
            className="btn-primary"
            style={{ width: '100%', maxWidth: 300 }}
            onClick={handleSubmit}
            disabled={phase === 'submitting'}>
            {phase === 'submitting' ? (queued ? 'Saved — will sync' : 'Logging…') : 'Log this hour'}
          </button>
        )}
      </div>

      {/* Submitting ripple */}
      {phase === 'submitting' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 260, height: 260,
            borderRadius: '50%',
            border: `2px solid oklch(0.7 0.3 ${hue})`,
            animation: 'ripple 1.2s ease-out forwards',
          }}/>
          <style>{`
            @keyframes ripple {
              from { transform: scale(0.5); opacity: 1; }
              to { transform: scale(3); opacity: 0; }
            }
          `}</style>
        </div>
      )}

    </div>
  );
}

Object.assign(window, { CaptureScreen, CalendarButton });
