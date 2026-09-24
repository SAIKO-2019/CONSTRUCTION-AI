// SAIKO Construction AI v15.9 — authenticated database refresh guard
(function(){
  // Remove stale misleading startup toasts if a legacy cached script created one
  // while no user is authenticated.
  function removeLegacyDbToast(){
    if(typeof currentUser!=='undefined' && currentUser) return;
    [...document.body.querySelectorAll('div')].forEach(el=>{
      const t=(el.textContent||'').trim();
      if(t==='Database tables are not ready. Run supabase-setup.sql.'){
        el.remove();
      }
    });
  }
  setTimeout(removeLegacyDbToast,700);
  setTimeout(removeLegacyDbToast,1400);
  setTimeout(removeLegacyDbToast,2600);
})();
