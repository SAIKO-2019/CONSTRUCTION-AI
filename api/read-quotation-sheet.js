import ExcelJS from "exceljs";

function extractSpreadsheetId(input=""){
  const s=String(input||"").trim();
  const m=s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

function safeText(cell){
  try{
    if(!cell) return "";
    if(typeof cell.text === "string" && cell.text.trim()) return cell.text.trim();
    const v=cell.value;
    if(v==null) return "";
    if(typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v).trim();
    if(typeof v === "object"){
      if(typeof v.text === "string") return v.text.trim();
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
          return {
            value:found.value,
            sheet:ws.name||"Sheet",
            labelCell:cell.address,
            valueCell:found.cell,
            label:text
          };
        }
      }
    }
  }
  return null;
}


function isScopeHeader(text){
  const n=normalize(text);
  return n==="scope" || n==="scope of work" || n==="scope of works" || n==="work scope" ||
         n==="description" || n==="work description" || n==="trade" || n==="division" || n==="category";
}

function isAmountHeader(text){
  const n=normalize(text);
  return n==="amount" || n==="total amount" || n==="cost" || n==="total cost" ||
         n==="estimated cost" || n==="budget" || n==="subtotal";
}

function isPercentHeader(text){
  const n=normalize(text);
  return n.includes("percent") || n.includes("percentage") || n==="weight" || n==="weightage" || n==="%";
}

function cleanScopeName(text){
  return String(text||"").replace(/^[-–—•\s]+/,"").replace(/\s+/g," ").trim();
}

function validScopeName(text){
  const t=cleanScopeName(text);
  const n=normalize(t);
  if(!t || t.length<2 || t.length>120) return false;
  if(/^\d+(\.\d+)?$/.test(t)) return false;
  if(n.includes("grand total") || n==="total" || n.startsWith("total ") || n.includes("indirect total cost") || n.includes("present profit")) return false;
  return true;
}

function numericFromCell(cell){
  if(!cell) return null;
  let n=asNumber(cell.value);
  if(n!==null) return n;
  const t=safeText(cell);
  if(t) n=asNumber(t);
  return n;
}

function percentFromCell(cell){
  if(!cell) return null;
  let v=cell.value;
  if(v && typeof v==="object" && v.result!=null) v=v.result;
  if(typeof v==="number" && Number.isFinite(v)){
    if(v>=0 && v<=1) return v*100;
    if(v>1 && v<=100) return v;
  }
  const t=safeText(cell);
  if(t.includes("%")){
    const n=asNumber(t);
    if(n!==null) return n;
  }
  return null;
}

function detectScopeTable(workbook){
  const candidates=[];

  for(const ws of workbook.worksheets||[]){
    const maxRows=Math.min(ws.rowCount||0,2500);
    for(let r=1;r<=maxRows;r++){
      const row=ws.getRow(r);
      const maxCols=Math.min(Math.max(row.cellCount||0,1),120);
      let scopeCol=null, amountCol=null, percentCol=null;

      for(let c=1;c<=maxCols;c++){
        const txt=safeText(row.getCell(c));
        if(!txt) continue;
        if(scopeCol===null && isScopeHeader(txt)) scopeCol=c;
        if(amountCol===null && isAmountHeader(txt)) amountCol=c;
        if(percentCol===null && isPercentHeader(txt)) percentCol=c;
      }

      if(scopeCol===null || (amountCol===null && percentCol===null)) continue;

      const items=[];
      let blankRun=0;
      for(let rr=r+1;rr<=Math.min(r+80,maxRows);rr++){
        const name=cleanScopeName(safeText(ws.getCell(rr,scopeCol)));
        if(!name){
          blankRun++;
          if(blankRun>=4 && items.length>=2) break;
          continue;
        }
        blankRun=0;
        if(!validScopeName(name)){
          if(normalize(name).includes("total") && items.length>=2) break;
          continue;
        }

        const pct=percentCol!==null ? percentFromCell(ws.getCell(rr,percentCol)) : null;
        const amount=amountCol!==null ? numericFromCell(ws.getCell(rr,amountCol)) : null;
        if(pct===null && amount===null) continue;
        items.push({name,amount,percentage:pct,source:`${ws.name}!${ws.getCell(rr,scopeCol).address}`});
      }

      if(items.length>=2){
        candidates.push({ws:ws.name,headerRow:r,items,hasPercent:percentCol!==null,hasAmount:amountCol!==null});
      }
    }
  }

  if(!candidates.length) return [];
  candidates.sort((a,b)=>{
    const score=x=>(x.hasPercent?4:0)+(x.hasAmount?2:0)+Math.min(x.items.length,15)/10;
    return score(b)-score(a);
  });

  const picked=candidates[0].items.slice(0,24);
  const pctValues=picked.map(x=>x.percentage).filter(x=>Number.isFinite(x) && x>=0);
  const pctSum=pctValues.reduce((a,b)=>a+b,0);

  if(pctValues.length===picked.length && pctSum>95 && pctSum<105){
    return picked.map(x=>({...x,percentage:(x.percentage/pctSum)*100}));
  }

  const amountTotal=picked.reduce((s,x)=>s+(Number.isFinite(x.amount)&&x.amount>0?x.amount:0),0);
  if(amountTotal>0){
    return picked
      .filter(x=>Number.isFinite(x.amount)&&x.amount>0)
      .map(x=>({...x,percentage:(x.amount/amountTotal)*100}));
  }

  if(pctValues.length){
    const usableTotal=pctValues.reduce((a,b)=>a+b,0);
    if(usableTotal>0){
      return picked
        .filter(x=>Number.isFinite(x.percentage)&&x.percentage>0)
        .map(x=>({...x,percentage:(x.percentage/usableTotal)*100}));
    }
  }

  return [];
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({ok:false,error:"Method not allowed"});
  try{
    const link=req.body?.link;
    const id=extractSpreadsheetId(link);
    if(!id) return res.status(400).json({ok:false,error:"Paste a valid Google Sheets link."});

    // Google Sheets only: export the workbook as XLSX using its spreadsheet ID.
    const exportUrl=`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
    const response=await fetch(exportUrl,{
      redirect:"follow",
      headers:{"user-agent":"SAIKO-Construction-AI/1.0"}
    });

    if(!response.ok){
      return res.status(400).json({
        ok:false,
        error:"Google Sheet could not be read. Set Share access to Anyone with the link → Viewer, then try again."
      });
    }

    const contentType=response.headers.get("content-type")||"";
    if(contentType.includes("text/html")){
      return res.status(400).json({
        ok:false,
        error:"Google returned a sign-in page. Set the Google Sheet to Anyone with the link → Viewer."
      });
    }

    const buf=Buffer.from(await response.arrayBuffer());
    if(!buf.length) return res.status(400).json({ok:false,error:"Google Sheet export was empty."});

    const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);

    const indirect=findMetric(workbook,"indirect",{numeric:true});
    const profit=findMetric(workbook,"profit",{numeric:true});
    const project=findMetric(workbook,"project",{numeric:false});
    const client=findMetric(workbook,"client",{numeric:false});
    const scopeBreakdown=detectScopeTable(workbook);

    const firstSheet=(workbook.worksheets?.[0]?.name || `Quotation ${id.slice(0,6)}`).trim();
    const projectName=(project?.value && String(project.value).trim().length<180)
      ? String(project.value).trim()
      : firstSheet;

    if(!indirect && !profit){
      return res.status(422).json({
        ok:false,
        error:'The Sheet opened, but “Indirect Total Cost” and “Present Profit” were not found. Check the exact labels in the Google Sheet.'
      });
    }

    return res.status(200).json({
      ok:true,
      spreadsheetId:id,
      projectName,
      clientName:client?.value ? String(client.value).trim() : "",
      indirectTotalCost:indirect?.value ?? null,
      presentProfit:profit?.value ?? null,
      scopeBreakdown:scopeBreakdown.map(x=>({
        name:x.name,
        amount:Number.isFinite(x.amount)?x.amount:null,
        percentage:Math.round((x.percentage||0)*100)/100,
        source:x.source
      })),
      sources:{
        project:project ? `${project.sheet}!${project.labelCell} → ${project.valueCell}` : `Worksheet: ${firstSheet}`,
        indirect:indirect ? `${indirect.sheet}!${indirect.labelCell} → ${indirect.valueCell}` : null,
        profit:profit ? `${profit.sheet}!${profit.labelCell} → ${profit.valueCell}` : null
      },
      warnings:[
        !indirect ? '“Indirect Total Cost” was not found.' : null,
        !profit ? '“Present Profit” was not found.' : null
      ].filter(Boolean)
    });
  }catch(err){
    console.error("quotation sheet read",err);
    return res.status(500).json({
      ok:false,
      error:"Could not read this Google Sheet. Make sure the link is valid and shared as Anyone with the link → Viewer."
    });
  }
}
