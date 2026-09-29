// CONSTRUCTION MONITORING v28.8
// 1) Per-view scroll position stays where the user left it.
// 2) Downpayment is excluded from Total Collected.
// 3) Billing Accumulated = latest cumulative regular Billing accomplishment %.
// 4) Remaining to Bill and Next Billing automatically deduct retention + recoupment.
// 5) Next Billing % = Actual Accomplishment - previous Billing Accumulated %.
// No MutationObserver and no new recurring timer.
(function(){
  const n=v=>{
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  };
  const clamp=(v,min=0,max=100)=>Math.min(max,Math.max(min,n(v)));

  function billCategory(b){
    if(b?.billing_category)return b.billing_category;
    return b?.variation_no?'VO':'Billing';
  }
  function isGencon(b){
    return b?.billing_type!=='Subcontractor Billing';
  }
  function isDownpayment(b){
    return billCategory(b)==='Downpayment';
  }
  function isRegularProgressBilling(b){
    return isGencon(b) && billCategory(b)==='Billing';
  }

  function projectRows(pid){
    return (cache.billings||[]).filter(b=>String(b.project_id)===String(pid));
  }

  function selectedBillingProjectId(){
    return $('billingProjectFilter')?.value||$('workspaceProject')?.value||'';
  }

  function projectById(pid){
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }

  function latestActualPercent(pid){
    const series=(cache.actualSeries||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({
        date:String(r.progress_date||'').slice(0,10),
        value:clamp(r.cumulative_percent)
      }))
      .filter(r=>r.date)
      .sort((a,b)=>a.date.localeCompare(b.date));

    if(series.length)return series[series.length-1].value;

    if(typeof window.actualForProject==='function'){
      return clamp(window.actualForProject(pid));
    }

    return clamp((cache.progress||[])
      .filter(r=>String(r.project_id)===String(pid))
      .reduce((s,r)=>s+n(r.actual_percent),0));
  }

  function billingForecast(pid){
    const p=projectById(pid)||{};
    const rows=projectRows(pid);
    const gen=rows.filter(isGencon);
    const dp=gen.filter(isDownpayment);
    const nonDp=gen.filter(b=>!isDownpayment(b));
    const progressRows=gen.filter(isRegularProgressBilling);

    const contract=n(p.contract_amount||p.total_contract_amount);
    const dpGross=dp.reduce((s,b)=>s+n(b.gross_amount),0);
    const dpReceived=dp.reduce((s,b)=>s+n(b.received_amount),0);

    // User rule: DP is NOT part of Total Collected.
    const totalCollected=nonDp.reduce((s,b)=>s+n(b.received_amount),0);

    // Accumulated Billing % is cumulative, so use the highest encoded regular Billing %.
    const accumulated=clamp(progressRows.reduce((mx,b)=>Math.max(mx,n(b.accomplishment_percent)),0));

    // Use the billing row corresponding to the latest accumulated percentage
    // as the commercial basis for the next/remaining forecast.
    const rateRow=progressRows
      .slice()
      .sort((a,b)=>{
        const pa=n(a.accomplishment_percent),pb=n(b.accomplishment_percent);
        if(pa!==pb)return pb-pa;
        const da=String(a.date_request||a.date_submitted||a.created_at||'');
        const db=String(b.date_request||b.date_submitted||b.created_at||'');
        return db.localeCompare(da);
      })[0]||null;

    const retPct=rateRow && (rateRow.retention_applicable || n(rateRow.retention_percent)>0)
      ? Math.max(0,n(rateRow.retention_percent))
      : 0;
    const recPct=rateRow && (rateRow.recoupment_applicable || n(rateRow.recoupment_percent)>0)
      ? Math.max(0,n(rateRow.recoupment_percent))
      : 0;

    const actual=latestActualPercent(pid);

    // Contract balance based on accumulated Billing %, not collections.
    const remainingPct=clamp(100-accumulated);
    const remainingGross=contract*remainingPct/100;
    const remainingRetention=remainingGross*retPct/100;
    const remainingRecoupment=remainingGross*recPct/100;
    const remainingNet=Math.max(0,remainingGross-remainingRetention-remainingRecoupment);

    // User rule: next billing is Actual - Previous Billing Accumulated %.
    const pendingPct=clamp(actual-accumulated);
    const nextGross=contract*pendingPct/100;
    const nextRetention=nextGross*retPct/100;
    const nextRecoupment=nextGross*recPct/100;
    const nextNet=Math.max(0,nextGross-nextRetention-nextRecoupment);

    return {
      contract,dpGross,dpReceived,totalCollected,
      accumulated,actual,pendingPct,
      retPct,recPct,
      remainingPct,remainingGross,remainingRetention,remainingRecoupment,remainingNet,
      nextGross,nextRetention,nextRecoupment,nextNet,
      rateRow
    };
  }

  window.billingForecastForProject=billingForecast;

  // =======================================================
  // Billing page forecast
  // =======================================================
  function renderBillingForecast(){
    const panel=$('billingForecastPanel');
    if(!panel)return;

    let party='gencon';
    try{party=localStorage.getItem('saiko_billing_party_folder')||'gencon'}catch(_){}
    if(party==='subcon'){
      panel.style.display='none';
      return;
    }
    panel.style.display='';

    const pid=selectedBillingProjectId();
    if(!pid){
      $('billingForecastSummary').innerHTML='<div class="empty">Select a project to compute billing accumulated and next billing.</div>';
      $('billingRemainingBreakdown').innerHTML='';
      $('billingNextBreakdown').innerHTML='';
      return;
    }

    const f=billingForecast(pid);

    // Keep existing GenCon KPI intent but apply user's Total Collected rule.
    const kpis=$('billingKPIs');
    if(kpis){
      const rows=projectRows(pid).filter(isGencon);
      const gross=rows.reduce((s,b)=>s+n(b.gross_amount),0);
      const outstanding=rows.reduce((s,b)=>s+n(b.outstanding_amount),0);
      const retention=rows.reduce((s,b)=>s+n(b.retention_amount),0);
      kpis.innerHTML=[
        ['GenCon Gross Billed',money(gross)],
        ['Total Collected (Excl. DP)',money(f.totalCollected)],
        ['Outstanding',money(outstanding)],
        ['Retention Held',money(retention)]
      ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
    }

    $('billingForecastBadge').textContent=f.pendingPct>0?'READY TO BILL':'UP TO DATE';

    $('billingForecastSummary').innerHTML=[
      ['Contract Amount',money(f.contract)],
      ['Downpayment',money(f.dpGross)],
      ['Billing Accumulated',`${f.accumulated.toFixed(2)}%`],
      ['Actual Accomplishment',`${f.actual.toFixed(2)}%`],
      ['Pending Accomplishment',`${f.pendingPct.toFixed(2)}%`],
      ['Total Collected (Excl. DP)',money(f.totalCollected)]
    ].map(([label,value])=>`
      <div class="billing-forecast-kpi">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>`).join('');

    $('billingRemainingNet').textContent=money(f.remainingNet);
    $('billingRemainingBreakdown').innerHTML=[
      ['Remaining Accomplishment',`${f.remainingPct.toFixed(2)}%`],
      ['Remaining Gross',money(f.remainingGross)],
      [`Less Retention (${f.retPct.toFixed(2)}%)`,money(f.remainingRetention)],
      [`Less Recoupment (${f.recPct.toFixed(2)}%)`,money(f.remainingRecoupment)],
      ['Remaining Net to Bill',money(f.remainingNet)]
    ].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

    $('billingNextNet').textContent=money(f.nextNet);
    $('billingNextBreakdown').innerHTML=[
      ['Previous Billing %',`${f.accumulated.toFixed(2)}%`],
      ['Current Actual %',`${f.actual.toFixed(2)}%`],
      ['Next Billable %',`${f.pendingPct.toFixed(2)}%`],
      ['Next Billing Gross',money(f.nextGross)],
      [`Less Retention (${f.retPct.toFixed(2)}%)`,money(f.nextRetention)],
      [`Less Recoupment (${f.recPct.toFixed(2)}%)`,money(f.nextRecoupment)],
      ['Next Billing Net',money(f.nextNet)]
    ].map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

    $('billingForecastFormula').innerHTML=
      `<strong>Formula:</strong> Next Billable % = Actual ${f.actual.toFixed(2)}% − Previous Billing Accumulated ${f.accumulated.toFixed(2)}% = ${f.pendingPct.toFixed(2)}%. `+
      `Next Billing Gross = Contract Amount × ${f.pendingPct.toFixed(2)}%. Retention and Recoupment use the latest regular Billing rates. `+
      `<strong>Downpayment is shown separately and is not included in Total Collected.</strong>`;
  }

  const baseBilling=window.renderBilling;
  window.renderBilling=function(){
    let out;
    try{out=baseBilling.apply(this,arguments)}catch(err){console.warn('billing base render',err)}
    renderBillingForecast();
    return out;
  };

  // =======================================================
  // Dashboard/Home financial corrections
  // =======================================================
  function rewriteHomeTotalCollected(){
    const host=$('v28HomeKpis');
    if(!host)return;
    const total=(cache.billings||[])
      .filter(b=>isGencon(b) && !isDownpayment(b))
      .reduce((s,b)=>s+n(b.received_amount||b.paid_amount),0);

    [...host.children].forEach(card=>{
      const label=card.querySelector('span');
      if(label && /total collected/i.test(label.textContent||'')){
        const value=card.querySelector('strong');
        if(value)value.textContent=money(total);
        label.textContent='Total Collected (Excl. DP)';
      }
    });
  }

  function rewriteSelectedDashboardFinance(){
    const p=(cache.projects||[]).find(x=>String(x.id)===String($('workspaceProject')?.value||''))||null;
    const host=$('v28FinanceSnapshot');
    if(!p||!host)return;

    const rows=projectRows(p.id).filter(isGencon);
    const nonDp=rows.filter(b=>!isDownpayment(b));
    const billed=nonDp.reduce((s,b)=>s+n(b.gross_amount),0);
    const collected=nonDp.reduce((s,b)=>s+n(b.received_amount),0);
    const outstanding=nonDp.reduce((s,b)=>s+n(b.outstanding_amount),0);

    host.innerHTML=[
      ['Contract Amount',money(n(p.contract_amount||p.total_contract_amount))],
      ['Regular / VO Billed',money(billed)],
      ['Collected (Excl. DP)',money(collected)],
      ['Outstanding',money(outstanding)]
    ].map(([a,b])=>`<div class="v28-finance-cell"><span>${a}</span><strong>${b}</strong></div>`).join('');
  }

  function rewriteProjectFinancialTable(){
    const body=$('dashboardProjectFinancialRows');
    if(!body)return;
    const projects=cache.projects||[];

    body.innerHTML=projects.length?projects.map(p=>{
      const rows=projectRows(p.id);
      const gen=rows.filter(isGencon);
      const sub=rows.filter(b=>b.billing_type==='Subcontractor Billing');

      const dpGross=gen.filter(isDownpayment).reduce((s,b)=>s+n(b.gross_amount),0);
      const regularGross=gen.filter(b=>!isDownpayment(b)).reduce((s,b)=>s+n(b.gross_amount),0);
      const collected=gen.filter(b=>!isDownpayment(b)).reduce((s,b)=>s+n(b.received_amount),0);
      const outstanding=gen.reduce((s,b)=>s+n(b.outstanding_amount),0);
      const subconPaid=sub.reduce((s,b)=>s+n(b.received_amount),0);

      return `<tr>
        <td><strong>${esc(p.project_name)}</strong></td>
        <td>${money(n(p.contract_amount))}</td>
        <td>${money(dpGross)}</td>
        <td>${money(regularGross)}</td>
        <td>${money(collected)}</td>
        <td>${money(outstanding)}</td>
        <td>${money(n(p.subcon_contract_amount))}</td>
        <td>${money(subconPaid)}</td>
      </tr>`;
    }).join(''):'<tr><td colspan="8" class="empty">No financial data yet.</td></tr>';
  }

  const baseDashboard=window.renderDashboard;
  window.renderDashboard=function(){
    let out;
    try{out=baseDashboard.apply(this,arguments)}catch(err){console.warn('dashboard base render',err)}
    rewriteSelectedDashboardFinance();
    rewriteProjectFinancialTable();
    rewriteHomeTotalCollected();
    return out;
  };

  // =======================================================
  // Per-view scroll preservation
  // =======================================================
  const scrollState=new Map();
  let scrollRAF=0;
  let restoreToken=0;

  function activeView(){
    return document.querySelector('.view.active-view')?.id||'';
  }

  function mainScroller(){
    const main=document.querySelector('.main');
    if(!main)return null;
    return main.scrollHeight>main.clientHeight+4 ? main : null;
  }

  function currentScroll(){
    const main=mainScroller();
    return {
      windowY:window.scrollY||document.documentElement.scrollTop||0,
      mainY:main?main.scrollTop:0
    };
  }

  function saveScroll(view=activeView()){
    if(!view)return;
    const s=currentScroll();
    scrollState.set(view,s);
    try{
      sessionStorage.setItem(`cm_scroll_${view}`,JSON.stringify(s));
    }catch(_){}
  }

  function getSavedScroll(view){
    if(scrollState.has(view))return scrollState.get(view);
    try{
      const raw=sessionStorage.getItem(`cm_scroll_${view}`);
      if(raw){
        const parsed=JSON.parse(raw);
        scrollState.set(view,parsed);
        return parsed;
      }
    }catch(_){}
    return {windowY:0,mainY:0};
  }

  function restoreScroll(view,expectedToken){
    const pos=getSavedScroll(view);
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        if(expectedToken!=null && expectedToken!==restoreToken)return;
        const main=mainScroller();
        if(main)main.scrollTop=n(pos.mainY);
        window.scrollTo({left:0,top:n(pos.windowY),behavior:'auto'});
      });
    });
  }

  window.addEventListener('scroll',()=>{
    if(scrollRAF)return;
    scrollRAF=requestAnimationFrame(()=>{
      scrollRAF=0;
      saveScroll();
    });
  },{passive:true});

  const baseShow=window.show;
  window.show=function(view){
    const from=activeView();
    if(from)saveScroll(from);

    const out=baseShow(view);
    const target=$(view)?view:activeView();
    restoreToken++;
    restoreScroll(target,restoreToken);

    // Refresh the financial correction without moving the user's viewport.
    if(target==='billing')renderBillingForecast();
    if(target==='home')rewriteHomeTotalCollected();
    if(target==='dashboard'){
      rewriteSelectedDashboardFinance();
      rewriteProjectFinancialTable();
    }
    return out;
  };

  const baseRefresh=window.refreshAll;
  if(typeof baseRefresh==='function'){
    window.refreshAll=async function(){
      const view=activeView();
      if(view)saveScroll(view);
      const token=++restoreToken;
      const out=await baseRefresh.apply(this,arguments);

      // Caller may synchronously render right after await refreshAll().
      // Two animation frames restore after those DOM writes without a timer.
      if(view)restoreScroll(view,token);

      rewriteHomeTotalCollected();
      if(view==='billing')renderBillingForecast();
      if(view==='dashboard'){
        rewriteSelectedDashboardFinance();
        rewriteProjectFinancialTable();
      }
      return out;
    };
  }

  // Project selection changes update forecast immediately.
  if($('billingProjectFilter')){
    $('billingProjectFilter').addEventListener('change',()=>{
      renderBillingForecast();
    },{passive:true});
  }
  if($('workspaceProject')){
    $('workspaceProject').addEventListener('change',()=>{
      if(document.querySelector('#billing.active-view'))renderBillingForecast();
    },{passive:true});
  }

  // Initial correction after all prior release scripts have populated the UI.
  requestAnimationFrame(()=>{
    rewriteHomeTotalCollected();
    rewriteSelectedDashboardFinance();
    rewriteProjectFinancialTable();
    renderBillingForecast();
  });
})();
