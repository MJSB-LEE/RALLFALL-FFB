async function loadOverallSummary() {
    const monthYear = document.getElementById('bulanTahun')?.value;
    if (!monthYear || !supabaseClient) return;
    const [year, month] = monthYear.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();

    const { data } = await supabaseClient
        .from('daily_records')
        .select('estate_name, record_date, rainfall_today')
        .gte('record_date', `${monthYear}-01`)
        .lte('record_date', `${monthYear}-${String(lastDay).padStart(2, '0')}`);

    let matrix = {};
    estateList.forEach(est => { matrix[est] = {}; });
    if (data) data.forEach(r => { if (matrix[r.estate_name]) matrix[r.estate_name][parseInt(r.record_date.split('-')[2], 10)] = parseFloat(r.rainfall_today) || 0; });

    let estateHdr = '<th>DATE</th>', subHdr = '<th>DATE</th>';
    estateList.forEach(est => { estateHdr += `<th colspan="2">${est}</th>`; subHdr += `<th>TO DAY</th><th>TO DATE</th>`; });
    if (document.getElementById('hdr-estates')) document.getElementById('hdr-estates').innerHTML = estateHdr + '<th>DATE</th>';
    if (document.getElementById('hdr-sub')) document.getElementById('hdr-sub').innerHTML = subHdr + '<th>DATE</th>';

    let tbody = '';
    let estateTotals = {};
    estateList.forEach(est => { estateTotals[est] = 0; });

    for (let d = 1; d <= lastDay; d++) {
        tbody += `<tr><td><b>${d}</b></td>`;
        estateList.forEach(est => {
            let val = matrix[est][d] || 0;
            estateTotals[est] += val;
            tbody += `<td>${val > 0 ? val.toFixed(1) : ''}</td><td class="readonly-cell">${estateTotals[est] > 0 ? estateTotals[est].toFixed(1) : ''}</td>`;
        });
        tbody += `<td><b>${d}</b></td></tr>`;
    }
    if (document.getElementById('tbody-summary')) document.getElementById('tbody-summary').innerHTML = tbody;
}

async function loadMillSummaryBreakdown() {
    const estate = document.getElementById('ladangSelect')?.value;
    const monthYear = document.getElementById('bulanTahun')?.value;
    if (!monthYear || !estate || !supabaseClient) return;
    const [year, month] = monthYear.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();

    const { data } = await supabaseClient
        .from('daily_mill_records')
        .select('mill_name, ffb_tonnage')
        .ilike('estate_name', estate)
        .gte('record_date', `${monthYear}-01`)
        .lte('record_date', `${monthYear}-${String(lastDay).padStart(2, '0')}`);

    const tbody = document.getElementById('tbody-mill-summary');
    if (!tbody) return;

    let millTotals = {}, grandTotal = 0;
    if (data) data.forEach(r => { let ffb = parseFloat(r.ffb_tonnage) || 0; millTotals[r.mill_name] = (millTotals[r.mill_name] || 0) + ffb; grandTotal += ffb; });

    let rows = '';
    Object.keys(millTotals).sort().forEach(m => {
        let ffb = millTotals[m];
        rows += `<tr><td><b>${m}</b></td><td>${ffb.toFixed(2)} MT</td><td>-</td><td>${grandTotal > 0 ? ((ffb/grandTotal)*100).toFixed(2) : '0.00'}%</td></tr>`;
    });
    tbody.innerHTML = rows || `<tr><td colspan="4">No mill data for ${estate} in ${monthYear}</td></tr>`;
}
