(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STATIONS = [
    {
      id: "kitchen",
      name: "母亲的厨房",
      relation: "母亲",
      color: "#E8B26A",
      x: -360,
      y: 220,
      bend: 38,
      style: "solid",
      icon: "bowl",
      object: "一只缺口的白瓷碗",
      whisper: "她说：我没等，我就是睡不着。",
      phase: 0.4,
    },
    {
      id: "letter",
      name: "没寄出的信",
      relation: "旧友",
      color: "#7C93B8",
      x: -320,
      y: -300,
      bend: -40,
      style: "dashed",
      icon: "letter",
      object: "一张对折了四次的信纸",
      whisper: "最后一行是：如果你看到，就当我没写。",
      phase: 1.7,
    },
    {
      id: "tree",
      name: "操场第三棵树",
      relation: "同桌",
      color: "#7FA88B",
      x: 360,
      y: -220,
      bend: 44,
      style: "solid",
      icon: "pen",
      object: "一支没有墨的黑色水笔",
      whisper: "毕业那天你说，以后常联系。我们都知道这句话的意思。",
      phase: 2.6,
    },
    {
      id: "chat",
      name: "凌晨两点的对话框",
      relation: "前任",
      color: "#9B8AB8",
      x: 350,
      y: 260,
      bend: -46,
      style: "tangled",
      icon: "phone",
      object: "一部碎了角的旧手机",
      whisper: "从“今天遇到一件特别好笑的事”，到“晚安”。",
      phase: 3.3,
    },
    {
      id: "chair",
      name: "空椅子",
      relation: "奶奶",
      color: "#C9D6E3",
      x: 30,
      y: -380,
      bend: 8,
      style: "broken",
      icon: "chair",
      object: "一把扶手被磨得发亮的藤椅",
      whisper: "风很大，像有人在叹气。",
      phase: 4.1,
    },
  ];

  const ICONS = {
    bowl: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 23h32"/><path d="M11 23c0 9 5 15 13 15s13-6 13-15"/><path d="M17 19c0-4 14-4 14 0" opacity=".5"/></svg>`,
    letter: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="14" width="30" height="21" rx="1"/><path d="M9 15l15 11 15-11"/><path d="M9 34l11-10M39 34L28 24" opacity=".4"/></svg>`,
    pen: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 38l3-11 17-17 8 8-17 17-11 3Z"/><path d="M31 14l5 5M18 27l3 3"/></svg>`,
    phone: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="15" y="5" width="18" height="38" rx="3"/><path d="M21 9h6" opacity=".5"/><circle cx="24" cy="38" r="1.2"/></svg>`,
    chair: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8v21h22V8"/><path d="M13 23h22"/><path d="M15 30v12M33 30v12M15 36h18"/></svg>`,
  };

  const state = {
    phase: "start",
    player: { x: 110, y: 110 },
    target: null,
    keys: new Set(),
    stayDown: false,
    stay: 0,
    centerStay: 0,
    near: null,
    atCenter: false,
    collected: [],
    trail: [],
  };

  let W = 1;
  let H = 1;
  let DPR = 1;
  let ctx = null;
  let viewScale = 1;
  let stars = [];
  let toastTimer = 0;
  let last = performance.now();
  let time = 0;

  const dom = {};

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  function rgba(hex, alpha) {
    let h = String(hex).replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  function screenOf(p) {
    return { x: W / 2 + p.x * viewScale, y: H / 2 + p.y * viewScale };
  }

  function worldOf(sx, sy) {
    return { x: (sx - W / 2) / viewScale, y: (sy - H / 2) / viewScale };
  }

  function stationById(id) {
    return STATIONS.find((s) => s.id === id) || null;
  }

  function isMobile() {
    return W < 600;
  }

  function toast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.remove("show"), 2600);
  }

  /* ------------------------------------------------------------------ */
  /* Canvas                                                              */
  /* ------------------------------------------------------------------ */

  function resize() {
    W = Math.max(320, window.innerWidth);
    H = Math.max(320, window.innerHeight);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    dom.canvas.width = Math.round(W * DPR);
    dom.canvas.height = Math.round(H * DPR);
    dom.canvas.style.width = W + "px";
    dom.canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    viewScale = clamp(Math.min(W, H) / 900, 0.42, 1);
    buildStars();
  }

  function buildStars() {
    const count = Math.round(clamp((W * H) / 11000, 80, 190));
    stars = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.1 + 0.3,
      a: Math.random() * 0.4 + 0.1,
      p: Math.random() * TAU,
      s: Math.random() * 0.7 + 0.3,
    }));
  }

  function drawNebula() {
    const base = Math.max(W, H);
    const blobs = [
      { x: W * 0.5, y: H * 0.44, r: base * 0.54, c: "#E8B26A", a: 0.045 },
      { x: W * 0.14, y: H * 0.72, r: base * 0.38, c: "#7C93B8", a: 0.035 },
      { x: W * 0.86, y: H * 0.2, r: base * 0.36, c: "#9B8AB8", a: 0.03 },
    ];
    for (const b of blobs) {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, rgba(b.c, b.a));
      g.addColorStop(1, rgba(b.c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawStars() {
    for (const st of stars) {
      const tw = REDUCED ? 1 : 0.6 + 0.4 * Math.sin(time * 0.001 * st.s + st.p);
      ctx.globalAlpha = st.a * tw;
      ctx.fillStyle = st.r > 1.05 ? "#E8B26A" : "#C9D6E3";
      ctx.beginPath();
      ctx.arc(st.x * W, st.y * H, st.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ */
  /* Drawing                                                             */
  /* ------------------------------------------------------------------ */

  function pathPoint(p0, c, p1, t) {
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
      y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
    };
  }

  function strokeCurve(s, p0, c, p1, from, to) {
    const steps = 54;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = from + (to - from) * (i / steps);
      const pt = pathPoint(p0, c, p1, t);
      let x = pt.x;
      let y = pt.y;
      if (s.style === "tangled") {
        const off = Math.sin(t * Math.PI * 5 + s.phase) * 7 * viewScale;
        x += nx * off;
        y += ny * off;
      }
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawLines() {
    const c0 = { x: W / 2, y: H / 2 };

    for (const s of STATIONS) {
      const p = screenOf(s);
      const dx = p.x - c0.x;
      const dy = p.y - c0.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const bend = s.bend * viewScale;
      const c = {
        x: (c0.x + p.x) / 2 + nx * bend,
        y: (c0.y + p.y) / 2 + ny * bend,
      };

      const collected = state.collected.includes(s.id);
      const near = state.near && state.near.id === s.id;
      const returning = state.phase === "return";

      let alpha = 0.22;
      if (collected) alpha = 0.6;
      else if (near) alpha = 0.5;
      else if (returning) alpha = 0.07;

      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = rgba(s.color, alpha * 0.18);
      ctx.lineWidth = 5;
      strokeCurve(s, c0, c, p, 0, 1);
      ctx.stroke();

      ctx.strokeStyle = rgba(s.color, alpha);
      ctx.lineWidth = collected ? 1.6 : 1;
      if (s.style === "dashed") ctx.setLineDash([4, 8]);
      else if (s.style === "broken") ctx.setLineDash([]);
      else ctx.setLineDash([]);

      if (s.style === "broken" && !collected) {
        strokeCurve(s, c0, c, p, 0, 0.42);
        strokeCurve(s, c0, c, p, 0.58, 1);
      } else {
        strokeCurve(s, c0, c, p, 0, 1);
      }

      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawGlyph(icon, x, y, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (icon === "bowl") {
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
    } else if (icon === "letter") {
      ctx.strokeRect(-7, -5, 14, 10);
      ctx.beginPath();
      ctx.moveTo(-7, -4);
      ctx.lineTo(0, 2);
      ctx.lineTo(7, -4);
      ctx.stroke();
    } else if (icon === "pen") {
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(5, -5);
      ctx.moveTo(4, -6);
      ctx.lineTo(6, -4);
      ctx.stroke();
    } else if (icon === "phone") {
      ctx.strokeRect(-4, -7, 8, 14);
      ctx.beginPath();
      ctx.arc(0, 5, 0.8, 0, TAU);
      ctx.stroke();
    } else if (icon === "chair") {
      ctx.beginPath();
      ctx.moveTo(-5, -7);
      ctx.lineTo(-5, 4);
      ctx.lineTo(5, 4);
      ctx.lineTo(5, -7);
      ctx.moveTo(-6, 7);
      ctx.lineTo(-6, 10);
      ctx.moveTo(6, 7);
      ctx.lineTo(6, 10);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawNodes() {
    const mobile = isMobile();

    for (const s of STATIONS) {
      const p = screenOf(s);
      const collected = state.collected.includes(s.id);
      const near = state.near && state.near.id === s.id;
      const returning = state.phase === "return";
      const dim = returning && !collected;

      const pulse = REDUCED ? 0 : Math.sin(time * 0.0012 + s.phase) * 1.4;
      const alpha = dim ? 0.26 : collected ? 1 : 0.9;

      ctx.save();
      ctx.globalAlpha = alpha;

      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 54 + pulse);
      g.addColorStop(0, rgba(s.color, collected ? 0.28 : 0.2));
      g.addColorStop(0.55, rgba(s.color, collected ? 0.09 : 0.06));
      g.addColorStop(1, rgba(s.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 54 + pulse, 0, TAU);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, 16 + (near ? 3 : 0) + pulse * 0.4, 0, TAU);
      ctx.strokeStyle = rgba(s.color, collected ? 0.8 : near ? 0.72 : 0.44);
      ctx.lineWidth = collected ? 1.6 : 1;
      ctx.stroke();

      if (collected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 22, 0, TAU);
        ctx.strokeStyle = rgba(s.color, 0.28);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, collected ? 5.2 : 4.2, 0, TAU);
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = collected ? 20 : 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      drawGlyph(s.icon, p.x, p.y - 32, s.color, collected ? 0.9 : near ? 0.85 : 0.5);

      ctx.textAlign = "center";
      ctx.font = `${mobile ? 10 : 13}px "Songti SC","STSong","SimSun",serif`;
      const labelW = ctx.measureText(s.name).width;
      ctx.fillStyle = "rgba(5,8,13,.52)";
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(p.x - labelW / 2 - 5, p.y + 16, labelW + 10, 15, 7);
      } else {
        ctx.rect(p.x - labelW / 2 - 5, p.y + 16, labelW + 10, 15);
      }
      ctx.fill();
      ctx.fillStyle = rgba("#EDEAE3", collected ? 0.95 : near ? 0.92 : dim ? 0.32 : 0.82);
      ctx.shadowColor = "rgba(0,0,0,.85)";
      ctx.shadowBlur = 6;
      ctx.fillText(s.name, p.x, p.y + 26);

      ctx.font = `${mobile ? 8 : 9}px system-ui,"PingFang SC",sans-serif`;
      ctx.fillStyle = rgba("#8E97A3", collected ? 0.72 : near ? 0.68 : dim ? 0.22 : 0.55);
      ctx.fillText(`${s.relation} · ${collected ? "光已带回" : "未靠近"}`, p.x, p.y + 41);

      ctx.restore();
    }
  }

  function drawCenter() {
    const p = { x: W / 2, y: H / 2 };
    const returning = state.phase === "return";
    const base = returning ? 1 : 0.72;
    const pulse = REDUCED ? 0 : Math.sin(time * 0.0013) * 2;

    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 120);
    g.addColorStop(0, `rgba(240,230,210,${0.12 * base})`);
    g.addColorStop(0.55, `rgba(232,178,106,${0.05 * base})`);
    g.addColorStop(1, "rgba(240,230,210,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 120, 0, TAU);
    ctx.fill();

    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22 + i * 18 + pulse, 0, TAU);
      ctx.strokeStyle = `rgba(232,178,106,${(0.2 - i * 0.04) * base})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // collected lights orbit the center
    state.collected.forEach((id, i) => {
      const s = stationById(id);
      if (!s) return;
      const a = time * 0.0003 + i * (TAU / 3);
      const rr = 34;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 2.2, 0, TAU);
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    ctx.beginPath();
    ctx.arc(p.x, p.y, 6.5, 0, TAU);
    ctx.fillStyle = "rgba(240,230,210,.96)";
    ctx.shadowColor = "#E8B26A";
    ctx.shadowBlur = 28;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.textAlign = "center";
    ctx.font = '15px "Songti SC","STSong","SimSun",serif';
    ctx.fillStyle = "rgba(240,230,210,.88)";
    ctx.fillText("我", p.x, p.y + 48);

    ctx.font = '8px system-ui,"PingFang SC",sans-serif';
    ctx.fillStyle = "rgba(200,205,214,.4)";
    ctx.fillText("S E L F", p.x, p.y + 64);

    if (returning) {
      const k = clamp(state.centerStay, 0, 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 24, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.strokeStyle = "rgba(232,178,106,.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawPlayer() {
    const p = screenOf(state.player);

    for (let i = 0; i < state.trail.length; i++) {
      const t = state.trail[i];
      const q = screenOf(t);
      const alpha = (i / state.trail.length) * 0.18;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 1.6, 0, TAU);
      ctx.fillStyle = `rgba(240,218,180,${alpha})`;
      ctx.fill();
    }

    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30);
    g.addColorStop(0, "rgba(248,226,190,.55)");
    g.addColorStop(0.5, "rgba(232,178,106,.16)");
    g.addColorStop(1, "rgba(232,178,106,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, TAU);
    ctx.fillStyle = "#F6E4C8";
    ctx.shadowColor = "#E8B26A";
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, TAU);
    ctx.strokeStyle = "rgba(232,178,106,.55)";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (state.stay > 0 && state.phase === "roam") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, -Math.PI / 2, -Math.PI / 2 + TAU * state.stay);
      ctx.strokeStyle = "rgba(232,178,106,.9)";
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  }

  function drawTarget() {
    if (!state.target) return;
    const p = screenOf(state.target);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, TAU);
    ctx.strokeStyle = "rgba(237,234,227,.28)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawNebula();
    drawStars();
    drawLines();
    drawCenter();
    drawPlayer();
    drawTarget();
    drawNodes();
  }

  /* ------------------------------------------------------------------ */
  /* Gameplay                                                            */
  /* ------------------------------------------------------------------ */

  function move(dt) {
    const speed = 185 / viewScale;
    let dx = 0;
    let dy = 0;
    const k = state.keys;

    if (k.has("w") || k.has("arrowup")) dy -= 1;
    if (k.has("s") || k.has("arrowdown")) dy += 1;
    if (k.has("a") || k.has("arrowleft")) dx -= 1;
    if (k.has("d") || k.has("arrowright")) dx += 1;

    if (dx || dy) {
      state.target = null;
      const len = Math.hypot(dx, dy) || 1;
      state.player.x += (dx / len) * speed * dt;
      state.player.y += (dy / len) * speed * dt;
    } else if (state.target) {
      const tx = state.target.x - state.player.x;
      const ty = state.target.y - state.player.y;
      const dist = Math.hypot(tx, ty);
      if (dist < 4) {
        state.target = null;
      } else {
        const step = Math.min(dist, speed * dt);
        state.player.x += (tx / dist) * step;
        state.player.y += (ty / dist) * step;
      }
    }

    state.player.x = clamp(state.player.x, -560, 560);
    state.player.y = clamp(state.player.y, -500, 500);

    const lastTrail = state.trail[state.trail.length - 1];
    if (!lastTrail || Math.hypot(lastTrail.x - state.player.x, lastTrail.y - state.player.y) > 3) {
      state.trail.push({ x: state.player.x, y: state.player.y });
      if (state.trail.length > 18) state.trail.shift();
    }
  }

  function update(dt) {
    time += dt * 1000;

    if (state.phase !== "roam" && state.phase !== "return") {
      updateUI();
      return;
    }

    move(dt);

    const centerDist = Math.hypot(state.player.x, state.player.y) * viewScale;
    state.atCenter = centerDist < 48;

    if (state.phase === "roam") {
      let best = null;
      let bestDist = Infinity;
      for (const s of STATIONS) {
        if (state.collected.includes(s.id)) continue;
        const p = screenOf(s);
        const q = screenOf(state.player);
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < 70 && d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      state.near = best;

      if (best) {
        if (state.stayDown) state.stay += dt / 2.1;
        else state.stay -= dt / 3;
        state.stay = clamp(state.stay, 0, 1);
        if (state.stay >= 1) collect(best);
      } else {
        state.stay = Math.max(0, state.stay - dt / 2.5);
      }
    } else {
      state.near = null;
      state.stay = 0;
      if (state.atCenter) {
        if (state.stayDown) state.centerStay += dt / 1.7;
        else state.centerStay -= dt / 2.5;
        state.centerStay = clamp(state.centerStay, 0, 1);
        if (state.centerStay >= 1) endGame();
      } else {
        state.centerStay = Math.max(0, state.centerStay - dt / 2);
      }
    }

    updateUI();
  }

  function collect(s) {
    state.collected.push(s.id);
    state.phase = "reading";
    state.stay = 0;
    state.stayDown = false;
    state.near = null;
    updateScore();
    showCard(s);
  }

  function showCard(s) {
    state.phase = "reading";
    state.stayDown = false;
    dom.cardKicker.textContent = `你靠近了 · ${s.name} · ${s.relation}`;
    dom.cardLine.textContent = `“${s.whisper}”`;
    dom.cardObject.textContent = `物件 · ${s.object}`;
    dom.cardGlyph.innerHTML = ICONS[s.icon] || "";
    dom.card.hidden = false;
    window.setTimeout(() => dom.cardBtn.focus({ preventScroll: true }), 180);
  }

  function closeCard() {
    dom.card.hidden = true;
    state.stayDown = false;
    if (state.collected.length >= 3) {
      state.phase = "return";
      toast("中心亮了。回到中心，把光放下。");
    } else {
      state.phase = "roam";
    }
    updateUI();
  }

  function endGame() {
    state.phase = "end";
    state.stayDown = false;
    const names = state.collected.map((id) => stationById(id).name);
    dom.endList.textContent = names.join(" · ");
    dom.end.hidden = false;
    window.setTimeout(() => dom.restartBtn.focus({ preventScroll: true }), 220);
  }

  function startGame() {
    state.phase = "roam";
    dom.start.classList.add("gone");
    window.setTimeout(() => {
      dom.start.hidden = true;
    }, 560);
    updateUI();
    dom.stayBtn.focus({ preventScroll: true });
  }

  function resetGame() {
    state.phase = "roam";
    state.player = { x: 110, y: 110 };
    state.target = null;
    state.keys.clear();
    state.stayDown = false;
    state.stay = 0;
    state.centerStay = 0;
    state.near = null;
    state.atCenter = false;
    state.collected = [];
    state.trail = [];
    dom.end.hidden = true;
    dom.card.hidden = true;
    updateScore();
    updateUI();
    toast("再走一次。");
  }

  /* ------------------------------------------------------------------ */
  /* UI                                                                  */
  /* ------------------------------------------------------------------ */

  function updateScore() {
    dom.lightsCount.textContent = String(state.collected.length);
    $$("#dots i").forEach((dot, i) => dot.classList.toggle("on", i < state.collected.length));
  }

  function updateUI() {
    const mobile = isMobile();
    const moveHint = mobile ? "点按节点靠近 · 按住「停留」" : "WASD / 方向键移动 · 靠近一个发光的节点";
    const stayHint = mobile ? "按住「停留」" : "按住空格";

    if (state.phase === "roam") {
      if (state.near) {
        dom.hint.textContent = `靠近了 · ${state.near.name} · ${stayHint}`;
      } else {
        dom.hint.textContent = moveHint;
      }
    } else if (state.phase === "return") {
      dom.hint.textContent = state.atCenter
        ? `${stayHint} · 把光放下`
        : "回到中心 · 把光放下";
    } else if (state.phase === "start") {
      dom.hint.textContent = moveHint;
    } else {
      dom.hint.textContent = "";
    }

    const ready = (state.phase === "roam" && state.near) || (state.phase === "return" && state.atCenter);
    dom.stayBtn.classList.toggle("is-ready", Boolean(ready));
    dom.stayLabel.textContent = state.phase === "return" && state.atCenter ? "把光放下" : "按住停留";

    const p = state.phase === "return" ? state.centerStay : state.stay;
    dom.stayBtn.style.setProperty("--p", String(Math.round(p * 100)));
  }

  /* ------------------------------------------------------------------ */
  /* Input                                                               */
  /* ------------------------------------------------------------------ */

  function bindInput() {
    const canvas = dom.canvas;

    canvas.addEventListener("pointerdown", (e) => {
      if (state.phase !== "roam" && state.phase !== "return") return;
      const world = worldOf(e.clientX, e.clientY);

      let target = world;
      for (const s of STATIONS) {
        const p = screenOf(s);
        if (Math.hypot(p.x - e.clientX, p.y - e.clientY) < 48) {
          target = { x: s.x, y: s.y };
          break;
        }
      }
      if (state.phase === "return") {
        const c = screenOf({ x: 0, y: 0 });
        if (Math.hypot(c.x - e.clientX, c.y - e.clientY) < 60) target = { x: 0, y: 0 };
      }
      state.target = target;
    });

    dom.startBtn.addEventListener("click", startGame);
    dom.cardBtn.addEventListener("click", closeCard);
    dom.restartBtn.addEventListener("click", resetGame);

    dom.stayBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      state.stayDown = true;
      dom.stayBtn.setPointerCapture(e.pointerId);
    });
    dom.stayBtn.addEventListener("pointerup", () => {
      state.stayDown = false;
    });
    dom.stayBtn.addEventListener("pointercancel", () => {
      state.stayDown = false;
    });
    dom.stayBtn.addEventListener("pointerleave", () => {
      state.stayDown = false;
    });

    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();

      if (key === " " || key === "spacebar") {
        e.preventDefault();
        if (state.phase === "start") {
          startGame();
          return;
        }
        state.stayDown = true;
        return;
      }

      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        e.preventDefault();
        state.keys.add(key);
      }
    });

    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      state.keys.delete(key);
      if (key === " " || key === "spacebar") state.stayDown = false;
    });

    window.addEventListener("blur", () => {
      state.keys.clear();
      state.stayDown = false;
    });

    window.addEventListener("resize", resize);
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  function cacheDom() {
    dom.canvas = $("#sky");
    ctx = dom.canvas.getContext("2d");
    dom.hud = $("#hud");
    dom.lightsCount = $("#lightsCount");
    dom.dots = $("#dots");
    dom.hint = $("#hint");
    dom.stayBtn = $("#stayBtn");
    dom.stayLabel = $("#stayLabel");
    dom.toast = $("#toast");
    dom.start = $("#start");
    dom.startBtn = $("#startBtn");
    dom.card = $("#card");
    dom.cardKicker = $("#cardKicker");
    dom.cardLine = $("#cardLine");
    dom.cardObject = $("#cardObject");
    dom.cardGlyph = $("#cardGlyph");
    dom.cardBtn = $("#cardBtn");
    dom.end = $("#end");
    dom.endList = $("#endList");
    dom.restartBtn = $("#restartBtn");
  }

  function loop(now) {
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    window.requestAnimationFrame(loop);
  }

  function init() {
    cacheDom();
    resize();
    bindInput();
    updateScore();
    updateUI();
    window.requestAnimationFrame(loop);

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.has("play")) {
      window.setTimeout(startGame, 100);
    }
    if (hash.has("near")) {
      const s = stationById(hash.get("near"));
      if (s) {
        state.phase = "roam";
        dom.start.hidden = true;
        state.player = { x: s.x + 20, y: s.y + 20 };
        state.near = s;
      }
    }
    if (hash.has("card")) {
      const s = stationById(hash.get("card"));
      if (s) {
        dom.start.hidden = true;
        state.phase = "roam";
        state.player = { x: s.x + 20, y: s.y + 20 };
        state.collected.push(s.id);
        showCard(s);
        updateScore();
      }
    }
    if (hash.has("end")) {
      dom.start.hidden = true;
      state.collected = ["kitchen", "chair", "tree"];
      updateScore();
      endGame();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
