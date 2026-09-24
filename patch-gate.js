// SAIKO Construction AI v21.8 — pre-boot patch gate
// Runs before the app initializes. If an existing auth session belongs to an older/unknown patch,
// clear it immediately so the user must pass the normal Login + reCAPTCHA flow again.
(function(){
  const CURRENT_PATCH='22.8';
  const SEEN_KEY='saiko_patch_seen';

  function authSessionKeys(){
    const keys=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)||'';
        const low=key.toLowerCase();
        if((low.startsWith('sb-')&&low.includes('auth-token')) || low.includes('supabase.auth.token')) keys.push(key);
      }
    }catch(_){ }
    return keys;
  }

  try{
    const seen=localStorage.getItem(SEEN_KEY);
    const authKeys=authSessionKeys();
    const hasExistingSession=authKeys.length>0;

    // First load of a new patch while an old session still exists => hard local sign-out.
    if(hasExistingSession && seen!==CURRENT_PATCH){
      authKeys.forEach(k=>localStorage.removeItem(k));
      sessionStorage.clear();
      localStorage.setItem(SEEN_KEY,CURRENT_PATCH);

      const url=new URL(window.location.href);
      url.searchParams.set('login','required');
      url.searchParams.set('patch',CURRENT_PATCH);
      window.location.replace(url.toString());
      return;
    }

    // No old session: mark this patch as acknowledged so the user can log in normally.
    if(seen!==CURRENT_PATCH)localStorage.setItem(SEEN_KEY,CURRENT_PATCH);
  }catch(_){ }
})();
