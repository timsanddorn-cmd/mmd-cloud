// ============================================================
//  MMD CLOUD – Medical Center Web-App  |  app.js  v6.4.2
//  Firebase Realtime Database (Compat SDK v10)
// ============================================================

/* ── XSS-Schutz: HTML Sanitization Helper ───────────────────── */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeJsArg(value) {
    return escapeHtml(JSON.stringify(String(value ?? '')));
}

function sanitizeRoleColor(value, fallback = '#38bdf8') {
    const v = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

/* ── Text-Parser: Links in Texten klickbar machen ─────────── */
function formatTextWithLinks(text) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return escaped.replace(urlPattern, url => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--primary);text-decoration:underline;word-break:break-all;">${url}</a>`;
    });
}

function sanitizeUrl(url) {
    if (!url) return '#';
    let trimmed = String(url).trim();
    if (!/^https?:\/\//i.test(trimmed)) trimmed = 'https://' + trimmed;
    try {
        const parsed = new URL(trimmed);
        if (!['http:', 'https:'].includes(parsed.protocol)) return '#';
        return parsed.href;
    } catch (_) {
        return '#';
    }
}

/* ── Einmalige Legacy-Passwortprüfung für Firebase-Auth-Migration ── */
const PASSWORD_HASH_ITERATIONS = 180000;

function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function derivePasswordHash(password, saltBase64, iterations = PASSWORD_HASH_ITERATIONS) {
    if (!window.crypto?.subtle) throw new Error('Sichere Passwortverschlüsselung wird von diesem Browser nicht unterstützt.');
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        salt: base64ToBytes(saltBase64),
        iterations: Number(iterations) || PASSWORD_HASH_ITERATIONS,
        hash: 'SHA-256'
    }, key, 256);
    return bytesToBase64(new Uint8Array(bits));
}


function createRandomSaltBase64(byteLength = 16) {
    if (!window.crypto?.getRandomValues) throw new Error('Sichere Zufallswerte werden von diesem Browser nicht unterstützt.');
    const bytes = new Uint8Array(byteLength);
    window.crypto.getRandomValues(bytes);
    return bytesToBase64(bytes);
}

async function deriveTransitionFirebasePassword(passwordHashBase64, accountId, version = 1) {
    if (!window.crypto?.subtle) throw new Error('Sichere Passwortableitung wird von diesem Browser nicht unterstützt.');
    const payload = `MMD-AUTH-TRANSITION-V1|${String(accountId || '')}|${Number(version) || 1}|${String(passwordHashBase64 || '')}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    const token = bytesToBase64(new Uint8Array(digest))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    return `MMDv1-${token}`;
}

async function verifyUserPassword(user, password) {
    if (!user || !password) return false;
    if (user.passwordHash && user.passwordSalt) {
        const candidate = await derivePasswordHash(password, user.passwordSalt, user.passwordIterations || PASSWORD_HASH_ITERATIONS);
        return candidate === user.passwordHash;
    }
    return typeof user.pass === 'string' && user.pass === password;
}

function stripSensitiveUserData(user) {
    if (!user || typeof user !== 'object') return user;
    const clean = { ...user };
    delete clean.pass;
    delete clean.passwordHash;
    delete clean.passwordSalt;
    delete clean.passwordAlgo;
    delete clean.passwordIterations;
    delete clean.passwordVersion;
    delete clean.passwordUpdatedAt;
    return clean;
}

function clearStoredSessionData() {
    ['mmd_session_active', 'mmd_session_user', 'mmd_session_date', 'mmd_session_user_id'].forEach(k => sessionStorage.removeItem(k));
    ['mmd_session_active', 'mmd_session_user', 'mmd_session_date', 'mmd_session_user_id'].forEach(k => localStorage.removeItem(k));
}

/* ── Robuste, einheitliche Benutzer-ID Normalisierung ──────── */
function generateUserId(vorname, nachname) {
    const cleanV = (vorname || '').trim().toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    const cleanN = (nachname || '').trim().toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    return (cleanV + '_' + cleanN).replace(/[^a-z0-9_]/g, '');
}

/* Die technische Account-ID bleibt dauerhaft stabil, auch wenn Name oder DN geändert werden. */
function getUserAccountId(user = sessionUser) {
    if (!user) return '';
    const stableId = String(user.accountId || '').trim();
    return stableId || generateUserId(user.vorname, user.nachname);
}

function withStableAccountId(uId, user) {
    if (!user || typeof user !== 'object') return user;
    return Object.assign({}, stripSensitiveUserData(user), { accountId: uId });
}

function canCurrentUserManageFeedback() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    return !!(eff.isAdmin || eff.isMasterAdmin || eff.canManageFeedback);
}

function normalizeKats(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') return Object.values(raw).filter(Boolean);
    return [];
}

/* ── Fallback Icon (Inline SVG) ────────────────────────────── */
const DEFAULT_MD_LOGO_FALLBACK = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%230f172a'/><path d='M42 20h16v22h22v16H58v22H42V58H20V42h22V20z' fill='%2338bdf8'/><circle cx='50' cy='50' r='46' fill='none' stroke='%2338bdf8' stroke-width='4'/></svg>";

/* ── Firebase Init ─────────────────────────────────────────── */
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDq_VRrDZG4gK1zHWBpiLn6mPuVe31MFro",
    authDomain: "mmd-live.firebaseapp.com",
    databaseURL: "https://mmd-live-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "mmd-live",
    storageBucket: "mmd-live.firebasestorage.app",
    messagingSenderId: "485210653639",
    appId: "1:485210653639:web:804c42fffe48749bf38fe2"
};
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();
const auth = firebase.auth();
const FIREBASE_AUTH_EMAIL_DOMAIN = 'mmd-login.invalid';

async function configureFirebaseAuthPersistence() {
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    } catch (err) {
        console.warn('Firebase-Auth-Persistenz konnte nicht gesetzt werden:', err);
    }
}

function getTechnicalAuthEmail(uId, version = 1) {
    const safeId = String(uId || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const safeVersion = Math.max(1, Number(version) || 1);
    return `${safeId}.v${safeVersion}@${FIREBASE_AUTH_EMAIL_DOMAIN}`;
}

function waitForFirebaseAuthReady() {
    return new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe();
            resolve(user || null);
        }, () => {
            unsubscribe();
            resolve(null);
        });
    });
}

/* ── Session-State ─────────────────────────────────────────── */
let sessionUser       = null;
let currentAuthTab    = 'login';
let aktuellerFallKosten = 0;
let anzahlVerletzungenFall = 1;
let fallMaterial      = {};
let daten             = { patienten: 0, verletzungen: 0, ausgaben: 0 };
let mySessionRef      = null;
let cachedUsers       = {};
let cachedExams       = {};
let cachedSubmissions = {};
let cachedNews        = {};
let cachedArchiv      = {};
let cachedAuditLogs   = {};
let cachedCalendar    = {};
let cachedPhotos      = {};
let cachedCustomChangelogs = {};
let cachedCommands    = {};
let cachedLinks       = {};
let cachedFeedback    = {};
let activeExam        = null;
let activeExamTimerInterval = null;
let activeExamSecondsElapsed = 0;
let midnightIntervalId = null;
let dailyForcedLogoutIntervalId = null;

/* ── Kalender State ────────────────────────────────────────── */
let currentCalYear  = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();
let activeDetailEventId = null;

/* ── Standard-Hierarchie-Daten ─────────────────────────────── */
const defaultHierarchieData = {
    chief_01: "Aktuell nicht belegt",
    chief_02: "Aktuell nicht belegt",
    chief_03: "Aktuell nicht belegt",
    dept_psych_l: "Aktuell nicht belegt",
    dept_psych_sl: "Aktuell nicht belegt",
    dept_perso_l: "Aktuell nicht belegt",
    dept_perso_sl: "Aktuell nicht belegt",
    dept_ausb_l: "Aktuell nicht belegt",
    dept_ausb_sl: "Aktuell nicht belegt",
    dept_luft_l: "Gleich die Ausbildungsleitung",
    dept_luft_sl: "Aktuell nicht belegt",
    domo_04: "Nick Garcia",
    domo_04_sub: "",
    fod_05: "Mike Gonzalo",
    fod_05_sub: "",
    chiefphys_06: "Katarina Harper",
    chiefphys_07: "Tim Sanddorn",
    lt_08: "Aktuell nicht belegt",
    lt_09: "Aktuell nicht belegt",
    a_emt_count: "2",
    emt_count: "0"
};
let hierarchieDaten = JSON.parse(JSON.stringify(defaultHierarchieData));

/* ── Vollständiger Gesamt-Changelog (Entwicklungsverlauf) ───── */
const systemChangelogs = [
    {
        id: "sys_v6_4_2",
        version: "v6.4.2",
        date: "15.09.2026",
        ts: 1789422000002,
        category: "Bugfix",
        title: "Wiederregistrierung gelöschter Mitarbeiter repariert",
        changes: [
            "Gelöschte Mitarbeiter können sich später wieder mit demselben Namen registrieren, ohne durch einen alten technischen Zugang blockiert zu werden.",
            "Bei einer erneuten Registrierung wird automatisch ein neuer technischer Zugang verwendet; alte Zugänge bleiben weiterhin ohne Zugriff auf die MD-Daten.",
            "Ausstehende Registrierungen werden für berechtigte Personen direkt in der Mitarbeiter-Kartei sichtbar und können dort freigeschaltet werden.",
            "Beim Öffnen der Adminverwaltung wird die Mitarbeiterliste frisch aus der Datenbank geladen, damit neue Anträge zuverlässig erscheinen.",
            "Fehler bei der Registrierung werden verständlicher abgefangen, damit unvollständige Konten möglichst nicht zurückbleiben."
        ]
    },
    {
        id: "sys_v6_4_0",
        version: "v6.4.0",
        date: "14.09.2026",
        ts: 1789422000000,
        category: "Update",
        title: "Anmeldung, Rollen & Bedienung verbessert",
        changes: [
            "Neue Mitarbeiterkonten können zuverlässiger beantragt und anschließend von berechtigten Personen freigeschaltet werden.",
            "Bei Freischaltungen, Sperrungen und Prüfungsaktionen werden Fehler jetzt verständlich angezeigt, statt unbemerkt zu bleiben.",
            "Die Dienstnummer wird in der Liste der aktuell im Dienst befindlichen Mitarbeiter wieder zuverlässiger beim Darüberfahren angezeigt.",
            "Die bisherige Rolle Admin wurde entfernt. Die Chief-Ebene übernimmt weiterhin die vorgesehenen Verwaltungsaufgaben unterhalb des Master-Admins.",
            "Wartende, aktive und gesperrte Mitarbeiterkonten werden deutlicher voneinander unterschieden.",
            "Der bestehende Changelog wurde sprachlich vereinfacht und stärker auf die sichtbaren Änderungen für Mitarbeiter ausgerichtet.",
            "Mehrere kleinere Stabilitätsprobleme bei Anmeldung, Ausbildung und Benutzerverwaltung wurden bereinigt."
        ]
    },
    {
        id: "sys_v6_3_0",
        version: "v6.3.0",
        date: "13.09.2026",
        ts: 1789335600001,
        category: "Bugfix",
        title: "Stabilität, Anmeldung & Navigation verbessert",
        changes: [
            "Einstellungen und Ausbildungsbereich sind wieder zuverlässig erreichbar.",
            "Das Prüfcenter wurde bereinigt, damit die verschiedenen Prüfungsansichten wieder korrekt funktionieren.",
            "Die Anmeldung und Passwortverwaltung wurden sicherer und zuverlässiger gemacht.",
            "Sitzungen und sensible Kontodaten werden besser geschützt.",
            "Rollen und Zugriffsrechte wurden verbessert, damit Funktionen nur von den vorgesehenen Personen genutzt werden können.",
            "Kalender-, News-, Feedback- und Prüfungsfunktionen wurden zusätzlich gegen unberechtigte Nutzung abgesichert.",
            "Besonders geschützte Verwaltungsrechte können nur noch vom Master-Admin vergeben oder verändert werden.",
            "Die automatische Archivierung wurde stabilisiert, damit neue Einträge nicht versehentlich mit entfernt werden.",
            "Nicht mehr benötigte Altlasten wurden aus dem laufenden System entfernt.",
            "Die Anmelde- und Registrierungsseite wurde optisch an die MMD-Cloud angepasst und für mobile Geräte verbessert.",
            "Die Dienstleiste wurde stabilisiert und bleibt auch bei mehreren Mitarbeitern übersichtlich.",
            "Wünsche und Bug-Meldungen wurden in einen eigenen übersichtlichen Bereich verschoben.",
            "Ältere Wunsch- und Bug-Einträge können wieder zuverlässig bearbeitet und gelöscht werden.",
            "Namen und Dienstnummern können geändert werden, ohne dass die feste Kontozuordnung verloren geht.",
            "Die Chief-Ebene wurde als Verwaltungsrolle unterhalb des Master-Admins ergänzt.",
            "Der Master-Admin kann den Stand der persönlichen Passwortumstellung aller Mitarbeiter einsehen."
        ]
    },
    {
        id: "sys_v6_2_0",
        version: "v6.2.0",
        date: "13.09.2026",
        ts: 1789335600000,
        category: "Update",
        title: "Prüfcenter & Bedienung verbessert",
        changes: [
            "Berechtigte Personen können Wünsche und Bug-Meldungen schneller über die Hauptleiste aufrufen.",
            "Begründungen bei Ablehnungen können direkt in der jeweiligen Zeile eingegeben werden.",
            "Erledigte oder abgelehnte Meldungen lassen sich wieder zuverlässig löschen.",
            "Die Schrift in Tabellen wurde für eine bessere Lesbarkeit vergrößert.",
            "Porträtfotos und Dienstlogos in der Mitarbeiter-Kartei wurden größer dargestellt.",
            "Mehrere kleinere Darstellungs- und Bedienprobleme wurden bereinigt."
        ]
    },
    {
        id: "sys_v6_1_0",
        version: "v6.1.0",
        date: "12.09.2026",
        ts: 1789249200000,
        category: "Neue Funktion",
        title: "Wünsche & Bug-Meldungen eingeführt",
        changes: [
            "Mitarbeiter können Verbesserungsvorschläge, Ideen und Fehlerberichte direkt über die Homepage einreichen.",
            "Die Verwaltung eingereichter Meldungen ist nur für berechtigte Personen sichtbar.",
            "Abgelehnte Vorschläge benötigen eine Begründung und bleiben nachvollziehbar.",
            "Einreichungen können für die weitere Bearbeitung als Aufgabenliste exportiert werden."
        ]
    },
    {
        id: "sys_v6_0_1",
        version: "v6.0.1",
        date: "12.09.2026",
        ts: 1789243200000,
        category: "Bugfix",
        title: "Passwort & Verwaltung stabilisiert",
        changes: [
            "Das Ändern des eigenen Passworts in den Einstellungen funktioniert wieder zuverlässig.",
            "Das Löschen archivierter Schichten wird im System-Protokoll nachvollziehbar erfasst.",
            "Beim Bearbeiten eines Mitarbeiterkontos bleibt das vorhandene Passwort erhalten, wenn kein neues gesetzt wird."
        ]
    },
    {
        id: "sys_v6_0_0",
        version: "v6.0.0",
        date: "11.09.2026",
        ts: 1789156800000,
        category: "Update",
        title: "Kalender, Ausbildung & Arbeitsabläufe erweitert",
        changes: [
            "Aktive Sitzungen werden täglich automatisch beendet.",
            "Der Ausbildungsbereich wurde übersichtlicher sortiert und um eine schnellere Suche ergänzt.",
            "Ausbilder können nur Prüfungen verwalten, für die sie selbst die erforderliche Freigabe besitzen.",
            "Der Kalender unterstützt private Termine und Rückmeldungen auf Einladungen.",
            "Bei Terminen werden nur passende Rollen und Abteilungen zur Auswahl angeboten.",
            "Mehrere regelmäßig benötigte Inhalte können direkt über die Homepage bearbeitet werden.",
            "Rollen, Protokolle und verschiedene Bedienhilfen wurden zuverlässiger gemacht."
        ]
    },
    {
        id: "sys_v5_9_4",
        version: "v5.9.4",
        date: "11.09.2026",
        ts: 1789136800000,
        category: "Bugfix",
        title: "Links & Dokumente bereinigt",
        changes: [
            "Leere oder nicht benötigte Standard-Links wurden entfernt.",
            "Links und Dokumente lassen sich zuverlässiger löschen und verwalten."
        ]
    },
    {
        id: "sys_v5_9_3",
        version: "v5.9.3",
        date: "11.09.2026",
        ts: 1789126800000,
        category: "Design",
        title: "Formulare & Bedienbarkeit verbessert",
        changes: [
            "Auswahlfelder und Checkboxen im Kalender und in der Rollenverwaltung wurden besser zugeordnet.",
            "Mehrere Hinweise und Warnungen bei Formularfeldern wurden beseitigt."
        ]
    },
    {
        id: "sys_v5_9_2",
        version: "v5.9.2",
        date: "11.09.2026",
        ts: 1789116800000,
        category: "Technische Änderung",
        title: "Benutzerzuordnung & Prüfungen stabilisiert",
        changes: [
            "Benutzer werden auch bei Namen mit Umlauten zuverlässiger erkannt und zugeordnet.",
            "Prüfungen werden beim Erstellen genauer geprüft, damit unvollständige Fragen nicht gespeichert werden."
        ]
    }
];

/* ── Standard-Gehaltstabelle ───────────────────────────────── */
const defaultGehaltData = [
    { id: "g_1",  rang: "Rang 1",  name: "Trainee",                      command: "SAMD Trainee", q15: "5.500k",  h1: "22.000k", styleVar: "var(--rank-trainee)" },
    { id: "g_2",  rang: "Rang 2",  name: "Solo Trainee",                 command: "SAMD Trainee", q15: "7.000k",  h1: "28.000k", styleVar: "var(--rank-trainee)" },
    { id: "g_3",  rang: "Rang 3",  name: "EMT",                          command: "Low Command",  q15: "7.500k",  h1: "30.000k", styleVar: "var(--rank-low)" },
    { id: "g_4",  rang: "Rang 4",  name: "A-EMT",                        command: "Low Command",  q15: "8.250k",  h1: "33.000k", styleVar: "var(--rank-low)" },
    { id: "g_5",  rang: "Rang 5",  name: "Paramedic / Resident Phys.",    command: "Mid Command",  q15: "9.500k",  h1: "38.000k", styleVar: "var(--rank-mid)" },
    { id: "g_6",  rang: "Rang 6",  name: "Senior Paramedic",             command: "Mid Command",  q15: "11.000k", h1: "44.000k", styleVar: "var(--rank-mid)" },
    { id: "g_7",  rang: "Rang 7",  name: "Physician",                    command: "Mid Command",  q15: "11.000k", h1: "44.000k", styleVar: "var(--rank-mid)" },
    { id: "g_8",  rang: "Rang 8",  name: "Medical Supervisor",           command: "Mid Command",  q15: "11.500k", h1: "46.000k", styleVar: "var(--rank-mid)" },
    { id: "g_9",  rang: "Rang 9",  name: "Attending",                    command: "Mid Command",  q15: "11.500k", h1: "46.000k", styleVar: "var(--rank-mid)" },
    { id: "g_10", rang: "Rang 10", name: "Lieutenant / Field Op. Dir.",   command: "High Command", q15: "12.500k", h1: "50.000k", styleVar: "var(--rank-high)" },
    { id: "g_11", rang: "Rang 11", name: "Chief Phys. / Dir. of Med. Op.",command: "High Command", q15: "12.500k", h1: "50.000k", styleVar: "var(--rank-high)" },
    { id: "g_12", rang: "Rang 12", name: "Deputy Chief",                 command: "Chiefebene",   q15: "15.000k", h1: "60.000k", styleVar: "var(--rank-chief)" },
    { id: "g_13", rang: "Rang 13", name: "Assistant Chief",              command: "Chiefebene",   q15: "15.500k", h1: "62.000k", styleVar: "var(--rank-chief)" },
    { id: "g_14", rang: "Rang 14", name: "Chief of SAMD",                 command: "Chiefebene",   q15: "16.250k", h1: "65.000k", styleVar: "var(--rank-chief)" },
    { id: "g_15", rang: "Rang 15", name: "Interne",                      command: "Interne",      q15: "0",       h1: "0",       styleVar: "var(--rank-interne)" }
];
let cachedGehaltData = JSON.parse(JSON.stringify(defaultGehaltData));

/* ── Standard-Rollen & Berechtigungen ───────────────────────── */
const defaultRoles = {
    masteradmin: {
        id:'masteradmin', name:'Master-Admin', color:'#eab308', icon:'👑', isSystem:true,
        isAdmin:true, isMasterAdmin:true, canViewArchive:true, canEditAllPatients:true,
        canCreateCalendar:true, delCalendar:true, canManagePhotos:true, delPhotos:true,
        isInstructor:true, canManageInstructors:true, canManageExams:true,
        canPostNews:true, canApproveNews:true, canViewNewsRead:true,
        canEditPrices:true, canEditGuide:true, canEditCommands:true, canEditLinks:true,
        delPatient:true, delArchiv:true, delGuide:true, delCommands:true, delLinks:true, delNews:true, delExams:true, delUsers:true, canManageFeedback:true, delFeedback:true,
        allowedCmdKats: [], allowedLinkKats: []
    },
    chiefebene: {
        id:'chiefebene', name:'Chief-Ebene', color:'#fbbf24', icon:'⭐', isSystem:true,
        isAdmin:true, isMasterAdmin:false, canViewArchive:true, canEditAllPatients:true,
        canCreateCalendar:true, delCalendar:true, canManagePhotos:true, delPhotos:true,
        isInstructor:true, canManageInstructors:true, canManageExams:true,
        canPostNews:true, canApproveNews:true, canViewNewsRead:true,
        canEditPrices:true, canEditGuide:true, canEditCommands:true, canEditLinks:true,
        delPatient:true, delArchiv:true, delGuide:true, delCommands:true, delLinks:true, delNews:true, delExams:true, delUsers:false, canManageFeedback:true, delFeedback:true,
        allowedCmdKats: [], allowedLinkKats: []
    },
    ausbildungsleitung: {
        id:'ausbildungsleitung', name:'Ausbildungsleitung', color:'#c084fc', icon:'⚙️', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false,
        canCreateCalendar:true, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:true, canManageInstructors:true, canManageExams:true,
        canPostNews:true, canApproveNews:true, canViewNewsRead:true,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:true, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Ausbildung', 'Ausbildungsabteilung', 'Abkürzungen & Dokumente', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'Ausbildung', 'MD Intern']
    },
    ausbilder: {
        id:'ausbilder', name:'Ausbilder', color:'#8b5cf6', icon:'🎓', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false,
        canCreateCalendar:true, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:true, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Ausbildung', 'Ausbildungsabteilung', 'Abkürzungen & Dokumente', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'MD Intern']
    },
    cls: {
        id:'cls', name:'CLS-Ausbilder', color:'#06b6d4', icon:'💉', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false,
        canCreateCalendar:false, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Abkürzungen & Dokumente', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'CLS', 'MD Intern']
    },
    ehk: {
        id:'ehk', name:'EHK-Ausbilder', color:'#10b981', icon:'🩺', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false,
        canCreateCalendar:false, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Abkürzungen & Dokumente', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'EHK', 'MD Intern']
    },
    luftrettung: {
        id:'luftrettung', name:'Luftrettung', color:'#0284c7', icon:'🚁', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false,
        canCreateCalendar:true, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Abkürzungen & Dokumente', 'Allgemein', 'T-Codes'],
        allowedLinkKats: ['MD Intern']
    },
    psychologie: {
        id:'psychologie', name:'Psychologie', color:'#ec4899', icon:'🧠', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false,
        canCreateCalendar:true, delCalendar:true, canManagePhotos:false, delPhotos:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:true, canApproveNews:false, canViewNewsRead:true,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Abkürzungen & Dokumente', 'Psychologie', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'MD Intern', 'Psychologie']
    },
    personalabteilung: {
        id:'personalabteilung', name:'Personalabteilung', color:'#ec4899', icon:'💼', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false,
        canCreateCalendar:true, delCalendar:false, canManagePhotos:true, delPhotos:true,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:true, canApproveNews:true, canViewNewsRead:true,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:true, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Abkürzungen & Dokumente', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'MD Intern']
    },
    mitarbeiter: {
        id:'mitarbeiter', name:'Mitarbeiter', color:'#64748b', icon:'👨‍⚕️', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false,
        canCreateCalendar:true, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Abkürzungen & Dokumente', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'MD Intern']
    }
};
let cachedRoles = Object.assign({}, defaultRoles);

const ROLE_PROPERTY_MAP = {
    roleFlagAdmin: 'isAdmin',
    roleFlagMasterAdmin: 'isMasterAdmin',
    delFlagUsers: 'delUsers',
    roleFlagManageFeedback: 'canManageFeedback',
    delFlagFeedback: 'delFeedback',
    roleFlagEditPrices: 'canEditPrices',
    roleFlagArchive: 'canViewArchive',
    roleFlagEditAllPatients: 'canEditAllPatients',
    delFlagPatient: 'delPatient',
    delFlagArchiv: 'delArchiv',
    roleFlagManagePhotos: 'canManagePhotos',
    delFlagPhotos: 'delPhotos',
    roleFlagCreateCalendar: 'canCreateCalendar',
    delFlagCalendar: 'delCalendar',
    roleFlagPostNews: 'canPostNews',
    roleFlagApproveNews: 'canApproveNews',
    roleFlagViewNewsRead: 'canViewNewsRead',
    delFlagNews: 'delNews',
    roleFlagInstructor: 'isInstructor',
    roleFlagManageInstructors: 'canManageInstructors',
    roleFlagManageExams: 'canManageExams',
    delFlagExams: 'delExams',
    roleFlagEditGuide: 'canEditGuide',
    delFlagGuide: 'delGuide',
    roleFlagEditCommands: 'canEditCommands',
    delFlagCommands: 'delCommands',
    roleFlagEditLinks: 'canEditLinks',
    delFlagLinks: 'delLinks'
};

/* ── Standard-Guide-Daten ───────────────────────────────────── */
let defaultGuideData = {
    tenCodes: [
        { id:"tc_1",  code:"10-1",  desc:"Auf Anfahrt",               color:"var(--warning)" },
        { id:"tc_2",  code:"10-2",  desc:"Am Einsatzort",              color:"var(--warning)" },
        { id:"tc_3",  code:"10-3",  desc:"Weg ins MD",                 color:"var(--warning)" },
        { id:"tc_4",  code:"10-4",  desc:"Verstanden, Ende",           color:"var(--success)" },
        { id:"tc_5",  code:"10-5",  desc:"Einsatz Beendet",            color:"var(--success)" },
        { id:"tc_6",  code:"10-6",  desc:"Auf Zuteilung",              color:"var(--primary)" },
        { id:"tc_7",  code:"10-7",  desc:"Auf Bereitschaft",           color:"var(--primary)" },
        { id:"tc_8",  code:"10-8",  desc:"Statusabfrage",              color:"var(--primary)" },
        { id:"tc_9",  code:"10-9",  desc:"Funkspruch wiederholen",     color:"var(--text-main)" },
        { id:"tc_10", code:"10-10", desc:"Weiterer RTW benötigt",      color:"var(--warning)" },
        { id:"tc_11", code:"10-11", desc:"Im Dienst",                  color:"var(--success)" },
        { id:"tc_12", code:"10-12", desc:"Dienstende",                 color:"var(--danger)" },
        { id:"tc_13", code:"10-20", desc:"Aktives Schussgefecht",      color:"var(--danger)" },
        { id:"tc_14", code:"10-19", desc:"Abholung benötigt",          color:"var(--warning)" },
        { id:"tc_15", code:"11-44", desc:"RTW von PD/USMS benötigt",   color:"var(--danger)" },
        { id:"tc_16", code:"11-99", desc:"Medic in Gefahr (Code Red)", color:"var(--danger)" }
    ],
    statusCodes: [
        { id:"sc_1", code:"1", desc:"Ausbildung", color:"var(--primary)" },
        { id:"sc_2", code:"2", desc:"verfügbar",  color:"var(--success)" },
        { id:"sc_3", code:"3", desc:"In Pause",   color:"var(--warning)" },
        { id:"sc_4", code:"4", desc:"Psychologie",color:"var(--primary)" },
        { id:"sc_5", code:"5", desc:"Besprechung",color:"var(--text-main)" }
    ],
    streifen: [
        { id:"st_1", code:"1", desc:"Streifen",      color:"var(--primary)" },
        { id:"st_2", code:"2", desc:"Luftrettung",   color:"var(--primary)" },
        { id:"st_3", code:"3", desc:"Sonderstreife", color:"var(--primary)" },
        { id:"st_4", code:"4", desc:"Bereitschaft",  color:"var(--primary)" }
    ],
    keineRechnung: [
        { id:"kr_1", name:"Staatliche Fraktionen",           note:"(SAPD, USMS, DOJ & SAMD)",            desc:"Im Dienst wird keine Rechnung ausgestellt" },
        { id:"kr_2", name:"Mechaniker",                      note:"(Benny's, Redfield & Roxwood Tuning)", desc:"Im Dienst wird keine Rechnung ausgestellt" },
        { id:"kr_3", name:"Security C77 / Bahamas / Casino", note:"",                                    desc:"Im Dienst wird keine Rechnung ausgestellt" }
    ]
};
let cachedGuideData = JSON.parse(JSON.stringify(defaultGuideData));

/* ── Material & Szenarien ──────────────────────────────────── */
let materialKatalog = {
    mat_05mg:        { name:"05mg Schmerzmittel", preis:200 },
    mat_10mg:        { name:"10mg Schmerzmittel", preis:400 },
    mat_15mg:        { name:"15mg Schmerzmittel", preis:600 },
    mat_20mg:        { name:"20mg Schmerzmittel", preis:800 },
    mat_schiene:     { name:"Schiene",            preis:600 },
    mat_naehset:     { name:"Nähset",             preis:350 },
    mat_wundreiniger:{ name:"Wundreiniger",        preis:150 },
    mat_ehk:         { name:"EHK",                preis:400 },
    mat_kuehlpack:   { name:"Kühlpack",           preis:200 },
    mat_verband:     { name:"Verband",            preis:200 },
    mat_wasser:      { name:"Wasser",             preis:200 }
};

let szenarioTemplates = {
    "Undefinierbar":  { mat_wundreiniger:1, mat_naehset:1, mat_verband:1, mat_10mg:1 },
    "Schnittwunde":   { mat_wundreiniger:1, mat_naehset:1, mat_verband:1, mat_15mg:1 },
    "Schusswunde":    { mat_wundreiniger:1, mat_naehset:1, mat_verband:1, mat_20mg:1 },
    "Stumpfe Gewalt": { mat_schiene:1, mat_naehset:1, mat_verband:1, mat_kuehlpack:1, mat_05mg:1 }
};

let previousSelectedSzenario = "";

let medicDatenbank = {
    "Stumpfe Gewalt": ["Rechnung stellen","Vitalwerte prüfen","Schiene anlegen","Wunde nähen","Verband anlegen","Kühlpack verwenden","Schmerzmittel verabreichen (5 mg)"],
    "Schusswunde":    ["Rechnung stellen","Vitalwerte prüfen","Kugelzange benutzen","Wundreinigung durchführen","Wunde nähen","Verband anlegen","Schmerzmittel verabreichen (20 mg)"],
    "Schnittwunde":   ["Rechnung stellen","Vitalwerte prüfen","Wundreinigung durchführen","Wunde nähen","Verband anlegen","Schmerzmittel verabreichen (15 mg)"],
    "Undefinierbar":  ["Rechnung stellen","Vitalwerte prüfen","Wundreinigung durchführen","Wunde nähen","Verband anlegen","Schmerzmittel verabreichen (10 mg)"]
};

let defaultCommands = {
    cmd_1: { name:"!Psych",       desc:"Psych anforderungen",  kat:"Psychologie" },
    cmd_2: { name:"!waffenschein",desc:"Warten für die Überprüfung", kat:"Psychologie" },
    cmd_3: { name:"/editmdthud",  desc:"MD HUD ändern", kat:"T-Codes" },
    cmd_4: { name:"PSGU Test",    desc:"Psychologisches Gutachten Leitfaden", kat:"Abkürzungen & Dokumente" },
    cmd_5: { name:"CLS",          desc:"Combat Life Saver Protokoll", kat:"Abkürzungen & Dokumente" },
    cmd_6: { name:"EHK",          desc:"Erste Hilfe Kurs Vorlage", kat:"Abkürzungen & Dokumente" },
    cmd_7: { name:"!ausbildung",  desc:"Ausbildungsanfrage stellen", kat:"Ausbildung" },
    cmd_8: { name:"!pruefung",    desc:"Prüfungsanmeldung", kat:"Ausbildung" },
    cmd_9: { name:"!ehkleiter",   desc:"Ausbildung zum EHK Ausbilder", kat:"Ausbildungsabteilung" },
    cmd_10: { name:"!arzt3info",  desc:"Infoblatt Arzt 3", kat:"Ausbildungsabteilung" },
    cmd_11: { name:"!para3info",  desc:"Infoblatt Paramedic 3", kat:"Ausbildungsabteilung" },
    cmd_12: { name:"!info",       desc:"Infoblatt Schemen, Gerätschaften und Medikamente", kat:"Ausbildungsabteilung" },
    cmd_13: { name:"/rename",     desc:"Ticket für Termin umbenennen im Discord", kat:"Psychologie" }
};

let defaultLinks = {
    link_8: { name:"Leitfaden EHK Original",            url:"https://docs.google.com/document/d/1v5fRU_FgLcElt5Tc5DGe_pUp3kzrCZEx0Llmi85rt5M/edit", desc:"Leitfaden zum Erste Hilfe Kurs", kat:"EHK" },
    link_9: { name:"Leitfaden Combat Life Saver",       url:"https://docs.google.com/document/d/1aLWK8zhFfqTdbvrTECvkStKCTgvuMCaah0xPlCJxNfU/edit", desc:"Leitfaden zum Combat Life Saver Kurs", kat:"CLS" },
    link_10:{ name:"Dokumente Psychologie",             url:"https://docs.google.com/document/d/19kLhrw9PDfk4Jmv9Yqo4l1JfUWh2HoEPf_WdZgVylBM/edit", desc:"Patienten Akten der Psychologie", kat:"Psychologie" },
    link_11:{ name:"Dienstvorschriften",                url:"https://docs.google.com/document/d/11q46KTgY9v0zysC-_xPgnyiFyqhtzTeMhUP0CGyAj3Q/edit", desc:"Dienstvorschriften", kat:"MD Intern" },
    link_12:{ name:"Sanktionskatalog",                  url:"https://docs.google.com/spreadsheets/d/1BXxvqmkU_1N9MwHMLimZlPRGtT668xMzkhxqH_hhm9k/edit", desc:"Sanktionskatalog", kat:"MD Intern" }
};

const STANDARD_INFO_QUESTIONS = [
    { id: 1, text: "Dienstnummer des Mitarbeiters", type: "text", isInfo: true },
    { id: 2, text: "Dienstnummer des Prüfers", type: "text", isInfo: true },
    { id: 3, text: "Vor- und Nachname des Mitarbeiters", type: "text", isInfo: true }
];

/* ── Audit Logger ──────────────────────────────────────────── */
function logAdminAudit(action, details) {
    if (!sessionUser) return;
    db.ref('data/auditLogs').push({
        action: action,
        details: details,
        admin: (sessionUser.vorname || '') + ' ' + (sessionUser.nachname || ''),
        ts: Date.now()
    });
};

// ============================================================
//  MMD CLOUD – Medical Center Web-App  |  app.js  v6.4.2
//  Firebase Realtime Database (Compat SDK v10)
// ============================================================

/* ── Rollen & Berechtigungen (Single Source of Truth) ──────── */
function getUserRolesList(user) {
    if (!user) return [];
    let list = [];
    if (user.roles) {
        if (Array.isArray(user.roles)) {
            list = [...user.roles];
        } else if (typeof user.roles === 'object') {
            list = Object.keys(user.roles).filter(k => user.roles[k] === true);
        }
    }
    // Kompatibilität für alte Konten: Die frühere Rolle "admin" wird seit v6.4.0 als Chief-Ebene behandelt.
    list = list.map(roleId => roleId === 'admin' ? 'chiefebene' : roleId);
    if (user.isMasterAdmin && !list.includes('masteradmin')) {
        list.unshift('masteradmin');
    }
    return [...new Set(list)];
}

function getUserEffectivePermissions(user) {
    const eff = {
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false,
        canCreateCalendar:true, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: [],
        allowedLinkKats: []
    };
    if (!user) return eff;

    const roleIds = getUserRolesList(user);
    let accumulatedCmdKats = [];
    let accumulatedLinkKats = [];
    let hasUnrestrictedRole = false;

    roleIds.forEach(rId => {
        const role = cachedRoles[rId] || defaultRoles[rId];
        if (!role) return;

        const cmdKats = normalizeKats(role.allowedCmdKats);
        const linkKats = normalizeKats(role.allowedLinkKats);

        if (role.isAdmin || role.isMasterAdmin) {
            hasUnrestrictedRole = true;
        }

        Object.keys(eff).forEach(prop => {
            if (prop === 'allowedCmdKats') {
                accumulatedCmdKats.push(...cmdKats);
            } else if (prop === 'allowedLinkKats') {
                accumulatedLinkKats.push(...linkKats);
            } else if (role[prop]) {
                eff[prop] = true;
            }
        });
    });

    const isMaster = !!user.isMasterAdmin || roleIds.includes('masteradmin');

    if (isMaster || eff.isAdmin || hasUnrestrictedRole) {
        eff.allowedCmdKats = [];
        eff.allowedLinkKats = [];
    } else {
        eff.allowedCmdKats = [...new Set(accumulatedCmdKats)];
        eff.allowedLinkKats = [...new Set(accumulatedLinkKats)];
    }

    if (isMaster) {
        Object.keys(eff).forEach(k => {
            if (k !== 'allowedCmdKats' && k !== 'allowedLinkKats') eff[k] = true;
        });
        eff.allowedCmdKats = [];
        eff.allowedLinkKats = [];
    }
    return eff;
}

const SERVER_PERMISSION_KEYS = [
    'isAdmin','isMasterAdmin','canViewArchive','canEditAllPatients',
    'canCreateCalendar','delCalendar','canManagePhotos','delPhotos',
    'isInstructor','canManageInstructors','canManageExams',
    'canPostNews','canApproveNews','canViewNewsRead',
    'canEditPrices','canEditGuide','canEditCommands','canEditLinks',
    'delPatient','delArchiv','delGuide','delCommands','delLinks',
    'delNews','delExams','delUsers','canManageFeedback','delFeedback'
];

function buildServerPermissions(user) {
    const eff = getUserEffectivePermissions(user || {});
    const out = {};
    SERVER_PERMISSION_KEYS.forEach(key => { out[key] = !!eff[key]; });
    return out;
}

async function syncServerPermissionsForUser(uId, userOverride = null) {
    if (!uId) return;
    const user = userOverride || cachedUsers[uId];
    if (!user) return;
    await db.ref(`data/users/${uId}/serverPermissions`).set(buildServerPermissions(user));
}

async function syncServerPermissionsForAllUsers() {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isAdmin && !eff.isMasterAdmin) return;
    const snap = await db.ref('data/users').once('value');
    const users = snap.val() || {};
    const updates = {};
    Object.entries(users).forEach(([uId, user]) => {
        updates[`data/users/${uId}/serverPermissions`] = buildServerPermissions(user);
    });
    if (Object.keys(updates).length) await db.ref().update(updates);
}

function requirePermission(permissionNames, message = 'Keine Berechtigung für diese Aktion!') {
    if (!sessionUser) {
        alert('Bitte zuerst anmelden.');
        return false;
    }
    const eff = getUserEffectivePermissions(sessionUser);
    const names = Array.isArray(permissionNames) ? permissionNames : [permissionNames];
    if (names.some(name => !!eff[name])) return true;
    alert(message);
    return false;
}

function requireAdminAccess(message = 'Diese Funktion ist nur für Administratoren verfügbar!') {
    return requirePermission(['isAdmin', 'isMasterAdmin'], message);
}

function requireMasterAdminAccess(message = 'Diese Funktion ist nur für Master-Admins verfügbar!') {
    return requirePermission('isMasterAdmin', message);
}

function isPrivilegedUser(user) {
    if (!user) return false;
    const roles = getUserRolesList(user);
    const hasPrivilegedRole = roles.some(rId => {
        const role = cachedRoles[rId] || defaultRoles[rId];
        return !!(role?.isAdmin || role?.isMasterAdmin || rId === 'admin' || rId === 'masteradmin');
    });
    return !!(user.isAdmin || user.isMasterAdmin || hasPrivilegedRole);
}

function canCurrentUserManageTargetUser(uId) {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isAdmin && !eff.isMasterAdmin && !eff.canManageInstructors) return false;
    const target = cachedUsers[uId];
    if (target && isPrivilegedUser(target) && !eff.isMasterAdmin) return false;
    return true;
}

function requireTargetUserManagement(uId) {
    if (canCurrentUserManageTargetUser(uId)) return true;
    alert('Privilegierte Admin-Konten dürfen nur von einem Master-Admin verändert werden!');
    return false;
}

function canCurrentUserManageExams() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    return !!(eff.canManageExams || eff.isAdmin || eff.isMasterAdmin);
}

function canUserManageEmployeePhotos() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    const roles = getUserRolesList(sessionUser);
    const isPersonalabteilung = roles.some(r => r.toLowerCase().includes('perso') || r.toLowerCase().includes('personal'));
    return eff.canManagePhotos || eff.isAdmin || eff.isMasterAdmin || isPersonalabteilung;
}

function isUserInstructor() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    return eff.isInstructor || eff.canManageInstructors || eff.isAdmin || eff.isMasterAdmin;
}

function canInstructorAccessExam(examId) {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    if (eff.isAdmin || eff.isMasterAdmin || eff.canManageInstructors || eff.canManageExams) {
        return true;
    }
    const myPassed = (sessionUser.passedExams) || (cachedUsers[getUserAccountId(sessionUser)]?.passedExams) || {};
    return !!myPassed[examId];
}

function renderUserRoleBadges(user, isTopBar = false) {
    if (!user) return '';
    const roleIds = getUserRolesList(user);
    if (!roleIds.length) return '<span class="user-role-badge" style="background:#64748b22;color:#94a3b8;border:1px solid #64748b44;font-size:11px;padding:2px 8px;border-radius:6px;">Mitarbeiter</span>';
    
    if (isTopBar && roleIds.length > 2) {
        const topRoles = roleIds.slice(0, 2);
        const remaining = roleIds.length - 2;
        const allNames = escapeHtml(roleIds.map(rId => (cachedRoles[rId] || defaultRoles[rId])?.name || rId).join(', '));
        const badgesHtml = topRoles.map(rId => {
            const r = cachedRoles[rId] || defaultRoles[rId];
            if (!r) return '';
            const c = sanitizeRoleColor(r.color);
            return `<span class="user-role-badge" style="background:${c}22;color:${c};border:1px solid ${c}44;font-size:11px;padding:2px 8px;border-radius:6px;white-space:nowrap;">${r.icon ? escapeHtml(r.icon) + ' ' : ''}${escapeHtml(r.name)}</span>`;
        }).join('');
        return badgesHtml + `<span class="user-role-badge" title="${allNames}" style="background:rgba(255,255,255,0.1);color:var(--text-muted);border:1px solid var(--border);font-size:10px;padding:2px 6px;border-radius:6px;cursor:pointer;white-space:nowrap;">+${remaining} weitere</span>`;
    }

    return roleIds.map(rId => {
        const r = cachedRoles[rId] || defaultRoles[rId];
        if (!r) return '';
        const c = sanitizeRoleColor(r.color);
        return `<span class="user-role-badge" style="background:${c}22;color:${c};border:1px solid ${c}44;font-size:11px;padding:2px 8px;border-radius:6px;white-space:nowrap;display:inline-block;margin:2px;">${r.icon ? escapeHtml(r.icon) + ' ' : ''}${escapeHtml(r.name)}</span>`;
    }).join('');
}

/* ── Authentifizierung ─────────────────────────────────────── */
function toggleAuthTab(tab) {
    currentAuthTab = tab;
    const loginBtn = document.getElementById('tabLoginBtn');
    const registerBtn = document.getElementById('tabRegisterBtn');
    loginBtn?.classList.toggle('active', tab === 'login');
    registerBtn?.classList.toggle('active', tab === 'register');
    loginBtn?.setAttribute('aria-selected', tab === 'login' ? 'true' : 'false');
    registerBtn?.setAttribute('aria-selected', tab === 'register' ? 'true' : 'false');
    document.getElementById('mainAuthActionBtn').textContent = tab === 'login' ? 'Dienst antreten' : 'Account beantragen';
    document.getElementById('authPassword').placeholder = tab === 'login' ? 'Passwort' : 'Passwort ausdenken';
    const dnC = document.getElementById('authDNContainer');
    if (dnC) dnC.style.display = tab === 'login' ? 'none' : 'block';
}

async function readLoginDirectory(loginKey) {
    try {
        const snap = await db.ref(`data/loginDirectory/${loginKey}`).once('value');
        const raw = snap.val();
        if (!raw || typeof raw !== 'object') return { loginKey, accountId: loginKey, version: 0, exists: false };
        const versionRaw = Number(raw.version);
        const version = Number.isFinite(versionRaw) && versionRaw >= 1 ? Math.floor(versionRaw) : 0;
        const accountId = (typeof raw.accountId === 'string' && raw.accountId.trim()) ? raw.accountId.trim() : loginKey;
        const transitionIterationsRaw = Number(raw.transitionIterations);
        return {
            loginKey,
            accountId,
            version,
            exists: true,
            deleted: !!raw.deleted,
            transitionMode: raw.transitionMode === 'legacy-kdf-v1',
            transitionSalt: typeof raw.transitionSalt === 'string' ? raw.transitionSalt : '',
            transitionIterations: Number.isFinite(transitionIterationsRaw) && transitionIterationsRaw > 0
                ? Math.floor(transitionIterationsRaw)
                : PASSWORD_HASH_ITERATIONS
        };
    } catch (err) {
        if (err?.code === 'PERMISSION_DENIED' || err?.code === 'permission-denied') {
            return { loginKey, accountId: loginKey, version: 0, exists: false };
        }
        throw err;
    }
}

async function readLoginVersion(loginKey) {
    const directory = await readLoginDirectory(loginKey);
    return directory.version;
}

async function loadAuthenticatedProfile(firebaseUser) {
    if (!firebaseUser) throw new Error('Keine Firebase-Anmeldung vorhanden.');
    const indexSnap = await db.ref(`data/authIndex/${firebaseUser.uid}`).once('value');
    const uId = indexSnap.val();
    if (!uId || typeof uId !== 'string') {
        throw new Error('Dieser Firebase-Zugang ist keinem MD-Mitarbeiterkonto zugeordnet.');
    }

    const userSnap = await db.ref(`data/users/${uId}`).once('value');
    const user = userSnap.val();
    if (!user) throw new Error('Das zugehörige MD-Mitarbeiterkonto wurde nicht gefunden.');
    if (user.authUid && user.authUid !== firebaseUser.uid) {
        throw new Error('Dieser Firebase-Zugang wurde durch einen neueren Zugang ersetzt.');
    }
    return { uId, user: withStableAccountId(uId, user) };
}

async function completeFirebaseAuthMapping(uId, rawUser, firebaseUser, version = 1) {
    if (!uId || !rawUser || !firebaseUser) throw new Error('Unvollständige Auth-Migration.');
    const loginKey = generateUserId(rawUser.vorname, rawUser.nachname);
    const cleanUserForPermissions = Object.assign({}, rawUser, { accountId: uId, loginKey, authUid: firebaseUser.uid, authVersion: version });
    const updates = {};
    updates[`data/authIndex/${firebaseUser.uid}`] = uId;
    updates[`data/loginDirectory/${loginKey}`] = { version: Math.max(1, Number(version) || 1), accountId: uId };
    updates[`data/users/${uId}/accountId`] = uId;
    updates[`data/users/${uId}/loginKey`] = loginKey;
    updates[`data/users/${uId}/authUid`] = firebaseUser.uid;
    updates[`data/users/${uId}/authVersion`] = Math.max(1, Number(version) || 1);
    updates[`data/users/${uId}/serverPermissions`] = buildServerPermissions(cleanUserForPermissions);
    updates[`data/users/${uId}/pass`] = null;
    updates[`data/users/${uId}/passwordHash`] = null;
    updates[`data/users/${uId}/passwordSalt`] = null;
    updates[`data/users/${uId}/passwordAlgo`] = null;
    updates[`data/users/${uId}/passwordIterations`] = null;
    updates[`data/users/${uId}/passwordVersion`] = null;
    updates[`data/users/${uId}/passwordUpdatedAt`] = null;

    const previousLoginKey = rawUser.loginKey || uId;
    if (previousLoginKey && previousLoginKey !== loginKey) {
        updates[`data/loginDirectory/${previousLoginKey}`] = null;
    }

    if (rawUser.authUid && rawUser.authUid !== firebaseUser.uid) {
        updates[`data/authIndex/${rawUser.authUid}`] = null;
    }
    await db.ref().update(updates);
}

async function migrateLegacyUserOnLogin(uId, password) {
    let snap;
    try {
        snap = await db.ref(`data/users/${uId}`).once('value');
    } catch (err) {
        const e = new Error('Dieser ältere Account wurde noch nicht in Firebase Authentication übernommen. Bitte den Master-Admin kontaktieren.');
        e.code = 'mmd/legacy-migration-locked';
        throw e;
    }

    const rawUser = snap.val();
    if (!rawUser || !(await verifyUserPassword(rawUser, password))) {
        const e = new Error('Falscher Name oder falsches Passwort!');
        e.code = 'mmd/invalid-credentials';
        throw e;
    }

    const effectiveStatus = rawUser.status || ((rawUser.isAdmin || rawUser.isMasterAdmin) ? 'approved' : 'pending');
    if (effectiveStatus !== 'approved') {
        const e = new Error('Dein Account wurde noch nicht freigeschaltet oder ist gesperrt!');
        e.code = 'mmd/account-not-approved';
        throw e;
    }

    let firebasePassword = password;
    if (firebasePassword.length < 6) {
        const replacement = prompt(
            'Dein bisheriges MD-Passwort ist kürzer als die von Firebase vorgeschriebenen 6 Zeichen.\n\n' +
            'Bitte lege jetzt einmalig ein neues Passwort mit mindestens 6 Zeichen fest. Dieses neue Passwort gilt anschließend für deine MD-Anmeldung.'
        );
        if (!replacement || replacement.length < 6) {
            const e = new Error('Für die sichere Umstellung wird ein neues Passwort mit mindestens 6 Zeichen benötigt.');
            e.code = 'mmd/password-too-short';
            throw e;
        }
        firebasePassword = replacement;
    }

    const version = Math.max(1, Number(rawUser.authVersion) || 1);
    const email = getTechnicalAuthEmail(uId, version);
    let credential;

    try {
        credential = await auth.createUserWithEmailAndPassword(email, firebasePassword);
    } catch (err) {
        if (err?.code === 'auth/email-already-in-use') {
            credential = await auth.signInWithEmailAndPassword(email, firebasePassword);
        } else {
            throw err;
        }
    }

    await completeFirebaseAuthMapping(uId, rawUser, credential.user, version);
    return { uId, user: withStableAccountId(uId, Object.assign({}, rawUser, {
        accountId: uId,
        loginKey: generateUserId(rawUser.vorname, rawUser.nachname),
        authUid: credential.user.uid,
        authVersion: version,
        serverPermissions: buildServerPermissions(rawUser)
    })) };
}

async function signInWithLegacyTransition(directory, enteredPassword) {
    if (!directory?.transitionMode || !directory.transitionSalt || !directory.version || !directory.accountId) {
        const e = new Error('Für dieses Konto ist kein gültiger Übergangslogin hinterlegt.');
        e.code = 'mmd/no-transition-login';
        throw e;
    }

    const verifierHash = await derivePasswordHash(
        enteredPassword,
        directory.transitionSalt,
        directory.transitionIterations || PASSWORD_HASH_ITERATIONS
    );
    const transitionPassword = await deriveTransitionFirebasePassword(verifierHash, directory.accountId, directory.version);
    const email = getTechnicalAuthEmail(directory.accountId, directory.version);
    return auth.signInWithEmailAndPassword(email, transitionPassword);
}

async function forcePasswordChangeAfterTransition(profile) {
    if (!profile?.user?.mustChangePassword) return profile;
    if (!auth.currentUser) throw new Error('Keine aktive Firebase-Anmeldung für die Passwortänderung vorhanden.');

    alert('🔐 Dein MD-Konto wurde auf die neue sichere Anmeldung umgestellt.\n\nBevor du fortfahren kannst, musst du jetzt ein neues persönliches Passwort festlegen.');

    while (true) {
        const first = prompt('Neues Passwort festlegen (mindestens 6 Zeichen):');
        if (first === null) {
            const e = new Error('Die Anmeldung wurde abgebrochen. Für dieses Konto ist zuerst eine Passwortänderung erforderlich.');
            e.code = 'mmd/password-change-required';
            throw e;
        }
        if (first.length < 6) {
            alert('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
            continue;
        }
        const second = prompt('Neues Passwort zur Bestätigung erneut eingeben:');
        if (second === null) {
            const e = new Error('Die Anmeldung wurde abgebrochen. Für dieses Konto ist zuerst eine Passwortänderung erforderlich.');
            e.code = 'mmd/password-change-required';
            throw e;
        }
        if (first !== second) {
            alert('Die beiden Passwörter stimmen nicht überein. Bitte erneut versuchen.');
            continue;
        }

        await auth.currentUser.updatePassword(first);
        await db.ref(`data/users/${profile.uId}/mustChangePassword`).set(false);
        profile.user.mustChangePassword = false;
        alert('✅ Neues Passwort gespeichert. Du kannst dich ab jetzt mit diesem Passwort anmelden.');
        return profile;
    }
}

async function registerNewFirebaseUser(v, n, p, dn) {
    const loginKey = generateUserId(v, n);
    const uId = loginKey; // initiale feste Account-ID; sie bleibt auch bei späteren Namensänderungen bestehen
    if (!uId) throw new Error('Aus Vor- und Nachname konnte keine gültige Benutzer-ID erzeugt werden.');

    const knownDirectory = await readLoginDirectory(loginKey);
    if (knownDirectory.exists && !knownDirectory.deleted) {
        const e = new Error('Dieser Name ist bereits registriert!');
        e.code = 'mmd/already-registered';
        throw e;
    }

    // Während der einmaligen Migration kann ein älterer Datensatz bereits existieren,
    // obwohl noch kein Login-Verzeichnis angelegt wurde.
    try {
        const existingSnap = await db.ref(`data/users/${uId}`).once('value');
        if (existingSnap.exists()) {
            const e = new Error('Dieser Name ist bereits registriert!');
            e.code = 'mmd/already-registered';
            throw e;
        }
    } catch (err) {
        if (err?.code === 'mmd/already-registered') throw err;
        // Unter den finalen Regeln darf ein nicht zugeordneter Neu-Account die Benutzerliste
        // nicht vorab lesen. Firebase Auth + authIndex übernehmen danach die sichere Zuordnung.
    }

    // Nach einer früheren Löschung bleibt das alte Firebase-Auth-Konto technisch bestehen.
    // Deshalb wird die nächste freie technische Version verwendet (v2, v3, ...), statt
    // erneut dieselbe technische E-Mail zu verwenden.
    const previousVersion = Math.max(0, Number(knownDirectory.version) || 0);
    let version = knownDirectory.exists && knownDirectory.deleted ? previousVersion + 1 : 1;
    let credential = null;
    const maxVersionAttempts = 25;

    try {
        for (let attempt = 0; attempt < maxVersionAttempts; attempt++, version++) {
            const email = getTechnicalAuthEmail(uId, version);
            try {
                credential = await auth.createUserWithEmailAndPassword(email, p);
                break;
            } catch (err) {
                if (err?.code === 'auth/email-already-in-use') continue;
                throw err;
            }
        }

        if (!credential?.user) {
            const e = new Error('Für diesen Namen existieren bereits mehrere alte technische Zugänge. Bitte den Master-Admin kontaktieren.');
            e.code = 'mmd/registration-version-exhausted';
            throw e;
        }

        const firebaseUser = credential.user;
        const todayIso = new Date().toLocaleDateString('sv-SE');
        const baseUser = {
            accountId: uId,
            loginKey,
            vorname: v,
            nachname: n,
            dn,
            status: 'pending',
            date: new Date().toLocaleDateString('de-DE'),
            einstellungsDatum: todayIso,
            roles: { mitarbeiter: true },
            photoUrl: 'mdlogo.png',
            authUid: firebaseUser.uid,
            authVersion: version
        };
        baseUser.serverPermissions = buildServerPermissions(baseUser);

        // Zuerst wird ausschließlich die neue Firebase-UID zugeordnet. Ein alter Auth-Zugang
        // bleibt ohne authIndex und besitzt daher weiterhin keinen Zugriff auf die MD-Daten.
        await db.ref(`data/authIndex/${firebaseUser.uid}`).set(uId);

        if (knownDirectory.exists && knownDirectory.deleted) {
            // Vorhandenen Löschmarker kontrolliert reaktivieren und die technische Version erhöhen.
            await db.ref(`data/loginDirectory/${loginKey}`).update({
                version,
                accountId: uId,
                deleted: false
            });
        } else {
            // Bei einer komplett neuen Registrierung darf die erste freie technische Version
            // auch größer als 1 sein, falls ein verwaister alter Firebase-Auth-Zugang existiert.
            await db.ref(`data/loginDirectory/${loginKey}`).set({ version, accountId: uId });
        }

        await db.ref(`data/users/${uId}`).set(baseUser);
        const registrationCheck = await db.ref(`data/users/${uId}`).once('value');
        if (!registrationCheck.exists() || registrationCheck.val()?.status !== 'pending') {
            throw new Error('Die Registrierung konnte nicht vollständig in der Mitarbeiterverwaltung gespeichert werden.');
        }

        await auth.signOut();
        return uId;
    } catch (err) {
        console.error('Registrierung fehlgeschlagen:', err);

        // Bestmöglicher Rollback, solange der gerade neu erstellte Firebase-Nutzer noch
        // angemeldet ist. Bestehende Löschmarker werden wiederhergestellt.
        if (credential?.user?.uid) {
            try {
                if (knownDirectory.exists && knownDirectory.deleted) {
                    await db.ref(`data/loginDirectory/${loginKey}`).update({
                        version: previousVersion || 1,
                        accountId: uId,
                        deleted: true
                    });
                } else {
                    await db.ref(`data/loginDirectory/${loginKey}`).remove();
                }
            } catch (rollbackErr) {
                console.warn('Login-Verzeichnis konnte beim Registrierungs-Rollback nicht vollständig zurückgesetzt werden:', rollbackErr);
            }

            try { await db.ref(`data/authIndex/${credential.user.uid}`).remove(); } catch (rollbackErr) {
                console.warn('Auth-Zuordnung konnte beim Registrierungs-Rollback nicht entfernt werden:', rollbackErr);
            }
            try { await credential.user.delete(); } catch (_) {}
        }

        if (err?.code === 'auth/email-already-in-use') {
            const e = new Error('Ein alter technischer Zugang blockiert diese Registrierung. Bitte den Master-Admin kontaktieren.');
            e.code = 'mmd/old-auth-account-conflict';
            throw e;
        }
        throw err;
    }
}

async function handleAuthAction() {
    const v = (document.getElementById('authVorname')?.value || '').trim();
    const n = (document.getElementById('authNachname')?.value || '').trim();
    const p = (document.getElementById('authPassword')?.value || '').trim();
    if (!v || !n || !p) { alert('Bitte alle Felder ausfüllen!'); return; }
    const loginKey = generateUserId(v, n);

    try {
        await configureFirebaseAuthPersistence();

        if (currentAuthTab === 'register') {
            const dn = (document.getElementById('authDN')?.value || '').trim();
            if (!dn) { alert('Bitte Dienstnummer eingeben!'); return; }
            if (p.length < 6) { alert('Das Passwort muss mindestens 6 Zeichen lang sein!'); return; }

            await registerNewFirebaseUser(v, n, p, dn);
            alert('Registrierung erfolgreich! Bitte warten Sie auf die Freischaltung durch die Leitung.');
            location.reload();
            return;
        }

        const directory = await readLoginDirectory(loginKey);
        const accountId = directory.accountId || loginKey;
        const version = directory.version;
        let profile;

        if (version) {
            const email = getTechnicalAuthEmail(accountId, version);
            try {
                const credential = await auth.signInWithEmailAndPassword(email, p);
                profile = await loadAuthenticatedProfile(credential.user);
            } catch (err) {
                try { await auth.signOut(); } catch (_) {}
                const wrongCredential = ['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(err?.code);
                if (wrongCredential && directory.transitionMode) {
                    try {
                        const credential = await signInWithLegacyTransition(directory, p);
                        profile = await loadAuthenticatedProfile(credential.user);
                    } catch (transitionErr) {
                        try { await auth.signOut(); } catch (_) {}
                        if (['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(transitionErr?.code)) {
                            alert('Falscher Name oder falsches Passwort!');
                            return;
                        }
                        throw transitionErr;
                    }
                } else if (wrongCredential) {
                    alert('Falscher Name oder falsches Passwort!');
                    return;
                } else {
                    throw err;
                }
            }
        } else {
            profile = await migrateLegacyUserOnLogin(accountId, p);
        }

        const user = profile.user;
        const effectiveStatus = user.status || ((user.isAdmin || user.isMasterAdmin) ? 'approved' : 'pending');
        if (effectiveStatus !== 'approved') {
            await auth.signOut();
            alert('Dein Account wurde noch nicht freigeschaltet oder ist gesperrt!');
            return;
        }

        profile = await forcePasswordChangeAfterTransition(profile);
        initDienstEintritt(profile.user);
    } catch (err) {
        console.error('Anmeldefehler:', err);
        try { await auth.signOut(); } catch (_) {}
        if (err?.code === 'mmd/invalid-credentials') {
            alert('Falscher Name oder falsches Passwort!');
        } else if (err?.code === 'mmd/password-change-required') {
            alert(err.message);
        } else {
            alert(err?.message || 'Anmeldung konnte nicht abgeschlossen werden.');
        }
    }
}

/* ── Tägliches Zwangs-Logout (23:59 Uhr) ─────────────────────── */
function setupDailyForcedLogoutScheduler() {
    if (dailyForcedLogoutIntervalId) clearInterval(dailyForcedLogoutIntervalId);
    dailyForcedLogoutIntervalId = setInterval(checkDailyForcedLogout, 15000);
}

function checkDailyForcedLogout() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    if (hours === 23 && minutes >= 59) {
        executeDailyForcedLogout();
        return;
    }

    const sessionDate = sessionStorage.getItem('mmd_session_date');
    const todayFormatted = now.toLocaleDateString('de-DE');
    if (sessionDate && sessionDate !== todayFormatted) {
        executeDailyForcedLogout();
    }
}

async function executeDailyForcedLogout() {
    if (mySessionRef) {
        try { await mySessionRef.remove(); } catch (_) {}
        mySessionRef = null;
    }
    clearStoredSessionData();
    sessionUser = null;
    try { await auth.signOut(); } catch (_) {}

    alert('🛑 Täglicher System-Reset (23:59 Uhr):\n\nIhre Schichtsitzung wurde beendet. Bitte melden Sie sich für Ihren nächsten Dienst erneut an.');
    location.reload();
}

/* ── Dienst-Start & App Init ───────────────────────────────── */
function applyUserPermissions(user) {
    if (!user) return;
    const eff = getUserEffectivePermissions(user);
    const canManagePhotos = canUserManageEmployeePhotos();
    const isMaster = !!eff.isMasterAdmin;
    const isAdminOrMaster = (eff.isAdmin || isMaster);
    const canPostDirect = eff.canPostNews || isAdminOrMaster;
    
    const akBtn = document.getElementById('adminKeyBtn');
    if (akBtn) akBtn.style.display = isAdminOrMaster ? 'inline-block' : 'none';

    const canManageFeedback = !!(eff.canManageFeedback || isAdminOrMaster);
    const feedbackManageTabBtn = document.getElementById('feedbackManageTabBtn');
    if (feedbackManageTabBtn) feedbackManageTabBtn.style.display = canManageFeedback ? 'inline-flex' : 'none';
    if (!canManageFeedback && document.getElementById('feedbackManagePane')?.classList.contains('active')) {
        switchFeedbackCenterTab('feedbackSubmitPane', document.getElementById('feedbackSubmitTabBtn'));
    }

    const pEdit = document.getElementById('btnEditPricesInline');
    if (pEdit) pEdit.style.display = (eff.canEditPrices || isMaster) ? 'inline-block' : 'none';

    const szEdit = document.getElementById('btnEditSzenarienInline');
    if (szEdit) szEdit.style.display = (eff.canEditPrices || isMaster) ? 'inline-block' : 'none';

    const gEdit = document.getElementById('btnEditGuideInline');
    if (gEdit) gEdit.style.display = (eff.canEditGuide || isMaster) ? 'inline-block' : 'none';

    const cEdit = document.getElementById('btnEditCommandsInline');
    if (cEdit) cEdit.style.display = (eff.canEditCommands || isMaster) ? 'inline-block' : 'none';

    const lEdit = document.getElementById('btnEditLinksInline');
    if (lEdit) lEdit.style.display = (eff.canEditLinks || isMaster) ? 'inline-block' : 'none';

    const hEdit = document.getElementById('btnEditHierarchieInline');
    if (hEdit) hEdit.style.display = isAdminOrMaster ? 'inline-block' : 'none';

    const gehaltEdit = document.getElementById('btnEditGehaltInline');
    if (gehaltEdit) gehaltEdit.style.display = isAdminOrMaster ? 'inline-block' : 'none';

    const grpArchiv = document.getElementById('group-archiv');
    if (grpArchiv) grpArchiv.style.display = (eff.canViewArchive || isAdminOrMaster) ? 'block' : 'none';

    const npBtn = document.getElementById('btnOpenPostNews');
    if (npBtn) npBtn.style.display = canPostDirect ? 'inline-block' : 'none';

    const propNewsBtn = document.getElementById('btnProposeNews');
    if (propNewsBtn) propNewsBtn.style.display = canPostDirect ? 'none' : 'inline-block';

    const btnCal = document.getElementById('btnCreateCalendarEvent');
    if (btnCal) btnCal.style.display = (eff.canCreateCalendar || isAdminOrMaster) ? 'inline-block' : 'none';

    const btnPhotoAdmin = document.getElementById('btnOpenPhotoAdminModal');
    if (btnPhotoAdmin) btnPhotoAdmin.style.display = canManagePhotos ? 'inline-block' : 'none';

    const instrView = document.getElementById('examInstructorView');
    if (instrView) instrView.style.display = isUserInstructor() ? 'block' : 'none';

    const allowedExamsBtn = document.getElementById('instrAllowedExamsTabBtn');
    if (allowedExamsBtn) allowedExamsBtn.style.display = (eff.canManageInstructors || isAdminOrMaster) ? '' : 'none';

    const instrManageBtn = document.getElementById('instrTabManageBtn');
    if (instrManageBtn) instrManageBtn.style.display = (eff.canManageExams || isAdminOrMaster) ? '' : 'none';

    document.querySelectorAll('.admin-action-th').forEach(el => {
        el.style.display = (eff.delArchiv || isMaster) ? 'table-cell' : 'none';
    });

    const manualProtArchBtn = document.getElementById('btnManualProtArchive');
    if (manualProtArchBtn) manualProtArchBtn.style.display = isAdminOrMaster ? 'inline-block' : 'none';

    const changelogWriterBtn = document.getElementById('btnOpenChangelogWriter');
    if (changelogWriterBtn) changelogWriterBtn.style.display = isMaster ? 'inline-flex' : 'none';

    const adminSystemTabBtn = document.getElementById('btnAdminSubSystem');
    if (adminSystemTabBtn) adminSystemTabBtn.style.display = isMaster ? '' : 'none';
    const fullResetBtn = document.querySelector('#adminSubTabSystem .btn-full-reset');
    if (fullResetBtn) fullResetBtn.style.display = isMaster ? 'inline-block' : 'none';

    /* Wünsche & Bugs: Verwaltungsdaten nur für Rollen mit entsprechender Berechtigung */
    if (canManageFeedback) {
        db.ref('data/feedback').off();
        db.ref('data/feedback').on('value', s => {
            const raw = s.val() || {};
            cachedFeedback = Object.fromEntries(Object.entries(raw).map(([fbId, item]) => [
                fbId,
                Object.assign({}, item || {}, { storedId: item?.id || '', id: fbId })
            ]));
            renderFeedbackManagementTable();
        });
    } else {
        db.ref('data/feedback').off();
        cachedFeedback = {};
    }
}

function refreshSessionIdentityDisplay() {
    if (!sessionUser) return;
    const top = document.getElementById('topBarMedicName');
    if (top) top.innerHTML = '<b>' + escapeHtml(sessionUser.vorname || '') + ' ' + escapeHtml(sessionUser.nachname || '') + '</b> ' + renderUserRoleBadges(sessionUser, true);
    const settingsName = document.getElementById('settingsUserName');
    if (settingsName) settingsName.textContent = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim();
    const settingsDn = document.getElementById('settingsUserDn');
    if (settingsDn) settingsDn.textContent = sessionUser.dn || '--';
}

async function migrateLegacyAdminRoleToChief() {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).isMasterAdmin) return;
    try {
        const [usersSnap, rolesSnap] = await Promise.all([
            db.ref('data/users').once('value'),
            db.ref('data/roles/admin').once('value')
        ]);
        const users = usersSnap.val() || {};
        const updates = {};
        let changedUsers = 0;
        Object.entries(users).forEach(([uId, user]) => {
            if (!user?.roles?.admin) return;
            const newRoles = Object.assign({}, user.roles, { chiefebene: true });
            delete newRoles.admin;
            const updatedUser = Object.assign({}, user, { roles: newRoles });
            updates[`data/users/${uId}/roles`] = newRoles;
            updates[`data/users/${uId}/isAdmin`] = true;
            updates[`data/users/${uId}/serverPermissions`] = buildServerPermissions(updatedUser);
            changedUsers++;
        });
        if (rolesSnap.exists()) updates['data/roles/admin'] = null;
        if (!Object.keys(updates).length) return;
        await db.ref().update(updates);
        logAdminAudit('Admin-Rolle migriert', `${changedUsers} alte Admin-Zuordnung(en) wurden auf Chief-Ebene umgestellt.`);
    } catch (err) {
        console.error('Migration der alten Admin-Rolle fehlgeschlagen:', err);
    }
}

function initDienstEintritt(user) {
    sessionUser = withStableAccountId(user?.accountId || generateUserId(user?.vorname, user?.nachname), user);
    const todayFormatted = new Date().toLocaleDateString('de-DE');
    clearStoredSessionData();
    sessionStorage.setItem('mmd_session_active', 'true');
    sessionStorage.setItem('mmd_session_date', todayFormatted);

    document.getElementById('authView').style.display = 'none';
    document.getElementById('mainAppView').style.display = 'block';
    refreshSessionIdentityDisplay();

    applyUserPermissions(sessionUser);
    startPresenceWatcher();
    updateOnlineStatus();
    updateLiveDate();
    baueMaterialUIAuf();
    startFirebaseListeners();
    if (getUserEffectivePermissions(sessionUser).isMasterAdmin) {
        migrateLegacyAdminRoleToChief();
    }
    setupMidnightScheduler();
    setupDailyForcedLogoutScheduler();
    cleanOldCalendarEvents();

    const eDatumEl = document.getElementById('einstellungsDatum');
    if (eDatumEl) {
        if (sessionUser.einstellungsDatum) {
            eDatumEl.value = sessionUser.einstellungsDatum;
            berechneDienstTage(false);
        } else {
            const stableStorageKey = 'mmd_einstellungsdatum_' + getUserAccountId(sessionUser);
            const legacyStorageKey = 'mmd_einstellungsdatum_' + sessionUser.vorname + '_' + sessionUser.nachname;
            const gDatum = localStorage.getItem(stableStorageKey) || localStorage.getItem(legacyStorageKey);
            if (gDatum) {
                localStorage.setItem(stableStorageKey, gDatum);
                if (legacyStorageKey !== stableStorageKey) localStorage.removeItem(legacyStorageKey);
                eDatumEl.value = gDatum;
                berechneDienstTage(true);
            }
        }
    }
}

function updateLiveDate() {
    const el = document.getElementById('liveDateDisplay');
    if (el) el.textContent = new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
}

/* ── Automatische Mitternachts-Archivierung ─────────────────── */
function setupMidnightScheduler() {
    if (midnightIntervalId) clearInterval(midnightIntervalId);
    checkMidnightAutoArchive();
    midnightIntervalId = setInterval(checkMidnightAutoArchive, 20000);
}

function checkMidnightAutoArchive() {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isAdmin && !eff.isMasterAdmin) return;

    const todayFormatted = new Date().toLocaleDateString('de-DE');
    const statusRef = db.ref('data/systemStatus/lastArchiveDate');
    let previousArchiveDate = null;

    statusRef.transaction(currentValue => {
        previousArchiveDate = currentValue || null;
        if (!currentValue) return todayFormatted;
        if (currentValue === todayFormatted) return;
        return todayFormatted;
    }, (error, committed) => {
        if (error) {
            console.error('Transaktionsfehler beim Mitternachts-Archiv:', error);
            return;
        }
        if (!committed) return;

        if (previousArchiveDate && previousArchiveDate !== todayFormatted) {
            executeMidnightArchive(previousArchiveDate);
        }
    });
}

function executeMidnightArchive(archivedDateLabel) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isAdmin && !eff.isMasterAdmin) return;

    const archiveTimestamp = Date.now();

    db.ref('data/protokoll').once('value', s => {
        const p = s.val() || {};
        const matchingEntries = Object.entries(p).filter(([, entry]) => {
            if (!entry?.ts) return true; // ältere Datensätze ohne Zeitstempel werden einmalig mitgenommen
            return new Date(entry.ts).toLocaleDateString('de-DE') === archivedDateLabel;
        });
        if (matchingEntries.length === 0) return;

        let tP = matchingEntries.length, tV = 0, tA = 0, tm = {};
        matchingEntries.forEach(([, x]) => {
            tV += Number(x.verletzungen) || 0;
            tA += Number(x.kosten) || 0;
            const mObj = x.material || {};
            Object.keys(mObj).forEach(k => {
                tm[k] = (tm[k] || 0) + (Number(mObj[k]) || 0);
            });
        });

        const archiveKey = db.ref('data/archiv').push().key;
        const updates = {};
        updates[`data/archiv/${archiveKey}`] = {
            datum: archivedDateLabel,
            patienten: tP,
            verletzungen: tV,
            ausgaben: tA,
            material: tm,
            ts: archiveTimestamp,
            isAutoArchived: true
        };
        matchingEntries.forEach(([k]) => { updates[`data/protokoll/${k}`] = null; });
        db.ref().update(updates).catch(err => console.error('Fehler bei der Mitternachts-Archivierung:', err));
    });

    db.ref('data/auditLogs').once('value', s => {
        const logs = s.val() || {};
        const matchingLogs = Object.entries(logs).filter(([, entry]) => {
            if (!entry?.ts) return true;
            return new Date(entry.ts).toLocaleDateString('de-DE') === archivedDateLabel;
        });
        if (matchingLogs.length === 0) return;

        const dateKeySafe = archivedDateLabel.replace(/\./g, '-');
        const updates = {};
        matchingLogs.forEach(([k, v]) => {
            updates[`data/auditLogsArchiv/${dateKeySafe}/${k}`] = v;
            updates[`data/auditLogs/${k}`] = null;
        });
        db.ref().update(updates).catch(err => console.error('Fehler bei der Audit-Archivierung:', err));
    });
}

/* ── Sensible Firebase-Listener nur bei passender Rolle ─────── */
async function refreshUsersFromFirebase() {
    if (!sessionUser) return cachedUsers;
    try {
        const snap = await db.ref('data/users').once('value');
        const rawUsers = snap.val() || {};
        cachedUsers = Object.fromEntries(Object.entries(rawUsers).map(([uId, u]) => [uId, withStableAccountId(uId, u)]));
        renderAdminUserTable(cachedUsers);
        renderStaffDirectory();
        renderExamTab();
        return cachedUsers;
    } catch (err) {
        console.error('Mitarbeiterliste konnte nicht aktualisiert werden:', err);
        throw err;
    }
}

function refreshSensitiveFirebaseListeners() {
    db.ref('data/archiv').off();
    db.ref('data/auditLogs').off();
    db.ref('data/employeePhotos').off();
    db.ref('data/examSubmissions').off();

    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const canArchive = !!(eff.canViewArchive || eff.isAdmin || eff.isMasterAdmin);
    const canAudit = !!(eff.isAdmin || eff.isMasterAdmin);
    const canManagePhotos = !!canUserManageEmployeePhotos();
    const canViewAllExamSubmissions = !!isUserInstructor();

    if (canArchive) {
        db.ref('data/archiv').on('value', snap => {
            cachedArchiv = snap.val() || {};
            renderArchiv(cachedArchiv);
        });
    } else {
        cachedArchiv = {};
        renderArchiv(cachedArchiv);
    }

    if (canAudit) {
        db.ref('data/auditLogs').on('value', snap => {
            cachedAuditLogs = snap.val() || {};
            renderAdminAuditLogsData(cachedAuditLogs);
        });
    } else {
        cachedAuditLogs = {};
    }

    if (canManagePhotos) {
        db.ref('data/employeePhotos').on('value', snap => {
            cachedPhotos = snap.val() || {};
            renderStaffPhotoAdminList();
        });
    } else {
        cachedPhotos = {};
        renderStaffPhotoAdminList();
    }

    if (canViewAllExamSubmissions) {
        db.ref('data/examSubmissions').on('value', snap => {
            cachedSubmissions = snap.val() || {};
            renderInstructorSubmissions(cachedSubmissions);
            renderStudentUnlockedExams();
        });
    } else if (sessionUser) {
        const myId = getUserAccountId(sessionUser);
        db.ref('data/examSubmissions').orderByChild('userId').equalTo(myId).on('value', snap => {
            cachedSubmissions = snap.val() || {};
            renderInstructorSubmissions(cachedSubmissions);
            renderStudentUnlockedExams();
        });
    } else {
        cachedSubmissions = {};
    }
}

/* ── Firebase Listeners ────────────────────────────────────── */
function startFirebaseListeners() {
    const endpoints = [
        'data/protokoll', 'data/archiv', 'data/hierarchie', 'data/gehaltstabelle',
        'data/guide', 'data/materialPreise', 'data/szenarioTemplates', 'data/szenarienConfig', 'data/dienstLinks',
        'data/dienstCommands', 'data/roles', 'data/users', 'data/exams', 'data/examSubmissions',
        'data/news', 'data/calendar', 'data/employeePhotos', 'data/changelogs', 'data/auditLogs'
    ];
    endpoints.forEach(ep => db.ref(ep).off());

    db.ref('data/protokoll').on('value', s => renderProtokoll(s.val() || {}));
    db.ref('data/hierarchie').on('value', s => renderHierarchieBoard(s.val() || hierarchieDaten));
    db.ref('data/gehaltstabelle').on('value', s => {
        const serverData = s.val();
        const serverList = serverData 
            ? (Array.isArray(serverData) ? serverData : Object.values(serverData)) 
            : [];
        cachedGehaltData = serverList.length > 0 
            ? serverList 
            : JSON.parse(JSON.stringify(defaultGehaltData));
        renderGehaltTab(cachedGehaltData);
    });
    db.ref('data/guide').on('value', s => {
        const serverData = s.val();
        cachedGuideData = serverData ? Object.assign(JSON.parse(JSON.stringify(defaultGuideData)), serverData) : JSON.parse(JSON.stringify(defaultGuideData));
        renderGuideTab();
    });
    db.ref('data/materialPreise').on('value', s => {
        const serverData = s.val();
        if (serverData) {
            Object.keys(serverData).forEach(k => { if (materialKatalog[k]) materialKatalog[k].preis = serverData[k]; });
        }
        baueMaterialUIAuf();
    });
    db.ref('data/szenarienConfig').on('value', s => {
        const cfg = s.val();
        if (cfg) {
            if (cfg.templates) szenarioTemplates = Object.assign({}, szenarioTemplates, cfg.templates);
            if (cfg.steps) medicDatenbank = Object.assign({}, medicDatenbank, cfg.steps);
            updateSzenarioDropdownOptions();
        }
    });
    db.ref('data/szenarioTemplates').on('value', s => {
        if (s.val()) szenarioTemplates = Object.assign({}, szenarioTemplates, s.val());
    });
    db.ref('data/dienstLinks').on('value', s => {
        cachedLinks = s.val() || defaultLinks;
        renderLinksTab(cachedLinks);
    });
    db.ref('data/dienstCommands').on('value', s => {
        cachedCommands = s.val() || defaultCommands;
        renderCommandsTab(cachedCommands);
    });
    db.ref('data/roles').on('value', s => {
        const serverRoles = Object.assign({}, s.val() || {});
        delete serverRoles.admin;
        cachedRoles = Object.assign({}, defaultRoles, serverRoles);
        if (sessionUser) {
            applyUserPermissions(sessionUser);
            refreshSensitiveFirebaseListeners();
        }
        renderCalendarMonth();
        renderStaffDirectory();
        renderCommandsTab(cachedCommands);
        renderLinksTab(cachedLinks);
    });
    db.ref('data/users').on('value', s => {
        const rawUsers = s.val() || {};
        cachedUsers = Object.fromEntries(Object.entries(rawUsers).map(([uId, u]) => [uId, withStableAccountId(uId, u)]));
        if (sessionUser) {
            const uId = getUserAccountId(sessionUser);
            const freshSessionUser = cachedUsers[uId];
            if (!freshSessionUser) {
                alert('Dein Account wurde entfernt. Die Sitzung wird beendet.');
                handleDienstEndeLogout();
                return;
            }
            const effectiveStatus = freshSessionUser.status || ((freshSessionUser.isAdmin || freshSessionUser.isMasterAdmin) ? 'approved' : 'pending');
            if (effectiveStatus !== 'approved') {
                alert('Dein Account wurde gesperrt. Die Sitzung wird beendet.');
                handleDienstEndeLogout();
                return;
            }
            if (freshSessionUser.authUid && auth.currentUser && freshSessionUser.authUid !== auth.currentUser.uid) {
                alert('Dein Login-Zugang wurde ersetzt. Bitte melde dich mit dem neuen Passwort erneut an.');
                handleDienstEndeLogout();
                return;
            }
            sessionUser = withStableAccountId(uId, freshSessionUser);
            refreshSessionIdentityDisplay();
            updateOnlineStatus();
            applyUserPermissions(sessionUser);
            refreshSensitiveFirebaseListeners();
        }
        renderExamTab();
        renderAdminUserTable(cachedUsers);
        renderPasswordChangeStatusPanel();
        renderCalendarMonth();
        renderStaffDirectory();
    });
    db.ref('data/exams').on('value', s => {
        const raw = s.val() || {};
        cachedExams = {};
        
        Object.keys(raw).forEach(k => {
            if (raw[k] && !raw[k].deleted) {
                const ex = JSON.parse(JSON.stringify(raw[k]));
                if (ex.questions && Array.isArray(ex.questions)) {
                    let filteredQ = ex.questions.filter(q => {
                        const t = (q.text||'').toLowerCase();
                        return !(q.type === 'info_dn' || q.type === 'info_pruefer' || q.type === 'info_name' ||
                                 t.includes('dienstnummer des mitarbeiters') ||
                                 t.includes('dienstnummer des prüfers') ||
                                 t.includes('vor- und nachname'));
                    });

                    filteredQ.forEach(q => {
                        if (q.correctAnswers === undefined || q.correctAnswers === null) {
                            q.correctAnswers = [0];
                        } else if (!Array.isArray(q.correctAnswers)) {
                            q.correctAnswers = [parseInt(q.correctAnswers) || 0];
                        }
                    });

                    ex.questions = [
                        { id: 1, text: "Dienstnummer des Mitarbeiters", type: "text", isInfo: true },
                        { id: 2, text: "Dienstnummer des Prüfers", type: "text", isInfo: true },
                        { id: 3, text: "Vor- und Nachname des Mitarbeiters", type: "text", isInfo: true },
                        ...filteredQ
                    ];
                }
                cachedExams[k] = ex;
            }
        });
        renderExamTab();
    });
    db.ref('data/news').on('value', s => {
        cachedNews = s.val() || {};
        renderNewsFeedData(cachedNews);
    });
    db.ref('data/calendar').on('value', s => {
        cachedCalendar = s.val() || {};
        renderCalendarMonth();
    });
    db.ref('data/changelogs').on('value', s => {
        cachedCustomChangelogs = s.val() || {};
        renderChangelogModal();
    });
    refreshSensitiveFirebaseListeners();
}

/* ── Presence Watcher ──────────────────────────────────────── */
function updateOnlineStatus() {
    if (!sessionUser) return;
    if (!mySessionRef) {
        mySessionRef = db.ref('data/presence').push();
        mySessionRef.onDisconnect().remove();
    }
    mySessionRef.set({
        accountId: getUserAccountId(sessionUser),
        name: `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim(),
        dn: sessionUser.dn || '',
        ts: Date.now()
    });
}

function startPresenceWatcher() {
    db.ref('data/presence').off();
    db.ref('data/presence').on('value', snap => {
        const raw = snap.val() || {};
        const d = document.getElementById('onlineMedicsList');
        if (!d) return;

        const unique = new Map();
        Object.entries(raw).forEach(([presenceId, value]) => {
            if (value && typeof value === 'object') {
                const name = String(value.name || '').trim() || 'Unbekannt';
                const key = String(value.accountId || name.toLowerCase() || presenceId);
                if (!unique.has(key)) unique.set(key, { accountId: String(value.accountId || '').trim(), name, dn: String(value.dn || '').trim() });
            } else {
                const name = String(value || '').trim();
                if (name && !unique.has(name.toLowerCase())) unique.set(name.toLowerCase(), { accountId: '', name, dn: '' });
            }
        });

        const medics = [...unique.values()].map(m => {
            const fallbackDn = m.accountId ? String(cachedUsers[m.accountId]?.dn || '').trim() : '';
            return Object.assign({}, m, { dn: m.dn || fallbackDn });
        }).sort((a, b) => a.name.localeCompare(b.name, 'de'));
        if (!medics.length) {
            d.innerHTML = '<span class="online-medic-name online-medic-empty">Keiner im Dienst</span>';
            return;
        }

        d.innerHTML = medics.map(m => `
            <span class="online-medic-name" title="${escapeHtml(m.dn ? `${m.name} • DN: ${m.dn}` : m.name)}">${escapeHtml(m.name)}</span>
        `).join('');
    });
}

/* ── REITER 1: DOKUMENTATION & EINSATZ ─────────────────────── */
function updateSzenarioDropdownOptions() {
    const sel = document.getElementById('verletzungSelect');
    if (!sel) return;
    const cur = sel.value;
    const allKeys = Object.keys(medicDatenbank).sort((a,b) => a.localeCompare(b, 'de'));
    sel.innerHTML = '<option value="">-- Bitte wählen --</option>' + 
        allKeys.map(k => `<option value="${escapeHtml(k)}" ${k === cur ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('');
}

function stepVerletzungenAnzahl(d) {
    anzahlVerletzungenFall = Math.max(1, anzahlVerletzungenFall + d);
    const el = document.getElementById('val_pVerletzungenAnzahl'); 
    if (el) el.textContent = anzahlVerletzungenFall;

    const sz = document.getElementById('verletzungSelect')?.value;
    if (sz && szenarioTemplates[sz]) {
        const tpl = szenarioTemplates[sz];
        Object.keys(materialKatalog).forEach(k => {
            if (k === 'mat_wasser') return;
            const baseQty = tpl[k] || 0;
            fallMaterial[k] = baseQty * anzahlVerletzungenFall;
            const e = document.getElementById('val_' + k);
            if (e) e.textContent = fallMaterial[k];
        });
    }

    fallMaterial['mat_wasser'] = anzahlVerletzungenFall;
    const we = document.getElementById('val_mat_wasser');
    if (we) we.textContent = anzahlVerletzungenFall;

    let total = 0;
    Object.keys(fallMaterial).forEach(k => {
        const itemPreis = (materialKatalog[k] && materialKatalog[k].preis) ? materialKatalog[k].preis : 0;
        total += fallMaterial[k] * itemPreis;
    });
    aktuellerFallKosten = total;
    const ke = document.getElementById('val_pKosten');
    if (ke) ke.textContent = '$' + total;
}

function stepKosten(d) {
    aktuellerFallKosten = Math.max(0, aktuellerFallKosten + d);
    const el = document.getElementById('val_pKosten'); if (el) el.textContent = '$' + aktuellerFallKosten;
}

function stepMat(key, d) {
    fallMaterial[key] = Math.max(0, (fallMaterial[key]||0) + d);
    const el = document.getElementById('val_' + key); if (el) el.textContent = fallMaterial[key];
    let total = 0; 
    Object.keys(fallMaterial).forEach(k => { 
        const itemPreis = (materialKatalog[k] && materialKatalog[k].preis) ? materialKatalog[k].preis : 0;
        total += fallMaterial[k] * itemPreis; 
    });
    aktuellerFallKosten = total;
    const ke = document.getElementById('val_pKosten'); if (ke) ke.textContent = '$' + total;
}

function ladeCheckliste() {
    const sel = document.getElementById('verletzungSelect'), cont = document.getElementById('checklisteContainer');
    if (!sel || !cont) return;
    const sz = sel.value;

    const hasManualChanges = Object.keys(fallMaterial).some(k => (fallMaterial[k] || 0) > 0);
    if (hasManualChanges && previousSelectedSzenario && previousSelectedSzenario !== sz) {
        const keepManual = confirm('Du hast bereits Materialmengen angepasst. Sollen deine manuellen Mengenangaben beibehalten werden? (Abbrechen setzt die Mengen auf das Standardszenario zurück)');
        if (keepManual) {
            previousSelectedSzenario = sz;
            const schritte = medicDatenbank[sz] || [];
            cont.innerHTML = schritte.map((s, i) => `<div class="todo-item" id="todo_${i}" onclick="toggleTodo(${i})"><input type="checkbox" id="check_${i}" onclick="event.stopPropagation();toggleTodo(${i})"><span>${escapeHtml(s)}</span></div>`).join('');
            return;
        }
    }
    previousSelectedSzenario = sz;

    if (!sz) { 
        cont.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Wähle links ein Szenario aus, um die Schritte zu sehen.</p>'; 
        return; 
    }
    const schritte = medicDatenbank[sz] || [];
    cont.innerHTML = schritte.map((s, i) => `<div class="todo-item" id="todo_${i}" onclick="toggleTodo(${i})"><input type="checkbox" id="check_${i}" onclick="event.stopPropagation();toggleTodo(${i})"><span>${escapeHtml(s)}</span></div>`).join('');
    
    const tpl = szenarioTemplates[sz] || {};
    Object.keys(materialKatalog).forEach(k => {
        if (k === 'mat_wasser') return;
        const baseQty = tpl[k] || 0;
        fallMaterial[k] = baseQty * anzahlVerletzungenFall;
        const e = document.getElementById('val_' + k); 
        if (e) e.textContent = fallMaterial[k];
    });
    fallMaterial['mat_wasser'] = anzahlVerletzungenFall;
    const we = document.getElementById('val_mat_wasser'); 
    if (we) we.textContent = anzahlVerletzungenFall;
    
    let total = 0; 
    Object.keys(fallMaterial).forEach(k => { 
        const itemPreis = (materialKatalog[k] && materialKatalog[k].preis) ? materialKatalog[k].preis : 0;
        total += fallMaterial[k] * itemPreis; 
    });
    aktuellerFallKosten = total;
    const ke = document.getElementById('val_pKosten'); 
    if (ke) ke.textContent = '$' + total;
}

function toggleTodo(idx) {
    const item = document.getElementById('todo_' + idx), chk = document.getElementById('check_' + idx);
    if (!item) return;
    item.classList.toggle('completed');
    if (chk) chk.checked = item.classList.contains('completed');
}

function resetMedicalWorkflow() {
    const cont = document.getElementById('checklisteContainer');
    if (!cont) return;
    const items = cont.querySelectorAll('.todo-item');
    items.forEach(it => {
        it.classList.remove('completed');
        const chk = it.querySelector('input[type="checkbox"]');
        if (chk) chk.checked = false;
    });
}

function patientHinzufuegen() {
    if (!sessionUser) { alert('Nicht eingeloggt!'); return; }
    const nF = document.getElementById('pName'), sS = document.getElementById('verletzungSelect');
    const patName = (nF?.value||'').trim() || 'Patient ' + ((daten.patienten||0)+1);
    const sz = sS?.value || 'Undefinierbar';
    const mat = Object.assign({}, fallMaterial); mat['mat_wasser'] = anzahlVerletzungenFall;
    const myId = getUserAccountId(sessionUser);

    db.ref('data/protokoll').push({
        name: patName,
        szenario: sz,
        verletzungen: anzahlVerletzungenFall,
        kosten: aktuellerFallKosten,
        material: mat,
        medic: sessionUser.vorname + ' ' + sessionUser.nachname,
        medicId: myId,
        ts: Date.now()
    }).then(() => {
        if (nF) nF.value = '';
        if (sS) sS.value = '';
        previousSelectedSzenario = "";
        anzahlVerletzungenFall = 1;
        aktuellerFallKosten = 0;
        fallMaterial = {};
        const vE = document.getElementById('val_pVerletzungenAnzahl'), kE = document.getElementById('val_pKosten');
        if (vE) vE.textContent = '1';
        if (kE) kE.textContent = '$0';
        const cc = document.getElementById('checklisteContainer');
        if (cc) cc.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Wähle links ein Szenario aus, um die Schritte zu sehen.</p>';
        baueMaterialUIAuf();
    });
}

function baueMaterialUIAuf() {
    const grid = document.getElementById('dynamischerMaterialVerbrauchGrid'); if (!grid) return;
    grid.innerHTML = '';
    let hL = '<div>', hR = '<div>', cnt = 0;
    const keys = Object.keys(materialKatalog).filter(k => k !== 'mat_wasser'), half = Math.ceil(keys.length/2);
    keys.forEach(k => {
        const q = fallMaterial[k] || 0;
        const itemPreis = (materialKatalog[k] && materialKatalog[k].preis) ? materialKatalog[k].preis : 0;
        const h = `<div id="lbl_mat_${k}" class="material-label-title" style="margin-top:4px; font-size:12px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">${escapeHtml(materialKatalog[k].name)} ($${itemPreis})</div><div class="counter-group" aria-labelledby="lbl_mat_${k}"><button type="button" class="counter-btn" onclick="stepMat('${k}',-1)" aria-label="${escapeHtml(materialKatalog[k].name)} verringern">-</button><span class="counter-value" id="val_${k}">${q}</span><button type="button" class="counter-btn plus-main" onclick="stepMat('${k}',1)" aria-label="${escapeHtml(materialKatalog[k].name)} erhöhen">+</button></div>`;
        if (cnt < half) hL += h; else hR += h; cnt++;
    });
    grid.innerHTML = hL + '</div>' + hR + '</div>';
    const wP = document.getElementById('wasserPreisLabel'); if (wP) wP.textContent = '$' + (materialKatalog.mat_wasser?.preis || 200);
}

/* ── PREISE & SZENARIEN VOR ORT ANPASSEN (INLINE) ─────────── */
function openPricesInlineModal() {
    if (!requirePermission(['canEditPrices','isMasterAdmin'], 'Keine Berechtigung zur Bearbeitung der Materialpreise!')) return;
    const cont = document.getElementById('pricesInlineContainer');
    if (!cont) return;
    cont.innerHTML = Object.keys(materialKatalog).map(k => `
        <div style="background:rgba(30,41,59,0.5);border:1px solid var(--border);border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center;">
            <label for="inlinePrice_${k}" style="font-weight:700;margin:0;cursor:pointer;">📦 ${escapeHtml(materialKatalog[k].name)}</label>
            <div style="display:flex;align-items:center;gap:4px;">
                <input type="number" id="inlinePrice_${k}" aria-label="Preis für ${escapeHtml(materialKatalog[k].name)}" value="${materialKatalog[k].preis || 0}" style="width:90px;padding:6px;">
                <b style="color:var(--success);">$</b>
            </div>
        </div>
    `).join('');
    document.getElementById('pricesInlineModal').style.display = 'flex';
}
function closePricesInlineModal() { document.getElementById('pricesInlineModal').style.display = 'none'; }

function speicherePreiseInline() {
    if (!requirePermission(['canEditPrices','isMasterAdmin'], 'Keine Berechtigung zum Speichern der Materialpreise!')) return;
    const upd = {};
    Object.keys(materialKatalog).forEach(k => {
        const inp = document.getElementById('inlinePrice_' + k);
        if (inp) {
            const v = parseInt(inp.value) || materialKatalog[k].preis || 0;
            upd[k] = v;
            materialKatalog[k].preis = v;
        }
    });
    db.ref('data/materialPreise').set(upd).then(() => {
        baueMaterialUIAuf();
        closePricesInlineModal();
        logAdminAudit('Materialpreise angepasst', `${sessionUser.vorname} ${sessionUser.nachname} hat die Preise vor Ort aktualisiert.`);
        alert('✅ Materialpreise gespeichert!');
    });
}

/* ── SZENARIEN & BEHANDLUNGSABLAUF NO-CODE EDITOR ───────────── */
function openSzenarienInlineModal() {
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.canEditPrices && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zur Anpassung von Szenarien!');
        return;
    }
    const cont = document.getElementById('szenarienInlineEditorContainer');
    if (!cont) return;

    renderSzenarienEditorHtml();
    document.getElementById('szenarienInlineModal').style.display = 'flex';
}

function closeSzenarienInlineModal() {
    document.getElementById('szenarienInlineModal').style.display = 'none';
}

function renderSzenarienEditorHtml() {
    const cont = document.getElementById('szenarienInlineEditorContainer');
    if (!cont) return;

    const names = Object.keys(medicDatenbank).sort((a,b) => a.localeCompare(b, 'de'));
    cont.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
            <div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:10px;border:1px solid var(--border);">
                <h4 style="margin:0 0 10px 0;color:var(--success);">➕ Neues Szenario anlegen</h4>
                <div style="display:flex;gap:10px;">
                    <input type="text" id="newSzenarioNameInput" placeholder="Name des Szenarios (z.B. Verbrennung)..." style="flex:1;">
                    <button type="button" class="btn" style="width:auto;margin:0;padding:8px 18px;" onclick="addNewSzenarioWorkflow()">Anlegen</button>
                </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:14px;max-height:60vh;overflow-y:auto;padding-right:4px;">
                ${names.map(szName => {
                    const steps = medicDatenbank[szName] || [];
                    const tpl = szenarioTemplates[szName] || {};
                    return `
                        <div style="background:rgba(30,41,59,0.4);border:1px solid var(--border);border-radius:12px;padding:14px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                <h4 style="margin:0;color:var(--primary);font-size:15px;">🏥 ${escapeHtml(szName)}</h4>
                                <button type="button" class="btn-delete-row" onclick="deleteSzenarioWorkflow(${escapeJsArg(szName)})">🗑️ Szenario löschen</button>
                            </div>
                            <div style="margin-bottom:8px;">
                                <label style="font-size:11px;margin-bottom:4px;">Behandlungsschritte (Jede Zeile = 1 Schritt im Ablauf):</label>
                                <textarea id="sz_steps_${escapeHtml(szName)}" rows="4" style="font-size:13px;">${escapeHtml(steps.join('\n'))}</textarea>
                            </div>
                            <div>
                                <label style="font-size:11px;margin-bottom:4px;">Standard-Materialmengen für dieses Szenario:</label>
                                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:6px;">
                                    ${Object.keys(materialKatalog).filter(k => k !== 'mat_wasser').map(mKey => `
                                        <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(8,12,20,0.5);padding:4px 8px;border-radius:6px;font-size:11px;">
                                            <span>${escapeHtml(materialKatalog[mKey].name)}</span>
                                            <input type="number" id="sz_mat_${escapeHtml(szName)}_${mKey}" value="${tpl[mKey] || 0}" min="0" style="width:50px;padding:2px 4px;font-size:11px;">
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;">
                <button type="button" class="btn" style="width:auto;background:var(--text-muted);" onclick="closeSzenarienInlineModal()">Abbrechen</button>
                <button type="button" class="btn" style="width:auto;background:var(--success);color:#080c14;font-weight:800;" onclick="saveAllSzenarienWorkflows()">💾 Szenarien speichern</button>
            </div>
        </div>
    `;
}

function addNewSzenarioWorkflow() {
    if (!requirePermission(['canEditPrices','isMasterAdmin'], 'Keine Berechtigung zur Bearbeitung von Szenarien!')) return;
    const name = document.getElementById('newSzenarioNameInput')?.value.trim();
    if (!name) { alert('Bitte Namen für das Szenario angeben!'); return; }
    if (medicDatenbank[name]) { alert('Dieses Szenario existiert bereits!'); return; }

    medicDatenbank[name] = ["Rechnung stellen", "Vitalwerte prüfen", "Wundreinigung durchführen", "Verband anlegen"];
    szenarioTemplates[name] = { mat_wundreiniger: 1, mat_verband: 1 };
    renderSzenarienEditorHtml();
}

function deleteSzenarioWorkflow(szName) {
    if (!requirePermission(['canEditPrices','isMasterAdmin'], 'Keine Berechtigung zum Löschen von Szenarien!')) return;
    if (confirm(`Szenario "${szName}" wirklich unwiderruflich löschen?`)) {
        delete medicDatenbank[szName];
        delete szenarioTemplates[szName];
        renderSzenarienEditorHtml();
    }
}

function saveAllSzenarienWorkflows() {
    if (!requirePermission(['canEditPrices','isMasterAdmin'], 'Keine Berechtigung zum Speichern von Szenarien!')) return;
    const updatedSteps = {};
    const updatedTpls = {};

    Object.keys(medicDatenbank).forEach(szName => {
        const stepTa = document.getElementById(`sz_steps_${szName}`);
        if (stepTa) {
            updatedSteps[szName] = stepTa.value.split('\n').map(s => s.trim()).filter(s => s.length > 0);
        } else {
            updatedSteps[szName] = medicDatenbank[szName] || [];
        }

        const tplObj = {};
        Object.keys(materialKatalog).filter(k => k !== 'mat_wasser').forEach(mKey => {
            const inp = document.getElementById(`sz_mat_${szName}_${mKey}`);
            if (inp) {
                const qty = parseInt(inp.value) || 0;
                if (qty > 0) tplObj[mKey] = qty;
            }
        });
        updatedTpls[szName] = tplObj;
    });

    db.ref('data/szenarienConfig').set({
        steps: updatedSteps,
        templates: updatedTpls
    }).then(() => {
        medicDatenbank = updatedSteps;
        szenarioTemplates = updatedTpls;
        updateSzenarioDropdownOptions();
        closeSzenarienInlineModal();
        logAdminAudit('Szenarien & Abläufe angepasst', `${sessionUser.vorname} ${sessionUser.nachname} hat medizinische Szenarien vor Ort aktualisiert.`);
        alert('✅ Medizinische Szenarien & Abläufe erfolgreich gespeichert!');
    });
}

// ============================================================
//  MMD CLOUD – Medical Center Web-App  |  app.js  v6.4.2
//  Firebase Realtime Database (Compat SDK v10)
// ============================================================

/* ── REITER 2: STATISTIK & ARCHIV ─────────────────────────── */
function renderProtokoll(obj) {
    const tbody = document.getElementById('logTableBody'); if (!tbody) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const myName = sessionUser ? (sessionUser.vorname + ' ' + sessionUser.nachname) : '';
    const myId = sessionUser ? getUserAccountId(sessionUser) : '';
    const entries = Object.entries(obj).sort((a,b) => (b[1].ts||0) - (a[1].ts||0));
    
    tbody.innerHTML = entries.length === 0
        ? '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">📋 Noch keine Patienten für die laufende Schicht dokumentiert.</td></tr>'
        : entries.map(([k,v]) => {
            const dateStr = v.ts ? new Date(v.ts).toLocaleDateString('de-DE') : '-';
            const isOwnEntry = (v.medicId && v.medicId === myId) || (v.medic === myName);
            const canEditThis = isOwnEntry || eff.canEditAllPatients || eff.isMasterAdmin;

            return `<tr>
                <td>${escapeHtml(v.name||'-')}</td>
                <td>${escapeHtml(v.szenario||'-')}</td>
                <td>${v.verletzungen||0}</td>
                <td style="color:var(--success);font-weight:800;">$${v.kosten||0}</td>
                <td>${escapeHtml(v.medic||'-')}</td>
                <td style="font-size:13px;color:var(--text-muted);">${dateStr}</td>
                <td>
                    <div style="display:flex;gap:6px;align-items:center;">
                        ${canEditThis ? `<button type="button" class="btn-edit-row" onclick="openEditModal('${k}')" title="Eintrag bearbeiten">✏️</button>` : ''}
                        ${eff.delPatient ? `<button type="button" class="btn-delete-row" onclick="deletePatient('${k}')" title="Eintrag löschen">🗑️</button>` : ''}
                    </div>
                </td>
              </tr>`;
          }).join('');

    let tP = 0, tV = 0, tA = 0;
    entries.forEach(([,v]) => { tP++; tV += v.verletzungen||0; tA += v.kosten||0; });
    daten = { patienten: tP, verletzungen: tV, ausgaben: tA };
    
    const sp = document.getElementById('statPatienten'), sv = document.getElementById('statVerletzungen'), sa = document.getElementById('statAusgaben');
    if (sp) sp.textContent = tP; if (sv) sv.textContent = tV; if (sa) sa.textContent = '$' + tA;
    renderTagesVerbrauch(entries.map(([,v]) => v));
}

function renderTagesVerbrauch(entries) {
    const tbody = document.getElementById('tagesVerbrauchTableBody'); if (!tbody) return;
    const totals = {};
    entries.forEach(e => { const m = e.material||{}; Object.keys(m).forEach(k => { totals[k] = (totals[k]||0) + (m[k]||0); }); });
    tbody.innerHTML = Object.keys(totals).length === 0
        ? '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:14px;">📦 Noch kein Materialverbrauch erfasst.</td></tr>'
        : Object.entries(totals).filter(([,v]) => v > 0).map(([k,v]) => `<tr><td>${materialKatalog[k]?escapeHtml(materialKatalog[k].name):escapeHtml(k)}</td><td><b>${v}x</b></td></tr>`).join('');
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return [d.getUTCFullYear(), weekNo];
}

function renderArchiv(obj) {
    const tbody = document.getElementById('archivTableBody');
    const tfoot = document.getElementById('archivTableFoot');
    if (!tbody) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const isMaster = !!eff.isMasterAdmin;

    if (!obj || !Object.keys(obj).length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">📥 Noch keine archivierten Schichten vorhanden.</td></tr>';
        if (tfoot) tfoot.innerHTML = '';
        return;
    }

    const currentWeekInfo = getWeekNumber(new Date());
    const currentWeekKey = `${currentWeekInfo[0]}-KW${currentWeekInfo[1].toString().padStart(2, '0')}`;

    let totalP = 0, totalV = 0, totalCash = 0, totalMatObj = {};
    const allEntries = Object.entries(obj).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));

    const cleanEntries = allEntries.filter(([, item]) => {
        const p = Number(item.patienten ?? item.p ?? 0);
        const cash = Number(item.ausgaben ?? item.cash ?? item.kosten ?? 0);
        return !(p === 0 && cash === 0);
    });

    const weekEntries = cleanEntries.filter(([, item]) => {
        let d;
        if (item.ts) {
            d = new Date(item.ts);
        } else if (item.datum && item.datum.includes('.')) {
            const parts = item.datum.split('.');
            d = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
            d = new Date();
        }
        const wInfo = getWeekNumber(d);
        const wKey = `${wInfo[0]}-KW${wInfo[1].toString().padStart(2, '0')}`;
        return wKey === currentWeekKey;
    });

    if (!weekEntries.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">📥 In der aktuellen Woche (${currentWeekKey}) liegen noch keine gültigen archivierten Schichten vor.</td></tr>`;
        if (tfoot) tfoot.innerHTML = '';
        return;
    }

    tbody.innerHTML = weekEntries.map(([k, i]) => {
        const p = Number(i.patienten ?? i.p ?? 0);
        const v = Number(i.verletzungen ?? i.v ?? 0);
        const cash = Number(i.ausgaben ?? i.cash ?? itemCash(i));
        const tagLabel = i.datum || (i.ts ? new Date(i.ts).toLocaleDateString('de-DE') : 'Schicht');

        totalP += p; 
        totalV += v; 
        totalCash += cash;

        let mHtml = '<ul class="archiv-details-list">';
        const matObj = i.material || i.matDetailsObj || {};
        const matKeys = Object.keys(matObj);
        
        if (matKeys.length > 0) {
            matKeys.forEach(m => {
                const qty = Number(matObj[m]) || 0;
                if (qty > 0) {
                    const dispName = materialKatalog[m] ? materialKatalog[m].name : m;
                    mHtml += `<li>${escapeHtml(dispName)}: <b>${qty}x</b></li>`;
                    totalMatObj[dispName] = (totalMatObj[dispName] || 0) + qty;
                }
            });
        } else {
            mHtml += '<li>Kein Verbrauch</li>';
        }
        mHtml += '</ul>';

        return `<tr>
            <td style="font-weight:700;color:var(--text-main);">${escapeHtml(tagLabel)}</td>
            <td style="font-weight:700;">${p}</td>
            <td style="color:var(--warning);font-weight:700;">${v}</td>
            <td style="color:var(--success);font-weight:800;font-family:monospace;font-size:14px;">$${cash.toLocaleString('de-DE')}</td>
            <td>${mHtml}</td>
            <td style="text-align:right;white-space:nowrap;">
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    ${isMaster ? `<button type="button" class="btn-edit-row" onclick="openArchivEditModal('${k}')" title="Schicht korrigieren">✏️</button>` : ''}
                    ${eff.delArchiv ? `<button type="button" class="btn-delete-row" onclick="deleteArchivSchicht('${k}')" title="Schicht löschen">🗑️</button>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');

    if (tfoot) {
        let totalMatHtml = '<ul class="archiv-details-list">';
        const totalKeys = Object.keys(totalMatObj);
        if (totalKeys.length > 0) {
            totalKeys.sort().forEach(m => {
                totalMatHtml += `<li>${escapeHtml(m)}: <b style="color:var(--primary);">${totalMatObj[m]}x</b></li>`;
            });
        } else {
            totalMatHtml += '<li>Kein Verbrauch</li>';
        }
        totalMatHtml += '</ul>';

        tfoot.innerHTML = `<tr style="background:rgba(56,189,248,0.08);font-weight:800;border-top:2px solid var(--primary);">
            <td><b style="color:var(--primary);">Summe (${currentWeekKey})</b></td>
            <td style="color:var(--primary);">${totalP.toLocaleString('de-DE')}</td>
            <td style="color:var(--warning);">${totalV.toLocaleString('de-DE')}</td>
            <td style="color:var(--success);font-family:monospace;font-size:15px;">$${totalCash.toLocaleString('de-DE')}</td>
            <td>${totalMatHtml}</td>
            <td style="text-align:right;">${isMaster ? '<span style="color:var(--primary);font-size:12px;">👑 Master</span>' : '--'}</td>
        </tr>`;
    }
}

function itemCash(i) {
    return Number(i.ausgaben ?? i.cash ?? i.kosten ?? 0);
}

/* ── Schicht-Korrektur (Master-Admin No-Code Stift) ─────────── */
function openArchivEditModal(k) {
    const s = cachedArchiv[k];
    if (!s) return;
    document.getElementById('editArchivKey').value = k;
    document.getElementById('editArchivDatum').value = s.datum || (s.ts ? new Date(s.ts).toLocaleDateString('de-DE') : '');
    document.getElementById('editArchivPatienten').value = s.patienten ?? s.p ?? 0;
    document.getElementById('editArchivVerletzungen').value = s.verletzungen ?? s.v ?? 0;
    document.getElementById('editArchivAusgaben').value = s.ausgaben ?? s.cash ?? s.kosten ?? 0;
    document.getElementById('archivEditModal').style.display = 'flex';
}
function closeArchivEditModal() { document.getElementById('archivEditModal').style.display = 'none'; }

function saveArchivEdit() {
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isMasterAdmin) { alert('Nur Master-Admins dürfen archivierte Schichten bearbeiten!'); return; }

    const k = document.getElementById('editArchivKey')?.value;
    if (!k) return;

    const datum = document.getElementById('editArchivDatum')?.value.trim();
    const patienten = parseInt(document.getElementById('editArchivPatienten')?.value) || 0;
    const verletzungen = parseInt(document.getElementById('editArchivVerletzungen')?.value) || 0;
    const ausgaben = parseInt(document.getElementById('editArchivAusgaben')?.value) || 0;

    if (!datum) { alert('Bitte Datum angeben!'); return; }

    db.ref('data/archiv/' + k).update({
        datum: datum,
        patienten: patienten,
        verletzungen: verletzungen,
        ausgaben: ausgaben,
        lastEditedBy: sessionUser.vorname + ' ' + sessionUser.nachname,
        lastEditedTs: Date.now()
    }).then(() => {
        closeArchivEditModal();
        logAdminAudit('Archivierte Schicht korrigiert', `${sessionUser.vorname} ${sessionUser.nachname} hat Schicht ${datum} bearbeitet.`);
        alert('✅ Schichteintrag erfolgreich aktualisiert!');
    });
}

/* ── Manueller Schichtabschluss mit CSV-Download ────────────── */
function manualTriggerArchive() {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isAdmin && !eff.isMasterAdmin) {
        alert('Keine Berechtigung für diese Aktion!');
        return;
    }
    if (!confirm('Möchtest du das aktuelle Tagesprotokoll archivieren, die Schichtdatei automatisch herunterladen und das Protokoll zurücksetzen?')) return;

    db.ref('data/protokoll').once('value', s => {
        const p = s.val() || {};
        const entries = Object.values(p);
        if (entries.length === 0) {
            alert('⚠️ Das Tagesprotokoll ist bereits leer.');
            return;
        }

        const todayFormatted = new Date().toLocaleDateString('de-DE');
        const archiveTimestamp = Date.now();
        let tP = entries.length, tV = 0, tA = 0, tm = {};
        let csvContent = 'Patient,Szenario,Verletzungen,Ausgaben,Medic,Datum\n';

        entries.forEach(x => {
            const pInj = Number(x.verletzungen) || 0;
            const pCost = Number(x.kosten) || 0;
            tV += pInj;
            tA += pCost;
            const mObj = x.material || {};
            Object.keys(mObj).forEach(k => { tm[k] = (tm[k] || 0) + (Number(mObj[k]) || 0); });
            csvContent += `"${(x.name||'').replace(/"/g, '""')}","${(x.szenario||'').replace(/"/g, '""')}","${pInj}","$${pCost}","${(x.medic||'').replace(/"/g, '""')}","${todayFormatted}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MMD_Schichtbericht_${todayFormatted.replace(/\./g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        const archiveKey = db.ref('data/archiv').push().key;
        const updates = {};
        updates[`data/archiv/${archiveKey}`] = {
            datum: todayFormatted,
            patienten: tP,
            verletzungen: tV,
            ausgaben: tA,
            material: tm,
            ts: archiveTimestamp,
            isManualProtArchived: true
        };
        Object.keys(p).forEach(k => { updates[`data/protokoll/${k}`] = null; });

        db.ref().update(updates).then(() => {
            logAdminAudit('Tagesprotokoll als Schicht übernommen & exportiert', `${sessionUser.vorname} ${sessionUser.nachname} hat das Tagesprotokoll übernommen und exportiert.`);
            alert('✅ Tagesprotokoll wurde archiviert, Schichtbericht heruntergeladen und die erfassten Einträge zurückgesetzt!');
        }).catch(err => alert('Fehler beim Archivieren: ' + (err?.message || err)));
    });
}

function deleteArchivSchicht(k) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delArchiv) {
        alert('Keine Berechtigung zum Löschen von Archiven!');
        return;
    }
    const s = cachedArchiv[k];
    const schichtDatum = s?.datum || (s?.ts ? new Date(s.ts).toLocaleDateString('de-DE') : k);
    if (confirm(`Soll der archivierte Schichteintrag vom ${schichtDatum} wirklich gelöscht werden?`)) {
        db.ref('data/archiv/' + k).remove().then(() => {
            logAdminAudit('Schichtarchiv gelöscht', `${sessionUser.vorname} ${sessionUser.nachname} hat Schicht ${schichtDatum} gelöscht.`);
            alert('✅ Schichteintrag erfolgreich gelöscht!');
        }).catch(err => {
            alert('Fehler beim Löschen: ' + err.message);
        });
    }
}

function canCurrentUserEditPatientRecord(record) {
    if (!sessionUser || !record) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    const myId = getUserAccountId(sessionUser);
    const myName = `${sessionUser.vorname} ${sessionUser.nachname}`;
    const isOwnEntry = (record.medicId && record.medicId === myId) || record.medic === myName;
    return !!(isOwnEntry || eff.canEditAllPatients || eff.isMasterAdmin);
}

function openEditModal(key) {
    if (!sessionUser) return;
    db.ref('data/protokoll/'+key).once('value', s => {
        const v = s.val(); if (!v) return;
        if (!canCurrentUserEditPatientRecord(v)) {
            alert('Keine Berechtigung zum Bearbeiten dieses Patienteneintrags!');
            return;
        }
        document.getElementById('editKey').value = key;
        document.getElementById('editName').value = v.name || '';
        document.getElementById('editSzenario').value = v.szenario || '';
        document.getElementById('editCount').value = v.verletzungen || 1;
        document.getElementById('editCash').value = v.kosten || 0;
        document.getElementById('editModal').style.display = 'flex';
    });
}
function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }
function speicherePatientEdit() {
    if (!sessionUser) return;
    const key = document.getElementById('editKey').value; if (!key) return;
    const ref = db.ref('data/protokoll/'+key);
    ref.once('value', snap => {
        const current = snap.val();
        if (!current || !canCurrentUserEditPatientRecord(current)) {
            alert('Keine Berechtigung zum Bearbeiten dieses Patienteneintrags!');
            closeEditModal();
            return;
        }
        ref.update({
            name: document.getElementById('editName').value.trim(),
            szenario: document.getElementById('editSzenario').value.trim(),
            verletzungen: parseInt(document.getElementById('editCount').value) || 1,
            kosten: parseInt(document.getElementById('editCash').value) || 0
        }).then(() => closeEditModal());
    });
}
function deletePatient(k) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delPatient) return;
    db.ref('data/protokoll/' + k).once('value', snap => {
        const pData = snap.val();
        const pName = pData ? (pData.name || 'Unbekannt') : k;
        const pMedic = pData ? (pData.medic || 'Unbekannt') : '';
        if (confirm(`Patienteneintrag "${pName}" wirklich löschen?`)) {
            db.ref('data/protokoll/' + k).remove().then(() => {
                logAdminAudit('Patienteneintrag gelöscht', `${sessionUser.vorname} ${sessionUser.nachname} hat Patient "${pName}" (Erfasst von: ${pMedic}) gelöscht.`);
            });
        }
    });
}

function exportArchivCSV() {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.canViewArchive && !eff.isAdmin && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zum Exportieren des Archivs!');
        return;
    }
    db.ref('data/archiv').once('value', s => {
        const a = s.val() || {}, e = Object.entries(a); if (!e.length) return;
        let csv = 'Datum,Patienten,Verletzungen,Ausgaben\n';
        e.forEach(([,v]) => { csv += `"${v.datum||''}","${v.patienten||0}","${v.verletzungen||0}","$${v.ausgaben||0}"\n`; });
        const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' }), u = URL.createObjectURL(b), el = document.createElement('a');
        el.href = u; el.download = 'MMD_Archiv.csv'; el.click();
        URL.revokeObjectURL(u);
    });
}

/* ══════════════════════════════════════════════════════════════
   KALENDER: EINLADUNGEN, SPAMSCHUTZ & BEREINIGUNG
══════════════════════════════════════════════════════════════ */
const MONTH_NAMES_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function cleanOldCalendarEvents() {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.delCalendar && !eff.isAdmin && !eff.isMasterAdmin) return;
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    db.ref('data/calendar').once('value', snap => {
        const events = snap.val() || {};
        Object.entries(events).forEach(([id, ev]) => {
            if (ev.date) {
                const parts = ev.date.split('-');
                if (parts.length === 3) {
                    const eventDateMs = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59).getTime();
                    if (eventDateMs < oneWeekAgo) {
                        db.ref('data/calendar/' + id).remove();
                    }
                }
            }
        });
    });
}

function changeCalendarMonth(delta) {
    currentCalMonth += delta;
    if (currentCalMonth > 11) { currentCalMonth = 0; currentCalYear++; }
    else if (currentCalMonth < 0) { currentCalMonth = 11; currentCalYear--; }
    renderCalendarMonth();
}

function resetCalendarToToday() {
    const n = new Date();
    currentCalYear = n.getFullYear();
    currentCalMonth = n.getMonth();
    renderCalendarMonth();
}

function renderCalendarMonth() {
    const lbl = document.getElementById('calendarCurrentMonthYear');
    const grid = document.getElementById('calendarMonthGrid');
    if (!lbl || !grid) return;

    lbl.textContent = `${MONTH_NAMES_DE[currentCalMonth]} ${currentCalYear}`;

    const myRoleIds = sessionUser ? getUserRolesList(sessionUser) : [];
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const isSpecialAdmin = eff.isAdmin || eff.isMasterAdmin;
    const myId = sessionUser ? getUserAccountId(sessionUser) : '';

    const eventsList = Object.entries(cachedCalendar || {}).map(([id, ev]) => {
        return Object.assign({ id }, ev);
    }).filter(ev => {
        if (ev.deleted) return false;
        
        const isInvited = ev.invitedUsers && Array.isArray(ev.invitedUsers) && ev.invitedUsers.includes(myId);
        const inviteStatus = (ev.invitationStatus && ev.invitationStatus[myId]) ? ev.invitationStatus[myId] : 'pending';

        if (isInvited) {
            return inviteStatus !== 'declined';
        }

        if (ev.isPrivate) {
            return (ev.creatorId === myId);
        }

        if (isSpecialAdmin) return true;
        if (!ev.targetRoles || !ev.targetRoles.length || ev.targetRoles.includes('all')) return true;
        return ev.targetRoles.some(r => myRoleIds.includes(r));
    });

    const firstDayOfMonth = new Date(currentCalYear, currentCalMonth, 1);
    const lastDayOfMonth  = new Date(currentCalYear, currentCalMonth + 1, 0);
    const totalDaysInMonth = lastDayOfMonth.getDate();

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const prevMonthLastDay = new Date(currentCalYear, currentCalMonth, 0).getDate();
    const today = new Date();
    const isCurrentActualMonth = (today.getFullYear() === currentCalYear && today.getMonth() === currentCalMonth);
    const todayDateNumber = today.getDate();

    let html = '';

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const dayNum = prevMonthLastDay - i;
        html += `<div class="calendar-day-cell is-other-month"><div class="cal-day-num">${dayNum}</div></div>`;
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
        const isToday = isCurrentActualMonth && (d === todayDateNumber);
        const yStr = currentCalYear;
        const mStr = String(currentCalMonth + 1).padStart(2, '0');
        const dStr = String(d).padStart(2, '0');
        const dateKey = `${yStr}-${mStr}-${dStr}`;

        const dayEvents = eventsList.filter(e => e.date === dateKey).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

        let eventsHtml = '';
        dayEvents.forEach(ev => {
            const color = sanitizeRoleColor(ev.roleColor);
            const privIcon = ev.isPrivate ? '🔒 ' : '';
            const isInvited = ev.invitedUsers && Array.isArray(ev.invitedUsers) && ev.invitedUsers.includes(myId);
            const inviteStatus = (ev.invitationStatus && ev.invitationStatus[myId]) ? ev.invitationStatus[myId] : 'pending';
            
            let statusBadge = '';
            if (isInvited && ev.creatorId !== myId) {
                if (inviteStatus === 'pending') statusBadge = '⏳ ';
                else if (inviteStatus === 'accepted') statusBadge = '✅ ';
            }

            const serIcon = ev.seriesId ? '🔁 ' : '';
            eventsHtml += `
                <div class="cal-event-pill" style="border-left:3px solid ${color}; background:${color}18;" onclick="event.stopPropagation(); openCalendarEventDetailsModal('${ev.id}')">
                    <span class="cal-event-time">${escapeHtml(ev.time || '--:--')}</span>
                    <span class="cal-event-title-text">${statusBadge}${privIcon}${serIcon}${escapeHtml(ev.title || 'Termin')}</span>
                </div>
            `;
        });

        html += `
            <div class="calendar-day-cell ${isToday ? 'is-today' : ''}" onclick="onCalendarCellClick('${dateKey}')">
                <div class="cal-day-num">${d}</div>
                <div class="cal-day-events-wrapper">${eventsHtml}</div>
            </div>
        `;
    }

    const totalCellsSoFar = startDayOfWeek + totalDaysInMonth;
    const trailingDays = (7 - (totalCellsSoFar % 7)) % 7;
    for (let j = 1; j <= trailingDays; j++) {
        html += `<div class="calendar-day-cell is-other-month"><div class="cal-day-num">${j}</div></div>`;
    }

    grid.innerHTML = html;
}

function onCalendarCellClick(dateKey) {
    if (!sessionUser) return;
    activeDetailEventId = null;
    openCreateEventModal(dateKey);
}

function handleCalendarCreatorSelectionChange() {
    const sel = document.getElementById('calEventCreatorSelection');
    const subCont = document.getElementById('calEventSubCreatorContainer');
    const subInp = document.getElementById('calEventSubCreatorName');
    if (!sel || !subCont) return;

    const val = sel.value;
    const myName = sessionUser ? `${sessionUser.vorname} ${sessionUser.nachname}` : '';

    if (val === 'self' || val.includes(myName)) {
        subCont.style.display = 'none';
        if (subInp) subInp.value = '';
    } else {
        subCont.style.display = 'block';
        if (subInp && !subInp.value) {
            subInp.value = sessionUser ? `${sessionUser.vorname} ${sessionUser.nachname}` : '';
        }
    }
}

function openCreateEventModal(prefillDate = null) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.canCreateCalendar && !eff.isAdmin && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zum Erstellen von Kalenderterminen!');
        return;
    }
    const modal = document.getElementById('calendarEventModal');
    if (!modal) return;

    activeDetailEventId = null;
    document.getElementById('editingCalendarEventId').value = '';
    document.getElementById('calendarEventModalHeading').textContent = '📅 Neuen Kalender Termin eintragen';

    const dateInp = document.getElementById('calEventDate');
    const timeInp = document.getElementById('calEventTime');
    const titleInp = document.getElementById('calEventTitle');
    const descInp = document.getElementById('calEventDesc');
    const repSel = document.getElementById('calEventRepeat');
    const repContainer = document.getElementById('calEventRepeatContainer');
    const selCreator = document.getElementById('calEventCreatorSelection');
    const subCont = document.getElementById('calEventSubCreatorContainer');
    const subInp = document.getElementById('calEventSubCreatorName');
    const privateCb = document.getElementById('calEventIsPrivate');
    const selectAllCb = document.getElementById('calSelectAllRolesCheckbox');
    const targetRolesContainer = document.getElementById('calEventRolesSelectionContainer');
    const invitedUsersContainer = document.getElementById('calEventInvitedUsersContainer');

    if (repContainer) repContainer.style.display = 'block';

    if (prefillDate && dateInp) {
        dateInp.value = prefillDate;
    } else if (dateInp) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        dateInp.value = `${y}-${m}-${d}`;
    }

    if (timeInp) timeInp.value = '20:00';
    if (titleInp) titleInp.value = '';
    if (descInp) descInp.value = '';
    if (repSel) repSel.value = 'none';
    if (subInp) subInp.value = '';
    if (subCont) subCont.style.display = 'none';
    if (privateCb) privateCb.checked = false;
    if (selectAllCb) selectAllCb.checked = false;
    togglePrivateEventOption(false);

    if (selCreator) {
        const playerName = `${sessionUser.vorname} ${sessionUser.nachname}` + (sessionUser.dn ? ` (${sessionUser.dn})` : '');
        const eff = getUserEffectivePermissions(sessionUser);
        const myRoles = getUserRolesList(sessionUser);
        const isAdminOrMaster = eff.isAdmin || eff.isMasterAdmin;

        const allPossibleDepts = [
            { id: 'self', label: `👤 ${playerName}`, val: 'self', color: '#38bdf8' },
            { id: 'masteradmin', label: '👑 Leitungsebene', val: 'Leitungsebene', color: '#eab308' },
            { id: 'ausbildungsleitung', label: '🎓 Bereich Ausbildung', val: 'Ausbildung', color: '#8b5cf6' },
            { id: 'cls', label: '💉 CLS Ausbilder', val: 'CLS Ausbilder', color: '#06b6d4' },
            { id: 'ehk', label: '🩺 EHK Ausbilder', val: 'EHK Ausbilder', color: '#10b981' },
            { id: 'luftrettung', label: '🚁 Luftrettung', val: 'Luftrettung', color: '#0284c7' },
            { id: 'psychologie', label: '🧠 Psychologie', val: 'Psychologie', color: '#f59e0b' },
            { id: 'personalabteilung', label: '💼 Personalabteilung', val: 'Personalabteilung', color: '#ec4899' }
        ];

        const allowedDepts = allPossibleDepts.filter(d => {
            if (d.id === 'self') return true;
            if (isAdminOrMaster) return true;
            return myRoles.includes(d.id);
        });

        selCreator.innerHTML = allowedDepts.map(d => `<option value="${escapeHtml(d.val)}" data-color="${d.color}">${escapeHtml(d.label)}</option>`).join('');
    }

    if (targetRolesContainer) {
        const sortedRoles = Object.values(cachedRoles).sort((a,b) => (a.name||'').localeCompare(b.name||'', 'de'));
        targetRolesContainer.innerHTML = sortedRoles.map(r => `
            <label for="cal_role_${r.id}" style="display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;background:rgba(30,41,59,0.4);border-radius:6px;font-size:13px;">
                <input type="checkbox" id="cal_role_${r.id}" class="cal-target-role-cb" value="${escapeHtml(r.id)}">
                <span style="color:${sanitizeRoleColor(r.color)};font-weight:700;">${r.icon ? escapeHtml(r.icon) + ' ' : ''}${escapeHtml(r.name)}</span>
            </label>
        `).join('');
    }

    if (invitedUsersContainer) {
        const myId = getUserAccountId(sessionUser);
        const allUsers = Object.entries(cachedUsers).sort((a,b) => (a[1].nachname||'').localeCompare(b[1].nachname||'', 'de'));
        invitedUsersContainer.innerHTML = allUsers.filter(([uId]) => uId !== myId).map(([uId, u]) => `
            <label for="cal_invite_${uId}" style="display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;background:rgba(30,41,59,0.4);border-radius:6px;font-size:13px;">
                <input type="checkbox" id="cal_invite_${uId}" class="cal-invited-user-cb" value="${escapeHtml(uId)}">
                <span><b>${escapeHtml(u.vorname||'')} ${escapeHtml(u.nachname||'')}</b> <span style="color:var(--primary);font-size:11px;">(${escapeHtml(u.dn||'--')})</span></span>
            </label>
        `).join('');
    }

    modal.style.display = 'flex';
}

function togglePrivateEventOption(isPrivate) {
    const rolesSec = document.getElementById('calEventRolesSection');
    if (rolesSec) {
        rolesSec.style.opacity = isPrivate ? '0.35' : '1';
        rolesSec.style.pointerEvents = isPrivate ? 'none' : 'auto';
    }
}

function toggleAllCalendarRoles(checkAll) {
    document.querySelectorAll('.cal-target-role-cb').forEach(cb => {
        cb.checked = checkAll;
    });
}

function closeCalendarEventModal() {
    const modal = document.getElementById('calendarEventModal');
    if (modal) modal.style.display = 'none';
    activeDetailEventId = null;
}

function saveCalendarEvent() {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);

    const editId = document.getElementById('editingCalendarEventId')?.value;
    const startDateStr = document.getElementById('calEventDate')?.value;
    const time = document.getElementById('calEventTime')?.value;
    const title = document.getElementById('calEventTitle')?.value.trim();
    const desc = document.getElementById('calEventDesc')?.value.trim() || '';
    const repeatOption = document.getElementById('calEventRepeat')?.value || 'none';
    const isPrivate = !!document.getElementById('calEventIsPrivate')?.checked;
    
    const selCreatorEl = document.getElementById('calEventCreatorSelection');
    const rawVal = selCreatorEl ? selCreatorEl.value : 'self';
    const selectedOption = selCreatorEl ? selCreatorEl.options[selCreatorEl.selectedIndex] : null;
    const roleColor = selectedOption ? selectedOption.getAttribute('data-color') : '#38bdf8';

    const subCreatorInp = document.getElementById('calEventSubCreatorName');
    const specificContact = (subCreatorInp && subCreatorInp.value.trim()) ? subCreatorInp.value.trim() : `${sessionUser.vorname} ${sessionUser.nachname}`;

    let creatorDisplay = '';
    if (rawVal === 'self') {
        creatorDisplay = `${sessionUser.vorname} ${sessionUser.nachname}`;
    } else {
        creatorDisplay = `${rawVal} (${specificContact})`;
    }

    if (!startDateStr || !time || !title) {
        alert('Bitte Datum, Uhrzeit und Titel angeben!');
        return;
    }

    const myId = getUserAccountId(sessionUser);

    let targetRoles = [];
    if (!isPrivate) {
        const selectAllCb = document.getElementById('calSelectAllRolesCheckbox');
        if (selectAllCb && selectAllCb.checked) {
            targetRoles = ['all'];
        } else {
            document.querySelectorAll('.cal-target-role-cb:checked').forEach(cb => targetRoles.push(cb.value));
        }
    }

    let invitedUsers = [];
    let invitationStatus = {};
    invitationStatus[myId] = 'accepted';

    document.querySelectorAll('.cal-invited-user-cb:checked').forEach(cb => {
        invitedUsers.push(cb.value);
        if (cb.value !== myId) {
            invitationStatus[cb.value] = 'pending';
        }
    });

    if (editId) {
        const existingEv = cachedCalendar[editId] || {};
        const myName = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim().toLowerCase();
        const legacyOwner = !existingEv.creatorId && ((existingEv.enteredBy || existingEv.creator || '').trim().toLowerCase() === myName);
        const canEditExisting = existingEv.creatorId === myId || legacyOwner || eff.isAdmin || eff.isMasterAdmin;
        if (!canEditExisting) {
            alert('Keine Berechtigung zum Bearbeiten dieses Termins!');
            return;
        }
        const mergedStatus = Object.assign({}, existingEv.invitationStatus || {});

        invitedUsers.forEach(uId => {
            if (!mergedStatus[uId]) {
                mergedStatus[uId] = 'pending';
            }
        });
        mergedStatus[myId] = 'accepted';

        const updateData = {
            date: startDateStr,
            time,
            title,
            desc,
            creatorDisplay,
            roleColor,
            isPrivate,
            targetRoles: isPrivate ? [] : targetRoles,
            invitedUsers: invitedUsers,
            invitationStatus: mergedStatus,
            lastEditedBy: sessionUser.vorname + ' ' + sessionUser.nachname,
            lastEditedTs: Date.now()
        };

        db.ref('data/calendar/' + editId).update(updateData).then(() => {
            closeCalendarEventModal();
            logAdminAudit('Kalendertermin bearbeitet', `${creatorDisplay}: ${title} (${startDateStr})`);
            alert('✅ Kalendertermin erfolgreich aktualisiert!');
        });
        return;
    }

    if (!eff.canCreateCalendar && !eff.isAdmin && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zum Erstellen von Kalenderterminen!');
        return;
    }

    let count = 1;
    if (repeatOption === 'weekly_1') count = 2;
    else if (repeatOption === 'weekly_2') count = 3;
    else if (repeatOption === 'weekly_4') count = 4;
    else if (repeatOption === 'weekly_8') count = 8;

    const seriesId = count > 1 ? ('ser_' + Date.now()) : null;
    const promises = [];
    const [startY, startM, startD] = startDateStr.split('-').map(Number);

    for (let idx = 0; idx < count; idx++) {
        const dObj = new Date(startY, startM - 1, startD + (idx * 7));
        const curY = dObj.getFullYear();
        const curM = String(dObj.getMonth() + 1).padStart(2, '0');
        const curD = String(dObj.getDate()).padStart(2, '0');
        const evDate = `${curY}-${curM}-${curD}`;

        const ev = {
            date: evDate,
            time,
            title,
            desc,
            creatorDisplay,
            roleColor,
            isPrivate,
            targetRoles: isPrivate ? [] : targetRoles,
            invitedUsers: invitedUsers,
            invitationStatus: invitationStatus,
            creatorId: myId,
            repeatSeries: count > 1,
            seriesId: seriesId,
            enteredBy: sessionUser.vorname + ' ' + sessionUser.nachname,
            enteredByDN: sessionUser.dn || '--',
            ts: Date.now()
        };

        promises.push(db.ref('data/calendar').push(ev));
    }

    Promise.all(promises).then(() => {
        closeCalendarEventModal();
        logAdminAudit('Kalendertermin(e) angelegt', `${creatorDisplay}: ${title} (${count}x Serie ab ${startDateStr})`);
        alert(`✅ ${count > 1 ? count + ' Termine der Serie' : 'Termin'} erfolgreich gespeichert!`);
    });
}

function openCalendarEventDetailsModal(eventId) {
    const ev = cachedCalendar[eventId];
    if (!ev) return;
    activeDetailEventId = eventId;

    const modal = document.getElementById('calendarEventDetailsModal');
    const titleEl = document.getElementById('calDetailsTitle');
    const bodyEl = document.getElementById('calDetailsBody');
    const delBtn = document.getElementById('btnDeleteCalendarEvent');
    const editBtn = document.getElementById('btnEditCalendarEvent');
    if (!modal || !bodyEl) return;

    const color = sanitizeRoleColor(ev.roleColor);
    if (titleEl) titleEl.textContent = (ev.isPrivate ? '🔒 ' : '') + (ev.title || 'Termin');

    let targetRoleNames = 'Alle Rollen / Öffentlich';
    if (ev.isPrivate) {
        targetRoleNames = '🔒 Nur für mich & Eingeladene sichtbar (Privat)';
    } else if (ev.targetRoles && ev.targetRoles.length) {
        if (ev.targetRoles.includes('all')) {
            targetRoleNames = 'Alle Rollen';
        } else {
            targetRoleNames = ev.targetRoles.map(rid => (cachedRoles[rid]?.name || defaultRoles[rid]?.name || rid)).join(', ');
        }
    }

    let invitedNames = 'Keine weiteren Personen eingeladen';
    if (ev.invitedUsers && ev.invitedUsers.length) {
        invitedNames = ev.invitedUsers.map(uId => {
            const u = cachedUsers[uId];
            const nameStr = u ? `${u.vorname} ${u.nachname} (${u.dn || '--'})` : uId;
            const status = (ev.invitationStatus && ev.invitationStatus[uId]) ? ev.invitationStatus[uId] : 'pending';
            let icon = '⏳';
            if (status === 'accepted') icon = '✅';
            if (status === 'declined') icon = '❌';
            return `${nameStr} [${icon} ${status}]`;
        }).join('<br>');
    }

    const myId = getUserAccountId(sessionUser);
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const myName = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim().toLowerCase();
    const legacyOwner = !ev.creatorId && ((ev.enteredBy || ev.creator || '').trim().toLowerCase() === myName);
    const isOwnerOrAdmin = (ev.creatorId === myId) || legacyOwner || eff.isAdmin || eff.isMasterAdmin;
    const isInvitedGuest = ev.invitedUsers && Array.isArray(ev.invitedUsers) && ev.invitedUsers.includes(myId) && (ev.creatorId !== myId);
    const myCurrentStatus = (ev.invitationStatus && ev.invitationStatus[myId]) ? ev.invitationStatus[myId] : 'pending';

    let rsvpSectionHtml = '';
    if (isInvitedGuest) {
        rsvpSectionHtml = `
            <div style="background:rgba(56,189,248,0.08);border:1px solid var(--primary);border-radius:10px;padding:12px;margin-bottom:14px;">
                <div style="font-weight:800;font-size:13px;color:var(--primary);margin-bottom:6px;">📨 Dein Einladungs-Status: <span style="color:var(--text-main);">${myCurrentStatus === 'accepted' ? '✅ Angenommen' : (myCurrentStatus === 'declined' ? '❌ Abgelehnt' : '⏳ Ausstehend')}</span></div>
                <div style="display:flex;gap:10px;">
                    <button type="button" class="btn" style="width:auto;margin:0;padding:6px 14px;background:var(--success);color:#080c14;font-weight:800;font-size:12px;" onclick="respondToCalendarInvite('${eventId}', 'accepted')">✅ Zusagen / Annehmen</button>
                    <button type="button" class="btn" style="width:auto;margin:0;padding:6px 14px;background:rgba(244,63,94,0.2);color:var(--danger);border:1px solid var(--danger);font-weight:800;font-size:12px;" onclick="respondToCalendarInvite('${eventId}', 'declined')">❌ Absagen / Ablehnen</button>
                </div>
            </div>
        `;
    }

    bodyEl.innerHTML = `
        ${rsvpSectionHtml}
        <div style="background:rgba(30,41,59,0.5);border-left:4px solid ${color};padding:12px 16px;border-radius:8px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <span>📅 <b>Datum:</b> ${escapeHtml(ev.date)}</span>
                <span>⏰ <b>Uhrzeit:</b> ${escapeHtml(ev.time)} Uhr</span>
            </div>
            <div style="margin-top:6px;font-size:13px;color:var(--text-muted);">
                Ersteller / Bereich: <b style="color:${color};">${escapeHtml(ev.creatorDisplay || ev.creator || 'SAMD')}</b>
                <br>Eingetragen von: <span style="color:var(--text-main);">${escapeHtml(ev.enteredBy || ev.creator || 'System')} (${escapeHtml(ev.enteredByDN || '--')})</span>
                ${ev.seriesId ? `<br><span style="color:var(--primary);font-weight:700;">🔁 Teil einer Serientermin-Reihe</span>` : ''}
            </div>
        </div>
        <div style="margin-bottom:10px;">
            <label style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Sichtbarkeit / Freigabe:</label>
            <div style="font-size:14px;color:${ev.isPrivate ? 'var(--warning)' : 'var(--primary)'};font-weight:700;">${escapeHtml(targetRoleNames)}</div>
        </div>
        <div style="margin-bottom:14px;">
            <label style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Eingeladene Mitarbeiter & Status:</label>
            <div style="font-size:13px;color:var(--text-main);line-height:1.6;">${invitedNames}</div>
        </div>
        <div>
            <label style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Beschreibung / Notizen:</label>
            <div style="background:rgba(8,12,20,0.6);border:1px solid var(--border);border-radius:8px;padding:12px;white-space:pre-wrap;color:var(--text-main);font-size:14px;min-height:60px;">${formatTextWithLinks(ev.desc || 'Keine weitere Beschreibung vorhanden.')}</div>
        </div>
    `;

    if (delBtn) delBtn.style.display = (isOwnerOrAdmin || eff.delCalendar) ? 'inline-block' : 'none';
    if (editBtn) editBtn.style.display = isOwnerOrAdmin ? 'inline-block' : 'none';

    modal.style.display = 'flex';
}

function respondToCalendarInvite(eventId, status) {
    if (!sessionUser || !['accepted','declined'].includes(status)) return;
    const myId = getUserAccountId(sessionUser);
    const ev = cachedCalendar[eventId];
    if (!ev || !Array.isArray(ev.invitedUsers) || !ev.invitedUsers.includes(myId)) {
        alert('Du bist für diesen Termin nicht eingeladen.');
        return;
    }
    db.ref(`data/calendar/${eventId}/invitationStatus/${myId}`).set(status).then(() => {
        closeCalendarEventDetailsModal();
        alert(status === 'accepted' ? '✅ Du hast den Termin verbindlich angenommen!' : '❌ Du hast die Einladung abgelehnt.');
    });
}

function closeCalendarEventDetailsModal() {
    const modal = document.getElementById('calendarEventDetailsModal');
    if (modal) modal.style.display = 'none';
    activeDetailEventId = null;
}

function editCalendarEventAction() {
    if (!sessionUser || !activeDetailEventId) return;
    const ev = cachedCalendar[activeDetailEventId];
    if (!ev) return;
    const myId = getUserAccountId(sessionUser);
    const eff = getUserEffectivePermissions(sessionUser);
    const myName = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim().toLowerCase();
    const legacyOwner = !ev.creatorId && ((ev.enteredBy || ev.creator || '').trim().toLowerCase() === myName);
    if (ev.creatorId !== myId && !legacyOwner && !eff.isAdmin && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zum Bearbeiten dieses Termins!');
        return;
    }

    const modal = document.getElementById('calendarEventModal');
    if (!modal) return;

    closeCalendarEventDetailsModal();

    document.getElementById('editingCalendarEventId').value = activeDetailEventId;
    document.getElementById('calendarEventModalHeading').textContent = '✏️ Kalender Termin bearbeiten';

    const dateInp = document.getElementById('calEventDate');
    const timeInp = document.getElementById('calEventTime');
    const titleInp = document.getElementById('calEventTitle');
    const descInp = document.getElementById('calEventDesc');
    const repContainer = document.getElementById('calEventRepeatContainer');
    const selCreator = document.getElementById('calEventCreatorSelection');
    const subCont = document.getElementById('calEventSubCreatorContainer');
    const subInp = document.getElementById('calEventSubCreatorName');
    const privateCb = document.getElementById('calEventIsPrivate');
    const selectAllCb = document.getElementById('calSelectAllRolesCheckbox');
    const targetRolesContainer = document.getElementById('calEventRolesSelectionContainer');
    const invitedUsersContainer = document.getElementById('calEventInvitedUsersContainer');

    if (repContainer) repContainer.style.display = 'none';

    if (dateInp) dateInp.value = ev.date || '';
    if (timeInp) timeInp.value = ev.time || '20:00';
    if (titleInp) titleInp.value = ev.title || '';
    if (descInp) descInp.value = ev.desc || '';
    if (privateCb) privateCb.checked = !!ev.isPrivate;
    togglePrivateEventOption(!!ev.isPrivate);

    if (selCreator) {
        const playerName = `${sessionUser.vorname} ${sessionUser.nachname}` + (sessionUser.dn ? ` (${sessionUser.dn})` : '');
        const eff = getUserEffectivePermissions(sessionUser);
        const myRoles = getUserRolesList(sessionUser);
        const isAdminOrMaster = eff.isAdmin || eff.isMasterAdmin;

        const allPossibleDepts = [
            { id: 'self', label: `👤 ${playerName}`, val: 'self', color: '#38bdf8' },
            { id: 'masteradmin', label: '👑 Leitungsebene', val: 'Leitungsebene', color: '#eab308' },
            { id: 'ausbildungsleitung', label: '🎓 Bereich Ausbildung', val: 'Ausbildung', color: '#8b5cf6' },
            { id: 'cls', label: '💉 CLS Ausbilder', val: 'CLS Ausbilder', color: '#06b6d4' },
            { id: 'ehk', label: '🩺 EHK Ausbilder', val: 'EHK Ausbilder', color: '#10b981' },
            { id: 'luftrettung', label: '🚁 Luftrettung', val: 'Luftrettung', color: '#0284c7' },
            { id: 'psychologie', label: '🧠 Psychologie', val: 'Psychologie', color: '#f59e0b' },
            { id: 'personalabteilung', label: '💼 Personalabteilung', val: 'Personalabteilung', color: '#ec4899' }
        ];

        const allowedDepts = allPossibleDepts.filter(d => {
            if (d.id === 'self') return true;
            if (isAdminOrMaster) return true;
            return myRoles.includes(d.id);
        });

        let matchedVal = 'self';
        let extractedSub = '';
        allowedDepts.forEach(d => {
            if (d.val !== 'self' && ev.creatorDisplay && ev.creatorDisplay.startsWith(d.val)) {
                matchedVal = d.val;
                const m = ev.creatorDisplay.match(/\((.*?)\)/);
                if (m && m[1]) extractedSub = m[1];
            }
        });

        selCreator.innerHTML = allowedDepts.map(d => `<option value="${escapeHtml(d.val)}" data-color="${d.color}" ${matchedVal === d.val ? 'selected' : ''}>${escapeHtml(d.label)}</option>`).join('');

        if (subCont && subInp) {
            if (matchedVal === 'self') {
                subCont.style.display = 'none';
                subInp.value = '';
            } else {
                subCont.style.display = 'block';
                subInp.value = extractedSub || (sessionUser ? `${sessionUser.vorname} ${sessionUser.nachname}` : '');
            }
        }
    }

    const hasAll = (ev.targetRoles && ev.targetRoles.includes('all'));
    if (selectAllCb) selectAllCb.checked = hasAll;

    if (targetRolesContainer) {
        const sortedRoles = Object.values(cachedRoles).sort((a,b) => (a.name||'').localeCompare(b.name||'', 'de'));
        targetRolesContainer.innerHTML = sortedRoles.map(r => {
            const isChecked = hasAll || (ev.targetRoles && ev.targetRoles.includes(r.id));
            return `
                <label for="edit_cal_role_${r.id}" style="display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;background:rgba(30,41,59,0.4);border-radius:6px;font-size:13px;">
                    <input type="checkbox" id="edit_cal_role_${r.id}" class="cal-target-role-cb" value="${escapeHtml(r.id)}" ${isChecked ? 'checked' : ''}>
                    <span style="color:${sanitizeRoleColor(r.color)};font-weight:700;">${r.icon ? escapeHtml(r.icon) + ' ' : ''}${escapeHtml(r.name)}</span>
                </label>
            `;
        }).join('');
    }

    if (invitedUsersContainer) {
        const myId = getUserAccountId(sessionUser);
        const allUsers = Object.entries(cachedUsers).sort((a,b) => (a[1].nachname||'').localeCompare(b[1].nachname||'', 'de'));
        invitedUsersContainer.innerHTML = allUsers.filter(([uId]) => uId !== myId).map(([uId, u]) => {
            const isInv = (ev.invitedUsers && Array.isArray(ev.invitedUsers) && ev.invitedUsers.includes(uId));
            return `
                <label for="edit_cal_invite_${uId}" style="display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;background:rgba(30,41,59,0.4);border-radius:6px;font-size:13px;">
                    <input type="checkbox" id="edit_cal_invite_${uId}" class="cal-invited-user-cb" value="${escapeHtml(uId)}" ${isInv ? 'checked' : ''}>
                    <span><b>${escapeHtml(u.vorname||'')} ${escapeHtml(u.nachname||'')}</b> <span style="color:var(--primary);font-size:11px;">(${escapeHtml(u.dn||'--')})</span></span>
                </label>
            `;
        }).join('');
    }

    modal.style.display = 'flex';
}

function deleteCalendarEventAction() {
    if (!activeDetailEventId) return;
    const ev = cachedCalendar[activeDetailEventId];
    if (!ev) return;

    const myId = getUserAccountId(sessionUser);
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const myName = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim().toLowerCase();
    const legacyOwner = !ev.creatorId && ((ev.enteredBy || ev.creator || '').trim().toLowerCase() === myName);
    const isOwnerOrAdmin = (ev.creatorId === myId) || legacyOwner || eff.isAdmin || eff.isMasterAdmin || eff.delCalendar;

    if (!isOwnerOrAdmin) {
        alert('Keine Berechtigung zum Löschen dieses Termins!');
        return;
    }

    if (ev.seriesId) {
        const deleteAll = confirm('Dieser Termin ist Teil einer Terminserie!\n\nKlicke [OK], um die GESAMTE Serie zu löschen.\nKlicke [Abbrechen], um nur diesen einzelnen Termin zu löschen.');
        if (deleteAll) {
            const sId = ev.seriesId;
            db.ref('data/calendar').once('value', snap => {
                const all = snap.val() || {};
                const deletes = [];
                Object.entries(all).forEach(([k, item]) => {
                    if (item.seriesId === sId) {
                        deletes.push(db.ref('data/calendar/' + k).remove());
                    }
                });
                Promise.all(deletes).then(() => {
                    logAdminAudit('Terminserie gelöscht', `Gesamte Serie ${sId} gelöscht von ${sessionUser.vorname} ${sessionUser.nachname}`);
                    closeCalendarEventDetailsModal();
                    alert('✅ Die gesamte Terminserie wurde erfolgreich gelöscht!');
                });
            });
            return;
        }
    }

    if (confirm('Möchtest du diesen Termin wirklich dauerhaft aus dem Kalender entfernen?')) {
        db.ref('data/calendar/' + activeDetailEventId).remove().then(() => {
            logAdminAudit('Kalendertermin gelöscht', `Termin ID ${activeDetailEventId} entfernt von ${sessionUser.vorname} ${sessionUser.nachname}`);
            closeCalendarEventDetailsModal();
            alert('✅ Termin erfolgreich gelöscht!');
        });
    }
}

/* ══════════════════════════════════════════════════════════════
   MITARBEITER-KARTEI & FOTO-WORKFLOW (FÜLLIGER & CA. 20% GRÖSSER)
══════════════════════════════════════════════════════════════ */
function parseDN(dnStr) {
    if (!dnStr) return 999999;
    const digits = dnStr.toString().replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 999999;
}

function renderStaffDirectory() {
    const grid = document.getElementById('staffDirectoryGrid');
    const badge = document.getElementById('staffCountBadge');
    if (!grid) return;

    const q = (document.getElementById('searchStaffInput')?.value || '').trim().toLowerCase();
    const canManagePhotos = canUserManageEmployeePhotos();
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const canManageRegistrations = !!(eff.canManageInstructors || eff.isAdmin || eff.isMasterAdmin);

    const staffList = Object.entries(cachedUsers || {}).filter(([, u]) => {
        if (canManageRegistrations) return true;
        return u.status === 'approved' || u.isAdmin || u.isMasterAdmin;
    });

    if (badge) badge.textContent = staffList.length;

    staffList.sort((a, b) => {
        const dnA = parseDN(a[1].dn);
        const dnB = parseDN(b[1].dn);
        if (dnA !== dnB) return dnA - dnB;
        return (a[1].nachname || '').localeCompare(b[1].nachname || '', 'de');
    });

    const filtered = staffList.filter(([uId, u]) => {
        if (!q) return true;
        const dnClean = (u.dn || '').toString().toLowerCase();
        const vClean = (u.vorname || '').toLowerCase();
        const nClean = (u.nachname || '').toLowerCase();
        const fullText = `${dnClean} ${vClean} ${nClean} ${vClean} ${nClean}`;
        return fullText.includes(q);
    });

    if (!filtered.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">Keine Mitarbeiter gefunden.</div>';
        return;
    }

    grid.innerHTML = filtered.map(([uId, u]) => {
        const rawPhoto = (u.photoUrl || '').trim();
        const isCustomPhoto = rawPhoto && !rawPhoto.includes('mdlogo') && rawPhoto !== DEFAULT_MD_LOGO_FALLBACK;
        const photoSrc = isCustomPhoto ? rawPhoto : 'mdlogo.png';
        const isLogo = !isCustomPhoto;
        const dnFormatted = u.dn ? `DN ${u.dn.toString().replace(/[^0-9]/g, '') || u.dn}` : 'Keine DN';

        return `
            <div class="staff-card">
                <div class="staff-photo-wrapper">
                    <img src="${photoSrc}" 
                         alt="${escapeHtml(u.vorname)} ${escapeHtml(u.nachname)}" 
                         class="staff-portrait-img ${isLogo ? 'is-logo' : ''}" 
                         onerror="this.onerror=null; this.src='${DEFAULT_MD_LOGO_FALLBACK}'; this.classList.add('is-logo');">
                </div>
                <div class="staff-card-content">
                    <div class="staff-dn-pill">${escapeHtml(dnFormatted)}</div>
                    <h3 class="staff-name-title">${escapeHtml(u.vorname || '')} ${escapeHtml(u.nachname || '')}</h3>
                    <div class="staff-roles-container">${renderUserRoleBadges(u)}</div>
                    ${canManageRegistrations ? `
                        <div style="margin-top:8px;font-size:12px;font-weight:800;color:${getUserStatusDisplay(u.status).color};">${getUserStatusDisplay(u.status).text}</div>
                        ${u.status !== 'approved' ? `
                            <div class="staff-card-admin-actions">
                                <button type="button" class="btn-staff-quick-action" onclick="approveUser('${uId}')" title="Diesen Mitarbeiter freischalten">✅ Freischalten</button>
                            </div>
                        ` : ''}
                    ` : ''}
                    ${(canManagePhotos && u.status === 'approved') ? `
                        <div class="staff-card-admin-actions">
                            <label class="btn-staff-quick-action btn-upload" title="Neues bearbeitetes Foto mit Logo für diesen Mitarbeiter einstellen">
                                🎨 Foto einstellen
                                <input type="file" accept="image/*" style="display:none;" onchange="uploadProcessedStaffPhoto(event, '${uId}')">
                            </label>
                            ${isCustomPhoto ? `
                                <button type="button" class="btn-staff-quick-action btn-reset" onclick="resetStaffPhotoToDefault('${uId}')" title="Auf Standard-Logo zurücksetzen">🔄 Logo</button>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function filterStaffDirectory() {
    renderStaffDirectory();
}

function resetStaffPhotoToDefault(uId) {
    if (!canUserManageEmployeePhotos()) return;
    if (confirm('Profilbild dieses Mitarbeiters wieder auf das Standard-Logo (mdlogo.png) zurücksetzen?')) {
        db.ref('data/users/' + uId + '/photoUrl').set('mdlogo.png').then(() => {
            logAdminAudit('Mitarbeiter-Foto zurückgesetzt', `Profilbild für ${uId} wurde auf Standard-Logo zurückgesetzt.`);
            renderStaffDirectory();
        });
    }
}

function scaleImageProportionally(file, maxWidth, maxHeight, callback) {
    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            let w = img.width;
            let h = img.height;
            const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/webp', 0.7));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function openStaffPhotoUploadModal() {
    if (!sessionUser) { alert('Nicht eingeloggt!'); return; }
    const modal = document.getElementById('staffPhotoUploadModal');
    const nameEl = document.getElementById('staffUploadMedicName');
    const dnEl = document.getElementById('staffUploadMedicDN');
    const prevCont = document.getElementById('staffPhotoPreviewContainer');
    const fileInp = document.getElementById('staffPhotoFileInput');

    if (nameEl) nameEl.textContent = `${sessionUser.vorname} ${sessionUser.nachname}`;
    if (dnEl) dnEl.textContent = sessionUser.dn || '--';
    if (prevCont) prevCont.style.display = 'none';
    if (fileInp) fileInp.value = '';
    _currentUploadedBase64 = null;

    modal.style.display = 'flex';
}

function closeStaffPhotoUploadModal() {
    const modal = document.getElementById('staffPhotoUploadModal');
    if (modal) modal.style.display = 'none';
}

let _currentUploadedBase64 = null;

function previewStaffPhotoUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    scaleImageProportionally(file, 360, 430, (scaledBase64) => {
        _currentUploadedBase64 = scaledBase64;
        const prevImg = document.getElementById('staffPhotoPreviewImg');
        const prevCont = document.getElementById('staffPhotoPreviewContainer');
        if (prevImg) prevImg.src = _currentUploadedBase64;
        if (prevCont) prevCont.style.display = 'block';
    });
}

function submitStaffPhotoUpload() {
    if (!sessionUser || !_currentUploadedBase64) {
        alert('Bitte wähle zuerst ein Foto aus!');
        return;
    }

    const uId = getUserAccountId(sessionUser);

    const photoEntry = {
        userId: uId,
        userName: `${sessionUser.vorname} ${sessionUser.nachname}`,
        userDN: sessionUser.dn || '--',
        rawPhoto: _currentUploadedBase64,
        date: new Date().toLocaleDateString('de-DE'),
        ts: Date.now()
    };

    db.ref('data/employeePhotos/' + uId).set(photoEntry).then(() => {
        closeStaffPhotoUploadModal();
        logAdminAudit('Foto zur Bearbeitung eingereicht', `${sessionUser.vorname} ${sessionUser.nachname} (DN: ${sessionUser.dn}) hat ein Foto eingereicht.`);
        alert('✅ Foto erfolgreich eingereicht!\n\nDein Bild liegt nun im internen Foto-Ordner der Leitung/Personalabteilung.');
    });
}

function openStaffPhotoAdminModal() {
    if (!canUserManageEmployeePhotos()) {
        alert('Keine Berechtigung für den Foto-Ordner!');
        return;
    }
    renderStaffPhotoAdminList();
    document.getElementById('staffPhotoAdminModal').style.display = 'flex';
}

function closeStaffPhotoAdminModal() {
    document.getElementById('staffPhotoAdminModal').style.display = 'none';
}

function renderStaffPhotoAdminList() {
    const c = document.getElementById('staffPhotoAdminListContainer');
    if (!c) return;

    const entries = Object.entries(cachedPhotos || {}).sort((a,b) => (b[1].ts||0) - (a[1].ts||0));

    if (!entries.length) {
        c.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-muted);">Keine eingereichten Originalfotos im Ordner vorhanden.</div>';
        return;
    }

    c.innerHTML = entries.map(([uId, p]) => `
        <div class="staff-admin-photo-card">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Eingereicht: ${escapeHtml(p.date || '--')}</div>
            <img src="${p.rawPhoto}" 
                 alt="${escapeHtml(p.userName)}" 
                 class="staff-admin-photo-preview"
                 onerror="this.onerror=null; this.src='${DEFAULT_MD_LOGO_FALLBACK}';">
            <div style="margin-top:8px;text-align:center;">
                <b style="font-size:15px;color:var(--text-main);">${escapeHtml(p.userName)}</b><br>
                <span style="color:var(--primary);font-weight:700;font-size:13px;">DN: ${escapeHtml(p.userDN)}</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;margin-top:12px;width:100%;">
                <button type="button" class="btn" style="padding:6px;font-size:12px;background:var(--primary);color:#080c14;font-weight:800;margin:0;" onclick="downloadStaffOriginalPhoto('${uId}')">📥 Original herunterladen</button>
                <label class="btn" style="padding:6px;font-size:12px;background:var(--success);color:#080c14;font-weight:800;text-align:center;cursor:pointer;margin:0;">
                    🎨 Bearbeitetes Bild einsetzen
                    <input type="file" accept="image/*" style="display:none;" onchange="uploadProcessedStaffPhoto(event, '${uId}')">
                </label>
                <button type="button" class="btn-delete-row" style="font-size:12px;padding:5px;" onclick="deleteSubmittedRawPhoto('${uId}')">🗑️ Aus Ordner löschen</button>
            </div>
        </div>
    `).join('');
}

function downloadStaffOriginalPhoto(uId) {
    const p = cachedPhotos[uId];
    if (!p || !p.rawPhoto) return;
    const a = document.createElement('a');
    a.href = p.rawPhoto;
    a.download = `MMD_Original_${p.userDN ? p.userDN.replace(/\W/g,'') : 'DN'}_${(p.userName||'Medic').replace(/\s+/g,'_')}.png`;
    a.click();
}

function uploadProcessedStaffPhoto(event, uId) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!canUserManageEmployeePhotos()) {
        alert('Keine Berechtigung!');
        return;
    }

    scaleImageProportionally(file, 360, 430, (scaledBase64) => {
        db.ref('data/users/' + uId + '/photoUrl').set(scaledBase64).then(() => {
            logAdminAudit('Finales Dienstfoto hinterlegt', `Freigestelltes Bild für ${uId} von ${sessionUser.vorname} ${sessionUser.nachname} gespeichert.`);
            alert('✅ Finales Foto erfolgreich in die Mitarbeiter-Kartei eingesetzt!');
            renderStaffDirectory();
        });
    });
}

function deleteSubmittedRawPhoto(uId) {
    if (!canUserManageEmployeePhotos()) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isMasterAdmin && !eff.delPhotos && !eff.isAdmin) {
        alert('Keine Berechtigung zum Löschen aus dem Foto-Ordner!');
        return;
    }

    if (confirm('Dieses eingereichte Originalfoto aus dem Ordner entfernen?')) {
        db.ref('data/employeePhotos/' + uId).remove().then(() => {
            logAdminAudit('Originalfoto aus Ordner entfernt', `Foto-Einreichung von ${uId} gelöscht durch ${sessionUser.vorname} ${sessionUser.nachname}.`);
        });
    }
}

/* ── REITER: HIERARCHIE BOARD ────────────────---------------- */
function renderHierarchieBoard(hData) {
    if (!hData) return;
    hierarchieDaten = Object.assign({}, hierarchieDaten, hData);
    Object.keys(hierarchieDaten).forEach(key => {
        let val = hierarchieDaten[key];
        const d = document.getElementById('disp_h_' + key);
        if (d) {
            if (key.endsWith('_sub')) {
                d.textContent = (val && val !== '--') ? val : '';
                d.style.display = (val && val !== '--') ? 'inline-block' : 'none';
            } else {
                d.textContent = (val && val !== '#REF!') ? val : 'Aktuell nicht belegt';
            }
        }
        const i = document.getElementById('inp_h_' + key);
        if (i && document.activeElement !== i) i.value = (val !== 'Aktuell nicht belegt' && val !== '#REF!') ? val : '';
    });
}

function openHierarchieInlineModal() {
    if (!requireAdminAccess('Keine Berechtigung zur Bearbeitung der Hierarchie!')) return;
    const cont = document.getElementById('hierarchieInlineEditorContainer');
    if (!cont) return;

    const fields = [
        { grp: "⭐ Chiefebene", items: [
            { k: "chief_01", label: "01 Chief of SAMD" },
            { k: "chief_02", label: "02 Ass. Chief of SAMD" },
            { k: "chief_03", label: "03 Deputy Chief of SAMD" }
        ]},
        { grp: "🏢 Abteilungsleitungen", items: [
            { k: "dept_psych_l", label: "Psychologie (Leitung)" },
            { k: "dept_psych_sl", label: "Psychologie (Stellv. Leitung)" },
            { k: "dept_perso_l", label: "Personal (Leitung)" },
            { k: "dept_perso_sl", label: "Personal (Stellv. Leitung)" },
            { k: "dept_ausb_l", label: "Ausbildung (Leitung)" },
            { k: "dept_ausb_sl", label: "Ausbildung (Stellv. Leitung)" },
            { k: "dept_luft_l", label: "Luftrettung (Leitung)" },
            { k: "dept_luft_sl", label: "Luftrettung (Stellv. Leitung)" }
        ]},
        { grp: "🎖️ High Command", items: [
            { k: "domo_04", label: "04 D.o.M.O" },
            { k: "domo_04_sub", label: "04 Zusatzinfo / Stellv." },
            { k: "fod_05", label: "05 F.o.D" },
            { k: "fod_05_sub", label: "05 Zusatzinfo / Stellv." },
            { k: "chiefphys_06", label: "06 Chief Physician" },
            { k: "chiefphys_07", label: "07 Chief Physician" },
            { k: "lt_08", label: "08 Lieutenant" },
            { k: "lt_09", label: "09 Lieutenant" }
        ]},
        { grp: "🩺 Low Command (Belegungszahlen)", items: [
            { k: "a_emt_count", label: "A-EMT (Anzahl Belegung)" },
            { k: "emt_count", label: "EMT (Anzahl Belegung)" }
        ]}
    ];

    cont.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
            ${fields.map(g => `
                <div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:10px;border:1px solid var(--border);">
                    <h4 style="margin:0 0 10px 0;color:var(--primary);font-size:14px;">${g.grp}</h4>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:10px;">
                        ${g.items.map(item => `
                            <div>
                                <label for="inline_h_${item.k}" style="font-size:11px;margin-bottom:4px;">${item.label}</label>
                                <input type="text" id="inline_h_${item.k}" value="${hierarchieDaten[item.k] !== 'Aktuell nicht belegt' ? escapeHtml(hierarchieDaten[item.k] || '') : ''}" placeholder="Aktuell nicht belegt">
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}

            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;">
                <button type="button" class="btn" style="width:auto;background:var(--text-muted);" onclick="closeHierarchieInlineModal()">Abbrechen</button>
                <button type="button" class="btn" style="width:auto;background:var(--success);color:#080c14;font-weight:800;" onclick="saveHierarchieInline()">💾 Hierarchie speichern</button>
            </div>
        </div>
    `;

    document.getElementById('hierarchieInlineModal').style.display = 'flex';
}

function closeHierarchieInlineModal() {
    document.getElementById('hierarchieInlineModal').style.display = 'none';
}

function saveHierarchieInline() {
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!sessionUser || (!eff.isAdmin && !eff.isMasterAdmin)) {
        alert('Keine Berechtigung zum Speichern der Hierarchie!');
        return;
    }

    const allInputs = document.querySelectorAll('#hierarchieInlineEditorContainer input');
    allInputs.forEach(inp => {
        const key = inp.id.replace('inline_h_', '');
        const val = inp.value.trim();
        if (key.endsWith('_sub')) {
            hierarchieDaten[key] = val;
        } else {
            hierarchieDaten[key] = val || 'Aktuell nicht belegt';
        }
    });

    db.ref('data/hierarchie').set(hierarchieDaten).then(() => {
        logAdminAudit('Hierarchie vor Ort aktualisiert', `${sessionUser.vorname} ${sessionUser.nachname} hat das Hierarchie-Board gespeichert.`);
        closeHierarchieInlineModal();
        alert('✅ Hierarchie erfolgreich aktualisiert!');
    });
}

/* ── REITER: GEHALTSTABELLE ────────────────────────────────── */
function renderGehaltTab(data) {
    const tbody = document.getElementById('gehaltTableBody');
    if (!tbody) return;

    const list = Array.isArray(data) ? data : Object.values(data || {});
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:18px;">Keine Gehaltseinträge vorhanden.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(item => `
        <tr style="background-color: ${item.styleVar || 'rgba(255,255,255,0.02)'};">
            <td style="font-weight:bold;">${escapeHtml(item.rang || '')}</td>
            <td style="font-weight:bold;">${escapeHtml(item.name || '')}</td>
            <td>${escapeHtml(item.command || '')}</td>
            <td>${escapeHtml(item.q15 || '0')}</td>
            <td>${escapeHtml(item.h1 || '0')}</td>
        </tr>
    `).join('');
}

function openGehaltInlineModal() {
    const cont = document.getElementById('gehaltInlineContainer');
    if (!cont) return;

    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isAdmin && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zur Bearbeitung der Gehaltstabelle!');
        return;
    }

    cont.innerHTML = cachedGehaltData.map((item, idx) => `
        <div style="background:rgba(30,41,59,0.5);border:1px solid var(--border);border-radius:10px;padding:10px;display:grid;grid-template-columns:1fr 2fr 1.5fr 1fr 1fr auto;gap:8px;align-items:center;">
            <input type="text" id="gehalt_rang_${idx}" aria-label="Rang Kennzeichnung Zeile ${idx+1}" value="${escapeHtml(item.rang||'')}" placeholder="Rang">
            <input type="text" id="gehalt_name_${idx}" aria-label="Rang Name Zeile ${idx+1}" value="${escapeHtml(item.name||'')}" placeholder="Rang-Name">
            <input type="text" id="gehalt_cmd_${idx}" aria-label="Command Ebene Zeile ${idx+1}" value="${escapeHtml(item.command||'')}" placeholder="Command">
            <input type="text" id="gehalt_q15_${idx}" aria-label="Sold 15 Minuten Zeile ${idx+1}" value="${escapeHtml(item.q15||'')}" placeholder="15 Min.">
            <input type="text" id="gehalt_h1_${idx}" aria-label="Sold volle Stunde Zeile ${idx+1}" value="${escapeHtml(item.h1||'')}" placeholder="Stunde">
            <button type="button" class="btn-delete-row" aria-label="Gehaltsrang ${escapeHtml(item.rang||'')} löschen" onclick="removeGehaltRowInline(${idx})" title="Rang entfernen">🗑️</button>
        </div>
    `).join('');

    document.getElementById('gehaltInlineModal').style.display = 'flex';
}

function closeGehaltInlineModal() {
    document.getElementById('gehaltInlineModal').style.display = 'none';
}

function addGehaltRowInline() {
    if (!requireAdminAccess('Keine Berechtigung zur Bearbeitung der Gehaltstabelle!')) return;
    cachedGehaltData.push({
        id: 'g_' + Date.now(),
        rang: `Rang ${cachedGehaltData.length + 1}`,
        name: 'Neuer Rang',
        command: 'Ebene',
        q15: '0',
        h1: '0',
        styleVar: 'var(--rank-mid)'
    });
    openGehaltInlineModal();
}

function removeGehaltRowInline(idx) {
    if (!requireAdminAccess('Keine Berechtigung zur Bearbeitung der Gehaltstabelle!')) return;
    if (confirm('Diesen Gehaltsrang wirklich entfernen?')) {
        cachedGehaltData.splice(idx, 1);
        openGehaltInlineModal();
    }
}

function saveGehaltInline() {
    if (!requireAdminAccess('Keine Berechtigung zum Speichern der Gehaltstabelle!')) return;
    const updated = [];
    cachedGehaltData.forEach((item, idx) => {
        const rangEl = document.getElementById(`gehalt_rang_${idx}`);
        const nameEl = document.getElementById(`gehalt_name_${idx}`);
        const cmdEl  = document.getElementById(`gehalt_cmd_${idx}`);
        const q15El  = document.getElementById(`gehalt_q15_${idx}`);
        const h1El   = document.getElementById(`gehalt_h1_${idx}`);

        if (rangEl && nameEl) {
            updated.push({
                id: item.id || ('g_' + idx),
                rang: rangEl.value.trim() || item.rang,
                name: nameEl.value.trim() || item.name,
                command: cmdEl ? cmdEl.value.trim() : item.command,
                q15: q15El ? q15El.value.trim() : item.q15,
                h1: h1El ? h1El.value.trim() : item.h1,
                styleVar: item.styleVar || 'var(--rank-mid)'
            });
        }
    });

    db.ref('data/gehaltstabelle').set(updated).then(() => {
        cachedGehaltData = updated;
        renderGehaltTab(cachedGehaltData);
        closeGehaltInlineModal();
        logAdminAudit('Gehaltstabelle angepasst', `${sessionUser.vorname} ${sessionUser.nachname} hat die Gehaltstabelle aktualisiert.`);
        alert('✅ Gehaltstabelle erfolgreich gespeichert!');
    });
}

/* ── REITER 3: FUNK & CODES (INLINE EDIT) ───────────────────── */
function renderGuideTab() {
    _renderGuideSection('guideTenCodesBody',    cachedGuideData.tenCodes);
    _renderGuideSection('guideStatusCodesBody', cachedGuideData.statusCodes);
    _renderGuideSection('guideStreifenBody',     cachedGuideData.streifen);
    _renderGuideKeineRechnung();
}
function _renderGuideSection(id, data) {
    const t = document.getElementById(id); if (!t) return;
    t.innerHTML = !data || !data.length ? '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:14px;">-</td></tr>'
        : data.map(i => `<tr><td class="text-center" style="color:${i.color||'var(--text-main)'};font-weight:800;">${escapeHtml(i.code||'')}</td><td>${escapeHtml(i.desc||'')}</td></tr>`).join('');
}
function _renderGuideKeineRechnung() {
    const t = document.getElementById('guideKeineRechnungBody'); if (!t) return;
    const data = cachedGuideData.keineRechnung || [];
    t.innerHTML = !data || !data.length ? '<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:14px;">Keine Einträge</td></tr>'
        : data.map(i => `<tr><td colspan="2"><b>${escapeHtml(i.name||'')}</b>${i.note?` <span style="color:var(--text-muted);font-size:12px;">${escapeHtml(i.note)}</span>`:''}<br><span style="color:var(--text-muted);font-size:13px;">${escapeHtml(i.desc||'')}</span></td></tr>`).join('');
}

function openGuideInlineModal() {
    if (!requirePermission(['canEditGuide','isMasterAdmin'], 'Keine Berechtigung zur Bearbeitung von Funk & Codes!')) return;
    const cont = document.getElementById('guideInlineEditorContainer');
    if (!cont) return;
    
    cont.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:18px;">
            <div style="background:rgba(15,23,42,0.6);padding:16px;border-radius:12px;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h4 style="margin:0;color:var(--primary);">📻 Ten Codes</h4>
                    <button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;" onclick="addGuideRow('tenCodes')">➕ Zeile hinzufügen</button>
                </div>
                <div id="inlineGuide_tenCodes"></div>
            </div>

            <div style="background:rgba(15,23,42,0.6);padding:16px;border-radius:12px;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h4 style="margin:0;color:var(--warning);">📟 Status Codes</h4>
                    <button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;" onclick="addGuideRow('statusCodes')">➕ Zeile hinzufügen</button>
                </div>
                <div id="inlineGuide_statusCodes"></div>
            </div>

            <div style="background:rgba(15,23,42,0.6);padding:16px;border-radius:12px;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h4 style="margin:0;color:var(--primary);">🚑 Streifen-Anordnung</h4>
                    <button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;" onclick="addGuideRow('streifen')">➕ Zeile hinzufügen</button>
                </div>
                <div id="inlineGuide_streifen"></div>
            </div>

            <div style="background:rgba(15,23,42,0.6);padding:16px;border-radius:12px;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h4 style="margin:0;color:var(--success);">🚫 Keine Rechnung (Ausnahmen)</h4>
                    <button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;" onclick="addKeineRechnungRow()">➕ Ausnahme hinzufügen</button>
                </div>
                <div id="inlineGuide_keineRechnung"></div>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px;">
                <button type="button" class="btn" style="width:auto;background:var(--text-muted);" onclick="closeGuideInlineModal()">Schließen</button>
                <button type="button" class="btn" style="width:auto;background:var(--success);color:#080c14;font-weight:800;" onclick="saveGuideInline()">💾 Speichern</button>
            </div>
        </div>
    `;
    renderGuideInlineRows('tenCodes');
    renderGuideInlineRows('statusCodes');
    renderGuideInlineRows('streifen');
    renderKeineRechnungInlineRows();
    document.getElementById('guideInlineModal').style.display = 'flex';
}
function closeGuideInlineModal() { document.getElementById('guideInlineModal').style.display = 'none'; }

function renderGuideInlineRows(section) {
    const c = document.getElementById('inlineGuide_' + section); if (!c) return;
    const list = cachedGuideData[section] || [];
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    c.innerHTML = list.map((item, idx) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
            <input type="text" id="${section}_code_${idx}" aria-label="${section} Code Zeile ${idx+1}" value="${escapeHtml(item.code||'')}" style="width:110px;" placeholder="Code">
            <input type="text" id="${section}_desc_${idx}" aria-label="${section} Beschreibung Zeile ${idx+1}" value="${escapeHtml(item.desc||'')}" style="flex:1;" placeholder="Beschreibung">
            ${eff.delGuide ? `<button type="button" class="btn-delete-row" aria-label="${section} Eintrag ${idx+1} löschen" onclick="removeGuideRow('${section}', ${idx})">🗑️</button>` : ''}
        </div>
    `).join('');
}

function renderKeineRechnungInlineRows() {
    const c = document.getElementById('inlineGuide_keineRechnung'); if (!c) return;
    const list = cachedGuideData.keineRechnung || [];
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    c.innerHTML = list.map((item, idx) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
            <input type="text" id="kr_name_${idx}" value="${escapeHtml(item.name||'')}" style="width:180px;" placeholder="Fraktion / Name">
            <input type="text" id="kr_note_${idx}" value="${escapeHtml(item.note||'')}" style="width:180px;" placeholder="Zusatz (z.B. SAPD...)">
            <input type="text" id="kr_desc_${idx}" value="${escapeHtml(item.desc||'')}" style="flex:1;" placeholder="Bedingung">
            ${eff.delGuide ? `<button type="button" class="btn-delete-row" onclick="removeKeineRechnungRow(${idx})">🗑️</button>` : ''}
        </div>
    `).join('');
}

function addGuideRow(section) {
    if (!requirePermission(['canEditGuide','isMasterAdmin'], 'Keine Berechtigung zur Bearbeitung von Funk & Codes!')) return;
    if (!cachedGuideData[section]) cachedGuideData[section] = [];
    cachedGuideData[section].push({ id: 'g_' + Date.now(), code: '', desc: '', color: 'var(--text-main)' });
    renderGuideInlineRows(section);
}
function removeGuideRow(section, idx) {
    if (!requirePermission(['delGuide','isMasterAdmin'], 'Keine Berechtigung zum Löschen von Funk-Codes!')) return;
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delGuide) return;
    cachedGuideData[section].splice(idx, 1);
    renderGuideInlineRows(section);
}

function addKeineRechnungRow() {
    if (!requirePermission(['canEditGuide','isMasterAdmin'], 'Keine Berechtigung zur Bearbeitung von Ausnahmen!')) return;
    if (!cachedGuideData.keineRechnung) cachedGuideData.keineRechnung = [];
    cachedGuideData.keineRechnung.push({ id: 'kr_' + Date.now(), name: '', note: '', desc: 'Im Dienst wird keine Rechnung ausgestellt' });
    renderKeineRechnungInlineRows();
}
function removeKeineRechnungRow(idx) {
    if (!requirePermission(['delGuide','isMasterAdmin'], 'Keine Berechtigung zum Löschen von Ausnahmen!')) return;
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delGuide) return;
    cachedGuideData.keineRechnung.splice(idx, 1);
    renderKeineRechnungInlineRows();
}

function saveGuideInline() {
    if (!requirePermission(['canEditGuide','isMasterAdmin'], 'Keine Berechtigung zum Speichern von Funk & Codes!')) return;
    ['tenCodes', 'statusCodes', 'streifen'].forEach(sec => {
        (cachedGuideData[sec] || []).forEach((item, idx) => {
            const cInp = document.getElementById(`${sec}_code_${idx}`);
            const dInp = document.getElementById(`${sec}_desc_${idx}`);
            if (cInp) item.code = cInp.value.trim();
            if (dInp) item.desc = dInp.value.trim();
        });
    });

    (cachedGuideData.keineRechnung || []).forEach((item, idx) => {
        const nInp = document.getElementById(`kr_name_${idx}`);
        const noInp = document.getElementById(`kr_note_${idx}`);
        const dInp = document.getElementById(`kr_desc_${idx}`);
        if (nInp) item.name = nInp.value.trim();
        if (noInp) item.note = noInp.value.trim();
        if (dInp) item.desc = dInp.value.trim();
    });

    db.ref('data/guide').set(cachedGuideData).then(() => {
        renderGuideTab();
        closeGuideInlineModal();
        logAdminAudit('Funk & Codes aktualisiert', `${sessionUser.vorname} ${sessionUser.nachname} hat Codes vor Ort geändert.`);
        alert('✅ Funk & Codes gespeichert!');
    });
}

/* ── REITER: COMMANDS (ALPHABETISCH SORTIERT & LINKBAR) ────── */
function renderCommandsTab(obj) {
    const cont = document.getElementById('commandsAccordionContainer'); if (!cont) return;
    const all = Object.assign({}, defaultCommands, obj || {});
    
    const validEntries = Object.entries(all).filter(([, c]) => !c.deleted);
    let kats = [...new Set(validEntries.map(([, c]) => c.kat || 'Allgemein'))].sort((a,b) => a.localeCompare(b, 'de'));
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};

    if (!eff.isAdmin && !eff.isMasterAdmin && eff.allowedCmdKats && eff.allowedCmdKats.length > 0) {
        kats = kats.filter(k => eff.allowedCmdKats.includes(k));
    }

    if (!kats.length) { cont.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px;">Keine Commands für deinen Dienstgrad freigegeben.</p>'; return; }

    cont.innerHTML = kats.map(kat => {
        const cmds = validEntries.filter(([,c]) => (c.kat || 'Allgemein') === kat)
                                  .sort((a,b) => (a[1].name||'').localeCompare(b[1].name||'', 'de'));
        const rows = cmds.map(([k,c]) => `<tr>
            <td style="width:30%;padding:12px 14px;"><span class="cmd-badge">${escapeHtml(c.name||'')}</span></td>
            <td style="width:60%;padding:12px 14px;color:var(--text-main);font-size:14px;">${formatTextWithLinks(c.desc||c.description||'')}</td>
            <td style="width:10%;padding:12px 14px;text-align:right;">${eff.delCommands ? `<button type="button" class="btn-delete-row" onclick="deleteDienstCommand('${k}')">🗑️</button>` : ''}</td>
        </tr>`).join('');
        const gId = 'cmd_' + kat.replace(/\W/g, '_');
        return `<div class="theme-accordion-group" id="${gId}" style="margin-bottom:12px;">
            <div class="theme-accordion-header" onclick="toggleGroupCollapse('${gId}')">
                <span>⚡ ${escapeHtml(kat)}</span>
            </div>
            <div class="theme-accordion-content"><table style="width:100%;"><tbody>${rows||'<tr><td colspan="3">Keine Commands</td></tr>'}</tbody></table></div>
        </div>`;
    }).join('');
}

function openCommandsInlineModal() {
    if (!requirePermission(['canEditCommands','isMasterAdmin'], 'Keine Berechtigung zur Bearbeitung der Commands!')) return;
    const cont = document.getElementById('commandsInlineEditorContainer');
    if (!cont) return;

    db.ref('data/dienstCommands').once('value', snap => {
        const cloudData = snap.val() || {};
        const allCmds = Object.assign({}, defaultCommands, cloudData);
        const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};

        const entries = Object.entries(allCmds).filter(([, c]) => !c.deleted)
            .sort((a,b) => {
                const katDiff = (a[1].kat || 'Allgemein').localeCompare(b[1].kat || 'Allgemein', 'de');
                if (katDiff !== 0) return katDiff;
                return (a[1].name || '').localeCompare(b[1].name || '', 'de');
            });

        let existingRowsHtml = entries.map(([k, c]) => `
            <div style="background:rgba(30,41,59,0.4);border:1px solid var(--border);border-radius:10px;padding:10px;display:grid;grid-template-columns:1.5fr 2.5fr 1.5fr auto;gap:8px;align-items:center;margin-bottom:8px;">
                <input type="text" id="cmd_name_${k}" aria-label="Command Name" value="${escapeHtml(c.name || '')}" placeholder="Name">
                <input type="text" id="cmd_desc_${k}" aria-label="Command Beschreibung" value="${escapeHtml(c.desc || c.description || '')}" placeholder="Beschreibung (inkl. https:// Links)">
                <input type="text" id="cmd_kat_${k}" aria-label="Command Kategorie" value="${escapeHtml(c.kat || 'Allgemein')}" placeholder="Kategorie">
                <div style="display:flex;gap:6px;">
                    <button type="button" class="btn" style="width:auto;margin:0;padding:6px 12px;font-size:12px;background:var(--primary);color:#080c14;font-weight:800;" onclick="editCommandInline('${k}')">💾</button>
                    ${eff.delCommands ? `<button type="button" class="btn-delete-row" onclick="deleteDienstCommand('${k}')">🗑️</button>` : ''}
                </div>
            </div>
        `).join('');

        cont.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:18px;">
                <div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:10px;border:1px solid var(--border);">
                    <h4 style="margin:0 0 10px 0;color:var(--success);">➕ Neuen Command anlegen</h4>
                    <div style="display:grid;grid-template-columns:1.5fr 2.5fr 1.5fr auto;gap:8px;">
                        <input type="text" id="inlineNewCmdName" placeholder="Name (z.B. !funk)">
                        <input type="text" id="inlineNewCmdDesc" placeholder="Beschreibung (inkl. Webadresse)">
                        <input type="text" id="inlineNewCmdKat" placeholder="Kategorie">
                        <button type="button" class="btn" style="width:auto;margin:0;padding:8px 16px;" onclick="addCommandInline()">Hinzufügen</button>
                    </div>
                </div>

                <div>
                    <h4 style="margin:0 0 10px 0;color:var(--primary);">📋 Bestehende Commands bearbeiten (Alphabetisch A-Z)</h4>
                    <div style="max-height:55vh;overflow-y:auto;padding-right:4px;">
                        ${existingRowsHtml || '<p style="color:var(--text-muted);">Keine Einträge vorhanden.</p>'}
                    </div>
                </div>

                <div style="display:flex;justify-content:flex-end;">
                    <button type="button" class="btn" style="width:auto;background:var(--text-muted);" onclick="closeCommandsInlineModal()">Schließen</button>
                </div>
            </div>
        `;
        document.getElementById('commandsInlineModal').style.display = 'flex';
    });
}
function closeCommandsInlineModal() { document.getElementById('commandsInlineModal').style.display = 'none'; }

function addCommandInline() {
    if (!requirePermission(['canEditCommands','isMasterAdmin'], 'Keine Berechtigung zum Anlegen von Commands!')) return;
    const name = document.getElementById('inlineNewCmdName')?.value.trim();
    const desc = document.getElementById('inlineNewCmdDesc')?.value.trim();
    const kat = document.getElementById('inlineNewCmdKat')?.value.trim() || 'Allgemein';
    if (!name || !desc) { alert('Bitte Name und Beschreibung angeben!'); return; }
    db.ref('data/dienstCommands').push({ name, desc, kat }).then(() => {
        alert('✅ Command angelegt!');
        closeCommandsInlineModal();
        refreshOpenRoleCategoryCheckboxes();
    });
}

function editCommandInline(k) {
    if (!requirePermission(['canEditCommands','isMasterAdmin'], 'Keine Berechtigung zum Bearbeiten von Commands!')) return;
    const name = document.getElementById('cmd_name_' + k)?.value.trim();
    const desc = document.getElementById('cmd_desc_' + k)?.value.trim();
    const kat = document.getElementById('cmd_kat_' + k)?.value.trim() || 'Allgemein';

    if (!name || !desc) { alert('Name und Beschreibung dürfen nicht leer sein!'); return; }

    db.ref('data/dienstCommands/' + k).set({ name, desc, kat }).then(() => {
        logAdminAudit('Command bearbeitet', `${sessionUser.vorname} ${sessionUser.nachname} hat Command "${name}" geändert.`);
        alert('✅ Command erfolgreich gespeichert!');
    });
}

function deleteDienstCommand(k) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delCommands) return;
    if (confirm('Command löschen?')) {
        db.ref('data/dienstCommands/' + k).set({ deleted: true }).then(() => {
            logAdminAudit('Command gelöscht', `Command ${k} gelöscht durch ${sessionUser.vorname} ${sessionUser.nachname}`);
        });
    }
}

/* ── REITER 4: LINKS & DOKUMENTE (AUTOMATISCHES HTTPS) ──────── */
function renderLinksTab(obj) {
    const cont = document.getElementById('linksAccordionContainer'); if (!cont) return;
    
    let rawLinks = Object.assign({}, defaultLinks, obj || {});
    let cleanedLinks = {};
    
    Object.entries(rawLinks).forEach(([k, l]) => {
        if (!l || l.deleted) return;
        if (l.url) {
            let u = String(l.url).trim();
            if (u === 'https://docs.google.com' || u === 'https://docs.google.com/' || u === 'http://docs.google.com') {
                return;
            }
        }
        cleanedLinks[k] = l;
    });

    let kats = [...new Set(Object.values(cleanedLinks).map(l => l.kat || l.thema || 'Allgemein'))].sort((a,b) => a.localeCompare(b, 'de'));
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};

    if (!eff.isAdmin && !eff.isMasterAdmin && eff.allowedLinkKats && eff.allowedLinkKats.length > 0) {
        kats = kats.filter(k => eff.allowedLinkKats.includes(k));
    }

    if (!kats.length) { 
        cont.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px;">Keine Links für deinen Dienstgrad freigegeben.</p>'; 
        return; 
    }

    cont.innerHTML = kats.map(kat => {
        const lnks = Object.entries(cleanedLinks).filter(([, l]) => (l.kat || l.thema || 'Allgemein') === kat)
                                                .sort((a,b) => (a[1].name||'').localeCompare(b[1].name||'', 'de'));
        if (!lnks.length) return '';

        const rows = lnks.map(([k, l]) => `<tr>
            <td style="width:35%;padding:12px 14px;word-break:break-word;"><a class="link-btn-clickable" href="${sanitizeUrl(l.url)}" target="_blank" rel="noopener noreferrer">🔗 ${escapeHtml(l.name||l.url)}</a></td>
            <td style="width:55%;padding:12px 14px;color:var(--text-main);font-size:14px;line-height:1.5;">${formatTextWithLinks(l.desc||l.description||'Keine Beschreibung')}</td>
            <td style="width:10%;padding:12px 14px;text-align:right;">${eff.delLinks ? `<button type="button" class="btn-delete-row" onclick="deleteDienstLink('${k}')">🗑️</button>` : ''}</td>
        </tr>`).join('');
        
        const gId = 'lnk_' + kat.replace(/\W/g, '_');
        return `<div class="theme-accordion-group" id="${gId}" style="margin-bottom:12px;">
            <div class="theme-accordion-header" onclick="toggleGroupCollapse('${gId}')">
                <span>📁 ${escapeHtml(kat)}</span>
            </div>
            <div class="theme-accordion-content"><table style="width:100%;"><tbody>${rows}</tbody></table></div>
        </div>`;
    }).join('');
}

function openLinksInlineModal() {
    if (!requirePermission(['canEditLinks','isMasterAdmin'], 'Keine Berechtigung zur Bearbeitung der Links!')) return;
    const cont = document.getElementById('linksInlineEditorContainer');
    if (!cont) return;

    db.ref('data/dienstLinks').once('value', snap => {
        const cloudData = snap.val() || {};
        const allLinks = Object.assign({}, defaultLinks, cloudData);
        const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};

        const entries = Object.entries(allLinks).filter(([, l]) => !l.deleted)
            .sort((a,b) => {
                const katDiff = (a[1].kat || a[1].thema || 'Allgemein').localeCompare(b[1].kat || b[1].thema || 'Allgemein', 'de');
                if (katDiff !== 0) return katDiff;
                return (a[1].name || '').localeCompare(b[1].name || '', 'de');
            });

        let existingRowsHtml = entries.map(([k, l]) => `
            <div style="background:rgba(30,41,59,0.4);border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;margin-bottom:10px;" id="link_row_${k}">
                <div style="grid-template-columns:1fr 1fr;gap:8px;display:grid;">
                    <input type="text" id="link_name_${k}" aria-label="Link Titel" value="${escapeHtml(l.name || '')}" placeholder="Titel">
                    <input type="text" id="link_url_${k}" aria-label="Link Webadresse" value="${escapeHtml(l.url || '')}" placeholder="https://docs.google.com/...">
                </div>
                <div style="grid-template-columns:2fr 1fr auto;gap:8px;align-items:center;display:grid;">
                    <input type="text" id="link_desc_${k}" aria-label="Link Beschreibung" value="${escapeHtml(l.desc || l.description || '')}" placeholder="Beschreibung">
                    <input type="text" id="link_kat_${k}" aria-label="Link Kategorie" value="${escapeHtml(l.kat || l.thema || 'Allgemein')}" placeholder="Kategorie">
                    <div style="display:flex;gap:6px;">
                        <button type="button" class="btn" style="width:auto;margin:0;padding:6px 12px;font-size:12px;background:var(--primary);color:#080c14;font-weight:800;" onclick="editLinkInline('${k}')">💾</button>
                        ${eff.delLinks ? `<button type="button" class="btn-delete-row" onclick="deleteDienstLink('${k}')">🗑️</button>` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        cont.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:18px;">
                <div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:10px;border:1px solid var(--border);">
                    <h4 style="margin:0 0 10px 0;color:var(--primary);">➕ Neuen Dokumenten-Link anlegen</h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                        <input type="text" id="inlineNewLinkName" placeholder="Titel des Links">
                        <input type="text" id="inlineNewLinkUrl" placeholder="https://docs.google.com/...">
                    </div>
                    <div style="display:grid;grid-template-columns:2fr 1fr auto;gap:8px;">
                        <input type="text" id="inlineNewLinkDesc" placeholder="Beschreibung">
                        <input type="text" id="inlineNewLinkKat" placeholder="Kategorie (z.B. MD Intern)">
                        <button type="button" class="btn" style="width:auto;margin:0;padding:8px 16px;" onclick="addLinkInline()">Hinzufügen</button>
                    </div>
                </div>

                <div>
                    <h4 style="margin:0 0 10px 0;color:var(--primary);">📁 Bestehende Links bearbeiten (Alphabetisch A-Z)</h4>
                    <div style="max-height:55vh;overflow-y:auto;padding-right:4px;">
                        ${existingRowsHtml || '<p style="color:var(--text-muted);">Keine Links vorhanden.</p>'}
                    </div>
                </div>

                <div style="display:flex;justify-content:flex-end;">
                    <button type="button" class="btn" style="width:auto;background:var(--text-muted);" onclick="closeLinksInlineModal()">Schließen</button>
                </div>
            </div>
        `;
        document.getElementById('linksInlineModal').style.display = 'flex';
    });
}
function closeLinksInlineModal() { document.getElementById('linksInlineModal').style.display = 'none'; }

function addLinkInline() {
    if (!requirePermission(['canEditLinks','isMasterAdmin'], 'Keine Berechtigung zum Anlegen von Links!')) return;
    const name = document.getElementById('inlineNewLinkName')?.value.trim();
    let url = document.getElementById('inlineNewLinkUrl')?.value.trim();
    const desc = document.getElementById('inlineNewLinkDesc')?.value.trim();
    const kat = document.getElementById('inlineNewLinkKat')?.value.trim() || 'Allgemein';
    if (!name || !url) { alert('Bitte Name und URL angeben!'); return; }
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

    db.ref('data/dienstLinks').push({ name, url, desc, kat }).then(() => {
        alert('✅ Link gespeichert!');
        closeLinksInlineModal();
        refreshOpenRoleCategoryCheckboxes();
    });
}

function editLinkInline(k) {
    if (!requirePermission(['canEditLinks','isMasterAdmin'], 'Keine Berechtigung zum Bearbeiten von Links!')) return;
    const name = document.getElementById('link_name_' + k)?.value.trim();
    let url = document.getElementById('link_url_' + k)?.value.trim();
    const desc = document.getElementById('link_desc_' + k)?.value.trim();
    const kat = document.getElementById('link_kat_' + k)?.value.trim() || 'Allgemein';

    if (!name || !url) { alert('Name und URL dürfen nicht leer sein!'); return; }
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

    db.ref('data/dienstLinks/' + k).set({ name, url, desc, kat }).then(() => {
        logAdminAudit('Link bearbeitet', `${sessionUser.vorname} ${sessionUser.nachname} hat Link "${name}" geändert.`);
        alert('✅ Link erfolgreich gespeichert!');
    });
}

function deleteDienstLink(k) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delLinks) return;
    if (confirm('Link wirklich löschen?')) {
        db.ref('data/dienstLinks/' + k).set({ deleted: true }).then(() => {
            const rowEl = document.getElementById('link_row_' + k);
            if (rowEl) rowEl.remove();
            alert('✅ Link erfolgreich gelöscht!');
        }).catch(err => {
            alert('Fehler beim Löschen des Links: ' + err.message);
        });
    }
}

/* ── CHANGELOG SYSTEM ──────────────────────────────────────── */
function openChangelogModal() {
    const modal = document.getElementById('changelogModal');
    if (!modal) return;
    renderChangelogModal();
    modal.style.display = 'flex';
}

function closeChangelogModal() {
    const modal = document.getElementById('changelogModal');
    if (modal) modal.style.display = 'none';
}

function openChangelogWriterModal() {
    if (!requireMasterAdminAccess('Nur Master-Admins dürfen den Changelog bearbeiten!')) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isMasterAdmin) {
        alert('Nur Master-Admins können neue Changelogs direkt eintragen!');
        return;
    }
    document.getElementById('clNewVersion').value = '';
    document.getElementById('clNewTitle').value = '';
    document.getElementById('clNewChanges').value = '';
    document.getElementById('changelogWriterModal').style.display = 'flex';
}

function closeChangelogWriterModal() {
    document.getElementById('changelogWriterModal').style.display = 'none';
}

function saveCustomChangelogEntry() {
    if (!requireMasterAdminAccess('Nur Master-Admins dürfen Changelog-Einträge speichern!')) return;
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).isMasterAdmin) return;
    const version = document.getElementById('clNewVersion')?.value.trim();
    const category = document.getElementById('clNewCategory')?.value || 'Update';
    const title = document.getElementById('clNewTitle')?.value.trim();
    const rawChanges = document.getElementById('clNewChanges')?.value.trim();

    if (!version || !title || !rawChanges) {
        alert('Bitte alle Felder ausfüllen!');
        return;
    }

    const changes = rawChanges.split('\n').map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(l => l.length > 0);
    const dateFormatted = new Date().toLocaleDateString('de-DE');

    const entryId = 'cl_' + Date.now();
    db.ref('data/changelogs/' + entryId).set({
        version,
        date: dateFormatted,
        category,
        title,
        changes,
        author: `${sessionUser.vorname} ${sessionUser.nachname}`,
        ts: Date.now()
    }).then(() => {
        closeChangelogWriterModal();
        logAdminAudit('Changelog-Eintrag erstellt', `${sessionUser.vorname} ${sessionUser.nachname} hat Version ${version} veröffentlicht.`);
        alert('✅ Neuer Changelog-Eintrag erfolgreich veröffentlicht!');
    });
}

function renderChangelogModal() {
    const cont = document.getElementById('changelogContainer');
    if (!cont) return;

    const catBadgeClassMap = {
        'Update': 'changelog-badge-update',
        'Neue Funktion': 'changelog-badge-feature',
        'Änderung': 'changelog-badge-change',
        'Bugfix': 'changelog-badge-bugfix',
        'Design': 'changelog-badge-design',
        'Technische Änderung': 'changelog-badge-tech'
    };

    const customList = Object.entries(cachedCustomChangelogs || {}).map(([id, item]) => Object.assign({ id, isCustom: true }, item));
    const allEntries = [...customList, ...systemChangelogs].sort((a, b) => (b.ts || 0) - (a.ts || 0));

    cont.innerHTML = allEntries.map(entry => {
        const bClass = catBadgeClassMap[entry.category] || 'changelog-badge-update';
        const itemsHtml = (entry.changes || []).map(ch => `<li>${escapeHtml(ch)}</li>`).join('');

        return `
            <div class="changelog-card">
                <div class="changelog-header">
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                        <span class="changelog-version-tag">${escapeHtml(entry.version)}</span>
                        <span class="changelog-badge ${bClass}">${escapeHtml(entry.category)}</span>
                        <b style="color:var(--text-main);font-size:15px;">${escapeHtml(entry.title)}</b>
                    </div>
                    <span class="changelog-date">📅 ${escapeHtml(entry.date)}</span>
                </div>
                <ul class="changelog-items-list">
                    ${itemsHtml}
                </ul>
            </div>
        `;
    }).join('');
}

/* ── REITER: NEWS / SCHWARZES BRETT ────────────────────────── */
function renderNewsFeedData(obj) {
    const c = document.getElementById('newsFeedList'); if (!c) return;
    const pendingCont = document.getElementById('pendingNewsApprovalContainer');
    const unreadBadge = document.getElementById('newsUnreadBadge');

    const allNews = Object.entries(obj || {}).filter(([, n]) => !n.deleted);
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const myName = sessionUser ? `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim().toLowerCase() : '';
    const myId = sessionUser ? getUserAccountId(sessionUser) : '';
    const myKey = myId;
    const legacyReadKey = sessionUser?.dn ? ('dn_' + sessionUser.dn) : '';

    const approvedNews = allNews.filter(([, n]) => n.status !== 'pending_approval');
    let unreadCount = 0;
    approvedNews.forEach(([, n]) => {
        const readBy = n.readBy || {};
        if (!readBy[myKey] && !(legacyReadKey && readBy[legacyReadKey])) unreadCount++;
    });

    if (unreadBadge) {
        if (unreadCount > 0) {
            unreadBadge.textContent = unreadCount;
            unreadBadge.style.display = 'inline-flex';
        } else {
            unreadBadge.style.display = 'none';
        }
    }

    if (pendingCont) {
        if (eff.canApproveNews) {
            const pendingList = allNews.filter(([, n]) => n.status === 'pending_approval');
            if (pendingList.length > 0) {
                pendingCont.style.display = 'block';
                pendingCont.innerHTML = `
                    <div style="background:rgba(245,158,11,0.08);border:1px solid var(--warning);border-radius:14px;padding:16px;">
                        <h4 style="margin:0 0 10px 0;color:var(--warning);">⏳ Ausstehende News-Vorschläge von Mitarbeitern (${pendingList.length})</h4>
                        <div style="display:flex;flex-direction:column;gap:10px;">
                            ${pendingList.map(([k, n]) => `
                                <div style="background:rgba(15,23,42,0.8);padding:12px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
                                    <div>
                                        <b>${escapeHtml(n.title)}</b> <span style="font-size:12px;color:var(--text-muted);">von ${escapeHtml(n.author)}</span>
                                        <p style="margin:4px 0 0 0;font-size:13px;color:var(--text-main);">${escapeHtml(n.content)}</p>
                                    </div>
                                    <div style="display:flex;gap:6px;">
                                        <button type="button" class="btn" style="width:auto;margin:0;padding:6px 12px;font-size:12px;background:var(--success);color:#080c14;font-weight:800;" onclick="approveNewsProposal('${k}')">✅ Freigeben</button>
                                        <button type="button" class="btn-delete-row" onclick="deleteNews('${k}')">🗑️</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else {
                pendingCont.style.display = 'none';
            }
        } else {
            pendingCont.style.display = 'none';
        }
    }

    const published = approvedNews.sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
    if (!published.length) {
        c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px;">📭 Keine aktuellen Mitteilungen.</div>';
        return;
    }

    c.innerHTML = published.map(([k, n]) => {
        const readBy = n.readBy || {};
        const hasRead = myKey && (readBy[myKey] || (legacyReadKey && readBy[legacyReadKey]));
        const readCount = Object.keys(readBy).length;
        const authorNormalized = (n.author || '').trim().toLowerCase();
        const isAuthor = (n.authorId && n.authorId === myId) || (authorNormalized === myName && myName.length > 0);
        const canEditThisNews = isAuthor || eff.canPostNews || eff.isAdmin || eff.isMasterAdmin;

        return `
            <div class="news-feed-card" style="background:rgba(15,23,42,0.7);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px;">
                <div style="padding:16px 20px;background:rgba(30,41,59,0.6);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <div>
                        <span style="font-weight:800;font-size:17px;color:var(--primary);">${escapeHtml(n.title)}</span>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                            👤 <b>${escapeHtml(n.author||'Klinikleitung')}</b> • 🏷️ ${escapeHtml(n.category||'Allgemein')}
                            ${n.edited ? `<span style="color:var(--warning);margin-left:6px;">(Bearbeitet)</span>` : ''}
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        ${hasRead ? '<span style="color:var(--success);font-weight:800;font-size:12px;">✅ Gelesen</span>' : `<button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;" onclick="markNewsAsRead('${k}')">👁️ Als gelesen markieren</button>`}
                        ${canEditThisNews ? `<button type="button" class="btn-edit-row" onclick="openEditNewsModal('${k}')" title="Beitrag bearbeiten">✏️</button>` : ''}
                        ${eff.canViewNewsRead ? `<button type="button" class="btn" style="width:auto;margin:0;padding:5px 10px;font-size:12px;background:rgba(56,189,248,0.15);color:var(--primary);border:1px solid var(--primary);" onclick="openNewsReadersModal('${k}')">👥 Gelesen (${readCount})</button>` : ''}
                        ${(eff.delNews || isAuthor) ? `<button type="button" class="btn-delete-row" onclick="deleteNews('${k}')">🗑️</button>` : ''}
                    </div>
                </div>
                <div style="padding:20px;white-space:pre-wrap;font-size:14px;line-height:1.6;">${formatTextWithLinks(n.content)}</div>
            </div>
        `;
    }).join('');
}

function markNewsAsRead(newsId) {
    if (!sessionUser) return;
    const newsItem = cachedNews[newsId];
    if (!newsItem || (newsItem.status && newsItem.status !== 'published')) return;
    const myKey = getUserAccountId(sessionUser);
    if (!myKey) return;
    const legacyKey = sessionUser.dn ? ('dn_' + sessionUser.dn) : '';
    const updates = {};
    updates[`data/news/${newsId}/readBy/${myKey}`] = {
        name: sessionUser.vorname + ' ' + sessionUser.nachname,
        dn: sessionUser.dn || '--',
        ts: Date.now()
    };
    if (legacyKey && legacyKey !== myKey && newsItem.readBy?.[legacyKey]) {
        updates[`data/news/${newsId}/readBy/${legacyKey}`] = null;
    }
    db.ref().update(updates);
}

function openNewsReadersModal(newsId) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.canViewNewsRead && !eff.isAdmin && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zur Einsicht der Leseliste!');
        return;
    }
    const n = cachedNews[newsId]; if (!n) return;
    const cont = document.getElementById('newsReadersListContainer');
    const modal = document.getElementById('newsReadersModal');
    if (!cont || !modal) return;
    const list = Object.values(n.readBy || {});
    cont.innerHTML = !list.length ? '<p style="color:var(--text-muted);text-align:center;">Noch von niemandem gelesen.</p>'
        : `<ul style="list-style:none;padding:0;margin:0;">` +
          list.map(r => `<li style="padding:8px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;"><b>${escapeHtml(r.name)}</b> <span style="color:var(--primary);">${escapeHtml(r.dn)}</span></li>`).join('') +
          `</ul>`;
    modal.style.display = 'flex';
}
function closeNewsReadersModal() { document.getElementById('newsReadersModal').style.display = 'none'; }

function togglePostNewsForm() {
    if (!sessionUser) return;
    const e = document.getElementById('postNewsContainer');
    if (!e) return;
    const isHidden = (e.style.display === 'none' || !e.style.display);
    if (isHidden) {
        const eff = getUserEffectivePermissions(sessionUser);
        if (!eff.canPostNews && !eff.isAdmin && !eff.isMasterAdmin) {
            alert('Keine Berechtigung zum Veröffentlichen von News!');
            return;
        }
    }
    if (isHidden) {
        document.getElementById('editingNewsId').value = '';
        document.getElementById('newNewsTitle').value = '';
        document.getElementById('newNewsContent').value = '';
        document.getElementById('postNewsFormHeading').textContent = '📝 Neuen News-Thread verfassen';
        document.getElementById('btnSaveNewsSubmit').textContent = '📢 Veröffentlichen';
        e.style.display = 'block';
    } else {
        e.style.display = 'none';
    }
}

function toggleProposeNewsForm() {
    const e = document.getElementById('proposeNewsContainer');
    if (e) e.style.display = e.style.display === 'none' ? 'block' : 'none';
}

function openEditNewsModal(newsId) {
    if (!sessionUser) return;
    const n = cachedNews[newsId];
    if (!n) return;
    const eff = getUserEffectivePermissions(sessionUser);
    const myId = getUserAccountId(sessionUser);
    const myName = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim().toLowerCase();
    const isAuthor = (n.authorId && n.authorId === myId) || ((n.author || '').trim().toLowerCase() === myName && myName.length > 0);
    if (!isAuthor && !eff.canPostNews && !eff.isAdmin && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zum Bearbeiten dieses News-Beitrags!');
        return;
    }

    const e = document.getElementById('postNewsContainer');
    if (!e) return;

    document.getElementById('editingNewsId').value = newsId;
    document.getElementById('newNewsTitle').value = n.title || '';
    document.getElementById('newNewsContent').value = n.content || '';
    if (document.getElementById('newNewsCategory')) {
        document.getElementById('newNewsCategory').value = n.category || 'Allgemein';
    }

    document.getElementById('postNewsFormHeading').textContent = '✏️ News-Thread bearbeiten';
    document.getElementById('btnSaveNewsSubmit').textContent = '💾 Änderungen speichern';
    e.style.display = 'block';
    e.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function speichereNeueNews() {
    if (!sessionUser) return;
    const t = document.getElementById('newNewsTitle')?.value.trim();
    const c = document.getElementById('newNewsContent')?.value.trim();
    const cat = document.getElementById('newNewsCategory')?.value || 'Allgemein';
    const editId = document.getElementById('editingNewsId')?.value;
    const myId = getUserAccountId(sessionUser);

    if (!t || !c) { alert('Bitte Titel und Inhalt eingeben!'); return; }

    if (editId) {
        const existing = cachedNews[editId] || {};
        const eff = getUserEffectivePermissions(sessionUser);
        const isOwn = (existing.authorId && existing.authorId === myId) || ((existing.author || '').trim().toLowerCase() === `${sessionUser.vorname} ${sessionUser.nachname}`.trim().toLowerCase());
        if (!isOwn && !eff.canPostNews && !eff.isAdmin && !eff.isMasterAdmin) {
            alert('Keine Berechtigung zum Bearbeiten dieses News-Beitrags!');
            return;
        }
        const auditRoleDesc = isOwn ? 'Eigener Beitrag bearbeitet' : 'Leitungs-Bearbeitung';

        db.ref('data/news/' + editId).update({
            title: t,
            content: c,
            category: cat,
            edited: true,
            editedTs: Date.now(),
            lastEditedBy: `${sessionUser.vorname} ${sessionUser.nachname}`
        }).then(() => {
            togglePostNewsForm();
            logAdminAudit(`News angepasst (${auditRoleDesc})`, `${sessionUser.vorname} ${sessionUser.nachname}: ${t}`);
            alert('✅ News-Beitrag erfolgreich aktualisiert!');
        });
        return;
    }

    {
        const eff = getUserEffectivePermissions(sessionUser);
        if (!eff.canPostNews && !eff.isAdmin && !eff.isMasterAdmin) return;
    }

    db.ref('data/news').push({
        title: t, content: c, category: cat, status: 'published',
        author: sessionUser.vorname + ' ' + sessionUser.nachname,
        authorId: myId,
        ts: Date.now()
    }).then(() => {
        togglePostNewsForm();
        logAdminAudit('News veröffentlicht', `${sessionUser.vorname} ${sessionUser.nachname}: ${t}`);
    });
}

function submitNewsProposal() {
    if (!sessionUser) return;
    const t = document.getElementById('propNewsTitle')?.value.trim();
    const c = document.getElementById('propNewsContent')?.value.trim();
    const myId = getUserAccountId(sessionUser);

    if (!t || !c) { alert('Bitte Titel und Inhalt angeben!'); return; }
    db.ref('data/news').push({
        title: t, content: c, category: 'Vorschlag', status: 'pending_approval',
        author: sessionUser.vorname + ' ' + sessionUser.nachname,
        authorId: myId,
        ts: Date.now()
    }).then(() => {
        document.getElementById('propNewsTitle').value = '';
        document.getElementById('propNewsContent').value = '';
        toggleProposeNewsForm();
        alert('✅ Dein Vorschlag wurde eingereicht und wird von der Leitung geprüft!');
    });
}

function approveNewsProposal(newsId) {
    if (!sessionUser) return;
    const item = cachedNews[newsId];
    if (!item || item.status !== 'pending_approval') return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.canApproveNews && !eff.isAdmin && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zum Freigeben von News-Vorschlägen!');
        return;
    }
    db.ref('data/news/' + newsId).update({ status: 'published', ts: Date.now() }).then(() => {
        logAdminAudit('News-Vorschlag genehmigt', `ID ${newsId} freigegeben von ${sessionUser.vorname} ${sessionUser.nachname}`);
    });
}

function deleteNews(k) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    const n = cachedNews[k];
    const myId = getUserAccountId(sessionUser);
    const myName = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim().toLowerCase();
    const authorNormalized = (n?.author || '').trim().toLowerCase();
    const isAuthor = n && ((n.authorId && n.authorId === myId) || (authorNormalized === myName && myName.length > 0));

    if (!eff.delNews && !isAuthor) return;

    if (confirm('Möchtest du diesen News-Beitrag wirklich löschen?')) {
        db.ref('data/news/' + k).remove().then(() => {
            logAdminAudit('News gelöscht', `ID ${k} gelöscht durch ${sessionUser.vorname} ${sessionUser.nachname}`);
        });
    }
}

/* ── REITER 5: EINSTELLUNGEN / DIENSTTAGE ───────────────────── */
async function passwortAendern() {
    if (!sessionUser || !auth.currentUser) return;
    const inp = document.getElementById('newPasswordInput');
    const np = (inp?.value || '').trim();
    if (!np) {
        alert('Bitte ein neues Passwort eingeben!');
        return;
    }
    if (np.length < 6) {
        alert('Das Passwort muss mindestens 6 Zeichen lang sein!');
        return;
    }

    try {
        await auth.currentUser.updatePassword(np);
        if (inp) inp.value = '';
        logAdminAudit('Eigenes Passwort geändert', `${sessionUser.vorname} ${sessionUser.nachname} hat das Firebase-Login-Passwort aktualisiert.`);
        alert('✅ Passwort erfolgreich geändert!');
    } catch (err) {
        console.error('Passwortänderung fehlgeschlagen:', err);
        if (err?.code === 'auth/requires-recent-login') {
            alert('Aus Sicherheitsgründen ist eine erneute Anmeldung erforderlich. Bitte Dienst beenden, erneut anmelden und die Passwortänderung direkt danach wiederholen.');
            return;
        }
        alert('Fehler beim Ändern des Passworts: ' + (err?.message || err));
    }
}

function berechneDienstTage(shouldPersist = false) {
    if (!sessionUser) return;
    const f = document.getElementById('einstellungsDatum'); if (!f || !f.value) return;
    
    if (shouldPersist) {
        const uId = getUserAccountId(sessionUser);
        db.ref('data/users/' + uId + '/einstellungsDatum').set(f.value);
        localStorage.setItem('mmd_einstellungsdatum_' + uId, f.value);
    }

    const ed = new Date(f.value); ed.setHours(0,0,0,0);
    const h = new Date(); h.setHours(0,0,0,0);
    const t = Math.max(0, Math.floor((h - ed)/(1000*60*60*24)) + 1);
    const e = document.getElementById('val_dienstTage'); if (e) e.textContent = t;
}

async function handleDienstEndeLogout() {
    if (mySessionRef) {
        try { await mySessionRef.remove(); } catch (_) {}
        mySessionRef = null;
    }
    clearStoredSessionData();
    sessionUser = null;
    try { await auth.signOut(); } catch (_) {}
    location.reload();
}

/* ══════════════════════════════════════════════════════════════
   AUSBILDUNGSBEREICH (SORTIERUNG, FILTER & SCHUTZLOGIK)
══════════════════════════════════════════════════════════════ */
const STRICT_EXAM_ORDER = [
    'exam_ga1',
    'exam_1787879357076',
    'exam_1787901145793',
    'exam_1787911180569',
    'exam_1787914959704',
    'exam_1787916215019',
    'exam_1787916321372'
];

function sortExamIds(ids) {
    return ids.sort((a, b) => {
        let ia = STRICT_EXAM_ORDER.indexOf(a);
        let ib = STRICT_EXAM_ORDER.indexOf(b);
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        return ia - ib;
    });
}

function renderExamTab() {
    const iv = document.getElementById('examInstructorView');
    if (iv) {
        if (isUserInstructor()) {
            iv.style.display = 'block';
            renderInstructorUnlocks();
            renderInstructorSubmissions(cachedSubmissions);
            renderInstructorExistingExams();
            renderInstructorAllowedExams();
        } else {
            iv.style.display = 'none';
        }
    }
    renderStudentUnlockedExams();
}

function renderStudentUnlockedExams() {
    const c = document.getElementById('studentUnlockedExamsContainer'); if (!c) return;
    const validIds = sortExamIds(Object.keys(cachedExams));
    if (!validIds.length) {
        c.innerHTML = '<div style="color:var(--text-muted);padding:14px;text-align:center;">Keine Prüfungen vorhanden.</div>';
        return;
    }

    const uId = sessionUser ? getUserAccountId(sessionUser) : '';
    const user = cachedUsers[uId] || sessionUser || {};
    const unlocked = user.unlockedExams || {};
    const passed = user.passedExams || {};

    c.innerHTML = validIds.map(eid => {
        const ex = cachedExams[eid]; if (!ex) return '';
        const isPassed = !!passed[eid];
        const isU = !!unlocked[eid];

        let badge = '', btnHtml = '';
        if (isPassed) {
            badge = '<span style="color:var(--success);font-weight:800;font-size:12px;">✅ Bestanden</span>';
            btnHtml = '<div style="font-size:12px;color:var(--text-muted);margin-top:6px;">Erfolgreich abgeschlossen.</div>';
        } else if (isU) {
            badge = '<span style="color:var(--primary);font-weight:800;font-size:12px;">⚡ Freigeschaltet</span>';
            btnHtml = `<button type="button" class="btn" style="margin-top:8px;padding:6px 12px;font-size:13px;background:var(--primary);color:#080c14;font-weight:800;" onclick="startExam('${eid}')">📝 Prüfung starten</button>`;
        } else {
            badge = '<span style="color:var(--danger);font-weight:800;font-size:12px;">🔒 Gesperrt</span>';
            btnHtml = '<div style="font-size:12px;color:var(--danger);margin-top:6px;">Nicht freigeschaltet oder durchgefallen.</div>';
        }

        const questionCount = (ex.questions || []).filter(q => !q.isInfo).length;

        return `
            <div class="exam-card-compact ${isPassed ? 'completed' : (isU ? 'unlocked' : 'locked')}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:11px;color:var(--primary);text-transform:uppercase;font-weight:800;">${escapeHtml(ex.kat||'Allgemein')}</span>
                    ${badge}
                </div>
                <h4 style="margin:4px 0;font-size:14px;color:var(--text-main);">${escapeHtml(ex.title)}</h4>
                <div style="font-size:12px;color:var(--text-muted);">⏱️ ${ex.timeLimitMinutes||30} Min • ❓ ${questionCount} Fachfragen</div>
                ${btnHtml}
            </div>
        `;
    }).join('');
}

function renderInstructorUnlocks() {
    const tbody = document.getElementById('instructorUserUnlocksTableBody');
    if (!tbody) return;
    
    const sortedExamIds = sortExamIds(Object.keys(cachedExams)).filter(eId => canInstructorAccessExam(eId));

    const myId = sessionUser ? getUserAccountId(sessionUser) : '';
    const myPassed = (cachedUsers[myId]?.passedExams) || {};
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const isLeitung = eff.canManageInstructors || eff.isAdmin || eff.isMasterAdmin;

    const userList = Object.entries(cachedUsers).sort((a, b) => {
        const nameA = ((a[1].nachname || '') + ' ' + (a[1].vorname || '')).trim().toLowerCase();
        const nameB = ((b[1].nachname || '') + ' ' + (b[1].vorname || '')).trim().toLowerCase();
        return nameA.localeCompare(nameB, 'de');
    });

    let rowsHtml = '';

    userList.forEach(([uId, u]) => {
        const unlocked = u.unlockedExams || {};
        const passedMap = u.passedExams || {};

        const examGridHtml = `
            <div class="exam-unlock-grid">
                ${sortedExamIds.map(eId => {
                    const ex = cachedExams[eId]; if (!ex) return '';
                    const canUnlockThis = isLeitung || !!myPassed[eId];
                    const disabledAttr = canUnlockThis ? '' : 'disabled title="Nur freischaltbar, wenn selbst bestanden!"';

                    return `
                        <div class="exam-unlock-box ${unlocked[eId] ? 'active' : ''}">
                            <div style="font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(ex.title)}</div>
                            <div style="display:flex;gap:8px;align-items:center;margin-top:2px;">
                                <label style="font-size:11px;color:var(--primary);cursor:pointer;">
                                    <input type="checkbox" ${unlocked[eId]?'checked':''} ${disabledAttr} onchange="toggleExamUnlockForUser('${uId}','${eId}',this.checked)"> Freigabe
                                </label>
                                <label style="font-size:11px;color:var(--success);cursor:pointer;">
                                    <input type="checkbox" ${passedMap[eId]?'checked':''} ${disabledAttr} onchange="toggleExamPassedForUser('${uId}','${eId}',this.checked)"> Bestanden
                                </label>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        rowsHtml += `
            <tr class="user-unlock-row" data-name="${escapeHtml((u.vorname+' '+u.nachname+' '+u.dn).toLowerCase())}">
                <td style="width:200px;vertical-align:top;padding:10px;">
                    <b>${escapeHtml(u.vorname||'')} ${escapeHtml(u.nachname||'')}</b><br>
                    <span style="color:var(--primary);font-size:12px;">DN: ${escapeHtml(u.dn||'--')}</span>
                </td>
                <td style="width:100px;vertical-align:top;padding:10px;color:var(--text-muted);font-size:12px;">${escapeHtml(u.date||'--')}</td>
                <td style="vertical-align:top;padding:10px;">${sortedExamIds.length > 0 ? examGridHtml : '<span style="color:var(--text-muted);font-size:13px;">Keine Prüfungen autorisiert.</span>'}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
    filterUnlocksTable();
}

function filterUnlocksTable() {
    const q = (document.getElementById('searchUnlocksUser')?.value||'').toLowerCase();
    document.querySelectorAll('#instrTabUnlocks .user-unlock-row').forEach(row => {
        row.style.display = row.getAttribute('data-name').includes(q) ? '' : 'none';
    });
}

function toggleExamUnlockForUser(uId, examId, isUnlocked) {
    if (!sessionUser || !isUserInstructor()) {
        alert('Keine Berechtigung zur Prüfungsfreischaltung!');
        return;
    }
    const eff = getUserEffectivePermissions(sessionUser);
    const myId = getUserAccountId(sessionUser);
    const myPassed = (cachedUsers[myId]?.passedExams) || {};
    const isLeitung = eff.canManageInstructors || eff.isAdmin || eff.isMasterAdmin;

    if (!isLeitung && !myPassed[examId]) {
        alert('Keine Berechtigung zur Freischaltung dieser Prüfung!');
        renderInstructorUnlocks();
        return;
    }
    db.ref(`data/users/${uId}/unlockedExams/${examId}`).set(isUnlocked).catch(err => {
        console.error('Prüfungsfreischaltung fehlgeschlagen:', err);
        alert('Prüfungsfreischaltung konnte nicht gespeichert werden: ' + (err?.message || err));
        renderInstructorUnlocks();
    });
}

function toggleExamPassedForUser(uId, examId, isPassed) {
    if (!sessionUser || !isUserInstructor()) {
        alert('Keine Berechtigung zur Änderung von Prüfungsergebnissen!');
        return;
    }
    const eff = getUserEffectivePermissions(sessionUser);
    const myId = getUserAccountId(sessionUser);
    const myPassed = (cachedUsers[myId]?.passedExams) || {};
    const isLeitung = eff.canManageInstructors || eff.isAdmin || eff.isMasterAdmin;

    if (!isLeitung && !myPassed[examId]) {
        alert('Keine Berechtigung zur Statusänderung dieser Prüfung!');
        renderInstructorUnlocks();
        return;
    }
    db.ref(`data/users/${uId}/passedExams/${examId}`).set(isPassed).catch(err => {
        console.error('Prüfungsstatus konnte nicht gespeichert werden:', err);
        alert('Prüfungsstatus konnte nicht gespeichert werden: ' + (err?.message || err));
        renderInstructorUnlocks();
    });
}

function renderInstructorSubmissionsInto(subs, tbodyId, searchInputId) {
    const t = document.getElementById(tbodyId); if (!t) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const myId = sessionUser ? getUserAccountId(sessionUser) : '';
    const q = (document.getElementById(searchInputId)?.value || '').trim().toLowerCase();

    let ee = Object.entries(subs || {}).sort((a,b) => (b[1].ts||0) - (a[1].ts||0));

    if (!isUserInstructor()) {
        ee = ee.filter(([, sub]) => sub.userId === myId);
    } else {
        ee = ee.filter(([, sub]) => canInstructorAccessExam(sub.examId));
    }

    if (q) {
        ee = ee.filter(([, sub]) => {
            const uName = (sub.userName || '').toLowerCase();
            const uDN = (sub.userDN || '').toString().toLowerCase();
            const eTitle = (sub.examTitle || '').toLowerCase();
            return uName.includes(q) || uDN.includes(q) || eTitle.includes(q);
        });
    }

    t.innerHTML = !ee.length ? '<tr><td colspan="8" style="text-align:center;padding:24px;">Keine Prüfungsergebnisse gefunden.</td></tr>'
        : ee.map(([subId, sub]) => `
            <tr>
                <td style="font-size:12px;color:var(--text-muted);">${escapeHtml(sub.datum||'--')}</td>
                <td><b>${escapeHtml(sub.userName||'--')}</b> <span style="color:var(--primary);font-size:12px;">(${escapeHtml(sub.userDN||'--')})</span></td>
                <td style="font-weight:700;color:var(--primary);">${escapeHtml(sub.examTitle||'--')}</td>
                <td style="font-family:monospace;color:var(--warning);">${escapeHtml(sub.durationFormatted||'--')}</td>
                <td><b>${sub.percentage||0}%</b></td>
                <td><span style="color:${sub.passed?'var(--success)':'var(--danger)'};font-weight:800;">${sub.passed?'✅ Bestanden':'⛔ Nicht bestanden'}</span></td>
                <td>
                    ${isUserInstructor() ? `<button type="button" class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:12px;" onclick="openExamSubmissionDetailsModal('${subId}')">👁️ Details</button>` : '--'}
                </td>
                <td>${eff.delExams ? `<button type="button" class="btn-delete-row" onclick="deleteExamSubmission('${subId}')">🗑️</button>` : '--'}</td>
            </tr>
        `).join('');
}

function renderInstructorSubmissions(subs) {
    renderInstructorSubmissionsInto(subs, 'instructorSubmissionsTableBody', 'searchSubmissionsInput');
}

function filterSubmissionsTable() {
    renderInstructorSubmissionsInto(cachedSubmissions, 'instructorSubmissionsTableBody', 'searchSubmissionsInput');
}

function openExamSubmissionDetailsModal(subId) {
    if (!sessionUser || !isUserInstructor()) {
        alert('Keine Berechtigung zur Einsicht dieser Prüfungsauswertung!');
        return;
    }
    const sub = cachedSubmissions[subId]; 
    if (!sub) return;
    if (!canInstructorAccessExam(sub.examId)) {
        alert('Keine Berechtigung zur Einsicht dieser Prüfung!');
        return;
    }
    
    const cont = document.getElementById('examSubDetailsContent');
    const modal = document.getElementById('examSubmissionDetailsModal');
    if (!cont || !modal) return;

    let answersList = [];
    if (Array.isArray(sub.answers)) {
        answersList = sub.answers;
    } else if (Array.isArray(sub.details)) {
        answersList = sub.details.map(d => ({
            questionText: d.questionText,
            chosenAnswerText: Array.isArray(d.selectedOptions) ? d.selectedOptions.join(', ') : (d.selectedOptions || '--'),
            isCorrect: d.isCorrect,
            isInfo: d.isInfo
        }));
    } else if (sub.answers && typeof sub.answers === 'object') {
        answersList = Object.values(sub.answers);
    }

    let answersHtml = '';
    if (answersList.length === 0) {
        answersHtml = `
            <div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:8px;color:var(--text-muted);text-align:center;">
                ℹ️ Für diesen Eintrag wurden keine detaillierten Antwort-Protokolle hinterlegt.
            </div>
        `;
    } else {
        answersHtml = answersList.map((ans, idx) => {
            const qText = ans.questionText || `Frage ${idx + 1}`;
            const chosen = ans.chosenAnswerText || 'Keine Antwort ausgewählt';
            
            if (ans.isInfo) {
                return `
                    <div style="background:rgba(30,41,59,0.5);padding:12px;border-radius:8px;border-left:4px solid var(--primary);">
                        <div style="font-weight:800;font-size:12px;color:var(--primary);text-transform:uppercase;">📋 Stammdaten / Prüfungs-Angabe</div>
                        <div style="font-weight:700;font-size:14px;color:var(--text-main);margin-top:2px;">${escapeHtml(qText)}</div>
                        <div style="font-size:13px;margin-top:4px;color:var(--text-main);background:rgba(8,12,20,0.6);padding:6px 10px;border-radius:6px;">
                            ${escapeHtml(chosen)}
                        </div>
                    </div>
                `;
            }

            const isCorrect = !!ans.isCorrect;
            return `
                <div style="background:rgba(15,23,42,0.7);padding:12px;border-radius:8px;border-left:4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'};">
                    <div style="font-weight:700;font-size:14px;color:var(--text-main);">${escapeHtml(qText)}</div>
                    <div style="font-size:13px;margin-top:4px;color:${isCorrect ? 'var(--success)' : 'var(--danger)'};font-weight:700;">
                        Ausgewählt: <span style="color:var(--text-main);font-weight:normal;">${escapeHtml(chosen)}</span> ${isCorrect ? '✅ (Richtig)' : '❌ (Falsch)'}
                    </div>
                </div>
            `;
        }).join('');
    }

    cont.innerHTML = `
        <div style="background:rgba(30,41,59,0.5);padding:14px;border-radius:10px;margin-bottom:14px;border:1px solid var(--border);">
            <p style="margin:0;"><b>Prüfling:</b> ${escapeHtml(sub.userName || '--')} <span style="color:var(--primary);font-weight:700;">(DN: ${escapeHtml(sub.userDN || '--')})</span></p>
            <p style="margin:6px 0 0 0;">
                <b>Prüfung:</b> ${escapeHtml(sub.examTitle || '--')} • 
                <b>Ergebnis:</b> <b style="color:${sub.passed ? 'var(--success)' : 'var(--danger)'};">${sub.percentage || 0}%</b> 
                (${sub.passed ? '✅ Bestanden' : '⛔ Nicht bestanden'}) • 
                <b>Dauer:</b> ${escapeHtml(sub.durationFormatted || '--')}
            </p>
        </div>
        <h4 style="margin:0 0 10px 0;color:var(--primary);">Antwort-Korrekturbogen:</h4>
        <div style="display:flex;flex-direction:column;gap:8px;">
            ${answersHtml}
        </div>
    `;

    modal.style.display = 'flex';
}
function closeExamSubmissionDetailsModal() { document.getElementById('examSubmissionDetailsModal').style.display = 'none'; }

function deleteExamSubmission(subId) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delExams) return;
    if (confirm('Ergebnis löschen?')) db.ref('data/examSubmissions/' + subId).remove();
}

function renderInstructorExistingExams() {
    const container = document.getElementById('instructorExistingExamsList');
    if (!container) return;
    const validIds = sortExamIds(Object.keys(cachedExams)).filter(eId => canInstructorAccessExam(eId));
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};

    const html = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:12px;">
            ${validIds.map(k => {
                const e = cachedExams[k]; if (!e) return '';
                const qCount = (e.questions || []).filter(q => !q.isInfo).length;
                return `
                    <div style="background:rgba(15,23,42,0.8);border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
                        <div>
                            <span style="font-size:11px;color:var(--primary);font-weight:800;text-transform:uppercase;">${escapeHtml(e.kat||'Allgemein')}</span>
                            <h5 style="margin:4px 0 6px 0;font-size:14px;color:var(--text-main);">${escapeHtml(e.title)}</h5>
                            <div style="font-size:12px;color:var(--text-muted);">⏱️ ${e.timeLimitMinutes||30} Min • ❓ ${qCount} Fachfragen (+3 Stammdaten) • 🎯 ${e.passPercentage||60}%</div>
                        </div>
                        <div style="display:flex;gap:6px;justify-content:flex-end;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;">
                            ${eff.canManageExams ? `<button type="button" class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:12px;" onclick="editExam('${k}')">✏️ Bearbeiten</button>` : ''}
                            ${eff.delExams ? `<button type="button" class="btn-delete-row" onclick="deleteExam('${k}')" title="Prüfung löschen">🗑️</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    container.innerHTML = html;
}

let _examBuilderQuestions = [];

function openExamBuilderModal() {
    if (!canCurrentUserManageExams()) { alert('Keine Berechtigung zum Erstellen von Prüfungen!'); return; }
    resetExamBuilderForm();
    document.getElementById('examBuilderModalHeading').textContent = '📝 Neue Prüfung erstellen';
    document.getElementById('examBuilderModal').style.display = 'flex';
}
function closeExamBuilderModal() { document.getElementById('examBuilderModal').style.display = 'none'; }

function resetExamBuilderForm() {
    _examBuilderQuestions = [];
    document.getElementById('editingExamId').value = '';
    document.getElementById('newExamTitle').value = '';
    document.getElementById('newExamKat').value = '';
    document.getElementById('newExamIntroText').value = '';
    document.getElementById('newExamTime').value = '30';
    document.getElementById('newExamPassRate').value = '60';
    refreshExamQuestionsDisplay();
}

function addExamQuestionRow() {
    _examBuilderQuestions.push({
        id: _examBuilderQuestions.length + 1,
        text: '',
        options: ['', '', '', ''],
        correctAnswers: [0],
        type: 'choice'
    });
    refreshExamQuestionsDisplay();
}

function refreshExamQuestionsDisplay() {
    const c = document.getElementById('examQuestionsListBuilder'); if (!c) return;
    const fachFragen = _examBuilderQuestions.filter(q => !q.isInfo);
    document.getElementById('examQuestionsCountDisplay').textContent = fachFragen.length;

    let fachIndex = 0;
    c.innerHTML = _examBuilderQuestions.map((q, idx) => {
        if (q.isInfo) {
            return `
                <div style="background:rgba(30,41,59,0.5);border:1px solid var(--primary);border-radius:10px;padding:12px;">
                    <div style="font-weight:800;color:var(--primary);font-size:12px;">📋 Stammdaten-Pflichtfeld ${idx+1} (Fest vorgegeben)</div>
                    <div style="font-size:14px;font-weight:700;margin-top:4px;">${escapeHtml(q.text)}</div>
                </div>
            `;
        }

        fachIndex++;
        const currentFachNumber = fachIndex;

        if (!Array.isArray(q.correctAnswers)) {
            q.correctAnswers = (q.correctAnswers !== undefined && q.correctAnswers !== null) ? [parseInt(q.correctAnswers)] : [0];
        }

        const optionsHtml = (q.options || ['', '', '', '']).map((opt, oIdx) => {
            const isChecked = q.correctAnswers.includes(oIdx);
            return `
                <div style="display:flex;align-items:center;gap:6px;">
                    <input type="checkbox" id="chk_bld_${idx}_${oIdx}" ${isChecked ? 'checked' : ''} onchange="toggleBuilderCorrectAnswer(${idx}, ${oIdx}, this.checked)">
                    <label for="chk_bld_${idx}_${oIdx}" style="margin:0;cursor:pointer;font-size:12px;color:var(--text-muted);">Richtig</label>
                    <input type="text" value="${escapeHtml(opt||'')}" oninput="_examBuilderQuestions[${idx}].options[${oIdx}]=this.value" placeholder="Antwort ${oIdx+1}" style="flex:1;">
                </div>
            `;
        }).join('');

        return `
            <div style="background:rgba(15,23,42,0.6);border:1px solid var(--border);border-radius:10px;padding:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <b>Fachfrage ${currentFachNumber} <span style="font-size:12px;color:var(--primary);">(Mehrfachauswahl aktiv)</span></b>
                    <button class="btn-delete-row" type="button" onclick="_examBuilderQuestions.splice(${idx},1);refreshExamQuestionsDisplay();">🗑️</button>
                </div>
                <input type="text" value="${escapeHtml(q.text||'')}" oninput="_examBuilderQuestions[${idx}].text=this.value" placeholder="Fragetext..." style="margin-bottom:8px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    ${optionsHtml}
                </div>
            </div>
        `;
    }).join('');
}

function toggleBuilderCorrectAnswer(qIdx, oIdx, isChecked) {
    if (!_examBuilderQuestions[qIdx]) return;
    if (!Array.isArray(_examBuilderQuestions[qIdx].correctAnswers)) {
        _examBuilderQuestions[qIdx].correctAnswers = [];
    }
    const arr = _examBuilderQuestions[qIdx].correctAnswers;
    if (isChecked) {
        if (!arr.includes(oIdx)) arr.push(oIdx);
    } else {
        _examBuilderQuestions[qIdx].correctAnswers = arr.filter(val => val !== oIdx);
    }
}

function neuePruefungSpeichern() {
    if (!canCurrentUserManageExams()) { alert('Keine Berechtigung zum Speichern von Prüfungen!'); return; }
    const title = document.getElementById('newExamTitle')?.value.trim();
    if (!title) { alert('Bitte Titel angeben!'); return; }
    
    let finalQuestions = _examBuilderQuestions.filter(q => !q.isInfo);
    
    for (let i = 0; i < finalQuestions.length; i++) {
        const q = finalQuestions[i];
        if (!q.text || !q.text.trim()) {
            alert(`⚠️ Fachfrage ${i + 1} besitzt keinen Fragetext!`);
            return;
        }
        if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) {
            alert(`⚠️ Fachfrage "${q.text.substring(0, 30)}..." hat keine korrekte Antwort markiert!`);
            return;
        }
    }

    const kat = document.getElementById('newExamKat')?.value.trim() || 'Allgemein';
    const timeLimit = parseInt(document.getElementById('newExamTime')?.value) || 30;
    const passRate = parseInt(document.getElementById('newExamPassRate')?.value) || 60;
    const intro = document.getElementById('newExamIntroText')?.value.trim() || '';
    const examId = document.getElementById('editingExamId')?.value || ('exam_' + Date.now());

    finalQuestions.forEach(q => {
        if (!Array.isArray(q.correctAnswers)) q.correctAnswers = [0];
    });

    const fullCatalog = [
        ...STANDARD_INFO_QUESTIONS,
        ...finalQuestions
    ];

    const data = {
        id: examId, title, kat, timeLimitMinutes: timeLimit, passPercentage: passRate,
        introText: intro, questions: fullCatalog, ts: Date.now()
    };

    db.ref('data/exams/' + examId).set(data).then(() => {
        cachedExams[examId] = data;
        closeExamBuilderModal();
        renderInstructorExistingExams();
        renderStudentUnlockedExams();
        alert('✅ Prüfung in Cloud gespeichert!');
    });
}

function editExam(eid) {
    if (!canCurrentUserManageExams()) { alert('Keine Berechtigung zum Bearbeiten von Prüfungen!'); return; }
    const ex = cachedExams[eid]; if (!ex) return;
    document.getElementById('editingExamId').value = eid;
    document.getElementById('newExamTitle').value = ex.title || '';
    document.getElementById('newExamKat').value = ex.kat || '';
    document.getElementById('newExamTime').value = ex.timeLimitMinutes || 30;
    document.getElementById('newExamPassRate').value = ex.passPercentage || 60;
    document.getElementById('newExamIntroText').value = ex.introText || '';
    
    _examBuilderQuestions = JSON.parse(JSON.stringify(ex.questions || []));
    
    let hasInfo = _examBuilderQuestions.some(q => q.isInfo);
    if (!hasInfo) {
        _examBuilderQuestions = [
            ...STANDARD_INFO_QUESTIONS,
            ..._examBuilderQuestions
        ];
    }

    _examBuilderQuestions.forEach(q => {
        if (!q.isInfo && !Array.isArray(q.correctAnswers)) {
            q.correctAnswers = (q.correctAnswers !== undefined && q.correctAnswers !== null) ? [parseInt(q.correctAnswers)] : [0];
        }
    });

    refreshExamQuestionsDisplay();
    document.getElementById('examBuilderModalHeading').textContent = '✏️ Prüfung bearbeiten';
    document.getElementById('examBuilderModal').style.display = 'flex';
}

function deleteExam(eid) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delExams) return;
    if (confirm('Soll diese Prüfung wirklich dauerhaft gelöscht werden?')) {
        db.ref('data/exams/' + eid).set({ deleted: true }).then(() => {
            delete cachedExams[eid];
            renderInstructorExistingExams();
            renderStudentUnlockedExams();
            logAdminAudit('Prüfung gelöscht', `ID ${eid} gelöscht durch ${sessionUser.vorname} ${sessionUser.nachname}`);
        });
    }
}

function renderInstructorAllowedExams() {
    const mt = document.getElementById('instructorMembersApprovalTableBody'); if (!mt) return;
    if (!sessionUser) { mt.innerHTML = ''; return; }
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.canManageInstructors && !eff.isAdmin && !eff.isMasterAdmin) { mt.innerHTML = ''; return; }
    const userList = Object.entries(cachedUsers).sort((a, b) => {
        const nameA = ((a[1].nachname || '') + ' ' + (a[1].vorname || '')).trim().toLowerCase();
        const nameB = ((b[1].nachname || '') + ' ' + (b[1].vorname || '')).trim().toLowerCase();
        return nameA.localeCompare(nameB, 'de');
    });

    mt.innerHTML = userList.map(([uId, u]) => `
        <tr>
            <td style="padding:10px;"><b>${escapeHtml(u.vorname||'')} ${escapeHtml(u.nachname||'')}</b></td>
            <td style="padding:10px;color:var(--primary);font-weight:700;">DN: ${escapeHtml(u.dn||'--')}</td>
            <td style="padding:10px;">${renderUserRoleBadges(u)}</td>
            <td style="padding:10px;"><span style="color:${getUserStatusDisplay(u.status).color};font-weight:700;">${getUserStatusDisplay(u.status).text}</span></td>
            <td style="text-align:right;padding:10px;">
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    ${u.status !== 'approved'
                        ? `<button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;background:var(--success);color:#080c14;font-weight:800;" onclick="approveUser('${uId}')">✅ Freischalten</button>`
                        : `<button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;background:rgba(244,63,94,0.15);color:var(--danger);border:1px solid var(--danger);" onclick="revokeUser('${uId}')">⛔ Sperren</button>`
                    }
                    <button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;" onclick="openAssignRolesModal('${uId}', null, true)">🎭 Rollen</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function startExam(eid) {
    if (!sessionUser) return;
    const myId = getUserAccountId(sessionUser);
    const me = cachedUsers[myId] || sessionUser || {};
    if (me.passedExams?.[eid]) {
        alert('Diese Prüfung wurde bereits bestanden.');
        return;
    }
    if (!me.unlockedExams?.[eid]) {
        alert('Diese Prüfung ist nicht freigeschaltet!');
        return;
    }
    const ex = cachedExams[eid]; if (!ex || !ex.questions) return;
    activeExam = { id: eid, exam: ex }; activeExamSecondsElapsed = 0;
    clearInterval(activeExamTimerInterval);
    activeExamTimerInterval = setInterval(() => {
        activeExamSecondsElapsed++;
        const m = Math.floor(activeExamSecondsElapsed/60).toString().padStart(2, '0');
        const s = (activeExamSecondsElapsed%60).toString().padStart(2, '0');
        const tEl = document.getElementById('activeExamTimerDisplay'); if (tEl) tEl.textContent = `${m}:${s}`;
    }, 1000);

    document.getElementById('activeExamTitle').textContent = ex.title;
    const c = document.getElementById('activeExamQuestionsContainer');
    let fachIndex = 0;
    if (c) {
        c.innerHTML = ex.questions.map((q, idx) => {
            if (q.isInfo || q.type === 'text') {
                return `
                    <div class="exam-q-box" style="border-left: 4px solid var(--primary);">
                        <p style="font-weight:800;margin:0 0 8px 0;">📋 Angabe ${idx+1}: ${escapeHtml(q.text)}</p>
                        <input type="text" name="q_text_${idx}" placeholder="Hier eintragen..." class="form-input" style="width:100%;margin-top:6px;" required>
                    </div>
                `;
            }
            fachIndex++;
            return `
                <div class="exam-q-box">
                    <p style="font-weight:800;margin:0 0 8px 0;">❓ Frage ${fachIndex}: ${escapeHtml(q.text)} <span style="font-size:12px;color:var(--warning);font-weight:normal;float:right;">(Mehrfachauswahl möglich)</span></p>
                    ${(q.options || []).map((opt, oIdx) => `
                        <label class="exam-opt-label">
                            <input type="checkbox" name="q_${idx}" value="${oIdx}">
                            <span>${escapeHtml(opt)}</span>
                        </label>
                    `).join('')}
                </div>
            `;
        }).join('');
    }

    document.getElementById('activeExamContainer').style.display = 'block';
    document.getElementById('examStudentView').querySelector('.exam-grid-compact').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelActiveExam() {
    clearInterval(activeExamTimerInterval); activeExam = null;
    document.getElementById('activeExamContainer').style.display = 'none';
    document.getElementById('examStudentView').querySelector('.exam-grid-compact').style.display = 'grid';
}

function submitActiveExam() {
    if (!sessionUser || !activeExam) return;
    const ex = activeExam.exam, eid = activeExam.id;
    const myId = getUserAccountId(sessionUser);
    const me = cachedUsers[myId] || sessionUser || {};
    if (!me.unlockedExams?.[eid] || me.passedExams?.[eid]) {
        cancelActiveExam();
        alert('Die Freigabe dieser Prüfung ist nicht mehr gültig.');
        return;
    }
    clearInterval(activeExamTimerInterval);
    let totalQ = 0, correctQ = 0;
    const recordedAnswers = [];

    ex.questions.forEach((q, idx) => {
        if (q.isInfo || q.type === 'text') {
            const val = (document.querySelector(`input[name="q_text_${idx}"]`)?.value || '').trim();
            recordedAnswers.push({
                questionText: q.text,
                chosenAnswerText: val || 'Keine Angabe',
                isCorrect: true,
                isInfo: true
            });
            return;
        }

        const checkboxes = document.querySelectorAll(`input[name="q_${idx}"]:checked`);
        let chosenArr = [];
        checkboxes.forEach(cb => chosenArr.push(parseInt(cb.value)));

        const correctArr = (q.correctAnswers || [0]).map(Number);
        const isRight = (chosenArr.length === correctArr.length) && chosenArr.every(val => correctArr.includes(val));
        
        totalQ++;
        if (isRight) correctQ++;

        const chosenTexts = chosenArr.length > 0 ? chosenArr.map(oIdx => q.options[oIdx] || 'Unbekannt').join(', ') : 'Keine Antwort';

        recordedAnswers.push({
            questionText: q.text,
            chosenAnswerText: chosenTexts,
            isCorrect: isRight,
            isInfo: false
        });
    });

    const pct = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
    const passed = pct >= (ex.passPercentage || 60);
    const m = Math.floor(activeExamSecondsElapsed / 60).toString().padStart(2, '0');
    const s = (activeExamSecondsElapsed % 60).toString().padStart(2, '0');

    const submissionRef = db.ref('data/examSubmissions').push();
    const updates = {};
    updates[`data/examSubmissions/${submissionRef.key}`] = {
        examId: eid,
        examTitle: ex.title,
        userId: myId,
        userName: sessionUser.vorname + ' ' + sessionUser.nachname,
        userDN: sessionUser.dn || 'Keine DN',
        percentage: pct,
        passed: passed,
        durationFormatted: `${m}:${s} Min`,
        datum: new Date().toLocaleDateString('de-DE'),
        ts: Date.now(),
        answers: recordedAnswers
    };
    if (passed) updates[`data/users/${myId}/passedExams/${eid}`] = true;
    else updates[`data/users/${myId}/unlockedExams/${eid}`] = false;

    db.ref().update(updates).then(() => {
        if (passed) {
            alert(`🎉 Herzlichen Glückwunsch! Du hast die Prüfung bestanden mit ${pct}%!`);
        } else {
            alert(`❌ Leider nicht bestanden (${pct}%). Die Prüfung wurde gesperrt und muss von der Ausbildungsleitung neu freigeschaltet werden.`);
        }
        cancelActiveExam();
    }).catch(err => {
        console.error('Prüfungsergebnis konnte nicht vollständig gespeichert werden:', err);
        alert('Das Prüfungsergebnis konnte nicht gespeichert werden. Bitte die Ausbildungsleitung informieren.\n\nFehler: ' + (err?.message || err));
    });
}

/* ══════════════════════════════════════════════════════════════
   ADMIN-BEREICH: ROLLENVERGABE & DAUERHAFTER ENTZUG
══════════════════════════════════════════════════════════════ */
function openAdminKeyModal() {
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isAdmin && !eff.isMasterAdmin) return;
    const pi = document.getElementById('adminAuthPassInput'); if (pi) pi.value = '';
    const m = document.getElementById('adminAuthModal');
    if (m) { m.style.display = 'flex'; if (pi) pi.focus(); }
}
function closeAdminAuthModal() { document.getElementById('adminAuthModal').style.display = 'none'; }

async function verifyAdminKeyPassword() {
    const p = (document.getElementById('adminAuthPassInput')?.value || '').trim();
    if (!sessionUser || !requireAdminAccess() || !auth.currentUser) return;
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, p);
        await auth.currentUser.reauthenticateWithCredential(credential);
        closeAdminAuthModal();
        document.getElementById('adminManagementModal').style.display = 'flex';
        try {
            await refreshUsersFromFirebase();
        } catch (_) {
            alert('Die Mitarbeiterliste konnte nicht frisch aus Firebase geladen werden. Es wird der zuletzt geladene Stand angezeigt.');
        }
        renderAdminUserTable(cachedUsers);
        renderAdminRolesList();
        refreshFirebaseAuthMigrationPanel();
        renderPasswordChangeStatusPanel();
    } catch (err) {
        console.error('Admin-Verifizierung fehlgeschlagen:', err);
        if (['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(err?.code)) {
            alert('Falsches Admin-Passwort!');
            return;
        }
        alert('Admin-Verifizierung fehlgeschlagen: ' + (err?.message || err));
    }
}

function closeAdminManagementModal() { document.getElementById('adminManagementModal').style.display = 'none'; }

function switchAdminTab(tabId, btnEl) {
    document.querySelectorAll('#adminManagementModal .admin-subtab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('#adminManagementModal .admin-tab-btn').forEach(e => e.classList.remove('active'));
    const t = document.getElementById(tabId); if (t) t.classList.add('active');
    if (btnEl) btnEl.classList.add('active');
}

function getUserStatusDisplay(status) {
    if (status === 'approved') return { text: '✅ Aktiv', color: 'var(--success)' };
    if (status === 'revoked') return { text: '⛔ Gesperrt', color: 'var(--danger)' };
    return { text: '⏳ Wartet auf Freischaltung', color: 'var(--warning)' };
}

function renderAdminUserTable(obj) {
    const tbody = document.getElementById('adminUserTableBody'); if (!tbody) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const userList = Object.entries(obj || {}).sort((a, b) => {
        const nameA = ((a[1].nachname || '') + ' ' + (a[1].vorname || '')).trim().toLowerCase();
        const nameB = ((b[1].nachname || '') + ' ' + (b[1].vorname || '')).trim().toLowerCase();
        return nameA.localeCompare(nameB, 'de');
    });

    tbody.innerHTML = userList.map(([uId, u]) => `
        <tr class="admin-user-row" data-name="${escapeHtml((u.vorname+' '+u.nachname+' '+u.dn).toLowerCase())}">
            <td>
                <b>${escapeHtml(u.vorname||'')} ${escapeHtml(u.nachname||'')}</b>
            </td>
            <td>
                <span style="color:var(--primary);font-weight:700;">DN: ${escapeHtml(u.dn||'--')}</span> | 
                <span style="font-family:monospace;color:var(--text-muted);">PW: ••••••</span>
            </td>
            <td>
                ${renderUserRoleBadges(u)}<br>
                <span style="color:${getUserStatusDisplay(u.status).color};font-weight:700;font-size:12px;">${getUserStatusDisplay(u.status).text}</span>
            </td>
            <td style="color:var(--text-muted);font-size:12px;">${escapeHtml(u.date||'--')}</td>
            <td style="text-align:right;">
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    ${u.status !== 'approved'
                        ? `<button type="button" class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:12px;background:var(--success);color:#080c14;font-weight:800;" onclick="approveUser('${uId}')">✅ Freischalten</button>`
                        : `<button type="button" class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:12px;background:rgba(244,63,94,0.15);color:var(--danger);border:1px solid var(--danger);" onclick="revokeUser('${uId}')">⛔ Sperren</button>`
                    }
                    <button type="button" class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:12px;" onclick="openAssignRolesModal('${uId}', null, false)">🎭 Rollen</button>
                    <button type="button" class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:12px;background:rgba(168,85,247,0.15);color:#a855f7;border:1px solid #a855f7;" onclick="openUserPermissionsModal('${uId}')">✏️ Edit</button>
                    ${eff.delUsers ? `<button type="button" class="btn-delete-row" onclick="deleteUserAccount('${uId}')" title="Mitarbeiter löschen">🗑️</button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function filterAdminUserTable() {
    const q = (document.getElementById('searchAdminUsers')?.value||'').toLowerCase();
    document.querySelectorAll('.admin-user-row').forEach(r => {
        r.style.display = r.getAttribute('data-name').includes(q) ? '' : 'none';
    });
}


async function createSecondaryAuthAccount(uId, version, password, allowExistingLogin = true) {
    const appName = `mmd-auth-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const secondaryApp = firebase.initializeApp(FIREBASE_CONFIG, appName);
    const secondaryAuth = secondaryApp.auth();
    await secondaryAuth.setPersistence(firebase.auth.Auth.Persistence.NONE);
    const email = getTechnicalAuthEmail(uId, version);

    let credential;
    let created = false;
    try {
        credential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        created = true;
    } catch (err) {
        if (allowExistingLogin && err?.code === 'auth/email-already-in-use') {
            credential = await secondaryAuth.signInWithEmailAndPassword(email, password);
        } else {
            try { await secondaryApp.delete(); } catch (_) {}
            throw err;
        }
    }

    return {
        app: secondaryApp,
        auth: secondaryAuth,
        user: credential.user,
        created,
        email
    };
}

async function closeSecondaryAuthAccount(ctx) {
    if (!ctx) return;
    try { await ctx.auth?.signOut(); } catch (_) {}
    try { await ctx.app?.delete(); } catch (_) {}
}

async function resetFirebaseAuthForUser(uId, newPassword) {
    if (!requireMasterAdminAccess('Nur der Master-Admin darf das Login-Passwort anderer Mitarbeiter zurücksetzen.')) return false;
    if (!uId || !newPassword || newPassword.length < 6) {
        alert('Das neue Passwort muss mindestens 6 Zeichen lang sein!');
        return false;
    }

    const target = cachedUsers[uId];
    if (!target) {
        alert('Mitarbeiterkonto wurde nicht gefunden.');
        return false;
    }

    const loginKey = target.loginKey || generateUserId(target.vorname, target.nachname);
    const directoryVersion = (await readLoginDirectory(loginKey)).version;
    let nextVersion = Math.max(directoryVersion, Number(target.authVersion) || 0) + 1;
    if (nextVersion < 1) nextVersion = 1;

    let ctx = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            ctx = await createSecondaryAuthAccount(uId, nextVersion, newPassword, false);
            break;
        } catch (err) {
            if (err?.code === 'auth/email-already-in-use') {
                nextVersion++;
                continue;
            }
            throw err;
        }
    }
    if (!ctx) throw new Error('Es konnte kein neuer Firebase-Zugang angelegt werden.');

    const oldAuthUid = target.authUid || null;
    const updates = {};
    if (oldAuthUid && oldAuthUid !== ctx.user.uid) {
        updates[`data/authIndex/${oldAuthUid}`] = null;
    }
    updates[`data/authIndex/${ctx.user.uid}`] = uId;
    updates[`data/loginDirectory/${loginKey}`] = { version: nextVersion, accountId: uId };
    updates[`data/users/${uId}/accountId`] = uId;
    updates[`data/users/${uId}/loginKey`] = loginKey;
    updates[`data/users/${uId}/authUid`] = ctx.user.uid;
    updates[`data/users/${uId}/authVersion`] = nextVersion;
    updates[`data/users/${uId}/mustChangePassword`] = true;
    updates[`data/users/${uId}/pass`] = null;
    updates[`data/users/${uId}/passwordHash`] = null;
    updates[`data/users/${uId}/passwordSalt`] = null;
    updates[`data/users/${uId}/passwordAlgo`] = null;
    updates[`data/users/${uId}/passwordIterations`] = null;
    updates[`data/users/${uId}/passwordVersion`] = null;
    updates[`data/users/${uId}/passwordUpdatedAt`] = null;
    updates[`data/users/${uId}/serverPermissions`] = buildServerPermissions(target);

    try {
        await db.ref().update(updates);
        await closeSecondaryAuthAccount(ctx);
        logAdminAudit('Firebase-Zugang zurückgesetzt', `Login-Zugang für ${uId} wurde durch ${sessionUser.vorname} ${sessionUser.nachname} neu gesetzt.`);
        return true;
    } catch (err) {
        try {
            if (ctx.created && ctx.user) await ctx.user.delete();
        } catch (_) {}
        await closeSecondaryAuthAccount(ctx);
        throw err;
    }
}


const PASSWORD_ROLLOUT_NOTIFY_KEY = 'mmd_password_rollout_complete_notified_v1';

function getPasswordRolloutEntries() {
    return Object.entries(cachedUsers || {})
        .filter(([, u]) => u && typeof u === 'object')
        .map(([uId, u]) => ({
            uId,
            user: u,
            pending: u.mustChangePassword === true,
            mapped: !!u.authUid
        }))
        .sort((a, b) => {
            const an = `${a.user.nachname || ''} ${a.user.vorname || ''}`.trim();
            const bn = `${b.user.nachname || ''} ${b.user.vorname || ''}`.trim();
            return an.localeCompare(bn, 'de');
        });
}

function buildPasswordReminderText(user) {
    const firstName = (user?.vorname || '').trim();
    const greetingName = firstName || 'du';
    return `Hallo ${greetingName}, bitte melde dich einmal in der MMD Cloud mit deinem aktuell gültigen Passwort an. Beim Login wirst du automatisch aufgefordert, ein neues persönliches Passwort festzulegen. Bitte führe diese Passwortänderung zeitnah durch. Danke!`;
}

async function copyPlainText(text) {
    const value = String(text || '');
    if (!value) return false;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch (_) {}

    try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    } catch (_) {
        return false;
    }
}

async function copyPasswordReminderForUser(uId) {
    const target = cachedUsers?.[uId];
    if (!target) {
        alert('Mitarbeiterkonto wurde nicht gefunden.');
        return;
    }
    const ok = await copyPlainText(buildPasswordReminderText(target));
    alert(ok ? `✅ Erinnerung für ${target.vorname || ''} ${target.nachname || ''} wurde kopiert.`.trim() : 'Die Erinnerung konnte nicht automatisch kopiert werden.');
}

async function copyAllOpenPasswordReminders() {
    const pending = getPasswordRolloutEntries().filter(e => e.pending && e.mapped);
    if (!pending.length) {
        alert('✅ Aktuell gibt es keine offenen Passwortänderungen.');
        return;
    }
    const text = pending.map(({ user }) => {
        const name = `${user.vorname || ''} ${user.nachname || ''}`.trim() || 'Mitarbeiter';
        return `${name}\n${buildPasswordReminderText(user)}`;
    }).join('\n\n--------------------\n\n');
    const ok = await copyPlainText(text);
    alert(ok ? `✅ ${pending.length} Erinnerung(en) wurden in die Zwischenablage kopiert.` : 'Die Erinnerungen konnten nicht automatisch kopiert werden.');
}

function maybeNotifyPasswordRolloutComplete(entries) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isMasterAdmin) return;

    const pending = entries.filter(e => e.pending || !e.mapped);
    if (pending.length > 0) {
        localStorage.removeItem(PASSWORD_ROLLOUT_NOTIFY_KEY);
        return;
    }

    const trackedAccountsExist = entries.some(e => typeof e.user.mustChangePassword === 'boolean');
    if (!trackedAccountsExist || entries.length === 0) return;
    if (localStorage.getItem(PASSWORD_ROLLOUT_NOTIFY_KEY) === 'done') return;

    localStorage.setItem(PASSWORD_ROLLOUT_NOTIFY_KEY, 'done');
    setTimeout(() => {
        alert('✅ Passwort-Umstellung abgeschlossen!\n\nAlle Mitarbeiterkonten sind jetzt ohne offene Passwortänderung.');
    }, 150);
}

function renderPasswordChangeStatusPanel() {
    const panel = document.getElementById('passwordChangeStatusPanel');
    const summary = document.getElementById('passwordChangeStatusSummary');
    const list = document.getElementById('passwordChangeStatusList');
    const copyAllBtn = document.getElementById('btnCopyAllPasswordReminders');
    if (!panel) return;

    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!sessionUser || !eff.isMasterAdmin) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';
    const entries = getPasswordRolloutEntries();
    const pending = entries.filter(e => e.pending && e.mapped);
    const problems = entries.filter(e => !e.mapped);
    const done = entries.filter(e => e.mapped && !e.pending);
    const total = entries.length;
    const completed = done.length;
    const pct = total ? Math.round((completed / total) * 100) : 100;

    if (summary) {
        const openCount = pending.length + problems.length;
        summary.innerHTML = `
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
                <div style="font-size:13px; color:var(--text-main);"><b>${completed} von ${total}</b> Konten abgeschlossen · <b style="color:${openCount ? 'var(--warning)' : 'var(--success)'};">${openCount} offen</b></div>
                <div style="font-size:12px; color:var(--text-muted);">Stand: ${new Date().toLocaleString('de-DE')}</div>
            </div>
            <div style="height:10px; background:rgba(148,163,184,0.14); border-radius:999px; overflow:hidden; border:1px solid rgba(148,163,184,0.18);">
                <div style="height:100%; width:${Math.max(0, Math.min(100, pct))}%; background:var(--success); transition:width .2s ease;"></div>
            </div>`;
    }

    if (copyAllBtn) copyAllBtn.style.display = pending.length ? 'inline-flex' : 'none';

    if (list) {
        if (!entries.length) {
            list.innerHTML = '<div style="font-size:12px; color:var(--text-muted); padding:10px 0;">Keine Mitarbeiterkonten gefunden.</div>';
        } else {
            const rows = entries.map(({ uId, user, pending: isPending, mapped }) => {
                const name = `${user.vorname || ''} ${user.nachname || ''}`.trim() || uId;
                const dn = user.dn ? `DN ${escapeHtml(user.dn)}` : 'keine DN';
                let statusHtml = '<span style="color:var(--success); font-weight:800;">✅ Abgeschlossen</span>';
                let actionHtml = '<span style="color:var(--text-muted); font-size:11px;">—</span>';
                if (!mapped) {
                    statusHtml = '<span style="color:var(--danger); font-weight:800;">⚠️ Konto prüfen</span>';
                } else if (isPending) {
                    statusHtml = '<span style="color:var(--warning); font-weight:800;">⏳ Passwortänderung offen</span>';
                    actionHtml = `<button type="button" class="btn password-reminder-copy-btn" data-user-id="${escapeHtml(uId)}" style="width:auto; margin:0; padding:7px 10px; font-size:11px; background:rgba(234,179,8,0.12); color:var(--warning); border:1px solid rgba(234,179,8,0.35);">📋 Erinnerung kopieren</button>`;
                }
                return `<tr>
                    <td style="font-weight:800;">${escapeHtml(name)}</td>
                    <td style="color:var(--text-muted);">${dn}</td>
                    <td>${statusHtml}</td>
                    <td style="text-align:right;">${actionHtml}</td>
                </tr>`;
            }).join('');

            list.innerHTML = `
                <div class="table-responsive" style="margin-top:10px;">
                    <table>
                        <thead><tr><th>Mitarbeiter</th><th>Dienstnummer</th><th>Passwortstatus</th><th style="text-align:right;">Aktion</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;

            list.querySelectorAll('.password-reminder-copy-btn').forEach(btn => {
                btn.addEventListener('click', () => copyPasswordReminderForUser(btn.dataset.userId));
            });
        }
    }

    maybeNotifyPasswordRolloutComplete(entries);
}

async function refreshFirebaseAuthMigrationPanel() {
    const panel = document.getElementById('firebaseAuthMigrationPanel');
    const statusEl = document.getElementById('firebaseAuthMigrationStatus');
    const runBtn = document.getElementById('btnRunFirebaseAuthMigration');
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!panel || !eff.isMasterAdmin) {
        if (panel) panel.style.display = 'none';
        return;
    }

    try {
        const [flagSnap, usersSnap] = await Promise.all([
            db.ref('data/system/authMigrationComplete').once('value'),
            db.ref('data/users').once('value')
        ]);
        const users = usersSnap.val() || {};
        const entries = Object.entries(users);
        const pending = entries.filter(([, u]) => !u?.authUid || u?.pass || u?.passwordHash || u?.passwordSalt);
        const complete = flagSnap.val() === true && pending.length === 0;

        panel.style.display = complete ? 'none' : 'block';
        if (complete) return;

        if (statusEl) {
            statusEl.innerHTML = `<b>${entries.length - pending.length}</b> von <b>${entries.length}</b> Konten sind vollständig auf Firebase Authentication umgestellt. ${pending.length ? `<span style="color:var(--warning);">${pending.length} Konto/Konten benötigen noch die Migration.</span>` : 'Die Konten sind migriert; der Abschlussstatus kann jetzt gesetzt werden.'}`;
        }
        if (runBtn) runBtn.disabled = false;
    } catch (err) {
        panel.style.display = 'block';
        if (statusEl) statusEl.textContent = 'Migrationsstatus konnte nicht gelesen werden: ' + (err?.message || err);
    }
}

async function runFirebaseAuthMigration() {
    if (!requireMasterAdminAccess('Nur der Master-Admin darf die Firebase-Auth-Migration ausführen.')) return;
    if (!auth.currentUser) {
        alert('Keine aktive Firebase-Anmeldung vorhanden.');
        return;
    }

    const ok = confirm(
        'Sicherheitsmigration jetzt starten?\n\n' +
        'Alle noch nicht umgestellten Mitarbeiterkonten werden jetzt sofort in Firebase Authentication angelegt.\n' +
        'Die Mitarbeiter behalten für den ersten Login ihr bisheriges Passwort und müssen anschließend direkt ein neues persönliches Passwort festlegen.\n\n' +
        'Es werden keine Übergangspasswörter an Mitarbeiter ausgegeben.\n\n' +
        'Vorher sollte ein aktuelles Firebase-Backup vorhanden sein.'
    );
    if (!ok) return;

    const btn = document.getElementById('btnRunFirebaseAuthMigration');
    const statusEl = document.getElementById('firebaseAuthMigrationStatus');
    if (btn) btn.disabled = true;

    const failures = [];
    let migrated = 0;
    let cleaned = 0;
    let transitionAccounts = 0;

    try {
        const [rolesSnap, snap] = await Promise.all([
            db.ref('data/roles').once('value'),
            db.ref('data/users').once('value')
        ]);
        cachedRoles = rolesSnap.val() ? Object.assign({}, defaultRoles, rolesSnap.val()) : Object.assign({}, defaultRoles);
        const users = snap.val() || {};
        const myId = getUserAccountId(sessionUser);

        for (const [uId, rawUser] of Object.entries(users)) {
            if (statusEl) statusEl.textContent = `Bearbeite ${uId} …`;

            let firebaseUid = rawUser?.authUid || null;
            const loginKey = rawUser?.loginKey || generateUserId(rawUser?.vorname, rawUser?.nachname);
            const existingDirectory = await readLoginDirectory(loginKey);
            let version = Math.max(1, Number(rawUser?.authVersion) || existingDirectory.version || 1);
            let secondaryCtx = null;
            let transitionMeta = null;

            try {
                if (uId === myId && auth.currentUser) {
                    firebaseUid = auth.currentUser.uid;
                }

                if (!firebaseUid) {
                    let verifierHash = '';
                    let transitionSalt = '';
                    let transitionIterations = PASSWORD_HASH_ITERATIONS;

                    if (rawUser?.passwordHash && rawUser?.passwordSalt) {
                        verifierHash = String(rawUser.passwordHash);
                        transitionSalt = String(rawUser.passwordSalt);
                        transitionIterations = Number(rawUser.passwordIterations) || PASSWORD_HASH_ITERATIONS;
                    } else if (typeof rawUser?.pass === 'string' && rawUser.pass.length > 0) {
                        transitionSalt = createRandomSaltBase64(16);
                        transitionIterations = PASSWORD_HASH_ITERATIONS;
                        verifierHash = await derivePasswordHash(rawUser.pass, transitionSalt, transitionIterations);
                    } else {
                        throw new Error('Kein altes Passwort oder Passwort-Hash für die sichere Selbstmigration vorhanden.');
                    }

                    const transitionPassword = await deriveTransitionFirebasePassword(verifierHash, uId, version);
                    secondaryCtx = await createSecondaryAuthAccount(uId, version, transitionPassword, true);
                    firebaseUid = secondaryCtx.user.uid;
                    migrated++;
                    transitionAccounts++;
                    transitionMeta = {
                        transitionMode: 'legacy-kdf-v1',
                        transitionSalt,
                        transitionIterations
                    };
                }

                const cleanForPermissions = Object.assign({}, rawUser, { accountId: uId, loginKey, authUid: firebaseUid, authVersion: version });
                const directoryData = { version, accountId: uId };
                if (transitionMeta) Object.assign(directoryData, transitionMeta);
                else if (existingDirectory.transitionMode) {
                    directoryData.transitionMode = 'legacy-kdf-v1';
                    directoryData.transitionSalt = existingDirectory.transitionSalt;
                    directoryData.transitionIterations = existingDirectory.transitionIterations;
                }

                const updates = {};
                updates[`data/authIndex/${firebaseUid}`] = uId;
                updates[`data/loginDirectory/${loginKey}`] = directoryData;
                updates[`data/users/${uId}/accountId`] = uId;
                updates[`data/users/${uId}/loginKey`] = loginKey;
                updates[`data/users/${uId}/authUid`] = firebaseUid;
                updates[`data/users/${uId}/authVersion`] = version;
                updates[`data/users/${uId}/serverPermissions`] = buildServerPermissions(cleanForPermissions);
                if (transitionMeta) updates[`data/users/${uId}/mustChangePassword`] = true;
                updates[`data/users/${uId}/pass`] = null;
                updates[`data/users/${uId}/passwordHash`] = null;
                updates[`data/users/${uId}/passwordSalt`] = null;
                updates[`data/users/${uId}/passwordAlgo`] = null;
                updates[`data/users/${uId}/passwordIterations`] = null;
                updates[`data/users/${uId}/passwordVersion`] = null;
                updates[`data/users/${uId}/passwordUpdatedAt`] = null;

                await db.ref().update(updates);
                cleaned++;
                await closeSecondaryAuthAccount(secondaryCtx);
            } catch (err) {
                if (secondaryCtx?.created && secondaryCtx.user) {
                    try { await secondaryCtx.user.delete(); } catch (_) {}
                }
                await closeSecondaryAuthAccount(secondaryCtx);
                failures.push(`${uId}: ${err?.message || err}`);
            }
        }

        if (failures.length === 0) {
            await db.ref('data/system').update({
                authMigrationComplete: true,
                authMigrationCompletedAt: Date.now(),
                authMigrationCompletedBy: `${sessionUser.vorname} ${sessionUser.nachname}`
            });
            await syncServerPermissionsForAllUsers();
            if (statusEl) statusEl.innerHTML = `✅ Migration abgeschlossen: ${cleaned} Konten geprüft, ${migrated} Firebase-Zugänge neu angelegt. ${transitionAccounts} Konto/Konten ändern ihr Passwort selbst beim nächsten Login.`;
            alert('✅ Firebase-Authentication-Migration vollständig abgeschlossen.\n\nAlle Konten sind jetzt technisch umgestellt. Mitarbeiter mit Übergangslogin verwenden beim ersten Login ihr bisheriges Passwort und müssen anschließend sofort ein neues Passwort festlegen.\n\nEs müssen keine Passwörter verteilt werden.\n\nJetzt können die FINALEN Realtime-Database-Regeln veröffentlicht werden.');
        } else {
            await db.ref('data/system/authMigrationComplete').set(false);
            if (statusEl) statusEl.innerHTML = `⚠️ Migration nicht vollständig. ${failures.length} Konto/Konten benötigen manuelle Prüfung.`;
            alert('⚠️ Die Migration konnte nicht für alle Konten abgeschlossen werden:\n\n' + failures.join('\n') + '\n\nBitte die finalen Regeln noch NICHT veröffentlichen.');
        }
    } catch (err) {
        console.error('Firebase-Auth-Migration fehlgeschlagen:', err);
        alert('Migration fehlgeschlagen: ' + (err?.message || err));
    } finally {
        if (btn) btn.disabled = false;
        refreshFirebaseAuthMigrationPanel();
    }
}

async function approveUser(uId) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.canManageInstructors && !eff.isAdmin && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zum Freischalten von Mitarbeitern!');
        return;
    }
    if (!requireTargetUserManagement(uId)) return;
    try {
        await db.ref('data/users/'+uId+'/status').set('approved');
        await refreshUsersFromFirebase();
        logAdminAudit('Mitarbeiter freigeschaltet', `Account ${uId} aktiviert von ${sessionUser.vorname} ${sessionUser.nachname}`);
        alert('✅ Mitarbeiter wurde erfolgreich freigeschaltet.');
    } catch (err) {
        console.error('Freischaltung fehlgeschlagen:', err);
        alert('Freischaltung fehlgeschlagen: ' + (err?.message || err));
    }
}
async function revokeUser(uId) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.canManageInstructors && !eff.isAdmin && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zum Sperren von Mitarbeitern!');
        return;
    }
    if (!requireTargetUserManagement(uId)) return;
    if (!confirm('Mitarbeiter wirklich sperren? Der Account bleibt bestehen, kann sich aber nicht mehr einloggen.')) return;
    try {
        await db.ref('data/users/'+uId+'/status').set('revoked');
        await refreshUsersFromFirebase();
        logAdminAudit('Mitarbeiter gesperrt', `Account ${uId} gesperrt von ${sessionUser.vorname} ${sessionUser.nachname}`);
        alert('✅ Mitarbeiter wurde gesperrt.');
    } catch (err) {
        console.error('Sperren fehlgeschlagen:', err);
        alert('Sperren fehlgeschlagen: ' + (err?.message || err));
    }
}
function deleteUserAccount(uId) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delUsers) return;
    if (!requireTargetUserManagement(uId)) return;
    const target = cachedUsers[uId] || {};
    if (confirm('ACHTUNG: Mitarbeiter endgültig aus der Datenbank löschen? Dadurch wird er sofort aus der Mitarbeiter-Kartei entfernt und sein Firebase-Zugang verliert den Datenbankzugriff.')) {
        const updates = {};
        updates[`data/users/${uId}`] = null;
        updates[`data/employeePhotos/${uId}`] = null;
        if (target.authUid) updates[`data/authIndex/${target.authUid}`] = null;
        const targetLoginKey = target.loginKey || generateUserId(target.vorname, target.nachname) || uId;
        if (target.authVersion || targetLoginKey) {
            updates[`data/loginDirectory/${targetLoginKey}`] = {
                version: Number(target.authVersion) || 1,
                accountId: uId,
                deleted: true,
                deletedAt: Date.now()
            };
        }
        db.ref().update(updates).then(() => {
            logAdminAudit('Mitarbeiter gelöscht', `Account ${uId} wurde von ${sessionUser.vorname} ${sessionUser.nachname} aus der MD-Datenbank entfernt und sein Datenbankzugriff widerrufen.`);
        }).catch(err => {
            alert('Fehler beim Löschen des Mitarbeiters: ' + (err?.message || err));
        });
    }
}

function openUserPermissionsModal(uId) {
    if (!requireAdminAccess()) return;
    if (!requireTargetUserManagement(uId)) return;
    const u = cachedUsers[uId]; if (!u) return;
    document.getElementById('permUserId').value = uId;
    document.getElementById('permVorname').value = u.vorname || '';
    document.getElementById('permNachname').value = u.nachname || '';
    document.getElementById('permDN').value = u.dn || '';
    document.getElementById('permPassword').value = '';
    const passwordResetContainer = document.getElementById('permPasswordResetContainer');
    if (passwordResetContainer) {
        const eff = getUserEffectivePermissions(sessionUser);
        passwordResetContainer.style.display = eff.isMasterAdmin ? 'block' : 'none';
    }
    document.getElementById('permStatus').value = u.status || 'approved';
    document.getElementById('userPermissionsModal').style.display = 'flex';
}
function closeUserPermissionsModal() { document.getElementById('userPermissionsModal').style.display = 'none'; }

async function migrateLegacyNewsReadKeyForUser(uId, oldDn, newProfile) {
    if (!uId || !oldDn || String(oldDn).trim() === '') return;
    const legacyKey = 'dn_' + String(oldDn).trim();
    if (legacyKey === uId) return;
    try {
        const newsSnap = await db.ref('data/news').once('value');
        const news = newsSnap.val() || {};
        const updates = {};
        Object.entries(news).forEach(([newsId, item]) => {
            const oldReceipt = item?.readBy?.[legacyKey];
            if (!oldReceipt) return;
            if (!item?.readBy?.[uId]) {
                updates[`data/news/${newsId}/readBy/${uId}`] = Object.assign({}, oldReceipt, {
                    name: `${newProfile?.vorname || ''} ${newProfile?.nachname || ''}`.trim() || oldReceipt.name || '--',
                    dn: newProfile?.dn || oldReceipt.dn || '--'
                });
            }
            updates[`data/news/${newsId}/readBy/${legacyKey}`] = null;
        });
        if (Object.keys(updates).length) await db.ref().update(updates);
    } catch (err) {
        console.warn('Alte News-Lesebestätigungen konnten nicht vollständig auf die feste Account-ID umgestellt werden:', err);
    }
}

async function saveUserPermissions() {
    if (!requireAdminAccess()) return;
    const uId = document.getElementById('permUserId')?.value;
    if (!uId) return;
    if (!requireTargetUserManagement(uId)) return;

    const newPass = document.getElementById('permPassword')?.value.trim();
    if (newPass && newPass.length < 6) {
        alert('Das neue Passwort muss mindestens 6 Zeichen lang sein!');
        return;
    }

    const original = cachedUsers[uId] || {};
    const vorname = document.getElementById('permVorname')?.value.trim() || '';
    const nachname = document.getElementById('permNachname')?.value.trim() || '';
    const dn = document.getElementById('permDN')?.value.trim() || '';
    const status = document.getElementById('permStatus')?.value || 'approved';

    if (!vorname || !nachname) {
        alert('Vorname und Nachname dürfen nicht leer sein!');
        return;
    }
    if (!dn) {
        alert('Bitte eine Dienstnummer eintragen!');
        return;
    }

    const oldLoginKey = original.loginKey || generateUserId(original.vorname, original.nachname) || uId;
    const newLoginKey = generateUserId(vorname, nachname);
    if (!newLoginKey) {
        alert('Aus dem neuen Vor- und Nachnamen konnte kein gültiger Loginname erstellt werden.');
        return;
    }

    try {
        if (newLoginKey !== oldLoginKey) {
            const conflictingUser = Object.entries(cachedUsers).find(([otherId, otherUser]) =>
                otherId !== uId && generateUserId(otherUser?.vorname, otherUser?.nachname) === newLoginKey
            );
            if (conflictingUser) {
                alert('Dieser Vor- und Nachname wird bereits von einem anderen Mitarbeiter als Login verwendet.');
                return;
            }

            const existingDirectory = await readLoginDirectory(newLoginKey);
            if (existingDirectory.exists && !existingDirectory.deleted && existingDirectory.accountId !== uId) {
                alert('Dieser Vor- und Nachname wird bereits von einem anderen Mitarbeiter als Login verwendet.');
                return;
            }
        }

        if (newPass) {
            const eff = getUserEffectivePermissions(sessionUser);
            if (!eff.isMasterAdmin) {
                alert('Nur der Master-Admin darf das Login-Passwort anderer Mitarbeiter zurücksetzen.');
                return;
            }
            const resetOk = await resetFirebaseAuthForUser(uId, newPass);
            if (!resetOk) return;
        }

        const freshTarget = cachedUsers[uId] || original;
        // Vor Abschluss der einmaligen Auth-Migration darf der Alias Version 0 tragen.
        // Nach erfolgter Migration ist authVersion >= 1 und die finalen Rules verlangen genau das.
        const version = Math.max(0, Number(freshTarget.authVersion || original.authVersion) || 0);
        const updates = {};
        updates[`data/users/${uId}/accountId`] = uId;
        updates[`data/users/${uId}/loginKey`] = newLoginKey;
        updates[`data/users/${uId}/vorname`] = vorname;
        updates[`data/users/${uId}/nachname`] = nachname;
        updates[`data/users/${uId}/dn`] = dn;
        updates[`data/users/${uId}/status`] = status;
        updates[`data/loginDirectory/${newLoginKey}`] = { version, accountId: uId };
        if (oldLoginKey && oldLoginKey !== newLoginKey) updates[`data/loginDirectory/${oldLoginKey}`] = null;

        await db.ref().update(updates);
        if ((original.dn || '') !== dn && original.dn) {
            await migrateLegacyNewsReadKeyForUser(uId, original.dn, { vorname, nachname, dn });
        }
        closeUserPermissionsModal();

        const changes = [];
        if ((original.vorname || '') !== vorname) changes.push(`Vorname: ${original.vorname || '--'} → ${vorname}`);
        if ((original.nachname || '') !== nachname) changes.push(`Nachname: ${original.nachname || '--'} → ${nachname}`);
        if ((original.dn || '') !== dn) changes.push(`Dienstnummer: ${original.dn || '--'} → ${dn}`);
        if ((original.status || 'approved') !== status) changes.push(`Status: ${original.status || 'approved'} → ${status}`);
        if (newPass) changes.push('Login-Passwort zurückgesetzt');
        logAdminAudit('Mitarbeiterdaten bearbeitet', `${vorname} ${nachname} (${uId}) angepasst von ${sessionUser.vorname} ${sessionUser.nachname}${changes.length ? ': ' + changes.join(' | ') : ''}`);
        alert(newPass ? '✅ Mitarbeiterdaten, Loginname und Firebase-Zugang erfolgreich aktualisiert!' : '✅ Mitarbeiterdaten und Loginname erfolgreich gespeichert!');
    } catch (err) {
        alert('Fehler beim Speichern: ' + (err?.message || err));
    }
}


let activeRoleAssignmentRestricted = false;

function isRoleAssignableByTrainingLead(roleDef) {
    if (!roleDef || roleDef.isAdmin || roleDef.isMasterAdmin || roleDef.id === 'admin' || roleDef.id === 'masteradmin') return false;
    const allowed = new Set(['isInstructor', 'canManageInstructors', 'canManageExams', 'delExams', 'canCreateCalendar', 'canPostNews', 'canApproveNews', 'canViewNewsRead']);
    return SERVER_PERMISSION_KEYS.every(key => !roleDef[key] || allowed.has(key));
}

function openAssignRolesModal(uId, name, isRestrictedByLeitung = false) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    const target = cachedUsers[uId];
    if (target && isPrivilegedUser(target) && !eff.isMasterAdmin) {
        alert('Privilegierte Admin-Konten dürfen nur von einem Master-Admin verändert werden!');
        return;
    }
    const isMasterOperator = !!eff.isMasterAdmin;
    const canAdminManage = !!(eff.isAdmin || eff.isMasterAdmin);
    const canLeitungManage = !!eff.canManageInstructors;
    if (!canAdminManage && !canLeitungManage) {
        alert('Keine Berechtigung zur Rollenvergabe!');
        return;
    }

    activeRoleAssignmentRestricted = !canAdminManage || !!isRestrictedByLeitung;
    const m = document.getElementById('assignRolesModal'); if (!m) return;
    document.getElementById('assignRoleUserId').value = uId;
    const u = cachedUsers[uId] || {};
    const displayName = name || `${u.vorname || ''} ${u.nachname || ''}`.trim() || uId;
    document.getElementById('assignRoleUserName').textContent = displayName;
    const rids = getUserRolesList(u);

    const rolesToShow = Object.values(cachedRoles).filter(r => {
        if ((r.id === 'masteradmin' || r.id === 'admin' || r.isAdmin || r.isMasterAdmin) && !isMasterOperator) return false;
        if (activeRoleAssignmentRestricted && (r.isAdmin || r.isMasterAdmin || r.id === 'admin' || r.id === 'masteradmin')) return false;
        if (!canAdminManage && canLeitungManage && !isRoleAssignableByTrainingLead(r)) return false;
        return true;
    }).sort((a,b) => (a.name||'').localeCompare(b.name||'', 'de'));

    const myId = getUserAccountId(sessionUser);
    const isSelfMasterAdmin = (uId === myId) && (rids.includes('masteradmin') || sessionUser.isMasterAdmin);

    document.getElementById('assignRolesContainer').innerHTML = rolesToShow.map(r => {
        const isSelfMasterProtection = isSelfMasterAdmin && (r.id === 'masteradmin');
        const isChecked = rids.includes(r.id);
        return `
            <label for="assignRoleInput_${r.id}" style="display:flex;align-items:center;gap:10px;padding:8px;cursor:pointer;background:rgba(30,41,59,0.3);border-radius:8px;">
                <input type="checkbox" ${isChecked ? 'checked' : ''} ${isSelfMasterProtection ? 'disabled checked title="Selbstausschluss-Schutz: Du kannst dir als Master-Admin deine eigene Rolle nicht entziehen."' : ''} id="assignRoleInput_${r.id}">
                <b style="color:${sanitizeRoleColor(r.color)};">${r.icon ? escapeHtml(r.icon) : ''} ${escapeHtml(r.name)}</b>
                ${isSelfMasterProtection ? '<span style="font-size:11px;color:var(--warning);margin-left:auto;">🔒 Geschützt</span>' : ''}
            </label>
        `;
    }).join('');

    m.style.display = 'flex';
}
function closeAssignRolesModal() { document.getElementById('assignRolesModal').style.display = 'none'; }

function saveAssignedRoles() {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    const isMasterOperator = !!eff.isMasterAdmin;
    const canAdminManage = !!(eff.isAdmin || eff.isMasterAdmin);
    const canLeitungManage = !!eff.canManageInstructors;
    if (!canAdminManage && !canLeitungManage) {
        alert('Keine Berechtigung zur Rollenvergabe!');
        return;
    }

    const uId = document.getElementById('assignRoleUserId')?.value; if (!uId) return;
    const target = cachedUsers[uId];
    if (target && isPrivilegedUser(target) && !isMasterOperator) {
        alert('Privilegierte Admin-Konten dürfen nur von einem Master-Admin verändert werden!');
        return;
    }
    let cleanRoles = {};
    const existingUser = cachedUsers[uId] || {};
    const existingRoleList = getUserRolesList(existingUser);

    Object.keys(cachedRoles).forEach(rId => {
        const roleDef = cachedRoles[rId] || defaultRoles[rId] || {};
        const isPrivilegedRole = rId === 'admin' || rId === 'masteradmin' || roleDef.isAdmin || roleDef.isMasterAdmin;
        if (isPrivilegedRole && !isMasterOperator) {
            if (existingRoleList.includes(rId)) cleanRoles[rId] = true;
            return;
        }
        if (!canAdminManage && canLeitungManage && !isRoleAssignableByTrainingLead(roleDef)) {
            if (existingRoleList.includes(rId)) cleanRoles[rId] = true;
            return;
        }

        const el = document.getElementById('assignRoleInput_' + rId);
        if (el) {
            if (el.checked) cleanRoles[rId] = true;
        } else if (existingRoleList.includes(rId)) {
            cleanRoles[rId] = true;
        }
    });

    const myId = getUserAccountId(sessionUser);
    if (uId === myId && eff.isMasterAdmin) cleanRoles.masteradmin = true;
    if (Object.keys(cleanRoles).length === 0) cleanRoles = { mitarbeiter: true };

    const assignedRoleDefs = Object.keys(cleanRoles).map(rId => cachedRoles[rId] || defaultRoles[rId] || {});
    const updates = {
        roles: cleanRoles,
        isAdmin: assignedRoleDefs.some(r => r.isAdmin || r.isMasterAdmin),
        isMasterAdmin: assignedRoleDefs.some(r => r.isMasterAdmin),
        isInstructor: null,
        canManageInstructors: null,
        canManageExams: null
    };
    updates.serverPermissions = buildServerPermissions(Object.assign({}, existingUser, updates));

    db.ref('data/users/' + uId + '/roles').set(cleanRoles).then(() => {
        return db.ref('data/users/' + uId).update(updates);
    }).then(() => {
        if (cachedUsers[uId]) {
            cachedUsers[uId].roles = cleanRoles;
            cachedUsers[uId].isAdmin = updates.isAdmin;
            cachedUsers[uId].isMasterAdmin = updates.isMasterAdmin;
            cachedUsers[uId].serverPermissions = updates.serverPermissions;
            delete cachedUsers[uId].isInstructor;
            delete cachedUsers[uId].canManageInstructors;
            delete cachedUsers[uId].canManageExams;
        }
        if (sessionUser && getUserAccountId(sessionUser) === uId) {
            sessionUser = Object.assign({}, sessionUser, updates, { roles: cleanRoles });
            applyUserPermissions(sessionUser);
        }
        closeAssignRolesModal();
        renderAdminUserTable(cachedUsers);
        renderStaffDirectory();
        renderExamTab();
        logAdminAudit('Rollen angepasst & bereinigt', `Rollen für ${uId} von ${sessionUser.vorname} ${sessionUser.nachname} gespeichert.`);
        alert('✅ Rollen erfolgreich und dauerhaft aktualisiert!');
    }).catch(err => alert('Fehler beim Speichern der Rollen: ' + (err?.message || err)));
}

function renderAdminRolesList() {
    const sb = document.getElementById('adminRolesSidebarList'); if (!sb) return;
    if (!sessionUser || !requireAdminAccess()) { sb.innerHTML = ''; return; }
    const sortedRoles = Object.values(cachedRoles).sort((a,b) => (a.name||'').localeCompare(b.name||'', 'de'));
    sb.innerHTML = sortedRoles.map(r => {
        const color = sanitizeRoleColor(r.color);
        return `
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;border:1px solid ${color}33;background:${color}0d;cursor:pointer;" onclick="selectRole(${escapeJsArg(r.id)})">
            <span>${escapeHtml(r.icon || '🎭')}</span>
            <b style="color:${color};font-size:14px;">${escapeHtml(r.name)}</b>
        </div>`;
    }).join('');
}

function renderRoleCategoryCheckboxes(containerId, allItems, selectedList = []) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    const kats = [...new Set(Object.values(allItems).map(i => i.kat || i.thema || 'Allgemein'))].sort((a,b) => a.localeCompare(b, 'de'));
    const safeSelected = normalizeKats(selectedList);

    if (!kats.length) {
        cont.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">Keine Kategorien vorhanden.</span>';
        return;
    }
    cont.innerHTML = kats.map((k, idx) => `
        <label for="${containerId}_item_${idx}" style="display:inline-flex;align-items:center;gap:6px;background:rgba(30,41,59,0.5);padding:4px 10px;border-radius:6px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="${containerId}_item_${idx}" class="cat-checkbox-item ${containerId}_check" value="${escapeHtml(k)}" ${safeSelected.includes(k) ? 'checked' : ''}>
            <span>${escapeHtml(k)}</span>
        </label>
    `).join('');
}

function refreshOpenRoleCategoryCheckboxes() {
    const curRoleId = document.getElementById('editingRoleId')?.value;
    if (!curRoleId) return;
    const r = cachedRoles[curRoleId] || {};

    db.ref('data/dienstCommands').once('value', sCmd => {
        const allCmds = Object.assign({}, defaultCommands, sCmd.val() || {});
        renderRoleCategoryCheckboxes('roleCommandsCategoriesContainer', allCmds, r.allowedCmdKats || []);
    });

    db.ref('data/dienstLinks').once('value', sLnk => {
        const allLnks = Object.assign({}, defaultLinks, sLnk.val() || {});
        renderRoleCategoryCheckboxes('roleLinksCategoriesContainer', allLnks, r.allowedLinkKats || []);
    });
}

function selectRole(roleId) {
    if (!requireAdminAccess()) return;
    const r = cachedRoles[roleId] || defaultRoles[roleId]; 
    if (!r) return;
    const operatorEff = getUserEffectivePermissions(sessionUser);
    if ((r.isAdmin || r.isMasterAdmin || roleId === 'admin' || roleId === 'masteradmin') && !operatorEff.isMasterAdmin) {
        alert('Rollen mit Admin- oder Master-Admin-Rechten dürfen nur von einem Master-Admin verändert werden!');
        return;
    }
    
    document.getElementById('editingRoleId').value = roleId;
    document.getElementById('roleEditName').value = r.name || '';
    document.getElementById('roleEditColor').value = sanitizeRoleColor(r.color);
    document.getElementById('roleEditIcon').value = r.icon || '🎭';

    const tEl = document.getElementById('editingRoleTitle');
    if (tEl) {
        tEl.innerHTML = `<span id="editingRoleBadgePreview" style="padding:4px 10px; border-radius:6px;">${escapeHtml(r.icon || '🎭')} ${escapeHtml(r.name || 'Rolle')}</span>`;
    }

    const isMaster = (roleId === 'masteradmin');
    const privilegeAdminEl = document.getElementById('roleFlagAdmin');
    const privilegeMasterEl = document.getElementById('roleFlagMasterAdmin');
    if (privilegeAdminEl) privilegeAdminEl.disabled = !operatorEff.isMasterAdmin;
    if (privilegeMasterEl) privilegeMasterEl.disabled = !operatorEff.isMasterAdmin;

    Object.keys(ROLE_PROPERTY_MAP).forEach(elementId => {
        const propName = ROLE_PROPERTY_MAP[elementId];
        const chk = document.getElementById(elementId);
        if (chk) {
            if (isMaster) {
                chk.checked = true;
            } else {
                chk.checked = !!r[propName];
            }
        }
    });

    const btnDel = document.getElementById('btnDeleteRole');
    const protectedRoles = ['masteradmin', 'mitarbeiter', 'ausbilder', 'ausbildungsleitung'];
    if (btnDel) {
        if (protectedRoles.includes(roleId) || r.isSystem) {
            btnDel.style.display = 'none';
        } else {
            btnDel.style.display = 'inline-block';
        }
    }

    db.ref('data/dienstCommands').once('value', sCmd => {
        const allCmds = Object.assign({}, defaultCommands, sCmd.val() || {});
        let allCmdKats = isMaster ? Object.values(allCmds).map(c => c.kat || 'Allgemein') : (r.allowedCmdKats || []);
        renderRoleCategoryCheckboxes('roleCommandsCategoriesContainer', allCmds, allCmdKats);
    });

    db.ref('data/dienstLinks').once('value', sLnk => {
        const allLnks = Object.assign({}, defaultLinks, sLnk.val() || {});
        let allLinkKats = isMaster ? Object.values(allLnks).map(l => l.kat || l.thema || 'Allgemein') : (r.allowedLinkKats || []);
        renderRoleCategoryCheckboxes('roleLinksCategoriesContainer', allLnks, allLinkKats);
    });

    updateRoleBadgePreview();
}

function updateRoleBadgePreview() {
    const n = document.getElementById('roleEditName')?.value || 'Rolle';
    const c = sanitizeRoleColor(document.getElementById('roleEditColor')?.value);
    const i = document.getElementById('roleEditIcon')?.value || '🎭';
    const p = document.getElementById('editingRoleBadgePreview'); if (!p) return;
    p.textContent = `${i} ${n}`.trim();
    p.style.color = c; p.style.background = c + '22'; p.style.border = `1px solid ${c}44`;
}

function neueRolleErstellen() {
    if (!requireAdminAccess()) return;
    const newId = 'role_' + Date.now();
    document.getElementById('editingRoleId').value = newId;
    document.getElementById('roleEditName').value = '';
    document.getElementById('roleEditColor').value = '#38bdf8';
    document.getElementById('roleEditIcon').value = '🎭';
    
    const tEl = document.getElementById('editingRoleTitle');
    if (tEl) {
        tEl.innerHTML = `<span id="editingRoleBadgePreview" style="padding:4px 10px; border-radius:6px;">🎭 Neue Rolle</span>`;
    }

    const btnDel = document.getElementById('btnDeleteRole');
    if (btnDel) btnDel.style.display = 'none';
    
    document.querySelectorAll('#adminRoleEditorCard input[type="checkbox"]').forEach(c => c.checked = false);
    const operatorEff = getUserEffectivePermissions(sessionUser);
    const privilegeAdminEl = document.getElementById('roleFlagAdmin');
    const privilegeMasterEl = document.getElementById('roleFlagMasterAdmin');
    if (privilegeAdminEl) privilegeAdminEl.disabled = !operatorEff.isMasterAdmin;
    if (privilegeMasterEl) privilegeMasterEl.disabled = !operatorEff.isMasterAdmin;

    db.ref('data/dienstCommands').once('value', sCmd => {
        const allCmds = Object.assign({}, defaultCommands, sCmd.val() || {});
        renderRoleCategoryCheckboxes('roleCommandsCategoriesContainer', allCmds, []);
    });

    db.ref('data/dienstLinks').once('value', sLnk => {
        const allLnks = Object.assign({}, defaultLinks, sLnk.val() || {});
        renderRoleCategoryCheckboxes('roleLinksCategoriesContainer', allLnks, []);
    });

    updateRoleBadgePreview();
}

function speichereRolle() {
    if (!requireAdminAccess()) return;
    const id = document.getElementById('editingRoleId')?.value; 
    if (!id) {
        alert('Bitte wähle zuerst eine Rolle aus oder erstelle eine neue Rolle!');
        return;
    }
    const operatorEff = getUserEffectivePermissions(sessionUser);
    const existingRole = cachedRoles[id] || defaultRoles[id];
    if ((id === 'masteradmin' || id === 'admin' || existingRole?.isAdmin || existingRole?.isMasterAdmin) && !operatorEff.isMasterAdmin) {
        alert('Rollen mit Admin- oder Master-Admin-Rechten dürfen nur von einem Master-Admin verändert werden!');
        return;
    }

    const isMaster = (id === 'masteradmin');

    const allowedCmds = [];
    document.querySelectorAll('.roleCommandsCategoriesContainer_check:checked').forEach(c => allowedCmds.push(c.value));

    const allowedLnks = [];
    document.querySelectorAll('.roleLinksCategoriesContainer_check:checked').forEach(c => allowedLnks.push(c.value));

    const r = {
        id,
        name: document.getElementById('roleEditName')?.value.trim() || id,
        color: sanitizeRoleColor(document.getElementById('roleEditColor')?.value),
        icon: document.getElementById('roleEditIcon')?.value.trim() || '🎭',
        isSystem: !!(existingRole && existingRole.isSystem),
        allowedCmdKats: isMaster ? [] : allowedCmds,
        allowedLinkKats: isMaster ? [] : allowedLnks
    };

    Object.keys(ROLE_PROPERTY_MAP).forEach(elementId => {
        const propName = ROLE_PROPERTY_MAP[elementId];
        const el = document.getElementById(elementId);
        r[propName] = isMaster ? true : !!(el && el.checked);
    });

    if (!operatorEff.isMasterAdmin) {
        r.isAdmin = false;
        r.isMasterAdmin = false;
        r.delUsers = false;
    }

    db.ref('data/roles/' + id).set(r).then(async () => {
        cachedRoles[id] = r;
        await syncServerPermissionsForAllUsers();
        renderAdminRolesList();
        logAdminAudit('Rolle gespeichert', `${sessionUser.vorname} ${sessionUser.nachname} hat Rolle "${r.name}" gespeichert.`);
        alert(`✅ Rolle "${r.name}" erfolgreich gespeichert!`);
    }).catch(err => {
        alert('Fehler beim Speichern der Rolle: ' + err.message);
    });
}

async function loescheRolle() {
    if (!requireAdminAccess()) return;
    const id = document.getElementById('editingRoleId')?.value;
    if (!id) { alert('Keine Rolle ausgewählt!'); return; }

    const role = cachedRoles[id] || defaultRoles[id];
    const operatorEff = getUserEffectivePermissions(sessionUser);
    if ((role?.isAdmin || role?.isMasterAdmin || id === 'admin' || id === 'masteradmin') && !operatorEff.isMasterAdmin) {
        alert('Rollen mit Admin- oder Master-Admin-Rechten dürfen nur von einem Master-Admin gelöscht werden!');
        return;
    }
    const protectedSystemRoles = ['masteradmin', 'mitarbeiter', 'ausbilder', 'ausbildungsleitung'];
    if (protectedSystemRoles.includes(id) || role?.isSystem) {
        alert(`⛔ Die Standard-Systemrolle "${role?.name || id}" kann nicht gelöscht werden!`);
        return;
    }

    if (!confirm(`Möchtest du die Rolle "${role?.name || id}" wirklich dauerhaft löschen?\n\nHinweis: Sie wird auch automatisch bei allen Mitarbeitern entfernt.`)) return;

    try {
        await db.ref('data/roles/' + id).remove();
        delete cachedRoles[id];

        const snap = await db.ref('data/users').once('value');
        const users = snap.val() || {};
        const updates = {};
        Object.entries(users).forEach(([uId, user]) => {
            if (user?.roles && user.roles[id]) {
                const newRoles = Object.assign({}, user.roles);
                delete newRoles[id];
                if (Object.keys(newRoles).length === 0) newRoles.mitarbeiter = true;
                const updatedUser = Object.assign({}, user, { roles: newRoles });
                updates[`data/users/${uId}/roles`] = newRoles;
                updates[`data/users/${uId}/serverPermissions`] = buildServerPermissions(updatedUser);
            }
        });
        if (Object.keys(updates).length) await db.ref().update(updates);

        renderAdminRolesList();
        neueRolleErstellen();
        logAdminAudit('Rolle gelöscht', `${sessionUser.vorname} ${sessionUser.nachname} hat die Rolle "${role?.name || id}" gelöscht.`);
        alert('✅ Rolle erfolgreich gelöscht!');
    } catch (err) {
        alert('Fehler beim Löschen der Rolle: ' + (err?.message || err));
    }
}

function stripCredentialsFromBackupUser(user) {
    if (!user || typeof user !== 'object') return user;
    const clean = Object.assign({}, user);
    ['pass','passwordHash','passwordSalt','passwordAlgo','passwordIterations','passwordVersion','passwordUpdatedAt'].forEach(k => delete clean[k]);
    return clean;
}

function downloadSystemBackup() {
    if (!requireMasterAdminAccess('Backups dürfen nur von Master-Admins heruntergeladen werden!')) return;
    db.ref('data').once('value', s => {
        const data = s.val() || {};
        if (data.users) {
            data.users = Object.fromEntries(Object.entries(data.users).map(([uId, user]) => [uId, stripCredentialsFromBackupUser(user)]));
        }
        const backup = {
            meta: {
                app: 'MMD Cloud',
                version: '6.3.0',
                createdAt: Date.now(),
                note: 'Passwörter und alte Passwort-Hashes werden aus Sicherheitsgründen nicht exportiert.'
            },
            data
        };
        const json = JSON.stringify(backup, null, 2);
        const b = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(b);
        const el = document.createElement('a');
        el.href = url;
        el.download = 'MMD_Backup_' + new Date().toLocaleDateString('sv-SE') + '.json';
        el.click();
        URL.revokeObjectURL(url);
    });
}

function restoreSystemBackupFromFile(event) {
    if (!requireMasterAdminAccess('Backups dürfen nur von Master-Admins eingespielt werden!')) {
        if (event?.target) event.target.value = '';
        return;
    }
    const file = event.target.files && event.target.files[0]; if (!file) return;
    const reader = new FileReader();

    reader.onload = async e => {
        try {
            const parsed = JSON.parse(e.target.result);
            const restoreDataRaw = parsed.data ? parsed.data : parsed;
            if (!restoreDataRaw || typeof restoreDataRaw !== 'object' || Array.isArray(restoreDataRaw)) {
                throw new Error('Ungültiges Backup-Format.');
            }
            if (!confirm('Das Backup ersetzt die Fachdaten. Aktuelle Firebase-Anmeldungen und Sicherheitszuordnungen bleiben geschützt erhalten. Wirklich fortfahren?')) return;

            const currentSnap = await db.ref('data').once('value');
            const current = currentSnap.val() || {};
            const restoreData = JSON.parse(JSON.stringify(restoreDataRaw));

            // Authentifizierungs-Zuordnungen niemals aus einem alten Backup zurückrollen.
            restoreData.authIndex = current.authIndex || {};
            restoreData.loginDirectory = current.loginDirectory || {};

            const currentSystem = current.system || {};
            restoreData.system = Object.assign({}, restoreData.system || {}, {
                authMigrationComplete: currentSystem.authMigrationComplete === true,
                authMigrationCompletedAt: currentSystem.authMigrationCompletedAt || null,
                authMigrationCompletedBy: currentSystem.authMigrationCompletedBy || null
            });

            const currentUsers = current.users || {};
            const incomingUsers = restoreData.users || {};
            const mergedUsers = {};

            Object.entries(incomingUsers).forEach(([uId, incomingUser]) => {
                const cleaned = stripCredentialsFromBackupUser(incomingUser);
                const currentUser = currentUsers[uId];
                if (currentUser?.authUid) {
                    cleaned.authUid = currentUser.authUid;
                    cleaned.authVersion = currentUser.authVersion || 1;
                } else {
                    delete cleaned.authUid;
                    delete cleaned.authVersion;
                    cleaned.status = 'pending';
                }
                mergedUsers[uId] = cleaned;
            });

            // Aktuell vorhandene Auth-Konten werden nicht durch ein älteres Backup gelöscht.
            Object.entries(currentUsers).forEach(([uId, currentUser]) => {
                if (!mergedUsers[uId]) mergedUsers[uId] = stripCredentialsFromBackupUser(currentUser);
            });

            const previousRoles = cachedRoles;
            cachedRoles = Object.assign({}, defaultRoles, restoreData.roles || {});
            Object.entries(mergedUsers).forEach(([uId, user]) => {
                user.serverPermissions = buildServerPermissions(user);
            });
            cachedRoles = previousRoles;

            restoreData.users = mergedUsers;
            await db.ref('data').set(restoreData);
            alert('✅ Backup wiederhergestellt. Firebase-Anmeldungen und Sicherheitszuordnungen wurden geschützt beibehalten.');
            location.reload();
        } catch(err) {
            alert('Fehler: ' + (err?.message || err));
        } finally {
            if (event?.target) event.target.value = '';
        }
    };
    reader.readAsText(file);
}

async function vollstaendigerReset() {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).isMasterAdmin) return;
    if (!confirm('ACHTUNG: Wirklich alle Fachdaten zurücksetzen?\n\nMitarbeiterkonten, Rollen und Firebase-Anmeldungen bleiben erhalten.')) return;
    if (!confirm('Patienten, Archive, Termine, Prüfungen, News, Feedback und weitere Fachdaten werden gelöscht. Fortfahren?')) return;

    try {
        const snap = await db.ref('data').once('value');
        const current = snap.val() || {};
        const system = current.system || {};
        const preserved = {
            users: current.users || {},
            roles: current.roles || {},
            authIndex: current.authIndex || {},
            loginDirectory: current.loginDirectory || {},
            employeePhotos: current.employeePhotos || {},
            system: {
                authMigrationComplete: system.authMigrationComplete === true,
                authMigrationCompletedAt: system.authMigrationCompletedAt || null,
                authMigrationCompletedBy: system.authMigrationCompletedBy || null
            }
        };
        await db.ref('data').set(preserved);
        alert('✅ Fachdaten wurden zurückgesetzt. Mitarbeiterkonten und Firebase-Anmeldungen sind erhalten geblieben.');
        location.reload();
    } catch (err) {
        alert('Reset fehlgeschlagen: ' + (err?.message || err));
    }
}

function renderAdminAuditLogs() {
    if (!requireAdminAccess('System-Protokoll')) return;
    db.ref('data/auditLogs').once('value', s => renderAdminAuditLogsData(s.val() || {}));
}

function renderAdminAuditLogsData(logsObj) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isAdmin && !eff.isMasterAdmin) return;
    const tbody = document.getElementById('adminAuditLogTableBody'); if (!tbody) return;
    const entries = Object.entries(logsObj).sort((a,b) => (b[1].ts||0) - (a[1].ts||0));
    tbody.innerHTML = !entries.length ? '<tr><td colspan="4" style="text-align:center;">Keine Protokolle für den heutigen Tag.</td></tr>'
        : entries.map(([, l]) => `<tr>
            <td style="font-size:12px;">⏰ ${l.ts ? new Date(l.ts).toLocaleTimeString('de-DE') : '-'}</td>
            <td><b>${escapeHtml(l.admin||'System')}</b></td>
            <td><span style="color:var(--primary);font-weight:700;">${escapeHtml(l.action||'-')}</span></td>
            <td>${escapeHtml(l.details||'-')}</td>
          </tr>`).join('');
}

function openAuditLogArchiveModal() {
    if (!requireAdminAccess('System-Protokoll-Archiv')) return;
    const modal = document.getElementById('auditArchiveModal');
    const cont = document.getElementById('auditArchiveContent');
    if (!modal || !cont) return;

    db.ref('data/auditLogsArchiv').once('value', s => {
        const raw = s.val() || {};
        const keys = Object.keys(raw);
        if (!keys.length) {
            cont.innerHTML = '<p style="color:var(--text-muted);text-align:center;">Noch keine archivierten Tage vorhanden.</p>';
        } else {
            cont.innerHTML = keys.sort().reverse().map(dateKey => {
                const logs = Object.values(raw[dateKey] || {});
                const displayDate = dateKey.replace(/-/g, '.');
                return `
                    <div class="theme-accordion-group" id="audit_${dateKey}" style="margin-bottom:10px;">
                        <div class="theme-accordion-header" onclick="toggleGroupCollapse('audit_${dateKey}')">
                            <span>📅 Tag: ${escapeHtml(displayDate)}</span>
                            <span>${logs.length} Einträge</span>
                        </div>
                        <div class="theme-accordion-content">
                            <div class="table-responsive" style="margin:0;border:none;">
                                <table>
                                    <thead><tr><th>Uhrzeit</th><th>Admin</th><th>Aktion</th><th>Details</th></tr></thead>
                                    <tbody>
                                        ${logs.map(l => `<tr><td>${l.ts ? new Date(l.ts).toLocaleTimeString('de-DE') : '--:--'}</td><td><b>${escapeHtml(l.admin || 'System')}</b></td><td>${escapeHtml(l.action || '--')}</td><td>${escapeHtml(l.details || '--')}</td></tr>`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        modal.style.display = 'flex';
    });
}
function closeAuditArchiveModal() { document.getElementById('auditArchiveModal').style.display = 'none'; }

/* ══════════════════════════════════════════════════════════════
   WÜNSCHE & BUGS: MELDESYSTEM, VERWALTUNG & INLINE-ABLEHNUNG
══════════════════════════════════════════════════════════════ */
function openFeedbackCenter() {
    if (!sessionUser) return;
    switchTab('feedbackTab', null);
    switchFeedbackCenterTab('feedbackSubmitPane', document.getElementById('feedbackSubmitTabBtn'));
}

function switchFeedbackCenterTab(tabId, btnEl) {
    if (tabId === 'feedbackManagePane' && !canCurrentUserManageFeedback()) {
        alert('Keine Berechtigung zum Bearbeiten von Wünsche- und Bug-Meldungen!');
        return;
    }
    document.querySelectorAll('#feedbackTab .admin-subtab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('#feedbackTab .feedback-center-tabs .admin-tab-btn').forEach(e => e.classList.remove('active'));
    const tab = document.getElementById(tabId);
    if (tab) tab.classList.add('active');
    if (btnEl) btnEl.classList.add('active');
    if (tabId === 'feedbackManagePane') renderFeedbackManagementTable();
}

function resetFeedbackSubmitForm() {
    const category = document.getElementById('fbCategory');
    const title = document.getElementById('fbTitle');
    const description = document.getElementById('fbDescription');
    if (category) category.value = 'Wunsch';
    if (title) title.value = '';
    if (description) description.value = '';
}

function getFeedbackList() {
    // Die Firebase-Node-ID ist die verbindliche technische ID. Dadurch bleiben auch
    // alte/unvollständige Datensätze ohne eigenes `id`-Feld sicher bearbeit- und löschbar.
    return Object.entries(cachedFeedback || {}).map(([fbId, item]) =>
        Object.assign({}, item || {}, { storedId: item?.id || '', id: fbId })
    );
}

function submitUserFeedback() {
    if (!sessionUser) return;
    const cat = document.getElementById('fbCategory')?.value || 'Wunsch';
    const title = document.getElementById('fbTitle')?.value.trim();
    const desc = document.getElementById('fbDescription')?.value.trim();

    if (!title || !desc) {
        alert('Bitte gib einen Titel und eine genaue Beschreibung ein!');
        return;
    }

    const myId = getUserAccountId(sessionUser);
    const feedbackId = 'fb_' + Date.now();

    const entry = {
        id: feedbackId,
        category: cat,
        title: title,
        description: desc,
        status: 'Neu',
        author: `${sessionUser.vorname} ${sessionUser.nachname}`,
        authorDN: sessionUser.dn || '--',
        authorId: myId,
        date: new Date().toLocaleDateString('de-DE'),
        ts: Date.now()
    };

    db.ref('data/feedback/' + feedbackId).set(entry).then(() => {
        resetFeedbackSubmitForm();
        alert('✅ Vielen Dank! Deine Meldung wurde sicher an die berechtigten Mitarbeiter übermittelt.');
    }).catch(err => {
        alert('Fehler beim Übermitteln: ' + err.message);
    });
}

function renderFeedbackRowsHtml(list, targetPrefix) {
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const canDelete = eff.isAdmin || eff.isMasterAdmin || eff.delFeedback || (sessionUser && sessionUser.isMasterAdmin);

    const badgeClassMap = {
        'Neu': 'badge-status-neu',
        'In Prüfung': 'badge-status-pruefung',
        'Angenommen': 'badge-status-angenommen',
        'In Umsetzung': 'badge-status-umsetzung',
        'Erledigt': 'badge-status-erledigt',
        'Abgelehnt': 'badge-status-abgelehnt'
    };

    return list.map(item => {
        const bClass = badgeClassMap[item.status] || 'badge-status-neu';
        let rejectNoteHtml = '';
        if (item.status === 'Abgelehnt' && item.rejectionReason) {
            rejectNoteHtml = `
                <div style="background:rgba(244,63,94,0.1);border-left:3px solid var(--danger);padding:6px 10px;border-radius:6px;margin-top:6px;font-size:12px;color:#fecdd3;">
                    <b>Begründung der Ablehnung:</b> ${escapeHtml(item.rejectionReason)}<br>
                    <span style="color:var(--text-muted);font-size:11px;">Entschieden von ${escapeHtml(item.rejectedBy || 'Leitung')} am ${escapeHtml(item.rejectedDate || '--')}</span>
                </div>
            `;
        }

        const inlineRejectBoxHtml = `
            <div id="${targetPrefix}_rejectBox_${item.id}" class="feedback-inline-reject-box" style="display:none;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <b style="color:var(--danger);font-size:12px;">❌ Ablehnung begründen:</b>
                    <button type="button" class="btn-close" style="width:24px;height:24px;font-size:12px;" onclick="closeInlineRejectBox('${targetPrefix}', '${item.id}')">✖</button>
                </div>
                <select id="${targetPrefix}_preset_${item.id}" onchange="applyInlinePreset('${targetPrefix}', '${item.id}', this.value)" style="font-size:12px;padding:4px 8px;">
                    <option value="">-- Schnellbegründung wählen (optional) --</option>
                    <option value="Für den aktuellen Arbeitsablauf nicht sinnvoll.">Für den aktuellen Arbeitsablauf nicht sinnvoll.</option>
                    <option value="Die gewünschte Funktion existiert bereits.">Die gewünschte Funktion existiert bereits.</option>
                    <option value="Technisch nicht sinnvoll umsetzbar.">Technisch nicht sinnvoll umsetzbar.</option>
                    <option value="Passt nicht zum Konzept der Homepage.">Passt nicht zum Konzept der Homepage.</option>
                    <option value="Zu hoher Aufwand im Verhältnis zum Nutzen.">Zu hoher Aufwand im Verhältnis zum Nutzen.</option>
                    <option value="Wird aktuell nicht benötigt.">Wird aktuell nicht benötigt.</option>
                </select>
                <textarea id="${targetPrefix}_reason_${item.id}" rows="2" placeholder="Verbindliche Begründung der Ablehnung..." style="font-size:13px;"></textarea>
                <div style="display:flex;gap:6px;justify-content:flex-end;">
                    <button type="button" class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:12px;background:var(--text-muted);" onclick="closeInlineRejectBox('${targetPrefix}', '${item.id}')">Abbrechen</button>
                    <button type="button" class="btn" style="width:auto;margin:0;padding:4px 14px;font-size:12px;background:var(--danger);color:#fff;font-weight:800;" onclick="saveInlineRejection('${targetPrefix}', '${item.id}')">Speichern & Ablehnen</button>
                </div>
            </div>
        `;

        return `
            <tr>
                <td style="font-size:13px;color:var(--text-muted);white-space:nowrap;">${escapeHtml(item.date || '--')}</td>
                <td><b>${escapeHtml(item.author || '--')}</b> <span style="color:var(--primary);font-size:12px;">(DN: ${escapeHtml(item.authorDN || '--')})</span></td>
                <td><span class="feedback-category-badge">${escapeHtml(item.category || 'Wunsch')}</span></td>
                <td>
                    <b>${escapeHtml(item.title || '--')}</b>
                    <div style="font-size:13px;color:var(--text-muted);margin-top:4px;white-space:pre-wrap;">${formatTextWithLinks(item.description || '')}</div>
                    ${rejectNoteHtml}
                    ${inlineRejectBoxHtml}
                </td>
                <td>
                    <span class="feedback-status-badge ${bClass}">${escapeHtml(item.status || 'Neu')}</span>
                </td>
                <td>
                    <select id="${targetPrefix}_selStatus_${item.id}" onchange="handleFeedbackStatusSelect('${targetPrefix}', '${item.id}', this.value)" style="padding:6px 8px;font-size:13px;width:auto;margin:0;">
                        <option value="Neu" ${item.status === 'Neu' ? 'selected' : ''}>Neu</option>
                        <option value="In Prüfung" ${item.status === 'In Prüfung' ? 'selected' : ''}>In Prüfung</option>
                        <option value="Angenommen" ${item.status === 'Angenommen' ? 'selected' : ''}>Angenommen</option>
                        <option value="In Umsetzung" ${item.status === 'In Umsetzung' ? 'selected' : ''}>In Umsetzung</option>
                        <option value="Erledigt" ${item.status === 'Erledigt' ? 'selected' : ''}>Erledigt</option>
                        <option value="Abgelehnt" ${item.status === 'Abgelehnt' ? 'selected' : ''}>❌ Ablehnen</option>
                    </select>
                </td>
                <td style="text-align:right;">
                    ${canDelete ? `<button type="button" class="btn-delete-row" onclick="deleteFeedbackEntry('${item.id}')" title="Meldung endgültig löschen">🗑️</button>` : '--'}
                </td>
            </tr>
        `;
    }).join('');
}

function renderFeedbackManagementTable() {
    const tbody = document.getElementById('feedbackManagementTableBody');
    if (!tbody) return;

    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isAdmin && !eff.isMasterAdmin && !eff.canManageFeedback) {
        tbody.innerHTML = '';
        return;
    }

    const q = (document.getElementById('searchFeedbackInput')?.value || '').trim().toLowerCase();
    const filterCat = document.getElementById('filterFeedbackCategory')?.value || 'all';
    const filterStatus = document.getElementById('filterFeedbackStatus')?.value || 'all';

    let list = getFeedbackList().sort((a, b) => (b.ts || 0) - (a.ts || 0));

    if (filterCat !== 'all') list = list.filter(item => item.category === filterCat);
    if (filterStatus !== 'all') list = list.filter(item => item.status === filterStatus);
    if (q) {
        list = list.filter(item => {
            const t = (item.title || '').toLowerCase();
            const d = (item.description || '').toLowerCase();
            const a = (item.author || '').toLowerCase();
            const dn = (item.authorDN || '').toLowerCase();
            return t.includes(q) || d.includes(q) || a.includes(q) || dn.includes(q);
        });
    }

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">Keine Wünsche oder Fehlermeldungen vorhanden.</td></tr>';
        return;
    }

    tbody.innerHTML = renderFeedbackRowsHtml(list, 'manageFb');
}

function handleFeedbackStatusSelect(prefix, fbId, newStatus) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isAdmin && !eff.isMasterAdmin && !eff.canManageFeedback) return;

    const rejectBox = document.getElementById(`${prefix}_rejectBox_${fbId}`);

    if (newStatus === 'Abgelehnt') {
        if (rejectBox) {
            rejectBox.style.display = 'flex';
            const reasonInput = document.getElementById(`${prefix}_reason_${fbId}`);
            if (reasonInput) reasonInput.focus();
        }
        return;
    }

    if (rejectBox) rejectBox.style.display = 'none';

    db.ref('data/feedback/' + fbId).update({
        status: newStatus,
        lastStatusUpdateBy: `${sessionUser.vorname} ${sessionUser.nachname}`,
        lastStatusUpdateTs: Date.now()
    }).then(() => {
        logAdminAudit('Feedback-Status geändert', `${sessionUser.vorname} ${sessionUser.nachname} setzte Meldung ${fbId} auf "${newStatus}".`);
    }).catch(err => {
        console.error('Feedback-Status konnte nicht gespeichert werden:', err);
        const sel = document.getElementById(`${prefix}_selStatus_${fbId}`);
        if (sel && cachedFeedback[fbId]) sel.value = cachedFeedback[fbId].status || 'Neu';
        alert('Der Status konnte nicht gespeichert werden: ' + (err?.message || err));
    });
}

function applyInlinePreset(prefix, fbId, val) {
    const reasonInp = document.getElementById(`${prefix}_reason_${fbId}`);
    if (reasonInp && val) {
        reasonInp.value = val;
    }
}

function closeInlineRejectBox(prefix, fbId) {
    const rejectBox = document.getElementById(`${prefix}_rejectBox_${fbId}`);
    if (rejectBox) rejectBox.style.display = 'none';
    const sel = document.getElementById(`${prefix}_selStatus_${fbId}`);
    if (sel && cachedFeedback[fbId]) {
        sel.value = cachedFeedback[fbId].status || 'Neu';
    }
}

function saveInlineRejection(prefix, fbId) {
    if (!fbId || !sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isAdmin && !eff.isMasterAdmin && !eff.canManageFeedback) {
        alert('Keine Berechtigung zum Ablehnen von Meldungen!');
        return;
    }
    const reasonInp = document.getElementById(`${prefix}_reason_${fbId}`);
    const reasonText = (reasonInp?.value || '').trim();

    if (!reasonText) {
        alert('⚠️ Begründungspflicht: Eine Ablehnung darf nicht ohne sachliche Erklärung gespeichert werden!');
        return;
    }

    const todayFormatted = new Date().toLocaleDateString('de-DE');

    db.ref('data/feedback/' + fbId).update({
        status: 'Abgelehnt',
        rejectionReason: reasonText,
        rejectedBy: `${sessionUser.vorname} ${sessionUser.nachname}`,
        rejectedDate: todayFormatted,
        rejectedTs: Date.now()
    }).then(() => {
        logAdminAudit('Meldung abgelehnt', `${sessionUser.vorname} ${sessionUser.nachname} lehnte Meldung ${fbId} ab. Begründung: ${reasonText}`);
        closeInlineRejectBox(prefix, fbId);
        alert('✅ Meldung wurde als abgelehnt markiert und die Begründung revisionssicher hinterlegt.');
    }).catch(err => {
        console.error('Ablehnung konnte nicht gespeichert werden:', err);
        alert('Die Ablehnung konnte nicht gespeichert werden: ' + (err?.message || err));
    });
}

function deleteFeedbackEntry(fbId) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    const canDelete = !!(sessionUser.isMasterAdmin || eff.isMasterAdmin || eff.isAdmin || eff.delFeedback);

    if (!canDelete) {
        alert('Keine Berechtigung zum Löschen von Meldungen!');
        return;
    }

    const item = cachedFeedback[fbId];
    const itemTitle = item ? (item.title || fbId) : fbId;

    if (confirm(`Möchtest du diese Meldung ("${itemTitle}") wirklich dauerhaft aus der Datenbank entfernen?`)) {
        db.ref('data/feedback/' + fbId).remove().then(() => {
            logAdminAudit('Feedback gelöscht', `Eintrag "${itemTitle}" (${fbId}) gelöscht durch ${sessionUser.vorname} ${sessionUser.nachname}`);
            alert('✅ Eintrag erfolgreich gelöscht!');
        }).catch(err => {
            alert('Fehler beim Löschen: ' + err.message);
        });
    }
}

function exportFeedbackListMarkdown() {
    if (!canCurrentUserManageFeedback()) { alert('Keine Berechtigung zum Exportieren der Meldungen!'); return; }
    const list = getFeedbackList().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    if (!list.length) {
        alert('Keine Einträge zum Exportieren vorhanden.');
        return;
    }

    let md = '# Aufgabenliste: Wünsche & Fehlermeldungen (MD-Homepage)\n\n';
    md += `Stand: ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')} Uhr\n\n`;
    md += '| ID | Datum | Kategorie | Titel & Beschreibung | Status | Einreicher | Begründung (bei Ablehnung) |\n';
    md += '|---|---|---|---|---|---|---|\n';

    list.forEach(item => {
        const cleanTitle = (item.title || '').replace(/\|/g, '-');
        const cleanDesc = (item.description || '').replace(/\r?\n|\r/g, ' ').replace(/\|/g, '-');
        const cleanReason = (item.rejectionReason || '--').replace(/\r?\n|\r/g, ' ').replace(/\|/g, '-');
        md += `| ${item.id} | ${item.date || '--'} | ${item.category || 'Wunsch'} | **${cleanTitle}**: ${cleanDesc} | ${item.status || 'Neu'} | ${item.author || '--'} (${item.authorDN || '--'}) | ${cleanReason} |\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wuensche_und_bugs_${new Date().toLocaleDateString('sv-SE')}.md`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ── Navigation & Global Helpers ───────────────────────────── */
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    const t = document.getElementById(tabId); if (t) t.classList.add('active');
    if (btn) btn.classList.add('active');
    if (tabId === 'calendarTab') renderCalendarMonth();
    if (tabId === 'staffTab') renderStaffDirectory();
    if (tabId === 'miscTab') renderGehaltTab(cachedGehaltData);
    if (tabId === 'examTab') renderExamTab();
    if (tabId === 'settingsTab' && sessionUser) {
        const eDatumEl = document.getElementById('einstellungsDatum');
        if (eDatumEl?.value) berechneDienstTage(false);
    }
    if (tabId === 'feedbackTab' && canCurrentUserManageFeedback()) renderFeedbackManagementTable();
}
function settingsTabClick() { switchTab('settingsTab', document.getElementById('adminMainTabHeader')); }
function switchInstructorTab(tabId, btnEl) {
    document.querySelectorAll('#examInstructorView .admin-subtab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('#examInstructorView .admin-tab-btn').forEach(e => e.classList.remove('active'));
    const t = document.getElementById(tabId); if (t) t.classList.add('active');
    if (btnEl) btnEl.classList.add('active');
}

function toggleGroupCollapse(gId) { const g = document.getElementById(gId); if (g) g.classList.toggle('collapsed'); }

/* ── DOM Ready & Exports ────────────────────────────────     */
document.addEventListener('DOMContentLoaded', async () => {
    updateLiveDate(); setInterval(updateLiveDate, 60000);
    renderGuideTab(); renderHierarchieBoard(hierarchieDaten); baueMaterialUIAuf();
    renderGehaltTab(cachedGehaltData);

    clearStoredSessionData();
    const authView = document.getElementById('authView');
    const mainView = document.getElementById('mainAppView');
    if (authView) authView.style.display = 'flex';
    if (mainView) mainView.style.display = 'none';

    try {
        await configureFirebaseAuthPersistence();
        const firebaseUser = await waitForFirebaseAuthReady();
        if (!firebaseUser) return;

        const profile = await loadAuthenticatedProfile(firebaseUser);
        const user = profile.user;
        const effectiveStatus = user.status || ((user.isAdmin || user.isMasterAdmin) ? 'approved' : 'pending');
        if (effectiveStatus !== 'approved') {
            await auth.signOut();
            return;
        }

        initDienstEintritt(user);
    } catch (err) {
        console.warn('Firebase-Sitzung konnte nicht wiederhergestellt werden:', err);
        try { await auth.signOut(); } catch (_) {}
        if (authView) authView.style.display = 'flex';
        if (mainView) mainView.style.display = 'none';
    }
});

const _w = window;
_w.switchTab = switchTab; _w.settingsTabClick = settingsTabClick; _w.switchAdminTab = switchAdminTab; _w.switchInstructorTab = switchInstructorTab;
_w.handleAuthAction = handleAuthAction; _w.toggleAuthTab = toggleAuthTab;
_w.openAdminKeyModal = openAdminKeyModal; _w.closeAdminAuthModal = closeAdminAuthModal; _w.verifyAdminKeyPassword = verifyAdminKeyPassword; _w.closeAdminManagementModal = closeAdminManagementModal;
_w.handleDienstEndeLogout = handleDienstEndeLogout; _w.berechneDienstTage = berechneDienstTage; _w.passwortAendern = passwortAendern;
_w.toggleGroupCollapse = toggleGroupCollapse; _w.stepVerletzungenAnzahl = stepVerletzungenAnzahl; _w.stepKosten = stepKosten; _w.stepMat = stepMat; _w.ladeCheckliste = ladeCheckliste; _w.patientHinzufuegen = patientHinzufuegen; _w.toggleTodo = toggleTodo;
_w.resetMedicalWorkflow = resetMedicalWorkflow; _w.openEditModal = openEditModal; _w.closeEditModal = closeEditModal; _w.speicherePatientEdit = speicherePatientEdit;
_w.deletePatient = deletePatient; _w.deleteArchivSchicht = deleteArchivSchicht; _w.deleteDienstLink = deleteDienstLink; _w.deleteDienstCommand = deleteDienstCommand; _w.exportArchivCSV = exportArchivCSV;
_w.openPricesInlineModal = openPricesInlineModal; _w.closePricesInlineModal = closePricesInlineModal; _w.speicherePreiseInline = speicherePreiseInline;
_w.openSzenarienInlineModal = openSzenarienInlineModal; _w.closeSzenarienInlineModal = closeSzenarienInlineModal; _w.addNewSzenarioWorkflow = addNewSzenarioWorkflow; _w.deleteSzenarioWorkflow = deleteSzenarioWorkflow; _w.saveAllSzenarienWorkflows = saveAllSzenarienWorkflows;
_w.openGuideInlineModal = openGuideInlineModal; _w.closeGuideInlineModal = closeGuideInlineModal; _w.addGuideRow = addGuideRow; _w.removeGuideRow = removeGuideRow; _w.saveGuideInline = saveGuideInline; _w.addKeineRechnungRow = addKeineRechnungRow; _w.removeKeineRechnungRow = removeKeineRechnungRow;
_w.openCommandsInlineModal = openCommandsInlineModal; _w.closeCommandsInlineModal = closeCommandsInlineModal; _w.addCommandInline = addCommandInline;
_w.openLinksInlineModal = openLinksInlineModal; _w.closeLinksInlineModal = closeLinksInlineModal; _w.addLinkInline = addLinkInline;
_w.togglePostNewsForm = togglePostNewsForm; _w.speichereNeueNews = speichereNeueNews; _w.deleteNews = deleteNews;
_w.toggleProposeNewsForm = toggleProposeNewsForm; _w.submitNewsProposal = submitNewsProposal; _w.approveNewsProposal = approveNewsProposal;
_w.markNewsAsRead = markNewsAsRead; _w.openNewsReadersModal = openNewsReadersModal; _w.closeNewsReadersModal = closeNewsReadersModal;
_w.openEditNewsModal = openEditNewsModal;
_w.openChangelogModal = openChangelogModal; _w.closeChangelogModal = closeChangelogModal;
_w.openChangelogWriterModal = openChangelogWriterModal; _w.closeChangelogWriterModal = closeChangelogWriterModal; _w.saveCustomChangelogEntry = saveCustomChangelogEntry;
_w.openGehaltInlineModal = openGehaltInlineModal; _w.closeGehaltInlineModal = closeGehaltInlineModal; _w.saveGehaltInline = saveGehaltInline; _w.addGehaltRowInline = addGehaltRowInline; _w.removeGehaltRowInline = removeGehaltRowInline;
_w.startExam = startExam; _w.cancelActiveExam = cancelActiveExam; _w.submitActiveExam = submitActiveExam;
_w.addExamQuestionRow = addExamQuestionRow; _w.resetExamBuilderForm = resetExamBuilderForm; _w.neuePruefungSpeichern = neuePruefungSpeichern; _w.editExam = editExam; _w.deleteExam = deleteExam; _w.deleteExamSubmission = deleteExamSubmission;
_w.openExamBuilderModal = openExamBuilderModal; _w.closeExamBuilderModal = closeExamBuilderModal;
_w.openExamSubmissionDetailsModal = openExamSubmissionDetailsModal; _w.closeExamSubmissionDetailsModal = closeExamSubmissionDetailsModal;
_w.filterUnlocksTable = filterUnlocksTable; _w.filterSubmissionsTable = filterSubmissionsTable; _w.toggleExamUnlockForUser = toggleExamUnlockForUser; _w.toggleExamPassedForUser = toggleExamPassedForUser;
_w.downloadSystemBackup = downloadSystemBackup; _w.restoreSystemBackupFromFile = restoreSystemBackupFromFile;
_w.speichereHierarchieDaten = saveHierarchieInline;
_w.approveUser = approveUser; _w.revokeUser = revokeUser; _w.deleteUserAccount = deleteUserAccount; _w.filterAdminUserTable = filterAdminUserTable;
_w.openAssignRolesModal = openAssignRolesModal; _w.closeAssignRolesModal = closeAssignRolesModal; _w.saveAssignedRoles = saveAssignedRoles;
_w.openUserPermissionsModal = openUserPermissionsModal; _w.closeUserPermissionsModal = closeUserPermissionsModal; _w.saveUserPermissions = saveUserPermissions; _w.runFirebaseAuthMigration = runFirebaseAuthMigration;
_w.renderPasswordChangeStatusPanel = renderPasswordChangeStatusPanel; _w.copyAllOpenPasswordReminders = copyAllOpenPasswordReminders; _w.copyPasswordReminderForUser = copyPasswordReminderForUser;
_w.neueRolleErstellen = neueRolleErstellen; _w.selectRole = selectRole; _w.updateRoleBadgePreview = updateRoleBadgePreview; _w.speichereRolle = speichereRolle; _w.loescheRolle = loescheRolle;
_w.vollstaendigerReset = vollstaendigerReset; _w.renderAdminAuditLogs = renderAdminAuditLogs;
_w.openAuditLogArchiveModal = openAuditLogArchiveModal; _w.closeAuditLogArchiveModal = closeAuditArchiveModal;
_w.editCommandInline = editCommandInline;
_w.editLinkInline = editLinkInline;
_w.openHierarchieInlineModal = openHierarchieInlineModal;
_w.closeHierarchieInlineModal = closeHierarchieInlineModal;
_w.saveHierarchieInline = saveHierarchieInline;
_w.changeCalendarMonth = changeCalendarMonth;
_w.resetCalendarToToday = resetCalendarToToday;
_w.renderCalendarMonth = renderCalendarMonth;
_w.onCalendarCellClick = onCalendarCellClick;
_w.openCreateEventModal = openCreateEventModal;
_w.closeCalendarEventModal = closeCalendarEventModal;
_w.saveCalendarEvent = saveCalendarEvent;
_w.openCalendarEventDetailsModal = openCalendarEventDetailsModal;
_w.closeCalendarEventDetailsModal = closeCalendarEventDetailsModal;
_w.editCalendarEventAction = editCalendarEventAction;
_w.deleteCalendarEventAction = deleteCalendarEventAction;
_w.togglePrivateEventOption = togglePrivateEventOption;
_w.toggleAllCalendarRoles = toggleAllCalendarRoles;
_w.handleCalendarCreatorSelectionChange = handleCalendarCreatorSelectionChange;
_w.respondToCalendarInvite = respondToCalendarInvite;
_w.renderStaffDirectory = renderStaffDirectory;
_w.filterStaffDirectory = filterStaffDirectory;
_w.openStaffPhotoUploadModal = openStaffPhotoUploadModal;
_w.closeStaffPhotoUploadModal = closeStaffPhotoUploadModal;
_w.previewStaffPhotoUpload = previewStaffPhotoUpload;
_w.submitStaffPhotoUpload = submitStaffPhotoUpload;
_w.openStaffPhotoAdminModal = openStaffPhotoAdminModal;
_w.closeStaffPhotoAdminModal = closeStaffPhotoAdminModal;
_w.renderStaffPhotoAdminList = renderStaffPhotoAdminList;
_w.downloadStaffOriginalPhoto = downloadStaffOriginalPhoto;
_w.uploadProcessedStaffPhoto = uploadProcessedStaffPhoto;
_w.resetStaffPhotoToDefault = resetStaffPhotoToDefault;
_w.toggleBuilderCorrectAnswer = toggleBuilderCorrectAnswer;
_w.openFeedbackCenter = openFeedbackCenter;
_w.switchFeedbackCenterTab = switchFeedbackCenterTab;
_w.resetFeedbackSubmitForm = resetFeedbackSubmitForm;
_w.submitUserFeedback = submitUserFeedback;
_w.renderFeedbackManagementTable = renderFeedbackManagementTable;
_w.handleFeedbackStatusSelect = handleFeedbackStatusSelect;
_w.applyInlinePreset = applyInlinePreset;
_w.closeInlineRejectBox = closeInlineRejectBox;
_w.saveInlineRejection = saveInlineRejection;
_w.deleteFeedbackEntry = deleteFeedbackEntry;
_w.exportFeedbackListMarkdown = exportFeedbackListMarkdown;