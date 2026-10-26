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

const IT_DELETE_PASSWORD = "ITREF2026"; 

let estateList = ["STY", "Klagan PH1", "Kars PH1/2/4", "Kars PH3", "Sg Millian 1", "Sg Millian 2", "Sg Millian 3", "Labuk", "TUNGKU"];
let estateMills = []; 
let userAccounts = [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let draggedEstateIndex = null;

// Utility Helper Functions
function formatDateToDDMMYYYY(dateInput) {
    if (!dateInput) return '-';
    let parts = dateInput.toString().split('T')[0].split('-');
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateInput;
}

function confirmITAction(actionName) {
    let confirmWarning = confirm(`⚠️ WARNING: Are you sure you want to delete ${actionName}?`);
    if (!confirmWarning) return false;
    let pass = prompt(`IT SECURITY KEY REQUIRED:`);
    return pass === IT_DELETE_PASSWORD;
}
