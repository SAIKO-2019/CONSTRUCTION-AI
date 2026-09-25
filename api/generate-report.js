import pptxgen from 'pptxgenjs';

const safe = s => String(s ?? '').replace(/[^\w .()%+\-]/g,'');
const money = n => `₱${Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const pct = n => `${Number(n||0).toFixed(2)}%`;

function addHeader(slide, title, subtitle=''){
  slide.addText('CONSTRUCTION MONITORING',{x:.45,y:.25,w:3.1,h:.3,fontSize:11,bold:true,color:'0F2A44'});
  slide.addText(title,{x:.45,y:.62,w:8.6,h:.5,fontSize:24,bold:true,color:'0F2A44'});
  if(subtitle) slide.addText(subtitle,{x:.45,y:1.12,w:8.7,h:.28,fontSize:10,color:'64748B'});
  slide.addShape('line',{x:.45,y:1.48,w:9.1,h:0,line:{color:'D6A94A',width:2}});
}
function addFooter(slide, meta){
  slide.addText(`${safe(meta.projectName)} | ${safe(meta.reportDate)} | ${safe(meta.preparedBy)}`,{x:.45,y:7.14,w:9,h:.2,fontSize:8,color:'64748B',align:'right'});
}
function metric(slide,x,y,w,label,value){
  slide.addShape('roundRect',{x,y,w,h:.72,rectRadius:.05,fill:{color:'F8FAFC'},line:{color:'E2E8F0'}});
  slide.addText(label,{x:x+.12,y:y+.1,w:w-.24,h:.18,fontSize:8,color:'64748B'});
  slide.addText(value,{x:x+.12,y:y+.3,w:w-.24,h:.28,fontSize:15,bold:true,color:'0F172A'});
}
function addTable(slide, rows, x,y,w,h){
  if(!rows?.length) return;
  slide.addTable(rows,{x,y,w,h,border:{type:'solid',color:'CBD5E1',pt:1},fontSize:8,color:'0F172A',fill:'FFFFFF',margin:.06,rowH:.28});
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).send('Method not allowed');
  try{
    const p=req.body||{}, d=p.data||{}, project=d.project||{}, meta=p.meta||{};
    const pptx=new pptxgen();
    pptx.layout='LAYOUT_WIDE';
    pptx.author='Construction Monitoring';
    pptx.company='Construction Monitoring';
    pptx.subject=meta.reportType||'Project Report';
    pptx.title=`${project.project_name||'Project'} - ${meta.reportType||'Report'}`;
    pptx.lang='en-PH';
    pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:'en-PH'};

    // Cover
    let s=pptx.addSlide();
    s.background={color:'F8FAFC'};
    s.addShape('rect',{x:0,y:0,w:13.333,h:7.5,fill:{color:'F8FAFC'},line:{color:'F8FAFC'}});
    s.addShape('rect',{x:0,y:0,w:13.333,h:.18,fill:{color:'D6A94A'},line:{color:'D6A94A'}});
    s.addText('SAIKO',{x:.8,y:1.0,w:2.2,h:.55,fontSize:32,bold:true,color:'0F2A44',charSpacing:4});
    s.addText('PROJECT CONTROL',{x:.82,y:1.6,w:2.1,h:.25,fontSize:10,color:'64748B',charSpacing:2});
    s.addText(meta.reportType||'PROJECT REPORT',{x:.8,y:2.35,w:5.4,h:.55,fontSize:28,bold:true,color:'0F172A'});
    s.addText(project.project_name||'Project',{x:.8,y:3.03,w:6.5,h:.45,fontSize:20,bold:true,color:'2563EB'});
    s.addText(`${project.client_name||''}\n${project.location||''}`,{x:.8,y:3.55,w:6.3,h:.7,fontSize:12,color:'475569'});
    s.addText(`Report Date: ${meta.reportDate||''}\nPrepared by: ${meta.preparedBy||''}\nPeriod: ${meta.period||''}`,{x:.8,y:5.4,w:4.5,h:.8,fontSize:11,color:'475569',breakLine:true});

    const sections=p.sections||[];

    if(sections.includes('overview')){
      s=pptx.addSlide(); addHeader(s,'Project Overview',project.project_name||'');
      metric(s,.45,1.75,2.25,'Net Contract',money(d.budget?.contract));
      metric(s,2.85,1.75,2.25,'Actual Progress',pct(d.schedule?.actual));
      metric(s,5.25,1.75,2.25,'Projected',pct(d.schedule?.planned));
      metric(s,7.65,1.75,2.25,'Schedule Variance',`${Number(d.schedule?.variance||0)>=0?'+':''}${pct(d.schedule?.variance)}`);
      metric(s,.45,2.62,2.25,'Running Cost',money(d.budget?.runningCost));
      metric(s,2.85,2.62,2.25,'Earned Value',money(d.budget?.earned));
      metric(s,5.25,2.62,2.25,'Running Profit',money(d.budget?.runningProfit));
      metric(s,7.65,2.62,2.25,'Projected Profit',money(d.budget?.projectedProfit));
      addTable(s,[
        [{text:'Status',options:{bold:true}},{text:'Value',options:{bold:true}}],
        ['Project Status', project.status||''],
        ['Start Date', project.start_date||''],
        ['Target Date', project.target_date||''],
        ['Schedule Status', d.schedule?.status||''],
        ['Original Contract', money(project.original_contract_amount||project.contract_amount)],
        ['Discount', money(project.discount_amount)],
        ['Net Contract', money(project.contract_amount)]
      ],.45,3.65,9.4,2.5); addFooter(s,{projectName:project.project_name,reportDate:meta.reportDate,preparedBy:meta.preparedBy});
    }

    if(sections.includes('schedule')){
      s=pptx.addSlide(); addHeader(s,'Schedule / S-Curve',`${project.project_name||''} — Projected vs Actual`);
      const sc=d.sCurve||{};
      const labels=sc.labels||[], planned=sc.planned||[], actual=sc.actual||[];
      if(labels.length){
        s.addChart(pptx.ChartType.line,[
          {name:'Projected',labels,values:planned},
          {name:'Actual',labels,values:actual}
        ],{x:.55,y:1.75,w:8.9,h:4.4,showLegend:true,legendPos:'b',catAxisLabelFontSize:8,valAxisLabelFontSize:8,valAxisMinVal:0,valAxisMaxVal:100,valAxisMajorUnit:20,showTitle:false,showValue:false,lineSize:2});
      }
      metric(s,9.7,1.8,2.4,'Projected',pct(d.schedule?.planned));
      metric(s,9.7,2.75,2.4,'Actual',pct(d.schedule?.actual));
      metric(s,9.7,3.7,2.4,'Variance',`${Number(d.schedule?.variance||0)>=0?'+':''}${pct(d.schedule?.variance)}`);
      metric(s,9.7,4.65,2.4,'Status',d.schedule?.status||'');
      addFooter(s,{projectName:project.project_name,reportDate:meta.reportDate,preparedBy:meta.preparedBy});
    }

    if(sections.includes('progress')){
      s=pptx.addSlide(); addHeader(s,'Actual Progress','BOQ-based accomplishment');
      const rows=(d.progress||[]).slice(0,18).map(r=>[safe(r.activity),pct(r.weight),pct(r.actual_percent),money(r.budget_amount),money(r.actual_cost)]);
      addTable(s,[[{text:'Scope',options:{bold:true}},{text:'Weight',options:{bold:true}},{text:'Actual',options:{bold:true}},{text:'BOQ Budget',options:{bold:true}},{text:'Actual Cost',options:{bold:true}}],...rows],.45,1.75,12.0,4.9);
      addFooter(s,{projectName:project.project_name,reportDate:meta.reportDate,preparedBy:meta.preparedBy});
    }

    if(sections.includes('budget') || sections.includes('costs')){
      s=pptx.addSlide(); addHeader(s,'Budget & Cost Monitoring','Running cost, earned value, and cost folders');
      const cats=d.budget?.categories||{};
      const labels=Object.keys(cats),vals=Object.values(cats).map(Number);
      if(labels.length){
        s.addChart(pptx.ChartType.bar,[{name:'Cost',labels,values:vals}],{x:.55,y:1.8,w:6.5,h:4.4,showLegend:false,showTitle:false,catAxisLabelFontSize:8,valAxisLabelFontSize:8});
      }
      metric(s,7.4,1.9,2.2,'Running Cost',money(d.budget?.runningCost));
      metric(s,9.8,1.9,2.2,'Earned Value',money(d.budget?.earned));
      metric(s,7.4,2.85,2.2,'Running Profit',money(d.budget?.runningProfit));
      metric(s,9.8,2.85,2.2,'Projected Profit',money(d.budget?.projectedProfit));
      const catRows=labels.map(k=>[k,money(cats[k])]);
      addTable(s,[[{text:'Cost Folder',options:{bold:true}},{text:'Amount',options:{bold:true}}],...catRows],7.4,4.05,4.6,2.0);
      addFooter(s,{projectName:project.project_name,reportDate:meta.reportDate,preparedBy:meta.preparedBy});
    }

    if(sections.includes('billing')){
      s=pptx.addSlide(); addHeader(s,'Billing / Subcontractor Summary','Client billings and subcontractor billings');
      const br=(d.billings||[]).slice(0,16).map(b=>[
        safe(b.billing_type||'Client Billing'),
        safe(b.variation_no?`VO ${b.variation_no}`:(b.billing_no||'')),
        money(b.gross_amount),money(b.retention_amount),money(b.recoupment_amount),money(b.received_amount),money(b.outstanding_amount)
      ]);
      addTable(s,[[{text:'Type',options:{bold:true}},{text:'Record',options:{bold:true}},{text:'Gross',options:{bold:true}},{text:'Retention',options:{bold:true}},{text:'Recoupment',options:{bold:true}},{text:'Paid/Received',options:{bold:true}},{text:'Balance',options:{bold:true}}],...br],.35,1.7,12.55,5.0);
      addFooter(s,{projectName:project.project_name,reportDate:meta.reportDate,preparedBy:meta.preparedBy});
    }

    if(sections.includes('risks')){
      s=pptx.addSlide(); addHeader(s,'Schedule Status & Recovery Guidance',d.schedule?.status||'');
      const items=d.recovery||[];
      if(items.length){
        items.slice(0,8).forEach((it,i)=>{
          s.addShape('roundRect',{x:.6,y:1.8+i*.62,w:11.8,h:.48,fill:{color:i%2?'FFFFFF':'F8FAFC'},line:{color:'E2E8F0'}});
          s.addText(`${i+1}. ${safe(it)}`,{x:.8,y:1.92+i*.62,w:11.3,h:.24,fontSize:11,color:'0F172A'});
        });
      }else{
        s.addText('No major recovery action is currently required based on the supplied schedule variance.',{x:.7,y:2.0,w:11.5,h:.5,fontSize:16,color:'475569'});
      }
      addFooter(s,{projectName:project.project_name,reportDate:meta.reportDate,preparedBy:meta.preparedBy});
    }

    const out=await pptx.write({outputType:'nodebuffer'});
    const base=(meta.templateName||`${project.project_name||'Project'}_${meta.reportType||'Report'}`).replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]/g,'_');
    res.setHeader('content-type','application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('content-disposition',`attachment; filename="${base}_${new Date().toISOString().slice(0,10)}.pptx"`);
    res.status(200).send(Buffer.from(out));
  }catch(e){res.status(500).send(e.message||String(e))}
}
