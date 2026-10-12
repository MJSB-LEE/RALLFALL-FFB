// Supabase Configuration
const SUPABASE_URL = 'https://tiwulxrorrmyxtosvzkw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_W4-5_riBQWAUBPVtgX8Pcw_WCRET_KF';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let estateList = [
    { name: "STY", aug: "1304.68", pfb: "389" },
    { name: "Klagan PH1", aug: "1877.14", pfb: "231" },
    { name: "Kars PH1/2/4", aug: "1251.25", pfb: "232" },
    { name: "Kars PH3", aug: "553.94", pfb: "158" },
    { name: "Sg Millian 1", aug: "279.58", pfb: "261" },
    { name: "Sg Millian 2", aug: "81.12", pfb: "100" },
    { name: "Sg Millian 3", aug: "55.24", pfb: "193" },
    { name: "Labuk", aug: "223.62", pfb: "178" }
];

let systemUsers = ["Manager 1", "Estate Supervisor", "Data Entry Officer"];

async function saveToCloud() {
    const estate = document.getElementById('ladangSelect').value;
    const monthYear = document.getElementById('bulanTahun').value; // e.g. "2026-09"
    
    if (!monthYear) {
        alert("Please select a Month and Year first.");
        return;
    }

    // Get the exact number of days for the selected month (e.g., 30 for Sept, 31 for Oct)
    const [year, month] = monthYear.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let updates = [];

    for (let d = 1; d <= daysInMonth; d++) {
        let rf = parseFloat(document.getElementById(`s1_rf_${d}`)?.value) || 0;
        let f1 = parseFloat(document.getElementById(`s1_ffb1_${d}`)?.value) || 0;
        let f2 = parseFloat(document.getElementById(`s1_ffb2_${d}`)?.value) || 0;
        let f3 = parseFloat(document.getElementById(`s1_ffb3_${d}`)?.value) || 0;
        let f4 = parseFloat(document.getElementById(`s1_ffb4_${d}`)?.value) || 0;

        let rf_p1 = parseFloat(document.getElementById(`s2_p1_t_${d}`)?.value) || 0;
        let rf_p2 = parseFloat(document.getElementById(`s2_p2_t_${d}`)?.value) || 0;
        let rf_p3 = parseFloat(document.getElementById(`s2_p3_t_${d}`)?.value) || 0;
        let rf_p4 = parseFloat(document.getElementById(`s2_p4_t_${d}`)?.value) || 0;

        let m1 = parseFloat(document.getElementById(`s3_m1_${d}`)?.value) || 0;
        let m2 = parseFloat(document.getElementById(`s3_m2_${d}`)?.value) || 0;
        let m3 = parseFloat(document.getElementById(`s3_m3_${d}`)?.value) || 0;
        let m4 = parseFloat(document.getElementById(`s3_m4_${d}`)?.value) || 0;
        let m5 = parseFloat(document.getElementById(`s3_m5_${d}`)?.value) || 0;
        let m6 = parseFloat(document.getElementById(`s3_m6_${d}`)?.value) || 0;

        let ffb_phases = {};
        for (let p = 1; p <= 12; p++) {
            ffb_phases[`ffb_phase${p}`] = parseFloat(document.getElementById(`s4_p${p}_${d}`)?.value) || 0;
        }

        let dayStr = String(d).padStart(2, '0');
        updates.push({
            estate_name: estate,
            record_date: `${monthYear}-${dayStr}`,
            rainfall_today: rf,
            ffb1: f1 || m1,
            ffb2: f2 || m2,
            ffb3: f3 || m3,
            ffb4: f4 || m4,
            ffb5: m5,
            ffb6: m6,
            rf_phase1: rf_p1,
            rf_phase2: rf_p2,
            rf_phase3: rf_p3,
            rf_phase4: rf_p4,
            ...ffb_phases
        });
    }

    const { error } = await supabaseClient
        .from('daily_records')
        .upsert(updates, { onConflict: 'estate_name,record_date' });

    if (error) alert("Error saving data: " + error.message);
    else alert("Data successfully saved to Cloud!");
}

async function loadFromCloud() {
    const estate = document.getElementById('ladangSelect').value;
    const monthYear = document.getElementById('bulanTahun').value;

    const { data, error } = await supabaseClient
        .from('daily_records')
        .select('*')
        .eq('estate_name', estate)
        .gte('record_date', `${monthYear}-01`)
        .lte('record_date', `${monthYear}-31`);

    if (error || !data) return;

    data.forEach(row => {
        let day = parseInt(row.record_date.split('-')[2], 10);

        if (document.getElementById(`s1_rf_${day}`)) document.getElementById(`s1_rf_${day}`).value = row.rainfall_today || '';
        if (document.getElementById(`s1_ffb1_${day}`)) document.getElementById(`s1_ffb1_${day}`).value = row.ffb1 || '';
        if (document.getElementById(`s1_ffb2_${day}`)) document.getElementById(`s1_ffb2_${day}`).value = row.ffb2 || '';
        if (document.getElementById(`s1_ffb3_${day}`)) document.getElementById(`s1_ffb3_${day}`).value = row.ffb3 || '';
        if (document.getElementById(`s1_ffb4_${day}`)) document.getElementById(`s1_ffb4_${day}`).value = row.ffb4 || '';

        if (document.getElementById(`s2_p1_t_${day}`)) document.getElementById(`s2_p1_t_${day}`).value = row.rf_phase1 || '';
        if (document.getElementById(`s2_p2_t_${day}`)) document.getElementById(`s2_p2_t_${day}`).value = row.rf_phase2 || '';
        if (document.getElementById(`s2_p3_t_${day}`)) document.getElementById(`s2_p3_t_${day}`).value = row.rf_phase3 || '';
        if (document.getElementById(`s2_p4_t_${day}`)) document.getElementById(`s2_p4_t_${day}`).value = row.rf_phase4 || '';

        if (document.getElementById(`s3_m1_${day}`)) document.getElementById(`s3_m1_${day}`).value = row.ffb1 || '';
        if (document.getElementById(`s3_m2_${day}`)) document.getElementById(`s3_m2_${day}`).value = row.ffb2 || '';
        if (document.getElementById(`s3_m3_${day}`)) document.getElementById(`s3_m3_${day}`).value = row.ffb3 || '';
        if (document.getElementById(`s3_m4_${day}`)) document.getElementById(`s3_m4_${day}`).value = row.ffb4 || '';
        if (document.getElementById(`s3_m5_${day}`)) document.getElementById(`s3_m5_${day}`).value = row.ffb5 || '';
        if (document.getElementById(`s3_m6_${day}`)) document.getElementById(`s3_m6_${day}`).value = row.ffb6 || '';

        for (let p = 1; p <= 12; p++) {
            if (document.getElementById(`s4_p${p}_${day}`)) {
                document.getElementById(`s4_p${p}_${day}`).value = row[`ffb_phase${p}`] || '';
            }
        }
    });

    calcS1();
    calcS2();
    syncRainfallToSummary();
}

function renderEstateDropdown() {
    const select = document.getElementById('ladangSelect');
    select.innerHTML = '';
    estateList.forEach(est => {
        let opt = document.createElement('option');
        opt.value = est.name;
        opt.innerText = est.name;
        select.appendChild(opt);
    });
}

function renderSettingsUI() {
    const estListUi = document.getElementById('estateSettingsList');
    if (!estListUi) return;
    estListUi.innerHTML = '';
    estateList.forEach((est, idx) => {
        estListUi.innerHTML += `<li style="padding: 6px; background: white; margin-bottom: 4px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span>${est.name}</span>
            <button onclick="removeEstate(${idx})" style="background:#ef4444; color:white; border:none; padding: 2px 6px; border-radius:3px; cursor:pointer;">Delete</button>
        </li>`;
    });

    const userListUi = document.getElementById('userSettingsList');
    if (!userListUi) return;
    userListUi.innerHTML = '';
    systemUsers.forEach((usr, idx) => {
        userListUi.innerHTML += `<li style="padding: 6px; background: white; margin-bottom: 4px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span>${usr}</span>
            <button onclick="removeUser(${idx})" style="background:#ef4444; color:white; border:none; padding: 2px 6px; border-radius:3px; cursor:pointer;">Delete</button>
        </li>`;
    });
}

function addNewEstate() {
    const nameInput = document.getElementById('newEstateName');
    if (!nameInput.value.trim()) return alert("Enter estate name");
    estateList.push({ name: nameInput.value.trim(), aug: "0", pfb: "0" });
    nameInput.value = '';
    renderEstateDropdown();
    buildSummaryHeader();
    buildSummaryBody();
    renderSettingsUI();
}

function removeEstate(idx) {
    estateList.splice(idx, 1);
    renderEstateDropdown();
    buildSummaryHeader();
    buildSummaryBody();
    renderSettingsUI();
}

function addNewUser() {
    const userInput = document.getElementById('newUserName');
    if (!userInput.value.trim()) return alert("Enter user name");
    systemUsers.push(userInput.value.trim());
    userInput.value = '';
    renderSettingsUI();
}

function removeUser(idx) {
    systemUsers.splice(idx, 1);
    renderSettingsUI();
}

function onEstateOrMonthChange() {
    updateSummaryHeader();
    syncRainfallToSummary();
    loadFromCloud();
}

function initKeyInTables() {
    let s1 = '';
    for (let d = 1; d <= 31; d++) {
        s1 += `<tr>
            <td><b>${d}</b></td>
            <td><input type="number" step="any" id="s1_rf_${d}" oninput="calcS1(); syncRainfallToSummary();"></td>
            <td class="readonly-cell" id="s1_rf_todate_${d}"></td>
            <td><input type="number" step="any" id="s1_rf_pm_${d}"></td>
            <td><input type="number" step="any" id="s1_ffb1_${d}" oninput="calcS1()"></td>
            <td><input type="number" step="any" id="s1_ffb2_${d}" oninput="calcS1()"></td>
            <td><input type="number" step="any" id="s1_ffb3_${d}" oninput="calcS1()"></td>
            <td><input type="number" step="any" id="s1_ffb4_${d}" oninput="calcS1()"></td>
            <td class="readonly-cell" id="s1_gt_today_${d}"></td>
            <td class="readonly-cell" id="s1_gt_todate_${d}"></td>
            <td><input type="number" step="any" id="s1_ffb_pm_${d}"></td>
        </tr>`;
    }
    document.getElementById('tbody-s1').innerHTML = s1;

    let s2 = '';
    for (let d = 1; d <= 31; d++) {
        s2 += `<tr>
            <td><b>${d}</b></td>
            ${[1,2,3,4].map(p => `
                <td><input type="number" step="any" id="s2_p${p}_t_${d}" oninput="calcS2(); syncRainfallToSummary();"></td>
                <td class="readonly-cell" id="s2_p${p}_td_${d}"></td>
                <td><input type="number" step="any" id="s2_p${p}_pm_${d}"></td>
            `).join('')}
        </tr>`;
    }
    document.getElementById('tbody-s2').innerHTML = s2;

    let s3 = '';
    for (let d = 1; d <= 31; d++) {
        s3 += `<tr>
            <td><b>${d}</b></td>
            ${[1,2,3,4,5,6].map(m => `<td><input type="number" step="any" id="s3_m${m}_${d}"></td>`).join('')}
            <td class="readonly-cell" id="s3_gt_today_${d}"></td>
            <td class="readonly-cell" id="s3_gt_todate_${d}"></td>
            <td><input type="number" step="any" id="s3_pm_${d}"></td>
        </tr>`;
    }
    document.getElementById('tbody-s3').innerHTML = s3;

    let s4Hdr = '';
    for (let p = 1; p <= 12; p++) {
        s4Hdr += `<th style="width: 60px;"><input type="text" value="P${p}" style="font-weight:bold; text-align:center;"></th>`;
    }
    s4Hdr += `<th>TODAY</th><th>TODATE</th>`;
    document.getElementById('s4-phase-headers').innerHTML = s4Hdr;

    let s4 = '';
    for (let d = 1; d <= 31; d++) {
        s4 += `<tr>
            <td><b>${d}</b></td>
            ${Array.from({length:12}, (_, i) => `<td><input type="number" step="any" id="s4_p${i+1}_${d}"></td>`).join('')}
            <td class="readonly-cell" id="s4_gt_today_${d}"></td>
            <td class="readonly-cell" id="s4_gt_todate_${d}"></td>
            <td><input type="number" step="any" id="s4_pm_${d}"></td>
        </tr>`;
    }
    document.getElementById('tbody-s4').innerHTML = s4;
}

function buildSummaryHeader() {
    let augHtml = '<th class="header-aug" style="width: 40px;">AUG</th>';
    let pfbHtml = '<th class="header-pfb">PFB</th>';
    let estateHtml = '<th class="header-rain">Rain</th>';
    let subHtml = '<th>Date</th>';
    let totHtml = '<td>Total</td>';
    let daysHtml = '<td>Days</td>';

    estateList.forEach((est, idx) => {
        augHtml += `<th colspan="2" class="header-pfb"><input type="number" step="any" value="${est.aug}" style="font-weight:bold; text-align:center;"></th>`;
        pfbHtml += `<th colspan="2"><input type="number" step="any" value="${est.pfb}" style="text-align:center;"></th>`;
        estateHtml += `<th colspan="2" class="header-estate">${est.name}</th>`;
        subHtml += `<th>To Day</th><th>To Date</th>`;
        totHtml += `<td id="tot_d_${idx}">0</td><td id="tot_td_${idx}">0</td>`;
        daysHtml += `<td colspan="2" id="days_${idx}">0 Days</td>`;
    });

    augHtml += '<th rowspan="4" style="width: 40px;">Date</th>';
    totHtml += '<td>-</td>';
    daysHtml += '<td>-</td>';

    document.getElementById('hdr-aug').innerHTML = augHtml;
    document.getElementById('hdr-pfb').innerHTML = pfbHtml;
    document.getElementById('hdr-estates').innerHTML = estateHtml;
    document.getElementById('hdr-sub').innerHTML = subHtml;
    document.getElementById('row-totals').innerHTML = totHtml;
    document.getElementById('row-days').innerHTML = daysHtml;
}

function buildSummaryBody() {
    let html = '';
    for (let d = 1; d <= 31; d++) {
        html += `<tr><td><b>${d}</b></td>`;
        estateList.forEach((_, idx) => {
            html += `
                <td><input type="number" step="any" id="es_${idx}_d_${d}" oninput="calcSummary()"></td>
                <td class="readonly-cell" id="es_${idx}_td_${d}"></td>
            `;
        });
        html += `<td><b>${d}</b></td></tr>`;
    }
    document.getElementById('tbody-summary').innerHTML = html;
}

function calcS1() {
    let cumRf = 0, cumFfb = 0;
    for (let d = 1; d <= 31; d++) {
        let rfVal = parseFloat(document.getElementById(`s1_rf_${d}`).value) || 0;
        cumRf += rfVal;
        document.getElementById(`s1_rf_todate_${d}`).innerText = cumRf > 0 ? cumRf.toFixed(2) : '';

        let f1 = parseFloat(document.getElementById(`s1_ffb1_${d}`).value) || 0;
        let f2 = parseFloat(document.getElementById(`s1_ffb2_${d}`).value) || 0;
        let f3 = parseFloat(document.getElementById(`s1_ffb3_${d}`).value) || 0;
        let f4 = parseFloat(document.getElementById(`s1_ffb4_${d}`).value) || 0;
        let sumToday = f1 + f2 + f3 + f4;
        cumFfb += sumToday;

        document.getElementById(`s1_gt_today_${d}`).innerText = sumToday > 0 ? sumToday.toFixed(2) : '';
        document.getElementById(`s1_gt_todate_${d}`).innerText = cumFfb > 0 ? cumFfb.toFixed(2) : '';
    }
}

function calcS2() {
    for (let p = 1; p <= 4; p++) {
        let cum = 0;
        for (let d = 1; d <= 31; d++) {
            let val = parseFloat(document.getElementById(`s2_p${p}_t_${d}`).value) || 0;
            cum += val;
            document.getElementById(`s2_p${p}_td_${d}`).innerText = cum > 0 ? cum.toFixed(2) : '';
        }
    }
}

function syncRainfallToSummary() {
    const selectedEstate = document.getElementById('ladangSelect').value;
    for (let d = 1; d <= 31; d++) {
        let val = document.getElementById(`s1_rf_${d}`) ? document.getElementById(`s1_rf_${d}`).value : '';
        estateList.forEach((est, idx) => {
            if (est.name === selectedEstate) {
                let targetInput = document.getElementById(`es_${idx}_d_${d}`);
                if (targetInput) targetInput.value = val;
            }
        });
    }
    calcSummary();
}

function calcSummary() {
    estateList.forEach((_, idx) => {
        let cum = 0;
        let days = 0;

        for (let d = 1; d <= 31; d++) {
            let inputElem = document.getElementById(`es_${idx}_d_${d}`);
            let tdElem = document.getElementById(`es_${idx}_td_${d}`);
            let valStr = inputElem ? inputElem.value : '';

            if (valStr !== '' && !isNaN(valStr)) {
                let val = parseFloat(valStr);
                cum += val;
                if (val > 0) days++;
                tdElem.innerText = cum.toFixed(1);
            } else {
                if (tdElem) tdElem.innerText = cum > 0 ? cum.toFixed(1) : '';
            }
        }

        let totD = document.getElementById(`tot_d_${idx}`);
        let totTd = document.getElementById(`tot_td_${idx}`);
        let daysElem = document.getElementById(`days_${idx}`);

        if (totD) totD.innerText = cum > 0 ? cum.toFixed(1) : '0';
        if (totTd) totTd.innerText = cum > 0 ? cum.toFixed(1) : '0';
        if (daysElem) daysElem.innerText = days + ' Days';
    });
}

function updateSummaryHeader() {
    let val = document.getElementById('bulanTahun').value;
    if (val) {
        let d = new Date(val + "-01");
        let mName = d.toLocaleString('en', { month: 'short' }).toUpperCase();
        let y = d.getFullYear();
        document.getElementById('sumReportTitle').innerText = `RAINFALL REPORT MONTH OF ${mName} ${y}`;
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.getElementById(`btn-${tabId}`).classList.add('active');
}

window.onload = function() {
    renderEstateDropdown();
    initKeyInTables();
    buildSummaryHeader();
    buildSummaryBody();
    updateSummaryHeader();
    renderSettingsUI();
    loadFromCloud();
};
