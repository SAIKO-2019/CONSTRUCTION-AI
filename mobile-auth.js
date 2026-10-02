(() => {
  'use strict';

  // Browser/web mode keeps the normal web login + reCAPTCHA flow.
  if (!window.__CM_STANDALONE_APP__) return;

  const $ = id => document.getElementById(id);
  const form = $('loginForm');
  const landing = $('authLanding');
  const openBtn = $('openSignInBtn');
  const email = $('loginEmail');
  const remember = $('rememberMe');
  const errorBox = $('loginError');
  const captchaWrap = document.querySelector('.captcha-wrap');

  // Installed app only: no reCAPTCHA UI.
  if (captchaWrap) captchaWrap.hidden = true;
  const captchaContainer = $('recaptchaContainer');
  if (captchaContainer) captchaContainer.replaceChildren();

  function openLogin() {
    landing?.classList.add('hidden');
    form?.classList.remove('hidden');
    if (errorBox) errorBox.textContent = '';
    setTimeout(() => email?.focus(), 60);
  }

  // v14.5 is intentionally not loaded in standalone app mode,
  // so keep its landing/open behavior here without touching login submission.
  openBtn?.addEventListener('click', openLogin);

  // Remembered email convenience only. No authentication logic is replaced here.
  try {
    const remembered = localStorage.getItem('saiko_remembered_email');
    if (remembered && email) {
      email.value = remembered;
      if (remember) remember.checked = true;
    }
  } catch (_) {}

  form?.addEventListener('submit', () => {
    try {
      const value = email?.value?.trim() || '';
      if (remember?.checked && value) localStorage.setItem('saiko_remembered_email', value);
      else localStorage.removeItem('saiko_remembered_email');
    } catch (_) {}
  }, { capture: true });

  // Visual indicator only.
  const options = form?.querySelector('.auth-options');
  if (options && !document.getElementById('cmAppSecurityBadge')) {
    const badge = document.createElement('div');
    badge.id = 'cmAppSecurityBadge';
    badge.className = 'cm-app-security-badge';
    badge.innerHTML = `
      <span class="cm-app-security-icon">✓</span>
      <div>
        <strong>Installed app sign-in</strong>
        <small>Secure direct account authentication on this device</small>
      </div>`;
    options.insertAdjacentElement('afterend', badge);
  }

  // If app.js did not attach the original login handler for some reason,
  // show a useful message instead of silently doing nothing.
  if (form && typeof form.onsubmit !== 'function') {
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (errorBox) errorBox.textContent = 'Login engine is still loading. Close and reopen the app, then try again.';
    });
  }
})();