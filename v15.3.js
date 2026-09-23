// SAIKO Construction AI v15.3 — readable dialogs + always-visible online icons
(function(){
  const $=id=>document.getElementById(id);
  const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const initials=name=>String(name||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'U';
  function ago(ts){
    if(!ts)return'';
    const sec=Math.max(0,Math.round((Date.now()-new Date(ts).getTime())/1000));
    if(sec<60)return `${sec}s ago`;
    if(sec<3600)return `${Math.floor(sec/60)}m ago`;
    if(sec<86400)return `${Math.floor(sec/3600)}h ago`;
    return `${Math.floor(sec/86400)}d ago`;
  }
  function hardenDialog(dialogId, innerSelector){
    const dlg=$(dialogId); if(!dlg) return;
    const card=dlg.querySelector(innerSelector); if(!card) return;
    dlg.style.width='min(1440px, 98vw)';
    dlg.style.maxWidth='98vw';
    dlg.style.maxHeight='94vh';
    dlg.style.overflow='hidden';
    card.style.width='100%';
    card.style.maxWidth='none';
    card.style.height='min(90vh, 900px)';
    card.style.maxHeight='90vh';
    card.style.overflowX='clip';
    card.style.scrollLeft=0;
    const killers=card.querySelectorAll('*');
    killers.forEach(el=>{
      el.style.maxWidth='100%';
      if(el.scrollWidth>el.clientWidth+6 && getComputedStyle(el).overflowX!=='visible') el.scrollLeft=0;
    });
  }
  async function loadPresence(){
    if(typeof currentUser==='undefined' || !currentUser || typeof sb==='undefined') return [];
    const cutoff=new Date(Date.now()-5*60*1000).toISOString();
    const {data,error}=await sb.from('collaboration_presence').select('*').gte('last_seen',cutoff).order('last_seen',{ascending:false});
    if(error){ console.warn('presence load', error); return []; }
    return data||[];
  }
  async function renderTopPresence(){
    const rail=$('topPresenceRail'); if(!rail) return;
    const holder=rail.querySelector('.presence-avatars'); if(!holder) return;
    const pres=await loadPresence();
    if(!pres.length){ holder.innerHTML='<span class="presence-empty">No one online yet</span>'; return; }
    const shown=pres.slice(0,5);
    let html='<span class="presence-rail-label">Online</span>';
    html+=shown.map(p=>{
      const idle=Date.now()-new Date(p.last_seen).getTime()>90000;
      const you=p.user_id===currentUser.id;
      const title=`${p.display_name||'User'}${you?' (You)':''} • ${p.module||'dashboard'} • ${ago(p.last_seen)}`;
      return `<button type="button" class="presence-avatar ${idle?'idle':''}" title="${safe(title)}" data-open-team="1">${safe(initials(p.display_name))}</button>`;
    }).join('');
    if(pres.length>shown.length){ html+=`<button type="button" class="presence-avatar more" title="${pres.length-shown.length} more online" data-open-team="1">+${pres.length-shown.length}</button>`; }
    holder.innerHTML=html;
    holder.querySelectorAll('[data-open-team]').forEach(btn=>btn.onclick=()=>$('teamActivityBtn')?.click());
  }

  // Wrap existing open handlers so the dialogs open wide and clean
  [['settingsBtn','settingsDialog','.settings-dialog-card'],['teamActivityBtn','teamActivityDialog','.collaboration-dialog-card']].forEach(([btnId,dlgId,sel])=>{
    const btn=$(btnId); if(!btn) return;
    const old=btn.onclick;
    btn.onclick=async function(ev){
      if(old) await old.call(this,ev);
      setTimeout(()=>hardenDialog(dlgId,sel),30);
      setTimeout(()=>hardenDialog(dlgId,sel),220);
      if(dlgId==='settingsDialog' && typeof refreshSettingsTeamPanel==='function') setTimeout(()=>refreshSettingsTeamPanel(),60);
      if(dlgId==='teamActivityDialog' && typeof refreshTeamActivity==='function') setTimeout(()=>refreshTeamActivity(),60);
    };
  });

  // expose function for v15.2 hook if needed
  window.refreshTopPresenceRail=renderTopPresence;
  window.hardenSettingsAndTeamDialogs=function(){
    hardenDialog('settingsDialog','.settings-dialog-card');
    hardenDialog('teamActivityDialog','.collaboration-dialog-card');
  };

  setTimeout(()=>{ renderTopPresence().catch(()=>{}); },1200);
  setInterval(()=>{ renderTopPresence().catch(()=>{}); },30000);
  window.addEventListener('resize',()=>window.hardenSettingsAndTeamDialogs());
})();
