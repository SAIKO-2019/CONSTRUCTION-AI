(() => {
  'use strict';

  const isStandalone = () =>
    window.__CM_STANDALONE_APP__ === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true;

  const isTouchMobile = () =>
    window.__CM_MOBILE_DEVICE__ === true ||
    ((navigator.maxTouchPoints || 0) > 0 && window.innerWidth <= 1180);

  const isMobileMode = () => isStandalone() || isTouchMobile();
  const $ = id => document.getElementById(id);
  const qs = (s, root=document) => root.querySelector(s);
  const qsa = (s, root=document) => [...root.querySelectorAll(s)];

  const primary = [
    { view:'home', label:'Home', icon:'⌂' },
    { view:'dashboard', label:'Dashboard', icon:'▦' },
    { view:'projects', label:'Projects', icon:'▣' },
    { view:'billing', label:'Billing', icon:'₱' }
  ];

  const labels = {
    home:'Home', dashboard:'Dashboard', projects:'Projects', billing:'Billing & Payments',
    schedule:'Projected', progress:'Actual', inventory:'Inventory / Purchases',
    budget:'Budget Monitoring', reports:'Project Reports', quotation:'For Quotation',
    files:'Project Files', templates:'Templates', assistant:'Construction AI',
    profile:'Profile', users:'User Management'
  };

  let lastView = 'home';
  let swipeStart = null;
  let transitionBusy = false;

  function activeView() {
    return qs('.main > .view.active-view')?.id || 'home';
  }

  function navViews() {
    return qsa('#sideNav button[data-view]')
      .filter(b => getComputedStyle(b).display !== 'none')
      .map(b => b.dataset.view)
      .filter(Boolean);
  }

  function originalNavButton(view) {
    return qs(`#sideNav button[data-view="${CSS.escape(view)}"]`);
  }

  function go(view, direction=0) {
    const btn = originalNavButton(view);
    if (!btn || transitionBusy) return;
    const before = activeView();
    if (before === view) {
      closeDrawer();
      return;
    }
    document.documentElement.dataset.cmNavDirection = direction > 0 ? 'forward' : direction < 0 ? 'back' : '';
    btn.click();
    closeDrawer();
    requestAnimationFrame(() => animateView(before, view, direction));
  }

  function animateView(fromId, toId, direction=0) {
    const incoming = $(toId);
    if (!incoming) return;
    transitionBusy = true;

    const cls = direction < 0 ? 'cm-page-enter-back' : 'cm-page-enter-forward';
    incoming.classList.remove('cm-page-enter-forward','cm-page-enter-back');
    void incoming.offsetWidth;
    incoming.classList.add(cls);
    setTimeout(() => {
      incoming.classList.remove(cls);
      transitionBusy = false;
      sync();
    }, 230);
    lastView = toId;
  }

  function createHeader() {
    if ($('cmMobileHeader')) return;
    const header = document.createElement('header');
    header.id = 'cmMobileHeader';
    header.className = 'cm-mobile-header';
    header.innerHTML = `
      <button type="button" class="cm-mobile-brand" data-cm-go="home" aria-label="Home">
        <img src="/icons/icon-192.png" alt="">
        <span><small>CONSTRUCTION</small><strong id="cmMobileViewTitle">Home</strong></span>
      </button>
      <div class="cm-mobile-header-actions">
        <button id="cmMobileNotif" type="button" class="cm-mobile-icon-btn" aria-label="Notifications">🔔<span id="cmMobileNotifBadge" class="cm-mobile-badge hidden">0</span></button>
        <button id="cmMobileTheme" type="button" class="cm-mobile-icon-btn" aria-label="Change theme">◐</button>
        <button id="cmMobileMenu" type="button" class="cm-mobile-icon-btn" aria-label="Open menu">☰</button>
      </div>`;
    document.body.appendChild(header);
    header.querySelector('[data-cm-go="home"]')?.addEventListener('click', () => go('home', -1));
    $('cmMobileNotif')?.addEventListener('click', () => {
      if (typeof window.cmOpenNotificationCenter === 'function') window.cmOpenNotificationCenter();
      else $('quotationNotifBtn')?.click();
    });
    $('cmMobileTheme')?.addEventListener('click', () => $('quickThemeBtn')?.click());
    $('cmMobileMenu')?.addEventListener('click', openDrawer);
  }

  function createBottomNav() {
    if ($('cmMobileBottomNav')) return;
    const nav = document.createElement('nav');
    nav.id = 'cmMobileBottomNav';
    nav.className = 'cm-mobile-bottom-nav';
    nav.setAttribute('aria-label','Mobile navigation');
    nav.innerHTML = primary.map(item => `
      <button type="button" data-cm-view="${item.view}">
        <span>${item.icon}</span><small>${item.label}</small>
      </button>`).join('') + `
      <button type="button" id="cmMobileMore"><span>⋯</span><small>More</small></button>`;
    document.body.appendChild(nav);
    qsa('[data-cm-view]', nav).forEach(b => b.addEventListener('click', () => {
      const order = navViews();
      const a = order.indexOf(activeView()), z = order.indexOf(b.dataset.cmView);
      go(b.dataset.cmView, z >= a ? 1 : -1);
    }));
    $('cmMobileMore')?.addEventListener('click', openDrawer);
  }

  function createDrawer() {
    if ($('cmMobileDrawer')) return;
    const wrap = document.createElement('div');
    wrap.id = 'cmMobileDrawer';
    wrap.className = 'cm-mobile-drawer-wrap';
    wrap.innerHTML = `
      <button class="cm-mobile-drawer-backdrop" type="button" aria-label="Close menu"></button>
      <aside class="cm-mobile-drawer" role="dialog" aria-modal="true" aria-label="Construction Monitoring menu">
        <div class="cm-mobile-drawer-handle"></div>
        <div class="cm-mobile-drawer-head">
          <div class="cm-mobile-user">
            <div id="cmMobileAvatar" class="cm-mobile-avatar">U</div>
            <div><strong id="cmMobileName">User</strong><small id="cmMobileRole">Editor</small></div>
          </div>
          <button id="cmMobileDrawerClose" type="button" class="cm-mobile-icon-btn" aria-label="Close">×</button>
        </div>
        <div class="cm-mobile-project-strip">
          <small>ACTIVE PROJECT</small>
          <strong id="cmMobileProjectName">All Projects</strong>
        </div>
        <div id="cmMobileAllFeatures" class="cm-mobile-feature-grid"></div>
        <div class="cm-mobile-quick-actions">
          <button type="button" data-cm-action="notifications">🔔<span>Notifications</span></button>
          <button type="button" data-cm-action="team">◉<span>Team</span></button>
          <button type="button" data-cm-action="settings">⚙<span>Settings</span></button>
          <button type="button" data-cm-action="theme">◐<span>Theme</span></button>
          <button type="button" data-cm-action="logout" class="danger">↗<span>Log out</span></button>
        </div>
      </aside>`;
    document.body.appendChild(wrap);

    const grid = $('cmMobileAllFeatures');
    qsa('#sideNav button[data-view]').forEach(btn => {
      const view = btn.dataset.view;
      if (primary.some(p => p.view === view)) return;
      const item = document.createElement('button');
      item.type = 'button';
      item.dataset.cmView = view;
      item.className = `cm-mobile-feature-item ${btn.classList.contains('admin-only') ? 'admin-only' : ''}`;
      const text = btn.textContent.trim();
      const icon = text.split(/\s+/)[0] || '•';
      item.innerHTML = `<span>${icon}</span><strong>${labels[view] || text.replace(/^\S+\s*/,'')}</strong>`;
      item.addEventListener('click', () => {
        const order = navViews(), a = order.indexOf(activeView()), z = order.indexOf(view);
        go(view, z >= a ? 1 : -1);
      });
      grid.appendChild(item);
    });

    qs('.cm-mobile-drawer-backdrop', wrap)?.addEventListener('click', closeDrawer);
    $('cmMobileDrawerClose')?.addEventListener('click', closeDrawer);
    qsa('[data-cm-action]', wrap).forEach(btn => btn.addEventListener('click', async () => {
      const a = btn.dataset.cmAction;
      if (a === 'notifications') {
        closeDrawer();
        if (typeof window.cmOpenNotificationCenter === 'function') window.cmOpenNotificationCenter();
        return;
      }
      if (a === 'team') $('teamActivityBtn')?.click();
      if (a === 'settings') $('settingsBtn')?.click();
      if (a === 'theme') $('quickThemeBtn')?.click();
      if (a === 'logout') $('logoutBtn')?.click();
      if (a !== 'theme') closeDrawer();
    }));
  }

  function createProjectQuickBar() {
    if ($('cmMobileProjectBar')) return;
    const topbar = qs('.topbar');
    if (!topbar) return;
    const bar = document.createElement('div');
    bar.id = 'cmMobileProjectBar';
    bar.className = 'cm-mobile-project-bar';
    bar.innerHTML = `
      <div class="cm-mobile-search-wrap"><span>⌕</span><div id="cmMobileSearchHost"></div></div>
      <div id="cmMobileProjectHost" class="cm-mobile-project-host"></div>`;
    topbar.parentElement?.insertBefore(bar, topbar.nextSibling);

    const search = $('globalSearch');
    const projectLabel = qs('.workspace-project');
    if (search) $('cmMobileSearchHost')?.appendChild(search);
    if (projectLabel) $('cmMobileProjectHost')?.appendChild(projectLabel);
  }

  function openDrawer() {
    $('cmMobileDrawer')?.classList.add('open');
    document.documentElement.classList.add('cm-drawer-open');
    sync();
  }
  function closeDrawer() {
    $('cmMobileDrawer')?.classList.remove('open');
    document.documentElement.classList.remove('cm-drawer-open');
  }

  function canSwipeFrom(target) {
    if (!target) return false;
    return !target.closest(`
      input,select,textarea,button,a,label,dialog,
      .table-wrap,table,.chart-box,canvas,svg,
      [contenteditable="true"],[data-no-swipe],
      .quotation-project-cards,.folder-card-grid,.settings-workspace,
      .cm-mobile-bottom-nav,.cm-mobile-drawer,.cm-mobile-project-bar
    `);
  }

  function wireSwipe() {
    document.addEventListener('touchstart', e => {
      if (!isMobileMode() || e.touches.length !== 1 || !canSwipeFrom(e.target)) {
        swipeStart = null;
        return;
      }
      const t = e.touches[0];
      swipeStart = { x:t.clientX, y:t.clientY, time:performance.now() };
    }, { passive:true });

    document.addEventListener('touchend', e => {
      if (!swipeStart || !isMobileMode()) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - swipeStart.x;
      const dy = t.clientY - swipeStart.y;
      const dt = performance.now() - swipeStart.time;
      swipeStart = null;

      // Fast, deliberate horizontal swipe only. Vertical scrolling always wins.
      if (dt > 650 || Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.55) return;

      const order = navViews();
      const i = order.indexOf(activeView());
      if (i < 0) return;
      if (dx < 0 && i < order.length - 1) go(order[i + 1], 1);
      if (dx > 0 && i > 0) go(order[i - 1], -1);
    }, { passive:true });
  }

  function sync() {
    if (!isMobileMode()) return;
    const view = activeView();
    const title = $('cmMobileViewTitle');
    if (title) title.textContent = labels[view] || 'Construction Monitoring';
    qsa('#cmMobileBottomNav [data-cm-view]').forEach(b => b.classList.toggle('active', b.dataset.cmView === view));

    const name = $('sidebarName')?.textContent?.trim() || 'User';
    const role = $('sidebarRole')?.textContent?.trim() || 'Editor';
    const avatar = $('sidebarAvatar')?.textContent?.trim() || name[0] || 'U';
    if ($('cmMobileName')) $('cmMobileName').textContent = name;
    if ($('cmMobileRole')) $('cmMobileRole').textContent = role;
    if ($('cmMobileAvatar')) $('cmMobileAvatar').textContent = avatar;

    const project = $('workspaceProject');
    const projectName = project?.selectedOptions?.[0]?.textContent?.trim() || 'All Projects';
    if ($('cmMobileProjectName')) $('cmMobileProjectName').textContent = projectName;

    const srcBadge = $('quotationNotifBadge');
    const dstBadge = $('cmMobileNotifBadge');
    if (dstBadge && srcBadge) {
      dstBadge.textContent = srcBadge.textContent || '0';
      dstBadge.classList.toggle('hidden', srcBadge.classList.contains('hidden') || !Number(srcBadge.textContent || 0));
    }

    qsa('#cmMobileAllFeatures .admin-only').forEach(el => {
      const original = originalNavButton('users');
      el.style.display = original && getComputedStyle(original).display !== 'none' ? '' : 'none';
    });
  }

  function enable() {
    if (!isMobileMode()) return;
    document.documentElement.classList.add('cm-mobile-app');
    if (isStandalone()) document.documentElement.classList.add('cm-standalone-app');

    createHeader();
    createBottomNav();
    createDrawer();
    createProjectQuickBar();
    wireSwipe();
    sync();

    const sourceNav = $('sideNav');
    if (sourceNav) new MutationObserver(sync).observe(sourceNav, {
      attributes:true, subtree:true, attributeFilter:['class','style']
    });

    $('workspaceProject')?.addEventListener('change', sync);
    const badge = $('quotationNotifBadge');
    if (badge) new MutationObserver(sync).observe(badge, { childList:true, attributes:true, subtree:true });

    const gate = $('loginGate');
    if (gate) new MutationObserver(() => setTimeout(sync, 100))
      .observe(gate, { attributes:true, attributeFilter:['class','style','hidden'] });

    document.addEventListener('click', e => {
      if (e.target.closest?.('[data-v28-view],[data-jump],[data-go],#sideNav [data-view]')) setTimeout(sync, 70);
    }, true);

    window.addEventListener('resize', sync, { passive:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enable, { once:true });
  else enable();
})();