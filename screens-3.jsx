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
  // is never blank. The demo toggle swaps this out for a rich synthetic
  // aggregate (see TWApi.getDemoAggregate) so visitors can see what the
  // experience is like once thousands of people are logging.
  const [live, setLive] = useStateS3(null);
  const [demo, setDemo] = useStateS3(() => localStorage.getItem('tw_demo') === '1');
  useEffectS3(() => {
    let cancelled = false;
    (window.TWApi ? window.TWApi.fetchWorldAggregate() : Promise.resolve(null))
      .then((v) => { if (!cancelled && v) setLive(v); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffectS3(() => { localStorage.setItem('tw_demo', demo ? '1' : '0'); }, [demo]);
  const agg = demo && window.TWApi ? window.TWApi.getDemoAggregate() : live;

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

  // The user's own log for the current clock hour, if any — surfaced above
  // the world hero so "how does this compare?" is literal.
  const mine = (window.TWApi && window.TWApi.loggedThisHour && window.TWApi.loggedThisHour()) || null;
  const mineLabel = mine ? stretchToLabel(mine.stretch)[0] : null;
  const mineHue = mine ? stretchToHue(mine.stretch) : 0;

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

      <TopBar onBack={onBack} label={`${new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' }).toUpperCase()} · WORLDWIDE`}
        right={<DemoToggle on={demo} onChange={setDemo}/>}/>

      <div style={{
        position: 'absolute',
        top: 100, left: 0, right: 0, bottom: 40,
        overflowY: 'auto', padding: '0 0 40px',
      }} className="no-scrollbar">

        {/* Your hour — only shown when the user has already logged this
            clock hour. Anchors the "see how this compares" prompt. */}
        {mine && (
          <div style={{ padding: '0 28px 18px', textAlign: 'center' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>YOUR LAST HOUR</div>
            <div style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 8,
              padding: '8px 18px', borderRadius: 999,
              background: `oklch(0.2 0.12 ${mineHue} / 0.35)`,
              border: `1px solid oklch(0.6 0.25 ${mineHue} / 0.35)`,
            }}>
              <span style={{
                fontFamily: 'var(--serif)', fontStyle: 'italic',
                fontSize: 28, color: `oklch(0.9 0.2 ${mineHue})`,
                letterSpacing: '-0.02em',
                filter: `drop-shadow(0 0 12px oklch(0.7 0.3 ${mineHue} / 0.5))`,
              }}>{mine.minutes}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.7, letterSpacing: '0.15em' }}>MIN</span>
              <span style={{ fontSize: 13, color: 'var(--ink-dim)', marginLeft: 4 }}>· {mineLabel.toLowerCase()}</span>
            </div>
          </div>
        )}

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

        {/* Patterns section — built from the server aggregate. The hourly
            cron writes patterns.age / .gender / .interests as {key, avg, n}.
            We surface the extremes (highest vs lowest avg within the bucket)
            so copy stays honest to whatever the data actually says today. */}
        <div style={{ padding: '12px 20px 0' }}>
          <div className="eyebrow" style={{ marginBottom: 12, paddingLeft: 8 }}>PATTERNS TODAY</div>

          <PatternCard
            kicker="GEOGRAPHY"
            title={
              Math.abs(hemDiff) < 3 ? (
                <>Hemispheres are <em style={{color:'#4fe9ff'}}>running in sync</em> today.</>
              ) : (
                <>Northern hemisphere had a <em style={{color:'#ff9500'}}>{Math.abs(hemDiff)}% {hemDir}</em> day than the south.</>
              )
            }
            detail={`${north.length} regions north · ${south.length} south`}
            bar={[nAvg, sAvg]}
            labels={['N', 'S']}
          />

          {(() => {
            const age = (agg && agg.patterns && agg.patterns.age) || [];
            if (age.length < 2) return null;
            const sorted = [...age].sort((a, b) => b.avg - a.avg);
            const hi = sorted[0], lo = sorted[sorted.length - 1];
            const pct = Math.round((hi.avg - lo.avg) * 20);
            const dir = pct >= 0 ? 'longer' : 'shorter';
            return (
              <PatternCard
                kicker="AGE"
                title={<>People <em style={{color:'#ff3ea5'}}>{hi.key}</em> reported a day <em>{Math.abs(pct)}% {dir}</em> than those {lo.key}.</>}
                detail={`${hi.n + lo.n} submissions · last 24h`}
                bar={[hi.avg, lo.avg]}
                labels={[hi.key, lo.key]}
              />
            );
          })()}

          {(() => {
            const ints = (agg && agg.patterns && agg.patterns.interests) || [];
            if (ints.length < 1) return null;
            const sorted = [...ints].sort((a, b) => Math.abs(a.avg) - Math.abs(b.avg));
            const steady = sorted[0];
            const allAvg = ints.reduce((a, r) => a + r.avg, 0) / ints.length;
            const drift = Math.round(Math.abs(steady.avg - allAvg) * 100);
            return (
              <PatternCard
                kicker="INTEREST"
                title={<>People into <em style={{color:'#ff3ea5'}}>{steady.key}</em> tracked closest to real time.</>}
                detail={`n = ${steady.n} · drift ${drift}%`}
                bar={[steady.avg, allAvg]}
                labels={[steady.key.toUpperCase(), 'OTHERS']}
              />
            );
          })()}

          {(() => {
            const gen = (agg && agg.patterns && agg.patterns.gender) || [];
            if (gen.length < 2) return null;
            const sorted = [...gen].sort((a, b) => b.avg - a.avg);
            const hi = sorted[0], lo = sorted[sorted.length - 1];
            const pct = Math.round((hi.avg - lo.avg) * 20);
            if (Math.abs(pct) < 3) return null;
            const dir = pct >= 0 ? 'longer' : 'shorter';
            return (
              <PatternCard
                kicker="GENDER"
                title={<>People identifying as <em style={{color:'#4fe9ff'}}>{hi.key}</em> felt the day <em>{Math.abs(pct)}% {dir}</em>.</>}
                detail={`${hi.n} vs ${lo.n} submissions`}
                bar={[hi.avg, lo.avg]}
                labels={[hi.key.toUpperCase(), lo.key.toUpperCase()]}
              />
            );
          })()}

          {totalUsers < 10 && (
            <div style={{
              padding: '14px 16px', borderRadius: 16,
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(255,255,255,0.08)',
              color: 'var(--ink-dim)', fontSize: 13, textAlign: 'center',
              fontFamily: 'var(--serif)', fontStyle: 'italic',
            }}>
              The world is just waking up here — patterns appear once a few more hours are logged.
            </div>
          )}
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

function TopBar({ onBack, label, right }) {
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
      <div style={{ minWidth: 38, display: 'flex', justifyContent: 'flex-end' }}>
        {right || null}
      </div>
    </div>
  );
}

// Demo toggle used on the World screen — swaps the real (small-sample)
// aggregate for a synthetic preview of what the data looks like at scale.
function DemoToggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-label={on ? 'Disable demo data' : 'Enable demo data'}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', borderRadius: 999,
        background: on ? 'rgba(255, 62, 165, 0.18)' : 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${on ? 'rgba(255, 62, 165, 0.45)' : 'rgba(255,255,255,0.1)'}`,
        color: on ? '#ff9dd1' : 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        fontFamily: 'var(--mono)', fontSize: 10,
        letterSpacing: '0.15em',
      }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: on ? '#ff3ea5' : 'rgba(255,255,255,0.35)',
        boxShadow: on ? '0 0 8px #ff3ea5' : 'none',
      }}/>
      DEMO
    </button>
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
// Renders the user's actual submissions over the last 7 calendar days.
// Each submission covers a ~1 hour window; the DB stores stretch in [-1,1]
// plus a minutes value, so "felt hours" for the week is Σ(minutes)/60 and
// "actual hours" is the count of submissions (each one = 1 hour of reported
// experience). The grid shows one cell per submission in local time.
function HistoryScreen({ onBack, onCompare }) {
  const [data, setData] = useStateS3(null); // null = loading, [] = empty
  const [offline, setOffline] = useStateS3(false);

  useEffectS3(() => {
    let cancelled = false;
    if (!window.TWApi) { setData([]); return; }
    window.TWApi.fetchMyHistory({ days: 7 })
      .then((r) => { if (cancelled) return; setData(r.submissions || []); setOffline(!!r.offline); })
      .catch(() => { if (!cancelled) setData([]); });
    return () => { cancelled = true; };
  }, []);

  // Group submissions by local day-of-week (Mon..Sun) over the last 7 days.
  const byDay = Array.from({ length: 7 }, () => []);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);
  if (data && data.length) {
    for (const s of data) {
      const d = new Date(s.ts * 1000);
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const idx = Math.floor((dayStart - weekStart) / 86400000);
      if (idx >= 0 && idx < 7) byDay[idx].push(s);
    }
  }

  const totalFeltMin = (data || []).reduce((a, s) => a + (s.minutes || 60), 0);
  const actualHours = (data || []).length;
  const feltHours = Math.round(totalFeltMin / 60 * 10) / 10;
  const drift = actualHours > 0 ? Math.round(((feltHours / actualHours) - 1) * 1000) / 10 : 0;
  const driftLabel = actualHours === 0
    ? null
    : drift >= 0 ? `${Math.abs(drift)}% slow` : `${Math.abs(drift)}% fast`;
  const driftColor = drift >= 0 ? '#ff9500' : '#4fe9ff';

  // Find the day-of-week that ran longest (positive stretch avg) for copy.
  const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i);
    return dayNames[d.getDay()];
  });
  let slowestIdx = -1, slowestAvg = -Infinity;
  byDay.forEach((xs, i) => {
    if (!xs.length) return;
    const a = xs.reduce((t, r) => t + (r.stretch || 0), 0) / xs.length;
    if (a > slowestAvg) { slowestAvg = a; slowestIdx = i; }
  });
  const slowestDayCopy = slowestIdx >= 0 && slowestAvg > 0.1 ? `${dayLabels[slowestIdx]}s dragged.` : '';

  return (
    <div className="screen" style={{
      background: `radial-gradient(ellipse at 100% 0%, rgba(255, 62, 165, 0.1) 0%, transparent 50%), #050008`,
    }}>
      <div className="starfield" style={{ opacity: 0.3 }}/>
      <TopBar onBack={onBack} label="YOUR WEEK"/>

      <div style={{ position: 'absolute', top: 104, left: 28, right: 28 }}>
        {data === null ? (
          <div className="serif" style={{ fontSize: 32, color: 'rgba(255,255,255,0.4)' }}>loading…</div>
        ) : actualHours === 0 ? (
          <>
            <div className="serif" style={{
              fontSize: 36, lineHeight: 1.05, color: '#fff', letterSpacing: '-0.02em',
            }}>
              Nothing yet.<br/>
              <span style={{ color: '#ff3ea5' }}>Log an hour</span> to start your week.
            </div>
            <div style={{ color: 'var(--ink-dim)', fontSize: 13, marginTop: 10 }}>
              Your last seven days will appear here.
              {offline && ' · offline'}
            </div>
          </>
        ) : (
          <>
            <div className="serif" style={{
              fontSize: 40, lineHeight: 1.05, color: '#fff', letterSpacing: '-0.02em',
            }}>
              {actualHours} {actualHours === 1 ? 'hour' : 'hours'} felt<br/>
              like <span style={{ color: '#ff3ea5' }}>{feltHours}</span>.
            </div>
            <div style={{ color: 'var(--ink-dim)', fontSize: 13, marginTop: 10 }}>
              Your week ran <span style={{ color: driftColor }}>{driftLabel}</span>.
              {slowestDayCopy ? ' ' + slowestDayCopy : ''}
              {offline && ' · offline'}
            </div>
          </>
        )}
      </div>

      <div style={{
        position: 'absolute', top: 270, left: 20, right: 20,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {byDay.map((entries, i) => (
          <DayRow key={i} day={dayLabels[i]} entries={entries}/>
        ))}
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
        <button onClick={onCompare} style={{
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

function DayRow({ day, entries }) {
  // 24 hour slots per day; each submission's local hour lights one cell.
  const cells = Array.from({ length: 24 }, () => null);
  for (const s of entries) {
    const h = new Date(s.ts * 1000).getHours();
    // If multiple entries land in the same hour, keep the one with the
    // largest magnitude — rare (rate-limited to one per 50 min on the server).
    if (!cells[h] || Math.abs(s.stretch) > Math.abs(cells[h].stretch)) cells[h] = s;
  }
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
        {cells.map((s, i) => {
          if (!s) {
            return (
              <div key={i} style={{
                height: 28, borderRadius: 2,
                background: 'rgba(255,255,255,0.02)',
                border: '1px dashed rgba(255,255,255,0.05)',
                opacity: 0.5,
              }}/>
            );
          }
          const hue = stretchToHue(s.stretch);
          return (
            <div key={i} title={`${new Date(s.ts * 1000).toLocaleTimeString()} · ${s.label}`} style={{
              height: 28, borderRadius: 2,
              background: `linear-gradient(to top, oklch(0.35 0.25 ${hue}) 0%, oklch(0.65 0.28 ${hue}) 100%)`,
              boxShadow: `0 0 8px oklch(0.55 0.3 ${hue} / 0.5)`,
            }}/>
          );
        })}
      </div>
    </div>
  );
}

// ---------- INSIGHTS ----------
// Scores each server-supplied cohort against the user's recent stretch.
// 1. "Distance" match — how close the user's average stretch is to the
//    cohort's avg (|Δ| on [-1,1] → 1 for identical, 0 for opposite).
// 2. "Membership" boost — if the cohort's bucket matches the user's own
//    demographic (e.g. AGE · 25-34 for a 25-34-year-old), add 0.15.
// The combined match drives the sort order and the % shown per row.
function InsightsScreen({ onBack }) {
  const SAMPLE = (window.TWApi && window.TWApi.SAMPLE_COHORTS) || [];
  const [cohorts, setCohorts] = useStateS3(null); // null = loading
  const [myRecent, setMyRecent] = useStateS3(null);

  useEffectS3(() => {
    let cancelled = false;
    const cohortP = window.TWApi ? window.TWApi.fetchCohorts() : Promise.resolve(null);
    const meP = window.TWApi ? window.TWApi.fetchMyHistory({ days: 7 }) : Promise.resolve(null);
    Promise.all([cohortP, meP]).then(([c, m]) => {
      if (cancelled) return;
      setCohorts((c && c.cohorts) || SAMPLE);
      setMyRecent((m && m.submissions) || []);
    }).catch(() => {
      if (!cancelled) { setCohorts(SAMPLE); setMyRecent([]); }
    });
    return () => { cancelled = true; };
  }, []);

  const profile = (window.TWProfile && window.TWProfile.getProfile()) || {};
  const hemisphere = window.TWProfile ? window.TWProfile.getHemisphere() : 'N';

  // User's average stretch over their recent history — the anchor we score
  // every cohort against. If there's no history yet, use 0 (neutral) and
  // mark the screen with a soft "log your first hour" hint.
  const userAvg = myRecent && myRecent.length
    ? myRecent.reduce((a, r) => a + (r.stretch || 0), 0) / myRecent.length
    : null;

  const scored = (cohorts || []).map((c) => {
    const dist = userAvg == null ? 0.5 : 1 - Math.min(1, Math.abs((c.s || 0) - userAvg) / 2);
    let member = 0;
    const lbl = (c.label || '').toUpperCase();
    if (lbl.startsWith('AGE · ') && profile.ageBucket && lbl.endsWith(profile.ageBucket.toUpperCase())) member = 0.15;
    else if (lbl.startsWith('GENDER · ') && profile.gender && lbl.endsWith(profile.gender.toUpperCase())) member = 0.15;
    else if (lbl.startsWith('HEMISPHERE · ') && lbl.endsWith(hemisphere)) member = 0.15;
    else if (lbl.startsWith('INTEREST · ') && profile.interests && profile.interests.length) {
      for (const t of profile.interests) {
        if (lbl.endsWith(t.toUpperCase())) { member = 0.15; break; }
      }
    }
    return { ...c, match: Math.min(1, dist * 0.85 + member) };
  }).sort((a, b) => b.match - a.match);

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
          Your recent hours<br/>
          <span style={{ color: '#4fe9ff' }}>
            {userAvg == null ? 'are blank.' : 'rhymed with'}
          </span>
        </div>
        {userAvg == null && (
          <div style={{ color: 'var(--ink-dim)', fontSize: 13, marginTop: 8 }}>
            Log an hour and your cohorts will snap into rank.
          </div>
        )}
      </div>

      <div style={{
        position: 'absolute', top: 220, left: 20, right: 20, bottom: 60,
        overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8,
      }} className="no-scrollbar">
        {cohorts === null ? (
          <div style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.15em' }}>
            LOADING…
          </div>
        ) : scored.length === 0 ? (
          <div style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.15em' }}>
            NO COHORTS YET — BE AMONG THE FIRST.
          </div>
        ) : (
          scored.map((c, i) => <CohortRow key={i} {...c}/>)
        )}
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
