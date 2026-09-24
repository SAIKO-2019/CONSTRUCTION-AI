export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  const deployment =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_URL ||
    'local-v22.5';

  return res.status(200).json({
    ok:true,
    appRelease:'22.5',
    deployment,
    checkedAt:new Date().toISOString()
  });
}
