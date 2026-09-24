// SAIKO Construction AI v21.1 — lightweight patch/version watcher
(function(){
  const CURRENT_PATCH='22.4';
  const CHECK_EVERY_MS=20*1000; // one tiny request every 5 minutes
  let checking=false;
  let patchRequired=false;
  let intervalId=null;

  function $(id){return document.getElementById(id)}

  function ensurePatchDialog(){
    let dlg=$('patchRequiredDialog');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');
    dlg.id='patchRequiredDialog';
    dlg.className='patch-required-dialog';
    dlg.innerHTML=`
      <div class="dialog-card patch-required-card">
        <div class="patch-required-icon">↻</div>
        <div class="patch-required-copy">
          <small>SYSTEM UPDATE</small>
          <h2>New Patch Required</h2>
          <p id="patchRequiredMessage">A new system patch is available. Refresh is required before continuing.</p>
          <p class="patch-required-note">You will be signed out first, then returned to the Login page. Please log in again manually after the refresh.</p>
        </div>
        <div class="dialog-actions patch-required-actions">
          <button id="patchRefreshLoginBtn" type="button" class="primary-btn">Refresh & Login Again</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    $('patchRefreshLoginBtn').onclick=logoutAndRefresh;
    return dlg;
  }

  function showPatchRequired(info){
    if(patchRequired)return;
    patchRequired=true;
    const dlg=ensurePatchDialog();
    const msg=$('patchRequiredMessage');
    if(msg&&info?.message)msg.textContent=info.message;
    document.documentElement.classList.add('patch-required-active');
    if(!dlg.open){
      try{dlg.showModal()}catch(_){dlg.setAttribute('open','')}
    }
  }

  async function logoutAndRefresh(){
    const btn=$('patchRefreshLoginBtn');
    if(btn){btn.disabled=true;btn.textContent='Signing out…'}

    try{
      if(window.sb?.auth?.signOut){
        await window.sb.auth.signOut({scope:'local'});
      }
    }catch(e){console.warn('patch logout',e)}

    try{
      const remove=[];
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)||'';
        const low=key.toLowerCase();
        if((low.startsWith('sb-')&&low.includes('auth-token'))||low.includes('supabase.auth.token')){
          remove.push(key);
        }
      }
      remove.forEach(k=>localStorage.removeItem(k));
      sessionStorage.clear();
    }catch(_){}

    try{localStorage.setItem('saiko_patch_seen','22.4')}catch(_){}
    const url=new URL(window.location.origin+window.location.pathname);
    url.searchParams.set('patch','22.4');
    url.searchParams.set('login','required');
    window.location.replace(url.toString());
  }

  async function checkPatch(){
    if(checking||patchRequired)return;
    checking=true;
    try{
      const res=await fetch(`/patch-version.json?t=${Date.now()}`,{
        cache:'no-store',
        headers:{'cache-control':'no-cache'}
      });
      if(!res.ok)return;
      const info=await res.json();
      const latest=String(info?.version||'').trim();
      if(latest&&latest!==CURRENT_PATCH)showPatchRequired(info);
    }catch(_){
      // Silent by design. A temporary network error must not block the app.
    }finally{
      checking=false;
    }
  }

  // Initial check is delayed so login/app rendering remains fast.
  setTimeout(checkPatch,500);
  intervalId=setInterval(checkPatch,CHECK_EVERY_MS);

  // Also check immediately when a user returns to the tab; no polling while hidden is added.
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')checkPatch();
  },{passive:true});

  window.addEventListener('online',checkPatch,{passive:true});

  window.checkForSaikoPatch=checkPatch;
})();
