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
    const all=currentRows();
    const gen=all.filter(isGenconRow);
    const sub=all.filter(isSubconRow);
    const rows=party==='subcon'?sub:gen;
    const t=totals(rows);

    if($('subconCommercialSettings'))$('subconCommercialSettings').style.display=party==='subcon'?'':'none';

    $('billingKPIs').innerHTML=(party==='gencon'
      ? [
          ['GenCon Gross Billed',money(t.gross)],
          ['Client Collections',money(t.received)],
          ['Outstanding',money(t.outstanding)],
          ['Retention Held',money(t.retention)]
        ]
      : [
          ['Subcon Issued',money(t.issued)],
          ['Subcon Gross Billed',money(t.gross)],
          ['Subcon Paid',money(t.received)],
          ['Subcon Outstanding',money(t.outstanding)]
        ]
    ).map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

    $('billingRows').innerHTML=rows.length?rows.map(b=>`<tr>
      <td class="check-col"><input class="billing-row-check" type="checkbox" value="${b.id}" ${selectedBillingIds.has(String(b.id))?'checked':''}></td>
      <td>${esc(proj(b.project_id)?.project_name||'—')}</td>
      <td>${esc(b.billing_type||'Client Billing')}${b.billing_type==='Subcontractor Billing'&&b.subcontractor_name?`<br><small>${esc(b.subcontractor_name)}</small>`:''}</td>
      <td>
        <strong>${b.variation_no?`VO: ${esc(b.variation_no)}`:`Billing: ${esc(b.billing_no||'—')}`}</strong>
        ${b.billing_type==='Subcontractor Billing'
          ? `<br><small>Issued: ${money(b.issued_amount||0)}${b.issued_date?` · ${esc(b.issued_date)}`:''}<br>Balance: ${money(b.subcontract_balance||0)}</small>`
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
        <button class="icon-action" type="button" onclick="addPayment('${b.id}')">${b.billing_type==='Subcontractor Billing'?'Add Payment':'Receive Payment'}</button>
        <button class="icon-action" type="button" onclick="generateBilling('${b.id}')">Download</button>
        <button class="danger-link" type="button" onclick="deleteBilling('${b.id}')">Delete</button>
      </div></td>
    </tr>`).join(''):`<tr><td colspan="16" class="empty">No ${party==='gencon'?'GenCon':'Subcon'} billing records for this project.</td></tr>`;

    wireBulkChecks('billing-row-check',selectedBillingIds,()=>bulkUI('billing',selectedBillingIds,rows));
    bulkUI('billing',selectedBillingIds,rows);

    if(party==='subcon' && typeof renderBillingCommercialSettings==='function')renderBillingCommercialSettings();
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
