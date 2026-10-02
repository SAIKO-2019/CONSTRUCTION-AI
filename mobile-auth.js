(() => {
  'use strict';
  if (!window.__CM_STANDALONE_APP__) return;

  const $ = id => document.getElementById(id);
  const form = $('loginForm');
  const landing = $('authLanding');
  const openBtn = $('openSignInBtn');
  const email = $('loginEmail');
  const password = $('loginPassword');
  const remember = $('rememberMe');
  const errorBox = $('loginError');
  const captchaWrap = document.querySelector('.captcha-wrap');

  if (captchaWrap) captchaWrap.hidden = true;
  $('recaptchaContainer')?.replaceChildren();

  function setMessage(msg='', success=false) {
    if (!errorBox) return;
    errorBox.textContent = msg;
    errorBox.classList.toggle('success', success);
  }

  function openLogin() {
    landing?.classList.add('hidden');
    form?.classList.remove('hidden');
    setMessage('');
    setTimeout(() => email?.focus(), 60);
  }

  openBtn?.addEventListener('click', openLogin);

  const remembered = localStorage.getItem('saiko_remembered_email');
  if (remembered && email) {
    email.value = remembered;
    if (remember) remember.checked = true;
  }

  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();
      e.stopPropagation();

      const emailValue = email?.value.trim() || '';
      const passwordValue = password?.value || '';
      if (!emailValue || !passwordValue) {
        setMessage('Enter your email and password.');
        return;
      }
      if (!window.sb?.auth) {
        setMessage('Secure sign-in is still loading. Please try again.');
        return;
      }

      const submit = form.querySelector('button[type="submit"]');
      if (submit?.disabled) return;
      if (submit) {
        submit.disabled = true;
        submit.dataset.oldText = submit.textContent || 'Sign in';
        submit.textContent = 'Signing in…';
      }
      form.classList.add('auth-busy');
      setMessage('');

      try {
        const { data, error } = await window.sb.auth.signInWithPassword({
          email: emailValue,
          password: passwordValue
        });
        if (error) throw error;
        if (!data?.user) throw new Error('Sign in did not create a valid session.');

        if (remember?.checked) localStorage.setItem('saiko_remembered_email', emailValue);
        else localStorage.removeItem('saiko_remembered_email');

        setMessage('Signed in. Opening your mobile workspace…', true);

        // Reuse the exact existing web-app entry function/data flow.
        if (typeof window.enter === 'function') await window.enter(data.user);
        else if (typeof window.boot === 'function') await window.boot();
        else location.reload();
      } catch (err) {
        setMessage(err?.message || String(err));
      } finally {
        form.classList.remove('auth-busy');
        if (submit) {
          submit.disabled = false;
          submit.textContent = submit.dataset.oldText || 'Sign in';
        }
      }
    };
  }

  // Direct app sign-in marker: no CAPTCHA in installed app only.
  const options = form?.querySelector('.auth-options');
  if (options && !document.getElementById('cmAppSecurityBadge')) {
    const badge = document.createElement('div');
    badge.id = 'cmAppSecurityBadge';
    badge.className = 'cm-app-security-badge';
    badge.innerHTML = `
      <span class="cm-app-security-icon">✓</span>
      <div><strong>Installed app sign-in</strong><small>Secure direct account authentication on this device</small></div>`;
    options.insertAdjacentElement('afterend', badge);
  }
})();