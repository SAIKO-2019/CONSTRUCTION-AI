import ExcelJS from "exceljs";

function extractSpreadsheetId(input=""){
  const m=String(input||"").trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m?m[1]:null;
}
function extractSheetGid(input=""){
  const s=String(input||"");
  const m=s.match(/[?#&]gid=(\d+)/);
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
  const ws=summaryWorksheet(workbook);
  if(!ws)return {sheetName:null,categories:[],totalArea:null};

  const maxRows=Math.min(ws.rowCount||0,5000);

  function cellText(r,c){ return safeText(ws.getCell(r,c)); }
  function cellNum(r,c){
    const cell=ws.getCell(r,c);
    let n=asNumber(cell?.value);
    if(n===null)n=asNumber(safeText(cell));
    return n;
  }
  function pctNum(r,c){
    const cell=ws.getCell(r,c);
    let n=cell?.value;
    if(n&&typeof n==="object"&&n.result!=null)n=n.result;
    if(typeof n!=="number")n=asNumber(safeText(cell));
    if(!Number.isFinite(n))return null;
    const txt=safeText(cell),fmt=String(cell?.numFmt||"");
    if((txt.includes("%")||fmt.includes("%"))&&n>=0&&n<=1)n*=100;
    return n;
  }
  function isItemNo(v){ return /^[A-Z]$/i.test(String(v||"").trim()); }
  function isSubtotal(v){ return /\bsub\s*-?\s*total\b/i.test(String(v||"")); }

  let totalArea=null;
  for(let r=1;r<=Math.min(maxRows,80);r++){
    for(let c=1;c<=Math.min(ws.getRow(r).cellCount||0,20);c++){
      const t=normalize(cellText(r,c));
      if(t.includes("total area")&&t.includes("sq")){
        for(let dc=1;dc<=4;dc++){
          const n=cellNum(r,c+dc);
          if(Number.isFinite(n)){totalArea=n;break;}
        }
      }
      if(totalArea!==null)break;
    }
    if(totalArea!==null)break;
  }

  const categories=[];
  let current=null;

  function closeCurrent(){
    if(!current)return;
    if(!Number.isFinite(current.amount)){
      const sum=current.items.reduce((s,x)=>s+(Number.isFinite(x.amount)?x.amount:0),0);
      if(sum>0)current.amount=sum;
    }
    if(!Number.isFinite(current.costPerSqm)&&Number.isFinite(current.amount)&&Number.isFinite(totalArea)&&totalArea>0){
      current.costPerSqm=current.amount/totalArea;
    }
    if(!Number.isFinite(current.percentage)){
      const p=current.items.reduce((s,x)=>s+(Number.isFinite(x.percentage)?x.percentage:0),0);
      if(p>0)current.percentage=p;
    }
    categories.push(current);
    current=null;
  }

  // Fixed Summary contract:
  // A = ITEM NO
  // B = WORK ITEM DESCRIPTION
  // C = TOTAL AMOUNT PHP
  // D = COST PER SQ.M
  // E = WEIGHTED %
  for(let r=1;r<=maxRows;r++){
    const itemNo=cellText(r,1).trim();
    const desc=cellText(r,2).replace(/\s+/g," ").trim();

    if(isItemNo(itemNo)&&desc){
      closeCurrent();
      current={
        itemNo:itemNo.toUpperCase(),
        name:desc,
        originalLabel:desc,
        amount:null,
        costPerSqm:null,
        percentage:null,
        source:`${ws.name}!A${r}:E${r}`,
        headerRow:r,
        items:[]
      };
      continue;
    }

    if(!current||!desc)continue;

    const amount=cellNum(r,3);
    const costPerSqm=cellNum(r,4);
    const percentage=pctNum(r,5);

    if(isSubtotal(desc)){
      current.subtotalLabel=desc;
      if(Number.isFinite(amount))current.amount=amount;
      if(Number.isFinite(costPerSqm))current.costPerSqm=costPerSqm;
      if(Number.isFinite(percentage))current.percentage=percentage;
      current.amountCell=`C${r}`;
      current.costPerSqmCell=`D${r}`;
      current.percentCell=`E${r}`;
      current.subtotalSource=`${ws.name}!B${r}:E${r}`;
      continue;
    }

    current.items.push({
      name:desc,
      amount:Number.isFinite(amount)?amount:null,
      costPerSqm:Number.isFinite(costPerSqm)?costPerSqm:null,
      percentage:Number.isFinite(percentage)?percentage:null,
      source:`${ws.name}!B${r}:E${r}`,
      amountCell:`C${r}`,
      costPerSqmCell:`D${r}`,
      percentCell:`E${r}`,
      row:r
    });
  }
  closeCurrent();

  return {
    sheetName:ws.name,
    totalArea,
    categories:categories.map(c=>({
      itemNo:c.itemNo,
      name:c.name,
      originalLabel:c.originalLabel,
      amount:Number.isFinite(c.amount)?c.amount:0,
      costPerSqm:Number.isFinite(c.costPerSqm)?c.costPerSqm:null,
      percentage:Number.isFinite(c.percentage)?c.percentage:0,
      source:c.source,
      headerRow:c.headerRow,
      amountCell:c.amountCell||null,
      costPerSqmCell:c.costPerSqmCell||null,
      percentCell:c.percentCell||null,
      subtotalLabel:c.subtotalLabel||null,
      subtotalSource:c.subtotalSource||null,
      items:c.items
    }))
  };
}

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
  try{
    const link=req.body?.link;
    const id=extractSpreadsheetId(link);
    const gid=extractSheetGid(link);
    if(!id)return res.status(400).json({ok:false,error:"Paste a valid Google Sheets link."});
    const workbook=new ExcelJS.Workbook();
    let loaded=false;
    let accessMode=null;

    function parseCsvIntoSummary(csv){
      if(!csv || /accounts\.google\.com|sign in/i.test(csv))return false;
      const ws=workbook.getWorksheet("SUMMARY") || workbook.addWorksheet("SUMMARY");
      const rows=[];
      let row=[],field="",quoted=false;
      for(let i=0;i<csv.length;i++){
        const ch=csv[i],next=csv[i+1];
        if(ch==='"'){
          if(quoted && next==='"'){field+='"';i++;}
          else quoted=!quoted;
        }else if(ch===',' && !quoted){
          row.push(field);field="";
        }else if((ch==='\n'||ch==='\r') && !quoted){
          if(ch==='\r'&&next==='\n')i++;
          row.push(field);field="";
          rows.push(row);row=[];
        }else field+=ch;
      }
      if(field.length||row.length){row.push(field);rows.push(row);}
      if(!rows.length)return false;
      rows.forEach((vals,r)=>vals.forEach((v,c)=>{ws.getCell(r+1,c+1).value=v;}));
      return true;
    }

    async function tryCsv(url,mode){
      try{
        const r=await fetch(url,{
          redirect:"follow",
          headers:{
            "user-agent":"Mozilla/5.0 SAIKO-Construction-AI",
            "accept":"text/csv,text/plain,*/*",
            "cache-control":"no-cache"
          }
        });
        const body=await r.text();
        const ct=r.headers.get("content-type")||"";
        if(r.ok && !ct.includes("text/html") && parseCsvIntoSummary(body)){
          loaded=true; accessMode=mode; return true;
        }
      }catch(_){ }
      return false;
    }

    // SUMMARY-only app: prefer lightweight CSV first. This avoids XLSX export quirks.
    if(gid){
      await tryCsv(
        `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${encodeURIComponent(gid)}`,
        "csv_gid"
      );
    }

    if(!loaded && gid){
      await tryCsv(
        `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`,
        "gviz_gid"
      );
    }

    if(!loaded){
      await tryCsv(
        `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("SUMMARY")}`,
        "gviz_summary"
      );
    }

    // Final fallback: complete workbook export.
    if(!loaded){
      try{
        const response=await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,{
          redirect:"follow",
          headers:{
            "user-agent":"Mozilla/5.0 SAIKO-Construction-AI",
            "accept":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
            "cache-control":"no-cache"
          }
        });
        const ct=response.headers.get("content-type")||"";
        if(response.ok && !ct.includes("text/html")){
          const buf=Buffer.from(await response.arrayBuffer());
          if(buf.length){
            await workbook.xlsx.load(buf);
            loaded=true;
            accessMode="xlsx";
          }
        }
      }catch(_){ }
    }

    if(!loaded){
      return res.status(400).json({
        ok:false,
        error:"Google Sheet is already shared as Anyone with the link — Editor, but Google did not return the SUMMARY data to the server. Open the SUMMARY tab, click Copy link, then paste that exact link again. No need to change it to Viewer."
      });
    }

    let indirect=null,profit=null,project=null,client=null;
    try{indirect=findMetric(workbook,"indirect",{numeric:true});}catch(_){}
    try{profit=findMetric(workbook,"profit",{numeric:true});}catch(_){}
    try{project=findMetric(workbook,"project",{numeric:false});}catch(_){}
    try{client=findMetric(workbook,"client",{numeric:false});}catch(_){}

    let summary={sheetName:"SUMMARY",totalArea:null,categories:[]};
    try{summary=parseSummarySheet(workbook);}catch(err){console.error("summary parser",err);}

    let fullSummary={headers:[],rows:[],range:null};
    try{fullSummary=readFullSummaryTable(workbook);}catch(err){console.error("summary mirror",err);}
    const firstSheet=(workbook.worksheets?.[0]?.name||`Quotation ${id.slice(0,6)}`).trim();
    const projectName=(project?.value&&String(project.value).trim().length<180)?String(project.value).trim():firstSheet;
    const summaryBreakdown=summary.categories.map(c=>({
      itemNo:c.itemNo,
      name:c.name,
      originalLabel:c.originalLabel,
      amount:Math.round((c.amount||0)*100)/100,
      costPerSqm:Number.isFinite(c.costPerSqm)?Math.round(c.costPerSqm*100)/100:null,
      percentage:Math.round((c.percentage||0)*100)/100,
      source:c.source,
      headerRow:c.headerRow,
      amountCell:c.amountCell,
      costPerSqmCell:c.costPerSqmCell,
      percentCell:c.percentCell,
      subtotalLabel:c.subtotalLabel,
      subtotalSource:c.subtotalSource,
      items:(c.items||[]).map(i=>({
        name:i.name,
        amount:Number.isFinite(i.amount)?Math.round(i.amount*100)/100:null,
        costPerSqm:Number.isFinite(i.costPerSqm)?Math.round(i.costPerSqm*100)/100:null,
        percentage:Number.isFinite(i.percentage)?Math.round(i.percentage*100)/100:null,
        source:i.source,
        amountCell:i.amountCell,
        costPerSqmCell:i.costPerSqmCell,
        percentCell:i.percentCell,
        row:i.row
      }))
    }));
    return res.status(200).json({
      ok:true,spreadsheetId:id,accessMode,projectName,clientName:client?.value?String(client.value).trim():"",
      indirectTotalCost:indirect?.value??null,presentProfit:profit?.value??null,
      summarySheetName:summary.sheetName,summaryTotalArea:summary.totalArea,summaryBreakdown,
      summaryHeaders:fullSummary.headers,
      summaryTable:fullSummary.rows,
      summaryRange:fullSummary.range,
      scopeBreakdown:summaryBreakdown.map(c=>({name:c.name,amount:c.amount,percentage:c.percentage,source:c.source})),
      sources:{summarySheet:summary.sheetName,indirect:indirect?`${indirect.sheet}!${indirect.labelCell} → ${indirect.valueCell}`:null,profit:profit?`${profit.sheet}!${profit.labelCell} → ${profit.valueCell}`:null},
      warnings:[!summaryBreakdown.length?"No major scopes were detected on the Summary sheet.":null].filter(Boolean)
    });
  }catch(err){
    console.error("quotation sheet read",err);
    return res.status(500).json({ok:false,error:"Could not process the Google Sheet data. “Anyone with the link — Editor” is supported; you do not need to change it to Viewer."});
  }
}
