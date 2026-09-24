import ExcelJS from "exceljs";

function extractSpreadsheetId(input=""){
  const s=String(input||"").trim();
  const m=s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

function safeText(cell){
  try{
    if(!cell) return "";
    if(typeof cell.text==="string" && cell.text.trim()) return cell.text.trim();
    const v=cell.value;
    if(v==null) return "";
    if(typeof v==="string" || typeof v==="number" || typeof v==="boolean") return String(v).trim();
    if(typeof v==="object"){
      if(typeof v.text==="string") return v.text.trim();
      if(v.result!=null) return String(v.result).trim();
      if(Array.isArray(v.richText)) return v.richText.map(x=>x?.text||"").join("").trim();
      if(v.hyperlink && v.text) return String(v.text).trim();
    }
    return "";
  }catch(_e){ return ""; }
}

function normalize(v){
  return String(v??"").toLowerCase()
    .replace(/\u00a0/g," ")
    .replace(/[^a-z0-9%]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function asNumber(v){
  if(typeof v==="number" && Number.isFinite(v)) return v;
  if(v && typeof v==="object"){
    if(typeof v.result==="number" && Number.isFinite(v.result)) return v.result;
    if(v.result!=null) v=v.result;
    else if(typeof v.text==="string") v=v.text;
  }
  const s=String(v??"").replace(/[₱,$,%\s]/g,"").replace(/,/g,"");
  if(!s || !/^[-+]?\d*\.?\d+$/.test(s)) return null;
  const n=Number(s);
  return Number.isFinite(n)?n:null;
}

function nearbyValue(ws,row,col,{numeric=false}={}){
  const positions=[];
  for(let dc=1;dc<=10;dc++) positions.push([row,col+dc]);
  for(let dr=1;dr<=5;dr++) for(let dc=0;dc<=5;dc++) positions.push([row+dr,col+dc]);
  for(const [r,c] of positions){
    const cell=ws.getCell(r,c);
    if(numeric){
      const n=asNumber(cell?.value);
      if(n!==null) return {value:n,cell:cell.address};
    }else{
      const t=safeText(cell);
      if(t) return {value:t,cell:cell.address};
    }
  }
  return null;
}

function metricMatch(kind,text){
  const n=normalize(text);
  if(kind==="indirect") return n.includes("indirect") && n.includes("total") && n.includes("cost");
  if(kind==="profit") return (n.includes("present") && n.includes("profit")) || n.includes("current profit");
  if(kind==="project") return ["project name","project title","project","quotation project","project opportunity name"].includes(n);
  if(kind==="client") return ["client","client name","owner","owner name"].includes(n);
  return false;
}

function findMetric(workbook,kind,{numeric=true}={}){
  for(const ws of workbook.worksheets||[]){
    const maxRows=Math.min(ws.rowCount||0,5000);
    for(let r=1;r<=maxRows;r++){
      const row=ws.getRow(r);
      const maxCols=Math.min(Math.max(row.cellCount||0,1),200);
      for(let c=1;c<=maxCols;c++){
        const cell=row.getCell(c);
        const text=safeText(cell);
        if(!text || !metricMatch(kind,text)) continue;
        const found=nearbyValue(ws,r,c,{numeric});
        if(found){
          return {value:found.value,sheet:ws.name||"Sheet",labelCell:cell.address,valueCell:found.cell,label:text};
        }
      }
    }
  }
  return null;
}

const MAJOR_SCOPE_ALIASES = [
  ["General Requirements",["general requirements","general requirement","gen req","genreq","preliminaries","preliminary works"]],
  ["Earth Works",["earth works","earthworks","earth work","site earthworks"]],
  ["Architectural",["architectural","architecture","architectural works","finishing works","finishes"]],
  ["Structural",["structural","structural works","civil structural","concrete works","reinforced concrete"]],
  ["Electrical",["electrical","electrical works"]],
  ["Plumbing",["plumbing","plumbing works","sanitary plumbing"]],
  ["Mechanical",["mechanical","mechanical works","hvac","air conditioning","ventilation"]],
  ["Fire Protection",["fire protection","fire protection works","fdas","sprinkler"]],
  ["Sanitary",["sanitary","sanitary works","sewerage","sewage"]],
  ["Civil / Site Development",["civil works","site development","site development works","earthworks","roadworks"]],
  ["Auxiliary Works",["auxiliary","electronics","auxiliary works","structured cabling","cctv"]],
  ["Landscaping",["landscaping","landscape","landscape works"]],
  ["Specialties",["specialties","specialty works"]],
  ["Equipment",["equipment","equipment works"]],
  ["Other",["other","others","miscellaneous","misc works","miscellaneous works"]]
];

function canonicalMajorScope(text){
  const n=normalize(text);
  if(!n) return null;
  for(const [canonical,aliases] of MAJOR_SCOPE_ALIASES){
    for(const a of aliases){
      if(n===a || n.startsWith(a+" ") || n.includes(" "+a+" ")) return canonical;
    }
  }
  return null;
}

function isPercentCell(cell){
  if(!cell) return false;
  const fmt=String(cell.numFmt||"").toLowerCase();
  const txt=safeText(cell);
  return fmt.includes("%") || txt.includes("%");
}

function firstAmountNumeric(ws,rowNum,labelCol){
  const row=ws.getRow(rowNum);
  const maxCols=Math.min(Math.max(row.cellCount||0,1),160);
  for(let c=Math.max(1,labelCol+1);c<=maxCols;c++){
    const cell=row.getCell(c);
    if(isPercentCell(cell)) continue;
    let n=asNumber(cell?.value);
    if(n===null) n=asNumber(safeText(cell));
    if(n===null) continue;
    return {value:n,cell:cell.address,col:c};
  }
  return null;
}

function percentNumeric(ws,rowNum,labelCol){
  const row=ws.getRow(rowNum);
  const maxCols=Math.min(Math.max(row.cellCount||0,1),160);
  for(let c=Math.max(1,labelCol+1);c<=maxCols;c++){
    const cell=row.getCell(c);
    const txt=safeText(cell);
    const fmt=String(cell.numFmt||"").toLowerCase();
    if(!(txt.includes("%") || fmt.includes("%"))) continue;
    let n=cell?.value;
    if(n && typeof n==="object" && n.result!=null) n=n.result;
    if(typeof n!=="number") n=asNumber(txt);
    if(!Number.isFinite(n)) continue;
    if(n>=0 && n<=1) n*=100;
    return {value:n,cell:cell.address,col:c};
  }
  return null;
}

function firstMeaningfulText(ws,rowNum){
  const row=ws.getRow(rowNum);
  const maxCols=Math.min(Math.max(row.cellCount||0,1),80);
  for(let c=1;c<=maxCols;c++){
    const t=safeText(row.getCell(c));
    if(!t) continue;
    const n=normalize(t);
    if(n==="amount" || n==="total" || n==="percentage" || n==="percent" || n==="%") continue;
    return {text:t,col:c,cell:row.getCell(c).address};
  }
  return null;
}

function summaryWorksheet(workbook){
  const sheets=workbook.worksheets||[];
  if(!sheets.length) return null;
  const exact=sheets.find(ws=>normalize(ws.name)==="summary");
  if(exact) return exact;
  const contains=sheets.find(ws=>normalize(ws.name).includes("summary"));
  return contains || sheets[0];
}

function isSubtotalLabel(text){
  const n=normalize(text);
  return n.includes("sub total") || n.includes("subtotal");
}

function normalizeHeadingLabel(text){
  return String(text||"")
    .replace(/\bsub[- ]?total\s*:?/ig,"")
    .replace(/\s+/g," ")
    .trim();
}

function canonicalSummaryHeading(text){
  if(isSubtotalLabel(text)) return null;
  const direct=canonicalMajorScope(text);
  if(direct) return direct;
  const n=normalize(text);
  // Major headings in SAIKO summaries commonly end in WORKS.
  if(n.endsWith(" works") && n.split(" ").length<=5){
    return String(text).replace(/\s+/g," ").trim()
      .toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
  }
  return null;
}

function parseSummarySheet(workbook){
  const ws=summaryWorksheet(workbook);
  if(!ws) return {sheetName:null,categories:[]};

  const maxRows=Math.min(ws.rowCount||0,4000);
  const categories=[];
  let current=null;

  function flush(){
    if(!current) return;
    // Prefer the explicit Sub-total row. If unavailable, sum child items.
    if((!Number.isFinite(current.amount) || current.amount<=0) && current.items.length){
      const sum=current.items.reduce((s,x)=>s+(Number.isFinite(x.amount)&&x.amount>0?x.amount:0),0);
      if(sum>0) current.amount=sum;
    }
    categories.push(current);
    current=null;
  }

  for(let r=1;r<=maxRows;r++){
    const label=firstMeaningfulText(ws,r);
    if(!label) continue;
    const raw=String(label.text).replace(/\s+/g," ").trim();
    const n=normalize(raw);
    if(!raw || raw.length>180) continue;

    const amountCell=firstAmountNumeric(ws,r,label.col); // first number after description = column C in the shown Summary
    const percentCell=percentNumeric(ws,r,label.col);     // percentage-formatted cell = column E in the shown Summary

    // IMPORTANT: handle subtotal BEFORE heading detection. Example: "Structural Sub-total:".
    if(isSubtotalLabel(raw)){
      if(current){
        if(amountCell && Number.isFinite(amountCell.value)) current.amount=amountCell.value;
        if(percentCell && Number.isFinite(percentCell.value)) current.percentage=percentCell.value;
        current.subtotalSource=`${ws.name}!${label.cell}`;
        current.subtotalAmountCell=amountCell?.cell||null;
        current.subtotalPercentCell=percentCell?.cell||null;
      }
      continue;
    }

    const major=canonicalSummaryHeading(raw);
    if(major){
      flush();
      current={
        name:major,
        originalLabel:raw,
        amount:null,
        percentage:null,
        source:`${ws.name}!${label.cell}`,
        amountCell:null,
        items:[]
      };
      continue;
    }

    if(!current) continue;

    if(n.includes("grand total") || n.includes("indirect total cost") || n.includes("present profit") || n==="total project cost") continue;

    if(amountCell && Number.isFinite(amountCell.value)){
      const looksHeader=n==="scope" || n==="description" || n==="particulars" || n==="works";
      if(!looksHeader && raw.length>=2){
        current.items.push({
          name:raw,
          amount:amountCell.value,
          percentage:percentCell?.value??null,
          source:`${ws.name}!${label.cell}`,
          amountCell:amountCell.cell,
          percentCell:percentCell?.cell||null
        });
      }
    }
  }
  flush();

  const cleaned=categories
    .map(c=>({
      ...c,
      amount:Number.isFinite(c.amount)&&c.amount>0?c.amount:null,
      percentage:Number.isFinite(c.percentage)?c.percentage:null,
      items:(c.items||[]).filter(x=>Number.isFinite(x.amount)&&x.amount>=0).slice(0,100)
    }))
    .filter(c=>c.amount!==null || c.items.length);

  // Prefer the explicit percentages from the Summary sheet. Only calculate when missing.
  const amountTotal=cleaned.reduce((s,c)=>s+(c.amount||0),0);
  const final=cleaned.map(c=>({
    name:c.name,
    originalLabel:c.originalLabel,
    amount:c.amount||0,
    percentage:Number.isFinite(c.percentage)
      ? c.percentage
      : (amountTotal>0 ? (c.amount||0)/amountTotal*100 : 0),
    source:c.source,
    amountCell:c.subtotalAmountCell||c.amountCell,
    percentCell:c.subtotalPercentCell||null,
    items:c.items.map(i=>({
      ...i,
      percentage:Number.isFinite(i.percentage)
        ? i.percentage
        : ((c.amount||0)>0 ? i.amount/(c.amount||0)*100 : 0)
    }))
  }));

  return {sheetName:ws.name,categories:final};
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({ok:false,error:"Method not allowed"});
  try{
    const link=req.body?.link;
    const id=extractSpreadsheetId(link);
    if(!id) return res.status(400).json({ok:false,error:"Paste a valid Google Sheets link."});

    const exportUrl=`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
    const response=await fetch(exportUrl,{
      redirect:"follow",
      headers:{"user-agent":"SAIKO-Construction-AI/1.0"}
    });

    if(!response.ok){
      return res.status(400).json({ok:false,error:"Google Sheet could not be read. Set Share access to Anyone with the link → Viewer, then try again."});
    }

    const contentType=response.headers.get("content-type")||"";
    if(contentType.includes("text/html")){
      return res.status(400).json({ok:false,error:"Google returned a sign-in page. Set the Google Sheet to Anyone with the link → Viewer."});
    }

    const buf=Buffer.from(await response.arrayBuffer());
    if(!buf.length) return res.status(400).json({ok:false,error:"Google Sheet export was empty."});

    const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);

    const indirect=findMetric(workbook,"indirect",{numeric:true});
    const profit=findMetric(workbook,"profit",{numeric:true});
    const project=findMetric(workbook,"project",{numeric:false});
    const client=findMetric(workbook,"client",{numeric:false});
    const summary=parseSummarySheet(workbook);

    const firstSheet=(workbook.worksheets?.[0]?.name || `Quotation ${id.slice(0,6)}`).trim();
    const projectName=(project?.value && String(project.value).trim().length<180)
      ? String(project.value).trim()
      : firstSheet;

    if(!indirect && !profit && !summary.categories.length){
      return res.status(422).json({ok:false,error:"The Google Sheet opened, but the quotation summary values could not be detected."});
    }

    return res.status(200).json({
      ok:true,
      spreadsheetId:id,
      projectName,
      clientName:client?.value ? String(client.value).trim() : "",
      indirectTotalCost:indirect?.value ?? null,
      presentProfit:profit?.value ?? null,
      summarySheetName:summary.sheetName,
      summaryBreakdown:summary.categories.map(c=>({
        name:c.name,
        originalLabel:c.originalLabel,
        amount:Math.round((c.amount||0)*100)/100,
        percentage:Math.round((c.percentage||0)*100)/100,
        source:c.source,
        amountCell:c.amountCell,
        items:(c.items||[]).map(i=>({
          name:i.name,
          amount:Math.round((i.amount||0)*100)/100,
          percentage:Math.round((i.percentage||0)*100)/100,
          source:i.source,
          amountCell:i.amountCell
        }))
      })),
      // Backward compatibility: the scope pie uses the same top-level summary categories.
      scopeBreakdown:summary.categories.map(c=>({
        name:c.name,
        amount:Math.round((c.amount||0)*100)/100,
        percentage:Math.round((c.percentage||0)*100)/100,
        source:c.source
      })),
      sources:{
        project:project ? `${project.sheet}!${project.labelCell} → ${project.valueCell}` : `Worksheet: ${firstSheet}`,
        indirect:indirect ? `${indirect.sheet}!${indirect.labelCell} → ${indirect.valueCell}` : null,
        profit:profit ? `${profit.sheet}!${profit.labelCell} → ${profit.valueCell}` : null,
        summarySheet:summary.sheetName
      },
      warnings:[
        !indirect ? '“Indirect Total Cost” was not found.' : null,
        !profit ? '“Present Profit” was not found.' : null,
        !summary.categories.length ? 'No major scope breakdown was detected on the Summary sheet.' : null
      ].filter(Boolean)
    });
  }catch(err){
    console.error("quotation sheet read",err);
    return res.status(500).json({ok:false,error:"Could not read this Google Sheet. Make sure the link is valid and shared as Anyone with the link → Viewer."});
  }
}
