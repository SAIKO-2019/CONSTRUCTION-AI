// SAIKO Construction AI v24.1
// Auto-link GenCon billings into Subcon folder and calculate available subcontract amount.
(function(){
  const num=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
  let currentFolder='gencon';

  function genconRows(){
    const pid=$('billingProjectFilter')?.value||$('workspaceProject')?.value||'';
    return (cache.billings||[]).filter(b=>
      (!pid || String(b.project_id)===String(pid)) && b.billing_type!=='Subcontractor Billing'
    );
  }

  function calcLinked(b){
    const collected=num(b.received_amount);
    const deductions=Math.max(0,num(b.subcon_total_deductions));
    const retention=collected*Math.max(0,num(b.subcon_retention_percent))/100;
    const recoupment=collected*Math.max(0,num(b.subcon_recoupment_percent))/100;
    const available=Math.max(0,collected-deductions-retention-recoupment);
    return {collected,deductions,retention,recoupment,available};
  }

  function renderLinkedSubcon(){
    const panel=$('linkedSubconPanel');
    const holder=$('linkedSubconRows');
    if(!panel||!holder)return;

    const active=document.querySelector('.billing-party-tab.active')?.dataset?.billingParty||currentFolder;
    currentFolder=active;
    panel.hidden=active!=='subcon';
    if(active!=='subcon')return;

    const rows=genconRows();
    holder.innerHTML=rows.length?rows.map(b=>{
      const c=calcLinked(b);
      const has=!!b.has_subcon;
      return `<div class="linked-subcon-card ${has?'has-subcon':'no-subcon'}">
        <div class="linked-subcon-main">
          <div>
            <small>${esc(proj(b.project_id)?.project_name||'Project')}</small>
            <strong>${b.billing_category==='Downpayment'?`Downpayment ${esc(b.billing_no||'')}`:(b.variation_no?`VO ${esc(b.variation_no)}`:`Billing ${esc(b.billing_no||'—')}`)}</strong>
            <span class="linked-subcon-status">${has?'Has Subcon':'No Subcon'}</span>
          </div>
          <button type="button" class="secondary-btn compact-btn" onclick="openLinkedSubcon('${b.id}')">Setup</button>
        </div>
        <div class="linked-subcon-stats">
          <div><span>GenCon Collected</span><strong>${money(c.collected)}</strong></div>
          <div><span>Total Deductions</span><strong>${money(c.deductions)}</strong></div>
          <div><span>Retention</span><strong>${money(c.retention)}</strong></div>
          <div><span>Recoupment</span><strong>${money(c.recoupment)}</strong></div>
          <div class="linked-available"><span>Available for Subcon</span><strong>${has?money(c.available):'—'}</strong></div>
        </div>
      </div>`;
    }).join(''):'<div class="empty">No GenCon billing yet for this project.</div>';
  }

  function calcDialog(){
    const collected=num($('linkedCollected')?.value);
    const deductions=Math.max(0,num($('linkedTotalDeductions')?.value));
    const retention=collected*Math.max(0,num($('linkedRetentionPct')?.value))/100;
    const recoupment=collected*Math.max(0,num($('linkedRecoupmentPct')?.value))/100;
    const has=$('linkedHasSubcon')?.value==='true';
    const available=Math.max(0,collected-deductions-retention-recoupment);
    $('linkedSubconCalc').innerHTML=[
      ['Collected',money(collected)],
      ['Less Deductions',money(deductions)],
      ['Less Retention',money(retention)],
      ['Less Recoupment',money(recoupment)],
      ['Net Available for Subcon',has?money(available):'No Subcon']
    ].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  }

  window.openLinkedSubcon=function(id){
    const b=(cache.billings||[]).find(x=>String(x.id)===String(id));
    if(!b)return alert('GenCon billing not found.');
    $('linkedSubconBillingId').value=b.id;
    $('linkedSubconBillingLabel').value=b.billing_category==='Downpayment'?`Downpayment ${b.billing_no||''}`:(b.variation_no?`VO ${b.variation_no}`:`Billing ${b.billing_no||'—'}`);
    $('linkedHasSubcon').value=b.has_subcon?'true':'false';
    $('linkedCollected').value=num(b.received_amount);
    $('linkedTotalDeductions').value=num(b.subcon_total_deductions);
    $('linkedRetentionPct').value=num(b.subcon_retention_percent);
    $('linkedRecoupmentPct').value=num(b.subcon_recoupment_percent);
    calcDialog();
    $('linkedSubconDialog').showModal();
  };

  ['linkedHasSubcon','linkedTotalDeductions','linkedRetentionPct','linkedRecoupmentPct'].forEach(id=>{
    if($(id))$(id).addEventListener('input',calcDialog,{passive:true});
    if($(id))$(id).addEventListener('change',calcDialog,{passive:true});
  });

  $('linkedSubconForm').onsubmit=async e=>{
    e.preventDefault();
    const id=$('linkedSubconBillingId').value;
    const values={
      has_subcon:$('linkedHasSubcon').value==='true',
      subcon_total_deductions:Math.max(0,num($('linkedTotalDeductions').value)),
      subcon_retention_percent:Math.max(0,num($('linkedRetentionPct').value)),
      subcon_recoupment_percent:Math.max(0,num($('linkedRecoupmentPct').value))
    };
    try{
      await q('billings','update',{id,values});
      $('linkedSubconDialog').close();
      await refreshAll();
      renderLinkedSubcon();
      renderBilling();
      renderDashboard();
      toast('Subcon allocation setup saved.');
    }catch(err){alert(err.message||'Could not save Subcon setup.');}
  };

  // Hook folder changes without extra timers/observers.
  document.querySelectorAll('.billing-party-tab').forEach(btn=>{
    btn.addEventListener('click',()=>setTimeout(renderLinkedSubcon,30));
  });
  if($('billingProjectFilter'))$('billingProjectFilter').addEventListener('change',()=>setTimeout(renderLinkedSubcon,0));

  // Enhance dashboard with linked net available calculation.
  window.renderLinkedSubconDashboard=function(){
    const box=$('dashPartyFinancialSummary');
    if(!box)return;
    const gen=(cache.billings||[]).filter(b=>b.billing_type!=='Subcontractor Billing');
    const linked=gen.filter(b=>b.has_subcon);
    const totalAvailable=linked.reduce((s,b)=>s+calcLinked(b).available,0);
    const totalDeductions=linked.reduce((s,b)=>s+calcLinked(b).deductions+calcLinked(b).retention+calcLinked(b).recoupment,0);
    const extra=`<div><span>Linked Subcon Available</span><strong>${money(totalAvailable)}</strong></div><div><span>Linked Subcon Deductions</span><strong>${money(totalDeductions)}</strong></div>`;
    if(!box.querySelector('[data-linked-subcon]')){
      const wrap=document.createElement('div');
      wrap.setAttribute('data-linked-subcon','1');
      wrap.style.display='contents';
      wrap.innerHTML=extra;
      box.appendChild(wrap);
    }else{
      box.querySelector('[data-linked-subcon]').innerHTML=extra;
    }
  };

  const prevBilling=renderBilling;
  renderBilling=function(){
    prevBilling();
    renderLinkedSubcon();
  };

  const prevDash=renderDashboard;
  renderDashboard=function(){
    prevDash();
    renderLinkedSubconDashboard();
  };

  setTimeout(()=>{if(currentUser){renderLinkedSubcon();renderLinkedSubconDashboard();}},200);
})();
