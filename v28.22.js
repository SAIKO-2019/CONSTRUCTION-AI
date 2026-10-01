// CONSTRUCTION MONITORING v28.22
// Construction Budget & Cost Tracker — workbook-style web replica.
// Per Active Project Folder. Editable inputs + automatic formulas.
// Actual Cost = linked Inventory/Purchases + Subcon Issued/Paid + optional manual adjustment.
// Collection Monitoring uses Billing + Actual accomplishment and is capped at Contract Amount.
(function(){
  const n=v=>{
    const x=Number(String(v??0).replace(/,/g,'').replace(/%/g,'').replace(/₱/g,'').trim());
    return Number.isFinite(x)?x:0;
  };
  const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,n(v)));
  const norm=v=>String(v??'').trim().toLowerCase();
  const money0=v=>'₱'+n(v).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct2=v=>`${n(v).toFixed(2)}%`;
  const escAttr=v=>String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const DEFAULT_PHASES=['GENERAL REQUIREMENTS','ARCHITECTURAL WORKS','PLUMBING WORKS','ELECTRICAL WORKS'];
  const CATEGORIES=['Materials','Labor','Subcontractor','Equipment','Overhead','Travel','Labor and materials'];

  function pid(){return $('workspaceProject')?.value||''}
  function project(){return (cache.projects||[]).find(p=>String(p.id)===String(pid()))||null}
  function boq(){return (cache.boq||[]).filter(x=>String(x.project_id)===String(pid()))}
  function inv(){return (cache.inventory||[]).filter(x=>String(x.project_id)===String(pid()))}
  function bills(){return (cache.billings||[]).filter(x=>String(x.project_id)===String(pid()))}
  function subconBills(){return bills().filter(b=>b.billing_type==='Subcontractor Billing')}

  function isDownpayment(b){
    if(norm(b.billing_category)==='downpayment')return true;
    const text=[b.billing_no,b.variation_no,b.billing_category].filter(Boolean).join(' ').toLowerCase();
    return /(^|[^a-z])(down\s*payment|downpayment|dp)([^a-z]|$)/i.test(text);
  }
  function isClient(b){
    return b.billing_type!=='Subcontractor Billing';
  }
  function isRegularBilling(b){
    return isClient(b) && !isDownpayment(b) && norm(b.billing_category||'Billing')==='billing' && !String(b.variation_no||'').trim();
  }

  function actualProgress(){
    const p=project(),id=pid();
    if(p?.budget_progress_override!=null && String(p.budget_progress_override)!==''){
      return clamp(p.budget_progress_override);
    }
    const series=(cache.actualSeries||[])
      .filter(r=>String(r.project_id)===String(id))
      .map(r=>({date:String(r.progress_date||r.date||'').slice(0,10),v:n(r.cumulative_percent??r.actual_percent??r.value)}))
      .filter(r=>r.date)
      .sort((a,b)=>a.date.localeCompare(b.date));
    if(series.length)return clamp(series[series.length-1].v);
    try{
      if(typeof window.actualForProject==='function')return clamp(window.actualForProject(id));
    }catch(_){}
    return clamp(p?.progress||0);
  }

  function latestRate(rows,key){
    return rows
      .slice()
      .sort((a,b)=>{
        const da=String(a.date_request||a.date_submitted||a.created_at||'');
        const db=String(b.date_request||b.date_submitted||b.created_at||'');
        return db.localeCompare(da);
      })
      .map(r=>Math.max(0,n(r[key])))
      .find(v=>v>0)||0;
  }

  function collectionModel(contract,actualPct){
    const p=project()||{};
    const safeContract=Math.max(0,n(contract));
    const safeActualPct=clamp(actualPct);
    const rows=bills().filter(isClient);
    const regular=rows.filter(isRegularBilling);
    const nonDp=rows.filter(b=>!isDownpayment(b));

    const billedPctFromRows=clamp(
      regular.reduce((sum,b)=>sum+Math.max(0,n(b.accomplishment_percent)),0)
    );
    const billedOverride=
      (p.budget_billed_accomplishment_override==null ||
       String(p.budget_billed_accomplishment_override)==='')
        ? null
        : clamp(p.budget_billed_accomplishment_override);
    const billedPct=billedOverride==null?billedPctFromRows:billedOverride;

    const retPct=clamp(p.budget_retention_percent,0,100);
    const recPct=clamp(p.budget_recoupment_percent,0,100);

    const nextPct=clamp(safeActualPct-billedPct);
    const nextGross=Math.min(safeContract,Math.max(0,safeContract*nextPct/100));
    const nextRetention=Math.min(nextGross,Math.max(0,nextGross*retPct/100));
    const afterNextRetention=Math.max(0,nextGross-nextRetention);
    const nextRecoupment=Math.min(afterNextRetention,Math.max(0,nextGross*recPct/100));
    const nextNet=Math.min(safeContract,Math.max(0,nextGross-nextRetention-nextRecoupment));

    const remainingPct=clamp(100-safeActualPct);
    const remainingGross=Math.min(safeContract,Math.max(0,safeContract*remainingPct/100));
    const remainingRetention=Math.min(remainingGross,Math.max(0,remainingGross*retPct/100));
    const afterRemainingRetention=Math.max(0,remainingGross-remainingRetention);
    const remainingRecoupment=Math.min(afterRemainingRetention,Math.max(0,remainingGross*recPct/100));
    const remainingFutureNet=Math.min(
      safeContract,
      Math.max(0,remainingGross-remainingRetention-remainingRecoupment)
    );

    const unpaidRaw=Math.max(
      0,
      nonDp.reduce((sum,b)=>sum+Math.max(0,n(b.outstanding_amount)),0)
    );
    const unpaid=Math.min(safeContract,unpaidRaw);
    const rawTotalNeed=Math.max(0,unpaid+remainingFutureNet);
    const totalNeed=Math.min(safeContract,rawTotalNeed);

    const pieUnpaid=Math.min(unpaid,totalNeed);
    const pieFuture=Math.max(0,totalNeed-pieUnpaid);
    const collected=Math.max(
      0,
      nonDp.reduce((sum,b)=>sum+Math.max(0,n(b.received_amount)),0)
    );

    // Separate retention collection, never added to Total Amount Need to Collect.
    const retentionCeiling=Math.min(safeContract,Math.max(0,safeContract*retPct/100));
    const billedRetentionRaw=Math.max(
      0,
      nonDp.reduce((sum,b)=>sum+Math.max(0,n(b.retention_amount)),0)
    );
    const billedRetention=Math.min(retentionCeiling,billedRetentionRaw);
    const unbilledPct=clamp(100-billedPct);
    const unbilledGross=Math.min(safeContract,Math.max(0,safeContract*unbilledPct/100));
    const retentionRoom=Math.max(0,retentionCeiling-billedRetention);
    const unbilledRetention=Math.min(
      retentionRoom,
      Math.max(0,unbilledGross*retPct/100)
    );
    const totalRetentionNeed=Math.min(
      retentionCeiling,
      Math.max(0,billedRetention+unbilledRetention)
    );

    return {
      contract:safeContract,
      billedPct,billedPctFromRows,billedOverride,retPct,recPct,
      nextPct,nextGross,nextRetention,nextRecoupment,nextNet,
      remainingPct,remainingGross,remainingRetention,remainingRecoupment,
      remainingFutureNet,unpaidRaw,unpaid,rawTotalNeed,totalNeed,
      pieUnpaid,pieFuture,collected,
      retentionCeiling,billedRetention,unbilledPct,unbilledGross,
      unbilledRetention,totalRetentionNeed
    };
  }

  function phaseOf(b){
    const v=String(b.phase_name||'').trim();
    return v||'GENERAL REQUIREMENTS';
  }
  function categoryOf(b){
    const c=String(b.cost_category||'').trim();
    return c||'Materials';
  }
  function subtotal(b){return n(b.quantity)*n(b.unit_cost)}
  function markupAmount(b){return subtotal(b)*n(b.markup_percent)/100}
  function projected(b){return subtotal(b)+markupAmount(b)}

  function model(){
    const p=project()||{};
    const items=boq().slice().sort((a,b)=>{
      const pa=phaseOf(a),pb=phaseOf(b);
      const ai=DEFAULT_PHASES.indexOf(pa),bi=DEFAULT_PHASES.indexOf(pb);
      if(ai!==bi && (ai>=0||bi>=0))return (ai<0?999:ai)-(bi<0?999:bi);
      const pc=pa.localeCompare(pb);
      if(pc)return pc;
      return n(a.display_order)-n(b.display_order)||String(a.created_at||'').localeCompare(String(b.created_at||''));
    });

    const invByBoq=new Map(),unlinked=[];
    inv().forEach(i=>{
      if(i.boq_item_id){
        const k=String(i.boq_item_id);
        invByBoq.set(k,(invByBoq.get(k)||0)+n(i.total_amount));
      }else unlinked.push(i);
    });

    const subIssued=subconBills().reduce((s,b)=>s+Math.max(0,n(b.received_amount)),0);
    const subRows=items.filter(b=>norm(categoryOf(b))==='subcontractor');
    const subProjectedTotal=subRows.reduce((s,b)=>s+Math.max(0,projected(b)),0);

    const rowData=items.map(b=>{
      const invAuto=invByBoq.get(String(b.id))||0;
      let subAuto=0;
      if(norm(categoryOf(b))==='subcontractor'&&subIssued){
        if(subRows.length===1)subAuto=subIssued;
        else if(subProjectedTotal>0)subAuto=subIssued*(Math.max(0,projected(b))/subProjectedTotal);
        else subAuto=subIssued/Math.max(1,subRows.length);
      }
      const autoActual=invAuto+subAuto;
      const adjustment=n(b.actual_cost_adjustment);
      const actual=autoActual+adjustment;
      const proj=projected(b);
      const variance=proj-actual;
      return {
        ...b,phase:phaseOf(b),category:categoryOf(b),
        subtotal:subtotal(b),markupAmount:markupAmount(b),projected:proj,
        invAuto,subAuto,autoActual,adjustment,actual,
        variance,variancePct:proj?variance/proj*100:0
      };
    });

    const unlinkedActual=unlinked.reduce((s,i)=>s+n(i.total_amount),0);
    const unallocatedSubIssued=subRows.length?0:subIssued;

    const subtotalTotal=rowData.reduce((s,r)=>s+r.subtotal,0);
    const markupTotal=rowData.reduce((s,r)=>s+r.markupAmount,0);
    const totalProjected=subtotalTotal+markupTotal;

    const vatPct=n(p.budget_vat_percent);
    const miscPct=n(p.budget_misc_percent);
    const contractBeforeDiscount=totalProjected*(1+vatPct/100)*(1+miscPct/100);

    let discountPct=p.budget_discount_percent;
    if(discountPct==null||String(discountPct)===''){
      const contract=n(p.contract_amount);
      discountPct=contractBeforeDiscount>0&&contract>0?contract/contractBeforeDiscount*100:100;
    }
    discountPct=n(discountPct);

    // Spreadsheet-style computed discounted amount. If there is no BOQ yet,
    // fall back to the actual Project Contract Amount.
    const discountedAmount=contractBeforeDiscount>0
      ? contractBeforeDiscount*discountPct/100
      : Math.max(0,n(p.contract_amount));

    const rowsActual=rowData.reduce((s,r)=>s+r.actual,0);
    const totalActual=rowsActual+unlinkedActual+unallocatedSubIssued;
    const totalOverUnder=discountedAmount-totalActual;
    const overUnderPct=discountedAmount?totalOverUnder/discountedAmount*100:0;

    const progress=actualProgress();
    const progressProjected=discountedAmount*progress/100;
    const profitCost=progressProjected-totalActual;

    const phaseMap=new Map();
    DEFAULT_PHASES.forEach(name=>phaseMap.set(name,{name,rows:[],subtotal:0,markup:0,projected:0,actual:0}));
    rowData.forEach(r=>{
      if(!phaseMap.has(r.phase))phaseMap.set(r.phase,{name:r.phase,rows:[],subtotal:0,markup:0,projected:0,actual:0});
      const ph=phaseMap.get(r.phase);
      ph.rows.push(r);
      ph.subtotal+=r.subtotal;
      ph.markup+=r.markupAmount;
      ph.projected+=r.projected;
      ph.actual+=r.actual;
    });

    if(unlinkedActual){
      phaseMap.set('UNLINKED INVENTORY',{name:'UNLINKED INVENTORY',rows:[],subtotal:0,markup:0,projected:0,actual:unlinkedActual,system:true});
    }
    if(unallocatedSubIssued){
      phaseMap.set('SUBCON ISSUED AMOUNTS',{name:'SUBCON ISSUED AMOUNTS',rows:[],subtotal:0,markup:0,projected:0,actual:unallocatedSubIssued,system:true});
    }

    let phases=[...phaseMap.values()].map(ph=>({
      ...ph,variance:ph.projected-ph.actual,
      variancePct:ph.projected?(ph.projected-ph.actual)/ph.projected*100:0
    }));

    const categoryMap=new Map();
    CATEGORIES.forEach(name=>categoryMap.set(name,{name,projected:0,actual:0}));
    rowData.forEach(r=>{
      if(!categoryMap.has(r.category))categoryMap.set(r.category,{name:r.category,projected:0,actual:0});
      const c=categoryMap.get(r.category);
      c.projected+=r.projected;c.actual+=r.actual;
    });
    unlinked.forEach(i=>{
      const key=String(i.category||'Other');
      if(!categoryMap.has(key))categoryMap.set(key,{name:key,projected:0,actual:0});
      categoryMap.get(key).actual+=n(i.total_amount);
    });
    if(unallocatedSubIssued){
      categoryMap.get('Subcontractor').actual+=unallocatedSubIssued;
    }

    const hideEmpty=!!p.budget_hide_empty_rows;
    if(hideEmpty){
      phases=phases.filter(ph=>ph.system||ph.rows.length||ph.projected||ph.actual);
    }

    const contractForCollection=Math.max(0,n(p.contract_amount||discountedAmount));
    const collection=collectionModel(contractForCollection,progress);

    const categories=[...categoryMap.values()];
    const projectedPhaseTotal=phases.reduce((sum,x)=>sum+Math.max(0,n(x.projected)),0);
    const projectedCategoryTotal=categories.reduce((sum,x)=>sum+Math.max(0,n(x.projected)),0);

    // Pies must always use available project data:
    // projected data when BOQ exists, otherwise actual data from Inventory/Subcon.
    const phaseChart=phases
      .map(x=>({...x,chartAmount:projectedPhaseTotal>0?Math.max(0,n(x.projected)):Math.max(0,n(x.actual))}))
      .filter(x=>x.chartAmount>0);
    const categoryChart=categories
      .map(x=>({...x,chartAmount:projectedCategoryTotal>0?Math.max(0,n(x.projected)):Math.max(0,n(x.actual))}))
      .filter(x=>x.chartAmount>0);

    return {
      p,rowData,phases,categories,
      phaseChart,categoryChart,
      phaseChartBasis:projectedPhaseTotal>0?'Projected':'Actual',
      categoryChartBasis:projectedCategoryTotal>0?'Projected':'Actual',
      subtotalTotal,markupTotal,totalProjected,vatPct,miscPct,contractBeforeDiscount,
      discountPct,discountedAmount,totalActual,totalOverUnder,overUnderPct,
      progress,progressProjected,profitCost,unlinkedActual,subIssued,unallocatedSubIssued,
      collection,contractForCollection
    };
  }

  function donut(entries,valueKey){
    const vals=entries.filter(x=>n(x[valueKey])>0);
    const total=vals.reduce((s,x)=>s+n(x[valueKey]),0);
    if(!total)return '<div class="excel-donut-empty">No data</div>';
    const palette=['#8AB597','#CDE0D0','#F3C94B','#6AA1F2','#85D5D0','#62B36F','#E78A3B','#B8B8B8'];
    let at=0,stops=[];
    vals.forEach((x,i)=>{
      const end=at+n(x[valueKey])/total*100;
      stops.push(`${palette[i%palette.length]} ${at}% ${end}%`);
      at=end;
    });
    return `<div class="excel-donut-wrap">
      <div class="excel-donut" style="background:conic-gradient(${stops.join(',')})"><i></i></div>
      <div class="excel-donut-legend">${vals.map((x,i)=>`<span><i style="background:${palette[i%palette.length]}"></i>${esc(x.name)}</span>`).join('')}</div>
    </div>`;
  }

  function collectionPie(c){
    const total=Math.max(0,c.totalNeed);
    if(total<=0){
      return `<div class="collect-pie-wrap"><div class="collect-pie zero"><div><strong>${money0(0)}</strong><span>Need to Collect</span></div></div><div class="collect-pie-legend"><span>Project collection is currently complete based on the formula.</span></div></div>`;
    }
    const unpaidPct=total?c.pieUnpaid/total*100:0;
    return `<div class="collect-pie-wrap">
      <div class="collect-pie" style="background:conic-gradient(#F3C94B 0 ${unpaidPct}%,#6AA1F2 ${unpaidPct}% 100%)">
        <div><strong>${money0(total)}</strong><span>Total Need to Collect</span></div>
      </div>
      <div class="collect-pie-legend">
        <div><i class="unpaid"></i><span>Unpaid Existing Billing</span><strong>${money0(c.pieUnpaid)}</strong></div>
        <div><i class="future"></i><span>Remaining Future Net</span><strong>${money0(c.pieFuture)}</strong></div>
      </div>
    </div>`;
  }

  function retentionPie(c){
    const total=Math.max(0,c.totalRetentionNeed);
    if(total<=0){
      return `<div class="collect-pie-wrap"><div class="collect-pie zero"><div><strong>${money0(0)}</strong><span>Retention to Collect</span></div></div><div class="collect-pie-legend"><span>No retention amount based on the current project settings.</span></div></div>`;
    }
    const billedPct=total?Math.min(100,c.billedRetention/total*100):0;
    return `<div class="collect-pie-wrap">
      <div class="collect-pie retention-pie" style="background:conic-gradient(#62B36F 0 ${billedPct}%,#85D5D0 ${billedPct}% 100%)">
        <div><strong>${money0(total)}</strong><span>Total Retention Need to Collect</span></div>
      </div>
      <div class="collect-pie-legend">
        <div><i class="ret-billed"></i><span>Billed Retention</span><strong>${money0(c.billedRetention)}</strong></div>
        <div><i class="ret-unbilled"></i><span>Unbilled Retention</span><strong>${money0(c.unbilledRetention)}</strong></div>
      </div>
    </div>`;
  }

  function input(value,field,type='text',extra=''){
    return `<input class="excel-edit-cell" data-budget-field="${field}" type="${type}" value="${escAttr(value??'')}" ${extra}>`;
  }
  function rowInput(id,value,field,type='text',extra=''){
    return `<input class="excel-row-input" data-boq-id="${id}" data-boq-field="${field}" type="${type}" value="${escAttr(value??'')}" ${extra}>`;
  }
  function categorySelect(r){
    return `<select class="excel-row-input" data-boq-id="${r.id}" data-boq-field="cost_category">
      ${CATEGORIES.map(c=>`<option value="${escAttr(c)}" ${c===r.category?'selected':''}>${esc(c)}</option>`).join('')}
    </select>`;
  }

  function render(){
    const host=$('budgetExcelReplica');
    if(!host)return;
    const m=model(),p=m.p||{},c=m.collection;

    const phaseProjected=m.phaseChart;
    const categoryProjected=m.categoryChart;
    const phaseBreakRows=m.phases.filter(x=>!x.system).map(ph=>`
      <tr>
        <td>${esc(ph.name)}</td>
        <td>${money0(ph.variance)}</td>
        <td>${ph.projected?pct2(ph.variancePct):'-'}</td>
      </tr>`).join('');

    const phaseSections=m.phases.filter(ph=>!ph.system).map(ph=>`
      <tbody class="excel-phase-group" data-phase="${escAttr(ph.name)}">
        <tr class="excel-phase-total-row">
          <td colspan="3"><input class="excel-phase-name" data-old-phase="${escAttr(ph.name)}" value="${escAttr(ph.name)}"></td>
          <td colspan="2" class="excel-phase-total-label">${esc(ph.name)} TOTAL:</td>
          <td>${money0(ph.subtotal)}</td>
          <td></td>
          <td>${money0(ph.markup)}</td>
          <td>${money0(ph.projected)}</td>
          <td>${money0(ph.actual)}</td>
          <td class="${ph.variance<0?'excel-neg':'excel-pos'}">${money0(ph.variance)}</td>
          <td class="${ph.variance<0?'excel-neg':'excel-pos'}">${ph.projected?pct2(ph.variancePct):'-'}</td>
        </tr>
        ${ph.rows.map(r=>`
          <tr class="excel-task-row">
            <td>${rowInput(r.id,r.description,'description')}</td>
            <td>${categorySelect(r)}</td>
            <td>${rowInput(r.id,r.unit,'unit')}</td>
            <td>${rowInput(r.id,n(r.quantity),'quantity','number','step="0.0001"')}</td>
            <td>${rowInput(r.id,n(r.unit_cost),'unit_cost','number','step="0.01"')}</td>
            <td class="excel-auto-cell">${money0(r.subtotal)}</td>
            <td>${rowInput(r.id,n(r.markup_percent),'markup_percent','number','step="0.01"')}</td>
            <td class="excel-auto-cell">${money0(r.markupAmount)}</td>
            <td class="excel-auto-cell">${money0(r.projected)}</td>
            <td>
              <input class="excel-row-input excel-actual-input" data-boq-id="${r.id}" data-boq-field="actual_cost"
                type="number" step="0.01" value="${n(r.actual).toFixed(2)}"
                title="Auto = Inventory ${money0(r.invAuto)}${r.subAuto?` + Subcon Issued ${money0(r.subAuto)}`:''}. Editing stores only the adjustment.">
              <small class="excel-source-note">Auto ${money0(r.autoActual)}${r.adjustment?` · Adj ${money0(r.adjustment)}`:''}</small>
            </td>
            <td class="${r.variance<0?'excel-neg':'excel-pos'}">${money0(r.variance)}</td>
            <td class="${r.variance<0?'excel-neg':'excel-pos'}">${r.projected?pct2(r.variancePct):'-'}</td>
          </tr>`).join('')}
        <tr class="excel-phase-add-row">
          <td colspan="12"><button type="button" class="excel-add-task" data-phase="${escAttr(ph.name)}">+ Add Row</button></td>
        </tr>
      </tbody>`).join('');

    const systemRows=m.phases.filter(ph=>ph.system).map(ph=>`
      <tbody class="excel-phase-group excel-system-phase">
        <tr class="excel-phase-total-row">
          <td colspan="9"><strong>${esc(ph.name)}</strong></td>
          <td>${money0(ph.actual)}</td>
          <td class="${ph.variance<0?'excel-neg':'excel-pos'}">${money0(ph.variance)}</td>
          <td>${ph.projected?pct2(ph.variancePct):'-'}</td>
        </tr>
      </tbody>`).join('');

    const projectAddress=p.budget_project_address??p.location??'';
    const projectManager=p.budget_project_manager??'';
    const hideEmpty=!!p.budget_hide_empty_rows;

    host.innerHTML=`
      <div class="excel-budget-sheet">
        <section class="excel-budget-header">
          <div class="excel-title">Construction Budget & Cost<br>Tracker</div>
          <div class="excel-meta-grid">
            <label>Project Manager:${input(projectManager,'budget_project_manager')}</label>
            <label>Project Name:${input(p.project_name||'','project_name')}</label>
            <label>Project Address:${input(projectAddress,'budget_project_address')}</label>
          </div>
          <div class="excel-meta-grid">
            <label>Start Date:${input(p.start_date||'','start_date','date')}</label>
            <label>End Date:${input(p.target_date||'','target_date','date')}</label>
            <label>% Progress:${input(m.progress,'budget_progress_override','number','step="0.01" min="0" max="100"')}</label>
          </div>
          <div class="excel-deduction-inputs">
            <small class="excel-editable-note">EDITABLE PER PROJECT</small>
            <label>Billed Accomplishment Before %:${input(c.billedPct,'budget_billed_accomplishment_override','number','step="0.01" min="0" max="100"')}</label>
            <label>Retention %:${input(c.retPct,'budget_retention_percent','number','step="0.01" min="0" max="100"')}</label>
            <label>Recoupment %:${input(c.recPct,'budget_recoupment_percent','number','step="0.01" min="0" max="100"')}</label>
            <label class="excel-hide-empty">Hide Empty Rows?
              <input data-budget-field="budget_hide_empty_rows" type="checkbox" ${hideEmpty?'checked':''}>
            </label>
          </div>
          <div class="excel-example">EXCEL TEMPLATE:<strong>LIVE WEB VERSION</strong></div>
        </section>

        <section class="excel-top-grid">
          <div class="excel-projected-box">
            <div class="excel-green-title">PROJECTED</div>
            <div class="excel-breakdown-two">
              <div>
                <h4>Cost Breakdown by Phase</h4>
                ${m.phases.filter(x=>!x.system).map(ph=>`<div><span>${esc(ph.name)}</span><strong>${money0(ph.projected)}</strong></div>`).join('')}
              </div>
              <div>
                <h4>Cost Breakdown by Category</h4>
                ${m.categories.map(cat=>`<div><span>${esc(cat.name)}</span><strong>${money0(cat.projected)}</strong></div>`).join('')}
              </div>
            </div>
          </div>

          <div class="excel-chart-stack">
            <div class="excel-chart-card"><h3>Project Phase Breakdown</h3><small class="excel-chart-basis">${m.phaseChartBasis} cost basis</small>${donut(phaseProjected,'chartAmount')}</div>
            <div class="excel-chart-card"><h3>Cost Category Breakdown</h3><small class="excel-chart-basis">${m.categoryChartBasis} cost basis</small>${donut(categoryProjected,'chartAmount')}</div>
          </div>

          <div class="excel-financial-stack">
            <div class="excel-finance-box">
              <div><span>Subtotal:</span><strong>${money0(m.subtotalTotal)}</strong></div>
              <div><span>Markup (%):</span><strong>${m.subtotalTotal?pct2(m.markupTotal/m.subtotalTotal*100):'-'}</strong></div>
              <div><span>Total Markup (₱):</span><strong>${money0(m.markupTotal)}</strong></div>
              <div class="strong"><span>Total Projected Cost:</span><strong>${money0(m.totalProjected)}</strong></div>
              <div class="excel-blue-input"><span>VAT (%):</span>${input(m.vatPct,'budget_vat_percent','number','step="0.01"')}</div>
              <div class="excel-blue-input"><span>Misc (%):</span>${input(m.miscPct,'budget_misc_percent','number','step="0.01"')}</div>
              <div class="strong"><span>Total Contract Price:</span><strong>${money0(m.contractBeforeDiscount)}</strong></div>
              <div><span>Discounted Percentage:</span>${input(m.discountPct,'budget_discount_percent','number','step="0.0001"')}</div>
              <div class="excel-yellow-result"><span>Discounted Amount:</span><strong>${money0(m.discountedAmount)}</strong></div>
            </div>
            <div class="excel-project-summary-box">
              <h4>PROJECT SUMMARY:</h4>
              <div><span>Total Contract Cost:</span><strong>${money0(m.discountedAmount)}</strong></div>
              <div><span>Total Actual Costs:</span><strong>${money0(m.totalActual)}</strong></div>
              <div><span>Total Over/Under (₱):</span><strong class="${m.totalOverUnder<0?'excel-neg':'excel-pos'}">${money0(m.totalOverUnder)}</strong></div>
              <div><span>Over/Under (%):</span><strong class="${m.totalOverUnder<0?'excel-neg':'excel-pos'}">${pct2(m.overUnderPct)}</strong></div>
              <div><span>Accomplishment Percentage:</span><strong>${pct2(m.progress)}</strong></div>
              <div><span>Total Projected Costs:</span><strong>${money0(m.progressProjected)}</strong></div>
              <div><span>Total Retention Need to Collect:</span><strong>${money0(c.totalRetentionNeed)}</strong></div>
              <div><span>Profit Cost:</span><strong class="${m.profitCost<0?'excel-neg':'excel-pos'}">${money0(m.profitCost)}</strong></div>
            </div>
          </div>

          <div class="excel-profit-box">
            <div class="excel-yellow-title">PROFIT</div>
            <table>
              <thead><tr><th>Over/Under by Phase</th><th>Over/Under (₱)</th><th>Over/Under (%)</th></tr></thead>
              <tbody>${phaseBreakRows||'<tr><td colspan="3">No phases</td></tr>'}</tbody>
            </table>
          </div>
        </section>

        <section class="excel-collection-section">
          <div class="excel-collection-head">
            <div>
              <span>COLLECTION MONITORING</span>
              <h3>Next Billing & Total Amount Need to Collect</h3>
              <p>Hard-capped at the project Contract Amount so the computed collection requirement can never exceed the contract.</p>
            </div>
            <div class="excel-collection-contract">Contract Amount<strong>${money0(m.contractForCollection)}</strong></div>
          </div>

          <div class="excel-collection-grid">
            <div class="excel-collection-card next">
              <h4>NEXT BILLING AMOUNT NEED TO COLLECT</h4>
              <div><span>Actual Accomplishment</span><strong>${pct2(m.progress)}</strong></div>
              <div><span>Less: Total Billed Accomplishment</span><strong>${pct2(c.billedPct)}</strong></div>
              <small class="billing-baseline-note">${c.billedOverride==null?'Based on encoded Billing accomplishment %':'Historical billed accomplishment baseline for this project'}</small>
              <div class="formula-result"><span>Next Billable Accomplishment</span><strong>${pct2(c.nextPct)}</strong></div>
              <div><span>Gross: Contract × Next Billable %</span><strong>${money0(c.nextGross)}</strong></div>
              <div><span>Less Retention (${pct2(c.retPct)})</span><strong>-${money0(c.nextRetention)}</strong></div>
              <div><span>Less Recoupment (${pct2(c.recPct)})</span><strong>-${money0(c.nextRecoupment)}</strong></div>
              <div class="grand"><span>Next Billing Need to Collect</span><strong>${money0(c.nextNet)}</strong></div>
            </div>

            <div class="excel-collection-card total">
              <h4>TOTAL AMOUNT NEED TO COLLECT</h4>
              <div><span>100% Less Actual Accomplishment</span><strong>${pct2(c.remainingPct)}</strong></div>
              <div><span>Remaining Gross Contract Amount</span><strong>${money0(c.remainingGross)}</strong></div>
              <div><span>Less Retention (${pct2(c.retPct)})</span><strong>-${money0(c.remainingRetention)}</strong></div>
              <div><span>Less Recoupment (${pct2(c.recPct)})</span><strong>-${money0(c.remainingRecoupment)}</strong></div>
              <div class="formula-result"><span>Remaining Future Net</span><strong>${money0(c.remainingFutureNet)}</strong></div>
              <div><span>Add Remaining Unpaid Billings</span><strong>+${money0(c.unpaid)}</strong></div>
              <div class="grand"><span>Total Amount Need to Collect</span><strong>${money0(c.totalNeed)}</strong></div>
              ${c.rawTotalNeed>m.contractForCollection+.01?`<small class="contract-cap-note">Raw result ${money0(c.rawTotalNeed)} was capped at Contract Amount.</small>`:''}
            </div>

            <div class="excel-collection-card retention">
              <h4>TOTAL RETENTION NEED TO COLLECT</h4>
              <div><span>Retention %</span><strong>${pct2(c.retPct)}</strong></div>
              <div><span>Billed Retention Held</span><strong>${money0(c.billedRetention)}</strong></div>
              <div><span>Unbilled Accomplishment</span><strong>${pct2(c.unbilledPct)}</strong></div>
              <div><span>Unbilled Gross Contract Amount</span><strong>${money0(c.unbilledGross)}</strong></div>
              <div class="formula-result"><span>Unbilled Retention Amount</span><strong>${money0(c.unbilledRetention)}</strong></div>
              <div class="grand"><span>Total Retention Need to Collect</span><strong>${money0(c.totalRetentionNeed)}</strong></div>
              <small class="retention-separate-note">Separate from Total Amount Need to Collect.</small>
            </div>

            <div class="excel-collection-pie-card">
              <h4>Need to Collect Breakdown</h4>
              ${collectionPie(c)}
              <div class="excel-collection-mini">
                <span>Total Received (DP excluded)<strong>${money0(c.collected)}</strong></span>
                <span>Unpaid Billing<strong>${money0(c.unpaid)}</strong></span>
                <span>Next Billing Need<strong>${money0(c.nextNet)}</strong></span>
              </div>
            </div>

            <div class="excel-collection-pie-card">
              <h4>Retention to Collect Breakdown</h4>
              ${retentionPie(c)}
              <div class="excel-collection-mini">
                <span>Retention Rate<strong>${pct2(c.retPct)}</strong></span>
                <span>Billed Retention<strong>${money0(c.billedRetention)}</strong></span>
                <span>Unbilled Retention<strong>${money0(c.unbilledRetention)}</strong></span>
              </div>
            </div>
          </div>
        </section>

        <section class="excel-main-table-wrap">
          <div class="excel-sheet-toolbar">
            <button type="button" id="budgetAddPhaseBtn" class="secondary-btn">+ Add Phase</button>
            <button type="button" id="budgetAddRowBtn" class="primary-btn">+ Add Row</button>
            <span>Enter/edit the same workbook input fields. Formula cells auto-calculate. Actual Cost automatically includes Inventory and Subcon Issued Amounts.</span>
          </div>

          <table class="excel-main-table">
            <thead>
              <tr class="excel-input-hint">
                <th>Enter input</th><th>Enter input</th><th>Enter input</th><th>Enter input</th><th>Enter input</th>
                <th>Auto-populate</th><th>Enter input</th><th>Auto-populate</th><th>Auto-populate</th><th>Enter input</th>
                <th colspan="2">Auto-populate</th>
              </tr>
              <tr>
                <th>TASK NAME</th><th>CATEGORY</th><th>UOM</th><th>QTY.</th><th>UNIT COST</th>
                <th>SUB-TOTAL</th><th>Markup (%)</th><th>Markup (₱)</th><th>TOTAL PROJECTED COST</th>
                <th>TOTAL ACTUAL COSTS</th><th>Over/Under (₱)</th><th>Over/Under (%)</th>
              </tr>
            </thead>
            ${phaseSections}
            ${systemRows}
          </table>
        </section>
      </div>`;

    wire();
  }

  async function updateProject(field,value){
    const p=project();
    if(!p)return;
    let dbValue=value;

    if(field==='budget_hide_empty_rows')dbValue=!!value;
    else if(['budget_vat_percent','budget_misc_percent','budget_discount_percent','budget_progress_override','budget_retention_percent','budget_recoupment_percent','budget_billed_accomplishment_override'].includes(field)){
      dbValue=value===''?null:n(value);
    }else if(['project_name','budget_project_manager','budget_project_address'].includes(field)){
      dbValue=String(value??'').trim();
    }else if(['start_date','target_date'].includes(field)){
      dbValue=value||null;
    }

    const {error}=await sb.from('projects').update({[field]:dbValue}).eq('id',p.id);
    if(error)return alert(error.message);
    p[field]=dbValue;

    if(field==='project_name'){
      [...($('workspaceProject')?.options||[])].forEach(o=>{
        if(String(o.value)===String(p.id))o.textContent=dbValue||'Untitled Project';
      });
    }
    render();
  }

  async function updateBoq(el){
    const id=el.dataset.boqId,field=el.dataset.boqField;
    const b=(cache.boq||[]).find(x=>String(x.id)===String(id));
    if(!b)return;

    const raw=el.value;
    let values={};

    if(field==='actual_cost'){
      const current=model().rowData.find(x=>String(x.id)===String(id));
      const wanted=n(raw),auto=current?.autoActual||0;
      values.actual_cost_adjustment=wanted-auto;
      b.actual_cost_adjustment=values.actual_cost_adjustment;
    }else if(['quantity','unit_cost','markup_percent'].includes(field)){
      values[field]=n(raw);
      b[field]=values[field];
      if(field==='quantity'||field==='unit_cost'){
        values.amount=n(field==='quantity'?raw:b.quantity)*n(field==='unit_cost'?raw:b.unit_cost);
        b.amount=values.amount;
      }
    }else{
      values[field]=String(raw??'').trim();
      b[field]=values[field];
    }

    const {error}=await sb.from('boq_items').update(values).eq('id',id);
    if(error)return alert(error.message);
    render();
  }

  async function addRow(phase){
    const projectId=pid();
    if(!projectId)return alert('Select an Active Project Folder first.');
    const target=phase||model().phases.find(x=>!x.system)?.name||DEFAULT_PHASES[0];
    const order=boq().reduce((mx,x)=>Math.max(mx,n(x.display_order)),0)+1;

    const {error}=await sb.from('boq_items').insert({
      project_id:projectId,
      description:'New Task',
      phase_name:target,
      cost_category:'Materials',
      unit:'Lot',
      quantity:1,
      unit_cost:0,
      amount:0,
      markup_percent:0,
      actual_cost_adjustment:0,
      display_order:order,
      created_by:currentUser.id
    });
    if(error)return alert(error.message);
    await refreshAll();
    render();
  }

  async function renamePhase(oldName,newName){
    newName=String(newName||'').trim().toUpperCase();
    if(!newName||newName===oldName)return render();
    const ids=boq().filter(b=>phaseOf(b)===oldName).map(b=>b.id);
    if(!ids.length){
      // Empty default phase: first Add Row will use the new name.
      return;
    }
    const {error}=await sb.from('boq_items').update({phase_name:newName}).in('id',ids);
    if(error)return alert(error.message);
    cache.boq.forEach(b=>{if(ids.includes(b.id))b.phase_name=newName});
    render();
  }

  function wire(){
    const host=$('budgetExcelReplica');
    if(!host)return;

    host.querySelectorAll('[data-budget-field]').forEach(el=>{
      el.onchange=()=>{
        const field=el.dataset.budgetField;
        updateProject(field,el.type==='checkbox'?el.checked:el.value);
      };
    });
    host.querySelectorAll('[data-boq-id][data-boq-field]').forEach(el=>{
      el.onchange=()=>updateBoq(el);
    });
    host.querySelectorAll('.excel-phase-name').forEach(el=>{
      el.onchange=()=>renamePhase(el.dataset.oldPhase,el.value);
    });
    host.querySelectorAll('.excel-add-task').forEach(btn=>{
      btn.onclick=()=>addRow(btn.dataset.phase);
    });

    const addRowBtn=$('budgetAddRowBtn');
    if(addRowBtn)addRowBtn.onclick=()=>addRow();

    const addPhaseBtn=$('budgetAddPhaseBtn');
    if(addPhaseBtn)addPhaseBtn.onclick=async()=>{
      const name=prompt('New phase name:');
      if(!name)return;
      await addRow(String(name).trim().toUpperCase());
    };
  }

  // Final Budget renderer. It supersedes the older Budget panels/renderers.
  window.renderBudget=render;

  window.budgetData=function(){
    const m=model();
    return {
      p:m.p,
      contract:m.discountedAmount,
      runningCost:m.totalActual,
      committed:m.totalProjected,
      actual:m.progress,
      earned:m.progressProjected,
      runningProfit:m.profitCost,
      projectedProfit:m.discountedAmount-m.totalProjected,
      categories:Object.fromEntries(m.categories.map(c=>[c.name,c.actual])),
      live:m
    };
  };

  requestAnimationFrame(()=>{if(document.querySelector('#budget.active-view'))render()});
})();
