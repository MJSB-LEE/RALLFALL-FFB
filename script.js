// Supabase Configuration
const SUPABASE_URL = 'https://tiwulxrorrmyxtosvzkw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_W4-5_riBQWAUBPVtgX8Pcw_WCRET_KF';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// System Configuration & Default Role Setup
const ADMIN_PASSWORD = "admin123"; // Admin password
let isAdminMode = false;

let estateList = ["STY", "Klagan PH1", "Kars PH1/2/4", "Kars PH3", "Sg Millian 1", "Sg Millian 2", "Sg Millian 3", "Labuk"];

let userProfiles = [
    { name: "STY Manager", estate: "STY" },
    { name: "Klagan Officer", estate: "Klagan PH1" },
    { name: "Kars Supervisor", estate: "Kars PH1/2/4" },
    { name: "Labuk Officer", estate: "Labuk" }
];

function toggleAdminLogin() {
    if (isAdminMode) {
        isAdminMode = false;
        alert("Logged out of Admin Mode.");
    } else {
        let pass = prompt("Enter Admin Password:");
        if (pass === ADMIN_PASSWORD) {
            isAdminMode = true;
            alert("Admin Access Granted! Full permission unlocked.");
        } else if (pass !== null) {
            alert("Invalid Password!");
        }
    }
    applyUserPermissions();
}

function applyUserPermissions() {
    const badge = document.getElementById('userBadge');
    const ladangSelect = document.getElementById('ladangSelect');
    const settingsBtn = document.getElementById('btn-tabSettings');

    if (isAdminMode) {
        badge.innerText = "ROLE: ADMIN (FULL ACCESS)";
        badge.style.background = "#ef4444"; // Red badge for Admin
        ladangSelect.disabled = false;
        settingsBtn.style.display = "inline-block";
    } else {
        badge.innerText = "ROLE: ESTATE USER (LOCKED)";
        badge.style.background = "#3b82f6"; // Blue badge for User
        ladangSelect.disabled = true; // Lock user to self estate
        settingsBtn.style.display = "none"; // Hide settings tab from standard users
        
        // Return to Tab 1 if sitting on Settings tab when logging out
        if (document.getElementById('tabSettings').classList.contains('active')) {
            switchTab('tab1');
        }
    }

    renderEstateDropdown();
    onEstateOrMonthChange();
}

function onUserProfileChange() {
    if (!isAdminMode) {
        let selectedUserIndex = document.getElementById('userSelect').value;
        let assignedEstate = userProfiles[selectedUserIndex]?.estate || estateList[0];
        document.getElementById('ladangSelect').value = assignedEstate;
        onEstateOrMonthChange();
    }
}

async function saveToCloud() {
    const estate = document.getElementById('ladangSelect').value;
    const monthYear = document.getElementById('bulanTahun').value;
    
    if (!monthYear) {
        alert("Please select a Month and Year.");
        return;
    }

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

    if (error) {
        alert("Error saving data: " + error.message);
    } else {
        alert(`Data for "${estate}" saved successfully!`);
        loadOverallSummary();
    }
}

async function loadFromCloud() {
    clearForm();

    const estate = document.getElementById('ladangSelect').value;
    const monthYear = document.getElementById('bulanTahun').value;

    if (!monthYear || !estate) return;

    const [year, month] = monthYear.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const lastDayStr = String(lastDay).padStart(2, '0');

    const { data, error } = await supabaseClient
        .from('daily_records')
        .select('*')
        .eq('estate_name', estate)
        .gte('record_date', `${monthYear}-01`)
        .lte('record_date', `${monthYear}-${lastDayStr}`);

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
}

async function loadOverallSummary() {
    const monthYear = document.getElementById('bulanTahun').value;
    if (!monthYear) return;

    const [year, month] = monthYear.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const lastDayStr = String(lastDay).padStart(2, '0');

    const { data, error } = await supabaseClient
        .from('daily_records')
        .select('estate_name, record_date, rainfall_today')
        .gte('record_date', `${monthYear}-01`)
        .lte('record_date', `${monthYear}-${lastDayStr}`);

    if (error) return;

    let matrix = {};
    estateList.forEach(est => { matrix[est] = {}; });

    if (data) {
        data.forEach(r => {
            let day = parseInt(r.record_date.split('-')[2], 10);
            if (matrix[r.estate_name]) {
                matrix[r.estate_name][day] = r.rainfall_today || 0;
            }
        });
    }

    let estateHdr = '<th>Date</th>';
    let subHdr = '<th>Date</th>';
    estateList.forEach(est => {
        estateHdr += `<th colspan="2" class="header-estate">${est}</th>`;
        subHdr += `<th>To Day</th><th>To Date</th>`;
    });
    estateHdr += '<th>Date</th>';
    subHdr += '<th>Date</th>';

    document.getElementById('hdr-estates').innerHTML = estateHdr;
    document.getElementById('hdr-sub').innerHTML = subHdr;

    let tbody = '';
    let estateTotals = {};
    let estateDays = {};
    estateList.forEach(est => { estateTotals[est] = 0; estateDays[est] = 0; });

    for (let d = 1; d <= lastDay; d++) {
        tbody += `<tr><td><b>${d}</b></td>`;
        estateList.forEach(est => {
            let val = matrix[est][d] || 0;
            estateTotals[est] += val;
            if (val > 0) estateDays[est]++;

            let toDayStr = val > 0 ? val.toFixed(1) : '';
            let toDateStr = estateTotals[est] > 0 ? estateTotals[est].toFixed(1) : '';

            tbody += `<td>${toDayStr}</td><td class="readonly-cell">${toDateStr}</td>`;
        });
        tbody += `<td><b>${d}</b></td></tr>`;
    }
    document.getElementById('tbody-summary').innerHTML = tbody;

    let totHtml = '<td>Total</td>';
    let daysHtml = '<td>Days</td>';
    estateList.forEach(est => {
        totHtml += `<td>${estateTotals[est].toFixed(1)}</td><td class="readonly-cell">${estateTotals[est].toFixed(1)}</td>`;
        daysHtml += `<td colspan="2">${estateDays[est]} Days</td>`;
    });
    totHtml += '<td>-</td>';
    daysHtml += '<td>-</td>';

    document.getElementById('row-totals').innerHTML = totHtml;
    document.getElementById('row-days').innerHTML = daysHtml;
}

function clearForm() {
    for (let d = 1; d <= 31; d++) {
        if (document.getElementById(`s1_rf_${d}`)) document.getElementById(`s1_rf_${d}`).value = '';
        if (document.getElementById(`s1_ffb1_${d}`)) document.getElementById(`s1_ffb1_${d}`).value = '';
        if (document.getElementById(`s1_ffb2_${d}`)) document.getElementById(`s1_ffb2_${d}`).value = '';
        if (document.getElementById(`s1_ffb3_${d}`)) document.getElementById(`s1_ffb3_${d}`).value = '';
        if (document.getElementById(`s1_ffb4_${d}`)) document.getElementById(`s1_ffb4_${d}`).value = '';

        if (document.getElementById(`s2_p1_t_${d}`)) document.getElementById(`s2_p1_t_${d}`).value = '';
        if (document.getElementById(`s2_p2_t_${d}`)) document.getElementById(`s2_p2_t_${d}`).value = '';
        if (document.getElementById(`s2_p3_t_${d}`)) document.getElementById(`s2_p3_t_${d}`).value = '';
        if (document.getElementById(`s2_p4_t_${d}`)) document.getElementById(`s2_p4_t_${d}`).value = '';

        if (document.getElementById(`s3_m1_${d}`)) document.getElementById(`s3_m1_${d}`).value = '';
        if (document.getElementById(`s3_m2_${d}`)) document.getElementById(`s3_m2_${d}`).value = '';
        if (document.getElementById(`s3_m3_${d}`)) document.getElementById(`s3_m3_${d}`).value = '';
        if (document.getElementById(`s3_m4_${d}`)) document.getElementById(`s3_m4_${d}`).value = '';
        if (document.getElementById(`s3_m5_${d}`)) document.getElementById(`s3_m5_${d}`).value = '';
        if (document.getElementById(`s3_m6_${d}`)) document.getElementById(`s3_m6_${d}`).value = '';

        for (let p = 1; p <= 12; p++) {
            if (document.getElementById(`s4_p${p}_${d}`)) document.getElementById(`s4_p${p}_${d}`).value = '';
        }
    }
}

function renderEstateDropdown() {
    const estateSelect = document.getElementById('ladangSelect');
    const newUserEstateSelect = document.getElementById('newUserEstate');

    estateSelect.innerHTML = '';
    if (newUserEstateSelect) newUserEstateSelect.innerHTML = '';

    estateList.forEach(est => {
        let opt1 = document.createElement('option');
        opt1.value = est;
        opt1.innerText = est;
        estateSelect.appendChild(opt1);

        if (newUserEstateSelect) {
            let opt2 = document.createElement('option');
            opt2.value = est;
            opt2.innerText = est;
            newUserEstateSelect.appendChild(opt2);
        }
    });

    renderUserDropdown();
}

function renderUserDropdown() {
    const userSelect = document.getElementById('userSelect');
    userSelect.innerHTML = '';

    userProfiles.forEach((usr, idx) => {
        let opt = document.createElement('option');
        opt.value = idx;
        opt.innerText = `${usr.name} (${usr.estate})`;
        userSelect.appendChild(opt);
    });

    onUserProfileChange();
}

function renderSettingsUI() {
    const userListUi = document.getElementById('userSettingsList');
    if (userListUi) {
        userListUi.innerHTML = '';
        userProfiles.forEach((usr, idx) => {
            userListUi.innerHTML += `<li style="padding: 6px; background: white; margin-bottom: 4px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span><b>${usr.name}</b> ➔ ${usr.estate}</span>
                <button onclick="removeUser(${idx})" style="background:#ef4444; color:white; border:none; padding: 2px 6px; border-radius:3px; cursor:pointer;">Delete</button>
            </li>`;
        });
    }

    const estListUi = document.getElementById('estateSettingsList');
    if (estListUi) {
        estListUi.innerHTML = '';
        estateList.forEach((est, idx) => {
            estListUi.innerHTML += `<li style="padding: 6px; background: white; margin-bottom: 4px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span>${est}</span>
                <button onclick="removeEstate(${idx})" style="background:#ef4444; color:white; border:none; padding: 2px 6px; border-radius:3px; cursor:pointer;">Delete</button>
            </li>`;
        });
    }
}

function addNewUser() {
    const nameInput = document.getElementById('newUserName');
    const estateSelect = document.getElementById('newUserEstate');

    if (!nameInput.value.trim()) return alert("Enter user name");

    userProfiles.push({ name: nameInput.value.trim(), estate: estateSelect.value });
    nameInput.value = '';

    renderUserDropdown();
    renderSettingsUI();
}

function removeUser(idx) {
    userProfiles.splice(idx, 1);
    renderUserDropdown();
    renderSettingsUI();
}

function addNewEstate() {
    const nameInput = document.getElementById('newEstateName');
    if (!nameInput.value.trim()) return alert("Enter estate name");

    estateList.push(nameInput.value.trim());
    nameInput.value = '';

    renderEstateDropdown();
    renderSettingsUI();
    loadOverallSummary();
}

function removeEstate(idx) {
    estateList.splice(idx, 1);
    renderEstateDropdown();
    renderSettingsUI();
    loadOverallSummary();
}

function onEstateOrMonthChange() {
    updateSummaryHeader();
    loadFromCloud();
    loadOverallSummary();
}

function initKeyInTables() {
    let s1 = '';
    for (let d = 1; d
