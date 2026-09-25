// SAIKO Construction AI v28.0
// UI-only major release:
// - Scrollable Home
// - Theme-adaptive per-project dashboard
// - Editable FB-style profile (saved in Supabase auth metadata + existing user_preferences)
// - Login redesign using existing functional auth forms
// - No MutationObserver and no new recurring timer.
(function(){
  const num=v=>{
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  };
  const money=v=>'₱'+num(v).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=v=>`${num(v).toFixed(2)}%`;
  const safe=v=>esc(String(v??''));

  function meta(){
    return currentUser?.user_metadata||{};
  }
  function displayName(){
    return cache.userPreferences?.display_name || meta().full_name || currentProfile?.full_name || currentUser?.email?.split('@')[0] || 'User';
  }
  function initials(name=displayName()){
    return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'U';
  }
  function selectedProject(){
    const pid=$('workspaceProject')?.value||'';
    return (cache.projects||[]).find(p=>String(p.id)===String(pid)) || (cache.projects||[])[0] || null;
  }

  // -------------------------------------------------------
  // Shared navigation for dynamically-rendered Home/Dashboard
  // -------------------------------------------------------
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-v28-view]');
    if(!btn)return;
    const view=btn.dataset.v28View;
    if(view && $(view))show(view);
  });

  document.querySelectorAll('[data-v28-close]').forEach(btn=>{
    btn.addEventListener('click',()=>$(btn.dataset.v28Close)?.close());
  });

  // -------------------------------------------------------
  // Home
  // -------------------------------------------------------
  function actualFor(pid){
    if(typeof window.actualForProject==='function')return num(window.actualForProject(pid));
    return (cache.progress||[]).filter(r=>String(r.project_id)===String(pid)).reduce((s,r)=>s+num(r.actual_percent),0);
  }
  function pendingQuotations(){
    return (cache.quotationProjects||cache.quotations||[]).filter(q=>String(q.status||'').toLowerCase()==='pending');
  }

  function renderHome(){
    if(!$('v28HomeGreeting'))return;
    $('v28HomeGreeting').textContent=`Welcome back, ${displayName().split(' ')[0] || 'User'}`;

    const projects=cache.projects||[];
    const ongoing=projects.filter(p=>String(p.status||'').toLowerCase()!=='completed');
    const paid=(cache.billings||[]).reduce((s,b)=>s+num(b.received_amount||b.paid_amount),0);
    const qPending=pendingQuotations();

    $('v28HomeKpis').innerHTML=[
      ['Active Projects',ongoing.length],
      ['Pending Quotations',qPending.length],
      ['Total Collected',money(paid)],
      ['Online Team',document.querySelectorAll('.presence-avatar').length||'—']
    ].map(([a,b])=>`<div class="v28-home-kpi"><span>${a}</span><strong>${b}</strong></div>`).join('');

    $('v28HomeProjects').innerHTML=ongoing.length?ongoing.slice(0,12).map(p=>{
      const actual=Math.max(0,Math.min(100,actualFor(p.id)));
      return `<button type="button" class="v28-home-project-row" data-v28-project="${p.id}">
        <div><h3>${safe(p.project_name)}</h3><small>${safe(p.location||p.status||'Ongoing project')}</small></div>
        <div class="v28-project-progress-mini"><strong>${pct(actual)}</strong><div class="v28-mini-track"><i style="width:${actual}%"></i></div></div>
      </button>`;
    }).join(''):'<div class="empty">No ongoing projects.</div>';

    const activity=(cache.activity||cache.activityLog||[]).slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,8);
    $('v28HomeActivity').innerHTML=activity.length?activity.map(a=>`<div class="v28-feed-item"><strong>${safe(a.action||a.activity||a.description||'Workspace update')}</strong><span>${safe(a.input_by_name||a.user_name||'Team')} • ${safe(a.created_at?new Date(a.created_at).toLocaleString():'')}</span></div>`).join(''):'<div class="empty">No recent shared activity yet.</div>';

    $('v28HomeQuotation').innerHTML=qPending.length?qPending.slice(0,8).map(q=>`<div class="v28-feed-item"><strong>${safe(q.project_name||q.name||'Quotation')}</strong><span>${safe(q.location||q.deadline||'Pending')}</span></div>`).join(''):'<div class="empty">No pending quotations.</div>';
  }

  if($('v28HomeProjects')){
    $('v28HomeProjects').addEventListener('click',e=>{
      const row=e.target.closest('[data-v28-project]');
      if(!row)return;
      const pid=row.dataset.v28Project;
      if($('workspaceProject') && [...$('workspaceProject').options].some(o=>String(o.value)===String(pid))){
        $('workspaceProject').value=pid;
        $('workspaceProject').dispatchEvent(new Event('change',{bubbles:true}));
      }
      show('dashboard');
    });
  }

  // -------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------
  function series(key,pid){
    return (cache[key]||[])
      .filter(r=>String(r.project_id)===String(pid))
      .map(r=>({date:String(r.progress_date).slice(0,10),value:Math.max(0,Math.min(100,num(r.cumulative_percent)))}))
      .sort((a,b)=>a.date.localeCompare(b.date));
  }
  function plannedAt(rows,date){
    let v=0;
    for(const r of rows){
      if(r.date<=date)v=r.value;
      else break;
    }
    return v;
  }
  function latestActual(pid){
    const a=series('actualSeries',pid);
    if(a.length)return a[a.length-1];
    return {date:new Date().toISOString().slice(0,10),value:actualFor(pid)};
  }
  function scopeRows(pid){
    const canonical=['CEILING WORKS','CABINETRY WORKS','WALL FINISHING WORKS','FLOORING WORKS','ELECTRICAL WORKS','PLUMBING WORKS','GLASS WORKS','GENERAL REQUIREMENTS'];
    const map=new Map();
    for(const r of (cache.progress||[]).filter(x=>String(x.project_id)===String(pid))){
      map.set(String(r.activity||'').toUpperCase(),num(r.actual_percent));
    }
    return canonical.map(scope=>({scope,value:Math.max(0,Math.min(100,map.get(scope)||0))}));
  }
  function finance(pid){
    const p=(cache.projects||[]).find(x=>String(x.id)===String(pid))||{};
    const bills=(cache.billings||[]).filter(b=>String(b.project_id)===String(pid));
    const billed=bills.reduce((s,b)=>s+num(b.gross_amount||b.amount),0);
    const collected=bills.reduce((s,b)=>s+num(b.received_amount||b.paid_amount),0);
    const contract=num(p.contract_amount||p.total_contract_amount);
    return {contract,billed,collected,outstanding:Math.max(0,billed-collected)};
  }
  function curveSvg(pid){
    const p=series('projectedSeries',pid);
    const a=series('actualSeries',pid);
    if(!p.length)return '<div class="empty">Upload the fixed Projected schedule to generate the S-Curve.</div>';

    const start=p[0].date,finish=p[p.length-1].date;
    const W=760,H=280,L=42,R=16,T=18,B=38;
    const tt=d=>new Date(`${d}T00:00:00`).getTime();
    const s=tt(start),e=tt(finish);
    const x=d=>L+((tt(d)-s)/Math.max(1,e-s))*(W-L-R);
    const y=v=>H-B-Math.max(0,Math.min(100,v))*(H-T-B)/100;
    const pp=p.map(r=>`${x(r.date)},${y(r.value)}`).join(' ');
    const aa=a.filter(r=>r.date>=start&&r.date<=finish);
    let ap='';
    if(aa.length){
      ap=`M ${x(aa[0].date)} ${y(aa[0].value)}`;
      for(let i=1;i<aa.length;i++){
        const prev=aa[i-1],cur=aa[i],dx=x(cur.date)-x(prev.date);
        ap+=` C ${x(prev.date)+dx*.33} ${y(prev.value)}, ${x(prev.date)+dx*.67} ${y(cur.value)}, ${x(cur.date)} ${y(cur.value)}`;
      }
    }
    const grid=[0,25,50,75,100].map(v=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="rgba(100,116,139,.14)"/><text x="4" y="${y(v)+4}" font-size="10" fill="#718087">${v}%</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:290px;display:block">${grid}<polyline fill="none" stroke="var(--v28-accent)" stroke-width="3" points="${pp}"/>${ap?`<path d="${ap}" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>`:''}</svg><div class="project-curve-legend"><span><i class="planned-dot"></i>Planned</span><span><i class="actual-dot"></i>Actual</span></div>`;
  }

  function renderDashboardV28(){
    const p=selectedProject();
    if(!p)return;
    const actualPoint=latestActual(p.id);
    const plannedRows=series('projectedSeries',p.id);
    const planned=plannedAt(plannedRows,actualPoint.date);
    const actual=actualPoint.value;
    const variance=actual-planned;
    const condition=variance<-0.25?'SLIPPAGE':variance>0.25?'AHEAD':'ON TRACK';

    $('v28DashProjectName').textContent=p.project_name||'Project Dashboard';
    $('v28DashProjectMeta').textContent=[p.location,p.status].filter(Boolean).join(' • ')||'Selected project';
    $('v28ProjectHeroTitle').textContent=p.project_name||'Project';
    $('v28ProjectHeroScope').textContent=p.description||p.scope||p.location||'Live project workspace';
    $('v28DashStatus').textContent=condition;
    $('v28DashStatus').className='v28-project-status '+(condition==='SLIPPAGE'?'behind':condition==='AHEAD'?'ahead':'track');

    $('v28PlannedKpi').textContent=pct(planned);
    $('v28ActualKpi').textContent=pct(actual);
    $('v28VarianceKpi').textContent=(variance>0?'+':'')+pct(variance);
    $('v28PlanDateKpi').textContent=plannedRows.length?`Plan ${plannedRows[0].date} → ${plannedRows[plannedRows.length-1].date}`:'No planned curve';
    $('v28ActualDateKpi').textContent=`Actual as of ${actualPoint.date}`;
    $('v28VarianceStatus').textContent=condition;

    $('v28ActualGauge').style.setProperty('--actual',Math.max(0,Math.min(100,actual)));
    $('v28ActualGaugeValue').textContent=pct(actual);

    $('v28ProjectSCurve').innerHTML=curveSvg(p.id);

    const f=finance(p.id);
    $('v28FinanceSnapshot').innerHTML=[
      ['Contract Amount',money(f.contract)],
      ['Billed',money(f.billed)],
      ['Collected',money(f.collected)],
      ['Outstanding',money(f.outstanding)]
    ].map(([a,b])=>`<div class="v28-finance-cell"><span>${a}</span><strong>${b}</strong></div>`).join('');

    $('v28ScopeBars').innerHTML=scopeRows(p.id).map(r=>`<div class="v28-scope-row"><span>${safe(r.scope)}</span><div class="v28-scope-track"><i style="width:${r.value}%"></i></div><strong>${pct(r.value)}</strong></div>`).join('');
  }

  if($('workspaceProject')){
    $('workspaceProject').addEventListener('change',()=>{
      renderDashboardV28();
      renderHome();
    },{passive:true});
  }

  // -------------------------------------------------------
  // Profile
  // -------------------------------------------------------
  function applyAvatar(el,url,name){
    if(!el)return;
    el.textContent=url?'':initials(name);
    el.style.backgroundImage=url?`url("${String(url).replace(/"/g,'')}")`:'';
  }
  function renderProfile(){
    const m=meta();
    const name=displayName();
    const headline=m.profile_title||currentProfile?.department||'Construction Team';
    const role=currentProfile?.role||'editor';
    const bio=m.profile_bio||'Add a short profile bio about your role, projects, or current focus.';
    const avatar=m.avatar_url||'';
    const cover=m.cover_style||'theme';

    $('v28ProfileName').textContent=name;
    $('v28ProfileHeadline').textContent=headline;
    $('v28ProfileRole').textContent=role;
    $('v28ProfileBio').textContent=bio;
    $('v28ProfileCover').dataset.cover=cover;
    applyAvatar($('v28ProfileAvatar'),avatar,name);
    applyAvatar($('sidebarAvatar'),avatar,name);
    document.querySelectorAll('.mini-avatar').forEach(el=>applyAvatar(el,avatar,name));

    $('v28ProfileDetails').innerHTML=[
      ['Department',m.profile_department||currentProfile?.department||'—'],
      ['Phone',m.profile_phone||'—'],
      ['Location',m.profile_location||'—'],
      ['Email',currentUser?.email||'—']
    ].map(([a,b])=>`<div class="v28-profile-detail"><span>${a}</span><strong>${safe(b)}</strong></div>`).join('');

    $('v28ProfileStats').innerHTML=[
      ['Projects',(cache.projects||[]).length],
      ['Billings',(cache.billings||[]).length],
      ['Files',(cache.files||[]).length],
      ['Role',role]
    ].map(([a,b])=>`<div class="v28-profile-stat"><span>${a}</span><strong>${safe(b)}</strong></div>`).join('');

    const activity=(cache.activity||cache.activityLog||[]).slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,12);
    $('v28ProfileActivity').innerHTML=activity.length?activity.map(a=>`<div class="v28-feed-item"><strong>${safe(a.action||a.activity||a.description||'Workspace update')}</strong><span>${safe(a.created_at?new Date(a.created_at).toLocaleString():'')}</span></div>`).join(''):'<div class="empty">No recent activity.</div>';
  }

  function fillProfileForm(){
    const m=meta();
    $('v28ProfileDisplayName').value=displayName();
    $('v28ProfileTitle').value=m.profile_title||'';
    $('v28ProfileDepartment').value=m.profile_department||currentProfile?.department||'';
    $('v28ProfilePhone').value=m.profile_phone||'';
    $('v28ProfileLocation').value=m.profile_location||'';
    $('v28ProfileAvatarUrl').value=m.avatar_url||'';
    $('v28ProfileBioInput').value=m.profile_bio||'';
    $('v28ProfileCoverStyle').value=m.cover_style||'theme';
  }

  if($('v28EditProfileBtn'))$('v28EditProfileBtn').onclick=()=>{
    fillProfileForm();
    $('v28ProfileDialog').showModal();
  };
  if($('v28OpenSettingsBtn'))$('v28OpenSettingsBtn').onclick=()=>{
    $('settingsBtn')?.click();
  };
  if($('v28ProfileForm'))$('v28ProfileForm').onsubmit=async e=>{
    e.preventDefault();
    if(!currentUser)return;

    const name=$('v28ProfileDisplayName').value.trim();
    const metadata={
      ...meta(),
      full_name:name,
      profile_title:$('v28ProfileTitle').value.trim(),
      profile_department:$('v28ProfileDepartment').value.trim(),
      profile_phone:$('v28ProfilePhone').value.trim(),
      profile_location:$('v28ProfileLocation').value.trim(),
      avatar_url:$('v28ProfileAvatarUrl').value.trim(),
      profile_bio:$('v28ProfileBioInput').value.trim(),
      cover_style:$('v28ProfileCoverStyle').value
    };

    const {data,error}=await sb.auth.updateUser({data:metadata});
    if(error)return alert(error.message);

    currentUser=data.user||currentUser;

    // Keep existing display-name preference in sync.
    try{
      const row={
        ...(cache.userPreferences||{}),
        user_id:currentUser.id,
        display_name:name,
        updated_at:new Date().toISOString()
      };
      const pref=await sb.from('user_preferences').upsert(row,{onConflict:'user_id'}).select();
      if(!pref.error)cache.userPreferences={...cache.userPreferences,...row};
    }catch(err){console.warn('profile preference sync',err)}

    // Best-effort profiles table sync; UI does not depend on this succeeding.
    try{
      await sb.from('profiles').update({
        full_name:name,
        department:metadata.profile_department||currentProfile?.department||'Other'
      }).eq('user_id',currentUser.id);
      if(currentProfile){
        currentProfile.full_name=name;
        currentProfile.department=metadata.profile_department||currentProfile.department;
      }
    }catch(_){}

    if($('sidebarName'))$('sidebarName').textContent=name;
    $('v28ProfileDialog').close();
    renderProfile();
    renderHome();
    toast('Profile updated.');
  };

  // -------------------------------------------------------
  // Final render hooks
  // -------------------------------------------------------
  const baseShow=window.show;
  window.show=function(view){
    const out=baseShow(view);
    if(view==='home')renderHome();
    if(view==='dashboard')renderDashboardV28();
    if(view==='profile')renderProfile();
    return out;
  };

  const baseDashboard=window.renderDashboard;
  window.renderDashboard=function(){
    let out;
    try{out=baseDashboard.apply(this,arguments)}catch(err){console.warn('legacy dashboard',err)}
    renderDashboardV28();
    return out;
  };

  const baseRefresh=window.refreshAll;
  window.refreshAll=async function(){
    const out=await baseRefresh.apply(this,arguments);
    renderHome();
    renderDashboardV28();
    renderProfile();
    return out;
  };

  // New users/default landing = Home. Existing saved last module is still respected by v23.7.
  setTimeout(()=>{
    renderHome();
    renderDashboardV28();
    renderProfile();
    try{
      const saved=localStorage.getItem('saiko_last_view');
      if(!saved && currentUser)show('home');
    }catch(_){}
  },850);
})();
