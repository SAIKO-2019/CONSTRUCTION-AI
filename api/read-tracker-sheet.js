function extractSpreadsheetId(input=''){
  const m=String(input||'').trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m?m[1]:null;
}
function extractSheetGid(input=''){
  const m=String(input||'').match(/[?#&]gid=(\d+)/);
  return m?m[1]:null;
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
  return rows.filter(r=>r.some(v=>String(v||'').trim()!==''));
}
async function tryCsv(url){
  const r=await fetch(url,{redirect:'follow',headers:{
    'user-agent':'Mozilla/5.0 SAIKO-Construction-AI',
    'accept':'text/csv,text/plain,*/*',
    'cache-control':'no-cache'
  }});
  const ct=r.headers.get('content-type')||'';
  const text=await r.text();
  if(!r.ok||ct.includes('text/html')||/accounts\.google\.com|sign in/i.test(text))return null;
  const rows=parseCsv(text);
  return rows.length?rows:null;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST only'});
  try{
    const link=req.body?.link;
    const id=extractSpreadsheetId(link);
    const gid=extractSheetGid(link);
    if(!id)return res.status(400).json({ok:false,error:'Paste a valid Google Sheets link.'});

    let rows=null,mode=null;
    if(gid){
      try{rows=await tryCsv(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${encodeURIComponent(gid)}`);if(rows)mode='csv_gid'}catch(_){ }
    }
    if(!rows&&gid){
      try{rows=await tryCsv(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`);if(rows)mode='gviz_gid'}catch(_){ }
    }
    if(!rows){
      return res.status(400).json({ok:false,error:'Google Sheet could not be read. Keep General access as “Anyone with the link”, then copy the link while the exact Schedule/Actual tab is open so the gid is included.'});
    }
    return res.status(200).json({ok:true,rows,mode,rowCount:rows.length});
  }catch(err){
    console.error(err);
    return res.status(500).json({ok:false,error:err?.message||'Could not read Google Sheet.'});
  }
}
