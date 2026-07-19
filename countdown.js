/**
 * countdown.js — Global epic launch countdown overlay
 * Injects a stunning full-page countdown on every page that uses it.
 * Countdown persists through refreshes via localStorage (2 days from first visit).
 */
(function () {
  'use strict';

  const COUNTDOWN_KEY = 'epic_launch_countdown_start';
  const DISMISSED_KEY = 'epic_launch_countdown_dismissed';
  const TOTAL_DURATION = 2 * 24 * 60 * 60 * 1000; // 2 days

  // ── If user dismissed or countdown expired, don't show ──
  const dismissed = localStorage.getItem(DISMISSED_KEY) === 'true';
  let startTime = localStorage.getItem(COUNTDOWN_KEY);
  if (!startTime) {
    startTime = Date.now();
    localStorage.setItem(COUNTDOWN_KEY, startTime);
  } else {
    startTime = parseInt(startTime, 10);
  }
  const endTime = startTime + TOTAL_DURATION;
  const expired = Date.now() >= endTime;

  if (dismissed || expired) return;

  // ── Inject styles ──
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;500;700&display=swap');

    #epic-countdown-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100vh;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a0f;
      font-family: 'Rajdhani', sans-serif;
      overflow: hidden;
      animation: overlayFadeIn 0.6s ease;
    }
    @keyframes overlayFadeIn {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }

    #epic-countdown-overlay * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* ── Animated Background ── */
    #epic-countdown-overlay .ec-bg-grid {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background-image:
        linear-gradient(rgba(255, 215, 0, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 215, 0, 0.03) 1px, transparent 1px);
      background-size: 60px 60px;
      z-index: 0;
      animation: ecGridPulse 6s ease-in-out infinite;
    }
    @keyframes ecGridPulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.7; }
    }

    #epic-countdown-overlay .ec-orbs {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;
    }
    #epic-countdown-overlay .ec-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      animation: ecOrbFloat 20s ease-in-out infinite;
      pointer-events: none;
    }
    #epic-countdown-overlay .ec-orb:nth-child(1) {
      width: 500px; height: 500px;
      background: radial-gradient(circle, rgba(255,215,0,0.12), transparent);
      top: -10%; left: -10%;
      animation-delay: 0s;
    }
    #epic-countdown-overlay .ec-orb:nth-child(2) {
      width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(255,100,50,0.10), transparent);
      bottom: -10%; right: -10%;
      animation-delay: -7s;
    }
    #epic-countdown-overlay .ec-orb:nth-child(3) {
      width: 350px; height: 350px;
      background: radial-gradient(circle, rgba(100,200,255,0.08), transparent);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      animation-delay: -14s;
    }
    @keyframes ecOrbFloat {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(40px, -30px) scale(1.1); }
      66% { transform: translate(-20px, 40px) scale(0.9); }
    }

    /* ── Scanning line ── */
    #epic-countdown-overlay .ec-scan {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(255,215,0,0.6), transparent);
      z-index: 1;
      animation: ecScanDown 4s linear infinite;
      box-shadow: 0 0 20px rgba(255,215,0,0.3);
    }
    @keyframes ecScanDown {
      0% { top: -2px; opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { top: 100%; opacity: 0; }
    }

    /* ── Particles ── */
    #epic-countdown-overlay .ec-particles {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 1;
      pointer-events: none;
      overflow: hidden;
    }
    #epic-countdown-overlay .ec-particle {
      position: absolute;
      width: 3px; height: 3px;
      background: #ffd700;
      border-radius: 50%;
      opacity: 0;
      animation: ecParticleFloat 6s ease-in-out infinite;
      box-shadow: 0 0 6px #ffd700;
    }
    #epic-countdown-overlay .ec-particle:nth-child(1) { left: 10%; animation-delay: 0s; }
    #epic-countdown-overlay .ec-particle:nth-child(2) { left: 20%; animation-delay: 1.2s; width: 2px; height: 2px; }
    #epic-countdown-overlay .ec-particle:nth-child(3) { left: 35%; animation-delay: 2.4s; }
    #epic-countdown-overlay .ec-particle:nth-child(4) { left: 50%; animation-delay: 0.6s; width: 4px; height: 4px; }
    #epic-countdown-overlay .ec-particle:nth-child(5) { left: 65%; animation-delay: 1.8s; }
    #epic-countdown-overlay .ec-particle:nth-child(6) { left: 75%; animation-delay: 3.0s; width: 2px; height: 2px; }
    #epic-countdown-overlay .ec-particle:nth-child(7) { left: 85%; animation-delay: 0.3s; }
    #epic-countdown-overlay .ec-particle:nth-child(8) { left: 95%; animation-delay: 1.5s; }
    #epic-countdown-overlay .ec-particle:nth-child(9) { left: 45%; animation-delay: 2.1s; }
    #epic-countdown-overlay .ec-particle:nth-child(10) { left: 5%; animation-delay: 3.6s; width: 2px; height: 2px; }
    @keyframes ecParticleFloat {
      0% { transform: translateY(100vh) scale(0); opacity: 0; }
      20% { opacity: 0.8; }
      80% { opacity: 0.6; }
      100% { transform: translateY(-10vh) scale(1); opacity: 0; }
    }

    /* ── Container ── */
    #epic-countdown-overlay .ec-container {
      position: relative;
      z-index: 2;
      text-align: center;
      padding: 40px 30px;
      max-width: 850px;
      width: 100%;
    }

    /* ── Badge ── */
    #epic-countdown-overlay .ec-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: rgba(255,215,0,0.08);
      border: 1px solid rgba(255,215,0,0.2);
      border-radius: 100px;
      padding: 8px 24px 8px 18px;
      margin-bottom: 30px;
      font-size: 13px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: rgba(255,215,0,0.7);
      animation: ecBadgePulse 3s ease-in-out infinite;
    }
    #epic-countdown-overlay .ec-badge .ec-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #ffd700;
      animation: ecDotBlink 1.4s ease-in-out infinite;
      box-shadow: 0 0 10px #ffd700;
    }
    @keyframes ecDotBlink {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(0.8); }
    }
    @keyframes ecBadgePulse {
      0%, 100% { border-color: rgba(255,215,0,0.2); }
      50% { border-color: rgba(255,215,0,0.5); }
    }

    /* ── Title ── */
    #epic-countdown-overlay .ec-title {
      font-family: 'Orbitron', monospace;
      font-size: clamp(28px, 5vw, 56px);
      font-weight: 900;
      text-transform: uppercase;
      background: linear-gradient(135deg, #ffd700 0%, #ff6b35 50%, #ffd700 100%);
      background-size: 200% 200%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: ecShimmer 3s ease-in-out infinite;
      margin-bottom: 8px;
      line-height: 1.2;
    }
    @keyframes ecShimmer {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    #epic-countdown-overlay .ec-subtitle {
      font-size: clamp(14px, 2vw, 20px);
      color: rgba(255,255,255,0.4);
      letter-spacing: 6px;
      text-transform: uppercase;
      margin-bottom: 50px;
      font-weight: 300;
    }
    #epic-countdown-overlay .ec-subtitle span {
      color: rgba(255,215,0,0.6);
    }

    /* ── Timer ── */
    #epic-countdown-overlay .ec-timer {
      display: flex;
      justify-content: center;
      gap: clamp(12px, 3vw, 30px);
      flex-wrap: wrap;
    }
    #epic-countdown-overlay .ec-tunit {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    #epic-countdown-overlay .ec-tile {
      position: relative;
      width: clamp(80px, 14vw, 160px);
      height: clamp(90px, 16vw, 170px);
      background: linear-gradient(180deg, rgba(20,20,30,0.9) 0%, rgba(10,10,18,0.95) 50%, rgba(5,5,12,1) 100%);
      border: 1px solid rgba(255,215,0,0.15);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,215,0,0.1);
      transition: border-color 0.3s, box-shadow 0.3s;
    }
    #epic-countdown-overlay .ec-tile:hover {
      border-color: rgba(255,215,0,0.4);
      box-shadow: 0 8px 40px rgba(0,0,0,0.8), 0 0 30px rgba(255,215,0,0.05), inset 0 1px 0 rgba(255,215,0,0.2);
    }
    #epic-countdown-overlay .ec-tile-num {
      font-family: 'Orbitron', monospace;
      font-size: clamp(38px, 8vw, 82px);
      font-weight: 900;
      color: #fff;
      text-shadow: 0 0 20px rgba(255,215,0,0.15), 0 0 60px rgba(255,215,0,0.05);
      line-height: 1;
      z-index: 1;
    }
    #epic-countdown-overlay .ec-tile::before {
      content: '';
      position: absolute;
      top: 50%; left: 0; right: 0;
      height: 1px;
      background: rgba(255,215,0,0.06);
    }
    #epic-countdown-overlay .ec-tile::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(180deg, rgba(255,215,0,0.03) 0%, transparent 40%, transparent 60%, rgba(255,215,0,0.03) 100%);
      border-radius: 16px;
      pointer-events: none;
    }
    #epic-countdown-overlay .ec-tlabel {
      font-size: clamp(11px, 1.2vw, 14px);
      letter-spacing: 4px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.3);
      margin-top: 14px;
      font-weight: 500;
    }
    #epic-countdown-overlay .ec-sep {
      font-family: 'Orbitron', monospace;
      font-size: clamp(30px, 6vw, 64px);
      font-weight: 900;
      color: rgba(255,215,0,0.3);
      align-self: center;
      padding-bottom: 28px;
      animation: ecSepPulse 1s ease-in-out infinite;
      user-select: none;
    }
    @keyframes ecSepPulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.7; }
    }

    /* ── Flip ── */
    #epic-countdown-overlay .ec-flip {
      animation: ecFlipIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    @keyframes ecFlipIn {
      0% { transform: rotateX(90deg) scale(0.8); opacity: 0.3; }
      100% { transform: rotateX(0deg) scale(1); opacity: 1; }
    }

    /* ── Progress ── */
    #epic-countdown-overlay .ec-progress-wrap {
      margin-top: 35px;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }
    #epic-countdown-overlay .ec-progress-bar {
      width: 100%; height: 3px;
      background: rgba(255,255,255,0.06);
      border-radius: 10px;
      overflow: hidden;
    }
    #epic-countdown-overlay .ec-progress-fill {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, #ff6b35, #ffd700);
      border-radius: 10px;
      transition: width 0.5s ease;
      box-shadow: 0 0 12px rgba(255,215,0,0.3);
    }
    #epic-countdown-overlay .ec-progress-label {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 11px;
      letter-spacing: 2px;
      color: rgba(255,255,255,0.2);
      text-transform: uppercase;
    }

    /* ── Bottom ── */
    #epic-countdown-overlay .ec-bottom {
      margin-top: 50px;
    }
    #epic-countdown-overlay .ec-bottom p {
      font-size: clamp(13px, 1.5vw, 17px);
      color: rgba(255,255,255,0.25);
      letter-spacing: 2px;
    }
    #epic-countdown-overlay .ec-bottom .ec-highlight {
      color: rgba(255,215,0,0.7);
      font-weight: 700;
      letter-spacing: 1px;
    }

    /* ── Dismiss button ── */
    #epic-countdown-overlay .ec-dismiss {
      position: fixed;
      top: 18px;
      right: 22px;
      z-index: 10;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.4);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 18px;
      font-family: 'Rajdhani', sans-serif;
      transition: background 0.2s, color 0.2s, border-color 0.2s;
      line-height: 1;
    }
    #epic-countdown-overlay .ec-dismiss:hover {
      background: rgba(255,215,0,0.12);
      color: #ffd700;
      border-color: rgba(255,215,0,0.3);
    }

    /* responsive */
    @media (max-width: 600px) {
      #epic-countdown-overlay .ec-container { padding: 30px 16px; }
      #epic-countdown-overlay .ec-sep { padding-bottom: 22px; }
      #epic-countdown-overlay .ec-tile { width: clamp(68px, 20vw, 90px); height: clamp(78px, 22vw, 100px); border-radius: 12px; }
      #epic-countdown-overlay .ec-tile-num { font-size: clamp(30px, 12vw, 44px); }
      #epic-countdown-overlay .ec-badge { font-size: 11px; padding: 6px 16px 6px 12px; }
    }
  `;
  document.head.appendChild(style);

  // ── Create overlay ──
  const overlay = document.createElement('div');
  overlay.id = 'epic-countdown-overlay';
  overlay.innerHTML = `
    <div class="ec-bg-grid"></div>
    <div class="ec-orbs">
      <div class="ec-orb"></div>
      <div class="ec-orb"></div>
      <div class="ec-orb"></div>
    </div>
    <div class="ec-scan"></div>
    <div class="ec-particles">
      <div class="ec-particle"></div><div class="ec-particle"></div><div class="ec-particle"></div>
      <div class="ec-particle"></div><div class="ec-particle"></div><div class="ec-particle"></div>
      <div class="ec-particle"></div><div class="ec-particle"></div><div class="ec-particle"></div>
      <div class="ec-particle"></div>
    </div>
    <button class="ec-dismiss" id="ecDismiss" aria-label="Dismiss countdown">✕</button>
    <div class="ec-container">
      <div class="ec-badge"><span class="ec-dot"></span><span>Launch countdown</span></div>
      <h1 class="ec-title">Something Epic Is Coming</h1>
      <p class="ec-subtitle">We're launching in <span>just around the corner</span></p>
      <div class="ec-timer" id="ecTimer">
        <div class="ec-tunit"><div class="ec-tile"><span class="ec-tile-num" id="ecDays">00</span></div><span class="ec-tlabel">Days</span></div>
        <span class="ec-sep">:</span>
        <div class="ec-tunit"><div class="ec-tile"><span class="ec-tile-num" id="ecHours">00</span></div><span class="ec-tlabel">Hours</span></div>
        <span class="ec-sep">:</span>
        <div class="ec-tunit"><div class="ec-tile"><span class="ec-tile-num" id="ecMins">00</span></div><span class="ec-tlabel">Minutes</span></div>
        <span class="ec-sep">:</span>
        <div class="ec-tunit"><div class="ec-tile"><span class="ec-tile-num" id="ecSecs">00</span></div><span class="ec-tlabel">Seconds</span></div>
      </div>
      <div class="ec-progress-wrap">
        <div class="ec-progress-bar"><div class="ec-progress-fill" id="ecProgressFill"></div></div>
        <div class="ec-progress-label"><span>Preparing launch</span><span id="ecProgressPct">0%</span></div>
      </div>
      <div class="ec-bottom"><p>🚀 &nbsp; Get ready &nbsp; · &nbsp; <span class="ec-highlight">#HYPED</span> &nbsp; · &nbsp; Stay tuned</p></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // ── Dismiss ──
  document.getElementById('ecDismiss').addEventListener('click', function () {
    localStorage.setItem(DISMISSED_KEY, 'true');
    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.opacity = '0';
    setTimeout(function () { overlay.remove(); }, 500);
  });

  // ── Countdown logic ──
  const daysEl = document.getElementById('ecDays');
  const hoursEl = document.getElementById('ecHours');
  const minsEl = document.getElementById('ecMins');
  const secsEl = document.getElementById('ecSecs');
  const fillBar = document.getElementById('ecProgressFill');
  const pctEl = document.getElementById('ecProgressPct');

  let prev = { d: -1, h: -1, m: -1, s: -1 };

  function pad(n) { return String(n).padStart(2, '0'); }

  function tick() {
    const now = Date.now();
    let diff = endTime - now;
    if (diff < 0) diff = 0;

    const totalSec = Math.floor(diff / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    daysEl.textContent = pad(d);
    hoursEl.textContent = pad(h);
    minsEl.textContent = pad(m);
    secsEl.textContent = pad(s);

    // Flip trigger
    if (prev.d !== -1) {
      [daysEl, hoursEl, minsEl, secsEl].forEach(function(el) { el.classList.remove('ec-flip'); });
      void daysEl.offsetWidth;
      if (d !== prev.d) daysEl.classList.add('ec-flip');
      if (h !== prev.h) hoursEl.classList.add('ec-flip');
      if (m !== prev.m) minsEl.classList.add('ec-flip');
      if (s !== prev.s) secsEl.classList.add('ec-flip');
    }
    prev = { d: d, h: h, m: m, s: s };

    // Progress
    const elapsed = now - startTime;
    let pct = (elapsed / TOTAL_DURATION) * 100;
    if (pct > 100) pct = 100;
    fillBar.style.width = pct + '%';
    pctEl.textContent = Math.round(pct) + '%';
  }

  tick();
  setInterval(tick, 1000);
})();