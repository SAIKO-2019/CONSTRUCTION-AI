// SAIKO Construction AI v25.8
// Exact user-requested percentage basis:
// Actual = STATUS on each OVERALL ACCOMPLISHMENT STATUS row.
// Projected = PROJECTED ACCUMULATIVE ACCOMPLISHMENT %AGE series.
(function(){
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};

  const oldProgress=window.renderProgress;
  window.renderProgress=function(){
    oldProgress();
    const pid=$('progressProject')?.value||cache.projects?.[0]?.id;
    if(!pid)return;
    const rows=(cache.progress||[]).filter(r=>String(r.project_id)===String(pid));
    const tbody=$('progressRows');
    if(!tbody)return;

    tbody.innerHTML=rows.length?rows.map(r=>`<tr>
      <td class="check-col"><input class="progress-row-check" type="checkbox" value="${r.id}" ${selectedProgressIds.has(String(r.id))?'checked':''}></td>
      <td>${esc(r.activity)}</td>
      <td>100.00%</td>
      <td><strong>${pct(n(r.actual_percent))}</strong></td>
      <td>${pct(n(r.actual_percent))}</td>
      <td>${r.updated_at?new Date(r.updated_at).toLocaleString():'—'}</td>
      <td><button class="danger-link" onclick="deleteProgress('${r.id}')">Delete</button></td>
    </tr>`).join(''):'<tr><td colspan="7" class="empty">Save the Actual Progress Google Sheet link, then click Sync Now.</td></tr>';

    const total=rows.reduce((sum,r)=>sum+n(r.actual_percent),0);
    $('progressSummary').innerHTML=[
      ['Actual Accomplishment',pct(total)],
      ['Remaining',pct(Math.max(0,100-total))],
      ['Scopes',rows.length],
      ['Basis','STATUS']
    ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  };

  const oldSchedule=window.renderSchedule;
  window.renderSchedule=function(){
    oldSchedule();
    const pid=$('scheduleProject')?.value||cache.projects?.[0]?.id;
    if(!pid)return;
    const exact=typeof plannedFromCumulativeSeries==='function'?plannedFromCumulativeSeries(pid):null;
    const rows=(cache.projectedSeries||[]).filter(r=>String(r.project_id)===String(pid));
    if(exact!=null && $('scheduleSummary')){
      $('scheduleSummary').innerHTML=[
        ['Projected Today',pct(exact)],
        ['Remaining Plan',pct(Math.max(0,100-exact))],
        ['Projected Points',rows.length],
        ['Basis','Cumulative %']
      ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
    }
  };
})();
