// SAIKO Construction AI v23.2
// 1) Editable billing records
// 2) Subcontractor issued amount + date + payee
// 3) Stay on the same module/page after refresh/re-login

(function(){
  const VIEW_KEY='saiko_last_view';
  const SCROLL_KEY='saiko_last_scroll';
  let editingBillingId=null;

  // ---------- Stay on same page/module ----------
  const oldShow=show;
  show=function(view){
    if(!$(view)) view='dashboard';
    try{
      localStorage.setItem(VIEW_KEY,view);
      localStorage.setItem(SCROLL_KEY,'0');
    }catch(_){}
    oldShow(view);
  };

  const oldEnter=enter;
  enter=async function(user){
    await oldEnter(user);
    let wanted='dashboard';
    try{wanted=localStorage.getItem(VIEW_KEY)||'dashboard'}catch(_){}
    if($(wanted)){
      show(wanted);
      requestAnimationFrame(()=>{
        try{window.scrollTo(0,Number(localStorage.getItem(SCROLL_KEY)||0))}catch(_){}
      });
    }
  };

  let scrollSaveTimer=null;
  window.addEventListener('scroll',()=>{
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer=setTimeout(()=>{
      const active=document.querySelector('.view.active-view')?.id;
      if(active){
        try{
          localStorage.setItem(VIEW_KEY,active);
          localStorage.setItem(SCROLL_KEY,String(window.scrollY||0));
        }catch(_){}
      }
    },150);
  },{passive:true});

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){
      const active=document.querySelector('.view.active-view')?.id;
      if(active){
        try{
          localStorage.setItem(VIEW_KEY,active);
          localStorage.setItem(SCROLL_KEY,String(window.scrollY||0));
        }catch(_){}
      }
    }
  },{passive:true});

  // ---------- Billing helpers ----------
  function isSubcon(){return $('bType')?.value==='Subcontractor Billing'}

  function setSubconFields(){
    const showSub=isSubcon();
    ['bSubcontractorNameField','bIssuedAmountField','bIssuedDateField'].forEach(id=>{
      const el=$(id);
      if(el)el.style.display=showSub?'':'none';
    });
    const note=$('billingRuleNote');
    if(note){
      note.textContent=showSub
        ? 'Subcontractor Billing: encode the subcontractor/payee, total Issued / Contract Amount, Date Issued, and each billing amount. Remaining balance is computed automatically.'
        : 'Client Billing: retention and recoupment are optional. Tick only when applicable.';
    }
  }

  function calcBilling232(){
    const gross=Number($('bGross')?.value||0);
    const retPct=$('bUseRetention')?.checked?Number($('bRetention')?.value||0):0;
    const recPct=$('bUseRecoupment')?.checked?Number($('bRecoup')?.value||0):0;
    const ret=gross*retPct/100;
    const rec=gross*recPct/100;
    const net=Math.max(0,gross-ret-rec);

    // During Edit, payment history is kept unchanged.
    const received=Number($('bReceived')?.value||0);
    const out=Math.max(0,net-received);

    const issued=Number($('bIssuedAmount')?.value||0);
    const pid=$('bProject')?.value||'';
    const payee=($('bSubcontractorName')?.value||'').trim().toLowerCase();

    const previous=(cache.billings||[])
      .filter(b=>String(b.project_id)===String(pid)
        && b.billing_type==='Subcontractor Billing'
        && String(b.id)!==String(editingBillingId||'')
        && (!payee || String(b.subcontractor_name||'').trim().toLowerCase()===payee))
      .reduce((s,b)=>s+Number(b.gross_amount||0),0);

    const subcontractBalance=Math.max(0,issued-(previous+gross));

    $('billingCalc').innerHTML=[
      ['Retention',money(ret)],
      ['Recoupment',money(rec)],
      ['Net Due',money(net)],
      ['Outstanding',money(out)],
      ...(isSubcon()?[['Subcontract Balance',money(subcontractBalance)]]:[])
    ].map(x=>`<div>${x[0]}<strong>${x[1]}</strong></div>`).join('');

    return {gross,retPct,recPct,ret,rec,net,received,out,issued,subcontractBalance};
  }

  function updateBillingUI232(){
    $('bRetention').disabled=!$('bUseRetention').checked;
    $('bRecoup').disabled=!$('bUseRecoupment').checked;
    setSubconFields();
    calcBilling232();
  }

  function setBillingMode(editing){
    const title=$('billingDialogTitle');
    const save=$('billingSaveBtn');
    if(title)title.textContent=editing?'Edit Billing / Payment Record':'Billing / Payment Record';
    if(save)save.textContent=editing?'Save Changes':'Save Billing';

    // Don't rewrite payment history through edit form.
    if($('bReceived')){
      $('bReceived').disabled=editing;
      $('bReceived').title=editing?'Use Receive Payment / Add Payment to record payments.':'';
    }
    if($('bPaidDate')){
      $('bPaidDate').disabled=editing;
      $('bPaidDate').title=editing?'Use Receive Payment / Add Payment to record payments.':'';
    }
  }

  ['bGross','bRetention','bRecoup','bReceived','bIssuedAmount','bSubcontractorName']
    .forEach(id=>{if($(id))$(id).oninput=calcBilling232});
  if($('bUseRetention'))$('bUseRetention').onchange=updateBillingUI232;
  if($('bUseRecoupment'))$('bUseRecoupment').onchange=updateBillingUI232;
  if($('bType'))$('bType').onchange=updateBillingUI232;

  // ---------- Add billing ----------
  $('addBillingBtn').onclick=()=>{
    editingBillingId=null;
    $('billingForm').reset();
    syncProjectSelects();
    if(typeof syncProjectSelectsV13==='function')syncProjectSelectsV13();

    const ws=$('workspaceProject')?.value;
    if(ws)$('bProject').value=ws;

    $('bType').value='Client Billing';
    $('bRecordType').value='Billing';
    if(typeof updateRecordTypeUI==='function')updateRecordTypeUI();

    $('bRetention').value=5;
    $('bRecoup').value=30;
    $('bUseRetention').checked=false;
    $('bUseRecoupment').checked=false;
    $('bInputBy').value=typeof profileName==='function'?profileName():(currentProfile?.full_name||'');

    if($('bSubcontractorName'))$('bSubcontractorName').value='';
    if($('bIssuedAmount'))$('bIssuedAmount').value='';
    if($('bIssuedDate'))$('bIssuedDate').value='';

    setBillingMode(false);
    updateBillingUI232();
    $('billingDialog').showModal();
  };

  // ---------- Edit billing ----------
  window.editBilling=function(id){
    const b=(cache.billings||[]).find(x=>String(x.id)===String(id));
    if(!b)return alert('Billing record not found.');

    editingBillingId=String(id);
    syncProjectSelects();
    if(typeof syncProjectSelectsV13==='function')syncProjectSelectsV13();

    $('bProject').value=b.project_id||'';
    $('bType').value=b.billing_type||'Client Billing';
    $('bRecordType').value=b.variation_no?'VO':'Billing';
    if(typeof updateRecordTypeUI==='function')updateRecordTypeUI();
    $('bNo').value=b.variation_no||b.billing_no||'';
    $('bGross').value=Number(b.gross_amount||0);
    $('bAccomplishment').value=Number(b.accomplishment_percent||0);

    $('bUseRetention').checked=!!b.retention_applicable || Number(b.retention_percent||0)>0;
    $('bRetention').value=Number(b.retention_percent||0);
    $('bUseRecoupment').checked=!!b.recoupment_applicable || Number(b.recoupment_percent||0)>0;
    $('bRecoup').value=Number(b.recoupment_percent||0);

    $('bRequestDate').value=b.date_request||b.date_submitted||'';
    $('bReceived').value=Number(b.received_amount||0);
    $('bPaidDate').value=b.date_paid||'';
    $('bInputBy').value=b.input_by_name||'';

    if($('bSubcontractorName'))$('bSubcontractorName').value=b.subcontractor_name||'';
    if($('bIssuedAmount'))$('bIssuedAmount').value=Number(b.issued_amount||0);
    if($('bIssuedDate'))$('bIssuedDate').value=b.issued_date||'';

    setBillingMode(true);
    updateBillingUI232();
    $('billingDialog').showModal();
  };

  // ---------- Save Add/Edit ----------
  $('billingForm').onsubmit=async e=>{
    e.preventDefault();
    const c=calcBilling232();
    const type=$('bType').value;
    const existing=editingBillingId
      ? (cache.billings||[]).find(x=>String(x.id)===String(editingBillingId))
      : null;

    const values={
      project_id:$('bProject').value,
      billing_no:$('bRecordType').value==='Billing' ? $('bNo').value.trim() : null,
      variation_no:$('bRecordType').value==='VO' ? $('bNo').value.trim() : null,
      billing_type:type,
      transaction_side:type==='Client Billing'?'receivable':'payable',
      accomplishment_percent:Number($('bAccomplishment').value||0),
      gross_amount:c.gross,
      retention_applicable:$('bUseRetention').checked,
      retention_percent:c.retPct,
      retention_amount:c.ret,
      recoupment_applicable:$('bUseRecoupment').checked,
      recoupment_percent:c.recPct,
      recoupment_amount:c.rec,
      net_due:c.net,
      date_request:$('bRequestDate').value||null,
      date_submitted:$('bRequestDate').value||null,
      input_by_name:existing?.input_by_name || (typeof profileName==='function'?profileName():(currentProfile?.full_name||'')),
      status:existing
        ? (c.net-Number(existing.received_amount||0)<=.01?'Paid':Number(existing.received_amount||0)>0?'Partially Paid':'Pending')
        : (c.out<=.01?'Paid':c.received>0?'Partially Paid':'Pending')
    };

    // Subcontract-only columns are written only for Subcontractor Billing.
    // This prevents Client Billing from failing if a browser reaches the UI
    // before the latest database migration has been applied.
    if(type==='Subcontractor Billing'){
      values.subcontractor_name=$('bSubcontractorName')?.value.trim()||null;
      values.issued_amount=c.issued;
      values.issued_date=$('bIssuedDate')?.value||null;
      values.subcontract_balance=c.subcontractBalance;
    }

    try{
      if(editingBillingId){
        const received=Number(existing?.received_amount||0);
        values.received_amount=received;
        values.outstanding_amount=Math.max(0,c.net-received);
        values.date_paid=existing?.date_paid||null;

        await q('billings','update',{id:editingBillingId,values});
        editingBillingId=null;
        $('billingDialog').close();
        await refreshAll();
        renderBilling();
        if(typeof renderBudget==='function')renderBudget();
        if(typeof renderDashboard==='function')renderDashboard();
        toast('Billing record updated.');
      }else{
        values.received_amount=c.received;
        values.outstanding_amount=c.out;
        values.date_paid=$('bPaidDate').value||null;
        values.created_by=currentUser.id;

        const rows=await q('billings','insert',values);
        if(c.received>0){
          await q('payments','insert',{
            billing_id:rows[0].id,
            amount:c.received,
            payment_date:$('bPaidDate').value||new Date().toISOString().slice(0,10),
            created_by:currentUser.id
          });
        }
        $('billingDialog').close();
        await refreshAll();
        renderBilling();
        if(typeof renderBudget==='function')renderBudget();
        if(typeof renderDashboard==='function')renderDashboard();
        toast('Billing saved.');
      }
    }catch(err){
      alert(err.message||'Could not save billing.');
    }finally{
      setBillingMode(false);
    }
  };

  // ---------- Billing table with Edit + issued details ----------
  renderBilling=function(){
    const pid=$('billingProjectFilter')?.value||$('workspaceProject')?.value||'';
    const rows=pid
      ? (cache.billings||[]).filter(b=>String(b.project_id)===String(pid))
      : (cache.billings||[]);

    const client=rows.filter(b=>b.billing_type!=='Subcontractor Billing');
    const subcon=rows.filter(b=>b.billing_type==='Subcontractor Billing');
    const clientGross=client.reduce((s,b)=>s+Number(b.gross_amount||0),0);
    const collections=client.reduce((s,b)=>s+Number(b.received_amount||0),0);
    const subconGross=subcon.reduce((s,b)=>s+Number(b.gross_amount||0),0);
    const subconPaid=subcon.reduce((s,b)=>s+Number(b.received_amount||0),0);

    $('billingKPIs').innerHTML=[
      ['Client Gross Billed',money(clientGross)],
      ['Client Collections',money(collections)],
      ['Subcon Gross Billed',money(subconGross)],
      ['Subcon Paid',money(subconPaid)]
    ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

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
    </tr>`).join(''):'<tr><td colspan="16" class="empty">No billing records for this project.</td></tr>';

    wireBulkChecks('billing-row-check',selectedBillingIds,()=>bulkUI('billing',selectedBillingIds,rows));
    bulkUI('billing',selectedBillingIds,rows);
  };

  // If user is already logged in when this late patch loads, restore current module.
  if(currentUser){
    let wanted='dashboard';
    try{wanted=localStorage.getItem(VIEW_KEY)||document.querySelector('.view.active-view')?.id||'dashboard'}catch(_){}
    if($(wanted))show(wanted);
  }
})();
