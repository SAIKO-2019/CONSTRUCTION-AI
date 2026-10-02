CONSTRUCTION MONITORING v28.38.2 — INSTALLED APP LOGIN HOTFIX

ROOT CAUSE FIXED
- The v28.38 mobile-auth helper replaced the original app.js login handler
  and tried to access Supabase through window.sb.
- In this project, app.js creates Supabase as a global lexical `sb`, not
  `window.sb`, so the installed app could not sign in.

WHAT THIS HOTFIX DOES
- Restores the existing app.js Supabase sign-in handler.
- Keeps reCAPTCHA hidden only in installed standalone app mode.
- Normal browser/web login continues using the existing reCAPTCHA flow.
- Keeps Remember Me and the installed-app security badge.
- No data, SQL, environment variable, billing, schedule, inventory,
  quotation, or project logic changes.

UPLOAD / OVERWRITE IN GITHUB
1. index.html
2. mobile-auth.js

NO SQL TO RUN.
NO VERCEL ENVIRONMENT VARIABLE CHANGES.
After Vercel becomes Ready, fully close the installed app and reopen it.
If it still shows old cached behavior, remove the app from the Home Screen
and install it again once.
