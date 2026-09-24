// SAIKO Construction AI v15.7 — global button & session stability layer
(function(){
  const $=id=>document.getElementById(id);
  const toggle=$('togglePasswordBtn'), pass=$('loginPassword');
  if(toggle&&pass)toggle.onclick=()=>{const show=pass.type==='password';pass.type=show?'text':'password';toggle.textContent=show?'🙈':'👁';toggle.title=show?'Hide password':'Show password';};

  document.addEventListener('click',e=>{
    const close=e.target.closest?.('[data-close]');
    if(close){e.preventDefault();e.stopPropagation();const dlg=$(close.dataset.close);if(dlg?.open)dlg.close();else dlg?.classList?.add('hidden');return;}
    const go=e.target.closest?.('[data-go]');if(go&&typeof show==='function'){e.preventDefault();show(go.dataset.go);return;}
    const jump=e.target.closest?.('[data-jump]');if(jump&&typeof show==='function'){e.preventDefault();show(jump.dataset.jump);return;}
  },true);

  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const open=[...document.querySelectorAll('dialog[open]')];const dlg=open[open.length-1];if(dlg){e.preventDefault();dlg.close();}});
  document.addEventListener('click',e=>{const dlg=e.target.closest?.('dialog');if(dlg&&e.target===dlg&&dlg.open){e.preventDefault();e.stopPropagation();dlg.close();}});

  const logout=$('logoutBtn');
  if(logout){logout.onclick=async e=>{e.preventDefault();if(logout.dataset.busy==='1')return;if(!confirm('Log out of SAIKO Construction AI?'))return;logout.dataset.busy='1';logout.disabled=true;const old=logout.innerHTML;logout.innerHTML='…';try{if(typeof hideMyPresence==='function')await hideMyPresence();const {error}=await sb.auth.signOut();if(error)throw error;location.reload();}catch(err){alert('Logout failed: '+(err?.message||err));logout.disabled=false;logout.dataset.busy='0';logout.innerHTML=old;}};}

  function hardenClicks(){
    document.querySelectorAll('button,a,input,select,textarea,[role="button"],[data-close],[data-go],[data-jump]').forEach(el=>{el.style.pointerEvents='auto';});
    document.querySelectorAll('.dialog-head,.dialog-actions,.panel-head,.profile-actions,.live-panel-actions').forEach(el=>{el.style.pointerEvents='auto';if(getComputedStyle(el).position==='static')el.style.position='relative';el.style.zIndex='20';});
  }
  hardenClicks();new MutationObserver(hardenClicks).observe(document.body,{subtree:true,childList:true});
})();
