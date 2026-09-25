// SAIKO Construction AI v22.5 — unified system release gate
// Detects ONLY true software/system releases:
// 1) new web/API deployment
// 2) explicit database release bumps from migrations
// Normal For Quotation Google Sheet data changes NEVER trigger logout/reCAPTCHA.
(function(){
  const CURRENT_PATCH='27.0';
  const CHECK_EVERY_MS=10*1000;
  const APP_DEPLOY_KEY='saiko_seen_deployment';
  const DB_RELEASE_KEY='saiko_seen_db_release';
  let checking=false;
  let patchRequired=false;

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
          <h2>Refresh Required</h2>
          <p id="patchRequiredMessage">A system component changed. Refresh is required before continuing.</p>
          <p class="patch-required-note">You will be signed out and returned to Login. Please log in again manually and complete reCAPTCHA.</p>
        </div>
        <div class="dialog-actions patch-required-actions">
          <button id="patchRefreshLoginBtn" type="button" class="primary-btn">Refresh & Login Again</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    $('patchRefreshLoginBtn').onclick=logoutAndRefresh;
    return dlg;
  }

  function showRequired(message){
    if(patchRequired)return;
    patchRequired=true;
    const dlg=ensurePatchDialog();
    const msg=$('patchRequiredMessage');
    if(msg)msg.textContent=message||'A system component changed. Refresh is required before continuing.';
    document.documentElement.classList.add('patch-required-active');
    try{if(!dlg.open)dlg.showModal()}catch(_){dlg.setAttribute('open','')}
  }

  async function logoutAndRefresh(){
    const btn=$('patchRefreshLoginBtn');
    if(btn){btn.disabled=true;btn.textContent='Signing out…'}

    try{
      if(window.sb?.auth?.signOut)await window.sb.auth.signOut({scope:'local'});
    }catch(e){console.warn('release logout',e)}

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
      localStorage.setItem('saiko_patch_seen',CURRENT_PATCH);
    }catch(_){}

    const url=new URL(window.location.origin+window.location.pathname);
    url.searchParams.set('patch',CURRENT_PATCH);
    url.searchParams.set('login','required');
    window.location.replace(url.toString());
  }

  async function checkDeployment(){
    try{
      const r=await fetch(`/api/system-version?t=${Date.now()}`,{
        cache:'no-store',
        headers:{'cache-control':'no-cache'}
      });
      if(!r.ok)return;
      const info=await r.json();
      const deployment=String(info?.deployment||'').trim();
      if(!deployment)return;

      const seen=localStorage.getItem(APP_DEPLOY_KEY);
      if(!seen){
        localStorage.setItem(APP_DEPLOY_KEY,deployment);
        return;
      }
      if(seen!==deployment){
        localStorage.setItem(APP_DEPLOY_KEY,deployment);
        showRequired('A new website/API deployment is live. Refresh and log in again before continuing.');
      }
    }catch(_){}
  }

  async function checkDatabaseRelease(){
    // Dedicated release row only; ordinary app data changes are ignored here.
    if(!window.currentUser || !window.sb?.from)return;
    try{
      const {data,error}=await window.sb
        .from('system_release_state')
        .select('release_no,release_label,changed_at')
        .eq('id',1)
        .maybeSingle();

      if(error || !data)return;
      const current=String(data.release_no ?? '').trim();
      if(!current)return;

      const seen=localStorage.getItem(DB_RELEASE_KEY);
      if(!seen){
        localStorage.setItem(DB_RELEASE_KEY,current);
        return;
      }
      if(seen!==current){
        localStorage.setItem(DB_RELEASE_KEY,current);
        showRequired(`Database/system update detected: ${data.release_label||'new release'}. Refresh and log in again before continuing.`);
      }
    }catch(_){}
  }

  async function checkSystem(){
    if(checking||patchRequired)return;
    checking=true;
    try{
      await checkDeployment();
      if(!patchRequired)await checkDatabaseRelease();
    }finally{
      checking=false;
    }
  }

  setTimeout(checkSystem,500);
  setInterval(checkSystem,CHECK_EVERY_MS);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')checkSystem();
  },{passive:true});
  window.addEventListener('online',checkSystem,{passive:true});

  window.checkForSaikoPatch=checkSystem;
})();
