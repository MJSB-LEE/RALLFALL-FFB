async function createNewUserAccount() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    const fullName = document.getElementById('newFullName').value.trim();
    const role = document.getElementById('newUserRole').value;

    if (!username || !password || !fullName) {
        return alert("Please fill in Username, Password, and Full Name.");
    }

    const newUser = { username, password, full_name: fullName, role, assigned_estates: [] };

    if (supabaseClient) {
        const { error } = await supabaseClient.from('user_profiles').insert([newUser]);
        if (error) return alert("Failed to save user: " + error.message);
    }

    userAccounts.push(newUser);
    await logActivity('CREATE_USER', `Created user ${username} (${role})`);
    alert(`✅ User ${username} created successfully!`);

    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newFullName').value = '';
}

async function addNewEstate() {
    const estateName = document.getElementById('newEstateName').value.trim();
    if (!estateName) return alert("Enter estate name");

    if (!estateList.includes(estateName)) {
        estateList.push(estateName);
        if (supabaseClient) {
            await supabaseClient.from('estates').insert([{ name: estateName }]);
        }
        await logActivity('ADD_ESTATE', `Added estate ${estateName}`);
        document.getElementById('newEstateName').value = '';
        renderEstateDropdown();
        renderSettingsUI();
        alert(`✅ Estate ${estateName} added!`);
    } else {
        alert("Estate already exists!");
    }
}

async function fetchMills() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('estate_mills').select('*').order('id', { ascending: true });
    if (data) estateMills = data;
    renderMillSettingsUI();
}

function renderMillSettingsUI() {
    const millEstateSelect = document.getElementById('millEstateSelect');
    if (millEstateSelect) {
        const selected = millEstateSelect.value;
        millEstateSelect.innerHTML = '';
        estateList.forEach(est => { let opt = document.createElement('option'); opt.value = est; opt.innerText = est; millEstateSelect.appendChild(opt); });
        if (selected && estateList.includes(selected)) millEstateSelect.value = selected;
    }
    const currentEstate = millEstateSelect?.value || estateList[0];
    const millListUi = document.getElementById('millSettingsList');
    if (millListUi) {
        millListUi.innerHTML = '';
        estateMills.filter(m => m.estate_name === currentEstate).forEach(m => {
            millListUi.innerHTML += `<li style="padding:4px; background:#fff; margin-bottom:4px; border:1px solid #cbd5e1; display:flex; justify-content:space-between; border-radius:4px;">
                <span>${m.mill_name}</span>
                <button onclick="removeMill(${m.id})" style="background:#dc2626; color:white; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer;">Del</button>
            </li>`;
        });
    }
}

async function addNewMill() {
    const estateName = document.getElementById('millEstateSelect').value;
    const millName = document.getElementById('newMillName').value.trim();
    if (!millName) return alert("Enter mill name");
    const { error } = await supabaseClient.from('estate_mills').insert([{ estate_name: estateName, mill_name: millName }]);
    if (!error) {
        await logActivity('ADD_MILL', `Added mill ${millName}`, estateName);
        document.getElementById('newMillName').value = '';
        await fetchMills();
        buildTab3MillGrid();
    }
}

async function removeMill(millId) {
    if (!confirmITAction("Mill Supplier")) return;
    const { error } = await supabaseClient.from('estate_mills').delete().eq('id', millId);
    if (!error) { await fetchMills(); buildTab3MillGrid(); }
}

async function fetchEstates() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('estates').select('*').order('id', { ascending: true });
    if (data && data.length > 0) {
        let fetched = data.map(e => e.name);
        let savedOrder = JSON.parse(localStorage.getItem('custom_estate_order'));
        estateList = (savedOrder && Array.isArray(savedOrder)) ? savedOrder.filter(n => fetched.includes(n)) : fetched;
    }
    renderEstateDropdown();
    renderSettingsUI();
}

function handleDragStart(e, index) { draggedEstateIndex = index; e.dataTransfer.effectAllowed = 'move'; }
function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function handleDrop(e, targetIndex) {
    e.preventDefault();
    if (draggedEstateIndex === null || draggedEstateIndex === targetIndex) return;
    const moved = estateList.splice(draggedEstateIndex, 1)[0];
    estateList.splice(targetIndex, 0, moved);
    localStorage.setItem('custom_estate_order', JSON.stringify(estateList));
    renderSettingsUI();
    renderEstateDropdown();
    draggedEstateIndex = null;
}

async function fetchUserProfiles() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('user_profiles').select('*');
    if (data && data.length > 0) userAccounts = data;
}

function renderEstateDropdown(filter = null) {
    const estateSelect = document.getElementById('ladangSelect');
    if (!estateSelect) return;
    estateSelect.innerHTML = '';
    estateList.forEach(est => {
        if (!filter || filter.length === 0 || currentUser?.role === 'admin' || filter.includes(est)) {
            let opt = document.createElement('option'); opt.value = est; opt.innerText = est; estateSelect.appendChild(opt);
        }
    });
}

function renderSettingsUI() {
    const estListUi = document.getElementById('estateSettingsList');
    if (estListUi) {
        estListUi.innerHTML = '';
        estateList.forEach((est, idx) => {
            estListUi.innerHTML += `<li draggable="true" ondragstart="handleDragStart(event, ${idx})" ondragover="handleDragOver(event)" ondrop="handleDrop(event, ${idx})" style="padding:4px 8px; background:#fff; margin-bottom:4px; border:1px dashed #3b82f6; border-radius:4px; display:flex; justify-content:space-between; cursor:grab;">
                <span>☰ ${est}</span>
            </li>`;
        });
    }
    renderMillSettingsUI();
}
