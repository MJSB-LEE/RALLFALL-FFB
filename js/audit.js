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

async function fetchActivityLogs() {
    const tableBody = document.getElementById('activityLogTableBody');
    if (!tableBody || !supabaseClient) return;
    const { data } = await supabaseClient.from('activity_logs').select('*').order('id', { ascending: false }).limit(200);
    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5">No activity logs recorded.</td></tr>`;
        return;
    }
    tableBody.innerHTML = data.map(log => `<tr>
        <td class="nowrap">${formatDateTime(log.timestamp)}</td>
        <td>${esc(log.username || 'SYSTEM')}</td>
        <td><span class="log-action">${esc(log.action)}</span></td>
        <td>${esc(log.estate || '-')}</td>
        <td class="left">${esc(log.details || '')}</td>
    </tr>`).join('');
}
