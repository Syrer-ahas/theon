(function() {
    'use strict';

    /* ─── Check if released ─── */
    try {
        if (localStorage.getItem('cdo_released') === 'true') return;
    } catch(e) {}

    /* ─── Already injected? ─── */
    if (document.getElementById('countdown-section')) return;

    /* ─── Load blocker.js dynamically ─── */
    var blockerScript = document.createElement('script');
    blockerScript.src = 'blocker.js';
    blockerScript.async = false;
    document.head.appendChild(blockerScript);

    /* ─── Inject styles ─── */
    const style = document.createElement('style');
    style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;500;700&display=swap');

/* ─── Block all clicks below the countdown ─── */
#countdown-blocker {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 999998;
    background: transparent;
    pointer-events: none;
}
#countdown-section {
    position: relative;
    width: 100%;
    background: #0a0a0f;
    overflow: hidden;
    font-family: 'Rajdhani', sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}
#countdown-section * { margin: 0; padding: 0; box-sizing: border-box; }

.cs-bg-grid {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%;
    background-image:
        linear-gradient(rgba(255,215,0,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,215,0,0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    animation: csGrid 6s ease-in-out infinite;
    pointer-events: none;
}
@keyframes csGrid { 0%,100%{opacity:.3} 50%{opacity:.7} }

.cs-orbs {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    overflow: hidden; pointer-events: none;
}
.cs-orb {
    position: absolute; border-radius: 50%;
    filter: blur(80px);
    animation: csFloat 20s ease-in-out infinite;
}
.cs-orb:nth-child(1) {
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(255,215,0,0.12), transparent);
    top: -10%; left: -10%;
}
.cs-orb:nth-child(2) {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(255,100,50,0.10), transparent);
    bottom: -10%; right: -10%; animation-delay: -7s;
}
.cs-orb:nth-child(3) {
    width: 350px; height: 350px;
    background: radial-gradient(circle, rgba(100,200,255,0.08), transparent);
    top: 50%; left: 50%; transform: translate(-50%,-50%); animation-delay: -14s;
}
@keyframes csFloat {
    0%,100%{transform:translate(0,0) scale(1)}
    33%{transform:translate(40px,-30px) scale(1.1)}
    66%{transform:translate(-20px,40px) scale(0.9)}
}
.cs-scan {
    position: absolute; top: 0; left: 0; width: 100%; height: 2px;
    background: linear-gradient(90deg, transparent, rgba(255,215,0,0.6), transparent);
    animation: csScan 4s linear infinite;
    box-shadow: 0 0 20px rgba(255,215,0,0.3);
    pointer-events: none;
}
@keyframes csScan { 0%{top:-2px;opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{top:100%;opacity:0} }
.cs-particles {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none; overflow: hidden;
}
.cs-particle {
    position: absolute; width: 3px; height: 3px;
    background: #ffd700; border-radius: 50%;
    opacity: 0;
    animation: csPart 6s ease-in-out infinite;
    box-shadow: 0 0 6px #ffd700;
}
.cs-particle:nth-child(1){left:10%}
.cs-particle:nth-child(2){left:20%;animation-delay:1.2s;width:2px;height:2px}
.cs-particle:nth-child(3){left:35%;animation-delay:2.4s}
.cs-particle:nth-child(4){left:50%;animation-delay:.6s;width:4px;height:4px}
.cs-particle:nth-child(5){left:65%;animation-delay:1.8s}
.cs-particle:nth-child(6){left:75%;animation-delay:3s;width:2px;height:2px}
.cs-particle:nth-child(7){left:85%;animation-delay:.3s}
.cs-particle:nth-child(8){left:95%;animation-delay:1.5s}
.cs-particle:nth-child(9){left:45%;animation-delay:2.1s}
.cs-particle:nth-child(10){left:5%;animation-delay:3.6s;width:2px;height:2px}
@keyframes csPart {
    0%{transform:translateY(100vh) scale(0);opacity:0}
    20%{opacity:.8}
    80%{opacity:.6}
    100%{transform:translateY(-10vh) scale(1);opacity:0}
}
.cs-inner {
    position: relative; z-index: 2;
    text-align: center;
    padding: 60px 30px;
    max-width: 850px; width: 100%;
}
.cs-badge {
    display: inline-flex; align-items: center; gap: 10px;
    background: rgba(255,215,0,0.08);
    border: 1px solid rgba(255,215,0,0.2);
    border-radius: 100px; padding: 8px 24px 8px 18px;
    margin-bottom: 30px;
    font-size: 13px; letter-spacing: 3px;
    text-transform: uppercase; color: rgba(255,215,0,0.7);
    animation: csBadgePulse 3s ease-in-out infinite;
}
.cs-badge .cs-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #ffd700;
    animation: csBlink 1.4s ease-in-out infinite;
    box-shadow: 0 0 10px #ffd700;
}
@keyframes csBlink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.8)} }
@keyframes csBadgePulse { 0%,100%{border-color:rgba(255,215,0,0.2)} 50%{border-color:rgba(255,215,0,0.5)} }
.cs-title {
    font-family: 'Orbitron', monospace;
    font-size: clamp(28px,5vw,56px); font-weight: 900;
    text-transform: uppercase;
    background: linear-gradient(135deg, #ffd700 0%, #ff6b35 50%, #ffd700 100%);
    background-size: 200% 200%;
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: csShimmer 3s ease-in-out infinite;
    margin-bottom: 8px; line-height: 1.2;
}
@keyframes csShimmer { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
.cs-subtitle {
    font-size: clamp(14px,2vw,20px);
    color: rgba(255,255,255,0.4);
    letter-spacing: 6px; text-transform: uppercase;
    margin-bottom: 50px; font-weight: 300;
}
.cs-subtitle span { color: rgba(255,215,0,0.6); }
.cs-timer {
    display: flex; justify-content: center;
    gap: clamp(12px,3vw,30px); flex-wrap: wrap;
}
.cs-unit { display: flex; flex-direction: column; align-items: center; }
.cs-tile {
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
.cs-tile:hover {
    border-color: rgba(255,215,0,0.4);
    box-shadow: 0 8px 40px rgba(0,0,0,0.8), 0 0 30px rgba(255,215,0,0.05), inset 0 1px 0 rgba(255,215,0,0.2);
}
.cs-tile::before {
    content: ''; position: absolute;
    top: 50%; left: 0; right: 0; height: 1px;
    background: rgba(255,215,0,0.06);
}
.cs-tile::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,215,0,0.03), transparent 40%, transparent 60%, rgba(255,215,0,0.03));
    border-radius: 16px; pointer-events: none;
}
.cs-num {
    font-family: 'Orbitron', monospace;
    font-size: clamp(38px,8vw,82px); font-weight: 900;
    color: #fff;
    text-shadow: 0 0 20px rgba(255,215,0,0.15), 0 0 60px rgba(255,215,0,0.05);
    line-height: 1; position: relative; z-index: 1;
}
.cs-label {
    font-size: clamp(11px,1.2vw,14px); letter-spacing: 4px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3); margin-top: 14px; font-weight: 500;
}
.cs-sep {
    font-family: 'Orbitron', monospace;
    font-size: clamp(30px,6vw,64px); font-weight: 900;
    color: rgba(255,215,0,0.3);
    align-self: center; padding-bottom: 28px;
    animation: csSepPulse 1s ease-in-out infinite;
    user-select: none;
}
@keyframes csSepPulse { 0%,100%{opacity:.3} 50%{opacity:.7} }
.cs-flip {
    animation: csFlip .4s cubic-bezier(.34,1.56,.64,1) forwards;
}
@keyframes csFlip {
    0%{transform:rotateX(90deg) scale(.8);opacity:.3}
    100%{transform:rotateX(0deg) scale(1);opacity:1}
}
.cs-progress { margin: 35px auto 0; max-width: 500px; }
.cs-progress-bar {
    width: 100%; height: 3px;
    background: rgba(255,255,255,0.06);
    border-radius: 10px; overflow: hidden;
}
.cs-progress-fill {
    height: 100%; width: 0%;
    background: linear-gradient(90deg, #ff6b35, #ffd700);
    border-radius: 10px; transition: width .5s ease;
    box-shadow: 0 0 12px rgba(255,215,0,0.3);
}
.cs-progress-label {
    display: flex; justify-content: space-between;
    margin-top: 8px;
    font-size: 11px; letter-spacing: 2px;
    color: rgba(255,255,255,0.2); text-transform: uppercase;
}
.cs-msg { margin-top: 50px; }
.cs-msg p {
    font-size: clamp(13px,1.5vw,17px);
    color: rgba(255,255,255,0.25); letter-spacing: 2px;
}
.cs-msg .cs-hl { color: rgba(255,215,0,0.7); font-weight: 700; }
.cs-hype {
    margin-top: 40px;
    display: flex; flex-direction: column;
    align-items: center; gap: 10px;
}
.cs-hype-btn {
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
.cs-hype-btn:hover {
    background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,107,53,0.2));
    border-color: rgba(255,215,0,0.5);
    box-shadow: 0 0 40px rgba(255,215,0,0.15);
    transform: scale(1.05);
}
.cs-hype-btn:active { transform: scale(0.95); }
.cs-hype-btn .cs-fire {
    font-size: clamp(20px,2.5vw,28px);
    transition: transform .2s ease;
}
.cs-hype-btn:hover .cs-fire { transform: scale(1.3) rotate(-10deg); }
.cs-hype-count {
    font-family: 'Orbitron', monospace;
    font-size: clamp(14px,1.8vw,20px); font-weight: 700;
    color: #fff; min-width: 30px; text-align: center;
}
.cs-hype-label {
    font-size: 12px; letter-spacing: 3px;
    text-transform: uppercase; color: rgba(255,255,255,0.2);
}
.cs-hype-burst {
    animation: csBurst .6s cubic-bezier(.34,1.56,.64,1) forwards;
}
@keyframes csBurst { 0%{transform:scale(1)} 30%{transform:scale(1.3)} 100%{transform:scale(1)} }
.cs-spark {
    position: absolute; pointer-events: none;
    width: 6px; height: 6px;
    border-radius: 50%; background: #ffd700;
    opacity: 0;
}
.cs-spark.fly {
    animation: csSparkFly .8s ease-out forwards;
}
@keyframes csSparkFly {
    0%{opacity:1;transform:translate(0,0) scale(1)}
    100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0)}
}
@media (max-width: 600px) {
    .cs-inner { padding: 40px 16px; }
    .cs-sep { padding-bottom: 22px; }
    .cs-tile { width: clamp(68px,20vw,90px); height: clamp(78px,22vw,100px); border-radius: 12px; }
    .cs-num { font-size: clamp(30px,12vw,44px); }
    .cs-badge { font-size: 11px; padding: 6px 16px 6px 12px; }
    .cs-hype-btn { padding: 12px 24px; }
}
`;
    document.head.appendChild(style);

    /* ─── Build the section ─── */
    const section = document.createElement('section');
    section.id = 'countdown-section';

    section.innerHTML = [
        '<div class="cs-bg-grid"></div>',
        '<div class="cs-orbs"><div class="cs-orb"></div><div class="cs-orb"></div><div class="cs-orb"></div></div>',
        '<div class="cs-scan"></div>',
        '<div class="cs-particles">' + '<div class="cs-particle"></div>'.repeat(10) + '</div>',
        '<div class="cs-inner">',
            '<div class="cs-badge"><span class="cs-dot"></span><span>Launch countdown</span></div>',
            '<div class="cs-title">Something Epic Is Coming</div>',
            '<div class="cs-subtitle">We\'re launching in <span>just around the corner</span></div>',
            '<div class="cs-timer">',
                '<div class="cs-unit"><div class="cs-tile"><span class="cs-num" id="cs-days">00</span></div><span class="cs-label">Days</span></div>',
                '<span class="cs-sep">:</span>',
                '<div class="cs-unit"><div class="cs-tile"><span class="cs-num" id="cs-hours">00</span></div><span class="cs-label">Hours</span></div>',
                '<span class="cs-sep">:</span>',
                '<div class="cs-unit"><div class="cs-tile"><span class="cs-num" id="cs-mins">00</span></div><span class="cs-label">Minutes</span></div>',
                '<span class="cs-sep">:</span>',
                '<div class="cs-unit"><div class="cs-tile"><span class="cs-num" id="cs-secs">00</span></div><span class="cs-label">Seconds</span></div>',
            '</div>',
            '<div class="cs-progress">',
                '<div class="cs-progress-bar"><div class="cs-progress-fill" id="cs-progressFill"></div></div>',
                '<div class="cs-progress-label"><span>Preparing launch</span><span id="cs-progressPct">0%</span></div>',
            '</div>',
            '<div class="cs-msg"><p>🚀 &nbsp; Get ready &nbsp; · &nbsp; <span class="cs-hl">#HYPED</span> &nbsp; · &nbsp; Stay tuned</p></div>',
            '<div class="cs-hype">',
                '<button class="cs-hype-btn" id="cs-hypeBtn">',
                    '<span class="cs-fire">🔥</span>',
                    '<span>HYPE</span>',
                    '<span class="cs-hype-count" id="cs-hypeCount">0</span>',
                '</button>',
                '<div class="cs-hype-label">Click if you\'re hyped!</div>',
            '</div>',
        '</div>'
    ].join('');

    // Insert at the very top of body
    document.body.insertBefore(section, document.body.firstChild);

    /* ─── Countdown timer ─── */
    const KEY = 'epic_launch_countdown_start';
    let startTime = localStorage.getItem(KEY);
    if (!startTime) {
        startTime = Date.now();
        try { localStorage.setItem(KEY, startTime); } catch(e) {}
    } else {
        startTime = parseInt(startTime, 10);
    }
    const TOTAL = 2 * 24 * 60 * 60 * 1000;
    const endTime = startTime + TOTAL;

    const daysEl = document.getElementById('cs-days');
    const hoursEl = document.getElementById('cs-hours');
    const minsEl = document.getElementById('cs-mins');
    const secsEl = document.getElementById('cs-secs');
    const fillBar = document.getElementById('cs-progressFill');
    const pctEl = document.getElementById('cs-progressPct');
    let prev = { d: -1, h: -1, m: -1, s: -1 };
    function pad(n) { return String(n).padStart(2, '0'); }
    function tick() {
        const now = Date.now();
        let diff = endTime - now;
        if (diff < 0) diff = 0;
        const t = Math.floor(diff / 1000);
        const d = Math.floor(t / 86400);
        const h = Math.floor((t % 86400) / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = t % 60;

        daysEl.textContent = pad(d);
        hoursEl.textContent = pad(h);
        minsEl.textContent = pad(m);
        secsEl.textContent = pad(s);

        if (prev.d !== -1) {
            if (d !== prev.d) daysEl.classList.remove('cs-flip');
            if (h !== prev.h) hoursEl.classList.remove('cs-flip');
            if (m !== prev.m) minsEl.classList.remove('cs-flip');
            if (s !== prev.s) secsEl.classList.remove('cs-flip');
            void daysEl.offsetWidth;
            if (d !== prev.d) daysEl.classList.add('cs-flip');
            if (h !== prev.h) hoursEl.classList.add('cs-flip');
            if (m !== prev.m) minsEl.classList.add('cs-flip');
            if (s !== prev.s) secsEl.classList.add('cs-flip');
        }
        prev = { d, h, m, s };

        const elapsed = now - startTime;
        let pct = (elapsed / TOTAL) * 100;
        if (pct > 100) pct = 100;
        fillBar.style.width = pct + '%';
        pctEl.textContent = Math.round(pct) + '%';
    }
    tick();
    setInterval(tick, 1000);

    /* ─── HYPE BUTTON — global via API ─── */
    const HYPE_API = '/api/hype';
    const hypeBtn = document.getElementById('cs-hypeBtn');
    const hypeCountEl = document.getElementById('cs-hypeCount');
    let clicked = false;

    // Fetch global hype count
    async function fetchHype() {
        try {
            const res = await fetch(HYPE_API);
            const data = await res.json();
            if (typeof data.count === 'number') {
                hypeCountEl.textContent = data.count;
            }
        } catch(e) {}
    }

    // Post to increment hype
    async function postHype() {
        try {
            const res = await fetch(HYPE_API, { method: 'POST' });
            const data = await res.json();
            if (typeof data.count === 'number') {
                hypeCountEl.textContent = data.count;
            }
        } catch(e) {}
    }

    // Initial fetch
    fetchHype();

    // Poll every 30 seconds for updates
    setInterval(fetchHype, 30000);

    hypeBtn.addEventListener('click', function() {
        if (clicked) return; // only once per page session
        clicked = true;
        postHype();
        hypeBtn.classList.remove('cs-hype-burst');
        void hypeBtn.offsetWidth;
        hypeBtn.classList.add('cs-hype-burst');
        const rect = hypeBtn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        for (let i = 0; i < 8; i++) {
            const sp = document.createElement('div');
            sp.className = 'cs-spark';
            const a = (i / 8) * Math.PI * 2;
            const d = 60 + Math.random() * 40;
            sp.style.setProperty('--tx', Math.cos(a) * d + 'px');
            sp.style.setProperty('--ty', Math.sin(a) * d + 'px');
            sp.style.left = cx + 'px';
            sp.style.top = cy + 'px';
            document.body.appendChild(sp);
            void sp.offsetWidth;
            sp.classList.add('fly');
            setTimeout(() => sp.remove(), 800);
        }
        if (navigator.vibrate) navigator.vibrate(15);
    });
})();