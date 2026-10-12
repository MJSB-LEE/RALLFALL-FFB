// Supabase Configuration
const SUPABASE_URL = 'https://tiwulxrorrmyxtosvzkw.supabase.co';
const SUPABASE_KEY = 'YOUR-ANON-PUBLIC-KEY'; // Insert your copied anon key here
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const estateList = [
    { name: "STY", aug: "1304.68", pfb: "389" },
    { name: "Klagan PH1", aug: "1877.14", pfb: "231" },
    { name: "Kars PH1/2/4", aug: "1251.25", pfb: "232" },
    { name: "Kars PH3", aug: "553.94", pfb: "158" },
    { name: "Sg Millian 1", aug: "279.58", pfb: "261" },
    { name: "Sg Millian 2", aug: "81.12", pfb: "100" },
    { name: "Sg Millian 3", aug: "55.24", pfb: "193" },
    { name: "Labuk", aug: "223.62", pfb: "178" }
];

async function saveToCloud() {
    const estate = document.getElementById('ladangSelect').value;
    const monthYear = document.getElementById('bulanTahun').value;
    let updates = [];

    for (let d = 1; d <= 31; d++) {
        let rf = parseFloat(document.getElementById(`s1_rf_${d}`).value) || 0;
        let f1 = parseFloat(document.getElementById(`s1_ffb1_${d}`).value) || 0;
        let f2 = parseFloat(document.getElementById(`s1_ffb2_${d}`).value) || 0;
        let f3 = parseFloat(document.getElementById(`s1_ffb3_${d}`).value) || 0;
        let f4 = parseFloat(document.getElementById(`s1_ffb4_${d}`).value) || 0;

        if (rf === 0 && f1 === 0 && f2 === 0 && f3 === 0 && f4 === 0) continue;

        let dayStr = String(d).padStart(2, '0');
        updates.push({
            estate_name: estate,
            record_date: `${monthYear}-${dayStr}`,
            rainfall_today: rf,
            ffb1: f1, ffb2: f2, ffb3: f3, ffb4: f4
        });
    }

    if (updates.length === 0) return alert("Tiada data untuk disimpan.");

    const { error } = await supabaseClient
        .from('daily_records')
        .upsert(updates, { onConflict: 'estate_name,record_date' });

    if (error) alert("Ralat semasa menyimpan: " + error.message);
    else alert("Data berjaya disimpan ke Cloud!");
}

async function loadFromCloud() {
    const estate = document.getElementById('ladangSelect').value;
    const monthYear = document.getElementById('bulanTahun').value;

    for (let d = 1; d <= 31; d++) {
        if (document.getElementById(`s1_rf_${d}`)) document.getElementById(`s1_rf_${d}`).value = '';
        if (document.getElementById(`s1_ffb1_${d}`)) document.getElementById(`s1_ffb1_${d}`).value = '';
        if (document.getElementById(`s1_ffb2_${d}`)) document.getElementById(`s1_ffb2_${d}`).value = '';
        if (document.getElementById(`s1_ffb3_${d}`)) document.getElementById(`s1_ffb3_${d}`).value = '';
        if (document.getElementById(`s1_ffb4_${d}`)) document.getElementById(`s1_ffb4_${d}`).value = '';
    }

    const { data, error } = await supabaseClient
        .from('daily_records')
        .select('*')
        .eq('estate_name', estate)
        .gte('record_date', `${monthYear}-01`)
        .lte('record_date', `${monthYear}-31`);

    if (error) {
        console.error("Ralat memuatkan data:", error);
        return;
    }

    if (data && data.length > 0) {
        data.forEach(row => {
            let day = parseInt(row.record_date.split('-')[2], 10);
            if (document.getElementById(`s1_rf_${day}`)) {
                document.getElementById(`s1_rf_${day}`).value = row.rainfall_today || '';
                document.getElementById(`s1_ffb1_${day}`).value = row.ffb1 || '';
                document.getElementById(`s1_ffb2_${day}`).value = row.ffb2 || '';
                document.getElementById(`s1_ffb3_${day}`).value = row.ffb3 || '';
                document.getElementById(`s1_ffb4_${day}`).value = row.ffb4 || '';
            }
        });
    }

    calcS1();
    syncRainfallToSummary();
}

function onEstateOrMonthChange() {
    updateSummaryHeader();
    syncRainfallToSummary();
    loadFromCloud();
}

function initKeyInTables() {
    // Tab 1
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

    // Tab 2
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

    // Tab 3
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

    // Tab 4 Header & Body
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
        daysHtml += `<td colspan="2" id="days_${idx}">0 Hari</td>`;
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
                if (targetInput) {
                    targetInput.value = val;
                }
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
        if (daysElem) daysElem.innerText = days + ' Hari';
    });
}

function updateSummaryHeader() {
    let val = document.getElementById('bulanTahun').value;
    if (val) {
        let d = new Date(val + "-01");
        let mName = d.toLocaleString('ms', { month: 'short' }).toUpperCase();
        let y = d.getFullYear();
        document.getElementById('sumReportTitle').innerText = `LAPORAN HUJAN BULAN ${mName} ${y}`;
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.getElementById(`btn-${tabId}`).classList.add('active');
}

window.onload = function() {
    initKeyInTables();
    buildSummaryHeader();
    buildSummaryBody();
    updateSummaryHeader();
    loadFromCloud();
};