// SAIKO Construction AI v24.0
// Tiny, GPU-friendly celebration when a billing becomes fully Paid.
// No intervals, no MutationObserver, no DOM scan loop.
(function(){
  let paidCelebrationTimer=null;

  function closePaidCelebration(){
    const el=document.getElementById('paidMiniCelebration');
    if(!el)return;
    el.classList.add('hide');
    setTimeout(()=>el.remove(),320);
  }

  window.showPaidCelebration=function(){
    const old=document.getElementById('paidMiniCelebration');
    if(old)old.remove();
    if(paidCelebrationTimer)clearTimeout(paidCelebrationTimer);

    const el=document.createElement('div');
    el.id='paidMiniCelebration';
    el.className='paid-mini-celebration';
    el.setAttribute('role','status');
    el.innerHTML=`
      <span class="paid-mini-icon">✓</span>
      <span class="paid-mini-text"><strong>Paid!</strong><small>Payment completed</small></span>
      <span class="paid-mini-spark p1">✦</span>
      <span class="paid-mini-spark p2">✦</span>
      <span class="paid-mini-spark p3">•</span>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));

    // User requested it to disappear after 30 seconds.
    paidCelebrationTimer=setTimeout(closePaidCelebration,30000);
  };

  const previousAddPayment=window.addPayment;
  if(typeof previousAddPayment==='function'){
    window.addPayment=async function(id){
      const before=(cache.billings||[]).find(x=>String(x.id)===String(id));
      const wasPaid=before?.status==='Paid';

      await previousAddPayment(id);

      const after=(cache.billings||[]).find(x=>String(x.id)===String(id));
      if(!wasPaid && after?.status==='Paid'){
        showPaidCelebration();
      }
    };
  }
})();
