// CONSTRUCTION MONITORING v28.4
// Per-project cost folder browser:
// Project Folder -> Materials / Labor / Overhead Cost -> editable ledger.
// Existing DB structure is reused. No duplicate inventory state and no new timer.
(function(){
  const PRIMARY=[
    {key:'Materials',label:'Materials',icon:'▦',note:'Material purchases, deliveries and supplier costs'},
    {key:'Labor',label:'Labor',icon:'◉',note:'Labor payroll, manpower and direct labor costs'},
    {key:'Overhead',label:'Overhead Cost',icon:'⌂',note:'Project overhead, site expenses and indirect costs'}
  ];

  let level='projects'; // projects | costs | ledger
  let browserProjectId='';
  let selectedCategory='';

  const n=v=>{
    const x=Number(v);
    return Number.isFinite(x)?x:0;
  };

  function rowsFor(pid,category=''){
    let rows=(cache.inventory||[]).filter(r=>String(r.project_id)===String(pid));
    if(category==='Legacy'){
      rows=rows.filter(r=>!PRIMARY.some(c=>c.key===r.category));
    }else if(category){
      rows=rows.filter(r=>r.category===category);
    }
    return rows;
  }

  function totals(rows){
    return {
      total:rows.reduce((s,r)=>s+n(r.total_amount),0),
      paid:rows.reduce((s,r)=>s+n(r.paid_amount),0),
      balance:rows.reduce((s,r)=>s+n(r.balance_amount),0),
      count:rows.length
    };
  }

  function project(pid){
    return (cache.projects||[]).find(p=>String(p.id)===String(pid))||null;
  }

  function selectedPid(){
    return $('inventoryProject')?.value||$('workspaceProject')?.value||browserProjectId||'';
  }

  function setWorkspaceProject(pid){
    browserProjectId=pid;
    if($('inventoryProject') && [...$('inventoryProject').options].some(o=>String(o.value)===String(pid))){
      $('inventoryProject').value=pid;
    }
    if($('workspaceProject') && [...$('workspaceProject').options].some(o=>String(o.value)===String(pid))){
      $('workspaceProject').value=pid;
      try{
        $('workspaceProject').dispatchEvent(new Event('change',{bubbles:true}));
      }catch(_){}
    }
  }

  function folderTotal(pid,key){
    return totals(rowsFor(pid,key));
  }

  function allPrimaryTotal(pid){
    return PRIMARY.reduce((sum,c)=>sum+folderTotal(pid,c.key).total,0);
  }

  function renderBreadcrumb(){
    const host=$('inventoryBreadcrumb');
    if(!host)return;
    const pid=selectedPid(),p=project(pid);

    let out=`<button type="button" data-inventory-level="projects">Projects</button>`;
    if(level==='costs'||level==='ledger'){
      out+=`<span>›</span><button type="button" data-inventory-level="costs">${esc(p?.project_name||'Project')}</button>`;
    }
    if(level==='ledger'){
      const label=selectedCategory==='Legacy'?'Other Existing Costs':(PRIMARY.find(c=>c.key===selectedCategory)?.label||selectedCategory);
      out+=`<span>›</span><strong>${esc(label)}</strong>`;
    }
    host.innerHTML=out;

    const back=$('inventoryBackBtn');
    if(back)back.hidden=level==='projects';
  }

  function renderProjectFolders(){
    const host=$('inventoryProjectFolders');
    if(!host)return;

    const projects=(cache.projects||[]).slice().sort((a,b)=>
      String(a.project_name||'').localeCompare(String(b.project_name||''))
    );

    host.innerHTML=projects.length?projects.map(p=>{
      const rows=rowsFor(p.id);
      const t=totals(rows);
      const primary=allPrimaryTotal(p.id);
      return `<button type="button" class="inventory-folder-card project-folder-card" data-project-folder="${p.id}">
        <div class="inventory-folder-tab"></div>
        <div class="inventory-folder-icon">▰</div>
        <div class="inventory-folder-copy">
          <span>PROJECT FOLDER</span>
          <h3>${esc(p.project_name||'Untitled Project')}</h3>
          <p>${esc(p.location||p.status||'')}</p>
        </div>
        <div class="inventory-folder-stats">
          <div><span>Primary Cost</span><strong>${money(primary)}</strong></div>
          <div><span>All Records</span><strong>${t.count}</strong></div>
        </div>
      </button>`;
    }).join(''):'<div class="empty">No projects yet.</div>';
  }

  function renderCostFolders(){
    const host=$('inventoryCostFolders');
    if(!host)return;
    const pid=selectedPid(),p=project(pid);
    if(!pid||!p){
      host.innerHTML='<div class="empty">Select a project.</div>';
      return;
    }

    const cards=PRIMARY.map(c=>{
      const t=folderTotal(pid,c.key);
      return `<button type="button" class="inventory-folder-card cost-subfolder-card" data-cost-subfolder="${c.key}">
        <div class="inventory-folder-tab"></div>
        <div class="inventory-folder-icon">${c.icon}</div>
        <div class="inventory-folder-copy">
          <span>${esc(c.label.toUpperCase())}</span>
          <h3>${esc(c.label)}</h3>
          <p>${esc(c.note)}</p>
        </div>
        <div class="inventory-cost-metrics">
          <div><span>Total</span><strong>${money(t.total)}</strong></div>
          <div><span>Paid</span><strong>${money(t.paid)}</strong></div>
          <div><span>Balance</span><strong>${money(t.balance)}</strong></div>
          <div><span>Rows</span><strong>${t.count}</strong></div>
        </div>
      </button>`;
    });

    const legacy=rowsFor(pid,'Legacy');
    if(legacy.length){
      const t=totals(legacy);
      cards.push(`<button type="button" class="inventory-folder-card cost-subfolder-card legacy-folder-card" data-cost-subfolder="Legacy">
        <div class="inventory-folder-tab"></div>
        <div class="inventory-folder-icon">…</div>
        <div class="inventory-folder-copy">
          <span>EXISTING RECORDS</span>
          <h3>Other Existing Costs</h3>
          <p>Older Equipment, Subcontractor and Other entries are preserved here. New rows are limited to the three main folders.</p>
        </div>
        <div class="inventory-cost-metrics">
          <div><span>Total</span><strong>${money(t.total)}</strong></div>
          <div><span>Paid</span><strong>${money(t.paid)}</strong></div>
          <div><span>Balance</span><strong>${money(t.balance)}</strong></div>
          <div><span>Rows</span><strong>${t.count}</strong></div>
        </div>
      </button>`);
    }

    const materialsTotal=folderTotal(pid,'Materials').total;
    const laborTotal=folderTotal(pid,'Labor').total;
    const overheadTotal=folderTotal(pid,'Overhead').total;
    const grandTotal=materialsTotal+laborTotal+overheadTotal;

    host.innerHTML=`
      <div class="inventory-folder-project-head">
        <span>OPEN PROJECT</span>
        <h2>${esc(p.project_name)}</h2>
        <p>${esc(p.location||'')} ${p.status?`• ${esc(p.status)}`:''}</p>
      </div>
      <div class="inventory-project-total-summary">
        <div><span>Materials Total</span><strong>${money(materialsTotal)}</strong></div>
        <div><span>Labor Total</span><strong>${money(laborTotal)}</strong></div>
        <div><span>Overhead Total</span><strong>${money(overheadTotal)}</strong></div>
        <div class="grand-total"><span>Grand Total Cost</span><strong>${money(grandTotal)}</strong></div>
      </div>
      ${cards.join('')}`;
  }

  function renderLedger(){
    const pid=selectedPid();
    const category=selectedCategory;
    const rows=rowsFor(pid,category);
    const custom=typeof inventoryColumnsForProject==='function'?inventoryColumnsForProject(pid):[];
    const head=$('inventoryHead');
    const badge=$('inventoryLedgerBadge');

    if(!head||!$('inventoryRows'))return;

    const label=category==='Legacy'?'Other Existing Costs':(PRIMARY.find(c=>c.key===category)?.label||category);
    if(badge)badge.textContent=label||'Cost Folder';

    head.innerHTML='<tr>'+
      baseCols.map(c=>`<th>${c[1]}</th>`).join('')+
      custom.map(c=>`<th class="custom-col-head">${esc(c.column_name)}</th>`).join('')+
      '<th>Action</th></tr>';

    const t=totals(rows);
    if($('costFolderSummary')){
      $('costFolderSummary').innerHTML=[
        ['Folder',label],
        ['Total',money(t.total)],
        ['Paid',money(t.paid)],
        ['Balance',money(t.balance)]
      ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
    }
    if($('inventoryKPIs')){
      $('inventoryKPIs').innerHTML=[
        ['Committed',money(t.total)],
        ['Paid',money(t.paid)],
        ['Balance',money(t.balance)],
        ['Rows',String(t.count)]
      ].map(x=>`<div class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
    }

    $('inventoryRows').innerHTML=rows.length?rows.map(i=>`<tr data-id="${i.id}">
      ${baseCols.map(([k])=>`<td contenteditable="${['input_by_name','total_amount','balance_amount'].includes(k)?'false':'true'}" data-field="${k}">${esc(String(i[k]??''))}</td>`).join('')}
      ${custom.map(c=>`<td contenteditable="true" data-custom="${c.column_key}">${esc(String((i.custom_data||{})[c.column_key]??''))}</td>`).join('')}
      <td><button class="danger-link" onclick="deleteInventory('${i.id}')">Delete</button></td>
    </tr>`).join(''):`<tr><td colspan="${baseCols.length+custom.length+1}" class="empty">No ${esc(label)} entries yet. Click Add Row.</td></tr>`;

    document.querySelectorAll('#inventoryRows td[contenteditable="true"]').forEach(td=>{
      td.onblur=()=>saveInventoryCell(td);
    });
  }

  function syncVisibility(){
    const projects=$('inventoryProjectFolders');
    const costs=$('inventoryCostFolders');
    const ledger=$('inventoryLedgerArea');
    const add=$('addInventoryRowBtn');

    if(projects)projects.hidden=level!=='projects';
    if(costs)costs.hidden=level!=='costs';
    if(ledger)ledger.hidden=level!=='ledger';

    if(add){
      const canAdd=level==='ledger' && selectedCategory && selectedCategory!=='Legacy';
      add.disabled=!canAdd;
      add.title=canAdd?'Add a row to this cost folder':'Open Materials, Labor or Overhead Cost first';
    }
  }

  function renderBrowser(){
    renderBreadcrumb();
    if(level==='projects')renderProjectFolders();
    if(level==='costs')renderCostFolders();
    if(level==='ledger')renderLedger();
    syncVisibility();
  }

  function openProject(pid){
    setWorkspaceProject(pid);
    selectedCategory='';
    level='costs';
    try{activeCostFolder='all'}catch(_){}
    renderBrowser();
  }

  function openFolder(category){
    selectedCategory=category;
    level='ledger';
    if(category!=='Legacy'){
      try{activeCostFolder=category}catch(_){}
    }
    renderBrowser();
  }

  function goBack(){
    if(level==='ledger'){
      level='costs';
      selectedCategory='';
    }else if(level==='costs'){
      level='projects';
    }
    renderBrowser();
  }

  // Project folder click.
  if($('inventoryProjectFolders')){
    $('inventoryProjectFolders').addEventListener('click',e=>{
      const card=e.target.closest('[data-project-folder]');
      if(card)openProject(card.dataset.projectFolder);
    });
  }

  // Cost folder click.
  if($('inventoryCostFolders')){
    $('inventoryCostFolders').addEventListener('click',e=>{
      const card=e.target.closest('[data-cost-subfolder]');
      if(card)openFolder(card.dataset.costSubfolder);
    });
  }

  if($('inventoryBreadcrumb')){
    $('inventoryBreadcrumb').addEventListener('click',e=>{
      const btn=e.target.closest('[data-inventory-level]');
      if(!btn)return;
      if(btn.dataset.inventoryLevel==='projects'){
        level='projects';selectedCategory='';
      }else if(btn.dataset.inventoryLevel==='costs'){
        level='costs';selectedCategory='';
      }
      renderBrowser();
    });
  }

  if($('inventoryBackBtn'))$('inventoryBackBtn').onclick=goBack;

  if($('inventoryProject')){
    $('inventoryProject').addEventListener('change',()=>{
      browserProjectId=$('inventoryProject').value||'';
      selectedCategory='';
      level=browserProjectId?'costs':'projects';
      renderBrowser();
    });
  }

  // Replace Add Row: new entries only go into Materials/Labor/Overhead Cost.
  if($('addInventoryRowBtn')){
    $('addInventoryRowBtn').onclick=async()=>{
      const pid=selectedPid();
      if(!pid)return alert('Select a project first.');
      if(level!=='ledger'||!selectedCategory||selectedCategory==='Legacy'){
        return alert('Open Materials, Labor or Overhead Cost first.');
      }

      const {error}=await sb.from('inventory_entries').insert({
        project_id:pid,
        category:selectedCategory,
        description:`New ${PRIMARY.find(c=>c.key===selectedCategory)?.label||selectedCategory} Row`,
        quantity:0,
        unit_cost:0,
        total_amount:0,
        paid_amount:0,
        balance_amount:0,
        input_by_name:profileName(),
        created_by:currentUser.id
      });
      if(error)return alert(error.message);

      await refreshAll();
      level='ledger';
      renderBrowser();
      if(typeof toast==='function')toast(`${PRIMARY.find(c=>c.key===selectedCategory)?.label||selectedCategory} row added.`);
    };
  }

  // Keep Add Column project-specific and refresh the currently-open folder.
  if($('addInventoryColumnBtn')){
    const existing=$('addInventoryColumnBtn').onclick;
    $('addInventoryColumnBtn').onclick=async()=>{
      const pid=selectedPid();
      if(!pid)return alert('Select a project first.');
      const name=prompt('New column name for this project:');
      if(!name)return;
      const key=name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
      const order=inventoryColumnsForProject(pid).length;
      const {error}=await sb.from('inventory_columns').insert({
        project_id:pid,
        column_name:name,
        column_key:key,
        display_order:order,
        created_by:currentUser.id
      });
      if(error)return alert(error.message);
      await refreshAll();
      renderBrowser();
    };
  }

  // Final Inventory renderer used by normal refresh + Supabase Realtime.
  const priorRenderInventory=window.renderInventory;
  window.renderInventory=function(){
    // Detect a project change made from the global Project Folder selector.
    const pid=$('inventoryProject')?.value||$('workspaceProject')?.value||'';
    if(pid && browserProjectId && String(pid)!==String(browserProjectId)){
      browserProjectId=pid;
      selectedCategory='';
      level='costs';
    }else if(pid && !browserProjectId){
      browserProjectId=pid;
    }

    if(level==='ledger')renderLedger();
    else renderBrowser();
  };

  // Navigation behavior: entering Inventory starts with project folders,
  // unless user is returning while already inside a folder in this session.
  const priorShow=window.show;
  window.show=function(id){
    const out=priorShow(id);
    if(id==='inventory'){
      if(!browserProjectId){
        level='projects';
        selectedCategory='';
      }
      renderBrowser();
    }
    return out;
  };

  // Public helper for other modules if needed.
  window.openInventoryProjectFolder=openProject;
  window.openInventoryCostFolder=openFolder;

  setTimeout(()=>{
    if($('inventoryProject')?.value)browserProjectId=$('inventoryProject').value;
    renderBrowser();
  },700);
})();
