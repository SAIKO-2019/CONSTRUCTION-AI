import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

function setRight(ws,label,value){
  let hit=null;ws.eachRow(row=>row.eachCell(cell=>{if(hit)return;const v=String(cell.value??'').trim().toLowerCase();if(v===label.toLowerCase())hit=cell}));
  if(!hit)return false;let c=hit.col+1;for(let i=0;i<6;i++,c++){const target=ws.getCell(hit.row,c);try{const master=target.master||target;if(master.address!==hit.address){master.value=value;return true}}catch{target.value=value;return true}}return false;
}
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).send('Method not allowed');
  const {templateUrl,billing}=req.body||{};if(!billing)return res.status(400).send('Missing billing payload');
  try{
    let buf;if(templateUrl){const r=await fetch(templateUrl);if(!r.ok)throw new Error('Unable to load selected template');buf=Buffer.from(await r.arrayBuffer())}else{buf=fs.readFileSync(path.join(process.cwd(),'templates','Architectural Melendres Billing No. 3.xlsx'))}
    const wb=new ExcelJS.Workbook();await wb.xlsx.load(buf);const ws=wb.getWorksheet('SUMMARY')||wb.worksheets[0];
    // Preserve the sample workbook and populate recognized summary labels.
    setRight(ws,'TOTAL BILLING THIS DATE',Number(billing.net_due||billing.gross_amount||0));
    setRight(ws,'RETENTION 5%',Number(billing.retention_amount||0));
    setRight(ws,'RECOUPMENT 30%',Number(billing.recoupment_amount||0));
    setRight(ws,'Remaining To Bill',Math.max(0,Number(billing.contract_amount||0)-Number(billing.gross_amount||0)));
    setRight(ws,'TOTAL AMOUNT:',Number(billing.net_due||0));
    // Put a small generated info block in unused area if possible.
    const start=70;ws.getCell(`A${start}`).value='AUTO-GENERATED BILLING INFO';ws.getCell(`A${start+1}`).value='Project';ws.getCell(`B${start+1}`).value=billing.project_name||'';ws.getCell(`A${start+2}`).value='Client';ws.getCell(`B${start+2}`).value=billing.client_name||'';ws.getCell(`A${start+3}`).value='Billing';ws.getCell(`B${start+3}`).value=billing.billing_no||'';ws.getCell(`A${start+4}`).value='Gross';ws.getCell(`B${start+4}`).value=Number(billing.gross_amount||0);ws.getCell(`A${start+5}`).value='Received';ws.getCell(`B${start+5}`).value=Number(billing.received_amount||0);ws.getCell(`A${start+6}`).value='Outstanding';ws.getCell(`B${start+6}`).value=Number(billing.outstanding_amount||0);
    const out=await wb.xlsx.writeBuffer();res.setHeader('content-type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('content-disposition',`attachment; filename="${String(billing.billing_no||'billing').replace(/[^a-zA-Z0-9._-]/g,'_')}.xlsx"`);res.status(200).send(Buffer.from(out));
  }catch(e){res.status(500).send(e.message)}
}
