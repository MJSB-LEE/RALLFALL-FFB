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
    if (!currentUser || currentUser.all_estates || isSettingsUser()) return all;
    const mine = userEstates(currentUser);
    return all.filter(n => mine.includes(n)); // nothing ticked = nothing (admin sees all)
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

function tabAllowed(tabId) {
    const btn = document.getElementById(`btn-${tabId}`);
    const key = btn?.dataset.perm;
    if (!key) return true;
    if (key === 'settings_or_columns') return can('can_settings') || can('can_columns');
    return key.startsWith('can_') ? can(key) : tabAccess(key) !== 'none';
}
function firstAllowedTab() {
    return [...document.querySelectorAll('.tab-btn')].map(b => b.id.replace('btn-', '')).find(tabAllowed) || null;
}

function switchTab(tabId) {
    if (!tabAllowed(tabId)) tabId = firstAllowedTab();
    if (!tabId) return;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.toggle('active', el.id === tabId));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.toggle('active', el.id === `btn-${tabId}`));
    document.getElementById('entryActions').style.display = ENTRY_TABS.includes(tabId) ? '' : 'none';
    // Estate picker is not used on the group tabs / settings
    document.getElementById('ladangSelect').disabled = !ENTRY_TABS.includes(tabId);

    if (tabId === 'tabSummary') loadOverallSummary();
    if (tabId === 'tabMillSummary') loadMillSummaryBreakdown();
    if (tabId === 'tabSettings') renderSettings();
    if (ENTRY_TABS.includes(tabId)) renderStatus();
}

// ---------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------
function publicUser(u) {
    const role = u.role || 'user';
    return {
        username: u.username, full_name: u.full_name, role,
        assigned_estates: userEstates(u),
        all_estates: !!u.all_estates || (!u.perms && role === 'admin'),
        group_name: u.group_name || role.toUpperCase(),
        perms: u.perms && Object.keys(u.perms).length ? u.perms : (ROLE_DEFAULT_PERMS[role] || ROLE_DEFAULT_PERMS.user)
    };
}

async function loadReferenceData() {
    await Promise.all([fetchEstates(), fetchColumns(), isSettingsUser() ? fetchUserProfiles() : null]);
}

async function handleLogin() {
    const userIn = document.getElementById('loginUsername').value.trim();
    const passIn = document.getElementById('loginPassword').value;
    const errorElem = document.getElementById('loginError');
    const showErr = msg => { errorElem.style.display = 'block'; errorElem.innerText = msg; };
    if (!userIn || !passIn) return showErr('Enter username and password.');
    if (!supabaseClient) return showErr('Cannot connect to the database. Check your internet.');
    const btn = document.querySelector('.login-btn');
    btn.disabled = true;
    const { data, error } = await (makeClient(null) || supabaseClient).rpc('app_login', { p_username: userIn, p_password: passIn });
    btn.disabled = false;
    if (error) return showErr(/app_login/.test(error.message)
        ? 'Database not updated yet: run sql/03_security.sql in Supabase.' : error.message);
    if (!data || data.error) return showErr(data?.error || 'Login failed.');

    errorElem.style.display = 'none';
    document.getElementById('loginPassword').value = '';
    setSession(data.token);

    // Login popup after expiry: same person -> keep everything typed and carry on
    if (reloginResolver) {
        const resolve = reloginResolver;
        reloginResolver = null;
        showReloginMode(false);
        if (currentUser && data.user.username === currentUser.username) {
            currentUser = publicUser(data.user);
            document.getElementById('loginOverlay').style.display = 'none';
            await logActivity('LOGIN', 'Logged in again after login expired');
            resolve(true);
            return;
        }
        resolve(false); // a different person logged in: start fresh
        S.dirty.clear(); S.reportDirty = false;
    }
    currentUser = publicUser(data.user);
    await loadReferenceData();
    await logActivity('LOGIN', `Logged in (${currentUser.group_name})`);
    await applyUserPermissions();
}

async function handleLogout(force = false) {
    if (!force && (S.dirty.size || S.reportDirty) && !confirm('You have unsaved changes. Logout anyway?')) return;
    if (currentUser && !force) {
        await logActivity('LOGOUT', 'Logged out');
        try { await supabaseClient.rpc('app_logout'); } catch (e) {}
    }
    currentUser = null;
    setSession(null);
    S.dirty.clear(); S.reportDirty = false;
    S.estates = []; S.columns = []; S.users = []; S.entries = {};
    document.getElementById('loginOverlay').style.display = 'flex';
}

async function applyUserPermissions() {
    if (!currentUser) { document.getElementById('loginOverlay').style.display = 'flex'; return; }
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('userBadge').innerText = currentUser.group_name.toUpperCase();
    document.getElementById('userInfoLabel').innerText = `User: ${displayName(currentUser)}`;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.style.display = tabAllowed(b.id.replace('btn-', '')) ? '' : 'none';
    });
    if (isSettingsUser() && S.tablesReady) checkBackupReminder();
    renderEstateDropdown();
    setDefaultMonthYear();
    lastSelection = { estate: S.estate, month: S.month };
    switchTab(firstAllowedTab());
    if (!firstAllowedTab()) showSetupBanner('Your user group has no tabs switched on. Ask your admin to check 👥 User Groups.');
    await loadMonthData();
}

// ---------------------------------------------------------------------
// Keep login alive + login popup when it expires (typed numbers are kept)
// ---------------------------------------------------------------------
let reloginResolver = null;
let lastActivityAt = Date.now();

// Extends the login 24 hours. Returns the user, or null if the login has expired.
async function touchSession() {
    if (!sessionToken || !supabaseClient) return null;
    let { data, error } = await supabaseClient.rpc('app_touch');
    if (error && /app_touch/.test(error.message)) ({ data, error } = await supabaseClient.rpc('app_me')); // 04_updates.sql not run yet
    if (error) return null;
    return data;
}

// Call before saving. Shows the login popup if needed; resolves true when it is OK to continue.
async function ensureSession() {
    const me = await touchSession();
    if (me && me.username === currentUser?.username) {
        currentUser = publicUser(me);
        return true;
    }
    return await promptRelogin();
}

function showReloginMode(on) {
    document.getElementById('reloginNote').style.display = on ? 'block' : 'none';
    document.getElementById('reloginCancel').style.display = on ? 'inline-block' : 'none';
    const u = document.getElementById('loginUsername');
    if (on && currentUser) u.value = currentUser.username;
}

function promptRelogin() {
    return new Promise(resolve => {
        reloginResolver = resolve;
        showReloginMode(true);
        document.getElementById('loginError').style.display = 'none';
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('loginPassword').focus();
    });
}

function cancelRelogin() {
    if (!reloginResolver) return;
    const resolve = reloginResolver;
    reloginResolver = null;
    showReloginMode(false);
    document.getElementById('loginOverlay').style.display = 'none';
    toast('Not saved — log in again to save your changes');
    resolve(false);
}

// While someone is actively working, keep the login alive every 20 minutes
['keydown', 'click', 'input'].forEach(ev => document.addEventListener(ev, () => { lastActivityAt = Date.now(); }, { passive: true }));
setInterval(() => {
    if (currentUser && !reloginResolver && Date.now() - lastActivityAt < 20 * 60 * 1000) touchSession();
}, 20 * 60 * 1000);

// ---------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------
function renderPrintParts() {
    document.querySelectorAll('.print-head').forEach(el => {
        const group = el.dataset.group === '1';
        el.innerHTML = `<div class="ph-group">MASIH JAYA GROUP</div>
            <div class="ph-title">${esc(el.dataset.title)}</div>
            <div class="ph-meta">
                <span>${group ? `Lokasi: <b class="ph-box">${esc(summaryEstates().join(', '))}</b>` : `Nama Ladang: <b class="ph-box">${esc(S.estate)}</b>`}</span>
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
    // Still logged in from before? Ask the database (role/estates may have changed, or login expired)
    if (sessionToken && supabaseClient) {
        const data = await touchSession();
        if (data && data.username) currentUser = publicUser(data);
        else setSession(null);
    }
    if (currentUser) await loadReferenceData();
    await applyUserPermissions();
};
