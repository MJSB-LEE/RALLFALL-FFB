// =====================================================================
// SETTINGS: Column Setup, Estates, Users, Audit Log (admin only)
// =====================================================================

// Settings for a "Column Setup only" user: just the Column Setup page
function switchSettings(id) {
    const btn = document.querySelector(`.sub-btn[data-sub="${id}"]`);
    if (btn?.dataset.need === 'settings' && !isSettingsUser()) id = 'setColumns';
    if (id === 'setDeletePwd') renderDeletePwdStatus();
    document.querySelectorAll('.settings-pane').forEach(p => p.classList.toggle('active', p.id === id));
    document.querySelectorAll('.sub-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === id));
    if (id === 'setAudit') { initAuditFilters(); fetchActivityLogs(); }
    if (id === 'setUsers') renderUsersTable();
    if (id === 'setEstates') renderEstateSettings();
    if (id === 'setColumns') renderColumnSetup();
    if (id === 'setGroups') fetchGroups().then(renderGroupsTable);
    if (id === 'setBackup') renderBackupInfo();
}

function renderSettings() {
    document.querySelectorAll('.sub-btn[data-need="settings"]').forEach(b => { b.style.display = isSettingsUser() ? '' : 'none'; });
    if (!isSettingsUser()) switchSettings('setColumns');
    const sel = document.getElementById('colEstateSelect');
    if (sel) {
        const keep = sel.value || S.estate;
        const list = visibleEstates();  // Column Setup users: only their own estates
        sel.innerHTML = list.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
        if (list.includes(keep)) sel.value = keep;
    }
    renderColumnSetup();
    renderEstateSettings();
    if (isSettingsUser()) fetchUserProfiles().then(() => { renderUsersTable(); renderGroupsTable(); });
}

// ---------------------------------------------------------------------
// Column Setup
// ---------------------------------------------------------------------
async function fetchColumns() {
    if (!supabaseClient) return;
    const { data, error } = await fetchAllRows(() => supabaseClient.from('estate_columns').select('*').order('id', { ascending: true }));
    if (error) {
        S.tablesReady = false;
        showSetupBanner(`⚠️ The database needs a one-time update before this version works. In Supabase, open <b>SQL Editor</b> and run the file <b>sql/01_new_tables.sql</b> (then optionally <b>sql/02_copy_old_data.sql</b>). <span class="muted">(${esc(error.message)})</span>`);
        return;
    }
    S.tablesReady = true;
    S.columns = data || [];
}

function renderColumnSetup() {
    const grid = document.getElementById('columnSetupGrid');
    const estate = document.getElementById('colEstateSelect')?.value;
    if (!grid) return;
    if (!estate) { grid.innerHTML = '<div class="empty-msg">Add an estate first (Estates tab).</div>'; return; }
    grid.innerHTML = Object.entries(CATEGORIES).map(([cat, info]) => {
        const cols = columnsFor(estate, cat, true);
        return `<div class="settings-card">
            <h3>${info.label} <span class="hint">→ Tab ${cat === 'rainfall' ? 1 : cat === 'mill' ? 2 : 3}</span></h3>
            <ul class="item-list">
                ${cols.length ? cols.map((c, i) => `<li class="${c.active === false ? 'is-hidden' : ''}">
                    <span class="item-name">${esc(c.name)}${c.active === false ? ' <i>(hidden)</i>' : ''}</span>
                    <span class="item-btns">
                        <button title="Move up" ${i === 0 ? 'disabled' : ''} onclick="moveColumn(${c.id}, -1)">▲</button>
                        <button title="Move down" ${i === cols.length - 1 ? 'disabled' : ''} onclick="moveColumn(${c.id}, 1)">▼</button>
                        <button title="Rename" onclick="renameColumn(${c.id})">✏️</button>
                        <button title="${c.active === false ? 'Show' : 'Hide'}" onclick="toggleColumn(${c.id})">${c.active === false ? '👁️' : '🚫'}</button>
                        <button title="Delete" class="del" onclick="deleteColumn(${c.id})">✕</button>
                    </span></li>`).join('') : `<li class="muted">None yet</li>`}
            </ul>
            <div class="add-row">
                <input type="text" id="newCol_${cat}" placeholder="${esc(info.example)}" onkeydown="if(event.key==='Enter')addColumn('${cat}')">
                <button class="btn btn-save" onclick="addColumn('${cat}')">+ Add</button>
            </div>
        </div>`;
    }).join('');
}

async function afterColumnChange() {
    await fetchColumns();
    renderColumnSetup();
    renderAllEntryTabs();
}

async function addColumn(category) {
    const estate = document.getElementById('colEstateSelect').value;
    const input = document.getElementById(`newCol_${category}`);
    const name = input.value.trim();
    if (!name) return;
    const existing = columnsFor(estate, category, true);
    if (existing.some(c => c.name.toLowerCase() === name.toLowerCase())) return alert(`"${name}" already exists for ${estate}.`);
    const sort = existing.reduce((m, c) => Math.max(m, c.sort_order), 0) + 1;
    const { error } = await supabaseClient.from('estate_columns').insert([{ estate_name: estate, category, name, sort_order: sort }]);
    if (error) return alert('❌ ' + error.message);
    await logActivity('ADD_COLUMN', `${CATEGORIES[category].label}: ${name}`, estate);
    await afterColumnChange();
    document.getElementById(`newCol_${category}`)?.focus();
}

async function moveColumn(id, dir) {
    const col = S.columns.find(c => c.id === id);
    const list = columnsFor(col.estate_name, col.category, true);
    const i = list.findIndex(c => c.id === id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const updates = list.map((c, idx) => ({ c, order: idx + 1 })).filter(x => x.c.sort_order !== x.order);
    for (const u of updates) {
        const { error } = await supabaseClient.from('estate_columns').update({ sort_order: u.order }).eq('id', u.c.id);
        if (error) return alert('❌ ' + error.message);
    }
    await afterColumnChange();
}

async function renameColumn(id) {
    const col = S.columns.find(c => c.id === id);
    const name = prompt(`Rename "${col.name}" to:`, col.name)?.trim();
    if (!name || name === col.name) return;
    if (columnsFor(col.estate_name, col.category, true).some(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase()))
        return alert(`"${name}" already exists.`);
    const { error } = await supabaseClient.from('estate_columns').update({ name }).eq('id', id);
    if (error) return alert('❌ ' + error.message);
    await logActivity('RENAME_COLUMN', `${col.name} → ${name}`, col.estate_name);
    await afterColumnChange();
}

async function toggleColumn(id) {
    const col = S.columns.find(c => c.id === id);
    const active = col.active === false;
    const { error } = await supabaseClient.from('estate_columns').update({ active }).eq('id', id);
    if (error) return alert('❌ ' + error.message);
    await logActivity(active ? 'SHOW_COLUMN' : 'HIDE_COLUMN', col.name, col.estate_name);
    await afterColumnChange();
}

async function deleteColumn(id) {
    const col = S.columns.find(c => c.id === id);
    const pwd = await askDeletePassword(`Delete column <b>${esc(col.name)}</b> (${esc(col.estate_name)})?`);
    if (pwd === null) return;
    if (!(await runDelete('app_delete_column', { p_id: id, p_password: pwd }))) return;
    toast(`🗑️ ${col.name} deleted`);
    await afterColumnChange();
}

// ---------- Delete password box (every delete) ----------
let pwdResolver = null;
function askDeletePassword(messageHtml) {
    return new Promise(resolve => {
        pwdResolver = resolve;
        document.getElementById('pwdMessage').innerHTML = messageHtml + '<br><span class="hint">Enter the IT delete password to confirm.</span>';
        document.getElementById('pwdInput').value = '';
        document.getElementById('pwdOverlay').style.display = 'flex';
        setTimeout(() => document.getElementById('pwdInput').focus(), 50);
    });
}
function closePwdBox(ok) {
    const v = document.getElementById('pwdInput').value;
    if (ok && !v) return document.getElementById('pwdInput').focus();
    document.getElementById('pwdOverlay').style.display = 'none';
    document.getElementById('pwdInput').value = '';
    const r = pwdResolver; pwdResolver = null;
    if (r) r(ok ? v : null);
}
// calls a delete function; the database checks the password and writes the Audit Log
async function runDelete(fn, args) {
    if (!(await ensureSession())) return false;
    const { data, error } = await supabaseClient.rpc(fn, args);
    if (error) { alert('❌ ' + dbErrorMessage(error)); return false; }
    if (data && data.error) { alert('❌ ' + data.error); return false; }
    return true;
}

// ---------- Settings -> Delete Password ----------
async function renderDeletePwdStatus() {
    const { data } = await supabaseClient.rpc('app_has_delete_password');
    document.getElementById('deletePwdStatus').innerHTML = data
        ? '<span class="ok">✓ A delete password is set.</span> To change it, type the current one first.'
        : '<span class="bad">No delete password yet — nobody can delete until you set one.</span>';
    document.getElementById('dpCurrentWrap').style.display = data ? '' : 'none';
}
async function saveDeletePassword() {
    const cur = document.getElementById('dpCurrent').value;
    const n1 = document.getElementById('dpNew').value, n2 = document.getElementById('dpNew2').value;
    if (n1.length < 6) return alert('The delete password must be at least 6 characters.');
    if (n1 !== n2) return alert('The two new passwords are not the same.');
    const { data, error } = await supabaseClient.rpc('app_set_delete_password', { p_current: cur, p_new: n1 });
    if (error) return alert('❌ ' + dbErrorMessage(error));
    if (data && data.error) return alert('❌ ' + data.error);
    ['dpCurrent', 'dpNew', 'dpNew2'].forEach(id => { document.getElementById(id).value = ''; });
    toast('✅ Delete password saved');
    renderDeletePwdStatus();
}

// ---------------------------------------------------------------------
// Estates
// ---------------------------------------------------------------------
async function fetchEstates() {
    if (!supabaseClient) return;
    let { data, error } = await supabaseClient.from('estates').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true });
    if (error) ({ data } = await supabaseClient.from('estates').select('*').order('id', { ascending: true }));
    S.estates = (data || []).map((e, i) => ({ ...e, sort_order: e.sort_order ?? i }));
}

function renderEstateSettings() {
    const ul = document.getElementById('estateSettingsList');
    if (!ul) return;
    ul.innerHTML = S.estates.map((e, i) => `<li>
        <span class="item-name">${esc(e.name)}</span>
        <span class="item-btns">
            <button title="Move up" ${i === 0 ? 'disabled' : ''} onclick="moveEstate(${i}, -1)">▲</button>
            <button title="Move down" ${i === S.estates.length - 1 ? 'disabled' : ''} onclick="moveEstate(${i}, 1)">▼</button>
        </span></li>`).join('') || '<li class="muted">No estates</li>';
}

async function moveEstate(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= S.estates.length) return;
    [S.estates[i], S.estates[j]] = [S.estates[j], S.estates[i]];
    for (let k = 0; k < S.estates.length; k++) {
        if (S.estates[k].sort_order !== k) {
            S.estates[k].sort_order = k;
            const { error } = await supabaseClient.from('estates').update({ sort_order: k }).eq('id', S.estates[k].id);
            if (error) return alert('❌ ' + error.message + '\n(Run sql/01_new_tables.sql first.)');
        }
    }
    renderEstateSettings();
    renderEstateDropdown();
    renderSettings();
}

async function addNewEstate() {
    const input = document.getElementById('newEstateName');
    const name = input.value.trim();
    if (!name) return alert('Enter estate name');
    if (S.estates.some(e => e.name.toLowerCase() === name.toLowerCase())) return alert('Estate already exists!');
    const { error } = await supabaseClient.from('estates').insert([{ name, sort_order: S.estates.length }]);
    if (error) return alert('❌ ' + error.message);
    await logActivity('ADD_ESTATE', `Added estate ${name}`);
    input.value = '';
    await fetchEstates();
    renderEstateDropdown();
    renderSettings();
    toast(`✅ ${name} added. Now set up its columns in Column Setup.`);
}

// ---------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------
async function fetchUserProfiles() {
    if (!supabaseClient || !isSettingsUser()) return;
    await fetchGroups();
    const { data, error } = await supabaseClient.rpc('app_list_users');
    if (error) { console.warn(error); return; }
    S.users = (data || []).sort((a, b) => (a.username || '').localeCompare(b.username || ''));
}

function userEstates(u) {
    const a = u.assigned_estates;
    if (Array.isArray(a)) return a;
    if (typeof a === 'string' && a.trim()) { try { const p = JSON.parse(a); if (Array.isArray(p)) return p; } catch (e) {} return a.split(',').map(s => s.trim()).filter(Boolean); }
    return [];
}

function renderUsersTable() {
    const tb = document.getElementById('usersTableBody');
    if (!tb) return;
    tb.innerHTML = S.users.map(u => {
        const ests = userEstates(u);
        const active = u.active !== false;
        return `<tr class="${active ? '' : 'is-hidden'}">
            <td class="left"><b>${esc(u.username)}</b>${u.email && !u.email.endsWith('@ledger.local') ? `<div class="small muted">${esc(u.email)}</div>` : ''}</td>
            <td class="left">${esc(u.full_name || '')}</td>
            <td><span class="role-pill role-${esc(u.role)}">${esc(u.group_name || (u.role || 'user').toUpperCase())}</span></td>
            <td class="left small">${u.all_estates ? '<b>All estates</b>' : (ests.length ? ests.map(esc).join(', ') : '<span class="bad">None — cannot see anything</span>')}</td>
            <td class="small nowrap">${lastLoginText(u.last_login_at)}</td>
            <td>${active ? 'Active' : '<b>Disabled</b>'}</td>
            <td class="nowrap">
                <button class="btn-mini" onclick="editUser('${esc(u.username)}')">✏️ Edit</button>
                <button class="btn-mini del" onclick="deleteUser('${esc(u.username)}')">✕</button>
            </td></tr>`;
    }).join('') || '<tr><td colspan="7">No users yet.</td></tr>';
    if (!document.getElementById('ufEstates').children.length) resetUserForm();
    else renderGroupOptions(document.getElementById('ufGroup').value || null);  // keep group list up to date
}

function lastLoginText(ts) {
    if (!ts) return '<span class="muted">Never</span>';
    const d = new Date(ts);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(d);
    const days = Math.round((new Date(today) - new Date(day)) / 86400000);
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hour12: true }).format(d);
    if (days === 0) return `Today ${time}`;
    if (days === 1) return `Yesterday ${time}`;
    return `${formatDateTime(ts).split(',')[0]} <span class="muted">(${days} days ago)</span>`;
}

function renderEstateChecks(selected = []) {
    document.getElementById('ufEstates').innerHTML = S.estates.map(e => `
        <label class="check-line"><input type="checkbox" value="${esc(e.name)}" ${selected.includes(e.name) ? 'checked' : ''}> ${esc(e.name)}</label>`).join('');
}
function toggleEstateChecks() {
    document.getElementById('ufEstatesWrap').style.display = document.getElementById('ufAllEstates').checked ? 'none' : '';
}
function renderGroupOptions(selectedId) {
    const sel = document.getElementById('ufGroup');
    sel.innerHTML = S.groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
    const fallback = S.groups.find(g => g.name === 'Clerk Full') || S.groups[0];
    sel.value = selectedId != null && S.groups.some(g => g.id == selectedId) ? selectedId : (fallback ? fallback.id : '');
}

function resetUserForm() {
    document.getElementById('ufEditing').value = '';
    document.getElementById('userFormTitle').textContent = 'Add New User';
    document.getElementById('ufUsername').value = '';
    document.getElementById('ufUsername').disabled = false;
    document.getElementById('ufFullName').value = '';
    document.getElementById('ufEmail').value = '';
    document.getElementById('ufPassword').value = '';
    document.getElementById('ufPasswordLabel').textContent = 'Password';
    renderGroupOptions(null);
    document.getElementById('ufAllEstates').checked = false;
    document.getElementById('ufActive').checked = true;
    renderEstateChecks([]);
    toggleEstateChecks();
}

function editUser(username) {
    const u = S.users.find(x => x.username === username);
    if (!u) return;
    document.getElementById('ufEditing').value = u.username;
    document.getElementById('userFormTitle').textContent = `Edit User: ${u.username}`;
    document.getElementById('ufUsername').value = u.username;
    document.getElementById('ufUsername').disabled = true;
    document.getElementById('ufFullName').value = u.full_name || '';
    document.getElementById('ufEmail').value = (u.email || '').endsWith('@ledger.local') ? '' : (u.email || '');
    document.getElementById('ufPassword').value = '';
    document.getElementById('ufPasswordLabel').textContent = 'New password (leave blank to keep)';
    renderGroupOptions(u.group_id);
    document.getElementById('ufAllEstates').checked = !!u.all_estates;
    document.getElementById('ufActive').checked = u.active !== false;
    renderEstateChecks(userEstates(u));
    toggleEstateChecks();
    document.getElementById('userFormCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function saveUserForm() {
    const editing = document.getElementById('ufEditing').value;
    const username = document.getElementById('ufUsername').value.trim();
    const full_name = document.getElementById('ufFullName').value.trim();
    const emailIn = document.getElementById('ufEmail').value.trim().toLowerCase();
    if (emailIn && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailIn)) return alert('Email does not look right.');
    // Database requires an email; users without one get a placeholder based on the username
    const email = emailIn || `${(username || editing).toLowerCase().replace(/[^a-z0-9._-]/g, '')}@ledger.local`;
    const password = document.getElementById('ufPassword').value;
    const groupId = parseInt(document.getElementById('ufGroup').value, 10);
    const groupName = S.groups.find(g => g.id === groupId)?.name || '';
    const allEstates = document.getElementById('ufAllEstates').checked;
    const active = document.getElementById('ufActive').checked;
    const assigned_estates = allEstates ? [] :
        [...document.querySelectorAll('#ufEstates input:checked')].map(i => i.value);

    if (!username || !full_name) return alert('Please fill in Username and Full Name.');
    if (!editing && !password) return alert('Please set a password for the new user.');
    if (password && password.length < 6) return alert('Password must be at least 6 characters.');
    if (!groupId) return alert('Choose a user group.');
    if (!allEstates && !assigned_estates.length) return alert('Tick at least one estate, or All estates.');

    if (editing) {
        const { error } = await supabaseClient.rpc('app_save_user', {
            p_editing: editing, p_username: editing, p_full_name: full_name, p_email: email,
            p_password: password || '', p_group_id: groupId, p_all_estates: allEstates, p_active: active, p_estates: assigned_estates });
        if (error) return alert('❌ ' + dbErrorMessage(error));
        await logActivity('EDIT_USER', `Edited ${editing} (${groupName}${allEstates ? ', all estates' : ''}${active ? '' : ', disabled'}${password ? ', password reset' : ''})`);
        toast(`✅ ${editing} updated`);
    } else {
        if (S.users.some(u => u.username.toLowerCase() === username.toLowerCase())) return alert('Username already exists.');
        const { error } = await supabaseClient.rpc('app_save_user', {
            p_editing: '', p_username: username, p_full_name: full_name, p_email: email,
            p_password: password, p_group_id: groupId, p_all_estates: allEstates, p_active: active, p_estates: assigned_estates });
        if (error) return alert('❌ ' + (/duplicate/.test(error.message) && /email/.test(error.message) ? 'That email is already used by another user.' : dbErrorMessage(error)));
        await logActivity('CREATE_USER', `Created ${username} (${groupName})`);
        toast(`✅ ${username} created`);
    }
    await fetchUserProfiles();
    resetUserForm();
    renderUsersTable();
}

async function deleteUser(username) {
    if (username === currentUser?.username) return alert('You cannot delete your own account.');
    const pwd = await askDeletePassword(`Delete user <b>${esc(username)}</b>?<br><span class="hint">Tip: untick "Active" instead to block login but keep the name in records.</span>`);
    if (pwd === null) return;
    if (!(await runDelete('app_delete_user', { p_username: username, p_password: pwd }))) return;
    toast(`🗑️ ${username} deleted`);
    await fetchUserProfiles();
    resetUserForm();
    renderUsersTable();
}

// ---------------------------------------------------------------------
// User Groups: per tab None / View / Edit, and Submit / Approve / Unlock / Settings
// ---------------------------------------------------------------------
const GROUP_TABS = [
    ['tab_rainfall', ['none', 'view', 'edit']], ['tab_mill', ['none', 'view', 'edit']], ['tab_block', ['none', 'view', 'edit']],
    ['tab_summary', ['none', 'view']], ['tab_millsummary', ['none', 'view']]
];
const GROUP_ACTIONS = ['can_submit', 'can_approve', 'can_unlock', 'can_columns', 'can_settings'];

async function fetchGroups() {
    if (!supabaseClient || !isSettingsUser()) return;
    const { data, error } = await supabaseClient.rpc('app_list_groups');
    if (error) { console.warn(error); S.groups = S.groups || []; return; }
    S.groups = data || [];
}

function renderGroupsTable() {
    const tb = document.getElementById('groupsTableBody');
    if (!tb) return;
    tb.innerHTML = (S.groups || []).map(g => {
        const p = g.perms || {};
        return `<tr data-gid="${g.id}">
            <td><input type="text" class="g-name" value="${esc(g.name)}" oninput="markGroupChanged(this)"></td>
            ${GROUP_TABS.map(([k, opts]) => {
                const v = opts.includes(p[k]) ? p[k] : 'none';
                return `<td><select data-k="${k}" class="p-${v}" onchange="this.className='p-'+this.value;markGroupChanged(this)">
                    ${opts.map(o => `<option value="${o}" ${o === v ? 'selected' : ''}>${o === 'none' ? 'None' : o === 'view' ? 'View' : 'Edit'}</option>`).join('')}
                </select></td>`;
            }).join('')}
            ${GROUP_ACTIONS.map(k => `<td><input type="checkbox" data-k="${k}" ${p[k] ? 'checked' : ''} onchange="markGroupChanged(this)"></td>`).join('')}
            <td>${g.users || 0}</td>
            <td class="nowrap">
                <button class="btn-mini" onclick="saveGroupRow(${g.id})">💾 Save</button>
                <button class="btn-mini del" onclick="deleteGroup(${g.id})" ${g.users ? 'disabled title="Move its users to another group first"' : ''}>✕</button>
            </td></tr>`;
    }).join('') || '<tr><td colspan="13">No groups yet. Run sql/05_user_groups.sql in Supabase.</td></tr>';
}

function markGroupChanged(el) { el.closest('tr').classList.add('changed'); }

function readGroupRow(tr) {
    const perms = {};
    tr.querySelectorAll('select[data-k]').forEach(s => { perms[s.dataset.k] = s.value; });
    tr.querySelectorAll('input[type=checkbox][data-k]').forEach(c => { perms[c.dataset.k] = c.checked; });
    return { name: tr.querySelector('.g-name').value.trim(), perms };
}

async function afterGroupChange() {
    await fetchGroups();
    renderGroupsTable();
    // my own rights may have changed
    const me = await touchSession();
    if (me && me.username) { currentUser = publicUser(me); await applyUserPermissions(); switchTab('tabSettings'); switchSettings('setGroups'); }
}

async function saveGroupRow(id) {
    const tr = document.querySelector(`#groupsTableBody tr[data-gid="${id}"]`);
    const { name, perms } = readGroupRow(tr);
    if (!name) return alert('Group name is required.');
    const { error } = await supabaseClient.rpc('app_save_group', { p_id: id, p_name: name, p_perms: perms });
    if (error) return alert('❌ ' + dbErrorMessage(error));
    await logActivity('SAVE_GROUP', `Saved group ${name}`);
    toast(`✅ ${name} saved`);
    await afterGroupChange();
}

async function addGroup() {
    const input = document.getElementById('newGroupName');
    const name = input.value.trim();
    if (!name) return alert('Type a group name first.');
    const perms = { tab_rainfall: 'view', tab_mill: 'view', tab_block: 'view', tab_summary: 'view', tab_millsummary: 'view',
                    can_submit: false, can_approve: false, can_unlock: false, can_columns: false, can_settings: false };
    const { error } = await supabaseClient.rpc('app_save_group', { p_id: null, p_name: name, p_perms: perms });
    if (error) return alert('❌ ' + dbErrorMessage(error));
    await logActivity('SAVE_GROUP', `Added group ${name}`);
    input.value = '';
    toast(`✅ ${name} added — now choose its rights and click Save`);
    await afterGroupChange();
}

async function deleteGroup(id) {
    const g = (S.groups || []).find(x => x.id === id);
    if (!g) return;
    const pwd = await askDeletePassword(`Delete group <b>${esc(g.name)}</b>?`);
    if (pwd === null) return;
    if (!(await runDelete('app_delete_group', { p_id: id, p_password: pwd }))) return;
    toast(`🗑️ ${g.name} deleted`);
    await afterGroupChange();
}
