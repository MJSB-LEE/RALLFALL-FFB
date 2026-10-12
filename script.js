// Supabase Configuration
const SUPABASE_URL = 'https://tiwulxrorrmyxtosvzkw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_W4-5_riBQWAUBPVtgX8Pcw_WCRET_KF';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const IT_DELETE_PASSWORD = "ITREF2026"; 

let estateList = ["STY", "Klagan PH1", "Kars PH1/2/4", "Kars PH3", "Sg Millian 1", "Sg Millian 2", "Sg Millian 3", "Labuk"];
let userAccounts = [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// Fetch Permanent Estates from Supabase Database
async function fetchEstates() {
    const { data, error } = await supabaseClient.from('estates').select('name').order('id', { ascending: true });
    if (!error && data && data.length > 0) {
        estateList = data.map(e => e.name);
    } else {
        estateList = ["STY", "Klagan PH1", "Kars PH1/2/4", "Kars PH3", "Sg Millian 1", "Sg Millian 2", "Sg Millian 3", "Labuk"];
    }
    renderEstateDropdown();
    renderSettingsUI();
    loadOverallSummary();
}

// Fetch User Profiles
async function fetchUserProfiles() {
    const { data, error } = await supabaseClient.from('user_profiles').select('*');
    if (!error && data && data.length > 0) {
        userAccounts = data;
    } else {
        userAccounts = [
            { username: "admin", password: "admin123", full_name: "System Admin", email: "admin@masihjaya.com", role: "admin", assigned_estates: [] },
            { username: "sty_user", password: "user123", full_name: "STY Officer", email: "sty@masihjaya.com", role: "user", assigned_estates: ["STY"] }
        ];
    }
    renderSettingsUI();
}

// Fetch QNE Activity & Audit Logs
async function fetchActivityLogs() {
    const tableBody = document.getElementById('activityLogTableBody');
    if (!tableBody) return;

    const { data, error } = await supabaseClient
        .from('activity_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(30);

    if (error || !data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No activity logs recorded yet.</td></tr>`;
        return;
    }

    let rowsHtml = '';
    data.forEach(log => {
        let timeStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
        rowsHtml += `<tr>
            <td style="color: #64748b; font-size: 11px;">${timeStr}</td>
            <td><b>${log.username || log.user_name || 'SYSTEM'}</b></td>
            <td><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${log.action || log.action_type || 'INFO'}</span></td>
            <td>${log.estate || log.estate_name || '-'}</td>
            <td style="color: #334155;">${log.details || '-'}</td>
        </tr>`;
    });
    tableBody.innerHTML = rowsHtml;
}

async function handleLogin() {
    const userIn = document.getElementById('loginUsername').value.trim();
    const passIn = document.getElementById('loginPassword').value.trim();
    const errorElem = document.getElementById('loginError');

    await fetchUserProfiles();

    const matchedUser = userAccounts.find(u => u.username === userIn && u.password === passIn);

    if (matchedUser) {
        currentUser = matchedUser;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        errorElem.style.display = "none";
        document.getElementById('loginOverlay').style.display = "none";
        
        // Log Login Action
        await supabaseClient.from('activity_logs').insert([{
            username: currentUser.username,
            action: 'LOGIN',
            details: `User logged into system`,
            estate: 'SYSTEM',
            timestamp: new Date().toISOString()
        }]);

        applyUserPermissions();
    } else {
        errorElem.innerText = "Invalid Username or Password!";
        errorElem.style.display = "block";
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('loginOverlay').style.display = "flex";
    document.getElementById('loginUsername').value = "";
    document.getElementById('loginPassword').value = "";
}

function applyUserPermissions() {
    if (!currentUser) {
        document.getElementById('loginOverlay').style.display = "flex";
        return;
    }

    document.getElementById('loginOverlay').style.display = "none";
    
    const badge = document.getElementById('userBadge');
    const userLabel = document.getElementById('userInfoLabel');
    const ladangSelect = document.getElementById('ladangSelect');
    const settingsBtn = document.getElementById('btn-tabSettings');

    userLabel.innerText = `User: ${currentUser.full_name \vert{}\vert{} currentUser.username} (${currentUser.username})`;

    let allowedEstates = currentUser.assigned_estates || [];
    if (!Array.isArray(allowedEstates) && currentUser.assigned_estate) {
        allowedEstates = [currentUser.assigned_estate];
    }

    renderEstateDropdown(allowedEstates);

    if (currentUser.role === "admin") {
        badge.innerText = "ROLE: ADMIN";
        badge.style.background = "#dc2626";
        ladangSelect.disabled = false;
        settingsBtn.style.display = "inline-block";
    } else {
        badge.innerText = `ROLE: USER (${allowedEstates.length} Location${allowedEstates.length > 1 ? 's' : ''})`;
        badge.style.background = "#2563eb";
        ladangSelect.disabled = allowedEstates.length <= 1; 
        settingsBtn.style.display = "none";
        
        if (document.getElementById('tabSettings').classList.contains('active')) {
            switchTab('tab1');
        }
    }

    onEstateOrMonthChange();
}

async function saveToCloud() {
    const activeTab = document.querySelector('.tab-content.active')?.id;
    
    if (activeTab === 'tabSummary' || activeTab === 'tabSettings') {
        alert("⚠️ Save operation is only available on Input Tabs (Tabs 1 to 4).");
        return;
    }

    const estate = document.getElementById('ladangSelect').value;
    const monthYear = document.getElementById('bulanTahun').value;
    
    if (!monthYear) return alert("Please select a Month and Year.");

    const [year, month] = monthYear.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const timestampNow = new Date().toISOString();
    const activeUserName = currentUser ? (currentUser.full_name || currentUser.username) : "Unknown User";

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
            updated_by: activeUserName,
            updated_at: timestampNow,
            ...ffb_phases
        });
    }

    const { error } = await supabaseClient
        .from('daily_records')
        .upsert(updates, { onConflict: 'estate_name,record_date' });

    if (error) {
        alert("Error saving data: " + error.message);
    } else {
        await supabaseClient.from('activity_logs').insert([{
            username: currentUser ? currentUser.username : 'ADMIN',
            action: 'SAVE_DATA',
            details: `Saved Data via ${activeTab.toUpperCase()} for${monthYear}`,
            estate: estate,
            timestamp: new Date().toISOString()
        }]);

        alert(`Data for "${estate}" saved successfully by ${activeUserName}!`);
        loadFromCloud();
        loadOverallSummary();
        fetchActivityLogs();
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

    if (data.length > 0) {
        let lastRecord = data[data.length - 1];
        let editBy = lastRecord.updated_by || 'Unknown';
        let editTime = lastRecord.updated_at ? new Date(lastRecord.updated_at).toLocaleString() : 'N/A';
        document.getElementById('auditLogDisplay').innerText = `Last Modified By: ${editBy} on${editTime}`;
    } else {
        document.getElementById('auditLogDisplay').innerText = `Data Record Info: No records for ${monthYear}`;
    }

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

function confirmITAction(actionName) {
    let confirmWarning = confirm(`⚠️ WARNING: Are you sure you want to delete ${actionName}? This action cannot be undone!`);
    if (!confirmWarning) return false;

    let pass = prompt(`IT SECURITY KEY REQUIRED:\nEnter IT Authorization Password to confirm deletion of ${actionName}:`);
    return pass === IT_DELETE_PASSWORD;
}

function renderEstateDropdown(allowedEstatesFilter = null) {
    const estateSelect = document.getElementById('ladangSelect');
    if (!estateSelect) return;
    estateSelect.innerHTML = '';

    estateList.forEach(est => {
        if (!allowedEstatesFilter || (currentUser && currentUser.role === "admin") || allowedEstatesFilter.includes(est)) {
            let opt1 = document.createElement('option');
            opt1.value = est;
            opt1.innerText = est;
            estateSelect.appendChild(opt1);
        }
    });
}

function toggleUserEstateDropdown() {
    const role = document.getElementById('newUserRole').value;
    const container = document.getElementById('newUserEstateCheckboxes');
    if (container) container.style.display = role === "admin" ? "none" : "block";
}

function toggleEditEstateDropdown() {
    const role = document.getElementById('editRole').value;
    const container = document.getElementById('editEstateCheckboxes');
    if (container) container.style.display = role === "admin" ? "none" : "block";
}

function renderNewUserEstateCheckboxes() {
    const container = document.getElementById('newUserEstateCheckboxes');
    if (!container) return;
    container.innerHTML = '';
    
    estateList.forEach(est => {
        container.innerHTML += `
            <label class="checkbox-item">
                <input type="checkbox" value="${est}" class="new-estate-chk">
                <span>${est}</span>
            </label>`;
    });
}

function renderSettingsUI() {
    const userListUi = document.getElementById('userSettingsList');
    if (userListUi) {
        userListUi.innerHTML = '';
        userAccounts.forEach((usr, idx) => {
            let userAssigned = usr.assigned_estates || (usr.assigned_estate ? [usr.assigned_estate] : []);
            userListUi.innerHTML += `<li style="padding: 6px; background: #f8fafc; margin-bottom: 4px; border-radius: 4px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <b>${usr.full_name \vert{}\vert{} usr.username}</b> (${usr.username})<br>
                    <small style="color: #64748b;">${usr.email || 'No email'} | ${usr.role.toUpperCase()}${userAssigned.length > 0 ? '➔ ' + userAssigned.join(', ') : ''}</small>
                </div>
                <div>
                    <button class="btn-edit" onclick="openEditUserModal(${idx})">Edit</button>
                    <button class="btn-delete" onclick="removeUser(${idx})">Delete</button>
                </div>
            </li>`;
        });
    }

    const estListUi = document.getElementById('estateSettingsList');
    if (estListUi) {
        estListUi.innerHTML = '';
        estateList.forEach((est, idx) => {
            estListUi.innerHTML += `<li style="padding: 6px; background: #f8fafc; margin-bottom: 4px; border-radius: 4px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <span>${est}</span>
                <div>
                    <button class="btn-edit" onclick="editEstateName(${idx})">Edit</button>
                    <button class="btn-delete" onclick="removeEstate(${idx})">Delete</button>
                </div>
            </li>`;
        });
    }

    renderNewUserEstateCheckboxes();
}

// FIX: OPEN EDIT USER MODAL WORKING CLEANLY
function openEditUserModal(idx) {
    const user = userAccounts[idx];
    document.getElementById('editIndex').value = idx;
    document.getElementById('editFull').value = user.full_name || '';
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editPass').value = '';
    document.getElementById('editRole').value = user.role || 'user';

    let userAssigned = user.assigned_estates || (user.assigned_estate ? [user.assigned_estate] : []);

    const editContainer = document.getElementById('editEstateCheckboxes');
    if (editContainer) {
        editContainer.innerHTML = '';
        estateList.forEach(est => {
            let isChecked = userAssigned.includes(est) ? 'checked' : '';
            editContainer.innerHTML += `
                <label class="checkbox-item">
                    <input type="checkbox" value
