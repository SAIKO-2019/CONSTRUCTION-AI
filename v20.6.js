// SAIKO Construction AI v20.6 — full Summary-sheet category reader
(function(){
  const $=id=>document.getElementById(id);
  const palette=['#0ea5e9','#14b8a6','#8b5cf6','#f59e0b','#ef4444','#22c55e','#ec4899','#6366f1','#84cc16','#f97316','#06b6d4','#a855f7','#64748b'];

  function selectedQuotation(){
    const list=cache.quotationProjects||[];
    const active=document.querySelector('.quotation-project-card.active');
    const id=active?.dataset?.quotationId;
    if(id)return list.find(x=>String(x.id)===String(id))||null;
    return list[0]||null;
  }

  function parsedSummary(q){
    let s=q?.summary_breakdown;
    if(typeof s==='string'){try{s=JSON.parse(s)}catch(_){s=[]}}
    return Array.isArray(s)?s.filter(x=>x&&x.name):[];
  }

  function renderSummary(){
    const q=selectedQuotation();
    const categories=parsedSummary(q);
    const sheetBadge=$('quotationSummarySheetName');
    const box=$('quotationSummaryCategories');
    if(sheetBadge)sheetBadge.textContent=q?.summary_sheet_name||'SUMMARY';
    if(!box)return;

    if(!categories.length){
      box.innerHTML='<div class="settings-empty-state">No saved Summary breakdown yet. Click “Refresh from Sheet” to read Item No. A/B/C/D… from the SUMMARY tab.</div>';
      return;
    }

    box.innerHTML=categories.map((c,i)=>{
      const items=Array.isArray(c.items)?c.items:[];
      const no=esc(c.itemNo||String.fromCharCode(65+i));
      return `<details class="quotation-summary-category" open>
        <summary class="quotation-summary-major">
          <span class="quotation-summary-itemno">${no}</span>
          <strong>${esc(c.name)}</strong>
          <span>${money(Number(c.amount||0))}</span>
          <span>${Number.isFinite(Number(c.costPerSqm))?money(Number(c.costPerSqm)):'—'}</span>
          <b>${Number(c.percentage||0).toFixed(2)}%</b>
        </summary>
        <div class="quotation-summary-items quotation-summary-grid">
          <div class="quotation-summary-grid-head">
            <span>Description</span><span>Total Amount</span><span>Cost / Sq.m</span><span>Weighted %</span>
          </div>
          ${items.length?items.map(item=>`<div class="quotation-summary-item">
            <span>${esc(item.name)}</span>
            <strong>${Number.isFinite(Number(item.amount))?money(Number(item.amount)):'—'}</strong>
            <strong>${Number.isFinite(Number(item.costPerSqm))?money(Number(item.costPerSqm)):'—'}</strong>
            <b>${Number.isFinite(Number(item.percentage))?Number(item.percentage).toFixed(2)+'%':'—'}</b>
          </div>`).join(''):'<div class="muted">No child descriptions detected under this Item No.</div>'}
          <div class="quotation-summary-subtotal">
            <span>${esc(c.subtotalLabel||`${c.name} Sub-total`)}</span>
            <strong>${money(Number(c.amount||0))}</strong>
            <strong>${Number.isFinite(Number(c.costPerSqm))?money(Number(c.costPerSqm)):'—'}</strong>
            <b>${Number(c.percentage||0).toFixed(2)}%</b>
          </div>
        </div>
      </details>`;
    }).join('');
  }

  function renderPieFromSummary(){
    const q=selectedQuotation();
    const categories=parsedSummary(q).filter(x=>Number(x.percentage)>0||Number(x.amount)>0);
    const pie=$('quotationScopePie'),legend=$('quotationScopeLegend'),count=$('quotationScopeCount'),total=$('quotationScopeTotalPct');
    if(!pie||!legend||!count||!total)return;

    count.textContent=`${categories.length} major scope${categories.length===1?'':'s'}`;
    if(!categories.length){
      pie.style.background='conic-gradient(#e5e7eb 0 100%)';
      total.textContent='0%';
      legend.innerHTML='<div class="settings-empty-state">No Item No. scopes detected yet.</div>';
      return;
    }

    const amountTotal=categories.reduce((s,x)=>s+(Number(x.amount)||0),0);
    const rows=categories.map((x,i)=>{
      let pct=Number(x.percentage);
      if(!Number.isFinite(pct)||pct<0){
        pct=amountTotal>0?(Number(x.amount||0)/amountTotal*100):0;
      }
      return {...x,pct,color:palette[i%palette.length]};
    });

    const sourceTotal=rows.reduce((s,x)=>s+x.pct,0);
    let cursor=0; const stops=[];
    rows.forEach(x=>{
      const a=Math.max(0,Math.min(100,cursor));
      cursor+=x.pct;
      const b=Math.max(a,Math.min(100,cursor));
      if(b>a)stops.push(`${x.color} ${a.toFixed(2)}% ${b.toFixed(2)}%`);
    });
    if(cursor<99.995)stops.push(`#e5e7eb ${Math.max(0,cursor).toFixed(2)}% 100%`);
    if(!stops.length)stops.push('#e5e7eb 0 100%');

    pie.style.background=`conic-gradient(${stops.join(',')})`;
    total.textContent=`${sourceTotal.toFixed(1)}%`;

    legend.innerHTML=rows.map(x=>`<div class="quotation-scope-item">
      <span class="quotation-scope-swatch" style="background:${x.color}"></span>
      <div class="quotation-scope-main">
        <strong>${esc(x.itemNo||'')} · ${esc(x.name)}</strong>
        <small>${money(Number(x.amount||0))}${Number.isFinite(Number(x.costPerSqm))?` · ${money(Number(x.costPerSqm))}/sq.m`:''}</small>
      </div>
      <b>${x.pct.toFixed(2)}%</b>
    </div>`).join('')
    +(sourceTotal<99.995?`<div class="quotation-scope-item quotation-scope-unallocated">
      <span class="quotation-scope-swatch" style="background:#e5e7eb"></span>
      <div class="quotation-scope-main"><strong>Unallocated</strong><small>Remaining weighted percentage</small></div>
      <b>${(100-sourceTotal).toFixed(2)}%</b>
    </div>`:'');
  }

  function renderAll(){
    renderSummary();
    renderPieFromSummary();
  }

  const oldRender=window.renderPending;
  if(typeof oldRender==='function'){
    window.renderPending=function(){
      const out=oldRender.apply(this,arguments);
      setTimeout(renderAll,0);
      return out;
    };
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-quotation-id]'))setTimeout(renderAll,0);
    if(e.target.closest?.('#refreshQuotationLinkBtn'))setTimeout(renderAll,900);
  });

  window.renderQuotationSummary=renderAll;
  setTimeout(()=>{if(currentUser)renderAll()},1200);
})();
