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


## v14 Integrated Control
Changes requested:
- Project accomplishment is no longer manually entered; it is derived from Actual Progress / schedule data.
- Billing types simplified to Client Billing and Subcontractor Billing.
- Retention and recoupment are optional for both.
- Subcontractor Billing tracks Issued/Contract Amount, Gross Billing, deductions, paid amount and remaining subcontract balance.
- Inventory is spreadsheet-style with direct cell editing, Add Row and Add Column.
- Inventory categories include Overhead, Materials, Labor, Equipment, Subcontractor and Other.
- Pending Works module added with daily in-app reminders.
- Pending works cannot become Completed until required evidence is uploaded, moved to For Verification, and then verified.
- Dashboard now includes Budget and Pending Works snapshots.
- Template-based download helper added so future generated downloads can be routed through the matching uploaded template.
- Everything remains per-project through the Project Folder selector.

### Required once
Run `v14-integrated-control.sql` in Supabase SQL Editor.

## v14.1 Billing / VO Record Type
- Billing entry is now explicitly either **Billing** or **Variation Order (VO)**.
- One Record No. field changes automatically to Billing No. or Variation Order No.
- Database saves only one identifier at a time (`billing_no` OR `variation_no`), never both.


## v14.2 Quotation Workspace + Ongoing Schedule Health
- Replaces the old Pending Works sidebar module with a separate **For Quotation** workspace.
- Quotation opportunities are kept separate from ongoing projects.
- Each quotation project can store a BOQ/costing file or Google Sheets link.
- Tracks running estimated cost, quoted amount, projected profit and margin.
- Dashboard now shows quotation totals.
- Ongoing projects now show their own mini S-curve, Projected %, Actual %, status, and schedule variance:
  - Ahead = variance > +2%
  - On Track = within ±2%
  - Behind / slippage = variance < -2%


## v14.3 Per-Project Cost Folders
For every ongoing project, cost records are organized into folder-style views:
- Materials
- Labor
- Overhead
- Equipment
- Subcontractor
- Other

Each folder is still part of the same project cost ledger and feeds Budget Monitoring / Running Cost. The folder view only filters and organizes the project's accounting records.


## v14.4 Automatic Project Report Generator
Adds a per-project **Project Reports** module that can automatically assemble:
- Project overview
- Planned vs actual S-curve
- Schedule status / slippage / ahead percentage
- Actual progress by BOQ scope
- Budget monitoring
- Cost folders
- Client and subcontractor billing
- Recovery / methodology guidance

Outputs:
- On-screen report preview
- Print / Save as PDF via the browser
- Downloadable PPTX presentation

The generated PPTX filename follows the selected uploaded report template name when a matching template exists.

### Template note
Uploaded report templates are currently used for template selection, naming, and report-type matching. The generator produces a standardized SAIKO slide layout. Pixel-for-pixel editing of arbitrary uploaded PPTX/PDF/Word layouts would require a separate template parser/mapping layer.
