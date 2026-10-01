// CONSTRUCTION MONITORING v28.10
// Minimal Subcon correction:
// - no extra Subcon section/cards
// - Amount to Issue is the per-billing calculation base
// - Add Payment sits in the existing linked Subcon table
// - each Subcon payment has its own editable amount/date/reference
(function(){
  const n=v=>{
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  };
  const today=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  function billing(id){
    return (cache.billings||[]).find(b=>String(b.id)===String(id))||null;
  }

  function rowsFor(billingId){
    return (cache.subconPayments||[])
      .filter(p=>String(p.billing_id)===String(billingId))
      .slice()
      .sort((a,b)=>{
        const da=String(a.payment_date||''),db=String(b.payment_date||'');
        if(da!==db)return da.localeCompare(db);
        return String(a.created_at||'').localeCompare(String(b.created_at||''));
      });
  }

  function state(b){
    const amountToIssue=Math.max(0,n(b.subcon_amount_to_issue));
    const deductions=Math.max(0,n(b.subcon_total_deductions));
    const retention=amountToIssue*Math.max(0,n(b.subcon_retention_percent))/100;
    const recoupment=amountToIssue*Math.max(0,n(b.subcon_recoupment_percent))/100;
    const available=Math.max(0,amountToIssue-deductions-retention-recoupment);
    const rows=rowsFor(b.id);
    const paid=rows.reduce((s,p)=>s+Math.max(0,n(p.amount)),0);
    const balance=Math.max(0,available-paid);
    return {amountToIssue,deductions,retention,recoupment,available,rows,paid,balance};
  }

  function close(){
    $('subconPaymentDialog')?.close();
  }

  window.openSubconPaymentDialog=function(billingId,paymentId=''){
    const b=billing(billingId);
    if(!b)return alert('Billing record not found.');
    if(!b.has_subcon)return alert('Mark this billing as Has Subcon first.');

    const st=state(b);
    if(st.available<=0)return alert('Set the Amount to Issue first.');

    const row=paymentId?st.rows.find(p=>String(p.id)===String(paymentId)):null;
    if(paymentId&&!row)return alert('Subcon payment record not found.');

    const otherPaid=st.paid-n(row?.amount);
    const max=Math.max(0,st.available-otherPaid);
    if(!paymentId && max<=0.01)return alert('This Subcon amount is already fully paid.');

    $('subconPaymentBillingId').value=b.id;
    $('subconPaymentRecordId').value=paymentId||'';
    $('subconPaymentDialogTitle').textContent=paymentId?'Edit Subcon Payment':'Add Subcon Payment';
    $('subconPaymentDialogSubtitle').textContent=
      `${b.billing_category==='Downpayment'?'Downpayment':b.variation_no?'VO':'Billing'} ${b.billing_no||b.variation_no||'—'}`;

    $('subconPaymentAmount').value=row?n(row.amount).toFixed(2):'';
    $('subconPaymentAmount').max=max.toFixed(2);
    $('subconPaymentDate').value=row?.payment_date||today();
    $('subconPaymentReference').value=row?.reference_no||'';

    $('subconPaymentSummary').innerHTML=[
      ['Amount to Issue',money(st.amountToIssue)],
      ['Net Available',money(st.available)],
      ['Paid',money(st.paid)],
      ['Balance',money(st.balance)]
    ].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

    $('subconPaymentNote').innerHTML=
      `Maximum allowed for this payment: <strong>${money(max)}</strong>. `+
      `Payment dates remain listed separately and can be edited later.`;

    $('saveSubconPaymentBtn').textContent=paymentId?'Update Payment':'Save Payment';
    $('subconPaymentDialog').showModal();
  };

  $('closeSubconPaymentDialogBtn')?.addEventListener('click',close);
  $('cancelSubconPaymentBtn')?.addEventListener('click',close);

  $('subconPaymentForm').onsubmit=async e=>{
    e.preventDefault();

    const billingId=$('subconPaymentBillingId').value;
    const paymentId=$('subconPaymentRecordId').value;
    const b=billing(billingId);
    if(!b)return alert('Billing record not found.');

    const st=state(b);
    const existing=paymentId?st.rows.find(p=>String(p.id)===String(paymentId)):null;
    const otherPaid=st.paid-n(existing?.amount);
    const max=Math.max(0,st.available-otherPaid);

    const amount=n($('subconPaymentAmount').value);
    const paymentDate=$('subconPaymentDate').value;
    const reference=$('subconPaymentReference').value.trim()||null;

    if(amount<=0)return alert('Enter a valid payment amount.');
    if(!paymentDate)return alert('Select a payment date.');
    if(amount-max>0.01)return alert(`Payment cannot exceed ${money(max)}.`);

    const btn=$('saveSubconPaymentBtn');
    btn.disabled=true;
    btn.textContent=paymentId?'Updating…':'Saving…';

    try{
      if(paymentId){
        const {error}=await sb.from('subcon_payments').update({
          amount,
          payment_date:paymentDate,
          reference_no:reference,
          updated_at:new Date().toISOString()
        }).eq('id',paymentId);
        if(error)throw error;
      }else{
        const {error}=await sb.from('subcon_payments').insert({
          billing_id:billingId,
          amount,
          payment_date:paymentDate,
          reference_no:reference,
          created_by:currentUser.id
        });
        if(error)throw error;
      }

      close();
      await refreshAll();
      try{renderBilling()}catch(renderErr){console.warn('Billing post-Subcon-payment render:',renderErr)}
      if(typeof toast==='function')toast(paymentId?'Subcon payment updated.':'Subcon payment added.');
    }catch(err){
      alert(err?.message||'Could not save Subcon payment.');
    }finally{
      btn.disabled=false;
      btn.textContent=paymentId?'Update Payment':'Save Payment';
    }
  };
})();
