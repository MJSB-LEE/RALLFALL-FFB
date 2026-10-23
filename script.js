// Supabase Configuration
const SUPABASE_URL = 'https://tiwulxrorrmyxtosvzkw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_W4-5_riBQWAUBPVtgX8Pcw_WCRET_KF';

let supabaseClient;
try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    console.error("Failed to initialize Supabase client:", e);
}

const IT_DELETE_PASSWORD = "ITREF2026"; 

let estateList = ["STY", "Klagan PH1", "Kars PH1/2/4", "Kars PH3", "Sg Millian 1", "Sg Millian 2", "Sg Millian 3", "Labuk"];
let userAccounts = [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// Fetch Permanent Estates from Supabase
async function fetchEstates() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('estates').select('name').order('id', { ascending: true });
    if (!error && data && data.length > 0) {
        estateList = data.map(e => e.name);
    } else {
        estateList = ["STY", "Klagan PH1", "Kars PH1/2/4", "Kars PH3", "Sg Millian 1", "Sg Millian 2", "Sg Millian 3", "Labuk"];
    }
    
    renderEstateDropdown();
    renderNewUserEstateCheckboxes();
    renderSettingsUI();
    loadOverallSummary();
}

// Fetch User Profiles from Supabase
async function fetchUserProfiles() {
    if (!supabaseClient) return;
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

// Fetch Activity & Audit Logs
async function fetchActivityLogs() {
    const tableBody = document.getElementById('activityLogTableBody');
    if (!tableBody || !supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('activity_logs')
        .select('*')
        .order('id', { ascending: false })
        .limit(30);

    if (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444;">Error loading logs: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No activity logs recorded yet.</td></tr>`;
        return;
    }

    let rowsHtml = '';
    data.forEach(log => {
        let logTime = log.timestamp || log.created_at;
        let timeStr = logTime ? new Date(logTime).toLocaleString() : 'N/A';
        rowsHtml += `<tr>
            <td style="color: #64748b; font-size: 11px;">${timeStr}</td>
            <td><b>${log.username || log.user_name || 'SYSTEM'}</b></td>
            <td><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${log.action || log.action_type || 'INFO'}</span></td>
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
        
        if (supabaseClient) {
            await supabaseClient.from('activity_logs').insert([{
                username: currentUser.username,
                action: 'LOGIN',
                details: `User '${currentUser.username}' logged into system`,
                estate: currentUser.role === 'admin' ? 'ALL ESTATES' : (currentUser.assigned_estates?.[0] || 'SYSTEM'),
                timestamp: new Date().toISOString()
            }]);
        }

        applyUserPermissions();
        renderSettingsUI();
        await fetchActivityLogs();
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
    const approveBtn = document.getElementById('approveBtn');
    const prepInput = document.getElementById('preparedByInput');

    userLabel.innerText = `User: ${currentUser.full_name || currentUser.username} (${currentUser.username})`;
    if (prepInput) {
        prepInput.value = `${currentUser.full_name || currentUser.username} (${currentUser.username})`;
    }

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
        if (approveBtn) approveBtn.style.display = "inline-block";
    } else {
        badge.innerText = `ROLE: USER (${allowedEstates.length} Location${allowedEstates.length > 1 ? 's' : ''})`;
        badge.style.background = "#2563eb";
        ladangSelect.disabled = allowedEstates.length <= 1; 
        settingsBtn.style.display = "none";
        if (approveBtn) approveBtn.style.display = "none";
        
        if (document.getElementById('tabSettings').classList.contains('active')) {
            switchTab('tab1');
        }
    }

    onEstateOrMonthChange();
}

// Function to Lock / Unlock inputs when report is Submitted / Approved
function setFormLockState(isLocked, statusText = '') {
    const inputs = document.querySelectorAll('#tbody-s1 input, #tbody-s2 input');
    inputs.forEach(input => {
        if (!input.classList.contains('readonly-cell')) {
            input.disabled = isLocked;
        }
    });

    const saveBtn = document.getElementById('saveBtn');
    const submitBtn = document.getElementById('submitBtn');

    if (saveBtn && submitBtn) {
        if (isLocked) {
            saveBtn.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.style.background = '#94a3b8';
            submitBtn.innerText = `🔒 Locked (${statusText.toUpperCase()})`;
        } else {
            saveBtn.style.display = 'inline-block';
            saveBtn.disabled = false;
            submitBtn.disabled = false;
            submitBtn.style.background = '#059669';
            submitBtn.innerText = 'Submit & Lock Report';
        }
    }
}

async function saveToCloud() {
    const activeTab = document.querySelector('.tab-content.active')?.id;
    if (activeTab === 'tabSummary' || activeTab === 'tabSettings') {
        alert("⚠️ Save operation is only available on Input Tabs (Tabs 1 & 2).");
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

        let dayStr = String(d).padStart(2, '0');
        updates.push({
            estate_name: estate,
            record_date: `${monthYear}-${dayStr}`,
            rainfall_today: rf,
            ffb1: f1,
            ffb2: f2,
            ffb3: f3,
            ffb4: f4,
            rf_phase1: rf_p1,
            rf_phase2: rf_p2,
            rf_phase3: rf_p3,
            rf_phase4: rf_p4,
            updated_by: activeUserName,
            updated_at: timestampNow,
            status: 'draft',
            prepared_by: document.getElementById('preparedByInput').value
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
            details: `Saved Data via ${activeTab.toUpperCase()} for ${monthYear}`,
            estate: estate,
            timestamp: new Date().toISOString()
        }]);

        alert(`Data for "${estate}" saved successfully!`);
        loadFromCloud();
        loadOverallSummary();
        fetchActivityLogs();
    }
}

async function submitMonthlyReport() {
    const estate = document.getElementById('ladangSelect').value;
    const monthYear = document.getElementById('bulanTahun').value;
    if (!monthYear || !estate) return alert("Select Estate and Month first.");

    if (!confirm(`Are you sure you want to SUBMIT and LOCK records for ${estate} (${monthYear})? You will not be able to edit further.`)) return;

    const prepName = document.getElementById('preparedByInput').value;
    const [year, month] = monthYear.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();

    const { error } = await supabaseClient
        .from('daily_records')
        .update({ status: 'submitted', prepared_by: prepName })
        .eq('estate_name', estate)
        .gte('record_date', `${monthYear}-01`)
        .lte('record_date', `${monthYear}-${String(lastDay).padStart(2, '0')}`);

    if (error) {
        alert("Submission Error: " + error.message);
    } else {
        await supabaseClient.from('activity_logs').insert([{
            username: currentUser.username,
            action: 'SUBMIT_REPORT',
            details: `Submitted monthly report for ${estate} (${monthYear})`,
            estate: estate,
            timestamp: new Date().toISOString()
        }]);

        alert("Report submitted successfully and locked!");
        loadFromCloud();
    }
}

async function approveMonthlyReport() {
    if (currentUser?.role !== "admin") return alert("Only Administrators / Managers can approve reports.");

    const estate = document.getElementById('ladangSelect').value;
    const monthYear = document.getElementById('bulanTahun').value;
    if (!monthYear || !estate) return alert("Select Estate and Month first.");

    const appName = `${currentUser.full_name || currentUser.username} (Manager)`;
    const [year, month] = monthYear.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();

    const { error } = await supabaseClient
        .from('daily_records')
        .update({ status: 'approved', approved_by: appName })
        .eq('estate_name', estate)
        .gte('record_date', `${monthYear}-01`)
        .lte('record_date', `${monthYear}-${String(lastDay).padStart(2, '0')}`);

    if (error) {
        alert("Approval Error: " + error.message);
    } else {
        await supabaseClient.from('activity_logs').insert([{
            username: currentUser.username,
            action: 'APPROVE_REPORT',
            details: `Approved monthly report for ${estate} (${monthYear})`,
            estate: estate,
            timestamp: new Date().toISOString()
        }]);

        alert("Report officially approved!");
        loadFromCloud();
    }
}

async function loadFromCloud() {
    clearForm();

    const estate = document.getElementById('ladangSelect').value;
    const monthYear = document.getElementById('bulanTahun').value;

    if (!monthYear || !estate || !supabaseClient) return;

    const [year, month] = monthYear.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const lastDayStr = String(lastDay).padStart(2, '0');

    // 1. Calculate Previous Month String (e.g., '2026-09' when selecting '2026-10')
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
    }
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();

    // 2. Query Current Month Records
    const { data: currentData } = await supabaseClient
        .from('daily_records')
        .select('*')
        .eq('estate_name', estate)
        .gte('record_date', `${monthYear}-01`)
        .lte('record_date', `${monthYear}-${lastDayStr}`);

    // 3. Query Previous Month Records
    const { data: prevData } = await supabaseClient
        .from('daily_records')
        .select('*')
        .eq('estate_name', estate)
        .gte('record_date', `${prevMonthStr}-01`)
        .lte('record_date', `${prevMonthStr}-${String(prevLastDay).padStart(2, '0')}`);

    // Map previous month records by day (Day 1 to 31)
    let prevDataMap = {};
    if (prevData && prevData.length > 0) {
        prevData.forEach(r => {
            let dayNum = parseInt(r.record_date.split('-')[2], 10);
            prevDataMap[dayNum] = r;
        });
    }

    // Populate Previous Month columns day-by-day according to matching date
    for (let d = 1; d <= 31; d++) {
        let pRow = prevDataMap[d];

        // S1: Previous Month Rainfall & Total FFB for Day d
        const rfPmElem = document.getElementById(`s1_rf_pm_${d}`);
        if (rfPmElem) {
            let rfVal = pRow ? (parseFloat(pRow.rainfall_today) || 0) : 0;
            rfPmElem.value = rfVal > 0 ? rfVal.toFixed(2) : '';
        }

        const ffbPmElem = document.getElementById(`s1_ffb_pm_${d}`);
        if (ffbPmElem) {
            let ffbSum = pRow ? ((parseFloat(pRow.ffb1) || 0) + (parseFloat(pRow.ffb2) || 0) + (parseFloat(pRow.ffb3) || 0) + (parseFloat(pRow.ffb4) || 0)) : 0;
            ffbPmElem.value = ffbSum > 0 ? ffbSum.toFixed(2) : '';
        }

        // S2: Previous Month Phase Rainfall for Day d
        for (let p = 1; p <= 4; p++) {
            const phasePmElem = document.getElementById(`s2_p${p}_pm_${d}`);
            if (phasePmElem) {
                let pVal = pRow ? (parseFloat(pRow[`rf_phase${p}`]) || 0) : 0;
                phasePmElem.value = pVal > 0 ? pVal.toFixed(2) : '';
            }
        }
    }

    // 4. Populate Current Month Data into input fields (if present)
    if (currentData && currentData.length > 0) {
        let lastRecord = currentData[currentData.length - 1];
        let editBy = lastRecord.updated_by || 'Unknown';
        let editTime = lastRecord.updated_at ? new Date(lastRecord.updated_at).toLocaleString() : 'N/A';
        document.getElementById('auditLogDisplay').innerText = `Last Modified By: ${editBy} on ${editTime}`;

        if (lastRecord.prepared_by) {
            document.getElementById('preparedByInput').value = lastRecord.prepared_by;
        }
        if (lastRecord.approved_by) {
            document.getElementById('approvedByInput').value = lastRecord.approved_by;
        } else {
            document.getElementById('approvedByInput').value = "Pending Manager Approval";
        }

        if (lastRecord.status === 'submitted' || lastRecord.status === 'approved') {
            setFormLockState(true, lastRecord.status);
        } else {
            setFormLockState(false);
        }

        currentData.forEach(row => {
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
        });
    } else {
        document.getElementById('auditLogDisplay').innerText = `Data Record Info: No records for ${monthYear}`;
        document.getElementById('approvedByInput').value = "Pending Manager Approval";
        setFormLockState(false);
    }

    calcS1();
    calcS2();
}

async function loadOverallSummary() {
    const monthYear = document.getElementById('bulanTahun').value;
    if (!monthYear || !supabaseClient) return;

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
    const label = container?.previousElementSibling;
    
    if (container) container.style.display = role === "admin" ? "none" : "block";
    if (label && label.tagName === "LABEL") label.style.display = role === "admin" ? "none" : "block";
}

function toggleEditEstateDropdown() {
    const role = document.getElementById('editRole').value;
    const container = document.getElementById('editEstateCheckboxes');
    const label = container?.previousElementSibling;

    if (container) container.style.display = role === "admin" ? "none" : "block";
    if (label && label.tagName === "LABEL") label.style.display = role === "admin" ? "none" : "block";
}

function renderNewUserEstateCheckboxes() {
    const container = document.getElementById('newUserEstateCheckboxes');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!estateList || estateList.length === 0) {
        container.innerHTML = '<span style="color:#94a3b8; font-size:11px;">Loading estates...</span>';
        return;
    }

    estateList.forEach(est => {
        container.innerHTML += `
            <label class="checkbox-item" style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <input type="checkbox" value="${est}" class="new-estate-chk">
                <span style="font-size: 12px; color: #1e293b;">${est}</span>
            </label>`;
    });

    toggleUserEstateDropdown();
}

function renderSettingsUI() {
    const userListUi = document.getElementById('userSettingsList');
    if (userListUi) {
        userListUi.innerHTML = '';
        userAccounts.forEach((usr, idx) => {
            let userAssigned = usr.assigned_estates || (usr.assigned_estate ? [usr.assigned_estate] : []);
            let estateText = usr.role === 'admin' ? '➔ ALL ESTATES' : (userAssigned.length > 0 ? '➔ ' + userAssigned.join(', ') : '');

            userListUi.innerHTML += `<li style="padding: 8px; background: #ffffff; margin-bottom: 6px; border-radius: 4px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <b style="font-size: 13px; color: #0f172a;">${usr.full_name || usr.username}</b> <span style="font-size: 12px; color: #64748b;">(${usr.username})</span><br>
                    <small style="color: #64748b; font-size: 11px;">${usr.email || 'No email'} | <b>${usr.role ? usr.role.toUpperCase() : 'USER'}</b> ${estateText}</small>
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
            estListUi.innerHTML += `<li style="padding: 8px 12px; background: #ffffff; margin-bottom: 6px; border-radius: 4px; border: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;">
                <span style="font-size: 13px; font-weight: 600; color: #334155;">${est}</span>
                <div>
                    <button class="btn-edit" onclick="editEstateName(${idx})">Edit</button>
                    <button class="btn-delete" onclick="removeEstate(${idx})">Delete</button>
                </div>
            </li>`;
        });
    }

    renderNewUserEstateCheckboxes();
}

function openEditUserModal(idx) {
    const user = userAccounts[idx];
    if (!user) return alert("Error: User record not found.");

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
                <label class="checkbox-item" style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                    <input type="checkbox" value="${est}" class="edit-estate-chk" ${isChecked}>
                    <span style="font-size: 12px; color: #1e293b;">${est}</span>
                </label>`;
        });
    }

    toggleEditEstateDropdown();

    const modalElem = document.getElementById('editUserModal');
    if (modalElem) modalElem.style.display = 'flex';
}

function closeEditModal() {
    const modalElem = document.getElementById('editUserModal');
    if (modalElem) modalElem.style.display = 'none';
}

async function addNewUser() {
    const uFull = document.getElementById('newUserFull').value.trim();
    const uEmail = document.getElementById('newUserEmail').value.trim();
    const uName = document.getElementById('newUsername').value.trim();
    const uPass = document.getElementById('newUserPass').value.trim();
    const uRole = document.getElementById('newUserRole').value;
    
    let uEstates = [];
    if (uRole === "admin") {
        uEstates = [...estateList];
    } else {
        const checkedBoxes = document.querySelectorAll('.new-estate-chk:checked');
        uEstates = Array.from(checkedBoxes).map(chk => chk.value);
    }

    if (!uName || !uPass || !uFull) return alert("Fill in Full Name, Username, and Password");

    const newUserObj = { 
        username: uName, 
        password: uPass, 
        full_name: uFull, 
        email: uEmail, 
        role: uRole, 
        assigned_estates: uEstates 
    };

    const { error } = await supabaseClient.from('user_profiles').insert([newUserObj]);

    if (error) {
        alert("Error creating user: " + error.message);
    } else {
        const activeAdmin = currentUser ? currentUser.username : 'ADMIN';
        const estateSummary = uRole === 'admin' ? 'ALL ESTATES' : (uEstates.join(', ') || 'NONE');

        await supabaseClient.from('activity_logs').insert([{
            username: activeAdmin,
            action: 'CREATE_USER',
            details: `Created user '${uName}' (${uRole.toUpperCase()}) with access: ${estateSummary}`,
            estate: 'SYSTEM',
            timestamp: new Date().toISOString()
        }]);

        alert(`User "${uName}" created successfully!`);
        document.getElementById('newUserFull').value = '';
        document.getElementById('newUserEmail').value = '';
        document.getElementById('newUsername').value = '';
        document.getElementById('newUserPass').value = '';
        document.querySelectorAll('.new-estate-chk').forEach(chk => chk.checked = false);

        fetchUserProfiles();
        fetchActivityLogs();
    }
}

async function saveUserEdit() {
    const idx = document.getElementById('editIndex').value;
    let targetUser = userAccounts[idx];

    const newFull = document.getElementById('editFull').value.trim();
    const newEmail = document.getElementById('editEmail').value.trim();
    const newPass = document.getElementById('editPass').value.trim();
    const newRole = document.getElementById('editRole').value;

    let newEstates = [];
    if (newRole === "admin") {
        newEstates = [...estateList];
    } else {
        const checkedBoxes = document.querySelectorAll('.edit-estate-chk:checked');
        newEstates = Array.from(checkedBoxes).map(chk => chk.value);
    }

    targetUser.full_name = newFull;
    targetUser.email = newEmail;
    if (newPass) targetUser.password = newPass;
    targetUser.role = newRole;
    targetUser.assigned_estates = newEstates;

    if (targetUser.id) {
        let updateObj = { full_name: newFull, email: newEmail, role: newRole, assigned_estates: newEstates };
        if (newPass) updateObj.password = newPass;

        const { error } = await supabaseClient.from('user_profiles').update(updateObj).eq('id', targetUser.id);
        if (error) return alert("Error updating database: " + error.message);
    }

    const activeAdmin = currentUser ? currentUser.username : 'ADMIN';
    const estateSummary = newRole === 'admin' ? 'ALL ESTATES' : (newEstates.join(', ') || 'NONE');

    await supabaseClient.from('activity_logs').insert([{
        username: activeAdmin,
        action: 'EDIT_USER',
        details: `Updated user '${targetUser.username}' (${newRole.toUpperCase()}). Access: ${estateSummary}`,
        estate: 'SYSTEM',
        timestamp: new Date().toISOString()
    }]);

    alert("User profile updated successfully!");
    closeEditModal();
    fetchUserProfiles();
    fetchActivityLogs();
}

async function addNewEstate() {
    const nameInput = document.getElementById('newEstateName');
    const newName = nameInput.value.trim();
    if (!newName) return alert("Enter estate name");

    const { error } = await supabaseClient.from('estates').insert([{ name: newName }]);

    if (error) {
        alert("Error adding estate: " + error.message);
    } else {
        alert(`Estate "${newName}" added permanently!`);
        nameInput.value = '';
        await fetchEstates();
    }
}

async function removeEstate(idx) {
    let targetEstate = estateList[idx];
    if (!confirmITAction(`Estate Location: "${targetEstate}"`)) return;

    const { error } = await supabaseClient.from('estates').delete().eq('name', targetEstate);

    if (error) {
        alert("Error deleting estate: " + error.message);
    } else {
        alert(`Estate "${targetEstate}" permanently deleted!`);
        await fetchEstates();
    }
}

async function editEstateName(idx) {
    let oldName = estateList[idx];
    let newName = prompt(`Edit Estate Location Name:`, oldName);

    if (newName && newName.trim() !== "" && newName !== oldName) {
        const trimmedName = newName.trim();
        const { error } = await supabaseClient
            .from('estates')
            .update({ name: trimmedName })
            .eq('name', oldName);

        if (error) {
            alert("Error updating estate: " + error.message);
        } else {
            alert(`Estate renamed to "${trimmedName}" permanently!`);
            await fetchEstates();
        }
    }
}

async function removeUser(idx) {
    let targetUser = userAccounts[idx];
    if (!confirmITAction(`User Account: "${targetUser.username}"`)) return;

    if (targetUser.id) {
        const { error } = await supabaseClient.from('user_profiles').delete().eq('id', targetUser.id);
        if (error) return alert("Error deleting user: " + error.message);
    }

    const activeAdmin = currentUser ? currentUser.username : 'ADMIN';
    await supabaseClient.from('activity_logs').insert([{
        username: activeAdmin,
        action: 'DELETE_USER',
        details: `Deleted user profile '${targetUser.username}' (${targetUser.role ? targetUser.role.toUpperCase() : 'USER'})`,
        estate: 'SYSTEM',
        timestamp: new Date().toISOString()
    }]);

    userAccounts.splice(idx, 1);
    renderSettingsUI();
    fetchActivityLogs();
}

function onEstateOrMonthChange() {
    updateSummaryHeader();
    loadFromCloud();
    loadOverallSummary();
}

function initKeyInTables() {
    let s1 = '';
    for (let d = 1; d <= 31; d++) {
        s1 += `<tr>
            <td><b>${d}</b></td>
            <td><input type="number" step="any" id="s1_rf_${d}" oninput="calcS1();"></td>
            <td class="readonly-cell" id="s1_rf_todate_${d}"></td>
            <td><input type="number" step="any" id="s1_rf_pm_${d}" readonly class="readonly-cell"></td>
            <td><input type="number" step="any" id="s1_ffb1_${d}" oninput="calcS1()"></td>
            <td><input type="number" step="any" id="s1_ffb2_${d}" oninput="calcS1()"></td>
            <td><input type="number" step="any" id="s1_ffb3_${d}" oninput="calcS1()"></td>
            <td><input type="number" step="any" id="s1_ffb4_${d}" oninput="calcS1()"></td>
            <td class="readonly-cell" id="s1_gt_today_${d}"></td>
            <td class="readonly-cell" id="s1_gt_todate_${d}"></td>
            <td><input type="number" step="any" id="s1_ffb_pm_${d}" readonly class="readonly-cell"></td>
        </tr>`;
    }
    document.getElementById('tbody-s1').innerHTML = s1;

    let s2 = '';
    for (let d = 1; d <= 31; d++) {
        s2 += `<tr>
            <td><b>${d}</b></td>
            ${[1,2,3,4].map(p => `
                <td><input type="number" step="any" id="s2_p${p}_t_${d}" oninput="calcS2();"></td>
                <td class="readonly-cell" id="s2_p${p}_td_${d}"></td>
                <td><input type="number" step="any" id="s2_p${p}_pm_${d}" readonly class="readonly-cell"></td>
            `).join('')}
        </tr>`;
    }
    document.getElementById('tbody-s2').innerHTML = s2;
}

function calcS1() {
    let cumRf = 0, cumFfb = 0;
    for (let d = 1; d <= 31; d++) {
        let rfVal = parseFloat(document.getElementById(`s1_rf_${d}`)?.value) || 0;
        cumRf += rfVal;
        if (document.getElementById(`s1_rf_todate_${d}`)) {
            document.getElementById(`s1_rf_todate_${d}`).innerText = cumRf > 0 ? cumRf.toFixed(2) : '';
        }

        let f1 = parseFloat(document.getElementById(`s1_ffb1_${d}`)?.value) || 0;
        let f2 = parseFloat(document.getElementById(`s1_ffb2_${d}`)?.value) || 0;
        let f3 = parseFloat(document.getElementById(`s1_ffb3_${d}`)?.value) || 0;
        let f4 = parseFloat(document.getElementById(`s1_ffb4_${d}`)?.value) || 0;
        let sumToday = f1 + f2 + f3 + f4;
        cumFfb += sumToday;

        if (document.getElementById(`s1_gt_today_${d}`)) {
            document.getElementById(`s1_gt_today_${d}`).innerText = sumToday > 0 ? sumToday.toFixed(2) : '';
        }
        if (document.getElementById(`s1_gt_todate_${d}`)) {
            document.getElementById(`s1_gt_todate_${d}`).innerText = cumFfb > 0 ? cumFfb.toFixed(2) : '';
        }
    }
}

function calcS2() {
    for (let p = 1; p <= 4; p++) {
        let cum = 0;
        for (let d = 1; d <= 31; d++) {
            let val = parseFloat(document.getElementById(`s2_p${p}_t_${d}`)?.value) || 0;
            cum += val;
            if (document.getElementById(`s2_p${p}_td_${d}`)) {
                document.getElementById(`s2_p${p}_td_${d}`).innerText = cum > 0 ? cum.toFixed(2) : '';
            }
        }
    }
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

    const saveBtn = document.getElementById('saveBtn');
    const submitBtn = document.getElementById('submitBtn');

    if (saveBtn && submitBtn) {
        if (tabId === 'tabSummary' || tabId === 'tabSettings') {
            saveBtn.style.display = 'none';
            submitBtn.style.display = 'none';
        } else {
            saveBtn.style.display = 'inline-block';
            submitBtn.style.display = 'inline-block';
        }
    }

    if (tabId === 'tabSettings') {
        fetchActivityLogs();
    }
}

// Initialization on window load
window.onload = async function() {
    initKeyInTables();
    await fetchEstates();        
    await fetchUserProfiles();   
    applyUserPermissions();
    fetchActivityLogs();
};
