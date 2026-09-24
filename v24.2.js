// SAIKO Construction AI v24.2
// Existing-record compatibility: new UI features must work on old records immediately.
(function(){
  function normalizeBilling(b){
    if(!b)return b;
    return {
      ...b,
      has_subcon:!!b.has_subcon,
      subcon_total_deductions:Number(b.subcon_total_deductions||0),
      subcon_retention_percent:Number(b.subcon_retention_percent||0),
      subcon_recoupment_percent:Number(b.subcon_recoupment_percent||0),
      issued_amount:Number(b.issued_amount||0),
      subcontract_balance:Number(b.subcontract_balance||0)
    };
  }

  function normalizeProject(p){
    if(!p)return p;
    return {
      ...p,
      subcon_dependency:p.subcon_dependency||'Independent',
      subcon_markup_percent:Number(p.subcon_markup_percent||0),
      subcon_other_deductions:Number(p.subcon_other_deductions||0)
    };
  }

  function normalizeCache(){
    if(Array.isArray(cache.billings)) cache.billings=cache.billings.map(normalizeBilling);
    if(Array.isArray(cache.projects)) cache.projects=cache.projects.map(normalizeProject);
  }

  // Normalize after every data load, so legacy rows instantly support new UI.
  const baseRefresh=refreshAll;
  refreshAll=async function(){
    await baseRefresh();
    normalizeCache();

    const active=document.querySelector('.view.active-view')?.id;
    if(active==='billing' && typeof renderBilling==='function')renderBilling();
    if(active==='dashboard' && typeof renderDashboard==='function')renderDashboard();
    if(active==='projects' && typeof renderProjects==='function')renderProjects();
  };

  // Existing GenCon records are derived directly into Subcon view.
  // No record copy / delete / re-upload / re-create is required.
  function forceLinkedSubconRender(){
    normalizeCache();
    if(typeof renderLinkedSubcon==='function')renderLinkedSubcon();
    if(typeof renderBilling==='function' && document.querySelector('.view.active-view')?.id==='billing')renderBilling();
  }

  document.querySelectorAll('.billing-party-tab').forEach(btn=>{
    btn.addEventListener('click',()=>setTimeout(forceLinkedSubconRender,40));
  });

  if($('billingProjectFilter')){
    $('billingProjectFilter').addEventListener('change',()=>setTimeout(forceLinkedSubconRender,20));
  }

  // Re-evaluate immediately after payment/save/edit without requiring recreation.
  ['billingDialog','paymentDialog','linkedSubconDialog'].forEach(id=>{
    const dlg=$(id);
    if(dlg){
      dlg.addEventListener('close',()=>setTimeout(forceLinkedSubconRender,50));
    }
  });

  normalizeCache();
  setTimeout(()=>{if(currentUser)forceLinkedSubconRender()},300);
})();
