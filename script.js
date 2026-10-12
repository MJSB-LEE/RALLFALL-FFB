// Supabase Configuration
const SUPABASE_URL = 'https://tiwulxrorrmyxtosvzkw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_W4-5_riBQWAUBPVtgX8Pcw_WCRET_KF';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const IT_DELETE_PASSWORD = "ITREF2026"; // Security key for deletion

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

// Fetch Permanent User Profiles from Supabase Database
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

    userLabel.innerText = `User: ${currentUser.full_name || currentUser.username} (${currentUser.username})`;

    // Standardize assigned estates into an array for multi-location access
    let allowedEstates = currentUser.assigned_estates || [];
    if (!Array.isArray(allowedEstates) && currentUser.assigned_estate) {
        allowedEstates = [currentUser.assigned_estate];
    }

    renderEstateDropdown(allowedEstates);

    if (currentUser.role === "admin") {
        badge.innerText = "ROLE: ADMIN";
        badge.style.background = "#ef4444";
        ladangSelect.disabled = false;
        settingsBtn.style.display = "inline-block";
    } else {
        badge.innerText = `ROLE: USER (${allowedEstates.length} Location${allowedEstates.length > 1 ? 's' : ''})`;
        badge.style.background = "#3b82f6";
        
        // Unlock dropdown ONLY if user has 2 or more assigned locations
        ladangSelect.disabled = allowedEstates.length <= 1; 
        settingsBtn.style.display = "none";
        
        if (document.getElementById('tabSettings').classList.contains('active')) {
            switchTab('tab1');
        }
    }

    onEstateOrMonthChange();
}

async function saveToCloud() {
    // Determine current active tab
    const activeTab = document.querySelector('.tab-content.active')?.id;
    
    // Tab Restriction: Prevent saving when viewing Overall Summary or Settings
    if (activeTab === 'tabSummary' || activeTab === 'tabSettings') {
        alert("⚠️ Save operation is only available on Input Tabs (Tabs 1 to 4).");
        return;
    }

    const estate = document.getElementById('ladangSelect').value;
    const monthYear = document.getElementById('bulanTahun').value;
    
    if (!monthYear) {
        alert("Please select a Month and Year.");
        return;
    }

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

    // Save records to main database table
    const { error } = await supabaseClient
        .from('daily_records')
        .upsert(updates, { onConflict: 'estate_name,record_date' });

    if (error) {
        alert("Error saving data: " + error.message);
    } else {
        // Record Activity Trail Entry
        await supabaseClient.from('activity_logs').insert([{
            user_name: activeUserName,
            estate_name: estate,
            record_date: monthYear,
            action_type: `Saved Data via ${activeTab.toUpperCase()}`
        }]);

        alert(`Data for "${estate}" saved successfully by ${activeUserName}!`);
        loadFromCloud();
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

    if (data.length > 0) {
        let lastRecord = data[data.length - 1];
        let editBy = lastRecord.updated_by || 'Unknown';
        let editTime = lastRecord.updated_at ? new Date(lastRecord.updated_at).toLocaleString() : 'N/A';
        document.getElementById('auditLogDisplay').innerText = `Last Modified By: ${editBy} on ${editTime}`;
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
    if (pass === IT_DELETE_PASSWORD) {
        return true;
    } else {
        alert("❌ Invalid IT Authorization Password! Deletion cancelled.");
        return false;
    }
}

function renderEstateDropdown(allowedEstatesFilter = null) {
    const estateSelect = document.getElementById('ladangSelect');
    const newUserEstateSelect = document.getElementById('newUserEstate');

    estateSelect.innerHTML = '';
    if (newUserEstateSelect) newUserEstateSelect.innerHTML = '';

    estateList.forEach(est => {
        // Show estate if admin OR if it exists in the user's allowedEstates array
        if (!allowedEstatesFilter || (currentUser && currentUser.role === "admin") || allowedEstatesFilter.includes(est)) {
            let opt1 = document.createElement('option');
            opt1.value = est;
            opt1.innerText = est;
            estateSelect.appendChild(opt1);
        }

        if (newUserEstateSelect) {
            let opt2 = document.createElement('option');
            opt2.value = est;
            opt2.innerText = est;
            newUserEstateSelect.appendChild(opt2);
        }
    });
}

function toggleUserEstateDropdown() {
    const role = document.getElementById('newUserRole').value;
    const estateSelect = document.getElementById('newUserEstate');
    estateSelect.style.display = role === "admin" ? "none" : "block";
}

function toggleEditEstateDropdown() {
    const role = document.getElementById('editRole').value;
    const estateSelect = document.getElementById('editEstate');
    estateSelect.style.display = role === "admin" ? "none" : "block";
}

function renderSettingsUI() {
    const userListUi = document.getElementById('userSettingsList');
    if (userListUi) {
        userListUi.innerHTML = '';
        userAccounts.forEach((usr, idx) => {
            let userAssigned = usr.assigned_estates || (usr.assigned_estate ? [usr.assigned_estate] : []);
            userListUi.innerHTML += `<li style="padding: 6px; background: white; margin-bottom: 4px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <b>${usr.full_name || usr.username}</b> (${usr.username})<br>
                    <small style="color: #64748b;">${usr.email || 'No email'} | ${usr.role.toUpperCase()} ${userAssigned.length > 0 ? '➔ ' + userAssigned.join(', ') : ''}</small>
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
            estListUi.innerHTML += `<li style="padding: 6px; background: white; margin-bottom: 4px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span>${est}</span>
                <div>
                    <button class="btn-edit" onclick="editEstateName(${idx})">Edit</button>
                    <button class="btn-delete" onclick="removeEstate(${idx})">Delete</button>
                </div>
            </li>`;
        });
    }
}

function openEditUserModal(idx) {
    const user = userAccounts[idx];
    document.getElementById('editIndex').value = idx;
    document.getElementById('editFull').value = user.full_name || '';
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editPass').value = '';
    document.getElementById('editRole').value = user.role || 'user';

    let userAssigned = user.assigned_estates || (user.assigned_estate ? [user.assigned_estate] : []);

    const editEstateSelect = document.getElementById('editEstate');
    editEstateSelect.innerHTML = '';
    estateList.forEach(est => {
        let opt = document.createElement('option');
        opt.value = est;
        opt.innerText = est;
        if (userAssigned.includes(est)) opt.selected = true;
        editEstateSelect.appendChild(opt);
    });

    toggleEditEstateDropdown();
    document.getElementById('editUserModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editUserModal').style.display = 'none';
}

async function saveUserEdit() {
    const idx = document.getElementById('editIndex').value;
    let targetUser = userAccounts[idx];

    const newFull = document.getElementById('editFull').value.trim();
    const newEmail = document.getElementById('editEmail').value.trim();
    const newPass = document.getElementById('editPass').value.trim();
    const newRole = document.getElementById('editRole').value;
    
    const editEstateSelect = document.getElementById('editEstate');
    const newEstates = newRole === "admin" ? [] : Array.from(editEstateSelect.selectedOptions).map(opt => opt.value);

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

    alert("User profile updated successfully!");
    closeEditModal();
    renderSettingsUI();
}

// Database-connected Permanent Estate Functions
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

async function addNewUser() {
    const uFull = document.getElementById('newUserFull').value.trim();
    const uEmail = document.getElementById('newUserEmail').value.trim();
    const uName = document.getElementById('newUsername').value.trim();
    const uPass = document.getElementById('newUserPass').value.trim();
    const uRole = document.getElementById('newUserRole').value;
    
    // Read multiple selected options from UI
    const estateSelect = document.getElementById('newUserEstate');
    const uEstates = uRole === "admin" ? [] : Array.from(estateSelect.selectedOptions).map(opt => opt.value);

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
        alert(`User "${uName}" created successfully with ${uEstates.length} assigned estate(s)!`);
        document.getElementById('newUserFull').value = '';
        document.getElementById('newUserEmail').value = '';
        document.getElementById('newUsername').value = '';
        document.getElementById('newUserPass').value = '';
        fetchUserProfiles();
    }
}

async function removeUser(idx) {
    let targetUser = userAccounts[idx];
    if (!confirmITAction(`User Account: "${targetUser.username}"`)) return;

    if (targetUser.id) {
        await supabaseClient.from('user_profiles').delete().eq('id', targetUser.id);
    }
    
    userAccounts.splice(idx, 1);
    renderSettingsUI();
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
                <td><input type="number" step="any" id="s2_p${p}_t_${d}" oninput="calcS2();"></td>
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

    // Hide Save Button when viewing Summary or Settings
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        if (tabId === 'tabSummary' || tabId === 'tabSettings') {
            saveBtn.style.display = 'none';
        } else {
            saveBtn.style.display = 'inline-block';
        }
    }
}

window.onload = function() {
    initKeyInTables();
    fetchEstates();
    fetchUserProfiles();
    applyUserPermissions();
};
