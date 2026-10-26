async function logActivity(action, details, estate = 'SYSTEM', recordDate = null) {
    if (!supabaseClient) return;

    let activeUser = currentUser ? (currentUser.username || currentUser.full_name || 'USER') : 'SYSTEM';

    const payload = {
        username: activeUser,
        user_name: activeUser,
        action: action,
        details: details,
        estate: estate,
        estate_name: estate,
        record_date: recordDate || new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString()
    };

    await supabaseClient.from('activity_logs').insert([payload]);
}

async function fetchActivityLogs() {
    const tableBody = document.getElementById('activityLogTableBody');
    if (!tableBody || !supabaseClient) return;

    const { data } = await supabaseClient
        .from('activity_logs')
        .select('*')
        .order('id', { ascending: false })
        .limit(50);

    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No activity logs recorded.</td></tr>`;
        return;
    }

    let rowsHtml = '';
    data.forEach(log => {
        rowsHtml += `<tr>
            <td style="color:#64748b; font-size:11px;">${log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}</td>
            <td><b>${formatDateToDDMMYYYY(log.record_date)}</b></td>
            <td>${log.username || 'SYSTEM'}</td>
            <td><span style="background:#e2e8f0; padding:2px 4px; border-radius:4px; font-weight:bold;">${log.action}</span></td>
            <td>${log.estate || '-'}</td>
        </tr>`;
    });
    tableBody.innerHTML = rowsHtml;
}
