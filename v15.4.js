// SAIKO Construction AI v15.4 — executive live panel
(function(){
  const $=id=>document.getElementById(id);
  const themeOrder=['light','dark','midnight','pastel','cute','summer','glass','executive'];
  window.SAIKO_THEME_ORDER=themeOrder;

  async function updateOnlineCount(){
    if(typeof currentUser==='undefined' || !currentUser || typeof sb==='undefined')return;
    const cutoff=new Date(Date.now()-5*60*1000).toISOString();
    try{
      const {data,error}=await sb.from('collaboration_presence').select('user_id,last_seen').gte('last_seen',cutoff);
      if(error)throw error;
      const n=(data||[]).length;
      const badge=$('sidebarOnlineCount');
      if(badge){ badge.textContent=String(n); badge.style.display=n?'grid':'none'; }
    }catch(e){ console.warn('online count',e); }
  }

  const collapseBtn=$('collapseSettingsTeamBtn');
  if(collapseBtn){
    collapseBtn.onclick=()=>{
      const card=document.querySelector('#settingsDialog .settings-dialog-card');
      if(!card)return;
      card.classList.toggle('team-collapsed');
      collapseBtn.title=card.classList.contains('team-collapsed')?'Expand live team panel':'Collapse live team panel';
    };
  }

  // ensure theme select knows about the new themes immediately
  const select=$('settingsTheme');
  if(select){
    ['glass','executive'].forEach(v=>{
      if(![...select.options].some(o=>o.value===v)){
        const o=document.createElement('option');o.value=v;o.textContent=v==='glass'?'Glass Ultra':'Executive Dark';select.appendChild(o);
      }
    });
  }

  // Extend quick theme behavior from v15 by intercepting and using full list
  const quick=$('quickThemeBtn');
  if(quick){
    quick.onclick=async()=>{
      if(!window.currentUser)return;
      const current=window.cache?.userPreferences?.theme||'light';
      const resolved=current==='system'?(document.documentElement.dataset.theme||'light'):current;
      const idx=Math.max(0,themeOrder.indexOf(resolved));
      const next=themeOrder[(idx+1)%themeOrder.length];
      if(typeof applyTheme==='function')applyTheme(next);else document.documentElement.dataset.theme=next;
      document.querySelectorAll('.theme-preview').forEach(btn=>btn.classList.toggle('active',btn.dataset.themeChoice===next));
      if(select)select.value=next;
      if(window.cache?.userPreferences){
        const row={...window.cache.userPreferences,theme:next,user_id:window.currentUser.id,updated_at:new Date().toISOString()};
        const {error}=await window.sb.from('user_preferences').upsert(row,{onConflict:'user_id'});
        if(!error){window.cache.userPreferences=row;if(typeof toast==='function')toast(`Theme: ${next}`);}
      }
    };
  }

  setTimeout(()=>updateOnlineCount().catch(()=>{}),1000);
  setInterval(()=>updateOnlineCount().catch(()=>{}),30000);
})();
