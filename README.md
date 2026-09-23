# SAIKO Construction AI v11 — Smart Upload (permission-fixed)

This build keeps the existing Construction AI modules and adds Smart Upload.

## Important setup
Run `supabase-setup.sql` once in Supabase SQL Editor. It now includes:
- operational tables
- BOQ table
- explicit `GRANT` permissions for authenticated users
- RLS policies that let signed-in users add/edit/delete operational data
- storage buckets and storage policies
- conversion of existing `viewer` profiles to `editor`
- default role for future profile rows set to `editor`

You do **not** need to separately run `smart-upload-migration.sql` if you already ran the full `supabase-setup.sql`.

Then upload the web files/folders to GitHub and let Vercel redeploy.
