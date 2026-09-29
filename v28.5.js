// CONSTRUCTION MONITORING v28.5
// Billing payment transactions:
// - Add Payment stays available until Net Due is fully paid.
// - Every payment has its own amount/date/reference.
// - Multiple payments show as separate dated history entries.
// - Existing payment records are editable.
// - Billing received/outstanding/status recalculate from payment history.
// No new timer / MutationObserver.
(function(){
  let editingPaymentId='';
  let paymentContext=null;

  const num=v=>{
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  };
  const isoToday=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const fmtDate=v=>{
    if(!v)return '—';
    const d=new Date(`${String(v).slice(0,10)}T00:00:00`);
    if(Number.isNaN(d.getTime()))return String(v);
    return d.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'});
  };

  function billing(id){
    return (cache.billings||[]).find(b=>String(b.id)===String(id))||null;
  }

  function paymentRows(billingId){
    return (cache.payments||[])
      .filter(p=>String(p.billing_id)===String(billingId))
      .slice()
      .sort((a,b)=>{
        const da=String(a.payment_date||'');
        const db=String(b.payment_date||'');
        if(da!==db)return da.localeCompare(db);
        return String(a.created_at||'').localeCompare(String(b.created_at||''));
      });
  }

  // Preserve any legacy/imported received value that does not yet have a payment row.
  function paymentState(b){
    const rows=paymentRows(b.id);
    const transactionTotal=rows.reduce((s,p)=>s+num(p.amount),0);
    const receivedStored=num(b.received_amount);
    const legacyBase=Math.max(0,receivedStored-transactionTotal);
    const netDue=num(b.net_due || (num(b.gross_amount)-num(b.retention_amount)-num(b.recoupment_amount)));
    const totalReceived=legacyBase+transactionTotal;
    const outstanding=Math.max(0,netDue-totalReceived);
    return {rows,transactionTotal,legacyBase,netDue,totalReceived,outstanding};
  }

  function projectedStateAfter(b,paymentId,newAmount){
    const st=paymentState(b);
    const current=paymentId?st.rows.find(p=>String(p.id)===String(paymentId)):null;
    const otherTxn=st.transactionTotal-num(current?.amount);
    const maxForRecord=Math.max(0,st.netDue-st.legacyBase-otherTxn);
    const newTransactionTotal=otherTxn+num(newAmount);
    const totalReceived=st.legacyBase+newTransactionTotal;
    const outstanding=Math.max(0,st.netDue-totalReceived);
    return {...st,current,otherTxn,maxForRecord,newTransactionTotal,totalReceived,outstanding};
  }

  function latestPaymentDate(rows,editedId='',editedDate=''){
    const dates=rows.map(p=>String(p.payment_date||'').slice(0,10)).filter(Boolean);
    if(editedId){
      const idx=rows.findIndex(p=>String(p.id)===String(editedId));
      if(idx>=0 && editedDate)dates[idx]=editedDate;
    }else if(editedDate){
      dates.push(editedDate);
    }
    dates.sort();
    return dates.at(-1)||null;
  }

  function paymentDialog(){
    return $('paymentHistoryDialog');
  }

  function closePaymentDialog(){
    paymentDialog()?.close();
    editingPaymentId='';
    paymentContext=null;
  }

  function openPaymentDialog(billingId,paymentId=''){
    const b=billing(billingId);
    if(!b)return alert('Billing record not found.');

    const st=paymentState(b);
    const p=paymentId?st.rows.find(x=>String(x.id)===String(paymentId)):null;
    if(paymentId && !p)return alert('Payment record not found.');

    const target=projectedStateAfter(b,paymentId,p?.amount||0);
    if(!paymentId && target.maxForRecord<=0.01){
      return alert('This billing is already fully paid.');
    }

    editingPaymentId=paymentId||'';
    paymentContext={
      billingId:String(b.id),
      paymentId:editingPaymentId,
      legacyBase:st.legacyBase
    };

    $('paymentBillingId').value=String(b.id);
    $('paymentRecordId').value=editingPaymentId;
    $('paymentDialogTitle').textContent=paymentId?'Edit Payment':'Add Payment';
    $('paymentDialogSubtitle').textContent=`${b.billing_no||b.variation_no||'Billing'} • ${proj(b.project_id)?.project_name||'Project'}`;
    $('paymentAmountInput').value=p?num(p.amount).toFixed(2):'';
    $('paymentDateInput').value=p?.payment_date||isoToday();
    $('paymentReferenceInput').value=p?.reference_no||'';

    const max=target.maxForRecord;
    $('paymentAmountInput').max=max.toFixed(2);

    $('paymentBillingSummary').innerHTML=[
      ['Net Due',money(st.netDue)],
      ['Recorded Paid',money(st.totalReceived)],
      ['Current Balance',money(st.outstanding)],
      [paymentId?'Maximum Edited Amount':'Maximum New Payment',money(max)]
    ].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

    $('paymentValidationNote').innerHTML=paymentId
      ? `Editing this transaction will automatically recalculate the billing balance. Maximum allowed for this payment is <strong>${money(max)}</strong>.`
      : `Add Payment will remain available until the full balance of <strong>${money(st.outstanding)}</strong> is completed.`;

    $('savePaymentBtn').textContent=paymentId?'Update Payment':'Save Payment';
    paymentDialog().showModal();
    setTimeout(()=>$('paymentAmountInput')?.focus(),50);
  }

  window.addPayment=id=>openPaymentDialog(id,'');
  window.editPaymentRecord=(billingId,paymentId)=>openPaymentDialog(billingId,paymentId);

  async function savePayment(e){
    e.preventDefault();
    const b=billing($('paymentBillingId').value);
    if(!b)return alert('Billing record not found.');

    const amount=num($('paymentAmountInput').value);
    const paymentDate=$('paymentDateInput').value;
    const reference=$('paymentReferenceInput').value.trim()||null;
    const paymentId=$('paymentRecordId').value||'';

    if(amount<=0)return alert('Enter a valid payment amount.');
    if(!paymentDate)return alert('Select the payment date.');

    const next=projectedStateAfter(b,paymentId,amount);
    if(amount-next.maxForRecord>0.01){
      return alert(`Payment cannot exceed the remaining allowed amount of ${money(next.maxForRecord)}.`);
    }

    const saveBtn=$('savePaymentBtn');
    saveBtn.disabled=true;
    saveBtn.textContent=paymentId?'Updating…':'Saving…';

    try{
      if(paymentId){
        const {error}=await sb.from('payments').update({
          amount,
          payment_date:paymentDate,
          reference_no:reference
        }).eq('id',paymentId);
        if(error)throw error;
      }else{
        const {error}=await sb.from('payments').insert({
          billing_id:b.id,
          amount,
          payment_date:paymentDate,
          reference_no:reference,
          created_by:currentUser.id
        });
        if(error)throw error;
      }

      const currentRows=paymentRows(b.id);
      const old=paymentId?currentRows.find(p=>String(p.id)===String(paymentId)):null;
      const currentTxn=currentRows.reduce((s,p)=>s+num(p.amount),0);
      const newTxn=paymentId
        ? currentTxn-num(old?.amount)+amount
        : currentTxn+amount;

      const totalReceived=paymentContext.legacyBase+newTxn;
      const netDue=num(b.net_due || (num(b.gross_amount)-num(b.retention_amount)-num(b.recoupment_amount)));
      const outstanding=Math.max(0,netDue-totalReceived);
      const status=outstanding<=0.01?'Paid':totalReceived>0?'Partially Paid':'Pending';
      const paidDate=outstanding<=0.01
        ? latestPaymentDate(currentRows,paymentId,paymentDate)
        : null;

      const {error:updateError}=await sb.from('billings').update({
        received_amount:totalReceived,
        outstanding_amount:outstanding,
        status,
        date_paid:paidDate
      }).eq('id',b.id);
      if(updateError)throw updateError;

      closePaymentDialog();
      await refreshAll();
      renderBilling();
      if(typeof renderDashboard==='function')renderDashboard();
      if(typeof window.renderSaikoHome==='function')window.renderSaikoHome();
      if(typeof toast==='function')toast(paymentId?'Payment updated.':'Payment added.');
    }catch(err){
      alert(err?.message||'Could not save payment.');
    }finally{
      saveBtn.disabled=false;
      saveBtn.textContent=paymentId?'Update Payment':'Save Payment';
    }
  }

  if($('paymentHistoryForm'))$('paymentHistoryForm').onsubmit=savePayment;
  if($('closePaymentDialogBtn'))$('closePaymentDialogBtn').onclick=closePaymentDialog;
  if($('cancelPaymentBtn'))$('cancelPaymentBtn').onclick=closePaymentDialog;

  function paymentHistoryHtml(b){
    const st=paymentState(b);
    const parts=[];

    if(st.legacyBase>0.01){
      parts.push(`<div class="payment-history-item legacy-payment">
        <div><span>Previous Received</span><strong>${money(st.legacyBase)}</strong></div>
        <small>${b.date_paid?fmtDate(b.date_paid):'Existing billing value'}</small>
      </div>`);
    }

    st.rows.forEach((p,i)=>{
      parts.push(`<div class="payment-history-item">
        <div class="payment-history-main">
          <span>Payment ${i+1}</span>
          <strong>${money(p.amount)}</strong>
        </div>
        <div class="payment-history-meta">
          <small>${fmtDate(p.payment_date)}${p.reference_no?` • ${esc(p.reference_no)}`:''}</small>
          <button type="button" class="payment-edit-btn" onclick="editPaymentRecord('${b.id}','${p.id}')">Edit</button>
        </div>
      </div>`);
    });

    if(!parts.length){
      return '<div class="payment-history-empty">No payment yet.</div>';
    }

    return `<div class="payment-history-list">${parts.join('')}</div>`;
  }

  function decorateBillingPaymentRows(){
    document.querySelectorAll('#billingRows tr').forEach(tr=>{
      const check=tr.querySelector('.billing-row-check');
      if(!check)return;

      const b=billing(check.value);
      if(!b)return;

      const cells=tr.children;
      if(cells.length<16)return;

      const paidCell=cells[9];
      const actionCell=cells[15];
      const st=paymentState(b);

      if(paidCell){
        paidCell.innerHTML=`
          <div class="billing-paid-total">${money(st.totalReceived)}</div>
          ${paymentHistoryHtml(b)}
        `;
      }

      if(actionCell){
        const actions=actionCell.querySelector('.row-actions');
        if(!actions)return;

        // Remove the older payment action and replace it with the balance-aware one.
        [...actions.querySelectorAll('button')].forEach(btn=>{
          const txt=(btn.textContent||'').trim().toLowerCase();
          if(txt==='payment'||txt==='receive payment'||txt==='add payment'){
            btn.remove();
          }
        });

        if(st.outstanding>0.01){
          const add=document.createElement('button');
          add.type='button';
          add.className='icon-action payment-add-action';
          add.textContent='Add Payment';
          add.onclick=()=>openPaymentDialog(b.id,'');
          const editBtn=[...actions.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='Edit');
          if(editBtn && editBtn.nextSibling){
            actions.insertBefore(add,editBtn.nextSibling);
          }else if(editBtn){
            actions.appendChild(add);
          }else{
            actions.prepend(add);
          }
        }else{
          const paid=document.createElement('span');
          paid.className='payment-complete-badge';
          paid.textContent='Fully Paid';
          actions.prepend(paid);
        }
      }
    });
  }

  // Wrap the final billing renderer instead of rebuilding the existing GenCon/Subcon logic.
  const previousRenderBilling=window.renderBilling;
  window.renderBilling=function(){
    let out;
    try{out=previousRenderBilling.apply(this,arguments)}catch(err){console.warn('billing base render',err)}
    decorateBillingPaymentRows();
    return out;
  };

  // Realtime refresh in v27.5 calls renderBilling(), so payment histories update on other accounts too.
  setTimeout(()=>{
    if(document.querySelector('#billing.active-view')){
      decorateBillingPaymentRows();
    }
  },500);
})();
