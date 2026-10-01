// CONSTRUCTION MONITORING v28.11
// One financial engine for Home / Billing / Budget Monitoring.
// Key rules:
// - All views follow the selected project.
// - Downpayment is shown separately and is NEVER part of Total Received.
// - Billing Accumulated is cumulative regular Billing accomplishment.
// - Pending accomplishment = 100 - Billing Accumulated.
// - Need to Collect = prior unpaid + projected remaining net collection.
// - Next Billing = Actual accomplishment - Billing Accumulated.
// - Budget reads live Inventory + BOQ/Progress + Subcon payment history.
// No new timer and no MutationObserver.
(function(){
  const n=v=>{
    const x=Number(String(v??0).replace(/,/g,'').replace(/%/g,'').trim());
    return Number.isFinite(x)?x:0;
  };
  const clamp=(v,min=0,max=100)=>Math.min(max,Math.max(min,n(v)));
  const norm=v=>String(v??'').trim().toLowerCase();

  function selectedProjectId(){
    return $('workspaceProject')?.value ||
           $('billingProjectFilter')?.value ||
           $('budgetProject')?.value ||
           cache.projects?.[0]?.id || '';
  }

  function project(pid){
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }

  function billText(b){
    return [
      b.billing_category,b.billing_no,b.variation_no,b.billing_type,
      b.input_by_name,b.scope,b.description,b.remarks
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function isDownpayment(b){
    const cat=norm(b.billing_category);
    if(cat==='downpayment')return true;
    const txt=billText(b);
    return /(^|[^a-z])(down\s*payment|downpayment|dp)([^a-z]|$)/i.test(txt);
  }

  function isCostBilling(b){
    const t=norm(b.billing_type);
    return /subcontractor billing|subcontractor|subcon|labor|equipment|other/.test(t);
  }

  function isClientBilling(b){
    return !isCostBilling(b);
  }

  function billCategory(b){
    if(isDownpayment(b))return 'Downpayment';
    if(norm(b.billing_category)==='vo' || String(b.variation_no||'').trim())return 'VO';
    return 'Billing';
  }

  function rowsForProject(pid){
    return (cache.billings||[]).filter(b=>String(b.project_id)===String(pid));
  }

  function clientRows(pid){
    return rowsForProject(pid).filter(isClientBilling);
  }

  function regularBillingRows(pid){
    return clientRows(pid).filter(b=>billCategory(b)==='Billing');
  }

  function latestActualPercent(pid){
    const series=(cache.actualSeries||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({
        date:String(r.progress_date||r.date||'').slice(0,10),
        value:clamp(r.cumulative_percent??r.actual_percent??r.value)
      }))
      .filter(r=>r.date)
      .sort((a,b)=>a.date.localeCompare(b.date));

    if(series.length)return series[series.length-1].value;

    try{
      if(typeof window.actualForProject==='function'){
        return clamp(window.actualForProject(pid));
      }
    }catch(_){}

    return clamp((cache.progress||[])
      .filter(r=>String(r.project_id)===String(pid))
      .reduce((s,r)=>s+n(r.weight)*n(r.actual_percent)/100,0));
  }

  function latestRate(rows,key){
    const candidates=rows
      .filter(b=>n(b[key])>0)
      .slice()
      .sort((a,b)=>{
        const pa=n(a.accomplishment_percent),pb=n(b.accomplishment_percent);
        if(pa!==pb)return pb-pa;
        const da=String(a.date_request||a.date_submitted||a.created_at||'');
        const db=String(b.date_request||b.date_submitted||b.created_at||'');
        return db.localeCompare(da);
      });
    return candidates.length?Math.max(0,n(candidates[0][key])):0;
  }

  function structuralAdjustments(pid){
    // Only separate structural adjustment rows that do not carry a regular
    // accomplishment percentage. This avoids double-counting progress billings.
    return clientRows(pid).filter(b=>{
      const txt=billText(b);
      return /structural/i.test(txt) &&
             !isDownpayment(b) &&
             n(b.accomplishment_percent)<=0.0001;
    });
  }

  function financeSnapshot(pid){
    const p=project(pid)||{};
    const client=clientRows(pid);
    const regular=regularBillingRows(pid);
    const dp=client.filter(isDownpayment);
    const nonDp=client.filter(b=>!isDownpayment(b));

    const contract=Math.max(0,n(p.contract_amount||p.original_contract_amount));
    const dpReceived=dp.reduce((s,b)=>s+n(b.received_amount),0);

    // IMPORTANT: selected project only, and DP excluded.
    const totalReceived=nonDp.reduce((s,b)=>s+n(b.received_amount),0);

    const accumulated=clamp(regular.reduce(
      (mx,b)=>Math.max(mx,n(b.accomplishment_percent)),0
    ));

    const structuralRows=structuralAdjustments(pid);
    const structuralIds=new Set(structuralRows.map(b=>String(b.id)));

    const unpaid=nonDp
      .filter(b=>!structuralIds.has(String(b.id)))
      .reduce((s,b)=>s+Math.max(0,n(b.outstanding_amount)),0);

    const retPct=latestRate(regular,'retention_percent');
    const recPct=latestRate(regular,'recoupment_percent');

    const pendingPct=clamp(100-accumulated);
    const pendingGross=contract*pendingPct/100;
    const pendingRecoup=pendingGross*recPct/100;
    const pendingRetention=pendingGross*retPct/100;

    const structuralAdjustment=structuralRows.reduce((s,b)=>{
      const amount=Math.max(
        Math.max(0,n(b.outstanding_amount)),
        Math.max(0,n(b.net_due)),
        Math.max(0,n(b.gross_amount))
      );
      return s+amount;
    },0);

    const structuralLabel=structuralRows.length
      ? structuralRows.map(b=>{
          const base=b.billing_no||b.variation_no||'Structural Billing';
          return /structural/i.test(base)?base:`${base} Structural`;
        }).join(' + ')
      : 'Structural / Other Billing Adjustment';

    const remainingNet=Math.max(
      0,
      pendingGross-pendingRecoup-pendingRetention-structuralAdjustment
    );

    const needToCollect=Math.max(0,unpaid+remainingNet);

    const actual=latestActualPercent(pid);
    const nextPct=clamp(actual-accumulated);
    const nextGross=contract*nextPct/100;
    const nextRecoup=nextGross*recPct/100;
    const nextRetention=nextGross*retPct/100;
    const nextNet=Math.max(0,nextGross-nextRecoup-nextRetention);

    return {
      pid,p,contract,dpReceived,totalReceived,accumulated,unpaid,
      retPct,recPct,pendingPct,pendingGross,pendingRecoup,pendingRetention,
      structuralAdjustment,structuralLabel,remainingNet,needToCollect,
      actual,nextPct,nextGross,nextRecoup,nextRetention,nextNet
    };
  }

  // ------------------------- Subcon / Budget -------------------------
  function invRows(pid){
    return (cache.inventory||[]).filter(i=>String(i.project_id)===String(pid));
  }

  function boqRows(pid){
    return (cache.boq||[]).filter(i=>String(i.project_id)===String(pid));
  }

  function progressRows(pid){
    return (cache.progress||[]).filter(i=>String(i.project_id)===String(pid));
  }

  function linkedSubconPaymentRows(billingId){
    return (cache.subconPayments||[]).filter(p=>String(p.billing_id)===String(billingId));
  }

  function subconSnapshot(pid){
    const p=project(pid)||{};
    const contract=Math.max(0,n(p.subcon_contract_amount));

    // Actual Subcontractor Billing records use the SAME transaction engine
    // as GenCon. Their received_amount is the running total of Issued Amounts.
    const actualBills=rowsForProject(pid).filter(b=>b.billing_type==='Subcontractor Billing');
    const actualDP=actualBills.filter(isDownpayment);
    const actualRegular=actualBills.filter(b=>!isDownpayment(b));

    // Linked GenCon→Subcon allocation remains the fallback / allocation plan.
    const client=clientRows(pid);
    const linked=client.filter(b=>b.has_subcon || n(b.subcon_amount_to_issue)>0);
    const linkedDP=linked.filter(isDownpayment);
    const linkedRegular=linked.filter(b=>!isDownpayment(b));

    const linkedDPPaid=linkedDP.reduce((s,b)=>
      s+linkedSubconPaymentRows(b.id).reduce((x,p)=>x+n(p.amount),0),0
    );
    const linkedRegularPaid=linkedRegular.reduce((s,b)=>
      s+linkedSubconPaymentRows(b.id).reduce((x,p)=>x+n(p.amount),0),0
    );

    const actualDPPaid=actualDP.reduce((s,b)=>s+Math.max(0,n(b.received_amount)),0);
    const actualRegularPaid=actualRegular.reduce((s,b)=>s+Math.max(0,n(b.received_amount)),0);

    const issuedDP=actualBills.length?actualDPPaid:linkedDPPaid;
    const issuedAmount=actualBills.length?actualRegularPaid:linkedRegularPaid;

    const dpAmountToIssue=linkedDP.reduce((s,b)=>s+Math.max(0,n(b.subcon_amount_to_issue)),0);
    const regularAmountToIssue=linkedRegular.reduce((s,b)=>s+Math.max(0,n(b.subcon_amount_to_issue)),0);

    const actualRetentionRates=actualBills
      .map(b=>Math.max(0,n(b.retention_percent)))
      .filter(Boolean);
    const linkedRetentionRates=linked
      .map(b=>Math.max(0,n(b.subcon_retention_percent)))
      .filter(Boolean);
    const retentionPct=actualRetentionRates.length
      ? Math.max(...actualRetentionRates)
      : (linkedRetentionRates.length?Math.max(...linkedRetentionRates):0);

    const retention=contract*retentionPct/100;
    const remaining=Math.max(0,contract-issuedDP-issuedAmount-retention);
    const plannedDPPercent=contract?dpAmountToIssue/contract*100:0;
    const paidDPPercent=contract?issuedDP/contract*100:0;

    return {
      contract,issuedDP,issuedAmount,retentionPct,retention,remaining,
      dpAmountToIssue,regularAmountToIssue,plannedDPPercent,paidDPPercent,
      scope:p.subcon_scope_caption||''
    };
  }

  function budgetSnapshot(pid){
    const f=financeSnapshot(pid);
    const s=subconSnapshot(pid);
    const inv=invRows(pid);
    const boq=boqRows(pid);
    const prog=progressRows(pid);

    const projectedBudgetFromBoq=boq.reduce((sum,b)=>sum+Math.max(0,n(b.amount)),0);
    const projectedBudgetFromProgress=prog.reduce((sum,r)=>sum+Math.max(0,n(r.budget_amount)),0);
    const projectedBudget=projectedBudgetFromBoq || projectedBudgetFromProgress || f.contract;

    // Matches the user's running expense ledger: Materials + Labor + Overhead + any
    // other inventory/cost-ledger entries, including transparent corrections.
    const runningExpenses=inv.reduce((sum,i)=>sum+n(i.total_amount),0);

    const remainingLMFromProgress=prog.reduce((sum,r)=>{
      const linked=boq.find(b=>String(b.id)===String(r.boq_item_id));
      const cat=norm(r.cost_category||linked?.cost_category);
      if(!(cat==='materials'||cat==='labor'))return sum;
      const budget=Math.max(0,n(r.budget_amount||linked?.amount));
      const actual=clamp(r.actual_percent);
      return sum+Math.max(0,budget*(1-actual/100));
    },0);

    const boqLM=boq
      .filter(b=>['materials','labor'].includes(norm(b.cost_category)))
      .reduce((sum,b)=>sum+Math.max(0,n(b.amount)),0);

    const spentLM=inv
      .filter(i=>['materials','labor'].includes(norm(i.category)))
      .reduce((sum,i)=>sum+n(i.total_amount),0);

    const remainingLM=remainingLMFromProgress>0
      ? remainingLMFromProgress
      : Math.max(0,boqLM-spentLM);

    const projectedRunningPayables=Math.max(0,remainingLM+s.remaining);

    const categories={Materials:0,Labor:0,Overhead:0,Other:0};
    inv.forEach(i=>{
      const c=norm(i.category);
      if(c==='materials')categories.Materials+=n(i.total_amount);
      else if(c==='labor')categories.Labor+=n(i.total_amount);
      else if(c==='overhead')categories.Overhead+=n(i.total_amount);
      else categories.Other+=n(i.total_amount);
    });

    return {
      ...f,
      subcon:s,
      projectedBudget,runningExpenses,remainingLM,projectedRunningPayables,
      categories
    };
  }

  window.projectFinanceSnapshot=financeSnapshot;
  window.projectBudgetSnapshot=budgetSnapshot;

  // ------------------------- Billing UI -------------------------
  function renderBillingFinancials(){
    const panel=$('billingForecastPanel');
    if(!panel)return;

    const pid=$('billingProjectFilter')?.value||selectedProjectId();
    if(!pid){
      panel.innerHTML='<div class="empty">Select a project.</div>';
      return;
    }
    const d=financeSnapshot(pid);

    const kpis=$('billingKPIs');
    if(kpis){
      kpis.innerHTML=[
        ['Total Contract Amount',money(d.contract)],
        ['Down Payment Received',money(d.dpReceived)],
        ['Total Received',money(d.totalReceived)],
        ['Total Accomplishment',`${d.accumulated.toFixed(2)}%`],
        ['Unpaid Amount',money(d.unpaid)],
        ['Need to Collect',money(d.needToCollect)]
      ].map(([a,b])=>`<div class="kpi ${a==='Need to Collect'?'financial-alert-kpi':''}"><span>${a}</span><strong>${b}</strong></div>`).join('');
    }

    panel.innerHTML=`
      <div class="financial-sheet-head">
        <div>
          <span>BILLING LIVE COMPUTATION</span>
          <h2>Receivable & Next Billing</h2>
          <p>Selected project only. Downpayment is separate and is not included in Total Received.</p>
        </div>
        <div class="financial-live-badge">LIVE SYNC</div>
      </div>

      <div class="financial-sheet-grid">
        <section class="financial-sheet-card">
          <h3>Collection Summary</h3>
          <div class="financial-sheet-row"><span>Total Contract Amount</span><strong>${money(d.contract)}</strong></div>
          <div class="financial-sheet-row"><span>Down Payment Received</span><strong>${money(d.dpReceived)}</strong></div>
          <div class="financial-sheet-row"><span>Total Received <small>(DP excluded)</small></span><strong>${money(d.totalReceived)}</strong></div>
          <div class="financial-sheet-row"><span>Total Accomplishment</span><strong>${d.accumulated.toFixed(2)}%</strong></div>
          <div class="financial-sheet-row"><span>Unpaid Amount</span><strong>${money(d.unpaid)}</strong></div>
          <div class="financial-sheet-row financial-highlight"><span>Need to Collect</span><strong>${money(d.needToCollect)}</strong></div>
        </section>

        <section class="financial-sheet-card">
          <h3>Remaining Based on Billing Accumulated</h3>
          <div class="financial-sheet-row"><span>Pending Accomplishment</span><strong>${d.pendingPct.toFixed(2)}%</strong></div>
          <div class="financial-sheet-row"><span>Contract Amount</span><strong>${money(d.pendingGross)}</strong></div>
          <div class="financial-sheet-row"><span>Recoupment (${d.recPct.toFixed(2)}%)</span><strong>-${money(d.pendingRecoup)}</strong></div>
          <div class="financial-sheet-row"><span>Retention (${d.retPct.toFixed(2)}%)</span><strong>-${money(d.pendingRetention)}</strong></div>
          <div class="financial-sheet-row"><span>${esc(d.structuralLabel)}</span><strong>${d.structuralAdjustment?'-'+money(d.structuralAdjustment):money(0)}</strong></div>
          <div class="financial-sheet-row financial-total"><span>Total Remaining Net</span><strong>${money(d.remainingNet)}</strong></div>
        </section>
      </div>

      <section class="financial-next-billing">
        <div>
          <span>NEXT BILLING BASED ON ACTUAL</span>
          <strong>${money(d.nextNet)}</strong>
        </div>
        <div class="financial-next-breakdown">
          <div><span>Actual Accomplishment</span><strong>${d.actual.toFixed(2)}%</strong></div>
          <div><span>Previous Billing Accumulated</span><strong>${d.accumulated.toFixed(2)}%</strong></div>
          <div><span>Next Billable %</span><strong>${d.nextPct.toFixed(2)}%</strong></div>
          <div><span>Gross</span><strong>${money(d.nextGross)}</strong></div>
          <div><span>Less Recoupment</span><strong>-${money(d.nextRecoup)}</strong></div>
          <div><span>Less Retention</span><strong>-${money(d.nextRetention)}</strong></div>
        </div>
      </section>`;
  }

  // ------------------------- Budget UI -------------------------
  function renderBudgetUnified(){
    if(!$('budgetKPIs'))return;
    const pid=$('budgetProject')?.value||selectedProjectId();
    if(!pid){
      $('budgetKPIs').innerHTML='';
      return;
    }

    const d=budgetSnapshot(pid);
    const s=d.subcon;

    $('budgetKPIs').innerHTML=[
      ['Projected Total Budget Amount',money(d.projectedBudget)],
      ['Running Expenses',money(d.runningExpenses)],
      ['Projected Remaining Labor & Materials',money(d.remainingLM)],
      ['Subcon Remaining Balance',money(s.remaining)],
      ['Projected Total Running Payables',money(d.projectedRunningPayables)],
      ['Total Received',money(d.totalReceived)],
      ['Need to Collect',money(d.needToCollect)],
      ['Actual Accomplishment',`${d.actual.toFixed(2)}%`]
    ].map(([a,b])=>`<div class="kpi ${a==='Projected Total Running Payables'||a==='Need to Collect'?'financial-alert-kpi':''}"><span>${a}</span><strong>${b}</strong></div>`).join('');

    const totalCost=Math.max(1,d.runningExpenses+d.projectedRunningPayables);
    const spentPct=Math.min(100,Math.max(0,d.runningExpenses/totalCost*100));
    if($('budgetPie')){
      $('budgetPie').innerHTML=`<div class="budget-pie-wrap">
        <div class="budget-pie" style="background:conic-gradient(var(--blue) 0 ${spentPct}%,var(--surface-soft) ${spentPct}% 100%)">
          <div class="pie-center">${spentPct.toFixed(1)}%</div>
        </div>
        <div>
          <strong>Running Expenses</strong><br>${money(d.runningExpenses)}
          <br><span class="muted">Projected Payables: ${money(d.projectedRunningPayables)}</span>
        </div>
      </div>`;
    }

    if($('budgetBars')){
      const cats={...d.categories,Subcontractor:s.issuedDP+s.issuedAmount};
      const max=Math.max(1,...Object.values(cats).map(v=>Math.abs(v)));
      $('budgetBars').innerHTML=`<div class="bar-list">${Object.entries(cats).map(([k,v])=>`
        <div class="bar-row"><span>${k}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.abs(v)/max*100)}%"></div></div><strong>${money(v)}</strong></div>
      `).join('')}</div>`;
    }

    if($('budgetSummaryTable')){
      $('budgetSummaryTable').innerHTML=`
        <div class="budget-live-summary">
          <section>
            <h3>Billing / Collection</h3>
            <div><span>Total Contract Amount</span><strong>${money(d.contract)}</strong></div>
            <div><span>Down Payment Received</span><strong>${money(d.dpReceived)}</strong></div>
            <div><span>Total Received <small>(DP excluded)</small></span><strong>${money(d.totalReceived)}</strong></div>
            <div><span>Total Accomplishment</span><strong>${d.accumulated.toFixed(2)}%</strong></div>
            <div><span>Unpaid Amount</span><strong>${money(d.unpaid)}</strong></div>
            <div class="live-accent"><span>Need to Collect</span><strong>${money(d.needToCollect)}</strong></div>
          </section>

          <section>
            <h3>Subcontractor</h3>
            <div><span>Subcontractor Amount</span><strong>${money(s.contract)}</strong></div>
            <div><span>Issued Downpayment</span><strong>${money(s.issuedDP)}</strong></div>
            <div><span>Issued Amount</span><strong>${money(s.issuedAmount)}</strong></div>
            <div><span>Retention (${s.retentionPct.toFixed(2)}%)</span><strong>${money(s.retention)}</strong></div>
            <div class="live-accent danger"><span>Remaining Balance</span><strong>${money(s.remaining)}</strong></div>
          </section>

          <section>
            <h3>Projected Budget / Payables</h3>
            <div><span>Projected Total Budget Amount</span><strong>${money(d.projectedBudget)}</strong></div>
            <div><span>Running Expenses for Labor & Materials <small>(incl. ledger overhead)</small></span><strong>${money(d.runningExpenses)}</strong></div>
            <div><span>Projected Remaining Amount Need for Labor & Materials</span><strong>${money(d.remainingLM)}</strong></div>
            <div class="live-accent"><span>Projected Total Running Payables</span><strong>${money(d.projectedRunningPayables)}</strong></div>
          </section>
        </div>`;
    }
  }

  // Preserve old budgetData API for Reports / AI but make it use the same live engine.
  window.budgetData=function(pid){
    const d=budgetSnapshot(pid);
    const inv=invRows(pid);
    const client=clientRows(pid);
    const original=n(d.p.original_contract_amount||d.contract);
    const discount=n(d.p.discount_amount);
    const committed=d.runningExpenses+d.projectedRunningPayables;
    const earned=d.contract*d.actual/100;
    const runningProfit=earned-d.runningExpenses;
    const projectedProfit=d.contract-committed;

    return {
      p:d.p,
      original,discount,contract:d.contract,
      invCommitted:inv.reduce((s,i)=>s+n(i.total_amount),0),
      invPaid:inv.reduce((s,i)=>s+n(i.paid_amount),0),
      costCommitted:d.subcon.contract,
      costPaid:d.subcon.issuedDP+d.subcon.issuedAmount,
      runningCost:d.runningExpenses+d.subcon.issuedDP+d.subcon.issuedAmount,
      committed,
      actual:d.actual,
      earned,
      runningProfit,
      projectedProfit,
      clientGross:client.filter(b=>!isDownpayment(b)).reduce((s,b)=>s+n(b.gross_amount),0),
      collections:d.totalReceived,
      categories:{...d.categories,Subcontractor:d.subcon.issuedDP+d.subcon.issuedAmount},
      remainingByType:{Materials:d.remainingLM,Labor:0,Equipment:0,Subcontractor:d.subcon.remaining,Other:0},
      live:d
    };
  };

  window.renderBudget=renderBudgetUnified;

  // ------------------------- Home / Dashboard -------------------------
  function applySelectedProjectCollections(){
    const pid=selectedProjectId();
    if(!pid)return;
    const d=financeSnapshot(pid);

    const host=$('v28HomeKpis');
    if(host){
      [...host.children].forEach(card=>{
        const label=card.querySelector('span');
        if(label && /total collected|total received/i.test(label.textContent||'')){
          label.textContent='Total Received';
          const value=card.querySelector('strong');
          if(value)value.textContent=money(d.totalReceived);
        }
      });
    }

    const finance=$('v28FinanceSnapshot');
    if(finance){
      const nonDp=clientRows(pid).filter(b=>!isDownpayment(b));
      const regularGross=nonDp.reduce((s,b)=>s+n(b.gross_amount),0);
      finance.innerHTML=[
        ['Contract Amount',money(d.contract)],
        ['Downpayment Received',money(d.dpReceived)],
        ['Regular / VO Billed',money(regularGross)],
        ['Total Received',money(d.totalReceived)],
        ['Need to Collect',money(d.needToCollect)]
      ].map(([a,b])=>`<div class="v28-finance-cell"><span>${a}</span><strong>${b}</strong></div>`).join('');
    }

    const body=$('dashboardProjectFinancialRows');
    if(body){
      const projects=cache.projects||[];
      body.innerHTML=projects.length?projects.map(p=>{
        const x=financeSnapshot(p.id);
        const nonDp=clientRows(p.id).filter(b=>!isDownpayment(b));
        const regularGross=nonDp.reduce((s,b)=>s+n(b.gross_amount),0);
        const sub=subconSnapshot(p.id);
        return `<tr>
          <td><strong>${esc(p.project_name)}</strong></td>
          <td>${money(x.contract)}</td>
          <td>${money(x.dpReceived)}</td>
          <td>${money(regularGross)}</td>
          <td>${money(x.totalReceived)}</td>
          <td>${money(x.unpaid)}</td>
          <td>${money(sub.contract)}</td>
          <td>${money(sub.issuedDP+sub.issuedAmount)}</td>
        </tr>`;
      }).join(''):'<tr><td colspan="8" class="empty">No financial data yet.</td></tr>';
    }
  }

  // Last render layer. No extra sections, only corrects the existing views.
  const baseBilling=window.renderBilling;
  window.renderBilling=function(){
    let out;
    try{out=baseBilling.apply(this,arguments)}catch(err){console.warn('billing base render',err)}
    renderBillingFinancials();
    applySelectedProjectCollections();
    return out;
  };

  const baseDashboard=window.renderDashboard;
  window.renderDashboard=function(){
    let out;
    try{out=baseDashboard.apply(this,arguments)}catch(err){console.warn('dashboard base render',err)}
    applySelectedProjectCollections();
    if(document.querySelector('#budget.active-view'))renderBudgetUnified();
    return out;
  };

  const baseHome=window.renderSaikoHome;
  window.renderSaikoHome=function(){
    try{if(typeof baseHome==='function')baseHome()}catch(err){console.warn('home base render',err)}
    applySelectedProjectCollections();
  };

  // Existing project selectors already drive all views. These hooks only update
  // the unified totals immediately when the selection changes.
  ['workspaceProject','billingProjectFilter','budgetProject'].forEach(id=>{
    const el=$(id);
    if(!el)return;
    el.addEventListener('change',()=>{
      requestAnimationFrame(()=>{
        if(document.querySelector('#billing.active-view'))renderBillingFinancials();
        if(document.querySelector('#budget.active-view'))renderBudgetUnified();
        applySelectedProjectCollections();
      });
    },{passive:true});
  });

  requestAnimationFrame(()=>{
    applySelectedProjectCollections();
    if(document.querySelector('#billing.active-view'))renderBillingFinancials();
    if(document.querySelector('#budget.active-view'))renderBudgetUnified();
  });
})();
