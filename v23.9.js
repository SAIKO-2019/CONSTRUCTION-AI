// SAIKO Construction AI v23.9
// Color-coded GenCon/Subcon folders + side transition.
(function(){
  function applyBillingPartyTheme(){
    const billing=$('billing');
    if(!billing)return;
    const active=document.querySelector('.billing-party-tab.active')?.dataset?.billingParty||'gencon';
    billing.classList.toggle('billing-mode-gencon',active==='gencon');
    billing.classList.toggle('billing-mode-subcon',active==='subcon');

    const table=document.querySelector('#billingRows')?.closest('.table-wrap, .panel, table');
    if(table){
      table.classList.remove('billing-table-switch');
      void table.offsetWidth;
      table.classList.add('billing-table-switch');
      setTimeout(()=>table.classList.remove('billing-table-switch'),380);
    }
  }

  document.querySelectorAll('.billing-party-tab').forEach(btn=>{
    btn.addEventListener('click',()=>setTimeout(applyBillingPartyTheme,20));
  });

  // Apply once on load; folder-click handlers above handle future transitions.
  // Avoid wrapping renderBilling, so background data refreshes do not restart animations.
  setTimeout(applyBillingPartyTheme,250);
})();
