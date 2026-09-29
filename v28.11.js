// Construction Monitoring v28.11
// Unified PHP financial computation for Billing + Budget + live shared data.
(function(){
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const pct=v=>`${Math.max(0,n(v)).toFixed(2)}%`;
  const pid=()=> $('billingProjectFilter')?.value || $('budgetProject')?.value || $('workspaceProject')?.value || '';
  const proj=id=>(cache.projects||[]).find(p=>String(p.id)===String(id))||null;
  const bills=id=>(cache.billings||[]).filter(b=>String(b.project_id)===String(id) && b.billing_type!=='Subcontractor Billing');
  const cat=b=>b.billing_category || (b.variation_no?'VO':'Billing');
  const isDP=b=>cat(b)==='Downpayment';
  const actual=id=>{
    const s=(cache.actualSeries||[]).filter(r=>String(r.project_id)===String(id))
      .sort((a,b)=>String(a.progress_date).localeCompare(String(b.progress_date)));
    if(s.length)return n(s.at(-1).cumulative_percent);
    return typeof window.actualForProject==='function'?n(window.actualForProject(id)):0;
  };
  function latestBilling(id){
    return bills(id).filter(b=>cat(b)==='Billing')
      .sort((a,b)=>n(b.accomplishment_percent)-n(a.accomplishment_percent))[0]||null;
  }
  function subcon(id){
    const p=proj(id)||{};
    const linked=bills(id).filter(b=>b.has_subcon);
    const contract=n(p.subcon_contract_amount);
    const dpIssue=linked.filter(isDP).reduce((s,b)=>s+n(b.subcon_amount_to_issue),0) || contract*.30;
    const issued=linked.filter(b=>!isDP(b)).reduce((s,b)=>s+n(b.subcon_amount_to_issue),0);
    const retentionPct=(linked.map(b=>n(b.subcon_retention_percent)).filter(Boolean).at(-1)) || (contract?10:0);
    const retention=contract*retentionPct/100;
    const remaining=Math.max(0,contract-dpIssue-issued-retention);
    const paid=(cache.subconPayments||[]).filter(sp=>{
      const b=(cache.billings||[]).find(x=>String(x.id)===String(sp.billing_id));
      return b && String(b.project_id)===String(id);
    }).reduce((s,x)=>s+n(x.amount),0);
    return {contract,dpIssue,issued,retentionPct,retention,remaining,paid};
  }
  function calc(id){
    const p=proj(id)||{};
    const rows=bills(id);
    const regular=rows.filter(b=>!isDP(b));
    const dp=rows.filter(isDP);
    const contract=n(p.contract_amount||p.total_contract_amount);
    const dpReceived=dp.reduce((s,b)=>s+n(b.received_amount||b.gross_amount),0);
    const totalReceived=regular.reduce((s,b)=>s+n(b.received_amount),0); // DP excluded
    const accum=regular.filter(b=>cat(b)==='Billing').reduce((m,b)=>Math.max(m,n(b.accomplishment_percent)),0);
    const unpaid=regular.reduce((s,b)=>s+n(b.outstanding_amount),0);
    const currentActual=actual(id);
    const pending=Math.max(0,currentActual-accum);
    const rate=latestBilling(id)||{};
    const retPct=n(rate.retention_percent);
    const recPct=n(rate.recoupment_percent);
    const pendingGross=contract*pending/100;
    const recoup=pendingGross*recPct/100;
    const retention=pendingGross*retPct/100;
    const nextNet=Math.max(0,pendingGross-recoup-retention);
    const needToCollect=Math.max(0,regular.reduce((s,b)=>s+n(b.outstanding_amount),0));
    const inv=(cache.inventory||[]).filter(r=>String(r.project_id)===String(id));
    const running=inv.reduce((s,r)=>s+n(r.total_amount),0);
    const projectedBudget=n(p.projected_budget||p.budget_amount||p.contract_amount);
    const projectedRemain=Math.max(0,projectedBudget-running);
    const sub=subcon(id);
    return {contract,dpReceived,totalReceived,accum,unpaid,needToCollect,currentActual,pending,pendingGross,
      recPct,recoup,retPct,retention,nextNet,running,projectedBudget,projectedRemain,sub};
  }
  function cell(label,value,cls=''){
    return `<div class="lfc-cell ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
  }
  function render(target,id){
    const el=$(target); if(!el||!id)return;
    const f=calc(id);
    el.innerHTML=`
      <section class="lfc-card">
        <div class="lfc-head"><div><span>CLIENT BILLING CONTROL</span><h3>Live Contract & Collection</h3></div><b>PHP</b></div>
        <div class="lfc-grid">
          ${cell('Total Contract Amount',money(f.contract))}
          ${cell('Down Payment Received',money(f.dpReceived))}
          ${cell('Total Collected — Excl. DP',money(f.totalReceived))}
          ${cell('Billing Accumulated',pct(f.accum))}
          ${cell('Unpaid Amount',money(f.unpaid))}
          ${cell('Need to Collect',money(f.needToCollect),'highlight')}
        </div>
      </section>

      <section class="lfc-card">
        <div class="lfc-head"><div><span>NEXT BILLING COMPUTATION</span><h3>Actual vs Previous Billing %</h3></div><b>LIVE</b></div>
        <div class="lfc-grid">
          ${cell('Actual Accomplishment',pct(f.currentActual))}
          ${cell('Previous Billing %',pct(f.accum))}
          ${cell('Pending Accomplishment',pct(f.pending),'highlight')}
          ${cell('Gross Amount',money(f.pendingGross))}
          ${cell(`Recoupment (${f.recPct.toFixed(2)}%)`,money(f.recoup),'negative')}
          ${cell(`Retention (${f.retPct.toFixed(2)}%)`,money(f.retention),'negative')}
          ${cell('Next Billing Net',money(f.nextNet),'strong-highlight')}
        </div>
      </section>

      <section class="lfc-card">
        <div class="lfc-head"><div><span>SUBCONTRACTOR CONTROL</span><h3>Issued Amount & Remaining Balance</h3></div><b>PHP</b></div>
        <div class="lfc-grid">
          ${cell('Subcontractor Amount',money(f.sub.contract))}
          ${cell('Issued Downpayment 30%',money(f.sub.dpIssue))}
          ${cell('Issued Amount',money(f.sub.issued))}
          ${cell(`Retention (${f.sub.retentionPct.toFixed(2)}%)`,money(f.sub.retention))}
          ${cell('Subcon Payments Recorded',money(f.sub.paid))}
          ${cell('Remaining Balance',money(f.sub.remaining),'highlight')}
        </div>
      </section>

      <section class="lfc-card">
        <div class="lfc-head"><div><span>BUDGET MONITORING</span><h3>Running Cost & Remaining Budget</h3></div><b>AUTO</b></div>
        <div class="lfc-grid">
          ${cell('Projected Total Budget',money(f.projectedBudget))}
          ${cell('Running Labor / Materials / Overhead',money(f.running))}
          ${cell('Projected Remaining Budget',money(f.projectedRemain),'highlight')}
          ${cell('Projected Running Payables',money(f.projectedRemain+f.sub.remaining))}
        </div>
      </section>`;
  }
  function renderAll(){
    const bpid=$('billingProjectFilter')?.value||$('workspaceProject')?.value||'';
    const budgetPid=$('budgetProject')?.value||$('workspaceProject')?.value||'';
    render('billingLiveFinancialControl',bpid);
    render('budgetLiveFinancialControl',budgetPid);
  }
  window.renderLiveFinancialControl=renderAll;
  const rb=window.renderBilling;
  window.renderBilling=function(){let x;try{x=rb.apply(this,arguments)}catch(e){console.warn(e)}renderAll();return x};
  const rbud=window.renderBudget;
  window.renderBudget=function(){let x;try{x=rbud.apply(this,arguments)}catch(e){console.warn(e)}renderAll();return x};
  $('billingProjectFilter')?.addEventListener('change',renderAll,{passive:true});
  $('budgetProject')?.addEventListener('change',renderAll,{passive:true});
  $('workspaceProject')?.addEventListener('change',renderAll,{passive:true});
  requestAnimationFrame(renderAll);
})();