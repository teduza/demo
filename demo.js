/* ==========================================================================
   demo.teduza.com — 3D Geodesic Planet + Irreversible Shatter Physics
   Phase Colors: Emerald (Init) -> Amber (Check) -> Crimson (Protection/Aftermath)
   ========================================================================== */
(function () {
  'use strict';

  // Capture visitor local timestamp strictly at page load
  const pageOpenedAt = new Date();

  const configEl = document.getElementById('scene-data');
  if (!configEl || !configEl.textContent) return;

  let config;
  try {
    config = JSON.parse(configEl.textContent);
  } catch (e) {
    return;
  }

  const prefersReduced =
    Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const bodyEl = document.body;
  const pageShell = document.querySelector('.page-shell');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const canvas = document.getElementById('spatial-field');
  const flashOverlay = document.getElementById('flash-overlay');
  const stageLog = document.getElementById('stage-log');
  const logContainer = document.getElementById('runtime-log');
  const scanBeam = document.getElementById('scan-beam');
  const stageNoise = document.getElementById('stage-noise');
  const noiseStream = document.getElementById('noise-stream');
  const stageProtection = document.getElementById('stage-protection');
  const stageEnvelope = document.getElementById('stage-envelope');
  const openLetterBtn = document.getElementById('open-letter-btn');
  const stageLetter = document.getElementById('stage-letter');
  const receivedTimeEl = document.getElementById('received-time');

  const NOISE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#%&$@<>/\\|*';

  const THEMES = {
    emerald: {
      meta: '#030706',
      primary: [16, 185, 129],
      bright: [110, 231, 183],
      core: [20, 184, 166],
    },
    amber: {
      meta: '#090602',
      primary: [245, 158, 11],
      bright: [252, 211, 77],
      core: [251, 146, 60],
    },
    crimson: {
      meta: '#090305',
      primary: [239, 68, 68],
      bright: [253, 164, 175],
      core: [225, 29, 72],
    },
  };

  // =========================================================================
  // 3D Geodesic Planet Engine + Irreversible Shatter & Debris Field
  // =========================================================================
  const sceneFX = {
    step: 1, // 1: log, 2: noise, 3: protection, 4: envelope, 5: document
    shattered: false, // Once true, planet NEVER recovers
    pointerX: 0.5,
    pointerY: 0.5,
    smoothX: 0.5,
    smoothY: 0.5,
    targetColor: THEMES.emerald,
    currentPrimary: [16, 185, 129],
    currentBright: [110, 231, 183],
    currentCore: [20, 184, 166],
    waves: [],
    sparks: [],
    shatterCallback: null,
    setTheme: function (name) {
      const t = THEMES[name];
      if (!t) return;
      this.targetColor = t;
      bodyEl.setAttribute('data-phase', name);
      if (themeMeta) themeMeta.setAttribute('content', t.meta);
    },
    triggerFlash: function () {
      if (!flashOverlay || prefersReduced) return;
      flashOverlay.classList.add('is-active');
      window.setTimeout(function () {
        flashOverlay.classList.remove('is-active');
      }, 95);
    },
    triggerImpact: function () {
      if (prefersReduced || !pageShell) return;
      pageShell.classList.remove('is-impact');
      void pageShell.offsetWidth;
      pageShell.classList.add('is-impact');
      window.setTimeout(function () {
        pageShell.classList.remove('is-impact');
      }, 420);
    },
    triggerWave: function (strength, isBright) {
      this.waves.push({
        r: 20,
        alpha: strength || 0.85,
        speed: 7.5,
        bright: Boolean(isBright),
      });
    },
    triggerBurst: function (count) {
      if (prefersReduced) return;
      for (let i = 0; i < (count || 32); i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.6 + Math.random() * 7.2;
        this.sparks.push({
          x: 0,
          y: 0,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.015 + Math.random() * 0.018,
          size: 1.2 + Math.random() * 2.1,
        });
      }
    },
    shatterPlanet: function () {
      if (this.shattered) return;
      this.shattered = true;
      this.triggerImpact();
      this.triggerFlash();
      this.triggerWave(1.0, true);
      window.setTimeout(function () {
        sceneFX.triggerWave(0.85, false);
      }, 110);
      this.triggerBurst(64);
      if (typeof this.shatterCallback === 'function') {
        this.shatterCallback();
      }
    },
  };

  (function initPlanetEngine() {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    // Build 3D Fibonacci sphere vertices + nearest neighbor edges + orbital rings
    const NODE_COUNT = 72;
    const nodes = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NODE_COUNT; i += 1) {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2;
      const rAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;
      nodes.push({
        x: Math.cos(theta) * rAtY,
        y: y,
        z: Math.sin(theta) * rAtY,
        jitterSeed: Math.random() * Math.PI * 2,
      });
    }

    const edges = [];
    for (let i = 0; i < NODE_COUNT; i += 1) {
      for (let j = i + 1; j < NODE_COUNT; j += 1) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dz = nodes[i].z - nodes[j].z;
        if (dx * dx + dy * dy + dz * dz < 0.36) {
          edges.push([i, j]);
        }
      }
    }

    // Orbiting planetary moons / beacons
    const satellites = [
      { angle: 0.4, speed: 0.013, radiusMul: 1.34, tilt: 0.32, size: 2.8 },
      { angle: 2.6, speed: -0.009, radiusMul: 1.48, tilt: -0.45, size: 2.2 },
      { angle: 4.5, speed: 0.011, radiusMul: 1.24, tilt: 0.14, size: 2.4 },
    ];

    // Irreversible shattered debris shards + snapped strut fragments
    const debrisShards = [];
    const brokenStruts = [];

    // Ambient starfield
    const stars = [];
    const STAR_COUNT = 92;
    for (let s = 0; s < STAR_COUNT; s += 1) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        z: 0.2 + Math.random() * 0.85,
        vx: (Math.random() - 0.5) * 0.00018,
        vy: (Math.random() - 0.5) * 0.00018,
        size: 0.65 + Math.random() * 1.45,
        alpha: 0.16 + Math.random() * 0.46,
      });
    }

    let rotY = 0.35;
    let rotX = 0.22;
    let time = 0;

    sceneFX.shatterCallback = function () {
      const cx = width * 0.5 + (sceneFX.smoothX - 0.5) * 28;
      const cy = height * 0.47 + (sceneFX.smoothY - 0.5) * 22;
      const baseR = Math.min(width, height) * 0.31;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Convert every sphere node into an irreversible drifting 3D polygonal shard
      for (let i = 0; i < NODE_COUNT; i += 1) {
        const n = nodes[i];
        const x1 = n.x * cosY - n.z * sinY;
        const z1 = n.x * sinY + n.z * cosY;
        const y2 = n.y * cosX - z1 * sinX;
        const z2 = n.y * sinX + z1 * cosX;

        const outForce = 2.4 + Math.random() * 6.2;
        const tangentX = -z1 * 1.4;
        const tangentY = (Math.random() - 0.5) * 2.2;

        debrisShards.push({
          x: x1 * baseR,
          y: y2 * baseR,
          z: z2 * baseR,
          vx: x1 * outForce + tangentX + (Math.random() - 0.5) * 1.5,
          vy: y2 * outForce + tangentY + (Math.random() - 0.5) * 1.5,
          vz: z2 * outForce * 0.8 + (Math.random() - 0.5) * 2.5,
          rot: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.045,
          size: 4 + Math.random() * 10,
          alpha: 0.45 + Math.random() * 0.5,
          shape: i % 3, // shard variety
        });
      }

      // Add extra fractured wireframe beam segments drifting outward
      for (let b = 0; b < 46; b += 1) {
        const a = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.5) * Math.PI;
        const r = baseR * (0.45 + Math.random() * 0.55);
        const ux = Math.cos(a) * Math.cos(phi);
        const uy = Math.sin(phi);
        const uz = Math.sin(a) * Math.cos(phi);
        const len = 14 + Math.random() * 34;
        const spd = 1.8 + Math.random() * 4.8;

        brokenStruts.push({
          x: ux * r,
          y: uy * r,
          z: uz * r,
          vx: ux * spd + (Math.random() - 0.5) * 1.2,
          vy: uy * spd + (Math.random() - 0.5) * 1.2,
          vz: uz * spd,
          angle: Math.random() * Math.PI * 2,
          vAngle: (Math.random() - 0.5) * 0.04,
          len: len,
          alpha: 0.35 + Math.random() * 0.45,
        });
      }
    };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener(
      'pointermove',
      function (e) {
        if (!width || !height) return;
        sceneFX.pointerX = e.clientX / width;
        sceneFX.pointerY = e.clientY / height;
      },
      { passive: true }
    );

    resize();

    function lerpTriple(curr, target, factor) {
      curr[0] += (target[0] - curr[0]) * factor;
      curr[1] += (target[1] - curr[1]) * factor;
      curr[2] += (target[2] - curr[2]) * factor;
    }

    function rgb(triple, alpha) {
      return (
        'rgba(' +
        Math.round(triple[0]) +
        ', ' +
        Math.round(triple[1]) +
        ', ' +
        Math.round(triple[2]) +
        ', ' +
        alpha.toFixed(3) +
        ')'
      );
    }

    function drawFrame() {
      ctx.clearRect(0, 0, width, height);

      // Smoothly interpolate theme colors & pointer parallax
      lerpTriple(sceneFX.currentPrimary, sceneFX.targetColor.primary, 0.075);
      lerpTriple(sceneFX.currentBright, sceneFX.targetColor.bright, 0.075);
      lerpTriple(sceneFX.currentCore, sceneFX.targetColor.core, 0.075);

      sceneFX.smoothX += (sceneFX.pointerX - sceneFX.smoothX) * 0.07;
      sceneFX.smoothY += (sceneFX.pointerY - sceneFX.smoothY) * 0.07;

      const cx = width * 0.5 + (sceneFX.smoothX - 0.5) * 28;
      const cy = height * 0.47 + (sceneFX.smoothY - 0.5) * 22;
      const planetRadius = Math.min(width, height) * 0.31;

      // 1. Background Starfield Dust
      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const mul = sceneFX.step === 2 ? 4.8 : sceneFX.shattered ? 0.55 : 1;
        if (!prefersReduced) {
          s.x = (s.x + s.vx * mul + 1) % 1;
          s.y = (s.y + s.vy * mul + 1) % 1;
        }
        const px = s.x * width + (sceneFX.smoothX - 0.5) * s.z * 38;
        const py = s.y * height + (sceneFX.smoothY - 0.5) * s.z * 28;
        ctx.beginPath();
        ctx.arc(px, py, s.size, 0, Math.PI * 2);
        ctx.fillStyle = rgb(i % 4 === 0 ? sceneFX.currentBright : sceneFX.currentPrimary, s.alpha * 0.72);
        ctx.fill();
      }

      // 2. Central Nebula Core Glow (Fades slightly when planet is shattered)
      const glowR = planetRadius * (sceneFX.shattered ? 1.55 : 1.45);
      const glowAlpha = sceneFX.shattered ? 0.14 : sceneFX.step === 2 ? 0.28 : 0.2;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      glow.addColorStop(0, rgb(sceneFX.currentPrimary, glowAlpha));
      glow.addColorStop(0.5, rgb(sceneFX.currentCore, glowAlpha * 0.42));
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // 3. INTACT 3D PLANET vs IRREVERSIBLE SHATTERED DEBRIS
      const fov = 580;

      if (!sceneFX.shattered) {
        const cosY = Math.cos(rotY + (sceneFX.smoothX - 0.5) * 0.55);
        const sinY = Math.sin(rotY + (sceneFX.smoothX - 0.5) * 0.55);
        const cosX = Math.cos(rotX + (sceneFX.smoothY - 0.5) * 0.4);
        const sinX = Math.sin(rotX + (sceneFX.smoothY - 0.5) * 0.4);

        // Planetary silhouette rim glow
        ctx.beginPath();
        ctx.arc(cx, cy, planetRadius * 0.94, 0, Math.PI * 2);
        ctx.strokeStyle = rgb(sceneFX.currentBright, sceneFX.step === 2 ? 0.34 : 0.18);
        ctx.lineWidth = 1.25;
        ctx.stroke();

        const projected = new Array(NODE_COUNT);
        for (let i = 0; i < NODE_COUNT; i += 1) {
          const n = nodes[i];
          let x = n.x;
          let y = n.y;
          let z = n.z;

          // Unstable pulse vibration during Step 2 (amber noise burst right before shatter)
          if (sceneFX.step === 2 && !prefersReduced) {
            const vib = 1 + Math.sin(time * 28 + n.jitterSeed) * 0.16;
            x *= vib;
            y *= vib;
            z *= vib;
          }

          const x1 = x * cosY - z * sinY;
          const z1 = x * sinY + z * cosY;
          const y2 = y * cosX - z1 * sinX;
          const z2 = y * sinX + z1 * cosX;

          const worldZ = z2 * planetRadius;
          const scale = fov / (fov + worldZ + planetRadius * 0.55);

          projected[i] = {
            sx: cx + x1 * planetRadius * scale,
            sy: cy + y2 * planetRadius * scale,
            depth: z2,
            scale: scale,
          };
        }

        // Geodesic planet wireframe edges
        ctx.lineWidth = 1;
        for (let e = 0; e < edges.length; e += 1) {
          const a = projected[edges[e][0]];
          const b = projected[edges[e][1]];
          const avgDepth = (a.depth + b.depth) * 0.5;
          const alpha = Math.max(0.035, ((1 - avgDepth) * 0.5) * (sceneFX.step === 2 ? 0.38 : 0.28));

          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.strokeStyle = rgb(sceneFX.currentPrimary, alpha);
          ctx.stroke();
        }

        // Geodesic planet nodes
        for (let i = 0; i < NODE_COUNT; i += 1) {
          const pt = projected[i];
          const alpha = Math.max(0.12, ((1 - pt.depth) * 0.5) * 0.88);
          const r = (1.35 + (1 - pt.depth) * 1.0) * pt.scale;
          ctx.beginPath();
          ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2);
          ctx.fillStyle = rgb(i % 6 === 0 ? sceneFX.currentBright : sceneFX.currentPrimary, alpha);
          ctx.fill();
        }

        // Tilted Planetary Ring + Orbiting Satellites
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.26);
        ctx.scale(1, 0.34);
        ctx.beginPath();
        ctx.setLineDash([8, 12]);
        ctx.arc(0, 0, planetRadius * 1.38, 0, Math.PI * 2);
        ctx.strokeStyle = rgb(sceneFX.currentBright, 0.24);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        for (let m = 0; m < satellites.length; m += 1) {
          const sat = satellites[m];
          if (!prefersReduced) sat.angle += sat.speed * (sceneFX.step === 2 ? 2.8 : 1);
          const sr = planetRadius * sat.radiusMul;
          const sx = cx + Math.cos(sat.angle) * sr;
          const sy = cy + Math.sin(sat.angle) * sr * 0.36 + Math.cos(sat.angle) * sr * sat.tilt * 0.45;
          ctx.beginPath();
          ctx.arc(sx, sy, sat.size, 0, Math.PI * 2);
          ctx.fillStyle = rgb(sceneFX.currentBright, 0.85);
          ctx.fill();
        }
      } else {
        // SHATTERED PLANET AFTERMATH (Irreversible drifting shards & snapped struts)
        const mxWorld = (sceneFX.pointerX - 0.5) * width;
        const myWorld = (sceneFX.pointerY - 0.5) * height;

        // Snapped wireframe struts
        for (let b = 0; b < brokenStruts.length; b += 1) {
          const st = brokenStruts[b];
          if (!prefersReduced) {
            st.x += st.vx;
            st.y += st.vy;
            st.z += st.vz;
            st.vx *= 0.986;
            st.vy *= 0.986;
            st.vz *= 0.986;
            st.vx += (Math.random() - 0.5) * 0.008;
            st.vy += (Math.random() - 0.5) * 0.008;
            st.angle += st.vAngle;
            st.vAngle *= 0.996;
            if (st.alpha > 0.14) st.alpha *= 0.9985;
          }

          const scale = fov / (fov + Math.max(-240, st.z) + 180);
          const sx = cx + st.x * scale;
          const sy = cy + st.y * scale;
          const half = st.len * 0.5 * scale;
          const dx = Math.cos(st.angle) * half;
          const dy = Math.sin(st.angle) * half;

          ctx.beginPath();
          ctx.moveTo(sx - dx, sy - dy);
          ctx.lineTo(sx + dx, sy + dy);
          ctx.strokeStyle = rgb(sceneFX.currentPrimary, st.alpha);
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }

        // Tumbling polygonal shards (with gentle cursor repulsion)
        for (let i = 0; i < debrisShards.length; i += 1) {
          const sh = debrisShards[i];
          if (!prefersReduced) {
            // Subtle cursor deflection force near pointer
            const dxPtr = sh.x - mxWorld;
            const dyPtr = sh.y - myWorld;
            const distSq = dxPtr * dxPtr + dyPtr * dyPtr;
            if (distSq > 10 && distSq < 28000) {
              const push = (1 - distSq / 28000) * 0.18;
              sh.vx += (dxPtr / Math.sqrt(distSq)) * push;
              sh.vy += (dyPtr / Math.sqrt(distSq)) * push;
            }

            sh.x += sh.vx;
            sh.y += sh.vy;
            sh.z += sh.vz;
            sh.vx *= 0.985;
            sh.vy *= 0.985;
            sh.vz *= 0.985;
            // Slow zero-gravity drift in void
            sh.vx += Math.sin(time * 0.7 + i) * 0.004;
            sh.vy += Math.cos(time * 0.6 + i) * 0.004;
            sh.rot += sh.vRot;
            sh.vRot *= 0.996;
            if (sh.alpha > 0.22) sh.alpha *= 0.9988;
          }

          const scale = fov / (fov + Math.max(-260, sh.z) + 200);
          const px = cx + sh.x * scale;
          const py = cy + sh.y * scale;
          const sz = sh.size * scale;

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(sh.rot);
          ctx.beginPath();
          ctx.moveTo(0, -sz);
          ctx.lineTo(sz * 0.85, sz * 0.65);
          ctx.lineTo(-sz * 0.65, sz * 0.45);
          ctx.closePath();

          if (sh.shape === 0) {
            ctx.fillStyle = rgb(sceneFX.currentPrimary, sh.alpha * 0.45);
            ctx.fill();
            ctx.strokeStyle = rgb(sceneFX.currentBright, sh.alpha * 0.75);
            ctx.lineWidth = 0.9;
            ctx.stroke();
          } else {
            ctx.strokeStyle = rgb(sceneFX.currentPrimary, sh.alpha * 0.8);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 4. Burst Sparks
      for (let k = sceneFX.sparks.length - 1; k >= 0; k -= 1) {
        const sp = sceneFX.sparks[k];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vx *= 0.972;
        sp.vy *= 0.972;
        sp.life -= sp.decay;

        if (sp.life <= 0) {
          sceneFX.sparks.splice(k, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(cx + sp.x, cy + sp.y, sp.size * sp.life, 0, Math.PI * 2);
        ctx.fillStyle = rgb(sceneFX.currentBright, sp.life * 0.92);
        ctx.fill();
      }

      // 5. Expanding Photonic Shockwaves
      for (let w = sceneFX.waves.length - 1; w >= 0; w -= 1) {
        const wave = sceneFX.waves[w];
        wave.r += wave.speed;
        wave.speed *= 1.028;
        wave.alpha *= 0.955;

        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.47, wave.r, 0, Math.PI * 2);
        ctx.strokeStyle = rgb(wave.bright ? sceneFX.currentBright : sceneFX.currentPrimary, wave.alpha);
        ctx.lineWidth = wave.bright ? 2.4 : 1.6;
        ctx.stroke();

        if (wave.alpha < 0.015 || wave.r > Math.max(width, height) * 1.2) {
          sceneFX.waves.splice(w, 1);
        }
      }

      if (!prefersReduced) {
        const rotSpeed = sceneFX.step === 2 ? 3.4 : 1;
        rotY += 0.0045 * rotSpeed;
        rotX += 0.0018 * rotSpeed;
        time += 0.016;
        window.requestAnimationFrame(drawFrame);
      }
    }

    drawFrame();
  })();

  // =========================================================================
  // Scene Choreography Helpers & Pacing
  // =========================================================================
  function setStageState(stepNum, sphereScale) {
    if (typeof stepNum === 'number') sceneFX.step = stepNum;
    if (typeof sphereScale === 'number') sceneFX.expansionTarget = sphereScale;
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function showPanel(el) {
    if (!el) return;
    el.hidden = false;
    el.classList.remove('is-exiting');
    el.classList.remove('is-visible');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('is-visible');
      });
    });
  }

  function hidePanel(el, waitMs) {
    return new Promise(function (resolve) {
      if (!el) {
        resolve();
        return;
      }
      el.classList.remove('is-visible');
      el.classList.add('is-exiting');
      window.setTimeout(function () {
        el.hidden = true;
        el.classList.remove('is-exiting');
        resolve();
      }, prefersReduced ? 20 : waitMs);
    });
  }

  function createCursor() {
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    return cursor;
  }

  function renderLogLine(container, text, highlightWord, isTypingEnd) {
    container.textContent = '';

    let highlightStart = -1;
    let highlightEnd = -1;
    if (highlightWord) {
      const idx = text.indexOf(highlightWord);
      if (idx !== -1) {
        highlightStart = idx;
        highlightEnd = idx + highlightWord.length;
      }
    }

    const headLimit = isTypingEnd && text.length > 1 ? text.length - 1 : text.length;

    if (highlightStart === -1 || headLimit <= highlightStart) {
      container.appendChild(document.createTextNode(text.slice(0, headLimit)));
    } else {
      container.appendChild(document.createTextNode(text.slice(0, highlightStart)));
      const hlSpan = document.createElement('span');
      hlSpan.className = 'hl-signal';
      hlSpan.textContent = text.slice(highlightStart, Math.min(headLimit, highlightEnd));
      container.appendChild(hlSpan);
      if (headLimit > highlightEnd) {
        container.appendChild(document.createTextNode(text.slice(highlightEnd, headLimit)));
      }
    }

    if (isTypingEnd && text.length > 0) {
      const flashSpan = document.createElement('span');
      flashSpan.className = 'char-flash';
      flashSpan.textContent = text.slice(text.length - 1);
      container.appendChild(flashSpan);
    }
  }

  function generateNoiseString(length) {
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += NOISE_ALPHABET.charAt(Math.floor(Math.random() * NOISE_ALPHABET.length));
    }
    return out;
  }

  function formatReceivedTimestamp(date, locale) {
    try {
      return new Intl.DateTimeFormat(locale || 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(date);
    } catch (e) {
      return date.toLocaleString();
    }
  }

  // Tactile 3D tilt + spotlight sheen on the sealed vault button
  if (openLetterBtn && !prefersReduced) {
    openLetterBtn.addEventListener('pointermove', function (e) {
      const rect = openLetterBtn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const nx = x / rect.width - 0.5;
      const ny = y / rect.height - 0.5;

      openLetterBtn.style.setProperty('--mx', x.toFixed(1) + 'px');
      openLetterBtn.style.setProperty('--my', y.toFixed(1) + 'px');
      openLetterBtn.style.setProperty('--rx', (-ny * 6.5).toFixed(2) + 'deg');
      openLetterBtn.style.setProperty('--ry', (nx * 6.5).toFixed(2) + 'deg');
    });

    openLetterBtn.addEventListener('pointerleave', function () {
      openLetterBtn.style.setProperty('--rx', '0deg');
      openLetterBtn.style.setProperty('--ry', '0deg');
    });
  }

  // =========================================================================
  // Deliberate 5-Step Sequence (Emerald -> Amber -> Crimson Shatter)
  // =========================================================================
  async function runStep1Log() {
    if (!stageLog || !logContainer || !Array.isArray(config.lines)) return;

    sceneFX.setTheme('emerald');
    setStageState(1, 1.0);
    showPanel(stageLog);
    const cursor = createCursor();

    for (let i = 0; i < config.lines.length; i += 1) {
      const item = config.lines[i];

      // Shift to Amber/Yellow right when environment check starts (index 2+)
      if (i === 2) {
        sceneFX.setTheme('amber');
        sceneFX.triggerWave(0.45, false);
        setStageState(1, 1.02);
      }

      const lineEl = document.createElement('div');
      lineEl.className = item.strong ? 'log-line is-strong' : 'log-line';

      const textSpan = document.createElement('span');
      lineEl.appendChild(textSpan);
      lineEl.appendChild(cursor);
      logContainer.appendChild(lineEl);

      if (prefersReduced) {
        renderLogLine(textSpan, item.text, item.highlight, false);
        await sleep(item.reducedDelay || 180);
      } else {
        const chars = item.text;
        for (let c = 1; c <= chars.length; c += 1) {
          renderLogLine(textSpan, chars.slice(0, c), item.highlight, c < chars.length);
          await sleep(item.charDelay || 34);
        }
        renderLogLine(textSpan, chars, item.highlight, false);
        if (item.highlight) {
          sceneFX.triggerWave(0.75, true);
          sceneFX.triggerBurst(22);
        }
        await sleep(item.pauseAfter || 560);
      }
    }

    if (scanBeam && !prefersReduced) {
      scanBeam.classList.add('is-sweeping');
    }

    await sleep(prefersReduced ? 180 : 720);
    await hidePanel(stageLog, 380);
    await sleep(prefersReduced ? 60 : 320);
  }

  async function runStep2Noise() {
    if (!stageNoise || !noiseStream) return;

    setStageState(2, 1.18);
    sceneFX.triggerFlash();
    sceneFX.triggerWave(0.7, true);
    showPanel(stageNoise);
    const len = 44;

    if (prefersReduced) {
      noiseStream.textContent = generateNoiseString(len);
      await sleep(360);
      await hidePanel(stageNoise, 40);
      return;
    }

    const duration = 1400;
    const intervalMs = 46;
    noiseStream.textContent = generateNoiseString(len);

    await new Promise(function (resolve) {
      const timer = window.setInterval(function () {
        noiseStream.textContent = generateNoiseString(len);
      }, intervalMs);

      window.setTimeout(function () {
        window.clearInterval(timer);
        resolve();
      }, duration);
    });

    await hidePanel(stageNoise, 320);
    await sleep(380);
  }

  async function runStep3Protection() {
    if (!stageProtection) return;
    // Switch to Crimson AND irreversibly fracture & shatter the 3D planet!
    sceneFX.setTheme('crimson');
    setStageState(3, 1.05);
    sceneFX.shatterPlanet();

    showPanel(stageProtection);
    await sleep(prefersReduced ? 750 : 2350);
    await hidePanel(stageProtection, 420);
    await sleep(prefersReduced ? 60 : 420);
  }

  function showStep4Envelope() {
    if (!stageEnvelope) return;
    setStageState(4, 0.96);
    sceneFX.triggerWave(0.5, false);
    showPanel(stageEnvelope);
  }

  async function openStep5Letter() {
    if (!stageEnvelope || !stageLetter) return;
    if (openLetterBtn) {
      openLetterBtn.disabled = true;
      openLetterBtn.style.setProperty('--rx', '0deg');
      openLetterBtn.style.setProperty('--ry', '0deg');
      openLetterBtn.classList.add('is-unsealing');
    }

    setStageState(5, 1.12);
    sceneFX.triggerFlash();
    sceneFX.triggerWave(0.9, true);
    sceneFX.triggerBurst(36);
    await sleep(prefersReduced ? 20 : 380);
    await hidePanel(stageEnvelope, 340);

    // Populate "Received" strictly when user opens the message
    if (receivedTimeEl) {
      receivedTimeEl.textContent = formatReceivedTimestamp(pageOpenedAt, config.locale);
    }

    showPanel(stageLetter);
  }

  if (openLetterBtn) {
    openLetterBtn.addEventListener('click', openStep5Letter);
  }

  async function runScene() {
    await runStep1Log();
    await runStep2Noise();
    await runStep3Protection();
    showStep4Envelope();
  }

  runScene();
})();
