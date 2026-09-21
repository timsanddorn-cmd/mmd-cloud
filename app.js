// ============================================================
//  MMD CLOUD – Medical Center Web-App  |  app.js  v6.8.8
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

function getStoredSessionDate() {
    return sessionStorage.getItem('mmd_session_date') || localStorage.getItem('mmd_session_date') || '';
}

function storeActiveSessionDate(dateLabel) {
    sessionStorage.setItem('mmd_session_active', 'true');
    sessionStorage.setItem('mmd_session_date', dateLabel);
    localStorage.setItem('mmd_session_active', 'true');
    localStorage.setItem('mmd_session_date', dateLabel);
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
    return !!(eff.isMasterAdmin || eff.canManageFeedback);
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

const APP_VERSION = 'v6.8.8';
const PRESENCE_HEARTBEAT_MS = 30 * 1000;
const PRESENCE_STALE_MS = 3 * 60 * 1000;

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
let cachedMaintenanceState = { enabled:false, startedAt:0, startedBy:'', message:'' };
let maintenanceModeListenerActive = false;
let maintenanceRestrictedLast = false;
let dailyForcedLogoutTimeoutId = null;
let dailyLogoutEventsBound = false;
let presenceHeartbeatIntervalId = null;
let sessionStartedAt = 0;
let sessionControlRef = null;
let clientReleaseRef = null;
let appUpdateCountdownIntervalId = null;
let appUpdateReloadAt = 0;
let cachedPresence = {};
let cachedClientRelease = null;
let pendingBackupRestore = null;
const unsavedChangeScopes = new Set();
let activeCalendarView = 'month';
let cachedSzenarioConfigMeta = { updatedAt: 0, updatedBy: '' };
let globalSearchResultsCache = [];
let officialDnSyncInProgress = false;
let officialDnSyncCompletedForPage = false;
let cachedUsers       = {};
let cachedEmployeeCareerPaths = {};
let cachedExams       = {};
let cachedSubmissions = {};
let cachedNews        = {};
let cachedMyEmployeeNotices = {};
let cachedManagedEmployeeNotices = {};
let employeeNoticeOwnRef = null;
let employeeNoticeAdminRef = null;
let activeEmployeeNoticeId = '';
let cachedArchiv      = {};
let cachedAuditLogs   = {};
let cachedCalendar    = {};
let cachedPhotos      = {};
let cachedCustomChangelogs = {};
let cachedCommands    = {};
let cachedLinks       = {};
let cachedFeedback    = {};
let cachedSanctionsCatalog = null;
let sanctionsCatalogBootstrapAttempted = false;
let activeExam        = null;
let activeExamTimerInterval = null;
let activeExamSecondsElapsed = 0;
let midnightIntervalId = null;
let dailyForcedLogoutIntervalId = null;

/* ── Kleine UI-Helfer: Hinweise & ungespeicherte Änderungen ── */
function showToast(message, type = 'info', duration = 3200) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `mmd-toast ${type}`;
    toast.textContent = String(message || '');
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    window.setTimeout(() => {
        toast.classList.remove('visible');
        window.setTimeout(() => toast.remove(), 220);
    }, Math.max(1200, Number(duration) || 3200));
}

function markUnsavedChanges(scope) {
    if (scope) unsavedChangeScopes.add(scope);
}

function clearUnsavedChanges(scope) {
    if (scope) unsavedChangeScopes.delete(scope);
}

function confirmDiscardUnsavedChanges(scope) {
    if (!scope || !unsavedChangeScopes.has(scope)) return true;
    const ok = confirm('Es gibt noch nicht gespeicherte Änderungen. Möchtest du sie wirklich verwerfen?');
    if (ok) unsavedChangeScopes.delete(scope);
    return ok;
}

function setupUnsavedChangeTracking() {
    const resolveScope = target => {
        if (!target || !(target instanceof Element)) return '';
        if (target.closest('#adminRoleEditorCard')) return 'role';
        if (target.closest('#userPermissionsForm') && target.id !== 'permPassword') return 'user';
        if (target.closest('#calendarEventModal')) return 'calendar';
        if (target.closest('#postNewsContainer')) return 'newsPost';
        if (target.closest('#proposeNewsContainer')) return 'newsProposal';
        return '';
    };
    const handler = event => {
        const scope = resolveScope(event.target);
        if (scope) markUnsavedChanges(scope);
    };
    document.addEventListener('input', handler, true);
    document.addEventListener('change', handler, true);
    window.addEventListener('beforeunload', event => {
        if (!unsavedChangeScopes.size) return;
        event.preventDefault();
        event.returnValue = '';
    });
}

/* ── v6.8.7 – persönliche Übersicht, Suche & Aktualität ───── */
function normalizeUiSearchText(value) {
    return String(value || '').toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[§]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getUnreadNewsCount() {
    if (!sessionUser) return 0;
    const myId = getUserAccountId(sessionUser);
    const legacyKey = sessionUser.dn ? ('dn_' + sessionUser.dn) : '';
    return Object.values(cachedNews || {}).filter(item => {
        if (!item || item.deleted || item.status === 'pending_approval') return false;
        const readBy = item.readBy || {};
        return !readBy[myId] && !(legacyKey && readBy[legacyKey]);
    }).length;
}

function getPendingCalendarInvitations() {
    if (!sessionUser) return [];
    const myId = getUserAccountId(sessionUser);
    const now = Date.now();
    return Object.entries(cachedCalendar || {}).map(([id, ev]) => Object.assign({ id }, ev || {})).filter(ev => {
        if (!ev || ev.deleted || !Array.isArray(ev.invitedUsers) || !ev.invitedUsers.includes(myId)) return false;
        if ((ev.invitationStatus?.[myId] || 'pending') !== 'pending') return false;
        const dt = getCalendarEventDateTime(ev);
        return !dt || dt.getTime() >= now;
    }).sort((a,b) => (getCalendarEventDateTime(a)?.getTime() || 0) - (getCalendarEventDateTime(b)?.getTime() || 0));
}

function getMyOpenItemsStats() {
    return { news: getUnreadNewsCount(), notices: getPendingEmployeeNoticeEntries().length, invites: getPendingCalendarInvitations().length };
}

function getOnlineMedicCount() {
    const now = Date.now();
    const unique = new Set();
    Object.values(cachedPresence || {}).forEach(value => {
        if (!value || typeof value !== 'object' || !isPresenceFresh(value, now)) return;
        const accountId = String(value.accountId || '').trim();
        if (!accountId) return;
        const account = cachedUsers[accountId];
        const status = account?.status || ((account?.isAdmin || account?.isMasterAdmin) ? 'approved' : 'pending');
        if (account && status !== 'approved') return;
        unique.add(accountId);
    });
    return unique.size;
}

function renderTodayOverview() {
    if (!sessionUser) return;
    const greeting = document.getElementById('todayOverviewGreeting');
    if (greeting) greeting.textContent = sessionUser.vorname ? `Heute für ${sessionUser.vorname}` : 'Deine Übersicht';
    const now = Date.now();
    const next = getVisibleCalendarEventsForCurrentUser()
        .map(ev => ({ ev, dt: getCalendarEventDateTime(ev) }))
        .filter(item => item.dt && item.dt.getTime() >= now)
        .sort((a,b) => a.dt - b.dt)[0];
    const nextTitle = document.getElementById('todayNextAppointment');
    const nextMeta = document.getElementById('todayNextAppointmentMeta');
    if (next) {
        if (nextTitle) nextTitle.textContent = next.ev.title || 'Termin';
        if (nextMeta) nextMeta.textContent = `${next.dt.toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})} · ${next.ev.time || '--:--'} Uhr`;
    } else {
        if (nextTitle) nextTitle.textContent = 'Kein Termin';
        if (nextMeta) nextMeta.textContent = 'Aktuell nichts geplant';
    }
    const stats = getMyOpenItemsStats();
    const totalOpen = stats.news + stats.notices + stats.invites;
    const openCount = document.getElementById('todayOpenItemsCount');
    const openMeta = document.getElementById('todayOpenItemsMeta');
    if (openCount) openCount.textContent = String(totalOpen);
    if (openMeta) openMeta.textContent = totalOpen ? 'braucht deine Aufmerksamkeit' : 'Alles erledigt';
    const onlineCount = document.getElementById('todayOnlineMedicsCount');
    if (onlineCount) onlineCount.textContent = String(getOnlineMedicCount());
    const newsCount = document.getElementById('todayUnreadNewsCount');
    const newsMeta = document.getElementById('todayUnreadNewsMeta');
    if (newsCount) newsCount.textContent = String(stats.news);
    if (newsMeta) newsMeta.textContent = stats.news ? 'noch nicht gelesen' : 'Alles gelesen';
}

function renderMyOpenItemsButton() {
    const btn = document.getElementById('myOpenItemsBtn');
    const badge = document.getElementById('myOpenItemsBadge');
    if (!btn || !badge) return;
    const stats = getMyOpenItemsStats();
    const total = stats.news + stats.notices + stats.invites;
    badge.textContent = String(total);
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
    btn.classList.toggle('has-open-items', total > 0);
}

function renderMyOpenItemsModal() {
    const box = document.getElementById('myOpenItemsContent');
    if (!box || !sessionUser) return;
    const stats = getMyOpenItemsStats();
    const rows = [];
    if (stats.news) rows.push(`<button type="button" class="my-open-item" onclick="navigateMyOpenItem('news')"><span>📰</span><div><b>${stats.news} ungelesene News</b><small>Schwarzes Brett öffnen und Beiträge lesen</small></div><em>${stats.news}</em></button>`);
    if (stats.notices) rows.push(`<button type="button" class="my-open-item" onclick="navigateMyOpenItem('notices')"><span>📨</span><div><b>${stats.notices} persönliche Mitarbeiterhinweise</b><small>Hinweise öffnen und bestätigen</small></div><em>${stats.notices}</em></button>`);
    getPendingCalendarInvitations().forEach(ev => {
        const dt = getCalendarEventDateTime(ev);
        const when = dt ? dt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}) + ' · ' + (ev.time || '--:--') : (ev.date || '');
        rows.push(`<button type="button" class="my-open-item" onclick="navigateMyOpenItem('calendar', ${escapeJsArg(ev.id)})"><span>📅</span><div><b>${escapeHtml(ev.title || 'Kalendereinladung')}</b><small>${escapeHtml(when)} · Antwort steht noch aus</small></div><em>1</em></button>`);
    });
    box.innerHTML = rows.length ? rows.join('') : '<div class="my-open-empty"><span>✅</span><b>Alles erledigt</b><small>Aktuell gibt es keine ungelesenen News, persönlichen Hinweise oder offenen Kalendereinladungen.</small></div>';
}
function openMyOpenItemsModal() { renderMyOpenItemsModal(); const modal=document.getElementById('myOpenItemsModal'); if(modal)modal.style.display='flex'; }
function closeMyOpenItemsModal() { const modal=document.getElementById('myOpenItemsModal'); if(modal)modal.style.display='none'; }
function navigateMyOpenItem(type, id='') {
    closeMyOpenItemsModal();
    if(type==='calendar'){switchTab('calendarTab',document.getElementById('calendarTabNavBtn'));if(id)openCalendarEventDetailsModal(id);return;}
    if(type==='news'||type==='notices'){switchTab('newsTab',document.getElementById('newsTabBtn'));document.getElementById('myEmployeeNoticesContainer')?.scrollIntoView({behavior:'smooth',block:'start'});}
}
function updatePersonalOverview(){renderTodayOverview();renderMyOpenItemsButton();if(document.getElementById('myOpenItemsModal')?.style.display==='flex')renderMyOpenItemsModal();}

function getLatestContentMeta(collection) {
    const items = Array.isArray(collection) ? collection : Object.values(collection || {});
    let best={updatedAt:0,updatedBy:''};
    items.forEach(item=>{if(!item||typeof item!=='object')return;const ts=Number(item.updatedAt)||0;if(ts>best.updatedAt)best={updatedAt:ts,updatedBy:String(item.updatedBy||'')};});
    return best;
}
function formatContentFreshness(updatedAt,updatedBy){
    const ts=Number(updatedAt)||0;if(!ts)return '☁️ Aktueller Cloud-Stand';
    const when=new Date(ts).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
    return `🕒 Zuletzt geändert: ${when}${updatedBy?' · '+updatedBy:''}`;
}
function renderContentFreshnessHints(){
    const set=(id,meta)=>{const el=document.getElementById(id);if(el)el.textContent=formatContentFreshness(meta?.updatedAt,meta?.updatedBy);};
    set('guideLastUpdated',{updatedAt:cachedGuideData?._updatedAt,updatedBy:cachedGuideData?._updatedBy});
    set('medicalWorkflowLastUpdated',cachedSzenarioConfigMeta);
    set('hierarchyLastUpdated',{updatedAt:hierarchieDaten?._updatedAt,updatedBy:hierarchieDaten?._updatedBy});
    set('salaryLastUpdated',getLatestContentMeta(cachedGehaltData));
    set('commandsLastUpdated',getLatestContentMeta(cachedCommands));
    set('linksLastUpdated',getLatestContentMeta(cachedLinks));
}

function setupUnifiedEditorModals(){
    ['szenarienInlineModal','gehaltInlineModal','sanctionsCatalogEditorModal','editModal','archivEditModal','pricesInlineModal','guideInlineModal','commandsInlineModal','linksInlineModal','calendarEventModal','staffPhotoUploadModal','userPermissionsModal','assignRolesModal','examBuilderModal','changelogWriterModal','hierarchieInlineModal'].forEach(id=>document.getElementById(id)?.querySelector('.modal-card')?.classList.add('mmd-editor-card'));
}
function findMainTabButton(tabId){return Array.from(document.querySelectorAll('.tab-btn,.nav-sub-btn')).find(btn=>(btn.getAttribute('onclick')||'').includes(`switchTab('${tabId}'`))||null;}
function canSearchSection(tabId){if(isMaintenanceRestrictedSession())return tabId==='docTab';if(tabId==='chiefTab')return canCurrentUserViewChiefMaterials();if(tabId==='personnelTab')return typeof canCurrentUserAccessPersonnelArea==='function'?canCurrentUserAccessPersonnelArea():canCurrentUserManageCareerPaths();return !!document.getElementById(tabId);}
function buildGlobalSearchResults(query){
    const q=normalizeUiSearchText(query);
    const sections=[
        ['docTab','📝','Dokumentation & Einsatz','patient behandlung einsatz material medizin'],['statsTab','📊','Statistik & Archiv','statistik archiv schicht patienten protokoll'],['calendarTab','📅','Kalender','kalender termine dienstbesprechung'],['examTab','🎓','Ausbildung','ausbildung pruefung prüfung'],['staffTab','👥','Mitarbeiter Kartei','mitarbeiter personal kartei dn'],['hierarchieTab','🌳','Hierarchie','hierarchie leitung abteilung'],['miscTab','💰','Gehaltstabelle','gehalt sold rang'],['guideTab','📋','Funk & Codes','funk codes status ten code streife'],['commandTab','💻','Commands','command befehl commands'],['linksTab','🔗','Links & Dokumente','links dokumente leitfaden'],['sanctionsTab','⚖️','Sanktionskatalog','sanktion paragraf paragraph verstoß verstoss'],['newsTab','📰','News','news schwarzes brett ankuendigung ankündigung'],['settingsTab','⚙️','Einstellungen','einstellungen passwort diensttage'],['chiefTab','⭐','Chief Ebene','chief material bestand']
    ].filter(([tabId])=>canSearchSection(tabId));
    const results=[];
    sections.forEach(([tabId,icon,title,keywords])=>{if(!q||normalizeUiSearchText(title+' '+keywords).includes(q))results.push({kind:'section',tabId,icon,title,subtitle:'Bereich öffnen'});});
    if(q){
        getVisibleStaffEntries().forEach(([uId,user])=>{const name=`${user.vorname||''} ${user.nachname||''}`.trim();if(normalizeUiSearchText(`${name} ${user.dn||''}`).includes(q))results.push({kind:'staff',tabId:'staffTab',id:uId,icon:'👤',title:name||uId,subtitle:formatStaffDn(user.dn)});});
        getSanctionsEntries().forEach(item=>{if(matchesSanctionsSearch(item,query))results.push({kind:'sanction',tabId:'sanctionsTab',icon:'⚖️',title:`${item.paragraph||'—'} · ${item.offense||'Verstoß'}`,subtitle:[item.sanction1,item.sanction2,item.sanction3].filter(Boolean).join(' · '),searchValue:item.paragraph||item.offense||query});});
        getVisibleCalendarEventsForCurrentUser().forEach(ev=>{if(normalizeUiSearchText(`${ev.title||''} ${ev.desc||''} ${ev.date||''} ${ev.creatorDisplay||''}`).includes(q))results.push({kind:'calendar',tabId:'calendarTab',id:ev.id,icon:'📅',title:ev.title||'Termin',subtitle:`${ev.date||''} · ${ev.time||'--:--'}`});});
    }
    const seen=new Set();return results.filter(item=>{const key=[item.kind,item.tabId,item.id||item.title].join('|');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,24);
}
function renderGlobalSearchResults(){
    const input=document.getElementById('globalSearchInput'),box=document.getElementById('globalSearchResults');if(!box)return;
    globalSearchResultsCache=buildGlobalSearchResults(input?.value||'');
    box.innerHTML=globalSearchResultsCache.length?globalSearchResultsCache.map((item,idx)=>`<button type="button" class="global-search-result" onclick="navigateGlobalSearchResult(${idx})"><span class="global-search-result-icon">${item.icon}</span><span class="global-search-result-main"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.subtitle||'')}</small></span><span class="global-search-result-arrow">›</span></button>`).join(''):'<div class="global-search-empty">Keine passenden Treffer gefunden.</div>';
}
function openGlobalSearch(){if(!sessionUser)return;const modal=document.getElementById('globalSearchModal'),input=document.getElementById('globalSearchInput');if(!modal||!input)return;modal.style.display='flex';input.value='';renderGlobalSearchResults();window.setTimeout(()=>input.focus(),0);}
function closeGlobalSearch(){const modal=document.getElementById('globalSearchModal');if(modal)modal.style.display='none';}
function navigateGlobalSearchResult(index){
    const item=globalSearchResultsCache[Number(index)];if(!item)return;closeGlobalSearch();switchTab(item.tabId,findMainTabButton(item.tabId));
    if(item.kind==='staff'&&item.id)openStaffDetailModal(item.id);
    else if(item.kind==='sanction'){const input=document.getElementById('sanctionsSearchInput');if(input)input.value=item.searchValue||'';renderSanctionsCatalog();input?.focus();}
    else if(item.kind==='calendar'&&item.id)openCalendarEventDetailsModal(item.id);
}
function setupGlobalSearchShortcut(){
    document.addEventListener('keydown',event=>{
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openGlobalSearch();return;}
        if(event.key==='Escape'){if(document.getElementById('globalSearchModal')?.style.display==='flex')closeGlobalSearch();else if(document.getElementById('myOpenItemsModal')?.style.display==='flex')closeMyOpenItemsModal();else if(document.getElementById('staffDetailModal')?.style.display==='flex')closeStaffDetailModal();}
    });
}

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
        id: "sys_v6_8_8", version: "v6.8.8", date: "22.09.2026", ts: 1790035200000,
        category: "Neue Funktion", title: "Personalabteilung ausgebaut",
        changes: [
            "Die Personalabteilung besitzt jetzt Übersicht, Personalakten, Mitarbeiterkalender und einen Bereich zum Anlegen neuer Mitarbeiter.",
            "Personalakten führen Sanktionen mit Bericht, Rankups mit Grund und allgemeine Notizen chronologisch.",
            "Doctor- und Paramedic-Laufbahn können parallel geführt werden; die zugehörigen Ränge können gleichzeitig sichtbar sein.",
            "Urlaub und entschuldigte Abwesenheit werden intern mit Zeitraum verwaltet, in der Mitarbeiterkartei aber nur als Status angezeigt.",
            "Abgelaufene Abwesenheiten bleiben sichtbar und werden in der Personalabteilung rot zur Rückkehrprüfung markiert.",
            "Rang und aktueller Abwesenheitsstatus sind in der Mitarbeiterkartei in Mehrfach- und Einzelansicht sichtbar."
        ]
    },
    {
        id: "sys_v6_8_7j", version: "v6.8.7j", date: "21.09.2026", ts: 1790009100000,
        category: "Fehlerbehebung", title: "Rollenspeichern stabilisiert",
        changes: [
            "Der Button „Rolle speichern“ besitzt jetzt einen eigenen stabilen Klickbereich und sichtbaren Speicherstatus.",
            "Eine Rolle gilt nach erfolgreichem Firebase-Rollenschreibvorgang sofort als gespeichert, auch wenn die anschließende Benutzerrechte-Synchronisierung separat fehlschlägt.",
            "Fehler beim eigentlichen Rollenspeichern und bei der nachgelagerten Rechte-Synchronisierung werden getrennt behandelt.",
            "Die neue Berechtigung canManageCareerPaths wurde ausdrücklich in den ServerPermissions-Regeln ergänzt."
        ]
    },
    {
        id: "sys_v6_8_7i", version: "v6.8.7i", date: "21.09.2026", ts: 1790008200000,
        category: "Fehlerbehebung", title: "Checkboxen in Rollen & Rechte vereinheitlicht",
        changes: [
            "Alle Rechte-Karten zeigen jetzt sichtbar ein Checkbox-Feld.",
            "Das feste Kalender-Grundrecht wird als angehakt und gesperrt dargestellt, statt ohne Kästchen.",
            "Deaktivierte Systemrechte bleiben sichtbar und sind optisch eindeutig gesperrt.",
            "Die Rollen- und Berechtigungslogik selbst wurde nicht verändert."
        ]
    },
    {
        id: "sys_v6_8_7h", version: "v6.8.7h", date: "21.09.2026", ts: 1790007300000,
        category: "Verbesserung", title: "Eigener Hauptbereich für die Personalabteilung",
        changes: [
            "Die Personalabteilung besitzt jetzt einen eigenen Hauptreiter in der MMD Cloud.",
            "Die Mitarbeiterlaufbahn-Verwaltung wurde aus der Mitarbeiterkartei in diesen eigenen Bereich verschoben.",
            "Der Bereich ist nur mit der Berechtigung „Mitarbeiterlaufbahn verwalten“ oder als Master Admin sichtbar und aufrufbar.",
            "Die Laufbahnanzeige auf den normalen Mitarbeiterkarten und in der Einzelansicht bleibt unverändert für alle sichtbar."
        ]
    },
    {
        id: "sys_v6_8_7g", version: "v6.8.7g", date: "21.09.2026", ts: 1790006400000,
        category: "Funktion", title: "Mitarbeiterlaufbahnen für die Personalabteilung",
        changes: [
            "Mitarbeiter können die Laufbahn Arzt, Paramedic oder Arzt & Paramedic erhalten; ohne Entscheidung bleibt der Status „Noch nicht festgelegt“.",
            "Die Laufbahn ist in der Mitarbeiter-Mehrfachansicht und in der vergrößerten Einzelansicht sichtbar.",
            "Rollen mit der neuen Berechtigung „Mitarbeiterlaufbahn verwalten“ können Laufbahnen in einem eigenen Personalbereich festlegen.",
            "Laufbahndaten liegen getrennt von Login- und Benutzerdaten unter data/employeeCareerPaths."
        ]
    },
    {
        id: "sys_v6_8_7f", version: "v6.8.7f", date: "20.09.2026", ts: 1789932000000,
        category: "Verbesserung", title: "Bestands Historie besser bedienbar",
        changes: [
            "Der horizontale Scrollbalken der Bestands Historie befindet sich jetzt oberhalb der Tabelle direkt unter dem Beschreibungstext.",
            "Die obere Scrollleiste und die Historientabelle laufen synchron.",
            "Der bisherige Scrollbalken am unteren Tabellenende wird ausgeblendet; Inhalte und Berechtigungen bleiben unverändert."
        ]
    },
    {
        id: "sys_v6_8_7e", version: "v6.8.7e", date: "20.09.2026", ts: 1789930500000,
        category: "Fehlerbehebung", title: "Fenster öffnen wieder im sichtbaren Bereich",
        changes: [
            "Modalfenster werden beim Laden an den Seiten-Body verschoben und sind dadurch nicht mehr an die Höhe des Hauptcontainers gebunden.",
            "Fenster wie Mitarbeiterdetails, Foto-Ordner, Kalender, Bearbeitungsdialoge und Adminfenster öffnen dadurch im aktuell sichtbaren Bildschirmbereich.",
            "Die Bezeichnung „Foto-Liste“ wurde auf „Foto liste“ geändert."
        ]
    },
    {
        id: "sys_v6_8_7d", version: "v6.8.7d", date: "20.09.2026", ts: 1789929000000,
        category: "Design", title: "Schriftgrößen global angehoben",
        changes: [
            "Das gesamte Schriftsystem wurde im Schnitt um etwa 2 Pixel vergrößert.",
            "Fließtexte, Buttons, Formulare, Labels, Tabellen, Hinweise und Überschriften sind dadurch besser lesbar.",
            "Auch die mobile Schriftstaffel wurde entsprechend angehoben; Funktionen und Layoutlogik bleiben unverändert."
        ]
    },
    {
        id: "sys_v6_8_7c", version: "v6.8.7c", date: "20.09.2026", ts: 1789927200000,
        category: "Design", title: "Schriftgrößen auf der gesamten Cloud vereinheitlicht",
        changes: [
            "Die gesamte MMD Cloud verwendet jetzt ein einheitlicheres und kompakteres Schriftsystem.",
            "Normale Texte, Tabellen, Formulare, Buttons, Navigation, Hinweise und Überschriften wurden auf feste Größenstufen abgestimmt.",
            "Die Änderung betrifft ausschließlich Darstellung und Lesbarkeit; Funktionen, Daten und Berechtigungen bleiben unverändert."
        ]
    },
    {
        id: "sys_v6_8_7b", version: "v6.8.7b", date: "20.09.2026", ts: 1789925700000,
        category: "Verbesserung", title: "Profilbild-Übersicht kompakter",
        changes: [
            "Die Profilbild-Übersicht kann innerhalb des geöffneten Bereichs ein- und ausgeklappt werden.",
            "Schriftgrößen und Abstände der Profilbild-Liste wurden kompakter abgestimmt.",
            "Foto-Hinweise, Profilbildstatus und bestehende Foto-Funktionen bleiben unverändert."
        ]
    },
    {
        id: "sys_v6_8_7a", version: "v6.8.7a", date: "20.09.2026", ts: 1789924200000,
        category: "Änderung", title: "Offizielle Dienstnummern synchronisiert",
        changes: [
            "Die neue offizielle DN-Liste wird einmalig und ausschließlich durch einen Master Admin mit den bereits registrierten Mitarbeiterkonten abgeglichen.",
            "Nicht registrierte Namen aus der Liste werden automatisch übersprungen; bereits korrekte Dienstnummern bleiben unverändert.",
            "Vor der Aktualisierung prüft die Cloud auf doppelte Ziel-Dienstnummern und bricht bei einem Konflikt ohne Datenänderung ab.",
            "Login, Account-IDs, Rollen, Passwörter, authIndex und loginDirectory werden durch die DN-Synchronisierung nicht verändert.",
            "Geänderte alte und neue Dienstnummern werden zur Nachvollziehbarkeit im Systemprotokoll festgehalten."
        ]
    },
    {
        id: "sys_v6_8_7", version: "v6.8.7", date: "20.09.2026", ts: 1789891200000,
        category: "Verbesserung", title: "Schneller finden, sehen und erledigen",
        changes: [
            "Ein kompakter Heute-Bereich zeigt den nächsten Termin, offene persönliche Punkte, ungelesene News und aktive Mitarbeiter.",
            "Der Kalender besitzt zusätzlich zur Monatsansicht eine chronologische 30-Tage-Listenansicht.",
            "Die Sanktionssuche ist deutlicher als Sofortsuche über Paragraph, Verstoß und alle Sanktionsstufen gekennzeichnet.",
            "Mitarbeiterkarten öffnen eine Detailansicht mit Foto, DN, Rollen und Dienstzeit; Verwaltungsaktionen bleiben berechtigungsabhängig.",
            "Das Admin-Kontrollzentrum zeigt unter den Kennzahlen ausschließlich aktuell offene Aufgaben.",
            "Bearbeitungsfenster erhalten ein einheitlicheres Erscheinungsbild und gezielte mobile Optimierungen.",
            "Zentrale Inhalte zeigen soweit verfügbar den letzten Änderungszeitpunkt und Bearbeiter.",
            "Eine globale Schnellsuche per Strg + K durchsucht Navigation und nur sichtbare Inhalte.",
            "Persönliche offene News, Hinweise und Kalendereinladungen werden in einer gemeinsamen Übersicht gebündelt.",
            "Systemprotokoll-Filter und Favoriten wurden bewusst nicht Bestandteil dieses Pakets."
        ]
    },
    {
        id: "sys_v6_8_6a", version: "v6.8.6a", date: "20.09.2026", ts: 1789869000000,
        category: "Verbesserung", title: "Status-Filter auf Verwaltung beschränkt",
        changes: [
            "Der Mitarbeiter-Statusfilter ist nur noch für Personen mit Mitarbeiterverwaltung oder für Master Admins sichtbar.",
            "Profilbild- und Rollenfilter bleiben für alle freigeschalteten Mitarbeiter verfügbar.",
            "Datenzugriff, Rollen, Berechtigungen und Firebase Rules wurden nicht verändert."
        ]
    },
    {
        id: "sys_v6_8_6", version: "v6.8.6", date: "20.09.2026", ts: 1789865340000,
        category: "Verbesserung", title: "Alltag & Verwaltung komfortabler",
        changes: [
            "Der Admin-Bereich besitzt jetzt ein Kontrollzentrum mit offenen Registrierungen, fehlenden Profilbildern, Passwortstatus, aktiven Browsern, Wartungsstatus und Versionsstand.",
            "Bei wichtigen Bearbeitungen warnt die MMD Cloud vor dem Verwerfen nicht gespeicherter Änderungen.",
            "Die Mitarbeiterkartei kann zusätzlich nach Status, Profilbild und Rolle gefiltert werden.",
            "Der Kalender zeigt die nächsten sichtbaren Termine kompakt oberhalb der Monatsansicht.",
            "Kalender und Mitarbeiterverwaltung zeigen kleine Zähler für offene Einladungen beziehungsweise Registrierungen; der bestehende News-Zähler bleibt erhalten.",
            "Vor dem Einspielen eines Backups wird jetzt eine Inhalts- und Datumsübersicht mit finaler Bestätigung angezeigt.",
            "Erfolgreiche Alltagsaktionen verwenden häufiger dezente MMD-Hinweise statt blockierender Browser-Popups."
        ]
    },
    {
        id: "sys_v6_8_5j", version: "v6.8.5j", date: "19.09.2026", ts: 1789849140000,
        category: "Bugfix", title: "Foto-Liste Layout korrigiert",
        changes: [
            "Der Foto-Hinweis bleibt jetzt vollständig innerhalb der jeweiligen Mitarbeiterkarte.",
            "Status und Foto-Hinweis sind kompakt auf der rechten Seite angeordnet und überdecken keine benachbarten Karten mehr.",
            "Vor- und Nachname sowie Dienstnummer bleiben weiterhin vollständig sichtbar."
        ]
    },
    {
        id: "sys_v6_8_5i", version: "v6.8.5i", date: "19.09.2026", ts: 1789813860000,
        category: "Verbesserung", title: "Admin-Bereich übersichtlicher",
        changes: [
            "Die Admin-Navigation wurde verständlicher in Verwaltung, System und Sicherheit gruppiert.",
            "Kopfbereich und Admin-Navigation bleiben beim Scrollen sichtbar, damit lange Verwaltungsseiten leichter bedienbar sind.",
            "Das Verteilen einer neuen Browser-Version verwendet automatisch die aktuelle MMD-Cloud-Version und benötigt keine manuelle Versionseingabe mehr.",
            "Der optionale Browser-Hinweis ist platzsparend unter erweiterten Optionen untergebracht.",
            "Die Profilbild-Übersicht zeigt Dienstnummer sowie Vor- und Nachname robust zusammen an, auch bei kleineren Fensterbreiten."
        ]
    },
    {
        id: "sys_v6_8_5h", version: "v6.8.5h", date: "19.09.2026", ts: 1789803000000,
        category: "Verbesserung", title: "Technische Bereinigung",
        changes: [
            "Nicht mehr verwendete Hilfsfunktionen wurden aus der Codebasis entfernt.",
            "Veraltete Versions- und Abschnittskommentare wurden bereinigt.",
            "Alte Inaktivitätsbezeichnungen wurden aus technischen Überschriften entfernt; Presence- und Browser-Update-Funktionen bleiben unverändert.",
            "Firebase Auth, Registrierung, Rollen, Berechtigungen und Datenbankregeln wurden nicht verändert."
        ]
    },
    {
        id: "sys_v6_8_5g", version: "v6.8.5g", date: "19.09.2026", ts: 1789772400000,
        category: "Verbesserung", title: "Dienststatus vereinfacht",
        changes: [
            "Die automatische Inaktivitätsabmeldung wurde vollständig entfernt.",
            "Der Dienststatus wird nur noch aus aktuellen Browser-Lebenszeichen ermittelt.",
            "Alte Presence-/Legacy-Einträge werden nicht mehr als aktiver Dienst angezeigt.",
            "Dienst beenden, der tägliche Dienstwechsel und das administrative Entfernen aus dem Dienst bleiben unverändert."
        ]
    },
    {
        id: "sys_v6_8_4", version: "v6.8.4", date: "18.09.2026", ts: 1789714800000,
        category: "Neue Funktion", title: "Persönliche Mitarbeiterhinweise",
        changes: [
            "Berechtigte Rollen können im Newsfeed gezielte Hinweise an einzelne Mitarbeiter senden.",
            "Neue persönliche Hinweise erscheinen beim Login oder während einer laufenden Sitzung als bestätigungspflichtiges Pop-up.",
            "Lesestatus und Löschrechte für Mitarbeiterhinweise werden getrennt über die Rollenberechtigungen gesteuert.",
            "Persönliche Hinweise bleiben vom allgemeinen Nachrichtenaustausch getrennt und besitzen keine Antwortfunktion."
        ]
    },
    {
        id: "sys_v6_8_3", version: "v6.8.3", date: "18.09.2026", ts: 1789711200000,
        category: "Verbesserung", title: "Navigation & Verwaltung übersichtlicher",
        changes: [
            "Die Hauptnavigation wurde übersichtlicher gruppiert; der Kalender bleibt weiterhin direkt erreichbar.",
            "Mitarbeiter-, Wissens- und Dokumentbereiche sind jetzt klarer zusammengefasst.",
            "Die Admin-Zentralverwaltung wurde nach Alltag, System und Gefahrenbereichen übersichtlicher geordnet.",
            "Rollenberechtigungen lassen sich in übersichtlichen Themenblöcken ein- und ausklappen.",
            "Mehrere kleinere Beschriftungs- und Versionsangaben wurden vereinheitlicht."
        ]
    },
    {
        id: "sys_v6_8_2", version: "v6.8.2", date: "18.09.2026", ts: 1789704000000,
        category: "Verbesserung", title: "Prüfungen & Sitzungsablauf aufgeräumt",
        changes: [
            "Die Auswahlsteuerung bei Prüfungsfragen wurde vereinheitlicht, ohne den Fragetyp optisch vorwegzunehmen.",
            "Prüfungen werden ausschließlich zentral in der MMD Cloud verwaltet."
        ]
    },
    {
        id: "sys_v6_8_1", version: "v6.8.1", date: "17.09.2026", ts: 1789628400000,
        category: "Verbesserung", title: "Dienststatus & Browser-Aktualisierung verbessert",
        changes: [
            "Master Admins können aktive Sitzungen gezielt aus dem Dienst entfernen.",
            "Neue Versionen können künftig an bereits geöffnete Browser gemeldet und automatisch neu geladen werden."
        ]
    },
    {
        id: "sys_v6_8_0e", version: "v6.8.0e", date: "17.09.2026", ts: 1789623960000,
        category: "Bugfix", title: "Registrierung wieder möglich",
        changes: [
            "Neue Mitarbeiter können ihren Account wieder zuverlässig über die Registrierung beantragen.",
            "Während des Registrierens zeigt der Button sichtbar an, dass der Antrag verarbeitet wird und verhindert versehentliche Doppelklicks.",
            "Fehler bei der Registrierung werden verständlicher angezeigt, ohne bestehende Konten oder Rollen zu verändern."
        ]
    },
    {
        id: "sys_v6_8_0", version: "v6.8.0", date: "16.09.2026", ts: 1789552800000,
        category: "Neue Funktion", title: "Sanktionskatalog hinzugefügt",
        changes: [
            "Der vollständige Sanktionskatalog ist jetzt direkt in der MMD Cloud verfügbar.",
            "Nach Paragraphen, Verstößen und Sanktionen kann schnell gesucht und gefiltert werden.",
            "Berechtigte Rollen können den Sanktionskatalog über das Stiftsymbol direkt auf der Seite bearbeiten.",
            "Ausbilder können Musterlösungen zu Prüfungen einsehen, die sie selbst bestanden haben; Ausbildungsleitung und berechtigte Leitungsrollen können alle Musterlösungen öffnen.",
            "Prüfungen werden jetzt nach einzelnen richtigen Antwortmöglichkeiten bepunktet; falsch gesetzte Antworten ziehen innerhalb der jeweiligen Frage Punkte ab, jedoch nie unter 0 Punkte.",
            "Prüfungsdetails zeigen zuerst vollständig richtige und danach falsche oder nicht vollständig richtige Antworten inklusive Punktestand und hinterlegter richtiger Lösung.",
            "Nicht bestandene Prüfungen können von berechtigten Ausbildern oder der Ausbildungsleitung zur Wiederholung freigegeben werden, ohne den Fehlversuch zu löschen.",
            "Ältere nicht bestandene Prüfungsergebnisse ohne gespeicherte Prüfungs-ID werden – wenn eindeutig möglich – über den Prüfungsnamen der aktuellen Prüfung zugeordnet und können ebenfalls wieder freigegeben werden.",
            "Die wichtigen allgemeinen Sanktionsregeln wurden deutlich größer und auffälliger hervorgehoben.",
            "Die Darstellung wurde für Computer, Tablets und Smartphones angepasst."
        ]
    },
    {
        id: "sys_v6_7_0", version: "v6.7.0", date: "16.09.2026", ts: 1789513200000,
        category: "Update", title: "Rollen & Bedienung verbessert",
        changes: [
            "Rollen und Berechtigungen wurden vereinheitlicht und zuverlässiger miteinander verknüpft.",
            "Personalabteilung und Ausbildungsleitung können Mitarbeiter freischalten und die festgelegten Rollen vergeben.",
            "CLS und EHK wurden passend zu ihren Aufgaben umbenannt.",
            "Kalendereinträge können von allen Mitarbeitern erstellt und eigene Termine wieder gelöscht werden.",
            "Der Wartungsmodus besitzt jetzt eine eigene Berechtigung.",
            "Die Bedienung auf Smartphones und kleineren Bildschirmen wurde verbessert."
        ]
    },
    {
        id: "sys_v6_6_0", version: "v6.6.0", date: "15.09.2026", ts: 1789426800000,
        category: "Update", title: "Materialliste & Wartungsmodus verbessert",
        changes: [
            "Die Materialverwaltung wurde übersichtlicher gestaltet und um die bisherigen Altbestände ergänzt.",
            "Fehlerhafte Bestandsaufnahmen können jetzt einzeln gelöscht werden.",
            "Für Wartungsarbeiten gibt es einen neuen geschützten Wartungsmodus. Dokumentation & Einsatz bleibt für alle Mitarbeiter nutzbar.",
            "Neue Registrierungen sind während Wartungsarbeiten vorübergehend nicht möglich.",
            "Der automatische Dienstlogout zum Tageswechsel wurde verbessert.",
            "Die Anzeige der Mitarbeiter im Dienst wurde für längere Namen verbessert.",
            "Die Passwortverwaltung für den Master Admin wurde verständlicher gestaltet.",
            "Hinweise und Fehlermeldungen wurden einfacher und verständlicher formuliert.",
            "Rollen und Berechtigungen wurden zuverlässiger miteinander verknüpft.",
            "Überschriften und Bezeichnungen wurden einheitlicher gestaltet."
        ]
    },
    {
        id: "sys_v6_5_0", version: "v6.5.0", date: "15.09.2026", ts: 1789423200000,
        category: "Neue Funktion", title: "Materialverwaltung hinzugefügt",
        changes: [
            "Die Chief Ebene hat einen eigenen Bereich für die Materialverwaltung erhalten.",
            "Bestände, Verbrauch und Auffüllstatus können gemeinsam gepflegt werden.",
            "Die Bestands Historie zeigt frühere Einträge übersichtlich an."
        ]
    },
    {
        id: "sys_v6_4_2", version: "v6.4.2", date: "15.09.2026", ts: 1789422000002,
        category: "Fehlerbehebung", title: "Registrierung verbessert",
        changes: [
            "Gelöschte Mitarbeiter können sich bei Bedarf wieder neu registrieren.",
            "Ausstehende Registrierungen werden zuverlässiger zur Freischaltung angezeigt."
        ]
    },
    {
        id: "sys_v6_4_0", version: "v6.4.0", date: "14.09.2026", ts: 1789422000000,
        category: "Update", title: "Anmeldung & Verwaltung verbessert",
        changes: [
            "Die Anmeldung und Freischaltung neuer Mitarbeiter wurde verbessert.",
            "Wartende, aktive und gesperrte Konten werden deutlicher unterschieden.",
            "Die Chief Ebene übernimmt die vorgesehenen Verwaltungsaufgaben."
        ]
    },
    {
        id: "sys_v6_3_0", version: "v6.3.0", date: "13.09.2026", ts: 1789335600001,
        category: "Fehlerbehebung", title: "Stabilität verbessert",
        changes: [
            "Mehrere Bereiche der Seite wurden stabilisiert.",
            "Anmeldung, Navigation und Mitarbeiterverwaltung wurden verbessert.",
            "Die Darstellung auf verschiedenen Geräten wurde überarbeitet."
        ]
    },
    {
        id: "sys_v6_2_0", version: "v6.2.0", date: "13.09.2026", ts: 1789335600000,
        category: "Update", title: "Prüfcenter & Bedienung verbessert",
        changes: [
            "Das Prüfcenter wurde übersichtlicher und zuverlässiger gemacht.",
            "Tabellen und Mitarbeiterfotos wurden besser lesbar dargestellt."
        ]
    },
    {
        id: "sys_v6_1_0", version: "v6.1.0", date: "12.09.2026", ts: 1789249200000,
        category: "Neue Funktion", title: "Wünsche & Bugs hinzugefügt",
        changes: [
            "Mitarbeiter können Wünsche und Fehler direkt über die Seite melden.",
            "Berechtigte Personen können die Meldungen prüfen und bearbeiten."
        ]
    },
    {
        id: "sys_v6_0_1", version: "v6.0.1", date: "12.09.2026", ts: 1789245600000,
        category: "Fehlerbehebung", title: "Passwort & Verwaltung verbessert",
        changes: [
            "Die Passwortverwaltung wurde zuverlässiger gemacht.",
            "Mehrere kleinere Probleme in der Mitarbeiterverwaltung wurden behoben."
        ]
    },
    {
        id: "sys_v6_0_0", version: "v6.0.0", date: "11.09.2026", ts: 1789159200000,
        category: "Update", title: "Arbeitsbereiche erweitert",
        changes: [
            "Kalender, Ausbildung und weitere Arbeitsbereiche wurden erweitert.",
            "Mehrere tägliche Abläufe können direkt über die MMD Cloud erledigt werden."
        ]
    },
    {
        id: "sys_v5_9_4", version: "v5.9.4", date: "11.09.2026", ts: 1789155600004,
        category: "Fehlerbehebung", title: "Links & Dokumente verbessert",
        changes: ["Der Bereich Links & Dokumente wurde bereinigt und stabilisiert."]
    },
    {
        id: "sys_v5_9_3", version: "v5.9.3", date: "11.09.2026", ts: 1789155600003,
        category: "Fehlerbehebung", title: "Bedienung verbessert",
        changes: ["Formulare und mehrere Bedienelemente wurden verbessert."]
    },
    {
        id: "sys_v5_9_2", version: "v5.9.2", date: "11.09.2026", ts: 1789155600002,
        category: "Fehlerbehebung", title: "Mitarbeiter & Prüfungen stabilisiert",
        changes: ["Mitarbeiterzuordnung und Prüfungsfunktionen wurden zuverlässiger gemacht."]
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

/* ── Sanktionskatalog 3.0 ─────────────────────────────────── */
const defaultSanctionsCatalog = {
    "version": "3.0",
    "entries": {
        "san_001": {
            "id": "san_001",
            "order": 1,
            "paragraph": "§1",
            "offense": "Nicht eintragen des Urlaubs",
            "sanction1": "$10.000",
            "sanction2": "$25.000",
            "sanction3": "$50.000"
        },
        "san_002": {
            "id": "san_002",
            "order": 2,
            "paragraph": "§1.1",
            "offense": "Nicht eintragen des Urlaubs Ende",
            "sanction1": "$10.000",
            "sanction2": "$25.000",
            "sanction3": "$50.000"
        },
        "san_003": {
            "id": "san_003",
            "order": 3,
            "paragraph": "§1.2",
            "offense": "Abwesenheit ohne Urlaub nach Erfolgloser Kontaktaufnahme",
            "sanction1": "Kündigung",
            "sanction2": "",
            "sanction3": ""
        },
        "san_004": {
            "id": "san_004",
            "order": 4,
            "paragraph": "§2",
            "offense": "Respektloses Verhalten",
            "sanction1": "$50.000",
            "sanction2": "$75.000",
            "sanction3": "$100.000"
        },
        "san_005": {
            "id": "san_005",
            "order": 5,
            "paragraph": "§2.1",
            "offense": "Missachten von Dienstaufgaben",
            "sanction1": "$50.000",
            "sanction2": "$75.000",
            "sanction3": "$100.000"
        },
        "san_006": {
            "id": "san_006",
            "order": 6,
            "paragraph": "§2.2",
            "offense": "Im Dienst ohne zu Arbeiten",
            "sanction1": "$50.000",
            "sanction2": "$100.000",
            "sanction3": "$200.000"
        },
        "san_007": {
            "id": "san_007",
            "order": 7,
            "paragraph": "§2.3",
            "offense": "Nicht erfüllen der Dienstlichen Aufgaben",
            "sanction1": "$50.000",
            "sanction2": "$100.000",
            "sanction3": "$200.000"
        },
        "san_008": {
            "id": "san_008",
            "order": 8,
            "paragraph": "§2.4",
            "offense": "Nicht nennen der Dienstnummer",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$100.000"
        },
        "san_009": {
            "id": "san_009",
            "order": 9,
            "paragraph": "§2.5",
            "offense": "Nicht einhalten der Hausregel",
            "sanction1": "$15.000",
            "sanction2": "$30.000",
            "sanction3": "$50.000"
        },
        "san_010": {
            "id": "san_010",
            "order": 10,
            "paragraph": "§2.6",
            "offense": "Nicht anfahren von Dispatches",
            "sanction1": "$50.000",
            "sanction2": "$100.000",
            "sanction3": "$200.000"
        },
        "san_011": {
            "id": "san_011",
            "order": 11,
            "paragraph": "§2.7",
            "offense": "Freiheitsberaubung der Patienten",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$100.000"
        },
        "san_012": {
            "id": "san_012",
            "order": 12,
            "paragraph": "§2.8",
            "offense": "Behandeln Nicht ansprechbarer Patienten",
            "sanction1": "$10.000",
            "sanction2": "$25.000",
            "sanction3": "$50.000"
        },
        "san_013": {
            "id": "san_013",
            "order": 13,
            "paragraph": "§2.9",
            "offense": "Falsche Rechnungs Stellung",
            "sanction1": "Ausgestellter betrag + 50k",
            "sanction2": "Ausgestellter betrag + 100k",
            "sanction3": "Ausgestellter betrag + 250k"
        },
        "san_014": {
            "id": "san_014",
            "order": 14,
            "paragraph": "§2.10",
            "offense": "Privat / 2Job Aktivitäten im Dienst",
            "sanction1": "$50.000 + Mahnung",
            "sanction2": "$100.000 + Mahnung",
            "sanction3": "$250.000 + Mahnung"
        },
        "san_015": {
            "id": "san_015",
            "order": 15,
            "paragraph": "§2.11",
            "offense": "Mitführen einer Waffe im Dienst",
            "sanction1": "Kündigung",
            "sanction2": "",
            "sanction3": ""
        },
        "san_016": {
            "id": "san_016",
            "order": 16,
            "paragraph": "§2.12",
            "offense": "Nicht einhalten der Funkdisziplin",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$75.000"
        },
        "san_017": {
            "id": "san_017",
            "order": 17,
            "paragraph": "§2.13",
            "offense": "Nicht einhaltung der StVO",
            "sanction1": "PD + 1 Tag Ausendienst Sperre",
            "sanction2": "PD + 3 Tage Ausendienst Sperre",
            "sanction3": "PD + 7 Tage Ausendienst Sperre"
        },
        "san_018": {
            "id": "san_018",
            "order": 18,
            "paragraph": "§2.14",
            "offense": "Nicht An- oder Abmelden zur Dienstbesprechung",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$75.000"
        },
        "san_019": {
            "id": "san_019",
            "order": 19,
            "paragraph": "§2.15",
            "offense": "Spätes An- oder Abmelden zur Dienstbesprechung",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$75.000"
        },
        "san_020": {
            "id": "san_020",
            "order": 20,
            "paragraph": "§2.16",
            "offense": "Absage ohne Absprache",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$75.000"
        },
        "san_021": {
            "id": "san_021",
            "order": 21,
            "paragraph": "§2.17",
            "offense": "Nicht Bestehen der Beobachtungsphase",
            "sanction1": "Kündigung",
            "sanction2": "",
            "sanction3": ""
        },
        "san_022": {
            "id": "san_022",
            "order": 22,
            "paragraph": "§3",
            "offense": "Weitergabe von Mitarbeiterdaten",
            "sanction1": "50k + Mahnung",
            "sanction2": "100k + Mahnung",
            "sanction3": "250k + Mahnung"
        },
        "san_023": {
            "id": "san_023",
            "order": 23,
            "paragraph": "§3.1",
            "offense": "Bruche der Ärztliche Schweigepflicht",
            "sanction1": "Kündigung",
            "sanction2": "",
            "sanction3": ""
        },
        "san_024": {
            "id": "san_024",
            "order": 24,
            "paragraph": "§4",
            "offense": "Tragen von Privatkleidung im Dienst",
            "sanction1": "$50.000",
            "sanction2": "$100.000",
            "sanction3": "$200.000"
        },
        "san_025": {
            "id": "san_025",
            "order": 25,
            "paragraph": "§4.1",
            "offense": "Tragen von Dienstkleidung wärend Privaten Zeiten",
            "sanction1": "$50.000",
            "sanction2": "$100.000",
            "sanction3": "$200.000"
        },
        "san_026": {
            "id": "san_026",
            "order": 26,
            "paragraph": "§4.2",
            "offense": "Unerlaubtes Verändern der Dienstkleidung",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$100.000"
        },
        "san_027": {
            "id": "san_027",
            "order": 27,
            "paragraph": "§4.3",
            "offense": "Tragen der Falschen Dienstkleidung",
            "sanction1": "$100.000",
            "sanction2": "$200.000",
            "sanction3": "$300.000"
        },
        "san_028": {
            "id": "san_028",
            "order": 28,
            "paragraph": "§4.4",
            "offense": "Nicht tragen der Dienstbesprechungs Uniform",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$100.000"
        },
        "san_029": {
            "id": "san_029",
            "order": 29,
            "paragraph": "§4.6",
            "offense": "Nicht tragen der Entsprechenden Abteilungs Kleidung",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$100.000"
        },
        "san_030": {
            "id": "san_030",
            "order": 30,
            "paragraph": "§4.7",
            "offense": "Tragen der Medicap und oder Medic Rucksack außer dienst",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$100.000"
        },
        "san_031": {
            "id": "san_031",
            "order": 31,
            "paragraph": "§4.8",
            "offense": "Tragen vom Winteroutfit in nicht Winterlichen Zeiten",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$100.000"
        },
        "san_032": {
            "id": "san_032",
            "order": 32,
            "paragraph": "§4.9",
            "offense": "Verlieren der Medic Tasche",
            "sanction1": "50.000$",
            "sanction2": "",
            "sanction3": ""
        },
        "san_033": {
            "id": "san_033",
            "order": 33,
            "paragraph": "§4.10",
            "offense": "Verlieren von Stethoskop oder Kugelzange",
            "sanction1": "50.000$",
            "sanction2": "",
            "sanction3": ""
        },
        "san_034": {
            "id": "san_034",
            "order": 34,
            "paragraph": "§4.11",
            "offense": "Verlieren vom MDT - Tablet",
            "sanction1": "250.000$",
            "sanction2": "",
            "sanction3": ""
        },
        "san_035": {
            "id": "san_035",
            "order": 35,
            "paragraph": "§4.12",
            "offense": "Nicht Anmelden und oder Beitreten von Funk/GPS 3",
            "sanction1": "$50.000",
            "sanction2": "$100.000",
            "sanction3": "$150.000"
        },
        "san_036": {
            "id": "san_036",
            "order": 36,
            "paragraph": "§4.13",
            "offense": "Nicht Abmelden und oder Verlassen von Funk/GPS 3",
            "sanction1": "$50.000",
            "sanction2": "$100.000",
            "sanction3": "$150.000"
        },
        "san_037": {
            "id": "san_037",
            "order": 37,
            "paragraph": "§4.14",
            "offense": "Verbleiben im Funk nach Dienstaustritt",
            "sanction1": "$50.000",
            "sanction2": "$100.000",
            "sanction3": "$150.000"
        },
        "san_038": {
            "id": "san_038",
            "order": 38,
            "paragraph": "§4.15",
            "offense": "MD Ausrüstung nicht zurückgelegt",
            "sanction1": "$100.000",
            "sanction2": "$150.000",
            "sanction3": "$200.000 + Mahnung"
        },
        "san_039": {
            "id": "san_039",
            "order": 39,
            "paragraph": "§4.16",
            "offense": "PD / DOJ Nicht infomiert",
            "sanction1": "$10.000",
            "sanction2": "$25.000",
            "sanction3": "$50.000"
        },
        "san_040": {
            "id": "san_040",
            "order": 40,
            "paragraph": "§4.18",
            "offense": "Zu lange Pause",
            "sanction1": "$150.000 + akt. Paycheck x 10",
            "sanction2": "$300.000 + akt. Paycheck x 20",
            "sanction3": "Kündigung"
        },
        "san_041": {
            "id": "san_041",
            "order": 41,
            "paragraph": "§4.19",
            "offense": "Rauchen im MD Gebäude",
            "sanction1": "$10.000",
            "sanction2": "$25.000",
            "sanction3": "$50.000"
        },
        "san_042": {
            "id": "san_042",
            "order": 42,
            "paragraph": "§5",
            "offense": "Nicht anmeldung des 2 Jobs",
            "sanction1": "$50.000",
            "sanction2": "",
            "sanction3": ""
        },
        "san_043": {
            "id": "san_043",
            "order": 43,
            "paragraph": "§6",
            "offense": "Behandlungssperren Ausnutzung",
            "sanction1": "$250.000 + Verwarnung",
            "sanction2": "$500.000 + Verwarnung",
            "sanction3": "Kündigung"
        },
        "san_044": {
            "id": "san_044",
            "order": 44,
            "paragraph": "§6.1",
            "offense": "Unerlaube Lange Behandlungssperre",
            "sanction1": "$250.000 + Mahnung",
            "sanction2": "$500.000 + Mahnung",
            "sanction3": "Kündigung"
        },
        "san_045": {
            "id": "san_045",
            "order": 45,
            "paragraph": "§6.2",
            "offense": "Ausnutzung der Sonderrechte",
            "sanction1": "$100.000",
            "sanction2": "$200.000",
            "sanction3": "$300.000"
        },
        "san_046": {
            "id": "san_046",
            "order": 46,
            "paragraph": "§7",
            "offense": "Dienstfahrzeuge für Privataktivitäten Genutzt",
            "sanction1": "$50.000",
            "sanction2": "$75.000",
            "sanction3": "$100.000"
        },
        "san_047": {
            "id": "san_047",
            "order": 47,
            "paragraph": "§7.2",
            "offense": "Nicht abschliesen von Dienstfahrzeuge",
            "sanction1": "$50.000",
            "sanction2": "$75.000",
            "sanction3": "$100.000"
        },
        "san_048": {
            "id": "san_048",
            "order": 48,
            "paragraph": "§7.3",
            "offense": "Verleihen vom Dienstfahrzeug",
            "sanction1": "$125.000",
            "sanction2": "$250.000",
            "sanction3": "$500.000"
        },
        "san_049": {
            "id": "san_049",
            "order": 49,
            "paragraph": "§7.4",
            "offense": "Unerlaubtes Mitnehmen Ziviler Personen",
            "sanction1": "Mahnung",
            "sanction2": "$250.000 + Mahnung",
            "sanction3": "$500.000 + Mahnung"
        },
        "san_050": {
            "id": "san_050",
            "order": 50,
            "paragraph": "§7.5",
            "offense": "Mitführen Illegaler Gegenstände",
            "sanction1": "Verwarnung",
            "sanction2": "",
            "sanction3": "Kündigung"
        },
        "san_051": {
            "id": "san_051",
            "order": 51,
            "paragraph": "§7.6",
            "offense": "Einmischen in Besprechungen oder Konflikten",
            "sanction1": "$100.000",
            "sanction2": "$200.000",
            "sanction3": "$300.000"
        },
        "san_052": {
            "id": "san_052",
            "order": 52,
            "paragraph": "§7.7",
            "offense": "Nicht verlassen des Einsatzortes",
            "sanction1": "$50.000",
            "sanction2": "$75.000",
            "sanction3": "$100.000"
        },
        "san_053": {
            "id": "san_053",
            "order": 53,
            "paragraph": "§8",
            "offense": "Nicht besetzen der Leitstelle",
            "sanction1": "$100.000",
            "sanction2": "$200.000",
            "sanction3": "$300.000"
        },
        "san_054": {
            "id": "san_054",
            "order": 54,
            "paragraph": "§8.4",
            "offense": "Nicht Erfüllung der Co- / Leitstellen Arbeit",
            "sanction1": "$100.000",
            "sanction2": "$200.000",
            "sanction3": "$300.000"
        },
        "san_055": {
            "id": "san_055",
            "order": 55,
            "paragraph": "§8.5",
            "offense": "Nicht ablösen der aktuellen Leitstelle",
            "sanction1": "$100.000",
            "sanction2": "$200.000",
            "sanction3": "$300.000"
        },
        "san_056": {
            "id": "san_056",
            "order": 56,
            "paragraph": "§9",
            "offense": "Fliegen ohne Flugschein oder Erlaubnis",
            "sanction1": "$125.000",
            "sanction2": "$250.000",
            "sanction3": "$500.000"
        },
        "san_057": {
            "id": "san_057",
            "order": 57,
            "paragraph": "§9.1",
            "offense": "Tragen von Schutzweste im MD",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$75.000"
        },
        "san_058": {
            "id": "san_058",
            "order": 58,
            "paragraph": "§9.2",
            "offense": "Luftrettung ohne Streife 1",
            "sanction1": "$50.000",
            "sanction2": "$75.000",
            "sanction3": "$100.000"
        },
        "san_059": {
            "id": "san_059",
            "order": 59,
            "paragraph": "§9.3",
            "offense": "Fliegen wie eine Kampfeinheit",
            "sanction1": "$100.000",
            "sanction2": "$200.000",
            "sanction3": "$300.000"
        },
        "san_060": {
            "id": "san_060",
            "order": 60,
            "paragraph": "§9.4",
            "offense": "Landen auf nicht markierten Bereichen",
            "sanction1": "$25.000",
            "sanction2": "$50.000",
            "sanction3": "$75.000"
        }
    },
    "rules": {
        "rule_1": {
            "id": "rule_1",
            "order": 1,
            "text": "3x Mahnung = 1x Verwarnung"
        },
        "rule_2": {
            "id": "rule_2",
            "order": 2,
            "text": "3x Verwarnung = Kündigung"
        },
        "rule_3": {
            "id": "rule_3",
            "order": 3,
            "text": "Jede Verwarnung kommt mit einer $150.000 Zahlung und einer 24h Außendienstsperre"
        },
        "rule_4": {
            "id": "rule_4",
            "order": 4,
            "text": "Sanktionen werden von der Chiefebene und der Personalabteilung ausgestellt"
        },
        "rule_5": {
            "id": "rule_5",
            "order": 5,
            "text": "Je nach Schwere des Vergehens kann die Strafe auch vom High Command oder der Chiefebene verschärft werden (bis hin zur Kündigung)"
        }
    },
    "updatedAt": 0,
    "updatedBy": ""
};
cachedSanctionsCatalog = JSON.parse(JSON.stringify(defaultSanctionsCatalog));

/* ── Chief Ebene: Materialverwaltung (Grundlage: SAMD-Materialliste) ── */
const CHIEF_MATERIAL_DEFS = [
    { id:'wundreiniger', name:'Wundreiniger', defaultMax:2500 },
    { id:'nahtset', name:'Nahtset', defaultMax:2500 },
    { id:'verband', name:'Verband', defaultMax:2500 },
    { id:'schiene', name:'Schiene', defaultMax:2500 },
    { id:'kuehlpack', name:'Kühlpack', defaultMax:2500 },
    { id:'medikit', name:'MediKit', defaultMax:3000 },
    { id:'schmerz5', name:'Schmerzmittel 5mg', defaultMax:2500 },
    { id:'schmerz10', name:'Schmerzmittel 10mg', defaultMax:3500 },
    { id:'schmerz15', name:'Schmerzmittel 15mg', defaultMax:2500 },
    { id:'schmerz20', name:'Schmerzmittel 20mg', defaultMax:2500 }
];
const defaultChiefMaterialConfig = Object.fromEntries(CHIEF_MATERIAL_DEFS.map(m => [m.id, m.defaultMax]));
let cachedChiefMaterialConfig = Object.assign({}, defaultChiefMaterialConfig);
let cachedChiefMaterialEntries = {};
let chiefMaterialsListenerActive = false;

/* ── Standard-Rollen & Berechtigungen ───────────────────────── */
const defaultRoles = {
    masteradmin: {
        id:'masteradmin', name:'Master Admin', color:'#eab308', icon:'👑', isSystem:true,
        isAdmin:true, isMasterAdmin:true, canViewArchive:true, canEditAllPatients:true, delCalendar:true, canManagePhotos:true, delPhotos:true,
        isInstructor:true, canManageInstructors:true, canManageExams:true,
        canPostNews:true, canApproveNews:true, canViewNewsRead:true,
        canSendEmployeeNotices:true, canViewEmployeeNoticeRead:true, delEmployeeNotices:true,
        canEditPrices:true, canEditGuide:true, canEditCommands:true, canEditLinks:true,
        canViewChiefMaterials:true, canEditChiefMaterials:true,
        canManageMemberAccess:true, canManageMaintenance:true,
        canEditSanctionsCatalog:true,
        canViewExamSolutions:true,
        delPatient:true, delArchiv:true, delGuide:true, delCommands:true, delLinks:true, delNews:true, delExams:true, delUsers:true, canManageFeedback:true, delFeedback:true,
        allowedCmdKats: [], allowedLinkKats: []
    },
    chiefebene: {
        id:'chiefebene', name:'Chief Ebene', color:'#fbbf24', icon:'⭐', isSystem:true,
        isAdmin:true, isMasterAdmin:false, canViewArchive:true, canEditAllPatients:true, delCalendar:true, canManagePhotos:true, delPhotos:true,
        isInstructor:true, canManageInstructors:true, canManageExams:true,
        canPostNews:true, canApproveNews:true, canViewNewsRead:true,
        canSendEmployeeNotices:true, canViewEmployeeNoticeRead:true, delEmployeeNotices:true,
        canEditPrices:true, canEditGuide:true, canEditCommands:true, canEditLinks:true,
        canViewChiefMaterials:true, canEditChiefMaterials:true,
        canManageMemberAccess:true, canManageMaintenance:true,
        canEditSanctionsCatalog:true,
        canViewExamSolutions:true,
        delPatient:true, delArchiv:true, delGuide:true, delCommands:true, delLinks:true, delNews:true, delExams:true, delUsers:false, canManageFeedback:true, delFeedback:true,
        allowedCmdKats: [], allowedLinkKats: []
    },
    ausbildungsleitung: {
        id:'ausbildungsleitung', name:'Ausbildungsleitung', color:'#c084fc', icon:'⚙️', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:true, canManageInstructors:true, canManageExams:true,
        canPostNews:true, canApproveNews:true, canViewNewsRead:true,
        canSendEmployeeNotices:true, canViewEmployeeNoticeRead:true, delEmployeeNotices:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        canViewChiefMaterials:false, canEditChiefMaterials:false,
        canManageMemberAccess:true, canManageMaintenance:false,
        canEditSanctionsCatalog:false,
        canViewExamSolutions:true,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:true, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Ausbildung', 'Ausbildungsabteilung', 'Abkürzungen & Dokumente', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'Ausbildung', 'MD Intern']
    },
    ausbilder: {
        id:'ausbilder', name:'Ausbilder', color:'#8b5cf6', icon:'🎓', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:true, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canSendEmployeeNotices:false, canViewEmployeeNoticeRead:false, delEmployeeNotices:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        canViewChiefMaterials:false, canEditChiefMaterials:false,
        canManageMemberAccess:false, canManageMaintenance:false,
        canEditSanctionsCatalog:false,
        canViewExamSolutions:true,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Ausbildung', 'Ausbildungsabteilung', 'Abkürzungen & Dokumente', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'MD Intern']
    },
    cls: {
        id:'cls', name:'CLS', color:'#06b6d4', icon:'💉', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canSendEmployeeNotices:false, canViewEmployeeNoticeRead:false, delEmployeeNotices:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        canViewChiefMaterials:false, canEditChiefMaterials:false,
        canManageMemberAccess:false, canManageMaintenance:false,
        canEditSanctionsCatalog:false,
        canViewExamSolutions:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Abkürzungen & Dokumente', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'CLS', 'MD Intern']
    },
    ehk: {
        id:'ehk', name:'EHK', color:'#10b981', icon:'🩺', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canSendEmployeeNotices:false, canViewEmployeeNoticeRead:false, delEmployeeNotices:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        canViewChiefMaterials:false, canEditChiefMaterials:false,
        canManageMemberAccess:false, canManageMaintenance:false,
        canEditSanctionsCatalog:false,
        canViewExamSolutions:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Abkürzungen & Dokumente', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'EHK', 'MD Intern']
    },
    luftrettung: {
        id:'luftrettung', name:'Luftrettung', color:'#0284c7', icon:'🚁', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canSendEmployeeNotices:false, canViewEmployeeNoticeRead:false, delEmployeeNotices:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        canViewChiefMaterials:false, canEditChiefMaterials:false,
        canManageMemberAccess:false, canManageMaintenance:false,
        canEditSanctionsCatalog:false,
        canViewExamSolutions:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Abkürzungen & Dokumente', 'Allgemein', 'T-Codes'],
        allowedLinkKats: ['MD Intern']
    },
    psychologie: {
        id:'psychologie', name:'Psychologie', color:'#ec4899', icon:'🧠', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false, delCalendar:true, canManagePhotos:false, delPhotos:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:true, canApproveNews:false, canViewNewsRead:true,
        canSendEmployeeNotices:false, canViewEmployeeNoticeRead:false, delEmployeeNotices:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        canViewChiefMaterials:false, canEditChiefMaterials:false,
        canManageMemberAccess:false, canManageMaintenance:false,
        canEditSanctionsCatalog:false,
        canViewExamSolutions:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Abkürzungen & Dokumente', 'Psychologie', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'MD Intern', 'Psychologie']
    },
    personalabteilung: {
        id:'personalabteilung', name:'Personalabteilung', color:'#ec4899', icon:'💼', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false, delCalendar:false, canManagePhotos:true, delPhotos:true,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:true, canApproveNews:true, canViewNewsRead:true,
        canSendEmployeeNotices:true, canViewEmployeeNoticeRead:true, delEmployeeNotices:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        canViewChiefMaterials:false, canEditChiefMaterials:false,
        canManageMemberAccess:true, canManageCareerPaths:true, canViewPersonnelRecords:true, canManagePersonnelRecords:true, canManagePersonnelAbsences:true, canManagePersonnelRanks:true, canCreateEmployees:true, canManageMaintenance:false,
        canEditSanctionsCatalog:true,
        canViewExamSolutions:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:true, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Abkürzungen & Dokumente', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'MD Intern']
    },
    mitarbeiter: {
        id:'mitarbeiter', name:'Mitarbeiter', color:'#64748b', icon:'👨‍⚕️', isSystem:true,
        isAdmin:false, isMasterAdmin:false, canViewArchive:false, canEditAllPatients:false, delCalendar:false, canManagePhotos:false, delPhotos:false,
        isInstructor:false, canManageInstructors:false, canManageExams:false,
        canPostNews:false, canApproveNews:false, canViewNewsRead:false,
        canSendEmployeeNotices:false, canViewEmployeeNoticeRead:false, delEmployeeNotices:false,
        canEditPrices:false, canEditGuide:false, canEditCommands:false, canEditLinks:false,
        canViewChiefMaterials:false, canEditChiefMaterials:false,
        canManageMemberAccess:false, canManageMaintenance:false,
        canEditSanctionsCatalog:false,
        canViewExamSolutions:false,
        delPatient:false, delArchiv:false, delGuide:false, delCommands:false, delLinks:false, delNews:false, delExams:false, delUsers:false, canManageFeedback:false, delFeedback:false,
        allowedCmdKats: ['Abkürzungen & Dokumente', 'T-Codes'],
        allowedLinkKats: ['Allgemein', 'MD Intern']
    }
};
let cachedRoles = Object.assign({}, defaultRoles);

// Feste Anzeige-Reihenfolge der Standardrollen. Die internen Rollen-IDs bleiben unverändert.
const ROLE_DISPLAY_ORDER = [
    'masteradmin',
    'chiefebene',
    'ausbildungsleitung',
    'ausbilder',
    'personalabteilung',
    'psychologie',
    'cls',
    'ehk',
    'luftrettung',
    'mitarbeiter'
];

const SYSTEM_ROLE_DISPLAY_NAMES = {
    masteradmin: 'Master Admin',
    chiefebene: 'Chief Ebene',
    ausbildungsleitung: 'Ausbildungsleitung',
    ausbilder: 'Ausbilder',
    personalabteilung: 'Personalabteilung',
    psychologie: 'Psychologie',
    cls: 'CLS',
    ehk: 'EHK',
    luftrettung: 'Luftrettung',
    mitarbeiter: 'Mitarbeiter'
};

function normalizeSystemRoleDisplayData(rolesObj) {
    const roles = rolesObj || {};
    Object.entries(SYSTEM_ROLE_DISPLAY_NAMES).forEach(([roleId, displayName]) => {
        if (roles[roleId]) roles[roleId].name = displayName;
    });
    return roles;
}

// Systemrollen werden feldweise mit ihren Standards zusammengeführt.
// Neue Berechtigungen erhalten dadurch einen definierten Standardwert,
// während bewusst gespeicherte true/false-Werte erhalten bleiben.
function mergeRolesWithDefaults(serverRoles = {}) {
    const merged = {};
    Object.entries(defaultRoles).forEach(([roleId, defaults]) => {
        merged[roleId] = Object.assign({}, defaults, serverRoles[roleId] || {});
    });
    Object.entries(serverRoles || {}).forEach(([roleId, role]) => {
        if (!merged[roleId]) merged[roleId] = Object.assign({}, role);
    });
    delete merged.admin;
    return normalizeSystemRoleDisplayData(merged);
}

function sortRolesForDisplay(roleList) {
    const orderMap = new Map(ROLE_DISPLAY_ORDER.map((id, index) => [id, index]));
    return [...(roleList || [])].sort((a, b) => {
        const ai = orderMap.has(a?.id) ? orderMap.get(a.id) : 999;
        const bi = orderMap.has(b?.id) ? orderMap.get(b.id) : 999;
        if (ai !== bi) return ai - bi;
        return (a?.name || '').localeCompare(b?.name || '', 'de');
    });
}

const ROLE_PROPERTY_MAP = {
    roleFlagAdmin: 'isAdmin',
    roleFlagMasterAdmin: 'isMasterAdmin',
    delFlagUsers: 'delUsers',
    roleFlagManageFeedback: 'canManageFeedback',
    delFlagFeedback: 'delFeedback',
    roleFlagViewChiefMaterials: 'canViewChiefMaterials',
    roleFlagEditChiefMaterials: 'canEditChiefMaterials',
    roleFlagEditPrices: 'canEditPrices',
    roleFlagArchive: 'canViewArchive',
    roleFlagEditAllPatients: 'canEditAllPatients',
    delFlagPatient: 'delPatient',
    delFlagArchiv: 'delArchiv',
    roleFlagManagePhotos: 'canManagePhotos',
    delFlagPhotos: 'delPhotos',
    roleFlagManageMemberAccess: 'canManageMemberAccess',
    roleFlagManageCareerPaths: 'canManageCareerPaths',
    roleFlagViewPersonnelRecords: 'canViewPersonnelRecords',
    roleFlagManagePersonnelRecords: 'canManagePersonnelRecords',
    roleFlagManagePersonnelAbsences: 'canManagePersonnelAbsences',
    roleFlagManagePersonnelRanks: 'canManagePersonnelRanks',
    roleFlagCreateEmployees: 'canCreateEmployees',
    roleFlagManageMaintenance: 'canManageMaintenance',
    roleFlagEditSanctionsCatalog: 'canEditSanctionsCatalog',
    delFlagCalendar: 'delCalendar',
    roleFlagPostNews: 'canPostNews',
    roleFlagApproveNews: 'canApproveNews',
    roleFlagViewNewsRead: 'canViewNewsRead',
    delFlagNews: 'delNews',
    roleFlagSendEmployeeNotices: 'canSendEmployeeNotices',
    roleFlagViewEmployeeNoticeRead: 'canViewEmployeeNoticeRead',
    delFlagEmployeeNotices: 'delEmployeeNotices',
    roleFlagInstructor: 'isInstructor',
    roleFlagManageInstructors: 'canManageInstructors',
    roleFlagManageExams: 'canManageExams',
    roleFlagViewExamSolutions: 'canViewExamSolutions',
    delFlagExams: 'delExams',
    roleFlagEditGuide: 'canEditGuide',
    delFlagGuide: 'delGuide',
    roleFlagEditCommands: 'canEditCommands',
    delFlagCommands: 'delCommands',
    roleFlagEditLinks: 'canEditLinks',
    delFlagLinks: 'delLinks'
};

// Zentrale Liste aller wirksamen Server-Berechtigungen.
// Sie wird direkt aus dem Rollen-Editor abgeleitet, damit neue Rechte nicht
// im Editor vorhanden sein können, aber in der Laufzeitberechnung fehlen.
const SERVER_PERMISSION_KEYS = [...new Set(Object.values(ROLE_PROPERTY_MAP))];

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
    cmd_9: { name:"!ehkleiter",   desc:"Ausbildung zum EHK", kat:"Ausbildungsabteilung" },
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

/* Prüfungen werden ausschließlich in Firebase verwaltet. */

/* ── Audit Logger ──────────────────────────────────────────── */

/* ── Wartungsmodus ─────────────────────────────────────────── */
function canUserManageMaintenance(user = sessionUser) {
    if (!user) return false;
    const eff = getUserEffectivePermissions(user);
    return !!(eff.isMasterAdmin || eff.canManageMaintenance);
}

function canCurrentUserManageMaintenance() {
    return canUserManageMaintenance(sessionUser);
}

function normalizeMaintenanceState(raw) {
    const x = raw && typeof raw === 'object' ? raw : {};
    return {
        enabled: x.enabled === true,
        startedAt: Number(x.startedAt) || 0,
        startedBy: String(x.startedBy || ''),
        message: String(x.message || '')
    };
}

async function readMaintenanceState() {
    try {
        if (!auth.currentUser) {
            const snap = await db.ref('data/systemStatus/maintenance/enabled').once('value');
            cachedMaintenanceState = { enabled: snap.val() === true, startedAt:0, startedBy:'', message:'' };
        } else {
            const snap = await db.ref('data/systemStatus/maintenance').once('value');
            cachedMaintenanceState = normalizeMaintenanceState(snap.val());
        }
    } catch (err) {
        console.error('Wartungsstatus konnte nicht geladen werden:', err);
        cachedMaintenanceState = { enabled:false, startedAt:0, startedBy:'', message:'' };
    }
    return cachedMaintenanceState;
}

function isMaintenanceRestrictedSession() {
    return !!(sessionUser && cachedMaintenanceState.enabled && !canUserManageMaintenance(sessionUser));
}

function updateMaintenanceBanner() {
    const banner = document.getElementById('maintenanceModeBanner');
    if (!banner) return;
    if (!cachedMaintenanceState.enabled) {
        banner.style.display = 'none';
        banner.textContent = '';
        return;
    }
    banner.style.display = 'flex';
    const suffix = cachedMaintenanceState.message ? ` – ${cachedMaintenanceState.message}` : '';
    banner.textContent = `🛠️ Wartungsmodus aktiv${suffix}`;
}

function applyMaintenanceAccessMode(showNotice = false) {
    updateMaintenanceBanner();
    if (!sessionUser) return;
    const restricted = isMaintenanceRestrictedSession();
    document.body.classList.toggle('maintenance-restricted', restricted);

    document.querySelectorAll('.tab-nav .tab-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        const isDoc = onclick.includes("switchTab('docTab'");
        if (restricted) {
            btn.dataset.maintenancePrevDisplay = btn.style.display || '';
            btn.style.display = isDoc ? '' : 'none';
        } else if (btn.dataset.maintenancePrevDisplay !== undefined) {
            btn.style.display = btn.dataset.maintenancePrevDisplay;
            delete btn.dataset.maintenancePrevDisplay;
        }
    });

    const adminBtn = document.getElementById('adminKeyBtn');
    const feedbackBtn = document.querySelector('.btn-feedback-trigger');
    const restrictedControls = [
        document.getElementById('btnEditPricesInline'),
        document.getElementById('btnEditSzenarienInline'),
        document.getElementById('btnManualProtArchive'),
        document.getElementById('globalSearchBtn'),
        document.getElementById('myOpenItemsBtn'),
        document.getElementById('todayOverview')
    ].filter(Boolean);
    if (restricted) {
        if (adminBtn) adminBtn.style.display = 'none';
        if (feedbackBtn) feedbackBtn.style.display = 'none';
        restrictedControls.forEach(el => {
            if (el.dataset.maintenancePrevDisplay === undefined) el.dataset.maintenancePrevDisplay = el.style.display || '';
            el.style.display = 'none';
        });
        if (!document.getElementById('docTab')?.classList.contains('active')) {
            switchTab('docTab', document.querySelector('.tab-nav .tab-btn'));
        }
        document.querySelectorAll('.modal-overlay').forEach(m => { if (m.style.display === 'flex') m.style.display = 'none'; });
        if (showNotice) alert('🛠️ Es finden aktuell Wartungsarbeiten statt. Dokumentation & Einsatz bleibt für den Dienstbetrieb verfügbar.');
    } else {
        if (feedbackBtn) feedbackBtn.style.display = '';
        restrictedControls.forEach(el => {
            if (el.dataset.maintenancePrevDisplay !== undefined) {
                el.style.display = el.dataset.maintenancePrevDisplay;
                delete el.dataset.maintenancePrevDisplay;
            }
        });
    }
}

function startMaintenanceStatusListener() {
    const ref = db.ref('data/systemStatus/maintenance');
    ref.off();
    maintenanceModeListenerActive = true;
    maintenanceRestrictedLast = isMaintenanceRestrictedSession();
    ref.on('value', snap => {
        const before = maintenanceRestrictedLast;
        cachedMaintenanceState = normalizeMaintenanceState(snap.val());
        const after = isMaintenanceRestrictedSession();
        maintenanceRestrictedLast = after;
        renderMaintenanceAdminPanel();
        renderAdminOverview();
        applyMaintenanceAccessMode(!before && after);
        if (before !== after) {
            if (!after && sessionUser) applyUserPermissions(sessionUser);
            startFirebaseListeners();
        }
    }, err => console.error('Wartungsstatus konnte nicht aktualisiert werden:', err));
}

function renderMaintenanceAdminPanel() {
    const box = document.getElementById('maintenanceAdminPanel');
    if (!box) return;
    const canManage = canCurrentUserManageMaintenance();
    const stateText = document.getElementById('maintenanceStatusText');
    const details = document.getElementById('maintenanceStatusDetails');
    const btnOn = document.getElementById('btnEnableMaintenance');
    const btnOff = document.getElementById('btnDisableMaintenance');
    const msg = document.getElementById('maintenanceMessageInput');
    if (stateText) {
        stateText.textContent = cachedMaintenanceState.enabled ? '🟠 Wartungsmodus ist aktiv' : '🟢 Normalbetrieb';
        stateText.className = cachedMaintenanceState.enabled ? 'maintenance-state active' : 'maintenance-state';
    }
    if (details) {
        if (cachedMaintenanceState.enabled) {
            const when = cachedMaintenanceState.startedAt ? new Date(cachedMaintenanceState.startedAt).toLocaleString('de-DE') : '--';
            details.textContent = `Aktiviert von ${cachedMaintenanceState.startedBy || 'Berechtigte Verwaltung'} · ${when}`;
        } else {
            details.textContent = 'Alle Bereiche stehen den jeweils berechtigten Mitarbeitern normal zur Verfügung.';
        }
    }
    if (msg && document.activeElement !== msg) msg.value = cachedMaintenanceState.message || '';
    if (btnOn) { btnOn.style.display = canManage && !cachedMaintenanceState.enabled ? 'inline-flex' : 'none'; btnOn.disabled = !canManage; }
    if (btnOff) { btnOff.style.display = canManage && cachedMaintenanceState.enabled ? 'inline-flex' : 'none'; btnOff.disabled = !canManage; }
}

async function setMaintenanceMode(enabled) {
    if (!canCurrentUserManageMaintenance()) {
        alert('Du hast dafür keine Berechtigung.');
        return;
    }
    const msg = (document.getElementById('maintenanceMessageInput')?.value || '').trim();
    const question = enabled
        ? 'Wartungsmodus jetzt aktivieren? Alle Mitarbeiter behalten Zugriff auf „Dokumentation & Einsatz“. Andere Bereiche stehen währenddessen nur Personen mit entsprechender Wartungsberechtigung zur Verfügung.'
        : 'Wartungsmodus jetzt beenden und den normalen Zugriff wieder freigeben?';
    if (!confirm(question)) return;
    const payload = enabled ? {
        enabled: true,
        startedAt: Date.now(),
        startedBy: `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim(),
        startedById: getUserAccountId(sessionUser),
        message: msg
    } : {
        enabled: false,
        startedAt: 0,
        startedBy: '',
        startedById: '',
        message: ''
    };
    try {
        await db.ref('data/systemStatus/maintenance').set(payload);
        logAdminAudit(enabled ? 'Wartungsmodus aktiviert' : 'Wartungsmodus beendet', enabled ? 'Wartungsarbeiten wurden gestartet.' : 'Wartungsarbeiten wurden beendet.');
        showToast(enabled ? '✅ Wartungsmodus wurde aktiviert.' : '✅ Wartungsmodus wurde beendet.', 'success');
    } catch (err) {
        console.error('Wartungsmodus konnte nicht geändert werden:', err);
        alert('Die Einstellung konnte nicht gespeichert werden. Bitte versuche es erneut.');
    }
}

function logAdminAudit(action, details) {
    if (!sessionUser) return;
    db.ref('data/auditLogs').push({
        action: action,
        details: details,
        admin: (sessionUser.vorname || '') + ' ' + (sessionUser.nachname || ''),
        ts: Date.now()
    });
};

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
    // Kompatibilität für alte Konten: Die frühere Rolle "admin" wird seit v6.4.0 als Chief Ebene behandelt.
    list = list.map(roleId => roleId === 'admin' ? 'chiefebene' : roleId);
    if (user.isMasterAdmin && !list.includes('masteradmin')) {
        list.unshift('masteradmin');
    }
    return [...new Set(list)];
}

function getUserEffectivePermissions(user) {
    const eff = Object.fromEntries(SERVER_PERMISSION_KEYS.map(key => [key, false]));
    // Grundrecht: Jeder freigeschaltete Mitarbeiter darf Kalendereinträge erstellen.
    // Das ist absichtlich kein Rollen-Häkchen.
    eff.canCreateCalendar = true;
    eff.allowedCmdKats = [];
    eff.allowedLinkKats = [];
    if (!user) return eff;

    const roleIds = getUserRolesList(user);
    let accumulatedCmdKats = [];
    let accumulatedLinkKats = [];
    let unrestrictedCmds = false;
    let unrestrictedLinks = false;

    roleIds.forEach(rId => {
        const role = cachedRoles[rId] || defaultRoles[rId];
        if (!role) return;

        const cmdKats = normalizeKats(role.allowedCmdKats);
        const linkKats = normalizeKats(role.allowedLinkKats);
        if (cmdKats.length === 0) unrestrictedCmds = true;
        else accumulatedCmdKats.push(...cmdKats);
        if (linkKats.length === 0) unrestrictedLinks = true;
        else accumulatedLinkKats.push(...linkKats);

        SERVER_PERMISSION_KEYS.forEach(prop => {
            if (role[prop] === true) eff[prop] = true;
        });
    });

    const isMaster = !!user.isMasterAdmin || roleIds.includes('masteradmin');
    if (isMaster) {
        SERVER_PERMISSION_KEYS.forEach(k => { eff[k] = true; });
        eff.canCreateCalendar = true;
        eff.allowedCmdKats = [];
        eff.allowedLinkKats = [];
        return eff;
    }

    eff.allowedCmdKats = unrestrictedCmds ? [] : [...new Set(accumulatedCmdKats)];
    eff.allowedLinkKats = unrestrictedLinks ? [] : [...new Set(accumulatedLinkKats)];
    return eff;
}

function buildServerPermissions(user) {
    const eff = getUserEffectivePermissions(user || {});
    const out = {};
    SERVER_PERMISSION_KEYS.forEach(key => { out[key] = !!eff[key]; });
    return out;
}

async function syncServerPermissionsForAllUsers() {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isAdmin && !eff.isMasterAdmin) return;
    const snap = await db.ref('data/users').once('value');
    const users = snap.val() || {};
    const updates = {};
    Object.entries(users).forEach(([uId, user]) => {
        const expected = buildServerPermissions(user);
        const current = user?.serverPermissions || {};
        const differs = SERVER_PERMISSION_KEYS.some(key => !!current[key] !== !!expected[key]);
        if (differs) updates[`data/users/${uId}/serverPermissions`] = expected;
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

function requireMasterAdminAccess(message = 'Diese Funktion ist nur für Master Admins verfügbar!') {
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
    if (!eff.isMasterAdmin && !eff.isAdmin && !eff.canManageMemberAccess) return false;
    const target = cachedUsers[uId];
    if (target && isPrivilegedUser(target) && !eff.isMasterAdmin) return false;
    return true;
}

function requireTargetUserManagement(uId) {
    if (canCurrentUserManageTargetUser(uId)) return true;
    alert('Privilegierte Admin Konten dürfen nur von einem Master Admin verändert werden!');
    return false;
}

function canCurrentUserManageExams() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    return !!(eff.canManageExams || eff.isMasterAdmin);
}

function canUserManageEmployeePhotos() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    return !!(eff.canManagePhotos || eff.isMasterAdmin);
}

function isUserInstructor() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    return !!(eff.isInstructor || eff.canManageInstructors || eff.isMasterAdmin);
}

function canUserAccessInstructorArea() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    return !!(isUserInstructor() || eff.canManageMemberAccess || eff.canViewExamSolutions || eff.isMasterAdmin);
}

function canInstructorAccessExam(examId) {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    if (eff.isMasterAdmin || eff.canManageInstructors || eff.canManageExams) {
        return true;
    }
    const myPassed = (sessionUser.passedExams) || (cachedUsers[getUserAccountId(sessionUser)]?.passedExams) || {};
    return !!myPassed[examId];
}

function canCurrentUserViewExamSolutions() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    return !!(eff.isMasterAdmin || eff.canViewExamSolutions);
}

function canCurrentUserViewExamSolution(examId) {
    if (!sessionUser || !examId) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    if (eff.isMasterAdmin) return true;
    if (!eff.canViewExamSolutions) return false;

    // Leitungs-/Prüfungsverwaltung darf die hinterlegten Musterlösungen aller Prüfungen sehen.
    if (eff.canManageInstructors || eff.canManageExams) return true;

    // Reine Ausbilder bzw. andere Rollen mit diesem Recht sehen nur Prüfungen,
    // die sie selbst bereits erfolgreich bestanden haben.
    const accountId = getUserAccountId(sessionUser);
    const me = cachedUsers[accountId] || sessionUser || {};
    const passed = me.passedExams || {};
    return passed[examId] === true;
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

async function loadAuthenticatedProfile(firebaseUser) {
    if (!firebaseUser) throw new Error('Keine aktive Anmeldung vorhanden.');
    const indexSnap = await db.ref(`data/authIndex/${firebaseUser.uid}`).once('value');
    const uId = indexSnap.val();
    if (!uId || typeof uId !== 'string') {
        throw new Error('Dieser Zugang ist keinem Mitarbeiterkonto zugeordnet.');
    }

    const userSnap = await db.ref(`data/users/${uId}`).once('value');
    const user = userSnap.val();
    if (!user) throw new Error('Das zugehörige MD Mitarbeiterkonto wurde nicht gefunden.');
    if (user.authUid && user.authUid !== firebaseUser.uid) {
        throw new Error('Dieser Zugang wurde ersetzt. Bitte melde dich erneut an.');
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
        const e = new Error('Dieser ältere Account muss noch umgestellt werden. Bitte den Master Admin kontaktieren.');
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
            'Dein bisheriges MD Passwort ist kürzer als die erforderlichen 6 Zeichen.\n\n' +
            'Bitte lege jetzt einmalig ein neues Passwort mit mindestens 6 Zeichen fest. Dieses neue Passwort gilt anschließend für deine MD Anmeldung.'
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
    if (!auth.currentUser) throw new Error('Keine aktive Anmeldung für die Passwortänderung vorhanden.');

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
            const e = new Error('Für diesen Namen bestehen bereits mehrere ältere Zugänge. Bitte den Master Admin kontaktieren.');
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
            const e = new Error('Ein älterer Zugang blockiert diese Registrierung. Bitte den Master Admin kontaktieren.');
            e.code = 'mmd/old-auth-account-conflict';
            throw e;
        }
        throw err;
    }
}

async function handleAuthAction() {
    const actionTab = currentAuthTab;
    const isRegisterAction = actionTab === 'register';
    const actionBtn = document.getElementById('mainAuthActionBtn');
    const v = (document.getElementById('authVorname')?.value || '').trim();
    const n = (document.getElementById('authNachname')?.value || '').trim();
    const p = (document.getElementById('authPassword')?.value || '').trim();
    if (!v || !n || !p) { alert('Bitte alle Felder ausfüllen!'); return; }
    const loginKey = generateUserId(v, n);

    let dn = '';
    if (isRegisterAction) {
        dn = (document.getElementById('authDN')?.value || '').trim();
        if (!dn) { alert('Bitte Dienstnummer eingeben!'); return; }
        if (p.length < 6) { alert('Das Passwort muss mindestens 6 Zeichen lang sein!'); return; }
    }

    if (actionBtn) {
        actionBtn.disabled = true;
        actionBtn.setAttribute('aria-busy', 'true');
        actionBtn.textContent = isRegisterAction ? '⏳ Registrierung wird gesendet …' : '⏳ Anmeldung läuft …';
    }

    try {
        await configureFirebaseAuthPersistence();

        if (isRegisterAction) {
            const maintenance = await readMaintenanceState();
            if (maintenance.enabled) {
                alert('🛠️ Eine Registrierung ist während der Wartungsarbeiten vorübergehend nicht möglich. Bitte versuche es später erneut.');
                return;
            }

            await registerNewFirebaseUser(v, n, p, dn);
            alert('Registrierung erfolgreich! Bitte warte auf die Freischaltung durch die Leitung.');
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

        cachedMaintenanceState = await readMaintenanceState();
        profile = await forcePasswordChangeAfterTransition(profile);
        initDienstEintritt(profile.user);
    } catch (err) {
        console.error(isRegisterAction ? 'Registrierungsfehler:' : 'Anmeldefehler:', err);
        try { await auth.signOut(); } catch (_) {}

        if (isRegisterAction) {
            if (err?.code === 'mmd/already-registered') {
                alert('Dieser Name ist bereits registriert. Bitte prüfe Vor- und Nachnamen.');
            } else if (err?.code === 'auth/weak-password') {
                alert('Das Passwort ist zu schwach. Bitte verwende mindestens 6 Zeichen.');
            } else if (err?.code === 'mmd/registration-version-exhausted' || err?.code === 'mmd/old-auth-account-conflict') {
                alert(err.message || 'Für diesen Namen besteht bereits ein älterer Zugang. Bitte den Master Admin kontaktieren.');
            } else {
                alert('Die Registrierung konnte nicht abgeschlossen werden. Bitte prüfe deine Angaben und versuche es erneut.');
            }
        } else if (err?.code === 'mmd/invalid-credentials') {
            alert('Falscher Name oder falsches Passwort!');
        } else if (err?.code === 'mmd/password-change-required') {
            alert(err.message);
        } else {
            alert('Die Anmeldung konnte nicht abgeschlossen werden. Bitte prüfe deine Angaben und versuche es erneut.');
        }
    } finally {
        if (actionBtn) {
            actionBtn.disabled = false;
            actionBtn.removeAttribute('aria-busy');
            actionBtn.textContent = currentAuthTab === 'register' ? 'Account beantragen' : 'Dienst antreten';
        }
    }
}

/* ── Tägliches Zwangs-Logout zum Tageswechsel ──────────────── */
function setupDailyForcedLogoutScheduler() {
    if (dailyForcedLogoutIntervalId) clearInterval(dailyForcedLogoutIntervalId);
    if (dailyForcedLogoutTimeoutId) clearTimeout(dailyForcedLogoutTimeoutId);

    checkDailyForcedLogout();
    dailyForcedLogoutIntervalId = setInterval(checkDailyForcedLogout, 15000);

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 2, 0);
    dailyForcedLogoutTimeoutId = setTimeout(() => checkDailyForcedLogout(), Math.max(1000, nextMidnight.getTime() - now.getTime()));

    if (!dailyLogoutEventsBound) {
        dailyLogoutEventsBound = true;
        document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDailyForcedLogout(); });
        window.addEventListener('focus', checkDailyForcedLogout);
        window.addEventListener('pageshow', checkDailyForcedLogout);
    }
}

function checkDailyForcedLogout() {
    if (!sessionUser) return;
    const todayFormatted = new Date().toLocaleDateString('de-DE');
    const sessionDate = getStoredSessionDate();
    if (sessionDate && sessionDate !== todayFormatted) executeDailyForcedLogout();
}

async function executeDailyForcedLogout() {
    if (!sessionUser) return;
    await performManagedLogout('🛑 Der vorherige Dienst wurde zum Tageswechsel automatisch beendet. Bitte melde dich für den neuen Dienst erneut an.');
}

/* ── Dienst-Start & App Init ───────────────────────────────── */
function applyUserPermissions(user) {
    if (!user) return;
    const eff = getUserEffectivePermissions(user);
    const canManagePhotos = canUserManageEmployeePhotos();
    const isMaster = !!eff.isMasterAdmin;
    const isAdminOrMaster = (eff.isAdmin || isMaster);
    const canPostDirect = !!(eff.canPostNews || isMaster);
    const canAccessPersonnel = !!(eff.canManageCareerPaths || eff.canViewPersonnelRecords || eff.canManagePersonnelRecords || eff.canManagePersonnelAbsences || eff.canManagePersonnelRanks || eff.canCreateEmployees || isMaster);
    renderCareerManagementPanel();
    if (typeof refreshPersonnelModule === 'function') refreshPersonnelModule();

    const personnelTabBtn = document.getElementById('personnelTabNavBtn');
    if (personnelTabBtn) personnelTabBtn.style.display = canAccessPersonnel ? 'inline-flex' : 'none';
    if (!canAccessPersonnel && document.getElementById('personnelTab')?.classList.contains('active')) {
        switchTab('docTab', document.querySelector('.tab-nav .tab-btn'));
    }
    
    const akBtn = document.getElementById('adminKeyBtn');
    if (akBtn) akBtn.style.display = (isAdminOrMaster || eff.canManageMaintenance) ? 'inline-block' : 'none';

    const maintenanceAdminTabBtn = document.getElementById('btnAdminSubMaintenance');
    if (maintenanceAdminTabBtn) maintenanceAdminTabBtn.style.display = canUserManageMaintenance(user) ? 'inline-flex' : 'none';
    if (!canUserManageMaintenance(user) && document.getElementById('adminSubTabMaintenance')?.classList.contains('active')) {
        switchAdminTab('adminSubTabUsers', document.getElementById('btnAdminSubUsers'));
    }

    const sessionsAdminTabBtn = document.getElementById('btnAdminSubSessions');
    if (sessionsAdminTabBtn) sessionsAdminTabBtn.style.display = isMaster ? 'inline-flex' : 'none';
    if (!isMaster && document.getElementById('adminSubTabSessions')?.classList.contains('active')) {
        switchAdminTab('adminSubTabUsers', document.getElementById('btnAdminSubUsers'));
    }

    const systemAdminTabBtn = document.getElementById('btnAdminSubSystem');
    if (systemAdminTabBtn) systemAdminTabBtn.style.display = isMaster ? 'inline-flex' : 'none';
    if (!isMaster && document.getElementById('adminSubTabSystem')?.classList.contains('active')) {
        switchAdminTab('adminSubTabUsers', document.getElementById('btnAdminSubUsers'));
    }

    const canManageFeedback = !!(eff.canManageFeedback || isMaster);
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
    if (gEdit) gEdit.style.display = (eff.canEditGuide || eff.delGuide || isMaster) ? 'inline-block' : 'none';

    const cEdit = document.getElementById('btnEditCommandsInline');
    if (cEdit) cEdit.style.display = (eff.canEditCommands || eff.delCommands || isMaster) ? 'inline-block' : 'none';

    const lEdit = document.getElementById('btnEditLinksInline');
    if (lEdit) lEdit.style.display = (eff.canEditLinks || eff.delLinks || isMaster) ? 'inline-block' : 'none';

    const hEdit = document.getElementById('btnEditHierarchieInline');
    if (hEdit) hEdit.style.display = isAdminOrMaster ? 'inline-block' : 'none';

    const gehaltEdit = document.getElementById('btnEditGehaltInline');
    if (gehaltEdit) gehaltEdit.style.display = isAdminOrMaster ? 'inline-block' : 'none';

    const sanctionsEdit = document.getElementById('btnEditSanctionsCatalog');
    if (sanctionsEdit) sanctionsEdit.style.display = (eff.canEditSanctionsCatalog || isMaster) ? 'inline-block' : 'none';

    const chiefBtn = document.getElementById('chiefTabNavBtn');
    const canViewChief = !!(eff.canViewChiefMaterials || eff.canEditChiefMaterials || isMaster);
    if (chiefBtn) chiefBtn.style.display = canViewChief ? 'inline-flex' : 'none';
    if (!canViewChief && document.getElementById('chiefTab')?.classList.contains('active')) {
        switchTab('docTab', document.querySelector('.tab-nav .tab-btn'));
    }
    refreshChiefMaterialsListener();

    const grpArchiv = document.getElementById('group-archiv');
    if (grpArchiv) grpArchiv.style.display = (eff.canViewArchive || isMaster) ? 'block' : 'none';

    const npBtn = document.getElementById('btnOpenPostNews');
    if (npBtn) npBtn.style.display = canPostDirect ? 'inline-block' : 'none';

    const employeeNoticeBtn = document.getElementById('btnOpenEmployeeNoticeComposer');
    const employeeNoticePerms = getEmployeeNoticePermissions();
    if (employeeNoticeBtn) employeeNoticeBtn.style.display = employeeNoticePerms.canSend ? 'inline-flex' : 'none';
    refreshEmployeeNoticeListeners();

    const propNewsBtn = document.getElementById('btnProposeNews');
    if (propNewsBtn) propNewsBtn.style.display = canPostDirect ? 'none' : 'inline-block';

    const btnCal = document.getElementById('btnCreateCalendarEvent');
    if (btnCal) btnCal.style.display = 'inline-block';

    const btnPhotoAdmin = document.getElementById('btnOpenPhotoAdminModal');
    if (btnPhotoAdmin) btnPhotoAdmin.style.display = canManagePhotos ? 'inline-block' : 'none';

    const btnPhotoChecklist = document.getElementById('btnTogglePhotoChecklist');
    const photoChecklistPanel = document.getElementById('staffPhotoChecklistPanel');
    if (btnPhotoChecklist) btnPhotoChecklist.style.display = isMaster ? 'inline-flex' : 'none';
    if (!isMaster && photoChecklistPanel) photoChecklistPanel.style.display = 'none';
    if (isMaster) renderStaffPhotoChecklist();

    const instrView = document.getElementById('examInstructorView');
    if (instrView) instrView.style.display = canUserAccessInstructorArea() ? 'block' : 'none';

    const allowedExamsBtn = document.getElementById('instrAllowedExamsTabBtn');
    if (allowedExamsBtn) allowedExamsBtn.style.display = (eff.canManageMemberAccess || isMaster) ? '' : 'none';

    const instrManageBtn = document.getElementById('instrTabManageBtn');
    if (instrManageBtn) instrManageBtn.style.display = (eff.canManageExams || isMaster) ? '' : 'none';

    const instrSolutionsBtn = document.getElementById('instrTabSolutionsBtn');
    if (instrSolutionsBtn) instrSolutionsBtn.style.display = (eff.canViewExamSolutions || isMaster) ? '' : 'none';

    const instructorCoreAccess = !!(eff.isInstructor || eff.canManageInstructors || eff.isMasterAdmin);
    const instrUnlocksBtn = document.getElementById('instrTabUnlocksBtn');
    const instrResultsBtn = document.getElementById('instrTabResultsBtn');
    if (instrUnlocksBtn) instrUnlocksBtn.style.display = instructorCoreAccess ? '' : 'none';
    if (instrResultsBtn) instrResultsBtn.style.display = instructorCoreAccess ? '' : 'none';
    const activeInstructorBtn = document.querySelector('#examInstructorView .admin-tab-btn.active');
    if (canUserAccessInstructorArea() && (!activeInstructorBtn || activeInstructorBtn.style.display === 'none')) {
        const fallbackBtn = [instrUnlocksBtn, instrResultsBtn, instrSolutionsBtn, instrManageBtn, allowedExamsBtn].find(btn => btn && btn.style.display !== 'none');
        if (fallbackBtn) fallbackBtn.click();
    }

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
    if (cachedMaintenanceState.enabled) applyMaintenanceAccessMode(false);
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
        logAdminAudit('Admin-Rolle migriert', `${changedUsers} alte Admin-Zuordnung(en) wurden auf Chief Ebene umgestellt.`);
    } catch (err) {
        console.error('Migration der alten Admin-Rolle fehlgeschlagen:', err);
    }
}

function initDienstEintritt(user) {
    sessionUser = withStableAccountId(user?.accountId || generateUserId(user?.vorname, user?.nachname), user);
    const todayFormatted = new Date().toLocaleDateString('de-DE');
    clearStoredSessionData();
    storeActiveSessionDate(todayFormatted);

    document.getElementById('authView').style.display = 'none';
    document.getElementById('mainAppView').style.display = 'block';
    refreshSessionIdentityDisplay();

    applyUserPermissions(sessionUser);
    startPresenceWatcher();
    setupSessionLifecycleServices();
    updateLiveDate();
    baueMaterialUIAuf();
    startFirebaseListeners();
    startMaintenanceStatusListener();
    applyMaintenanceAccessMode(false);
    if (getUserEffectivePermissions(sessionUser).isMasterAdmin) {
        migrateLegacyAdminRoleToChief();
    }
    setupMidnightScheduler();
    setupDailyForcedLogoutScheduler();
    cleanOldCalendarEvents();
    updatePersonalOverview();

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
        renderEmployeeNoticeRecipientOptions();
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
    const canArchive = !!(eff.canViewArchive || eff.isMasterAdmin);
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

/* ── Offizielle DN-Liste 20.09.2026 ─────────────────────────── */
const OFFICIAL_DN_ROSTER_2026_09_20 = Object.freeze([
    { name: 'Dr. Hiroto Takahashi', dn: '11' },
    { name: 'Rene Stoned', dn: '12' },
    { name: 'Mark Akuma', dn: '13' },
    { name: 'Sam Franzika', dn: '14' },
    { name: 'Rico Malz', dn: '15' },
    { name: 'Ray Harper', dn: '27' },
    { name: 'Maximilian Miami', dn: '30' },
    { name: 'Fabio Leroux', dn: '40' },
    { name: 'Conny Grey', dn: '41' },
    { name: 'Domek Redfield', dn: '42' },
    { name: 'Chiko Muerto', dn: '43' },
    { name: 'Brian Akuma', dn: '44' },
    { name: 'Alesya Leroux', dn: '45' },
    { name: 'Luna Hunter', dn: '46' },
    { name: 'John Fernandez Smith', dn: '47' },
    { name: 'Nilo Leroux', dn: '48' },
    { name: 'Neo Castilla', dn: '49' },
    { name: 'Raven Marchetti', dn: '50' },
    { name: 'Rico Reimer', dn: '51' },
    { name: 'Andy Laken', dn: '52' },
    { name: 'Lars Petersen', dn: '53' }
]);

function normalizeOfficialRosterName(value) {
    return normalizeUiSearchText(value)
        .replace(/^dr\s+/, '')
        .replace(/^doctor\s+/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeOfficialDnValue(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/\d+/);
    if (!match) return raw.toLowerCase();
    return String(Number(match[0]));
}

async function syncOfficialServiceNumbersFromRoster() {
    if (officialDnSyncInProgress || officialDnSyncCompletedForPage || !sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isMasterAdmin) return;

    officialDnSyncInProgress = true;
    try {
        const rosterByName = new Map(
            OFFICIAL_DN_ROSTER_2026_09_20.map(item => [normalizeOfficialRosterName(item.name), item])
        );
        const matchesByName = new Map();
        const assignments = [];

        Object.entries(cachedUsers || {}).forEach(([uId, user]) => {
            if (!user) return;
            const fullName = `${user.vorname || ''} ${user.nachname || ''}`.trim();
            const nameKey = normalizeOfficialRosterName(fullName);
            const rosterItem = rosterByName.get(nameKey);
            if (!rosterItem) return;

            const existingMatch = matchesByName.get(nameKey);
            if (existingMatch && existingMatch.uId !== uId) {
                throw new Error(`Mehrere registrierte Konten passen zu „${rosterItem.name}“.`);
            }

            const assignment = {
                uId,
                user,
                rosterName: rosterItem.name,
                targetDn: String(rosterItem.dn),
                oldDn: String(user.dn || '').trim()
            };
            matchesByName.set(nameKey, assignment);
            assignments.push(assignment);
        });

        const assignmentById = new Map(assignments.map(item => [item.uId, item]));
        const conflicts = [];

        assignments.forEach(item => {
            const targetNorm = normalizeOfficialDnValue(item.targetDn);
            Object.entries(cachedUsers || {}).forEach(([otherId, otherUser]) => {
                if (otherId === item.uId || !otherUser) return;
                if (normalizeOfficialDnValue(otherUser.dn) !== targetNorm) return;

                const otherAssignment = assignmentById.get(otherId);
                const otherMovesAway = !!otherAssignment &&
                    normalizeOfficialDnValue(otherAssignment.targetDn) !== targetNorm;

                if (!otherMovesAway) {
                    const otherName = `${otherUser.vorname || ''} ${otherUser.nachname || ''}`.trim() || otherId;
                    conflicts.push(`DN ${item.targetDn}: ${item.rosterName} ↔ ${otherName}`);
                }
            });
        });

        if (conflicts.length) {
            officialDnSyncCompletedForPage = true;
            const uniqueConflicts = [...new Set(conflicts)];
            console.error('DN-Synchronisierung abgebrochen – Doppelbelegung:', uniqueConflicts);
            logAdminAudit('DN-Synchronisierung blockiert', `Offizielle DN-Liste 20.09.2026 wegen Doppelbelegung nicht angewendet: ${uniqueConflicts.join(' | ')}`);
            showToast('⚠️ DN-Liste nicht übernommen: Es gibt eine Doppelbelegung. Es wurden keine Dienstnummern geändert.', 'error', 6500);
            return;
        }

        const changes = assignments.filter(item =>
            normalizeOfficialDnValue(item.oldDn) !== normalizeOfficialDnValue(item.targetDn)
        );

        officialDnSyncCompletedForPage = true;
        if (!changes.length) {
            if (assignments.length) {
                showToast(`✅ DN-Liste geprüft: ${assignments.length} registrierte Personen sind bereits aktuell.`, 'success', 4200);
            }
            return;
        }

        const updates = {};
        changes.forEach(item => {
            updates[`data/users/${item.uId}/dn`] = item.targetDn;
        });

        await db.ref().update(updates);

        for (const item of changes) {
            if (!item.oldDn) continue;
            await migrateLegacyNewsReadKeyForUser(item.uId, item.oldDn, {
                vorname: item.user.vorname || '',
                nachname: item.user.nachname || '',
                dn: item.targetDn
            });
        }

        const detail = changes
            .map(item => `${item.rosterName}: ${item.oldDn || '--'} → ${item.targetDn}`)
            .join(' | ');
        logAdminAudit(
            'Dienstnummern synchronisiert',
            `Offizielle DN-Liste 20.09.2026 angewendet. ${changes.length} Änderung(en), ${assignments.length} registrierte Treffer. Rückfallwerte: ${detail}`
        );
        showToast(
            `✅ Dienstnummern übernommen: ${changes.length} geändert, ${assignments.length} registrierte Personen geprüft.`,
            'success',
            6000
        );
    } catch (err) {
        officialDnSyncCompletedForPage = false;
        console.error('Offizielle DN-Synchronisierung fehlgeschlagen:', err);
        showToast('⚠️ Dienstnummern konnten nicht automatisch übernommen werden. Es wurde kein unsicherer Folgeversuch ausgeführt.', 'error', 6500);
    } finally {
        officialDnSyncInProgress = false;
    }
}

/* ── Firebase Listeners ────────────────────────────────────── */
function startFirebaseListeners() {
    const endpoints = [
        'data/protokoll', 'data/archiv', 'data/hierarchie', 'data/gehaltstabelle',
        'data/guide', 'data/materialPreise', 'data/szenarioTemplates', 'data/szenarienConfig', 'data/dienstLinks',
        'data/dienstCommands', 'data/roles', 'data/users', 'data/exams', 'data/examSubmissions',
        'data/news', 'data/calendar', 'data/employeeCareerPaths', 'data/employeePhotos', 'data/changelogs', 'data/auditLogs', 'data/sanctionsCatalog'
    ];
    endpoints.forEach(ep => db.ref(ep).off());

    if (isMaintenanceRestrictedSession()) {
        db.ref('data/protokoll').on('value', s => renderProtokoll(s.val() || {}));
        db.ref('data/materialPreise').on('value', s => {
            const serverData = s.val();
            if (serverData) Object.keys(serverData).forEach(k => { if (materialKatalog[k]) materialKatalog[k].preis = serverData[k]; });
            baueMaterialUIAuf();
        });
        db.ref('data/szenarienConfig').on('value', s => {
            const cfg = s.val();
            if (cfg) {
                cachedSzenarioConfigMeta = { updatedAt: Number(cfg.updatedAt) || 0, updatedBy: String(cfg.updatedBy || '') };
                if (cfg.templates) szenarioTemplates = Object.assign({}, szenarioTemplates, cfg.templates);
                if (cfg.steps) medicDatenbank = Object.assign({}, medicDatenbank, cfg.steps);
                updateSzenarioDropdownOptions();
                renderContentFreshnessHints();
            }
        });
        db.ref('data/szenarioTemplates').on('value', s => {
            if (s.val()) szenarioTemplates = Object.assign({}, szenarioTemplates, s.val());
        });
        return;
    }

    db.ref('data/protokoll').on('value', s => renderProtokoll(s.val() || {}));
    db.ref('data/hierarchie').on('value', s => {
        renderHierarchieBoard(s.val() || hierarchieDaten);
        renderContentFreshnessHints();
    });
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
    db.ref('data/sanctionsCatalog').on('value', s => {
        const serverData = s.val();
        cachedSanctionsCatalog = sanitizeSanctionsCatalog(serverData || defaultSanctionsCatalog);
        renderSanctionsCatalog();
        if (!serverData) initializeSanctionsCatalogIfAllowed();
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
            cachedSzenarioConfigMeta = { updatedAt: Number(cfg.updatedAt) || 0, updatedBy: String(cfg.updatedBy || '') };
            if (cfg.templates) szenarioTemplates = Object.assign({}, szenarioTemplates, cfg.templates);
            if (cfg.steps) medicDatenbank = Object.assign({}, medicDatenbank, cfg.steps);
            updateSzenarioDropdownOptions();
            renderContentFreshnessHints();
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
        cachedRoles = mergeRolesWithDefaults(serverRoles);
        if (sessionUser) {
            applyUserPermissions(sessionUser);
            refreshSensitiveFirebaseListeners();
            const eff = getUserEffectivePermissions(sessionUser);
            if (eff.isAdmin || eff.isMasterAdmin) {
                syncServerPermissionsForAllUsers().then(() => initializeSanctionsCatalogIfAllowed()).catch(err => console.error('Berechtigungen konnten nicht automatisch synchronisiert werden:', err));
            }
        }
        renderCalendarMonth();
        renderStaffDirectory();
        updateNavigationBadges();
        renderAdminOverview();
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
            syncOfficialServiceNumbersFromRoster();
        }
        renderExamTab();
        renderAdminUserTable(cachedUsers);
        renderPasswordChangeStatusPanel();
        renderCalendarMonth();
        renderStaffDirectory();
        renderCareerManagementPanel();
        if (typeof renderPersonnelWorkspace === 'function') renderPersonnelWorkspace();
        renderEmployeeNoticeRecipientOptions();
        renderEmployeeNoticeFeedPanels();
        updateNavigationBadges();
        renderAdminOverview();
        renderContentFreshnessHints();
        updatePersonalOverview();
    });
    db.ref('data/employeeCareerPaths').on('value', s => {
        cachedEmployeeCareerPaths = s.val() || {};
        renderStaffDirectory();
        renderCareerManagementPanel();
        if (typeof renderPersonnelWorkspace === 'function') renderPersonnelWorkspace();
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
        updatePersonalOverview();
    });
    db.ref('data/calendar').on('value', s => {
        cachedCalendar = s.val() || {};
        renderCalendarMonth();
        updateNavigationBadges();
        updatePersonalOverview();
    });
    db.ref('data/changelogs').on('value', s => {
        cachedCustomChangelogs = s.val() || {};
        renderChangelogModal();
    });
    refreshSensitiveFirebaseListeners();
}

/* ── Sitzungs- & Presence-Steuerung ─────────── */
function getPresenceTimestamp(value) {
    if (!value || typeof value !== 'object') return 0;
    return Number(value.lastSeen || value.ts) || 0;
}

function isPresenceFresh(value, now = Date.now()) {
    const ts = getPresenceTimestamp(value);
    return !!ts && (now - ts) <= PRESENCE_STALE_MS;
}

function compareAppVersions(a, b) {
    const parse = value => {
        const m = String(value || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)([a-z]?)$/i);
        if (!m) return null;
        return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ? (m[4].toLowerCase().charCodeAt(0) - 96) : 0];
    };
    const pa = parse(a);
    const pb = parse(b);
    if (!pa || !pb) return String(a || '').localeCompare(String(b || ''), 'de', { numeric: true, sensitivity: 'base' });
    for (let i = 0; i < pa.length; i++) {
        if (pa[i] > pb[i]) return 1;
        if (pa[i] < pb[i]) return -1;
    }
    return 0;
}

function cleanupSessionLifecycleServices() {
    if (presenceHeartbeatIntervalId) clearInterval(presenceHeartbeatIntervalId);
    if (appUpdateCountdownIntervalId) clearInterval(appUpdateCountdownIntervalId);
    presenceHeartbeatIntervalId = null;
    appUpdateCountdownIntervalId = null;
    appUpdateReloadAt = 0;
    if (sessionControlRef) {
        sessionControlRef.off();
        sessionControlRef = null;
    }
    if (clientReleaseRef) {
        clientReleaseRef.off();
        clientReleaseRef = null;
    }
    if (employeeNoticeOwnRef) {
        employeeNoticeOwnRef.off();
        employeeNoticeOwnRef = null;
    }
    if (employeeNoticeAdminRef) {
        employeeNoticeAdminRef.off();
        employeeNoticeAdminRef = null;
    }
    cachedMyEmployeeNotices = {};
    cachedManagedEmployeeNotices = {};
    activeEmployeeNoticeId = '';
    const employeeNoticeModal = document.getElementById('employeeNoticePopupModal');
    if (employeeNoticeModal) employeeNoticeModal.style.display = 'none';
    const updateModal = document.getElementById('appUpdateModal');
    if (updateModal) updateModal.style.display = 'none';
}

async function performManagedLogout(message = '') {
    cleanupSessionLifecycleServices();
    if (mySessionRef) {
        try { await mySessionRef.remove(); } catch (_) {}
        mySessionRef = null;
    }
    clearStoredSessionData();
    sessionUser = null;
    try { await auth.signOut(); } catch (_) {}
    if (message) alert(message);
    location.reload();
}

async function updateOnlineStatus() {
    if (!sessionUser) return;
    const isNewPresence = !mySessionRef;
    if (!mySessionRef) mySessionRef = db.ref('data/presence').push();

    const now = Date.now();
    try {
        await mySessionRef.set({
            accountId: getUserAccountId(sessionUser),
            authUid: auth.currentUser?.uid || '',
            name: `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim(),
            dn: sessionUser.dn || '',
            ts: now,
            lastSeen: now,
            clientVersion: APP_VERSION
        });
        if (isNewPresence) await mySessionRef.onDisconnect().remove();
    } catch (err) {
        console.warn('Presence konnte nicht aktualisiert werden:', err);
    }
}

function startPresenceHeartbeat() {
    if (presenceHeartbeatIntervalId) clearInterval(presenceHeartbeatIntervalId);
    updateOnlineStatus();
    presenceHeartbeatIntervalId = setInterval(updateOnlineStatus, PRESENCE_HEARTBEAT_MS);
}

function renderActiveSessionAdminPanel() {
    const box = document.getElementById('activeSessionsList');
    const summary = document.getElementById('activeSessionsSummary');
    if (!box) return;

    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isMasterAdmin) {
        box.innerHTML = '';
        if (summary) summary.textContent = '';
        return;
    }

    const now = Date.now();
    const grouped = new Map();
    Object.entries(cachedPresence || {}).forEach(([presenceId, value]) => {
        if (!value || typeof value !== 'object' || !isPresenceFresh(value, now)) return;
        const accountId = String(value.accountId || '').trim();
        if (!accountId) return;
        const item = grouped.get(accountId) || {
            accountId,
            name: String(value.name || '').trim() || accountId,
            dn: String(value.dn || '').trim(),
            clientVersion: String(value.clientVersion || '').trim() || 'älter',
            lastSeen: 0,
            sessions: []
        };
        item.lastSeen = Math.max(item.lastSeen, getPresenceTimestamp(value));
        item.sessions.push(presenceId);
        if (String(value.clientVersion || '').trim()) item.clientVersion = String(value.clientVersion || '').trim();
        grouped.set(accountId, item);
    });

    const entries = [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (summary) summary.textContent = `${entries.length} aktive${entries.length === 1 ? ' Sitzung' : ' Sitzungen'} erkannt`;

    if (!entries.length) {
        box.innerHTML = '<div class="session-empty-state">Aktuell ist niemand aktiv in der MMD Cloud angemeldet.</div>';
        return;
    }

    const myId = getUserAccountId(sessionUser);
    box.innerHTML = entries.map(item => {
        const seconds = Math.max(0, Math.round((now - item.lastSeen) / 1000));
        const lastSeenText = seconds < 10 ? 'gerade eben' : `vor ${seconds} Sek.`;
        const isSelf = item.accountId === myId;
        return `
            <div class="session-admin-row">
                <div class="session-admin-main">
                    <div class="session-admin-name">${escapeHtml(item.name)}</div>
                    <div class="session-admin-meta">
                        ${item.dn ? `DN ${escapeHtml(item.dn)} · ` : ''}
                        ${escapeHtml(item.clientVersion)} · Lebenszeichen ${escapeHtml(lastSeenText)}
                        ${item.sessions.length > 1 ? ` · ${item.sessions.length} Browser` : ''}
                    </div>
                </div>
                <button type="button" class="btn session-kick-btn" ${isSelf ? 'disabled title="Eigene Sitzung bitte über Dienst beenden schließen."' : `onclick="forceUserOutOfService(${escapeJsArg(item.accountId)})"`}>
                    ${isSelf ? 'Eigene Sitzung' : '🚪 Aus Dienst entfernen'}
                </button>
            </div>
        `;
    }).join('');
}

function getActivePresenceUserCount() {
    const now = Date.now();
    return Object.values(cachedPresence || {}).filter(value => {
        if (!value || typeof value !== 'object' || !isPresenceFresh(value, now)) return false;
        return !!String(value.accountId || '').trim();
    }).length;
}

function setNavigationBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    const value = Math.max(0, Number(count) || 0);
    el.textContent = String(value);
    el.style.display = value > 0 ? 'inline-flex' : 'none';
}

function getCalendarEventDateTime(ev) {
    if (!ev?.date) return null;
    const time = /^\d{2}:\d{2}$/.test(String(ev.time || '')) ? ev.time : '23:59';
    const dt = new Date(`${ev.date}T${time}:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

function updateNavigationBadges() {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    const canManageMembers = !!(eff.isMasterAdmin || eff.canManageMemberAccess);
    const pendingUsers = canManageMembers
        ? Object.values(cachedUsers || {}).filter(u => {
            const status = u?.status || ((u?.isAdmin || u?.isMasterAdmin) ? 'approved' : 'pending');
            return status === 'pending';
        }).length
        : 0;

    setNavigationBadge('adminPendingBadge', pendingUsers);
    setNavigationBadge('staffPendingBadge', pendingUsers);

    const myId = getUserAccountId(sessionUser);
    const now = Date.now();
    const pendingInvites = Object.values(cachedCalendar || {}).filter(ev => {
        if (!ev || ev.deleted || !myId) return false;
        if (!Array.isArray(ev.invitedUsers) || !ev.invitedUsers.includes(myId)) return false;
        const status = ev.invitationStatus?.[myId] || 'pending';
        if (status !== 'pending') return false;
        const dt = getCalendarEventDateTime(ev);
        return !dt || dt.getTime() >= now;
    }).length;
    setNavigationBadge('calendarPendingBadge', pendingInvites);
}

function renderAdminOverview() {
    const root = document.getElementById('adminSubTabOverview');
    if (!root || !sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    const canManageMembers = !!(eff.isMasterAdmin || eff.canManageMemberAccess);
    const canManageMaintenance = canCurrentUserManageMaintenance();

    const pendingUsers = Object.values(cachedUsers || {}).filter(u => {
        const status = u?.status || ((u?.isAdmin || u?.isMasterAdmin) ? 'approved' : 'pending');
        return status === 'pending';
    }).length;
    const missingPhotos = Object.values(cachedUsers || {}).filter(u => {
        const status = u?.status || ((u?.isAdmin || u?.isMasterAdmin) ? 'approved' : 'pending');
        return status === 'approved' && !hasCustomStaffPhoto(u);
    }).length;
    const passwordOpen = eff.isMasterAdmin
        ? getPasswordRolloutEntries().filter(entry => entry.pending || !entry.mapped).length
        : 0;
    const activeSessions = eff.isMasterAdmin ? getActivePresenceUserCount() : 0;
    const remoteVersion = String(cachedClientRelease?.version || '').trim();

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };
    const setVisible = (id, visible) => {
        const el = document.getElementById(id);
        if (el) el.style.display = visible ? '' : 'none';
    };

    setText('adminOverviewPendingUsersCount', pendingUsers);
    setText('adminOverviewMissingPhotosCount', missingPhotos);
    setText('adminOverviewPasswordsCount', passwordOpen);
    setText('adminOverviewSessionsCount', activeSessions);
    setText('adminOverviewMaintenanceState', cachedMaintenanceState.enabled ? 'AKTIV' : 'Normal');
    setText('adminOverviewVersionState', APP_VERSION);

    const versionHint = document.getElementById('adminOverviewVersionHint');
    if (versionHint) {
        versionHint.textContent = remoteVersion === APP_VERSION
            ? 'Aktuelle Version ist verteilt'
            : remoteVersion
                ? `Verteilt: ${remoteVersion}`
                : 'Noch keine Version verteilt';
    }

    setVisible('adminOverviewPendingUsersCard', !!(eff.isAdmin || eff.isMasterAdmin));
    setVisible('adminOverviewMissingPhotosCard', !!eff.isMasterAdmin);
    setVisible('adminOverviewPasswordsCard', !!eff.isMasterAdmin);
    setVisible('adminOverviewSessionsCard', !!eff.isMasterAdmin);
    setVisible('adminOverviewMaintenanceCard', canManageMaintenance);
    setVisible('adminOverviewVersionCard', !!eff.isMasterAdmin);

    const taskList = document.getElementById('adminOverviewTaskList');
    if (taskList) {
        const tasks = [];
        if (canManageMembers && pendingUsers > 0) tasks.push({ icon:'👤', text:`${pendingUsers} offene Registrierung${pendingUsers === 1 ? '' : 'en'}`, action:"openAdminOverviewSection('adminSubTabUsers')" });
        if (eff.isMasterAdmin && missingPhotos > 0) tasks.push({ icon:'📷', text:missingPhotos === 1 ? '1 fehlendes Profilbild' : `${missingPhotos} fehlende Profilbilder`, action:'openPhotoChecklistFromAdminOverview()' });
        if (eff.isMasterAdmin && passwordOpen > 0) tasks.push({ icon:'🔐', text:`${passwordOpen} offene Passwortumstellung${passwordOpen === 1 ? '' : 'en'}`, action:"openAdminOverviewSection('adminSubTabSystem')" });
        if (eff.isMasterAdmin && remoteVersion !== APP_VERSION) tasks.push({ icon:'🔄', text:`Browser-Version noch nicht vollständig auf ${APP_VERSION} verteilt`, action:"openAdminOverviewSection('adminSubTabSessions')" });
        if (canManageMaintenance && cachedMaintenanceState.enabled) tasks.push({ icon:'🛠️', text:'Wartungsmodus ist aktuell aktiv', action:"openAdminOverviewSection('adminSubTabMaintenance')" });
        taskList.innerHTML = tasks.length
            ? tasks.map(task => `<button type="button" class="admin-open-task-row" onclick="${task.action}"><span>${task.icon}</span><b>${escapeHtml(task.text)}</b><em>›</em></button>`).join('')
            : '<div class="admin-open-task-empty">✅ Aktuell nichts zu erledigen.</div>';
    }
}

function openAdminOverviewSection(tabId) {
    const buttonMap = {
        adminSubTabOverview: 'btnAdminSubOverview',
        adminSubTabUsers: 'btnAdminSubUsers',
        adminSubTabRoles: 'btnAdminSubRoles',
        adminSubTabSessions: 'btnAdminSubSessions',
        adminSubTabAudit: 'btnAdminSubAudit',
        adminSubTabMaintenance: 'btnAdminSubMaintenance',
        adminSubTabSystem: 'btnAdminSubSystem'
    };
    switchAdminTab(tabId, document.getElementById(buttonMap[tabId] || ''));
}

function openPhotoChecklistFromAdminOverview() {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).isMasterAdmin) return;
    closeAdminManagementModal(true);
    switchTab('staffTab', document.getElementById('staffTabNavBtn'));
    const photoFilter = document.getElementById('staffPhotoFilter');
    if (photoFilter) photoFilter.value = 'missing';
    renderStaffDirectory();
    toggleStaffPhotoChecklist(true);
}

function startPresenceWatcher() {
    db.ref('data/presence').off();
    db.ref('data/presence').on('value', snap => {
        const raw = snap.val() || {};
        cachedPresence = raw;
        const d = document.getElementById('onlineMedicsList');
        if (!d) return;

        const now = Date.now();
        const unique = new Map();
        Object.entries(raw).forEach(([presenceId, value]) => {
            // "Im Dienst" basiert ausschließlich auf aktuellen Heartbeat-Einträgen.
            // Alte Legacy-/Altdaten ohne die aktuellen Presence-Felder werden
            // nicht mehr als aktiver Dienst gewertet.
            if (!value || typeof value !== 'object') return;

            const isCurrentPresence = Object.prototype.hasOwnProperty.call(value, 'lastSeen')
                && Object.prototype.hasOwnProperty.call(value, 'clientVersion')
                && Object.prototype.hasOwnProperty.call(value, 'authUid');
            if (!isCurrentPresence || !isPresenceFresh(value, now)) return;

            const accountId = String(value.accountId || '').trim();
            if (!accountId) return;

            const account = cachedUsers[accountId];
            const effectiveStatus = account?.status || ((account?.isAdmin || account?.isMasterAdmin) ? 'approved' : 'pending');
            if (account && effectiveStatus !== 'approved') return;

            const name = String(value.name || '').trim() || 'Unbekannt';
            if (!unique.has(accountId)) unique.set(accountId, {
                accountId,
                name,
                dn: String(value.dn || '').trim()
            });
        });

        const medics = [...unique.values()].map(m => {
            const accountDn = m.accountId ? String(cachedUsers[m.accountId]?.dn || '').trim() : '';
            return Object.assign({}, m, { dn: m.dn || accountDn });
        }).sort((a, b) => a.name.localeCompare(b.name, 'de'));

        if (!medics.length) {
            d.innerHTML = '<span class="online-medic-name online-medic-empty">Keiner im Dienst</span>';
        } else {
            d.innerHTML = medics.map(m => `
                <span class="online-medic-name" title="${escapeHtml(m.dn ? `${m.name} • DN: ${m.dn}` : m.name)}">${escapeHtml(m.name)}</span>
            `).join('');
        }
        renderActiveSessionAdminPanel();
        renderAdminOverview();
        updatePersonalOverview();
    });
}

function startSessionControlListener() {
    if (!sessionUser) return;
    if (sessionControlRef) sessionControlRef.off();
    const accountId = getUserAccountId(sessionUser);
    sessionControlRef = db.ref(`data/sessionControl/${accountId}`);
    sessionControlRef.on('value', snap => {
        const raw = snap.val() || {};
        const forceLogoutAt = Number(raw.forceLogoutAt) || 0;
        if (!forceLogoutAt || forceLogoutAt <= sessionStartedAt) return;
        const reason = String(raw.reason || '').trim();
        performManagedLogout(`🚪 Deine MMD-Cloud-Sitzung wurde durch die Verwaltung beendet.${reason ? `\n\nGrund: ${reason}` : ''}`);
    }, err => console.warn('Sitzungssteuerung konnte nicht gelesen werden:', err));
}

async function forceUserOutOfService(accountId) {
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isMasterAdmin) {
        alert('Diese Funktion ist ausschließlich für Master Admins verfügbar.');
        return;
    }
    const targetId = String(accountId || '').trim();
    if (!targetId) return;
    if (targetId === getUserAccountId(sessionUser)) {
        alert('Die eigene Sitzung bitte über „Dienst beenden“ schließen.');
        return;
    }

    const target = cachedUsers[targetId] || {};
    const targetName = `${target.vorname || ''} ${target.nachname || ''}`.trim() || targetId;
    if (!confirm(`${targetName} wirklich aus der MMD Cloud abmelden und aus „Im Dienst“ entfernen?`)) return;

    const updates = {};
    updates[`data/sessionControl/${targetId}`] = {
        forceLogoutAt: firebase.database.ServerValue.TIMESTAMP,
        forcedBy: `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim(),
        forcedById: getUserAccountId(sessionUser),
        reason: 'Durch Master Admin aus dem Dienst entfernt'
    };
    Object.entries(cachedPresence || {}).forEach(([presenceId, value]) => {
        if (String(value?.accountId || '').trim() === targetId) updates[`data/presence/${presenceId}`] = null;
    });

    try {
        await db.ref().update(updates);
        logAdminAudit('Sitzung beendet', `${targetName} wurde durch ${sessionUser.vorname} ${sessionUser.nachname} aus dem Dienst entfernt.`);
        alert(`✅ ${targetName} wurde aus dem Dienst entfernt.`);
    } catch (err) {
        console.error('Sitzung konnte nicht beendet werden:', err);
        alert('Die Sitzung konnte nicht beendet werden. Bitte versuche es erneut.');
    }
}

function normalizeClientRelease(raw) {
    const x = raw && typeof raw === 'object' ? raw : {};
    return {
        version: String(x.version || '').trim(),
        publishedAt: Number(x.publishedAt) || 0,
        publishedBy: String(x.publishedBy || '').trim(),
        message: String(x.message || '').trim()
    };
}

function updateClientReleaseAdminPanel() {
    const current = document.getElementById('currentClientVersionText');
    const live = document.getElementById('publishedClientVersionText');
    const status = document.getElementById('clientReleaseStatusText');
    const publishBtn = document.getElementById('btnPublishClientRelease');
    const remoteVersion = String(cachedClientRelease?.version || '').trim();

    if (current) current.textContent = APP_VERSION;
    if (live) live.textContent = remoteVersion || 'Noch nicht verteilt';

    let state = 'pending';
    let statusText = `🟡 ${APP_VERSION} wurde noch nicht an geöffnete Browser verteilt.`;
    let canPublish = true;

    if (remoteVersion) {
        const comparison = compareAppVersions(APP_VERSION, remoteVersion);
        if (comparison === 0) {
            state = 'success';
            statusText = `✅ ${APP_VERSION} ist bereits an geöffnete Browser verteilt.`;
            canPublish = false;
        } else if (comparison < 0) {
            state = 'info';
            statusText = `ℹ️ Verteilt ist bereits ${remoteVersion}. Dieser Browser verwendet noch ${APP_VERSION} und wird automatisch aktualisiert.`;
            canPublish = false;
        }
    }

    if (status) {
        status.className = `client-release-status ${state}`;
        status.textContent = statusText;
    }
    if (publishBtn) {
        publishBtn.disabled = !canPublish;
        publishBtn.textContent = canPublish
            ? '🔄 Update an geöffnete Browser senden'
            : (state === 'success' ? '✅ Aktuelle Version bereits verteilt' : '🔄 Browser-Aktualisierung läuft');
    }
}

function startClientReleaseListener() {
    if (!sessionUser) return;
    if (clientReleaseRef) clientReleaseRef.off();
    clientReleaseRef = db.ref('data/systemStatus/clientRelease');
    clientReleaseRef.on('value', snap => {
        cachedClientRelease = normalizeClientRelease(snap.val());
        updateClientReleaseAdminPanel();
        renderAdminOverview();
        const remoteVersion = cachedClientRelease.version;
        if (!remoteVersion) return;
        const comparison = compareAppVersions(remoteVersion, APP_VERSION);
        if (comparison > 0) {
            showAppUpdateNotice(cachedClientRelease);
        }
    }, err => console.warn('Live-Version konnte nicht gelesen werden:', err));
}

function showAppUpdateNotice(release) {
    if (!sessionUser || appUpdateReloadAt) return;
    appUpdateReloadAt = Date.now() + 10 * 1000;
    const modal = document.getElementById('appUpdateModal');
    const versionEl = document.getElementById('appUpdateVersionText');
    const messageEl = document.getElementById('appUpdateMessageText');
    if (versionEl) versionEl.textContent = release.version || 'neue Version';
    if (messageEl) messageEl.textContent = release.message || 'Die MMD Cloud wurde aktualisiert. Die Seite wird automatisch neu geladen.';
    if (modal) modal.style.display = 'flex';
    updateAppUpdateCountdown();
    if (appUpdateCountdownIntervalId) clearInterval(appUpdateCountdownIntervalId);
    appUpdateCountdownIntervalId = setInterval(updateAppUpdateCountdown, 250);
}

function updateAppUpdateCountdown() {
    if (!appUpdateReloadAt) return;
    const remainingMs = Math.max(0, appUpdateReloadAt - Date.now());
    const remaining = Math.ceil(remainingMs / 1000);
    const el = document.getElementById('appUpdateCountdown');
    if (el) el.textContent = String(remaining);
    if (remainingMs <= 0) reloadForAppUpdate();
}

function reloadForAppUpdate() {
    if (appUpdateCountdownIntervalId) clearInterval(appUpdateCountdownIntervalId);
    appUpdateCountdownIntervalId = null;
    appUpdateReloadAt = 0;
    location.reload();
}

async function publishClientRelease() {
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isMasterAdmin) {
        alert('Diese Funktion ist ausschließlich für Master Admins verfügbar.');
        return;
    }

    const version = APP_VERSION;
    const message = String(document.getElementById('clientReleaseMessageInput')?.value || '').trim();
    if (!confirm(`Aktuelle MMD-Cloud-Version ${version} jetzt an geöffnete Browser senden?\n\nÄltere geöffnete Browser erhalten einen 10-Sekunden-Hinweis und laden anschließend automatisch neu.`)) return;

    try {
        await db.ref('data/systemStatus/clientRelease').set({
            version,
            publishedAt: firebase.database.ServerValue.TIMESTAMP,
            publishedBy: `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim(),
            publishedById: getUserAccountId(sessionUser),
            message: message.slice(0, 180)
        });
        logAdminAudit('Live-Version veröffentlicht', `${version} wurde für geöffnete Browser freigegeben.`);
        showToast(`✅ ${version} wurde an geöffnete Browser verteilt.`, 'success');
    } catch (err) {
        console.error('Live-Version konnte nicht veröffentlicht werden:', err);
        alert('Die Live-Version konnte nicht veröffentlicht werden.');
    }
}

function setupSessionLifecycleServices() {
    sessionStartedAt = Date.now();
    startPresenceHeartbeat();
    startSessionControlListener();
    startClientReleaseListener();
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

    const updatedAt = Date.now();
    const updatedBy = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim();
    db.ref('data/szenarienConfig').set({
        steps: updatedSteps,
        templates: updatedTpls,
        updatedAt,
        updatedBy
    }).then(() => {
        cachedSzenarioConfigMeta = { updatedAt, updatedBy };
        medicDatenbank = updatedSteps;
        szenarioTemplates = updatedTpls;
        updateSzenarioDropdownOptions();
        closeSzenarienInlineModal();
        logAdminAudit('Szenarien & Abläufe angepasst', `${sessionUser.vorname} ${sessionUser.nachname} hat medizinische Szenarien vor Ort aktualisiert.`);
        showToast('✅ Medizinische Szenarien & Abläufe erfolgreich gespeichert.', 'success');
    });
}

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

/* ── Schicht-Korrektur (Master Admin No-Code Stift) ─────────── */
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
    if (!eff.isMasterAdmin) { alert('Nur Master Admins dürfen archivierte Schichten bearbeiten!'); return; }

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
        }).catch(err => alert('Die Archivierung konnte nicht abgeschlossen werden. Bitte versuche es erneut.'));
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
            alert('Der Eintrag konnte nicht gelöscht werden. Bitte versuche es erneut.');
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
    if (!eff.canViewArchive && !eff.isMasterAdmin) {
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
    if (!eff.delCalendar && !eff.isMasterAdmin) return;
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

function getVisibleCalendarEventsForCurrentUser() {
    const myRoleIds = sessionUser ? getUserRolesList(sessionUser) : [];
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const isSpecialAdmin = eff.isAdmin || eff.isMasterAdmin;
    const myId = sessionUser ? getUserAccountId(sessionUser) : '';

    return Object.entries(cachedCalendar || {}).map(([id, ev]) => Object.assign({ id }, ev)).filter(ev => {
        if (ev.deleted) return false;
        const isInvited = Array.isArray(ev.invitedUsers) && ev.invitedUsers.includes(myId);
        const inviteStatus = ev.invitationStatus?.[myId] || 'pending';
        if (isInvited) return inviteStatus !== 'declined';
        if (ev.isPrivate) return ev.creatorId === myId;
        if (isSpecialAdmin) return true;
        if (!ev.targetRoles || !ev.targetRoles.length || ev.targetRoles.includes('all')) return true;
        return ev.targetRoles.some(roleId => myRoleIds.includes(roleId));
    });
}

function renderUpcomingCalendarEvents() {
    const box = document.getElementById('upcomingCalendarList');
    const summary = document.getElementById('upcomingCalendarSummary');
    if (!box) return;

    const now = Date.now();
    const future = getVisibleCalendarEventsForCurrentUser()
        .map(ev => ({ ev, dateTime: getCalendarEventDateTime(ev) }))
        .filter(item => item.dateTime && item.dateTime.getTime() >= now)
        .sort((a, b) => a.dateTime - b.dateTime);

    if (summary) summary.textContent = future.length
        ? `${future.length} anstehend`
        : 'Keine anstehenden Termine';

    if (!future.length) {
        box.innerHTML = '<div class="upcoming-calendar-empty">Aktuell stehen keine weiteren sichtbaren Termine an.</div>';
        return;
    }

    box.innerHTML = future.slice(0, 5).map(({ ev, dateTime }) => {
        const dateLabel = dateTime.toLocaleDateString('de-DE', { weekday:'short', day:'2-digit', month:'2-digit' });
        const inviteStatus = ev.invitationStatus?.[getUserAccountId(sessionUser)] || '';
        const inviteBadge = inviteStatus === 'pending' ? '<span class="upcoming-calendar-badge">Antwort offen</span>' : '';
        return `
            <button type="button" class="upcoming-calendar-item" onclick="openCalendarEventDetailsModal('${ev.id}')">
                <span class="upcoming-calendar-when">${escapeHtml(dateLabel)} · ${escapeHtml(ev.time || '--:--')}</span>
                <span class="upcoming-calendar-title">${escapeHtml(ev.title || 'Termin')}</span>
                ${inviteBadge}
            </button>
        `;
    }).join('');
}

function setCalendarView(view = 'month') {
    activeCalendarView = view === 'list' ? 'list' : 'month';
    const monthBtn=document.getElementById('calendarViewMonthBtn'),listBtn=document.getElementById('calendarViewListBtn'),monthNav=document.getElementById('calendarMonthNavControls'),monthView=document.getElementById('calendarMonthView'),listView=document.getElementById('calendarListView');
    monthBtn?.classList.toggle('active',activeCalendarView==='month');listBtn?.classList.toggle('active',activeCalendarView==='list');
    if(monthNav)monthNav.style.display=activeCalendarView==='month'?'flex':'none';if(monthView)monthView.style.display=activeCalendarView==='month'?'':'none';if(listView)listView.style.display=activeCalendarView==='list'?'block':'none';
    if(activeCalendarView==='list')renderCalendarListView();
}
function renderCalendarListView() {
    const box=document.getElementById('calendarListContainer'),summary=document.getElementById('calendarListSummary');if(!box)return;
    const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+30);
    const events=getVisibleCalendarEventsForCurrentUser().map(ev=>({ev,dt:getCalendarEventDateTime(ev)})).filter(item=>item.dt&&item.dt>=start&&item.dt<end).sort((a,b)=>a.dt-b.dt);
    if(summary)summary.textContent=`${events.length} ${events.length===1?'Termin':'Termine'}`;
    if(!events.length){box.innerHTML='<div class="calendar-list-empty">In den nächsten 30 Tagen stehen keine sichtbaren Termine an.</div>';return;}
    const myId=getUserAccountId(sessionUser);
    box.innerHTML=events.map(({ev,dt})=>{const inviteStatus=ev.invitationStatus?.[myId]||'';const badge=inviteStatus==='pending'?'<span class="calendar-list-badge pending">Antwort offen</span>':inviteStatus==='accepted'?'<span class="calendar-list-badge accepted">Zugesagt</span>':'';return `<button type="button" class="calendar-list-row" onclick="openCalendarEventDetailsModal('${ev.id}')"><span class="calendar-list-date"><b>${escapeHtml(dt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}))}</b><small>${escapeHtml(dt.toLocaleDateString('de-DE',{weekday:'short'}))}</small></span><span class="calendar-list-main"><b>${escapeHtml(ev.title||'Termin')}</b><small>${escapeHtml(ev.time||'--:--')} Uhr${ev.creatorDisplay?' · '+escapeHtml(ev.creatorDisplay):''}</small></span>${badge}<span class="calendar-list-arrow">›</span></button>`;}).join('');
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
    renderUpcomingCalendarEvents();
    renderCalendarListView();
    updateNavigationBadges();
    updatePersonalOverview();
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
    clearUnsavedChanges('calendar');
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.canCreateCalendar) {
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
            { id: 'cls', label: '💉 CLS', val: 'CLS', color: '#06b6d4' },
            { id: 'ehk', label: '🩺 EHK', val: 'EHK', color: '#10b981' },
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
        const sortedRoles = sortRolesForDisplay(Object.values(cachedRoles));
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

function closeCalendarEventModal(force = false) {
    if (!force && !confirmDiscardUnsavedChanges('calendar')) return;
    clearUnsavedChanges('calendar');
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
        const canEditExisting = existingEv.creatorId === myId || legacyOwner || eff.delCalendar || eff.isMasterAdmin;
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
            clearUnsavedChanges('calendar');
            closeCalendarEventModal(true);
            logAdminAudit('Kalendertermin bearbeitet', `${creatorDisplay}: ${title} (${startDateStr})`);
            showToast('✅ Kalendertermin erfolgreich aktualisiert.', 'success');
        });
        return;
    }

    if (!eff.canCreateCalendar) {
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
        clearUnsavedChanges('calendar');
        closeCalendarEventModal(true);
        logAdminAudit('Kalendertermin(e) angelegt', `${creatorDisplay}: ${title} (${count}x Serie ab ${startDateStr})`);
        showToast(`✅ ${count > 1 ? count + ' Termine der Serie' : 'Termin'} erfolgreich gespeichert.`, 'success');
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
    const isOwnerOrAdmin = (ev.creatorId === myId) || legacyOwner || eff.delCalendar || eff.isMasterAdmin;
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
        showToast(status === 'accepted' ? '✅ Termin verbindlich angenommen.' : '❌ Einladung abgelehnt.', status === 'accepted' ? 'success' : 'info');
    });
}

function closeCalendarEventDetailsModal() {
    const modal = document.getElementById('calendarEventDetailsModal');
    if (modal) modal.style.display = 'none';
    activeDetailEventId = null;
}

function editCalendarEventAction() {
    if (!sessionUser || !activeDetailEventId) return;
    clearUnsavedChanges('calendar');
    const eventId = activeDetailEventId;
    const ev = cachedCalendar[eventId];
    if (!ev) return;
    const myId = getUserAccountId(sessionUser);
    const eff = getUserEffectivePermissions(sessionUser);
    const myName = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim().toLowerCase();
    const legacyOwner = !ev.creatorId && ((ev.enteredBy || ev.creator || '').trim().toLowerCase() === myName);
    if (ev.creatorId !== myId && !legacyOwner && !eff.delCalendar && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zum Bearbeiten dieses Termins!');
        return;
    }

    const modal = document.getElementById('calendarEventModal');
    if (!modal) return;

    closeCalendarEventDetailsModal();

    document.getElementById('editingCalendarEventId').value = eventId;
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
            { id: 'cls', label: '💉 CLS', val: 'CLS', color: '#06b6d4' },
            { id: 'ehk', label: '🩺 EHK', val: 'EHK', color: '#10b981' },
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
        const sortedRoles = sortRolesForDisplay(Object.values(cachedRoles));
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
    const isOwnerOrAdmin = (ev.creatorId === myId) || legacyOwner || eff.delCalendar || eff.isMasterAdmin;

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

function formatStaffDn(dnValue) {
    const raw = String(dnValue || '').trim();
    if (!raw) return 'Keine DN';
    const digits = raw.replace(/\D/g, '');
    return digits ? `DN ${digits}` : `DN ${raw}`;
}

function hasCustomStaffPhoto(user) {
    const rawPhoto = String(user?.photoUrl || '').trim();
    return !!(rawPhoto && !rawPhoto.includes('mdlogo') && rawPhoto !== DEFAULT_MD_LOGO_FALLBACK);
}

function updateStaffRoleFilterOptions() {
    const select = document.getElementById('staffRoleFilter');
    if (!select) return;
    const selected = select.value || 'all';
    const roles = sortRolesForDisplay(Object.values(cachedRoles || {}));
    select.innerHTML = '<option value="all">Alle Rollen</option>' + roles.map(role =>
        `<option value="${escapeHtml(role.id)}">${escapeHtml((role.icon ? role.icon + ' ' : '') + role.name)}</option>`
    ).join('');
    select.value = roles.some(role => role.id === selected) ? selected : 'all';
}

function resetStaffDirectoryFilters() {
    const search = document.getElementById('searchStaffInput');
    const status = document.getElementById('staffStatusFilter');
    const photo = document.getElementById('staffPhotoFilter');
    const role = document.getElementById('staffRoleFilter');
    if (search) search.value = '';
    if (status) status.value = 'all';
    if (photo) photo.value = 'all';
    if (role) role.value = 'all';
    renderStaffDirectory();
}

function getVisibleStaffEntries() {
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const canManageRegistrations = !!(eff.canManageMemberAccess || eff.isMasterAdmin);
    return Object.entries(cachedUsers || {}).filter(([, user]) => {
        if (!user) return false;
        if (canManageRegistrations) return true;
        return user.status === 'approved' || user.isAdmin || user.isMasterAdmin;
    });
}


const EMPLOYEE_CAREER_PATHS = Object.freeze({
    none: { label: 'Noch nicht festgelegt', icon: '➖' },
    doctor: { label: 'Doctor', icon: '🩺' },
    paramedic: { label: 'Paramedic', icon: '🚑' },
    both: { label: 'Doctor & Paramedic', icon: '⚕️' }
});

function normalizeEmployeeCareerPath(value) {
    const raw = String(value || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(EMPLOYEE_CAREER_PATHS, raw) ? raw : 'none';
}

function getEmployeeCareerPathKey(uId) {
    return normalizeEmployeeCareerPath(cachedEmployeeCareerPaths?.[uId]?.path);
}

function getEmployeeCareerPathLabel(uId) {
    const key = getEmployeeCareerPathKey(uId);
    return EMPLOYEE_CAREER_PATHS[key]?.label || EMPLOYEE_CAREER_PATHS.none.label;
}

function getEmployeeCareerPathBadge(uId) {
    const key = getEmployeeCareerPathKey(uId);
    const meta = EMPLOYEE_CAREER_PATHS[key] || EMPLOYEE_CAREER_PATHS.none;
    return `<span class="staff-career-badge career-${key}">${meta.icon} Laufbahn: ${escapeHtml(meta.label)}</span>`;
}

function canCurrentUserManageCareerPaths() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    return !!(eff.canManageCareerPaths || eff.isMasterAdmin);
}

function renderCareerManagementPanel() {
    const panel = document.getElementById('staffCareerManagementPanel');
    const list = document.getElementById('staffCareerManagementList');
    if (!panel || !list) return;

    const canManage = canCurrentUserManageCareerPaths();
    panel.style.display = canManage ? 'block' : 'none';
    if (!canManage) {
        list.innerHTML = '';
        return;
    }

    const entries = Object.entries(cachedUsers || {})
        .filter(([, user]) => {
            const status = user?.status || ((user?.isAdmin || user?.isMasterAdmin) ? 'approved' : 'pending');
            return !!user && status === 'approved';
        })
        .sort((a, b) => {
            const dnDiff = parseDN(a[1]?.dn) - parseDN(b[1]?.dn);
            if (dnDiff !== 0) return dnDiff;
            return `${a[1]?.nachname || ''} ${a[1]?.vorname || ''}`.localeCompare(`${b[1]?.nachname || ''} ${b[1]?.vorname || ''}`, 'de');
        });

    if (!entries.length) {
        list.innerHTML = '<div class="career-management-empty">Keine aktiven Mitarbeiter vorhanden.</div>';
        return;
    }

    list.innerHTML = entries.map(([uId, user]) => {
        const name = `${user.vorname || ''} ${user.nachname || ''}`.trim() || uId;
        const current = getEmployeeCareerPathKey(uId);
        return `
            <div class="career-management-row">
                <div class="career-management-person">
                    <b>${escapeHtml(name)}</b>
                    <span>${escapeHtml(formatStaffDn(user.dn))}</span>
                </div>
                <select id="careerPathSelect_${uId}" class="career-management-select" aria-label="Laufbahn für ${escapeHtml(name)}">
                    <option value="none" ${current === 'none' ? 'selected' : ''}>Noch nicht festgelegt</option>
                    <option value="doctor" ${current === 'doctor' ? 'selected' : ''}>Arzt</option>
                    <option value="paramedic" ${current === 'paramedic' ? 'selected' : ''}>Paramedic</option>
                    <option value="both" ${current === 'both' ? 'selected' : ''}>Arzt & Paramedic</option>
                </select>
                <button type="button" class="btn career-management-save" onclick="saveEmployeeCareerPath('${uId}')">💾 Speichern</button>
            </div>
        `;
    }).join('');
}

async function saveEmployeeCareerPath(uId) {
    if (!canCurrentUserManageCareerPaths()) {
        alert('Keine Berechtigung zum Verwalten von Mitarbeiterlaufbahnen.');
        return;
    }
    if (!cachedUsers?.[uId]) {
        alert('Der Mitarbeiter wurde nicht gefunden.');
        return;
    }

    const select = document.getElementById('careerPathSelect_' + uId);
    if (!select) return;
    const selected = normalizeEmployeeCareerPath(select.value);

    try {
        const ref = db.ref('data/employeeCareerPaths/' + uId);
        if (selected === 'none') {
            await ref.remove();
        } else {
            await ref.set({
                path: selected,
                updatedAt: Date.now(),
                updatedBy: `${sessionUser?.vorname || ''} ${sessionUser?.nachname || ''}`.trim() || 'MMD Cloud',
                updatedById: getUserAccountId(sessionUser)
            });
        }
        const person = cachedUsers[uId] || {};
        const name = `${person.vorname || ''} ${person.nachname || ''}`.trim() || uId;
        logAdminAudit('Mitarbeiterlaufbahn geändert', `${name}: ${EMPLOYEE_CAREER_PATHS[selected]?.label || EMPLOYEE_CAREER_PATHS.none.label}`);
        showToast('✅ Laufbahn wurde gespeichert.', 'success');
    } catch (err) {
        console.error('Mitarbeiterlaufbahn konnte nicht gespeichert werden:', err);
        showToast('⚠️ Laufbahn konnte nicht gespeichert werden.', 'error', 5000);
    }
}

function renderStaffDirectory() {
    const grid = document.getElementById('staffDirectoryGrid');
    const badge = document.getElementById('staffCountBadge');
    const totalBadge = document.getElementById('staffTotalBadge');
    if (!grid) return;
    renderStaffPhotoChecklist();
    updateStaffRoleFilterOptions();

    const q = (document.getElementById('searchStaffInput')?.value || '').trim().toLowerCase();
    const photoFilter = document.getElementById('staffPhotoFilter')?.value || 'all';
    const roleFilter = document.getElementById('staffRoleFilter')?.value || 'all';
    const canManagePhotos = canUserManageEmployeePhotos();
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const canManageRegistrations = !!(eff.canManageMemberAccess || eff.isMasterAdmin);
    const statusFilterEl = document.getElementById('staffStatusFilter');
    const statusFilterField = statusFilterEl?.closest('.staff-filter-field');
    if (statusFilterField) statusFilterField.style.display = canManageRegistrations ? '' : 'none';
    if (!canManageRegistrations && statusFilterEl) statusFilterEl.value = 'all';
    const statusFilter = canManageRegistrations ? (statusFilterEl?.value || 'all') : 'all';

    const staffList = getVisibleStaffEntries();

    if (totalBadge) totalBadge.textContent = staffList.length;

    staffList.sort((a, b) => {
        const dnA = parseDN(a[1].dn);
        const dnB = parseDN(b[1].dn);
        if (dnA !== dnB) return dnA - dnB;
        return (a[1].nachname || '').localeCompare(b[1].nachname || '', 'de');
    });

    const filtered = staffList.filter(([uId, u]) => {
        const effectiveStatus = u.status || ((u.isAdmin || u.isMasterAdmin) ? 'approved' : 'pending');
        if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false;
        if (photoFilter === 'missing' && hasCustomStaffPhoto(u)) return false;
        if (photoFilter === 'ready' && !hasCustomStaffPhoto(u)) return false;
        if (roleFilter !== 'all' && !getUserRolesList(u).includes(roleFilter)) return false;
        if (!q) return true;
        const dnClean = (u.dn || '').toString().toLowerCase();
        const vClean = (u.vorname || '').toLowerCase();
        const nClean = (u.nachname || '').toLowerCase();
        const fullText = `${dnClean} ${vClean} ${nClean} ${vClean} ${nClean}`;
        return fullText.includes(q);
    });

    if (badge) badge.textContent = filtered.length;

    if (!filtered.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">Keine Mitarbeiter gefunden.</div>';
        return;
    }

    grid.innerHTML = filtered.map(([uId, u]) => {
        const rawPhoto = (u.photoUrl || '').trim();
        const isCustomPhoto = hasCustomStaffPhoto(u);
        const photoSrc = isCustomPhoto ? rawPhoto : 'mdlogo.png';
        const isLogo = !isCustomPhoto;
        const dnFormatted = formatStaffDn(u.dn);

        return `
            <div class="staff-card staff-card-clickable" role="button" tabindex="0" onclick="openStaffDetailModal('${uId}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openStaffDetailModal('${uId}');}">
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
                    <div class="staff-card-career">${getEmployeeCareerPathBadge(uId)}</div>
                    <div class="staff-card-ranks">${typeof getEmployeeRankBadges === 'function' ? getEmployeeRankBadges(uId) : ''}</div>
                    ${typeof getEmployeeAbsenceBadge === 'function' && getEmployeeAbsenceBadge(uId) ? `<div class="staff-card-absence">${getEmployeeAbsenceBadge(uId)}</div>` : ''}
                    ${canManageRegistrations ? `
                        <div style="margin-top:8px;font-size:12px;font-weight:800;color:${getUserStatusDisplay(u.status).color};">${getUserStatusDisplay(u.status).text}</div>
                        ${u.status !== 'approved' ? `
                            <div class="staff-card-admin-actions">
                                <button type="button" class="btn-staff-quick-action" onclick="event.stopPropagation(); approveUser('${uId}')" title="Diesen Mitarbeiter freischalten">✅ Freischalten</button>
                            </div>
                        ` : ''}
                    ` : ''}
                    ${(canManagePhotos && u.status === 'approved') ? `
                        <div class="staff-card-admin-actions">
                            <label class="btn-staff-quick-action btn-upload" onclick="event.stopPropagation()" title="Neues bearbeitetes Foto mit Logo für diesen Mitarbeiter einstellen">
                                🎨 Foto einstellen
                                <input type="file" accept="image/*" style="display:none;" onclick="event.stopPropagation()" onchange="uploadProcessedStaffPhoto(event, '${uId}')">
                            </label>
                            ${isCustomPhoto ? `
                                <button type="button" class="btn-staff-quick-action btn-reset" onclick="event.stopPropagation(); resetStaffPhotoToDefault('${uId}')"  title="Auf Standardlogo zurücksetzen">🔄 Logo</button>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getServiceDaysForUser(user) {
    const raw = String(user?.einstellungsDatum || '').trim();
    if (!raw) return null;
    const start = new Date(raw + 'T00:00:00');
    if (Number.isNaN(start.getTime())) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.max(0, Math.floor((today - start) / 86400000) + 1);
}

function openStaffDetailModal(uId) {
    const entry = getVisibleStaffEntries().find(([id]) => id === uId);
    if (!entry) return;
    const [, user] = entry;
    const modal = document.getElementById('staffDetailModal');
    const box = document.getElementById('staffDetailContent');
    const title = document.getElementById('staffDetailName');
    if (!modal || !box) return;

    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const canManageMembers = !!(eff.canManageMemberAccess || eff.isMasterAdmin);
    const canAdminEdit = !!(eff.isAdmin || eff.isMasterAdmin);
    const customPhoto = hasCustomStaffPhoto(user);
    const photoSrc = customPhoto ? String(user.photoUrl || '') : 'mdlogo.png';
    const days = getServiceDaysForUser(user);
    const status = getUserStatusDisplay(user.status || ((user.isAdmin || user.isMasterAdmin) ? 'approved' : 'pending'));
    const statusMeta = canManageMembers
        ? `<div><span>Status</span><b style="color:${status.color};">${escapeHtml(status.text)}</b></div>`
        : '';
    const displayName = `${user.vorname || ''} ${user.nachname || ''}`.trim() || uId;
    if (title) title.textContent = displayName;

    let actions = '';
    if (canManageMembers) {
        actions += (user.status || 'pending') !== 'approved'
            ? `<button type="button" class="btn staff-detail-action success" onclick="closeStaffDetailModal(); approveUser('${uId}')">✅ Freischalten</button>`
            : `<button type="button" class="btn staff-detail-action danger" onclick="closeStaffDetailModal(); revokeUser('${uId}')">⛔ Sperren</button>`;
        actions += `<button type="button" class="btn staff-detail-action" onclick="closeStaffDetailModal(); openAssignRolesModal('${uId}', null, false)">🎭 Rollen</button>`;
    }
    if (canAdminEdit) actions += `<button type="button" class="btn staff-detail-action" onclick="closeStaffDetailModal(); openUserPermissionsModal('${uId}')">✏️ Bearbeiten</button>`;

    box.innerHTML = `
        <div class="staff-detail-layout">
            <div class="staff-detail-photo-wrap"><img src="${photoSrc}" alt="${escapeHtml(displayName)}" onerror="this.onerror=null;this.src='${DEFAULT_MD_LOGO_FALLBACK}'"></div>
            <div class="staff-detail-info">
                <span class="staff-detail-dn">${escapeHtml(formatStaffDn(user.dn))}</span>
                <h2>${escapeHtml(displayName)}</h2>
                <div class="staff-detail-roles">${renderUserRoleBadges(user)}</div>
                <div class="staff-detail-meta-grid">
                    ${statusMeta}
                    <div><span>Laufbahn</span><b>${escapeHtml(getEmployeeCareerPathLabel(uId))}</b></div>
                    <div><span>Rang</span><b>${escapeHtml(typeof getEmployeeRankLabels === 'function' ? getEmployeeRankLabels(uId).join(' · ') : 'Noch nicht festgelegt')}</b></div>
                    ${typeof getEmployeePublicAbsence === 'function' && getEmployeePublicAbsence(uId) ? `<div class="staff-detail-absence"><span>Abwesenheit</span><b>${escapeHtml(getEmployeePublicAbsence(uId).label)}</b></div>` : ''}
                    <div><span>Diensttage</span><b>${days === null ? 'Nicht hinterlegt' : days}</b></div>
                    <div><span>Profilbild</span><b>${customPhoto ? '✅ Vorhanden' : '📷 Standardlogo'}</b></div>
                </div>
            </div>
        </div>
        ${actions ? `<div class="staff-detail-actions">${actions}</div>` : ''}
    `;
    modal.style.display = 'flex';
}
function closeStaffDetailModal() {
    const modal = document.getElementById('staffDetailModal');
    if (modal) modal.style.display = 'none';
}

function renderStaffPhotoChecklist() {
    const panel = document.getElementById('staffPhotoChecklistPanel');
    const list = document.getElementById('staffPhotoChecklistList');
    const summary = document.getElementById('staffPhotoChecklistSummary');
    const toggleBtn = document.getElementById('btnTogglePhotoChecklist');
    if (!panel || !list) return;

    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const isMaster = !!eff.isMasterAdmin;

    if (toggleBtn) toggleBtn.style.display = isMaster ? 'inline-flex' : 'none';
    if (!isMaster) {
        panel.style.display = 'none';
        list.innerHTML = '';
        if (summary) summary.textContent = '';
        return;
    }

    const entries = Object.entries(cachedUsers || {})
        .filter(([, user]) => !!user)
        .sort((a, b) => {
            const dnDiff = parseDN(a[1].dn) - parseDN(b[1].dn);
            if (dnDiff !== 0) return dnDiff;
            const aName = `${a[1].nachname || ''} ${a[1].vorname || ''}`.trim();
            const bName = `${b[1].nachname || ''} ${b[1].vorname || ''}`.trim();
            return aName.localeCompare(bName, 'de');
        });

    const completed = entries.filter(([, user]) => hasCustomStaffPhoto(user)).length;
    if (summary) summary.textContent = `${completed} / ${entries.length} mit eigenem Profilbild`;

    if (!entries.length) {
        list.innerHTML = '<div class="staff-photo-checklist-empty">Noch keine Mitarbeiter registriert.</div>';
        return;
    }

    list.innerHTML = entries.map(([uId, user]) => {
        const complete = hasCustomStaffPhoto(user);
        const name = `${user.vorname || ''} ${user.nachname || ''}`.trim() || uId;
        const statusText = complete ? 'Profilbild vorhanden' : 'Profilbild fehlt';
        return `
            <div class="staff-photo-checklist-row ${complete ? 'done' : 'open'}">
                <span class="staff-photo-checklist-icon" aria-hidden="true">${complete ? '✅' : '⬜'}</span>
                <div class="staff-photo-checklist-person">
                    <span class="staff-photo-checklist-name">${escapeHtml(name)}</span>
                    <span class="staff-photo-checklist-dn">${escapeHtml(formatStaffDn(user.dn))}</span>
                </div>
                <span class="staff-photo-checklist-state">${statusText}</span>
                ${!complete ? `<button type="button" class="btn staff-photo-notice-btn" onclick="sendMissingPhotoEmployeeNotice('${uId}')">📨 Foto-Hinweis</button>` : ''}
            </div>
        `;
    }).join('');
}

function toggleStaffPhotoChecklistBody(forceExpanded = null) {
    const body = document.getElementById('staffPhotoChecklistBody');
    const btn = document.getElementById('btnCollapsePhotoChecklist');
    if (!body || !btn || !sessionUser) return;

    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isMasterAdmin) return;

    const isExpanded = body.style.display !== 'none';
    const shouldExpand = forceExpanded === null ? !isExpanded : !!forceExpanded;
    body.style.display = shouldExpand ? '' : 'none';
    btn.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
    btn.textContent = shouldExpand ? '▴ Einklappen' : '▾ Ausklappen';
}

function toggleStaffPhotoChecklist(forceOpen = null) {
    const panel = document.getElementById('staffPhotoChecklistPanel');
    const btn = document.getElementById('btnTogglePhotoChecklist');
    if (!panel || !btn || !sessionUser) return;

    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isMasterAdmin) {
        panel.style.display = 'none';
        return;
    }

    renderStaffPhotoChecklist();
    const shouldOpen = forceOpen === null ? panel.style.display === 'none' || !panel.style.display : !!forceOpen;
    panel.style.display = shouldOpen ? 'block' : 'none';
    btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if (shouldOpen) toggleStaffPhotoChecklistBody(true);
}

async function sendMissingPhotoEmployeeNotice(uId) {
    if (!sessionUser) return;

    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isMasterAdmin) {
        alert('Diese Funktion ist nur für Master Admins verfügbar.');
        return;
    }

    const recipient = cachedUsers[uId];
    if (!recipient) {
        alert('Der Mitarbeiter wurde nicht gefunden.');
        return;
    }

    if (hasCustomStaffPhoto(recipient)) {
        renderStaffPhotoChecklist();
        alert('Für diesen Mitarbeiter ist bereits ein eigenes Profilbild hinterlegt.');
        return;
    }

    const recipientName = `${recipient.vorname || ''} ${recipient.nachname || ''}`.trim() || uId;
    const recipientLabel = `${formatStaffDn(recipient.dn)} – ${recipientName}`;
    if (!confirm(`Foto-Hinweis jetzt an ${recipientLabel} senden?`)) return;

    const title = 'Fehlendes Mitarbeiterfoto';
    const message =
        `Sehr geehrter Mitarbeiter ${recipientName},\n\n` +
        'für Ihre Mitarbeiterkartei fehlt aktuell noch ein Mitarbeiterfoto. Bitte tragen Sie für die Aufnahme das Besprechungsoutfit und orientieren Sie sich bei Motiv und Position an den bereits vorhandenen Mitarbeiterfotos.\n\n' +
        'Das Foto können Sie unter Mitarbeiter → Mitarbeiterkartei → Foto einreichen hochladen oder per D-Funk an DN 07 Tim Sanddorn senden. Das Bild muss nicht bearbeitet werden; die Bearbeitung übernimmt DN 07. Falls Sie Unterstützung bei der Aufnahme benötigen, hilft Ihnen auch Fabio Leroux gerne weiter.\n\n' +
        'Vielen Dank.';

    const ref = db.ref(`data/employeeNotices/${uId}`).push();
    const notice = {
        id: ref.key,
        recipientId: uId,
        recipientName,
        recipientDn: recipient.dn || '',
        title,
        message,
        senderId: getUserAccountId(sessionUser),
        senderName: `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim(),
        createdAt: Date.now(),
        expiresAt: 0
    };

    try {
        await ref.set(notice);
        logAdminAudit('Foto-Hinweis gesendet', `${notice.senderName} → ${recipientLabel}: ${title}`);
        showToast(`✅ Foto-Hinweis wurde an ${recipientLabel} gesendet.`, 'success');
    } catch (err) {
        console.error('Foto-Hinweis konnte nicht gesendet werden:', err);
        alert('Der Foto-Hinweis konnte nicht gesendet werden. Bitte versuche es erneut.');
    }
}

function filterStaffDirectory() {
    renderStaffDirectory();
}

function resetStaffPhotoToDefault(uId) {
    if (!canUserManageEmployeePhotos()) return;
    if (confirm('Profilbild dieses Mitarbeiters wieder auf das Standardlogo (mdlogo.png) zurücksetzen?')) {
        db.ref('data/users/' + uId + '/photoUrl').set('mdlogo.png').then(() => {
            logAdminAudit('Mitarbeiterfoto zurückgesetzt', `Profilbild für ${uId} wurde auf Standardlogo zurückgesetzt.`);
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
        showToast('✅ Foto erfolgreich eingereicht. Es liegt jetzt im internen Fotoordner.', 'success', 4200);
    });
}

function openStaffPhotoAdminModal() {
    if (!canUserManageEmployeePhotos()) {
        alert('Keine Berechtigung für den Fotoordner!');
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
                    <input type="file" accept="image/*" style="display:none;" onclick="event.stopPropagation()" onchange="uploadProcessedStaffPhoto(event, '${uId}')">
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
            showToast('✅ Finales Foto wurde in die Mitarbeiterkartei eingesetzt.', 'success');
            renderStaffDirectory();
        });
    });
}

function deleteSubmittedRawPhoto(uId) {
    if (!canUserManageEmployeePhotos()) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isMasterAdmin && !eff.delPhotos) {
        alert('Keine Berechtigung zum Löschen aus dem Fotoordner!');
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
    renderContentFreshnessHints();
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

    hierarchieDaten._updatedAt = Date.now();
    hierarchieDaten._updatedBy = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim();
    db.ref('data/hierarchie').set(hierarchieDaten).then(() => {
        logAdminAudit('Hierarchie vor Ort aktualisiert', `${sessionUser.vorname} ${sessionUser.nachname} hat das Hierarchie-Board gespeichert.`);
        closeHierarchieInlineModal();
        showToast('✅ Hierarchie erfolgreich aktualisiert.', 'success');
    });
}

/* ── REITER: GEHALTSTABELLE ────────────────────────────────── */
function renderGehaltTab(data) {
    renderContentFreshnessHints();
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
    const updatedAt = Date.now();
    const updatedBy = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim();
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
                styleVar: item.styleVar || 'var(--rank-mid)',
                updatedAt,
                updatedBy
            });
        }
    });

    db.ref('data/gehaltstabelle').set(updated).then(() => {
        cachedGehaltData = updated;
        renderGehaltTab(cachedGehaltData);
        closeGehaltInlineModal();
        logAdminAudit('Gehaltstabelle angepasst', `${sessionUser.vorname} ${sessionUser.nachname} hat die Gehaltstabelle aktualisiert.`);
        showToast('✅ Gehaltstabelle erfolgreich gespeichert.', 'success');
    });
}

/* ── REITER: SANKTIONSKATALOG ──────────────────────────────── */
let activeSanctionsFilter = 'all';
let sanctionsEditorEntries = [];
let sanctionsEditorRules = [];

function sanctionsCatalogToObject(list) {
    const out = {};
    (list || []).forEach((item, idx) => {
        const id = item.id || ('san_' + String(idx + 1).padStart(3, '0'));
        out[id] = Object.assign({}, item, { id, order: Number(item.order) || (idx + 1) });
    });
    return out;
}
function sanctionsRulesToObject(list) {
    const out = {};
    (list || []).forEach((item, idx) => {
        const id = item.id || ('rule_' + String(idx + 1));
        out[id] = Object.assign({}, item, { id, order: Number(item.order) || (idx + 1) });
    });
    return out;
}
function compareSanctionsParagraphs(a, b) {
    const parse = value => {
        const m = String(value || '').replace(/[^\d.]/g, '').split('.').filter(Boolean).map(Number);
        return [m[0] || 9999, m[1] || 0, m[2] || 0];
    };
    const av = parse(a), bv = parse(b);
    for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return av[i] - bv[i];
    return String(a || '').localeCompare(String(b || ''), 'de');
}
function getSanctionsEntries(catalog = cachedSanctionsCatalog) {
    const raw = catalog?.entries || {};
    const list = Array.isArray(raw) ? raw.filter(Boolean) : Object.values(raw);
    return list.map((item, idx) => ({
        id:item?.id || ('san_' + String(idx + 1).padStart(3,'0')), order:Number(item?.order) || (idx + 1),
        paragraph:String(item?.paragraph || ''), offense:String(item?.offense || ''), sanction1:String(item?.sanction1 || ''), sanction2:String(item?.sanction2 || ''), sanction3:String(item?.sanction3 || '')
    })).sort((a,b)=>(a.order-b.order)||compareSanctionsParagraphs(a.paragraph,b.paragraph));
}
function getSanctionsRules(catalog = cachedSanctionsCatalog) {
    const raw = catalog?.rules || {};
    const list = Array.isArray(raw) ? raw.filter(Boolean) : Object.values(raw);
    return list.map((item, idx)=>({id:item?.id || ('rule_'+String(idx+1)),order:Number(item?.order)||(idx+1),text:String(item?.text||'')})).sort((a,b)=>a.order-b.order);
}
function sanitizeSanctionsCatalog(raw) {
    const source = raw && typeof raw === 'object' ? raw : defaultSanctionsCatalog;
    const entries=getSanctionsEntries(source), rules=getSanctionsRules(source);
    return {version:String(source.version||'3.0'),entries:sanctionsCatalogToObject(entries.length?entries:getSanctionsEntries(defaultSanctionsCatalog)),rules:sanctionsRulesToObject(rules.length?rules:getSanctionsRules(defaultSanctionsCatalog)),updatedAt:Number(source.updatedAt)||0,updatedBy:String(source.updatedBy||'')};
}
function normalizeSanctionsText(value) {
    let text=String(value||'').toLowerCase()
        .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    text=text.replace(/(\d+)\.(\d{3})/g,'$1$2').replace(/\b(\d+)\s*k\b/g,(_,n)=>String(Number(n)*1000));
    // Suchhilfe: offensichtliche Schreibvariante aus der Quelldatei vereinheitlichen, ohne den sichtbaren Originaltext zu verändern.
    text=text.replace(/\bausendienst\b/g,'aussendienst');
    return text.replace(/[§$€]/g,'').replace(/\s+/g,' ').trim();
}
function sanctionsSearchHaystack(item) {
    const normal=normalizeSanctionsText([item.paragraph,item.offense,item.sanction1,item.sanction2,item.sanction3].join(' '));
    return `${normal} ${normal.replace(/[^a-z0-9]+/g,'')}`;
}
function matchesSanctionsSearch(item, query) {
    const q=normalizeSanctionsText(query); if(!q) return true;
    const hay=sanctionsSearchHaystack(item);
    return q.split(' ').filter(Boolean).every(token=>hay.includes(token)||(token.replace(/[^a-z0-9]+/g,'')&&hay.includes(token.replace(/[^a-z0-9]+/g,''))));
}
function matchesSanctionsFilter(item, filter) {
    if(!filter||filter==='all') return true;
    const text=normalizeSanctionsText([item.sanction1,item.sanction2,item.sanction3].join(' '));
    if(filter==='money') return /\d{4,}/.test(text)||text.includes('paycheck');
    if(filter==='mahnung') return text.includes('mahnung');
    if(filter==='verwarnung') return text.includes('verwarnung');
    if(filter==='kuendigung') return text.includes('kuendigung');
    if(filter==='aussendienst') return text.includes('aussendienst');
    return true;
}
function getSanctionsRuleImportanceClass(text) {
    const normalized = normalizeSanctionsText(text);
    if (normalized.includes('3x verwarnung') && normalized.includes('kuendigung')) return 'sanctions-rule-critical';
    if (normalized.includes('3x mahnung') && normalized.includes('verwarnung')) return 'sanctions-rule-warning';
    if (normalized.includes('jede verwarnung') || normalized.includes('aussendienstsperre')) return 'sanctions-rule-important';
    return '';
}
function renderSanctionsRules() {
    const c=document.getElementById('sanctionsRulesList'); if(!c) return;
    const rules=getSanctionsRules();
    c.innerHTML=rules.length?rules.map(r=>{
        const importanceClass=getSanctionsRuleImportanceClass(r.text);
        return `<div class="sanctions-rule-item ${importanceClass}"><span class="sanctions-rule-bullet">!</span><div>${escapeHtml(r.text)}</div></div>`;
    }).join(''):'<div class="sanctions-rule-item"><div>Keine allgemeinen Regeln hinterlegt.</div></div>';
}
function renderSanctionsCatalog() {
    const tbody=document.getElementById('sanctionsTableBody'); if(!tbody) return;
    const q=document.getElementById('sanctionsSearchInput')?.value||''; const all=getSanctionsEntries();
    const entries=all.filter(i=>matchesSanctionsSearch(i,q)).filter(i=>matchesSanctionsFilter(i,activeSanctionsFilter)).sort((a,b)=>compareSanctionsParagraphs(a.paragraph,b.paragraph));
    tbody.innerHTML=entries.map(i=>`<tr><td data-label="Paragraf" class="sanctions-paragraph-cell">${escapeHtml(i.paragraph||'—')}</td><td data-label="Verstoß" class="sanctions-offense-cell">${escapeHtml(i.offense||'—')}</td><td data-label="1. Sanktion">${escapeHtml(i.sanction1||'—')}</td><td data-label="2. Sanktion">${escapeHtml(i.sanction2||'—')}</td><td data-label="3. Sanktion">${escapeHtml(i.sanction3||'—')}</td></tr>`).join('');
    const count=document.getElementById('sanctionsResultCount'); if(count) count.textContent=entries.length===all.length?`${all.length} Einträge`:`${entries.length} von ${all.length} Einträgen`;
    const none=document.getElementById('sanctionsNoResults'), wrap=document.querySelector('.sanctions-table-wrap'); if(none) none.style.display=entries.length?'none':'block'; if(wrap) wrap.style.display=entries.length?'block':'none';
    const upd=document.getElementById('sanctionsLastUpdated'); if(upd){const ts=Number(cachedSanctionsCatalog?.updatedAt)||0;const by=String(cachedSanctionsCatalog?.updatedBy||'');upd.textContent=ts?`🕒 Zuletzt geändert: ${new Date(ts).toLocaleString('de-DE')}${by?' · '+by:''}`:'☁️ Grundlage: Sanktionskatalog 3.0';}
    renderSanctionsRules();
}
function setSanctionsFilter(filter,btn){activeSanctionsFilter=filter||'all';document.querySelectorAll('.sanctions-filter-chip').forEach(e=>e.classList.remove('active'));if(btn)btn.classList.add('active');renderSanctionsCatalog();}
function resetSanctionsFilters(){const i=document.getElementById('sanctionsSearchInput');if(i)i.value='';activeSanctionsFilter='all';document.querySelectorAll('.sanctions-filter-chip').forEach(e=>e.classList.toggle('active',e.dataset.filter==='all'));renderSanctionsCatalog();if(i)i.focus();}
function toggleSanctionsRules(){const l=document.getElementById('sanctionsRulesList'),b=document.getElementById('sanctionsRulesToggle'),ic=document.getElementById('sanctionsRulesToggleIcon');if(!l)return;const hidden=l.style.display==='none';l.style.display=hidden?'':'none';if(b)b.setAttribute('aria-expanded',hidden?'true':'false');if(ic)ic.textContent=hidden?'▾':'▸';}
async function initializeSanctionsCatalogIfAllowed(){if(sanctionsCatalogBootstrapAttempted||!sessionUser)return;const eff=getUserEffectivePermissions(sessionUser);if(!eff.isMasterAdmin&&!eff.canEditSanctionsCatalog)return;sanctionsCatalogBootstrapAttempted=true;try{const s=await db.ref('data/sanctionsCatalog').once('value');if(!s.exists()){const p=sanitizeSanctionsCatalog(defaultSanctionsCatalog);p.updatedAt=Date.now();p.updatedBy=`${sessionUser.vorname||''} ${sessionUser.nachname||''}`.trim();await db.ref('data/sanctionsCatalog').set(p);logAdminAudit('Sanktionskatalog eingerichtet',`${p.updatedBy||'Berechtigte Person'} hat den Sanktionskatalog 3.0 erstmalig eingerichtet.`);}}catch(err){console.warn('Sanktionskatalog konnte noch nicht automatisch eingerichtet werden:',err);sanctionsCatalogBootstrapAttempted=false;}}
function openSanctionsCatalogEditor(){if(!requirePermission(['canEditSanctionsCatalog','isMasterAdmin'],'Keine Berechtigung zur Bearbeitung des Sanktionskatalogs!'))return;sanctionsEditorEntries=getSanctionsEntries().map(i=>Object.assign({},i));sanctionsEditorRules=getSanctionsRules().map(i=>Object.assign({},i));renderSanctionsCatalogEditor();const m=document.getElementById('sanctionsCatalogEditorModal');if(m)m.style.display='flex';}
function closeSanctionsCatalogEditor(){const m=document.getElementById('sanctionsCatalogEditorModal');if(m)m.style.display='none';}
function renderSanctionsCatalogEditor(){const rc=document.getElementById('sanctionsRulesEditorContainer');if(rc)rc.innerHTML=sanctionsEditorRules.map((r,i)=>`<div class="sanctions-rule-editor-row"><textarea id="san_rule_text_${i}" rows="2" aria-label="Sanktionsregel ${i+1}">${escapeHtml(r.text||'')}</textarea><button type="button" class="btn-delete-row" onclick="removeSanctionsRuleEditorRow(${i})" title="Regel entfernen">🗑️</button></div>`).join('');const tb=document.getElementById('sanctionsEntriesEditorBody');if(tb)tb.innerHTML=sanctionsEditorEntries.map((it,i)=>`<tr><td data-label="Paragraf"><input type="text" id="san_para_${i}" value="${escapeHtml(it.paragraph||'')}" aria-label="Paragraf Zeile ${i+1}"></td><td data-label="Verstoß"><textarea id="san_offense_${i}" rows="2">${escapeHtml(it.offense||'')}</textarea></td><td data-label="1. Sanktion"><textarea id="san_s1_${i}" rows="2">${escapeHtml(it.sanction1||'')}</textarea></td><td data-label="2. Sanktion"><textarea id="san_s2_${i}" rows="2">${escapeHtml(it.sanction2||'')}</textarea></td><td data-label="3. Sanktion"><textarea id="san_s3_${i}" rows="2">${escapeHtml(it.sanction3||'')}</textarea></td><td data-label="Aktion"><button type="button" class="btn-delete-row" onclick="removeSanctionsEntryEditorRow(${i})" title="Eintrag entfernen">🗑️</button></td></tr>`).join('');}
function readSanctionsEditorState(){sanctionsEditorRules=sanctionsEditorRules.map((r,i)=>({id:r.id||('rule_'+Date.now()+'_'+i),order:i+1,text:document.getElementById(`san_rule_text_${i}`)?.value.trim()||''}));sanctionsEditorEntries=sanctionsEditorEntries.map((it,i)=>({id:it.id||('san_'+Date.now()+'_'+i),order:i+1,paragraph:document.getElementById(`san_para_${i}`)?.value.trim()||'',offense:document.getElementById(`san_offense_${i}`)?.value.trim()||'',sanction1:document.getElementById(`san_s1_${i}`)?.value.trim()||'',sanction2:document.getElementById(`san_s2_${i}`)?.value.trim()||'',sanction3:document.getElementById(`san_s3_${i}`)?.value.trim()||''}));}
function addSanctionsRuleEditorRow(){if(!requirePermission(['canEditSanctionsCatalog','isMasterAdmin']))return;readSanctionsEditorState();sanctionsEditorRules.push({id:'rule_'+Date.now(),order:sanctionsEditorRules.length+1,text:''});renderSanctionsCatalogEditor();const rows=document.querySelectorAll('.sanctions-rule-editor-row textarea');rows[rows.length-1]?.focus();}
function removeSanctionsRuleEditorRow(i){if(!requirePermission(['canEditSanctionsCatalog','isMasterAdmin']))return;readSanctionsEditorState();if(!confirm('Diese allgemeine Regel wirklich entfernen?'))return;sanctionsEditorRules.splice(i,1);renderSanctionsCatalogEditor();}
function addSanctionsEntryEditorRow(){if(!requirePermission(['canEditSanctionsCatalog','isMasterAdmin']))return;readSanctionsEditorState();sanctionsEditorEntries.push({id:'san_'+Date.now(),order:sanctionsEditorEntries.length+1,paragraph:'',offense:'',sanction1:'',sanction2:'',sanction3:''});renderSanctionsCatalogEditor();document.getElementById(`san_para_${sanctionsEditorEntries.length-1}`)?.focus();}
function removeSanctionsEntryEditorRow(i){if(!requirePermission(['canEditSanctionsCatalog','isMasterAdmin']))return;readSanctionsEditorState();const it=sanctionsEditorEntries[i];if(!confirm(`Eintrag ${it?.paragraph||''} wirklich entfernen?`))return;sanctionsEditorEntries.splice(i,1);renderSanctionsCatalogEditor();}
async function saveSanctionsCatalogEditor(){if(!requirePermission(['canEditSanctionsCatalog','isMasterAdmin'],'Keine Berechtigung zum Speichern des Sanktionskatalogs!'))return;readSanctionsEditorState();const entries=sanctionsEditorEntries.map((i,x)=>Object.assign({},i,{order:x+1})).filter(i=>i.paragraph||i.offense||i.sanction1||i.sanction2||i.sanction3);const rules=sanctionsEditorRules.map((i,x)=>Object.assign({},i,{order:x+1})).filter(i=>i.text);if(entries.find(i=>!i.paragraph||!i.offense)){alert('Bitte gib bei jedem Eintrag mindestens Paragraf und Verstoß an.');return;}if(!entries.length){alert('Der Sanktionskatalog muss mindestens einen Tabelleneintrag enthalten.');return;}if(!rules.length){alert('Bitte hinterlege mindestens eine allgemeine Sanktionsregel.');return;}const actor=`${sessionUser?.vorname||''} ${sessionUser?.nachname||''}`.trim();const payload={version:'3.0',entries:sanctionsCatalogToObject(entries),rules:sanctionsRulesToObject(rules),updatedAt:Date.now(),updatedBy:actor};try{await db.ref('data/sanctionsCatalog').set(payload);cachedSanctionsCatalog=sanitizeSanctionsCatalog(payload);renderSanctionsCatalog();closeSanctionsCatalogEditor();logAdminAudit('Sanktionskatalog aktualisiert',`${actor||'Berechtigte Person'} hat den Sanktionskatalog gespeichert (${entries.length} Einträge).`);showToast('✅ Sanktionskatalog erfolgreich gespeichert.', 'success');}catch(err){console.error('Sanktionskatalog speichern fehlgeschlagen:',err);alert('Der Sanktionskatalog konnte nicht gespeichert werden. Bitte versuche es erneut.');}}

/* ── REITER 3: FUNK & CODES (INLINE EDIT) ───────────────────── */
function renderGuideTab() {
    renderContentFreshnessHints();
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
    if (!requirePermission(['canEditGuide','delGuide','isMasterAdmin'], 'Keine Berechtigung zur Verwaltung von Funk & Codes!')) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const canEditGuide = !!(eff.canEditGuide || eff.isMasterAdmin);
    const cont = document.getElementById('guideInlineEditorContainer');
    if (!cont) return;
    
    cont.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:18px;">
            <div style="background:rgba(15,23,42,0.6);padding:16px;border-radius:12px;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h4 style="margin:0;color:var(--primary);">📻 Ten Codes</h4>
                    ${canEditGuide ? `<button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;" onclick="addGuideRow('tenCodes')">➕ Zeile hinzufügen</button>` : ''}
                </div>
                <div id="inlineGuide_tenCodes"></div>
            </div>

            <div style="background:rgba(15,23,42,0.6);padding:16px;border-radius:12px;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h4 style="margin:0;color:var(--warning);">📟 Status Codes</h4>
                    ${canEditGuide ? `<button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;" onclick="addGuideRow('statusCodes')">➕ Zeile hinzufügen</button>` : ''}
                </div>
                <div id="inlineGuide_statusCodes"></div>
            </div>

            <div style="background:rgba(15,23,42,0.6);padding:16px;border-radius:12px;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h4 style="margin:0;color:var(--primary);">🚑 Streifen-Anordnung</h4>
                    ${canEditGuide ? `<button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;" onclick="addGuideRow('streifen')">➕ Zeile hinzufügen</button>` : ''}
                </div>
                <div id="inlineGuide_streifen"></div>
            </div>

            <div style="background:rgba(15,23,42,0.6);padding:16px;border-radius:12px;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h4 style="margin:0;color:var(--success);">🚫 Keine Rechnung (Ausnahmen)</h4>
                    ${canEditGuide ? `<button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;" onclick="addKeineRechnungRow()">➕ Ausnahme hinzufügen</button>` : ''}
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
    const canEdit = !!(eff.canEditGuide || eff.isMasterAdmin);
    c.innerHTML = list.map((item, idx) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
            <input type="text" id="${section}_code_${idx}" aria-label="${section} Code Zeile ${idx+1}" value="${escapeHtml(item.code||'')}" style="width:110px;" placeholder="Code" ${canEdit ? '' : 'disabled'}>
            <input type="text" id="${section}_desc_${idx}" aria-label="${section} Beschreibung Zeile ${idx+1}" value="${escapeHtml(item.desc||'')}" style="flex:1;" placeholder="Beschreibung" ${canEdit ? '' : 'disabled'}>
            ${eff.delGuide ? `<button type="button" class="btn-delete-row" aria-label="${section} Eintrag ${idx+1} löschen" onclick="removeGuideRow('${section}', ${idx})">🗑️</button>` : ''}
        </div>
    `).join('');
}

function renderKeineRechnungInlineRows() {
    const c = document.getElementById('inlineGuide_keineRechnung'); if (!c) return;
    const list = cachedGuideData.keineRechnung || [];
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const canEdit = !!(eff.canEditGuide || eff.isMasterAdmin);
    c.innerHTML = list.map((item, idx) => `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
            <input type="text" id="kr_name_${idx}" value="${escapeHtml(item.name||'')}" style="width:180px;" placeholder="Fraktion / Name" ${canEdit ? '' : 'disabled'}>
            <input type="text" id="kr_note_${idx}" value="${escapeHtml(item.note||'')}" style="width:180px;" placeholder="Zusatz (z.B. SAPD...)" ${canEdit ? '' : 'disabled'}>
            <input type="text" id="kr_desc_${idx}" value="${escapeHtml(item.desc||'')}" style="flex:1;" placeholder="Bedingung" ${canEdit ? '' : 'disabled'}>
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
    if (!requirePermission(['canEditGuide','delGuide','isMasterAdmin'], 'Keine Berechtigung zum Speichern von Funk & Codes!')) return;
    const eff = getUserEffectivePermissions(sessionUser);
    const canEdit = !!(eff.canEditGuide || eff.isMasterAdmin);
    if (canEdit) ['tenCodes', 'statusCodes', 'streifen'].forEach(sec => {
        (cachedGuideData[sec] || []).forEach((item, idx) => {
            const cInp = document.getElementById(`${sec}_code_${idx}`);
            const dInp = document.getElementById(`${sec}_desc_${idx}`);
            if (cInp) item.code = cInp.value.trim();
            if (dInp) item.desc = dInp.value.trim();
        });
    });

    if (canEdit) (cachedGuideData.keineRechnung || []).forEach((item, idx) => {
        const nInp = document.getElementById(`kr_name_${idx}`);
        const noInp = document.getElementById(`kr_note_${idx}`);
        const dInp = document.getElementById(`kr_desc_${idx}`);
        if (nInp) item.name = nInp.value.trim();
        if (noInp) item.note = noInp.value.trim();
        if (dInp) item.desc = dInp.value.trim();
    });

    cachedGuideData._updatedAt = Date.now();
    cachedGuideData._updatedBy = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim();
    db.ref('data/guide').set(cachedGuideData).then(() => {
        renderGuideTab();
        closeGuideInlineModal();
        logAdminAudit('Funk & Codes aktualisiert', `${sessionUser.vorname} ${sessionUser.nachname} hat Codes vor Ort geändert.`);
        showToast('✅ Funk & Codes gespeichert.', 'success');
    });
}

/* ── REITER: COMMANDS (ALPHABETISCH SORTIERT & LINKBAR) ────── */
function renderCommandsTab(obj) {
    renderContentFreshnessHints();
    const cont = document.getElementById('commandsAccordionContainer'); if (!cont) return;
    const all = Object.assign({}, defaultCommands, obj || {});
    
    const validEntries = Object.entries(all).filter(([, c]) => !c.deleted);
    let kats = [...new Set(validEntries.map(([, c]) => c.kat || 'Allgemein'))].sort((a,b) => a.localeCompare(b, 'de'));
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};

    if (!eff.isMasterAdmin && eff.allowedCmdKats && eff.allowedCmdKats.length > 0) {
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
    if (!requirePermission(['canEditCommands','delCommands','isMasterAdmin'], 'Keine Berechtigung zur Verwaltung der Commands!')) return;
    const cont = document.getElementById('commandsInlineEditorContainer');
    if (!cont) return;

    db.ref('data/dienstCommands').once('value', snap => {
        const cloudData = snap.val() || {};
        const allCmds = Object.assign({}, defaultCommands, cloudData);
        const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
        const canEditCommands = !!(eff.canEditCommands || eff.isMasterAdmin);

        const entries = Object.entries(allCmds).filter(([, c]) => !c.deleted)
            .sort((a,b) => {
                const katDiff = (a[1].kat || 'Allgemein').localeCompare(b[1].kat || 'Allgemein', 'de');
                if (katDiff !== 0) return katDiff;
                return (a[1].name || '').localeCompare(b[1].name || '', 'de');
            });

        let existingRowsHtml = entries.map(([k, c]) => `
            <div style="background:rgba(30,41,59,0.4);border:1px solid var(--border);border-radius:10px;padding:10px;display:grid;grid-template-columns:1.5fr 2.5fr 1.5fr auto;gap:8px;align-items:center;margin-bottom:8px;">
                <input type="text" id="cmd_name_${k}" aria-label="Command Name" value="${escapeHtml(c.name || '')}" placeholder="Name" ${canEditCommands ? '' : 'disabled'}>
                <input type="text" id="cmd_desc_${k}" aria-label="Command Beschreibung" value="${escapeHtml(c.desc || c.description || '')}" placeholder="Beschreibung (inkl. https:// Links)" ${canEditCommands ? '' : 'disabled'}>
                <input type="text" id="cmd_kat_${k}" aria-label="Command Kategorie" value="${escapeHtml(c.kat || 'Allgemein')}" placeholder="Kategorie" ${canEditCommands ? '' : 'disabled'}>
                <div style="display:flex;gap:6px;">
                    ${canEditCommands ? `<button type="button" class="btn" style="width:auto;margin:0;padding:6px 12px;font-size:12px;background:var(--primary);color:#080c14;font-weight:800;" onclick="editCommandInline('${k}')">💾</button>` : ''}
                    ${eff.delCommands ? `<button type="button" class="btn-delete-row" onclick="deleteDienstCommand('${k}')">🗑️</button>` : ''}
                </div>
            </div>
        `).join('');

        cont.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:18px;">
                ${canEditCommands ? `<div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:10px;border:1px solid var(--border);">
                    <h4 style="margin:0 0 10px 0;color:var(--success);">➕ Neuen Command anlegen</h4>
                    <div style="display:grid;grid-template-columns:1.5fr 2.5fr 1.5fr auto;gap:8px;">
                        <input type="text" id="inlineNewCmdName" placeholder="Name (z.B. !funk)">
                        <input type="text" id="inlineNewCmdDesc" placeholder="Beschreibung (inkl. Webadresse)">
                        <input type="text" id="inlineNewCmdKat" placeholder="Kategorie">
                        <button type="button" class="btn" style="width:auto;margin:0;padding:8px 16px;" onclick="addCommandInline()">Hinzufügen</button>
                    </div>
                </div>` : ''}

                <div>
                    <h4 style="margin:0 0 10px 0;color:var(--primary);">📋 Bestehende Commands verwalten (Alphabetisch A bis Z)</h4>
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
    const updatedAt = Date.now();
    const updatedBy = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim();
    db.ref('data/dienstCommands').push({ name, desc, kat, updatedAt, updatedBy }).then(() => {
        showToast('✅ Command angelegt.', 'success');
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

    const updatedAt = Date.now();
    const updatedBy = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim();
    db.ref('data/dienstCommands/' + k).set({ name, desc, kat, updatedAt, updatedBy }).then(() => {
        logAdminAudit('Command bearbeitet', `${sessionUser.vorname} ${sessionUser.nachname} hat Command "${name}" geändert.`);
        showToast('✅ Command erfolgreich gespeichert.', 'success');
    });
}

function deleteDienstCommand(k) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delCommands) return;
    if (confirm('Command löschen?')) {
        db.ref('data/dienstCommands/' + k).set({ deleted: true, updatedAt: Date.now(), updatedBy: `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim() }).then(() => {
            logAdminAudit('Command gelöscht', `Command ${k} gelöscht durch ${sessionUser.vorname} ${sessionUser.nachname}`);
        });
    }
}

/* ── REITER 4: LINKS & DOKUMENTE (AUTOMATISCHES HTTPS) ──────── */
function renderLinksTab(obj) {
    renderContentFreshnessHints();
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

    if (!eff.isMasterAdmin && eff.allowedLinkKats && eff.allowedLinkKats.length > 0) {
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
    if (!requirePermission(['canEditLinks','delLinks','isMasterAdmin'], 'Keine Berechtigung zur Verwaltung der Links!')) return;
    const cont = document.getElementById('linksInlineEditorContainer');
    if (!cont) return;

    db.ref('data/dienstLinks').once('value', snap => {
        const cloudData = snap.val() || {};
        const allLinks = Object.assign({}, defaultLinks, cloudData);
        const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
        const canEditLinks = !!(eff.canEditLinks || eff.isMasterAdmin);

        const entries = Object.entries(allLinks).filter(([, l]) => !l.deleted)
            .sort((a,b) => {
                const katDiff = (a[1].kat || a[1].thema || 'Allgemein').localeCompare(b[1].kat || b[1].thema || 'Allgemein', 'de');
                if (katDiff !== 0) return katDiff;
                return (a[1].name || '').localeCompare(b[1].name || '', 'de');
            });

        let existingRowsHtml = entries.map(([k, l]) => `
            <div style="background:rgba(30,41,59,0.4);border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;margin-bottom:10px;" id="link_row_${k}">
                <div style="grid-template-columns:1fr 1fr;gap:8px;display:grid;">
                    <input type="text" id="link_name_${k}" aria-label="Link Titel" value="${escapeHtml(l.name || '')}" placeholder="Titel" ${canEditLinks ? '' : 'disabled'}>
                    <input type="text" id="link_url_${k}" aria-label="Link Webadresse" value="${escapeHtml(l.url || '')}" placeholder="https://docs.google.com/..." ${canEditLinks ? '' : 'disabled'}>
                </div>
                <div style="grid-template-columns:2fr 1fr auto;gap:8px;align-items:center;display:grid;">
                    <input type="text" id="link_desc_${k}" aria-label="Link Beschreibung" value="${escapeHtml(l.desc || l.description || '')}" placeholder="Beschreibung" ${canEditLinks ? '' : 'disabled'}>
                    <input type="text" id="link_kat_${k}" aria-label="Link Kategorie" value="${escapeHtml(l.kat || l.thema || 'Allgemein')}" placeholder="Kategorie" ${canEditLinks ? '' : 'disabled'}>
                    <div style="display:flex;gap:6px;">
                        ${canEditLinks ? `<button type="button" class="btn" style="width:auto;margin:0;padding:6px 12px;font-size:12px;background:var(--primary);color:#080c14;font-weight:800;" onclick="editLinkInline('${k}')">💾</button>` : ''}
                        ${eff.delLinks ? `<button type="button" class="btn-delete-row" onclick="deleteDienstLink('${k}')">🗑️</button>` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        cont.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:18px;">
                ${canEditLinks ? `<div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:10px;border:1px solid var(--border);">
                    <h4 style="margin:0 0 10px 0;color:var(--primary);">➕ Neuen Dokumentenlink anlegen</h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                        <input type="text" id="inlineNewLinkName" placeholder="Titel des Links">
                        <input type="text" id="inlineNewLinkUrl" placeholder="https://docs.google.com/..." ${canEditLinks ? '' : 'disabled'}>
                    </div>
                    <div style="display:grid;grid-template-columns:2fr 1fr auto;gap:8px;">
                        <input type="text" id="inlineNewLinkDesc" placeholder="Beschreibung">
                        <input type="text" id="inlineNewLinkKat" placeholder="Kategorie (z.B. MD Intern)">
                        <button type="button" class="btn" style="width:auto;margin:0;padding:8px 16px;" onclick="addLinkInline()">Hinzufügen</button>
                    </div>
                </div>` : ''}

                <div>
                    <h4 style="margin:0 0 10px 0;color:var(--primary);">📁 Bestehende Links verwalten (Alphabetisch A bis Z)</h4>
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

    const updatedAt = Date.now();
    const updatedBy = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim();
    db.ref('data/dienstLinks').push({ name, url, desc, kat, updatedAt, updatedBy }).then(() => {
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

    const updatedAt = Date.now();
    const updatedBy = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim();
    db.ref('data/dienstLinks/' + k).set({ name, url, desc, kat, updatedAt, updatedBy }).then(() => {
        logAdminAudit('Link bearbeitet', `${sessionUser.vorname} ${sessionUser.nachname} hat Link "${name}" geändert.`);
        alert('✅ Link erfolgreich gespeichert!');
    });
}

function deleteDienstLink(k) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delLinks) return;
    if (confirm('Link wirklich löschen?')) {
        db.ref('data/dienstLinks/' + k).set({ deleted: true, updatedAt: Date.now(), updatedBy: `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim() }).then(() => {
            const rowEl = document.getElementById('link_row_' + k);
            if (rowEl) rowEl.remove();
            alert('✅ Link erfolgreich gelöscht!');
        }).catch(err => {
            alert('Der Link konnte nicht gelöscht werden. Bitte versuche es erneut.');
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
    if (!requireMasterAdminAccess('Nur Master Admins dürfen den Changelog bearbeiten!')) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isMasterAdmin) {
        alert('Nur Master Admins können neue Changelogs direkt eintragen!');
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
    if (!requireMasterAdminAccess('Nur Master Admins dürfen Changelog-Einträge speichern!')) return;
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
        'Verbesserung': 'changelog-badge-change',
        'Fehlerbehebung': 'changelog-badge-bugfix',
        'Bugfix': 'changelog-badge-bugfix',
        'Design': 'changelog-badge-design',
        'Technische Änderung': 'changelog-badge-tech'
    };

    const customList = Object.entries(cachedCustomChangelogs || {}).map(([id, item]) => Object.assign({ id, isCustom: true }, item));
    const allEntries = [...customList, ...systemChangelogs].sort((a, b) => (b.ts || 0) - (a.ts || 0));

    cont.innerHTML = allEntries.map(entry => {
        const displayCategory = entry.category === 'Technische Änderung' ? 'Verbesserung' : (entry.category === 'Bugfix' ? 'Fehlerbehebung' : entry.category);
        const bClass = catBadgeClassMap[displayCategory] || 'changelog-badge-update';
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

/* ── PERSÖNLICHE MITARBEITERHINWEISE ───────────────────────── */
function getEmployeeNoticePermissions() {
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    return {
        canSend: !!(eff.canSendEmployeeNotices || eff.isMasterAdmin),
        canViewRead: !!(eff.canViewEmployeeNoticeRead || eff.isMasterAdmin),
        canDelete: !!(eff.delEmployeeNotices || eff.isMasterAdmin)
    };
}

function isEmployeeNoticeExpired(notice) {
    const expiresAt = Number(notice?.expiresAt || 0);
    return expiresAt > 0 && expiresAt < Date.now();
}

function getPendingEmployeeNoticeEntries() {
    return Object.entries(cachedMyEmployeeNotices || {})
        .filter(([, notice]) => notice && !notice.ack && !isEmployeeNoticeExpired(notice))
        .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
}

function refreshEmployeeNoticeListeners() {
    if (employeeNoticeOwnRef) {
        employeeNoticeOwnRef.off();
        employeeNoticeOwnRef = null;
    }
    if (employeeNoticeAdminRef) {
        employeeNoticeAdminRef.off();
        employeeNoticeAdminRef = null;
    }
    cachedMyEmployeeNotices = {};
    cachedManagedEmployeeNotices = {};

    if (!sessionUser || isMaintenanceRestrictedSession()) {
        renderEmployeeNoticeFeedPanels();
        return;
    }

    const myId = getUserAccountId(sessionUser);
    if (!myId) return;

    employeeNoticeOwnRef = db.ref('data/employeeNotices/' + myId);
    employeeNoticeOwnRef.on('value', snap => {
        cachedMyEmployeeNotices = snap.val() || {};
        renderEmployeeNoticeFeedPanels();
        renderNewsFeedData(cachedNews);
        updatePersonalOverview();
        showNextEmployeeNoticePopup();
    }, err => console.error('Mitarbeiterhinweise konnten nicht geladen werden:', err));

    const perms = getEmployeeNoticePermissions();
    if (perms.canViewRead || perms.canDelete) {
        employeeNoticeAdminRef = db.ref('data/employeeNotices');
        employeeNoticeAdminRef.on('value', snap => {
            cachedManagedEmployeeNotices = snap.val() || {};
            renderEmployeeNoticeFeedPanels();
        }, err => console.error('Mitarbeiterhinweis-Übersicht konnte nicht geladen werden:', err));
    }

    renderEmployeeNoticeRecipientOptions();
    renderEmployeeNoticeFeedPanels();
}

function getSelectedEmployeeNoticeRecipientIds() {
    return Array.from(document.querySelectorAll('#employeeNoticeRecipientList input[type="checkbox"]:checked'))
        .map(input => input.value)
        .filter(Boolean);
}

function updateEmployeeNoticeRecipientCount() {
    const countEl = document.getElementById('employeeNoticeRecipientCount');
    if (!countEl) return;
    const count = getSelectedEmployeeNoticeRecipientIds().length;
    countEl.textContent = count === 1 ? '1 Mitarbeiter ausgewählt' : `${count} Mitarbeiter ausgewählt`;
}

function renderEmployeeNoticeRecipientOptions() {
    const container = document.getElementById('employeeNoticeRecipientList');
    if (!container) return;

    const selectedIds = new Set(getSelectedEmployeeNoticeRecipientIds());
    const users = Object.entries(cachedUsers || {})
        .filter(([, user]) => user && (user.status || 'pending') === 'approved')
        .sort((a, b) => {
            const dnDiff = parseDN(a[1].dn) - parseDN(b[1].dn);
            if (dnDiff !== 0) return dnDiff;
            const an = `${a[1].nachname || ''} ${a[1].vorname || ''}`.trim();
            const bn = `${b[1].nachname || ''} ${b[1].vorname || ''}`.trim();
            return an.localeCompare(bn, 'de');
        });

    if (!users.length) {
        container.innerHTML = '<div class="employee-notice-recipient-empty">Keine freigeschalteten Mitarbeiter vorhanden.</div>';
        updateEmployeeNoticeRecipientCount();
        return;
    }

    container.innerHTML = users.map(([uId, user]) => {
        const name = `${user.vorname || ''} ${user.nachname || ''}`.trim() || uId;
        return `
            <label class="employee-notice-recipient-option">
                <input type="checkbox" value="${escapeHtml(uId)}" ${selectedIds.has(uId) ? 'checked' : ''} onchange="updateEmployeeNoticeRecipientCount()">
                <span class="employee-notice-recipient-dn">${escapeHtml(formatStaffDn(user.dn))}</span>
                <span class="employee-notice-recipient-name">${escapeHtml(name)}</span>
            </label>
        `;
    }).join('');

    updateEmployeeNoticeRecipientCount();
}

function toggleEmployeeNoticeComposer(forceOpen = null) {
    const box = document.getElementById('employeeNoticeComposer');
    if (!box) return;
    const perms = getEmployeeNoticePermissions();
    if (!perms.canSend) {
        box.style.display = 'none';
        return;
    }
    const shouldOpen = forceOpen === null ? box.style.display === 'none' || !box.style.display : !!forceOpen;
    box.style.display = shouldOpen ? 'block' : 'none';
    if (shouldOpen) {
        renderEmployeeNoticeRecipientOptions();
        document.querySelector('#employeeNoticeRecipientList input[type="checkbox"]')?.focus();
    }
}

function clearEmployeeNoticeComposer() {
    ['employeeNoticeTitle','employeeNoticeMessage','employeeNoticeExpiresAt'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.querySelectorAll('#employeeNoticeRecipientList input[type="checkbox"]').forEach(input => {
        input.checked = false;
    });
    updateEmployeeNoticeRecipientCount();
}

async function sendEmployeeNotice() {
    if (!sessionUser) return;
    const perms = getEmployeeNoticePermissions();
    if (!perms.canSend) {
        alert('Keine Berechtigung zum Senden von Mitarbeiterhinweisen!');
        return;
    }

    const recipientIds = getSelectedEmployeeNoticeRecipientIds();
    const title = document.getElementById('employeeNoticeTitle')?.value.trim() || '';
    const message = document.getElementById('employeeNoticeMessage')?.value.trim() || '';
    const expiresRaw = document.getElementById('employeeNoticeExpiresAt')?.value || '';
    const recipients = recipientIds
        .map(recipientId => [recipientId, cachedUsers[recipientId]])
        .filter(([, recipient]) => recipient && (recipient.status || 'pending') === 'approved');

    if (!recipients.length || recipients.length !== recipientIds.length) {
        alert('Bitte mindestens einen gültigen Mitarbeiter auswählen.');
        return;
    }
    if (!title || !message) {
        alert('Bitte Betreff und Hinweistext ausfüllen.');
        return;
    }

    let expiresAt = 0;
    if (expiresRaw) {
        const expiry = new Date(expiresRaw + 'T23:59:59');
        if (Number.isNaN(expiry.getTime())) {
            alert('Das Ablaufdatum ist ungültig.');
            return;
        }
        if (expiry.getTime() < Date.now()) {
            alert('Das Ablaufdatum muss in der Zukunft liegen.');
            return;
        }
        expiresAt = expiry.getTime();
    }

    const senderId = getUserAccountId(sessionUser);
    const senderName = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim();
    const createdAt = Date.now();
    const updates = {};
    const recipientNames = [];

    recipients.forEach(([recipientId, recipient]) => {
        const noticeId = db.ref(`data/employeeNotices/${recipientId}`).push().key;
        const recipientName = `${recipient.vorname || ''} ${recipient.nachname || ''}`.trim();
        recipientNames.push(`${formatStaffDn(recipient.dn)} – ${recipientName || recipientId}`);
        updates[`${recipientId}/${noticeId}`] = {
            id: noticeId,
            recipientId,
            recipientName,
            recipientDn: recipient.dn || '',
            title,
            message,
            senderId,
            senderName,
            createdAt,
            expiresAt
        };
    });

    try {
        await db.ref('data/employeeNotices').update(updates);
        clearEmployeeNoticeComposer();
        toggleEmployeeNoticeComposer(false);
        logAdminAudit(
            'Mitarbeiterhinweis gesendet',
            `${senderName} → ${recipients.length} Mitarbeiter: ${title} | ${recipientNames.join(', ')}`
        );
        alert(recipients.length === 1
            ? '✅ Mitarbeiterhinweis wurde gesendet.'
            : `✅ Mitarbeiterhinweis wurde an ${recipients.length} Mitarbeiter gesendet.`);
    } catch (err) {
        console.error('Mitarbeiterhinweis konnte nicht gesendet werden:', err);
        alert('Der Mitarbeiterhinweis konnte nicht gesendet werden. Bitte Berechtigung und Firebase Rules prüfen.');
    }
}

function renderEmployeeNoticeFeedPanels() {
    const myBox = document.getElementById('myEmployeeNoticesContainer');
    const manageBox = document.getElementById('employeeNoticeManagementContainer');
    const sendBtn = document.getElementById('btnOpenEmployeeNoticeComposer');
    const perms = getEmployeeNoticePermissions();

    if (sendBtn) sendBtn.style.display = perms.canSend ? 'inline-flex' : 'none';

    if (myBox) {
        const entries = Object.entries(cachedMyEmployeeNotices || {})
            .filter(([, notice]) => !!notice)
            .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

        if (!entries.length) {
            myBox.style.display = 'none';
            myBox.innerHTML = '';
        } else {
            myBox.style.display = 'block';
            myBox.innerHTML = `
                <div class="employee-notice-section-head">
                    <div>
                        <h3>📨 Meine Mitarbeiterhinweise</h3>
                        <p>Persönliche Informationen für dich. Antworten sind hier nicht vorgesehen.</p>
                    </div>
                </div>
                <div class="employee-notice-list">
                    ${entries.map(([noticeId, notice]) => {
                        const expired = isEmployeeNoticeExpired(notice);
                        const acknowledged = !!notice.ack;
                        const state = acknowledged
                            ? '<span class="employee-notice-badge done">✅ Bestätigt</span>'
                            : expired
                                ? '<span class="employee-notice-badge expired">⌛ Abgelaufen</span>'
                                : '<span class="employee-notice-badge open">🔔 Offen</span>';
                        return `
                            <div class="employee-notice-card ${acknowledged ? 'acknowledged' : ''}">
                                <div class="employee-notice-card-head">
                                    <div>
                                        <b>${escapeHtml(notice.title || 'Hinweis')}</b>
                                        <span>von ${escapeHtml(notice.senderName || 'Leitung')} · ${formatTimestampShort(notice.createdAt)}</span>
                                    </div>
                                    ${state}
                                </div>
                                <div class="employee-notice-message">${formatTextWithLinks(notice.message || '')}</div>
                                ${notice.expiresAt ? `<div class="employee-notice-meta">Gültig bis: ${escapeHtml(new Date(notice.expiresAt).toLocaleDateString('de-DE'))}</div>` : ''}
                                ${!acknowledged && !expired ? `<button type="button" class="btn employee-notice-ack-inline" onclick="acknowledgeEmployeeNotice('${noticeId}')">✅ Zur Kenntnis genommen</button>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    }

    if (manageBox) {
        if (!perms.canViewRead && !perms.canDelete) {
            manageBox.style.display = 'none';
            manageBox.innerHTML = '';
        } else {
            const flat = [];
            Object.entries(cachedManagedEmployeeNotices || {}).forEach(([recipientId, notices]) => {
                Object.entries(notices || {}).forEach(([noticeId, notice]) => {
                    if (notice) flat.push({ recipientId, noticeId, notice });
                });
            });
            flat.sort((a,b)=>(b.notice.createdAt||0)-(a.notice.createdAt||0));

            manageBox.style.display = 'block';
            manageBox.innerHTML = `
                <div class="employee-notice-section-head">
                    <div>
                        <h3>📋 Mitarbeiterhinweise Übersicht</h3>
                        <p>${perms.canViewRead ? 'Hier ist sichtbar, ob und wann ein persönlicher Hinweis bestätigt wurde.' : 'Hier können vorhandene Mitarbeiterhinweise verwaltet werden.'}</p>
                    </div>
                </div>
                <div class="employee-notice-management-list">
                    ${flat.length ? flat.map(({recipientId, noticeId, notice}) => {
                        const ack = notice.ack;
                        const expired = isEmployeeNoticeExpired(notice);
                        let status = '<span class="employee-notice-badge open">🔔 Offen</span>';
                        if (perms.canViewRead && ack) status = `<span class="employee-notice-badge done">✅ Bestätigt · ${formatTimestampShort(ack.ts)}</span>`;
                        else if (expired) status = '<span class="employee-notice-badge expired">⌛ Abgelaufen</span>';
                        else if (!perms.canViewRead) status = '<span class="employee-notice-badge neutral">📨 Hinweis</span>';
                        return `
                            <div class="employee-notice-manage-row">
                                <div class="employee-notice-manage-main">
                                    <b>${notice.recipientDn ? escapeHtml(formatStaffDn(notice.recipientDn)) + ' – ' : ''}${escapeHtml(notice.recipientName || recipientId)}</b>
                                    <span>${escapeHtml(notice.title || 'Hinweis')}</span>
                                    <small>von ${escapeHtml(notice.senderName || 'Leitung')} · ${formatTimestampShort(notice.createdAt)}</small>
                                </div>
                                <div class="employee-notice-manage-actions">
                                    ${status}
                                    ${perms.canDelete ? `<button type="button" class="btn-delete-row" onclick="deleteEmployeeNotice('${recipientId}','${noticeId}')" title="Mitarbeiterhinweis löschen">🗑️</button>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('') : '<div class="employee-notice-empty">Noch keine Mitarbeiterhinweise vorhanden.</div>'}
                </div>
            `;
        }
    }
}

function formatTimestampShort(ts) {
    if (!ts) return '--';
    try {
        return new Date(ts).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch (_) {
        return '--';
    }
}

function showNextEmployeeNoticePopup() {
    if (!sessionUser) return;
    const modal = document.getElementById('employeeNoticePopupModal');
    if (!modal) return;

    const pending = getPendingEmployeeNoticeEntries();
    if (!pending.length) {
        activeEmployeeNoticeId = '';
        modal.style.display = 'none';
        return;
    }

    if (activeEmployeeNoticeId && cachedMyEmployeeNotices[activeEmployeeNoticeId] && !cachedMyEmployeeNotices[activeEmployeeNoticeId].ack && !isEmployeeNoticeExpired(cachedMyEmployeeNotices[activeEmployeeNoticeId])) {
        return;
    }

    const [noticeId, notice] = pending[0];
    activeEmployeeNoticeId = noticeId;
    const titleEl = document.getElementById('employeeNoticePopupTitle');
    const messageEl = document.getElementById('employeeNoticePopupMessage');
    const metaEl = document.getElementById('employeeNoticePopupMeta');
    const expiryEl = document.getElementById('employeeNoticePopupExpiry');
    if (titleEl) titleEl.textContent = notice.title || 'Mitarbeiterhinweis';
    if (messageEl) messageEl.innerHTML = formatTextWithLinks(notice.message || '');
    if (metaEl) metaEl.textContent = `Von ${notice.senderName || 'Leitung'} · ${formatTimestampShort(notice.createdAt)}`;
    if (expiryEl) {
        expiryEl.textContent = notice.expiresAt ? `Gültig bis ${new Date(notice.expiresAt).toLocaleDateString('de-DE')}` : '';
        expiryEl.style.display = notice.expiresAt ? 'block' : 'none';
    }
    modal.style.display = 'flex';
}

async function acknowledgeEmployeeNotice(noticeId = activeEmployeeNoticeId) {
    if (!sessionUser || !noticeId) return;
    const myId = getUserAccountId(sessionUser);
    if (!myId || !cachedMyEmployeeNotices[noticeId]) return;

    try {
        await db.ref(`data/employeeNotices/${myId}/${noticeId}/ack`).set({
            name: `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim(),
            dn: sessionUser.dn || '',
            ts: Date.now()
        });
        activeEmployeeNoticeId = '';
        const modal = document.getElementById('employeeNoticePopupModal');
        if (modal) modal.style.display = 'none';
        showNextEmployeeNoticePopup();
    } catch (err) {
        console.error('Mitarbeiterhinweis konnte nicht bestätigt werden:', err);
        alert('Der Hinweis konnte gerade nicht bestätigt werden. Bitte versuche es erneut.');
    }
}

async function deleteEmployeeNotice(recipientId, noticeId) {
    const perms = getEmployeeNoticePermissions();
    if (!perms.canDelete) {
        alert('Keine Berechtigung zum Löschen von Mitarbeiterhinweisen!');
        return;
    }
    if (!recipientId || !noticeId || !confirm('Diesen persönlichen Mitarbeiterhinweis wirklich löschen?')) return;

    try {
        await db.ref(`data/employeeNotices/${recipientId}/${noticeId}`).remove();
        logAdminAudit('Mitarbeiterhinweis gelöscht', `Hinweis ${noticeId} gelöscht durch ${sessionUser.vorname} ${sessionUser.nachname}`);
    } catch (err) {
        console.error('Mitarbeiterhinweis konnte nicht gelöscht werden:', err);
        alert('Der Mitarbeiterhinweis konnte nicht gelöscht werden.');
    }
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
        const employeeNoticeUnread = getPendingEmployeeNoticeEntries().length;
        const totalUnread = unreadCount + employeeNoticeUnread;
        if (totalUnread > 0) {
            unreadBadge.textContent = totalUnread;
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
        const canEditThisNews = isAuthor || eff.canPostNews || eff.isMasterAdmin;

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
    if (!eff.canViewNewsRead && !eff.isMasterAdmin) {
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

function togglePostNewsForm(forceClose = false) {
    if (!sessionUser) return;
    const e = document.getElementById('postNewsContainer');
    if (!e) return;
    const isHidden = (e.style.display === 'none' || !e.style.display);
    if (isHidden) {
        const eff = getUserEffectivePermissions(sessionUser);
        if (!eff.canPostNews && !eff.isMasterAdmin) {
            alert('Keine Berechtigung zum Veröffentlichen von News!');
            return;
        }
    }
    if (isHidden) {
        clearUnsavedChanges('newsPost');
        document.getElementById('editingNewsId').value = '';
        document.getElementById('newNewsTitle').value = '';
        document.getElementById('newNewsContent').value = '';
        document.getElementById('postNewsFormHeading').textContent = '📝 Neuen News-Thread verfassen';
        document.getElementById('btnSaveNewsSubmit').textContent = '📢 Veröffentlichen';
        e.style.display = 'block';
    } else {
        if (!forceClose && !confirmDiscardUnsavedChanges('newsPost')) return;
        clearUnsavedChanges('newsPost');
        e.style.display = 'none';
    }
}

function toggleProposeNewsForm(forceClose = false) {
    const e = document.getElementById('proposeNewsContainer');
    if (!e) return;
    const isHidden = e.style.display === 'none' || !e.style.display;
    if (isHidden) {
        clearUnsavedChanges('newsProposal');
        e.style.display = 'block';
    } else {
        if (!forceClose && !confirmDiscardUnsavedChanges('newsProposal')) return;
        clearUnsavedChanges('newsProposal');
        e.style.display = 'none';
    }
}

function openEditNewsModal(newsId) {
    if (!sessionUser) return;
    if (!confirmDiscardUnsavedChanges('newsPost')) return;
    clearUnsavedChanges('newsPost');
    const n = cachedNews[newsId];
    if (!n) return;
    const eff = getUserEffectivePermissions(sessionUser);
    const myId = getUserAccountId(sessionUser);
    const myName = `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim().toLowerCase();
    const isAuthor = (n.authorId && n.authorId === myId) || ((n.author || '').trim().toLowerCase() === myName && myName.length > 0);
    if (!isAuthor && !eff.canPostNews && !eff.isMasterAdmin) {
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
        if (!isOwn && !eff.canPostNews && !eff.isMasterAdmin) {
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
            clearUnsavedChanges('newsPost');
            togglePostNewsForm(true);
            logAdminAudit(`News angepasst (${auditRoleDesc})`, `${sessionUser.vorname} ${sessionUser.nachname}: ${t}`);
            showToast('✅ News-Beitrag erfolgreich aktualisiert.', 'success');
        });
        return;
    }

    {
        const eff = getUserEffectivePermissions(sessionUser);
        if (!eff.canPostNews && !eff.isMasterAdmin) return;
    }

    db.ref('data/news').push({
        title: t, content: c, category: cat, status: 'published',
        author: sessionUser.vorname + ' ' + sessionUser.nachname,
        authorId: myId,
        ts: Date.now()
    }).then(() => {
        clearUnsavedChanges('newsPost');
        togglePostNewsForm(true);
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
        clearUnsavedChanges('newsProposal');
        toggleProposeNewsForm(true);
        showToast('✅ Dein Vorschlag wurde eingereicht und wird von der Leitung geprüft.', 'success');
    });
}

function approveNewsProposal(newsId) {
    if (!sessionUser) return;
    const item = cachedNews[newsId];
    if (!item || item.status !== 'pending_approval') return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.canApproveNews && !eff.isMasterAdmin) {
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
        logAdminAudit('Eigenes Passwort geändert', `${sessionUser.vorname} ${sessionUser.nachname} hat das Login-Passwort aktualisiert.`);
        showToast('✅ Passwort erfolgreich geändert.', 'success');
    } catch (err) {
        console.error('Passwortänderung fehlgeschlagen:', err);
        if (err?.code === 'auth/requires-recent-login') {
            alert('Aus Sicherheitsgründen ist eine erneute Anmeldung erforderlich. Bitte Dienst beenden, erneut anmelden und die Passwortänderung direkt danach wiederholen.');
            return;
        }
        alert('Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.');
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
    await performManagedLogout();
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
        if (canUserAccessInstructorArea()) {
            iv.style.display = 'block';
            const eff = getUserEffectivePermissions(sessionUser);
            const instructorCoreAccess = !!(eff.isInstructor || eff.canManageInstructors || eff.isMasterAdmin);
            if (instructorCoreAccess) {
                renderInstructorUnlocks();
                renderInstructorSubmissions(cachedSubmissions);
            }
            if (eff.canViewExamSolutions || eff.isMasterAdmin) renderInstructorExamSolutions();
            if (eff.canManageExams || eff.isMasterAdmin) renderInstructorExistingExams();
            if (eff.canManageMemberAccess || eff.isMasterAdmin) renderInstructorAllowedExams();
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
    const isLeitung = eff.canManageInstructors || eff.isMasterAdmin;

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
    const isLeitung = eff.canManageInstructors || eff.isMasterAdmin;

    if (!isLeitung && !myPassed[examId]) {
        alert('Keine Berechtigung zur Freischaltung dieser Prüfung!');
        renderInstructorUnlocks();
        return;
    }
    db.ref(`data/users/${uId}/unlockedExams/${examId}`).set(isUnlocked).catch(err => {
        console.error('Prüfungsfreischaltung fehlgeschlagen:', err);
        alert('Die Prüfungsfreischaltung konnte nicht gespeichert werden. Bitte versuche es erneut.');
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
    const isLeitung = eff.canManageInstructors || eff.isMasterAdmin;

    if (!isLeitung && !myPassed[examId]) {
        alert('Keine Berechtigung zur Statusänderung dieser Prüfung!');
        renderInstructorUnlocks();
        return;
    }
    db.ref(`data/users/${uId}/passedExams/${examId}`).set(isPassed).catch(err => {
        console.error('Prüfungsstatus konnte nicht gespeichert werden:', err);
        alert('Der Prüfungsstatus konnte nicht gespeichert werden. Bitte versuche es erneut.');
        renderInstructorUnlocks();
    });
}

function getExamPassPercentage(exam) {
    const configured = Number(exam?.passPercentage || 60);
    return Math.max(60, Math.min(100, Number.isFinite(configured) ? configured : 60));
}

function normalizeExamLookupText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
        .replace(/[^a-z0-9]+/g,' ')
        .replace(/\s+/g,' ')
        .trim();
}

function resolveSubmissionExamId(sub) {
    if (!sub || typeof sub !== 'object') return '';
    if (sub.examId && cachedExams[sub.examId]) return sub.examId;

    const wantedTitle = normalizeExamLookupText(sub.examTitle);
    if (!wantedTitle) return '';

    const matches = Object.entries(cachedExams || {})
        .filter(([, exam]) => normalizeExamLookupText(exam?.title) === wantedTitle)
        .map(([examId]) => examId);

    return matches.length === 1 ? matches[0] : '';
}

function resolveSubmissionUserId(sub) {
    if (!sub || typeof sub !== 'object') return '';
    if (sub.userId && cachedUsers[sub.userId]) return sub.userId;

    const wantedDn = String(sub.userDN || '').trim().toLowerCase();
    if (wantedDn) {
        const dnMatches = Object.entries(cachedUsers || {})
            .filter(([, user]) => String(user?.dn || '').trim().toLowerCase() === wantedDn)
            .map(([userId]) => userId);
        if (dnMatches.length === 1) return dnMatches[0];
    }

    const wantedName = normalizeExamLookupText(sub.userName);
    if (wantedName) {
        const nameMatches = Object.entries(cachedUsers || {})
            .filter(([, user]) => normalizeExamLookupText(`${user?.vorname || ''} ${user?.nachname || ''}`) === wantedName)
            .map(([userId]) => userId);
        if (nameMatches.length === 1) return nameMatches[0];
    }

    return '';
}

function canCurrentUserRepeatExamForSubmission(sub) {
    if (!sessionUser || !sub || sub.passed) return false;
    const examId = resolveSubmissionExamId(sub);
    const targetUserId = resolveSubmissionUserId(sub);
    if (!examId || !targetUserId) return false;

    const eff = getUserEffectivePermissions(sessionUser);
    if (!(eff.isMasterAdmin || eff.canManageInstructors || eff.isInstructor)) return false;
    if (!canInstructorAccessExam(examId)) return false;

    const target = cachedUsers[targetUserId] || {};
    if (target.passedExams?.[examId] === true) return false;
    return true;
}

function repeatFailedExam(subId) {
    if (!sessionUser) return;
    const sub = cachedSubmissions[subId];
    if (!sub || sub.passed) {
        alert('Diese Prüfung kann nicht zur Wiederholung freigegeben werden.');
        return;
    }

    const examId = resolveSubmissionExamId(sub);
    const targetUserId = resolveSubmissionUserId(sub);
    if (!examId) {
        alert('Die zugehörige aktuelle Prüfung konnte nicht eindeutig gefunden werden. Bitte prüfe, ob der Prüfungsname noch mit dem alten Ergebnis übereinstimmt.');
        return;
    }
    if (!targetUserId) {
        alert('Der zugehörige Mitarbeiter konnte nicht eindeutig gefunden werden. Bitte prüfe Name und Dienstnummer des alten Ergebnisses.');
        return;
    }
    if (!canCurrentUserRepeatExamForSubmission(sub)) {
        alert('Keine Berechtigung, diese Prüfung zur Wiederholung freizugeben.');
        return;
    }

    const target = cachedUsers[targetUserId] || {};
    if (target.passedExams?.[examId] === true) {
        alert('Der Mitarbeiter hat diese Prüfung inzwischen bereits bestanden.');
        return;
    }

    const exam = cachedExams[examId] || {};
    if (!confirm(`Soll ${sub.userName || 'der Mitarbeiter'} die Prüfung „${exam.title || sub.examTitle || 'Prüfung'}“ erneut absolvieren dürfen?`)) return;

    db.ref(`data/users/${targetUserId}/unlockedExams/${examId}`).set(true).then(() => {
        if (cachedUsers[targetUserId]) {
            cachedUsers[targetUserId].unlockedExams = cachedUsers[targetUserId].unlockedExams || {};
            cachedUsers[targetUserId].unlockedExams[examId] = true;
        }
        logAdminAudit('Prüfung zur Wiederholung freigegeben', `${sessionUser.vorname} ${sessionUser.nachname} hat ${sub.userName || targetUserId} die Prüfung „${exam.title || sub.examTitle || examId}“ erneut freigeschaltet.`);
        renderInstructorSubmissions(cachedSubmissions);
        closeExamSubmissionDetailsModal();
        alert('✅ Die Prüfung wurde zur Wiederholung freigegeben. Der bisherige Fehlversuch bleibt in der Historie erhalten.');
    }).catch(err => {
        console.error('Wiederholungsfreigabe fehlgeschlagen:', err);
        alert('Die Prüfung konnte nicht zur Wiederholung freigegeben werden.');
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
        ee = ee.filter(([, sub]) => {
            const resolvedExamId = resolveSubmissionExamId(sub);
            return !!resolvedExamId && canInstructorAccessExam(resolvedExamId);
        });
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
                <td><b>${sub.percentage||0}%</b>${Number.isFinite(Number(sub.earnedPoints)) && Number.isFinite(Number(sub.maxPoints)) ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${Number(sub.earnedPoints)} / ${Number(sub.maxPoints)} Punkte</div>` : ''}</td>
                <td><span style="color:${sub.passed?'var(--success)':'var(--danger)'};font-weight:800;">${sub.passed?'✅ Bestanden':'⛔ Nicht bestanden'}</span></td>
                <td>
                    ${isUserInstructor() ? `<div style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:12px;" onclick="openExamSubmissionDetailsModal('${subId}')">👁️ Details</button>${canCurrentUserRepeatExamForSubmission(sub) ? `<button type="button" class="btn exam-repeat-btn" style="width:auto;margin:0;padding:4px 10px;font-size:12px;" onclick="repeatFailedExam('${subId}')">🔄 Wiederholen</button>` : ''}</div>` : '--'}
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
    const resolvedExamId = resolveSubmissionExamId(sub);
    if (!resolvedExamId || !canInstructorAccessExam(resolvedExamId)) {
        alert('Keine Berechtigung zur Einsicht dieser Prüfung oder die zugehörige aktuelle Prüfung konnte nicht eindeutig gefunden werden.');
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

    const infoAnswers = answersList.filter(ans => ans?.isInfo);
    const fachAnswers = answersList.filter(ans => !ans?.isInfo);
    const correctAnswers = fachAnswers.filter(ans => ans?.isCorrect === true);
    const wrongAnswers = fachAnswers.filter(ans => ans?.isCorrect !== true);

    const renderInfoAnswer = (ans, idx) => {
        const qText = ans.questionText || `Angabe ${idx + 1}`;
        const chosen = ans.chosenAnswerText || 'Keine Angabe';
        return `
            <div style="background:rgba(30,41,59,0.5);padding:12px;border-radius:8px;border-left:4px solid var(--primary);">
                <div style="font-weight:800;font-size:12px;color:var(--primary);text-transform:uppercase;">📋 Stammdaten / Prüfungs-Angabe</div>
                <div style="font-weight:700;font-size:14px;color:var(--text-main);margin-top:2px;">${escapeHtml(qText)}</div>
                <div style="font-size:13px;margin-top:4px;color:var(--text-main);background:rgba(8,12,20,0.6);padding:6px 10px;border-radius:6px;">${escapeHtml(chosen)}</div>
            </div>`;
    };

    const renderScoredAnswer = (ans, idx, isCorrectGroup) => {
        const qText = ans.questionText || `Frage ${idx + 1}`;
        const chosen = ans.chosenAnswerText || 'Keine Antwort ausgewählt';
        const correctText = ans.correctAnswerText || '';
        const pointsPossible = Number(ans.pointsPossible);
        const pointsEarned = Number(ans.pointsEarned);
        const hasPoints = Number.isFinite(pointsPossible) && pointsPossible > 0 && Number.isFinite(pointsEarned);
        const pointLabel = hasPoints ? `${pointsEarned} / ${pointsPossible} Punkte` : (isCorrectGroup ? 'Richtig' : 'Falsch');
        return `
            <div style="background:rgba(15,23,42,0.7);padding:12px;border-radius:8px;border-left:4px solid ${isCorrectGroup ? 'var(--success)' : 'var(--danger)'};">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
                    <div style="font-weight:700;font-size:14px;color:var(--text-main);">${escapeHtml(qText)}</div>
                    <div style="font-size:12px;font-weight:800;color:${isCorrectGroup ? 'var(--success)' : 'var(--warning)'};">${escapeHtml(pointLabel)}</div>
                </div>
                <div style="font-size:13px;margin-top:6px;color:${isCorrectGroup ? 'var(--success)' : 'var(--danger)'};font-weight:700;">
                    Ausgewählt: <span style="color:var(--text-main);font-weight:normal;">${escapeHtml(chosen)}</span>
                </div>
                ${!isCorrectGroup && correctText ? `<div style="font-size:13px;margin-top:5px;color:var(--success);font-weight:700;">Richtige Antwort${correctText.includes(',') ? 'en' : ''}: <span style="color:var(--text-main);font-weight:normal;">${escapeHtml(correctText)}</span></div>` : ''}
            </div>`;
    };

    let answersHtml = '';
    if (answersList.length === 0) {
        answersHtml = `<div style="background:rgba(15,23,42,0.6);padding:14px;border-radius:8px;color:var(--text-muted);text-align:center;">ℹ️ Für diesen Eintrag wurden keine detaillierten Antwort-Protokolle hinterlegt.</div>`;
    } else {
        const infoHtml = infoAnswers.length ? `
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">${infoAnswers.map(renderInfoAnswer).join('')}</div>` : '';
        const correctHtml = `
            <h4 style="margin:8px 0;color:var(--success);">✅ Richtig beantwortet (${correctAnswers.length})</h4>
            <div style="display:flex;flex-direction:column;gap:8px;">${correctAnswers.length ? correctAnswers.map((ans, idx) => renderScoredAnswer(ans, idx, true)).join('') : '<div style="color:var(--text-muted);padding:10px 0;">Keine vollständig richtig beantworteten Fragen.</div>'}</div>`;
        const wrongHtml = `
            <h4 style="margin:18px 0 8px;color:var(--danger);">❌ Falsch oder nicht vollständig beantwortet (${wrongAnswers.length})</h4>
            <div style="display:flex;flex-direction:column;gap:8px;">${wrongAnswers.length ? wrongAnswers.map((ans, idx) => renderScoredAnswer(ans, idx, false)).join('') : '<div style="color:var(--text-muted);padding:10px 0;">Keine falsch beantworteten Fragen.</div>'}</div>`;
        answersHtml = infoHtml + correctHtml + wrongHtml;
    }

    const hasPointTotals = Number.isFinite(Number(sub.earnedPoints)) && Number.isFinite(Number(sub.maxPoints));
    const repeatBtn = canCurrentUserRepeatExamForSubmission(sub)
        ? `<button type="button" class="btn exam-repeat-btn" style="margin-top:12px;width:auto;" onclick="repeatFailedExam('${subId}')">🔄 Prüfung zur Wiederholung freigeben</button>`
        : '';

    cont.innerHTML = `
        <div style="background:rgba(30,41,59,0.5);padding:14px;border-radius:10px;margin-bottom:14px;border:1px solid var(--border);">
            <p style="margin:0;"><b>Prüfling:</b> ${escapeHtml(sub.userName || '--')} <span style="color:var(--primary);font-weight:700;">(DN: ${escapeHtml(sub.userDN || '--')})</span></p>
            <p style="margin:6px 0 0 0;">
                <b>Prüfung:</b> ${escapeHtml(sub.examTitle || '--')} • 
                <b>Ergebnis:</b> <b style="color:${sub.passed ? 'var(--success)' : 'var(--danger)'};">${sub.percentage || 0}%</b>
                ${hasPointTotals ? ` · <b>${Number(sub.earnedPoints)} / ${Number(sub.maxPoints)} Punkte</b>` : ''}
                (${sub.passed ? '✅ Bestanden' : '⛔ Nicht bestanden'}) • 
                <b>Dauer:</b> ${escapeHtml(sub.durationFormatted || '--')}
            </p>
            ${repeatBtn}
        </div>
        <h4 style="margin:0 0 10px 0;color:var(--primary);">Antwort-Korrekturbogen:</h4>
        <div>${answersHtml}</div>
    `;

    modal.style.display = 'flex';
}
function closeExamSubmissionDetailsModal() { document.getElementById('examSubmissionDetailsModal').style.display = 'none'; }

function deleteExamSubmission(subId) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delExams) return;
    if (confirm('Ergebnis löschen?')) db.ref('data/examSubmissions/' + subId).remove();
}

function renderInstructorExamSolutions() {
    const container = document.getElementById('instructorExamSolutionsList');
    if (!container) return;
    if (!canCurrentUserViewExamSolutions()) {
        container.innerHTML = '<div class="exam-solution-empty">Keine Berechtigung zum Einsehen von Musterlösungen.</div>';
        return;
    }

    const ids = sortExamIds(Object.keys(cachedExams)).filter(eid => canCurrentUserViewExamSolution(eid));
    const eff = getUserEffectivePermissions(sessionUser);
    const restrictedToPassed = !(eff.isMasterAdmin || eff.canManageInstructors || eff.canManageExams);

    if (!ids.length) {
        container.innerHTML = `<div class="exam-solution-empty">${restrictedToPassed
            ? 'Noch keine Musterlösung verfügbar. Als Ausbilder werden hier nur Prüfungen angezeigt, die du selbst bestanden hast.'
            : 'Keine Prüfungen mit Musterlösung vorhanden.'}</div>`;
        return;
    }

    container.innerHTML = `
        <div class="exam-solution-hint">
            <div>👁️ <b>Musterlösungen</b></div>
            <div>${restrictedToPassed
                ? 'Du siehst ausschließlich Prüfungen, die du selbst erfolgreich bestanden hast. Die laufenden Eingaben eines Prüflings werden hier nicht angezeigt.'
                : 'Diese Ansicht zeigt die hinterlegten Fragen und richtigen Antworten. Laufende Eingaben eines Prüflings werden nicht angezeigt.'}</div>
        </div>
        <div class="exam-solution-grid">
            ${ids.map(eid => {
                const ex = cachedExams[eid];
                if (!ex) return '';
                const qCount = (ex.questions || []).filter(q => !q.isInfo && q.type !== 'text').length;
                return `
                    <article class="exam-solution-card">
                        <div class="exam-solution-card-main">
                            <span class="exam-solution-category">${escapeHtml(ex.kat || 'Allgemein')}</span>
                            <h5>${escapeHtml(ex.title || 'Prüfung')}</h5>
                            <div class="exam-solution-meta">❓ ${qCount} Fachfragen · 🎯 ${getExamPassPercentage(ex)}% Mindestquote · ⏱️ ${Number(ex.timeLimitMinutes || 30)} Min</div>
                        </div>
                        <button type="button" class="btn exam-solution-open" onclick="openExamSolutionModal('${eid}')">👁️ Musterlösung öffnen</button>
                    </article>`;
            }).join('')}
        </div>`;
}

function openExamSolutionModal(examId) {
    if (!canCurrentUserViewExamSolution(examId)) {
        alert('Für diese Musterlösung hast du keine Berechtigung. Ausbilder können nur Musterlösungen von Prüfungen öffnen, die sie selbst bestanden haben.');
        return;
    }
    const ex = cachedExams[examId];
    if (!ex) {
        alert('Die Prüfung wurde nicht gefunden.');
        return;
    }
    const modal = document.getElementById('examSolutionModal');
    const title = document.getElementById('examSolutionModalTitle');
    const content = document.getElementById('examSolutionModalContent');
    if (!modal || !title || !content) return;

    title.textContent = `👁️ Musterlösung – ${ex.title || 'Prüfung'}`;
    let fachIndex = 0;
    const questionsHtml = (ex.questions || []).map((q, idx) => {
        if (q.isInfo || q.type === 'text') {
            return `
                <div class="exam-solution-question exam-solution-info">
                    <div class="exam-solution-question-title">📋 Angabe ${idx + 1}: ${escapeHtml(q.text || '')}</div>
                    <div class="exam-solution-info-text">Dieses Stammdatenfeld wird vom Prüfling ausgefüllt und besitzt keine Musterantwort.</div>
                </div>`;
        }
        fachIndex++;
        const correct = Array.isArray(q.correctAnswers)
            ? q.correctAnswers.map(Number)
            : [Number(q.correctAnswers ?? 0)];
        const options = Array.isArray(q.options) ? q.options : [];
        return `
            <div class="exam-solution-question">
                <div class="exam-solution-question-title">❓ Frage ${fachIndex}: ${escapeHtml(q.text || '')}</div>
                <div class="exam-solution-options">
                    ${options.map((opt, optIdx) => {
                        const isCorrect = correct.includes(optIdx);
                        return `<div class="exam-solution-option ${isCorrect ? 'correct' : ''}">
                            <span class="exam-solution-marker">${isCorrect ? '✅' : '○'}</span>
                            <span>${escapeHtml(opt || '')}</span>
                            ${isCorrect ? '<strong>Richtige Antwort</strong>' : ''}
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
    }).join('');

    content.innerHTML = `
        <div class="exam-solution-summary">
            <div><b>Kategorie:</b> ${escapeHtml(ex.kat || 'Allgemein')}</div>
            <div><b>Zeit:</b> ${Number(ex.timeLimitMinutes || 30)} Minuten</div>
            <div><b>Mindestquote:</b> ${getExamPassPercentage(ex)}%</div>
        </div>
        ${ex.introText ? `<div class="exam-solution-intro"><b>Einleitung:</b><br>${escapeHtml(ex.introText)}</div>` : ''}
        <div class="exam-solution-privacy-note">ℹ️ Diese Musterlösung zeigt nur den hinterlegten Prüfungsinhalt. Antworten oder Eingaben eines aktuell prüfenden Mitarbeiters werden nicht live übertragen.</div>
        <div class="exam-solution-question-list">${questionsHtml || '<div class="exam-solution-empty">Keine Fragen hinterlegt.</div>'}</div>`;
    modal.style.display = 'flex';
}

function closeExamSolutionModal() {
    const modal = document.getElementById('examSolutionModal');
    if (modal) modal.style.display = 'none';
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
                            <div style="font-size:12px;color:var(--text-muted);">⏱️ ${e.timeLimitMinutes||30} Min • ❓ ${qCount} Fachfragen (+3 Stammdaten) • 🎯 ${getExamPassPercentage(e)}%</div>
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
                    <b>Fachfrage ${currentFachNumber}${q.correctAnswers.length > 1 ? ' <span style="font-size:12px;color:var(--primary);">(Mehrfachauswahl aktiv)</span>' : ''}</b>
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
    const passRate = Math.max(60, Math.min(100, parseInt(document.getElementById('newExamPassRate')?.value) || 60));
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
    document.getElementById('newExamPassRate').value = getExamPassPercentage(ex);
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
    if (!eff.canManageMemberAccess && !eff.isMasterAdmin) { mt.innerHTML = ''; return; }
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
                        ? `<button type="button" class="btn" style="width:auto;margin:0;padding:5px 12px;font-size:12px;background:var(--success);color:#080c14;font-weight:800;" onclick="event.stopPropagation(); approveUser('${uId}')">✅ Freischalten</button>`
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
            const isMultipleChoice = Array.isArray(q.correctAnswers) && q.correctAnswers.length > 1;
            return `
                <div class="exam-q-box">
                    <p style="font-weight:800;margin:0 0 8px 0;">❓ Frage ${fachIndex}: ${escapeHtml(q.text)}</p>
                    ${(q.options || []).map((opt, oIdx) => `
                        <label class="exam-opt-label">
                            <input type="checkbox" name="q_${idx}" value="${oIdx}" ${!isMultipleChoice ? `onchange="if(this.checked){document.querySelectorAll('input[name=\\'q_${idx}\\']').forEach(el=>{if(el!==this)el.checked=false;});}"` : ''}>
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
    let maxPoints = 0, earnedPoints = 0;
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
        const chosenArr = [];
        checkboxes.forEach(cb => chosenArr.push(parseInt(cb.value)));

        const correctArr = Array.from(new Set((q.correctAnswers || [0]).map(Number).filter(Number.isInteger)));
        const possible = Math.max(1, correctArr.length);
        const selectedCorrect = chosenArr.filter(val => correctArr.includes(val));
        const selectedWrong = chosenArr.filter(val => !correctArr.includes(val));
        const points = Math.max(0, Math.min(possible, selectedCorrect.length - selectedWrong.length));
        const fullyCorrect = points === possible && selectedWrong.length === 0 && selectedCorrect.length === correctArr.length;

        maxPoints += possible;
        earnedPoints += points;

        const chosenTexts = chosenArr.length > 0 ? chosenArr.map(oIdx => q.options?.[oIdx] || 'Unbekannt').join(', ') : 'Keine Antwort';
        const correctTexts = correctArr.map(oIdx => q.options?.[oIdx] || 'Unbekannt').join(', ');

        recordedAnswers.push({
            questionText: q.text,
            chosenAnswerText: chosenTexts,
            correctAnswerText: correctTexts,
            isCorrect: fullyCorrect,
            isInfo: false,
            pointsEarned: points,
            pointsPossible: possible,
            selectedCorrectCount: selectedCorrect.length,
            selectedWrongCount: selectedWrong.length
        });
    });

    const pct = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;
    const passPercentage = getExamPassPercentage(ex);
    const passed = pct >= passPercentage;
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
        earnedPoints: earnedPoints,
        maxPoints: maxPoints,
        passPercentage: passPercentage,
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
            alert(`🎉 Herzlichen Glückwunsch! Du hast die Prüfung mit ${earnedPoints}/${maxPoints} Punkten (${pct}%) bestanden!`);
        } else {
            alert(`❌ Leider nicht bestanden (${earnedPoints}/${maxPoints} Punkte = ${pct}%). Die Prüfung wurde gesperrt und kann von einem berechtigten Ausbilder oder der Ausbildungsleitung zur Wiederholung freigegeben werden.`);
        }
        cancelActiveExam();
    }).catch(err => {
        console.error('Prüfungsergebnis konnte nicht vollständig gespeichert werden:', err);
        alert('Das Prüfungsergebnis konnte nicht gespeichert werden. Bitte die Ausbildungsleitung informieren.');
    });
}

/* ══════════════════════════════════════════════════════════════
   ADMIN-BEREICH: ROLLENVERGABE & DAUERHAFTER ENTZUG
══════════════════════════════════════════════════════════════ */
function openAdminKeyModal() {
    if (isMaintenanceRestrictedSession()) { alert('🛠️ Dieser Bereich ist während der Wartungsarbeiten vorübergehend nicht verfügbar.'); return; }
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    if (!eff.isAdmin && !eff.isMasterAdmin && !eff.canManageMaintenance) return;
    const pi = document.getElementById('adminAuthPassInput'); if (pi) pi.value = '';
    const m = document.getElementById('adminAuthModal');
    if (m) { m.style.display = 'flex'; if (pi) pi.focus(); }
}
function closeAdminAuthModal() { document.getElementById('adminAuthModal').style.display = 'none'; }

async function verifyAdminKeyPassword() {
    const p = (document.getElementById('adminAuthPassInput')?.value || '').trim();
    if (!sessionUser || !auth.currentUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.isAdmin && !eff.isMasterAdmin && !eff.canManageMaintenance) return;
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, p);
        await auth.currentUser.reauthenticateWithCredential(credential);
        closeAdminAuthModal();
        document.getElementById('adminManagementModal').style.display = 'flex';
        const onlyMaintenanceAccess = !eff.isAdmin && !eff.isMasterAdmin && eff.canManageMaintenance;
        ['btnAdminSubOverview','btnAdminSubUsers','btnAdminSubRoles','btnAdminSubAudit','btnAdminSubSessions','btnAdminSubSystem'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = onlyMaintenanceAccess ? 'none' : '';
        });
        if (onlyMaintenanceAccess) {
            const maintenanceBtn = document.getElementById('btnAdminSubMaintenance');
            switchAdminTab('adminSubTabMaintenance', maintenanceBtn);
            renderMaintenanceAdminPanel();
            return;
        }
        try {
            await refreshUsersFromFirebase();
        } catch (_) {
            alert('Die Mitarbeiterliste konnte gerade nicht aktualisiert werden. Es wird der zuletzt geladene Stand angezeigt.');
        }
        switchAdminTab('adminSubTabOverview', document.getElementById('btnAdminSubOverview'));
        renderAdminUserTable(cachedUsers);
        renderAdminRolesList();
        refreshFirebaseAuthMigrationPanel();
        renderPasswordChangeStatusPanel();
        renderMaintenanceAdminPanel();
        renderActiveSessionAdminPanel();
        updateClientReleaseAdminPanel();
        renderAdminOverview();
    } catch (err) {
        console.error('Admin-Verifizierung fehlgeschlagen:', err);
        if (['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(err?.code)) {
            alert('Falsches Admin-Passwort!');
            return;
        }
        alert('Die Admin-Verifizierung konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
    }
}

function closeAdminManagementModal(force = false) {
    if (!force && !confirmDiscardUnsavedChanges('role')) return;
    document.getElementById('adminManagementModal').style.display = 'none';
}

function switchAdminTab(tabId, btnEl) {
    const eff = getUserEffectivePermissions(sessionUser || {});
    const activeTab = document.querySelector('#adminManagementModal .admin-subtab-content.active')?.id || '';
    if (activeTab === 'adminSubTabRoles' && tabId !== 'adminSubTabRoles' && !confirmDiscardUnsavedChanges('role')) return;
    if (tabId === 'adminSubTabMaintenance' && !canCurrentUserManageMaintenance()) {
        alert('Du hast dafür keine Berechtigung.');
        return;
    }
    if (tabId === 'adminSubTabSessions' && !eff.isMasterAdmin) {
        alert('Dieser Bereich ist ausschließlich für Master Admins verfügbar.');
        return;
    }
    if (tabId === 'adminSubTabSystem' && !eff.isMasterAdmin) {
        alert('Backup, Wiederherstellung und Fachdaten-Reset sind ausschließlich für Master Admins verfügbar.');
        return;
    }
    document.querySelectorAll('#adminManagementModal .admin-subtab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('#adminManagementModal .admin-tab-btn').forEach(e => e.classList.remove('active'));
    const t = document.getElementById(tabId); if (t) t.classList.add('active');
    if (btnEl) btnEl.classList.add('active');
    if (tabId === 'adminSubTabOverview') renderAdminOverview();
    if (tabId === 'adminSubTabMaintenance') renderMaintenanceAdminPanel();
    if (tabId === 'adminSubTabSessions') {
        renderActiveSessionAdminPanel();
        updateClientReleaseAdminPanel();
    }
}

function getUserStatusDisplay(status) {
    if (status === 'approved') return { text: '✅ Aktiv', color: 'var(--success)' };
    if (status === 'revoked') return { text: '⛔ Gesperrt', color: 'var(--danger)' };
    return { text: '⏳ Wartet auf Freischaltung', color: 'var(--warning)' };
}

function renderAdminUserTable(obj) {
    const tbody = document.getElementById('adminUserTableBody'); if (!tbody) return;
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const canManageMemberAccess = !!(eff.isMasterAdmin || eff.canManageMemberAccess);
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
                    ${canManageMemberAccess ? (u.status !== 'approved'
                        ? `<button type="button" class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:12px;background:var(--success);color:#080c14;font-weight:800;" onclick="event.stopPropagation(); approveUser('${uId}')">✅ Freischalten</button>`
                        : `<button type="button" class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:12px;background:rgba(244,63,94,0.15);color:var(--danger);border:1px solid var(--danger);" onclick="revokeUser('${uId}')">⛔ Sperren</button>`
                    ) : ''}
                    ${canManageMemberAccess ? `<button type="button" class="btn" style="width:auto;margin:0;padding:4px 10px;font-size:12px;" onclick="openAssignRolesModal('${uId}', null, false)">🎭 Rollen</button>` : ''}
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
    if (!requireMasterAdminAccess('Nur der Master Admin darf das Login-Passwort anderer Mitarbeiter zurücksetzen.')) return false;
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
    if (!ctx) throw new Error('Es konnte kein neuer Zugang angelegt werden.');

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
        logAdminAudit('Login-Zugang zurückgesetzt', `Login-Zugang für ${uId} wurde durch ${sessionUser.vorname} ${sessionUser.nachname} neu gesetzt.`);
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
            statusEl.innerHTML = `<b>${entries.length - pending.length}</b> von <b>${entries.length}</b> Konten sind vollständig auf die sichere Anmeldung umgestellt. ${pending.length ? `<span style="color:var(--warning);">${pending.length} Konto/Konten benötigen noch die Umstellung.</span>` : 'Die Konten sind umgestellt; der Abschlussstatus kann jetzt gesetzt werden.'}`;
        }
        if (runBtn) runBtn.disabled = false;
    } catch (err) {
        panel.style.display = 'block';
        console.error('Status der Sicherheitsumstellung konnte nicht gelesen werden:', err);
        if (statusEl) statusEl.textContent = 'Der Status konnte gerade nicht geladen werden. Bitte versuche es später erneut.';
    }
}

async function runFirebaseAuthMigration() {
    if (!requireMasterAdminAccess('Nur der Master Admin darf diese Sicherheitsumstellung ausführen.')) return;
    if (!auth.currentUser) {
        alert('Deine Anmeldung ist nicht mehr aktiv. Bitte melde dich erneut an.');
        return;
    }

    const ok = confirm(
        'Sicherheitsumstellung jetzt starten?\n\n' +
        'Alle noch nicht umgestellten Mitarbeiterkonten werden jetzt für die sichere Anmeldung vorbereitet.\n' +
        'Die Mitarbeiter behalten für den ersten Login ihr bisheriges Passwort und müssen anschließend direkt ein neues persönliches Passwort festlegen.\n\n' +
        'Es werden keine Übergangspasswörter an Mitarbeiter ausgegeben.\n\n' +
        'Vorher sollte eine aktuelle Sicherung vorhanden sein.'
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
        cachedRoles = normalizeSystemRoleDisplayData(rolesSnap.val() ? Object.assign({}, defaultRoles, rolesSnap.val()) : Object.assign({}, defaultRoles));
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
            if (statusEl) statusEl.innerHTML = `✅ Umstellung abgeschlossen: ${cleaned} Konten geprüft, ${migrated} Zugänge neu eingerichtet. ${transitionAccounts} Konto/Konten ändern ihr Passwort selbst beim nächsten Login.`;
            alert('✅ Die Sicherheitsumstellung wurde erfolgreich abgeschlossen.');
        } else {
            await db.ref('data/system/authMigrationComplete').set(false);
            if (statusEl) statusEl.innerHTML = `⚠️ Umstellung nicht vollständig. ${failures.length} Konto/Konten benötigen eine Prüfung.`;
            console.error('Einige Konten konnten bei der Sicherheitsumstellung nicht verarbeitet werden:', failures);
            alert('⚠️ Die Umstellung konnte nicht für alle Konten abgeschlossen werden. Bitte prüfe die offenen Konten und versuche es anschließend erneut.');
        }
    } catch (err) {
        console.error('Firebase-Auth-Migration fehlgeschlagen:', err);
        alert('Die Umstellung konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
    } finally {
        if (btn) btn.disabled = false;
        refreshFirebaseAuthMigrationPanel();
    }
}

async function approveUser(uId) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.canManageMemberAccess && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zum Freischalten von Mitarbeitern!');
        return;
    }
    if (!requireTargetUserManagement(uId)) return;
    try {
        await db.ref('data/users/'+uId+'/status').set('approved');
        await refreshUsersFromFirebase();
        logAdminAudit('Mitarbeiter freigeschaltet', `Account ${uId} aktiviert von ${sessionUser.vorname} ${sessionUser.nachname}`);
        showToast('✅ Mitarbeiter wurde erfolgreich freigeschaltet.', 'success');
    } catch (err) {
        console.error('Freischaltung fehlgeschlagen:', err);
        alert('Die Freischaltung konnte nicht gespeichert werden. Bitte versuche es erneut.');
    }
}
async function revokeUser(uId) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    if (!eff.canManageMemberAccess && !eff.isMasterAdmin) {
        alert('Keine Berechtigung zum Sperren von Mitarbeitern!');
        return;
    }
    if (!requireTargetUserManagement(uId)) return;
    if (!confirm('Mitarbeiter wirklich sperren? Der Account bleibt bestehen, kann sich aber nicht mehr einloggen.')) return;
    try {
        await db.ref('data/users/'+uId+'/status').set('revoked');
        await refreshUsersFromFirebase();
        logAdminAudit('Mitarbeiter gesperrt', `Account ${uId} gesperrt von ${sessionUser.vorname} ${sessionUser.nachname}`);
        showToast('✅ Mitarbeiter wurde gesperrt.', 'success');
    } catch (err) {
        console.error('Sperren fehlgeschlagen:', err);
        alert('Die Sperrung konnte nicht gespeichert werden. Bitte versuche es erneut.');
    }
}
function deleteUserAccount(uId) {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).delUsers) return;
    if (!requireTargetUserManagement(uId)) return;
    const target = cachedUsers[uId] || {};
    if (confirm('ACHTUNG: Mitarbeiter endgültig löschen? Dadurch wird er sofort aus der Mitarbeiterkartei entfernt und kann sich mit diesem Zugang nicht mehr anmelden.')) {
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
            logAdminAudit('Mitarbeiter gelöscht', `Account ${uId} wurde von ${sessionUser.vorname} ${sessionUser.nachname} aus der Mitarbeiterverwaltung entfernt.`);
        }).catch(err => {
            alert('Der Mitarbeiter konnte nicht gelöscht werden. Bitte versuche es erneut.');
        });
    }
}

function openUserPermissionsModal(uId) {
    if (!requireAdminAccess()) return;
    clearUnsavedChanges('user');
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
    const statusEl = document.getElementById('permStatus');
    if (statusEl) {
        statusEl.value = u.status || 'approved';
        const eff = getUserEffectivePermissions(sessionUser);
        statusEl.disabled = !(eff.isMasterAdmin || eff.canManageMemberAccess);
        statusEl.title = statusEl.disabled ? 'Für Statusänderungen fehlt die Berechtigung „Mitarbeiter freigeben & Rollen verteilen“.' : '';
    }
    document.getElementById('userPermissionsModal').style.display = 'flex';
}
function closeUserPermissionsModal(force = false) {
    if (!force && !confirmDiscardUnsavedChanges('user')) return;
    clearUnsavedChanges('user');
    document.getElementById('userPermissionsModal').style.display = 'none';
}

async function resetSelectedUserPassword() {
    if (!requireMasterAdminAccess('Nur der Master Admin darf Passwörter anderer Mitarbeiter zurücksetzen.')) return;

    const uId = document.getElementById('permUserId')?.value;
    if (!uId) {
        alert('Der Mitarbeiter konnte nicht gefunden werden.');
        return;
    }
    if (!requireTargetUserManagement(uId)) return;

    const input = document.getElementById('permPassword');
    const newPassword = input?.value || '';
    if (newPassword.length < 6) {
        alert('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
        input?.focus();
        return;
    }

    const target = cachedUsers[uId] || {};
    const displayName = `${target.vorname || ''} ${target.nachname || ''}`.trim() || 'diesen Mitarbeiter';
    if (!confirm(`Passwort für ${displayName} wirklich zurücksetzen?\n\nDas bisherige Passwort kann danach nicht mehr verwendet werden.`)) return;

    try {
        const ok = await resetFirebaseAuthForUser(uId, newPassword);
        if (!ok) return;
        if (input) input.value = '';
        showToast('✅ Neues Passwort gesetzt. Der Mitarbeiter muss es beim nächsten Login ändern.', 'success', 4200);
    } catch (err) {
        console.error('Passwort-Zurücksetzung fehlgeschlagen:', err);
        alert('Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.');
    }
}

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

    const original = cachedUsers[uId] || {};
    const vorname = document.getElementById('permVorname')?.value.trim() || '';
    const nachname = document.getElementById('permNachname')?.value.trim() || '';
    const dn = document.getElementById('permDN')?.value.trim() || '';
    const editorEff = getUserEffectivePermissions(sessionUser);
    const mayChangeStatus = !!(editorEff.isMasterAdmin || editorEff.canManageMemberAccess);
    const status = mayChangeStatus ? (document.getElementById('permStatus')?.value || 'approved') : (original.status || 'approved');

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
        clearUnsavedChanges('user');
        closeUserPermissionsModal(true);

        const changes = [];
        if ((original.vorname || '') !== vorname) changes.push(`Vorname: ${original.vorname || '--'} → ${vorname}`);
        if ((original.nachname || '') !== nachname) changes.push(`Nachname: ${original.nachname || '--'} → ${nachname}`);
        if ((original.dn || '') !== dn) changes.push(`Dienstnummer: ${original.dn || '--'} → ${dn}`);
        if ((original.status || 'approved') !== status) changes.push(`Status: ${original.status || 'approved'} → ${status}`);
        logAdminAudit('Mitarbeiterdaten bearbeitet', `${vorname} ${nachname} (${uId}) angepasst von ${sessionUser.vorname} ${sessionUser.nachname}${changes.length ? ': ' + changes.join(' | ') : ''}`);
        showToast('✅ Mitarbeiterdaten wurden erfolgreich gespeichert.', 'success');
    } catch (err) {
        alert('Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.');
    }
}


const LIMITED_MEMBER_ROLE_ASSIGNMENT_IDS = new Set(['ausbildungsleitung', 'ausbilder', 'mitarbeiter']);

function getAssignableRoleIdsForOperator(user = sessionUser) {
    if (!user) return new Set();
    const eff = getUserEffectivePermissions(user);
    if (eff.isMasterAdmin) return new Set(Object.keys(cachedRoles));
    if (!eff.canManageMemberAccess) return new Set();

    const operatorRoleIds = getUserRolesList(user);
    if (operatorRoleIds.includes('chiefebene')) {
        // Chief Ebene darf mit dem Mitgliedsrecht alle nicht geschützten Rollen unterhalb von Chief verteilen.
        return new Set(Object.entries(cachedRoles)
            .filter(([roleId, role]) => roleId !== 'masteradmin' && roleId !== 'chiefebene' && roleId !== 'admin' && !role?.isMasterAdmin && !role?.isAdmin)
            .map(([roleId]) => roleId));
    }

    // Ausbildungsleitung, Personalabteilung und andere Rollen mit diesem Recht: bewusst nur diese drei Rollen.
    return new Set([...LIMITED_MEMBER_ROLE_ASSIGNMENT_IDS].filter(roleId => !!cachedRoles[roleId]));
}

function openAssignRolesModal(uId, name, isRestrictedByLeitung = false) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    const target = cachedUsers[uId];
    if (target && isPrivilegedUser(target) && !eff.isMasterAdmin) {
        alert('Geschützte Admin Konten dürfen nur von einem Master Admin verändert werden!');
        return;
    }
    const assignableIds = getAssignableRoleIdsForOperator(sessionUser);
    if (!eff.isMasterAdmin && assignableIds.size === 0) {
        alert('Keine Berechtigung zur Rollenvergabe!');
        return;
    }

    const m = document.getElementById('assignRolesModal'); if (!m) return;
    document.getElementById('assignRoleUserId').value = uId;
    const u = cachedUsers[uId] || {};
    const displayName = name || `${u.vorname || ''} ${u.nachname || ''}`.trim() || uId;
    document.getElementById('assignRoleUserName').textContent = displayName;
    const rids = getUserRolesList(u);

    const rolesToShow = Object.values(cachedRoles).filter(r => assignableIds.has(r.id));
    const sortedRolesToShow = sortRolesForDisplay(rolesToShow);

    const myId = getUserAccountId(sessionUser);
    const isSelfMasterAdmin = (uId === myId) && (rids.includes('masteradmin') || sessionUser.isMasterAdmin);

    document.getElementById('assignRolesContainer').innerHTML = sortedRolesToShow.map(r => {
        const isSelfMasterProtection = isSelfMasterAdmin && (r.id === 'masteradmin');
        const isChecked = rids.includes(r.id);
        return `
            <label for="assignRoleInput_${r.id}" class="assign-role-option">
                <input type="checkbox" ${isChecked ? 'checked' : ''} ${isSelfMasterProtection ? 'disabled checked title="Selbstausschluss Schutz: Du kannst dir als Master Admin deine eigene Rolle nicht entziehen."' : ''} id="assignRoleInput_${r.id}">
                <b style="color:${sanitizeRoleColor(r.color)};">${r.icon ? escapeHtml(r.icon) : ''} ${escapeHtml(r.name)}</b>
                ${isSelfMasterProtection ? '<span class="assign-role-protected">🔒 Geschützt</span>' : ''}
            </label>
        `;
    }).join('');

    m.style.display = 'flex';
}
function closeAssignRolesModal() { document.getElementById('assignRolesModal').style.display = 'none'; }

function saveAssignedRoles() {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    const assignableIds = getAssignableRoleIdsForOperator(sessionUser);
    if (!eff.isMasterAdmin && assignableIds.size === 0) {
        alert('Keine Berechtigung zur Rollenvergabe!');
        return;
    }

    const uId = document.getElementById('assignRoleUserId')?.value; if (!uId) return;
    const target = cachedUsers[uId];
    if (target && isPrivilegedUser(target) && !eff.isMasterAdmin) {
        alert('Geschützte Admin Konten dürfen nur von einem Master Admin verändert werden!');
        return;
    }

    let cleanRoles = {};
    const existingUser = cachedUsers[uId] || {};
    const existingRoleList = getUserRolesList(existingUser);

    Object.keys(cachedRoles).forEach(rId => {
        if (!assignableIds.has(rId)) {
            if (existingRoleList.includes(rId)) cleanRoles[rId] = true;
            return;
        }
        const el = document.getElementById('assignRoleInput_' + rId);
        if (el?.checked) cleanRoles[rId] = true;
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
        logAdminAudit('Rollen angepasst', `Rollen für ${uId} von ${sessionUser.vorname} ${sessionUser.nachname} gespeichert.`);
        alert('✅ Rollen erfolgreich aktualisiert!');
    }).catch(err => {
        console.error('Rollen konnten nicht gespeichert werden:', err);
        alert('Die Rollen konnten nicht gespeichert werden. Bitte versuche es erneut.');
    });
}

function renderAdminRolesList() {
    const sb = document.getElementById('adminRolesSidebarList'); if (!sb) return;
    if (!sessionUser || !requireAdminAccess()) { sb.innerHTML = ''; return; }
    const sortedRoles = sortRolesForDisplay(Object.values(cachedRoles));
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
    if (!confirmDiscardUnsavedChanges('role')) return;
    clearUnsavedChanges('role');
    const r = cachedRoles[roleId] || defaultRoles[roleId]; 
    if (!r) return;
    const operatorEff = getUserEffectivePermissions(sessionUser);
    if ((r.isAdmin || r.isMasterAdmin || roleId === 'admin' || roleId === 'masteradmin') && !operatorEff.isMasterAdmin) {
        alert('Rollen mit Admin- oder Master Admin-Rechten dürfen nur von einem Master Admin verändert werden!');
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

    Object.keys(ROLE_PROPERTY_MAP).forEach(elementId => {
        const propName = ROLE_PROPERTY_MAP[elementId];
        const chk = document.getElementById(elementId);
        if (!chk) return;
        chk.checked = isMaster ? true : !!r[propName];
        // Master Admin und das endgültige Löschen von Accounts sind feste Master-Funktionen.
        // Für alle übrigen konfigurierbaren Rechte gilt exakt: Häkchen an = Recht vorhanden.
        if (isMaster) chk.disabled = true;
        else if (elementId === 'roleFlagMasterAdmin' || elementId === 'delFlagUsers') {
            chk.checked = false;
            chk.disabled = true;
        } else if (elementId === 'roleFlagAdmin') chk.disabled = !operatorEff.isMasterAdmin;
        else chk.disabled = false;
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
    if (!confirmDiscardUnsavedChanges('role')) return;
    clearUnsavedChanges('role');
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
    
    const operatorEff = getUserEffectivePermissions(sessionUser);
    document.querySelectorAll('#adminRoleEditorCard input[type="checkbox"]').forEach(c => {
        c.checked = false;
        c.disabled = false;
    });
    const privilegeAdminEl = document.getElementById('roleFlagAdmin');
    const privilegeMasterEl = document.getElementById('roleFlagMasterAdmin');
    const deleteUsersEl = document.getElementById('delFlagUsers');
    if (privilegeAdminEl) privilegeAdminEl.disabled = !operatorEff.isMasterAdmin;
    if (privilegeMasterEl) { privilegeMasterEl.checked = false; privilegeMasterEl.disabled = true; }
    if (deleteUsersEl) { deleteUsersEl.checked = false; deleteUsersEl.disabled = true; }

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

async function speichereRolle() {
    if (!requireAdminAccess()) return;
    const saveBtn = document.getElementById('btnSaveRole');
    const originalLabel = saveBtn?.textContent || '💾 Rolle speichern';

    const id = document.getElementById('editingRoleId')?.value;
    if (!id) {
        alert('Bitte wähle zuerst eine Rolle aus oder erstelle eine neue Rolle!');
        return;
    }

    const operatorEff = getUserEffectivePermissions(sessionUser);
    const existingRole = cachedRoles[id] || defaultRoles[id];
    if ((id === 'masteradmin' || id === 'admin' || existingRole?.isAdmin || existingRole?.isMasterAdmin) && !operatorEff.isMasterAdmin) {
        alert('Rollen mit Admin- oder Master Admin-Rechten dürfen nur von einem Master Admin verändert werden!');
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
        if (propName === 'isMasterAdmin' || propName === 'delUsers') r[propName] = isMaster;
        else r[propName] = isMaster ? true : !!(el && el.checked);
    });

    if (!operatorEff.isMasterAdmin) {
        r.isAdmin = false;
        r.isMasterAdmin = false;
        r.delUsers = false;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ Speichert …';
        saveBtn.setAttribute('aria-busy', 'true');
    }

    try {
        await db.ref('data/roles/' + id).set(r);
        cachedRoles[id] = r;
        clearUnsavedChanges('role');
        renderAdminRolesList();
        logAdminAudit('Rolle gespeichert', `${sessionUser.vorname} ${sessionUser.nachname} hat Rolle "${r.name}" gespeichert.`);
        showToast(`✅ Rolle "${r.name}" erfolgreich gespeichert.`, 'success');

        try {
            await syncServerPermissionsForAllUsers();
        } catch (syncErr) {
            console.error('Rolle gespeichert, aber Benutzerrechte konnten nicht vollständig synchronisiert werden:', syncErr);
            showToast('⚠️ Rolle gespeichert. Die Rechte-Synchronisierung konnte nicht vollständig abgeschlossen werden.', 'warning', 6000);
        }
    } catch (err) {
        console.error('Rolle konnte nicht gespeichert werden:', err);
        alert('Die Rolle konnte nicht gespeichert werden. Bitte prüfe die Firebase Rules und versuche es erneut.');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = originalLabel;
            saveBtn.removeAttribute('aria-busy');
        }
    }
}

async function loescheRolle() {
    if (!requireAdminAccess()) return;
    const id = document.getElementById('editingRoleId')?.value;
    if (!id) { alert('Keine Rolle ausgewählt!'); return; }

    const role = cachedRoles[id] || defaultRoles[id];
    const operatorEff = getUserEffectivePermissions(sessionUser);
    if ((role?.isAdmin || role?.isMasterAdmin || id === 'admin' || id === 'masteradmin') && !operatorEff.isMasterAdmin) {
        alert('Rollen mit Admin- oder Master Admin-Rechten dürfen nur von einem Master Admin gelöscht werden!');
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
        clearUnsavedChanges('role');
        neueRolleErstellen();
        logAdminAudit('Rolle gelöscht', `${sessionUser.vorname} ${sessionUser.nachname} hat die Rolle "${role?.name || id}" gelöscht.`);
        showToast('✅ Rolle erfolgreich gelöscht.', 'success');
    } catch (err) {
        alert('Die Rolle konnte nicht gelöscht werden. Bitte versuche es erneut.');
    }
}

function stripCredentialsFromBackupUser(user) {
    if (!user || typeof user !== 'object') return user;
    const clean = Object.assign({}, user);
    ['pass','passwordHash','passwordSalt','passwordAlgo','passwordIterations','passwordVersion','passwordUpdatedAt'].forEach(k => delete clean[k]);
    return clean;
}

function downloadSystemBackup() {
    if (!requireMasterAdminAccess('Backups dürfen nur von Master Admins heruntergeladen werden!')) return;
    db.ref('data').once('value', s => {
        const data = s.val() || {};
        if (data.users) {
            data.users = Object.fromEntries(Object.entries(data.users).map(([uId, user]) => [uId, stripCredentialsFromBackupUser(user)]));
        }
        const backup = {
            meta: {
                app: 'MMD Cloud',
                version: APP_VERSION,
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
        showToast('✅ Backup wurde heruntergeladen.', 'success');
    });
}

function countBackupEntries(value) {
    if (!value) return 0;
    if (Array.isArray(value)) return value.filter(Boolean).length;
    if (typeof value === 'object') return Object.keys(value).length;
    return 0;
}

function closeBackupPreviewModal() {
    pendingBackupRestore = null;
    const modal = document.getElementById('backupPreviewModal');
    if (modal) modal.style.display = 'none';
}

function openBackupPreviewModal(parsed, restoreDataRaw, fileName) {
    pendingBackupRestore = {
        parsed,
        restoreDataRaw: JSON.parse(JSON.stringify(restoreDataRaw)),
        fileName: String(fileName || 'Backup.json')
    };

    const meta = parsed?.meta || {};
    const metaEl = document.getElementById('backupPreviewMeta');
    const countsEl = document.getElementById('backupPreviewCounts');
    const modal = document.getElementById('backupPreviewModal');
    if (!modal || !countsEl) return;

    let createdLabel = 'Unbekannt';
    if (meta.createdAt) {
        const created = new Date(Number(meta.createdAt) || meta.createdAt);
        if (!Number.isNaN(created.getTime())) createdLabel = created.toLocaleString('de-DE');
    }
    if (metaEl) {
        metaEl.innerHTML = `
            <div><span>Datei</span><b>${escapeHtml(pendingBackupRestore.fileName)}</b></div>
            <div><span>Erstellt</span><b>${escapeHtml(createdLabel)}</b></div>
            <div><span>Version</span><b>${escapeHtml(meta.version || 'nicht angegeben')}</b></div>
        `;
    }

    const sections = [
        ['👥 Mitarbeiter', 'users'],
        ['📝 Patientenprotokoll', 'protokoll'],
        ['🗄️ Archiv', 'archiv'],
        ['📅 Termine', 'calendar'],
        ['🎓 Prüfungen', 'exams'],
        ['✅ Prüfungsergebnisse', 'examSubmissions'],
        ['📰 News', 'news'],
        ['💡 Wünsche & Bugs', 'feedback'],
        ['📨 Mitarbeiterhinweise', 'employeeNotices']
    ];
    countsEl.innerHTML = sections.map(([label, key]) => `
        <div class="backup-preview-count">
            <span>${label}</span>
            <b>${countBackupEntries(restoreDataRaw[key])}</b>
        </div>
    `).join('');

    modal.style.display = 'flex';
}

function restoreSystemBackupFromFile(event) {
    if (!requireMasterAdminAccess('Backups dürfen nur von Master Admins eingespielt werden!')) {
        if (event?.target) event.target.value = '';
        return;
    }
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = e => {
        try {
            const parsed = JSON.parse(e.target.result);
            const restoreDataRaw = parsed.data ? parsed.data : parsed;
            if (!restoreDataRaw || typeof restoreDataRaw !== 'object' || Array.isArray(restoreDataRaw)) {
                throw new Error('Ungültiges Backup-Format.');
            }
            openBackupPreviewModal(parsed, restoreDataRaw, file.name);
        } catch (err) {
            console.error('Backup konnte nicht gelesen werden:', err);
            alert('Das Backup konnte nicht gelesen werden oder besitzt ein ungültiges Format.');
        } finally {
            if (event?.target) event.target.value = '';
        }
    };
    reader.readAsText(file);
}

async function confirmBackupRestore() {
    if (!requireMasterAdminAccess('Backups dürfen nur von Master Admins eingespielt werden!')) return;
    if (!pendingBackupRestore?.restoreDataRaw) return;

    const restoreDataRaw = JSON.parse(JSON.stringify(pendingBackupRestore.restoreDataRaw));
    try {
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
        cachedRoles = normalizeSystemRoleDisplayData(Object.assign({}, defaultRoles, restoreData.roles || {}));
        Object.entries(mergedUsers).forEach(([uId, user]) => {
            user.serverPermissions = buildServerPermissions(user);
        });
        cachedRoles = previousRoles;

        restoreData.users = mergedUsers;
        await db.ref('data').set(restoreData);
        pendingBackupRestore = null;
        const modal = document.getElementById('backupPreviewModal');
        if (modal) modal.style.display = 'none';
        showToast('✅ Backup wurde erfolgreich wiederhergestellt. Die MMD Cloud wird neu geladen.', 'success', 1400);
        window.setTimeout(() => location.reload(), 1000);
    } catch(err) {
        console.error('Backup-Wiederherstellung fehlgeschlagen:', err);
        alert('Die Wiederherstellung konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
    }
}

async function vollstaendigerReset() {
    if (!sessionUser || !getUserEffectivePermissions(sessionUser).isMasterAdmin) return;
    if (!confirm('ACHTUNG: Wirklich alle Fachdaten zurücksetzen?\n\nMitarbeiterkonten, Rollen, Anmeldungen, Chief-Materialliste und Sanktionskatalog bleiben erhalten.')) return;
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
            chiefMaterials: current.chiefMaterials || {},
            sanctionsCatalog: current.sanctionsCatalog || {},
            system: {
                authMigrationComplete: system.authMigrationComplete === true,
                authMigrationCompletedAt: system.authMigrationCompletedAt || null,
                authMigrationCompletedBy: system.authMigrationCompletedBy || null
            }
        };
        await db.ref('data').set(preserved);
        alert('✅ Die Fachdaten wurden zurückgesetzt. Mitarbeiterkonten und Anmeldungen bleiben erhalten.');
        location.reload();
    } catch (err) {
        alert('Das Zurücksetzen konnte nicht abgeschlossen werden. Bitte versuche es erneut.');
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
        alert('Die Meldung konnte nicht übermittelt werden. Bitte versuche es erneut.');
    });
}

function renderFeedbackRowsHtml(list, targetPrefix) {
    const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
    const canDelete = eff.isMasterAdmin || eff.delFeedback || (sessionUser && sessionUser.isMasterAdmin);

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
    if (!eff.isMasterAdmin && !eff.canManageFeedback) {
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
    if (!eff.isMasterAdmin && !eff.canManageFeedback) return;

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
        alert('Der Status konnte nicht gespeichert werden. Bitte versuche es erneut.');
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
    if (!eff.isMasterAdmin && !eff.canManageFeedback) {
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
        alert('Die Ablehnung konnte nicht gespeichert werden. Bitte versuche es erneut.');
    });
}

function deleteFeedbackEntry(fbId) {
    if (!sessionUser) return;
    const eff = getUserEffectivePermissions(sessionUser);
    const canDelete = !!(sessionUser.isMasterAdmin || eff.isMasterAdmin || eff.delFeedback);

    if (!canDelete) {
        alert('Keine Berechtigung zum Löschen von Meldungen!');
        return;
    }

    const item = cachedFeedback[fbId];
    const itemTitle = item ? (item.title || fbId) : fbId;

    if (confirm(`Möchtest du diese Meldung ("${itemTitle}") wirklich dauerhaft löschen?`)) {
        db.ref('data/feedback/' + fbId).remove().then(() => {
            logAdminAudit('Feedback gelöscht', `Eintrag "${itemTitle}" (${fbId}) gelöscht durch ${sessionUser.vorname} ${sessionUser.nachname}`);
            alert('✅ Eintrag erfolgreich gelöscht!');
        }).catch(err => {
            alert('Der Eintrag konnte nicht gelöscht werden. Bitte versuche es erneut.');
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

/* ══════════════════════════════════════════════════════════════
   CHIEF-EBENE: MATERIALVERWALTUNG
══════════════════════════════════════════════════════════════ */

const CHIEF_MATERIAL_LEGACY_V660 = [
    {date:'2026-05-24', stocks:{wundreiniger:1744,nahtset:759,verband:1832,schiene:3545,kuehlpack:2417,schmerz5:2704,schmerz10:2101,schmerz15:2913,schmerz20:2127}, refilled:true, refilledAt:'2026-05-24'},
    {date:'2026-05-31', stocks:{wundreiniger:1648,nahtset:646,verband:2044,schiene:3459,kuehlpack:2430,schmerz5:2718,schmerz10:2025,schmerz15:2922,schmerz20:2118}, refilled:true, refilledAt:'2026-05-31'},
    {date:'2026-06-07', stocks:{wundreiniger:1693,nahtset:1721,verband:2385,schiene:3449,kuehlpack:2572,schmerz5:2682,schmerz10:2116,schmerz15:2905,schmerz20:2101}, refilled:true, refilledAt:'2026-06-07'},
    {date:'2026-06-14', stocks:{wundreiniger:1853,nahtset:1841,verband:1866,schiene:3405,kuehlpack:2500,medikit:1233,schmerz5:2619,schmerz10:2136,schmerz15:2812,schmerz20:2236}, refilled:true, refilledAt:'2026-06-15'},
    {date:'2026-06-21', stocks:{wundreiniger:1943,nahtset:2500,verband:2720,schiene:3367,kuehlpack:2520,medikit:1179,schmerz5:2660,schmerz10:2493,schmerz15:3063,schmerz20:2443}, refilled:true, refilledAt:'2026-06-21'},
    {date:'2026-06-28', stocks:{wundreiniger:1443,nahtset:1359,verband:1681,schiene:3269,kuehlpack:2355,medikit:957,schmerz5:2516,schmerz10:1784,schmerz15:3035,schmerz20:2085}, refilled:true, refilledAt:''},
    {date:'2026-07-05', stocks:{wundreiniger:2076,nahtset:2187,verband:2351,schiene:3234,kuehlpack:2468,medikit:1743,schmerz5:2496,schmerz10:2286,schmerz15:3003,schmerz20:2527}, refilled:true, refilledAt:''},
    {date:'2026-07-12', stocks:{wundreiniger:1927,nahtset:1945,verband:1871,schiene:3148,kuehlpack:2417,medikit:604,schmerz5:2481,schmerz10:2105,schmerz15:2890,schmerz20:2330}, refilled:true, refilledAt:'2026-07-13'},
    {date:'2026-07-19', stocks:{wundreiniger:2169,nahtset:2127,verband:2167,schiene:3096,kuehlpack:2477,medikit:1124,schmerz5:2508,schmerz10:2119,schmerz15:2880,schmerz20:2495}, refilled:true, refilledAt:'2026-07-19'},
    {date:'2026-07-26', stocks:{wundreiniger:2080,nahtset:1968,verband:2008,schiene:3032,kuehlpack:2523,medikit:851,schmerz5:2435,schmerz10:1654,schmerz15:2850,schmerz20:2529}, refilled:true, refilledAt:'2026-06-27'},
    {date:'2026-08-02', stocks:{wundreiniger:2167,nahtset:2145,verband:2150,schiene:3014,kuehlpack:2507,medikit:1438,schmerz5:2436,schmerz10:2167,schmerz15:2880,schmerz20:2573}, refilled:true, refilledAt:''},
    {date:'2026-08-09', stocks:{wundreiniger:2350,nahtset:2306,verband:2249,schiene:3009,kuehlpack:2507,medikit:2592,schmerz5:2441,schmerz10:2355,schmerz15:2894,schmerz20:2593}, refilled:true, refilledAt:''},
    {date:'2026-08-16', stocks:{wundreiniger:2010,nahtset:1929,verband:1879,schiene:3044,kuehlpack:2532,medikit:1443,schmerz5:2492,schmerz10:2039,schmerz15:2924,schmerz20:2622}, refilled:true, refilledAt:'2026-08-16'},
    {date:'2026-08-23', stocks:{wundreiniger:2072,nahtset:2105,verband:2128,schiene:3035,kuehlpack:2529,medikit:1598,schmerz5:2456,schmerz10:2115,schmerz15:2924,schmerz20:2629}, refilled:true, refilledAt:'2026-08-23'},
    {date:'2026-08-30', stocks:{wundreiniger:1967,nahtset:1866,verband:1938,schiene:2959,kuehlpack:2445,medikit:2469,schmerz5:2438,schmerz10:1953,schmerz15:2819,schmerz20:2519}, refilled:true, refilledAt:'2026-08-30'},
    {date:'2026-09-06', stocks:{wundreiniger:2062,nahtset:1986,verband:1897,schiene:2909,kuehlpack:2500,medikit:2287,schmerz5:2520,schmerz10:1974,schmerz15:2814,schmerz20:2504}, refilled:true, refilledAt:'2026-09-06'},
    {date:'2026-09-13', stocks:{wundreiniger:1899,nahtset:1966,verband:2131,schiene:2821,kuehlpack:2421,medikit:2457,schmerz5:2431,schmerz10:1522,schmerz15:2763,schmerz20:2461}, refilled:false, refilledAt:''}
];

async function importChiefMaterialLegacyV660Once() {
    if (!sessionUser || !canCurrentUserEditChiefMaterials() || isMaintenanceRestrictedSession()) return;
    try {
        const markerRef = db.ref('data/chiefMaterials/legacyImportV660');
        const marker = await markerRef.once('value');
        if (marker.exists()) return;
        const updates = {};
        CHIEF_MATERIAL_LEGACY_V660.forEach((row, index) => {
            const maxima = Object.assign({}, defaultChiefMaterialConfig);
            const consumed = {};
            Object.entries(row.stocks || {}).forEach(([id, stock]) => {
                if (stock === null || stock === undefined || stock === '') return;
                consumed[id] = Math.round((Number(maxima[id]) || 0) - Number(stock));
            });
            const key = `legacy_v660_${row.date.replace(/-/g, '_')}`;
            updates[`data/chiefMaterials/entries/${key}`] = {
                date: row.date,
                stocks: row.stocks,
                maxima,
                consumed,
                refilled: row.refilled === true,
                refilledAt: row.refilledAt || '',
                enteredBy: 'Altbestand (übernommen)',
                enteredById: 'legacy_import_v660',
                ts: new Date(`${row.date}T12:00:00`).getTime() + index
            };
        });
        updates['data/chiefMaterials/legacyImportV660'] = {
            done: true,
            importedAt: Date.now(),
            importedBy: getUserAccountId(sessionUser),
            count: CHIEF_MATERIAL_LEGACY_V660.length
        };
        await db.ref().update(updates);
        console.info(`${CHIEF_MATERIAL_LEGACY_V660.length} Altbestände wurden übernommen.`);
    } catch (err) {
        console.error('Altbestände konnten nicht übernommen werden:', err);
    }
}

function canCurrentUserViewChiefMaterials() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    // Variante A: Auch Chief Ebene folgt ausschließlich den konfigurierbaren Häkchen.
    // Nur Master Admin besitzt unveränderlichen Vollzugriff.
    return !!(eff.isMasterAdmin || eff.canViewChiefMaterials || eff.canEditChiefMaterials);
}

function canCurrentUserEditChiefMaterials() {
    if (!sessionUser) return false;
    const eff = getUserEffectivePermissions(sessionUser);
    return !!(eff.isMasterAdmin || eff.canEditChiefMaterials);
}

function refreshChiefMaterialsListener() {
    if (!db) return;
    const ref = db.ref('data/chiefMaterials');
    ref.off();
    chiefMaterialsListenerActive = false;
    if (!sessionUser || !canCurrentUserViewChiefMaterials()) {
        cachedChiefMaterialConfig = Object.assign({}, defaultChiefMaterialConfig);
        cachedChiefMaterialEntries = {};
        return;
    }
    chiefMaterialsListenerActive = true;
    importChiefMaterialLegacyV660Once();
    ref.on('value', snap => {
        const raw = snap.val() || {};
        cachedChiefMaterialConfig = Object.assign({}, defaultChiefMaterialConfig, raw.config || {});
        cachedChiefMaterialEntries = raw.entries || {};
        if (document.getElementById('chiefTab')?.classList.contains('active')) renderChiefMaterialsTab();
    }, err => {
        console.error('Chief-Materialliste konnte nicht geladen werden:', err);
        if (document.getElementById('chiefTab')?.classList.contains('active')) {
            const body = document.getElementById('chiefMaterialHistoryBody');
            if (body) body.innerHTML = '<tr><td colspan="20" style="text-align:center;color:var(--danger);padding:20px;">Materialliste konnte nicht geladen werden.</td></tr>';
        }
    });
}

function getChiefConsumptionLevel(consumed) {
    const n = Number(consumed);
    if (n < 0) return { cls:'chief-level-surplus', label:`${Math.abs(n)} Überschuss` };
    if (n <= 199) return { cls:'chief-level-green', label:`${n} verbraucht` };
    if (n <= 399) return { cls:'chief-level-yellow', label:`${n} verbraucht` };
    if (n <= 599) return { cls:'chief-level-orange', label:`${n} verbraucht` };
    return { cls:'chief-level-red', label:`${n} verbraucht` };
}

function formatChiefDate(iso) {
    if (!iso) return '--';
    const parts = String(iso).split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : escapeHtml(iso);
}

function renderChiefMaterialEntryForm() {
    const grid = document.getElementById('chiefMaterialInputGrid');
    if (!grid) return;
    const editable = canCurrentUserEditChiefMaterials();
    grid.innerHTML = CHIEF_MATERIAL_DEFS.map(m => {
        const max = Math.max(0, Number(cachedChiefMaterialConfig[m.id]) || m.defaultMax);
        return `<div class="chief-material-item">
            <label for="chiefStock_${m.id}">${escapeHtml(m.name)}</label>
            <input type="number" min="0" step="1" id="chiefStock_${m.id}" ${editable ? '' : 'disabled'} placeholder="Bestand" oninput="updateChiefMaterialPreview()">
            <div class="chief-material-meta">Max.: <b>${max}</b></div>
            <div id="chiefPreview_${m.id}" class="chief-consumption-badge chief-level-green">—</div>
        </div>`;
    }).join('');
    const saveBtn = document.getElementById('btnSaveChiefMaterialEntry');
    if (saveBtn) saveBtn.style.display = editable ? 'inline-block' : 'none';
    document.getElementById('chiefMaterialRefilled')?.toggleAttribute('disabled', !editable);
    document.getElementById('chiefMaterialRefilledAt')?.toggleAttribute('disabled', !editable);
}

function renderChiefMaterialConfig() {
    const grid = document.getElementById('chiefMaterialConfigGrid');
    if (!grid) return;
    const editable = canCurrentUserEditChiefMaterials();
    grid.innerHTML = CHIEF_MATERIAL_DEFS.map(m => {
        const max = Math.max(0, Number(cachedChiefMaterialConfig[m.id]) || m.defaultMax);
        return `<div class="chief-config-item"><label for="chiefMax_${m.id}">${escapeHtml(m.name)}</label><input type="number" min="0" step="1" id="chiefMax_${m.id}" value="${max}" ${editable ? '' : 'disabled'}></div>`;
    }).join('');
    const btn = document.getElementById('btnSaveChiefMaterialConfig');
    if (btn) btn.style.display = editable ? 'block' : 'none';
}

function updateChiefMaterialPreview() {
    CHIEF_MATERIAL_DEFS.forEach(m => {
        const input = document.getElementById(`chiefStock_${m.id}`);
        const badge = document.getElementById(`chiefPreview_${m.id}`);
        if (!input || !badge) return;
        if (input.value === '') {
            badge.className = 'chief-consumption-badge chief-level-green';
            badge.textContent = '—';
            return;
        }
        const stock = Math.max(0, Number(input.value) || 0);
        const max = Math.max(0, Number(cachedChiefMaterialConfig[m.id]) || m.defaultMax);
        const level = getChiefConsumptionLevel(max - stock);
        badge.className = `chief-consumption-badge ${level.cls}`;
        badge.textContent = level.label;
    });
}

function handleChiefRefilledToggle() {
    const cb = document.getElementById('chiefMaterialRefilled');
    const date = document.getElementById('chiefMaterialRefilledAt');
    if (!cb || !date) return;
    date.style.display = cb.checked ? 'block' : 'none';
    if (cb.checked && !date.value) date.value = new Date().toLocaleDateString('sv-SE');
    if (!cb.checked) date.value = '';
}

let chiefHistoryScrollSyncing = false;

function updateChiefHistoryTopScrollbar() {
    const top = document.getElementById('chiefHistoryTopScroll');
    const inner = document.getElementById('chiefHistoryTopScrollInner');
    const wrap = document.getElementById('chiefHistoryTableWrap');
    const table = document.getElementById('chiefHistoryTable');
    if (!top || !inner || !wrap || !table) return;

    requestAnimationFrame(() => {
        const tableWidth = Math.max(table.scrollWidth, table.offsetWidth || 0);
        inner.style.width = `${tableWidth}px`;
        top.style.display = tableWidth > wrap.clientWidth + 1 ? 'block' : 'none';
        top.scrollLeft = wrap.scrollLeft;
    });
}

function syncChiefHistoryScroll(source) {
    if (chiefHistoryScrollSyncing) return;
    const top = document.getElementById('chiefHistoryTopScroll');
    const wrap = document.getElementById('chiefHistoryTableWrap');
    if (!top || !wrap) return;

    chiefHistoryScrollSyncing = true;
    if (source === 'top') {
        wrap.scrollLeft = top.scrollLeft;
    } else {
        top.scrollLeft = wrap.scrollLeft;
    }
    requestAnimationFrame(() => { chiefHistoryScrollSyncing = false; });
}

function renderChiefMaterialHistory() {
    const head = document.getElementById('chiefMaterialHistoryHead');
    const body = document.getElementById('chiefMaterialHistoryBody');
    if (!head || !body) return;
    const editable = canCurrentUserEditChiefMaterials();
    head.innerHTML = `<tr><th>Stichtag</th>${CHIEF_MATERIAL_DEFS.map(m => `<th>${escapeHtml(m.name)}</th>`).join('')}<th>Aufgefüllt</th><th>Erfasst von</th>${editable ? '<th class="chief-history-action-col">Aktion</th>' : ''}</tr>`;
    const entries = Object.entries(cachedChiefMaterialEntries || {}).sort((a,b) => {
        const ad = a[1]?.date || '';
        const bd = b[1]?.date || '';
        if (ad !== bd) return bd.localeCompare(ad);
        return (b[1]?.ts || 0) - (a[1]?.ts || 0);
    });
    if (!entries.length) {
        body.innerHTML = `<tr><td colspan="${CHIEF_MATERIAL_DEFS.length + (editable ? 4 : 3)}" style="text-align:center;color:var(--text-muted);padding:24px;">Noch keine Bestandsaufnahmen gespeichert.</td></tr>`;
        updateChiefHistoryTopScrollbar();
        return;
    }
    body.innerHTML = entries.map(([entryId, e]) => {
        const stocks = e.stocks || {};
        const maxima = e.maxima || cachedChiefMaterialConfig || {};
        const consumed = e.consumed || {};
        const matCells = CHIEF_MATERIAL_DEFS.map(m => {
            const stock = stocks[m.id];
            if (stock === undefined || stock === null || stock === '') return '<td class="chief-history-empty">—</td>';
            const max = Number(maxima[m.id] ?? m.defaultMax);
            const cons = Number(consumed[m.id] ?? (max - Number(stock)));
            const level = getChiefConsumptionLevel(cons);
            return `<td><div class="chief-history-stock">${escapeHtml(stock)}</div><span class="chief-consumption-badge ${level.cls}">${escapeHtml(level.label)}</span></td>`;
        }).join('');
        const refill = e.refilled ? `✅ Ja${e.refilledAt ? `<br><small>${formatChiefDate(e.refilledAt)}</small>` : ''}` : '—';
        return `<tr><td><b>${formatChiefDate(e.date)}</b></td>${matCells}<td>${refill}</td><td>${escapeHtml(e.enteredBy || '--')}</td>${editable ? `<td class="chief-history-action-col"><button type="button" class="btn-delete-row chief-history-delete-btn" onclick="deleteChiefMaterialEntry('${entryId}')" title="Bestandsaufnahme löschen" aria-label="Bestandsaufnahme löschen">🗑️</button></td>` : ''}</tr>`;
    }).join('');
    updateChiefHistoryTopScrollbar();
}

function renderChiefMaterialsTab() {
    const allowed = canCurrentUserViewChiefMaterials();
    const noAccess = document.getElementById('chiefMaterialsNoAccess');
    const content = document.getElementById('chiefMaterialsContent');
    if (noAccess) noAccess.style.display = allowed ? 'none' : 'block';
    if (content) content.style.display = allowed ? 'block' : 'none';
    if (!allowed) return;
    const dateEl = document.getElementById('chiefMaterialDate');
    if (dateEl && !dateEl.value) dateEl.value = new Date().toLocaleDateString('sv-SE');
    renderChiefMaterialEntryForm();
    renderChiefMaterialConfig();
    renderChiefMaterialHistory();
    handleChiefRefilledToggle();
}

async function saveChiefMaterialEntry() {
    if (!requirePermission(['canEditChiefMaterials','isMasterAdmin'], 'Keine Berechtigung zum Bearbeiten der Chief Materialliste!')) return;
    const date = document.getElementById('chiefMaterialDate')?.value;
    if (!date) { alert('Bitte einen Stichtag auswählen.'); return; }
    const stocks = {}, maxima = {}, consumed = {};
    for (const m of CHIEF_MATERIAL_DEFS) {
        const el = document.getElementById(`chiefStock_${m.id}`);
        if (!el || el.value === '') { alert(`Bitte den Bestand für „${m.name}“ eintragen.`); el?.focus(); return; }
        const stock = Number(el.value);
        if (!Number.isFinite(stock) || stock < 0) { alert(`Ungültiger Bestand bei „${m.name}“.`); el.focus(); return; }
        const max = Math.max(0, Number(cachedChiefMaterialConfig[m.id]) || m.defaultMax);
        stocks[m.id] = Math.round(stock);
        maxima[m.id] = Math.round(max);
        consumed[m.id] = Math.round(max - stock);
    }
    const refilled = !!document.getElementById('chiefMaterialRefilled')?.checked;
    const refilledAt = refilled ? (document.getElementById('chiefMaterialRefilledAt')?.value || date) : '';
    const entry = {
        date, stocks, maxima, consumed, refilled, refilledAt,
        enteredBy: `${sessionUser.vorname || ''} ${sessionUser.nachname || ''}`.trim(),
        enteredById: getUserAccountId(sessionUser),
        ts: Date.now()
    };
    try {
        await db.ref('data/chiefMaterials/entries').push(entry);
        logAdminAudit('Materialbestand gespeichert', `Bestandsaufnahme vom ${formatChiefDate(date)} wurde gespeichert.`);
        CHIEF_MATERIAL_DEFS.forEach(m => { const el = document.getElementById(`chiefStock_${m.id}`); if (el) el.value = ''; });
        const cb = document.getElementById('chiefMaterialRefilled'); if (cb) cb.checked = false;
        const rd = document.getElementById('chiefMaterialRefilledAt'); if (rd) { rd.value = ''; rd.style.display = 'none'; }
        updateChiefMaterialPreview();
        alert('✅ Bestandsaufnahme wurde gespeichert.');
    } catch (err) {
        console.error('Materialbestand konnte nicht gespeichert werden:', err);
        alert('Die Bestandsaufnahme konnte nicht gespeichert werden. Bitte versuche es erneut.');
    }
}

async function saveChiefMaterialConfig() {
    if (!requirePermission(['canEditChiefMaterials','isMasterAdmin'], 'Keine Berechtigung zum Ändern der Maximalbestände!')) return;
    const config = {};
    for (const m of CHIEF_MATERIAL_DEFS) {
        const el = document.getElementById(`chiefMax_${m.id}`);
        const val = Number(el?.value);
        if (!Number.isFinite(val) || val < 0) { alert(`Ungültiger Maximalbestand bei „${m.name}“.`); el?.focus(); return; }
        config[m.id] = Math.round(val);
    }
    try {
        await db.ref('data/chiefMaterials/config').set(config);
        logAdminAudit('Maximalbestände geändert', `${sessionUser.vorname} ${sessionUser.nachname} hat die Maximalbestände der Chief Materialliste aktualisiert.`);
        alert('✅ Maximalbestände wurden gespeichert.');
    } catch (err) {
        console.error('Maximalbestände konnten nicht gespeichert werden:', err);
        alert('Die Maximalbestände konnten nicht gespeichert werden. Bitte versuche es erneut.');
    }
}

async function deleteChiefMaterialEntry(entryId) {
    if (!requirePermission(['canEditChiefMaterials','isMasterAdmin'], 'Keine Berechtigung zum Löschen von Bestandsaufnahmen!')) return;
    if (!entryId || !confirm('Diese Bestandsaufnahme wirklich dauerhaft löschen?')) return;
    try {
        await db.ref(`data/chiefMaterials/entries/${entryId}`).remove();
        logAdminAudit('Materialbestand gelöscht', `Bestandsaufnahme ${entryId} wurde gelöscht.`);
    } catch (err) {
        console.error('Bestandsaufnahme konnte nicht gelöscht werden:', err);
        alert('Der Eintrag konnte nicht gelöscht werden. Bitte versuche es erneut.');
    }
}

/* ── Navigation & Global Helpers ───────────────────────────── */
function closeMainNavGroups() {
    document.querySelectorAll('.nav-group.open').forEach(group => group.classList.remove('open'));
    document.querySelectorAll('.nav-group-toggle[aria-expanded="true"]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
}

function toggleMainNavGroup(menuId, btn, event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById(menuId);
    const group = menu?.closest('.nav-group');
    if (!menu || !group || !btn) return;

    const willOpen = !group.classList.contains('open');
    closeMainNavGroups();
    if (willOpen) {
        group.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
    }
}

function switchTab(tabId, btn) {
    if (tabId === 'personnelTab' && !(typeof canCurrentUserAccessPersonnelArea === 'function' ? canCurrentUserAccessPersonnelArea() : canCurrentUserManageCareerPaths())) {
        alert('Keine Berechtigung für den Bereich Personalabteilung.');
        return;
    }
    if (isMaintenanceRestrictedSession() && tabId !== 'docTab') {
        alert('🛠️ Dieser Bereich ist während der Wartungsarbeiten vorübergehend nicht verfügbar. Dokumentation & Einsatz bleibt nutzbar.');
        tabId = 'docTab';
        btn = document.querySelector('.tab-nav .tab-btn');
    }
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab-btn, .nav-sub-btn').forEach(e => e.classList.remove('active'));
    const t = document.getElementById(tabId); if (t) t.classList.add('active');

    if (btn) {
        btn.classList.add('active');
        const group = btn.closest?.('.nav-group');
        const groupToggle = group?.querySelector('.nav-group-toggle');
        if (groupToggle && btn.classList.contains('nav-sub-btn')) groupToggle.classList.add('active');
    }
    closeMainNavGroups();

    if (tabId === 'calendarTab') { renderCalendarMonth(); setCalendarView(activeCalendarView); }
    if (tabId === 'staffTab') renderStaffDirectory();
    if (tabId === 'personnelTab') { if (typeof renderPersonnelWorkspace === 'function') renderPersonnelWorkspace(); else renderCareerManagementPanel(); }
    if (tabId === 'miscTab') renderGehaltTab(cachedGehaltData);
    if (tabId === 'sanctionsTab') renderSanctionsCatalog();
    if (tabId === 'chiefTab') renderChiefMaterialsTab();
    if (tabId === 'examTab') renderExamTab();
    if (tabId === 'settingsTab' && sessionUser) {
        const eDatumEl = document.getElementById('einstellungsDatum');
        if (eDatumEl?.value) berechneDienstTage(false);
    }
    if (tabId === 'feedbackTab' && canCurrentUserManageFeedback()) renderFeedbackManagementTable();
}
function settingsTabClick() { switchTab('settingsTab', document.getElementById('adminMainTabHeader')); }

function setupRolePermissionAccordions() {
    const card = document.getElementById('adminRoleEditorCard');
    if (!card) return;

    const headings = Array.from(card.querySelectorAll('h5'));
    headings.forEach((heading, idx) => {
        const section = heading.parentElement;
        const body = heading.nextElementSibling;
        if (!section || !body || section.dataset.accordionReady === '1') return;

        section.dataset.accordionReady = '1';
        section.classList.add('role-perm-section');
        heading.classList.add('role-perm-section-toggle');
        heading.setAttribute('role', 'button');
        heading.setAttribute('tabindex', '0');
        heading.setAttribute('aria-expanded', idx === 0 ? 'true' : 'false');
        if (idx !== 0) section.classList.add('collapsed');

        const toggle = () => {
            const collapsed = section.classList.toggle('collapsed');
            heading.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        };
        heading.addEventListener('click', toggle);
        heading.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
            }
        });
    });
}

function switchInstructorTab(tabId, btnEl) {
    if (btnEl && btnEl.style.display === 'none') return;
    if (tabId === 'instrTabSolutions') renderInstructorExamSolutions();
    document.querySelectorAll('#examInstructorView .admin-subtab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('#examInstructorView .admin-tab-btn').forEach(e => e.classList.remove('active'));
    const t = document.getElementById(tabId); if (t) t.classList.add('active');
    if (btnEl) btnEl.classList.add('active');
}

function toggleGroupCollapse(gId) { const g = document.getElementById(gId); if (g) g.classList.toggle('collapsed'); }

/* ── Modalfenster immer am sichtbaren Viewport verankern ── */
function mountModalOverlaysToViewport() {
    if (!document.body) return;
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
    });
}

/* ── DOM Ready & Exports ────────────────────────────────     */
document.addEventListener('DOMContentLoaded', async () => {
    mountModalOverlaysToViewport();
    updateLiveDate(); setInterval(updateLiveDate, 60000);
    setupRolePermissionAccordions();
    setupUnsavedChangeTracking();
    setupUnifiedEditorModals();
    setupGlobalSearchShortcut();
    window.addEventListener('resize', updateChiefHistoryTopScrollbar);
    document.addEventListener('click', event => {
        if (!event.target.closest('.nav-group')) closeMainNavGroups();
    });
    renderGuideTab(); renderHierarchieBoard(hierarchieDaten); baueMaterialUIAuf();
    renderGehaltTab(cachedGehaltData);
    renderSanctionsCatalog();
    renderContentFreshnessHints();

    const authView = document.getElementById('authView');
    const mainView = document.getElementById('mainAppView');
    if (authView) authView.style.display = 'flex';
    if (mainView) mainView.style.display = 'none';

    try {
        await configureFirebaseAuthPersistence();
        const firebaseUser = await waitForFirebaseAuthReady();
        if (!firebaseUser) return;

        const todayFormatted = new Date().toLocaleDateString('de-DE');
        const storedSessionDate = getStoredSessionDate();
        if (!storedSessionDate || storedSessionDate !== todayFormatted) {
            clearStoredSessionData();
            await auth.signOut();
            return;
        }

        const profile = await loadAuthenticatedProfile(firebaseUser);
        const user = profile.user;
        const effectiveStatus = user.status || ((user.isAdmin || user.isMasterAdmin) ? 'approved' : 'pending');
        if (effectiveStatus !== 'approved') {
            await auth.signOut();
            return;
        }

        cachedMaintenanceState = await readMaintenanceState();
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
_w.renderAdminOverview = renderAdminOverview; _w.openAdminOverviewSection = openAdminOverviewSection; _w.openPhotoChecklistFromAdminOverview = openPhotoChecklistFromAdminOverview;
_w.openGlobalSearch = openGlobalSearch; _w.closeGlobalSearch = closeGlobalSearch; _w.renderGlobalSearchResults = renderGlobalSearchResults; _w.navigateGlobalSearchResult = navigateGlobalSearchResult;
_w.openMyOpenItemsModal = openMyOpenItemsModal; _w.closeMyOpenItemsModal = closeMyOpenItemsModal; _w.navigateMyOpenItem = navigateMyOpenItem;
_w.handleAuthAction = handleAuthAction; _w.toggleAuthTab = toggleAuthTab;
_w.openAdminKeyModal = openAdminKeyModal; _w.closeAdminAuthModal = closeAdminAuthModal; _w.verifyAdminKeyPassword = verifyAdminKeyPassword; _w.closeAdminManagementModal = closeAdminManagementModal;
_w.handleDienstEndeLogout = handleDienstEndeLogout; _w.forceUserOutOfService = forceUserOutOfService; _w.publishClientRelease = publishClientRelease; _w.reloadForAppUpdate = reloadForAppUpdate; _w.berechneDienstTage = berechneDienstTage; _w.passwortAendern = passwortAendern;
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
_w.renderSanctionsCatalog = renderSanctionsCatalog; _w.setSanctionsFilter = setSanctionsFilter; _w.resetSanctionsFilters = resetSanctionsFilters; _w.toggleSanctionsRules = toggleSanctionsRules;
_w.openSanctionsCatalogEditor = openSanctionsCatalogEditor; _w.closeSanctionsCatalogEditor = closeSanctionsCatalogEditor; _w.addSanctionsRuleEditorRow = addSanctionsRuleEditorRow; _w.removeSanctionsRuleEditorRow = removeSanctionsRuleEditorRow; _w.addSanctionsEntryEditorRow = addSanctionsEntryEditorRow; _w.removeSanctionsEntryEditorRow = removeSanctionsEntryEditorRow; _w.saveSanctionsCatalogEditor = saveSanctionsCatalogEditor;
_w.renderChiefMaterialsTab = renderChiefMaterialsTab; _w.updateChiefMaterialPreview = updateChiefMaterialPreview; _w.handleChiefRefilledToggle = handleChiefRefilledToggle; _w.saveChiefMaterialEntry = saveChiefMaterialEntry; _w.saveChiefMaterialConfig = saveChiefMaterialConfig; _w.deleteChiefMaterialEntry = deleteChiefMaterialEntry; _w.syncChiefHistoryScroll = syncChiefHistoryScroll;
_w.startExam = startExam; _w.cancelActiveExam = cancelActiveExam; _w.submitActiveExam = submitActiveExam;
_w.addExamQuestionRow = addExamQuestionRow; _w.resetExamBuilderForm = resetExamBuilderForm; _w.neuePruefungSpeichern = neuePruefungSpeichern; _w.editExam = editExam; _w.deleteExam = deleteExam; _w.deleteExamSubmission = deleteExamSubmission;
_w.openExamBuilderModal = openExamBuilderModal; _w.closeExamBuilderModal = closeExamBuilderModal;
_w.openExamSubmissionDetailsModal = openExamSubmissionDetailsModal; _w.closeExamSubmissionDetailsModal = closeExamSubmissionDetailsModal; _w.repeatFailedExam = repeatFailedExam;
_w.filterUnlocksTable = filterUnlocksTable; _w.filterSubmissionsTable = filterSubmissionsTable; _w.toggleExamUnlockForUser = toggleExamUnlockForUser; _w.toggleExamPassedForUser = toggleExamPassedForUser;
_w.downloadSystemBackup = downloadSystemBackup; _w.restoreSystemBackupFromFile = restoreSystemBackupFromFile; _w.closeBackupPreviewModal = closeBackupPreviewModal; _w.confirmBackupRestore = confirmBackupRestore;
_w.speichereHierarchieDaten = saveHierarchieInline;
_w.approveUser = approveUser; _w.revokeUser = revokeUser; _w.deleteUserAccount = deleteUserAccount; _w.filterAdminUserTable = filterAdminUserTable;
_w.openAssignRolesModal = openAssignRolesModal; _w.closeAssignRolesModal = closeAssignRolesModal; _w.saveAssignedRoles = saveAssignedRoles;
_w.openUserPermissionsModal = openUserPermissionsModal; _w.closeUserPermissionsModal = closeUserPermissionsModal; _w.saveUserPermissions = saveUserPermissions; _w.resetSelectedUserPassword = resetSelectedUserPassword; _w.runFirebaseAuthMigration = runFirebaseAuthMigration;
_w.renderPasswordChangeStatusPanel = renderPasswordChangeStatusPanel; _w.copyAllOpenPasswordReminders = copyAllOpenPasswordReminders; _w.copyPasswordReminderForUser = copyPasswordReminderForUser;
_w.neueRolleErstellen = neueRolleErstellen; _w.selectRole = selectRole; _w.updateRoleBadgePreview = updateRoleBadgePreview; _w.speichereRolle = speichereRolle; _w.loescheRolle = loescheRolle;
_w.vollstaendigerReset = vollstaendigerReset; _w.renderAdminAuditLogs = renderAdminAuditLogs; _w.setMaintenanceMode = setMaintenanceMode; _w.renderMaintenanceAdminPanel = renderMaintenanceAdminPanel;
_w.openAuditLogArchiveModal = openAuditLogArchiveModal; _w.closeAuditLogArchiveModal = closeAuditArchiveModal;
_w.editCommandInline = editCommandInline;
_w.editLinkInline = editLinkInline;
_w.openHierarchieInlineModal = openHierarchieInlineModal;
_w.closeHierarchieInlineModal = closeHierarchieInlineModal;
_w.saveHierarchieInline = saveHierarchieInline;
_w.changeCalendarMonth = changeCalendarMonth;
_w.resetCalendarToToday = resetCalendarToToday;
_w.renderCalendarMonth = renderCalendarMonth; _w.setCalendarView = setCalendarView;
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
_w.renderStaffDirectory = renderStaffDirectory; _w.resetStaffDirectoryFilters = resetStaffDirectoryFilters; _w.openStaffDetailModal = openStaffDetailModal; _w.closeStaffDetailModal = closeStaffDetailModal; _w.renderCareerManagementPanel = renderCareerManagementPanel; _w.saveEmployeeCareerPath = saveEmployeeCareerPath; _w.toggleStaffPhotoChecklistBody = toggleStaffPhotoChecklistBody;
_w.syncOfficialServiceNumbersFromRoster = syncOfficialServiceNumbersFromRoster;
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


const PERSONNEL_RANKS = Object.freeze({
    trainee:{label:'Trainee',track:'common-low',order:1}, solo:{label:'Solo',track:'common-low',order:2},
    emt:{label:'EMT',track:'common-low',order:3}, a_emt:{label:'A-EMT',track:'common-low',order:4},
    resident_physician:{label:'Resident Physician',track:'doctor',order:5}, physician:{label:'Physician',track:'doctor',order:6}, attending:{label:'Attending',track:'doctor',order:7},
    paramedic:{label:'Paramedic',track:'paramedic',order:5}, senior_paramedic:{label:'Senior Paramedic',track:'paramedic',order:6}, medical_supervisor:{label:'Medical Supervisor',track:'paramedic',order:7},
    lieutenant:{label:'Lieutenant',track:'common-high',order:8}, chief_physician:{label:'Chief Physician',track:'common-high',order:9}, fod:{label:'F.o.D',track:'common-high',order:10},
    domo:{label:'D.o.M.O',track:'common-high',order:11}, deputy_chief:{label:'Deputy Chief',track:'common-high',order:12}, ass_chief:{label:'Ass. Chief',track:'common-high',order:13}, chief:{label:'Chief',track:'common-high',order:14}
});
const PERSONNEL_COMMON_RANKS=['trainee','solo','emt','a_emt','lieutenant','chief_physician','fod','domo','deputy_chief','ass_chief','chief'];
const PERSONNEL_DOCTOR_RANKS=['resident_physician','physician','attending'];
const PERSONNEL_PARAMEDIC_RANKS=['paramedic','senior_paramedic','medical_supervisor'];
const PERSONNEL_ABSENCE_TYPES=Object.freeze({vacation:{label:'Urlaub',icon:'🏖️'},excused:{label:'Entschuldigt abwesend',icon:'📝'}});
let cachedEmployeeRanks={},cachedEmployeeAbsenceStatus={},cachedPersonnelRecords={},cachedPersonnelAbsences={},activePersonnelEmployeeId='',activePersonnelView='overview';

function getPersonnelPermissions(){
    const eff=sessionUser?getUserEffectivePermissions(sessionUser):{},master=!!eff.isMasterAdmin;
    return {canAccess:!!(master||eff.canManageCareerPaths||eff.canViewPersonnelRecords||eff.canManagePersonnelRecords||eff.canManagePersonnelAbsences||eff.canManagePersonnelRanks||eff.canCreateEmployees),
        canViewRecords:!!(master||eff.canViewPersonnelRecords||eff.canManagePersonnelRecords||eff.canManagePersonnelRanks||eff.canManagePersonnelAbsences),canManageRecords:!!(master||eff.canManagePersonnelRecords),
        canManageAbsences:!!(master||eff.canManagePersonnelAbsences),canManageRanks:!!(master||eff.canManagePersonnelRanks),canManageCareer:!!(master||eff.canManageCareerPaths),canCreateEmployees:!!(master||eff.canCreateEmployees)};
}
function canCurrentUserAccessPersonnelArea(){return getPersonnelPermissions().canAccess;}
function normalizePersonnelRankKey(v){const k=String(v||'').trim();return PERSONNEL_RANKS[k]?k:'';}
function personnelUserName(uId){const u=cachedUsers?.[uId]||{};return `${u.vorname||''} ${u.nachname||''}`.trim()||uId;}
function getEmployeeRankData(uId){const x=cachedEmployeeRanks?.[uId]||{};return {common:normalizePersonnelRankKey(x.common),doctor:normalizePersonnelRankKey(x.doctor),paramedic:normalizePersonnelRankKey(x.paramedic)};}
function getEmployeeRankKeys(uId){const r=getEmployeeRankData(uId);if(r.common&&PERSONNEL_RANKS[r.common]?.track==='common-high')return[r.common];const b=[r.doctor,r.paramedic].filter(Boolean);return b.length?b:(r.common?[r.common]:[]);}
function getEmployeeRankLabels(uId){const k=getEmployeeRankKeys(uId);return k.length?k.map(x=>PERSONNEL_RANKS[x]?.label||x):['Noch nicht festgelegt'];}
function getEmployeeRankBadges(uId){const k=getEmployeeRankKeys(uId);if(!k.length)return '<span class="staff-rank-badge rank-none">🎖️ Rang: Noch nicht festgelegt</span>';return k.map(x=>`<span class="staff-rank-badge rank-${escapeHtml(PERSONNEL_RANKS[x]?.track||'common')}">🎖️ ${escapeHtml(PERSONNEL_RANKS[x]?.label||x)}</span>`).join('');}
function getEmployeePublicAbsence(uId){const x=cachedEmployeeAbsenceStatus?.[uId];if(!x||x.active!==true||!PERSONNEL_ABSENCE_TYPES[x.type])return null;const m=PERSONNEL_ABSENCE_TYPES[x.type];return {type:x.type,label:m.label,icon:m.icon};}
function getEmployeeAbsenceBadge(uId){const x=getEmployeePublicAbsence(uId);return x?`<span class="staff-absence-badge">${x.icon} ${escapeHtml(x.label)}</span>`:'';}
function personnelTodayIso(){return new Date().toLocaleDateString('sv-SE');}
function formatPersonnelDate(v){const raw=String(v||'');if(!raw)return '—';const d=new Date(raw+'T00:00:00');return Number.isNaN(d.getTime())?raw:d.toLocaleDateString('de-DE');}
function isPersonnelAbsenceDue(x){return !!(x&&x.status!=='returned'&&x.active!==false&&x.endDate&&personnelTodayIso()>String(x.endDate));}
function getPersonnelActiveAbsence(uId){return Object.values(cachedPersonnelAbsences?.[uId]||{}).find(x=>x&&x.status!=='returned'&&x.active!==false)||null;}
function getPersonnelApprovedEntries(){return Object.entries(cachedUsers||{}).filter(([,u])=>{const st=u?.status||((u?.isAdmin||u?.isMasterAdmin)?'approved':'pending');return !!u&&st==='approved';}).sort((a,b)=>{const da=parseDN(a[1]?.dn),dbb=parseDN(b[1]?.dn);return da!==dbb?da-dbb:personnelUserName(a[0]).localeCompare(personnelUserName(b[0]),'de');});}
function buildPersonnelRankOptions(keys,selected,placeholder='Nicht festgelegt'){return `<option value="">${escapeHtml(placeholder)}</option>`+keys.map(k=>`<option value="${k}" ${selected===k?'selected':''}>${escapeHtml(PERSONNEL_RANKS[k].label)}</option>`).join('');}

function switchPersonnelView(view){if(!canCurrentUserAccessPersonnelArea())return;activePersonnelView=['overview','files','calendar','create'].includes(view)?view:'overview';renderPersonnelWorkspace();}
function renderPersonnelWorkspace(){
    const root=document.getElementById('personnelTab');if(!root)return;const p=getPersonnelPermissions();if(!p.canAccess)return;
    const vis={files:p.canViewRecords||p.canManageCareer||p.canManageRanks,calendar:p.canViewRecords||p.canManageAbsences,create:p.canCreateEmployees};
    ['files','calendar','create'].forEach(k=>{const b=document.getElementById('personnelNav_'+k);if(b)b.style.display=vis[k]?'':'none';});
    if(activePersonnelView!=='overview'&&!vis[activePersonnelView])activePersonnelView='overview';
    document.querySelectorAll('.personnel-pane').forEach(e=>e.classList.toggle('active',e.id==='personnelPane_'+activePersonnelView));
    document.querySelectorAll('.personnel-nav-btn').forEach(e=>e.classList.toggle('active',e.id==='personnelNav_'+activePersonnelView));
    const c=document.getElementById('personnelAbsenceCreateCard');if(c)c.style.display=p.canManageAbsences?'':'none';
    renderPersonnelOverview();renderPersonnelEmployeeList();renderPersonnelEmployeeDetail();renderPersonnelCalendar();renderPersonnelCreateForm();
}
function renderPersonnelOverview(){
    const due=[];let vacation=0,excused=0;Object.entries(cachedPersonnelAbsences||{}).forEach(([uId,map])=>Object.entries(map||{}).forEach(([id,x])=>{if(!x||x.status==='returned'||x.active===false)return;if(x.type==='vacation')vacation++;if(x.type==='excused')excused++;if(isPersonnelAbsenceDue(x))due.push({uId,id,x});}));
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=String(v);};set('personnelStatEmployees',getPersonnelApprovedEntries().length);set('personnelStatVacation',vacation);set('personnelStatExcused',excused);set('personnelStatDue',due.length);
    const box=document.getElementById('personnelReturnAlerts');if(!box)return;const canConfirm=getPersonnelPermissions().canManageAbsences;
    box.innerHTML=due.length?due.sort((a,b)=>String(a.x.endDate).localeCompare(String(b.x.endDate))).map(({uId,id,x})=>`<div class="personnel-return-alert"><div><b>${escapeHtml(personnelUserName(uId))}</b><span>${escapeHtml(PERSONNEL_ABSENCE_TYPES[x.type]?.label||'Abwesenheit')} endete am ${escapeHtml(formatPersonnelDate(x.endDate))}</span></div>${canConfirm?`<button type="button" class="btn personnel-small-btn" onclick="confirmPersonnelReturn('${uId}','${id}')">✅ Rückkehr bestätigen</button>`:'<strong>🔴 Rückkehr prüfen</strong>'}</div>`).join(''):'<div class="personnel-empty-state">✅ Keine offenen Rückkehrprüfungen.</div>';
}
function renderPersonnelEmployeeList(){
    const box=document.getElementById('personnelEmployeeList');if(!box)return;const q=(document.getElementById('personnelEmployeeSearch')?.value||'').trim().toLowerCase();
    const entries=getPersonnelApprovedEntries().filter(([uId,u])=>!q||`${u.dn||''} ${u.vorname||''} ${u.nachname||''} ${getEmployeeRankLabels(uId).join(' ')}`.toLowerCase().includes(q));
    if(!activePersonnelEmployeeId||!cachedUsers[activePersonnelEmployeeId])activePersonnelEmployeeId=entries[0]?.[0]||'';
    box.innerHTML=entries.length?entries.map(([uId,u])=>`<button type="button" class="personnel-employee-row ${activePersonnelEmployeeId===uId?'active':''}" onclick="selectPersonnelEmployee('${uId}')"><span class="personnel-employee-dn">${escapeHtml(formatStaffDn(u.dn))}</span><span><b>${escapeHtml(personnelUserName(uId))}</b><small>${escapeHtml(getEmployeeRankLabels(uId).join(' · '))}</small></span>${getEmployeePublicAbsence(uId)?'<em>●</em>':''}</button>`).join(''):'<div class="personnel-empty-state">Keine Mitarbeiter gefunden.</div>';
}
function selectPersonnelEmployee(uId){activePersonnelEmployeeId=uId;renderPersonnelEmployeeList();renderPersonnelEmployeeDetail();}
function renderPersonnelTimelineItem(item){const d=item.ts?new Date(item.ts).toLocaleString('de-DE'):'—',x=item.x||{};if(item.type==='sanction')return `<article class="personnel-timeline-item sanction"><div><b>⚖️ ${escapeHtml(x.title||'Sanktion')}</b><span>${escapeHtml(d)} · ${escapeHtml(x.createdBy||'')}</span></div><p>${formatTextWithLinks(x.report||'')}</p></article>`;if(item.type==='rankup')return `<article class="personnel-timeline-item rankup"><div><b>🎖️ Rangänderung</b><span>${escapeHtml(d)} · ${escapeHtml(x.createdBy||'')}</span></div><p>${escapeHtml(x.summary||'')}${x.reason?`<br><strong>Grund: ${escapeHtml(x.reason)}</strong>`:''}${x.note?`<br>${escapeHtml(x.note)}`:''}</p></article>`;return `<article class="personnel-timeline-item note"><div><b>🗒️ Notiz</b><span>${escapeHtml(d)} · ${escapeHtml(x.createdBy||'')}</span></div><p>${formatTextWithLinks(x.text||'')}</p></article>`;}
function renderPersonnelEmployeeDetail(){
    const box=document.getElementById('personnelEmployeeDetail');if(!box)return;const uId=activePersonnelEmployeeId,user=cachedUsers?.[uId];if(!uId||!user){box.innerHTML='<div class="personnel-empty-state">Wähle links einen Mitarbeiter aus.</div>';return;}
    const p=getPersonnelPermissions(),career=getEmployeeCareerPathKey(uId),ranks=getEmployeeRankData(uId),record=cachedPersonnelRecords?.[uId]||{},timeline=[];Object.entries(record.sanctions||{}).forEach(([id,x])=>timeline.push({id,type:'sanction',ts:Number(x.createdAt)||0,x}));Object.entries(record.notes||{}).forEach(([id,x])=>timeline.push({id,type:'note',ts:Number(x.createdAt)||0,x}));Object.entries(record.rankups||{}).forEach(([id,x])=>timeline.push({id,type:'rankup',ts:Number(x.createdAt)||0,x}));timeline.sort((a,b)=>b.ts-a.ts);const abs=getPersonnelActiveAbsence(uId);
    box.innerHTML=`<div class="personnel-file-head"><span class="personnel-file-dn">${escapeHtml(formatStaffDn(user.dn))}</span><h3>${escapeHtml(personnelUserName(uId))}</h3><div class="personnel-file-badges">${getEmployeeCareerPathBadge(uId)} ${getEmployeeRankBadges(uId)} ${getEmployeeAbsenceBadge(uId)}</div></div>
    <div class="personnel-file-grid">${(p.canManageCareer||p.canManageRanks)?`<section class="personnel-card"><h4>🎖️ Laufbahn & Ränge</h4>${p.canManageCareer?`<label>Laufbahn</label><div class="personnel-inline-row"><select id="personnelCareerSelect"><option value="none" ${career==='none'?'selected':''}>Noch nicht festgelegt</option><option value="doctor" ${career==='doctor'?'selected':''}>Doctor</option><option value="paramedic" ${career==='paramedic'?'selected':''}>Paramedic</option><option value="both" ${career==='both'?'selected':''}>Doctor & Paramedic</option></select><button type="button" class="btn personnel-small-btn" onclick="savePersonnelCareer('${uId}')">Speichern</button></div>`:''}${p.canManageRanks?`<label>Gemeinsamer Rang</label><select id="personnelRankCommon">${buildPersonnelRankOptions(PERSONNEL_COMMON_RANKS,ranks.common)}</select>${career==='doctor'||career==='both'?`<label>Doctor-Rang</label><select id="personnelRankDoctor">${buildPersonnelRankOptions(PERSONNEL_DOCTOR_RANKS,ranks.doctor)}</select>`:''}${career==='paramedic'||career==='both'?`<label>Paramedic-Rang</label><select id="personnelRankParamedic">${buildPersonnelRankOptions(PERSONNEL_PARAMEDIC_RANKS,ranks.paramedic)}</select>`:''}<label>Grund der Rangänderung</label><select id="personnelRankReason"><option value="">Bitte wählen</option><option>Ausbildung</option><option>Wiedereinstellung</option><option>Sonder-Rankup</option></select><label>Zusatz / Begründung</label><input type="text" id="personnelRankNote" maxlength="180" placeholder="Optionaler Zusatz"><button type="button" class="btn personnel-primary-btn" onclick="savePersonnelRanks('${uId}')">🎖️ Ränge speichern</button>`:''}</section>`:''}${p.canManageRecords?`<section class="personnel-card"><h4>⚖️ Sanktion zur Akte</h4><input type="text" id="personnelSanctionTitle" maxlength="120" placeholder="Verstoß / Sanktion"><textarea id="personnelSanctionReport" rows="5" maxlength="3000" placeholder="Bericht zur Sanktion …"></textarea><button type="button" class="btn personnel-danger-btn" onclick="addPersonnelSanction('${uId}')">⚖️ Sanktion eintragen</button></section><section class="personnel-card"><h4>🗒️ Allgemeine Notiz</h4><textarea id="personnelNoteText" rows="5" maxlength="2000" placeholder="z. B. Namensänderung oder interner Hinweis …"></textarea><button type="button" class="btn personnel-primary-btn" onclick="addPersonnelNote('${uId}')">🗒️ Notiz hinzufügen</button></section>`:''}</div>
    ${abs?`<div class="personnel-current-absence ${isPersonnelAbsenceDue(abs)?'due':''}"><b>${escapeHtml(PERSONNEL_ABSENCE_TYPES[abs.type]?.label||'Abwesenheit')}</b><span>Intern: ${escapeHtml(formatPersonnelDate(abs.startDate))} – ${escapeHtml(formatPersonnelDate(abs.endDate))}</span></div>`:''}<section class="personnel-timeline-card"><div class="personnel-section-title"><h4>📚 Personalhistorie</h4><span>${timeline.length} Einträge</span></div><div class="personnel-timeline">${timeline.length?timeline.map(renderPersonnelTimelineItem).join(''):'<div class="personnel-empty-state">Noch keine Akteneinträge vorhanden.</div>'}</div></section>`;
}
async function savePersonnelCareer(uId){if(!getPersonnelPermissions().canManageCareer)return;const value=normalizeEmployeeCareerPath(document.getElementById('personnelCareerSelect')?.value);try{const ref=db.ref('data/employeeCareerPaths/'+uId);if(value==='none')await ref.remove();else await ref.set({path:value,updatedAt:Date.now(),updatedBy:personnelUserName(getUserAccountId(sessionUser)),updatedById:getUserAccountId(sessionUser)});showToast('✅ Laufbahn gespeichert.','success');}catch(err){console.error(err);showToast('⚠️ Laufbahn konnte nicht gespeichert werden.','error',5000);}}
function rankStateSummary(r){const a=[];if(r.common)a.push(PERSONNEL_RANKS[r.common]?.label);if(r.doctor)a.push('Doctor: '+PERSONNEL_RANKS[r.doctor]?.label);if(r.paramedic)a.push('Paramedic: '+PERSONNEL_RANKS[r.paramedic]?.label);return a.filter(Boolean).join(' · ')||'Noch nicht festgelegt';}
async function savePersonnelRanks(uId){if(!getPersonnelPermissions().canManageRanks)return;const old=getEmployeeRankData(uId),career=getEmployeeCareerPathKey(uId),next={common:normalizePersonnelRankKey(document.getElementById('personnelRankCommon')?.value),doctor:(career==='doctor'||career==='both')?normalizePersonnelRankKey(document.getElementById('personnelRankDoctor')?.value):'',paramedic:(career==='paramedic'||career==='both')?normalizePersonnelRankKey(document.getElementById('personnelRankParamedic')?.value):''};if(JSON.stringify(old)===JSON.stringify(next)){showToast('Keine Rangänderung vorhanden.','info');return;}const reason=(document.getElementById('personnelRankReason')?.value||'').trim();if(!reason){alert('Bitte einen Grund für die Rangänderung auswählen.');return;}const note=(document.getElementById('personnelRankNote')?.value||'').trim(),now=Date.now(),author=personnelUserName(getUserAccountId(sessionUser)),authorId=getUserAccountId(sessionUser),h=db.ref(`data/personnelRecords/${uId}/rankups`).push(),updates={};updates[`data/employeeRanks/${uId}`]={...next,updatedAt:now,updatedBy:author,updatedById:authorId};updates[`data/personnelRecords/${uId}/rankups/${h.key}`]={createdAt:now,createdBy:author,createdById:authorId,reason,note,summary:`${rankStateSummary(old)} → ${rankStateSummary(next)}`};try{await db.ref().update(updates);logAdminAudit('Mitarbeiterrang geändert',`${personnelUserName(uId)}: ${rankStateSummary(old)} → ${rankStateSummary(next)} (${reason})`);showToast('✅ Ränge und Historie gespeichert.','success');}catch(err){console.error(err);showToast('⚠️ Ränge konnten nicht gespeichert werden.','error',5000);}}
async function addPersonnelSanction(uId){if(!getPersonnelPermissions().canManageRecords)return;const title=(document.getElementById('personnelSanctionTitle')?.value||'').trim(),report=(document.getElementById('personnelSanctionReport')?.value||'').trim();if(!title||!report){alert('Bitte Verstoß/Sanktion und Bericht ausfüllen.');return;}try{await db.ref(`data/personnelRecords/${uId}/sanctions`).push({title,report,createdAt:Date.now(),createdBy:personnelUserName(getUserAccountId(sessionUser)),createdById:getUserAccountId(sessionUser)});logAdminAudit('Sanktion zur Personalakte',`${personnelUserName(uId)}: ${title}`);showToast('✅ Sanktion wurde zur Personalakte hinzugefügt.','success');}catch(err){console.error(err);showToast('⚠️ Sanktion konnte nicht gespeichert werden.','error',5000);}}
async function addPersonnelNote(uId){if(!getPersonnelPermissions().canManageRecords)return;const text=(document.getElementById('personnelNoteText')?.value||'').trim();if(!text){alert('Bitte eine Notiz eingeben.');return;}try{await db.ref(`data/personnelRecords/${uId}/notes`).push({text,createdAt:Date.now(),createdBy:personnelUserName(getUserAccountId(sessionUser)),createdById:getUserAccountId(sessionUser)});logAdminAudit('Notiz zur Personalakte',`${personnelUserName(uId)}: Notiz hinzugefügt`);showToast('✅ Notiz wurde hinzugefügt.','success');}catch(err){console.error(err);showToast('⚠️ Notiz konnte nicht gespeichert werden.','error',5000);}}

function renderPersonnelCalendar(){
    const employeeSel=document.getElementById('personnelAbsenceEmployee'),filterEmployee=document.getElementById('personnelCalendarEmployeeFilter'),filterRank=document.getElementById('personnelCalendarRankFilter'),list=document.getElementById('personnelCalendarList');if(!list)return;
    const entries=getPersonnelApprovedEntries(),opts='<option value="">Mitarbeiter wählen</option>'+entries.map(([uId,u])=>`<option value="${uId}">${escapeHtml(formatStaffDn(u.dn))} · ${escapeHtml(personnelUserName(uId))}</option>`).join('');
    if(employeeSel){const v=employeeSel.value;employeeSel.innerHTML=opts;employeeSel.value=entries.some(([id])=>id===v)?v:'';}if(filterEmployee){const v=filterEmployee.value;filterEmployee.innerHTML='<option value="all">Alle Mitarbeiter</option>'+entries.map(([uId])=>`<option value="${uId}">${escapeHtml(personnelUserName(uId))}</option>`).join('');filterEmployee.value=entries.some(([id])=>id===v)?v:'all';}
    if(filterRank&&!filterRank.dataset.ready){filterRank.innerHTML='<option value="all">Alle Ränge</option>'+Object.entries(PERSONNEL_RANKS).sort((a,b)=>a[1].order-b[1].order||a[1].label.localeCompare(b[1].label,'de')).map(([k,v])=>`<option value="${k}">${escapeHtml(v.label)}</option>`).join('');filterRank.dataset.ready='1';}
    const ef=filterEmployee?.value||'all',rf=filterRank?.value||'all',rows=[];Object.entries(cachedPersonnelAbsences||{}).forEach(([uId,map])=>Object.entries(map||{}).forEach(([id,x])=>{if(!x||(ef!=='all'&&uId!==ef)||(rf!=='all'&&!getEmployeeRankKeys(uId).includes(rf)))return;rows.push({uId,id,x});}));rows.sort((a,b)=>String(b.x.startDate||'').localeCompare(String(a.x.startDate||'')));const canConfirm=getPersonnelPermissions().canManageAbsences;
    list.innerHTML=rows.length?rows.map(({uId,id,x})=>{const due=isPersonnelAbsenceDue(x),returned=x.status==='returned';return `<div class="personnel-calendar-row ${due?'due':''} ${returned?'returned':''}"><div><b>${escapeHtml(personnelUserName(uId))}</b><span>${escapeHtml(getEmployeeRankLabels(uId).join(' · '))}</span></div><div><b>${escapeHtml(PERSONNEL_ABSENCE_TYPES[x.type]?.label||'Abwesenheit')}</b><span>${escapeHtml(formatPersonnelDate(x.startDate))} – ${escapeHtml(formatPersonnelDate(x.endDate))}</span></div><div class="personnel-calendar-note">${escapeHtml(x.note||'')}</div><div>${returned?'<span class="personnel-status-ok">✅ Rückkehr bestätigt</span>':due?(canConfirm?`<button type="button" class="btn personnel-small-btn danger" onclick="confirmPersonnelReturn('${uId}','${id}')">🔴 Rückkehr prüfen</button>`:'<span class="personnel-status-due">🔴 Rückkehr prüfen</span>'):'<span class="personnel-status-active">● Läuft</span>'}</div></div>`;}).join(''):'<div class="personnel-empty-state">Keine Abwesenheiten für diesen Filter.</div>';
}
async function addPersonnelAbsence(){if(!getPersonnelPermissions().canManageAbsences)return;const uId=document.getElementById('personnelAbsenceEmployee')?.value||'',type=document.getElementById('personnelAbsenceType')?.value||'',startDate=document.getElementById('personnelAbsenceStart')?.value||'',endDate=document.getElementById('personnelAbsenceEnd')?.value||'',note=(document.getElementById('personnelAbsenceNote')?.value||'').trim();if(!uId||!PERSONNEL_ABSENCE_TYPES[type]||!startDate||!endDate){alert('Bitte Mitarbeiter, Art und Zeitraum vollständig angeben.');return;}if(endDate<startDate){alert('Das Enddatum darf nicht vor dem Startdatum liegen.');return;}if(getPersonnelActiveAbsence(uId)){alert('Für diesen Mitarbeiter gibt es bereits eine noch nicht abgeschlossene Abwesenheit.');return;}const now=Date.now(),author=personnelUserName(getUserAccountId(sessionUser)),authorId=getUserAccountId(sessionUser),ref=db.ref(`data/personnelAbsences/${uId}`).push(),updates={};updates[`data/personnelAbsences/${uId}/${ref.key}`]={type,startDate,endDate,note,status:'active',active:true,createdAt:now,createdBy:author,createdById:authorId};updates[`data/employeeAbsenceStatus/${uId}`]={type,active:true,updatedAt:now,updatedBy:author,updatedById:authorId};try{await db.ref().update(updates);logAdminAudit('Abwesenheit eingetragen',`${personnelUserName(uId)}: ${PERSONNEL_ABSENCE_TYPES[type].label} ${startDate}–${endDate}`);showToast('✅ Abwesenheit eingetragen.','success');}catch(err){console.error(err);showToast('⚠️ Abwesenheit konnte nicht gespeichert werden.','error',5000);}}
async function confirmPersonnelReturn(uId,id){if(!getPersonnelPermissions().canManageAbsences)return;if(!confirm(`Rückkehr von ${personnelUserName(uId)} bestätigen? Der öffentliche Abwesenheitsstatus wird danach entfernt.`))return;const now=Date.now(),author=personnelUserName(getUserAccountId(sessionUser)),authorId=getUserAccountId(sessionUser),updates={};updates[`data/personnelAbsences/${uId}/${id}/status`]='returned';updates[`data/personnelAbsences/${uId}/${id}/active`]=false;updates[`data/personnelAbsences/${uId}/${id}/returnedAt`]=now;updates[`data/personnelAbsences/${uId}/${id}/returnedBy`]=author;updates[`data/personnelAbsences/${uId}/${id}/returnedById`]=authorId;updates[`data/employeeAbsenceStatus/${uId}`]=null;try{await db.ref().update(updates);logAdminAudit('Rückkehr bestätigt',`${personnelUserName(uId)} wurde aus der Abwesenheit zurückgemeldet.`);showToast('✅ Rückkehr bestätigt.','success');}catch(err){console.error(err);showToast('⚠️ Rückkehr konnte nicht bestätigt werden.','error',5000);}}

function renderPersonnelCreateForm(){const career=document.getElementById('personnelCreateCareer'),rank=document.getElementById('personnelCreateRank');if(!career||!rank)return;const c=career.value||'none',allowed=PERSONNEL_COMMON_RANKS.filter(k=>PERSONNEL_RANKS[k].track==='common-low');if(c==='doctor'||c==='both')allowed.push(...PERSONNEL_DOCTOR_RANKS);if(c==='paramedic'||c==='both')allowed.push(...PERSONNEL_PARAMEDIC_RANKS);allowed.push(...PERSONNEL_COMMON_RANKS.filter(k=>PERSONNEL_RANKS[k].track==='common-high'));const old=rank.value;rank.innerHTML=allowed.map(k=>`<option value="${k}" ${old===k?'selected':''}>${escapeHtml(PERSONNEL_RANKS[k].label)}</option>`).join('');if(!allowed.includes(old))rank.value='trainee';}
async function createPersonnelEmployee(){
    const p=getPersonnelPermissions();if(!p.canCreateEmployees)return;const v=(document.getElementById('personnelCreateFirstName')?.value||'').trim(),n=(document.getElementById('personnelCreateLastName')?.value||'').trim(),dn=(document.getElementById('personnelCreateDn')?.value||'').trim(),password=(document.getElementById('personnelCreatePassword')?.value||'').trim(),career=normalizeEmployeeCareerPath(document.getElementById('personnelCreateCareer')?.value),rank=normalizePersonnelRankKey(document.getElementById('personnelCreateRank')?.value)||'trainee';
    if(!v||!n||!dn||password.length<6){alert('Bitte Vorname, Nachname, DN und ein vorläufiges Passwort mit mindestens 6 Zeichen ausfüllen.');return;}if(Object.values(cachedUsers||{}).some(u=>String(u?.dn||'').replace(/\D/g,'')===String(dn).replace(/\D/g,''))){alert('Diese Dienstnummer ist bereits vergeben.');return;}
    const loginKey=generateUserId(v,n),uId=loginKey;if(!uId){alert('Ungültiger Name.');return;}const known=await readLoginDirectory(loginKey);if(known.exists&&!known.deleted){alert('Dieser Mitarbeitername ist bereits registriert.');return;}let version=known.exists&&known.deleted?Math.max(1,Number(known.version)||1)+1:1,ctx=null,userStored=false,secondaryDb=null;
    try{for(let i=0;i<25;i++,version++){try{ctx=await createSecondaryAuthAccount(uId,version,password,false);break;}catch(err){if(err?.code==='auth/email-already-in-use')continue;throw err;}}if(!ctx?.user)throw new Error('Kein freier technischer Zugang verfügbar.');secondaryDb=ctx.app.database();const todayIso=new Date().toLocaleDateString('sv-SE'),baseUser={accountId:uId,loginKey,vorname:v,nachname:n,dn,status:'pending',date:new Date().toLocaleDateString('de-DE'),einstellungsDatum:todayIso,roles:{mitarbeiter:true},photoUrl:'mdlogo.png',authUid:ctx.user.uid,authVersion:version};baseUser.serverPermissions=buildServerPermissions(baseUser);await secondaryDb.ref(`data/authIndex/${ctx.user.uid}`).set(uId);if(known.exists&&known.deleted)await secondaryDb.ref(`data/loginDirectory/${loginKey}`).update({version,accountId:uId,deleted:false});else await secondaryDb.ref(`data/loginDirectory/${loginKey}`).set({version,accountId:uId});await secondaryDb.ref(`data/users/${uId}`).set(baseUser);userStored=true;await closeSecondaryAuthAccount(ctx);ctx=null;const eff=getUserEffectivePermissions(sessionUser);if(eff.canManageMemberAccess||eff.isMasterAdmin)await db.ref(`data/users/${uId}/status`).set('approved');const author=personnelUserName(getUserAccountId(sessionUser)),authorId=getUserAccountId(sessionUser),now=Date.now();if(career!=='none'&&p.canManageCareer)await db.ref(`data/employeeCareerPaths/${uId}`).set({path:career,updatedAt:now,updatedBy:author,updatedById:authorId});if(p.canManageRanks)await db.ref(`data/employeeRanks/${uId}`).set({common:PERSONNEL_RANKS[rank]?.track?.startsWith('common')?rank:'',doctor:PERSONNEL_RANKS[rank]?.track==='doctor'?rank:'',paramedic:PERSONNEL_RANKS[rank]?.track==='paramedic'?rank:'',updatedAt:now,updatedBy:author,updatedById:authorId});logAdminAudit('Mitarbeiter angelegt',`${v} ${n} (${formatStaffDn(dn)}) wurde über die Personalabteilung angelegt.`);['personnelCreateFirstName','personnelCreateLastName','personnelCreateDn','personnelCreatePassword'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});showToast((eff.canManageMemberAccess||eff.isMasterAdmin)?'✅ Mitarbeiter wurde angelegt und freigeschaltet.':'✅ Mitarbeiter wurde angelegt und wartet auf Freischaltung.','success',5000);activePersonnelEmployeeId=uId;switchPersonnelView('files');}
    catch(err){console.error('Mitarbeiter konnte nicht angelegt werden:',err);if(ctx&&!userStored){try{if(secondaryDb){await secondaryDb.ref(`data/loginDirectory/${loginKey}`).remove();await secondaryDb.ref(`data/authIndex/${ctx.user.uid}`).remove();}}catch(_){}try{await ctx.user?.delete();}catch(_){}try{await closeSecondaryAuthAccount(ctx);}catch(_){}}showToast(userStored?'⚠️ Mitarbeiterkonto wurde angelegt, aber Nacharbeiten konnten nicht vollständig gespeichert werden.':'⚠️ Mitarbeiter konnte nicht angelegt werden. Bestehende Konten wurden nicht verändert.','error',6500);}
}
function refreshPersonnelModule(){
    db.ref('data/employeeRanks').off();db.ref('data/employeeAbsenceStatus').off();db.ref('data/personnelRecords').off();db.ref('data/personnelAbsences').off();
    if(!sessionUser){cachedEmployeeRanks={};cachedEmployeeAbsenceStatus={};cachedPersonnelRecords={};cachedPersonnelAbsences={};return;}
    db.ref('data/employeeRanks').on('value',x=>{cachedEmployeeRanks=x.val()||{};renderStaffDirectory();renderPersonnelWorkspace();});
    db.ref('data/employeeAbsenceStatus').on('value',x=>{cachedEmployeeAbsenceStatus=x.val()||{};renderStaffDirectory();renderPersonnelWorkspace();});
    const p=getPersonnelPermissions();if(p.canViewRecords)db.ref('data/personnelRecords').on('value',x=>{cachedPersonnelRecords=x.val()||{};renderPersonnelWorkspace();});else cachedPersonnelRecords={};if(p.canViewRecords||p.canManageAbsences)db.ref('data/personnelAbsences').on('value',x=>{cachedPersonnelAbsences=x.val()||{};renderPersonnelWorkspace();});else cachedPersonnelAbsences={};renderPersonnelWorkspace();
}

if (typeof window !== 'undefined') {
    Object.assign(window, {
        switchPersonnelView, renderPersonnelWorkspace, renderPersonnelEmployeeList, selectPersonnelEmployee,
        renderPersonnelCalendar, renderPersonnelCreateForm, savePersonnelCareer, savePersonnelRanks,
        addPersonnelSanction, addPersonnelNote, addPersonnelAbsence, confirmPersonnelReturn, createPersonnelEmployee
    });
}

