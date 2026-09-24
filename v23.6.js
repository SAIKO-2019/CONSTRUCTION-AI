// SAIKO Construction AI v23.6 — compact Dashboard remarks for For Quotation
(function(){
  function renderQuotationDashboardRemark(){
    const box=$('dashboardQuotationRemarks');
    if(!box)return;
    const qs=cache.quotationProjects||[];
    const active=qs.filter(q=>q.status==='For Quotation'||!q.status).length;
    const awarded=qs.filter(q=>q.status==='Awarded').length;
    const notAwarded=qs.filter(q=>q.status==='Not Awarded').length;
    const span=box.querySelector('span');
    if(span){
      span.textContent=`${active} active quotation${active===1?'':'s'} · ${awarded} awarded · ${notAwarded} not awarded. Detailed quotation data remains in For Quotation.`;
    }
  }

  const oldDashboard=renderDashboard;
  renderDashboard=function(){
    oldDashboard();
    renderQuotationDashboardRemark();
  };

  if(currentUser)renderQuotationDashboardRemark();
})();
