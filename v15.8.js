// SAIKO Construction AI v15.8 — Inline Edit Mode for testing
(function(){
  const $=id=>document.getElementById(id);
  const state={enabled:false};

  // Field maps: table body -> column index -> {table,field,type}
  // Only columns that are safe/direct are editable.
  const maps={
    projectRows:{
      table:'projects',
      key:'id',
      columns:{
        1:{field:'project_name',type:'text'},
        2:{field:'client_name',type:'text'},
        3:{field:'location',type:'text'},
        4:{field:'contract_amount',type:'number'},
        5:{field:'status',type:'text'}
      }
    },
    billingRows:{
      table:'billings',
      key:'id',
      columns:{
        2:{field:'billing_type',type:'text'},
        3:{field:'billing_no',type:'text'},
        4:{field:'accomplishment_percent',type:'number'},
        5:{field:'gross_amount',type:'number'},
        6:{field:'retention_amount',type:'number'},
        7:{field:'recoupment_amount',type:'number'},
        8:{field:'net_due',type:'number'},
        9:{field:'received_amount',type:'number'},
        10:{field:'outstanding_amount',type:'number'},
        11:{field:'date_submitted',type:'date'},
        12:{field:'date_paid',type:'date'},
        14:{field:'status',type:'text'}
      }
    },
    scheduleRows:{
      table:'project_schedule',
      key:'id',
      columns:{
        1:{field:'activity',type:'text'},
        2:{field:'start_date',type:'date'},
        3:{field:'end_date',type:'date'},
        4:{field:'weight',type:'number'}
      }
    },
    progressRows:{
      table:'actual_progress',
      key:'id',
      columns:{
        1:{field:'activity',type:'text'},
        2:{field:'weight',type:'number'},
        3:{field:'actual_percent',type:'number'}
      }
    },
    inventoryRows:{
      table:'inventory',
      key:'id',
      columns:{}
    }
  };

  function toastSafe(msg){
    if(typeof toast==='function') toast(msg);
    else console.log(msg);
  }

  function esc(s){
    return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function setEnabled(on){
    state.enabled=on;
    document.documentElement.dataset.editMode=on?'on':'off';
    const btn=$('editModeBtn');
    if(btn){
      btn.classList.toggle('active',on);
      btn.textContent=on?'✓ Edit Mode ON':'✎ Edit Mode';
    }
    refreshEditableCells();
    toastSafe(on?'Inline Edit Mode enabled. Click editable cells to change data.':'Inline Edit Mode disabled.');
  }

  function getRowId(tr){
    return tr?.dataset?.id || tr?.getAttribute('data-id') || null;
  }

  function enableCell(td, cfg){
    if(!state.enabled || !cfg || td.dataset.inlineEditReady==='1')return;
    td.dataset.inlineEditReady='1';
    td.classList.add('inline-editable');
    td.tabIndex=0;
    td.addEventListener('dblclick',()=>startEdit(td,cfg));
    td.addEventListener('keydown',e=>{
      if(e.key==='Enter' && !td.querySelector('input,select')){e.preventDefault();startEdit(td,cfg);}
    });
  }

  function refreshEditableCells(){
    Object.entries(maps).forEach(([tbodyId,map])=>{
      const tbody=$(tbodyId);
      if(!tbody)return;
      [...tbody.querySelectorAll('tr')].forEach(tr=>{
        [...tr.children].forEach((td,i)=>{
          const cfg=map.columns[i];
          td.classList.remove('inline-editable');
          if(state.enabled && cfg) enableCell(td,{...cfg,table:map.table,key:map.key});
        });
      });
    });

    // Inventory already supports editable spreadsheet-like cells in current builds.
    const inv=$('inventoryRows');
    if(inv){
      inv.querySelectorAll('td[contenteditable]').forEach(td=>{
        td.classList.toggle('inline-editable',state.enabled);
        td.contentEditable=state.enabled?'true':'false';
      });
    }
  }

  async function startEdit(td,cfg){
    if(!state.enabled || td.dataset.editing==='1')return;
    const tr=td.closest('tr');
    const id=getRowId(tr);
    if(!id){toastSafe('This row is not editable yet because no record ID was found.');return;}

    // Respect collaboration lock if available.
    if(typeof acquireCollabLock==='function'){
      try{
        const lock=await acquireCollabLock(cfg.table,id,null);
        if(lock && lock.acquired===false){
          alert(`${lock.owner_name||'Another user'} is currently editing this record.`);
          return;
        }
      }catch(_e){}
    }

    td.dataset.editing='1';
    const oldText=td.textContent.trim();
    td.dataset.oldValue=oldText;

    const input=document.createElement('input');
    input.className='inline-editor';
    input.type=cfg.type==='number'?'number':cfg.type==='date'?'date':'text';
    input.step=cfg.type==='number'?'0.01':'';
    input.value=oldText.replace(/[₱,%]/g,'').replace(/,/g,'').trim();
    td.innerHTML='';
    td.appendChild(input);
    input.focus();
    input.select();

    const cancel=()=>{
      td.innerHTML=esc(oldText);
      td.dataset.editing='0';
      if(typeof releaseCollabLock==='function') releaseCollabLock(cfg.table,id).catch(()=>{});
      refreshEditableCells();
    };

    const save=async()=>{
      let val=input.value;
      if(cfg.type==='number') val=Number(val||0);
      if(cfg.type==='date' && !val) val=null;

      input.disabled=true;
      td.classList.add('inline-saving');
      try{
        if(typeof q==='function'){
          await q(cfg.table,'update',{id,values:{[cfg.field]:val}});
        }else if(typeof sb!=='undefined'){
          const {error}=await sb.from(cfg.table).update({[cfg.field]:val}).eq(cfg.key||'id',id);
          if(error) throw error;
        }else{
          throw new Error('Database connection is unavailable.');
        }

        if(typeof logCollabActivity==='function'){
          try{await logCollabActivity(cfg.table,'inline_update',id,`updated ${cfg.field}`,null,{field:cfg.field,value:val});}catch(_e){}
        }

        td.classList.remove('inline-saving');
        td.dataset.editing='0';
        if(typeof releaseCollabLock==='function') await releaseCollabLock(cfg.table,id);
        toastSafe('Saved.');
        if(typeof refreshAll==='function') await refreshAll();
      }catch(err){
        alert('Save failed: '+(err?.message||err));
        cancel();
      }
    };

    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();save();}
      if(e.key==='Escape'){e.preventDefault();cancel();}
    });
    input.addEventListener('blur',()=>setTimeout(()=>{
      if(td.dataset.editing==='1') save();
    },100));
  }

  $('editModeBtn')?.addEventListener('click',()=>setEnabled(!state.enabled));

  // Re-scan after app re-renders tables.
  const observer=new MutationObserver(()=>{ if(state.enabled) refreshEditableCells(); });
  observer.observe(document.body,{subtree:true,childList:true});

  window.saikoInlineEdit={
    enable:()=>setEnabled(true),
    disable:()=>setEnabled(false),
    refresh:refreshEditableCells
  };
})();
