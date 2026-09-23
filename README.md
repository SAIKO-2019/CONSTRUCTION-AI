# SAIKO Construction AI v10

This build adds a real Supabase-backed construction management workflow:
- self-signup accounts default to editor access
- admin role/status management
- projects
- automatic billing/payment calculations
- Excel schedule import and planned-vs-actual tracking
- manual weighted progress
- project file cloud storage
- reusable template library
- billing Excel generation from the supplied Melendres sample template
- Construction AI serverless endpoint (requires OPENAI_API_KEY in Vercel)

## Deploy
1. Upload all files/folders to the GitHub repo, including `api/`, `templates/`, and `package.json`.
2. Run `supabase-setup.sql` once in Supabase SQL Editor.
3. Redeploy/refresh Vercel.
4. For AI, add `OPENAI_API_KEY` in Vercel Environment Variables and redeploy.

## Schedule Excel columns
Use headers such as: Activity, Start Date, End Date, Weight (%).

## Billing template
The supplied `Architectural Melendres Billing No. 3.xlsx` is included as the default billing workbook. Users can also upload a Billing Excel template in the Templates module; generated billing will use the latest uploaded Billing Excel template when available.
