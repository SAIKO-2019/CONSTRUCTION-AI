// SAIKO Construction AI v24.5
// Dedicated Downpayment records + summary-only Dashboard per project.
(function(){
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};

  function category(b){
    if(b?.billing_category)return b.billing_category;
    return b?.variation_no?'VO':'Billing';
  }

  function linkedCalc(b){
    const collected=n(b.received_amount);
    const deductions=Math.max(0,n(b.subcon_total_deductions));
    const retention=collected*Math.max(0,n(b.subcon_retention_percent))/100;
    const recoupment=collected*Math.max(0,n(b.subcon_recoupment_percent))/100;
    return Math.max(0,collected-deductions-retention-recoupment);
  }

  window.renderProjectFinancialDashboard=function(){
    const body=$('dashboardProjectFinancialRows');
    if(!body)return;

    const projects=cache.projects||[];
    body.innerHTML=projects.length?projects.map(p=>{
      const rows=(cache.billings||[]).filter(b=>String(b.project_id)===String(p.id));
      const gen=rows.filter(b=>b.billing_type!=='Subcontractor Billing');
      const sub=rows.filter(b=>b.billing_type==='Subcontractor Billing');

      const dpGross=gen.filter(b=>category(b)==='Downpayment').reduce((s,b)=>s+n(b.gross_amount),0);
      const regularGross=gen.filter(b=>category(b)!=='Downpayment').reduce((s,b)=>s+n(b.gross_amount),0);
      const collected=gen.reduce((s,b)=>s+n(b.received_amount),0);
      const outstanding=gen.reduce((s,b)=>s+n(b.outstanding_amount),0);
      const linkedAvailable=gen.filter(b=>b.has_subcon).reduce((s,b)=>s+linkedCalc(b),0);
      const subconPaid=sub.reduce((s,b)=>s+n(b.received_amount),0);

      return `<tr>
        <td><strong>${esc(p.project_name)}</strong></td>
        <td>${money(n(p.contract_amount))}</td>
        <td>${money(dpGross)}</td>
        <td>${money(regularGross)}</td>
        <td>${money(collected)}</td>
        <td>${money(outstanding)}</td>
        <td>${money(linkedAvailable)}</td>
        <td>${money(subconPaid)}</td>
      </tr>`;
    }).join(''):'<tr><td colspan="8" class="empty">No financial data yet.</td></tr>';
  };

  // Keep older dashboard wrappers safe even though their old financial containers
  // are intentionally removed from the Dashboard.
  if(typeof renderDashboard==='function'){
    const base=renderDashboard;
    renderDashboard=function(){
      base();
      renderProjectFinancialDashboard();
    };
  }

  // Default category for legacy cache rows without forcing a database write.
  (cache.billings||[]).forEach(b=>{
    if(!b.billing_category)b.billing_category=b.variation_no?'VO':'Billing';
  });

  if(currentUser)renderProjectFinancialDashboard();
})();
