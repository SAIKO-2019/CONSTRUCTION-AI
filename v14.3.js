// SAIKO Construction AI v14.3 - Per-project cost folders

let activeCostFolder='all';

function costFolderRows(pid,folder){
  let rows=inventoryForProject(pid);
  if(folder && folder!=='all') rows=rows.filter(i=>i.category===folder);
  return rows;
}

function renderCostFolderSummary(){
  const pid=$('inventoryProject')?.value||$('workspaceProject')?.value;
  if(!pid||!$('costFolderSummary'))return;
  const rows=costFolderRows(pid,activeCostFolder);
  const total=rows.reduce((s,i)=>s+Number(i.total_amount||0),0);
  const paid=rows.reduce((s,i)=>s+Number(i.paid_amount||0),0);
  const balance=rows.reduce((s,i)=>s+Number(i.balance_amount||0),0);
  $('costFolderSummary').innerHTML=[
    ['Folder',activeCostFolder==='all'?'All Costs':activeCostFolder],
    ['Total',money(total)],['Paid',money(paid)],['Balance',money(balance)]
  ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
}

function setActiveCostFolder(folder){
  activeCostFolder=folder||'all';
  document.querySelectorAll('.cost-folder').forEach(b=>b.classList.toggle('active',b.dataset.costFolder===activeCostFolder));
  renderInventory();
  renderCostFolderSummary();
}
document.querySelectorAll('.cost-folder').forEach(b=>b.onclick=()=>setActiveCostFolder(b.dataset.costFolder));

const renderInventoryV143Base=renderInventory;
renderInventory=function(){
  if(!$('inventoryRows'))return;
  const pid=$('inventoryProject')?.value||$('workspaceProject')?.value||'';
  const rows=costFolderRows(pid,activeCostFolder);
  const custom=inventoryColumnsForProject(pid),head=$('inventoryHead');
  head.innerHTML='<tr>'+baseCols.map(c=>`<th>${c[1]}</th>`).join('')+custom.map(c=>`<th class="custom-col-head">${esc(c.column_name)}</th>`).join('')+'<th>Action</th></tr>';
  const total=rows.reduce((s,i)=>s+Number(i.total_amount||0),0),paid=rows.reduce((s,i)=>s+Number(i.paid_amount||0),0),bal=rows.reduce((s,i)=>s+Number(i.balance_amount||0),0);
  $('inventoryKPIs').innerHTML=[['Committed',money(total)],['Paid',money(paid)],['Balance',money(bal)],['Rows',String(rows.length)]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  $('inventoryRows').innerHTML=rows.length?rows.map(i=>`<tr data-id="${i.id}">
    ${baseCols.map(([k])=>`<td contenteditable="${['input_by_name','total_amount','balance_amount'].includes(k)?'false':'true'}" data-field="${k}">${esc(String(i[k]??''))}</td>`).join('')}
    ${custom.map(c=>`<td contenteditable="true" data-custom="${c.column_key}">${esc(String((i.custom_data||{})[c.column_key]??''))}</td>`).join('')}
    <td><button class="danger-link" onclick="deleteInventory('${i.id}')">Delete</button></td>
  </tr>`).join(''):`<tr><td colspan="${baseCols.length+custom.length+1}" class="empty">No ${activeCostFolder==='all'?'cost':activeCostFolder} entries yet. Click Add Row.</td></tr>`;
  document.querySelectorAll('#inventoryRows td[contenteditable="true"]').forEach(td=>td.onblur=()=>saveInventoryCell(td));
  renderCostFolderSummary();
};

const addInventoryRowV143Base=addInventoryRow;
addInventoryRow=async function(){
  const pid=$('inventoryProject')?.value||$('workspaceProject')?.value;if(!pid)return alert('Select a project.');
  const category=activeCostFolder==='all'?'Materials':activeCostFolder;
  const {error}=await sb.from('inventory_entries').insert({project_id:pid,category,description:'New Row',quantity:0,unit_cost:0,total_amount:0,paid_amount:0,balance_amount:0,input_by_name:profileName(),created_by:currentUser.id});
  if(error)return alert(error.message);
  await refreshAll();renderInventory();
};
if($('addInventoryRowBtn')) $('addInventoryRowBtn').onclick=addInventoryRow;

if($('inventoryProject')) $('inventoryProject').addEventListener('change',()=>{setActiveCostFolder('all');renderProjectFolderCards()});

function folderTotals(pid){
  const cats=['Materials','Labor','Overhead','Equipment','Subcontractor','Other'];
  return Object.fromEntries(cats.map(c=>[c,inventoryForProject(pid).filter(i=>i.category===c).reduce((s,i)=>s+Number(i.total_amount||0),0)]));
}
function renderProjectFolderCards(){
  const box=$('projectFolderCards');if(!box)return;
  const pid=$('workspaceProject')?.value||cache.projects[0]?.id;
  if(!pid){box.innerHTML='<div class="empty">Select a project.</div>';return}
  const p=currentProject(pid),tot=folderTotals(pid);
  const cats=[['Materials','▦'],['Labor','👷'],['Overhead','⌂'],['Equipment','⚙'],['Subcontractor','◫'],['Other','…']];
  box.innerHTML=cats.map(([c,icon])=>`<div class="folder-card" onclick="openCostFolder('${c}')">
    <div class="folder-icon">${icon}</div><h3>${c}</h3><small>${esc(p?.project_name||'')}</small><div class="folder-total">${money(tot[c])}</div>
  </div>`).join('');
}
window.openCostFolder=folder=>{
  show('inventory');
  if($('inventoryProject')&&$('workspaceProject')?.value)$('inventoryProject').value=$('workspaceProject').value;
  setActiveCostFolder(folder);
};

const renderDashboardV143Base=renderDashboard;
renderDashboard=function(){renderDashboardV143Base();renderProjectFolderCards()};

const showV143Base=show;
show=function(id){showV143Base(id);if(id==='projects')renderProjectFolderCards();if(id==='inventory'){renderInventory();renderCostFolderSummary()}};

setTimeout(()=>{try{renderProjectFolderCards();renderCostFolderSummary()}catch(e){console.warn('v14.3 init',e)}},900);
