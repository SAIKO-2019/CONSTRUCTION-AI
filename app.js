const cfg=window.SAIKO_CONFIG||{};
const configReady=cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_URL.includes('PASTE_') && !cfg.SUPABASE_PUBLISHABLE_KEY.includes('PASTE_');
const sb=(configReady && window.supabase && typeof window.supabase.createClient==='function')?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY):null;
const PROFILE_TABLE='SAIKO BUILDERS';
const loginGate=document.getElementById('loginGate');
const loginForm=document.getElementById('loginForm');
const signupForm=document.getElementById('signupForm');
const loginError=document.getElementById('loginError');
const signupError=document.getElementById('signupError');
const logoutBtn=document.getElementById('logoutBtn');
let currentProfile=null;

function setAuthPane(mode){
  const login=mode==='login';
  document.getElementById('loginPane').classList.toggle('auth-pane-hidden',!login);
  document.getElementById('signupPane').classList.toggle('auth-pane-hidden',login);
  document.getElementById('showLoginBtn').classList.toggle('active',login);
  document.getElementById('showSignupBtn').classList.toggle('active',!login);
  loginError.textContent=''; signupError.textContent='';
}
document.getElementById('showLoginBtn').addEventListener('click',()=>setAuthPane('login'));
document.getElementById('showSignupBtn').addEventListener('click',()=>setAuthPane('signup'));

function profileRoleLabel(role){
  const map={admin:'Administrator',qs:'Quantity Surveyor',accounting:'Accounting',engineer:'Engineer',procurement:'Procurement',viewer:'Viewer'};
  return map[(role||'viewer').toLowerCase()]||role||'Viewer';
}
function setUserUI(user,profile){
  const name=profile?.full_name||user?.user_metadata?.full_name||user?.email||'Signed in user';
  const role=profileRoleLabel(profile?.role||user?.user_metadata?.role||'viewer');
  const initial=(name[0]||'U').toUpperCase();
  document.getElementById('sidebarAvatar').textContent=initial;
  document.getElementById('sidebarName').textContent=name;
  document.getElementById('sidebarRole').textContent=role;
  document.querySelector('.mini-avatar').textContent=initial;
  document.querySelectorAll('.admin-only').forEach(el=>el.style.display=(profile?.role==='admin'?'':'none'));
}
async function getProfile(user){
  if(!sb||!user) return null;
  const {data,error}=await sb.from(PROFILE_TABLE).select('*').eq('user_id',user.id).maybeSingle();
  if(error){ console.warn('Profile lookup:',error.message); return null; }
  return data;
}
async function ensureProfile(user){
  if(!sb||!user) return null;
  let profile=await getProfile(user);
  if(profile) return profile;
  const meta=user.user_metadata||{};
  const record={user_id:user.id,full_name:meta.full_name||user.email?.split('@')[0]||'User',email:user.email||'',role:meta.role||'viewer',department:meta.department||'Other',status:'active'};
  const {data,error}=await sb.from(PROFILE_TABLE).insert(record).select().maybeSingle();
  if(error){ console.warn('Profile create:',error.message); return record; }
  return data||record;
}
async function authorizeSession(user){
  currentProfile=await ensureProfile(user);
  if(currentProfile?.status && currentProfile.status!=='active'){
    await sb.auth.signOut();
    loginGate.classList.remove('hidden');
    loginError.textContent='This account is currently inactive. Please contact your administrator.';
    return false;
  }
  setUserUI(user,currentProfile);
  loginGate.classList.add('hidden');
  if(currentProfile?.role==='admin') loadUsers();
  return true;
}
async function bootstrapAuth(){
  if(!configReady){ loginError.textContent='Setup needed: Supabase configuration is missing in config.js.'; return; }
  const {data}=await sb.auth.getSession();
  const user=data?.session?.user;
  if(user) await authorizeSession(user); else loginGate.classList.remove('hidden');
}
loginForm.addEventListener('submit',async e=>{
  e.preventDefault(); loginError.textContent='Signing in...';
  if(!sb){ loginError.textContent='Supabase is not configured yet.'; return; }
  const email=document.getElementById('loginEmail').value.trim();
  const password=document.getElementById('loginPassword').value;
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){ loginError.textContent=error.message; return; }
  loginError.textContent=''; await authorizeSession(data.user);
});
signupForm.addEventListener('submit',async e=>{
  e.preventDefault();
  signupError.classList.remove('success-msg');
  signupError.textContent='Creating account...';
  if(!sb){ signupError.textContent='Supabase is not configured yet.'; return; }
  const full_name=document.getElementById('signupName').value.trim();
  const email=document.getElementById('signupEmail').value.trim();
  const department=document.getElementById('signupDepartment').value;
  const password=document.getElementById('signupPassword').value;
  const password2=document.getElementById('signupPassword2').value;
  if(!full_name||!email||!department||!password){ signupError.textContent='Please complete all required fields.'; return; }
  if(password.length<6){ signupError.textContent='Password must be at least 6 characters.'; return; }
  if(password!==password2){ signupError.textContent='Passwords do not match.'; return; }

  const submitBtn=signupForm.querySelector('button[type="submit"]');
  if(submitBtn){ submitBtn.disabled=true; submitBtn.textContent='Creating account...'; }
  try{
    const {data,error}=await sb.auth.signUp({
      email,
      password,
      options:{data:{full_name,department,role:'viewer',status:'active'}}
    });
    if(error){ signupError.textContent=error.message; return; }

    signupError.classList.add('success-msg');
    if(data?.session?.user){
      signupError.textContent='Account created successfully. Signing you in...';
      await authorizeSession(data.session.user);
    }else{
      signupError.textContent='Account created. Check your email for the confirmation link, then sign in.';
    }
  }catch(err){
    signupError.textContent=err?.message||'Unable to create account. Please try again.';
  }finally{
    if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent='Create account'; }
  }
});
document.getElementById('forgotPasswordBtn').addEventListener('click',async()=>{
  if(!sb){ loginError.textContent='Supabase is not configured yet.'; return; }
  const email=document.getElementById('loginEmail').value.trim();
  if(!email){ loginError.textContent='Enter your email first, then click Forgot password.'; return; }
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
  loginError.textContent=error?error.message:'Password reset email sent.';
});
logoutBtn.addEventListener('click',async()=>{ if(sb) await sb.auth.signOut(); currentProfile=null; loginGate.classList.remove('hidden'); setAuthPane('login'); });
if(sb) sb.auth.onAuthStateChange(async(event,session)=>{
  if(event==='SIGNED_OUT'||!session?.user){ currentProfile=null; loginGate.classList.remove('hidden'); return; }
  if(event==='SIGNED_IN' && session?.user) await authorizeSession(session.user);
});

async function loadUsers(){
  const body=document.getElementById('userRows'); if(!body||!sb||currentProfile?.role!=='admin') return;
  body.innerHTML='<tr><td colspan="6" class="empty-state">Loading users...</td></tr>';
  const {data,error}=await sb.from(PROFILE_TABLE).select('*').order('created_at',{ascending:true});
  if(error){ body.innerHTML=`<tr><td colspan="6" class="empty-state">${error.message}</td></tr>`; return; }
  if(!data?.length){ body.innerHTML='<tr><td colspan="6" class="empty-state">No user profiles yet.</td></tr>'; return; }
  body.innerHTML=data.map(u=>`<tr><td><strong>${u.full_name||'—'}</strong></td><td>${u.email||'—'}</td><td>${u.department||'—'}</td><td>${profileRoleLabel(u.role)}</td><td><span class="user-status ${u.status==='active'?'active':'inactive'}">${u.status||'active'}</span></td><td>${u.user_id===currentProfile.user_id?'<span class="muted-text">Current admin</span>':`<button class="user-action-btn" data-user-id="${u.user_id}" data-next-status="${u.status==='active'?'inactive':'active'}">${u.status==='active'?'Deactivate':'Reactivate'}</button>`}</td></tr>`).join('');
  body.querySelectorAll('.user-action-btn').forEach(btn=>btn.addEventListener('click',async()=>{
    const next=btn.dataset.nextStatus;
    btn.disabled=true; btn.textContent='Saving...';
    const {error}=await sb.from(PROFILE_TABLE).update({status:next}).eq('user_id',btn.dataset.userId);
    if(error){ alert(error.message); btn.disabled=false; return; }
    loadUsers();
  }));
}
document.getElementById('refreshUsersBtn')?.addEventListener('click',loadUsers);
bootstrapAuth();

let projects = JSON.parse(localStorage.getItem('saiko_projects')||'[]');
function saveProjects(){ localStorage.setItem('saiko_projects',JSON.stringify(projects)); }

const moduleCopy = {
  cost:{eyebrow:'COST CONTROL',title:'Cost Database',desc:'Maintain labor, material, equipment, and subcontractor rates.',cards:[['Material Rates','Store and update construction material prices.'],['Labor Rates','Maintain skilled, helper, foreman, and crew rates.'],['Equipment Rates','Track owned and rented equipment rates.']]},
  contracts:{eyebrow:'DOCUMENT CONTROL',title:'Contracts & Documents',desc:'Generate and organize project correspondence and agreements.',cards:[['Construction Contract','Prepare project-specific agreements and terms.'],['Formal Letters','Create demand, notice, transmittal, and follow-up letters.'],['Templates Library','Keep standard SAIKO formats in one place.']]},
  billing:{eyebrow:'PROJECT FINANCE',title:'Billing & Payments',desc:'Prepare progress billings and monitor payment status.',cards:[['Progress Billing','Compute billing based on accomplishment.'],['Retention Tracking','Monitor retention receivable and release dates.'],['Payment Status','Track submitted, approved, and paid billings.']]},
  vo:{eyebrow:'CONTRACT ADMINISTRATION',title:'Variation Orders / EOT',desc:'Document changes, additional costs, and time impacts.',cards:[['Variation Order','Prepare scope, cost, and approval documents.'],['Extension of Time','Document excusable delays and requested days.'],['Change Register','Track all submitted and approved changes.']]},
  procurement:{eyebrow:'SUPPLY CHAIN',title:'Procurement',desc:'Compare supplier prices and monitor purchasing activities.',cards:[['RFQ Comparison','Compare quotations from multiple suppliers.'],['Purchase Tracking','Monitor requested, ordered, and delivered items.'],['Supplier Directory','Maintain supplier contacts and categories.']]},
  monitoring:{eyebrow:'FIELD CONTROL',title:'Project Monitoring',desc:'Monitor schedule, accomplishment, manpower, and project cost.',cards:[['Progress Reports','Generate weekly and monthly project summaries.'],['Accomplishment','Track percentage by scope of work.'],['Cost vs Budget','Compare actual cost against approved budget.']]}
};

const peso = n => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(n);

function projectRow(p){
  return `<tr><td><strong>${p.name}</strong></td><td>${p.location}</td><td><span class="status"><span class="status-dot" style="background:${p.color}"></span>${p.status}</span></td><td><div class="progress-wrap"><span>${p.progress.toFixed(2)}%</span><div class="progress"><span style="width:${p.progress}%"></span></div></div></td><td>${p.target}</td></tr>`;
}
function renderProjects(list=projects){
  const emptyRow='<tr class="empty-project-row"><td colspan="5">No projects yet. Click + Add Project to create your first record.</td></tr>';
  document.querySelector('#projectRows').innerHTML=list.length?list.slice(0,7).map(projectRow).join(''):emptyRow;
  document.querySelector('#allProjectRows').innerHTML=list.length?list.map(projectRow).join(''):emptyRow;
  const active=list.filter(p=>['On-going','Architectural Phase','Design Phase'].includes(p.status)).length;
  const avg=list.length?list.reduce((a,b)=>a+b.progress,0)/list.length:0;
  document.querySelector('#projectStats').innerHTML=[['Total Projects',list.length],['Active Projects',active],['Average Progress',avg.toFixed(1)+'%'],['Planning / On-hold',list.filter(p=>['Planning','On-hold'].includes(p.status)).length]].map(([a,b])=>`<div class="stat-card"><small>${a}</small><strong>${b}</strong></div>`).join('');
}
renderProjects();

function showView(id){
  const target=document.getElementById(id);
  if(!target){ showToast('Module not found yet.'); return; }
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
  target.classList.add('active-view');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===id));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.addEventListener('click',e=>{
  const viewBtn=e.target.closest('[data-view]');
  if(viewBtn){ e.preventDefault(); showView(viewBtn.dataset.view); return; }
  const openBtn=e.target.closest('[data-open]');
  if(openBtn){ e.preventDefault(); showView(openBtn.dataset.open); return; }
  const generic=e.target.closest('[data-generic-action]');
  if(generic){ e.preventDefault(); showToast(generic.dataset.genericAction+' is ready for the next database step.'); }
});

Object.entries(moduleCopy).forEach(([id,m])=>{
  const section=document.getElementById(id);
  section.innerHTML=`<div class="module-header"><div><small>${m.eyebrow}</small><h1>${m.title}</h1><p>${m.desc}</p></div><button class="primary-btn" data-generic-action="${m.title} - New record">＋ New</button></div><div class="generic-grid">${m.cards.map(c=>`<div class="generic-card"><h3>${c[0]}</h3><p>${c[1]}</p><button data-generic-action="${c[0]}">Open Module →</button></div>`).join('')}</div>`;
});

function addMessage(container, text, who='bot'){
  const div=document.createElement('div');div.className=who==='user'?'user-message':'bot-message';div.innerHTML=text;container.appendChild(div);container.scrollTop=container.scrollHeight;
}
function localAiReply(q){
  const t=q.toLowerCase();
  if(t.includes('boq')||t.includes('estimate')) return 'For a BOQ, I can organize the estimate into <b>Preliminaries, Structural, Architectural, Electrical, Plumbing, Mechanical, and General Requirements</b>. Open the Estimate / BOQ module to generate a preliminary cost from floor area and rate.';
  if(t.includes('billing')) return 'For progress billing, use: <b>Current Accomplishment × Contract Amount</b>, then deduct previous billings, applicable retention, and other deductions. The Billing module can be connected to project accomplishment later.';
  if(t.includes('variation')||t.includes('vo')) return 'A Variation Order should capture the <b>original scope, revised scope, reason for change, cost impact, time impact, and approval</b>. The VO / EOT module is ready as a prototype screen.';
  if(t.includes('contract')) return 'I can structure construction contracts with scope, price, payment terms, duration, variation procedure, delay provisions, warranties, termination, and signatories. In a production version, templates can be generated to Word/PDF.';
  if(t.includes('hello')||t.includes('hi')) return 'Hello! I’m ready to help with construction estimating, BOQ, billing, contracts, VO/EOT, procurement, and project monitoring.';
  return 'Prototype response: I understood your request. In the production version, this chat will connect to an AI API plus your company cost database and project records, so it can generate real calculations and documents.';
}
const aiForm=document.querySelector('#aiForm'),aiInput=document.querySelector('#aiInput'),aiMessages=document.querySelector('#aiMessages');
aiForm.addEventListener('submit',e=>{e.preventDefault();const q=aiInput.value.trim();if(!q)return;addMessage(aiMessages,q,'user');aiInput.value='';setTimeout(()=>addMessage(aiMessages,localAiReply(q),'bot'),250)});
document.querySelectorAll('.chips button').forEach(b=>b.addEventListener('click',()=>{aiInput.value=b.textContent;aiForm.requestSubmit()}));
const fullForm=document.querySelector('#fullAiForm'),fullInput=document.querySelector('#fullAiInput'),fullMessages=document.querySelector('#fullAiMessages');
fullForm.addEventListener('submit',e=>{e.preventDefault();const q=fullInput.value.trim();if(!q)return;addMessage(fullMessages,q,'user');fullInput.value='';setTimeout(()=>addMessage(fullMessages,localAiReply(q),'bot'),250)});

function runEstimate(){
  const area=+document.querySelector('#estArea').value||0, rate=+document.querySelector('#estRate').value||0, cont=+document.querySelector('#estCont').value||0, markup=+document.querySelector('#estMarkup').value||0;
  const base=area*rate, contingency=base*cont/100, subtotal=base+contingency, contractor=subtotal*markup/100, total=subtotal+contractor;
  const shares={Structural:.32,Architectural:.30,Electrical:.08,Plumbing:.07,Mechanical:.05,'General Requirements':.08,'Site / External Works':.10};
  document.querySelector('#estimateOutput').innerHTML=`<div class="estimate-summary"><small>PROJECT</small><h3>${document.querySelector('#estProject').value}</h3><div class="estimate-total">${peso(total)}</div><div class="estimate-breakdown">${Object.entries(shares).map(([k,v])=>`<div><b>${k}</b><span>${peso(base*v)}</span></div>`).join('')}<div><b>Contingency</b><span>${peso(contingency)}</span></div><div><b>Contractor Markup</b><span>${peso(contractor)}</span></div></div><p style="margin-top:16px;color:#748094;font-size:12px">Preliminary budget based on ${area.toLocaleString()} sqm × ${peso(rate)}/sqm. Detailed quantities and specifications are required for a final BOQ.</p></div>`;
}
document.querySelector('#estimateForm').addEventListener('submit',e=>{e.preventDefault();runEstimate()});
function startNewEstimate(){
  showView('estimate');
  const form=document.getElementById('estimateForm');
  form.reset();
  document.getElementById('estProject').value='';
  document.getElementById('estLocation').value='';
  document.getElementById('estArea').value='';
  document.getElementById('estRate').value='';
  document.getElementById('estCont').value='5';
  document.getElementById('estMarkup').value='10';
  document.getElementById('estimateOutput').innerHTML='<div class="empty-state">Enter a new project estimate, then click Generate Preliminary Estimate.</div>';
  setTimeout(()=>document.getElementById('estProject').focus(),150);
}
['newEstimateBtn','createEstimateBtn'].forEach(id=>document.getElementById(id)?.addEventListener('click',startNewEstimate));

const projectDialog=document.getElementById('projectDialog');document.getElementById('addProjectBtn')?.addEventListener('click',()=>{ if(projectDialog?.showModal) projectDialog.showModal(); });
document.getElementById('closeProjectDialogBtn')?.addEventListener('click',()=>projectDialog?.close());
document.getElementById('cancelProjectBtn')?.addEventListener('click',()=>projectDialog?.close());
document.getElementById('projectForm').addEventListener('submit',e=>{e.preventDefault();projects.unshift({name:document.getElementById('pName').value,location:document.getElementById('pLocation').value,status:document.getElementById('pStatus').value,progress:+document.getElementById('pProgress').value||0,target:'—',color:'#2f6fde'});saveProjects();renderProjects();projectDialog.close();e.target.reset();showToast('Project saved.');});
document.getElementById('projectSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase();renderProjects(projects.filter(p=>(p.name+' '+p.location+' '+p.status).toLowerCase().includes(q)))});
document.getElementById('globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const q=e.target.value.trim();if(!q)return;showView('assistant');fullInput.value=q;fullForm.requestSubmit();e.target.value=''}});


function showToast(message){
  let t=document.getElementById('appToast');
  if(!t){ t=document.createElement('div'); t.id='appToast'; t.className='app-toast'; document.body.appendChild(t); }
  t.textContent=message; t.classList.add('show'); clearTimeout(window.__saikoToast); window.__saikoToast=setTimeout(()=>t.classList.remove('show'),2200);
}

document.querySelectorAll('.icon-btn').forEach(btn=>btn.addEventListener('click',()=>showToast('No new notifications yet.')));

if(!window.HTMLDialogElement || !HTMLDialogElement.prototype.showModal){
  document.getElementById('addProjectBtn')?.addEventListener('click',()=>{
    const name=prompt('Project name'); if(!name) return; const location=prompt('Location')||''; projects.unshift({name,location,status:'Planning',progress:0,target:'—',color:'#2f6fde'}); saveProjects(); renderProjects(); showToast('Project saved.');
  });
}
