// SAIKO Construction AI v14.5 - click-to-sign-in, remember me, reCAPTCHA

(function(){
  const byId=id=>document.getElementById(id);
  const landing=byId('authLanding');
  const form=byId('loginForm');
  const openBtn=byId('openSignInBtn');
  const backBtn=byId('backToWelcomeBtn');
  const remember=byId('rememberMe');
  const email=byId('loginEmail');
  const password=byId('loginPassword');
  const errorBox=byId('loginError');
  const captcha=byId('recaptchaContainer');
  const hint=byId('captchaDevHint');

  function setErr(msg=''){ if(errorBox) errorBox.textContent=msg; }

  function configureCaptcha(){
    const key=window.RECAPTCHA_SITE_KEY||'';
    if(captcha){
      captcha.dataset.sitekey=key;
      if(!key && hint) hint.classList.remove('hidden');
    }
  }

  if(openBtn) openBtn.onclick=()=>{
    landing?.classList.add('hidden');
    form?.classList.remove('hidden');
    setErr('');
    setTimeout(()=>email?.focus(),50);
  };

  if(backBtn) backBtn.onclick=()=>{
    form?.classList.add('hidden');
    landing?.classList.remove('hidden');
    setErr('');
  };

  // Remember only the email address. Password is never stored in localStorage.
  const remembered=localStorage.getItem('saiko_remembered_email');
  if(remembered && email){
    email.value=remembered;
    if(remember) remember.checked=true;
  }

  configureCaptcha();

  // Replace existing form submit handler with secure flow.
  if(form){
    form.onsubmit=async e=>{
      e.preventDefault();
      setErr('');

      const emailValue=email?.value.trim()||'';
      const passwordValue=password?.value||'';
      if(!emailValue || !passwordValue){
        setErr('Enter your email and password.');
        return;
      }

      const captchaToken=window.grecaptcha?.getResponse?.()||'';
      if(!captchaToken){
        setErr('Please complete the reCAPTCHA.');
        return;
      }

      try{
        const verify=await fetch('/api/verify-recaptcha',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({token:captchaToken})
        });
        const verifyData=await verify.json().catch(()=>({}));
        if(!verify.ok || !verifyData.ok) throw new Error(verifyData.error||'reCAPTCHA verification failed.');

        // "Remember me" here remembers the email only.
        if(remember?.checked) localStorage.setItem('saiko_remembered_email',emailValue);
        else localStorage.removeItem('saiko_remembered_email');

        // Supabase manages the authenticated session securely.
        const {data,error}=await sb.auth.signInWithPassword({email:emailValue,password:passwordValue});
        if(error) throw error;

        window.grecaptcha?.reset?.();
        if(typeof boot==='function') await boot();
        else location.reload();
      }catch(err){
        setErr(err.message||String(err));
        window.grecaptcha?.reset?.();
      }
    };
  }
})();
