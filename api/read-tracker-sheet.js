import ExcelJS from 'exceljs';

function extractSpreadsheetId(input=''){
  const m=String(input||'').trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m?m[1]:null;
}
function extractSheetGid(input=''){
  const m=String(input||'').match(/[?#&]gid=(\d+)/);
  return m?m[1]:null;
}
function cellText(cell){
  const v=cell?.value;
  if(v==null)return '';

  const isPct=String(cell?.numFmt||'').includes('%');
  const fmtNumber=n=>{
    if(typeof n!=='number'||!Number.isFinite(n))return String(n??'');
    return isPct ? `${n*100}%` : String(n);
  };

  if(v instanceof Date && !Number.isNaN(v.getTime())){
    const y=v.getFullYear();
    const m=String(v.getMonth()+1).padStart(2,'0');
    const d=String(v.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  if(typeof v==='number')return fmtNumber(v);

  if(typeof v==='object'){
    if(v.text!=null)return String(v.text);
    if(v.result!=null){
      if(v.result instanceof Date && !Number.isNaN(v.result.getTime())){
        const y=v.result.getFullYear();
        const m=String(v.result.getMonth()+1).padStart(2,'0');
        const d=String(v.result.getDate()).padStart(2,'0');
        return `${y}-${m}-${d}`;
      }
      if(typeof v.result==='number')return fmtNumber(v.result);
      return String(v.result);
    }
    if(v.richText)return v.richText.map(x=>x.text||'').join('');
    if(v.hyperlink&&v.text)return String(v.text);
  }
  return String(v);
}
function clean(v){
  return String(v??'').replace(/\s+/g,' ').trim();
}
function norm(v){
  return clean(v).toLowerCase().replace(/[^a-z0-9%]+/g,' ').replace(/\s+/g,' ').trim();
}
function parseCsv(csv){
  const rows=[];
  let row=[],field='',quoted=false;
  for(let i=0;i<csv.length;i++){
    const ch=csv[i],next=csv[i+1];
    if(ch==='"'){
      if(quoted&&next==='"'){field+='"';i++;}
      else quoted=!quoted;
    }else if(ch===','&&!quoted){row.push(field);field='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&next==='\n')i++;
      row.push(field);field='';rows.push(row);row=[];
    }else field+=ch;
  }
  if(field.length||row.length){row.push(field);rows.push(row)}
  return rows.filter(r=>r.some(v=>clean(v)!==''));
}
function worksheetRows(ws,{visibleOnly=true}={}){
  const cols=[];
  for(let c=1;c<=ws.columnCount;c++){
    if(!visibleOnly || !ws.getColumn(c).hidden)cols.push(c);
  }
  const rows=[];
  ws.eachRow({includeEmpty:false},row=>{
    if(visibleOnly && row.hidden)return;
    const out=cols.map(c=>cellText(row.getCell(c)));
    if(out.some(v=>clean(v)!==''))rows.push(out);
  });
  return rows;
}
function signature(rows,limit=80){
  const out=[];
  for(const row of rows){
    for(const v of row){
      const x=norm(v);
      if(x && x.length>=3 && !/^\d+(\.\d+)?%?$/.test(x))out.push(x);
      if(out.length>=limit)return out;
    }
  }
  return out;
}
function worksheetMatchScore(ws,csvRows){
  const csvSig=signature(csvRows,70);
  if(!csvSig.length)return 0;
  const sheetSig=new Set(signature(worksheetRows(ws,{visibleOnly:false}),220));
  if(!sheetSig.size)return 0;
  let hit=0;
  for(const x of csvSig)if(sheetSig.has(x))hit++;
  return hit/csvSig.length;
}
async function fetchCsvForGid(id,gid){
  if(!gid)return null;
  const urls=[
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${encodeURIComponent(gid)}`,
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`
  ];
  for(const url of urls){
    try{
      const r=await fetch(url,{redirect:'follow',headers:{
        'user-agent':'Mozilla/5.0 SAIKO-Construction-AI',
        'accept':'text/csv,text/plain,*/*',
        'cache-control':'no-cache'
      }});
      const ct=r.headers.get('content-type')||'';
      const text=await r.text();
      if(!r.ok||ct.includes('text/html')||/accounts\.google\.com|sign in/i.test(text))continue;
      const rows=parseCsv(text);
      if(rows.length)return rows;
    }catch(_){}
  }
  return null;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST only'});
  try{
    const link=req.body?.link;
    const id=extractSpreadsheetId(link);
    const gid=extractSheetGid(link);
    if(!id)return res.status(400).json({ok:false,error:'Paste a valid Google Sheets link.'});
    if(!gid)return res.status(400).json({ok:false,error:'Open the exact Google Sheet tab you want to sync, then copy its link so the URL contains gid=.'});

    // 1) CSV with gid gives us the exact selected Google Sheet tab.
    const selectedCsvRows=await fetchCsvForGid(id,gid);
    if(!selectedCsvRows){
      return res.status(400).json({ok:false,error:'Could not read the selected Google Sheet tab. Keep General access as “Anyone with the link”, then copy the link from the exact tab.'});
    }

    // 2) XLSX preserves hidden row/column metadata.
    const xlsxUrl=`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
    const xr=await fetch(xlsxUrl,{redirect:'follow',headers:{
      'user-agent':'Mozilla/5.0 SAIKO-Construction-AI',
      'accept':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
      'cache-control':'no-cache'
    }});
    if(!xr.ok){
      // Correct tab is more important than failing entirely. Fall back to exact-gid CSV.
      return res.status(200).json({
        ok:true,rows:selectedCsvRows,mode:'csv-gid-fallback',
        rowCount:selectedCsvRows.length,visibleOnly:false,
        warning:'Correct tab detected, but hidden-row metadata was unavailable for this sync.'
      });
    }

    const buf=Buffer.from(await xr.arrayBuffer());
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.load(buf);

    // Google gid is NOT the ExcelJS worksheet index/id.
    // Resolve the worksheet by comparing its content to the exact-gid CSV tab.
    let best=null,bestScore=-1;
    for(const ws of wb.worksheets){
      if(ws.state==='hidden'||ws.state==='veryHidden')continue;
      const score=worksheetMatchScore(ws,selectedCsvRows);
      if(score>bestScore){best=ws;bestScore=score;}
    }

    if(!best || bestScore<0.12){
      // Never silently read the wrong worksheet.
      return res.status(200).json({
        ok:true,rows:selectedCsvRows,mode:'csv-gid-fallback',
        rowCount:selectedCsvRows.length,visibleOnly:false,
        warning:'Exact tab synced. Hidden-row filtering could not be verified for this worksheet.'
      });
    }

    const rows=worksheetRows(best,{visibleOnly:true});
    if(!rows.length){
      return res.status(400).json({ok:false,error:'No visible rows were found in the selected Google Sheet tab.'});
    }

    return res.status(200).json({
      ok:true,
      rows,
      mode:'xlsx-visible-exact-gid',
      worksheet:best.name,
      worksheetMatchScore:Number(bestScore.toFixed(3)),
      rowCount:rows.length,
      visibleOnly:true
    });
  }catch(err){
    console.error(err);
    return res.status(500).json({ok:false,error:err?.message||'Could not read Google Sheet.'});
  }
}
