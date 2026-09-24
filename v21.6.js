// SAIKO Construction AI v21.6 — upload format awareness notice
(function(){
  const $=id=>document.getElementById(id);
  let shownForProject=null;

  function selectedQuotation(){
    const list=cache.quotationProjects||[];
    const active=document.querySelector('.quotation-project-card.active');
    const id=active?.dataset?.quotationId;
    return id ? list.find(q=>String(q.id)===String(id))||null : list[0]||null;
  }

  function projectSafeName(name){
    return String(name||'Project Name').replace(/[\\/:*?"<>|]/g,'').trim();
  }

  function updateExample(){
    const q=selectedQuotation();
    const text=`${projectSafeName(q?.project_name)}_Location_YYYY-MM-DD.pdf`;

    const a=$('quotationUploadFormatExample');
    if(a)a.textContent=text;

    const b=$('quotationRequiredFilename');
    if(b)b.textContent=text;
  }

  function showAwareness(){
    const q=selectedQuotation();
    const key=String(q?.id||'none');
    if(shownForProject===key)return;
    shownForProject=key;

    const text=`Required final filename: ${projectSafeName(q?.project_name)}_Location_YYYY-MM-DD.pdf`;
    if(typeof toast==='function')toast(text);
  }

  const input=$('quotationBoqFile');
  if(input){
    input.addEventListener('click',()=>{
      updateExample();
      showAwareness();
    });
    input.addEventListener('focus',updateExample);
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('.quotation-project-card[data-quotation-id]')){
      shownForProject=null;
      setTimeout(updateExample,0);
    }
  },{passive:true});

  updateExample();
})();
