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


## v14.5 Login Security
- Initial login screen now requires the user to click **Sign In** before the email/password form opens.
- Adds **Remember me**.
- Remember me stores only the email address; passwords are not stored in localStorage.
- Adds Google reCAPTCHA v2 Checkbox verification.
- Server-side reCAPTCHA validation runs through `/api/verify-recaptcha`.
- Requires `RECAPTCHA_SECRET_KEY` in Vercel and `RECAPTCHA_SITE_KEY` in `config.js`.

See `V14.5-LOGIN-SETUP.md`.


## v14.6 Logout
- Replaces the small arrow-only logout control with a visible **Log out** button.
- Adds logout confirmation.
- Shows `Logging out...` while Supabase ends the session.
- Returns the user to the login screen after logout.
- Remembered email remains available when Remember Me was used; password is never stored.


## v14.7 Per-Profile Settings
Each authenticated account can sign out any time and sign back in again.

Per-user settings now include:
- Display Name
- Theme: System / Light / Dark
- Density: Comfortable / Compact
- Remember last selected project
- Delete confirmation preference
- Daily pending-work reminder preference

Preferences are stored in Supabase per authenticated user, so one employee's settings do not affect another employee's account.

### Required once
Run `v14.7-user-preferences.sql` in Supabase SQL Editor.


## v14.8 Multi-user Collaboration Safety
This version adds a collaboration layer on top of v14.7.

### Included
- Multiple users can remain signed in and work at the same time.
- Live/recent user presence by module.
- Team Activity panel.
- Atomic record locks for shared spreadsheet-style Inventory rows.
- Conflict warning when another user is already editing the same Inventory row.
- Automatic lock expiry to avoid abandoned locks.
- Inventory history snapshots before each cell update.
- Recent activity log for Projects, Billing/VO, Progress, Inventory, and Quotation saves.
- Logout remains per session and does not log out other users.
- Per-user theme/profile settings from v14.7 are preserved.

### Required once
Run `v14.8-collaboration.sql` in Supabase SQL Editor after the existing v14.7 migration.

### Note
The strongest row-level edit lock is currently applied to Inventory because it is the app's direct spreadsheet-style simultaneous editing surface. Other forms are logged in the activity feed; new records do not conflict with one another.

## v15 Ultra UI
Premium interface upgrade built on top of v14.9 and v14.8 collaboration safety.

### Visual upgrades
- Full-width advanced profile settings workspace without horizontal scrolling
- Premium glass/blur dialog treatment
- Icon-only Team, Settings, and Logout controls
- Theme preview cards inside Settings
- Quick theme switch button in the top bar
- Refined dashboard cards, panels, navigation, search focus, shadows, spacing, and hover states
- Responsive layout for desktop and mobile
- Reduced-motion accessibility support

### Per-profile themes
- Light Clean
- Dark Pro
- Midnight Steel
- Pastel Glow
- Cute Candy
- Summer Cool

Theme choice is saved to the existing `user_preferences.theme` field, so no new SQL migration is required if v14.7 user preferences were already installed.


Hotfix v15.1: fixed Team Activity modal button clicks and removed the horizontal drag/scroll bar from the collaboration dialog.


## v15.3 Readability + Presence Fix
- removes horizontal drag/scroll in Settings and Team Activity dialogs
- forces the dialogs to open wide and full workspace style
- strengthens text contrast across all themes, especially pastel/cute/summer
- adds always-visible online user icons in the top bar
- clicking an online icon opens the Team Activity dialog


## v15.4 Executive Live Panel
- premium profile icons
- live online user count badge in the sidebar
- collapsible live team panel in Settings
- adds Glass Ultra and Executive Dark themes
- quick theme button now cycles through all 8 themes
- preserves readable contrast rules from v15.3


## v15.5 Button Fix + Active Status Privacy
- Adds per-profile **Show active status** toggle.
- When OFF, the user's presence row is removed and heartbeat publishing stops, so other users no longer see that account in Who's Online / online avatar rail.
- Turning it back ON publishes presence again.
- Presence is also removed before logout.
- Adds stronger delegated click handling and pointer-event hardening for dialog close, refresh, theme, settings/team controls.
- Run `v15.5-active-status.sql` once in Supabase SQL Editor.


## v15.6 Login / reCAPTCHA Fix
- Public reCAPTCHA Site Key is now included in `config.js`.
- reCAPTCHA uses explicit rendering instead of auto-render, avoiding the blank widget/timing problem.
- Login shows clearer reCAPTCHA errors and `Signing in...` state.
- No new SQL migration is required.
- Keep `RECAPTCHA_SECRET_KEY` only in Vercel Environment Variables.


## v15.7 Auth + Button Stability
- Rebuilt login into one clean flow to avoid duplicate handlers.
- Explicit reCAPTCHA with timeout/error feedback.
- Smooth logout with presence cleanup.
- Delegated Close/Cancel/navigation handlers so modal buttons stay clickable.
- Escape and backdrop close dialogs.
- Password visibility toggle.
- No new SQL required beyond v15.5.


## v15.8 Inline Edit Mode for Testing
- Adds an **Edit Mode** button in the top bar.
- When enabled, selected fields in Projects, Billing, Schedule, Actual Progress, and Inventory can be edited directly from the webpage.
- Double-click or press Enter on a highlighted editable cell.
- Enter saves; Escape cancels.
- Collaboration lock is respected when available.
- Intended for controlled testing and quick corrections. Complex calculated/link fields remain protected.
- No new SQL migration is required.


## v15.9 Auth-Gated Database Refresh
- Fixes the misleading `Database tables are not ready` toast shown on the login screen.
- Older modules were automatically calling `refreshAll()` before a user was signed in; Supabase RLS correctly rejected those anonymous requests.
- Startup database refreshes now run only after authentication.
- If a real database query fails after login, the app now identifies the exact table/error instead of telling you to rerun the whole setup.
- No SQL migration is required.


## v16 Stable Controls
- Removes the stacked v15.2–v15.7 button wrappers that were repeatedly attaching handlers to Settings/Team/Close/Logout controls.
- Removes the expensive page-wide MutationObserver/button rescanning layer that could make the interface feel laggy after opening Settings.
- Keeps login, themes, online presence, active-status privacy, collaboration, edit mode, and database refresh protection.
- Settings/online refresh is now lightweight and runs only when needed.
- No SQL migration is required.


## v16.1 Password Toggle Fix
- Restores the login password show/hide eye button after the v16 stability cleanup.
- Uses one lightweight click handler only; no additional observers or button wrappers.
- No SQL migration required.


## v17 Ultra-Light Performance
- Password show/hide is handled inline in the login button itself, so it works even if an external JS bundle is cached.
- Removed the `v15.js` theme MutationObserver.
- Removed the `v15.8.js` page-wide MutationObserver.
- Removed `v16.js` and replaced it with one cache-busted lightweight control file.
- Settings team data loads only when Settings opens or Refresh is clicked.
- Online icon refresh reduced to once per minute.
- Edit Mode rescans only after navigation/data refresh instead of watching every DOM mutation.
- Main JS URLs are cache-busted for this release.
- No SQL migration required.


## v18 Focused For Quotation
The For Quotation workspace is now intentionally limited to:
1. Google Sheets costing link
2. automatic reading of **Indirect Total Cost**
3. automatic reading of **Present Profit**
4. final file upload
5. automatic **Complete** status after final file upload

The Sheet is read through `/api/read-quotation-sheet`. The linked Google Sheet must be accessible as **Anyone with the link can view** so the server can export it as XLSX.

The reader searches every worksheet for labels matching `Indirect Total Cost` and `Present Profit`, then reads the nearby numeric value.

No SQL migration is required because the existing quotation fields are reused:
- `estimated_cost` = Indirect Total Cost
- `projected_profit` = Present Profit
- `boq_file_name/boq_storage_path` = final completion file
- `status` = For Quotation / Complete


## v19 Quotation Project Cards
The For Quotation workspace is rebuilt around one simple workflow:

1. Click **+ Add Quotation**
2. Paste only the Google Sheets costing link
3. The app reads the Sheet automatically
4. A project card is created using the Sheet project name (or first worksheet name as fallback)
5. Each project card immediately shows:
   - Status
   - Running / Indirect Total Cost
   - Present Profit
6. Click a project card to open its current details
7. Upload the final quotation file when done
8. Uploading the final file automatically changes the quotation to **Complete**

No manual quotation amount entry is required.
No SQL migration is required.


## v20 For Quotation — Project Dashboard + History
New workflow:
1. Click **+ Add Quotation Project**
2. Enter Project Name, optional Client, and Google Sheets Link
3. Save
4. The Sheet is read automatically for:
   - Indirect Total Cost
   - Present Profit
5. The project is saved and appears in quotation history
6. Each quotation project has its own mini dashboard
7. When finished, upload the final quotation file
8. The project is automatically marked **Complete**
9. Creation, Sheet refresh, and completion are stored in the existing `activity_log` table as quotation history

No new SQL migration is required.


## v20.1 Google Sheets Reader Fix
- The quotation link field is explicitly Google Sheets only.
- Fixed null-cell/formula/rich-text handling that could trigger `Cannot read properties of null (reading toString)`.
- The reader now safely ignores blank/unsupported cells while scanning the workbook.
- Clearer error messages are shown when the Sheet is private or the required labels cannot be found.
- No SQL migration required.
