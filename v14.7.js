// SAIKO Construction AI v14.7 - Per-user profile settings

cache.userPreferences = cache.userPreferences || null;

function systemTheme(){
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark':'light';
}
function applyTheme(theme){
  const resolved=theme==='system'?systemTheme():theme;
  document.documentElement.dataset.theme=resolved;
}
function applyDensity(density){
  document.documentElement.dataset.density=density||'comfortable';
}
async function loadUserPreferences(){
  if(!currentUser)return;
  try{
    const {data,error}=await sb.from('user_preferences').select('*').eq('user_id',currentUser.id).maybeSingle();
    if(error)throw error;
    cache.userPreferences=data||{
      user_id:currentUser.id,
      display_name:currentProfile?.full_name||'',
      theme:'system',
      density:'comfortable',
      remember_project:true,
      confirm_delete:true,
      daily_pending_reminder:true,
      show_active_status:true,
      last_project_id:null
    };
    applyTheme(cache.userPreferences.theme||'system');
    applyDensity(cache.userPreferences.density||'comfortable');

    if(cache.userPreferences.display_name){
      if($('sidebarName')) $('sidebarName').textContent=cache.userPreferences.display_name;
    }
    if(cache.userPreferences.remember_project && cache.userPreferences.last_project_id){
      const pid=String(cache.userPreferences.last_project_id);
      if(cache.projects.some(p=>String(p.id)===pid) && $('workspaceProject')){
        $('workspaceProject').value=pid;
        if(typeof syncWorkspaceProject==='function')syncWorkspaceProject(pid);
      }
    }
  }catch(e){
    console.warn('Preferences not ready:',e.message||e);
  }
}
function fillSettingsForm(){
  const p=cache.userPreferences||{};
  $('settingsDisplayName').value=p.display_name||currentProfile?.full_name||'';
  $('settingsEmail').value=currentUser?.email||'';
  $('settingsRole').value=currentProfile?.role||'editor';
  $('settingsTheme').value=p.theme||'system';
  $('settingsDensity').value=p.density||'comfortable';
  $('settingsRememberProject').checked=p.remember_project!==false;
  $('settingsConfirmDelete').checked=p.confirm_delete!==false;
  $('settingsDailyPending').checked=p.daily_pending_reminder!==false;
  if($('settingsShowActiveStatus')) $('settingsShowActiveStatus').checked=p.show_active_status!==false;
}
if($('settingsBtn'))$('settingsBtn').onclick=()=>{
  fillSettingsForm();
  $('settingsDialog').showModal();
};
if($('settingsForm'))$('settingsForm').onsubmit=async e=>{
  e.preventDefault();
  if(!currentUser)return;
  const row={
    user_id:currentUser.id,
    display_name:$('settingsDisplayName').value.trim(),
    theme:$('settingsTheme').value,
    density:$('settingsDensity').value,
    remember_project:$('settingsRememberProject').checked,
    confirm_delete:$('settingsConfirmDelete').checked,
    daily_pending_reminder:$('settingsDailyPending').checked,
    show_active_status:$('settingsShowActiveStatus') ? $('settingsShowActiveStatus').checked : true,
    last_project_id:$('settingsRememberProject').checked?($('workspaceProject')?.value||null):null,
    updated_at:new Date().toISOString()
  };
  const {error}=await sb.from('user_preferences').upsert(row,{onConflict:'user_id'});
  if(error)return alert(error.message);
  cache.userPreferences=row;
  if(row.show_active_status===false && typeof hideMyPresence==='function') await hideMyPresence();
  if(row.show_active_status!==false && typeof heartbeatPresence==='function') await heartbeatPresence();
  applyTheme(row.theme);
  applyDensity(row.density);
  if($('sidebarName')&&row.display_name)$('sidebarName').textContent=row.display_name;
  $('settingsDialog').close();
  toast('Profile settings saved.');
};

// Remember last selected project per profile
if($('workspaceProject')){
  $('workspaceProject').addEventListener('change',async e=>{
    if(!currentUser || !cache.userPreferences?.remember_project)return;
    cache.userPreferences.last_project_id=e.target.value||null;
    await sb.from('user_preferences').upsert({
      ...cache.userPreferences,
      user_id:currentUser.id,
      last_project_id:e.target.value||null,
      updated_at:new Date().toISOString()
    },{onConflict:'user_id'});
  });
}

// Honor user delete-confirmation preference in a reusable helper.
window.saikoConfirmDelete=function(message){
  if(cache.userPreferences?.confirm_delete===false)return true;
  return confirm(message||'Delete this item?');
};

// Honor daily reminder setting
const oldDailyPendingReminderV147 = typeof dailyPendingReminder==='function' ? dailyPendingReminder : null;
if(oldDailyPendingReminderV147){
  dailyPendingReminder=function(){
    if(cache.userPreferences?.daily_pending_reminder===false)return;
    return oldDailyPendingReminderV147();
  };
}

// Keep system theme synchronized if preference is System Default.
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{
  if((cache.userPreferences?.theme||'system')==='system')applyTheme('system');
});

const refreshV147Base=refreshAll;
refreshAll=async function(){
  await refreshV147Base();
  await loadUserPreferences();
};

setTimeout(async()=>{
  try{
    await loadUserPreferences();
  }catch(e){console.warn('v14.7 init',e)}
},1200);
