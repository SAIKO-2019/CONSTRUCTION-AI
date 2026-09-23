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

## v12.1 file deletion
Saved Project Files now have a Delete action. The user can choose between deleting only the stored original file or deleting the file together with BOQ, schedule, billing, VO, and progress rows imported from that upload. Run `file-delete-link-patch.sql` once before using linked-data deletion.


## v12.2 Template Delete
- Individual Delete button on every saved template
- Select All checkbox
- Custom multi-select via row checkboxes
- Delete Selected bulk action
- Clear Selection
- Deletes both the Supabase Storage object and document_templates record


## v12.3
Bulk selection/delete added to Projects, Billing, Schedule, Actual Progress, Project Files, and Templates.


## v13 Project Cost Control
Adds:
- Project Folder selector across modules
- Original contract amount, discount, and net contract amount
- Expanded Billing / Payments fields: type, gross, accomplishment %, retention %, recoupment %, request date, paid date, billing no., VO no., encoder
- Retention / recoupment rules for Labor, Equipment and Subcontractor
- BOQ-driven Actual Progress
- Progress History for actual S-curve trend
- Automatic planned vs actual S-curve
- Automatic recovery / methodology guidance when behind schedule
- Per-project Inventory / Purchases with request/purchase dates, supplier, paid, balance and encoder
- BOQ scope linking for purchases
- Budget Monitoring with running cost, earned value, running profit and projected profit
- Cost allocation pie chart and category bar chart
- Estimated remaining BOQ spend for materials and labor
- Construction AI context expanded with BOQ, schedule, inventory, progress and budget data

### Required once
Run `v13-project-cost-control.sql` in Supabase SQL Editor.
