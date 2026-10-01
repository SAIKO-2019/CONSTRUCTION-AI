// CONSTRUCTION MONITORING v28.21
// BUDGET & COST TRACKER
// Structure inspired by the user's Budget & Cost Tracker workbook.
// Per-project only. Actual cost = Inventory/Purchases + Subcon Issued/Paid.
// No polling; existing Supabase realtime refreshes the same cache.
(function(){
  const n=v=>{
    const x=Number(String(v??0).replace(/,/g,'').replace(/%/g,'').trim());
    return Number.isFinite(x)?x:0;
  };
  const pct=v=>`${n(v).toFixed(2)}%`;
  const norm=v=>String(v??'').trim().toLowerCase();

  function pid(){
    return $('workspaceProject')?.value||'';
  }
  function project(){
    return (cache.projects||[]).find(p=>String(p.id)===String(pid()))||null;
  }
  function boqRows(){
    const id=pid();
    return (cache.boq||[]).filter(x=>String(x.project_id)===String(id));
  }
  function inventoryRows(){
    const id=pid();
    return (cache.inventory||[]).filter(x=>String(x.project_id)===String(id));
  }
  function billingRows(){
    const id=pid();
    return (cache.billings||[]).filter(x=>String(x.project_id)===String(id));
  }
  function subconRows(){
    return billingRows().filter(b=>b.billing_type==='Subcontractor Billing');
  }

  function actualProgress(){
    const id=pid();
    const series=(cache.actualSeries||[])
      .filter(r=>String(r.project_id)===String(id))
      .map(r=>({date:String(r.progress_date||r.date||'').slice(0,10),v:n(r.cumulative_percent??r.actual_percent??r.value)}))
      .filter(r=>r.date)
      .sort((a,b)=>a.date.localeCompare(b.date));
    if(series.length)return Math.max(0,Math.min(100,series[series.length-1].v));
    try{
      if(typeof window.actualForProject==='function')return Math.max(0,Math.min(100,n(window.actualForProject(id))));
    }catch(_){}
    return 0;
  }

  function categoryName(raw){
    const x=norm(raw);
    if(!x)return 'Other';
    if(x==='materials'||x==='material')return 'Materials';
    if(x==='labor'||x==='labour')return 'Labor';
    if(x==='overhead'||x==='general requirements')return 'Overhead';
    if(x==='equipment')return 'Equipment';
    if(x==='subcontractor'||x==='subcon'||x==='subcontractor billing')return 'Subcontractor';
    if(x==='travel')return 'Travel';
    if(x==='labor and materials'||x==='labor & materials'||x==='labour and materials')return 'Labor and Materials';
    return raw||'Other';
  }

  function invAmount(i){
    // Actual Cost follows the Inventory ledger committed/actual amount.
    // Paid/Balance is shown separately in the detail table.
    return n(i.total_amount);
  }

  function issuedAmount(b){
    // received_amount is maintained by the dated Add Issued Amount transactions.
    return Math.max(0,n(b.received_amount));
  }

  function tracker(){
    const p=project()||{};
    const boq=boqRows();
    const inv=inventoryRows();
    const subs=subconRows();

    const contract=Math.max(0,n(p.contract_amount||p.original_contract_amount));
    const original=Math.max(0,n(p.original_contract_amount||contract));
    const discount=Math.max(0,n(p.discount_amount));

    const projectedBOQ=boq.reduce((s,b)=>s+Math.max(0,n(b.amount)),0);
    const projectedCost=projectedBOQ||contract;

    const inventoryActual=inv.reduce((s,i)=>s+invAmount(i),0);
    const inventoryPaid=inv.reduce((s,i)=>s+n(i.paid_amount),0);
    const inventoryBalance=inv.reduce((s,i)=>s+n(i.balance_amount),0);

    const subconGross=subs.reduce((s,b)=>s+Math.max(0,n(b.gross_amount)),0);
    const subconRetention=subs.reduce((s,b)=>s+Math.max(0,n(b.retention_amount)),0);
    const subconRecoupment=subs.reduce((s,b)=>s+Math.max(0,n(b.recoupment_amount)),0);
    const subconNet=subs.reduce((s,b)=>s+Math.max(0,n(b.net_due)),0);
    const subconIssued=subs.reduce((s,b)=>s+issuedAmount(b),0);
    const subconPayableBalance=Math.max(0,subconNet-subconIssued);
    const subconContract=Math.max(0,n(p.subcon_contract_amount));
    const subconRemainingContract=Math.max(0,subconContract-subconGross);

    // IMPORTANT: Subcon actual cost is the actual ISSUED/PAID amount, exactly as requested.
    const totalActual=inventoryActual+subconIssued;
    const overUnder=projectedCost-totalActual;
    const overUnderPct=projectedCost?overUnder/projectedCost*100:0;
    const progress=actualProgress();

    const earnedValue=contract*progress/100;
    const runningProfit=earnedValue-totalActual;
    const projectedProfit=contract-projectedCost;
    const remainingProjected=Math.max(0,projectedCost-totalActual);

    // ----- Breakdown by category -----
    const categories=new Map();
    function cat(key){
      const name=categoryName(key);
      if(!categories.has(name)){
        categories.set(name,{name,projected:0,inventory:0,subconIssued:0,actual:0});
      }
      return categories.get(name);
    }

    boq.forEach(b=>{
      cat(b.cost_category||'Other').projected+=Math.max(0,n(b.amount));
    });
    inv.forEach(i=>{
      cat(i.category||'Other').inventory+=invAmount(i);
    });
    // Issued Subcon amounts belong to Subcontractor actual cost.
    cat('Subcontractor').subconIssued+=subconIssued;

    categories.forEach(c=>{
      c.actual=c.inventory+c.subconIssued;
      c.overUnder=c.projected-c.actual;
      c.overUnderPct=c.projected?c.overUnder/c.projected*100:0;
    });

    // ----- BOQ task rows linked to Inventory -----
    const invByBoq=new Map();
    inv.forEach(i=>{
      if(!i.boq_item_id)return;
      const key=String(i.boq_item_id);
      invByBoq.set(key,(invByBoq.get(key)||0)+invAmount(i));
    });

    const taskRows=boq.map(b=>{
      const projected=Math.max(0,n(b.amount));
      const actual=invByBoq.get(String(b.id))||0;
      const variance=projected-actual;
      const variancePct=projected?variance/projected*100:0;
      return {
        kind:'BOQ',
        name:b.description||b.item_no||'BOQ Item',
        category:categoryName(b.cost_category||'Other'),
        unit:b.unit||'—',
        qty:n(b.quantity),
        unitCost:n(b.unit_cost),
        projected,
        actual,
        variance,
        variancePct,
        source:'BOQ + linked Inventory'
      };
    });

    // Inventory rows not linked to BOQ remain fully visible as actual cost rows.
    inv.filter(i=>!i.boq_item_id).forEach(i=>{
      const actual=invAmount(i);
      taskRows.push({
        kind:'Inventory',
        name:i.description||'Inventory / Purchase',
        category:categoryName(i.category||'Other'),
        unit:i.unit||'—',
        qty:n(i.quantity),
        unitCost:n(i.unit_cost),
        projected:0,
        actual,
        variance:-actual,
        variancePct:0,
        source:'Inventory'
      });
    });

    return {
      p,boq,inv,subs,
      contract,original,discount,projectedCost,inventoryActual,inventoryPaid,inventoryBalance,
      subconContract,subconGross,subconRetention,subconRecoupment,subconNet,subconIssued,
      subconPayableBalance,subconRemainingContract,totalActual,overUnder,overUnderPct,
      progress,earnedValue,runningProfit,projectedProfit,remainingProjected,
      categories:[...categories.values()],
      taskRows
    };
  }

  window.budgetCostTrackerV2821=tracker;

  function signClass(v){
    return n(v)<0?'tracker-negative':'tracker-positive';
  }

  function renderBreakdowns(d){
    if($('budgetPie')){
      const projected=d.categories.filter(c=>Math.abs(c.projected)>.005);
      const total=Math.max(1,projected.reduce((s,c)=>s+Math.abs(c.projected),0));
      $('budgetPie').innerHTML=`
        <div class="tracker-breakdown-list">
          ${projected.length?projected.map(c=>`
            <div class="tracker-breakdown-row">
              <div><span>${esc(c.name)}</span><strong>${money(c.projected)}</strong></div>
              <div class="tracker-breakdown-track"><i style="width:${Math.min(100,Math.abs(c.projected)/total*100)}%"></i></div>
            </div>`).join(''):'<div class="empty">No BOQ / projected cost data yet.</div>'}
        </div>`;
    }

    if($('budgetBars')){
      const actual=d.categories.filter(c=>Math.abs(c.actual)>.005);
      const total=Math.max(1,actual.reduce((s,c)=>s+Math.abs(c.actual),0));
      $('budgetBars').innerHTML=`
        <div class="tracker-breakdown-list">
          ${actual.length?actual.map(c=>`
            <div class="tracker-breakdown-row">
              <div><span>${esc(c.name)}</span><strong>${money(c.actual)}</strong></div>
              <div class="tracker-breakdown-track actual"><i style="width:${Math.min(100,Math.abs(c.actual)/total*100)}%"></i></div>
              <small>${c.inventory?`Inventory ${money(c.inventory)}`:''}${c.inventory&&c.subconIssued?' · ':''}${c.subconIssued?`Subcon Issued ${money(c.subconIssued)}`:''}</small>
            </div>`).join(''):'<div class="empty">No actual cost data yet.</div>'}
        </div>`;
    }
  }

  function renderCategoryTable(d){
    return `
      <section class="tracker-section">
        <div class="tracker-section-head">
          <div><span>COST BREAKDOWN</span><h3>Projected vs Actual by Category</h3></div>
        </div>
        <div class="table-wrap">
          <table class="tracker-table category-table">
            <thead><tr>
              <th>Category</th>
              <th>Projected Cost</th>
              <th>Inventory Actual</th>
              <th>Subcon Issued</th>
              <th>Total Actual Cost</th>
              <th>Over / Under</th>
              <th>Over / Under %</th>
            </tr></thead>
            <tbody>
              ${d.categories.length?d.categories.map(c=>`
                <tr>
                  <td><strong>${esc(c.name)}</strong></td>
                  <td>${money(c.projected)}</td>
                  <td>${money(c.inventory)}</td>
                  <td>${money(c.subconIssued)}</td>
                  <td><strong>${money(c.actual)}</strong></td>
                  <td class="${signClass(c.overUnder)}">${money(c.overUnder)}</td>
                  <td class="${signClass(c.overUnder)}">${c.projected?pct(c.overUnderPct):'—'}</td>
                </tr>`).join(''):'<tr><td colspan="7" class="empty">No cost category data.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function renderTaskTable(d){
    return `
      <section class="tracker-section">
        <div class="tracker-section-head">
          <div>
            <span>COST TRACKER</span>
            <h3>Scope / Task Cost Table</h3>
            <p>Projected values come from BOQ. Actual values come from linked Inventory / Purchases. Unlinked inventory remains as a separate actual-cost row.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="tracker-table task-cost-table">
            <thead><tr>
              <th>Task / Scope</th>
              <th>Category</th>
              <th>UOM</th>
              <th>Qty.</th>
              <th>Unit Cost</th>
              <th>Total Projected Cost</th>
              <th>Total Actual Cost</th>
              <th>Over / Under</th>
              <th>Over / Under %</th>
              <th>Source</th>
            </tr></thead>
            <tbody>
              ${d.taskRows.length?d.taskRows.map(r=>`
                <tr class="${r.kind==='Inventory'?'tracker-unlinked-row':''}">
                  <td><strong>${esc(r.name)}</strong></td>
                  <td>${esc(r.category)}</td>
                  <td>${esc(r.unit)}</td>
                  <td>${r.qty.toLocaleString()}</td>
                  <td>${money(r.unitCost)}</td>
                  <td>${money(r.projected)}</td>
                  <td><strong>${money(r.actual)}</strong></td>
                  <td class="${signClass(r.variance)}">${money(r.variance)}</td>
                  <td class="${signClass(r.variance)}">${r.projected?pct(r.variancePct):'—'}</td>
                  <td><span class="tracker-source-pill">${esc(r.source)}</span></td>
                </tr>`).join(''):'<tr><td colspan="10" class="empty">No BOQ or inventory data for this project.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function renderSubconTable(d){
    let cumulativeGross=0;
    const rows=d.subs.map(b=>{
      const gross=Math.max(0,n(b.gross_amount));
      cumulativeGross+=gross;
      const ret=Math.max(0,n(b.retention_amount));
      const rec=Math.max(0,n(b.recoupment_amount));
      const net=Math.max(0,n(b.net_due));
      const issued=issuedAmount(b);
      const payable=Math.max(0,net-issued);
      const billingPct=d.subconContract?gross/d.subconContract*100:0;
      const remaining=Math.max(0,d.subconContract-cumulativeGross);
      return `
        <tr>
          <td><strong>${esc(b.billing_category==='Downpayment'?'Downpayment':(b.variation_no?`VO ${b.variation_no}`:`Billing ${b.billing_no||'—'}`))}</strong>${b.source_gencon_billing_id?'<br><small>Auto-linked from GenCon</small>':''}</td>
          <td>${esc(b.subcontractor_name||'—')}</td>
          <td>${money(gross)}</td>
          <td>${pct(billingPct)}</td>
          <td>${money(ret)}${n(b.retention_percent)?`<br><small>${pct(b.retention_percent)}</small>`:''}</td>
          <td>${money(rec)}${n(b.recoupment_percent)?`<br><small>${pct(b.recoupment_percent)}</small>`:''}</td>
          <td>${money(net)}</td>
          <td><strong>${money(issued)}</strong></td>
          <td>${money(payable)}</td>
          <td><strong>${money(remaining)}</strong></td>
        </tr>`;
    }).join('');

    return `
      <section class="tracker-section">
        <div class="tracker-section-head">
          <div>
            <span>SUBCONTRACTOR COST</span>
            <h3>Subcon Billing & Issued Amounts</h3>
            <p>Issued Amount is treated as actual project cost in this Budget & Cost Tracker.</p>
          </div>
        </div>
        <div class="tracker-subcon-summary">
          <div><span>Subcon Contract</span><strong>${money(d.subconContract)}</strong></div>
          <div><span>Gross Billed</span><strong>${money(d.subconGross)}</strong></div>
          <div><span>Retention</span><strong>${money(d.subconRetention)}</strong></div>
          <div><span>Recoupment</span><strong>${money(d.subconRecoupment)}</strong></div>
          <div><span>Net Payable</span><strong>${money(d.subconNet)}</strong></div>
          <div><span>Issued / Paid</span><strong>${money(d.subconIssued)}</strong></div>
          <div><span>Payable Balance</span><strong>${money(d.subconPayableBalance)}</strong></div>
          <div class="accent"><span>Remaining Contract</span><strong>${money(d.subconRemainingContract)}</strong></div>
        </div>
        <div class="table-wrap">
          <table class="tracker-table subcon-cost-table">
            <thead><tr>
              <th>Billing / VO</th>
              <th>Subcontractor</th>
              <th>Billing Amount</th>
              <th>Billing %</th>
              <th>Retention</th>
              <th>Recoupment</th>
              <th>Net Payable</th>
              <th>Issued / Paid</th>
              <th>Payable Balance</th>
              <th>Remaining Contract</th>
            </tr></thead>
            <tbody>${rows||'<tr><td colspan="10" class="empty">No Subcon billing rows yet.</td></tr>'}</tbody>
          </table>
        </div>
      </section>`;
  }

  function renderInventoryTable(d){
    return `
      <section class="tracker-section">
        <div class="tracker-section-head">
          <div>
            <span>ACTUAL COST SOURCE</span>
            <h3>Inventory / Purchases Cost Ledger</h3>
            <p>Every inventory row for the Active Project Folder is included in Total Actual Cost.</p>
          </div>
        </div>
        <div class="tracker-inventory-summary">
          <div><span>Inventory Actual Cost</span><strong>${money(d.inventoryActual)}</strong></div>
          <div><span>Paid</span><strong>${money(d.inventoryPaid)}</strong></div>
          <div><span>Balance</span><strong>${money(d.inventoryBalance)}</strong></div>
          <div><span>Rows</span><strong>${d.inv.length.toLocaleString()}</strong></div>
        </div>
        <div class="table-wrap">
          <table class="tracker-table inventory-cost-table">
            <thead><tr>
              <th>Date Request</th>
              <th>Date Purchase</th>
              <th>Category</th>
              <th>Description</th>
              <th>Qty.</th>
              <th>Unit</th>
              <th>Unit Cost</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Supplier / Payee</th>
              <th>Reference No.</th>
            </tr></thead>
            <tbody>
              ${d.inv.length?d.inv.map(i=>`
                <tr>
                  <td>${esc(i.date_request||'—')}</td>
                  <td>${esc(i.date_purchase||'—')}</td>
                  <td>${esc(categoryName(i.category))}</td>
                  <td><strong>${esc(i.description||'—')}</strong></td>
                  <td>${n(i.quantity).toLocaleString()}</td>
                  <td>${esc(i.unit||'—')}</td>
                  <td>${money(i.unit_cost)}</td>
                  <td><strong>${money(i.total_amount)}</strong></td>
                  <td>${money(i.paid_amount)}</td>
                  <td>${money(i.balance_amount)}</td>
                  <td>${esc(i.supplier||'—')}</td>
                  <td>${esc(i.reference_no||'—')}</td>
                </tr>`).join(''):'<tr><td colspan="12" class="empty">No inventory entries yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function renderBudgetTracker(){
    if(!$('budgetKPIs'))return;
    const d=tracker();

    $('budgetKPIs').innerHTML=[
      ['Total Contract Cost',money(d.contract)],
      ['Total Projected Costs',money(d.projectedCost)],
      ['Inventory Actual Cost',money(d.inventoryActual)],
      ['Subcon Issued Amount',money(d.subconIssued)],
      ['Total Actual Costs',money(d.totalActual)],
      ['Over / Under',money(d.overUnder)],
      ['Accomplishment Percentage',pct(d.progress)],
      ['Projected Profit',money(d.projectedProfit)]
    ].map(([a,b])=>`
      <div class="kpi ${a==='Over / Under'?signClass(d.overUnder):''}">
        <span>${a}</span><strong>${b}</strong>
      </div>`).join('');

    renderBreakdowns(d);

    $('budgetSummaryTable').innerHTML=`
      <div class="budget-tracker-workbook">
        <section class="tracker-project-summary">
          <div class="tracker-summary-title">
            <span>PROJECT SUMMARY</span>
            <h2>${esc(d.p?.project_name||'Selected Project')}</h2>
          </div>
          <div class="tracker-summary-grid">
            <div><span>Original Contract</span><strong>${money(d.original)}</strong></div>
            <div><span>Discount</span><strong>${money(d.discount)}</strong></div>
            <div><span>Total Contract Cost</span><strong>${money(d.contract)}</strong></div>
            <div><span>Total Projected Costs</span><strong>${money(d.projectedCost)}</strong></div>
            <div><span>Total Actual Costs</span><strong>${money(d.totalActual)}</strong><small>Inventory + Subcon Issued</small></div>
            <div class="${signClass(d.overUnder)}"><span>Over / Under</span><strong>${money(d.overUnder)}</strong><small>${pct(d.overUnderPct)}</small></div>
            <div><span>Accomplishment Percentage</span><strong>${pct(d.progress)}</strong></div>
            <div><span>Earned Value</span><strong>${money(d.earnedValue)}</strong></div>
            <div class="${signClass(d.runningProfit)}"><span>Running Profit</span><strong>${money(d.runningProfit)}</strong></div>
            <div class="${signClass(d.projectedProfit)}"><span>Projected Profit</span><strong>${money(d.projectedProfit)}</strong></div>
            <div><span>Remaining Projected Cost</span><strong>${money(d.remainingProjected)}</strong></div>
            <div><span>Inventory Rows</span><strong>${d.inv.length.toLocaleString()}</strong></div>
          </div>
        </section>

        ${renderCategoryTable(d)}
        ${renderTaskTable(d)}
        ${renderSubconTable(d)}
        ${renderInventoryTable(d)}
      </div>`;

    // Keep Reports/AI budget API aligned to this tracker.
    window.__budgetTrackerV2821=d;
  }

  // Replace previous layered Budget renderers with one final source.
  window.renderBudget=renderBudgetTracker;

  // Keep the generic budgetData API aligned for report generation / AI.
  window.budgetData=function(projectId){
    // Single Active Project Folder is authoritative.
    const d=tracker();
    return {
      p:d.p,
      original:d.original,
      discount:d.discount,
      contract:d.contract,
      invCommitted:d.inventoryActual,
      invPaid:d.inventoryPaid,
      costCommitted:d.subconNet,
      costPaid:d.subconIssued,
      runningCost:d.totalActual,
      committed:d.projectedCost,
      actual:d.progress,
      earned:d.earnedValue,
      runningProfit:d.runningProfit,
      projectedProfit:d.projectedProfit,
      clientGross:0,
      collections:0,
      categories:Object.fromEntries(d.categories.map(c=>[c.name,c.actual])),
      remainingByType:{
        Materials:Math.max(0,d.projectedCost-d.totalActual),
        Labor:0,
        Equipment:0,
        Subcontractor:d.subconRemainingContract,
        Other:0
      },
      live:d
    };
  };

  requestAnimationFrame(()=>{
    if(document.querySelector('#budget.active-view'))renderBudgetTracker();
  });
})();
