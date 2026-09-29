// CONSTRUCTION MONITORING v28.9
// Subcon folder:
// - Project-level Total Amount for Subcon (Net Due)
// - Gross Subcon Billing / Paid / Balance
// - Actual Subcontractor Billing rows visible in Subcon folder
// - Add Payment remains until fully paid
// - Every dated payment stays listed and can be edited using v28.5 dialog
// Reuses existing billings + payments tables. No new timer/observer.
(function(){
  const n=v=>{
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  };

  function currentPid(){
    return $('billingProjectFilter')?.value||$('workspaceProject')?.value||'';
  }

  function currentProject(){
    const pid=currentPid();
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }

  function subconRows(){
    const pid=currentPid();
    return (cache.billings||[])
      .filter(b=>String(b.project_id)===String(pid) && b.billing_type==='Subcontractor Billing')
      .slice()
      .sort((a,b)=>{
        const da=String(a.date_request||a.date_submitted||a.created_at||'');
        const db=String(b.date_request||b.date_submitted||b.created_at||'');
        return da.localeCompare(db);
      });
  }

  function paymentsFor(billingId){
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

  function paymentState(b){
    const rows=paymentsFor(b.id);
    const txnTotal=rows.reduce((s,p)=>s+n(p.amount),0);
    const received=n(b.received_amount);
    const legacyBase=Math.max(0,received-txnTotal);
    const totalPaid=legacyBase+txnTotal;
    const netDue=n(b.net_due || (n(b.gross_amount)-n(b.retention_amount)-n(b.recoupment_amount)));
    const balance=Math.max(0,netDue-totalPaid);
    return {rows,txnTotal,legacyBase,totalPaid,netDue,balance};
  }

  function totals(){
    const rows=subconRows();
    return rows.reduce((t,b)=>{
      const p=paymentState(b);
      t.gross+=n(b.gross_amount);
      t.net+=p.netDue;
      t.paid+=p.totalPaid;
      t.balance+=p.balance;
      t.retention+=n(b.retention_amount);
      t.recoupment+=n(b.recoupment_amount);
      return t;
    },{gross:0,net:0,paid:0,balance:0,retention:0,recoupment:0});
  }

  function dateLabel(v){
    if(!v)return '—';
    const d=new Date(`${String(v).slice(0,10)}T00:00:00`);
    if(Number.isNaN(d.getTime()))return String(v);
    return d.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'});
  }

  function paymentHistory(b){
    const st=paymentState(b);
    const blocks=[];

    if(st.legacyBase>0.01){
      blocks.push(`<div class="subcon-payment-history-item legacy">
        <div><span>Previous Paid</span><strong>${money(st.legacyBase)}</strong></div>
        <small>${b.date_paid?dateLabel(b.date_paid):'Existing value'}</small>
      </div>`);
    }

    st.rows.forEach((p,i)=>{
      blocks.push(`<div class="subcon-payment-history-item">
        <div>
          <span>Payment ${i+1}</span>
          <strong>${money(p.amount)}</strong>
        </div>
        <div class="subcon-payment-history-meta">
          <small>${dateLabel(p.payment_date)}${p.reference_no?` • ${esc(p.reference_no)}`:''}</small>
          <button type="button" onclick="editPaymentRecord('${b.id}','${p.id}')">Edit</button>
        </div>
      </div>`);
    });

    return blocks.length
      ? `<div class="subcon-payment-history">${blocks.join('')}</div>`
      : '<span class="subcon-no-payment">No payment yet.</span>';
  }

  function billingName(b){
    if(b.billing_category==='Downpayment')return `Downpayment ${esc(b.billing_no||'DP')}`;
    if(b.variation_no)return `VO ${esc(b.variation_no)}`;
    return `Billing ${esc(b.billing_no||'—')}`;
  }

  function renderSubconPayments(){
    const holder=$('linkedSubconRows');
    if(!holder)return;

    const active=document.querySelector('.billing-party-tab.active')?.dataset?.billingParty||'gencon';
    if(active!=='subcon')return;

    const p=currentProject();
    if(!p)return;

    const rows=subconRows();
    const t=totals();

    // Extend the existing v26.5 project summary instead of replacing it.
    const summary=holder.querySelector('.subcon-clean-summary');
    if(summary){
      let extra=summary.querySelector('[data-subcon-payment-summary]');
      if(!extra){
        extra=document.createElement('div');
        extra.setAttribute('data-subcon-payment-summary','1');
        extra.style.display='contents';
        summary.appendChild(extra);
      }
      extra.innerHTML=`
        <div class="subcon-summary-emphasis">
          <span>Total Amount for Subcon</span>
          <strong>${money(t.net)}</strong>
          <small>Net payable after retention / recoupment</small>
        </div>
        <div>
          <span>Subcon Gross Billing</span>
          <strong>${money(t.gross)}</strong>
        </div>
        <div>
          <span>Total Paid to Subcon</span>
          <strong>${money(t.paid)}</strong>
        </div>
        <div>
          <span>Balance to Pay</span>
          <strong>${money(t.balance)}</strong>
        </div>`;
    }

    // Keep one payment section only even after Realtime/refresh renders.
    holder.querySelector('[data-subcon-payments-section]')?.remove();

    const section=document.createElement('div');
    section.className='subcon-payment-section';
    section.setAttribute('data-subcon-payments-section','1');

    section.innerHTML=`
      <div class="subcon-payment-head">
        <div>
          <span>SUBCON PAYMENTS</span>
          <h3>Subcontractor Billings & Payment History</h3>
          <p>Every payment is dated separately. Add Payment stays available until that Subcon billing balance becomes zero.</p>
        </div>
        <button type="button" class="secondary-btn" id="addSubconBillingFromFolderBtn">+ Add Subcon Billing</button>
      </div>

      ${rows.length?`
      <div class="subcon-payment-table-wrap">
        <table class="subcon-payment-table">
          <thead><tr>
            <th>Subcon Billing</th>
            <th>Subcontractor</th>
            <th>Gross</th>
            <th>Retention</th>
            <th>Recoupment</th>
            <th>Total Amount for Subcon</th>
            <th>Paid</th>
            <th>Balance</th>
            <th>Payment History</th>
            <th>Action</th>
          </tr></thead>
          <tbody>
            ${rows.map(b=>{
              const st=paymentState(b);
              return `<tr>
                <td>
                  <strong>${billingName(b)}</strong>
                  <small>${b.date_request||b.date_submitted||'—'}</small>
                </td>
                <td>${esc(b.subcontractor_name||'—')}</td>
                <td>${money(b.gross_amount)}</td>
                <td>${money(b.retention_amount)}</td>
                <td>${money(b.recoupment_amount)}</td>
                <td><strong>${money(st.netDue)}</strong></td>
                <td><strong>${money(st.totalPaid)}</strong></td>
                <td><strong>${money(st.balance)}</strong></td>
                <td>${paymentHistory(b)}</td>
                <td>
                  <div class="subcon-payment-actions">
                    ${st.balance>0.01
                      ? `<button type="button" class="primary-btn compact-btn" onclick="addPayment('${b.id}')">Add Payment</button>`
                      : `<span class="subcon-paid-badge">Fully Paid</span>`}
                    <button type="button" class="secondary-btn compact-btn" onclick="editBilling('${b.id}')">Edit Billing</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`
      :`<div class="subcon-payment-empty">
          <strong>No Subcontractor Billing record yet.</strong>
          <span>Create a Subcon Billing first, then payments can be added and tracked by date.</span>
        </div>`}
    `;

    holder.appendChild(section);

    const add=$('addSubconBillingFromFolderBtn');
    if(add){
      add.onclick=()=>{
        // Existing Add Billing handler already detects the active Subcon folder
        // and defaults bType to Subcontractor Billing.
        $('addBillingBtn')?.click();
      };
    }
  }

  // Final wrapper after v28.8 / v28.5.
  const baseBilling=window.renderBilling;
  window.renderBilling=function(){
    let out;
    try{out=baseBilling.apply(this,arguments)}catch(err){console.warn('billing render',err)}
    renderSubconPayments();
    return out;
  };

  // Re-render after payment dialog saves through refreshAll/renderBilling.
  // Folder/project interactions already invoke renderBilling; these direct hooks
  // only cover edge cases without a polling loop.
  document.querySelectorAll('.billing-party-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      requestAnimationFrame(renderSubconPayments);
    },{passive:true});
  });

  if($('billingProjectFilter')){
    $('billingProjectFilter').addEventListener('change',()=>{
      requestAnimationFrame(renderSubconPayments);
    },{passive:true});
  }

  requestAnimationFrame(renderSubconPayments);
  window.renderSubconPaymentsV289=renderSubconPayments;
})();
