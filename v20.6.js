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
    if(sheetBadge)sheetBadge.textContent=q?.summary_sheet_name||'Summary';
    if(!box)return;

    if(!categories.length){
      box.innerHTML='<div class="settings-empty-state">No Summary-sheet category breakdown has been saved yet. Click “Refresh from Sheet” after uploading v20.6 and running its SQL migration.</div>';
      return;
    }

    box.innerHTML=categories.map((c,i)=>{
      const items=Array.isArray(c.items)?c.items:[];
      return `<details class="quotation-summary-category" ${i<2?'open':''}>
        <summary>
          <span class="quotation-summary-swatch" style="background:${palette[i%palette.length]}"></span>
          <strong>${esc(c.name)}</strong>
          <span>${money(Number(c.amount||0))}</span>
          <b>${Number(c.percentage||0).toFixed(1)}%</b>
        </summary>
        <div class="quotation-summary-items">
          ${items.length?items.map(item=>`<div class="quotation-summary-item">
            <span>${esc(item.name)}</span>
            <strong>${money(Number(item.amount||0))}</strong>
            <b>${Number(item.percentage||0).toFixed(1)}%</b>
          </div>`).join(''):'<div class="muted">No child line-items detected under this category.</div>'}
        </div>
      </details>`;
    }).join('');
  }

  function renderPieFromSummary(){
    const q=selectedQuotation();
    const categories=parsedSummary(q).filter(x=>Number(x.amount)>0);
    const pie=$('quotationScopePie'), legend=$('quotationScopeLegend'), count=$('quotationScopeCount'), total=$('quotationScopeTotalPct');
    if(!pie||!legend||!count||!total)return;

    count.textContent=`${categories.length} major scope${categories.length===1?'':'s'}`;
    if(!categories.length){
      pie.style.background='conic-gradient(#e5e7eb 0 100%)';
      total.textContent='0%';
      legend.innerHTML='<div class="settings-empty-state">No Summary-sheet scopes detected yet.</div>';
      return;
    }

    const sum=categories.reduce((s,x)=>s+Number(x.amount||0),0)||1;
    let cursor=0;
    const stops=[];
    const normalized=categories.map((x,i)=>({...x,pct:Number(x.amount||0)/sum*100,color:palette[i%palette.length]}));
    normalized.forEach(x=>{
      const start=cursor; cursor+=x.pct;
      stops.push(`${x.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`);
    });
    pie.style.background=`conic-gradient(${stops.join(',')})`;
    total.textContent='100%';

    legend.innerHTML=normalized.map(x=>`<div class="quotation-scope-item">
      <span class="quotation-scope-swatch" style="background:${x.color}"></span>
      <div class="quotation-scope-main">
        <strong>${esc(x.name)}</strong>
        <small>${money(Number(x.amount||0))}</small>
      </div>
      <b>${x.pct.toFixed(1)}%</b>
    </div>`).join('');
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
