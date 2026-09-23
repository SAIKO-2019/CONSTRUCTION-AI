export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;
  if(!key) return res.status(503).json({error:'Construction AI is ready, but OPENAI_API_KEY has not been added in Vercel Environment Variables yet.'});
  const {message,context}=req.body||{};
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${key}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5-mini',input:[{role:'system',content:[{type:'input_text',text:'You are SAIKO Construction AI, an internal construction management assistant. Use supplied project data first. Help with billing, project progress, recovery actions, schedule, contracts, quantity surveying, and document workflows. Be concise, practical, and flag uncertainty.'}]},{role:'user',content:[{type:'input_text',text:`Current system context:\n${JSON.stringify(context||{},null,2)}\n\nUser question: ${message||''}`}]}]})});
    const j=await r.json();
    if(!r.ok) return res.status(r.status).json({error:j?.error?.message||'AI request failed'});
    const answer=j.output_text||j.output?.flatMap(o=>o.content||[]).map(c=>c.text||'').join('\n')||'No answer returned.';
    return res.status(200).json({answer});
  }catch(e){return res.status(500).json({error:e.message})}
}
