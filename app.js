const projects = [
  {name:'UY Residence', location:'Kawit, Cavite', status:'On-going', progress:47.25, target:'Dec 31, 2026', color:'#20a565'},
  {name:'Melendrez Residence', location:'Kawit, Cavite', status:'Architectural Phase', progress:68.10, target:'Nov 30, 2026', color:'#2f6fde'},
  {name:'SMDC Mint Residence CP02A', location:'Taguig City', status:'Demobilized', progress:62.00, target:'—', color:'#d64b62'},
  {name:'Manna Resort (Lumora Tropica)', location:'Dipaculao, Aurora', status:'On-going', progress:34.83, target:'Mar 31, 2027', color:'#20a565'},
  {name:'Coffee Shop', location:'Pampanga', status:'Design Phase', progress:0, target:'Oct 31, 2026', color:'#2f6fde'},
  {name:'Subdivision Development', location:'Magalang, Pampanga', status:'Planning', progress:0, target:'—', color:'#f39b24'},
  {name:'Alstom CIAC Canopy', location:'Clark, Pampanga', status:'On-hold', progress:60, target:'—', color:'#8a8f96'}
];

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
  document.querySelector('#projectRows').innerHTML=list.slice(0,7).map(projectRow).join('');
  document.querySelector('#allProjectRows').innerHTML=list.map(projectRow).join('');
  const active=list.filter(p=>['On-going','Architectural Phase','Design Phase'].includes(p.status)).length;
  const avg=list.reduce((a,b)=>a+b.progress,0)/list.length;
  document.querySelector('#projectStats').innerHTML=[['Total Projects',list.length],['Active Projects',active],['Average Progress',avg.toFixed(1)+'%'],['Planning / On-hold',list.filter(p=>['Planning','On-hold'].includes(p.status)).length]].map(([a,b])=>`<div class="stat-card"><small>${a}</small><strong>${b}</strong></div>`).join('');
}
renderProjects();

function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));
  document.getElementById(id).classList.add('active-view');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===id));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
document.querySelectorAll('[data-open]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.open)));

Object.entries(moduleCopy).forEach(([id,m])=>{
  const section=document.getElementById(id);
  section.innerHTML=`<div class="module-header"><div><small>${m.eyebrow}</small><h1>${m.title}</h1><p>${m.desc}</p></div><button class="primary-btn">＋ New</button></div><div class="generic-grid">${m.cards.map(c=>`<div class="generic-card"><h3>${c[0]}</h3><p>${c[1]}</p><button>Open Module →</button></div>`).join('')}</div>`;
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
document.querySelector('#estimateForm').addEventListener('submit',e=>{e.preventDefault();runEstimate()});runEstimate();
['newEstimateBtn','createEstimateBtn'].forEach(id=>document.getElementById(id)?.addEventListener('click',()=>showView('estimate')));

const projectDialog=document.getElementById('projectDialog');document.getElementById('addProjectBtn').addEventListener('click',()=>projectDialog.showModal());
document.getElementById('projectForm').addEventListener('submit',e=>{e.preventDefault();projects.unshift({name:document.getElementById('pName').value,location:document.getElementById('pLocation').value,status:document.getElementById('pStatus').value,progress:+document.getElementById('pProgress').value||0,target:'—',color:'#2f6fde'});renderProjects();projectDialog.close();e.target.reset()});
document.getElementById('projectSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase();renderProjects(projects.filter(p=>(p.name+' '+p.location+' '+p.status).toLowerCase().includes(q)))});
document.getElementById('globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){const q=e.target.value.trim();if(!q)return;showView('assistant');fullInput.value=q;fullForm.requestSubmit();e.target.value=''}});
