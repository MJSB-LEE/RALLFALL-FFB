# Masih Jaya Group — Rainfall & FFB Ledger

## Tabs
1. **Rainfall by Phase**: each estate's own phase names, with Today / To Date / Prev Month, total mm and rain days.
2. **FFB by Mill**: each estate's own mills, Grand Total, Buah Gantung, Pay to Workers, and the mill % table.
3. **FFB by Phase / Block**: each estate's own block names. Days that don't match Tab 2 are highlighted in orange.
4. **Group Summary** (manager/admin): FFB and rainfall for all estates, calculated automatically.
5. **Mill Summary** (manager/admin): MT and % per mill across all estates.
6. **Settings** (admin): Column Setup, Estates, Users, Audit Log.

## One-time database update (do this BEFORE putting the new files live)
1. Open Supabase, then **SQL Editor**, then **New query**.
2. Paste in `sql/01_new_tables.sql` and click **Run**.
3. Optional: paste in `sql/02_copy_old_data.sql` and click **Run** once. This copies your old mills, old mill tonnage and old single rainfall figures into the new tables.
4. Log in as admin, go to **Settings → Column Setup**, and set up each estate's rainfall phases, mills and blocks.

## Roles
| Role | Can do |
|---|---|
| User | Key in data for their ticked estates, then Submit (after submitting, the month is locked for them) |
| Manager | Everything a User can, plus Approve or Return to Draft, and Tabs 4–5 |
| Admin | Everything, plus Settings, and can edit any month |

## Known limitation (next step)
Passwords are still kept in plain text in `user_profiles`, and login is checked in the browser. The next step is to move to Supabase Auth with Row Level Security.
