import ExcelJS from "exceljs";

function extractSpreadsheetId(input=""){
  const s=String(input).trim();
  const m=s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
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
    if(typeof v.result==="number") return v.result;
    if(typeof v.text==="string") v=v.text;
  }
  const s=String(v??"").replace(/[₱,$,%\s]/g,"").replace(/,/g,"");
  if(!s || !/^[-+]?\d*\.?\d+$/.test(s)) return null;
  const n=Number(s);
  return Number.isFinite(n)?n:null;
}

function nearbyValue(ws,row,col,{numeric=false}={}){
  const positions=[];
  for(let dc=1;dc<=8;dc++)positions.push([row,col+dc]);
  for(let dr=1;dr<=4;dr++)for(let dc=0;dc<=4;dc++)positions.push([row+dr,col+dc]);

  for(const [r,c] of positions){
    const cell=ws.getCell(r,c);
    if(numeric){
      const n=asNumber(cell.value);
      if(n!==null)return {value:n,cell:cell.address};
    }else{
      const t=String(cell.text||cell.value||"").trim();
      if(t)return {value:t,cell:cell.address};
    }
  }
  return null;
}

function metricMatch(kind,text){
  const n=normalize(text);
  if(kind==="indirect") return n.includes("indirect") && n.includes("total") && n.includes("cost");
  if(kind==="profit") return (n.includes("present") && n.includes("profit")) || n.includes("current profit");
  if(kind==="project") return [
    "project name","project title","project","quotation project","project opportunity name"
  ].includes(n);
  if(kind==="client") return ["client","client name","owner","owner name"].includes(n);
  return false;
}

function findMetric(workbook,kind,{numeric=true}={}){
  for(const ws of workbook.worksheets){
    for(let r=1;r<=ws.rowCount;r++){
      const row=ws.getRow(r);
      for(let c=1;c<=Math.max(row.cellCount,1);c++){
        const cell=row.getCell(c);
        const text=cell.text || String(cell.value??"");
        if(!metricMatch(kind,text))continue;
        const found=nearbyValue(ws,r,c,{numeric});
        if(found){
          return {
            value:found.value,
            sheet:ws.name,
            labelCell:cell.address,
            valueCell:found.cell,
            label:String(text)
          };
        }
      }
    }
  }
  return null;
}

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
  try{
    const link=req.body?.link;
    const id=extractSpreadsheetId(link);
    if(!id)return res.status(400).json({ok:false,error:"Invalid Google Sheets link."});

    const exportUrl=`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
    const response=await fetch(exportUrl,{
      redirect:"follow",
      headers:{"user-agent":"SAIKO-Construction-AI/1.0"}
    });

    if(!response.ok){
      return res.status(400).json({
        ok:false,
        error:"Google Sheet could not be read. Set it to Anyone with the link can view."
      });
    }

    const contentType=response.headers.get("content-type")||"";
    if(contentType.includes("text/html")){
      return res.status(400).json({
        ok:false,
        error:"Google returned a sign-in page. Set the Sheet to Anyone with the link can view."
      });
    }

    const buf=Buffer.from(await response.arrayBuffer());
    const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);

    const indirect=findMetric(workbook,"indirect",{numeric:true});
    const profit=findMetric(workbook,"profit",{numeric:true});
    const project=findMetric(workbook,"project",{numeric:false});
    const client=findMetric(workbook,"client",{numeric:false});

    const firstSheet=workbook.worksheets?.[0]?.name || `Quotation ${id.slice(0,6)}`;
    const projectName=(project?.value && String(project.value).length<180)
      ? String(project.value).trim()
      : firstSheet;

    if(!indirect && !profit){
      return res.status(422).json({
        ok:false,
        error:'Could not find “Indirect Total Cost” or “Present Profit” in the workbook.'
      });
    }

    return res.status(200).json({
      ok:true,
      spreadsheetId:id,
      projectName,
      clientName:client?.value ? String(client.value).trim() : "",
      indirectTotalCost:indirect?.value ?? null,
      presentProfit:profit?.value ?? null,
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
    return res.status(500).json({ok:false,error:err?.message||"Could not read Google Sheet."});
  }
}
