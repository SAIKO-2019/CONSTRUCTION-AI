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


## v20.2 Quotation Delete
- Adds **Delete Quotation** to the selected quotation dashboard.
- Requires confirmation before deletion.
- Deletes the quotation record.
- Best-effort removes the linked final uploaded file.
- Cleans up quotation history entries from `activity_log`.
- No SQL migration required.


## v20.3 Quotation Deadlines & In-System Reminders
- Adds a required **Deadline** when creating a quotation project.
- Deadline is saved in the existing `target_submission` field.
- Pending quotation deadlines are shown on project cards and the selected project dashboard.
- Adds a notification bell in the top bar.
- The system checks quotation deadlines five times during the working day:
  - 8:00 AM
  - 10:00 AM
  - 12:00 PM
  - 2:00 PM
  - 4:00 PM
- Reminders are shown for overdue quotations and quotations due within 3 days.
- Each reminder slot triggers at most once per browser/user per day.
- Browser desktop notification is used only if notification permission was already granted; in-app notification/toast works without it.
- No SQL migration required because the existing `target_submission` column is reused.


## v20.4 Per-Project Quotation Amounts
- Removed summed quotation amount totals.
- Indirect Total Cost and Present Profit are shown per quotation project only.
- Top quotation KPI labels now include the selected project name.
- Dashboard quotation snapshot also shows one card per quotation project instead of combining costs/profits.
- Project/status counts may still be shown as counts, but money values are never totaled across projects.
- No SQL migration required.


## v20.5 Scope Breakdown + Pie Chart
- Google Sheet reader now also looks for a scope table.
- It recognizes columns such as Scope / Scope of Works / Description / Trade / Division / Category.
- It looks for Amount / Cost / Total Cost or Weight / Percentage columns.
- If percentages are present, they are normalized to 100%.
- Otherwise percentages are calculated from the detected scope amounts.
- The selected quotation project gets its own Scope Breakdown pie chart and percentage legend.
- Scope data is saved in `quotation_projects.scope_breakdown` so the last read breakdown remains available even when the Sheet is closed.
- Run `v20.5-scope-breakdown.sql` once in Supabase SQL Editor.


## v20.6 Full Google Sheet Summary Reader
The quotation reader now focuses on the workbook's **Summary** sheet.

It recognizes major scope headings including:
- General Requirements
- Architectural
- Structural
- Electrical
- Plumbing
- Mechanical
- Fire Protection
- Sanitary
- Civil / Site Development
- Auxiliary / Electronics
- Landscaping
- Specialties
- Equipment
- Other / Miscellaneous

For each major scope, it also reads the amount-bearing line items underneath it until the next major scope heading.

The quotation dashboard shows:
- one pie-chart slice per major scope
- percentage share of the Summary-sheet scope amount
- major scope amount
- expandable child line-items with their amount and percentage within that scope

The parsed Summary data is saved in `quotation_projects.summary_breakdown`, so the latest read remains available even when the Google Sheet is closed.

Run `v20.6-summary-reader.sql` once in Supabase SQL Editor.


## v20.7 Summary Reader Fix + Project Edit
- Fixed Summary parsing for the shown SAIKO layout: Description in column B, amount in column C, unit/per-sqm value in column D, percentage in column E.
- Amount reader now uses the **first non-percentage numeric value after the description**, avoiding the previous mistake where percentage decimals were read as money.
- Explicit `Sub-total` rows are used as the authoritative major-scope amount and percentage.
- Recognizes Earth Works and Auxiliary Works in addition to General Requirements, Structural, Architectural, Electrical, Plumbing, Mechanical, etc.
- Child line items keep their amount and percentage from the Summary sheet.
- Adds a pencil Edit icon to every quotation project card. Project name, client, deadline, and Google Sheets link can be edited.
- Money/scope values remain Sheet-controlled and are updated through Refresh from Sheet.
- No new SQL is required beyond the v20.6 migration.


## v20.8 Cute Quotation Reminder Popup
- For Quotation reminders still run five times per working day: 8 AM, 10 AM, 12 PM, 2 PM, and 4 PM.
- Pending quotation projects with deadlines are included in the reminder; overdue / near-deadline items are shown first.
- Adds a lightweight in-app popup that stays for 30 seconds.
- Popup has a working X close button and fades smoothly in/out.
- Plays a short three-note cute chime using WebAudio; no audio file or network request is needed.
- Browser sound policies require one user interaction after page load before audio can play; the app unlocks audio on the first click/key press.
- Adds a “Test Cute Reminder” button inside the notification dialog.
- Keeps only one 60-second reminder timer and does not add MutationObservers or page-wide repeated scans.
- No SQL migration required.


## v20.9 Full Summary Fix + Visible Edit Button
- Fixed the Summary reader for layouts where column A contains section letters (A/B/C/D...) and column B contains the actual scope/description.
- Major headings now require an exact heading match or a full label ending in `WORKS`; child rows like `Structural Cast in Place`, `Storm and Sanitary Drainage`, and `Auxiliary Supply Accessories` are no longer misclassified as major scopes.
- Every amount-bearing description under each scope is preserved.
- Explicit `Sub-total` rows remain authoritative for major-scope amount and percentage.
- The Edit button is now visibly placed in the upper-right area of each quotation project card beside the status badge.
- No new SQL migration is required beyond v20.6.


## v21 — Full Summary Mirror + Performance Guard
- Saves the complete visible data from the Google Sheet `SUMMARY` tab, not only recognized scope rows.
- Preserves every populated row and column in the Summary range.
- This means Amount, Price per sqm, Weighted Percentage, descriptions, sub-totals, and additional populated columns are displayed just as they appear in the source Summary sheet.
- The existing pie chart still uses the parsed major scopes/subtotals.
- Adds a separate `Summary Sheet Data` table for the exact visible Summary content.
- Performance: v21 adds no MutationObserver, no interval, and does not wrap the main renderer. It uses one delegated click handler plus short one-shot renders after project selection or Sheet refresh.
- Existing v20.9 Edit buttons and v20.8 notification controls are preserved.
- Run `v21-full-summary-mirror.sql` once in Supabase.


## v21.1 — Required Patch Notice for All Logged-in Accounts
- Adds `patch-version.json` as the deployment version manifest.
- Every open browser checks it with one tiny no-cache request every 5 minutes and whenever the tab becomes visible again.
- When the deployed patch version differs from the currently loaded app version, a blocking **New Patch Required** notice appears.
- User clicks **Refresh & Login Again**. The app signs out the current Supabase session, refreshes the site, returns to Login, and requires manual login.
- No MutationObserver and no page-wide scan are used. Only one 5-minute timer and one visibility listener are added.
- The patch dialog has one direct button handler, so it does not stack handlers with existing controls.

### IMPORTANT FOR FUTURE PATCHES
For every new release, update BOTH:
1. `patch-version.json` -> `version`
2. `CURRENT_PATCH` in `patch-watch.js`

Example: when releasing v21.2, change both values from `21.1` to `21.2`. Existing v21.1 sessions will then detect v21.2 and require refresh/login again.

The first deployment of v21.1 cannot notify browsers that are still running older builds which did not yet contain the patch watcher. Starting with v21.1, future patches are automatically detected.

No SQL migration required for v21.1.


## v21.3 — Weighted % Fix + Editable Summary Data
- Weighted Percentage from the Google Sheet Summary is authoritative; the pie chart no longer redistributes valid source percentages.
- Amount-based percentage is only a fallback when source weighted percentage is missing.
- Adds Edit Data / Save / Cancel for full Summary Sheet Data.
- Visible Summary cells can be edited: descriptions, amounts, price per sqm, weighted percentage, and other populated columns.
- Saving updates Supabase and linked scope subtotal amount/percentage updates the pie chart.
- Manual edits are logged. Refresh from Sheet may overwrite manual edits with source values.
- No MutationObserver and no new recurring timer added.
- No new SQL required beyond the existing v21 full-summary columns.


## v21.4 — Awarded / Not Awarded Quotation Folders
- Completed quotations can be classified as **Awarded** or **Not Awarded**.
- Adds three lightweight folders/tabs:
  - For Quotation
  - Awarded
  - Not Awarded
- Classification becomes available after the final quotation file is uploaded.
- An Awarded project can later be moved to Not Awarded using **Decline → Move to Not Awarded**.
- A Not Awarded project can later be moved to Awarded using **Accept → Move to Awarded**.
- Projects can also be removed from either result folder and returned to **Complete / unclassified**.
- All result changes are recorded in `activity_log`.
- Uses the existing `status` text field; no new SQL migration is required.
- No MutationObserver and no new recurring timer added.
- Patch version bumped to 21.4.


## v21.5 — Final PDF Filename Validation
- Final quotation file accepts PDF only.
- Required filename format: `Project Name_Location_YYYY-MM-DD.pdf`.
- Project Name must match the selected quotation project.
- Location must be present.
- Date completed must be a valid `YYYY-MM-DD`.
- Invalid files are immediately rejected and the chooser is cleared so the corrected file can be selected again.
- Nothing uploads until validation passes.
- The required filename example updates per selected project.
- Existing buttons and v21.4 Awarded / Not Awarded workflow remain intact.
- No MutationObserver and no new timer added.
- No new SQL required.
- Patch version bumped to 21.5.


## v21.6 — Upload Format Notice
- Adds a clear notice above the final quotation file picker.
- The required format is shown before the user selects a file:
  `Project Name_Location_YYYY-MM-DD.pdf`
- The sample filename updates automatically for the selected quotation project.
- Clicking the file picker also shows a one-time in-app reminder for that project.
- Invalid files are still rejected by the v21.5 validation and can be re-selected after correction.
- No MutationObserver and no new recurring timer added.
- No new SQL required.
- Patch version bumped to 21.6.


## v21.7 — Item No Summary Parser + Hard Patch Re-login
- Summary parsing is now based strictly on Item No. A/B/C/D… in column A.
- Column B is treated as Work Item Description.
- Column C is Total Amount Php.
- Column D is Cost per Sq.m.
- Column E is Weighted %.
- Every description row between an Item No header and the next Item No is retained under that scope.
- Explicit Sub-total rows are authoritative for scope amount, Cost per Sq.m, and Weighted %.
- Pie chart uses source Weighted % directly.
- Patch refresh now signs the user out locally, removes Supabase auth-session keys, clears session state, and returns to the login page so the user must manually log in and pass reCAPTCHA again.
- Reminder popup label changed to simply `REMINDER`.
- No new MutationObserver or recurring timer added.
- No new SQL migration required.


## v21.8 — Pre-boot Patch Gate
- Fixes the case where a browser loads the new deployment while still carrying the old Supabase auth session.
- `patch-gate.js` runs before the app initializes.
- If an existing login session is present and the acknowledged patch version differs from the current patch, the session keys are cleared immediately.
- The page redirects back to the normal Login screen and the user must log in manually and complete reCAPTCHA again.
- The existing 5-minute patch watcher still handles users who keep an older tab open while a new deployment goes live.
- No MutationObserver and no new recurring timer were added. The pre-boot gate is a one-time localStorage check only.
- No new SQL migration required.


## v21.9 — Google Sheets Access Fallback
- Primary reader still uses Google XLSX export.
- If XLSX export cannot be loaded, the server automatically falls back to Google Visualization CSV for the `SUMMARY` tab.
- This improves compatibility with link-shared Google Sheets, including links opened in edit mode.
- General access may be **Viewer or Editor**, but it must be **Anyone with the link** for unauthenticated server-side reading.
- Sheets shared only to named/specific Google accounts still require Google OAuth and cannot be read by this public-link reader.
- Adds clearer access guidance in the Add Quotation dialog.
- No new SQL required.
- Patch version bumped to 21.9.


## v22.0 — Wider Dialogs / No Cramped Modals
- Major dialogs are now wide and centered instead of appearing compressed/minimized.
- Quotation Add/Edit and Notifications dialogs use a wider responsive layout.
- Horizontal scrolling inside standard dialogs is removed.
- Form fields shrink correctly inside the modal and buttons wrap instead of being cut off.
- Mobile screens automatically switch to a single-column form layout.
- No new MutationObserver, interval, or heavy event handler was added.
- No SQL migration required.
- Patch version bumped to 22.0.


## v22.1 — Reminder Label Cleanup
- Renamed `Test Cute Reminder` to simply `Reminder`.
- Keeps the same reminder behavior and sound; only the label/copy was simplified.
- No new SQL required.


## v22.2 — Faster Mandatory Patch Detection
- Patch notice check interval reduced from 5 minutes to **20 seconds**.
- Initial patch check starts about **0.5 second** after page load.
- Returning to the tab still triggers an immediate check.
- Reconnecting to the internet also triggers an immediate check.
- Request remains a tiny `patch-version.json` no-cache fetch.
- No MutationObserver or page-wide scans were added.
- Mandatory refresh + hard logout + manual login + reCAPTCHA flow remains enabled.
- No new SQL required.


## v22.3 — Google Sheets “Anyone with the link — Editor” Support
- You do **not** need to change the Sheet from Editor to Viewer.
- The reader now tries four methods automatically:
  1. XLSX workbook export
  2. CSV export using the exact `gid` from the pasted link
  3. Google Visualization CSV using `gid`
  4. Google Visualization CSV using the `SUMMARY` tab name
- For best results, open the `SUMMARY` tab first, then use **Copy link** and paste that URL into the quotation form.
- This patch keeps the Item No. A/B/C/D scope parser from v21.7.
- No SQL migration required.


## v22.4 — SUMMARY CSV-First Reader
- Fixes the remaining Google Sheet Editor-access failure path.
- The reader now uses the exact SUMMARY-tab `gid` CSV first, then GViz by gid, then GViz by SUMMARY name, then XLSX as a last fallback.
- Parsing errors in optional metrics no longer cause the entire Sheet read to fail.
- Stale error text that incorrectly required Viewer access was removed.
- `Anyone with the link — Editor` remains supported; no access change to Viewer is required.
- No SQL migration required.


## v22.5 — Unified Global System Release Gate
This version centralizes mandatory refresh/re-login behavior.

### What now triggers a mandatory re-login
1. **Any new Vercel deployment**
   - frontend files
   - API/serverless files
   - config changes that require a redeploy
   - environment-variable changes after redeploy
2. **Any Supabase/database migration that calls `bump_system_release()`**
   - schema changes
   - new tables/columns
   - RLS/policy changes
   - database functions or migration changes

### User behavior after detection
- Blocking `Refresh Required` notice
- Supabase session is signed out
- auth session keys are cleared locally
- page returns to Login
- user logs in manually again
- reCAPTCHA is required again

### Detection speed
- first check after ~0.5 second
- then every 10 seconds
- immediate check when returning to the tab
- immediate check when internet reconnects

### Important rule for all future database changes
Every SQL migration generated for this project must finish with:
```sql
select public.bump_system_release('description of change');
```
That makes every logged-in account detect the database change and require a fresh login.

### Limitation
A change made completely outside the app cannot be detected unless it changes the Vercel deployment fingerprint or bumps the Supabase system-release row. Therefore all future project changes should go through one of those two release paths.

No MutationObserver or page-wide repeated scan is used.


## v22.6 — Automatic Google Sheet Sync
- Quotation projects with a Google Sheet link automatically re-read their source every **5 minutes** while the app is open.
- First background sync runs about **10 seconds** after login/app load.
- Returning to the tab triggers an immediate sync.
- Adds **Sync Now** for immediate manual refresh of all linked quotation projects.
- Auto-sync updates: Indirect Total Cost, Present Profit, scope breakdown, Summary breakdown, full Summary table, and pie-chart data.
- Changes are logged to `activity_log` as `auto_sheet_sync`.
- Awarded and Not Awarded quotation projects are excluded from automatic source syncing.
- Requests run sequentially to avoid bursts and UI lag.
- Only one 5-minute timer is added; no MutationObserver or page-wide scanning loop.
- No SQL migration required.
- Patch version bumped to 22.6.


## v22.7 — For Quotation Live Sync Only
- Google Sheet auto-sync is now restricted **only to active `For Quotation` projects**.
- Complete, Awarded, and Not Awarded quotation projects are frozen and are not auto-synced from the source link.
- Changes inside a linked Google Sheet update live on the next sync and **do not trigger logout, refresh-required, or reCAPTCHA**.
- Mandatory re-login remains only for true software/system releases: new Vercel web/API deployments or explicit database migration release bumps.
- Sync interval remains every 5 minutes, with immediate sync when returning to the tab and optional Sync Now.
- No new SQL required.


## v22.8 — Near-Instant Google Sheet Link Auto-Sync
- Applies only to active **For Quotation** projects with a saved Google Sheets link.
- First auto-sync runs about **1 second** after app load.
- Background sync runs every **30 seconds** while the app tab is visible.
- Selecting a quotation project triggers an additional immediate sync for that project.
- The selected project is synchronized first, then the remaining active For Quotation projects sequentially.
- Normal Google Sheet data changes do **not** trigger logout, refresh-required, or reCAPTCHA.
- Complete, Awarded, and Not Awarded projects remain frozen from auto-sync.
- No MutationObserver; one lightweight 30-second timer only.
- No new SQL required.


## v22.9 — Project Edit Button
- Adds an **Edit** button beside Delete in the Projects table.
- Edit opens the existing Project dialog pre-filled with the saved information.
- Editable fields: Project Name, Client, Location, Original Contract Amount, Discount Amount, Net Contract Amount, Start Date, Target Date, and Status.
- Net Contract Amount continues to recalculate from Original Contract Amount minus Discount Amount.
- Saving updates the existing `projects` record instead of creating a duplicate.
- Project accomplishment remains derived from Actual Progress and is not manually edited here.
- No new SQL required.


## v23.0 — Project Subcontract Dependency Category
- Adds **Subcontract Dependency** to Add Project and Edit Project.
- Choices: **Independent** or **Dependent**.
- Shows the category directly in the Projects table.
- Existing projects default to **Independent** after migration and can be edited anytime.
- Requires running `v23.0-project-subcon-category.sql` once in Supabase SQL Editor.
- The SQL migration also bumps the global system release gate when available, so logged-in users are required to refresh/re-login for the database change.


## v23.2 — Editable Billing + Subcontract Issued Details + Stay on Page
- Adds **Edit** beside each billing record.
- Existing billing details can be changed without creating a duplicate.
- Payment history is protected during Edit; use Receive Payment / Add Payment for payment entries.
- Subcontractor Billing now has:
  - Subcontractor / Payee
  - Issued / Contract Amount
  - Date Issued
  - automatic remaining Subcontract Balance
- Billing table shows issued amount/date and subcontractor name.
- The app remembers the last active module/page and scroll position.
- After refresh, patch re-login, or reopening the site, it returns to the last module instead of always jumping back to Dashboard.
- Run `v23.2-billing-edit-subcon-details.sql` once in Supabase.


## v23.3 — Subcontract Summary on Dashboard, Details in Billing
- Dashboard shows **summary only** per subcontract-dependent contract/project: Total Subcon Allocation, Issued, Billed, Paid, and Remaining.
- Markup %, optional deductions, and deduction notes are **not shown as editable fields on Dashboard**.
- Those commercial settings live in **Billing & Payments**, under the selected Project Folder.
- Issued amount/date/payee remain in Subcontractor Billing records from v23.2.
- Run `v23.3-subcon-commercial-settings.sql` once in Supabase.


## v23.4 — Automatic Billing / Payment Dates
- Opening **Add Billing** automatically fills Date Request with today.
- Typing a Billing No./VO No. or billing amount also fills Date Request if blank.
- Entering a Receive/Paid amount automatically fills Date Paid with today.
- Entering subcontractor/payee or Issued Amount automatically fills Date Issued with today.
- Receive Payment / Add Payment now also updates the billing record's Date Paid so the date appears immediately in the billing table.
- Auto-filled dates remain editable before saving for historical entries.
- No new SQL required.


## v23.5 — Billing Save / Missing Column Fix
- Fixes Client Billing saves so they no longer send subcontract-only fields.
- Includes one consolidated SQL migration: `v23.5-required-database-fix.sql`.
- The migration creates any missing subcontract/billing columns from v23.0-v23.3 and reloads the Supabase schema cache.
- After running SQL, wait 10-20 seconds and refresh the app.


## v23.6 — Dashboard For Quotation Remarks
- Adds a small Dashboard remark showing the connection to **For Quotation**.
- Shows live counts for Active Quotations, Awarded, and Not Awarded.
- Includes an **Open For Quotation** shortcut.
- Detailed quotation data stays inside the For Quotation module; Dashboard remains summary-only.
- No new SQL required.


## v23.7 — Sticky Project / Stay Where You Are
- Fixes the recurring jump back to the global Project Folder during background refreshes and Google Sheet auto-sync.
- Billing, Schedule, Progress, Inventory, Budget, Files, and the global Workspace now remember their own selected project independently.
- Changing the top Project Folder still intentionally synchronizes module project filters.
- Background `refreshAll()` no longer overwrites the project you are currently viewing.
- The active module and scroll position are preserved across refresh/re-login.
- No SQL required.


## v23.8 — GenCon / Subcon Billing Folders
- Billing & Payments now has two folder-style views: **GenCon** and **Subcon**.
- Switching folders uses a lightweight transition and remembers the last open folder.
- GenCon shows Client Billing records only.
- Subcon shows Subcontractor Billing records only, including issued amount/date, billed, paid, outstanding, and commercial settings.
- Add Billing automatically defaults to Client Billing in GenCon and Subcontractor Billing in Subcon.
- Main Dashboard automatically summarizes both sides: GenCon billed/collections, Subcon issued/billed/paid, client outstanding, subcon outstanding, and net cash position.
- No new SQL required.


## v23.9 — Color-Coded GenCon/Subcon + Side Animation
- **GenCon** folder now uses a cool blue visual family.
- **Subcon** folder now uses a warm amber/orange visual family.
- KPI cells and billing rows inherit a subtle tint based on the active folder.
- Active folder has an animated left-side indicator.
- Switching folders uses a light horizontal slide-in transition.
- No SQL required.


## v24.0 — Tiny Paid Celebration
- When a billing changes from unpaid/partial to fully **Paid**, a small happy animation appears.
- It disappears automatically after **30 seconds**.
- Uses only `transform` and `opacity` animations for smooth GPU-friendly rendering.
- Only one `setTimeout`; no interval, MutationObserver, or page-wide scan.
- Respects `prefers-reduced-motion`.
- No SQL required.


## v24.1 — Linked GenCon → Subcon Allocation
- Every GenCon/Client Billing automatically appears in the Subcon folder.
- Each linked GenCon billing has **Has Subcon? Yes/No**.
- If Has Subcon = Yes, encode only:
  - Total Deductions
  - Retention %
  - Recoupment %
- The system calculates deductions against the **actual GenCon collected amount**.
- Net Available for Subcon = GenCon Collection − Total Deductions − Retention − Recoupment.
- Original GenCon collection is never altered; the Subcon folder shows the derived amount available for subcontract use.
- Dashboard adds Linked Subcon Available and Linked Subcon Deductions summaries.
- Requires running `v24.1-linked-gencon-subcon.sql` once in Supabase.


## v24.2 — Existing Records Update Automatically
- New features now work immediately with **existing project and billing records**.
- Existing GenCon billings automatically appear in the linked Subcon view.
- No delete, re-create, re-upload, or re-encode is required.
- Legacy records are normalized in memory after every refresh so missing new fields safely use defaults.
- Added one-time database backfill: `v24.2-existing-records-backfill.sql`.
- Added no-cache Vercel headers + cache-busted local assets to prevent the browser from showing an older patch after deployment.
- The same compatibility approach applies to project/subcon fields added in earlier patches.


## v24.3 — Clean Subcon View
- In the **Subcon** folder, only the linked summary cards are shown.
- Hidden from the Subcon folder to reduce clutter: KPI cards, commercial settings block, and the billing records table.
- The **Setup** button remains available on every linked card.
- GenCon view remains unchanged.


## v24.4 — Performance Boost
- Supabase tables now load in parallel instead of sequentially during refresh/login.
- Google Sheet auto-sync no longer calls a full-app `refreshAll()` every 30 seconds. It updates only the affected quotation cache and repaints quotation UI only when For Quotation is open.
- Removed redundant v24.2/v24.3 runtime wrappers that caused repeated Billing renders.
- Clean Subcon view is now handled directly by the Billing renderer.
- Folder animation no longer restarts on every background render.
- No MutationObserver, no new recurring timer, no extra database polling.
- No new SQL required if v24.2 backfill was already run.


## v24.5 — Downpayment + Summary-Only Dashboard
- Adds **Downpayment** as a dedicated GenCon record type beside Billing and VO.
- Downpayment records remain part of GenCon receivables/collections and are included in overall financial computations.
- Dashboard financial area is now a single compact **per-project summary table** instead of detailed financial cards.
- Per project it shows Contract Amount, Downpayment, Regular Billed, Collected, Client Outstanding, Subcon Available, and Subcon Paid.
- Detailed billing and subcontract settings remain in Billing & Payments only.
- Run `v24.5-downpayment-category.sql` once in Supabase.


## v24.6 — Restore Billing Project Folder / No Regression
- Fixes the blank **Project Folder** selection visible in Billing & Payments.
- Preserves the selected Billing project across refresh/background updates.
- If a saved Billing project is unavailable, it safely falls back to the Workspace project, then the first accessible project.
- Fixes a Dashboard compatibility error caused by removing the old detailed Billing Snapshot container in v24.5.
- The correct GenCon/Subcon Billing layout from v24.4 is preserved.
- Downpayment support and the new summary-only Dashboard from v24.5 remain included.
- No new SQL required beyond the v24.5 migration.


## v24.7 — Subcon Contract Amount + Scope Caption
- Subcon folder now has a compact **Subcon Contract** setup for the selected project.
- Fields: **Subcon Contract Amount** and **Subcontracted Scope / Caption**.
- Dashboard **Subcontractor Summary** now shows the explicit Subcon Contract Amount and Scope.
- Remaining Subcon Contract = Subcon Contract Amount − Issued amount.
- Project Financial Summary also shows the explicit **Subcon Contract** amount.
- Detailed billing remains inside Billing & Payments.
- Run `v24.7-subcon-contract-scope.sql` once in Supabase.


## v24.8 — Live Google Sheet Schedule + Actual Progress
- Schedule Tracker and Actual Progress are now **per-project Google Sheet link based**.
- Paste the link while the exact Schedule/Actual tab is open so its `gid` is included.
- The parser automatically detects common Activity/Description, Start, Finish, Weight, Actual/Accomplishment columns.
- When either tracker page is open, linked sheets auto-sync every **45 seconds** and immediately when switching project/returning to the tab.
- Sheet links are authoritative for their tracker: sync replaces that project's Schedule or Actual Progress rows with the latest linked Sheet data.
- Schedule and Actual scope names are fuzzy-matched, so slightly different wording can still compare.
- Overall Actual % uses Schedule weights against matched Actual Progress % when both linked datasets exist.
- Match summary shows matched, schedule-only, and actual-only scopes.
- No MutationObserver; one active-view-only timer.
- Run `v24.8-schedule-actual-sheet-links.sql` once in Supabase.


## v24.9 — Schedule / Actual Live Sync Fix
- Fixes `Cannot access selectedScheduleIds before initialization`.
- Fixes `actual_progress_project_id_activity_key` duplicate-key errors by collapsing duplicate/trivially different activity rows and using conflict-safe upsert.
- Skips Total/Sub-total rows from tracker imports.
- If Schedule weights exceed 100%, they are normalized to one 100% project basis to prevent planned progress above 100%.
- Schedule and Actual fuzzy scope matching remains active.
- Old Excel-upload empty text is replaced with Google Sheet link instructions.
- Run `v24.9-tracker-sync-fix.sql` once in Supabase.
