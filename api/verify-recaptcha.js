export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const token=req.body?.token;
    if(!token) return res.status(400).json({ok:false,error:'Please complete the reCAPTCHA.'});

    const secret=process.env.RECAPTCHA_SECRET_KEY;
    if(!secret) return res.status(500).json({ok:false,error:'RECAPTCHA_SECRET_KEY is not configured in Vercel.'});

    const body=new URLSearchParams();
    body.set('secret',secret);
    body.set('response',token);

    const r=await fetch('https://www.google.com/recaptcha/api/siteverify',{
      method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:body.toString()
    });
    const data=await r.json();

    if(!data.success) return res.status(400).json({ok:false,error:'reCAPTCHA verification failed.',details:data['error-codes']||[]});
    return res.status(200).json({ok:true});
  }catch(e){
    return res.status(500).json({ok:false,error:e.message||String(e)});
  }
}
