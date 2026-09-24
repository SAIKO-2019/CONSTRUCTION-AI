// SAIKO Construction AI v24.6
// Restore Billing Project Folder reliably; keep Billing UI from v24.4 intact.
(function(){
  const BILLING_PROJECT_KEY='saiko_project_billing';

  function validProject(id){
    return !!(id && (cache.projects||[]).some(p=>String(p.id)===String(id)));
  }

  function ensureBillingProjectSelection(){
    const sel=$('billingProjectFilter');
    if(!sel || !(cache.projects||[]).length)return;

    // If current selection is already valid, preserve it.
    if(validProject(sel.value)){
      try{localStorage.setItem(BILLING_PROJECT_KEY,sel.value)}catch(_){ }
      return;
    }

    let saved='';
    try{saved=localStorage.getItem(BILLING_PROJECT_KEY)||''}catch(_){ }
    const workspace=$('workspaceProject')?.value||'';
    const target=validProject(saved)
      ? saved
      : (validProject(workspace)?workspace:String(cache.projects[0]?.id||''));

    if(target && [...sel.options].some(o=>String(o.value)===String(target))){
      sel.value=target;
      try{localStorage.setItem(BILLING_PROJECT_KEY,target)}catch(_){ }
    }
  }

  // Wrap only refresh completion; no extra timer loop or MutationObserver.
  const baseRefresh=refreshAll;
  refreshAll=async function(){
    const before=$('billingProjectFilter')?.value||'';
    await baseRefresh();
    const sel=$('billingProjectFilter');
    if(sel && validProject(before) && [...sel.options].some(o=>String(o.value)===String(before))){
      sel.value=before;
    }else{
      ensureBillingProjectSelection();
    }
  };

  if($('billingProjectFilter')){
    $('billingProjectFilter').addEventListener('change',()=>{
      if(validProject($('billingProjectFilter').value)){
        try{localStorage.setItem(BILLING_PROJECT_KEY,$('billingProjectFilter').value)}catch(_){ }
      }
    },{passive:true});
  }

  // When Billing opens, make sure the project name/value never appears blank.
  document.querySelectorAll('[data-go="billing"], [data-view="billing"]').forEach(btn=>{
    btn.addEventListener('click',()=>setTimeout(()=>{
      ensureBillingProjectSelection();
      if(typeof renderBilling==='function')renderBilling();
    },0));
  });

  setTimeout(()=>{
    if(currentUser){
      ensureBillingProjectSelection();
      if(document.querySelector('#billing.view.active-view') && typeof renderBilling==='function')renderBilling();
    }
  },250);
})();
