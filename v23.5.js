// SAIKO Construction AI v23.5 — clearer database schema errors
(function(){
  window.saikoSchemaHelp=function(err){
    const msg=String(err?.message||err||'');
    if(/schema cache|column .* of .*billings|issued_date|issued_amount|subcontractor_name|subcontract_balance/i.test(msg)){
      return 'Database update required. Run v23.5-required-database-fix.sql in Supabase SQL Editor, wait 10–20 seconds, then refresh the app.';
    }
    return msg;
  };
})();
