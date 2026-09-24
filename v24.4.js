// SAIKO Construction AI v24.4 — performance guard
(function(){
  // Avoid duplicate click work when controls are clicked rapidly.
  let lastPartyClick=0;
  document.querySelectorAll('.billing-party-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{lastPartyClick=performance.now()},{passive:true});
  });

  // Existing-record defaults are cheap and applied once; SQL backfill persists them.
  if(Array.isArray(cache.billings)){
    cache.billings.forEach(b=>{
      if(b.has_subcon==null)b.has_subcon=false;
      if(b.subcon_total_deductions==null)b.subcon_total_deductions=0;
      if(b.subcon_retention_percent==null)b.subcon_retention_percent=0;
      if(b.subcon_recoupment_percent==null)b.subcon_recoupment_percent=0;
    });
  }
})();
