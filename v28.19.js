// CONSTRUCTION MONITORING v28.19
// Auto-mirrored Subcon rows + percentage conversion + Budget report.
(function(){
  const n=v=>{
    const x=Number(String(v??0).replace(/,/g,'').replace(/%/g,'').trim());
    return Number.isFinite(x)?x:0;
  };
  const norm=v=>String(v??'').trim().toLowerCase();

  function activeProjectId(){
    return $('workspaceProject')?.value||'';
  }

  function project(pid){
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }

  function isSubconForm(){
    return $('bType')?.value==='Subcontractor Billing';
  }

  function subconContract(pid){
    return Math.max(0,n(project(pid)?.subcon_contract_amount));
  }

  function syncSubconBillingPercent(){
    const field=$('bAccomplishment');
    if(!field)return;

    if(!isSubconForm()){
      field.readOnly=false;
      field.title='';
      return;
    }

    const pid=$('bProject')?.value||activeProjectId();
    const contract=subconContract(pid);
    const gross=Math.max(0,n($('bGross')?.value));
    const pct=contract>0?(gross/contract*100):0;

    field.value=pct.toFixed(4);
    field.readOnly=true;
    field.title='Auto: Subcon Billing Amount ÷ Subcon Contract Amount × 100';

    // A typed non-zero deduction rate automatically becomes applicable.
    if(n($('bRetention')?.value)>0 && $('bUseRetention')){
      $('bUseRetention').checked=true;
    }
    if(n($('bRecoup')?.value)>0 && $('bUseRecoupment')){
      $('bUseRecoupment').checked=true;
    }

    const note=$('billingRuleNote');
    if(note){
      note.innerHTML=
        `<strong>Subcon Billing:</strong> Billing % is automatic: `+
        `${money(gross)} ÷ ${money(contract)} = <strong>${pct.toFixed(2)}%</strong>. `+
        `Retention and Recoupment are deducted from this billing amount; use Add Issued Amount to record the actual payment.`;
    }
  }

  // Keep the current dialog but make Subcon percentage automatic.
  ['bGross','bProject','bRetention','bRecoup'].forEach(id=>{
    const el=$(id);
    if(!el)return;
    el.addEventListener('input',syncSubconBillingPercent,{passive:true});
    el.addEventListener('change',syncSubconBillingPercent,{passive:true});
  });
  $('bType')?.addEventListener('change',()=>requestAnimationFrame(syncSubconBillingPercent),{passive:true});

  // Ensure the auto percentage is set before the existing save handler reads it.
  $('billingForm')?.addEventListener('submit',()=>{
    syncSubconBillingPercent();
  },true);

  const priorEdit=window.editBilling;
  window.editBilling=function(id){
    const out=priorEdit?.apply(this,arguments);
    requestAnimationFrame(syncSubconBillingPercent);
    return out;
  };

  // ---------------- Detailed Budget-only Subcon report ----------------
  function billingLabel(b){
    if(b?.billing_category==='Downpayment')return `Downpayment ${b.billing_no||'DP'}`;
    if(b?.variation_no)return `VO ${b.variation_no}`;
    return `Billing ${b?.billing_no||'—'}`;
  }

  function rowsForProject(pid){
    return (cache.billings||[]).filter(b=>String(b.project_id)===String(pid));
  }

  function renderSubconBudgetReport(){
    const host=$('budgetSummaryTable');
    if(!host)return;

    host.querySelector('[data-v2819-subcon-report]')?.remove();

    const pid=activeProjectId();
    if(!pid)return;

    const p=project(pid)||{};
    const contract=Math.max(0,n(p.subcon_contract_amount));
    const all=rowsForProject(pid);
    const genMap=new Map(
      all.filter(b=>b.billing_type!=='Subcontractor Billing')
         .map(b=>[String(b.id),b])
    );

    const rows=all
      .filter(b=>b.billing_type==='Subcontractor Billing')
      .slice()
      .sort((a,b)=>{
        const ga=genMap.get(String(a.source_gencon_billing_id||'')),
              gb=genMap.get(String(b.source_gencon_billing_id||''));
        const da=String(ga?.date_request||ga?.date_submitted||a.date_request||a.created_at||'');
        const db=String(gb?.date_request||gb?.date_submitted||b.date_request||b.created_at||'');
        if(da!==db)return da.localeCompare(db);
        return String(a.created_at||'').localeCompare(String(b.created_at||''));
      });

    let cumulativeGross=0;
    let totalRetention=0;
    let totalRecoupment=0;
    let totalNet=0;
    let totalPaid=0;

    const tableRows=rows.map(b=>{
      const gen=genMap.get(String(b.source_gencon_billing_id||''));
      const gross=Math.max(0,n(b.gross_amount));
      const ret=Math.max(0,n(b.retention_amount));
      const rec=Math.max(0,n(b.recoupment_amount));
      const net=Math.max(0,n(b.net_due));
      const paid=Math.max(0,n(b.received_amount));
      const payableBalance=Math.max(0,net-paid);
      const pct=contract>0?gross/contract*100:0;

      cumulativeGross+=gross;
      totalRetention+=ret;
      totalRecoupment+=rec;
      totalNet+=net;
      totalPaid+=paid;

      const remaining=Math.max(0,contract-cumulativeGross);

      return `<tr>
        <td><strong>${esc(gen?billingLabel(gen):billingLabel(b))}</strong>${b.source_gencon_billing_id?'<br><small>Auto-linked</small>':'<br><small>Manual row</small>'}</td>
        <td>${esc(b.subcontractor_name||'—')}</td>
        <td>${money(gross)}</td>
        <td><strong>${pct.toFixed(2)}%</strong></td>
        <td>${money(ret)}${n(b.retention_percent)>0?`<br><small>${n(b.retention_percent).toFixed(2)}%</small>`:''}</td>
        <td>${money(rec)}${n(b.recoupment_percent)>0?`<br><small>${n(b.recoupment_percent).toFixed(2)}%</small>`:''}</td>
        <td><strong>${money(net)}</strong></td>
        <td>${money(paid)}</td>
        <td>${money(payableBalance)}</td>
        <td><strong>${money(remaining)}</strong></td>
      </tr>`;
    }).join('');

    const grossBilled=rows.reduce((s,b)=>s+Math.max(0,n(b.gross_amount)),0);
    const billedPct=contract>0?grossBilled/contract*100:0;
    const remaining=Math.max(0,contract-grossBilled);
    const unpaid=Math.max(0,totalNet-totalPaid);

    const report=document.createElement('div');
    report.setAttribute('data-v2819-subcon-report','1');
    report.className='subcon-budget-report';
    report.innerHTML=`
      <div class="subcon-budget-report-head">
        <div>
          <span>SUBCONTRACTOR BILLING REPORT</span>
          <h3>Billing, Deductions & Remaining Contract</h3>
          <p>Each GenCon billing automatically has one Subcon row. Encode the Subcon amount manually; Billing % is calculated from the Subcon Contract Amount.</p>
        </div>
        <span class="smart-badge">LIVE</span>
      </div>

      <div class="subcon-budget-summary">
        <div><span>Subcon Contract</span><strong>${money(contract)}</strong></div>
        <div><span>Gross Billed</span><strong>${money(grossBilled)}</strong><small>${billedPct.toFixed(2)}%</small></div>
        <div><span>Retention</span><strong>${money(totalRetention)}</strong></div>
        <div><span>Recoupment</span><strong>${money(totalRecoupment)}</strong></div>
        <div><span>Net Payable</span><strong>${money(totalNet)}</strong></div>
        <div><span>Issued / Paid</span><strong>${money(totalPaid)}</strong></div>
        <div><span>Unpaid Payable</span><strong>${money(unpaid)}</strong></div>
        <div class="accent"><span>Remaining Contract Balance</span><strong>${money(remaining)}</strong></div>
      </div>

      <div class="table-wrap">
        <table class="subcon-budget-table">
          <thead><tr>
            <th>GenCon Billing</th>
            <th>Subcontractor</th>
            <th>Subcon Billing Amount</th>
            <th>Billing %</th>
            <th>Retention</th>
            <th>Recoupment</th>
            <th>Net Payable</th>
            <th>Issued / Paid</th>
            <th>Payable Balance</th>
            <th>Remaining Contract</th>
          </tr></thead>
          <tbody>${tableRows||'<tr><td colspan="10" class="empty">No Subcon billing rows yet.</td></tr>'}</tbody>
        </table>
      </div>`;

    host.appendChild(report);
  }

  const priorBudget=window.renderBudget;
  window.renderBudget=function(){
    const out=priorBudget?.apply(this,arguments);
    renderSubconBudgetReport();
    return out;
  };

  requestAnimationFrame(()=>{
    syncSubconBillingPercent();
    if(document.querySelector('#budget.active-view'))renderSubconBudgetReport();
  });

  window.renderSubconBudgetReportV2819=renderSubconBudgetReport;
})();
