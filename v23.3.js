// SAIKO Construction AI v23.3
// Dashboard = summary only.
// Markup + optional deductions are edited in Billing & Payments only.
(function(){
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};

  function selectedBillingProject(){
    const pid=$('billingProjectFilter')?.value||$('workspaceProject')?.value||'';
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }

  function projectSubconStats(p){
    const rows=(cache.billings||[]).filter(b=>String(b.project_id)===String(p.id) && b.billing_type==='Subcontractor Billing');

    // Issued amount is a contract value per payee. Avoid double-counting when
    // the same subcontractor has multiple progress billings.
    const issuedByPayee=new Map();
    rows.forEach(b=>{
      const key=(String(b.subcontractor_name||'unnamed').trim().toLowerCase()||'unnamed');
      issuedByPayee.set(key,Math.max(issuedByPayee.get(key)||0,n(b.issued_amount)));
    });
    const issued=[...issuedByPayee.values()].reduce((s,v)=>s+v,0);
    const billed=rows.reduce((s,b)=>s+n(b.gross_amount),0);
    const paid=rows.reduce((s,b)=>s+n(b.received_amount),0);

    const clientContract=n(p.contract_amount);
    const markupPct=Math.max(0,n(p.subcon_markup_percent));
    // If our client contract includes our markup, back-calculate the subcontract base.
    const base=markupPct>0?clientContract/(1+markupPct/100):clientContract;
    const deductions=Math.max(0,n(p.subcon_other_deductions));
    const totalAllocation=Math.max(0,base-deductions);
    const remaining=Math.max(0,totalAllocation-issued);
    const unpaid=Math.max(0,billed-paid);
    return {clientContract,markupPct,base,deductions,totalAllocation,issued,billed,paid,remaining,unpaid};
  }

  function renderBillingCommercialSettings(){
    const panel=$('subconCommercialSettings');
    if(!panel)return;
    const p=selectedBillingProject();
    if(!p){panel.style.display='none';return;}

    // Show settings for any project, but highlight Dependent projects naturally via data.
    panel.style.display='';
    $('billingSubconMarkup').value=n(p.subcon_markup_percent);
    $('billingSubconDeductions').value=n(p.subcon_other_deductions);
    $('billingSubconDeductionNotes').value=p.subcon_deduction_notes||'';

    const s=projectSubconStats(p);
    $('billingSubconCommercialSummary').innerHTML=[
      ['Total Subcon Allocation',money(s.totalAllocation)],
      ['Issued to Subcon',money(s.issued)],
      ['Subcon Billed',money(s.billed)],
      ['Subcon Paid',money(s.paid)],
      ['Remaining to Issue',money(s.remaining)],
      ['Unpaid Subcon Billing',money(s.unpaid)]
    ].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  }

  async function saveBillingCommercialSettings(){
    const p=selectedBillingProject();
    if(!p)return alert('Select a project first.');
    const values={
      subcon_markup_percent:Math.max(0,n($('billingSubconMarkup').value)),
      subcon_other_deductions:Math.max(0,n($('billingSubconDeductions').value)),
      subcon_deduction_notes:$('billingSubconDeductionNotes').value.trim()||null
    };
    try{
      await q('projects','update',{id:p.id,values});
      await refreshAll();
      renderBillingCommercialSettings();
      renderDashboard();
      toast('Subcontract commercial settings saved.');
    }catch(err){alert(err.message||'Could not save subcontract settings.');}
  }

  $('saveSubconCommercialBtn').onclick=saveBillingCommercialSettings;
  $('billingProjectFilter').addEventListener('change',()=>setTimeout(renderBillingCommercialSettings,0));
  if($('workspaceProject'))$('workspaceProject').addEventListener('change',()=>setTimeout(renderBillingCommercialSettings,0));

  window.renderDashSubconSummary=function(){
    const tbody=$('dashSubconSummaryRows');
    if(!tbody)return;
    const projects=(cache.projects||[]).filter(p=>p.subcon_dependency==='Dependent');
    tbody.innerHTML=projects.length?projects.map(p=>{
      const s=projectSubconStats(p);
      return `<tr>
        <td><strong>${esc(p.project_name)}</strong></td>
        <td>${money(s.totalAllocation)}</td>
        <td>${money(s.issued)}</td>
        <td>${money(s.billed)}</td>
        <td>${money(s.paid)}</td>
        <td><strong>${money(s.remaining)}</strong></td>
      </tr>`;
    }).join(''):'<tr><td colspan="6" class="empty">No subcontract-dependent projects yet.</td></tr>';
  };

  // Keep existing billing renderer, then refresh the settings panel.
  const oldBilling=renderBilling;
  renderBilling=function(){
    oldBilling();
    renderBillingCommercialSettings();
  };

  // Dashboard remains summary only.
  const oldDashboard=renderDashboard;
  renderDashboard=function(){
    oldDashboard();
    renderDashSubconSummary();
  };

  if(currentUser){
    renderBillingCommercialSettings();
    renderDashSubconSummary();
  }
})();
