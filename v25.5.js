// SAIKO Construction AI v25.5
// Fix Select All / Clear Selection / Delete Selected on Schedule & Actual Progress.
// Uses event delegation so controls keep working after live-sync table re-renders.
(function(){
  function wireBulk(cfg){
    const selectAll=document.getElementById(cfg.selectAllId);
    const count=document.getElementById(cfg.countId);
    const delBtn=document.getElementById(cfg.deleteBtnId);
    const clearBtn=document.getElementById(cfg.clearBtnId);
    const tbody=document.getElementById(cfg.tbodyId);
    const selected=cfg.selectedSet;

    if(!tbody)return;

    const checks=()=>[...tbody.querySelectorAll(`input.${cfg.rowClass}[type="checkbox"]`)];

    function refresh(){
      const rows=checks();

      rows.forEach(cb=>{
        cb.checked=selected.has(String(cb.value));
      });

      if(selectAll){
        const checked=rows.filter(cb=>selected.has(String(cb.value))).length;
        selectAll.checked=rows.length>0 && checked===rows.length;
        selectAll.indeterminate=checked>0 && checked<rows.length;
      }

      if(count)count.textContent=`${selected.size} selected`;
      if(delBtn)delBtn.disabled=selected.size===0;
    }

    if(!tbody.dataset.v255Bulk){
      tbody.dataset.v255Bulk='1';
      tbody.addEventListener('change',e=>{
        const cb=e.target.closest(`input.${cfg.rowClass}[type="checkbox"]`);
        if(!cb)return;
        const id=String(cb.value||'');
        if(!id)return;
        if(cb.checked)selected.add(id);
        else selected.delete(id);
        refresh();
      });
    }

    if(selectAll && !selectAll.dataset.v255Bulk){
      selectAll.dataset.v255Bulk='1';
      selectAll.addEventListener('change',()=>{
        checks().forEach(cb=>{
          const id=String(cb.value||'');
          if(!id)return;
          cb.checked=selectAll.checked;
          if(selectAll.checked)selected.add(id);
          else selected.delete(id);
        });
        refresh();
      });
    }

    if(clearBtn && !clearBtn.dataset.v255Bulk){
      clearBtn.dataset.v255Bulk='1';
      clearBtn.addEventListener('click',e=>{
        e.preventDefault();
        selected.clear();
        checks().forEach(cb=>cb.checked=false);
        if(selectAll){
          selectAll.checked=false;
          selectAll.indeterminate=false;
        }
        refresh();
      });
    }

    if(delBtn && !delBtn.dataset.v255Bulk){
      delBtn.dataset.v255Bulk='1';
      delBtn.addEventListener('click',async e=>{
        e.preventDefault();

        const ids=[...selected];
        if(!ids.length){
          refresh();
          return;
        }

        if(!confirm(`Delete ${ids.length} selected item${ids.length===1?'':'s'}?`))return;

        delBtn.disabled=true;
        try{
          const {error}=await sb.from(cfg.table).delete().in('id',ids);
          if(error)throw error;

          if(cfg.cacheKey==='schedule'){
            cache.schedule=(cache.schedule||[]).filter(r=>!selected.has(String(r.id)));
          }else{
            cache.progress=(cache.progress||[]).filter(r=>!selected.has(String(r.id)));
          }

          selected.clear();

          if(cfg.cacheKey==='schedule' && typeof renderSchedule==='function')renderSchedule();
          if(cfg.cacheKey==='progress' && typeof renderProgress==='function')renderProgress();
          if(typeof renderDashboard==='function')renderDashboard();

          if(typeof toast==='function')toast(`${ids.length} selected item${ids.length===1?'':'s'} deleted.`);
        }catch(err){
          alert(err?.message||'Could not delete selected items.');
        }finally{
          refresh();
        }
      });
    }

    refresh();
  }

  function wireAll(){
    wireBulk({
      selectAllId:'scheduleSelectAll',
      countId:'scheduleSelectedCount',
      deleteBtnId:'deleteSelectedScheduleBtn',
      clearBtnId:'clearScheduleSelectionBtn',
      tbodyId:'scheduleRows',
      rowClass:'schedule-row-check',
      selectedSet:selectedScheduleIds,
      table:'schedule_items',
      cacheKey:'schedule'
    });

    wireBulk({
      selectAllId:'progressSelectAll',
      countId:'progressSelectedCount',
      deleteBtnId:'deleteSelectedProgressBtn',
      clearBtnId:'clearProgressSelectionBtn',
      tbodyId:'progressRows',
      rowClass:'progress-row-check',
      selectedSet:selectedProgressIds,
      table:'actual_progress',
      cacheKey:'progress'
    });
  }

  // Re-run wiring after render functions because live sync replaces table rows.
  const oldSchedule=window.renderSchedule;
  if(typeof oldSchedule==='function'){
    window.renderSchedule=function(){
      const result=oldSchedule.apply(this,arguments);
      wireAll();
      return result;
    };
  }

  const oldProgress=window.renderProgress;
  if(typeof oldProgress==='function'){
    window.renderProgress=function(){
      const result=oldProgress.apply(this,arguments);
      wireAll();
      return result;
    };
  }

  setTimeout(wireAll,250);
})();
