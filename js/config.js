// Supabase Configuration
const SUPABASE_URL = 'https://tiwulxrorrmyxtosvzkw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_W4-5_riBQWAUBPVtgX8Pcw_WCRET_KF';

let supabaseClient;
try {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) {
    console.error("Failed to initialize Supabase client:", e);
}

const CATEGORIES = {
    rainfall: { label: 'Rainfall Phases',   tab: 'tabRainfall', example: 'e.g. Styland PH1, Kapor, Muanad' },
    mill:     { label: 'Mills',             tab: 'tabMill',     example: 'e.g. Golden Elite, Sungai Ruku' },
    block:    { label: 'FFB Phase / Block', tab: 'tabBlock',    example: 'e.g. BLK 1/2/3, PH 09, Riparian' }
};
const ROLE_RANK = { user: 1, manager: 2, admin: 3 };

// App state
const S = {
    estates: [],          // [{ id, name, sort_order }]
    columns: [],          // estate_columns rows (all estates)
    users: [],            // user_profiles rows
    estate: '',
    month: '',            // 'YYYY-MM'
    entries: {},          // `${columnId}|${YYYY-MM-DD}` -> number (current + previous month, current estate)
    dirty: new Set(),     // keys of entries changed since last save
    report: null,         // monthly_reports row for current estate+month
    prevReport: null,
    reportDirty: false,
    tablesReady: true
};
let currentUser = null;
try { currentUser = JSON.parse(localStorage.getItem('currentUser')) || null; } catch (e) { currentUser = null; }

// ---------- Helpers ----------
function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function fmt(n, dp = 2) { return n ? Number(n).toFixed(dp) : '-'; }
function daysIn(month) { const [y, m] = month.split('-').map(Number); return new Date(y, m, 0).getDate(); }
function prevMonthOf(month) {
    const [y, m] = month.split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
function dateOf(month, d) { return `${month}-${String(d).padStart(2, '0')}`; }
function monthLabel(month) {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'short' }) + '-' + String(y).slice(2);
}
function formatDateTime(ts) {
    if (!ts) return '-';
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(ts));
}
function roleAtLeast(role) { return (ROLE_RANK[currentUser?.role] || 0) >= ROLE_RANK[role]; }
function displayName(u) { return u?.full_name || u?.username || ''; }

// Columns of one estate + category, in order. includeHidden for history/summary use.
function columnsFor(estate, category, includeHidden = false) {
    return S.columns
        .filter(c => c.estate_name === estate && c.category === category && (includeHidden || c.active !== false))
        .sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
}

// Supabase returns max 1000 rows per request, so page through.
async function fetchAllRows(buildQuery) {
    const pageSize = 1000;
    let all = [], from = 0;
    while (true) {
        const { data, error } = await buildQuery().range(from, from + pageSize - 1);
        if (error) return { data: all, error };
        all = all.concat(data || []);
        if (!data || data.length < pageSize) break;
        from += pageSize;
    }
    return { data: all, error: null };
}

function startMalaysiaClock() {
    const clockElem = document.getElementById('realTimeClock');
    const tick = () => {
        if (!clockElem) return;
        const options = { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
        clockElem.innerText = `MYT: ${new Intl.DateTimeFormat('en-MY', options).format(new Date())}`;
    };
    tick();
    setInterval(tick, 1000);
}
