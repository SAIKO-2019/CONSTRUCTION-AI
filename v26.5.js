// SAIKO Construction AI v26.5
// 1) Actual tracker follows the linked Actual GSheet scope / TOTAL / STATUS format.
// 2) Subcon folder uses one clean standardized table for every project.
(function(){
  const n=v=>{
    if(v==null)return 0;
    const x=Number(String(v).replace(/,/g,'').replace(/%/g,'').trim());
    return Number.isFinite(x)?x:0;
  };
  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9%]+/g,' ').replace(/\s+/g,' ').trim();

  function currentActualProjectId(){
    return $('progressProject')?.value||$('workspaceProject')?.value||cache.projects?.[0]?.id||'';
  }

  function scopeNameFromRows(rows, headerRow, descCol){
    for(let r=headerRow-1;r>=Math.max(0,headerRow-5);r--){
      const vals=(rows[r]||[]).slice(Math.max(0,descCol-1),descCol+3).map(clean).filter(Boolean);
      const explicit=vals.find(v=>/\bworks?\b/i.test(v));
      if(explicit)return explicit.toUpperCase();
      const candidate=vals.find(v=>/[A-Za-z]/.test(v) && !/%/.test(v) && !/description|total|status|distribution|balanced|equivalent/i.test(v));
      if(candidate)return candidate.toUpperCase();
    }
    return '';
  }

  // Parse the Actual GSheet in the same format the user sees:
  // Scope title -> DESCRIPTION / TOTAL / ... / STATUS / BALANCED -> OVERALL ACCOMPLISHMENT STATUS.
  function parseActualScopeBlocks(rows){
    const out=[];
    const seen=new Set();

    for(let r=0;r<rows.length;r++){
      const row=rows[r]||[];

      // Multiple blocks can exist side-by-side on the same sheet row.
      for(let descCol=0;descCol<row.length;descCol++){
        const h=norm(row[descCol]);
        if(!(h==='description'||h.includes('description')))continue;

        let totalCol=-1,statusCol=-1,balanceCol=-1;
        for(let c=descCol+1;c<Math.min(row.length,descCol+7);c++){
          const hc=norm(row[c]);
          if(totalCol<0 && hc==='total')totalCol=c;
          if(statusCol<0 && (hc==='status'||hc.includes('actual')||hc.includes('accomplishment')))statusCol=c;
          if(balanceCol<0 && (hc.includes('balanced')||hc.includes('balance')))balanceCol=c;
        }
        if(totalCol<0||statusCol<0)continue;

        const scope=scopeNameFromRows(rows,r,descCol);
        if(!scope)continue;

        let overall=null;
        for(let rr=r+1;rr<Math.min(rows.length,r+15);rr++){
          const d=clean((rows[rr]||[])[descCol]);
          if(!d)continue;
          if(
            /overall.*(accomplishment|status|progress|percentage)/i.test(d) ||
            /overall\s*status/i.test(d)
          ){
            overall=rows[rr]||[];
            break;
          }
          if(rr>r+1 && /^description$/i.test(d))break;
        }
        if(!overall)continue;

        const key=scope.replace(/\s+/g,' ').trim();
        if(seen.has(key))continue;
        seen.add(key);

        const total=Math.max(0,n(overall[totalCol]));
        const status=Math.max(0,n(overall[statusCol]));
        const explicitBalance=balanceCol>=0?n(overall[balanceCol]):NaN;
        const balance=Number.isFinite(explicitBalance) && clean(overall[balanceCol])!=='' ? explicitBalance : Math.max(0,total-status);

        out.push({scope:key,total,status,balance});
      }
    }

    return out;
  }

  function fallbackActualScopes(pid){
    return (cache.progress||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({
        scope:String(r.activity||'').toUpperCase(),
        total:0,
        status:Math.max(0,n(r.actual_percent)),
        balance:0
      }));
  }

  function renderActualScopeStatus(){
    const tbody=$('actualScopeStatusRows');
    const badge=$('actualScopeStatusBadge');
    if(!tbody)return;

    const pid=currentActualProjectId();
    const raw=window.trackerSheetViews?.actual?.[String(pid)]||[];
    let scopes=parseActualScopeBlocks(raw);
    if(!scopes.length)scopes=fallbackActualScopes(pid);

    if(!scopes.length){
      tbody.innerHTML='<tr><td colspan="4" class="empty">Sync the Actual Google Sheet to read the scope STATUS values.</td></tr>';
      if(badge)badge.textContent='WAITING';
      return;
    }

    const preferred=[
      'CEILING WORKS','CABINETRY WORKS','WALL FINISHING WORKS','FLOORING WORKS',
      'ELECTRICAL WORKS','PLUMBING WORKS','GLASS WORKS','GENERAL REQUIREMENTS'
    ];
    scopes.sort((a,b)=>{
      const ai=preferred.indexOf(a.scope),bi=preferred.indexOf(b.scope);
      if(ai<0&&bi<0)return a.scope.localeCompare(b.scope);
      if(ai<0)return 1;
      if(bi<0)return -1;
      return ai-bi;
    });

    tbody.innerHTML=scopes.map(s=>`<tr>
      <td><strong>${esc(s.scope)}</strong></td>
      <td>${pct(s.total)}</td>
      <td><strong>${pct(s.status)}</strong></td>
      <td>${pct(s.balance)}</td>
    </tr>`).join('');

    const actualTotal=Math.max(0,Math.min(100,scopes.reduce((sum,s)=>sum+s.status,0)));
    if(badge)badge.textContent=`TOTAL STATUS ${pct(actualTotal)}`;
  }

  // Wrap the final v26.4 Actual renderer. Live sync calls renderProgress,
  // so this table updates automatically every sync without another timer.
  const prevProgress=window.renderProgress;
  window.renderProgress=function(){
    const out=prevProgress.apply(this,arguments);
    renderActualScopeStatus();
    return out;
  };

  if($('progressProject')){
    $('progressProject').addEventListener('change',()=>setTimeout(renderActualScopeStatus,10),{passive:true});
  }

  // ---------------- Clean standardized Subcon folder ----------------
  function currentBillingProject(){
    const pid=$('billingProjectFilter')?.value||$('workspaceProject')?.value||'';
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }

  function calcLinked(b){
    const collected=Math.max(0,n(b.received_amount));
    const deductions=Math.max(0,n(b.subcon_total_deductions));
    const retention=collected*Math.max(0,n(b.subcon_retention_percent))/100;
    const recoupment=collected*Math.max(0,n(b.subcon_recoupment_percent))/100;
    const available=Math.max(0,collected-deductions-retention-recoupment);
    return {collected,deductions,retention,recoupment,available};
  }

  function billingLabel(b){
    if(b.billing_category==='Downpayment')return `Downpayment ${esc(b.billing_no||'')}`;
    if(b.variation_no)return `VO ${esc(b.variation_no)}`;
    return `Billing ${esc(b.billing_no||'—')}`;
  }

  function renderStandardSubconFolder(){
    const holder=$('linkedSubconRows');
    const panel=$('linkedSubconPanel');
    if(!holder||!panel)return;

    const active=document.querySelector('.billing-party-tab.active')?.dataset?.billingParty||'gencon';
    if(active!=='subcon')return;

    const p=currentBillingProject();
    if(!p){
      holder.innerHTML='<div class="empty">Select a project.</div>';
      return;
    }

    const rows=(cache.billings||[]).filter(b=>
      String(b.project_id)===String(p.id) &&
      b.billing_type!=='Subcontractor Billing'
    );

    const contract=Math.max(0,n(p.subcon_contract_amount));
    const scope=clean(p.subcon_scope_caption)||'—';

    const summary=`<div class="subcon-clean-summary">
      <div><span>Subcon Contract Amount</span><strong>${money(contract)}</strong></div>
      <div><span>Subcontracted Scope</span><strong>${esc(scope)}</strong></div>
    </div>`;

    if(!rows.length){
      holder.innerHTML=summary+'<div class="empty">No GenCon billing yet for this project.</div>';
      return;
    }

    holder.innerHTML=summary+`<div class="subcon-clean-table-wrap">
      <table class="subcon-clean-table">
        <thead><tr>
          <th>Billing</th>
          <th>Subcon</th>
          <th>GenCon Collected</th>
          <th>Deductions</th>
          <th>Retention</th>
          <th>Recoupment</th>
          <th>Available</th>
          <th>Action</th>
        </tr></thead>
        <tbody>${rows.map(b=>{
          const c=calcLinked(b);
          const has=!!b.has_subcon;
          return `<tr class="${has?'has-subcon-row':'no-subcon-row'}">
            <td><strong>${billingLabel(b)}</strong></td>
            <td><span class="subcon-clean-pill ${has?'yes':'no'}">${has?'Has Subcon':'No Subcon'}</span></td>
            <td>${money(c.collected)}</td>
            <td>${money(c.deductions)}</td>
            <td>${money(c.retention)}</td>
            <td>${money(c.recoupment)}</td>
            <td><strong>${has?money(c.available):'—'}</strong></td>
            <td><button type="button" class="secondary-btn compact-btn" onclick="openLinkedSubcon('${b.id}')">Setup</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
  }

  // v24.1 renders cards first; v26.5 immediately normalizes them into the same table.
  const prevBilling=window.renderBilling;
  window.renderBilling=function(){
    const out=prevBilling.apply(this,arguments);
    renderStandardSubconFolder();
    return out;
  };

  document.querySelectorAll('.billing-party-tab').forEach(btn=>{
    btn.addEventListener('click',()=>setTimeout(renderStandardSubconFolder,50));
  });
  if($('billingProjectFilter')){
    $('billingProjectFilter').addEventListener('change',()=>setTimeout(renderStandardSubconFolder,20));
  }

  setTimeout(()=>{
    renderActualScopeStatus();
    renderStandardSubconFolder();
  },400);

  window.renderActualScopeStatus=renderActualScopeStatus;
  window.renderStandardSubconFolder=renderStandardSubconFolder;
})();
