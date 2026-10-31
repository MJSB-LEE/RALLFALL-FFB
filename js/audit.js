async function logActivity(action, details, estate = 'SYSTEM') {
    if (!supabaseClient) return;
    const activeUser = currentUser ? (currentUser.username || 'USER') : 'SYSTEM';
    try {
        await supabaseClient.from('activity_logs').insert([{
            username: activeUser,
            user_name: activeUser,
            action,
            details,
            estate,
            estate_name: estate,
            record_date: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString()
        }]);
    } catch (e) { console.warn('Log failed', e); }
}

// ---------------------------------------------------------------------
// Audit Log viewer (Settings -> Audit Log): filter by day range, user, estate, action
// ---------------------------------------------------------------------
const AUDIT_ACTIONS = ['LOGIN', 'LOGOUT', 'SAVE_DATA', 'SUBMIT_APPROVAL', 'APPROVE', 'UNLOCK', 'BACKUP',
    'CREATE_USER', 'EDIT_USER', 'DELETE_USER', 'ADD_ESTATE', 'ADD_COLUMN', 'RENAME_COLUMN', 'HIDE_COLUMN', 'SHOW_COLUMN', 'DELETE_COLUMN'];

function mytDate(d = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(d); }
function addDays(ymd, n) { const d = new Date(ymd + 'T12:00:00+08:00'); d.setDate(d.getDate() + n); return mytDate(d); }

function setAuditRange(kind) {
    const today = mytDate();
    let from = today, to = today;
    if (kind === 'yesterday') from = to = addDays(today, -1);
    if (kind === '7') from = addDays(today, -6);
    if (kind === 'month') from = today.slice(0, 8) + '01';
    document.getElementById('auditFrom').value = from;
    document.getElementById('auditTo').value = to;
    fetchActivityLogs();
}

function initAuditFilters() {
    const from = document.getElementById('auditFrom');
    if (!from.value) { from.value = addDays(mytDate(), -6); document.getElementById('auditTo').value = mytDate(); }
    const fill = (id, items, allLabel) => {
        const sel = document.getElementById(id);
        const keep = sel.value;
        sel.innerHTML = `<option value="">${allLabel}</option>` + items.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
        sel.value = items.includes(keep) ? keep : '';
    };
    fill('auditUser', S.users.map(u => u.username), 'All users');
    fill('auditEstate', S.estates.map(e => e.name), 'All estates');
    fill('auditAction', AUDIT_ACTIONS, 'All actions');
}

async function fetchActivityLogs() {
    const tableBody = document.getElementById('activityLogTableBody');
    if (!tableBody || !supabaseClient) return;
    let from = document.getElementById('auditFrom').value || addDays(mytDate(), -6);
    let to = document.getElementById('auditTo').value || mytDate();
    if (from > to) [from, to] = [to, from];
    const user = document.getElementById('auditUser').value;
    const estate = document.getElementById('auditEstate').value;
    const action = document.getElementById('auditAction').value;

    // Malaysia day boundaries, sent as UTC ISO text (works whether the column is text or timestamp)
    const startIso = new Date(from + 'T00:00:00+08:00').toISOString();
    const endIso = new Date(addDays(to, 1) + 'T00:00:00+08:00').toISOString();

    tableBody.innerHTML = `<tr><td colspan="5">Loading…</td></tr>`;
    const { data, error } = await fetchAllRows(() => {
        let q = supabaseClient.from('activity_logs').select('*')
            .gte('timestamp', startIso).lt('timestamp', endIso)
            .order('id', { ascending: false });
        if (user) q = q.eq('username', user);
        if (estate) q = q.eq('estate', estate);
        if (action) q = q.eq('action', action);
        return q;
    });
    const countEl = document.getElementById('auditCount');
    if (error) { tableBody.innerHTML = `<tr><td colspan="5">${esc(dbErrorMessage(error))}</td></tr>`; return; }
    countEl.textContent = `${data.length} record${data.length === 1 ? '' : 's'}`;
    if (!data.length) { tableBody.innerHTML = `<tr><td colspan="5">No activity in this period.</td></tr>`; return; }

    // Group by Malaysia day
    const byDay = {};
    data.forEach(l => { const d = l.timestamp ? mytDate(new Date(l.timestamp)) : 'Unknown'; (byDay[d] = byDay[d] || []).push(l); });
    const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    tableBody.innerHTML = Object.keys(byDay).sort().reverse().map(day => {
        const label = day === 'Unknown' ? day : new Date(day + 'T12:00:00+08:00').toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
        const users = new Set(byDay[day].map(l => l.username)).size;
        return `<tr class="day-row"><td colspan="5">📅 ${label}<span class="day-count">${byDay[day].length} actions · ${users} user${users > 1 ? 's' : ''}</span></td></tr>`
            + byDay[day].map(log => `<tr>
                <td class="nowrap">${log.timestamp ? timeFmt.format(new Date(log.timestamp)) : '-'}</td>
                <td>${esc(log.username || 'SYSTEM')}</td>
                <td><span class="log-action">${esc(log.action)}</span></td>
                <td>${esc(log.estate || '-')}</td>
                <td class="left">${esc(log.details || '')}</td>
            </tr>`).join('');
    }).join('');
}
