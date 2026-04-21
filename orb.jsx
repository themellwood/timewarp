/* Time Warp — jelly orb.
 * A real soft-body blob: SVG path with N vertices simulated as springs around a center.
 * Cursor pulls the nearest vertices; neighbors follow; all restore with damped spring physics.
 * Overall "stretch" is derived from the blob's bounding aspect ratio & distance from rest.
 */

const { useRef: oUseRef, useState: oUseState, useEffect: oUseEffect } = React;

// ------ labels ------
function stretchToLabel(s) {
  if (s <= -0.85) return ['Vanished', 'like a breath'];
  if (s <= -0.55) return ['Flew by', 'barely noticed'];
  if (s <= -0.2)  return ['Quick', 'a bit fast'];
  if (s <  0.2)   return ['As it was', 'sixty for sixty'];
  if (s <  0.55)  return ['Lingered', 'a little heavy'];
  if (s <  0.85)  return ['Dragged', 'thick & slow'];
  return ['Endless', 'forever in an hour'];
}
function stretchToMinutes(s) {
  const sign = Math.sign(s);
  const e = Math.pow(Math.abs(s), 0.85);
  return Math.max(1, Math.round(60 + sign * e * 55));
}
function stretchToHue(s) {
  if (s < 0) return 330 + s * 135;
  return 330 - s * 295 + 360;
}

function OrbDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id="goo-jelly">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b"/>
          <feColorMatrix in="b" type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" result="g"/>
          <feComposite in="SourceGraphic" in2="g" operator="atop"/>
        </filter>
      </defs>
    </svg>
  );
}

// Catmull–Rom to Bezier smooth closed path
function smoothPath(pts) {
  const n = pts.length;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d + ' Z';
}

function Orb({
  size = 280,
  stretch: extStretch,
  onStretchChange,
  interactive = true,
  material = 'plasma',
  showGlow = true,
}) {
  const hostRef = oUseRef(null);
  const [tick, setTick] = oUseState(0);
  const [hue, setHue] = oUseState(330);
  const [derivedS, setDerivedS] = oUseState(0);

  // Simulation state lives in refs (doesn't trigger rerender)
  const sim = oUseRef(null);
  // grabs: list of {i, offsetX, offsetY, weight} captured at press-down so the
  // pointer drags a cohesive "blob" of the surface, not just one vertex.
  const pointer = oUseRef({ active: false, x: 0, y: 0, grabs: [], wasActive: false });
  const timeRef = oUseRef(0);

  // Init vertex ring. Rest positions (rx,ry) stay fixed at the original circle
  // so we can always derive "how much has this been warped from a perfect sphere".
  // Anchors (ax,ay) move when the user releases the orb — that's how the shape is held.
  oUseEffect(() => {
    const N = 44;
    const R = size * 0.36;
    const cx = size / 2, cy = size / 2;
    const verts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const px = cx + Math.cos(a) * R;
      const py = cy + Math.sin(a) * R;
      verts.push({
        rx: px, ry: py,       // rest (original circle)
        ax: px, ay: py,       // current anchor (updates on release)
        x:  px, y:  py,       // live position
        vx: 0, vy: 0,
      });
    }
    sim.current = { verts, cx, cy, R };
  }, [size]);

  // Reset helper — springs everything back to the original circle.
  const reset = () => {
    const s = sim.current; if (!s) return;
    for (const v of s.verts) { v.ax = v.rx; v.ay = v.ry; v.vx = 0; v.vy = 0; }
  };
  oUseEffect(() => { window.__resetOrb = reset; return () => { if (window.__resetOrb === reset) delete window.__resetOrb; }; }, []);

  // Main rAF loop — physics + render tick
  oUseEffect(() => {
    let raf;
    const step = () => {
      timeRef.current += 0.016;
      const s = sim.current;
      if (s) {
        const { verts, cx, cy } = s;
        const N = verts.length;
        const DAMP = 0.82;      // velocity damping (slightly less than before for more bounce)
        const NEIGHBOR = 0.18;  // neighbor cohesion — keeps surface smooth under big deformations
        const BREATH = Math.sin(timeRef.current * 0.9) * 0.8;
        const dragging = pointer.current.active;

        // On release: bake the current deformed positions as new anchors so the
        // orb HOLDS the shape the user pulled (this is a time input, not a toy).
        if (pointer.current.wasActive && !dragging) {
          for (let i = 0; i < N; i++) {
            verts[i].ax = verts[i].x;
            verts[i].ay = verts[i].y;
          }
        }
        pointer.current.wasActive = dragging;

        // Pointer pull — putty stretch. Vertices in the grab cluster are glued
        // to (pointer + captured offset), so the surface translates rigidly
        // under the finger while neighbor cohesion smears the rest of the blob
        // toward it. This is what makes it feel like stretching taffy vs. a
        // rubber ball bouncing back.
        if (dragging) {
          const px = pointer.current.x, py = pointer.current.y;
          const grabs = pointer.current.grabs;
          for (let k = 0; k < grabs.length; k++) {
            const g = grabs[k];
            const v = verts[g.i];
            const tx = px + g.offsetX;
            const ty = py + g.offsetY;
            // Position-based pull: strong enough to overpower damping within 1–2 frames.
            const pull = 0.55 * g.weight;
            v.vx += (tx - v.x) * pull;
            v.vy += (ty - v.y) * pull;
          }
        }

        // Spring back to anchors — essentially OFF while dragging (plastic
        // deformation) and very soft when released so the baked shape is held.
        const STIFF = dragging ? 0.006 : 0.015;
        for (let i = 0; i < N; i++) {
          const v = verts[i];
          const ang = Math.atan2(v.ay - cy, v.ax - cx) || 0;
          const ar = Math.hypot(v.ax - cx, v.ay - cy);
          const tax = cx + Math.cos(ang) * (ar + BREATH);
          const tay = cy + Math.sin(ang) * (ar + BREATH);
          v.vx += (tax - v.x) * STIFF;
          v.vy += (tay - v.y) * STIFF;
        }
        // neighbor smoothing
        for (let i = 0; i < N; i++) {
          const a = verts[(i - 1 + N) % N];
          const b = verts[(i + 1) % N];
          const v = verts[i];
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          v.vx += (mx - v.x) * NEIGHBOR;
          v.vy += (my - v.y) * NEIGHBOR;
        }
        // integrate
        for (let i = 0; i < N; i++) {
          const v = verts[i];
          v.vx *= DAMP; v.vy *= DAMP;
          v.x += v.vx;  v.y += v.vy;
        }

        // Derive stretch signal. Two contributions:
        //   1) Area change vs original circle → compressed (area shrunk) = flew by
        //   2) Aspect distortion → tall = dragged, wide = flew
        // Use signed polygon area; compare against π R².
        let A = 0;
        let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
        for (let i = 0; i < N; i++) {
          const v = verts[i], w = verts[(i + 1) % N];
          A += v.x * w.y - w.x * v.y;
          if (v.x<minX) minX=v.x; if (v.x>maxX) maxX=v.x;
          if (v.y<minY) minY=v.y; if (v.y>maxY) maxY=v.y;
        }
        const area = Math.abs(A) / 2;
        const restArea = Math.PI * s.R * s.R;
        const areaRatio = area / restArea;                // 1 = same as rest
        const bw = maxX - minX, bh = maxY - minY;
        const aspect = bh / Math.max(bw, 0.001);          // 1 = round
        // Map: smaller area OR wider-than-tall → negative (flew).
        // Larger area OR taller-than-wide → positive (dragged).
        // Area contributes more strongly since pinching shrinks area.
        // Coefficients tuned so a moderate pull (~30–40% bbox change) already
        // registers as a clear "dragged" / "flew" response instead of needing
        // near-destructive deformation to move the needle.
        const areaSig = Math.max(-1, Math.min(1, (areaRatio - 1) * 2.2));
        const aspectSig = Math.max(-1, Math.min(1, (aspect - 1) * 1.9));
        const newStretch = Math.max(-1, Math.min(1, areaSig * 0.5 + aspectSig * 0.7));
        setDerivedS(newStretch);
        setHue(stretchToHue(newStretch));
        onStretchChange?.(newStretch);
      }
      setTick(t => t + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [onStretchChange]);

  // Pointer handlers — track position when held
  const updatePointer = (e, active) => {
    if (!hostRef.current) return;
    const rect = hostRef.current.getBoundingClientRect();
    const p = e.touches ? (e.touches[0] || e.changedTouches[0]) : e;
    if (!p) return;
    pointer.current.x = p.clientX - rect.left;
    pointer.current.y = p.clientY - rect.top;
    if (active !== undefined) pointer.current.active = active;
  };

  const onDown = (e) => {
    if (!interactive) return;
    e.preventDefault();
    updatePointer(e, true);

    // Capture which vertices get "grabbed" + their offsets from the pointer.
    // These stay constant for the whole drag, so the grabbed cluster follows
    // the finger as a rigid group and the rest of the surface stretches
    // toward it via neighbor cohesion.
    const s = sim.current; if (!s) return;
    const px = pointer.current.x, py = pointer.current.y;
    const GRAB_RADIUS = size * 0.32;
    const grabs = [];
    for (let i = 0; i < s.verts.length; i++) {
      const v = s.verts[i];
      const dx = v.x - px, dy = v.y - py;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < GRAB_RADIUS) {
        const w = Math.pow(1 - d / GRAB_RADIUS, 1.3);
        grabs.push({ i, offsetX: dx, offsetY: dy, weight: w });
      }
    }
    // If the press was outside the orb entirely, grab the 3 nearest vertices
    // so the user can still pull from the edge of the canvas.
    if (grabs.length === 0) {
      const ranked = s.verts
        .map((v, i) => ({ i, d: Math.hypot(v.x - px, v.y - py) }))
        .sort((a, b) => a.d - b.d);
      for (let k = 0; k < Math.min(3, ranked.length); k++) {
        const v = s.verts[ranked[k].i];
        grabs.push({ i: ranked[k].i, offsetX: v.x - px, offsetY: v.y - py, weight: 1 - k * 0.25 });
      }
    }
    pointer.current.grabs = grabs;
  };
  const onMoveGlobal = (e) => { if (pointer.current.active) updatePointer(e); };
  const onUpGlobal = () => { pointer.current.active = false; pointer.current.grabs = []; };

  oUseEffect(() => {
    window.addEventListener('mousemove', onMoveGlobal);
    window.addEventListener('mouseup', onUpGlobal);
    window.addEventListener('touchmove', onMoveGlobal, { passive: false });
    window.addEventListener('touchend', onUpGlobal);
    window.addEventListener('touchcancel', onUpGlobal);
    return () => {
      window.removeEventListener('mousemove', onMoveGlobal);
      window.removeEventListener('mouseup', onUpGlobal);
      window.removeEventListener('touchmove', onMoveGlobal);
      window.removeEventListener('touchend', onUpGlobal);
      window.removeEventListener('touchcancel', onUpGlobal);
    };
  }, []);

  // derive path
  const verts = sim.current?.verts || [];
  const path = verts.length ? smoothPath(verts) : '';

  // compute bounding metrics for gradient placement
  let minX=0, maxX=size, minY=0, maxY=size;
  if (verts.length) {
    minX=Infinity; maxX=-Infinity; minY=Infinity; maxY=-Infinity;
    for (const v of verts) {
      if (v.x<minX) minX=v.x; if (v.x>maxX) maxX=v.x;
      if (v.y<minY) minY=v.y; if (v.y>maxY) maxY=v.y;
    }
  }

  const s = derivedS;

  // Material palette
  const palettes = {
    plasma: [`oklch(0.78 0.28 ${hue})`, `oklch(0.55 0.30 ${hue + 25})`, `oklch(0.18 0.14 ${hue + 40})`],
    chrome: [`oklch(0.95 0.03 ${hue})`, `oklch(0.62 0.06 ${hue + 20})`, `oklch(0.12 0.02 ${hue})`],
    glass:  [`oklch(0.88 0.14 ${hue})`, `oklch(0.5 0.18 ${hue + 30})`, `oklch(0.12 0.08 ${hue + 40})`],
    liquid: [`oklch(0.82 0.22 ${hue})`, `oklch(0.48 0.28 ${hue + 40})`, `oklch(0.1 0.12 ${hue + 50})`],
  };
  const [c1, c2, c3] = palettes[material] || palettes.plasma;
  const gradId = `og-${material}-${Math.round(hue)}`;
  const gloId = `glo-${material}-${Math.round(hue)}`;

  return (
    <div
      ref={hostRef}
      onMouseDown={onDown}
      onTouchStart={onDown}
      style={{
        width: size, height: size, position: 'relative',
        cursor: interactive ? (pointer.current.active ? 'grabbing' : 'grab') : 'default',
        userSelect: 'none', touchAction: 'none',
      }}>
      {/* outer glow */}
      {showGlow && (
        <div style={{
          position: 'absolute', inset: -size*0.4,
          background: `radial-gradient(circle, ${c1}44 0%, ${c2}22 35%, transparent 70%)`,
          filter: 'blur(22px)', pointerEvents: 'none',
          transform: `scale(${1 + Math.abs(s)*0.3})`,
          transition: 'transform 0.4s',
        }}/>
      )}

      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <radialGradient id={gradId} cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9"/>
            <stop offset="8%" stopColor={c1} stopOpacity="0.95"/>
            <stop offset="45%" stopColor={c2}/>
            <stop offset="85%" stopColor={c3}/>
            <stop offset="100%" stopColor="#000"/>
          </radialGradient>
          <radialGradient id={gloId} cx="25%" cy="22%" r="30%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.95"/>
            <stop offset="60%" stopColor="#fff" stopOpacity="0.15"/>
            <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id={`${gradId}-shade`} cx="70%" cy="85%" r="55%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.55"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0"/>
          </radialGradient>
          <filter id={`drop-${gradId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2"/>
          </filter>
        </defs>

        {/* soft outer halo */}
        <path d={path}
          fill={c1} opacity="0.3"
          transform={`translate(${(minX+maxX)/2} ${(minY+maxY)/2}) scale(1.15) translate(${-(minX+maxX)/2} ${-(minY+maxY)/2})`}
          style={{ filter: 'blur(14px)' }}/>

        {/* main body */}
        <path d={path} fill={`url(#${gradId})`}/>
        {/* rim dark */}
        <path d={path} fill={`url(#${gradId}-shade)`} style={{ mixBlendMode: 'multiply' }}/>
        {/* specular highlight — itself a blob stretched near the bright side */}
        <path d={path} fill={`url(#${gloId})`} style={{ mixBlendMode: 'screen' }}/>

        {/* inner swirl conic fake via multiple translucent ellipses */}
        <g style={{ mixBlendMode: 'screen', opacity: 0.35 }}>
          <ellipse cx={(minX+maxX)/2} cy={(minY+maxY)/2}
            rx={(maxX-minX)/2 * 0.7} ry={(maxY-minY)/2 * 0.4}
            fill={c1} opacity="0.4"
            transform={`rotate(${timeRef.current*12} ${(minX+maxX)/2} ${(minY+maxY)/2})`}
            style={{ filter: 'blur(8px)' }}/>
          <ellipse cx={(minX+maxX)/2} cy={(minY+maxY)/2}
            rx={(maxX-minX)/2 * 0.3} ry={(maxY-minY)/2 * 0.65}
            fill={c2} opacity="0.5"
            transform={`rotate(${-timeRef.current*8} ${(minX+maxX)/2} ${(minY+maxY)/2})`}
            style={{ filter: 'blur(6px)' }}/>
        </g>

        {/* pointer trail — tiny dots near pointer when dragging */}
        {interactive && pointer.current.active && (
          <circle cx={pointer.current.x} cy={pointer.current.y}
            r="4" fill="#fff" opacity="0.6"
            style={{ filter: 'blur(1px)', pointerEvents: 'none' }}/>
        )}
      </svg>

      {/* satellite particles */}
      {[...Array(10)].map((_, i) => {
        const t = timeRef.current;
        const angle = (i/10)*Math.PI*2 + t*0.15;
        const r = size*(0.55 + Math.sin(t*0.7 + i)*0.06) * (1 + Math.abs(s)*0.25);
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `calc(50% + ${Math.cos(angle)*r}px)`,
            top: `calc(50% + ${Math.sin(angle)*r}px)`,
            width: 2, height: 2, borderRadius: '50%',
            background: c1, boxShadow: `0 0 6px ${c1}`,
            opacity: 0.55, transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}/>
        );
      })}
    </div>
  );
}

Object.assign(window, { Orb, OrbDefs, stretchToLabel, stretchToMinutes, stretchToHue });
