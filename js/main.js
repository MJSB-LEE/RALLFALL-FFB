function startMalaysiaClock() {
    function updateClock() {
        const clockElem = document.getElementById('realTimeClock');
        if (!clockElem) return;
        const now = new Date();
        const options = { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
        clockElem.innerText = `MYT: ${new Intl.DateTimeFormat('en-MY', options).format(now)}`;
    }
    updateClock();
    setInterval(updateClock, 1000);
}

function setDefaultMonthYear() {
    const monthYearInput = document.getElementById('bulanTahun');
    if (monthYearInput && !monthYearInput.value) {
        const now = new Date();
        const mytDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(now);
        monthYearInput.value = mytDateStr.substring(0, 7);
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId)?.classList.add('active');
    document.getElementById(`btn-${tabId}`)?.classList.add('active');

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.style.display = (tabId === 'tabSummary' || tabId === 'tabMillSummary' || tabId === 'tabSettings') ? 'none' : 'inline-block';

    if (tabId === 'tab3') buildTab3MillGrid();
    if (tabId === 'tabMillSummary') loadMillSummaryBreakdown();
    if (tabId === 'tabSettings') { fetchActivityLogs(); renderMillSettingsUI(); }
}

async function handleLogin() {
    const userIn = document.getElementById('loginUsername')?.value.trim();
    const passIn = document.getElementById('loginPassword')?.value.trim();
    const errorElem = document.getElementById('loginError');

    let fallbackAccounts = [
        { username: "admin", password: "admin123", full_name: "System Admin", role: "admin" },
        { username: "manager", password: "manager123", full_name: "Estate Manager", role: "manager" },
        { username: "user", password: "user123", full_name: "Estate User", role: "user" }
    ];

    let accountsToSearch = (typeof userAccounts !== 'undefined' && userAccounts.length > 0) 
        ? userAccounts 
        : fallbackAccounts;

    const matched = accountsToSearch.find(u => u.username === userIn && u.password === passIn);

    if (matched) {
        currentUser = matched;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        if (errorElem) errorElem.style.display = "none";
        
        const overlay = document.getElementById('loginOverlay');
        if (overlay) overlay.style.display = "none";

        if (document.getElementById('lblLastKeyinUser')) {
            document.getElementById('lblLastKeyinUser').innerText = currentUser.full_name || currentUser.username;
        }

        if (typeof logActivity === 'function') {
            await logActivity('LOGIN', `Logged in as ${(currentUser.role || 'USER').toUpperCase()}`);
        }
        
        if (typeof applyUserPermissions === 'function') {
            applyUserPermissions();
        }
    } else {
        if (errorElem) {
            errorElem.style.display = "block";
            errorElem.innerText = "Invalid Username or Password!";
        } else {
            alert("Invalid Username or Password!");
        }
    }
}

function handleLogout() {
    if (currentUser && typeof logActivity === 'function') logActivity('LOGOUT', `Logged out`);
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById('loginOverlay').style.display = "flex";
}

function applyUserPermissions() {
    if (!currentUser) { document.getElementById('loginOverlay').style.display = "flex"; return; }
    document.getElementById('loginOverlay').style.display = "none";
    document.getElementById('userBadge').innerText = `ROLE: ${(currentUser.role || 'USER').toUpperCase()}`;
    document.getElementById('userInfoLabel').innerText = `User: ${currentUser.full_name || currentUser.username}`;
    renderEstateDropdown(currentUser.assigned_estates || []);
    setDefaultMonthYear();
    onEstateOrMonthChange();
}

async function saveToCloud() {
    const activeTabId = document.querySelector('.tab-content.active')?.id || '';
    if (activeTabId === 'tab3') {
        await saveTab3ToCloud();
        await logActivity('SAVE_DATA', `Saved Tab 3 FFB by Mill`, document.getElementById('ladangSelect')?.value);
        alert(`✅ Daily Mill FFB Data saved!`);
        await loadFromCloud();
        return;
    }

    const estate = document.getElementById('ladangSelect')?.value;
    const monthYear = document.getElementById('bulanTahun')?.value;
    if (!monthYear || !estate) return alert("Select Estate & Month.");

    const [year, month] = monthYear.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    let updates = [];
    for (let d = 1; d <= daysInMonth; d++) {
        let fullDate = `${monthYear}-${String(d).padStart(2, '0')}`;
        let updateData = { estate_name: estate, record_date: fullDate, updated_by: currentUser?.username || 'SYSTEM' };
        if (activeTabId === 'tab1') {
            updateData.rainfall_today = parseFloat(document.getElementById(`s1_rf_${d}`)?.value) || 0;
            updateData.ffb1 = parseFloat(document.getElementById(`s1_ffb1_${d}`)?.value) || 0;
        } else if (activeTabId === 'tab2') {
            updateData.rf_phase1 = parseFloat(document.getElementById(`s2_p1_t_${d}`)?.value) || 0;
            updateData.rf_phase2 = parseFloat(document.getElementById(`s2_p2_t_${d}`)?.value) || 0;
            updateData.rf_phase3 = parseFloat(document.getElementById(`s2_p3_t_${d}`)?.value) || 0;
            updateData.rf_phase4 = parseFloat(document.getElementById(`s2_p4_t_${d}`)?.value) || 0;
        }
        updates.push(updateData);
    }
    const { error } = await supabaseClient.from('daily_records').upsert(updates, { onConflict: 'estate_name,record_date' });
    if (!error) {
        await logActivity('SAVE_DATA', `Saved ${activeTabId.toUpperCase()} entries`, estate);
        alert(`✅ Data saved!`);
        await loadFromCloud();
        await loadOverallSummary();
    }
}

async function loadFromCloud() {
    clearForm();
    const estate = document.getElementById('ladangSelect')?.value;
    const monthYear = document.getElementById('bulanTahun')?.value;
    if (!monthYear || !estate || !supabaseClient) return;

    const [year, month] = monthYear.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();

    const { data } = await supabaseClient.from('daily_records').select('*').ilike('estate_name', estate).gte('record_date', `${monthYear}-01`).lte('record_date', `${monthYear}-${String(lastDay).padStart(2, '0')}`);
    if (data) {
        data.forEach(row => {
            let day = parseInt(row.record_date.split('-')[2], 10);
            if (document.getElementById(`s1_rf_${day}`)) document.getElementById(`s1_rf_${day}`).value = row.rainfall_today || '';
            if (document.getElementById(`s1_ffb1_${day}`)) document.getElementById(`s1_ffb1_${day}`).value = row.ffb1 || '';
            if (document.getElementById(`s2_p1_t_${day}`)) document.getElementById(`s2_p1_t_${day}`).value = row.rf_phase1 || '';
            if (document.getElementById(`s2_p2_t_${day}`)) document.getElementById(`s2_p2_t_${day}`).value = row.rf_phase2 || '';
            if (document.getElementById(`s2_p3_t_${day}`)) document.getElementById(`s2_p3_t_${day}`).value = row.rf_phase3 || '';
            if (document.getElementById(`s2_p4_t_${day}`)) document.getElementById(`s2_p4_t_${day}`).value = row.rf_phase4 || '';
        });
    }
    calcS1(); calcS2();
    await buildTab3MillGrid();
}

function clearForm() {
    for (let d = 1; d <= 31; d++) {
        if (document.getElementById(`s1_rf_${d}`)) document.getElementById(`s1_rf_${d}`).value = '';
        if (document.getElementById(`s1_ffb1_${d}`)) document.getElementById(`s1_ffb1_${d}`).value = '';
        for (let p = 1; p <= 4; p++) if (document.getElementById(`s2_p${p}_t_${d}`)) document.getElementById(`s2_p${p}_t_${d}`).value = '';
    }
}

function onEstateOrMonthChange() {
    loadFromCloud();
    loadOverallSummary();
    loadMillSummaryBreakdown();
}

function initKeyInTables() {
    let s1 = '', s2 = '';
    for (let d = 1; d <= 31; d++) {
        s1 += `<tr>
            <td><b>${d}</b></td>
            <td><input type="number" step="any" id="s1_rf_${d}" oninput="calcS1()"></td>
            <td class="readonly-cell" id="s1_rf_todate_${d}"></td>
            <td><input type="number" step="any" id="s1_rf_pm_${d}" readonly class="readonly-cell"></td>
            <td><input type="number" step="any" id="s1_ffb1_${d}" oninput="calcS1()"></td>
            <td class="readonly-cell" id="s1_gt_todate_${d}"></td>
            <td><input type="number" step="any" id="s1_ffb_pm_${d}" readonly class="readonly-cell"></td>
        </tr>`;

        s2 += `<tr>
            <td><b>${d}</b></td>
            ${[1,2,3,4].map(p => `
                <td><input type="number" step="any" id="s2_p${p}_t_${d}" oninput="calcS2()"></td>
                <td class="readonly-cell" id="s2_p${p}_td_${d}"></td>
                <td><input type="number" step="any" id="s2_p${p}_pm_${d}" readonly class="readonly-cell"></td>
            `).join('')}
        </tr>`;
    }
    if (document.getElementById('tbody-s1')) document.getElementById('tbody-s1').innerHTML = s1;
    if (document.getElementById('tbody-s2')) document.getElementById('tbody-s2').innerHTML = s2;
}

function printActiveTab() {
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab || activeTab.id === 'tabSettings') return alert("⚠️ Printing disabled on Settings.");
    document.body.className = '';
    if (activeTab.id === 'tab1' || activeTab.id === 'tabMillSummary') document.body.classList.add('print-tab1');
    else document.body.classList.add('print-tab2');
    setTimeout(() => { window.print(); }, 200);
}

window.onload = async function() {
    startMalaysiaClock();
    initKeyInTables();
    switchTab('tab1');
    setDefaultMonthYear();
    await fetchEstates();
    await fetchUserProfiles();
    await fetchMills();
    applyUserPermissions();
    fetchActivityLogs();
};
