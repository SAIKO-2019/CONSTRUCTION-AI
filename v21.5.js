// SAIKO Construction AI v21.5 — strict final quotation PDF validation
(function(){
  const $=id=>document.getElementById(id);
  function selectedQuotation(){
    const list=cache.quotationProjects||[];
    const active=document.querySelector('.quotation-project-card.active');
    const id=active?.dataset?.quotationId;
    return id ? list.find(q=>String(q.id)===String(id))||null : list[0]||null;
  }
  function normalizeName(s){
    return String(s||'').trim().replace(/\s+/g,' ').replace(/[\\/:*?"<>|]/g,'').toLowerCase();
  }
  function isValidIsoDate(s){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
    const [y,m,d]=s.split('-').map(Number),dt=new Date(y,m-1,d);
    return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d;
  }
  function validate(file,q){
    if(!file)return{ok:false,message:'Choose a PDF file first.'};
    const mime=String(file.type||'').toLowerCase();
    if(!/\.pdf$/i.test(file.name)||(mime&&mime!=='application/pdf'))return{ok:false,message:'Rejected: final quotation file must be PDF only.'};
    const base=file.name.replace(/\.pdf$/i,'');
    const parts=base.split('_').map(x=>x.trim());
    if(parts.length!==3)return{ok:false,message:'Rejected: filename must be Project Name_Location_YYYY-MM-DD.pdf'};
    const [projectPart,locationPart,datePart]=parts;
    if(normalizeName(projectPart)!==normalizeName(q?.project_name))return{ok:false,message:`Rejected: project name must match exactly: ${q?.project_name||'Project Name'}`};
    if(!locationPart||locationPart.length<2)return{ok:false,message:'Rejected: Location is required in the filename.'};
    if(!isValidIsoDate(datePart))return{ok:false,message:'Rejected: Date completed must use YYYY-MM-DD.'};
    return{ok:true,location:locationPart,dateCompleted:datePart};
  }
  function showRule(){
    const q=selectedQuotation(),el=$('quotationRequiredFilename');
    if(el){
      const p=String(q?.project_name||'Project Name').replace(/[\\/:*?"<>|]/g,'').trim();
      el.textContent=`${p}_Location_YYYY-MM-DD.pdf`;
    }
  }
  function clearError(){
    $('quotationFinalFileRule')?.classList.remove('has-error');
    const e=$('quotationFileValidationError'); if(e)e.textContent='';
  }
  function reject(input,message){
    input.value='';
    const rule=$('quotationFinalFileRule');
    if(rule){
      rule.classList.add('has-error');
      let e=$('quotationFileValidationError');
      if(!e){e=document.createElement('div');e.id='quotationFileValidationError';e.className='quotation-file-validation-error';rule.appendChild(e)}
      e.textContent=message;
    }
    if(typeof toast==='function')toast(message);
  }

  const input=$('quotationBoqFile');
  const uploadBtn=$('saveQuotationDataBtn');
  if(input){
    input.setAttribute('accept','application/pdf,.pdf');
    input.addEventListener('change',()=>{
      clearError();
      const file=input.files?.[0]; if(!file)return;
      const check=validate(file,selectedQuotation());
      if(!check.ok){reject(input,check.message);return}
      if(typeof toast==='function')toast('PDF filename verified. Ready to upload.');
    });
  }
  if(uploadBtn){
    uploadBtn.addEventListener('click',e=>{
      const check=validate(input?.files?.[0],selectedQuotation());
      if(!check.ok){
        e.preventDefault(); e.stopImmediatePropagation();
        if(input)reject(input,check.message);
        return false;
      }
      clearError();
    },true);
  }
  document.addEventListener('click',e=>{
    if(e.target.closest?.('.quotation-project-card[data-quotation-id]'))setTimeout(showRule,0);
  },{passive:true});
  showRule();
  window.validateQuotationFinalPdf=validate;
})();
