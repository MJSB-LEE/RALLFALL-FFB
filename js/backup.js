// =====================================================================
// Export Backup (admin): all data -> one Excel file
// =====================================================================
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const TYPE_LABEL = { rainfall: 'Rainfall (mm)', mill: 'FFB by Mill (MT)', block: 'FFB by Phase/Block (MT)' };

function loadXlsxLib() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = XLSX_URL;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Could not load the Excel library. Check your internet.'));
        document.head.appendChild(s);
    });
}

async function lastBackupTime() {
    const { data } = await supabaseClient.from('activity_logs').select('timestamp')
        .eq('action', 'BACKUP').order('id', { ascending: false }).limit(1);
    return data && data[0] ? new Date(data[0].timestamp) : null;
}

function daysAgo(d) { return Math.floor((Date.now() - d.getTime()) / 86400000); }

async function renderBackupInfo() {
    const el = document.getElementById('backupInfo');
    if (!el) return;
    const last = await lastBackupTime();
    if (!last) { el.innerHTML = '<span class="bad">No backup has been downloaded yet.</span>'; return; }
    const n = daysAgo(last);
    el.innerHTML = `Last backup: <b>${formatDateTime(last)}</b> (${n === 0 ? 'today' : n + ' day' + (n > 1 ? 's' : '') + ' ago'})`
        + (n >= 7 ? ' — <span class="bad">time for a new one</span>' : ' <span class="ok">✓</span>');
}

// After admin login: remind if last backup is older than 7 days
async function checkBackupReminder() {
    try {
        const last = await lastBackupTime();
        if (!last || daysAgo(last) >= 7) {
            showSetupBanner(`💾 ${last ? `Last backup was <b>${daysAgo(last)} days ago</b>.` : 'No backup downloaded yet.'}
                Go to <b>⚙️ Settings → 💾 Backup</b> and download one.
                <a href="#" onclick="showSetupBanner('');return false;" class="banner-close">Dismiss</a>`);
        }
    } catch (e) { /* not important */ }
}

async function exportBackup() {
    const btn = document.getElementById('btnBackup');
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = '⏳ Preparing backup…';
    try {
        await loadXlsxLib();
        const [cols, entries, reports, logs, estates] = await Promise.all([
            fetchAllRows(() => supabaseClient.from('estate_columns').select('*').order('id')),
            fetchAllRows(() => supabaseClient.from('daily_entries').select('*').order('record_date').order('column_id')),
            fetchAllRows(() => supabaseClient.from('monthly_reports').select('*').order('month').order('estate_name')),
            fetchAllRows(() => supabaseClient.from('activity_logs').select('*').order('id', { ascending: false })),
            fetchAllRows(() => supabaseClient.from('estates').select('*').order('id'))
        ]);
        for (const r of [cols, entries, reports, logs, estates]) if (r.error) throw r.error;
        await fetchUserProfiles();

        const colById = {};
        cols.data.forEach(c => { colById[c.id] = c; });
        const estateOrder = {};
        S.estates.forEach((e, i) => { estateOrder[e.name] = i; });

        const daily = entries.data
            .filter(r => r.value !== null && r.value !== undefined)
            .map(r => {
                const c = colById[r.column_id] || {};
                return {
                    Date: String(r.record_date).slice(0, 10), Estate: r.estate_name,
                    Type: TYPE_LABEL[c.category] || c.category, Column: c.name, Value: Number(r.value),
                    'Updated By': r.updated_by || '', 'Updated At': r.updated_at ? formatDateTime(r.updated_at) : '',
                    'Column ID': r.column_id
                };
            })
            .sort((a, b) => a.Date.localeCompare(b.Date) || (estateOrder[a.Estate] ?? 99) - (estateOrder[b.Estate] ?? 99)
                || String(a.Type).localeCompare(String(b.Type)));

        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
        const wb = XLSX.utils.book_new();
        const add = (name, rows, widths) => {
            const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '(empty)': '' }]);
            if (widths) ws['!cols'] = widths.map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws, name);
        };
        add('Read Me', [
            { Item: 'Backup of', Value: 'Masih Jaya Group — Rainfall & FFB Ledger' },
            { Item: 'Downloaded', Value: formatDateTime(new Date()) },
            { Item: 'Downloaded by', Value: displayName(currentUser) },
            { Item: 'Daily numbers', Value: daily.length },
            { Item: 'Estates', Value: estates.data.length },
            { Item: 'Note', Value: 'Passwords are NOT included. Keep this file private.' }
        ], [18, 50]);
        add('Daily Data', daily, [11, 14, 22, 22, 10, 14, 20, 10]);
        add('Monthly Reports', reports.data.map(r => ({
            Estate: r.estate_name, Month: r.month,
            'Buah Gantung Last Month': r.buah_gantung_last, 'Buah Gantung This Month': r.buah_gantung_this,
            Status: r.status, 'Submitted By': r.submitted_by || '', 'Submitted At': r.submitted_at ? formatDateTime(r.submitted_at) : '',
            'Approved By': r.approved_by || '', 'Approved At': r.approved_at ? formatDateTime(r.approved_at) : '',
            'Mill Estimate % (by column id)': JSON.stringify(r.mill_estimates || {})
        })), [14, 9, 12, 12, 10, 18, 20, 18, 20, 30]);
        add('Column Setup', cols.data.map(c => ({
            'Column ID': c.id, Estate: c.estate_name, Type: TYPE_LABEL[c.category] || c.category,
            Name: c.name, Order: c.sort_order, Active: c.active === false ? 'Hidden' : 'Yes'
        })), [10, 14, 22, 24, 7, 8]);
        add('Estates', estates.data.map(e => ({ ID: e.id, Name: e.name, Order: e.sort_order ?? '' })), [6, 20, 7]);
        add('Users', S.users.map(u => ({
            Username: u.username, 'Full Name': u.full_name, Email: u.email, Role: u.role,
            Estates: u.role === 'admin' ? 'All' : (userEstates(u).join(', ') || 'All'), Active: u.active === false ? 'Disabled' : 'Yes'
        })), [14, 24, 26, 9, 30, 9]);
        add('Audit Log', logs.data.map(l => ({
            Time: formatDateTime(l.timestamp), User: l.username, Action: l.action, Estate: l.estate, Details: l.details
        })), [20, 14, 16, 14, 50]);

        XLSX.writeFile(wb, `MJSB_Ledger_Backup_${today}.xlsx`);
        await logActivity('BACKUP', `Downloaded backup (${daily.length} daily numbers)`);
        showSetupBanner('');
        toast('✅ Backup downloaded — save it to Google Drive');
        renderBackupInfo();
    } catch (err) {
        alert('❌ Backup failed: ' + dbErrorMessage(err));
    } finally {
        btn.disabled = false;
        btn.textContent = oldText;
    }
}
