import ExcelJS from "exceljs";

function extractSpreadsheetId(input=""){
  const m=String(input||"").trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m?m[1]:null;
}
function safeText(cell){
  try{
    if(!cell)return "";
    if(typeof cell.text==="string"&&cell.text.trim())return cell.text.trim();
    const v=cell.value;
    if(v==null)return "";
    if(typeof v==="string"||typeof v==="number"||typeof v==="boolean")return String(v).trim();
    if(typeof v==="object"){
      if(typeof v.text==="string")return v.text.trim();
      if(v.result!=null)return String(v.result).trim();
      if(Array.isArray(v.richText))return v.richText.map(x=>x?.text||"").join("").trim();
    }
    return "";
  }catch(_){return ""}
}
function normalize(v){
  return String(v??"").toLowerCase().replace(/\u00a0/g," ").replace(/[^a-z0-9%]+/g," ").replace(/\s+/g," ").trim();
}
function asNumber(v){
  if(typeof v==="number"&&Number.isFinite(v))return v;
  if(v&&typeof v==="object"){
    if(typeof v.result==="number"&&Number.isFinite(v.result))return v.result;
    if(v.result!=null)v=v.result; else if(typeof v.text==="string")v=v.text;
  }
  const s=String(v??"").replace(/[₱,$,%\s]/g,"").replace(/,/g,"");
  if(!s||!/^[-+]?\d*\.?\d+$/.test(s))return null;
  const n=Number(s); return Number.isFinite(n)?n:null;
}
function nearbyValue(ws,row,col,{numeric=false}={}){
  const positions=[];
  for(let dc=1;dc<=10;dc++)positions.push([row,col+dc]);
  for(let dr=1;dr<=5;dr++)for(let dc=0;dc<=5;dc++)positions.push([row+dr,col+dc]);
  for(const [r,c] of positions){
    const cell=ws.getCell(r,c);
    if(numeric){const n=asNumber(cell?.value);if(n!==null)return{value:n,cell:cell.address}}
    else{const t=safeText(cell);if(t)return{value:t,cell:cell.address}}
  }
  return null;
}
function metricMatch(kind,text){
  const n=normalize(text);
  if(kind==="indirect")return n.includes("indirect")&&n.includes("total")&&n.includes("cost");
  if(kind==="profit")return (n.includes("present")&&n.includes("profit"))||n.includes("current profit");
  if(kind==="project")return ["project name","project title","project","quotation project","project opportunity name"].includes(n);
  if(kind==="client")return ["client","client name","owner","owner name"].includes(n);
  return false;
}
function findMetric(workbook,kind,{numeric=true}={}){
  for(const ws of workbook.worksheets||[]){
    const maxRows=Math.min(ws.rowCount||0,5000);
    for(let r=1;r<=maxRows;r++){
      const row=ws.getRow(r),maxCols=Math.min(Math.max(row.cellCount||0,1),200);
      for(let c=1;c<=maxCols;c++){
        const cell=row.getCell(c),text=safeText(cell);
        if(!text||!metricMatch(kind,text))continue;
        const found=nearbyValue(ws,r,c,{numeric});
        if(found)return{value:found.value,sheet:ws.name||"Sheet",labelCell:cell.address,valueCell:found.cell,label:text};
      }
    }
  }
  return null;
}

const EXACT_SCOPE_ALIASES=new Map([
  ["general requirements","General Requirements"],["general requirement","General Requirements"],["gen req","General Requirements"],["genreq","General Requirements"],
  ["earth works","Earth Works"],["earthworks","Earth Works"],["earth work","Earth Works"],
  ["structural works","Structural"],["structural","Structural"],
  ["architectural works","Architectural"],["architectural","Architectural"],
  ["electrical works","Electrical"],["electrical","Electrical"],
  ["plumbing works","Plumbing"],["plumbing","Plumbing"],
  ["mechanical works","Mechanical"],["mechanical","Mechanical"],
  ["auxiliary works","Auxiliary Works"],["auxiliary","Auxiliary Works"],
  ["fire protection works","Fire Protection"],["fire protection","Fire Protection"],
  ["sanitary works","Sanitary"],["sanitary","Sanitary"],
  ["civil works","Civil Works"],["site development works","Site Development"],["site development","Site Development"],
  ["landscaping works","Landscaping"],["landscaping","Landscaping"],
  ["specialty works","Specialties"],["specialties","Specialties"],["equipment works","Equipment"],["equipment","Equipment"]
]);
function titleCaseWords(s){return String(s||"").toLowerCase().replace(/\b\w/g,m=>m.toUpperCase())}
function canonicalHeading(text){
  const raw=String(text||"").replace(/\s+/g," ").trim();
  const n=normalize(raw);
  if(EXACT_SCOPE_ALIASES.has(n))return EXACT_SCOPE_ALIASES.get(n);
  // Generic user-defined major scopes are accepted only when the WHOLE label ends in WORKS.
  if(/\bworks\s*$/i.test(raw) && raw.length<=80)return titleCaseWords(raw.replace(/[:;]+$/,""));
  return null;
}
function isSubtotal(text){return /\bsub\s*-?\s*total\b/i.test(String(text||""))}
function subtotalName(text){
  const cleaned=String(text||"").replace(/\bsub\s*-?\s*total\b\s*:?/ig,"").replace(/[:;]+$/g,"").trim();
  return canonicalHeading(cleaned)||titleCaseWords(cleaned);
}
function isPercentCell(cell){
  const txt=safeText(cell),fmt=String(cell?.numFmt||"");
  return txt.includes("%")||fmt.includes("%");
}
function getDescriptionCell(ws,rowNum){
  const row=ws.getRow(rowNum),max=Math.min(Math.max(row.cellCount||0,1),60);
  // Prefer B onward. Column A in the user's Summary contains section letters A/B/C/D...
  for(let c=2;c<=max;c++){
    const t=safeText(row.getCell(c));
    if(!t)continue;
    const n=normalize(t);
    if(["amount","total","percentage","percent","%","rate","unit cost"].includes(n))continue;
    return{text:t,col:c,cell:row.getCell(c).address};
  }
  // fallback to A only if it isn't a section code / sequence number
  const a=safeText(row.getCell(1));
  if(a&&!/^[a-z]$/i.test(a)&&!/^\d+[.)-]?$/.test(a))return{text:a,col:1,cell:row.getCell(1).address};
  return null;
}
function firstAmountAfter(ws,rowNum,labelCol){
  const row=ws.getRow(rowNum),max=Math.min(Math.max(row.cellCount||0,1),120);
  for(let c=labelCol+1;c<=max;c++){
    const cell=row.getCell(c);
    if(isPercentCell(cell))continue;
    let n=asNumber(cell?.value); if(n===null)n=asNumber(safeText(cell));
    if(n!==null)return{value:n,cell:cell.address,col:c};
  }
  return null;
}
function firstPercentAfter(ws,rowNum,labelCol){
  const row=ws.getRow(rowNum),max=Math.min(Math.max(row.cellCount||0,1),120);
  for(let c=labelCol+1;c<=max;c++){
    const cell=row.getCell(c); if(!isPercentCell(cell))continue;
    let n=cell?.value;
    if(n&&typeof n==="object"&&n.result!=null)n=n.result;
    if(typeof n!=="number")n=asNumber(safeText(cell));
    if(!Number.isFinite(n))continue;
    if(n>=0&&n<=1)n*=100;
    return{value:n,cell:cell.address,col:c};
  }
  return null;
}
function summaryWorksheet(workbook){
  const sheets=workbook.worksheets||[];
  return sheets.find(ws=>normalize(ws.name)==="summary")||sheets.find(ws=>normalize(ws.name).includes("summary"))||sheets[0]||null;
}
function parseSummarySheet(workbook){
  const ws=summaryWorksheet(workbook); if(!ws)return{sheetName:null,categories:[]};
  const maxRows=Math.min(ws.rowCount||0,5000);
  const cats=[]; let current=null;
  function ensureCategory(name,source){
    if(current&&normalize(current.name)===normalize(name))return current;
    if(current)cats.push(current);
    current={name,originalLabel:name,amount:null,percentage:null,source,items:[]};
    return current;
  }
  function close(){if(current){cats.push(current);current=null}}

  for(let r=1;r<=maxRows;r++){
    const desc=getDescriptionCell(ws,r); if(!desc)continue;
    const raw=String(desc.text).replace(/\s+/g," ").trim();
    const n=normalize(raw); if(!raw||raw.length>180)continue;
    const amount=firstAmountAfter(ws,r,desc.col);
    const pct=firstPercentAfter(ws,r,desc.col);

    // Subtotal is authoritative and closes the category.
    if(isSubtotal(raw)){
      const name=subtotalName(raw)||current?.name||"Other";
      if(!current||normalize(current.name)!==normalize(name))ensureCategory(name,`${ws.name}!${desc.cell}`);
      if(amount)current.amount=amount.value;
      if(pct)current.percentage=pct.value;
      current.subtotalSource=`${ws.name}!${desc.cell}`;
      current.subtotalAmountCell=amount?.cell||null;
      current.subtotalPercentCell=pct?.cell||null;
      close();
      continue;
    }

    const heading=canonicalHeading(raw);
    if(heading && !amount){
      ensureCategory(heading,`${ws.name}!${desc.cell}`);
      current.originalLabel=raw;
      continue;
    }

    // Ignore final summary metrics as line items.
    if(n.includes("grand total")||n.includes("indirect total cost")||n.includes("present profit")||n==="total project cost")continue;

    // If a row has an amount but no heading yet, preserve it in an Other block instead of dropping it.
    if(amount){
      if(!current)ensureCategory("Other",`${ws.name}!${desc.cell}`);
      current.items.push({
        name:raw,
        amount:amount.value,
        percentage:pct?.value??null,
        source:`${ws.name}!${desc.cell}`,
        amountCell:amount.cell,
        percentCell:pct?.cell||null
      });
    }
  }
  close();

  // Merge accidental adjacent/duplicate categories by exact category name.
  const merged=[];
  for(const c of cats){
    const key=normalize(c.name); let m=merged.find(x=>normalize(x.name)===key);
    if(!m){m={...c,items:[...(c.items||[])]};merged.push(m)}
    else{
      m.items.push(...(c.items||[]));
      if(Number.isFinite(c.amount)&&c.amount>0)m.amount=c.amount;
      if(Number.isFinite(c.percentage))m.percentage=c.percentage;
      if(c.subtotalSource)m.subtotalSource=c.subtotalSource;
      if(c.subtotalAmountCell)m.subtotalAmountCell=c.subtotalAmountCell;
      if(c.subtotalPercentCell)m.subtotalPercentCell=c.subtotalPercentCell;
    }
  }

  const cleaned=merged.map(c=>{
    let amount=Number.isFinite(c.amount)&&c.amount>0?c.amount:null;
    if(amount===null){const s=(c.items||[]).reduce((a,x)=>a+(Number.isFinite(x.amount)?x.amount:0),0);if(s>0)amount=s}
    return{...c,amount,items:(c.items||[]).filter(x=>Number.isFinite(x.amount)&&x.amount>=0).slice(0,150)};
  }).filter(c=>c.amount!==null||c.items.length);

  const total=cleaned.reduce((s,c)=>s+(c.amount||0),0);
  return{
    sheetName:ws.name,
    categories:cleaned.map(c=>({
      name:c.name,originalLabel:c.originalLabel,amount:c.amount||0,
      percentage:Number.isFinite(c.percentage)?c.percentage:(total>0?(c.amount||0)/total*100:0),
      source:c.source,amountCell:c.subtotalAmountCell||null,percentCell:c.subtotalPercentCell||null,
      items:c.items.map(i=>({
        ...i,
        percentage:Number.isFinite(i.percentage)?i.percentage:((c.amount||0)>0?i.amount/(c.amount||0)*100:0)
      }))
    }))
  };
}

function columnLetter(n){
  let s="";
  while(n>0){ n--; s=String.fromCharCode(65+(n%26))+s; n=Math.floor(n/26); }
  return s;
}

function readFullSummaryTable(workbook){
  const ws=summaryWorksheet(workbook);
  if(!ws)return {sheetName:null,headers:[],rows:[],range:null};

  const maxRows=Math.min(ws.rowCount||0,5000);
  let maxCols=0;
  for(let r=1;r<=maxRows;r++){
    maxCols=Math.max(maxCols,Math.min(ws.getRow(r).cellCount||0,120));
  }
  if(!maxCols)return {sheetName:ws.name,headers:[],rows:[],range:null};

  let firstCol=maxCols,lastCol=1,firstRow=maxRows,lastRow=1,found=false;
  for(let r=1;r<=maxRows;r++){
    for(let c=1;c<=maxCols;c++){
      const t=safeText(ws.getCell(r,c));
      if(t!==""){
        found=true;
        firstCol=Math.min(firstCol,c); lastCol=Math.max(lastCol,c);
        firstRow=Math.min(firstRow,r); lastRow=Math.max(lastRow,r);
      }
    }
  }
  if(!found)return {sheetName:ws.name,headers:[],rows:[],range:null};

  const headers=[];
  for(let c=firstCol;c<=lastCol;c++){
    headers.push({key:columnLetter(c),label:columnLetter(c),column:c});
  }

  const rows=[];
  for(let r=firstRow;r<=lastRow;r++){
    let hasAny=false;
    const cells=[];
    for(let c=firstCol;c<=lastCol;c++){
      const cell=ws.getCell(r,c);
      const display=safeText(cell);
      if(display!=="")hasAny=true;

      let numeric=asNumber(cell?.value);
      if(numeric===null)numeric=asNumber(display);

      const isPercent=isPercentCell(cell);
      let percentage=null;
      if(isPercent && numeric!==null){
        percentage=(numeric>=0&&numeric<=1)?numeric*100:numeric;
      }

      cells.push({
        column:columnLetter(c),
        address:cell.address,
        display,
        numeric,
        isPercent,
        percentage,
        numberFormat:String(cell?.numFmt||""),
        bold:!!cell?.font?.bold,
        italic:!!cell?.font?.italic,
        align:cell?.alignment?.horizontal||null
      });
    }
    if(hasAny)rows.push({row:r,cells});
  }

  return {
    sheetName:ws.name,
    headers,
    rows,
    range:`${columnLetter(firstCol)}${firstRow}:${columnLetter(lastCol)}${lastRow}`
  };
}

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
  try{
    const id=extractSpreadsheetId(req.body?.link);
    if(!id)return res.status(400).json({ok:false,error:"Paste a valid Google Sheets link."});
    const response=await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,{redirect:"follow",headers:{"user-agent":"SAIKO-Construction-AI/1.0"}});
    if(!response.ok)return res.status(400).json({ok:false,error:"Google Sheet could not be read. Set Share access to Anyone with the link → Viewer, then try again."});
    const ct=response.headers.get("content-type")||"";
    if(ct.includes("text/html"))return res.status(400).json({ok:false,error:"Google returned a sign-in page. Set the Google Sheet to Anyone with the link → Viewer."});
    const buf=Buffer.from(await response.arrayBuffer()); if(!buf.length)return res.status(400).json({ok:false,error:"Google Sheet export was empty."});
    const workbook=new ExcelJS.Workbook(); await workbook.xlsx.load(buf);
    const indirect=findMetric(workbook,"indirect",{numeric:true});
    const profit=findMetric(workbook,"profit",{numeric:true});
    const project=findMetric(workbook,"project",{numeric:false});
    const client=findMetric(workbook,"client",{numeric:false});
    const summary=parseSummarySheet(workbook);
    const fullSummary=readFullSummaryTable(workbook);
    const firstSheet=(workbook.worksheets?.[0]?.name||`Quotation ${id.slice(0,6)}`).trim();
    const projectName=(project?.value&&String(project.value).trim().length<180)?String(project.value).trim():firstSheet;
    const summaryBreakdown=summary.categories.map(c=>({
      name:c.name,originalLabel:c.originalLabel,amount:Math.round((c.amount||0)*100)/100,
      percentage:Math.round((c.percentage||0)*100)/100,source:c.source,amountCell:c.amountCell,percentCell:c.percentCell,
      items:(c.items||[]).map(i=>({name:i.name,amount:Math.round((i.amount||0)*100)/100,percentage:Math.round((i.percentage||0)*100)/100,source:i.source,amountCell:i.amountCell,percentCell:i.percentCell}))
    }));
    return res.status(200).json({
      ok:true,spreadsheetId:id,projectName,clientName:client?.value?String(client.value).trim():"",
      indirectTotalCost:indirect?.value??null,presentProfit:profit?.value??null,
      summarySheetName:summary.sheetName,summaryBreakdown,
      summaryHeaders:fullSummary.headers,
      summaryTable:fullSummary.rows,
      summaryRange:fullSummary.range,
      scopeBreakdown:summaryBreakdown.map(c=>({name:c.name,amount:c.amount,percentage:c.percentage,source:c.source})),
      sources:{summarySheet:summary.sheetName,indirect:indirect?`${indirect.sheet}!${indirect.labelCell} → ${indirect.valueCell}`:null,profit:profit?`${profit.sheet}!${profit.labelCell} → ${profit.valueCell}`:null},
      warnings:[!summaryBreakdown.length?"No major scopes were detected on the Summary sheet.":null].filter(Boolean)
    });
  }catch(err){
    console.error("quotation sheet read",err);
    return res.status(500).json({ok:false,error:"Could not read this Google Sheet. Make sure the link is valid and shared as Anyone with the link → Viewer."});
  }
}
