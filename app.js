const FIREBASE_DB_URL = "https://mmd-live-default-rtdb.europe-west1.firebasedatabase.app";
firebase.initializeApp({ databaseURL: FIREBASE_DB_URL });
const db = firebase.database();

let sessionUser = null; let currentAuthTab = 'login';
let tagesZaehler = 1; let aktuellerFallKosten = 0; let anzahlVerletzungenFall = 1;
let fallMaterial = {}; let daten = { patienten: 0, verletzungen: 0, ausgaben: 0 };
let mySessionRef = null;
let cachedUsers = {};
let cachedExams = {};
let cachedSubmissions = {};
let cachedExamOrder = [];
let allLinkCategories = [];
let allCmdCategories = [];
let activeExam = null;
let activeExamTimerInterval = null;
let activeExamSecondsElapsed = 0;

let defaultRoles = {
    masteradmin: { id: 'masteradmin', name: 'Master-Admin', color: '#eab308', icon: '👑', isSystem: true, isAdmin: true, isMasterAdmin: true, canDelete: true, isInstructor: true, canManageInstructors: true, canPostNews: true, allowedLinkKats: {}, allowedCmdKats: {} },
    admin: { id: 'admin', name: 'Admin', color: '#f59e0b', icon: '🛡️', isSystem: true, isAdmin: true, isMasterAdmin: false, canDelete: true, isInstructor: true, canManageInstructors: true, canPostNews: true, allowedLinkKats: {}, allowedCmdKats: {} },
    ausbildungsleitung: { id: 'ausbildungsleitung', name: 'Ausbildungsleitung', color: '#c084fc', icon: '⚙️', isSystem: true, isAdmin: false, isMasterAdmin: false, canDelete: false, isInstructor: true, canManageInstructors: true, canPostNews: true, allowedLinkKats: { 'Ausbildung': true, 'Luftrettung': true, 'MD Intern': true, 'Allgemein': true }, allowedCmdKats: { 'Ausbildung': true, 'T-Codes': true, 'Abkürzungen & Dokumente': true } },
    ausbilder: { id: 'ausbilder', name: 'Ausbilder', color: '#8b5cf6', icon: '🎓', isSystem: true, isAdmin: false, isMasterAdmin: false, canDelete: false, isInstructor: true, canManageInstructors: false, canPostNews: false, allowedLinkKats: { 'Ausbildung': true, 'MD Intern': true, 'Allgemein': true }, allowedCmdKats: { 'Ausbildung': true, 'T-Codes': true, 'Abkürzungen & Dokumente': true } },
    ehk: { id: 'ehk', name: 'EHK-Ausbilder', color: '#10b981', icon: '🩺', isSystem: true, isAdmin: false, isMasterAdmin: false, canDelete: false, isInstructor: true, canManageInstructors: false, canPostNews: false, allowedLinkKats: { 'EHK': true, 'MD Intern': true, 'Allgemein': true }, allowedCmdKats: { 'EHK': true, 'T-Codes': true, 'Abkürzungen & Dokumente': true } },
    cls: { id: 'cls', name: 'CLS-Ausbilder', color: '#06b6d4', icon: '💉', isSystem: true, isAdmin: false, isMasterAdmin: false, canDelete: false, isInstructor: true, canManageInstructors: false, canPostNews: false, allowedLinkKats: { 'CLS': true, 'MD Intern': true, 'Allgemein': true }, allowedCmdKats: { 'CLS': true, 'T-Codes': true, 'Abkürzungen & Dokumente': true } },
    personal: { id: 'personal', name: 'Personalabteilung', color: '#3b82f6', icon: '📋', isSystem: true, isAdmin: false, isMasterAdmin: false, canDelete: false, isInstructor: false, canManageInstructors: false, canPostNews: false, allowedLinkKats: { 'Personalabteilung': true, 'MD Intern': true, 'Allgemein': true }, allowedCmdKats: { 'Personalabteilung': true, 'T-Codes': true, 'Abkürzungen & Dokumente': true } },
    psychologie: { id: 'psychologie', name: 'Psychologie', color: '#ec4899', icon: '🧠', isSystem: true, isAdmin: false, isMasterAdmin: false, canDelete: false, isInstructor: false, canManageInstructors: false, canPostNews: false, allowedLinkKats: { 'Psychologie': true, 'MD Intern': true, 'Allgemein': true }, allowedCmdKats: { 'Psychologie': true, 'T-Codes': true, 'Abkürzungen & Dokumente': true } },
    luftrettung: { id: 'luftrettung', name: 'Luftrettung', color: '#0284c7', icon: '🚁', isSystem: true, isAdmin: false, isMasterAdmin: false, canDelete: false, isInstructor: false, canManageInstructors: false, canPostNews: false, allowedLinkKats: { 'Luftrettung': true, 'MD Intern': true, 'Allgemein': true }, allowedCmdKats: { 'T-Codes': true, 'Abkürzungen & Dokumente': true } },
    mitarbeiter: { id: 'mitarbeiter', name: 'Mitarbeiter', color: '#64748b', icon: '👨‍⚕️', isSystem: true, isAdmin: false, isMasterAdmin: false, canDelete: false, isInstructor: false, canManageInstructors: false, canPostNews: false, allowedLinkKats: { 'MD Intern': true, 'Allgemein': true }, allowedCmdKats: { 'T-Codes': true, 'Abkürzungen & Dokumente': true } }
};
let cachedRoles = Object.assign({}, defaultRoles);

let defaultGuideData = {
    tenCodes: [
        { id: "tc_1", code: "10-1", desc: "Auf Anfahrt", color: "var(--warning)" },
        { id: "tc_2", code: "10-2", desc: "Am Einsatzort", color: "var(--warning)" },
        { id: "tc_3", code: "10-3", desc: "Weg ins MD", color: "var(--warning)" },
        { id: "tc_4", code: "10-4", desc: "Verstanden, Ende", color: "var(--success)" },
        { id: "tc_5", code: "10-5", desc: "Einsatz Beendet", color: "var(--success)" },
        { id: "tc_6", code: "10-6", desc: "Auf Zuteilung", color: "var(--primary)" },
        { id: "tc_7", code: "10-7", desc: "Auf Bereitschaft", color: "var(--primary)" },
        { id: "tc_8", code: "10-8", desc: "Statusabfrage", color: "var(--primary)" },
        { id: "tc_9", code: "10-9", desc: "Funkspruch wiederholen", color: "var(--text-main)" },
        { id: "tc_10", code: "10-10", desc: "Weiterer RTW benötigt", color: "var(--warning)" },
        { id: "tc_11", code: "10-11", desc: "Im Dienst", color: "var(--success)" },
        { id: "tc_12", code: "10-12", desc: "Dienstende", color: "var(--danger)" },
        { id: "tc_13", code: "10-20", desc: "Aktives Schussgefecht", color: "var(--danger)" },
        { id: "tc_14", code: "10-19", desc: "Abholung benötigt", color: "var(--warning)" },
        { id: "tc_15", code: "11-44", desc: "RTW von PD/USMS benötigt", color: "var(--danger)" },
        { id: "tc_16", code: "11-99", desc: "Medic in Gefahr (Code Red)", color: "var(--danger)" }
    ],
    statusCodes: [
        { id: "sc_1", code: "1", desc: "Ausbildung", color: "var(--primary)" },
        { id: "sc_2", code: "2", desc: "verfügbar", color: "var(--success)" },
        { id: "sc_3", code: "3", desc: "In Pause", color: "var(--warning)" },
        { id: "sc_4", code: "4", desc: "Psychologie", color: "var(--primary)" },
        { id: "sc_5", code: "5", desc: "Besprechung", color: "var(--text-main)" }
    ],
    streifen: [
        { id: "st_1", code: "1", desc: "Streifen", color: "var(--primary)" },
        { id: "st_2", code: "2", desc: "Luftrettung", color: "var(--primary)" },
        { id: "st_3", code: "3", desc: "Sonderstreife", color: "var(--primary)" },
        { id: "st_4", code: "4", desc: "Bereitschaft", color: "var(--primary)" }
    ],
    keineRechnung: [
        { id: "kr_1", name: "Staatliche Fraktionen", note: "(SAPD, USMS, DOJ & SAMD)", desc: "Im Dienst wird keine Rechnung ausgestellt" },
        { id: "kr_2", name: "Mechaniker", note: "(Benny´s, Redfield & Roxwood Tuning)", desc: "Im Dienst wird keine Rechnung ausgestellt" },
        { id: "kr_3", name: "Security C77 / Bahamas / Casino", note: "", desc: "Im Dienst wird keine Rechnung ausgestellt" }
    ]
};
let cachedGuideData = Object.assign({}, defaultGuideData);

function getUserRolesList(user) {
    if (!user) return [];
    let list = [];
    if (user.roles) {
        if (Array.isArray(user.roles)) {
            list = [...user.roles];
        } else if (typeof user.roles === 'object') {
            list = Object.keys(user.roles).filter(rId => user.roles[rId] === true);
        }
    }
    if (list.includes('superadmin')) {
        list = list.filter(r => r !== 'superadmin');
        if (!list.includes('masteradmin')) list.unshift('masteradmin');
    }
    const vClean = (user.vorname || '').trim().toLowerCase();
    const nClean = (user.nachname || '').trim().toLowerCase();
    if (vClean === "tim" && nClean === "sanddorn") {
        if (!list.includes('masteradmin')) list.unshift('masteradmin');
    }
    if (user.isMasterAdmin && !list.includes('masteradmin')) {
        list.unshift('masteradmin');
    } else if (user.isAdmin && !list.includes('admin') && !list.includes('masteradmin')) {
        list.push('admin');
    }
    if (user.canManageInstructors && !list.includes('ausbildungsleitung')) {
        list.push('ausbildungsleitung');
    } else if (user.isInstructor && !list.includes('ausbilder') && !list.includes('ausbildungsleitung')) {
        list.push('ausbilder');
    }
    return list;
}

function hasUserRole(user, roleId) {
    return getUserRolesList(user).includes(roleId);
}

function getUserEffectivePermissions(user) {
    if (!user) {
        return {
            isAdmin: false, isMasterAdmin: false, canDelete: false,
            isInstructor: false, canManageInstructors: false, canPostNews: false,
            canSeeLinks: true, canSeeCommands: true
        };
    }
    const roleIds = getUserRolesList(user);
    let isAdmin = user.isAdmin === true;
    let isMasterAdmin = user.isMasterAdmin === true;
    let canDelete = user.canDelete === true;
    let isInstructor = user.isInstructor === true;
    let canManageInstructors = user.canManageInstructors === true;
    let canPostNews = user.canPostNews === true;
    let canSeeLinks = user.canSeeLinks !== false;
    let canSeeCommands = user.canSeeCommands !== false;

    roleIds.forEach(rId => {
        const role = cachedRoles[rId] || (rId === 'superadmin' ? cachedRoles['masteradmin'] : null);
        if (role) {
            if (role.isAdmin) isAdmin = true;
            if (role.isMasterAdmin) isMasterAdmin = true;
            if (role.canDelete) canDelete = true;
            if (role.isInstructor) isInstructor = true;
            if (role.canManageInstructors) canManageInstructors = true;
            if (role.canPostNews) canPostNews = true;
        }
    });

    const vClean = (user.vorname || '').trim().toLowerCase();
    const nClean = (user.nachname || '').trim().toLowerCase();
    if (vClean === "tim" && nClean === "sanddorn") {
        isAdmin = true; isMasterAdmin = true; canDelete = true;
        isInstructor = true; canManageInstructors = true; canPostNews = true;
        canSeeLinks = true; canSeeCommands = true;
    }
    return { isAdmin, isMasterAdmin, canDelete, isInstructor, canManageInstructors, canPostNews, canSeeLinks, canSeeCommands };
}

function renderUserRoleBadges(user) {
    if (!user) return '';
    const roleIds = getUserRolesList(user);
    if (roleIds.length === 0) {
        return `Mitarbeiter`;
    }
    return roleIds.map(rId => {
        const role = cachedRoles[rId] || (rId === 'superadmin' ? cachedRoles['masteradmin'] : null);
        if (!role) {
            return `${rId}`;
        }
        const color = role.color || '#38bdf8';
        const icon = role.icon ? `${role.icon} ` : '';
        const isTopAdmin = role.id === 'masteradmin' || role.id === 'admin';
        const extraGlow = isTopAdmin ? `box-shadow: 0 0 8px ${color}33;` : '';
        return `${icon}${role.name}`;
    }).join('');
}

function getUserAllowedLinkCategories(user, allCategories) {
    if (!user || !allCategories) return allCategories || [];
    const eff = getUserEffectivePermissions(user);
    if (eff.isAdmin || eff.isMasterAdmin) return allCategories;

    const userRoleIds = getUserRolesList(user);
    const roleAllowedSet = new Set();

    userRoleIds.forEach(rId => {
        const role = cachedRoles[rId] || defaultRoles[rId];
        if (role && role.allowedLinkKats) {
            Object.keys(role.allowedLinkKats).forEach(k => {
                if (role.allowedLinkKats[k] === true) roleAllowedSet.add(k.trim().toLowerCase());
            });
        }
    });

    return allCategories.filter(kat => {
        const katLower = kat.trim().toLowerCase();
        if (user.allowedLinkKats && user.allowedLinkKats[kat] === false) return false;
        if (user.allowedLinkKats && user.allowedLinkKats[kat] === true) return true;
        if (roleAllowedSet.has(katLower)) return true;
        if (userRoleIds.some(rId => rId.toLowerCase() === katLower || (cachedRoles[rId]?.name || '').toLowerCase() === katLower)) return true;
        if (katLower === 'md intern' || katLower === 'allgemein') return true;
        return false;
    });
}

function getUserAllowedCmdCategories(user, allCategories) {
    if (!user || !allCategories) return allCategories || [];
    const eff = getUserEffectivePermissions(user);
    if (eff.isAdmin || eff.isMasterAdmin) return allCategories;

    const userRoleIds = getUserRolesList(user);
    const roleAllowedCmdSet = new Set();

    userRoleIds.forEach(rId => {
        const role = cachedRoles[rId] || defaultRoles[rId];
        if (role && role.allowedCmdKats) {
            Object.keys(role.allowedCmdKats).forEach(k => {
                if (role.allowedCmdKats[k] === true) roleAllowedCmdSet.add(k.trim().toLowerCase());
            });
        }
    });

    return allCategories.filter(kat => {
        const katLower = kat.trim().toLowerCase();
        if (user.allowedCmdKats && user.allowedCmdKats[kat] === false) return false;
        if (user.allowedCmdKats && user.allowedCmdKats[kat] === true) return true;
        if (roleAllowedCmdSet.has(katLower)) return true;
        if (userRoleIds.some(rId => rId.toLowerCase() === katLower || (cachedRoles[rId]?.name || '').toLowerCase() === katLower)) return true;
        if (katLower === 't-codes' || katLower === 'abkürzungen & dokumente') return true;
        return false;
    });
}

let materialKatalog = {
    mat_05mg: { name: "05mg Schmerzmittel", preis: 200, isMeds: true },
    mat_10mg: { name: "10mg Schmerzmittel", preis: 400, isMeds: true },
    mat_15mg: { name: "15mg Schmerzmittel", preis: 600, isMeds: true },
    mat_20mg: { name: "20mg Schmerzmittel", preis: 800, isMeds: true },
    mat_schiene: { name: "Schiene", preis: 600, isMeds: false },
    mat_naehset: { name: "Nähset", preis: 350, isMeds: false },
    mat_wundreiniger: { name: "Wundreiniger", preis: 150, isMeds: false },
    mat_ehk: { name: "EHK", preis: 400, isMeds: false },
    mat_kuehlpack: { name: "Kühlpack", preis: 200, isMeds: false },
    mat_verband: { name: "Verband", preis: 200, isMeds: false },
    mat_wasser: { name: "Wasser", preis: 200, isMeds: false }
};

let szenarioTemplates = {
    "Undefinierbar": { mat_wundreiniger: 1, mat_naehset: 1, mat_verband: 1, mat_10mg: 1 },
    "Schnittwunde": { mat_wundreiniger: 1, mat_naehset: 1, mat_verband: 1, mat_15mg: 1 },
    "Schusswunde": { mat_wundreiniger: 1, mat_naehset: 1, mat_verband: 1, mat_20mg: 1 },
    "Stumpfe Gewalt": { mat_schiene: 1, mat_naehset: 1, mat_verband: 1, mat_kuehlpack: 1, mat_05mg: 1 }
};

let medicDatenbank = {
    "Stumpfe Gewalt": ["Rechnung stellen", "Vitalwerte prüfen", "Schiene anlegen", "Wunde nähen", "Verband anlegen", "Kühlpack verwenden", "Schmerzmittel verabreichen (5 mg)"],
    "Schusswunde": ["Rechnung stellen", "Vitalwerte prüfen", "Kugelzange benutzen", "Wundreinigung durchführen", "Wunde nähen", "Verband anlegen", "Schmerzmittel verabreichen (20 mg)"],
    "Schnittwunde": ["Rechnung stellen", "Vitalwerte prüfen", "Wundreinigung durchführen", "Wunde nähen", "Verband anlegen", "Schmerzmittel verabreichen (15 mg)"],
    "Undefinierbar": ["Rechnung stellen", "Vitalwerte prüfen", "Wundreinigung durchführen", "Wunde nähen", "Verband anlegen", "Schmerzmittel verabreichen (10 mg)"]
};

let defaultCommands = {
    cmd_1: { name: "!Psych", desc: "Psych anforderungen", kat: "Psychologie" },
    cmd_2: { name: "!waffenschein", desc: "Warten für die Überprüfung", kat: "Psychologie" },
    cmd_3: { name: "/editmdthud", desc: "MD HUD ändern", kat: "T-Codes" },
    cmd_4: { name: "PSGU Test", desc: "Psychologisches Gutachten", kat: "Abkürzungen & Dokumente" },
    cmd_5: { name: "CLS", desc: "Combat Life Saver", kat: "Abkürzungen & Dokumente" },
    cmd_6: { name: "EHK", desc: "Erste Hilfe Kurs", kat: "Abkürzungen & Dokumente" },
    cmd_7: { name: "!ausbildung", desc: "Ausbildungsanfrage stellen", kat: "Ausbildung" },
    cmd_8: { name: "!pruefung", desc: "Prüfungsanmeldung", kat: "Ausbildung" }
};

function toggleAuthTab(tab) {
    currentAuthTab = tab;
    document.getElementById('tabLoginBtn').classList.toggle('active', tab === 'login');
    document.getElementById('tabRegisterBtn').classList.toggle('active', tab === 'register');
    document.getElementById('mainAuthActionBtn').textContent = tab === 'login' ? 'Dienst antreten' : 'Account beantragen';
    document.getElementById('authVorname').placeholder = "Vorname";
    document.getElementById('authNachname').placeholder = "Nachname";
    document.getElementById('authPassword').placeholder = tab === 'login' ? "Passwort" : "Passwort ausdenken";
    document.getElementById('authDNContainer').style.display = tab === 'login' ? 'none' : 'block';
}

function handleAuthAction() {
    const v = document.getElementById('authVorname').value.trim();
    const n = document.getElementById('authNachname').value.trim();
    const p = document.getElementById('authPassword').value.trim();

    if(!v || !n || !p) { alert("⚠️ Bitte alle Felder ausfüllen!"); return; }
    const uId = (v + "_" + n).toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (v.toLowerCase() === "tim" && n.toLowerCase() === "sanddorn" && p === "0815") {
        const adminPayload = { 
            vorname: "Tim", 
            nachname: "Sanddorn", 
            pass: "0815", 
            status: "approved", 
            isAdmin: true, 
            isMasterAdmin: true, 
            canDelete: true, 
            isInstructor: true, 
            canManageInstructors: true, 
            canSeeLinks: true, 
            canSeeCommands: true, 
            roles: { masteradmin: true }, 
            date: "20.07.2026" 
        };
        db.ref("data/users/tim_sanddorn").set(adminPayload);
        initDienstEintritt(adminPayload);
        return;
    }

    let dn = "";
    if (currentAuthTab === 'register') {
        dn = document.getElementById('authDN').value.trim();
        if (!dn) { alert("⚠️ Bitte trage deine Dienstnummer (DN) ein!"); return; }
    }

    if (currentAuthTab === 'register') {
        db.ref("data/users/" + uId).once("value", snap => {
            if(snap.val() !== null) { alert("❌ Dieser Name ist bereits registriert!"); }
            else {
                const payload = { 
                    vorname: v, nachname: n, pass: p, dn: dn, 
                    status: 'pending', date: new Date().toLocaleDateString('de-DE'), 
                    isAdmin: false, roles: {}, canSeeLinks: true, canSeeCommands: true, canDelete: false 
                };
                db.ref("data/users/" + uId).set(payload).then(() => {
                    alert("⏳ Bitte warten Sie auf die Verifizierung durch die Leitung.");
                    location.reload();
                });
            }
        });
    } else {
        db.ref("data/users/" + uId).once("value", snap => {
            const user = snap.val();
            if(!user || user.pass !== p) { alert("❌ Falscher Name oder falsches Passwort!"); }
            else if(user.status !== 'approved' && !user.isAdmin) { alert("⏳ Dein Account wurde noch nicht freigeschaltet!"); }
            else { initDienstEintritt(user); }
        });
    }
}

function applyUserPermissions(user) {
    if(!user) return;
    const eff = getUserEffectivePermissions(user);

    const linksBtn = document.getElementById('linksTabBtn');
    const linksTabContent = document.getElementById('linksTab');
    if (linksBtn) linksBtn.style.display = eff.canSeeLinks ? '' : 'none';
    if (!eff.canSeeLinks && linksTabContent && linksTabContent.classList.contains('active')) {
        const firstTab = document.querySelector('.tab-btn');
        if (firstTab) switchTab('docTab', firstTab);
    }

    const cmdBtn = document.querySelector('.tab-nav button[onclick*="commandTab"]');
    const cmdTabContent = document.getElementById('commandTab');
    if (cmdBtn) cmdBtn.style.display = eff.canSeeCommands ? '' : 'none';
    if (!eff.canSeeCommands && cmdTabContent && cmdTabContent.classList.contains('active')) {
        const firstTab = document.querySelector('.tab-btn');
        if (firstTab) switchTab('docTab', firstTab);
    }

    const instructorView = document.getElementById('examInstructorView');
    if (instructorView) {
        instructorView.style.display = (eff.isInstructor || eff.isAdmin) ? 'block' : 'none';
    }

    const allowedExamsBtn = document.getElementById('instrAllowedExamsTabBtn');
    if (allowedExamsBtn) {
        allowedExamsBtn.style.display = (eff.canManageInstructors || eff.isAdmin) ? '' : 'none';
    }
}

function initDienstEintritt(user) {
    sessionUser = user;
    sessionStorage.setItem('mmd_session_active', 'true');
    sessionStorage.setItem('mmd_session_user', JSON.stringify(user));
    localStorage.setItem('mmd_session_active', 'true');
    localStorage.setItem('mmd_session_user', JSON.stringify(user));

    const eff = getUserEffectivePermissions(user);

    document.getElementById('authView').style.display = 'none';
    document.getElementById('mainAppView').style.display = 'block';
    document.getElementById('topBarMedicName').innerHTML = `${user.vorname} ${user.nachname} ${renderUserRoleBadges(user)}`;
    document.getElementById('daysMedicName').textContent = user.vorname + " " + user.nachname;

    if(eff.isAdmin || eff.isMasterAdmin) {
        document.getElementById('adminKeyBtn').style.display = 'inline-block';
        document.querySelectorAll('.admin-action-th').forEach(el => el.style.display = eff.canDelete ? 'table-cell' : 'none');
    } else {
        document.getElementById('adminKeyBtn').style.display = 'none';
        document.querySelectorAll('.admin-action-th').forEach(el => el.style.display = eff.canDelete ? 'table-cell' : 'none');
    }
    
    applyUserPermissions(user);
    startPresenceWatcher();
    const gespDatum = localStorage.getItem('mmd_einstellungsdatum_' + user.vorname + "_" + user.nachname);
    if(gespDatum) {
        document.getElementById('einstellungsDatum').value = gespDatum;
        berechneDienstTage();
    }
    renderNewsFeed();
    updateOnlineStatus();
}

function updateAdminModalTabVisibility(eff) {
    const btnUsers = document.getElementById('btnAdminSubUsers');
    const btnRoles = document.getElementById('btnAdminSubRoles');
    const btnContent = document.getElementById('btnAdminSubContent');
    const btnHierarchy = document.getElementById('btnAdminSubHierarchy');
    const btnPrices = document.getElementById('btnAdminSubPrices');
    const btnSystem = document.getElementById('btnAdminSubSystem');
    const btnAudit = document.getElementById('btnAdminSubAudit');
    const btnFullReset = document.querySelector('.btn-full-reset');

    const isMaster = eff.isMasterAdmin;
    const isAdmin = eff.isAdmin;

    if (isMaster) {
        if (btnUsers) btnUsers.style.display = '';
        if (btnRoles) btnRoles.style.display = '';
        if (btnContent) btnContent.style.display = '';
        if (btnHierarchy) btnHierarchy.style.display = '';
        if (btnPrices) btnPrices.style.display = '';
        if (btnSystem) btnSystem.style.display = '';
        if (btnAudit) btnAudit.style.display = '';
        if (btnFullReset) btnFullReset.style.display = '';
    } else if (isAdmin) {
        if (btnUsers) btnUsers.style.display = '';
        if (btnRoles) btnRoles.style.display = 'none';
        if (btnContent) btnContent.style.display = '';
        if (btnHierarchy) btnHierarchy.style.display = '';
        if (btnPrices) btnPrices.style.display = '';
        if (btnSystem) btnSystem.style.display = '';
        if (btnAudit) btnAudit.style.display = '';
        if (btnFullReset) btnFullReset.style.display = 'none';
    }

    const visibleBtns = Array.from(document.querySelectorAll('.admin-tab-btn')).filter(btn => btn.style.display !== 'none');
    if (visibleBtns.length > 0) {
        const currentActive = document.querySelector('.admin-tab-btn.active');
        if (!currentActive || currentActive.style.display === 'none') {
            const targetOnclick = visibleBtns[0].getAttribute('onclick') || '';
            const match = targetOnclick.match(/switchAdminTab\('([^']+)'/);
            if (match) switchAdminTab(match[1], visibleBtns[0]);
        }
    }
}

function openAdminKeyModal() {
    if(!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if(!eff.isAdmin && !eff.isMasterAdmin) return;
    document.getElementById('adminAuthPassInput').value = "";
    document.getElementById('adminAuthModal').style.display = 'flex';
    document.getElementById('adminAuthPassInput').focus();
}

function closeAdminAuthModal() {
    document.getElementById('adminAuthModal').style.display = 'none';
}

function verifyAdminKeyPassword() {
    const pass = (document.getElementById('adminAuthPassInput').value || '').trim();
    if (!pass) { alert("Bitte Admin-Passwort eingeben!"); return; }
    const vClean = (sessionUser.vorname || '').trim().toLowerCase();
    const nClean = (sessionUser.nachname || '').trim().toLowerCase();
    const isTim = (vClean === "tim" && nClean === "sanddorn");
    if (pass === sessionUser.pass || (isTim && pass === "0815")) {
        closeAdminAuthModal();
        document.getElementById('adminManagementModal').style.display = 'flex';
        const eff = getUserEffectivePermissions(sessionUser);
        updateAdminModalTabVisibility(eff);
        bauePreiseEinstellungenUI();
        ladeSzenarioTemplateInSettings();
        db.ref("data/users").once("value", snap => {
            if(snap.val()) renderAdminUserTable(snap.val());
        });
    } else {
        alert("❌ Falsches Admin-Passwort!");
    }
}

function closeAdminManagementModal() {
    document.getElementById('adminManagementModal').style.display = 'none';
}

function passwortAendern() {
    if(!sessionUser) return;
    const newPass = document.getElementById('newPasswordInput').value.trim();
    if(!newPass) { alert("Bitte neues Passwort eingeben!"); return; }
    const uId = (sessionUser.vorname + "_" + sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g, "");
    db.ref("data/users/" + uId + "/pass").set(newPass).then(() => {
        sessionUser.pass = newPass;
        sessionStorage.setItem('mmd_session_user', JSON.stringify(sessionUser));
        localStorage.setItem('mmd_session_user', JSON.stringify(sessionUser));
        document.getElementById('newPasswordInput').value = "";
        alert("✅ Passwort erfolgreich geändert!");
    });
}

function handleDienstEndeLogout() {
    if(mySessionRef) mySessionRef.remove();
    sessionStorage.clear();
    localStorage.removeItem('mmd_session_active');
    localStorage.removeItem('mmd_session_user');
    location.reload();
}

function berechneDienstTage() {
    if(!sessionUser) return;
    const inputField = document.getElementById('einstellungsDatum');
    if(!inputField || !inputField.value) return;
    localStorage.setItem('mmd_einstellungsdatum_' + sessionUser.vorname + "_" + sessionUser.nachname, inputField.value);
    const einstellungsDatum = new Date(inputField.value);
    einstellungsDatum.setHours(0,0,0,0);
    const heute = new Date();
    heute.setHours(0,0,0,0);
    const zeitDifferenz = heute.getTime() - einstellungsDatum.getTime();
    let tage = Math.floor(zeitDifferenz / (1000 * 60 * 60 * 24)) + 1;
    if (tage < 0) tage = 0;
    document.getElementById('val_dienstTage').textContent = tage;
}

function updateOnlineStatus() {
    if(!sessionUser) return;
    const fullName = sessionUser.vorname + " " + sessionUser.nachname;
    if (!mySessionRef) {
        mySessionRef = db.ref("data/presence").push();
        mySessionRef.onDisconnect().remove();
    }
    mySessionRef.set(fullName);
}

function startPresenceWatcher() {
    db.ref("data/presence").off();
    db.ref("data/presence").on("value", snapshot => {
        const list = snapshot.val();
        const display = document.getElementById('onlineMedicsList');
        const adminDisp = document.getElementById('adminOnlineMedicsList');
        if (!list) { 
            if(display) display.textContent = "Keiner im Dienst"; 
            if(adminDisp) adminDisp.textContent = "Keine Medics im Dienst";
            return; 
        }
        let eindeutigeNamen = [...new Set(Object.values(list))];
        if(display) display.textContent = eindeutigeNamen.join(", ");
        if(adminDisp) adminDisp.textContent = eindeutigeNamen.join(", ");
    });
}

function aktualisiereAdminVerwaltung() {
    db.ref("data/users").once("value", snap => {
        if(snap.val()) {
            renderAdminUserTable(snap.val());
            alert("🔄 Mitarbeiterliste & Berechtigungen erfolgreich aktualisiert!");
        }
    });
}

let hierarchieDaten = {
    chief_01: "#REF!", chief_02: "#REF!", chief_03: "#REF!",
    domo_04: "Nick Garcia", domo_04_sub: "",
    fod_05: "Mike Gonzalo", fod_05_sub: "",
    chiefphys_06: "Katarina Harper", chiefphys_07: "Tim Sanddorn",
    lt_08: "Aktuell nicht belegt", lt_09: "Aktuell nicht belegt",
    dept_psych_l: "Aktuell nicht belegt", dept_psych_sl: "Aktuell nicht belegt",
    dept_perso_l: "Aktuell nicht belegt", dept_perso_sl: "Aktuell nicht belegt",
    dept_ausb_l: "Aktuell nicht belegt", dept_ausb_sl: "Aktuell nicht belegt",
    dept_luft_l: "Gleich die Ausbildungsleitung", dept_luft_sl: "Aktuell nicht belegt"
};

function renderHierarchieBoard(hData) {
    if (!hData) return;
    hierarchieDaten = Object.assign({}, hierarchieDaten, hData);
    Object.keys(hierarchieDaten).forEach(key => {
        const dispEl = document.getElementById('disp_h_' + key);
        if (dispEl) {
            if (key.endsWith('_sub')) {
                const val = (hierarchieDaten[key] !== undefined && hierarchieDaten[key] !== "--") ? hierarchieDaten[key] : "";
                dispEl.textContent = val;
                dispEl.style.display = val ? "inline-block" : "none";
            } else {
                dispEl.textContent = (hierarchieDaten[key] !== undefined && hierarchieDaten[key] !== "") ? hierarchieDaten[key] : "--";
            }
        }
        const inpEl = document.getElementById('inp_h_' + key);
        if (inpEl && document.activeElement !== inpEl) inpEl.value = hierarchieDaten[key] !== undefined ? hierarchieDaten[key] : "";
    });
}

function speichereHierarchieDaten() {
    if (!sessionUser || !sessionUser.isAdmin) return;
    Object.keys(hierarchieDaten).forEach(key => {
        const inpEl = document.getElementById('inp_h_' + key);
        if (inpEl) hierarchieDaten[key] = inpEl.value.trim();
    });
    db.ref("data/hierarchie").set(hierarchieDaten).then(() => {
        alert("✅ Hierarchie-Besetzungen & Abteilungen erfolgreich gespeichert!");
    });
}

function baueMaterialUIAuf() {
    const grid = document.getElementById('dynamischerMaterialVerbrauchGrid'); 
    if(!grid) return; 
    grid.innerHTML = "";
    let htmlLeft = "<div>"; 
    let htmlRight = "<div>"; 
    let counter = 0;
    const keys = Object.keys(materialKatalog);
    keys.forEach(key => {
        if(key === 'mat_wasser') return;
        let currentQty = fallMaterial[key] || 0;
        let itemHtml = `<label style="margin-top:4px;">${materialKatalog[key].name} ($${materialKatalog[key].preis})</label><div class="counter-group"><button class="counter-btn" onclick="stepMat('${key}', -1)">-</button><span class="counter-value" id="val_${key}">${currentQty}</span><button class="counter-btn plus-main" onclick="stepMat('${key}', 1)">+</button></div>`;
        if(counter < (keys.length - 1) / 2) htmlLeft += itemHtml; 
        else htmlRight += itemHtml; 
        counter++;
    });
    grid.innerHTML = htmlLeft + "</div>" + htmlRight + "</div>";
}

function bauePreiseEinstellungenUI() {
    const settingsContainer = document.getElementById('preiseEinstellungsContainer'); 
    if(!settingsContainer) return; 
    settingsContainer.innerHTML = "";
    Object.keys(materialKatalog).forEach(key => { 
        settingsContainer.innerHTML += `<div class="setting-row"><span>${materialKatalog[key].name}:</span><input type="number" style="width:100px; padding:6px;" id="setPrice_${key}" value="${materialKatalog[key].preis}"></div>`; 
    });
}

function ladeSzenarioTemplateInSettings() {
    const select = document.getElementById('templateSzenarioSelect'); 
    const container = document.getElementById('templateMaterialsContainer'); 
    if(!select || !container) return;
    const szenario = select.value; 
    container.innerHTML = "";
    let currentTemplate = szenarioTemplates[szenario] || {};
    for (let key in materialKatalog) { 
        if (key !== 'mat_wasser') {
            container.innerHTML += `
${materialKatalog[key].name}:
`; 
        }
    }
}

function speichereSzenarioTemplate() {
    const select = document.getElementById('templateSzenarioSelect');
    if (!select) return;
    const szenario = select.value;
    if (!szenario) return;
    if (!szenarioTemplates[szenario]) szenarioTemplates[szenario] = {};
    for (let key in materialKatalog) { 
        if (key !== 'mat_wasser') { 
            let el = document.getElementById(`setTpl_${key}`);
            let val = el ? (parseInt(el.value) || 0) : 0; 
            if (val > 0) szenarioTemplates[szenario][key] = val; 
            else delete szenarioTemplates[szenario][key];
        } 
    }
    db.ref("data/szenarioTemplates").set(szenarioTemplates).then(() => {
        alert("✅ Voreinstellungen gespeichert!");
    });
}

function ensureExamHasDefaultHeaderFields(exam) {
    if (!exam || !exam.questions) return exam;
    if (!Array.isArray(exam.questions)) { try { exam.questions = Object.values(exam.questions); } catch(e) {} }
    if (!Array.isArray(exam.questions)) return exam;
    
    let hasDN = exam.questions.some(q => q.type === 'info_dn' || (q.text || "").toLowerCase().includes("dienstnummer des mitarbeiters"));
    let hasPruefer = exam.questions.some(q => q.type === 'info_pruefer' || (q.text || "").toLowerCase().includes("dienstnummer des prüfers"));
    let hasName = exam.questions.some(q => q.type === 'info_name' || (q.text || "").toLowerCase().includes("vor- und nachname"));
    
    let newQuestions = [];
    if (!hasDN) newQuestions.push({ type: "info_dn", text: "Dienstnummer des Mitarbeiters", options: [], correctAnswers: [], points: [] });
    if (!hasPruefer) newQuestions.push({ type: "info_pruefer", text: "Dienstnummer des Prüfers", options: [], correctAnswers: [], points: [] });
    if (!hasName) newQuestions.push({ type: "info_name", text: "Vor- und Nachname des Mitarbeiters", options: [], correctAnswers: [], points: [] });
    
    if (newQuestions.length > 0) exam.questions = [...newQuestions, ...exam.questions];
    exam.questions.forEach((q, idx) => {
        q.id = idx + 1;
        if (!q.type) q.type = "choice";
        if (q.type === 'choice' && (!q.correctAnswers || q.correctAnswers.length === 0)) q.correctAnswers = [0];
    });
    return exam;
}

function renderExamTab(examsData, usersData, submissionsData) {
    let rawExams = Object.assign({}, defaultExams, examsData || {});
    cachedExams = rawExams;
    Object.keys(cachedExams).forEach(eId => {
        cachedExams[eId] = ensureExamHasDefaultHeaderFields(cachedExams[eId]);
    });

    cachedUsers = usersData || {};
    cachedSubmissions = submissionsData || {};

    const instructorView = document.getElementById('examInstructorView');
    if (instructorView) {
        if (isUserInstructor()) {
            instructorView.style.display = 'block';
            renderInstructorUnlocks(cachedUsers, cachedExams);
            renderInstructorSubmissions(cachedSubmissions);
            renderInstructorExistingExams(cachedExams);
            const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
            const allowedExamsBtn = document.getElementById('instrAllowedExamsTabBtn');
            if (allowedExamsBtn) allowedExamsBtn.style.display = eff.canManageInstructors ? '' : 'none';
            if (eff.canManageInstructors) renderInstructorAllowedExams(cachedUsers, cachedExams);
        } else {
            instructorView.style.display = 'none';
        }
    }
    renderStudentUnlockedExams();
    korrigiereAlleBisherigenPruefungen(true);
}

function sortExamIdsDynamically(examIds, examsMap) {
    if (!cachedExamOrder || cachedExamOrder.length === 0) {
        return examIds.sort((a, b) => {
            const titleA = (examsMap[a] && examsMap[a].title) ? examsMap[a].title.toLowerCase() : '';
            const titleB = (examsMap[b] && examsMap[b].title) ? examsMap[b].title.toLowerCase() : '';
            return titleA.localeCompare(titleB);
        });
    }
    return examIds.sort((a, b) => {
        let idxA = cachedExamOrder.indexOf(a); let idxB = cachedExamOrder.indexOf(b);
        if (idxA === -1) idxA = 999999; if (idxB === -1) idxB = 999999;
        if (idxA !== idxB) return idxA - idxB;
        return ((examsMap[a]?.title || '').toLowerCase()).localeCompare((examsMap[b]?.title || '').toLowerCase());
    });
}

function renderStudentUnlockedExams() {
    const container = document.getElementById('studentUnlockedExamsContainer');
    if(!container) return;
    container.innerHTML = "";
    if(!sessionUser) {
        container.innerHTML = `
Bitte melde dich an, um deinen Prüfungsstatus einzusehen.
`;
        return;
    }

    const myUserId = (sessionUser.vorname + "_" + sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g, "");
    const unlockedObj = sessionUser.unlockedExams || {};
    const passedObj = sessionUser.passedExams || {};

    const examIdSet = new Set();
    Object.keys(unlockedObj).forEach(k => { if (unlockedObj[k] === true) examIdSet.add(k); });
    Object.keys(passedObj).forEach(k => { if (passedObj[k] === true) examIdSet.add(k); });
    if (cachedSubmissions) {
        Object.values(cachedSubmissions).forEach(sub => {
            if (sub.userId === myUserId && sub.examId) examIdSet.add(sub.examId);
        });
    }

    let relevantExamIds = Array.from(examIdSet).filter(k => cachedExams[k] && !cachedExams[k].isPractical);
    relevantExamIds = sortExamIdsDynamically(relevantExamIds, cachedExams);

    if(relevantExamIds.length === 0) {
        container.innerHTML = `
        

            
🔒 Keine Prüfungen freigeschaltet

            

                Du hast aktuell noch keine freigeschalteten Prüfungen. Sobald du im Dienstgrad aufsteigst, schaltet die Ausbildungsabteilung Prüfungen für dich frei.
            

        
`;
        return;
    }

    let activeExamsHtml = "";
    let completedExamsHtml = "";
    let completedCount = 0;

    relevantExamIds.forEach(examId => {
        const exam = cachedExams[examId];
        if(!exam) return;
        const isUnlocked = unlockedObj[examId] === true;
        let isPassed = passedObj[examId] === true;
        let hasFailed = false; let lastSub = null; let bestSub = null;

        if (cachedSubmissions) {
            const userSubs = Object.values(cachedSubmissions).filter(sub => sub.userId === myUserId && sub.examId === examId);
            if (userSubs.length > 0) {
                lastSub = userSubs[userSubs.length - 1];
                const passedSubs = userSubs.filter(s => s.passed === true);
                if (passedSubs.length > 0) { bestSub = passedSubs[passedSubs.length - 1]; isPassed = true; hasFailed = false; }
                else if (!isPassed) { hasFailed = true; }
            }
        }

        let statusBadge = ""; let actionBtn = "";
        if (isPassed) {
            const displaySub = bestSub || lastSub;
            statusBadge = `🏆 Bestanden ${displaySub ? `(${displaySub.percentage}%)` : ''}`;
        } else if (isUnlocked) {
            statusBadge = `🔓 Bereit zur Prüfung`;
            actionBtn = `🚀 Prüfung starten`;
        } else {
            statusBadge = `❌ Nicht bestanden - 🔒 Gesperrt`;
            actionBtn = `
🔒 Prüfung gesperrt – Bitte an Ausbilder wenden
`;
        }

        const cardHtml = `
        

            
                

                    ${exam.kat || 'Prüfung'}
                    ${statusBadge}
                

                
${exam.title}

                

                    ⏱️ Dauer: ca. ${exam.timeLimitMinutes || 15} Min  |  ❓ Fragen: ${exam.questions ? exam.questions.length : 0}  |  🎯 Mindestquote: ${exam.passPercentage || 60}%
                

            
            ${actionBtn}
        
`;

        if (isPassed) { completedExamsHtml += cardHtml; completedCount++; } 
        else { activeExamsHtml += cardHtml; }
    });

    container.innerHTML = `
${activeExamsHtml || '
Keine ausstehenden Prüfungen zu erledigen.
'}
`;
    if (completedCount > 0) {
        let isCollapsed = localStorage.getItem('mmd_student_completed_collapsed') === 'true';
        container.innerHTML += `
        

            

                ✅ Bereits bestandene Prüfungen (${completedCount})
                ${isCollapsed ? '▶ Anzeigen' : '▼ Ausblenden'}
            

            
${completedExamsHtml}

        
`;
    }
}

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(tabId);
    if(target) target.classList.add('active');
    if(btn) btn.classList.add('active');
    if(tabId === 'newsTab') renderNewsFeed();
}

function settingsTabClick() {
    const btn = document.getElementById('adminMainTabHeader');
    switchTab('settingsTab', btn);
}

function deletePatient(key) { 
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).canDelete) { alert("⛔ Keine Berechtigung!"); return; }
    if(confirm("Eintrag löschen?")) db.ref("data/protokoll/" + key).remove();
}

function deleteArchivSchicht(key) { 
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).canDelete) { alert("⛔ Keine Berechtigung!"); return; }
    if(confirm("Schicht unwiderruflich löschen?")) db.ref("data/archiv/" + key).remove(); 
}

function deleteDienstLink(key) { 
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).canDelete) { alert("⛔ Keine Berechtigung!"); return; }
    if (confirm("Link löschen?")) db.ref("data/dienstLinks/" + key).remove(); 
}

function deleteDienstCommand(key) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).canDelete) { alert("⛔ Keine Berechtigung!"); return; }
    if (confirm("Command / Kürzel löschen?")) db.ref("data/dienstCommands/" + key).remove();
}

function setDynamischenPatientenNamen() { 
    const nF = document.getElementById('pName'); 
    if (nF && (!nF.value || nF.value.startsWith("Patient "))) { 
        nF.value = "Patient " + ((Number(daten.patienten) || 0) + 1); 
    } 
}

// Window-Exporte
window.switchTab = switchTab;
window.settingsTabClick = settingsTabClick;
window.deletePatient = deletePatient;
window.deleteArchivSchicht = deleteArchivSchicht;
window.deleteDienstLink = deleteDienstLink;
window.deleteDienstCommand = deleteDienstCommand;
window.setDynamischenPatientenNamen = setDynamischenPatientenNamen;
window.handleAuthAction = handleAuthAction;
window.toggleAuthTab = toggleAuthTab;
window.openAdminKeyModal = openAdminKeyModal;
window.closeAdminAuthModal = closeAdminAuthModal;
window.verifyAdminKeyPassword = verifyAdminKeyPassword;
window.closeAdminManagementModal = closeAdminManagementModal;
window.handleDienstEndeLogout = handleDienstEndeLogout;
window.berechneDienstTage = berechneDienstTage;
window.passwortAendern = passwortAendern;

