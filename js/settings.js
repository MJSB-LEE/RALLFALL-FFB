// =====================================================================
// SETTINGS: Column Setup, Estates, Users, Audit Log (admin only)
// =====================================================================

function switchSettings(id) {
    document.querySelectorAll('.settings-pane').forEach(p => p.classList.toggle('active', p.id === id));
    document.querySelectorAll('.sub-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === id));
    if (id === 'setAudit') fetchActivityLogs();
    if (id === 'setUsers') renderUsersTable();
    if (id === 'setEstates') renderEstateSettings();
    if (id === 'setColumns') renderColumnSetup();
}

function renderSettings() {
    const sel = document.getElementById('colEstateSelect');
    if (sel) {
        const keep = sel.value || S.estate;
        sel.innerHTML = S.estates.map(e => `<option value="${esc(e.name)}">${esc(e.name)}</option>`).join('');
        if (S.estates.some(e => e.name === keep)) sel.value = keep;
    }
    renderColumnSetup();
    renderEstateSettings();
    renderUsersTable();
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
    const { count, error: cErr } = await supabaseClient.from('daily_entries')
        .select('column_id', { count: 'exact', head: true }).eq('column_id', id).not('value', 'is', null);
    if (cErr) return alert('❌ ' + cErr.message);
    if (count > 0) {
        return alert(`"${col.name}" already has ${count} day(s) of data, so it cannot be deleted.\n\nUse 🚫 Hide instead — it disappears from key-in but old months stay correct.`);
    }
    if (!confirm(`Delete "${col.name}"? It has no data.`)) return;
    const { error } = await supabaseClient.from('estate_columns').delete().eq('id', id);
    if (error) return alert('❌ ' + error.message);
    await logActivity('DELETE_COLUMN', col.name, col.estate_name);
    await afterColumnChange();
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
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('user_profiles').select('*');
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
            <td class="left"><b>${esc(u.username)}</b></td>
            <td class="left">${esc(u.full_name || '')}</td>
            <td><span class="role-pill role-${esc(u.role)}">${esc((u.role || 'user').toUpperCase())}</span></td>
            <td class="left small">${u.role === 'admin' ? '<i>All</i>' : (ests.length ? ests.map(esc).join(', ') : '<i>All</i>')}</td>
            <td>${active ? 'Active' : '<b>Disabled</b>'}</td>
            <td class="nowrap">
                <button class="btn-mini" onclick="editUser('${esc(u.username)}')">✏️ Edit</button>
                <button class="btn-mini del" onclick="deleteUser('${esc(u.username)}')">✕</button>
            </td></tr>`;
    }).join('') || '<tr><td colspan="6">No users yet.</td></tr>';
    if (!document.getElementById('ufEstates').children.length) resetUserForm();
}

function renderEstateChecks(selected = []) {
    document.getElementById('ufEstates').innerHTML = S.estates.map(e => `
        <label class="check-line"><input type="checkbox" value="${esc(e.name)}" ${selected.includes(e.name) ? 'checked' : ''}> ${esc(e.name)}</label>`).join('');
}
function toggleEstateChecks() {
    document.getElementById('ufEstatesWrap').style.display = document.getElementById('ufRole').value === 'admin' ? 'none' : '';
}

function resetUserForm() {
    document.getElementById('ufEditing').value = '';
    document.getElementById('userFormTitle').textContent = 'Add New User';
    document.getElementById('ufUsername').value = '';
    document.getElementById('ufUsername').disabled = false;
    document.getElementById('ufFullName').value = '';
    document.getElementById('ufPassword').value = '';
    document.getElementById('ufPasswordLabel').textContent = 'Password';
    document.getElementById('ufRole').value = 'user';
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
    document.getElementById('ufPassword').value = '';
    document.getElementById('ufPasswordLabel').textContent = 'New password (leave blank to keep)';
    document.getElementById('ufRole').value = u.role || 'user';
    document.getElementById('ufActive').checked = u.active !== false;
    renderEstateChecks(userEstates(u));
    toggleEstateChecks();
    document.getElementById('userFormCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function activeAdminsAfter(change) {
    return S.users.map(u => u.username === change.username ? { ...u, ...change } : u)
        .filter(u => u.role === 'admin' && u.active !== false).length;
}

async function saveUserForm() {
    const editing = document.getElementById('ufEditing').value;
    const username = document.getElementById('ufUsername').value.trim();
    const full_name = document.getElementById('ufFullName').value.trim();
    const password = document.getElementById('ufPassword').value;
    const role = document.getElementById('ufRole').value;
    const active = document.getElementById('ufActive').checked;
    const assigned_estates = role === 'admin' ? [] :
        [...document.querySelectorAll('#ufEstates input:checked')].map(i => i.value);

    if (!username || !full_name) return alert('Please fill in Username and Full Name.');
    if (!editing && !password) return alert('Please set a password for the new user.');
    if (password && password.length < 6) return alert('Password must be at least 6 characters.');

    if (editing) {
        if (activeAdminsAfter({ username: editing, role, active }) === 0) return alert('There must be at least one active Admin.');
        const changes = { full_name, role, active, assigned_estates };
        if (password) changes.password = password;
        const { error } = await supabaseClient.from('user_profiles').update(changes).eq('username', editing);
        if (error) return alert('❌ ' + error.message);
        await logActivity('EDIT_USER', `Edited ${editing} (${role}${active ? '' : ', disabled'}${password ? ', password reset' : ''})`);
        toast(`✅ ${editing} updated`);
    } else {
        if (S.users.some(u => u.username.toLowerCase() === username.toLowerCase())) return alert('Username already exists.');
        const { error } = await supabaseClient.from('user_profiles').insert([{ username, password, full_name, role, active, assigned_estates }]);
        if (error) return alert('❌ ' + error.message);
        await logActivity('CREATE_USER', `Created ${username} (${role})`);
        toast(`✅ ${username} created`);
    }
    await fetchUserProfiles();
    resetUserForm();
    renderUsersTable();
}

async function deleteUser(username) {
    if (username === currentUser?.username) return alert('You cannot delete your own account.');
    if (activeAdminsAfter({ username, active: false }) === 0) return alert('There must be at least one active Admin.');
    if (!confirm(`Delete user "${username}"?\n\nTip: you can untick "Active" instead to block login but keep the name in records.`)) return;
    const { error } = await supabaseClient.from('user_profiles').delete().eq('username', username);
    if (error) return alert('❌ ' + error.message);
    await logActivity('DELETE_USER', `Deleted ${username}`);
    await fetchUserProfiles();
    resetUserForm();
    renderUsersTable();
}
