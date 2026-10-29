// =====================================================================
// TAB 4: GROUP SUMMARY   |   TAB 5: MILL SUMMARY
// Both add up all estates for the selected month (automatic, no key-in).
// =====================================================================

async function loadGroupData() {
    const month = S.month, pm = prevMonthOf(month);
    const [entriesRes, reportsRes] = await Promise.all([
        fetchAllRows(() => supabaseClient.from('daily_entries')
            .select('column_id, record_date, value')
            .gte('record_date', dateOf(pm, 1)).lte('record_date', dateOf(month, daysIn(month)))
            .order('record_date', { ascending: true })),
        supabaseClient.from('monthly_reports').select('*').eq('month', month)
    ]);
    // totals[columnId] = { cur, prev, curDays, prevDays }
    const totals = {};
    (entriesRes.data || []).forEach(r => {
        const v = num(r.value);
        const t = totals[r.column_id] || (totals[r.column_id] = { cur: 0, prev: 0, curDays: 0, prevDays: 0 });
        if (String(r.record_date).slice(0, 7) === month) { t.cur += v; if (v > 0) t.curDays++; }
        else { t.prev += v; if (v > 0) t.prevDays++; }
    });
    const reports = {};
    (reportsRes.data || []).forEach(r => { reports[r.estate_name] = r; });
    return { totals, reports, error: entriesRes.error };
}

function sumCols(cols, totals, key) { return cols.reduce((s, c) => s + (totals[c.id]?.[key] || 0), 0); }

async function loadOverallSummary() {
    const box = document.getElementById('summaryContent');
    if (!box || !S.month || !supabaseClient || !S.tablesReady) return;
    box.innerHTML = '<div class="hint">Loading…</div>';
    const { totals, reports } = await loadGroupData();
    const estates = visibleEstates();

    // ---- Rainfall ----
    let rf = `<h4 class="sum-title">RAINFALL (MM) — ${monthLabel(S.month)}</h4>
        <table class="data-table sum-table"><thead><tr>
        <th>ESTATE</th><th>PHASE</th><th class="th-rf-header">THIS MONTH (MM)</th><th class="th-rf-header">RAIN DAYS</th>
        <th>PREV MONTH (MM)</th><th>RAIN DAYS</th></tr></thead><tbody>`;
    estates.forEach(est => {
        const cols = columnsFor(est, 'rainfall', true).filter(c => c.active !== false || totals[c.id]);
        if (!cols.length) {
            rf += `<tr><td class="left"><b>${esc(est)}</b></td><td colspan="5" class="muted">No rainfall phases set up</td></tr>`;
            return;
        }
        cols.forEach((c, i) => {
            const t = totals[c.id] || {};
            rf += `<tr>${i === 0 ? `<td class="left" rowspan="${cols.length}"><b>${esc(est)}</b></td>` : ''}
                <td class="left">${esc(c.name)}</td>
                <td><b>${(t.cur || 0).toFixed(1)}</b></td><td>${t.curDays || 0}</td>
                <td>${(t.prev || 0).toFixed(1)}</td><td>${t.prevDays || 0}</td></tr>`;
        });
    });
    rf += `</tbody></table>`;

    // ---- FFB ----
    let g = { mill: 0, block: 0, bgL: 0, bgT: 0, pay: 0, prev: 0 };
    let ffb = `<h4 class="sum-title">FFB PRODUCTION (MT) — ${monthLabel(S.month)}</h4>
        <table class="data-table sum-table"><thead><tr>
        <th>ESTATE</th><th class="th-ffb-header">BY MILL</th><th class="th-blk-header">BY PHASE / BLOCK</th><th>CHECK</th>
        <th>BUAH GANTUNG<br>LAST MONTH</th><th>BUAH GANTUNG<br>THIS MONTH</th><th class="th-total-header">PAY TO WORKERS</th>
        <th>PREV MONTH</th><th>STATUS</th></tr></thead><tbody>`;
    estates.forEach(est => {
        const mills = columnsFor(est, 'mill', true), blocks = columnsFor(est, 'block', true);
        const m = sumCols(mills, totals, 'cur'), b = sumCols(blocks, totals, 'cur');
        const prev = mills.length ? sumCols(mills, totals, 'prev') : sumCols(blocks, totals, 'prev');
        const r = reports[est] || {};
        const total = mills.length ? m : b;
        const bgL = num(r.buah_gantung_last), bgT = num(r.buah_gantung_this);
        const pay = total - bgL + bgT;
        let check = '<span class="muted">—</span>';
        if (mills.length && blocks.length && (m || b)) {
            check = Math.abs(m - b) < 0.005 ? '<span class="ok">✓</span>' : `<span class="bad">${(b - m).toFixed(2)}</span>`;
        }
        g.mill += m; g.block += b; g.bgL += bgL; g.bgT += bgT; g.pay += pay; g.prev += prev;
        const st = r.status || 'draft';
        ffb += `<tr><td class="left"><b>${esc(est)}</b></td>
            <td>${mills.length ? m.toFixed(2) : '<span class="muted">—</span>'}</td>
            <td>${blocks.length ? b.toFixed(2) : '<span class="muted">—</span>'}</td>
            <td>${check}</td>
            <td>${bgL ? bgL.toFixed(2) : '-'}</td><td>${bgT ? bgT.toFixed(2) : '-'}</td>
            <td><b>${pay.toFixed(2)}</b></td><td>${prev.toFixed(2)}</td>
            <td><span class="status-pill st-${st}">${st.toUpperCase()}</span></td></tr>`;
    });
    ffb += `</tbody><tfoot><tr class="grand-row"><td>GROUP TOTAL</td>
        <td>${g.mill.toFixed(2)}</td><td>${g.block.toFixed(2)}</td><td></td>
        <td>${g.bgL.toFixed(2)}</td><td>${g.bgT.toFixed(2)}</td><td><b>${g.pay.toFixed(2)} MT</b></td><td>${g.prev.toFixed(2)}</td><td></td></tr></tfoot></table>
        <div class="hint screen-only">CHECK = By Phase/Block minus By Mill. ✓ means both forms give the same monthly total.</div>`;

    box.innerHTML = ffb + rf;
}

async function loadMillSummaryBreakdown() {
    const box = document.getElementById('millSummaryContent');
    if (!box || !S.month || !supabaseClient || !S.tablesReady) return;
    box.innerHTML = '<div class="hint">Loading…</div>';
    const { totals } = await loadGroupData();

    // Group mills by name across estates (e.g. "Golden Elite" used by 2 estates = 1 row)
    const estates = visibleEstates().filter(est => columnsFor(est, 'mill', true).length);
    const mills = {}; // key -> { name, perEstate: {est: mt}, total, prev }
    estates.forEach(est => {
        columnsFor(est, 'mill', true).forEach(c => {
            const t = totals[c.id] || {};
            if (c.active === false && !t.cur && !t.prev) return;
            const key = c.name.trim().toLowerCase();
            const m = mills[key] || (mills[key] = { name: c.name.trim(), perEstate: {}, total: 0, prev: 0 });
            m.perEstate[est] = (m.perEstate[est] || 0) + (t.cur || 0);
            m.total += t.cur || 0;
            m.prev += t.prev || 0;
        });
    });
    const rows = Object.values(mills).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const grand = rows.reduce((s, m) => s + m.total, 0);
    const grandPrev = rows.reduce((s, m) => s + m.prev, 0);

    if (!rows.length) { box.innerHTML = `<div class="empty-msg">No mills set up yet.</div>`; return; }

    let h = `<h4 class="sum-title">MILL SUPPLIER — ${monthLabel(S.month)}</h4>
        <div class="table-scroll"><table class="data-table sum-table"><thead><tr><th>MILL / SUPPLIER</th>
        ${estates.map(e => `<th class="th-ffb-header">${esc(e)}</th>`).join('')}
        <th class="th-total-header">TOTAL (MT)</th><th class="th-total-header">%</th><th>PREV MONTH (MT)</th></tr></thead><tbody>`;
    rows.forEach(m => {
        h += `<tr><td class="left"><b>${esc(m.name)}</b></td>
            ${estates.map(e => `<td>${m.perEstate[e] ? m.perEstate[e].toFixed(2) : (e in m.perEstate ? '-' : '')}</td>`).join('')}
            <td><b>${m.total.toFixed(2)}</b></td><td>${grand ? (m.total / grand * 100).toFixed(1) + '%' : '-'}</td>
            <td>${m.prev.toFixed(2)}</td></tr>`;
    });
    h += `</tbody><tfoot><tr class="grand-row"><td>GRAND TOTAL</td>
        ${estates.map(e => `<td>${rows.reduce((s, m) => s + (m.perEstate[e] || 0), 0).toFixed(2)}</td>`).join('')}
        <td><b>${grand.toFixed(2)} MT</b></td><td>${grand ? '100%' : ''}</td><td>${grandPrev.toFixed(2)}</td></tr></tfoot></table></div>
        <div class="hint screen-only">Mills with the same name in different estates are added together.</div>`;
    box.innerHTML = h;
}
