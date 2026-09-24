// v15.6 compatibility fixes
(function(){
  const form=document.getElementById('loginForm');
  if(form) form.classList.add('stack-form');
  const captcha=document.getElementById('recaptchaContainer');
  if(captcha){
    captcha.style.minHeight='78px';
    captcha.style.display='flex';
    captcha.style.alignItems='center';
  }
})();
