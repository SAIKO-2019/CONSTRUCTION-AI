// SAIKO Construction AI v20.5 — scope breakdown + pie chart
(function(){
  const $=id=>document.getElementById(id);
  const palette=['#0ea5e9','#14b8a6','#8b5cf6','#f59e0b','#ef4444','#22c55e','#ec4899','#6366f1','#84cc16','#f97316','#06b6d4','#a855f7'];

  function selectedQuotation(){
    const list=cache.quotationProjects||[];
    const active=document.querySelector('.quotation-project-card.active');
    const id=active?.dataset?.quotationId;
    if(id)return list.find(x=>String(x.id)===String(id))||null;
    return list[0]||null;
  }

  function scopesOf(q){
    let s=q?.scope_breakdown;
    if(typeof s==='string'){
      try{s=JSON.parse(s)}catch(_){s=[]}
    }
    return Array.isArray(s)?s.filter(x=>x&&x.name&&Number(x.percentage)>0):[];
  }

  function renderScopePie(){
    const q=selectedQuotation();
    const scopes=scopesOf(q);
    const pie=$('quotationScopePie'), legend=$('quotationScopeLegend'), count=$('quotationScopeCount'), totalPct=$('quotationScopeTotalPct');
    if(!pie||!legend||!count||!totalPct)return;

    count.textContent=`${scopes.length} scope${scopes.length===1?'':'s'}`;
    if(!scopes.length){
      pie.style.background='conic-gradient(#e5e7eb 0 100%)';
      totalPct.textContent='0%';
      legend.innerHTML='<div class="settings-empty-state">No scope breakdown detected yet. Click “Refresh from Sheet” after the Sheet has a Scope/Description table with Amount, Cost, Weight, or Percentage.</div>';
      return;
    }

    const rawTotal=scopes.reduce((s,x)=>s+Number(x.percentage||0),0)||100;
    const normalized=scopes.map((x,i)=>({...x,pct:Number(x.percentage||0)/rawTotal*100,color:palette[i%palette.length]}));
    let cursor=0;
    const stops=[];
    for(const x of normalized){
      const start=cursor;
      cursor+=x.pct;
      stops.push(`${x.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`);
    }
    pie.style.background=`conic-gradient(${stops.join(',')})`;
    totalPct.textContent='100%';

    legend.innerHTML=normalized.map(x=>`<div class="quotation-scope-item">
      <span class="quotation-scope-swatch" style="background:${x.color}"></span>
      <div class="quotation-scope-main">
        <strong>${esc(x.name)}</strong>
        ${Number.isFinite(Number(x.amount)) && Number(x.amount)>0 ? `<small>${money(Number(x.amount))}</small>` : '<small>Read from Google Sheet</small>'}
      </div>
      <b>${x.pct.toFixed(1)}%</b>
    </div>`).join('');
  }

  const oldRender=window.renderPending;
  if(typeof oldRender==='function'){
    window.renderPending=function(){
      const out=oldRender.apply(this,arguments);
      setTimeout(renderScopePie,0);
      return out;
    };
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-quotation-id]'))setTimeout(renderScopePie,0);
    if(e.target.closest?.('#refreshQuotationLinkBtn'))setTimeout(renderScopePie,800);
  });

  window.renderQuotationScopePie=renderScopePie;
  setTimeout(()=>{if(currentUser)renderScopePie()},1200);
})();
