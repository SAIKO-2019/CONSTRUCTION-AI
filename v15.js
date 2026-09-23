// SAIKO Construction AI v15 Ultra UI
(function(){
  const themeOrder=['light','dark','midnight','pastel','cute','summer'];
  function qs(sel,root=document){return root.querySelector(sel)}
  function qsa(sel,root=document){return [...root.querySelectorAll(sel)]}

  function syncThemeCards(theme){
    qsa('.theme-preview').forEach(btn=>btn.classList.toggle('active',btn.dataset.themeChoice===theme));
  }

  function previewTheme(theme){
    if(typeof applyTheme==='function') applyTheme(theme);
    else document.documentElement.dataset.theme=theme;
    syncThemeCards(theme);
    const select=document.getElementById('settingsTheme');
    if(select) select.value=theme;
  }

  document.addEventListener('click',e=>{
    const card=e.target.closest('.theme-preview');
    if(!card)return;
    previewTheme(card.dataset.themeChoice);
  });

  const themeSelect=document.getElementById('settingsTheme');
  if(themeSelect){
    themeSelect.addEventListener('change',()=>{
      const val=themeSelect.value;
      if(val==='system'){
        if(typeof applyTheme==='function')applyTheme('system');
        syncThemeCards('');
      }else previewTheme(val);
    });
  }

  const settingsBtn=document.getElementById('settingsBtn');
  if(settingsBtn){
    const old=settingsBtn.onclick;
    settingsBtn.onclick=function(ev){
      if(old) old.call(this,ev);
      setTimeout(()=>{
        const t=(window.cache?.userPreferences?.theme||'system');
        syncThemeCards(t==='system'?'':t);
      },0);
    };
  }

  const quick=document.getElementById('quickThemeBtn');
  if(quick){
    quick.onclick=async()=>{
      if(!window.currentUser)return;
      const current=window.cache?.userPreferences?.theme||'light';
      const currentResolved=current==='system'?(document.documentElement.dataset.theme||'light'):current;
      const idx=Math.max(0,themeOrder.indexOf(currentResolved));
      const next=themeOrder[(idx+1)%themeOrder.length];
      previewTheme(next);
      if(window.cache?.userPreferences){
        const row={...window.cache.userPreferences,theme:next,user_id:window.currentUser.id,updated_at:new Date().toISOString()};
        const {error}=await window.sb.from('user_preferences').upsert(row,{onConflict:'user_id'});
        if(!error){
          window.cache.userPreferences=row;
          if(typeof toast==='function')toast(`Theme: ${next[0].toUpperCase()+next.slice(1)}`);
        }
      }
    };
  }

  // keep preview selection in sync after profile preference loads
  const obs=new MutationObserver(()=>{
    const d=document.getElementById('settingsDialog');
    if(d?.open){
      const t=window.cache?.userPreferences?.theme||'system';
      syncThemeCards(t==='system'?'':t);
    }
  });
  obs.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
})();
