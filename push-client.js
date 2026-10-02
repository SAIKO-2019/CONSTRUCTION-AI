(() => {
  'use strict';
  const VAPID_PUBLIC_KEY = "BAQLVJ1caahJHfsSHSUU-IuDTTK9uYXv5MChNvpBQf7L6WcEHQ1q6sfgG9tDpFPH3L_HIdoMIXfEM84DoDaFL9w";
  const isStandalone = () => window.__CM_STANDALONE_APP__ === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true;
  const $ = id => document.getElementById(id);
  let promptShown = false;

  function b64ToUint8(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  async function sessionUser() {
    try {
      const { data } = await window.sb?.auth?.getSession?.();
      return data?.session?.user || null;
    } catch (_) { return null; }
  }

  async function registerSubscription() {
    if (!isStandalone()) return { ok:false, reason:'Install the app first.' };
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
      return { ok:false, reason:'Push notifications are not supported on this device/browser.' };

    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok:false, reason:'Notification permission was not granted.' };

    const user = await sessionUser();
    if (!user) return { ok:false, reason:'Sign in first.' };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:b64ToUint8(VAPID_PUBLIC_KEY)
      });
    }

    const json = sub.toJSON();
    const row = {
      user_id:user.id,
      endpoint:json.endpoint,
      p256dh:json.keys?.p256dh || '',
      auth:json.keys?.auth || '',
      device_label:`${navigator.platform || 'Mobile'} · ${navigator.userAgent.includes('iPhone')?'iPhone':navigator.userAgent.includes('iPad')?'iPad':navigator.userAgent.includes('Android')?'Android':'Installed App'}`,
      user_agent:navigator.userAgent,
      enabled:true,
      updated_at:new Date().toISOString()
    };
    const { error } = await window.sb.from('push_subscriptions').upsert(row, { onConflict:'user_id,endpoint' });
    if (error) throw error;

    try {
      await reg.showNotification('Construction Monitoring', {
        body:'Background notifications are now enabled on this device.',
        icon:'/icons/icon-192.png',
        badge:'/icons/icon-192.png',
        tag:'cm-push-enabled',
        data:{ url:'/' }
      });
    } catch (_) {}

    localStorage.setItem('cm_push_enabled','1');
    updateButtons();
    return { ok:true };
  }

  async function disableSubscription() {
    try {
      const user = await sessionUser();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub && user) {
        await window.sb.from('push_subscriptions')
          .update({ enabled:false, updated_at:new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      localStorage.removeItem('cm_push_enabled');
      updateButtons();
      return { ok:true };
    } catch (err) { return { ok:false, reason:err?.message || String(err) }; }
  }

  function buildCenter() {
    if ($('cmPushCenter')) return $('cmPushCenter');
    const d = document.createElement('dialog');
    d.id = 'cmPushCenter';
    d.className = 'cm-push-center';
    d.innerHTML = `
      <div class="cm-push-card">
        <button type="button" class="cm-push-close" aria-label="Close">×</button>
        <div class="cm-push-head">
          <span class="cm-push-orb">🔔</span>
          <div><small>BACKGROUND NOTIFICATIONS</small><h2>Phone notifications</h2></div>
        </div>
        <p>When enabled, the installed app can receive quotation reminders and system activity notifications even when the app is closed, as long as the phone has internet/data.</p>
        <div id="cmPushStatus" class="cm-push-status">Checking…</div>
        <div class="cm-push-actions">
          <button id="cmEnablePush" type="button" class="primary-btn">Enable notifications</button>
          <button id="cmDisablePush" type="button" class="secondary-btn">Disable</button>
        </div>
        <small class="cm-push-note">iPhone/iPad: Web Push requires the app to be added to the Home Screen and notification permission to be allowed.</small>
      </div>`;
    document.body.appendChild(d);
    d.querySelector('.cm-push-close').onclick = () => d.close();
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    $('cmEnablePush').onclick = async () => {
      const btn = $('cmEnablePush'); btn.disabled = true; btn.textContent = 'Enabling…';
      try {
        const r = await registerSubscription();
        if (!r.ok) alert(r.reason);
      } catch (err) {
        alert('Notification setup failed: ' + (err?.message || err));
      } finally {
        btn.disabled = false; btn.textContent = 'Enable notifications'; updateButtons();
      }
    };
    $('cmDisablePush').onclick = async () => {
      await disableSubscription(); updateButtons();
    };
    return d;
  }

  async function updateButtons() {
    if (!('Notification' in window)) return;
    const enabled = Notification.permission === 'granted' && localStorage.getItem('cm_push_enabled') === '1';
    const status = $('cmPushStatus');
    if (status) {
      status.className = 'cm-push-status ' + (enabled ? 'enabled' : 'disabled');
      status.textContent = enabled
        ? '● Background notifications enabled'
        : Notification.permission === 'denied'
          ? 'Notifications are blocked in phone/browser settings'
          : 'Background notifications are not enabled yet';
    }
    if ($('cmEnablePush')) $('cmEnablePush').hidden = enabled;
    if ($('cmDisablePush')) $('cmDisablePush').hidden = !enabled;
  }

  function openCenter() {
    const d = buildCenter();
    updateButtons();
    d.showModal();
  }
  window.cmOpenNotificationCenter = openCenter;

  async function autoReconnectIfAllowed() {
    if (!isStandalone() || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try { await registerSubscription(); } catch (_) {}
    }
  }

  function maybePrompt() {
    if (!isStandalone() || promptShown || !('Notification' in window) || Notification.permission !== 'default') return;
    const gate = $('loginGate');
    if (gate && !gate.classList.contains('hidden') && getComputedStyle(gate).display !== 'none') return;
    promptShown = true;

    const bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'cm-push-optin';
    bar.innerHTML = '<span>🔔</span><div><strong>Enable phone notifications</strong><small>Get reminders even when the app is closed</small></div><b>Enable</b>';
    document.body.appendChild(bar);
    bar.onclick = () => { bar.remove(); openCenter(); };
    setTimeout(() => bar.classList.add('show'), 80);
    setTimeout(() => { bar.classList.remove('show'); setTimeout(() => bar.remove(), 300); }, 9000);
  }

  function start() {
    if (!isStandalone()) return;
    buildCenter();
    autoReconnectIfAllowed();
    const gate = $('loginGate');
    const check = () => {
      const hidden = !gate || gate.classList.contains('hidden') || gate.hidden || getComputedStyle(gate).display === 'none';
      if (hidden) {
        setTimeout(autoReconnectIfAllowed, 500);
        setTimeout(maybePrompt, 1200);
      }
    };
    if (gate) new MutationObserver(check).observe(gate, { attributes:true, attributeFilter:['class','style','hidden'] });
    setTimeout(check, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();