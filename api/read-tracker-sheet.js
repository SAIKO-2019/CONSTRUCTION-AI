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
  if(typeof v==='object'){
    if(v.text!=null)return String(v.text);
    if(v.result!=null)return String(v.result);
    if(v.richText)return v.richText.map(x=>x.text||'').join('');
    if(v.hyperlink&&v.text)return String(v.text);
  }
  return String(v);
}
function worksheetRowsVisibleOnly(ws){
  const visibleCols=[];
  for(let c=1;c<=ws.columnCount;c++){
    const col=ws.getColumn(c);
    if(!col.hidden)visibleCols.push(c);
  }
  const rows=[];
  ws.eachRow({includeEmpty:false},row=>{
    if(row.hidden)return;
    const out=visibleCols.map(c=>cellText(row.getCell(c)));
    if(out.some(v=>String(v||'').trim()!==''))rows.push(out);
  });
  return rows;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST only'});
  try{
    const link=req.body?.link;
    const id=extractSpreadsheetId(link);
    const gid=extractSheetGid(link);
    if(!id)return res.status(400).json({ok:false,error:'Paste a valid Google Sheets link.'});

    const url=`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
    const r=await fetch(url,{redirect:'follow',headers:{
      'user-agent':'Mozilla/5.0 SAIKO-Construction-AI',
      'accept':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
      'cache-control':'no-cache'
    }});
    if(!r.ok){
      return res.status(400).json({ok:false,error:'Google Sheet could not be read. Keep General access as “Anyone with the link”.'});
    }
    const contentType=r.headers.get('content-type')||'';
    if(contentType.includes('text/html')){
      return res.status(400).json({ok:false,error:'Google Sheet returned a sign-in page. Set General access to “Anyone with the link”.'});
    }

    const buf=Buffer.from(await r.arrayBuffer());
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.load(buf);

    let ws=null;
    if(gid){
      // Google stores the sheetId as worksheet.properties.id in xlsx export in most cases.
      ws=wb.worksheets.find(w=>String(w.id)===String(gid) || String(w.properties?.id)===String(gid));
    }
    if(!ws){
      // Fallback: the link's selected tab is not always mappable from gid in xlsx,
      // so use the first visible worksheet.
      ws=wb.worksheets.find(w=>w.state!=='hidden'&&w.state!=='veryHidden')||wb.worksheets[0];
    }
    if(!ws)return res.status(400).json({ok:false,error:'No readable worksheet found.'});

    const rows=worksheetRowsVisibleOnly(ws);
    if(!rows.length)return res.status(400).json({ok:false,error:'No visible rows were found in the selected Google Sheet tab.'});

    return res.status(200).json({
      ok:true,
      rows,
      mode:'xlsx-visible-only',
      worksheet:ws.name,
      rowCount:rows.length,
      visibleOnly:true
    });
  }catch(err){
    console.error(err);
    return res.status(500).json({ok:false,error:err?.message||'Could not read Google Sheet.'});
  }
}
