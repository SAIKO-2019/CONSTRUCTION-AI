// SAIKO Construction AI v15.7 — smooth single-owner authentication controller
(function(){
  const $=id=>document.getElementById(id);
  const landing=$('authLanding'), form=$('loginForm'), openBtn=$('openSignInBtn'), remember=$('rememberMe');
  const email=$('loginEmail'), password=$('loginPassword'), errorBox=$('loginError'), captcha=$('recaptchaContainer');
  let captchaWidgetId=null, loginBusy=false, captchaTimer=null;
  function setMessage(msg='',type='error'){if(!errorBox)return;errorBox.textContent=msg;errorBox.classList.toggle('success',type==='success');}
  function setBusy(on){loginBusy=on;const submit=form?.querySelector('button[type="submit"]');if(!submit)return;submit.disabled=on;submit.textContent=on?'Signing in…':'Sign in';form?.classList.toggle('auth-busy',on);}
  function openLogin(){landing?.classList.add('hidden');form?.classList.remove('hidden');setMessage('');setTimeout(()=>email?.focus(),30);ensureCaptcha();}
  function ensureCaptcha(){
    const key=window.RECAPTCHA_SITE_KEY||'';
    if(!captcha)return false;
    if(!key){setMessage('Login verification is not configured. Please contact the administrator.');return false;}
    if(captchaWidgetId!==null)return true;
    if(!window.grecaptcha?.render){clearTimeout(captchaTimer);captchaTimer=setTimeout(ensureCaptcha,250);return false;}
    try{
      captcha.innerHTML='';
      captchaWidgetId=window.grecaptcha.render(captcha,{sitekey:key,theme:'light',callback:()=>setMessage(''),'expired-callback':()=>setMessage('Verification expired. Tick “I’m not a robot” again.'),'error-callback':()=>setMessage('Verification could not load. Refresh and try again.')});
      return true;
    }catch(err){console.warn('reCAPTCHA render failed',err);clearTimeout(captchaTimer);captchaTimer=setTimeout(ensureCaptcha,500);return false;}
  }
  const remembered=localStorage.getItem('saiko_remembered_email');
  if(remembered&&email){email.value=remembered;if(remember)remember.checked=true;}
  if(openBtn)openBtn.onclick=openLogin;
  ensureCaptcha();
  if(form){form.onsubmit=async e=>{
    e.preventDefault();e.stopPropagation();if(loginBusy)return;setMessage('');
    const emailValue=email?.value.trim()||'', passwordValue=password?.value||'';
    if(!emailValue||!passwordValue){setMessage('Enter your email and password.');return;}
    if(!ensureCaptcha()){setMessage('Please wait a moment while verification loads.');return;}
    const token=window.grecaptcha?.getResponse?.(captchaWidgetId)||'';
    if(!token){setMessage('Tick “I’m not a robot” first.');return;}
    setBusy(true);
    try{
      const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),12000);
      const verify=await fetch('/api/verify-recaptcha',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token}),signal:controller.signal}).finally(()=>clearTimeout(timeout));
      const verified=await verify.json().catch(()=>({}));
      if(!verify.ok||!verified.ok)throw new Error(verified.error||'Verification failed. Please try again.');
      const {data,error}=await sb.auth.signInWithPassword({email:emailValue,password:passwordValue});
      if(error)throw error;if(!data?.session)throw new Error('Sign in did not create a session. Please try again.');
      if(remember?.checked)localStorage.setItem('saiko_remembered_email',emailValue);else localStorage.removeItem('saiko_remembered_email');
      setMessage('Signed in. Opening your workspace…','success');
      try{window.grecaptcha?.reset?.(captchaWidgetId)}catch(_e){}
      if(typeof boot==='function')await boot();else location.reload();
    }catch(err){setMessage(err?.name==='AbortError'?'Verification timed out. Check your connection and try again.':(err?.message||String(err)));try{window.grecaptcha?.reset?.(captchaWidgetId)}catch(_e){}
    }finally{setBusy(false);}
  };}
  window.saikoOpenLogin=openLogin;
})();
