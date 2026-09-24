// SAIKO Construction AI v23.4 — automatic transaction dates
(function(){
  const today=()=>new Date().toISOString().slice(0,10);

  function setIfBlank(id,value=today()){
    const el=$(id);
    if(el && !el.value)el.value=value;
  }

  function wireAutoDates(){
    // Billing / VO number = transaction/request date starts automatically.
    if($('bNo')){
      $('bNo').addEventListener('input',()=>{
        if($('bNo').value.trim())setIfBlank('bRequestDate');
      },{passive:true});
    }

    // Any entered billing amount also ensures a request date exists.
    if($('bGross')){
      $('bGross').addEventListener('input',()=>{
        if(Number($('bGross').value||0)>0)setIfBlank('bRequestDate');
      },{passive:true});
    }

    // Receive / Paid amount automatically stamps today's paid/received date.
    if($('bReceived')){
      $('bReceived').addEventListener('input',()=>{
        if(Number($('bReceived').value||0)>0)setIfBlank('bPaidDate');
      },{passive:true});
    }

    // Subcontract issued information automatically gets Date Issued.
    ['bSubcontractorName','bIssuedAmount'].forEach(id=>{
      if($(id))$(id).addEventListener('input',()=>{
        const hasPayee=($('bSubcontractorName')?.value||'').trim();
        const hasAmount=Number($('bIssuedAmount')?.value||0)>0;
        if(hasPayee||hasAmount)setIfBlank('bIssuedDate');
      },{passive:true});
    });
  }

  wireAutoDates();

  // Add Billing: show today's request date immediately, but still allow manual correction.
  const oldAddBilling=$('addBillingBtn')?.onclick;
  if($('addBillingBtn')){
    $('addBillingBtn').onclick=()=>{
      if(typeof oldAddBilling==='function')oldAddBilling();
      setIfBlank('bRequestDate');
    };
  }

  // Receive Payment / Add Payment already uses today's date in payments.
  // Also save that date into the billing record itself so it appears in the billing table.
  window.addPayment=async id=>{
    const b=(cache.billings||[]).find(x=>String(x.id)===String(id));
    if(!b)return alert('Billing record not found.');
    const label=b.billing_type==='Subcontractor Billing'?'Paid amount':'Received payment amount';
    const ref=b.variation_no||b.billing_no||'billing';
    const v=prompt(`${label} for ${ref}:`);
    if(v===null)return;
    const amt=Number(v);
    if(!amt||amt<=0)return alert('Enter a valid amount.');

    const paymentDate=today();
    const newReceived=Number(b.received_amount||0)+amt;
    const newOut=Math.max(0,Number(b.net_due||0)-newReceived);
    try{
      await q('payments','insert',{
        billing_id:id,
        amount:amt,
        payment_date:paymentDate,
        created_by:currentUser.id
      });
      await q('billings','update',{
        id,
        values:{
          received_amount:newReceived,
          outstanding_amount:newOut,
          date_paid:paymentDate,
          status:newOut<=.01?'Paid':'Partially Paid'
        }
      });
      await refreshAll();
      renderBilling();
      if(typeof renderDashboard==='function')renderDashboard();
      toast(`${label} recorded — ${paymentDate}.`);
    }catch(err){alert(err.message||'Could not record payment.');}
  };
})();
