// SAIKO Construction AI v21 — full SUMMARY mirror, lightweight
(function(){
  const $=id=>document.getElementById(id);
  let renderTimer=null;

  function selectedQuotation(){
    const list=cache.quotationProjects||[];
    const active=document.querySelector('.quotation-project-card.active');
    const id=active?.dataset?.quotationId;
    if(id)return list.find(q=>String(q.id)===String(id))||null;
    return list[0]||null;
  }

  function arr(v){
    if(Array.isArray(v))return v;
    if(typeof v==='string'){
      try{const x=JSON.parse(v);return Array.isArray(x)?x:[]}catch(_){}
    }
    return [];
  }

  function escapeHtml(s){
    return String(s??'').replace(/[&<>"']/g,m=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[m]));
  }

  function renderSummaryMirror(){
    const table=$('quotationSummaryMirrorTable');
    if(!table)return;

    const q=selectedQuotation();
    const rows=arr(q?.summary_table);
    const headers=arr(q?.summary_headers);
    const badge=$('quotationSummaryMirrorBadge');

    if(badge){
      badge.textContent=(q?.summary_sheet_name||'SUMMARY')+(rows.length?` · ${rows.length} rows`:'');
    }

    if(!rows.length){
      table.innerHTML='<tbody><tr><td class="summary-mirror-empty">No saved Summary data yet. Click “Refresh from Sheet” to read the complete SUMMARY tab.</td></tr></tbody>';
      return;
    }

    const cols=headers.length
      ? headers
      : (rows[0]?.cells||[]).map(c=>({key:c.column,label:c.column}));

    let out='<thead><tr>';
    for(const c of cols)out+=`<th>${escapeHtml(c.label||c.key||'')}</th>`;
    out+='</tr></thead><tbody>';

    for(const row of rows){
      const map=new Map((row.cells||[]).map(c=>[String(c.column),c]));
      out+=`<tr data-summary-row="${row.row}">`;
      for(const col of cols){
        const key=String(col.key||col.label||col.column||'');
        const c=map.get(key)||{};
        const cls=c.isPercent?'summary-percent-cell':(c.numeric!==null&&c.numeric!==undefined?'summary-number-cell':'');
        let inline='';
        if(c.bold)inline+='font-weight:800;';
        if(c.italic)inline+='font-style:italic;';
        if(c.align)inline+=`text-align:${c.align};`;
        out+=`<td class="${cls}" title="${escapeHtml(c.address||'')}" style="${inline}">${escapeHtml(c.display??'')}</td>`;
      }
      out+='</tr>';
    }
    out+='</tbody>';

    table.innerHTML=out;
  }

  function scheduleRender(delay=0){
    if(renderTimer)clearTimeout(renderTimer);
    renderTimer=setTimeout(()=>{renderTimer=null;renderSummaryMirror()},delay);
  }

  // One delegated click handler only. No MutationObserver, no intervals.
  document.addEventListener('click',e=>{
    if(e.target.closest?.('.quotation-project-card[data-quotation-id]'))scheduleRender(0);
    if(e.target.closest?.('#refreshQuotationLinkBtn'))scheduleRender(1200);
  });

  // Initial render only.
  scheduleRender(900);

  window.renderQuotationSummaryMirror=renderSummaryMirror;
})();
