// =====================================================================
// App start, login, tabs, estate/month selection, print
// =====================================================================

const ENTRY_TABS = ['tabRainfall', 'tabMill', 'tabBlock'];

function showSetupBanner(html) {
    const b = document.getElementById('setupBanner');
    if (!b) return;
    b.innerHTML = html;
    b.style.display = html ? 'block' : 'none';
}

function visibleEstates() {
    const all = S.estates.map(e => e.name);
    if (!currentUser || currentUser.role === 'admin') return all;
    const mine = userEstates(currentUser);
    return mine.length ? all.filter(n => mine.includes(n)) : all;
}

function renderEstateDropdown() {
    const sel = document.getElementById('ladangSelect');
    if (!sel) return;
    const list = visibleEstates();
    sel.innerHTML = list.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    if (list.includes(S.estate)) sel.value = S.estate;
    else S.estate = list[0] || '';
}

function setDefaultMonthYear() {
    const input = document.getElementById('bulanTahun');
    if (input && !input.value) {
        input.value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date()).substring(0, 7);
    }
    S.month = input?.value || '';
}

let lastSelection = { estate: '', month: '' };
async function onEstateOrMonthChange() {
    const sel = document.getElementById('ladangSelect'), mon = document.getElementById('bulanTahun');
    if ((S.dirty.size || S.reportDirty) && !confirm('You have unsaved changes. Leave without saving?')) {
        sel.value = lastSelection.estate; mon.value = lastSelection.month;
        return;
    }
    S.estate = sel.value;
    S.month = mon.value;
    lastSelection = { estate: S.estate, month: S.month };
    await loadMonthData();
    const active = document.querySelector('.tab-content.active')?.id;
    if (active === 'tabSummary') loadOverallSummary();
    if (active === 'tabMillSummary') loadMillSummaryBreakdown();
}

function switchTab(tabId) {
    const btn = document.getElementById(`btn-${tabId}`);
    if (btn?.dataset.minRole && !roleAtLeast(btn.dataset.minRole)) tabId = 'tabRainfall';
    document.querySelectorAll('.tab-content').forEach(el => el.classList.toggle('active', el.id === tabId));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.toggle('active', el.id === `btn-${tabId}`));
    document.getElementById('entryActions').style.display = ENTRY_TABS.includes(tabId) ? '' : 'none';
    // Estate picker is not used on the group tabs / settings
    document.getElementById('ladangSelect').disabled = !ENTRY_TABS.includes(tabId);

    if (tabId === 'tabSummary') loadOverallSummary();
    if (tabId === 'tabMillSummary') loadMillSummaryBreakdown();
    if (tabId === 'tabSettings') renderSettings();
}

// ---------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------
function publicUser(u) {
    return { username: u.username, full_name: u.full_name, role: u.role || 'user', assigned_estates: userEstates(u) };
}

async function handleLogin() {
    const userIn = document.getElementById('loginUsername').value.trim();
    const passIn = document.getElementById('loginPassword').value;
    const errorElem = document.getElementById('loginError');
    await fetchUserProfiles();

    let matched = S.users.find(u => u.username === userIn && u.password === passIn);
    // First-time setup only: built-in admin works while no users exist in the database
    if (!matched && S.users.length === 0 && userIn === 'admin' && passIn === 'admin123') {
        matched = { username: 'admin', full_name: 'System Admin', role: 'admin' };
    }
    if (!matched) { errorElem.style.display = 'block'; errorElem.innerText = 'Invalid Username or Password!'; return; }
    if (matched.active === false) { errorElem.style.display = 'block'; errorElem.innerText = 'This account is disabled. Contact your admin.'; return; }

    errorElem.style.display = 'none';
    document.getElementById('loginPassword').value = '';
    currentUser = publicUser(matched);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    await logActivity('LOGIN', `Logged in as ${currentUser.role.toUpperCase()}`);
    await applyUserPermissions();
}

function handleLogout() {
    if ((S.dirty.size || S.reportDirty) && !confirm('You have unsaved changes. Logout anyway?')) return;
    if (currentUser) logActivity('LOGOUT', 'Logged out');
    currentUser = null;
    localStorage.removeItem('currentUser');
    S.dirty.clear(); S.reportDirty = false;
    document.getElementById('loginOverlay').style.display = 'flex';
}

async function applyUserPermissions() {
    if (!currentUser) { document.getElementById('loginOverlay').style.display = 'flex'; return; }
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('userBadge').innerText = `ROLE: ${currentUser.role.toUpperCase()}`;
    document.getElementById('userInfoLabel').innerText = `User: ${displayName(currentUser)}`;
    document.querySelectorAll('.tab-btn[data-min-role]').forEach(b => {
        b.style.display = roleAtLeast(b.dataset.minRole) ? '' : 'none';
    });
    if (S.users.length === 0 && currentUser.role === 'admin') {
        showSetupBanner(S.tablesReady ? '⚠️ No user accounts exist yet. Go to <b>⚙️ Settings → Users</b> and create your own Admin account — the built-in admin/admin123 stops working once a user exists.' : document.getElementById('setupBanner').innerHTML);
    }
    renderEstateDropdown();
    setDefaultMonthYear();
    lastSelection = { estate: S.estate, month: S.month };
    switchTab('tabRainfall');
    await loadMonthData();
}

// ---------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------
function renderPrintParts() {
    document.querySelectorAll('.print-head').forEach(el => {
        const group = el.dataset.group === '1';
        el.innerHTML = `<div class="ph-group">MASIH JAYA GROUP</div>
            <div class="ph-title">${esc(el.dataset.title)}</div>
            <div class="ph-meta">
                <span>${group ? '' : `Nama Ladang: <b class="ph-box">${esc(S.estate)}</b>`}</span>
                <span>Bulan/Tahun: <b class="ph-box">${S.month ? monthLabel(S.month) : ''}</b></span>
            </div>`;
    });
    const r = S.report || {};
    document.querySelectorAll('.print-sign').forEach(el => {
        el.innerHTML = `<div class="sig"><span>Prepared By:</span><div class="sig-line"></div><div class="sig-name">${esc(r.submitted_by || displayName(currentUser))}</div></div>
            <div class="sig"><span>Approved By:</span><div class="sig-line"></div><div class="sig-name">${esc(r.approved_by || '') || '&nbsp;'}</div></div>`;
    });
}

async function printActiveTab() {
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab || activeTab.id === 'tabSettings') return alert('⚠️ Printing is not available on Settings.');
    if (ENTRY_TABS.includes(activeTab.id) && (S.dirty.size || S.reportDirty) && !isLocked()) {
        if (!(await saveToCloud(true))) return;
    }
    renderPrintParts();
    // Wide tables print in landscape
    const ths = activeTab.querySelector('thead tr:last-child')?.children.length || 0;
    const landscape = ['tabSummary', 'tabMillSummary'].includes(activeTab.id) ? ths > 9 : ths > 14;
    document.getElementById('printPageStyle').textContent = `@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 6mm; }`;
    setTimeout(() => window.print(), 100);
}

// ---------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------
window.onload = async function () {
    startMalaysiaClock();
    setDefaultMonthYear();
    if (!supabaseClient) {
        showSetupBanner('⚠️ Cannot connect to the database (Supabase library did not load). Check your internet connection.');
    }
    await Promise.all([fetchEstates(), fetchUserProfiles(), fetchColumns()]);

    // Refresh saved login from the database (role/estates may have changed)
    if (currentUser) {
        const fresh = S.users.find(u => u.username === currentUser.username);
        if (fresh && fresh.active !== false) currentUser = publicUser(fresh);
        else if (!(S.users.length === 0 && currentUser.username === 'admin')) currentUser = null;
        if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser));
        else localStorage.removeItem('currentUser');
    }
    await applyUserPermissions();
};
