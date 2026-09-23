const cfg=window.SAIKO_CONFIG||{};
const sb=(window.supabase&&cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY)?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY):null;
const PROFILE_TABLE='SAIKO BUILDERS';
let currentUser=null,currentProfile=null,cache={projects:[],billings:[],payments:[],schedule:[],progress:[],files:[],templates:[],boq:[]};
let smartImportItems=[];
const $=id=>document.getElementById(id); const money=n=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(Number(n||0)); const pct=n=>`${Number(n||0).toFixed(2)}%`; const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function toast(msg){const d=document.createElement('div');d.textContent=msg;Object.assign(d.style,{position:'fixed',right:'20px',bottom:'20px',background:'#10253a',color:'#fff',padding:'12px 16px',borderRadius:'10px',zIndex:2000,boxShadow:'0 8px 30px rgba(0,0,0,.22)'});document.body.appendChild(d);setTimeout(()=>d.remove(),3000)}
function show(view){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));$(view).classList.add('active-view');document.querySelectorAll('#sideNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); if(view==='dashboard')renderDashboard();if(view==='projects')renderProjects();if(view==='billing')renderBilling();if(view==='schedule')renderSchedule();if(view==='progress')renderProgress();if(view==='files')renderFiles();if(view==='templates')renderTemplates();if(view==='users')renderUsers();}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());

// AUTH
function authTab(mode){$('loginPane').classList.toggle('hidden',mode!=='login');$('signupPane').classList.toggle('hidden',mode!=='signup');$('showLoginBtn').classList.toggle('active',mode==='login');$('showSignupBtn').classList.toggle('active',mode==='signup');}
$('showLoginBtn').onclick=()=>authTab('login');$('showSignupBtn').onclick=()=>authTab('signup');
async function profileFor(user){const {data,error}=await sb.from(PROFILE_TABLE).select('*').eq('user_id',user.id).maybeSingle();if(error)console.warn(error);return data}
async function ensureProfile(user){let p=await profileFor(user);if(p)return p;const m=user.user_metadata||{};const row={user_id:user.id,full_name:m.full_name||user.email?.split('@')[0]||'User',email:user.email||'',role:m.role||'editor',department:m.department||'Other',status:'active'};const {data,error}=await sb.from(PROFILE_TABLE).insert(row).select().maybeSingle();if(error)console.warn(error);return data||row}
async function enter(user){currentUser=user;currentProfile=await ensureProfile(user);if(currentProfile?.status==='inactive'){await sb.auth.signOut();$('loginError').textContent='Account is inactive. Contact the administrator.';return}const name=currentProfile?.full_name||user.email;const initial=(name||'U')[0].toUpperCase();$('sidebarName').textContent=name;$('sidebarRole').textContent=currentProfile?.role||'editor';$('sidebarAvatar').textContent=initial;document.querySelector('.mini-avatar').textContent=initial;document.querySelectorAll('.admin-only').forEach(e=>e.style.display=currentProfile?.role==='admin'?'':'none');$('loginGate').classList.add('hidden');await refreshAll();await checkStorage();}
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginError').textContent='Signing in...';const {data,error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error){$('loginError').textContent=error.message;return}$('loginError').textContent='';await enter(data.user)};
$('signupForm').onsubmit=async e=>{e.preventDefault();const name=$('signupName').value.trim(),email=$('signupEmail').value.trim(),department=$('signupDepartment').value,p1=$('signupPassword').value,p2=$('signupPassword2').value;if(p1!==p2){$('signupError').textContent='Passwords do not match.';return}$('signupError').textContent='Creating account...';const {data,error}=await sb.auth.signUp({email,password:p1,options:{data:{full_name:name,department,role:'editor',status:'active'}}});if(error){$('signupError').textContent=error.message;return}let user=data?.session?.user;if(!user){const r=await sb.auth.signInWithPassword({email,password:p1});if(r.error){$('signupError').textContent='Account created, but Supabase email confirmation is enabled. Confirm the email or disable Confirm email in Authentication → Sign In / Providers → Email.';return}user=r.data.user}$('signupError').classList.add('success');$('signupError').textContent='Account created.';await enter(user)};
$('forgotPasswordBtn').onclick=async()=>{const email=$('loginEmail').value.trim();if(!email){$('loginError').textContent='Enter your email first.';return}const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin});$('loginError').textContent=error?error.message:'Password reset email sent.'};
$('logoutBtn').onclick=async()=>{
  if(!confirm('Log out of SAIKO Construction AI?')) return;
  const btn=$('logoutBtn');
  const oldText=btn.textContent;
  btn.disabled=true;
  btn.textContent='Logging out...';
  try{
    const {error}=await sb.auth.signOut();
    if(error) throw error;
    currentUser=null;
    currentProfile=null;
    location.reload();
  }catch(e){
    alert('Logout failed: '+(e.message||e));
    btn.disabled=false;
    btn.textContent=oldText;
  }
};
(async()=>{if(!sb){$('loginError').textContent='Supabase config missing.';return}const {data}=await sb.auth.getSession();if(data.session?.user)await enter(data.session.user)})();

async function q(table,op='select',payload=null){if(!sb)throw new Error('Supabase not configured');let r;if(op==='select')r=await sb.from(table).select(payload||'*');if(op==='insert')r=await sb.from(table).insert(payload).select();if(op==='update')r=await sb.from(table).update(payload.values).eq('id',payload.id).select();if(op==='delete')r=await sb.from(table).delete().eq('id',payload);if(r.error)throw r.error;return r.data||[]}
async function refreshAll(){try{cache.projects=await q('projects');cache.billings=await q('billings');cache.payments=await q('payments');cache.schedule=await q('schedule_items');cache.progress=await q('actual_progress');cache.files=await q('project_files');cache.templates=await q('document_templates');try{cache.boq=await q('boq_items')}catch(_){cache.boq=[];}}catch(e){console.warn(e);toast('Database tables are not ready. Run supabase-setup.sql.')}syncProjectSelects();renderDashboard();}
function syncProjectSelects(){['scheduleProject','progressProject','fileProject','smartProject','bProject'].forEach(id=>{const s=$(id);if(!s)return;const old=s.value;s.innerHTML='<option value="">Select project</option>'+cache.projects.map(p=>`<option value="${p.id}">${esc(p.project_name)}</option>`).join('');if(cache.projects.some(p=>String(p.id)===String(old)))s.value=old;});}
function proj(id){return cache.projects.find(p=>String(p.id)===String(id))}
function plannedForProject(pid,at=new Date()){const items=cache.schedule.filter(x=>String(x.project_id)===String(pid));return items.reduce((sum,x)=>{const w=Number(x.weight||0),s=new Date(x.start_date),e=new Date(x.end_date);let f=0;if(at>=e)f=1;else if(at<=s)f=0;else f=(at-s)/(e-s||1);return sum+w*Math.max(0,Math.min(1,f));},0)}
function actualForProject(pid){const rows=cache.progress.filter(x=>String(x.project_id)===String(pid));if(rows.length)return rows.reduce((s,x)=>s+Number(x.weight||0)*Number(x.actual_percent||0)/100,0);return Number(proj(pid)?.progress||0)}

function renderDashboard(){const active=cache.projects.filter(p=>!['Completed'].includes(p.status));const billed=cache.billings.reduce((s,b)=>s+Number(b.gross_amount||0),0),paid=cache.billings.reduce((s,b)=>s+Number(b.received_amount||0),0);$('kpiGrid').innerHTML=[['Total Projects',cache.projects.length],['Active Projects',active.length],['Total Billed',money(billed)],['Outstanding',money(cache.billings.reduce((s,b)=>s+Number(b.outstanding_amount||0),0))]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');$('dashProjects').innerHTML=active.length?active.map(p=>{const pl=plannedForProject(p.id),ac=actualForProject(p.id),v=ac-pl;return `<tr><td><strong>${esc(p.project_name)}</strong></td><td>${esc(p.status)}</td><td>${pct(ac)}</td><td>${pct(pl)}</td><td class="${v<0?'negative':'positive'}">${pct(v)}</td></tr>`}).join(''):'<tr><td colspan="5" class="empty">No projects yet.</td></tr>';const now=new Date(),soon=new Date(Date.now()+7*864e5);const ag=cache.schedule.filter(x=>new Date(x.end_date)>=now&&new Date(x.start_date)<=soon).sort((a,b)=>new Date(a.start_date)-new Date(b.start_date));$('agendaList').innerHTML=ag.length?ag.slice(0,8).map(a=>`<div class="list-item"><strong>${esc(a.activity)}</strong><div class="muted">${esc(proj(a.project_id)?.project_name||'')} • ${a.start_date} to ${a.end_date}</div></div>`).join(''):'<div class="empty">No scheduled activities for the next 7 days.</div>';$('billingSnapshot').innerHTML=[['Gross Billed',money(billed)],['Received',money(paid)],['Outstanding',money(cache.billings.reduce((s,b)=>s+Number(b.outstanding_amount||0),0))],['Retention Held',money(cache.billings.reduce((s,b)=>s+Number(b.retention_amount||0),0))]].map(x=>`<div><span class="muted">${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}

$('addProjectBtn').onclick=()=>{$('projectForm').reset();$('projectDialog').showModal()};$('projectForm').onsubmit=async e=>{e.preventDefault();const row={project_name:$('pName').value.trim(),client_name:$('pClient').value.trim(),location:$('pLocation').value.trim(),contract_amount:Number($('pContract').value||0),start_date:$('pStart').value||null,target_date:$('pTarget').value||null,status:$('pStatus').value,progress:Number($('pProgress').value||0),created_by:currentUser.id};try{await q('projects','insert',row);$('projectDialog').close();await refreshAll();renderProjects();toast('Project saved.')}catch(e){alert(e.message)}};
function renderProjects(){const rows=cache.projects;$('projectRows').innerHTML=rows.length?rows.map(p=>`<tr><td class="check-col"><input class="project-row-check" type="checkbox" value="${p.id}" ${selectedProjectIds.has(String(p.id))?'checked':''}></td><td><strong>${esc(p.project_name)}</strong></td><td>${esc(p.client_name||'—')}</td><td>${esc(p.location||'—')}</td><td>${money(p.contract_amount)}</td><td>${esc(p.status)}</td><td>${pct(actualForProject(p.id))}</td><td><button class="danger-link" onclick="deleteProject('${p.id}')">Delete</button></td></tr>`).join(''):'<tr><td colspan="8" class="empty">No projects yet.</td></tr>';wireBulkChecks('project-row-check',selectedProjectIds,()=>bulkUI('project',selectedProjectIds,rows));bulkUI('project',selectedProjectIds,rows)}
window.deleteProject=async id=>{const p=cache.projects.find(x=>String(x.id)===String(id));if(!p)return;if(!confirm(`Delete project "${p.project_name}"? Related records may also be deleted.`))return;if(!confirm('Final confirmation: permanently delete this project?'))return;try{await q('projects','delete',id);selectedProjectIds.delete(String(id));await refreshAll();renderProjects();toast('Project deleted.')}catch(e){alert(e.message)}};
async function deleteSelectedProjects(){const rows=cache.projects.filter(p=>selectedProjectIds.has(String(p.id)));if(!rows.length)return;if(!confirm(`Delete ${rows.length} selected project(s)? Related records may also be deleted.`))return;if(!confirm('Final confirmation: permanently delete selected projects?'))return;for(const p of rows){const {error}=await sb.from('projects').delete().eq('id',p.id);if(error)return alert(error.message)}selectedProjectIds.clear();await refreshAll();renderProjects();toast(`${rows.length} project(s) deleted.`)}

function calcBilling(){const gross=Number($('bGross').value||0),ret=gross*Number($('bRetention').value||0)/100,rec=gross*Number($('bRecoup').value||0)/100,net=Math.max(0,gross-ret-rec),received=Number($('bReceived').value||0),out=Math.max(0,net-received);$('billingCalc').innerHTML=[['Retention',money(ret)],['Recoupment',money(rec)],['Net Due',money(net)],['Outstanding',money(out)]].map(x=>`<div>${x[0]}<strong>${x[1]}</strong></div>`).join('');return{gross,ret,rec,net,received,out}}['bGross','bRetention','bRecoup','bReceived'].forEach(id=>$(id).oninput=calcBilling);$('addBillingBtn').onclick=()=>{$('billingForm').reset();$('bRetention').value=5;$('bRecoup').value=30;syncProjectSelects();calcBilling();$('billingDialog').showModal()};$('billingForm').onsubmit=async e=>{e.preventDefault();const c=calcBilling(),row={project_id:$('bProject').value,billing_no:$('bNo').value.trim(),gross_amount:c.gross,retention_percent:Number($('bRetention').value||0),retention_amount:c.ret,recoupment_percent:Number($('bRecoup').value||0),recoupment_amount:c.rec,net_due:c.net,received_amount:c.received,outstanding_amount:c.out,date_submitted:$('bSubmitted').value||null,date_paid:$('bPaidDate').value||null,status:c.out<=.01?'Paid':c.received>0?'Partially Paid':'Pending',created_by:currentUser.id};try{const rows=await q('billings','insert',row);if(c.received>0)await q('payments','insert',{billing_id:rows[0].id,amount:c.received,payment_date:$('bPaidDate').value||new Date().toISOString().slice(0,10),created_by:currentUser.id});$('billingDialog').close();await refreshAll();renderBilling();toast('Billing saved.')}catch(e){alert(e.message)}};
function renderBilling(){const rows=cache.billings,total=rows.reduce((s,b)=>s+Number(b.gross_amount||0),0),paid=rows.reduce((s,b)=>s+Number(b.received_amount||0),0),out=rows.reduce((s,b)=>s+Number(b.outstanding_amount||0),0);$('billingKPIs').innerHTML=[['Gross Billed',money(total)],['Received',money(paid)],['Outstanding',money(out)],['Collection %',total?`${(paid/total*100).toFixed(2)}%`:'0.00%']].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');$('billingRows').innerHTML=rows.length?rows.map(b=>`<tr><td class="check-col"><input class="billing-row-check" type="checkbox" value="${b.id}" ${selectedBillingIds.has(String(b.id))?'checked':''}></td><td>${esc(proj(b.project_id)?.project_name||'—')}</td><td><strong>${esc(b.billing_no)}</strong></td><td>${money(b.gross_amount)}</td><td>${money(b.retention_amount)}</td><td>${money(b.recoupment_amount)}</td><td>${money(b.net_due)}</td><td>${money(b.received_amount)}</td><td>${money(b.outstanding_amount)}</td><td>${esc(b.status)}</td><td><div class="row-actions"><button class="icon-action" onclick="addPayment('${b.id}')">Payment</button><button class="icon-action" onclick="generateBilling('${b.id}')">Download</button><button class="danger-link" onclick="deleteBilling('${b.id}')">Delete</button></div></td></tr>`).join(''):'<tr><td colspan="11" class="empty">No billing records yet.</td></tr>';wireBulkChecks('billing-row-check',selectedBillingIds,()=>bulkUI('billing',selectedBillingIds,rows));bulkUI('billing',selectedBillingIds,rows)}
window.deleteBilling=async id=>{const b=cache.billings.find(x=>String(x.id)===String(id));if(!b)return;if(!confirm(`Delete billing "${b.billing_no}"?`))return;const {error}=await sb.from('billings').delete().eq('id',id);if(error)return alert(error.message);selectedBillingIds.delete(String(id));await refreshAll();renderBilling();toast('Billing deleted.')};
async function deleteSelectedBillings(){const rows=cache.billings.filter(b=>selectedBillingIds.has(String(b.id)));if(!rows.length)return;if(!confirm(`Delete ${rows.length} selected billing record(s)?`))return;for(const b of rows){const {error}=await sb.from('billings').delete().eq('id',b.id);if(error)return alert(error.message)}selectedBillingIds.clear();await refreshAll();renderBilling();toast(`${rows.length} billing record(s) deleted.`)}
window.addPayment=async id=>{const b=cache.billings.find(x=>String(x.id)===String(id));const v=prompt(`Received payment amount for ${b.billing_no}:`);if(v===null)return;const amt=Number(v);if(!amt||amt<=0)return alert('Enter a valid amount.');const newReceived=Number(b.received_amount||0)+amt,newOut=Math.max(0,Number(b.net_due||0)-newReceived);try{await q('payments','insert',{billing_id:id,amount:amt,payment_date:new Date().toISOString().slice(0,10),created_by:currentUser.id});await q('billings','update',{id,values:{received_amount:newReceived,outstanding_amount:newOut,status:newOut<=.01?'Paid':'Partially Paid'}});await refreshAll();renderBilling()}catch(e){alert(e.message)}};
window.generateBilling=async id=>{const b=cache.billings.find(x=>String(x.id)===String(id)),p=proj(b.project_id);let templateUrl=null;const t=cache.templates.find(x=>x.template_type==='Billing Excel');if(t){const {data}=await sb.storage.from('templates').createSignedUrl(t.storage_path,300);templateUrl=data?.signedUrl}const r=await fetch('/api/generate-billing',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({templateUrl,billing:{...b,project_name:p?.project_name,client_name:p?.client_name,location:p?.location,contract_amount:p?.contract_amount}})});if(!r.ok)return alert(await r.text());const blob=await r.blob(),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${p?.project_name||'Project'}_${b.billing_no||'Billing'}.xlsx`;a.click();URL.revokeObjectURL(a.href)};

$('scheduleProject').onchange=renderSchedule;$('progressProject').onchange=renderProgress;$('fileProject').onchange=renderFiles;
$('importScheduleBtn').onclick=async()=>{const pid=$('scheduleProject').value,file=$('scheduleFile').files[0];if(!pid||!file)return alert('Select a project and Excel file.');const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:''});const pick=(o,names)=>{for(const k of Object.keys(o)){if(names.includes(k.toLowerCase().trim()))return o[k]}return''};const parsed=rows.map(r=>({project_id:pid,activity:String(pick(r,['activity','task','description','scope of work','work item'])||'').trim(),start_date:excelDate(pick(r,['start','start date','planned start'])),end_date:excelDate(pick(r,['end','finish','end date','finish date','planned finish'])),weight:Number(pick(r,['weight','weight %','weightage','percentage','%'])||0),created_by:currentUser.id})).filter(r=>r.activity&&r.start_date&&r.end_date);if(!parsed.length)return alert('No rows found. Use columns like Activity, Start Date, End Date, Weight (%).');try{await sb.from('schedule_items').delete().eq('project_id',pid);const {error}=await sb.from('schedule_items').insert(parsed);if(error)throw error;await refreshAll();renderSchedule();toast(`${parsed.length} schedule activities imported.`)}catch(e){alert(e.message)}};
function excelDate(v){if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`}const d=new Date(v);return isNaN(d)?null:d.toISOString().slice(0,10)}
function scheduleData(pid){return cache.schedule.filter(x=>String(x.project_id)===String(pid))}
function renderSchedule(){const pid=$('scheduleProject').value||cache.projects[0]?.id;if(pid&&!$('scheduleProject').value)$('scheduleProject').value=pid;const rows=scheduleData(pid),planned=plannedForProject(pid),actual=actualForProject(pid),variance=actual-planned;$('scheduleSummary').innerHTML=[['Planned Today',pct(planned)],['Actual',pct(actual)],['Variance',pct(variance)],['Status',variance<-2?'Behind Schedule':variance>2?'Ahead':'On Track']].map(x=>`<div class="kpi"><span>${x[0]}</span><strong class="${x[0]==='Variance'?(variance<0?'negative':'positive'):''}">${x[1]}</strong></div>`).join('');$('scheduleRows').innerHTML=rows.length?rows.map(r=>{const today=new Date(),s=new Date(r.start_date),e=new Date(r.end_date);let f=today>=e?100:today<=s?0:Math.max(0,Math.min(100,(today-s)/(e-s||1)*100));const ap=cache.progress.find(x=>String(x.project_id)===String(pid)&&x.activity.toLowerCase()===r.activity.toLowerCase());return `<tr><td class="check-col"><input class="schedule-row-check" type="checkbox" value="${r.id}" ${selectedScheduleIds.has(String(r.id))?'checked':''}></td><td>${esc(r.activity)}</td><td>${r.start_date}</td><td>${r.end_date}</td><td>${pct(r.weight)}</td><td>${pct(f)}</td><td>${pct(ap?.actual_percent||0)}</td><td>${pct(Number(r.weight||0)*Number(ap?.actual_percent||0)/100)}</td><td><button class="danger-link" onclick="deleteScheduleItem('${r.id}')">Delete</button></td></tr>`}).join(''):'<tr><td colspan="9" class="empty">Upload a schedule Excel file.</td></tr>';wireBulkChecks('schedule-row-check',selectedScheduleIds,()=>bulkUI('schedule',selectedScheduleIds,rows));bulkUI('schedule',selectedScheduleIds,rows)}
window.deleteScheduleItem=async id=>{if(!confirm('Delete this schedule activity?'))return;const {error}=await sb.from('schedule_items').delete().eq('id',id);if(error)return alert(error.message);selectedScheduleIds.delete(String(id));await refreshAll();renderSchedule();toast('Schedule activity deleted.')};
async function deleteSelectedSchedule(){const pid=$('scheduleProject').value||cache.projects[0]?.id,rows=scheduleData(pid).filter(r=>selectedScheduleIds.has(String(r.id)));if(!rows.length)return;if(!confirm(`Delete ${rows.length} selected schedule item(s)?`))return;for(const r of rows){const {error}=await sb.from('schedule_items').delete().eq('id',r.id);if(error)return alert(error.message)}selectedScheduleIds.clear();await refreshAll();renderSchedule();toast(`${rows.length} schedule item(s) deleted.`)}

$('addProgressBtn').onclick=()=>{if(!$('progressProject').value)return alert('Select a project.');$('progressForm').reset();$('progressDialog').showModal()};$('progressForm').onsubmit=async e=>{e.preventDefault();const pid=$('progressProject').value,row={project_id:pid,activity:$('aActivity').value.trim(),weight:Number($('aWeight').value||0),actual_percent:Number($('aActual').value||0),updated_by:currentUser.id,updated_at:new Date().toISOString()};try{const old=cache.progress.find(x=>String(x.project_id)===String(pid)&&x.activity.toLowerCase()===row.activity.toLowerCase());if(old)await q('actual_progress','update',{id:old.id,values:row});else await q('actual_progress','insert',row);$('progressDialog').close();await refreshAll();renderProgress();renderSchedule()}catch(e){alert(e.message)}};
function renderProgress(){const pid=$('progressProject').value||cache.projects[0]?.id;if(pid&&!$('progressProject').value)$('progressProject').value=pid;const rows=cache.progress.filter(x=>String(x.project_id)===String(pid)),actual=actualForProject(pid),planned=plannedForProject(pid),variance=actual-planned;$('progressSummary').innerHTML=[['Actual',pct(actual)],['Planned',pct(planned)],['Variance',pct(variance)],['Remaining',pct(Math.max(0,100-actual))]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong class="${x[0]==='Variance'?(variance<0?'negative':'positive'):''}">${x[1]}</strong></div>`).join('');$('progressRows').innerHTML=rows.length?rows.map(r=>`<tr><td class="check-col"><input class="progress-row-check" type="checkbox" value="${r.id}" ${selectedProgressIds.has(String(r.id))?'checked':''}></td><td>${esc(r.activity)}</td><td>${pct(r.weight)}</td><td>${pct(r.actual_percent)}</td><td>${pct(Number(r.weight||0)*Number(r.actual_percent||0)/100)}</td><td>${new Date(r.updated_at).toLocaleString()}</td><td><button class="danger-link" onclick="deleteProgress('${r.id}')">Delete</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty">No actual progress entries yet.</td></tr>';wireBulkChecks('progress-row-check',selectedProgressIds,()=>bulkUI('progress',selectedProgressIds,rows));bulkUI('progress',selectedProgressIds,rows)}
window.deleteProgress=async id=>{if(!confirm('Delete this actual progress entry?'))return;await q('actual_progress','delete',id);selectedProgressIds.delete(String(id));await refreshAll();renderProgress()};
async function deleteSelectedProgress(){const pid=$('progressProject').value||cache.projects[0]?.id,rows=cache.progress.filter(x=>String(x.project_id)===String(pid)&&selectedProgressIds.has(String(x.id)));if(!rows.length)return;if(!confirm(`Delete ${rows.length} selected progress item(s)?`))return;for(const r of rows){const {error}=await sb.from('actual_progress').delete().eq('id',r.id);if(error)return alert(error.message)}selectedProgressIds.clear();await refreshAll();renderProgress();toast(`${rows.length} progress item(s) deleted.`)}

// SMART PROJECT FILE IMPORT ADD-ON — MULTI-MODULE + AUTO PROJECT MATCH
function detectFileType(file){
  const n=file.name.toLowerCase(), ext=n.split('.').pop();
  if(/\b(boq|bill.?of.?quant|quantity|cost.?estimate|estimate)\b/.test(n)) return 'BOQ';
  if(/\b(schedule|program|timeline|gantt|look.?ahead)\b/.test(n)) return 'Schedule';
  if(/\b(billing|progress.?billing|statement.?of.?account)\b/.test(n)) return 'Billing';
  if(/\b(contract|agreement|subcontract)\b/.test(n)) return 'Contracts';
  if(/\b(vo|variation|change.?order|eot|extension)\b/.test(n)) return 'VO & EOT';
  if(/\b(quotation|quote|proposal)\b/.test(n)) return 'Quotations';
  if(/\b(progress|accomplishment|weekly|daily.?report)\b/.test(n)) return 'Progress Reports';
  if(['dwg','dxf'].includes(ext)) return 'Plans';
  if(['jpg','jpeg','png','webp'].includes(ext)) return 'Photos';
  if(['pdf'].includes(ext) && /\b(plan|drawing|layout|architect|structural|electrical|plumbing|mechanical)\b/.test(n)) return 'Plans';
  if(['doc','docx'].includes(ext)) return 'Other';
  if(['xlsx','xls','csv'].includes(ext)) return 'Spreadsheet';
  return 'Other';
}
function categoryForModules(mods){
  if(mods.includes('Billing'))return 'Billings'; if(mods.includes('Schedule'))return 'Schedules'; if(mods.includes('VO & EOT'))return 'VO & EOT';
  if(mods.includes('Contracts'))return 'Contracts'; if(mods.includes('Plans'))return 'Plans'; if(mods.includes('Photos'))return 'Photos';
  if(mods.includes('Progress Reports'))return 'Progress Reports'; if(mods.includes('Quotations'))return 'Quotations'; return 'Other';
}
async function workbookSheets(file){
  const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:'array',cellDates:true});
  const sheets=wb.SheetNames.map(name=>{const ws=wb.Sheets[name];return {name,rows:XLSX.utils.sheet_to_json(ws,{defval:'',raw:false}),matrix:XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false})}});
  return {wb,sheets};
}
function normKey(k){return String(k||'').toLowerCase().replace(/[^a-z0-9%]+/g,' ').trim()}
function valFrom(row,names){const keys=Object.keys(row);for(const n of names){const target=normKey(n);const key=keys.find(k=>normKey(k)===target||normKey(k).includes(target));if(key!=null&&row[key]!==''&&row[key]!=null)return row[key]}return ''}
function parseNum(v){if(typeof v==='number')return v;const n=Number(String(v??'').replace(/[^0-9.\-]/g,''));return Number.isFinite(n)?n:0}
function inspectSheet(sheet){
  const rows=sheet.rows||[], matrix=sheet.matrix||[], name=sheet.name.toLowerCase();
  const ks=rows.length?Object.keys(rows[0]).map(normKey).join(' | '):'';
  const txt=(name+' '+matrix.slice(0,80).flat().join(' ')).toLowerCase(); const hits=[];
  if((/description|scope|work item/.test(ks)&&/qty|quantity/.test(ks)&&/unit/.test(ks)) || /\bboq\b|bill of quantities/.test(txt)) hits.push('BOQ');
  if((/activity|task|description/.test(ks)&&/start/.test(ks)&&/end|finish/.test(ks)) || /gantt|schedule|program of work|look ahead/.test(txt)) hits.push('Schedule');
  if(/billing|gross|retention|recoup|received|amount/.test(ks+' '+txt)) hits.push('Billing');
  if(/variation order|change order|\bvo\b|additional works|deductive|additive/.test(txt)) hits.push('VO & EOT');
  if(/contract|agreement|subcontract/.test(txt)) hits.push('Contracts');
  if(/progress report|accomplishment|weekly report|daily report/.test(txt)) hits.push('Progress Reports');
  return [...new Set(hits)];
}
function scanBillingMatrix(matrix){let flat=[];for(const r of matrix.slice(0,140)){for(let i=0;i<r.length;i++){const label=String(r[i]??'').trim();if(!label)continue;const next=r.slice(i+1,i+6).find(v=>v!==''&&v!=null);flat.push([label,next]);}}const find=re=>{const x=flat.find(([k])=>re.test(String(k).toLowerCase()));return x?x[1]:''};return {billingNo:String(find(/billing\s*(no|number)/)||'').trim(),gross:parseNum(find(/total billing this date|gross billing|billing amount|amount due|total amount/)),retention:parseNum(find(/retention.*%|retention rate/)),recoup:parseNum(find(/recoup.*%|recoupment rate/)),received:parseNum(find(/received payment|amount received|paid amount/))}}
function scanVOMatrix(matrix){let flat=matrix.slice(0,160).flat().map(x=>String(x??'').trim()).filter(Boolean);const text=flat.join(' | ');const no=(text.match(/(?:variation order|vo|change order)\s*(?:no\.?|#)?\s*[:\-]?\s*([A-Z0-9\-]+)/i)||[])[1]||'';const amtMatches=[...text.matchAll(/(?:amount|additional amount|variation amount|approved amount)\s*[:\-]?\s*(?:php|₱)?\s*([0-9,]+(?:\.\d+)?)/ig)];return {vo_no:no,amount:amtMatches.length?parseNum(amtMatches[0][1]):0,description:flat.find(x=>/variation|additional|change order/i.test(x))||''}}
function searchableWorkbook(parsed,file){return (file.name+' '+parsed.sheets.map(s=>s.name+' '+s.matrix.slice(0,80).flat().join(' ')).join(' ')).toLowerCase()}
function scoreProject(p,text){let score=0;const vals=[p.project_name,p.client_name,p.location].filter(Boolean).map(v=>String(v).toLowerCase());for(const v of vals){const parts=v.split(/[^a-z0-9]+/).filter(x=>x.length>2);if(text.includes(v))score+=8;for(const part of parts)if(text.includes(part))score+=1;}return score}
function detectProjectFromText(text){let best=null,bestScore=0;for(const p of cache.projects){const s=scoreProject(p,text);if(s>bestScore){best=p;bestScore=s}}return bestScore>=2?{project:best,score:bestScore}:{project:null,score:bestScore}}
function modulesDetail(item){return item.modules.map(m=>{const c=item.moduleData?.[m]?.count;return c?`${m} (${c})`:m}).join(' • ')||item.primaryType}
function renderSmartFiles(){const body=$('smartFileRows');if(!body)return;if(!smartImportItems.length){body.innerHTML='<tr><td colspan="5" class="empty">Choose one or more existing project files. Scanning starts automatically.</td></tr>';return}body.innerHTML=smartImportItems.map((x,i)=>`<tr><td><div class="smart-file-meta"><strong>${esc(x.file.name)}</strong><small>${(x.file.size/1024/1024).toFixed(2)} MB</small></div></td><td>${x.project?`<strong>${esc(x.project.project_name)}</strong><br><small>auto matched</small>`:'<span class="scan-warn">Needs project confirmation</span>'}</td><td>${x.modules.map(m=>`<span class="smart-badge">${esc(m)}</span>`).join(' ')||esc(x.primaryType)}</td><td><span class="${x.ready?'scan-ok':'scan-warn'}">${esc(x.detail||'File will be stored')}</span></td><td><button class="icon-action" onclick="removeSmartFile(${i})">Remove</button></td></tr>`).join('');$('processFilesBtn').disabled=!smartImportItems.length}
window.removeSmartFile=i=>{smartImportItems.splice(i,1);renderSmartFiles()};
async function checkStorage(){try{const r=await sb.storage.from('project-files').list('',{limit:1});$('storageStatus').textContent=r.error?'Storage not ready: '+r.error.message:'Storage ready: original files will be saved in Supabase.';$('storageStatus').className='form-msg '+(r.error?'scan-warn':'scan-ok')}catch(e){$('storageStatus').textContent='Storage check failed: '+e.message}}
async function scanSmartFiles(){
  const files=[...$('smartFiles').files]; if(!files.length){smartImportItems=[];renderSmartFiles();$('smartUploadStatus').textContent='Choose one or more project files.';return}
  smartImportItems=[];$('smartUploadStatus').textContent='Scanning every sheet and matching projects…';$('processFilesBtn').disabled=true;
  for(const file of files){let primaryType=detectFileType(file),modules=[],moduleData={},parsed=null,detail='Ready to store in Project Files',ready=true,project=null;
    const ext=file.name.toLowerCase().split('.').pop();
    if(['xlsx','xls','csv'].includes(ext))try{parsed=await workbookSheets(file);for(const sh of parsed.sheets){const hits=inspectSheet(sh);for(const m of hits){if(!modules.includes(m))modules.push(m);(moduleData[m]??={sheets:[],rows:[],count:0}).sheets.push(sh.name);moduleData[m].rows.push(...sh.rows);moduleData[m].count+=sh.rows.length;if(m==='Billing'){const b=scanBillingMatrix(sh.matrix);moduleData[m].billing={...(moduleData[m].billing||{}),...Object.fromEntries(Object.entries(b).filter(([,v])=>v))}}if(m==='VO & EOT'){const v=scanVOMatrix(sh.matrix);moduleData[m].vo={...(moduleData[m].vo||{}),...Object.fromEntries(Object.entries(v).filter(([,val])=>val))}}}}
      const match=detectProjectFromText(searchableWorkbook(parsed,file));project=match.project;detail=(modules.length?`Detected ${modulesDetail({modules,moduleData,primaryType})}`:'Spreadsheet detected')+(project?` • Project: ${project.project_name}`:' • Project not confidently matched');
    }catch(e){ready=false;detail='Spreadsheet parsing failed; original file can still be stored.'}
    if(!modules.length&&primaryType!=='Spreadsheet'&&primaryType!=='Other')modules=[primaryType];
    if(!project){const match=detectProjectFromText(file.name.toLowerCase());project=match.project}
    smartImportItems.push({file,primaryType,modules,moduleData,parsed,detail,ready,project});
  }
  const uniqueProjects=[...new Set(smartImportItems.map(x=>x.project?.id).filter(Boolean))];if(uniqueProjects.length===1)$('smartProject').value=uniqueProjects[0];
  renderSmartFiles();$('smartUploadStatus').textContent=`${smartImportItems.length} file(s) scanned. One file may feed multiple modules. Confirm the suggested project, then Upload & Import.`;
}
$('scanFilesBtn').onclick=scanSmartFiles;$('smartFiles').addEventListener('change',scanSmartFiles);
async function uploadSmartFile(pid,item){const file=item.file,path=`${pid}/${Date.now()}-${Math.random().toString(36).slice(2,7)}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const up=await sb.storage.from('project-files').upload(path,file,{upsert:false});if(up.error)throw new Error('File storage failed: '+up.error.message);const row={project_id:pid,category:categoryForModules(item.modules),file_name:file.name,storage_path:path,uploaded_by:currentProfile?.full_name||currentUser.email,created_by:currentUser.id};if('detected_modules' in (cache.files[0]||{}))row.detected_modules=item.modules.join(', ');const saved=await q('project_files','insert',row);return saved[0]||{storage_path:path,file_name:file.name,project_id:pid}}
async function importBoqRows(pid,rows,file,fileId){const mapped=rows.map((r,idx)=>({project_id:pid,item_no:String(valFrom(r,['item no','item','no.','no'])||idx+1),description:String(valFrom(r,['description','description of work','scope of work','work item'])||'').trim(),unit:String(valFrom(r,['unit','uom'])||'').trim(),quantity:parseNum(valFrom(r,['qty','quantity'])),unit_cost:parseNum(valFrom(r,['unit cost','unit price','rate','price'])),amount:parseNum(valFrom(r,['amount','total','total cost'])),source_file:file.name,source_file_id:fileId||null,created_by:currentUser.id})).filter(x=>x.description);if(!mapped.length)return 0;const {error}=await sb.from('boq_items').insert(mapped);if(error)throw error;return mapped.length}
async function importScheduleRows(pid,rows,file,fileId){const mapped=rows.map(r=>({project_id:pid,activity:String(valFrom(r,['activity','task','description','scope of work','work item'])||'').trim(),start_date:excelDate(valFrom(r,['start date','start','planned start'])),end_date:excelDate(valFrom(r,['end date','finish date','finish','planned finish'])),weight:parseNum(valFrom(r,['weight %','weight','weightage','percentage','%'])),source_file:file?.name||null,source_file_id:fileId||null,created_by:currentUser.id})).filter(x=>x.activity&&x.start_date&&x.end_date);if(!mapped.length)return 0;const {error}=await sb.from('schedule_items').insert(mapped);if(error)throw error;return mapped.length}
async function importBillingData(pid,b,file,fileId){if(!b||(!b.gross&&!b.billingNo))return 0;const retention=b.retention||0,recoup=b.recoup||0,gross=b.gross||0,retAmt=gross*retention/100,recAmt=gross*recoup/100,net=Math.max(0,gross-retAmt-recAmt),received=b.received||0,out=Math.max(0,net-received),status=out<=0&&net>0?'Paid':received>0?'Partially Paid':'Pending';await q('billings','insert',{project_id:pid,billing_no:b.billingNo||`Imported Billing ${new Date().toLocaleDateString()}`,gross_amount:gross,retention_percent:retention,retention_amount:retAmt,recoupment_percent:recoup,recoupment_amount:recAmt,net_due:net,received_amount:received,outstanding_amount:out,status,source_file:file?.name||null,source_file_id:fileId||null,created_by:currentUser.id});return 1}
async function importVOData(pid,v,file,fileId){if(!v||(!v.vo_no&&!v.amount&&!v.description))return 0;const {error}=await sb.from('variation_orders').insert({project_id:pid,vo_no:v.vo_no||`Imported VO ${new Date().toLocaleDateString()}`,description:v.description||file.name,amount:v.amount||0,status:'Imported',source_file:file.name,source_file_id:fileId||null,created_by:currentUser.id});if(error)throw error;return 1}
$('processFilesBtn').onclick=async()=>{if(!smartImportItems.length)return;let uploaded=0,boq=0,sched=0,bill=0,vo=0;$('processFilesBtn').disabled=true;$('smartUploadStatus').textContent='Saving original files and importing detected modules…';try{for(const item of smartImportItems){const pid=item.project?.id||$('smartProject').value;if(!pid)throw new Error(`No project matched for ${item.file.name}. Select a Fallback Project first.`);const savedFile=await uploadSmartFile(pid,item),fileId=savedFile.id;uploaded++;if(item.modules.includes('BOQ'))boq+=await importBoqRows(pid,item.moduleData.BOQ?.rows||[],item.file,fileId);if(item.modules.includes('Schedule'))sched+=await importScheduleRows(pid,item.moduleData.Schedule?.rows||[],item.file,fileId);if(item.modules.includes('Billing'))bill+=await importBillingData(pid,item.moduleData.Billing?.billing||{},item.file,fileId);if(item.modules.includes('VO & EOT'))vo+=await importVOData(pid,item.moduleData['VO & EOT']?.vo||{},item.file,fileId)}await refreshAll();renderFiles();renderSchedule();renderBilling();$('smartUploadStatus').textContent=`Done: ${uploaded} original file(s) stored${boq?`, ${boq} BOQ item(s)`:''}${sched?`, ${sched} schedule row(s)`:''}${bill?`, ${bill} billing record(s)`:''}${vo?`, ${vo} VO record(s)`:''}.`;smartImportItems=[];$('smartFiles').value='';renderSmartFiles();await checkStorage();toast('Smart import complete.')}catch(e){console.error(e);$('smartUploadStatus').textContent='Import stopped: '+e.message;alert(e.message)}finally{$('processFilesBtn').disabled=!smartImportItems.length}};
$('uploadFileBtn').onclick=async()=>{const pid=$('fileProject').value,file=$('projectFile').files[0],cat=$('fileCategory').value;if(!pid||!file)return alert('Select project and file.');const path=`${pid}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error}=await sb.storage.from('project-files').upload(path,file);if(error)return alert(error.message);await q('project_files','insert',{project_id:pid,category:cat,file_name:file.name,storage_path:path,uploaded_by:currentProfile.full_name||currentUser.email,created_by:currentUser.id});await refreshAll();renderFiles();toast('File uploaded.')};
function visibleProjectFiles(){const pid=$('fileProject').value;return pid?cache.files.filter(x=>String(x.project_id)===String(pid)):cache.files}
function renderFiles(){const rows=visibleProjectFiles();$('fileRows').innerHTML=rows.length?rows.map(f=>`<tr><td class="check-col"><input class="file-row-check" type="checkbox" value="${f.id}" ${selectedFileIds.has(String(f.id))?'checked':''}></td><td>${esc(proj(f.project_id)?.project_name||'—')}</td><td>${esc(f.category)}</td><td>${esc(f.file_name)}</td><td>${esc(f.uploaded_by||'—')}</td><td>${new Date(f.created_at).toLocaleString()}</td><td><div class="row-actions"><button class="icon-action" onclick="downloadFile('${f.storage_path}','${encodeURIComponent(f.file_name)}')">Download</button><button class="danger-link" onclick="deleteProjectFile('${f.id}')">Delete</button></div></td></tr>`).join(''):'<tr><td colspan="7" class="empty">No project files uploaded.</td></tr>';wireBulkChecks('file-row-check',selectedFileIds,()=>bulkUI('file',selectedFileIds,rows));bulkUI('file',selectedFileIds,rows)}
window.downloadFile=async(path,name)=>{const {data,error}=await sb.storage.from('project-files').createSignedUrl(path,300);if(error)return alert(error.message);const a=document.createElement('a');a.href=data.signedUrl;a.download=decodeURIComponent(name);a.target='_blank';a.click()};
async function deleteImportedForProjectFile(f){const tables=['boq_items','schedule_items','billings','variation_orders','actual_progress'];for(const table of tables){const r=await sb.from(table).delete().eq('source_file_id',f.id);if(r.error&&!/column .*source_file_id.* does not exist/i.test(r.error.message))throw r.error}}
async function removeProjectFileRecord(f,deleteImported){if(deleteImported)await deleteImportedForProjectFile(f);const rm=await sb.storage.from('project-files').remove([f.storage_path]);if(rm.error)throw rm.error;const del=await sb.from('project_files').delete().eq('id',f.id);if(del.error)throw del.error}
window.deleteProjectFile=async id=>{const f=cache.files.find(x=>String(x.id)===String(id));if(!f)return alert('File record not found.');if(!confirm(`Delete "${f.file_name}" from Project Files?`))return;const deleteImported=confirm('Also delete data imported from this file?\n\nOK = delete file + linked imported data\nCancel = delete stored file only');try{await removeProjectFileRecord(f,deleteImported);selectedFileIds.delete(String(f.id));await refreshAll();renderFiles();renderSchedule();renderBilling();renderProgress();toast(deleteImported?'File and linked imported data deleted.':'File deleted. Imported project data was kept.')}catch(e){alert('Delete failed: '+e.message)}};
async function deleteSelectedFiles(){const rows=visibleProjectFiles().filter(f=>selectedFileIds.has(String(f.id)));if(!rows.length)return;if(!confirm(`Delete ${rows.length} selected file(s)?`))return;const deleteImported=confirm('Also delete data imported from ALL selected files?\n\nOK = files + linked imported data\nCancel = stored files only');for(const f of rows){try{await removeProjectFileRecord(f,deleteImported)}catch(e){return alert(`Delete failed for ${f.file_name}: ${e.message}`)}}selectedFileIds.clear();await refreshAll();renderFiles();renderSchedule();renderBilling();renderProgress();toast(`${rows.length} file(s) deleted.`)}

$('uploadTemplateBtn').onclick=async()=>{const file=$('templateFile').files[0],type=$('templateType').value;if(!file)return alert('Choose a template file.');const path=`${type.replace(/\W+/g,'_')}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error}=await sb.storage.from('templates').upload(path,file);if(error)return alert(error.message);await q('document_templates','insert',{template_type:type,template_name:file.name,storage_path:path,created_by:currentUser.id});await refreshAll();renderTemplates();toast('Template saved.')};
let selectedProjectIds=new Set(),selectedBillingIds=new Set(),selectedScheduleIds=new Set(),selectedProgressIds=new Set(),selectedFileIds=new Set();
function bulkUI(prefix,set,rows){const cap=prefix.charAt(0).toUpperCase()+prefix.slice(1),all=$(prefix+'SelectAll'),count=$(prefix+'SelectedCount'),del=$('deleteSelected'+cap+'Btn');if(!all||!count||!del)return;const ids=rows.map(r=>String(r.id)),n=ids.filter(id=>set.has(id)).length;all.checked=ids.length>0&&n===ids.length;all.indeterminate=n>0&&n<ids.length;count.textContent=`${n} selected`;del.disabled=n===0}
function wireBulkChecks(cls,set,cb){document.querySelectorAll('.'+cls).forEach(x=>x.onchange=()=>{x.checked?set.add(x.value):set.delete(x.value);cb()})}
let selectedTemplateIds=new Set();
function updateTemplateBulkUI(){
  const all=$('templateSelectAll'),count=$('templateSelectedCount'),del=$('deleteSelectedTemplatesBtn');
  if(!all||!count||!del)return;
  const visibleIds=cache.templates.map(t=>String(t.id));
  const selectedVisible=visibleIds.filter(id=>selectedTemplateIds.has(id)).length;
  all.checked=visibleIds.length>0&&selectedVisible===visibleIds.length;
  all.indeterminate=selectedVisible>0&&selectedVisible<visibleIds.length;
  count.textContent=`${selectedVisible} selected`;
  del.disabled=selectedVisible===0;
}
function renderTemplates(){
  $('templateRows').innerHTML=cache.templates.length
    ?cache.templates.map(t=>`<tr>
      <td class="check-col"><input class="template-row-check" type="checkbox" value="${esc(String(t.id))}" ${selectedTemplateIds.has(String(t.id))?'checked':''}></td>
      <td>${esc(t.template_type)}</td>
      <td>${esc(t.template_name)}</td>
      <td>${new Date(t.created_at).toLocaleString()}</td>
      <td class="row-actions">
        <button class="icon-action" onclick="downloadTemplate('${t.storage_path}','${encodeURIComponent(t.template_name)}')">Download</button>
        <button class="danger-link" onclick="deleteTemplate('${String(t.id)}')">Delete</button>
      </td>
    </tr>`).join('')
    :'<tr><td colspan="5" class="empty">No templates uploaded yet. The package includes your Melendres billing as the default server template.</td></tr>';

  document.querySelectorAll('.template-row-check').forEach(cb=>{
    cb.onchange=()=>{
      cb.checked?selectedTemplateIds.add(cb.value):selectedTemplateIds.delete(cb.value);
      updateTemplateBulkUI();
    };
  });
  updateTemplateBulkUI();
}
window.downloadTemplate=async(path,name)=>{
  const {data,error}=await sb.storage.from('templates').createSignedUrl(path,300);
  if(error)return alert(error.message);
  window.open(data.signedUrl,'_blank');
};
async function removeTemplateRecord(t){
  if(t.storage_path){
    const {error:storageError}=await sb.storage.from('templates').remove([t.storage_path]);
    if(storageError && !/not found/i.test(storageError.message||'')) throw storageError;
  }
  const {error}=await sb.from('document_templates').delete().eq('id',t.id);
  if(error) throw error;
}
window.deleteTemplate=async id=>{
  const t=cache.templates.find(x=>String(x.id)===String(id));
  if(!t)return;
  if(!confirm(`Delete template "${t.template_name}" permanently?\n\nThis removes both the database record and stored file.`))return;
  try{
    await removeTemplateRecord(t);
    selectedTemplateIds.delete(String(t.id));
    await refreshAll();
    renderTemplates();
    toast('Template deleted.');
  }catch(e){alert(e.message||String(e))}
};
async function deleteSelectedTemplates(){
  const items=cache.templates.filter(t=>selectedTemplateIds.has(String(t.id)));
  if(!items.length)return;
  if(!confirm(`Delete ${items.length} selected template${items.length===1?'':'s'} permanently?\n\nThis will remove the selected database records and stored files.`))return;
  const failed=[];
  for(const t of items){
    try{await removeTemplateRecord(t)}
    catch(e){failed.push(`${t.template_name}: ${e.message||e}`)}
  }
  selectedTemplateIds.clear();
  await refreshAll();
  renderTemplates();
  if(failed.length) alert(`Some templates could not be deleted:\n\n${failed.join('\n')}`);
  else toast(`${items.length} template${items.length===1?'':'s'} deleted.`);
}


$('aiForm').onsubmit=async e=>{e.preventDefault();const msg=$('aiInput').value.trim();if(!msg)return;$('aiInput').value='';$('aiMessages').insertAdjacentHTML('beforeend',`<div class="user-msg">${esc(msg)}</div>`);const ctx={projects:cache.projects.map(p=>({name:p.project_name,status:p.status,actual:actualForProject(p.id),planned:plannedForProject(p.id)})),billings:cache.billings.map(b=>({project:proj(b.project_id)?.project_name,billing:b.billing_no,gross:b.gross_amount,received:b.received_amount,outstanding:b.outstanding_amount,status:b.status})),agenda:cache.schedule.filter(x=>new Date(x.end_date)>=new Date()).slice(0,20)};const loading=document.createElement('div');loading.className='bot';loading.textContent='Thinking...';$('aiMessages').appendChild(loading);$('aiMessages').scrollTop=$('aiMessages').scrollHeight;try{const r=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:msg,context:ctx})});const j=await r.json();loading.textContent=j.answer||j.error||'AI is not configured yet.';}catch(err){loading.textContent='AI endpoint is unavailable. Add OPENAI_API_KEY in Vercel Environment Variables.'}$('aiMessages').scrollTop=$('aiMessages').scrollHeight};

async function renderUsers(){if(currentProfile?.role!=='admin')return;const {data,error}=await sb.from(PROFILE_TABLE).select('*').order('created_at');if(error){$('userRows').innerHTML=`<tr><td colspan="6">${esc(error.message)}</td></tr>`;return}$('userRows').innerHTML=data.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.email)}</td><td>${esc(u.department)}</td><td><select onchange="changeRole('${u.id}',this.value)"><option ${u.role==='editor'?'selected':''}>editor</option><option ${u.role==='qs'?'selected':''}>qs</option><option ${u.role==='engineer'?'selected':''}>engineer</option><option ${u.role==='accounting'?'selected':''}>accounting</option><option ${u.role==='procurement'?'selected':''}>procurement</option><option ${u.role==='admin'?'selected':''}>admin</option></select></td><td class="status-${u.status}">${u.status}</td><td><button class="icon-action" onclick="toggleUser('${u.id}','${u.status==='active'?'inactive':'active'}')">${u.status==='active'?'Deactivate':'Reactivate'}</button></td></tr>`).join('')}window.changeRole=async(id,role)=>{const {error}=await sb.from(PROFILE_TABLE).update({role}).eq('id',id);if(error)alert(error.message)};window.toggleUser=async(id,status)=>{const {error}=await sb.from(PROFILE_TABLE).update({status}).eq('id',id);if(error)alert(error.message);else renderUsers()};

$('globalSearch').oninput=e=>{const q=e.target.value.toLowerCase();if(!q)return;const p=cache.projects.find(x=>`${x.project_name} ${x.client_name} ${x.location}`.toLowerCase().includes(q));if(p){show('projects')}};


if($('templateSelectAll')) $('templateSelectAll').onchange=e=>{
  if(e.target.checked) cache.templates.forEach(t=>selectedTemplateIds.add(String(t.id)));
  else selectedTemplateIds.clear();
  renderTemplates();
};
if($('deleteSelectedTemplatesBtn')) $('deleteSelectedTemplatesBtn').onclick=deleteSelectedTemplates;
if($('clearTemplateSelectionBtn')) $('clearTemplateSelectionBtn').onclick=()=>{
  selectedTemplateIds.clear();
  renderTemplates();
};


function bindBulk(prefix,set,getRows,deleteFn,renderFn){const cap=prefix.charAt(0).toUpperCase()+prefix.slice(1),all=$(prefix+'SelectAll'),del=$('deleteSelected'+cap+'Btn'),clear=$('clear'+cap+'SelectionBtn');if(all)all.onchange=e=>{if(e.target.checked)getRows().forEach(r=>set.add(String(r.id)));else set.clear();renderFn()};if(del)del.onclick=deleteFn;if(clear)clear.onclick=()=>{set.clear();renderFn()}}
bindBulk('project',selectedProjectIds,()=>cache.projects,deleteSelectedProjects,renderProjects);
bindBulk('billing',selectedBillingIds,()=>cache.billings,deleteSelectedBillings,renderBilling);
bindBulk('schedule',selectedScheduleIds,()=>scheduleData($('scheduleProject').value||cache.projects[0]?.id),deleteSelectedSchedule,renderSchedule);
bindBulk('progress',selectedProgressIds,()=>cache.progress.filter(x=>String(x.project_id)===String($('progressProject').value||cache.projects[0]?.id)),deleteSelectedProgress,renderProgress);
bindBulk('file',selectedFileIds,visibleProjectFiles,deleteSelectedFiles,renderFiles);
