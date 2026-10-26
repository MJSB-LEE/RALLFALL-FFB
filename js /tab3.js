async function buildTab3MillGrid() {
    const estate = document.getElementById('ladangSelect')?.value;
    const monthYear = document.getElementById('bulanTahun')?.value;
    if (!monthYear || !estate || !supabaseClient) return;

    const currentMills = estateMills.filter(m => m.estate_name.toLowerCase() === estate.toLowerCase()).map(m => m.mill_name);
    const [year, month] = monthYear.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();

    const headerRow = document.getElementById('tab3HeaderMills');
    if (headerRow) {
        let cols = '';
        if (currentMills.length === 0) cols = `<th style="color:#94a3b8;">NO MILLS CONFIGURED IN SETTINGS</th>`;
        else currentMills.forEach(m => cols += `<th style="min-width:110px;">${m}</th>`);
        headerRow.innerHTML = cols;
    }

    const tbody = document.getElementById('tbody-tab3');
    if (!tbody) return;

    let bodyHtml = '';
    for (let d = 1; d <= 31; d++) {
        let isHidden = d > lastDay ? 'style="display:none;"' : '';
        bodyHtml += `<tr ${isHidden}>
            <td><b>${d}</b></td>`;
        if (currentMills.length === 0) {
            bodyHtml += `<td style="background:#f8fafc;">-</td>`;
        } else {
            currentMills.forEach((m, idx) => {
                bodyHtml += `<td><input type="number" step="any" id="tab3_${d}_m_${idx}" oninput="calcTab3Full()"></td>`;
            });
        }
        bodyHtml += `<td class="readonly-cell" id="tab3_today_${d}"></td>
            <td class="readonly-cell" id="tab3_todate_${d}"></td>
            <td><input type="number" step="any" id="tab3_pm_${d}" readonly class="readonly-cell"></td>
        </tr>`;
    }
    tbody.innerHTML = bodyHtml;
    await loadTab3FromCloud(estate, monthYear, lastDay, currentMills);
}

async function loadTab3FromCloud(estate, monthYear, lastDay, currentMills) {
    const { data } = await supabaseClient
        .from('daily_mill_records')
        .select('*')
        .ilike('estate_name', estate)
        .gte('record_date', `${monthYear}-01`)
        .lte('record_date', `${monthYear}-${String(lastDay).padStart(2, '0')}`);

    if (data) {
        data.forEach(r => {
            let day = parseInt(r.record_date.split('-')[2], 10);
            let millIndex = currentMills.indexOf(r.mill_name);
            if (millIndex !== -1) {
                let input = document.getElementById(`tab3_${day}_m_${millIndex}`);
                if (input) input.value = r.ffb_tonnage > 0 ? r.ffb_tonnage : '';
            }
        });
    }
    calcTab3Full();
}

function calcTab3Full() {
    const estate = document.getElementById('ladangSelect')?.value;
    const currentMills = estateMills.filter(m => m.estate_name.toLowerCase() === estate.toLowerCase()).map(m => m.mill_name);
    let cumTotal = 0;
    for (let d = 1; d <= 31; d++) {
        let daySum = 0;
        currentMills.forEach((m, idx) => {
            daySum += parseFloat(document.getElementById(`tab3_${d}_m_${idx}`)?.value) || 0;
        });
        cumTotal += daySum;
        const todayElem = document.getElementById(`tab3_today_${d}`);
        const toDateElem = document.getElementById(`tab3_todate_${d}`);
        if (todayElem) todayElem.innerText = daySum > 0 ? daySum.toFixed(2) : '';
        if (toDateElem) toDateElem.innerText = cumTotal > 0 ? cumTotal.toFixed(2) : '';
    }
}

async function saveTab3ToCloud() {
    const estate = document.getElementById('ladangSelect')?.value;
    const monthYear = document.getElementById('bulanTahun')?.value;
    if (!monthYear || !estate) return;

    const currentMills = estateMills.filter(m => m.estate_name.toLowerCase() === estate.toLowerCase()).map(m => m.mill_name);
    const [year, month] = monthYear.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const activeUser = currentUser ? (currentUser.full_name || currentUser.username) : "System Administrator";

    let millUpdates = [], dailyUpdates = [];
    for (let d = 1; d <= daysInMonth; d++) {
        let fullDate = `${monthYear}-${String(d).padStart(2, '0')}`;
        let dayGrandTotal = 0;
        currentMills.forEach((m, idx) => {
            let tonVal = parseFloat(document.getElementById(`tab3_${d}_m_${idx}`)?.value) || 0;
            dayGrandTotal += tonVal;
            millUpdates.push({ estate_name: estate, record_date: fullDate, mill_name: m, ffb_tonnage: tonVal, updated_by: activeUser });
        });
        dailyUpdates.push({ estate_name: estate, record_date: fullDate, ffb1: dayGrandTotal, updated_by: activeUser });
    }

    if (millUpdates.length > 0) await supabaseClient.from('daily_mill_records').upsert(millUpdates, { onConflict: 'estate_name,record_date,mill_name' });
    await supabaseClient.from('daily_records').upsert(dailyUpdates, { onConflict: 'estate_name,record_date' });
}
