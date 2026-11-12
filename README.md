# Masih Jaya Group — Rainfall & FFB Ledger

## Tabs
1. **Rainfall by Phase**: each estate's own phase names, with Today / To Date / Prev Month, total mm and rain days.
2. **FFB by Mill**: each estate's own mills, Grand Total, Buah Gantung, Pay to Workers, and the mill % table.
3. **FFB by Phase / Block**: each estate's own block names. Days that don't match Tab 2 are highlighted in orange.
4. **Summary**: FFB and rainfall totals, calculated automatically. A 📍 Location picker shows only the estates you're allowed to see, with an **All Locations** button.
5. **Mill Summary**: one section per estate, with that estate's Phase/Block subtotals and Mill/Supplier subtotals. Each adds up to 100% of that estate, and estates are never mixed.
6. **Settings** (for groups with Settings access): Column Setup, Estates, Users, User Groups, Audit Log, and Backup.

## One-time database update (do this BEFORE putting the new files live)
1. Open Supabase, then **SQL Editor**, then **New query**.
2. Paste in `sql/01_new_tables.sql` and click **Run**.
3. Optional: paste in `sql/02_copy_old_data.sql` and click **Run** once. This copies your old mills, old mill tonnage and old single rainfall figures into the new tables.
4. Log in as admin, go to **Settings → Column Setup**, and set up each estate's rainfall phases, mills and blocks.

## Security update (sql/03_security.sql)
Run this once in Supabase SQL Editor, then **upload the new website files straight away**. The old website can't log in after this file has run.
- Passwords are stored scrambled (bcrypt). Everyone logs in with the same password as before.
- The database refuses everything unless the request comes from someone who is logged in. Each login lasts 24 hours.
- A user can only read and change their own estates, and can't change a month once it has been submitted or approved.
- Only an admin can change settings and users, or read the audit log.
- The old tables (daily_records, daily_mill_records, estate_mills) are locked and kept as a backup.

## Update 4 (sql/04_updates.sql)
- **Last login** is shown for each user in Settings → Users.
- Your login **stays alive while you work**: every save extends it by 24 hours. If it does expire, a login box pops up and the numbers you typed are kept.
- **Audit log by day**: pick Today, Yesterday, Last 7 days or This month, or choose your own dates. You can also filter by user, estate and action.
- **Lock rules**: after Submit, only an **admin** can edit. A manager can only **Approve**, and only an admin can **Unlock to Edit**.
- **Users and managers only see their ticked estates**, including in the summaries. If none are ticked, they see nothing. Admins always see all estates.

## Update 5: User Groups (sql/05_user_groups.sql)
Run this once in Supabase SQL Editor, then upload the new website files straight away.
- **Settings → 👥 User Groups**: for each group, set Tabs 1–3 to None / View / Edit, set Tabs 4–5 to None / View, and choose whether the group can Submit, Approve, Unlock and use Settings.
  - **None** hides the tab.
  - **View** shows the numbers but locks the boxes.
  - **Edit** lets the group key in.
- Starting groups: **Admin**, **Manager** (view all, approve), **Clerk Rainfall** (edits Tab 1), **Clerk FFB** (edits Tabs 2–3), and **Clerk Full** (edits Tabs 1–3). You can change them or add more.
- **Settings → 👤 Users**: give each user one group, plus their estates (or **All estates**).
- Existing users were moved automatically: admin went to Admin with all estates, manager went to Manager, and user went to Clerk Full.
- The database also checks the group rights, so a Clerk Rainfall user can't save FFB numbers.

## Backup (free)
Go to Settings, then 💾 Backup, then **Download Backup (Excel)** once a week, and save the file to Google Drive. Admins see a reminder if the last backup is 7 or more days old.

## Who can do what
Each user's **group** decides what they can do (see Update 5). Their **estates** decide where they can do it. Approving, viewing and keying in only work for that user's own estates, unless they have **All estates**.
