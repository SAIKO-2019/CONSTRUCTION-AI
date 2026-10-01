// SAIKO Construction AI v23.8
// Billing folders: GenCon / Subcon, with animated transition and dashboard rollups.
(function(){
  const FOLDER_KEY='saiko_billing_party_folder';
  let party='gencon';
  try{party=localStorage.getItem(FOLDER_KEY)||'gencon'}catch(_){ }
  if(!['gencon','subcon'].includes(party))party='gencon';

  function moneyN(v){return Number(v||0)}
  function currentProjectId(){return $('billingProjectFilter')?.value||$('workspaceProject')?.value||''}
  function currentRows(){
    const pid=currentProjectId();
    const rows=cache.billings||[];
    return pid?rows.filter(b=>String(b.project_id)===String(pid)):rows;
  }

  function isGenconRow(b){return b.billing_type!=='Subcontractor Billing'}
  function isSubconRow(b){return b.billing_type==='Subcontractor Billing'}

  // v28.28: natural ascending order for every project's GenCon/Subcon folder.
  // Downpayment first, then Billing No.1, No.2, No.3..., then VO No.1...
  function naturalNumber(value){
    const m=String(value||'').match(/-?\d+(?:\.\d+)?/);
    return m?Number(m[0]):Number.POSITIVE_INFINITY;
  }
  function billingKindRank(b){
    const cat=String(b.billing_category||'').trim().toLowerCase();
    const label=[b.billing_no,b.variation_no,b.billing_category].filter(Boolean).join(' ').toLowerCase();
    if(cat==='downpayment'||/(^|[^a-z])(down\s*payment|downpayment|dp)([^a-z]|$)/i.test(label))return 0;
    if(String(b.variation_no||'').trim())return 2;
    if(cat==='billing'||String(b.billing_no||'').trim())return 1;
    return 3;
  }
  function compareBillingAsc(a,b){
    const kind=billingKindRank(a)-billingKindRank(b);
    if(kind)return kind;

    const av=a.variation_no||a.billing_no||'';
    const bv=b.variation_no||b.billing_no||'';
    const an=naturalNumber(av),bn=naturalNumber(bv);
    if(an!==bn)return an-bn;

    const txt=String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'});
    if(txt)return txt;

    const ad=String(a.date_request||a.date_submitted||a.created_at||'');
    const bd=String(b.date_request||b.date_submitted||b.created_at||'');
    if(ad!==bd)return ad.localeCompare(bd);

    return String(a.id||'').localeCompare(String(b.id||''));
  }

  function totals(rows){
    const gross=rows.reduce((s,b)=>s+moneyN(b.gross_amount),0);
    const received=rows.reduce((s,b)=>s+moneyN(b.received_amount),0);
    const outstanding=rows.reduce((s,b)=>s+moneyN(b.outstanding_amount),0);
    const retention=rows.reduce((s,b)=>s+moneyN(b.retention_amount),0);
    const issuedByPayee=new Map();
    rows.filter(isSubconRow).forEach(b=>{
      const key=(String(b.subcontractor_name||'unnamed').trim().toLowerCase()||'unnamed');
      issuedByPayee.set(key,Math.max(issuedByPayee.get(key)||0,moneyN(b.issued_amount)));
    });
    const issued=[...issuedByPayee.values()].reduce((s,v)=>s+v,0);
    return {gross,received,outstanding,retention,issued};
  }

  function setFolder(next,animate=true){
    if(!['gencon','subcon'].includes(next))return;
    party=next;
    try{localStorage.setItem(FOLDER_KEY,next)}catch(_){ }

    document.querySelectorAll('.billing-party-tab').forEach(btn=>{
      const on=btn.dataset.billingParty===next;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-selected',on?'true':'false');
    });

    const shell=$('billingFolderTransition');
    if(shell && animate){
      shell.classList.remove('show');
      void shell.offsetWidth;
      shell.classList.add('show');
      setTimeout(()=>shell.classList.remove('show'),300);
    }
    renderBilling();
  }

  document.querySelectorAll('.billing-party-tab').forEach(btn=>{
    btn.addEventListener('click',()=>setFolder(btn.dataset.billingParty,true));
  });

  // Override billing renderer with folder filtering, retaining all v23.2/v23.3 actions.
  renderBilling=function(){
    const viewport=typeof window.captureStableViewportV2828==='function'
      ? window.captureStableViewportV2828()
      : {x:window.scrollX||0,y:window.scrollY||0};

    const all=currentRows();
    const gen=all.filter(isGenconRow).slice().sort(compareBillingAsc);
    const sub=all.filter(isSubconRow).slice().sort(compareBillingAsc);
    const rows=party==='subcon'?sub:gen;
    const t=totals(rows);

    const tablePanel=$('billingRows')?.closest('.panel');

    // v28.23: both folders use the same Billing table AND both folders
    // keep their own Add Billing button behavior.
    // GenCon shows Client Billing rows; Subcon shows Subcontractor Billing rows.
    if($('billingKPIs'))$('billingKPIs').style.display='grid';
    if(tablePanel)tablePanel.style.display='';
    if($('addBillingBtn')){
      $('addBillingBtn').style.display='';
      $('addBillingBtn').textContent='+ Add Row';
      $('addBillingBtn').title=party==='subcon'
        ? 'Add a Subcontractor Billing row for the Active Project Folder.'
        : 'Add a Client Billing row for the Active Project Folder. A matching blank Subcon row is created automatically.';
    }

    if($('subconCommercialSettings'))$('subconCommercialSettings').style.display='none';

    $('billingKPIs').innerHTML=(party==='gencon'
      ? [
          ['GenCon Gross Billed',money(t.gross)],
          ['Client Collections',money(t.received)],
          ['Outstanding',money(t.outstanding)],
          ['Retention Held',money(t.retention)]
        ]
      : [
          ['Subcon Gross Billed',money(t.gross)],
          ['Issued / Paid',money(t.received)],
          ['Subcon Outstanding',money(t.outstanding)],
          ['Retention Held',money(t.retention)]
        ]
    ).map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

    $('billingRows').innerHTML=rows.length?rows.map(b=>`<tr>
      <td class="check-col"><input class="billing-row-check" type="checkbox" value="${b.id}" ${selectedBillingIds.has(String(b.id))?'checked':''}></td>
      <td>${esc(proj(b.project_id)?.project_name||'—')}</td>
      <td>${esc(b.billing_type||'Client Billing')}${b.billing_type==='Subcontractor Billing'&&b.subcontractor_name?`<br><small>${esc(b.subcontractor_name)}</small>`:''}</td>
      <td>
        <strong>${b.billing_category==='Downpayment'?`Downpayment: ${esc(b.billing_no||'DP')}`:(b.variation_no?`VO: ${esc(b.variation_no)}`:`Billing: ${esc(b.billing_no||'—')}`)}</strong>
        ${b.billing_type==='Subcontractor Billing'
          ? `<br><small>${b.source_gencon_billing_id?'Auto-linked from GenCon · ':''}Issued: ${money(b.received_amount||0)}<br>Balance: ${money(b.outstanding_amount||0)}</small>`
          : ''}
      </td>
      <td>${pct(b.accomplishment_percent||0)}</td>
      <td>${money(b.gross_amount)}</td>
      <td>${money(b.retention_amount)}</td>
      <td>${money(b.recoupment_amount)}</td>
      <td>${money(b.net_due)}</td>
      <td>${money(b.received_amount)}</td>
      <td>${money(b.outstanding_amount)}</td>
      <td>${b.date_request||b.date_submitted||'—'}</td>
      <td>${b.date_paid||'—'}</td>
      <td>${esc(b.input_by_name||'—')}</td>
      <td>${esc(b.status)}</td>
      <td><div class="row-actions">
        <button class="icon-action" type="button" onclick="editBilling('${b.id}')">Edit</button>
        <button class="icon-action" type="button" onclick="addPayment('${b.id}')">${b.billing_type==='Subcontractor Billing'?'Add Issued Amount':'Receive Payment'}</button>
        <button class="icon-action" type="button" onclick="generateBilling('${b.id}')">Download</button>
        <button class="danger-link" type="button" onclick="deleteBilling('${b.id}')">Delete</button>
      </div></td>
    </tr>`).join(''):`<tr><td colspan="16" class="empty">No ${party==='gencon'?'GenCon':'Subcon'} billing records for this project.</td></tr>`;

    wireBulkChecks('billing-row-check',selectedBillingIds,()=>bulkUI('billing',selectedBillingIds,rows));
    bulkUI('billing',selectedBillingIds,rows);

    if(party==='subcon' && typeof renderBillingCommercialSettings==='function')renderBillingCommercialSettings();

    if(typeof window.restoreStableViewportV2828==='function'){
      window.restoreStableViewportV2828(viewport);
    }
  };

  // Force Add Billing default type based on current folder.
  const oldAdd=$('addBillingBtn')?.onclick;
  if($('addBillingBtn')){
    $('addBillingBtn').onclick=()=>{
      if(typeof oldAdd==='function')oldAdd();
      if($('bType')){
        $('bType').value=party==='subcon'?'Subcontractor Billing':'Client Billing';
        $('bType').dispatchEvent(new Event('change',{bubbles:true}));
      }
    };
  }

  // Dashboard auto-computes contract-level GenCon vs Subcon results.
  window.renderPartyFinancialSummary=function(){
    const box=$('dashPartyFinancialSummary');
    if(!box)return;
    const all=cache.billings||[];
    const gen=totals(all.filter(isGenconRow));
    const sub=totals(all.filter(isSubconRow));
    const netCash=gen.received-sub.received;
    const uncollected=gen.outstanding;
    const unpaidSub=sub.outstanding;
    box.innerHTML=[
      ['GenCon Gross Billed',money(gen.gross)],
      ['GenCon Collections',money(gen.received)],
      ['Subcon Issued',money(sub.issued)],
      ['Subcon Billed',money(sub.gross)],
      ['Subcon Paid',money(sub.received)],
      ['Net Cash Position',money(netCash)],
      ['Client Outstanding',money(uncollected)],
      ['Subcon Outstanding',money(unpaidSub)]
    ].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  };

  const prevDash=renderDashboard;
  renderDashboard=function(){
    prevDash();
    renderPartyFinancialSummary();
  };

  // Initialize folder UI.
  setTimeout(()=>{
    document.querySelectorAll('.billing-party-tab').forEach(btn=>{
      const on=btn.dataset.billingParty===party;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-selected',on?'true':'false');
    });
    if(currentUser){renderBilling();renderPartyFinancialSummary();}
  },150);
})();
