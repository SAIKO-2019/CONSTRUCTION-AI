// SAIKO Construction AI v25.4
// Canonical scope matching + Dashboard matched cumulative S-Curve.
(function(){
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
  const clean=s=>String(s??'').trim();

  function basicNorm(s){
    return clean(s).toLowerCase()
      .replace(/&/g,' and ')
      .replace(/[^a-z0-9]+/g,' ')
      .replace(/\b(works?|work|scope|of|the|for|and|installation|supply|complete|including|item|finish|finishing)\b/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function canonicalScope(name){
    const s=basicNorm(name);

    if(/\bceiling\b/.test(s))return 'CEILING WORKS';
    if(/\b(cabinet|cabinetry|joinery|casework)\b/.test(s))return 'CABINETRY WORKS';
    if(/\b(wall paint|painting|wall cladding|cladding|wall finish|skimcoat|plaster)\b/.test(s))return 'WALL FINISHING WORKS';
    if(/\b(tile|tiling|flooring|floor finish|spc|vinyl|epoxy)\b/.test(s))return 'FLOORING WORKS';
    if(/\b(electrical|lighting|light|outlet|wiring|wire|panel board|panelboard)\b/.test(s))return 'ELECTRICAL WORKS';
    if(/\b(plumbing|sanitary|water line|sewer|sewage|drain|fixture)\b/.test(s))return 'PLUMBING WORKS';
    if(/\b(glass|glazing)\b/.test(s))return 'GLASS WORKS';
    if(/\b(window|windows|aluminum)\b/.test(s))return 'DOORS & WINDOWS';
    if(/\b(door|doors)\b/.test(s))return 'DOORS & WINDOWS';
    if(/\b(general requirement|mobilization|demobilization|temporary facility|permit|safety)\b/.test(s))return 'GENERAL REQUIREMENTS';

    return clean(name)
      .toUpperCase()
      .replace(/\bWORKS?\b/g,'')
      .replace(/\s+/g,' ')
      .trim() || 'OTHER';
  }

  function tokenSet(s){
    return new Set(basicNorm(s).split(' ').filter(x=>x.length>1));
  }

  function similarity(a,b){
    const ca=canonicalScope(a), cb=canonicalScope(b);
    if(ca===cb)return 1;

    const A=basicNorm(a),B=basicNorm(b);
    if(!A||!B)return 0;
    if(A===B)return 1;
    if(A.includes(B)||B.includes(A))return .90;

    const ta=tokenSet(A),tb=tokenSet(B);
    let inter=0;
    ta.forEach(x=>{if(tb.has(x))inter++});
    const denom=Math.max(1,ta.size+tb.size);
    return (2*inter)/denom;
  }

  function scheduleFractionToday(r){
    const today=new Date();
    const s=new Date(r.start_date),e=new Date(r.end_date);
    if(Number.isNaN(s.getTime())||Number.isNaN(e.getTime()))return 0;
    if(today<=s)return 0;
    if(today>=e)return 1;
    return Math.max(0,Math.min(1,(today-s)/(e-s||1)));
  }

  function groupProjected(pid){
    const rows=(cache.schedule||[]).filter(r=>String(r.project_id)===String(pid));
    const groups=new Map();

    for(const r of rows){
      const key=canonicalScope(r.activity);
      if(!groups.has(key)){
        groups.set(key,{
          key,
          names:[],
          weight:0,
          plannedToday:0,
          earliest:r.start_date||null
        });
      }
      const g=groups.get(key);
      if(!g.names.includes(r.activity))g.names.push(r.activity);
      const w=Math.max(0,n(r.weight));
      g.weight+=w;
      g.plannedToday+=w*scheduleFractionToday(r);
      if(r.start_date&&(!g.earliest||r.start_date<g.earliest))g.earliest=r.start_date;
    }
    return [...groups.values()];
  }

  function groupActual(pid){
    const rows=(cache.progress||[]).filter(r=>String(r.project_id)===String(pid));
    const groups=new Map();

    for(const r of rows){
      const key=canonicalScope(r.activity);
      if(!groups.has(key)){
        groups.set(key,{key,names:[],actual:0,weight:0});
      }
      const g=groups.get(key);
      if(!g.names.includes(r.activity))g.names.push(r.activity);
      const w=Math.max(0,n(r.weight));
      g.weight+=w;
      g.actual+=w*Math.max(0,Math.min(100,n(r.actual_percent)))/100;
    }
    return [...groups.values()];
  }

  function matchedScopes(pid){
    const projected=groupProjected(pid);
    const actual=groupActual(pid);
    const used=new Set();
    const result=[];

    for(const p of projected){
      let best=null,bestScore=0,bestIndex=-1;

      for(let i=0;i<actual.length;i++){
        if(used.has(i))continue;
        const a=actual[i];
        const score=p.key===a.key?1:Math.max(...p.names.flatMap(pn=>a.names.map(an=>similarity(pn,an))));
        if(score>bestScore){
          best=a;
          bestScore=score;
          bestIndex=i;
        }
      }

      if(best && bestScore>=.42){
        used.add(bestIndex);
        result.push({
          scope:p.key===best.key?p.key:(bestScore>=.8?p.key:`${p.key}`),
          projectedNames:p.names,
          actualNames:best.names,
          projected:p.plannedToday,
          actual:best.actual,
          earliest:p.earliest,
          score:bestScore
        });
      }else{
        result.push({
          scope:p.key,
          projectedNames:p.names,
          actualNames:[],
          projected:p.plannedToday,
          actual:0,
          earliest:p.earliest,
          score:0
        });
      }
    }

    actual.forEach((a,i)=>{
      if(used.has(i))return;
      result.push({
        scope:a.key,
        projectedNames:[],
        actualNames:a.names,
        projected:0,
        actual:a.actual,
        earliest:'9999-12-31',
        score:0
      });
    });

    result.sort((a,b)=>String(a.earliest||'9999').localeCompare(String(b.earliest||'9999')) || a.scope.localeCompare(b.scope));
    return result;
  }


  function exactProjectedSeries(pid){
    return (cache.projectedSeries||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({date:String(r.progress_date).slice(0,10),projected:Math.max(0,n(r.cumulative_percent))}))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }

  function renderMatchedScopeSCurve(){
    const chart=$('dashboardMatchedSCurve');
    const tbody=$('dashboardMatchedScopeRows');
    const badge=$('dashboardScopeMatchBadge');
    if(!chart||!tbody)return;

    const pid=$('workspaceProject')?.value||cache.projects?.[0]?.id;
    if(!pid){
      chart.innerHTML='<div class="empty">Select a project.</div>';
      return;
    }

    const rows=matchedScopes(pid);
    if(!rows.length){
      chart.innerHTML='<div class="empty">Sync the Projected and Actual Google Sheets to generate the matched S-Curve.</div>';
      tbody.innerHTML='<tr><td colspan="6" class="empty">No matched scope data yet.</td></tr>';
      if(badge)badge.textContent='NO DATA';
      return;
    }

    const exactSeries=exactProjectedSeries(pid);
    if(exactSeries.length){
      const currentActual=actualForProject(pid);
      const W=920,H=260,padL=44,padR=20,padT=18,padB=42;
      const y=v=>H-padB-Math.max(0,Math.min(100,v))*(H-padT-padB)/100;
      const x=i=>exactSeries.length===1?(padL+(W-padL-padR)/2):padL+i*(W-padL-padR)/(exactSeries.length-1);
      const grid=[0,25,50,75,100].map(v=>
        `<line x1="${padL}" y1="${y(v)}" x2="${W-padR}" y2="${y(v)}" stroke="rgba(100,116,139,.18)"/>
         <text x="4" y="${y(v)+4}" font-size="11" fill="#64748b">${v}%</text>`
      ).join('');
      const pp=exactSeries.map((r,i)=>`${x(i)},${y(r.projected)}`).join(' ');
      const actualPoints=exactSeries.map((r,i)=>{
        const isLast=i===exactSeries.length-1;
        return `${x(i)},${y(isLast?currentActual:0)}`;
      }).join(' ');
      chart.innerHTML=`
        <svg class="scurve-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          ${grid}
          <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pp}"/>
          <circle cx="${x(exactSeries.length-1)}" cy="${y(currentActual)}" r="5" fill="#16a34a"/>
        </svg>
        <div class="chart-legend">
          <span><i class="legend-dot" style="background:#2563eb"></i>Projected cumulative %</span>
          <span><i class="legend-dot" style="background:#16a34a"></i>Current Actual STATUS total</span>
          <span>${pct(exactSeries[exactSeries.length-1].projected)} projected series end • ${pct(currentActual)} actual</span>
        </div>`;
    }

    const totalProjected=rows.reduce((s,r)=>s+r.projected,0);
    const totalActual=rows.reduce((s,r)=>s+r.actual,0);

    // Use a common 0-100 project basis. If a source is slightly over 100 because of rounding,
    // scale only the chart positions; table values remain the source values.
    const scaleP=totalProjected>100?100/totalProjected:1;
    const scaleA=totalActual>100?100/totalActual:1;

    let cp=0,ca=0;
    const curve=rows.map(r=>{
      cp+=r.projected*scaleP;
      ca+=r.actual*scaleA;
      return {...r,cumProjected:cp,cumActual:ca};
    });

    const W=920,H=260,padL=44,padR=20,padT=18,padB=42;
    const x=i=>curve.length===1?(padL+(W-padL-padR)/2):padL+i*(W-padL-padR)/(curve.length-1);
    const y=v=>H-padB-Math.max(0,Math.min(100,v))*(H-padT-padB)/100;

    const grid=[0,25,50,75,100].map(v=>
      `<line x1="${padL}" y1="${y(v)}" x2="${W-padR}" y2="${y(v)}" stroke="rgba(100,116,139,.18)"/>
       <text x="4" y="${y(v)+4}" font-size="11" fill="#64748b">${v}%</text>`
    ).join('');

    const pp=curve.map((r,i)=>`${x(i)},${y(r.cumProjected)}`).join(' ');
    const ap=curve.map((r,i)=>`${x(i)},${y(r.cumActual)}`).join(' ');
    const labels=curve.map((r,i)=>{
      const short=r.scope
        .replace(' WORKS','')
        .replace('GENERAL REQUIREMENTS','GEN. REQ.')
        .replace('WALL FINISHING','WALL');
      return `<text x="${x(i)}" y="${H-12}" text-anchor="middle" font-size="9" fill="#64748b">${esc(short.slice(0,13))}</text>`;
    }).join('');

    chart.innerHTML=`
      <svg class="scurve-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        ${grid}
        <polyline fill="none" stroke="#2563eb" stroke-width="3" points="${pp}"/>
        <polyline fill="none" stroke="#16a34a" stroke-width="3" points="${ap}"/>
        ${curve.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.cumProjected)}" r="3.5" fill="#2563eb"/><circle cx="${x(i)}" cy="${y(r.cumActual)}" r="3.5" fill="#16a34a"/>`).join('')}
        ${labels}
      </svg>
      <div class="chart-legend">
        <span><i class="legend-dot" style="background:#2563eb"></i>Projected cumulative</span>
        <span><i class="legend-dot" style="background:#16a34a"></i>Actual cumulative</span>
        <span>${pct(totalProjected)} projected today • ${pct(totalActual)} actual</span>
      </div>`;

    tbody.innerHTML=rows.map(r=>{
      const variance=r.actual-r.projected;
      const projectedName=r.projectedNames.length?r.projectedNames.join(' + '):'—';
      const actualName=r.actualNames.length?r.actualNames.join(' + '):'—';
      return `<tr>
        <td><strong>${esc(r.scope)}</strong></td>
        <td>${esc(projectedName)}</td>
        <td>${esc(actualName)}</td>
        <td>${pct(r.projected)}</td>
        <td>${pct(r.actual)}</td>
        <td class="${variance<0?'negative':'positive'}">${pct(variance)}</td>
      </tr>`;
    }).join('');

    const matched=rows.filter(r=>r.projectedNames.length&&r.actualNames.length).length;
    if(badge)badge.textContent=`${matched}/${rows.length} MATCHED`;
  }

  const baseDashboard=renderDashboard;
  renderDashboard=function(){
    baseDashboard();
    renderMatchedScopeSCurve();
  };

  if($('workspaceProject')){
    $('workspaceProject').addEventListener('change',()=>setTimeout(renderMatchedScopeSCurve,20),{passive:true});
  }

  window.renderMatchedScopeSCurve=renderMatchedScopeSCurve;
})();
