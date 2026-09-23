// SAIKO Construction AI v14.8 - Multi-user collaboration safety

window.saikoCollab = window.saikoCollab || {
  currentModule: 'dashboard',
  currentLock: null,
  heartbeat: null,
  presenceTimer: null
};

function collabName(){
  return cache.userPreferences?.display_name || currentProfile?.full_name || currentUser?.email || 'User';
}
function collabProjectId(){
  return $('workspaceProject')?.value || $('inventoryProject')?.value || null;
}
function currentVisibleView(){
  const el=[...document.querySelectorAll('.view')].find(x=>!x.classList.contains('hidden') && getComputedStyle(x).display!=='none');
  return el?.id || 'dashboard';
}
async function hideMyPresence(){
  if(!currentUser)return;
  try{await sb.from('collaboration_presence').delete().eq('user_id',currentUser.id)}catch(e){console.warn('presence hide',e)}
}
window.hideMyPresence=hideMyPresence;
async function heartbeatPresence(){
  if(!currentUser)return;
  if(cache.userPreferences?.show_active_status===false){
    await hideMyPresence();
    return;
  }
  const module=currentVisibleView();
  saikoCollab.currentModule=module;
  await sb.from('collaboration_presence').upsert({
    user_id:currentUser.id,
    display_name:collabName(),
    module,
    project_id:collabProjectId()||null,
    last_seen:new Date().toISOString()
  },{onConflict:'user_id'});
}
async function acquireCollabLock(module,recordId,projectId){
  if(!currentUser || !recordId)return {acquired:true};
  const {data,error}=await sb.rpc('acquire_record_lock',{
    p_module:module,
    p_record_id:String(recordId),
    p_display_name:collabName(),
    p_project_id:projectId||null
  });
  if(error){console.warn('Lock check failed',error);return {acquired:true,warning:error.message}}
  const lock=Array.isArray(data)?data[0]:data;
  if(lock?.acquired){
    saikoCollab.currentLock={module,recordId:String(recordId)};
    return lock;
  }
  return lock||{acquired:false};
}
async function releaseCollabLock(module,recordId){
  if(!currentUser||!recordId)return;
  try{await sb.rpc('release_record_lock',{p_module:module,p_record_id:String(recordId)})}catch(e){}
  if(saikoCollab.currentLock?.module===module && saikoCollab.currentLock?.recordId===String(recordId))saikoCollab.currentLock=null;
}
async function logCollabActivity(module,action,recordId,description,projectId,changeData){
  if(!currentUser)return;
  await sb.from('activity_log').insert({
    user_id:currentUser.id,display_name:collabName(),module,action,
    record_id:recordId?String(recordId):null,project_id:projectId||null,
    description:description||null,change_data:changeData||{}
  });
}
async function snapshotRecord(module,recordId,projectId,snapshot){
  if(!currentUser||!recordId)return;
  await sb.from('record_history').insert({
    module,record_id:String(recordId),project_id:projectId||null,
    changed_by:currentUser.id,display_name:collabName(),snapshot:snapshot||{}
  });
}
function ago(ts){
  if(!ts)return'';
  const s=Math.max(0,Math.round((Date.now()-new Date(ts).getTime())/1000));
  if(s<60)return `${s}s ago`;
  if(s<3600)return `${Math.floor(s/60)}m ago`;
  if(s<86400)return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}
async function refreshTeamActivity(){
  if(!currentUser)return;
  const cutoff=new Date(Date.now()-5*60*1000).toISOString();
  const now=new Date().toISOString();

  const [pRes,lRes,aRes]=await Promise.all([
    sb.from('collaboration_presence').select('*').gte('last_seen',cutoff).order('last_seen',{ascending:false}),
    sb.from('collaboration_locks').select('*').gt('expires_at',now).order('locked_at',{ascending:false}),
    sb.from('activity_log').select('*').order('created_at',{ascending:false}).limit(40)
  ]);
  const pres=pRes.data||[],locks=lRes.data||[],acts=aRes.data||[];

  if($('collabPresence')) $('collabPresence').innerHTML=pres.length?pres.map(p=>`
    <div class="collab-person">
      <div class="collab-person-main"><span class="collab-dot ${Date.now()-new Date(p.last_seen).getTime()>90000?'idle':''}"></span>
      <div><strong>${esc(p.display_name||'User')}${p.user_id===currentUser.id?' (You)':''}</strong>
      <div class="collab-meta">${esc(p.module||'dashboard')} · ${ago(p.last_seen)}</div></div></div>
    </div>`).join(''):'<div class="muted">No recently active users.</div>';

  if($('collabLocks')) $('collabLocks').innerHTML=locks.length?locks.map(l=>`
    <div class="collab-lock ${l.user_id===currentUser.id?'mine':'other'}">
      <div><strong>${esc(l.display_name||'User')}</strong><div class="collab-meta">${esc(l.module)} · record ${esc(l.record_id)}</div></div>
      <span class="lock-badge">${l.user_id===currentUser.id?'Your edit':'Editing'}</span>
    </div>`).join(''):'<div class="muted">No records are locked right now.</div>';

  if($('collabActivity')) $('collabActivity').innerHTML=acts.length?acts.map(a=>`
    <div class="activity-item"><div class="activity-main"><div>
      <strong>${esc(a.display_name||'User')}</strong> ${esc(a.description||a.action)}
      <div class="collab-meta">${esc(a.module)} · ${ago(a.created_at)}</div>
    </div></div></div>`).join(''):'<div class="muted">No activity yet.</div>';
}

if($('teamActivityBtn')) $('teamActivityBtn').onclick=async()=>{
  $('teamActivityDialog').showModal();
  await refreshTeamActivity();
};
if($('refreshTeamActivityBtn')) $('refreshTeamActivityBtn').onclick=refreshTeamActivity;

// Presence heartbeat. Other users are not interrupted when one account logs out.
setInterval(()=>{heartbeatPresence().catch(()=>{})},30000);
setTimeout(()=>heartbeatPresence().catch(()=>{}),1500);

// Release owned lock before leaving page/signing out.
window.addEventListener('beforeunload',()=>{
  const l=saikoCollab.currentLock;
  if(l) releaseCollabLock(l.module,l.recordId);
});

// Inventory rows are the current spreadsheet-style shared editing surface.
// Lock the exact row on focus so two people cannot silently overwrite it.
document.addEventListener('focusin',async e=>{
  const td=e.target.closest?.('#inventoryRows td[contenteditable="true"]');
  if(!td)return;
  const tr=td.closest('tr'),id=tr?.dataset?.id;
  if(!id)return;
  const row=cache.inventory?.find(x=>String(x.id)===String(id));
  const lock=await acquireCollabLock('inventory',id,row?.project_id||collabProjectId());
  if(!lock?.acquired){
    td.classList.add('edit-locked');
    td.contentEditable='false';
    td.dataset.lockedByOther='1';
    alert(`${lock?.owner_name||'Another user'} is currently editing this inventory row. Try again after they finish.`);
    setTimeout(()=>{td.classList.remove('edit-locked');td.contentEditable='true';delete td.dataset.lockedByOther},4500);
    return;
  }
  td.classList.add('edit-mine');
},true);

document.addEventListener('focusout',e=>{
  const td=e.target.closest?.('#inventoryRows td[contenteditable="true"]');
  if(!td)return;
  setTimeout(()=>{
    const tr=td.closest('tr'),id=tr?.dataset?.id;
    td.classList.remove('edit-mine');
    if(id)releaseCollabLock('inventory',id);
  },700);
},true);

// Wrap the inventory cell saver with history + activity + a final lock check.
if(typeof saveInventoryCell==='function'){
  const saveInventoryCellV148Base=saveInventoryCell;
  saveInventoryCell=async function(td){
    const tr=td.closest('tr'),id=tr?.dataset?.id;
    if(!id || td.dataset.lockedByOther==='1')return;
    const row=cache.inventory?.find(x=>String(x.id)===String(id));
    const lock=await acquireCollabLock('inventory',id,row?.project_id||collabProjectId());
    if(!lock?.acquired){
      alert(`${lock?.owner_name||'Another user'} is editing this inventory row. Your change was not saved.`);
      await refreshAll();renderInventory();
      return;
    }
    await snapshotRecord('inventory',id,row?.project_id,row);
    const field=td.dataset.field||td.dataset.custom||'cell';
    const value=td.textContent.trim();
    await saveInventoryCellV148Base(td);
    await logCollabActivity('inventory','update',id,`updated ${field}`,row?.project_id,{field,value});
    await releaseCollabLock('inventory',id);
  };
}

// Basic create/update activity tracking for main forms.
function collabFormLog(formId,module,descriptionFn){
  const form=$(formId);if(!form)return;
  form.addEventListener('submit',()=>{
    const pid=collabProjectId();
    setTimeout(()=>logCollabActivity(module,'save',null,descriptionFn?descriptionFn():`saved ${module} data`,pid,{}),900);
  });
}
collabFormLog('projectForm','projects',()=>`saved a project record`);
collabFormLog('billingForm','billing',()=>`saved a billing / VO record`);
collabFormLog('progressForm','progress',()=>`saved actual progress`);
collabFormLog('inventoryForm','inventory',()=>`saved a cost entry`);
collabFormLog('pendingForm','quotation',()=>`saved a quotation record`);

setTimeout(()=>refreshTeamActivity().catch(()=>{}),1800);
