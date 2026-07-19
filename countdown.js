(function() {
    'use strict';

    /* ─── Inject full-page countdown overlay ─── */
    const overlay = document.createElement('div');
    overlay.id = 'global-countdown-overlay';
    overlay.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100%',
        'height: 100%',
        'z-index: 2147483647',
        'background: #0a0a0f',
        'font-family: "Rajdhani", sans-serif',
        'overflow-y: auto'
    ].map(s => s + ';').join('');

    /* ─── Inject styles ─── */
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;500;700&display=swap');

#global-countdown-overlay * {
    margin: 0; padding: 0; box-sizing: border-box;
}
.cdo-bg-grid {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%;
    background-image:
        linear-gradient(rgba(255,215,0,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,215,0,0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    animation: cdoGridPulse 6s ease-in-out infinite;
    pointer-events: none;
}
@keyframes cdoGridPulse { 0%,100%{opacity:.3} 50%{opacity:.7} }

.cdo-orbs {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%;
    overflow: hidden; pointer-events: none;
}
.cdo-orb {
    position: absolute; border-radius: 50%;
    filter: blur(80px);
    animation: cdoOrbFloat 20s ease-in-out infinite;
}
.cdo-orb:nth-child(1) {
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(255,215,0,0.12), transparent);
    top: -10%; left: -10%;
}
.cdo-orb:nth-child(2) {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(255,100,50,0.10), transparent);
    bottom: -10%; right: -10%; animation-delay: -7s;
}
.cdo-orb:nth-child(3) {
    width: 350px; height: 350px;
    background: radial-gradient(circle, rgba(100,200,255,0.08), transparent);
    top: 50%; left: 50%; transform: translate(-50%,-50%); animation-delay: -14s;
}
@keyframes cdoOrbFloat {
    0%,100%{transform:translate(0,0) scale(1)}
    33%{transform:translate(40px,-30px) scale(1.1)}
    66%{transform:translate(-20px,40px) scale(0.9)}
}
.cdo-scan {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 2px;
    background: linear-gradient(90deg, transparent, rgba(255,215,0,0.6), transparent);
    animation: cdoScan 4s linear infinite;
    box-shadow: 0 0 20px rgba(255,215,0,0.3);
    pointer-events: none;
}
@keyframes cdoScan { 0%{top:-2px;opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{top:100%;opacity:0} }
.cdo-particles {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none; overflow: hidden;
}
.cdo-particle {
    position: absolute; width: 3px; height: 3px;
    background: #ffd700; border-radius: 50%;
    opacity: 0;
    animation: cdoParticle 6s ease-in-out infinite;
    box-shadow: 0 0 6px #ffd700;
}
.cdo-particle:nth-child(1){left:10%}
.cdo-particle:nth-child(2){left:20%;animation-delay:1.2s;width:2px;height:2px}
.cdo-particle:nth-child(3){left:35%;animation-delay:2.4s}
.cdo-particle:nth-child(4){left:50%;animation-delay:.6s;width:4px;height:4px}
.cdo-particle:nth-child(5){left:65%;animation-delay:1.8s}
.cdo-particle:nth-child(6){left:75%;animation-delay:3s;width:2px;height:2px}
.cdo-particle:nth-child(7){left:85%;animation-delay:.3s}
.cdo-particle:nth-child(8){left:95%;animation-delay:1.5s}
.cdo-particle:nth-child(9){left:45%;animation-delay:2.1s}
.cdo-particle:nth-child(10){left:5%;animation-delay:3.6s;width:2px;height:2px}
@keyframes cdoParticle {
    0%{transform:translateY(100vh) scale(0);opacity:0}
    20%{opacity:.8}
    80%{opacity:.6}
    100%{transform:translateY(-10vh) scale(1);opacity:0}
}
.cdo-container {
    position: relative; z-index: 2;
    text-align: center;
    padding: 40px 30px;
    max-width: 850px; width: 100%;
}
.cdo-badge {
    display: inline-flex; align-items: center; gap: 10px;
    background: rgba(255,215,0,0.08);
    border: 1px solid rgba(255,215,0,0.2);
    border-radius: 100px; padding: 8px 24px 8px 18px;
    margin-bottom: 30px;
    font-size: 13px; letter-spacing: 3px;
    text-transform: uppercase; color: rgba(255,215,0,0.7);
    animation: cdoBadgePulse 3s ease-in-out infinite;
}
.cdo-badge .cdo-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #ffd700;
    animation: cdoBlink 1.4s ease-in-out infinite;
    box-shadow: 0 0 10px #ffd700;
}
@keyframes cdoBlink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.8)} }
@keyframes cdoBadgePulse { 0%,100%{border-color:rgba(255,215,0,0.2)} 50%{border-color:rgba(255,215,0,0.5)} }
.cdo-title {
    font-family: 'Orbitron', monospace;
    font-size: clamp(28px,5vw,56px); font-weight: 900;
    text-transform: uppercase;
    background: linear-gradient(135deg, #ffd700 0%, #ff6b35 50%, #ffd700 100%);
    background-size: 200% 200%;
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: cdoShimmer 3s ease-in-out infinite;
    margin-bottom: 8px; line-height: 1.2;
}
@keyframes cdoShimmer { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
.cdo-subtitle {
    font-size: clamp(14px,2vw,20px);
    color: rgba(255,255,255,0.4);
    letter-spacing: 6px; text-transform: uppercase;
    margin-bottom: 50px; font-weight: 300;
}
.cdo-subtitle span { color: rgba(255,215,0,0.6); }
.cdo-timer {
    display: flex; justify-content: center;
    gap: clamp(12px,3vw,30px); flex-wrap: wrap;
}
.cdo-unit { display: flex; flex-direction: column; align-items: center; }
.cdo-tile {
    position: relative;
    width: clamp(80px,14vw,160px);
    height: clamp(90px,16vw,170px);
    background: linear-gradient(180deg, rgba(20,20,30,0.9), rgba(10,10,18,0.95) 50%, rgba(5,5,12,1));
    border: 1px solid rgba(255,215,0,0.15); border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,215,0,0.1);
    transition: border-color .3s, box-shadow .3s;
}
.cdo-tile:hover {
    border-color: rgba(255,215,0,0.4);
    box-shadow: 0 8px 40px rgba(0,0,0,0.8), 0 0 30px rgba(255,215,0,0.05), inset 0 1px 0 rgba(255,215,0,0.2);
}
.cdo-tile::before {
    content: ''; position: absolute;
    top: 50%; left: 0; right: 0; height: 1px;
    background: rgba(255,215,0,0.06);
}
.cdo-tile::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,215,0,0.03), transparent 40%, transparent 60%, rgba(255,215,0,0.03));
    border-radius: 16px; pointer-events: none;
}
.cdo-number {
    font-family: 'Orbitron', monospace;
    font-size: clamp(38px,8vw,82px); font-weight: 900;
    color: #fff;
    text-shadow: 0 0 20px rgba(255,215,0,0.15), 0 0 60px rgba(255,215,0,0.05);
    line-height: 1; position: relative; z-index: 1;
}
.cdo-label {
    font-size: clamp(11px,1.2vw,14px); letter-spacing: 4px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3); margin-top: 14px; font-weight: 500;
}
.cdo-sep {
    font-family: 'Orbitron', monospace;
    font-size: clamp(30px,6vw,64px); font-weight: 900;
    color: rgba(255,215,0,0.3);
    align-self: center; padding-bottom: 28px;
    animation: cdoSepPulse 1s ease-in-out infinite;
    user-select: none;
}
@keyframes cdoSepPulse { 0%,100%{opacity:.3} 50%{opacity:.7} }
.cdo-flip {
    animation: cdoFlipIn .4s cubic-bezier(.34,1.56,.64,1) forwards;
}
@keyframes cdoFlipIn {
    0%{transform:rotateX(90deg) scale(.8);opacity:.3}
    100%{transform:rotateX(0deg) scale(1);opacity:1}
}
.cdo-progress-wrap { margin: 35px auto 0; max-width: 500px; }
.cdo-progress-bar {
    width: 100%; height: 3px;
    background: rgba(255,255,255,0.06);
    border-radius: 10px; overflow: hidden;
}
.cdo-progress-fill {
    height: 100%; width: 0%;
    background: linear-gradient(90deg, #ff6b35, #ffd700);
    border-radius: 10px; transition: width .5s ease;
    box-shadow: 0 0 12px rgba(255,215,0,0.3);
}
.cdo-progress-label {
    display: flex; justify-content: space-between;
    margin-top: 8px;
    font-size: 11px; letter-spacing: 2px;
    color: rgba(255,255,255,0.2); text-transform: uppercase;
}
.cdo-bottom { margin-top: 50px; }
.cdo-bottom p {
    font-size: clamp(13px,1.5vw,17px);
    color: rgba(255,255,255,0.25); letter-spacing: 2px;
}
.cdo-bottom .cdo-highlight { color: rgba(255,215,0,0.7); font-weight: 700; }

/* ── Hype Button ── */
.cdo-hype-wrap {
    margin-top: 40px;
    display: flex; flex-direction: column;
    align-items: center; gap: 10px;
}
.cdo-hype-btn {
    display: inline-flex; align-items: center; gap: 12px;
    position: relative;
    background: linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,107,53,0.12));
    border: 1px solid rgba(255,215,0,0.25);
    border-radius: 60px; padding: 14px 36px;
    cursor: pointer;
    font-family: 'Orbitron', monospace;
    font-size: clamp(16px,2vw,22px); font-weight: 700;
    color: #ffd700;
    transition: all .3s ease;
    box-shadow: 0 0 20px rgba(255,215,0,0.05);
    user-select: none; -webkit-tap-highlight-color: transparent;
}
.cdo-hype-btn:hover {
    background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,107,53,0.2));
    border-color: rgba(255,215,0,0.5);
    box-shadow: 0 0 40px rgba(255,215,0,0.15);
    transform: scale(1.05);
}
.cdo-hype-btn:active { transform: scale(0.95); }
.cdo-hype-btn .cdo-fire {
    font-size: clamp(20px,2.5vw,28px);
    transition: transform .2s ease;
}
.cdo-hype-btn:hover .cdo-fire { transform: scale(1.3) rotate(-10deg); }
.cdo-hype-count {
    font-family: 'Orbitron', monospace;
    font-size: clamp(14px,1.8vw,20px); font-weight: 700;
    color: #fff;
    min-width: 30px; text-align: center;
}
.cdo-hype-label {
    font-size: 12px; letter-spacing: 3px;
    text-transform: uppercase; color: rgba(255,255,255,0.2);
}
.cdo-hype-burst {
    animation: cdoBurst .6s cubic-bezier(.34,1.56,.64,1) forwards;
}
@keyframes cdoBurst { 0%{transform:scale(1)} 30%{transform:scale(1.3)} 100%{transform:scale(1)} }
.cdo-spark {
    position: absolute; pointer-events: none;
    width: 6px; height: 6px;
    border-radius: 50%; background: #ffd700;
    opacity: 0;
}
.cdo-spark.fly {
    animation: cdoSparkFly .8s ease-out forwards;
}
@keyframes cdoSparkFly {
    0%{opacity:1;transform:translate(0,0) scale(1)}
    100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0)}
}
@media (max-width: 600px) {
    .cdo-container { padding: 30px 16px; }
    .cdo-sep { padding-bottom: 22px; }
    .cdo-tile { width: clamp(68px,20vw,90px); height: clamp(78px,22vw,100px); border-radius: 12px; }
    .cdo-number { font-size: clamp(30px,12vw,44px); }
    .cdo-badge { font-size: 11px; padding: 6px 16px 6px 12px; }
    .cdo-hype-btn { padding: 12px 24px; }
}
`;
        document.head.appendChild(style);
    }
    injectStyles();

    /* ─── Build HTML ─── */
    overlay.innerHTML = [
        '<div class="cdo-bg-grid"></div>',
        '<div class="cdo-orbs"><div class="cdo-orb"></div><div class="cdo-orb"></div><div class="cdo-orb"></div></div>',
        '<div class="cdo-scan"></div>',
        '<div class="cdo-particles">' + '<div class="cdo-particle"></div>'.repeat(10) + '</div>',
        '<div class="cdo-container">',
            '<div class="cdo-badge"><span class="cdo-dot"></span><span>Launch countdown</span></div>',
            '<div class="cdo-title">Something Epic Is Coming</div>',
            '<div class="cdo-subtitle">We\'re launching in <span>just around the corner</span></div>',
            '<div class="cdo-timer">',
                '<div class="cdo-unit"><div class="cdo-tile"><span class="cdo-number" id="cdo-days">00</span></div><span class="cdo-label">Days</span></div>',
                '<span class="cdo-sep">:</span>',
                '<div class="cdo-unit"><div class="cdo-tile"><span class="cdo-number" id="cdo-hours">00</span></div><span class="cdo-label">Hours</span></div>',
                '<span class="cdo-sep">:</span>',
                '<div class="cdo-unit"><div class="cdo-tile"><span class="cdo-number" id="cdo-minutes">00</span></div><span class="cdo-label">Minutes</span></div>',
                '<span class="cdo-sep">:</span>',
                '<div class="cdo-unit"><div class="cdo-tile"><span class="cdo-number" id="cdo-seconds">00</span></div><span class="cdo-label">Seconds</span></div>',
            '</div>',
            '<div class="cdo-progress-wrap">',
                '<div class="cdo-progress-bar"><div class="cdo-progress-fill" id="cdo-progressFill"></div></div>',
                '<div class="cdo-progress-label"><span>Preparing launch</span><span id="cdo-progressPct">0%</span></div>',
            '</div>',
            '<div class="cdo-bottom"><p>🚀 &nbsp; Get ready &nbsp; · &nbsp; <span class="cdo-highlight">#HYPED</span> &nbsp; · &nbsp; Stay tuned</p></div>',
            /* ── HYPE BUTTON ── */
            '<div class="cdo-hype-wrap">',
                '<button class="cdo-hype-btn" id="cdo-hypeBtn">',
                    '<span class="cdo-fire">🔥</span>',
                    '<span>HYPE</span>',
                    '<span class="cdo-hype-count" id="cdo-hypeCount">0</span>',
                '</button>',
                '<div class="cdo-hype-label">Click if you\'re hyped!</div>',
            '</div>',
        '</div>'
    ].join('');

    document.body.appendChild(overlay);

    /* ─── Countdown timer ─── */
    const COUNTDOWN_KEY = 'epic_launch_countdown_start';
    let startTime = localStorage.getItem(COUNTDOWN_KEY);
    if (!startTime) {
        startTime = Date.now();
        try { localStorage.setItem(COUNTDOWN_KEY, startTime); } catch(e) {}
    } else {
        startTime = parseInt(startTime, 10);
    }

    const TOTAL_DURATION = 2 * 24 * 60 * 60 * 1000;
    const endTime = startTime + TOTAL_DURATION;

    const daysEl    = document.getElementById('cdo-days');
    const hoursEl   = document.getElementById('cdo-hours');
    const minutesEl = document.getElementById('cdo-minutes');
    const secondsEl = document.getElementById('cdo-seconds');
    const fillBar   = document.getElementById('cdo-progressFill');
    const pctEl     = document.getElementById('cdo-progressPct');

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
        minutesEl.textContent = pad(m);
        secondsEl.textContent = pad(s);

        if (prev.d !== -1) {
            if (d !== prev.d) daysEl.classList.remove('cdo-flip');
            if (h !== prev.h) hoursEl.classList.remove('cdo-flip');
            if (m !== prev.m) minutesEl.classList.remove('cdo-flip');
            if (s !== prev.s) secondsEl.classList.remove('cdo-flip');
            void daysEl.offsetWidth;
            if (d !== prev.d) daysEl.classList.add('cdo-flip');
            if (h !== prev.h) hoursEl.classList.add('cdo-flip');
            if (m !== prev.m) minutesEl.classList.add('cdo-flip');
            if (s !== prev.s) secondsEl.classList.add('cdo-flip');
        }
        prev = { d, h, m, s };

        const elapsed = now - startTime;
        let pct = (elapsed / TOTAL_DURATION) * 100;
        if (pct > 100) pct = 100;
        fillBar.style.width = pct + '%';
        pctEl.textContent = Math.round(pct) + '%';
    }

    tick();
    setInterval(tick, 1000);

    /* ─── HYPE BUTTON LOGIC ─── */
    const HYPE_KEY = 'cdo_hype_count';
    const hypeBtn = document.getElementById('cdo-hypeBtn');
    const hypeCountEl = document.getElementById('cdo-hypeCount');

    function getHypeCount() {
        try {
            return parseInt(localStorage.getItem(HYPE_KEY), 10) || 0;
        } catch(e) { return 0; }
    }

    function setHypeCount(n) {
        try { localStorage.setItem(HYPE_KEY, n); } catch(e) {}
    }

    // Init
    hypeCountEl.textContent = getHypeCount();

    // Click handler
    hypeBtn.addEventListener('click', function(e) {
        let count = getHypeCount();
        count++;
        setHypeCount(count);
        hypeCountEl.textContent = count;

        // Burst animation
        hypeBtn.classList.remove('cdo-hype-burst');
        void hypeBtn.offsetWidth;
        hypeBtn.classList.add('cdo-hype-burst');

        // Sparks
        const rect = hypeBtn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        for (let i = 0; i < 8; i++) {
            const spark = document.createElement('div');
            spark.className = 'cdo-spark';
            const angle = (i / 8) * Math.PI * 2;
            const dist = 60 + Math.random() * 40;
            spark.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
            spark.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
            spark.style.left = cx + 'px';
            spark.style.top = cy + 'px';
            document.body.appendChild(spark);
            void spark.offsetWidth;
            spark.classList.add('fly');
            setTimeout(() => spark.remove(), 800);
        }

        // Subtle haptic feedback (mobile)
        if (navigator.vibrate) navigator.vibrate(15);
    });
})();