// SAIKO Construction AI v24.3
// Clean Subcon folder: show only the linked summary cards to reduce clutter.
(function(){
  function activeParty(){
    return document.querySelector('.billing-party-tab.active')?.dataset?.billingParty || 'gencon';
  }

  function tablePanel(){
    const rows=$('billingRows');
    return rows ? rows.closest('.panel') : null;
  }

  function ensureStyle(){
    if(document.getElementById('v24_3_clean_style')) return;
    const style=document.createElement('style');
    style.id='v24_3_clean_style';
    style.textContent=`
      #linkedSubconPanel.clean-subcon-only { margin-top: 12px; }
      #linkedSubconPanel.clean-subcon-only .panel-head { display:none; }
      #linkedSubconPanel.clean-subcon-only #linkedSubconRows { display:grid; gap:14px; }
      #linkedSubconPanel.clean-subcon-only .linked-subcon-card { margin:0; }
    `;
    document.head.appendChild(style);
  }

  function applySubconCleanView(){
    ensureStyle();
    const party=activeParty();
    const panel=$('linkedSubconPanel');
    const kpis=$('billingKPIs');
    const settings=$('subconCommercialSettings');
    const table=tablePanel();
    const addBtn=$('addBillingBtn');

    if(party==='subcon'){
      if(panel){
        panel.hidden=false;
        panel.classList.add('clean-subcon-only');
      }
      if(kpis)kpis.style.display='none';
      if(settings)settings.style.display='none';
      if(table)table.style.display='none';
      if(addBtn)addBtn.style.display='none';
    }else{
      if(panel)panel.classList.remove('clean-subcon-only');
      if(kpis)kpis.style.display='grid';
      if(table)table.style.display='';
      if(addBtn)addBtn.style.display='';
      // leave subcon settings to v23.8 logic (hidden on gencon)
      if(settings)settings.style.display='none';
    }
  }

  const prevRenderBilling=renderBilling;
  renderBilling=function(){
    prevRenderBilling();
    applySubconCleanView();
  };

  document.querySelectorAll('.billing-party-tab').forEach(btn=>{
    btn.addEventListener('click',()=>setTimeout(applySubconCleanView,40));
  });
  if($('billingProjectFilter')) $('billingProjectFilter').addEventListener('change',()=>setTimeout(applySubconCleanView,20));

  setTimeout(()=>{ if(currentUser) applySubconCleanView(); }, 300);
})();
