// SAIKO Construction AI v24.7
// Explicit subcontract contract amount + subcontract scope per selected project.
(function(){
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};

  function selectedProject(){
    const pid=$('billingProjectFilter')?.value||$('workspaceProject')?.value||'';
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }

  function loadSubconContractSetup(){
    const panel=$('subconProjectContractSetup');
    if(!panel)return;
    const party=document.querySelector('.billing-party-tab.active')?.dataset?.billingParty||'gencon';
    panel.style.display=party==='subcon'?'':'none';
    if(party!=='subcon')return;

    const p=selectedProject();
    $('subconProjectContractAmount').value=n(p?.subcon_contract_amount);
    $('subconProjectScopeCaption').value=p?.subcon_scope_caption||'';
  }

  $('saveSubconProjectContractBtn').onclick=async()=>{
    const p=selectedProject();
    if(!p)return alert('Select a project first.');
    const values={
      subcon_contract_amount:Math.max(0,n($('subconProjectContractAmount').value)),
      subcon_scope_caption:$('subconProjectScopeCaption').value.trim()||null,
      // Once a project has an explicit subcon contract, mark it dependent.
      subcon_dependency:Math.max(0,n($('subconProjectContractAmount').value))>0?'Dependent':(p.subcon_dependency||'Independent')
    };
    try{
      await q('projects','update',{id:p.id,values});
      const i=(cache.projects||[]).findIndex(x=>String(x.id)===String(p.id));
      if(i>=0)cache.projects[i]={...cache.projects[i],...values};
      if(typeof renderDashSubconSummary==='function')renderDashSubconSummary();
      if(typeof renderProjectFinancialDashboard==='function')renderProjectFinancialDashboard();
      loadSubconContractSetup();
      toast('Subcon contract amount and scope saved.');
    }catch(err){alert(err.message||'Could not save Subcon contract setup.');}
  };

  document.querySelectorAll('.billing-party-tab').forEach(btn=>{
    btn.addEventListener('click',()=>setTimeout(loadSubconContractSetup,25));
  });
  if($('billingProjectFilter'))$('billingProjectFilter').addEventListener('change',()=>setTimeout(loadSubconContractSetup,10));

  // Normalize legacy records locally until SQL migration is applied.
  (cache.projects||[]).forEach(p=>{
    if(p.subcon_contract_amount==null)p.subcon_contract_amount=0;
    if(p.subcon_scope_caption==null)p.subcon_scope_caption=null;
  });

  setTimeout(()=>{if(currentUser)loadSubconContractSetup()},250);
})();
