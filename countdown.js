// countdown.js
// Shows a global countdown overlay (4 days from first use) on every page.
// When it ends, the overlay is removed and the underlying content becomes interactive.
// Stores start date in localStorage so the countdown is consistent across pages.

(function () {
  const LS_KEY = 'tactical-web-countdown-start';
  const DAYS = 4;

  const OVERLAY_ID = 'tacticalCountdownOverlay';
  const CONTAINER_ID = 'tacticalCountdownContainer';
  const LABEL_DAYS = 'cdDays';
  const LABEL_HOURS = 'cdHours';
  const LABEL_MINUTES = 'cdMinutes';
  const LABEL_SECONDS = 'cdSeconds';
  const LABEL_HINT = 'cdHint';

  function nowMs() {
    return Date.now();
  }

  function getOrInitStartMs() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
      const ts = nowMs();
      localStorage.setItem(LS_KEY, String(ts));
      return ts;
    } catch (e) {
      // If storage fails, fall back to current time.
      return nowMs();
    }
  }

  function format2(n) {
    return String(n).padStart(2, '0');
  }

  function computeRemainingMs(startMs) {
    const endMs = startMs + DAYS * 24 * 60 * 60 * 1000;
    return endMs - nowMs();
  }

  function ensureOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const container = document.createElement('div');
    container.id = CONTAINER_ID;

    const style = document.createElement('style');
    style.textContent = `
      /* Overlay: keep background static (no rotating/sweeping gradients) */
      #${OVERLAY_ID} {
        animation: cdFadeIn 0.35s ease both, cdBgBlink 3.8s ease-in-out infinite;

        position: fixed;
        inset: 0;
        z-index: 999999;
        background:
          radial-gradient(1200px circle at 12% 8%, rgba(141,125,255,0.28), rgba(0,0,0,0) 58%),
          radial-gradient(900px circle at 92% 12%, rgba(82,213,255,0.22), rgba(0,0,0,0) 48%),
          radial-gradient(800px circle at 50% 110%, rgba(242,141,255,0.14), rgba(0,0,0,0) 60%),
          rgba(0,0,0,0.68);
        backdrop-filter: blur(10px);
        display: grid;
        place-items: center;
        overflow: hidden;
        transform: translateZ(0);
        animation: cdFadeIn 0.35s ease both, cdBgBlink 3.8s ease-in-out infinite;

      }


      @keyframes cdFadeIn {
        from { opacity: 0; transform: scale(0.985); }
        to { opacity: 1; transform: scale(1); }
      }

      #${OVERLAY_ID}::before {
        content: '';
        position: absolute;
        inset: -40px;
        background:
          linear-gradient(90deg, rgba(141,125,255,0.0), rgba(141,125,255,0.22), rgba(141,125,255,0.0)),
          linear-gradient(180deg, rgba(82,213,255,0.0), rgba(82,213,255,0.18), rgba(82,213,255,0.0));
        opacity: 0.7;
        transform: rotate(8deg);
        animation: cdSweep 2.6s ease-in-out infinite;
        pointer-events: none;
      }

      @keyframes cdSweep {
        0%, 100% { transform: translateX(0) rotate(0deg); opacity: 0.75; }
        50% { transform: translateX(0) rotate(0deg); opacity: 0.95; }
      }


      #${CONTAINER_ID} {
        width: min(1040px, calc(100% - 26px));
        padding: 26px 22px 22px;
        border-radius: 30px;
        background:
          radial-gradient(1200px circle at 15% 0%, rgba(141,125,255,0.22), rgba(0,0,0,0) 55%),
          radial-gradient(900px circle at 100% 10%, rgba(82,213,255,0.16), rgba(0,0,0,0) 45%),
          linear-gradient(180deg, rgba(16, 23, 41, 0.82), rgba(10, 15, 28, 0.76));
        border: 1px solid rgba(255,255,255,0.16);
        box-shadow:
          0 55px 180px rgba(0,0,0,0.62),
          0 0 0 1px rgba(141,125,255,0.12),
          inset 0 1px 0 rgba(255,255,255,0.14),
          inset 0 -1px 0 rgba(0,0,0,0.22);
        position: relative;
        overflow: hidden;
        transform: translateZ(0);
      }

      #${CONTAINER_ID}::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
          repeating-linear-gradient(180deg, rgba(255,255,255,0.06) 0 1px, rgba(0,0,0,0) 1px 6px);
        opacity: 0.25;
        pointer-events: none;
        mask-image: radial-gradient(closest-side at 50% 35%, rgba(0,0,0,1), rgba(0,0,0,0));
      }

      .cd-top {
        display:flex;
        justify-content: space-between;
        align-items:flex-start;
        gap: 14px;
        margin-bottom: 14px;
      }

      .cd-title {
        display:flex;
        gap: 12px;
        align-items:center;
      }

      .cd-badge {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(141,125,255,0.24), rgba(82,213,255,0.16));
        border: 1px solid rgba(141,125,255,0.35);
        box-shadow: 0 18px 50px rgba(141,125,255,0.14);
        display:grid;
        place-items:center;
        position: relative;
      }

      .cd-badge span {
        font-size: 20px;
        filter: drop-shadow(0 10px 24px rgba(141,125,255,0.40)) drop-shadow(0 0 14px rgba(141,125,255,0.35));
        transform: translateZ(0);
        animation: cdEmojiSpin 2.4s ease-in-out infinite;
        transform-origin: 50% 55%;
      }

      @keyframes cdEmojiSpin {
        0% { transform: translateZ(0) rotate(0deg); }
        35% { transform: translateZ(0) rotate(14deg); }
        70% { transform: translateZ(0) rotate(-10deg); }
        100% { transform: translateZ(0) rotate(0deg); }
      }


      .cd-badge {
        box-shadow:
          0 22px 60px rgba(141,125,255,0.22),
          0 0 0 1px rgba(141,125,255,0.20),
          inset 0 1px 0 rgba(255,255,255,0.22);
      }

      /* Slow background blink (subtle, premium) */
      @keyframes cdBgBlink {
        0%, 100% { filter: brightness(1.0) saturate(1.0); }
        45% { filter: brightness(1.06) saturate(1.06); }
      }


      .cd-heading {
        display:grid;
        place-items:center;
        text-align:center;
      }


      .cd-heading h1 {
        margin: 0;
        font-family: 'Manrope', system-ui, sans-serif;
        font-size: clamp(1.15rem, 2.2vw, 1.6rem);
        letter-spacing: 0.02em;
      }

      .cd-heading p {
        margin: 6px 0 0;
        color: rgba(230,238,255,0.8);
        line-height: 1.4;
        font-size: 0.95rem;
      }

      .cd-holo {
        padding: 10px 12px;
        border-radius: 18px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        color: rgba(220,235,255,0.92);
        font-weight: 800;
        font-size: 0.9rem;
        white-space: nowrap;
      }

      .cd-grid {
        display:grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        align-items:center;
        justify-items:center;
      }


      @media (max-width: 720px) {
        .cd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      .cd-tile {
        padding: 14px 14px 12px;
        border-radius: 20px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.10);
        position: relative;
        overflow: hidden;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
      }

      .cd-tile::before {
        content: '';
        position: absolute;
        inset: -60px;
        background: radial-gradient(circle at 30% 25%, rgba(141,125,255,0.22), rgba(0,0,0,0) 58%),
                    radial-gradient(circle at 70% 60%, rgba(82,213,255,0.18), rgba(0,0,0,0) 55%);
        opacity: 0.85;
        pointer-events: none;
      }

      .cd-val {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;

        font-size: clamp(1.7rem, 3.8vw, 2.6rem);
        font-weight: 950;
        letter-spacing: 0.02em;
        position: relative;
        line-height: 1;
        text-shadow:
          0 10px 30px rgba(0,0,0,0.35),
          0 0 18px rgba(141,125,255,0.30);
        transform: translateZ(0);
      }

      .cd-val { animation: cdPop 650ms cubic-bezier(0.2, 0.9, 0.25, 1) both; }

      @keyframes cdPop {
        from { opacity: 0.0; transform: translateY(6px) scale(0.98); filter: blur(4px); }
        to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); }
      }

      .cd-label {
        margin-top: 6px;
        color: rgba(185,204,240,0.9);
        font-weight: 800;
        font-size: 0.85rem;
        position: relative;
        text-align: center;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        letter-spacing: 0.01em;
      }


      .cd-bottom {
        margin-top: 14px;
        display:flex;
        justify-content: space-between;
        align-items:center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .cd-hint {
        color: rgba(220,235,255,0.90);
        font-weight: 850;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        letter-spacing: 0.02em;
        text-align: center;
      }



      .cd-progress {
        height: 10px;
        width: min(420px, 100%);
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.10);
        position: relative;
      }

      .cd-progress > span {
        display:block;
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, rgba(141,125,255,1), rgba(82,213,255,1));
        box-shadow: 0 0 22px rgba(141,125,255,0.32);
        transition: width 0.25s ease;
      }

      .cd-closeanim {
        animation: cdClose 0.45s ease both;
      }

      @keyframes cdClose {
        from { opacity: 1; transform: scale(1); filter: blur(0px); }
        to { opacity: 0; transform: scale(0.985); filter: blur(8px); }
      }
    `;

    container.innerHTML = `
      <div class="cd-top">
        <div class="cd-title">
          <div class="cd-badge" aria-hidden="true"><span>⏳</span></div>
          <div class="cd-heading">
            <h1>Mission unlock countdown</h1>
            <p>Everything stays behind layers until the global timer finishes.</p>
          </div>
        </div>
        <div class="cd-holo" id="${LABEL_HINT}">Hold on…</div>
      </div>

      <div class="cd-grid" aria-live="polite">
        <div class="cd-tile"><div class="cd-val" id="${LABEL_DAYS}">--</div><div class="cd-label">Days</div></div>
        <div class="cd-tile"><div class="cd-val" id="${LABEL_HOURS}">--</div><div class="cd-label">Hours</div></div>
        <div class="cd-tile"><div class="cd-val" id="${LABEL_MINUTES}">--</div><div class="cd-label">Minutes</div></div>
        <div class="cd-tile"><div class="cd-val" id="${LABEL_SECONDS}">--</div><div class="cd-label">Seconds</div></div>
      </div>

      <div class="cd-bottom">
        <div class="cd-hint">Reveals are synced across pages on this device.</div>
        <div class="cd-progress" aria-hidden="true"><span id="cdProgress"></span></div>
      </div>
    `;

    overlay.appendChild(style);
    overlay.appendChild(container);
    document.documentElement.appendChild(overlay);
  }

  function removeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.add('cd-closeanim');
    setTimeout(() => {
      try {
        overlay.remove();
      } catch (e) {
        overlay.parentNode && overlay.parentNode.removeChild(overlay);
      }
    }, 420);
  }

  function setAriaBlocked(blocked) {
    // Block interaction by disabling pointer events on underlying page.
    // We do not remove content until the countdown ends.
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    if (blocked) {
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
    }
  }

  function tick(startMs) {
    const remainingMs = computeRemainingMs(startMs);
    const hint = document.getElementById(LABEL_HINT);
    const progressSpan = document.getElementById('cdProgress');

    if (remainingMs <= 0) {
      // End condition: remove overlay and show page normally.
      if (hint) hint.textContent = 'Unlocked.';
      setAriaBlocked(false);
      removeOverlay();
      return;
    }

    const totalMs = DAYS * 24 * 60 * 60 * 1000;
    const elapsed = totalMs - remainingMs;
    const pct = Math.max(0, Math.min(100, (elapsed / totalMs) * 100));

    const seconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const elDays = document.getElementById(LABEL_DAYS);
    const elHours = document.getElementById(LABEL_HOURS);
    const elMinutes = document.getElementById(LABEL_MINUTES);
    const elSeconds = document.getElementById(LABEL_SECONDS);

    if (elDays) elDays.textContent = format2(days);
    if (elHours) elHours.textContent = format2(hours);
    if (elMinutes) elMinutes.textContent = format2(minutes);
    if (elSeconds) elSeconds.textContent = format2(secs);

    if (progressSpan) progressSpan.style.width = `${pct}%`;
    if (hint) {
      const dayWord = days === 1 ? 'day' : 'days';
      hint.textContent = `Unlocks in ${days} ${dayWord}.`; 
    }
  }

  function init() {
    ensureOverlay();
    setAriaBlocked(true);

    const startMs = getOrInitStartMs();

    // First tick immediately, then every second.
    tick(startMs);

    // If already ended, tick will remove overlay.
    const t = setInterval(() => {
      tick(startMs);
      const overlay = document.getElementById(OVERLAY_ID);
      if (!overlay) clearInterval(t);
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

