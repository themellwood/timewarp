/* Time Warp — 5 alternative capture UIs
 * Each takes: { onSubmit, material }
 * Each produces a stretch value (-1..1) and calls onSubmit({ stretch, minutes, label })
 */

const { useState: useCapAlt, useEffect: useECapAlt, useRef: useRCapAlt } = React;

// Shared shell (prompt at top, submit at bottom)
function CaptureShell({ children, stretch, onSubmit, onOpenHistory, hint, label, sub, minutes, hue, hasInteracted, allowSubmit }) {
  return (
    <div className="screen" style={{
      background: `
        radial-gradient(ellipse 110% 70% at 50% 45%, oklch(0.28 0.22 ${hue} / 0.45) 0%, transparent 60%),
        radial-gradient(ellipse at 20% 0%, rgba(123, 44, 255, 0.14) 0%, transparent 50%),
        #030006`,
      transition: 'background 0.5s ease',
    }}>
      <div className="starfield" style={{ opacity: 0.4 }}/>

      {onOpenHistory && window.CalendarButton && <window.CalendarButton onClick={onOpenHistory}/>}

      <div style={{
        position: 'absolute', top: 72, left: 28, right: 28,
        textAlign: 'center',
      }}>
        <div className="serif" style={{
          fontSize: 30, lineHeight: 1.15, color: '#fff', letterSpacing: '-0.02em',
        }}>
          How long did<br/>
          <span style={{ opacity: 0.65 }}>the last hour</span><br/>
          take?
        </div>
      </div>

      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>

      {/* read-out */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 140, textAlign: 'center',
      }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>FELT LIKE</div>
        <div style={{
          fontFamily: 'var(--serif)', fontStyle: 'italic',
          fontSize: 56, lineHeight: 1, color: '#fff',
          letterSpacing: '-0.03em', marginBottom: 4,
        }}>
          <span style={{
            color: `oklch(0.85 0.22 ${hue})`,
            filter: `drop-shadow(0 0 18px oklch(0.7 0.3 ${hue} / 0.6))`,
          }}>{minutes}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 16, opacity: 0.5, fontStyle: 'normal', marginLeft: 6 }}>min</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
          {label.toLowerCase()} · <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontSize: 15 }}>{sub}</span>
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 56, left: 28, right: 28,
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
      }}>
        {!hasInteracted ? (
          <div style={{
            color: 'var(--ink-faint)', fontFamily: 'var(--mono)', fontSize: 11,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            animation: 'breathe 3s ease-in-out infinite',
          }}>✹ {hint}</div>
        ) : (
          <button className="btn-primary" style={{ width: '100%', maxWidth: 300 }}
            onClick={() => onSubmit?.({ stretch, minutes, label })}>
            Log this hour
          </button>
        )}
      </div>

    </div>
  );
}

// Utility: stretch->feel
function readout(stretch) {
  const [label, sub] = stretchToLabel(stretch);
  const minutes = stretchToMinutes(stretch);
  const hue = stretchToHue(stretch);
  return { label, sub, minutes, hue };
}

// ============================================================
// VARIANT A — Elastic Timeline
// Drag the endpoint of a rubber-band timeline.
// The band represents the hour; if you drag it short = flew, long = dragged.
// ============================================================
function CaptureTimeline({ onSubmit, onOpenHistory }) {
  const [stretch, setStretch] = useCapAlt(0);
  const [dragging, setDragging] = useCapAlt(false);
  const [hasInteracted, setHasInteracted] = useCapAlt(false);
  const trackRef = useRCapAlt(null);
  const ro = readout(stretch);

  // Center point is neutral; handle x in -1..1 relative to half-track
  const handleDown = (e) => {
    e.preventDefault(); setDragging(true); setHasInteracted(true);
  };
  const handleMove = (e) => {
    if (!dragging || !trackRef.current) return;
    const p = e.touches ? e.touches[0] : e;
    const rect = trackRef.current.getBoundingClientRect();
    const x = (p.clientX - rect.left) / rect.width; // 0..1
    // 0.5 is neutral, 0 is fully compressed (flew), 1 is fully stretched (dragged)
    setStretch(Math.max(-1, Math.min(1, (x - 0.5) * 2)));
  };
  const handleUp = () => setDragging(false);

  useECapAlt(() => {
    if (!dragging) return;
    const mv = (e) => handleMove(e);
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', mv, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', mv);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging]);

  // visual: scaleX of the band from 0.2 to 1.8 depending on stretch
  const bandW = (1 + stretch) * 50; // 0 to 100 percent
  const bandColor = `oklch(0.75 0.3 ${ro.hue})`;

  return (
    <CaptureShell {...ro} stretch={stretch} onSubmit={onSubmit} onOpenHistory={onOpenHistory}
      hint="grab & stretch the hour" hasInteracted={hasInteracted}>
      {/* Centered stretchable band */}
      <div style={{
        position: 'absolute', left: 28, right: 28, top: 300,
      }}>
        {/* ruler background */}
        <div style={{
          position: 'relative', height: 120,
          display: 'flex', alignItems: 'center',
        }}>
          {/* ghost track (the full hour representation) */}
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '50%',
            transform: 'translateY(-50%)',
            height: 2, background: 'rgba(255,255,255,0.06)',
            borderLeft: '2px solid rgba(255,255,255,0.25)',
            borderRight: '2px solid rgba(255,255,255,0.25)',
          }}/>
          {/* ticks */}
          {[...Array(13)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${(i/12)*100}%`, top: '50%', transform: 'translate(-50%, -50%)',
              width: 1, height: i % 6 === 0 ? 14 : 6,
              background: 'rgba(255,255,255,0.2)',
            }}/>
          ))}
          {[0, 30, 60].map(m => (
            <div key={m} style={{
              position: 'absolute', left: `${(m/60)*100}%`, top: 0,
              transform: 'translateX(-50%)',
              fontFamily: 'var(--mono)', fontSize: 9,
              color: 'var(--ink-faint)', letterSpacing: '0.1em',
            }}>{m}m</div>
          ))}
          {/* "how long it felt" band */}
          <div ref={trackRef} style={{
            position: 'absolute', left: 0, right: 0, top: '50%',
            transform: 'translateY(-50%)', height: 60,
          }}>
            <div style={{
              position: 'absolute',
              left: `${50 - bandW/2}%`, width: `${bandW}%`,
              top: '50%', transform: 'translateY(-50%)',
              height: 6, borderRadius: 4,
              background: `linear-gradient(90deg, transparent, ${bandColor}, transparent)`,
              boxShadow: `0 0 20px ${bandColor}`,
              transition: dragging ? 'none' : 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}/>
            {/* handle */}
            <div
              onMouseDown={handleDown} onTouchStart={handleDown}
              style={{
                position: 'absolute',
                left: `calc(${((stretch + 1) / 2) * 100}% - 18px)`,
                top: '50%', transform: 'translateY(-50%)',
                width: 36, height: 36, borderRadius: '50%',
                background: `radial-gradient(circle at 35% 35%, oklch(0.9 0.2 ${ro.hue}), oklch(0.55 0.3 ${ro.hue}))`,
                boxShadow: `0 0 24px ${bandColor}, inset 0 1px 0 rgba(255,255,255,0.4)`,
                cursor: dragging ? 'grabbing' : 'grab',
                touchAction: 'none', zIndex: 2,
                transition: dragging ? 'none' : 'left 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}/>
            {/* left anchor */}
            <div style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 8, height: 8, borderRadius: '50%',
              background: 'rgba(255,255,255,0.5)',
            }}/>
          </div>
        </div>
        {/* labels */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 14,
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)',
          letterSpacing: '0.15em',
        }}>
          <span>← FLEW BY</span>
          <span>TRUE HOUR</span>
          <span>DRAGGED →</span>
        </div>
      </div>
    </CaptureShell>
  );
}

// ============================================================
// VARIANT B — Dial / Vinyl
// Rotate a circular dial. Twist CCW = fast, CW = slow.
// ============================================================
function CaptureDial({ onSubmit, onOpenHistory }) {
  const [stretch, setStretch] = useCapAlt(0);
  const [hasInteracted, setHasInteracted] = useCapAlt(false);
  const [dragging, setDragging] = useCapAlt(false);
  const dialRef = useRCapAlt(null);
  const lastAngle = useRCapAlt(0);
  const accumAngle = useRCapAlt(0);
  // Last quantized "tick" the dial crossed — used to fire one haptic pulse
  // per tick crossing, like the detents on an iPod clickwheel.
  const lastTick = useRCapAlt(0);
  const ro = readout(stretch);

  const getAngle = (e) => {
    const p = e.touches ? e.touches[0] : e;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(p.clientY - cy, p.clientX - cx) * 180 / Math.PI;
  };
  const down = (e) => {
    e.preventDefault();
    setDragging(true); setHasInteracted(true);
    lastAngle.current = getAngle(e);
  };
  const move = (e) => {
    if (!dragging) return;
    const a = getAngle(e);
    let delta = a - lastAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    accumAngle.current += delta;
    lastAngle.current = a;

    // Haptic click per detent. 12° = 30 ticks per full rotation, which
    // matches the feel of a classic clickwheel (iPod Mini had ~24). Keep
    // the pulse short so a fast spin becomes a rapid flurry of clicks
    // without turning into a continuous buzz.
    const TICK_DEG = 12;
    const t = Math.round(accumAngle.current / TICK_DEG);
    if (t !== lastTick.current) {
      lastTick.current = t;
      if (navigator.vibrate) {
        try { navigator.vibrate(6); } catch (err) {}
      }
    }

    // 360° = full stretch
    const s = Math.max(-1, Math.min(1, accumAngle.current / 360));
    setStretch(s);
  };
  const up = () => setDragging(false);
  useECapAlt(() => {
    if (!dragging) return;
    const mv = (e) => move(e);
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', mv, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', mv);
      window.removeEventListener('touchend', up);
    };
  }, [dragging]);

  const rotation = accumAngle.current;

  return (
    <CaptureShell {...ro} stretch={stretch} onSubmit={onSubmit} onOpenHistory={onOpenHistory}
      hint="twist the dial" hasInteracted={hasInteracted}>
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 280, height: 280,
      }}>
        {/* outer ring ticks */}
        <svg viewBox="0 0 280 280" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <circle cx="140" cy="140" r="130" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
          {[...Array(60)].map((_, i) => {
            const a = (i/60) * Math.PI * 2 - Math.PI/2;
            const r1 = 130, r2 = i % 5 === 0 ? 118 : 124;
            return <line key={i}
              x1={140 + Math.cos(a)*r1} y1={140 + Math.sin(a)*r1}
              x2={140 + Math.cos(a)*r2} y2={140 + Math.sin(a)*r2}
              stroke="rgba(255,255,255,0.2)" strokeWidth={i % 5 === 0 ? 1.5 : 0.5}/>;
          })}
          {[0, 15, 30, 45].map((m) => {
            const a = (m/60) * Math.PI * 2 - Math.PI/2;
            return <text key={m}
              x={140 + Math.cos(a)*105} y={140 + Math.sin(a)*105 + 4}
              textAnchor="middle" fill="rgba(255,255,255,0.35)"
              fontFamily="JetBrains Mono" fontSize="10" letterSpacing="0.1em">
              {m === 0 ? '60' : m}
            </text>;
          })}
        </svg>
        {/* dial (rotatable) */}
        <div
          ref={dialRef}
          onMouseDown={down} onTouchStart={down}
          style={{
            position: 'absolute', inset: 24,
            borderRadius: '50%',
            background: `
              radial-gradient(circle at 35% 30%, oklch(0.35 0.1 ${ro.hue}) 0%, oklch(0.12 0.06 ${ro.hue}) 70%),
              #080010`,
            boxShadow: `0 20px 50px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.1), 0 0 50px oklch(0.5 0.2 ${ro.hue} / 0.3)`,
            cursor: dragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            transform: `rotate(${rotation}deg)`,
            transition: dragging ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
          {/* grooves */}
          {[0.6, 0.72, 0.84].map((r, i) => (
            <div key={i} style={{
              position: 'absolute', left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${r*100}%`, height: `${r*100}%`,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.05)',
            }}/>
          ))}
          {/* grip dot */}
          <div style={{
            position: 'absolute', left: '50%', top: '8%',
            transform: 'translateX(-50%)',
            width: 12, height: 12, borderRadius: '50%',
            background: `oklch(0.9 0.2 ${ro.hue})`,
            boxShadow: `0 0 16px oklch(0.7 0.3 ${ro.hue})`,
          }}/>
          {/* center hub */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 40, height: 40, borderRadius: '50%',
            background: '#000', border: '1px solid rgba(255,255,255,0.1)',
          }}/>
        </div>
        {/* pointer */}
        <div style={{
          position: 'absolute', left: '50%', top: 0,
          transform: 'translate(-50%, -4px)',
          width: 0, height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: `14px solid oklch(0.85 0.25 ${ro.hue})`,
          filter: `drop-shadow(0 0 8px oklch(0.7 0.3 ${ro.hue}))`,
        }}/>
      </div>

      {/* hints */}
      <div style={{
        position: 'absolute', top: 310, left: 28,
        fontFamily: 'var(--mono)', fontSize: 10,
        color: 'var(--ink-faint)', letterSpacing: '0.15em',
      }}>↶ FLEW</div>
      <div style={{
        position: 'absolute', top: 310, right: 28,
        fontFamily: 'var(--mono)', fontSize: 10,
        color: 'var(--ink-faint)', letterSpacing: '0.15em',
      }}>DRAGGED ↷</div>
    </CaptureShell>
  );
}

// ============================================================
// VARIANT C — Squeeze / Pressure
// Hold & press the 60-min card. Long press = dragged. Quick release = flew.
// ============================================================
function CaptureSqueeze({ onSubmit, onOpenHistory }) {
  const [stretch, setStretch] = useCapAlt(0);
  const [pressing, setPressing] = useCapAlt(false);
  const [hasInteracted, setHasInteracted] = useCapAlt(false);
  const pressTime = useRCapAlt(0);
  const rafRef = useRCapAlt(null);
  const ro = readout(stretch);

  const tick = () => {
    if (pressing) {
      // longer = more "dragged"
      pressTime.current += 0.016;
      const s = Math.min(1, pressTime.current / 2); // 2s of press = full drag
      setStretch(s);
    }
    rafRef.current = requestAnimationFrame(tick);
  };
  useECapAlt(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pressing]);

  const down = (e) => {
    e.preventDefault();
    setHasInteracted(true);
    pressTime.current = 0;
    // Snap: start at -1 (flew), grow toward +1 (dragged) while held
    setStretch(-1);
    setPressing(true);
  };
  const up = () => { setPressing(false); };

  useECapAlt(() => {
    if (!pressing) return;
    const u = () => up();
    window.addEventListener('mouseup', u);
    window.addEventListener('touchend', u);
    return () => {
      window.removeEventListener('mouseup', u);
      window.removeEventListener('touchend', u);
    };
  }, [pressing]);

  // card visual
  const scale = pressing ? 0.9 : 1;
  const wobble = pressing ? (1 + Math.sin(Date.now() / 100) * 0.02) : 1;

  return (
    <CaptureShell {...ro} stretch={stretch} onSubmit={onSubmit} onOpenHistory={onOpenHistory}
      hint="press & hold · long press = dragged" hasInteracted={hasInteracted}>
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      }}>
        <div
          onMouseDown={down} onTouchStart={down}
          style={{
            width: 220, height: 220, borderRadius: 40,
            background: `
              radial-gradient(circle at 30% 25%, rgba(255,255,255,0.1) 0%, transparent 50%),
              linear-gradient(145deg, oklch(0.25 0.2 ${ro.hue}), oklch(0.12 0.12 ${ro.hue}))`,
            boxShadow: `
              inset 0 2px 0 rgba(255,255,255,0.15),
              inset 0 -30px 60px oklch(0.08 0.1 ${ro.hue}),
              0 30px 60px rgba(0,0,0,0.5),
              0 0 ${pressing ? 80 : 40}px oklch(0.6 0.3 ${ro.hue} / 0.4)`,
            transform: `scale(${scale * wobble})`,
            transition: pressing ? 'transform 0.3s ease' : 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            cursor: 'pointer', touchAction: 'none',
            display: 'grid', placeItems: 'center',
            border: `1px solid oklch(0.5 0.2 ${ro.hue} / 0.4)`,
          }}>
          <div style={{ textAlign: 'center' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>THE LAST</div>
            <div style={{
              fontFamily: 'var(--serif)', fontStyle: 'italic',
              fontSize: 72, lineHeight: 1, color: '#fff',
              letterSpacing: '-0.04em',
            }}>60</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11,
              color: 'rgba(255,255,255,0.6)', letterSpacing: '0.2em',
              marginTop: 4,
            }}>MINUTES</div>
          </div>
          {/* pressure ring */}
          {pressing && (
            <div style={{
              position: 'absolute', inset: -6,
              borderRadius: 46,
              border: `2px solid oklch(0.8 0.3 ${ro.hue})`,
              opacity: 0.3 + Math.abs(stretch) * 0.7,
              pointerEvents: 'none',
            }}/>
          )}
        </div>
        {/* pressure meter */}
        <div style={{
          width: 220, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${((stretch + 1) / 2) * 100}%`,
            background: `linear-gradient(90deg, #4fe9ff, oklch(0.7 0.3 ${ro.hue}))`,
            boxShadow: `0 0 8px oklch(0.7 0.3 ${ro.hue})`,
            transition: pressing ? 'none' : 'width 0.5s',
          }}/>
        </div>
      </div>
    </CaptureShell>
  );
}

// ============================================================
// VARIANT D — Draw the Hour
// Drag a curved line across 60 dots. Arc high = dragged, arc low = flew.
// ============================================================
function CaptureDraw({ onSubmit, onOpenHistory }) {
  const [points, setPoints] = useCapAlt([]); // array of {t, y} in 0..1
  const [drawing, setDrawing] = useCapAlt(false);
  const [hasInteracted, setHasInteracted] = useCapAlt(false);
  const canvasRef = useRCapAlt(null);

  // Derive stretch from avg y: low y (top) = dragged, high y (bottom) = flew
  // Invert for our convention: y 0 = top = dragged, y 1 = bottom = flew
  const avgY = points.length ? points.reduce((a, p) => a + p.y, 0) / points.length : 0.5;
  const stretch = (0.5 - avgY) * 2; // -1..1 (top=+1 dragged, bottom=-1 flew)
  const ro = readout(stretch);

  const addPoint = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    const t = (p.clientX - rect.left) / rect.width;
    const y = (p.clientY - rect.top) / rect.height;
    if (t < 0 || t > 1) return;
    setPoints(prev => {
      const next = [...prev.filter(pp => Math.abs(pp.t - t) > 0.015), { t, y: Math.max(0, Math.min(1, y)) }];
      next.sort((a, b) => a.t - b.t);
      return next;
    });
  };

  const down = (e) => {
    e.preventDefault();
    setDrawing(true); setHasInteracted(true);
    setPoints([]);
    addPoint(e);
  };
  const move = (e) => { if (drawing) addPoint(e); };
  const up = () => setDrawing(false);
  useECapAlt(() => {
    if (!drawing) return;
    const mv = (e) => move(e);
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', mv, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', mv);
      window.removeEventListener('touchend', up);
    };
  }, [drawing]);

  // Build path
  const W = 340, H = 200;
  const path = points.length
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.t * W} ${p.y * H}`).join(' ')
    : '';

  return (
    <CaptureShell {...ro} stretch={stretch} onSubmit={onSubmit} onOpenHistory={onOpenHistory}
      hint="draw how the hour felt" hasInteracted={hasInteracted}>
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: W, height: H + 50,
      }}>
        {/* axis labels */}
        <div style={{
          position: 'absolute', left: -4, top: 0, bottom: 50,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-faint)',
          letterSpacing: '0.1em', transform: 'translateX(-100%)', paddingRight: 8,
          textAlign: 'right',
        }}>
          <span>SLOW</span>
          <span>FAST</span>
        </div>
        <div
          ref={canvasRef}
          onMouseDown={down} onTouchStart={down}
          style={{
            position: 'relative', width: W, height: H,
            borderRadius: 20,
            background: `
              linear-gradient(to bottom, oklch(0.25 0.15 ${ro.hue} / 0.15), oklch(0.1 0.1 240 / 0.15)),
              rgba(255,255,255,0.02)`,
            border: '1px solid rgba(255,255,255,0.06)',
            cursor: 'crosshair', touchAction: 'none',
            overflow: 'hidden',
          }}>
          {/* dot grid */}
          <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
            {[...Array(13)].map((_, i) => (
              <g key={i}>
                {[...Array(7)].map((_, j) => (
                  <circle key={j}
                    cx={(i/12) * W} cy={(j/6) * H}
                    r="1" fill="rgba(255,255,255,0.15)"/>
                ))}
              </g>
            ))}
            {/* center line */}
            <line x1="0" y1={H/2} x2={W} y2={H/2}
              stroke="rgba(255,255,255,0.1)" strokeDasharray="2 4" strokeWidth="0.5"/>
            {/* drawn path */}
            {path && (
              <>
                <path d={`${path} L ${W} ${H} L 0 ${H} Z`}
                  fill={`oklch(0.65 0.3 ${ro.hue} / 0.15)`}/>
                <path d={path} stroke={`oklch(0.85 0.25 ${ro.hue})`}
                  strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 6px oklch(0.7 0.3 ${ro.hue}))` }}/>
              </>
            )}
          </svg>
        </div>
        {/* x axis */}
        <div style={{
          width: W, display: 'flex', justifyContent: 'space-between',
          marginTop: 8, fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--ink-faint)', letterSpacing: '0.1em',
        }}>
          {[0, 15, 30, 45, 60].map(m => (
            <span key={m}>{m}m</span>
          ))}
        </div>
        {/* reset */}
        {points.length > 0 && (
          <button onClick={() => { setPoints([]); setHasInteracted(false); }} style={{
            position: 'absolute', top: -28, right: 0,
            background: 'transparent', border: 0,
            color: 'var(--ink-faint)', fontFamily: 'var(--mono)',
            fontSize: 10, letterSpacing: '0.15em',
            cursor: 'pointer',
          }}>CLEAR ↺</button>
        )}
      </div>
    </CaptureShell>
  );
}

// ============================================================
// VARIANT E — Two Thumbs (pinch-stretch)
// Two handles you can pinch together or spread apart.
// ============================================================
function CapturePinch({ onSubmit, onOpenHistory }) {
  const [spread, setSpread] = useCapAlt(0.5); // 0..1, 0.5 = neutral
  const [drag, setDrag] = useCapAlt(null); // 'left' | 'right' | null
  const [hasInteracted, setHasInteracted] = useCapAlt(false);
  const trackRef = useRCapAlt(null);
  const stretch = (spread - 0.5) * 2;
  const ro = readout(stretch);

  const down = (side) => (e) => {
    e.preventDefault(); setDrag(side); setHasInteracted(true);
  };
  const move = (e) => {
    if (!drag || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    const x = (p.clientX - rect.left) / rect.width;
    // moving left handle further left, OR right handle further right, = spread (dragged)
    // bring handles together = compressed (flew)
    if (drag === 'left') {
      // x range: 0..0.5
      const leftPos = Math.max(0, Math.min(0.5, x));
      // left: 0 = full spread, 0.5 = neutral
      setSpread(1 - leftPos * 2 * 0.5 - 0.5 + leftPos); // hmm, just use symmetry
      // Simpler: symmetric. compute distance from center.
      const dist = 0.5 - leftPos; // 0..0.5
      setSpread(0.5 + dist); // further out handles -> higher spread (dragged)
    } else {
      const rightPos = Math.max(0.5, Math.min(1, x));
      const dist = rightPos - 0.5;
      setSpread(0.5 + dist);
    }
    // Actually we want spread to be able to go BELOW 0.5 (flew) too.
    // Let left handle be in 0..0.5 => normalized 0..1. If it's past 0.5, that's impossible.
    // Let's allow crossing by using a different model: single drag = distance from midpoint.
    // If drag direction was OUT, increase; if IN (past neutral), go below 0.5.
  };
  // Simpler re-model: compute spread as total distance between handles (0..1).
  // We'll allow it to be 0 (fully compressed) to 1 (fully spread).
  // Both handles move symmetrically based on whichever is dragged.
  const move2 = (e) => {
    if (!drag || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    const x = Math.max(0, Math.min(1, (p.clientX - rect.left) / rect.width));
    // distance from center
    const dist = Math.abs(x - 0.5); // 0..0.5
    // For left handle: if x < 0.5, spread = 2*dist (0..1, out = high)
    //                  if x > 0.5, handle crossed over, so spread = -2*dist? We clamp.
    if (drag === 'left' && x < 0.5) setSpread(dist * 2);
    else if (drag === 'left' && x >= 0.5) setSpread(0); // fully pinched
    else if (drag === 'right' && x > 0.5) setSpread(dist * 2);
    else if (drag === 'right' && x <= 0.5) setSpread(0);
  };
  const up = () => setDrag(null);

  useECapAlt(() => {
    if (!drag) return;
    const mv = (e) => move2(e);
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', mv, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', mv);
      window.removeEventListener('touchend', up);
    };
  }, [drag]);

  // spread 0..1 -> stretch -1..1
  const stretch2 = (spread - 0.5) * 2;
  const ro2 = readout(stretch2);

  const leftX = 0.5 - spread / 2;
  const rightX = 0.5 + spread / 2;

  return (
    <CaptureShell {...ro2} stretch={stretch2} onSubmit={onSubmit} onOpenHistory={onOpenHistory}
      hint="pinch in or pull apart" hasInteracted={hasInteracted}>
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 320,
      }}>
        {/* instructional text */}
        <div style={{
          textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--ink-faint)', letterSpacing: '0.15em', marginBottom: 30,
        }}>
          THE HOUR · NOW
        </div>
        <div ref={trackRef} style={{
          position: 'relative', width: 320, height: 140,
          touchAction: 'none',
        }}>
          {/* reference 60min track */}
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '50%',
            transform: 'translateY(-50%)',
            height: 1, background: 'rgba(255,255,255,0.1)',
            borderLeft: '1px solid rgba(255,255,255,0.2)',
            borderRight: '1px solid rgba(255,255,255,0.2)',
          }}/>
          {/* stretched bar */}
          <div style={{
            position: 'absolute',
            left: `${leftX * 100}%`, right: `${(1 - rightX) * 100}%`,
            top: '50%', transform: 'translateY(-50%)',
            height: 8, borderRadius: 4,
            background: `linear-gradient(90deg,
              oklch(0.65 0.3 ${ro2.hue}),
              oklch(0.85 0.25 ${ro2.hue}),
              oklch(0.65 0.3 ${ro2.hue}))`,
            boxShadow: `0 0 20px oklch(0.7 0.3 ${ro2.hue})`,
            transition: drag ? 'none' : 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}/>
          {/* handles */}
          {['left', 'right'].map((side, i) => {
            const x = side === 'left' ? leftX : rightX;
            return (
              <div key={side}
                onMouseDown={down(side)} onTouchStart={down(side)}
                style={{
                  position: 'absolute',
                  left: `calc(${x * 100}% - 22px)`,
                  top: '50%', transform: 'translateY(-50%)',
                  width: 44, height: 44, borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 30%, oklch(0.95 0.15 ${ro2.hue}), oklch(0.5 0.3 ${ro2.hue}))`,
                  boxShadow: `0 0 20px oklch(0.7 0.3 ${ro2.hue}), inset 0 1px 0 rgba(255,255,255,0.4)`,
                  cursor: drag === side ? 'grabbing' : 'grab',
                  border: '1px solid rgba(255,255,255,0.2)',
                  transition: drag ? 'none' : 'left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  zIndex: 2,
                }}>
                <div style={{
                  position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                  color: '#fff', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                  textShadow: '0 0 4px rgba(0,0,0,0.6)',
                }}>{side === 'left' ? '◀' : '▶'}</div>
              </div>
            );
          })}
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 20,
          fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--ink-faint)', letterSpacing: '0.15em',
        }}>
          <span>← PINCH · FLEW</span>
          <span>STRETCH · DRAGGED →</span>
        </div>
      </div>
    </CaptureShell>
  );
}

Object.assign(window, {
  CaptureTimeline, CaptureDial, CaptureSqueeze, CaptureDraw, CapturePinch,
});
