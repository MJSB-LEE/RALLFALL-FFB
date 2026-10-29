// =====================================================================
// Key-in tabs: 1. Rainfall by Phase, 2. FFB by Mill, 3. FFB by Phase/Block
// Every estate has its own column names (Settings -> Column Setup).
// =====================================================================

let loadToken = 0;

async function loadMonthData() {
    const token = ++loadToken;
    S.entries = {};
    S.dirty.clear();
    S.reportDirty = false;
    S.report = { estate_name: S.estate, month: S.month, status: 'draft', mill_estimates: {}, _new: true };
    S.prevReport = null;

    if (S.estate && S.month && supabaseClient && S.tablesReady) {
        const pm = prevMonthOf(S.month);
        const start = dateOf(pm, 1), end = dateOf(S.month, daysIn(S.month));
        const [entriesRes, reportsRes] = await Promise.all([
            fetchAllRows(() => supabaseClient.from('daily_entries')
                .select('column_id, record_date, value')
                .eq('estate_name', S.estate).gte('record_date', start).lte('record_date', end)
                .order('record_date', { ascending: true })),
            supabaseClient.from('monthly_reports').select('*').eq('estate_name', S.estate).in('month', [S.month, pm])
        ]);
        if (token !== loadToken) return; // user switched estate/month while loading

        (entriesRes.data || []).forEach(r => {
            if (r.value !== null && r.value !== undefined) S.entries[`${r.column_id}|${String(r.record_date).slice(0, 10)}`] = num(r.value);
        });
        const reps = reportsRes.data || [];
        const cur = reps.find(r => r.month === S.month);
        if (cur) S.report = { ...cur, mill_estimates: cur.mill_estimates || {} };
        S.prevReport = reps.find(r => r.month === pm) || null;

        // Buah Gantung (Last Month) = previous month's Buah Gantung (This Month), if not keyed in yet
        if ((S.report.buah_gantung_last === null || S.report.buah_gantung_last === undefined)
            && S.prevReport && S.prevReport.buah_gantung_this !== null && S.prevReport.buah_gantung_this !== undefined) {
            S.report.buah_gantung_last = S.prevReport.buah_gantung_this;
            S.report._needsSave = true;
        }
    }
    renderAllEntryTabs();
}

// ---------- Number helpers ----------
function cellVal(colId, month, d) { return S.entries[`${colId}|${dateOf(month, d)}`]; }
function dayTotal(cols, month, d) { return cols.reduce((s, c) => s + (cellVal(c.id, month, d) || 0), 0); }
function colMonthTotal(col, month) {
    let s = 0; const n = daysIn(month);
    for (let d = 1; d <= n; d++) s += cellVal(col.id, month, d) || 0;
    return s;
}
function monthTotal(cols, month) { return cols.reduce((s, c) => s + colMonthTotal(c, month), 0); }

// Show "to date" up to today for the current month, all days for past months.
function lastToDateDay(cols) {
    const n = daysIn(S.month);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
    const thisMonth = today.slice(0, 7);
    if (S.month < thisMonth) return n;
    let last = 0;
    for (let d = 1; d <= n; d++) if (cols.some(c => cellVal(c.id, S.month, d) !== undefined)) last = d;
    if (S.month === thisMonth) last = Math.max(last, parseInt(today.slice(8, 10), 10));
    return last;
}

function isLocked() {
    const st = S.report?.status || 'draft';
    if (roleAtLeast('admin')) return false;
    if (st === 'approved') return true;
    if (st === 'submitted') return !roleAtLeast('manager');
    return false;
}

function inputHtml(colId, d, dp = 2) {
    const v = cellVal(colId, S.month, d);
    return `<input type="number" step="any" inputmode="decimal" class="cell-in" data-col="${colId}" data-day="${d}"
        value="${v === undefined ? '' : v.toFixed(dp)}" ${isLocked() ? 'disabled' : ''}>`;
}

function emptyColumnsMsg(category, colspan = 1) {
    const adminHint = roleAtLeast('admin')
        ? `Go to <b>⚙️ Settings → Column Setup</b> to add them.`
        : `Ask your admin to set them up in Settings.`;
    const optional = category === 'block' ? ' (optional — skip if this estate does not record FFB by phase/block)' : '';
    return `<tbody><tr><td colspan="${colspan}" class="empty-msg">No <b>${CATEGORIES[category].label}</b> columns set up for <b>${esc(S.estate)}</b>${optional}. ${adminHint}</td></tr></tbody>`;
}

function renderAllEntryTabs() {
    renderRainfall();
    renderFfb('mill');
    renderFfb('block');
    renderStatus();
    renderPrintParts();
    updateUnsavedNote();
}

// =====================================================================
// TAB 1: RAINFALL BY PHASE
// =====================================================================
function renderRainfall() {
    const tbl = document.getElementById('tblRainfall');
    if (!tbl) return;
    const cols = columnsFor(S.estate, 'rainfall');
    if (!S.estate || !cols.length) { tbl.innerHTML = emptyColumnsMsg('rainfall'); return; }
    const n = daysIn(S.month);

    let h = `<thead><tr><th rowspan="2" class="date-col">DATE</th>
        ${cols.map(c => `<th colspan="3" class="th-rf-header">${esc(c.name)}</th>`).join('')}</tr>
        <tr>${cols.map(() => `<th class="th-rf-header">TODAY</th><th class="th-rf-header">TODATE</th><th class="th-rf-header">PREV<br>MONTH</th>`).join('')}</tr></thead><tbody>`;
    for (let d = 1; d <= n; d++) {
        h += `<tr><td class="date-col"><b>${d}</b></td>${cols.map(c => `
            <td>${inputHtml(c.id, d, 1)}</td>
            <td class="readonly-cell" id="rf_td_${c.id}_${d}"></td>
            <td class="prev-cell" id="rf_pm_${c.id}_${d}"></td>`).join('')}</tr>`;
    }
    h += `</tbody><tfoot>
        <tr><td class="foot-label">Total (mm)</td>${cols.map(c => `<td></td><td class="total-cell" id="rf_tot_${c.id}"></td><td class="total-cell" id="rf_ptot_${c.id}"></td>`).join('')}</tr>
        <tr><td class="foot-label">Total Days</td>${cols.map(c => `<td></td><td class="total-cell" id="rf_days_${c.id}"></td><td class="total-cell" id="rf_pdays_${c.id}"></td>`).join('')}</tr>
    </tfoot>`;
    tbl.innerHTML = h;
    recalcRainfall();
}

function recalcRainfall() {
    const cols = columnsFor(S.estate, 'rainfall');
    if (!cols.length) return;
    const n = daysIn(S.month), pm = prevMonthOf(S.month), pn = daysIn(pm);
    const lastDay = lastToDateDay(cols);
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

    cols.forEach(c => {
        let cum = 0, days = 0, pcum = 0, pdays = 0;
        const prevCum = [0];
        for (let d = 1; d <= pn; d++) {
            const v = cellVal(c.id, pm, d) || 0;
            pcum += v; if (v > 0) pdays++;
            prevCum[d] = pcum;
        }
        for (let d = 1; d <= n; d++) {
            const v = cellVal(c.id, S.month, d) || 0;
            cum += v; if (v > 0) days++;
            set(`rf_td_${c.id}_${d}`, d <= lastDay ? fmt(cum, 1) : '');
            set(`rf_pm_${c.id}_${d}`, fmt(prevCum[Math.min(d, pn)], 1));
        }
        set(`rf_tot_${c.id}`, `${cum.toFixed(1)} MM`);
        set(`rf_ptot_${c.id}`, `${pcum.toFixed(1)} MM`);
        set(`rf_days_${c.id}`, `${days} Days`);
        set(`rf_pdays_${c.id}`, `${pdays} Days`);
    });
}

// =====================================================================
// TAB 2 & 3: FFB BY MILL / FFB BY PHASE-BLOCK (same grid layout)
// =====================================================================
function renderFfb(category) {
    const p = category; // id prefix
    const tbl = document.getElementById(category === 'mill' ? 'tblMill' : 'tblBlock');
    if (!tbl) return;
    const cols = columnsFor(S.estate, category);
    if (!S.estate || !cols.length) {
        tbl.innerHTML = emptyColumnsMsg(category);
        renderBelowGrid(category);
        return;
    }
    const n = daysIn(S.month);
    const head = category === 'mill' ? 'th-ffb-header' : 'th-blk-header';

    let h = `<thead><tr><th rowspan="2" class="date-col">DATE</th>
        ${cols.map(c => `<th class="${head} col-name">${esc(c.name)}</th>`).join('')}
        <th colspan="2" class="th-total-header">GRAND TOTAL</th>
        <th rowspan="2" class="th-total-header">PREV<br>MONTH</th></tr>
        <tr>${cols.map(() => `<th class="${head}">TODAY</th>`).join('')}
        <th class="th-total-header">TODAY</th><th class="th-total-header">TODATE</th></tr></thead><tbody>`;
    for (let d = 1; d <= n; d++) {
        h += `<tr><td class="date-col"><b>${d}</b></td>
            ${cols.map(c => `<td>${inputHtml(c.id, d)}</td>`).join('')}
            <td class="readonly-cell" id="${p}_gt_${d}"></td>
            <td class="readonly-cell" id="${p}_td_${d}"></td>
            <td class="prev-cell" id="${p}_pm_${d}"></td></tr>`;
    }
    h += `</tbody><tfoot><tr><td class="foot-label">Total</td>
        ${cols.map(c => `<td class="total-cell" id="${p}_ctot_${c.id}"></td>`).join('')}
        <td class="total-cell" id="${p}_tot1"></td><td class="total-cell" id="${p}_tot2"></td><td class="total-cell" id="${p}_ptot"></td></tr></tfoot>`;
    tbl.innerHTML = h;
    recalcFfb(category);
}

function recalcFfb(category) {
    const p = category;
    const cols = columnsFor(S.estate, category);
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    if (cols.length) {
        const n = daysIn(S.month), pm = prevMonthOf(S.month), pn = daysIn(pm);
        const lastDay = lastToDateDay(cols);
        const millCols = category === 'block' ? columnsFor(S.estate, 'mill') : [];

        const prevCum = [0]; let pc = 0;
        for (let d = 1; d <= pn; d++) { pc += dayTotal(cols, pm, d); prevCum[d] = pc; }

        let cum = 0;
        for (let d = 1; d <= n; d++) {
            const t = dayTotal(cols, S.month, d);
            cum += t;
            const gt = document.getElementById(`${p}_gt_${d}`);
            if (gt) {
                gt.textContent = d <= lastDay ? fmt(t) : '';
                // Tab 3: flag days where phase/block total differs from mill total
                if (millCols.length) {
                    const mt = dayTotal(millCols, S.month, d);
                    const diff = Math.abs(mt - t) > 0.005 && (mt || t);
                    gt.classList.toggle('mismatch', !!diff);
                    gt.title = diff ? `By Mill total for day ${d}: ${mt.toFixed(2)} MT` : '';
                }
            }
            set(`${p}_td_${d}`, d <= lastDay ? fmt(cum) : '');
            set(`${p}_pm_${d}`, fmt(prevCum[Math.min(d, pn)]));
        }
        cols.forEach(c => set(`${p}_ctot_${c.id}`, fmt(colMonthTotal(c, S.month))));
        set(`${p}_tot1`, `${cum.toFixed(2)} MT`);
        set(`${p}_tot2`, `${cum.toFixed(2)} MT`);
        set(`${p}_ptot`, `${pc.toFixed(2)} MT`);
    }
    renderBelowGrid(category);
}

// Monthly box: Total FFB, Buah Gantung, Pay to Workers (+ mill % table on Tab 2, check on Tab 3)
function renderBelowGrid(category) {
    const millCols = columnsFor(S.estate, 'mill');
    const blockCols = columnsFor(S.estate, 'block');
    const cols = category === 'mill' ? millCols : blockCols;
    const total = monthTotal(cols, S.month);
    const r = S.report || {};
    const bgLast = num(r.buah_gantung_last), bgThis = num(r.buah_gantung_this);
    const pay = total - bgLast + bgThis;
    const editable = category === 'mill' && !isLocked();
    const bgInput = (field, v) => editable
        ? `<input type="number" step="any" inputmode="decimal" class="bg-in" data-field="${field}" value="${v === null || v === undefined ? '' : v}">`
        : (v ? num(v).toFixed(2) + ' MT' : '');

    const monthlyHtml = !cols.length ? '' : `<table class="data-table mini-table">
        <tr><td class="lbl">Total FFB (This Month) =</td><td class="val"><b>${total.toFixed(2)} MT</b></td></tr>
        <tr><td class="lbl">Buah Gantung (Last Month) =</td><td class="val">${bgInput('buah_gantung_last', r.buah_gantung_last)}</td></tr>
        <tr><td class="lbl">Buah Gantung (This Month) =</td><td class="val">${bgInput('buah_gantung_this', r.buah_gantung_this)}</td></tr>
        <tr><td class="lbl">Total Pay to Workers (This Month) =</td><td class="val"><b>${pay.toFixed(2)} MT</b></td></tr>
    </table>
    ${category === 'block' ? '<div class="hint screen-only">Buah Gantung is keyed in on Tab 2.</div>' : ''}`;

    if (category === 'mill') {
        document.getElementById('millMonthlyPanel').innerHTML = monthlyHtml;
        const est = r.mill_estimates || {};
        document.getElementById('millPercentPanel').innerHTML = !millCols.length ? '' : `<table class="data-table mini-table pct-table">
            <thead><tr><th rowspan="2">MILL</th><th>ESTIMATE</th><th colspan="2">ACTUAL</th></tr>
            <tr><th>%</th><th>%</th><th>MT</th></tr></thead><tbody>
            ${millCols.map(c => {
                const mt = colMonthTotal(c, S.month);
                const e = est[c.id];
                return `<tr><td class="left">${esc(c.name)}</td>
                    <td>${editable ? `<input type="number" step="any" class="est-in" data-col="${c.id}" value="${e === undefined || e === null ? '' : e}">` : (e ? e + '%' : '')}</td>
                    <td>${total && mt ? Math.round(mt / total * 100) + '%' : ''}</td><td>${mt ? mt.toFixed(2) : ''}</td></tr>`;
            }).join('')}
            <tr class="grand-row"><td>GRAND TOTAL</td><td></td><td>${total ? '100%' : ''}</td><td><b>${total.toFixed(2)} MT</b></td></tr>
            </tbody></table>`;
    } else {
        document.getElementById('blockMonthlyPanel').innerHTML = monthlyHtml;
        const millTotal = monthTotal(millCols, S.month);
        const diff = total - millTotal;
        const ok = Math.abs(diff) < 0.005;
        document.getElementById('blockCheckPanel').innerHTML = (!cols.length || !millCols.length) ? '' : `
            <table class="data-table mini-table screen-only">
                <tr><td class="lbl">Total by Mill (Tab 2)</td><td class="val">${millTotal.toFixed(2)} MT</td></tr>
                <tr><td class="lbl">Total by Phase / Block (Tab 3)</td><td class="val">${total.toFixed(2)} MT</td></tr>
                <tr class="${ok ? 'check-ok' : 'check-bad'}"><td class="lbl">Difference</td>
                    <td class="val"><b>${ok ? '✓ Match' : diff.toFixed(2) + ' MT'}</b></td></tr>
            </table>
            <div class="hint screen-only">Days highlighted in orange have a different total from Tab 2.</div>`;
    }
}

// ---------- Typing into the grids ----------
document.addEventListener('input', e => {
    const t = e.target;
    if (t.classList.contains('cell-in')) {
        const col = S.columns.find(c => c.id == t.dataset.col);
        const key = `${t.dataset.col}|${dateOf(S.month, +t.dataset.day)}`;
        if (t.value === '' || isNaN(parseFloat(t.value))) delete S.entries[key];
        else S.entries[key] = parseFloat(t.value);
        S.dirty.add(key);
        if (col?.category === 'rainfall') recalcRainfall();
        else { recalcFfb('mill'); recalcFfb('block'); }
        updateUnsavedNote();
    } else if (t.classList.contains('bg-in')) {
        S.report[t.dataset.field] = t.value === '' ? null : parseFloat(t.value);
        S.reportDirty = true;
        refreshMonthlyNumbers();
        updateUnsavedNote();
    } else if (t.classList.contains('est-in')) {
        S.report.mill_estimates = { ...(S.report.mill_estimates || {}), [t.dataset.col]: t.value === '' ? null : parseFloat(t.value) };
        S.reportDirty = true;
        updateUnsavedNote();
    }
});

// Re-render the monthly boxes without losing focus of the input being typed in
function refreshMonthlyNumbers() {
    const active = document.activeElement;
    const field = active?.dataset?.field;
    renderBelowGrid('mill');
    renderBelowGrid('block');
    if (field) {
        const again = document.querySelector(`.bg-in[data-field="${field}"]`);
        if (again) { again.focus(); const v = again.value; again.value = ''; again.value = v; }
    }
}

// Enter / arrow keys move between days like Excel; stop arrows changing the number
document.addEventListener('keydown', e => {
    const t = e.target;
    if (!t.classList?.contains('cell-in')) return;
    let dDay = 0;
    if (e.key === 'Enter' || e.key === 'ArrowDown') dDay = 1;
    else if (e.key === 'ArrowUp') dDay = -1;
    else return;
    e.preventDefault();
    const table = t.closest('table');
    const inputs = [...table.querySelectorAll('.cell-in')];
    const sameCol = inputs.filter(i => i.dataset.col === t.dataset.col);
    const next = sameCol.find(i => +i.dataset.day === +t.dataset.day + dDay);
    if (next) { next.focus(); next.select(); }
});
document.addEventListener('wheel', e => { if (e.target.classList?.contains('cell-in') && document.activeElement === e.target) e.target.blur(); }, { passive: true });

function updateUnsavedNote() {
    const el = document.getElementById('unsavedNote');
    if (el) el.style.display = (S.dirty.size || S.reportDirty) ? 'inline' : 'none';
}
window.addEventListener('beforeunload', e => {
    if (S.dirty.size || S.reportDirty) { e.preventDefault(); e.returnValue = ''; }
});

// =====================================================================
// SAVE / SUBMIT / APPROVE
// =====================================================================
function reportPayload() {
    const r = S.report;
    return {
        estate_name: S.estate, month: S.month,
        buah_gantung_last: r.buah_gantung_last ?? null,
        buah_gantung_this: r.buah_gantung_this ?? null,
        mill_estimates: r.mill_estimates || {},
        status: r.status || 'draft',
        submitted_by: r.submitted_by ?? null, submitted_at: r.submitted_at ?? null,
        approved_by: r.approved_by ?? null, approved_at: r.approved_at ?? null
    };
}

async function saveReport() {
    const { error } = await supabaseClient.from('monthly_reports').upsert([reportPayload()], { onConflict: 'estate_name,month' });
    if (error) throw error;
    S.report._new = false; S.report._needsSave = false; S.reportDirty = false;
}

async function saveToCloud(silent = false) {
    if (!S.estate || !S.month) { alert('Select Estate & Month.'); return false; }
    if (!supabaseClient || !S.tablesReady) { alert('Database is not ready. See the message at the top of the page.'); return false; }
    if (isLocked()) { if (!silent) alert('🔒 This month is locked (submitted/approved). Ask a manager to return it to draft.'); return false; }

    const user = currentUser?.username || 'SYSTEM';
    const now = new Date().toISOString();
    const rows = [...S.dirty].map(k => {
        const [cid, date] = k.split('|');
        return { column_id: +cid, record_date: date, estate_name: S.estate, value: S.entries[k] ?? null, updated_by: user, updated_at: now };
    });
    try {
        for (let i = 0; i < rows.length; i += 500) {
            const { error } = await supabaseClient.from('daily_entries').upsert(rows.slice(i, i + 500), { onConflict: 'column_id,record_date' });
            if (error) throw error;
        }
        if (S.reportDirty || S.report._needsSave) await saveReport();
    } catch (err) {
        alert('❌ Save failed: ' + (err.message || err));
        return false;
    }
    S.dirty.clear();
    updateUnsavedNote();
    if (rows.length || !silent) await logActivity('SAVE_DATA', `Saved ${monthLabel(S.month)} (${rows.length} cells)`, S.estate);
    if (!silent) toast('✅ Saved');
    return true;
}

async function setStatus(status, extra, action, message) {
    const backup = { ...S.report };
    Object.assign(S.report, { status }, extra);
    try { await saveReport(); }
    catch (err) { S.report = backup; alert('❌ Failed: ' + (err.message || err)); return; }
    await logActivity(action, `${monthLabel(S.month)}`, S.estate);
    renderAllEntryTabs();
    toast(message);
}

async function submitForApproval() {
    if (!confirm(`Submit ${S.estate} — ${monthLabel(S.month)} for approval?\nUsers cannot edit after submitting.`)) return;
    if (!(await saveToCloud(true))) return;
    await setStatus('submitted', { submitted_by: displayName(currentUser), submitted_at: new Date().toISOString() },
        'SUBMIT_APPROVAL', '🔒 Submitted for approval');
}
async function approveReport() {
    if (!roleAtLeast('manager')) return;
    if (S.dirty.size || S.reportDirty) { if (!(await saveToCloud(true))) return; }
    if (!confirm(`Approve ${S.estate} — ${monthLabel(S.month)}?`)) return;
    await setStatus('approved', { approved_by: displayName(currentUser), approved_at: new Date().toISOString() },
        'APPROVE', '✅ Approved');
}
async function reopenReport() {
    if (!roleAtLeast('manager')) return;
    if (!confirm(`Return ${S.estate} — ${monthLabel(S.month)} to draft so it can be edited again?`)) return;
    await setStatus('draft', { approved_by: null, approved_at: null }, 'RETURN_TO_DRAFT', '↩️ Returned to draft');
}

function renderStatus() {
    const info = document.getElementById('statusInfo');
    if (!info) return;
    const r = S.report || {};
    const st = r.status || 'draft';
    let txt = `<span class="status-pill st-${st}">${st.toUpperCase()}</span>`;
    if (st !== 'draft' && r.submitted_by) txt += ` Submitted by <b>${esc(r.submitted_by)}</b> · ${formatDateTime(r.submitted_at)}`;
    if (st === 'approved' && r.approved_by) txt += ` &nbsp;|&nbsp; Approved by <b>${esc(r.approved_by)}</b> · ${formatDateTime(r.approved_at)}`;
    if (isLocked()) txt += ` &nbsp;🔒 <i>Locked</i>`;
    info.innerHTML = txt;

    const show = (id, on) => { const b = document.getElementById(id); if (b) b.style.display = on ? '' : 'none'; };
    show('btnSave', !isLocked());
    show('btnSubmit', st === 'draft');
    show('btnApprove', st === 'submitted' && roleAtLeast('manager'));
    show('btnReopen', st !== 'draft' && roleAtLeast('manager'));
}

function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
}
