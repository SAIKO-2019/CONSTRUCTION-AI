(() => {
  'use strict';

  const VERSION = '28.37';
  const GREET_KEY = 'cm_voice_greeted_this_session';
  let deferredInstall = null;
  let greetingInFlight = false;

  const $ = id => document.getElementById(id);
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function firstName() {
    const sources = [
      $('sidebarName')?.textContent,
      $('settingsDisplayName')?.value,
      $('v28HomeGreeting')?.textContent?.replace(/^welcome\s+back[,!\s]*/i,''),
      $('loginEmail')?.value?.split('@')[0]
    ];
    const raw = sources.find(v => v && String(v).trim() && !/^user$/i.test(String(v).trim())) || 'there';
    const cleaned = String(raw).trim().replace(/[._-]+/g,' ').replace(/\s+/g,' ');
    return cleaned.split(' ')[0] || 'there';
  }

  function voiceFor(voices) {
    return voices.find(v => /^en-PH$/i.test(v.lang)) ||
           voices.find(v => /^en-(US|GB|AU)$/i.test(v.lang)) ||
           voices.find(v => /^en/i.test(v.lang)) || voices[0];
  }

  function visualGreeting(name) {
    let t = document.getElementById('cmVoiceGreetingToast');
    if (t) t.remove();
    t = document.createElement('div');
    t.id = 'cmVoiceGreetingToast';
    t.className = 'cm-voice-greeting-toast';
    t.innerHTML = `<span class="cm-voice-orb" aria-hidden="true"></span><div><small>CONSTRUCTION MONITORING</small><strong>Hello, welcome ${escapeHtml(name)}.</strong></div>`;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 380); }, 3600);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  }

  function speakGreeting(force = false) {
    if (greetingInFlight) return;
    if (!force && sessionStorage.getItem(GREET_KEY) === '1') return;
    const gate = $('loginGate');
    if (gate && !gate.classList.contains('hidden') && getComputedStyle(gate).display !== 'none') return;

    const name = firstName();
    visualGreeting(name);
    sessionStorage.setItem(GREET_KEY, '1');

    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
    greetingInFlight = true;
    const say = () => {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(`Hello, welcome ${name}.`);
        const voices = window.speechSynthesis.getVoices();
        const voice = voiceFor(voices);
        if (voice) { u.voice = voice; u.lang = voice.lang || 'en-US'; }
        else u.lang = 'en-US';
        u.rate = 0.94;
        u.pitch = 1.02;
        u.volume = 0.92;
        u.onend = () => { greetingInFlight = false; };
        u.onerror = event => {
          greetingInFlight = false;
          if (event?.error === 'not-allowed') {
            sessionStorage.removeItem(GREET_KEY);
            document.addEventListener('pointerdown', () => speakGreeting(true), { once:true, capture:true });
          }
        };
        window.speechSynthesis.speak(u);
      } catch (_) { greetingInFlight = false; }
    };
    if (window.speechSynthesis.getVoices().length) say();
    else {
      window.speechSynthesis.addEventListener('voiceschanged', say, { once:true });
      setTimeout(() => { if (greetingInFlight) say(); }, 900);
    }
  }

  function wireVoiceGreeting() {
    const gate = $('loginGate');
    const loginForm = $('loginForm');
    const logout = $('logoutBtn');

    loginForm?.addEventListener('submit', () => {
      sessionStorage.removeItem(GREET_KEY);
      try { window.speechSynthesis?.cancel(); } catch (_) {}
    }, true);

    logout?.addEventListener('click', () => {
      sessionStorage.removeItem(GREET_KEY);
      try { window.speechSynthesis?.cancel(); } catch (_) {}
    }, true);

    if (!gate) return;
    const check = () => {
      const hidden = gate.classList.contains('hidden') || gate.hidden || getComputedStyle(gate).display === 'none';
      if (hidden) setTimeout(() => speakGreeting(false), 280);
    };
    new MutationObserver(check).observe(gate, { attributes:true, attributeFilter:['class','style','hidden'] });
    setTimeout(check, 500);
  }

  function showInstallHelp() {
    let d = $('cmInstallDialog');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'cmInstallDialog';
      d.className = 'cm-install-dialog';
      d.innerHTML = `
        <div class="cm-install-card">
          <button type="button" class="cm-install-close" aria-label="Close">×</button>
          <div class="cm-install-icon"><img src="/icons/icon-192.png" alt=""></div>
          <small>CONSTRUCTION MONITORING</small>
          <h2>Install on your phone</h2>
          <div class="cm-install-steps"></div>
          <button type="button" class="primary-btn cm-install-done">Got it</button>
        </div>`;
      document.body.appendChild(d);
      d.querySelector('.cm-install-close').onclick = () => d.close();
      d.querySelector('.cm-install-done').onclick = () => d.close();
      d.addEventListener('click', e => { if (e.target === d) d.close(); });
    }
    const steps = d.querySelector('.cm-install-steps');
    if (isIOS()) {
      steps.innerHTML = `<p><strong>iPhone / iPad</strong></p><ol><li>Open this site in <strong>Safari</strong>.</li><li>Tap the <strong>Share</strong> button.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>.</li></ol>`;
    } else {
      steps.innerHTML = `<p><strong>Android / Chrome</strong></p><ol><li>Open this site in <strong>Chrome</strong>.</li><li>Tap the browser menu <strong>⋮</strong>.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm <strong>Install</strong>.</li></ol>`;
    }
    d.showModal();
  }

  function ensureInstallButtons() {
    if (isStandalone()) return;
    const mobileCandidate = isIOS() || /Android/i.test(navigator.userAgent) || deferredInstall;
    if (!mobileCandidate) return;

    const actions = document.querySelector('.sidebar-user .profile-actions');
    if (actions && !$('cmInstallBtn')) {
      const b = document.createElement('button');
      b.id = 'cmInstallBtn';
      b.type = 'button';
      b.className = 'profile-icon-btn cm-install-btn';
      b.title = 'Install Construction Monitoring';
      b.setAttribute('aria-label','Install Construction Monitoring');
      b.innerHTML = '<span class="icon-glyph">⌄</span>';
      actions.insertBefore(b, actions.firstChild);
      b.onclick = installApp;
    }

    const authSide = document.querySelector('.v28-auth-form-side');
    if (authSide && !$('cmInstallLoginBtn')) {
      const b = document.createElement('button');
      b.id = 'cmInstallLoginBtn';
      b.type = 'button';
      b.className = 'cm-install-login-btn';
      b.innerHTML = '<img src="/icons/icon-192.png" alt=""><span><strong>Install App</strong><small>Add Construction Monitoring to your phone</small></span>';
      authSide.appendChild(b);
      b.onclick = installApp;
    }
  }

  async function installApp() {
    if (isStandalone()) return;
    if (deferredInstall) {
      try {
        deferredInstall.prompt();
        await deferredInstall.userChoice;
        deferredInstall = null;
        document.querySelectorAll('#cmInstallBtn,#cmInstallLoginBtn').forEach(el => el.remove());
        return;
      } catch (_) {}
    }
    showInstallHelp();
  }

  function wirePWA() {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredInstall = event;
      ensureInstallButtons();
    });
    window.addEventListener('appinstalled', () => {
      deferredInstall = null;
      document.querySelectorAll('#cmInstallBtn,#cmInstallLoginBtn').forEach(el => el.remove());
    });
    ensureInstallButtons();

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js?v=28371', { scope:'/', updateViaCache:'none' })
          .then(reg => reg.update().catch(() => {}))
          .catch(err => console.warn('[CM PWA] Service worker registration failed:', err));
      }, { once:true });
    }
  }

  function start() {
    wireVoiceGreeting();
    wirePWA();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
