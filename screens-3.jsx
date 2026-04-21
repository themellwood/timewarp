/* Time Warp — World (day aggregate) + History + Insights */

const { useState: useStateS3, useEffect: useEffectS3 } = React;

function formatCount(n) {
  if (!isFinite(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

// ---------- WORLD: day-level aggregate ----------
function WorldScreen({ onBack, onCompare, worldStyle = 'globe' }) {
  const [now, setNow] = useStateS3(0);
  useEffectS3(() => {
    let t = 0;
    const tick = () => { t += 0.003; setNow(t); requestAnimationFrame(tick); };
    const r = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(r);
  }, []);

  // Live aggregate — fetched from the public R2 snapshot. Until the first
  // response (or when offline), we render the bundled sample so the screen
  // is never blank.
  const [agg, setAgg] = useStateS3(null);
  useEffectS3(() => {
    let cancelled = false;
    (window.TWApi ? window.TWApi.fetchWorldAggregate() : Promise.resolve(null))
      .then((v) => { if (!cancelled && v) setAgg(v); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const SAMPLE_REGIONS = (window.TWApi && window.TWApi.SAMPLE_REGIONS) || [];
  const regions = (agg && agg.regions) || SAMPLE_REGIONS;

  // Aggregate the "24h felt like X hours" — prefer the server-computed
  // feltHours when present, otherwise re-derive from the regions we have.
  const avgS = regions.length
    ? regions.reduce((a, r) => a + r.s, 0) / regions.length
    : 0;
  const feltHours = (agg && typeof agg.feltHours === 'number')
    ? agg.feltHours
    : Math.round((24 + avgS * 20) * 10) / 10;
  const diffPct = Math.round(((feltHours / 24) - 1) * 100);
  const diffLabel = diffPct >= 0 ? `${diffPct}% longer` : `${-diffPct}% shorter`;
  const totalUsers = (agg && agg.totalUsers) || 2100000;

  // Hemisphere split (derived client-side as a fallback when the aggregate
  // doesn't include precomputed hemisphere stats).
  const north = regions.filter(r => r.lat >= 0);
  const south = regions.filter(r => r.lat < 0);
  const nAvg = north.length ? north.reduce((a, r) => a + r.s, 0) / north.length : 0;
  const sAvg = south.length ? south.reduce((a, r) => a + r.s, 0) / south.length : 0;
  const hemDiff = (agg && agg.hemisphere && typeof agg.hemisphere.diffPct === 'number')
    ? agg.hemisphere.diffPct
    : Math.round((nAvg - sAvg) * 20);
  const hemDir = hemDiff > 0 ? 'longer' : 'shorter';

  return (
    <div className="screen" style={{
      background: `radial-gradient(ellipse at 50% 0%, rgba(79, 233, 255, 0.14) 0%, transparent 55%), #000004`,
    }}>
      <div className="starfield" style={{ opacity: 0.9 }}/>

      <TopBar onBack={onBack} label={`${new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' }).toUpperCase()} · WORLDWIDE`}/>

      <div style={{
        position: 'absolute',
        top: 100, left: 0, right: 0, bottom: 40,
        overflowY: 'auto', padding: '0 0 40px',
      }} className="no-scrollbar">

        {/* Hero readout */}
        <div style={{ padding: '0 28px', textAlign: 'center' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>THE LAST DAY FELT LIKE</div>
          <div style={{
            fontFamily: 'var(--serif)', fontStyle: 'italic',
            fontSize: 96, lineHeight: 0.95,
            color: '#fff', letterSpacing: '-0.04em',
          }}>
            <span style={{ color: '#4fe9ff', filter: 'drop-shadow(0 0 20px rgba(79,233,255,0.6))' }}>{feltHours}</span>
            <span style={{ fontSize: 28, fontFamily: 'var(--mono)', fontStyle: 'normal', opacity: 0.6, marginLeft: 8 }}>hrs</span>
          </div>
          <div style={{
            fontFamily: 'var(--sans)', fontSize: 13,
            color: 'var(--ink-dim)', marginTop: 6,
          }}>
            {formatCount(totalUsers)} people · a day that was <span style={{ color: '#fff', fontStyle: 'italic', fontFamily: 'var(--serif)', fontSize: 15 }}>{diffLabel}</span> than 24
          </div>
        </div>

        {/* World visualization */}
        <div style={{
          position: 'relative',
          margin: '24px auto 0',
          width: 320, height: 320,
        }}>
          {worldStyle === 'particles' && <ParticleField regions={regions} t={now}/>}
          {worldStyle === 'grid' && <OrbGrid regions={regions} t={now}/>}
          {worldStyle !== 'particles' && worldStyle !== 'grid' && <Globe regions={regions} rotation={now * 30}/>}
        </div>

        {/* Patterns section */}
        <div style={{ padding: '12px 20px 0' }}>
          <div className="eyebrow" style={{ marginBottom: 12, paddingLeft: 8 }}>PATTERNS TODAY</div>

          <PatternCard
            kicker="GEOGRAPHY"
            title={<>Northern hemisphere had a <em style={{color:'#ff9500'}}>{Math.abs(hemDiff)}% {hemDir}</em> day than the south.</>}
            detail={`${north.length} regions vs ${south.length} regions · p < 0.001`}
            bar={[nAvg, sAvg]}
            labels={['N', 'S']}
          />

          <PatternCard
            kicker="AGE"
            title={<>People <em style={{color:'#ff3ea5'}}>over 50</em> reported a day <em>34% longer</em> than those under 25.</>}
            detail="consistent across 18 countries"
            bar={[0.42, -0.18]}
            labels={['50+', '<25']}
          />

          <PatternCard
            kicker="TIMEZONE"
            title={<>Night-shift workers felt the day <em style={{color:'#4fe9ff'}}>23% shorter</em>.</>}
            detail="vs. 9-5 baseline · n = 89K"
            bar={[-0.4, 0.05]}
            labels={['NIGHT', 'DAY']}
          />

          <PatternCard
            kicker="WEATHER"
            title={<>Rainy-weather cities ran <em style={{color:'#ff9500'}}>9% longer</em>.</>}
            detail="sunny regions: baseline"
            bar={[0.18, -0.02]}
            labels={['RAIN', 'SUN']}
          />

          <PatternCard
            kicker="INTEREST"
            title={<>People into <em style={{color:'#ff3ea5'}}>meditation</em> had the most accurate sense of a day.</>}
            detail="avg drift: ±2.1% from 24h"
            bar={[0.02, 0.35]}
            labels={['MEDITATE', 'OTHERS']}
          />
        </div>

        {/* Footer CTA */}
        <div style={{ padding: '16px 20px 0' }}>
          <button onClick={onCompare} style={{
            width: '100%', padding: '16px',
            borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(255,62,165,0.15), rgba(123,44,255,0.15))',
            border: '1px solid rgba(255,62,165,0.3)',
            color: '#fff', cursor: 'pointer',
            fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 16,
          }}>
            See how your day compared →
          </button>
        </div>
      </div>

    </div>
  );
}

function TopBar({ onBack, label }) {
  return (
    <div style={{
      position: 'absolute', top: 52, left: 0, right: 0,
      padding: '0 24px', display: 'flex',
      justifyContent: 'space-between', alignItems: 'center', zIndex: 5,
    }}>
      <button onClick={onBack} style={{
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
      <div className="eyebrow">{label}</div>
      <div style={{ width: 38 }}/>
    </div>
  );
}

function PatternCard({ kicker, title, detail, bar, labels }) {
  const max = Math.max(...bar.map(Math.abs), 0.5);
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 18,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      marginBottom: 8,
    }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{kicker}</div>
      <div style={{
        fontFamily: 'var(--serif)', fontSize: 20,
        lineHeight: 1.25, color: '#fff', letterSpacing: '-0.01em',
        marginBottom: 12,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {bar.map((v, i) => {
          const hue = stretchToHue(v);
          return (
            <div key={i} style={{ flex: 1 }}>
              <div style={{
                height: 8, borderRadius: 4,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden', position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', left: '50%', top: 0, bottom: 0,
                  width: `${Math.abs(v)/max * 50}%`,
                  transform: v < 0 ? 'translateX(-100%)' : 'none',
                  background: `oklch(0.7 0.28 ${hue})`,
                  boxShadow: `0 0 8px oklch(0.7 0.3 ${hue})`,
                }}/>
                <div style={{
                  position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1,
                  background: 'rgba(255,255,255,0.2)',
                }}/>
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.15em',
                color: 'var(--ink-faint)', marginTop: 6,
              }}>{labels[i]}</div>
            </div>
          );
        })}
      </div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10,
        color: 'var(--ink-faint)', marginTop: 10, letterSpacing: '0.08em',
      }}>{detail}</div>
    </div>
  );
}

// ---------- Particles (cosmic field of color blooms) ----------
function ParticleField({ regions, t }) {
  // Expand regions into a dense field — each region seeds ~60 particles nearby.
  const W = 320, H = 320;
  const particles = [];
  regions.forEach((reg, ri) => {
    for (let i = 0; i < 60; i++) {
      // Deterministic pseudo-random from (ri, i)
      const seed1 = Math.sin(ri * 12.9 + i * 78.2) * 43758.5;
      const seed2 = Math.sin(ri * 93.7 + i * 17.1) * 43758.5;
      const rx = (seed1 - Math.floor(seed1));
      const ry = (seed2 - Math.floor(seed2));
      const ang = rx * Math.PI * 2;
      const rad = Math.pow(ry, 0.5) * 150;
      // slow drift
      const drift = Math.sin(t * 2 + ri + i * 0.3) * 6;
      // anchor point for this region (place around a spiral)
      const rAng = (ri / regions.length) * Math.PI * 2;
      const rRad = 90 + (ri % 3) * 18;
      const ax = W / 2 + Math.cos(rAng) * rRad * 0.4;
      const ay = H / 2 + Math.sin(rAng) * rRad * 0.4;
      particles.push({
        x: ax + Math.cos(ang) * rad * 0.35 + drift,
        y: ay + Math.sin(ang) * rad * 0.35 + drift * 0.7,
        s: reg.s,
        size: 1.2 + ry * 3,
        alpha: 0.15 + (1 - ry) * 0.55,
      });
    }
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <radialGradient id="pf-bg">
          <stop offset="0%" stopColor="#120022" stopOpacity="0.9"/>
          <stop offset="60%" stopColor="#080014" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#000" stopOpacity="0"/>
        </radialGradient>
        <filter id="pf-bloom"><feGaussianBlur stdDeviation="3"/></filter>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="url(#pf-bg)"/>
      {/* faint rings */}
      {[60, 110, 150].map(r => (
        <circle key={r} cx={W/2} cy={H/2} r={r}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"/>
      ))}
      {/* Region nucleus — bright dot with label shadow */}
      {regions.map((reg, i) => {
        const rAng = (i / regions.length) * Math.PI * 2;
        const rRad = 90 + (i % 3) * 18;
        const x = W/2 + Math.cos(rAng) * rRad * 0.4;
        const y = H/2 + Math.sin(rAng) * rRad * 0.4;
        const hue = stretchToHue(reg.s);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={18 + Math.abs(reg.s) * 16}
              fill={`oklch(0.7 0.3 ${hue})`} opacity="0.15" filter="url(#pf-bloom)"/>
            <circle cx={x} cy={y} r={3.5}
              fill={`oklch(0.95 0.22 ${hue})`}/>
          </g>
        );
      })}
      {/* Scattered particles */}
      {particles.map((p, i) => {
        const hue = stretchToHue(p.s);
        return (
          <circle key={i} cx={p.x} cy={p.y} r={p.size}
            fill={`oklch(0.8 0.28 ${hue})`} opacity={p.alpha}/>
        );
      })}
    </svg>
  );
}

// ---------- Grid (every person is a tiny orb) ----------
function OrbGrid({ regions, t }) {
  const COLS = 14, ROWS = 14;
  const cells = [];
  // Distribute regions weighted into the grid, producing ~196 samples.
  // Each cell gets a stretch value sampled from nearby region + noise.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ux = c / (COLS - 1);
      const uy = r / (ROWS - 1);
      // pick closest region in a normalized lat/lng space for believable clumping
      let best = 0, bestD = Infinity;
      regions.forEach((reg, i) => {
        const rx = (reg.lng + 180) / 360;
        const ry = (90 - reg.lat) / 180;
        const d = (rx - ux) * (rx - ux) + (ry - uy) * (ry - uy);
        if (d < bestD) { bestD = d; best = i; }
      });
      const noise = Math.sin(r * 3.7 + c * 1.9 + t * 0.5) * 0.15;
      const jitter = Math.sin(r * 17.1 + c * 5.3) * 0.25;
      const s = Math.max(-1, Math.min(1, regions[best].s + noise + jitter * 0.6));
      cells.push({ r, c, s });
    }
  }
  const W = 320, H = 320;
  const pad = 14;
  const cellW = (W - pad * 2) / COLS;
  const cellH = (H - pad * 2) / ROWS;
  const radius = Math.min(cellW, cellH) * 0.38;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <filter id="gr-bloom"><feGaussianBlur stdDeviation="1.2"/></filter>
      </defs>
      {cells.map((cell, i) => {
        const cx = pad + cell.c * cellW + cellW / 2;
        const cy = pad + cell.r * cellH + cellH / 2;
        const hue = stretchToHue(cell.s);
        const intensity = Math.abs(cell.s);
        // pulse phase per cell
        const phase = Math.sin(t * 2 + cell.r * 0.4 + cell.c * 0.3) * 0.5 + 0.5;
        const rx = radius * (1 - cell.s * 0.35) * (0.9 + phase * 0.1);
        const ry = radius * (1 + cell.s * 0.55) * (0.9 + phase * 0.1);
        return (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx={rx * 1.6} ry={ry * 1.6}
              fill={`oklch(0.65 0.28 ${hue})`}
              opacity={0.08 + intensity * 0.15}
              filter="url(#gr-bloom)"/>
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
              fill={`oklch(${0.55 + intensity * 0.2} 0.28 ${hue})`}
              opacity={0.45 + intensity * 0.35}/>
            {/* highlight */}
            <ellipse cx={cx - rx * 0.3} cy={cy - ry * 0.35}
              rx={rx * 0.35} ry={ry * 0.25}
              fill="#fff" opacity={0.25}/>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Globe ----------
function Globe({ regions, rotation = 0 }) {
  const cx = 160, cy = 160, r = 140;
  const toXYZ = (lat, lng) => {
    const rLat = (lat * Math.PI) / 180;
    const rLng = ((lng + rotation) * Math.PI) / 180;
    return {
      x: r * Math.cos(rLat) * Math.sin(rLng),
      y: -r * Math.sin(rLat),
      z: r * Math.cos(rLat) * Math.cos(rLng),
    };
  };

  return (
    <svg viewBox="0 0 320 320" style={{ width: '100%', height: '100%' }}>
      <defs>
        <radialGradient id="globe-g" cx="0.35" cy="0.3">
          <stop offset="0%" stopColor="#1a1030"/>
          <stop offset="70%" stopColor="#08000f"/>
          <stop offset="100%" stopColor="#000"/>
        </radialGradient>
        <radialGradient id="globe-glow">
          <stop offset="0%" stopColor="#7b2cff" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="#7b2cff" stopOpacity="0"/>
        </radialGradient>
        <filter id="bloom"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      <circle cx={cx} cy={cy} r={r + 28} fill="url(#globe-glow)"/>
      <circle cx={cx} cy={cy} r={r} fill="url(#globe-g)"/>
      {[-60, -30, 0, 30, 60].map(lat => {
        const rl = (lat * Math.PI) / 180;
        const ry = Math.abs(r * Math.cos(rl));
        const cy2 = cy + Math.sin(-rl) * r;
        return (
          <ellipse key={lat} cx={cx} cy={cy2} rx={ry} ry={ry * 0.1}
            fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
        );
      })}
      {[0, 30, 60, 90, 120, 150].map(lng => {
        const shift = ((lng + rotation) % 180);
        return (
          <ellipse key={lng} cx={cx} cy={cy}
            rx={Math.abs(Math.cos((shift * Math.PI) / 180) * r)} ry={r}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/>
        );
      })}
      {regions.map((reg, i) => {
        const p = toXYZ(reg.lat, reg.lng);
        if (p.z < 0) return null;
        const hue = stretchToHue(reg.s);
        const intensity = Math.abs(reg.s);
        const size = 8 + intensity * 18;
        return (
          <g key={i} opacity={0.4 + p.z / r * 0.6}>
            <circle cx={cx + p.x} cy={cy + p.y} r={size * 2}
              fill={`oklch(0.7 0.3 ${hue})`} opacity="0.25" filter="url(#bloom)"/>
            <circle cx={cx + p.x} cy={cy + p.y} r={size}
              fill={`oklch(0.75 0.28 ${hue})`} opacity="0.6" filter="url(#bloom)"/>
            <circle cx={cx + p.x} cy={cy + p.y} r={2.5}
              fill={`oklch(0.95 0.2 ${hue})`}/>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={r}
        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5"/>
    </svg>
  );
}

// ---------- HISTORY ----------
function HistoryScreen({ onBack }) {
  const days = [
    { day: 'MON', hours: gen(14, 0.3) },
    { day: 'TUE', hours: gen(13, -0.2) },
    { day: 'WED', hours: gen(15, 0.5) },
    { day: 'THU', hours: gen(12, -0.1) },
    { day: 'FRI', hours: gen(16, -0.6) },
    { day: 'SAT', hours: gen(11, -0.4) },
    { day: 'SUN', hours: gen(13, 0.1) },
  ];

  return (
    <div className="screen" style={{
      background: `radial-gradient(ellipse at 100% 0%, rgba(255, 62, 165, 0.1) 0%, transparent 50%), #050008`,
    }}>
      <div className="starfield" style={{ opacity: 0.3 }}/>
      <TopBar onBack={onBack} label="YOUR WEEK"/>

      <div style={{ position: 'absolute', top: 104, left: 28, right: 28 }}>
        <div className="serif" style={{
          fontSize: 40, lineHeight: 1.05, color: '#fff',
          letterSpacing: '-0.02em',
        }}>
          94 hours felt<br/>
          like <span style={{ color: '#ff3ea5' }}>87</span>.
        </div>
        <div style={{ color: 'var(--ink-dim)', fontSize: 13, marginTop: 10 }}>
          Your week ran <span style={{ color: '#4fe9ff' }}>7.4% fast</span>. Fridays especially.
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 270, left: 20, right: 20,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {days.map((d, i) => <DayRow key={i} {...d}/>)}
      </div>

      <div style={{
        position: 'absolute', bottom: 140, left: 28, right: 28,
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'var(--mono)', fontSize: 10,
        color: 'var(--ink-faint)', letterSpacing: '0.15em',
      }}>
        <span>FLEW</span>
        <div style={{
          flex: 1, height: 6, borderRadius: 3,
          background: 'linear-gradient(90deg, #4fe9ff, #ff3ea5, #ff9500)',
        }}/>
        <span>DRAGGED</span>
      </div>

      <div style={{ position: 'absolute', bottom: 58, left: 20, right: 20 }}>
        <button style={{
          width: '100%', padding: '16px 20px', borderRadius: 18,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#fff', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          textAlign: 'left',
        }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 2 }}>INSIGHT</div>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 16 }}>
              See who felt time like you →
            </div>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff3ea5, #7b2cff)',
          }}/>
        </button>
      </div>
    </div>
  );
}

function gen(seed, bias) {
  const out = [];
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    const rhythm = Math.sin(t * Math.PI * 2) * 0.3;
    const noise = Math.sin(seed * 7 + i * 2.1) * 0.4;
    out.push(Math.max(-1, Math.min(1, rhythm + noise + bias)));
  }
  return out;
}

function DayRow({ day, hours }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 32, fontFamily: 'var(--mono)',
        fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-faint)',
      }}>{day}</div>
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: 'repeat(24, 1fr)', gap: 2, height: 28,
      }}>
        {hours.map((s, i) => {
          const hue = stretchToHue(s);
          const filled = i < 18;
          return (
            <div key={i} style={{
              height: 28, borderRadius: 2,
              background: filled
                ? `linear-gradient(to top, oklch(0.35 0.25 ${hue}) 0%, oklch(0.65 0.28 ${hue}) 100%)`
                : 'rgba(255,255,255,0.03)',
              border: filled ? 'none' : '1px dashed rgba(255,255,255,0.06)',
              opacity: filled ? 1 : 0.4,
              boxShadow: filled ? `0 0 8px oklch(0.55 0.3 ${hue} / 0.5)` : 'none',
            }}/>
          );
        })}
      </div>
    </div>
  );
}

// ---------- INSIGHTS ----------
function InsightsScreen({ onBack }) {
  const SAMPLE = (window.TWApi && window.TWApi.SAMPLE_COHORTS) || [];
  const [cohorts, setCohorts] = useStateS3(SAMPLE);
  useEffectS3(() => {
    let cancelled = false;
    (window.TWApi ? window.TWApi.fetchCohorts() : Promise.resolve(null))
      .then((v) => { if (!cancelled && v && v.cohorts) setCohorts(v.cohorts); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="screen" style={{
      background: `radial-gradient(ellipse at 50% 110%, rgba(123, 44, 255, 0.2) 0%, transparent 50%), #050008`,
    }}>
      <div className="starfield" style={{ opacity: 0.4 }}/>
      <TopBar onBack={onBack} label="WHO FELT IT LIKE YOU"/>

      <div style={{ position: 'absolute', top: 100, left: 28, right: 28 }}>
        <div className="serif" style={{
          fontSize: 32, lineHeight: 1.1, color: '#fff',
          letterSpacing: '-0.02em',
        }}>
          Your last hour<br/>
          <span style={{ color: '#4fe9ff' }}>rhymed with</span>
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 220, left: 20, right: 20, bottom: 60,
        overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8,
      }} className="no-scrollbar">
        {cohorts.sort((a, b) => b.match - a.match).map((c, i) => <CohortRow key={i} {...c}/>)}
      </div>
    </div>
  );
}

function CohortRow({ label, match, s, n }) {
  const hue = stretchToHue(s);
  const pct = Math.round(match * 100);
  const [lab] = stretchToLabel(s);
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 16,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.15em', color: '#fff' }}>
          {label}
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, color: `oklch(0.8 0.25 ${hue})` }}>
          {pct}%<span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontStyle: 'normal', opacity: 0.6, marginLeft: 3 }}>MATCH</span>
        </div>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          background: `linear-gradient(90deg, oklch(0.5 0.25 ${hue}), oklch(0.75 0.3 ${hue}))`,
          boxShadow: `0 0 8px oklch(0.7 0.3 ${hue})`,
        }}/>
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        color: 'var(--ink-faint)', fontSize: 11,
      }}>
        <span>felt it <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', color: 'var(--ink-dim)', fontSize: 13 }}>{lab.toLowerCase()}</span></span>
        <span className="mono">{n}</span>
      </div>
    </div>
  );
}

Object.assign(window, { WorldScreen, HistoryScreen, InsightsScreen });
