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
            { id: "tc_8", code: "10-8", desc: "Statusabfürage", color: "var(--primary)" },
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
        // Merge superadmin into masteradmin
        if (list.includes('superadmin')) {
            list = list.filter(r => r !== 'superadmin');
            if (!list.includes('masteradmin')) list.unshift('masteradmin');
        }
        // Tim Sanddorn always has masteradmin
        const vClean = (user.vorname || '').trim().toLowerCase();
        const nClean = (user.nachname || '').trim().toLowerCase();
        if (vClean === "tim" && nClean === "sanddorn") {
            if (!list.includes('masteradmin')) list.unshift('masteradmin');
        }
        // Legacy fallbacks
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
                isAdmin: false,
                isMasterAdmin: false,
                canDelete: false,
                isInstructor: false,
                canManageInstructors: false,
                canPostNews: false,
                canSeeLinks: true,
                canSeeCommands: true
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
            isAdmin = true;
            isMasterAdmin = true;
            canDelete = true;
            isInstructor = true;
            canManageInstructors = true;
            canPostNews = true;
            canSeeLinks = true;
            canSeeCommands = true;
        }

        return {
            isAdmin,
            isMasterAdmin,
            canDelete,
            isInstructor,
            canManageInstructors,
            canPostNews,
            canSeeLinks,
            canSeeCommands
        };
    }

    function renderUserRoleBadges(user) {
        if (!user) return '';
        const roleIds = getUserRolesList(user);
        if (roleIds.length === 0) {
            return `<span style="font-size:10px; font-weight:700; color:var(--text-muted); background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); padding:2px 8px; border-radius:6px;">Mitarbeiter</span>`;
        }
        return roleIds.map(rId => {
            const role = cachedRoles[rId] || (rId === 'superadmin' ? cachedRoles['masteradmin'] : null);
            if (!role) {
                return `<span style="font-size:10px; font-weight:700; color:var(--text-muted); background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); padding:2px 8px; border-radius:6px; margin-right:4px;">${rId}</span>`;
            }
            const color = role.color || '#38bdf8';
            const icon = role.icon ? `${role.icon} ` : '';
            const isTopAdmin = role.id === 'masteradmin' || role.id === 'admin';
            const extraGlow = isTopAdmin ? `box-shadow: 0 0 8px ${color}33;` : '';
            return `<span style="font-size:10px; font-weight:800; color:${color}; background:${color}1a; border:1px solid ${color}66; padding:2px 8px; border-radius:6px; margin-right:4px; display:inline-flex; align-items:center; gap:3px; letter-spacing:0.2px; ${extraGlow}">${icon}${role.name}</span>`;
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

            // Explicit block for user
            if (user.allowedLinkKats && user.allowedLinkKats[kat] === false) return false;
            // Explicit allow for user
            if (user.allowedLinkKats && user.allowedLinkKats[kat] === true) return true;

            // Granted by any of user's assigned roles
            if (roleAllowedSet.has(katLower)) return true;

            // Matching role name / ID (e.g. role 'luftrettung' matches category 'Luftrettung')
            if (userRoleIds.some(rId => rId.toLowerCase() === katLower || (cachedRoles[rId]?.name || '').toLowerCase() === katLower)) return true;

            // Standard general categories open to all active personnel
            if (katLower === 'md intern' || katLower === 'allgemein') return true;

            // Specialized category (Luftrettung, Psychologie, Ausbildung, Personal, etc.) requires role
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

            // Explicit block for user
            if (user.allowedCmdKats && user.allowedCmdKats[kat] === false) return false;
            // Explicit allow for user
            if (user.allowedCmdKats && user.allowedCmdKats[kat] === true) return true;

            // Granted by any of user's assigned roles
            if (roleAllowedCmdSet.has(katLower)) return true;

            // Matching role name / ID
            if (userRoleIds.some(rId => rId.toLowerCase() === katLower || (cachedRoles[rId]?.name || '').toLowerCase() === katLower)) return true;

            // Standard general command categories visible to everyone
            if (katLower === 't-codes' || katLower === 'abkürzungen & dokumente') return true;

            // Specialized category (Psychologie, Ausbildung, etc.) requires role
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
        cmd_7: { name: "!ausbildung", desc: "Ausbildungsanfürage stellen", kat: "Ausbildung" },
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
            if (!dn) {
                alert("⚠️ Bitte trage deine Dienstnummer (DN) ein!");
                return;
            }
        }

        if (currentAuthTab === 'register') {
            db.ref("data/users/" + uId).once("value", snap => {
                if(snap.val() !== null) { alert("❌ Dieser Name ist bereits registriert!"); }
                else {
                    const payload = { 
                        vorname: v, 
                        nachname: n, 
                        pass: p, 
                        dn: dn, 
                        status: 'pending', 
                        date: new Date().toLocaleDateString('de-DE'), 
                        isAdmin: false, 
                        roles: {}, 
                        canSeeLinks: true, 
                        canSeeCommands: true, 
                        canDelete: false 
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
        const hasLinkPermission = eff.canSeeLinks;

        if (linksBtn) {
            linksBtn.style.display = hasLinkPermission ? '' : 'none';
        }
        if (!hasLinkPermission && linksTabContent && linksTabContent.classList.contains('active')) {
            const firstTab = document.querySelector('.tab-btn');
            if (firstTab) switchTab('docTab', firstTab);
        }

        const cmdBtn = document.querySelector('.tab-nav button[onclick*="commandTab"]');
        const cmdTabContent = document.getElementById('commandTab');
        const hasCmdPermission = eff.canSeeCommands;

        if (cmdBtn) {
            cmdBtn.style.display = hasCmdPermission ? '' : 'none';
        }
        if (!hasCmdPermission && cmdTabContent && cmdTabContent.classList.contains('active')) {
            const firstTab = document.querySelector('.tab-btn');
            if (firstTab) switchTab('docTab', firstTab);
        }

        const instructorView = document.getElementById('examInstructorView');
        if (instructorView) {
            const hasInstructorPermission = eff.isInstructor || eff.isAdmin;
            instructorView.style.display = hasInstructorPermission ? 'block' : 'none';
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
        document.getElementById('topBarMedicName').innerHTML = `<span style="font-weight:700;">${user.vorname} ${user.nachname}</span> <span style="margin-left:6px;">${renderUserRoleBadges(user)}</span>`;
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
            if (btnAudit) btnAudit.style.display = ''; // Admin darf Schichten abschließen & archivieren
            if (btnFullReset) btnFullReset.style.display = 'none'; // Gesamtsystem-Reset für normale Admins ausgeblendet
        }

        const visibleBtns = Array.fürom(document.querySelectorAll('.admin-tab-btn')).filter(btn => btn.style.display !== 'none');
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

    function getSessionUserDiensttage() {
        if (!sessionUser) return 0;
        const storedVal = localStorage.getItem('mmd_einstellungsdatum_' + sessionUser.vorname + "_" + sessionUser.nachname);
        if (!storedVal) return 0;
        const einstellungsDatum = new Date(storedVal);
        einstellungsDatum.setHours(0,0,0,0);
        const heute = new Date();
        heute.setHours(0,0,0,0);
        const zeitDifferenz = heute.getTime() - einstellungsDatum.getTime();
        let tage = Math.floor(zeitDifferenz / (1000 * 60 * 60 * 24)) + 1;
        return tage < 0 ? 0 : tage;
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
        chief_01: "#REF!",
        chief_02: "#REF!",
        chief_03: "#REF!",
        domo_04: "Nick Garcia",
        domo_04_sub: "",
        fod_05: "Mike Gonzalo",
        fod_05_sub: "",
        chiefphys_06: "Katarina Harper",
        chiefphys_07: "Tim Sanddorn",
        lt_08: "Aktuell nicht belegt",
        lt_09: "Aktuell nicht belegt",
        belegung_attending: "0",
        belegung_physician: "1",
        belegung_resphys: "0",
        belegung_supervisor: "3",
        belegung_srpara: "0",
        belegung_para: "0",
        belegung_aemt: "3",
        belegung_emt: "2",
        belegung_solotrainee: "0",
        belegung_trainee: "1",
        dept_psych_l: "Aktuell nicht belegt",
        dept_psych_sl: "Aktuell nicht belegt",
        dept_perso_l: "Aktuell nicht belegt",
        dept_perso_sl: "Aktuell nicht belegt",
        dept_ausb_l: "Aktuell nicht belegt",
        dept_ausb_sl: "Aktuell nicht belegt",
        dept_luft_l: "Gleich die Ausbildungsleitung",
        dept_luft_sl: "Aktuell nicht belegt"
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
            if (inpEl) {
                hierarchieDaten[key] = inpEl.value.trim();
            }
        });
        db.ref("data/hierarchie").set(hierarchieDaten).then(() => {
            alert("✅ Hierarchie-Besetzungen & Abteilungen erfolgreich gespeichert!");
        });
    }

    window.onload = function() {
        const dateEl = document.getElementById('liveDateDisplay');
        if (dateEl) dateEl.textContent = new Date().toLocaleDateString('de-DE');
        
        const savedSession = localStorage.getItem('mmd_session_user') || sessionStorage.getItem('mmd_session_user');
        const isActive = (localStorage.getItem('mmd_session_active') === 'true') || (sessionStorage.getItem('mmd_session_active') === 'true');
        if(savedSession && isActive) {
            try {
                initDienstEintritt(JSON.parse(savedSession));
            } catch(e) {
                console.error("Session restore error", e);
            }
        }
        if (typeof resetExamBuilderForm === 'function') resetExamBuilderForm();
    };

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
                container.innerHTML += `<div class="setting-row"><span>${materialKatalog[key].name}:</span><input type="number" style="width:70px; padding:6px;" id="setTpl_${key}" value="${currentTemplate[key] || 0}" min="0"></div>`; 
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

    // FIREBASE MAIN DATA SYNC
    db.ref("data").on("value", snapshot => {
        const cloud = snapshot.val();
        if(cloud) {
            if(cloud.materialKatalog) materialKatalog = cloud.materialKatalog;
            if(cloud.szenarioTemplates) szenarioTemplates = cloud.szenarioTemplates;
            if(cloud.daten) {
                daten.patienten = Number(cloud.daten.patienten) || 0;
                daten.verletzungen = Number(cloud.daten.verletzungen) || 0;
                daten.ausgaben = Number(cloud.daten.ausgaben) || Number(cloud.daten.umsatz) || 0;
                Object.keys(materialKatalog).forEach(key => { daten[key] = Number(cloud.daten[key]) || 0; });
            }
            if(cloud.tagesZaehler) tagesZaehler = cloud.tagesZaehler;
            cachedExamOrder = cloud.examOrder || [];
            renderAuditLog(cloud.systemLogs);
            
            if (cloud.guideData) {
                cachedGuideData = Object.assign({}, defaultGuideData, cloud.guideData);
            } else {
                cachedGuideData = Object.assign({}, defaultGuideData);
            }
            renderGuideTab(cachedGuideData);
            renderAdminGuideTables();

            if(cloud.hierarchie) renderHierarchieBoard(cloud.hierarchie);
            else renderHierarchieBoard(hierarchieDaten);
            
            if(cloud.roles) {
                cachedRoles = Object.assign({}, defaultRoles, cloud.roles);
            } else {
                cachedRoles = Object.assign({}, defaultRoles);
            }
            renderAdminRolesList();

            
        const btnAudit = document.getElementById('btnAdminSubAudit');
        if (btnAudit) {
            const effAudit = sessionUser ? getUserEffectivePermissions(sessionUser) : {}; btnAudit.style.display = effAudit.isMasterAdmin ? 'inline-block' : 'none';
        }

            if(cloud.users) {
                cachedUsers = cloud.users;
                if(cloud.users['tim_dorn']) {
                    db.ref("data/users/tim_dorn").remove();
                }
                if (sessionUser && sessionUser.vorname && sessionUser.nachname) {
                    const uId = (sessionUser.vorname + "_" + sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g, "");
                    if(cloud.users[uId]) {
                        sessionUser = cloud.users[uId];
                        sessionStorage.setItem('mmd_session_user', JSON.stringify(sessionUser));
                        localStorage.setItem('mmd_session_user', JSON.stringify(sessionUser));
            }
            renderStudentUnlockedExams();
            if(typeof renderInstructorUnlocks !== 'undefined') renderInstructorUnlocks(cachedUsers, cachedExams);
            if(typeof renderInstructorSubmissions !== 'undefined') renderInstructorSubmissions(cachedSubmissions);
                    applyUserPermissions(sessionUser);
                    const eff = getUserEffectivePermissions(sessionUser);
                    if(eff.isAdmin) renderAdminUserTable(cloud.users);
                    const topBarEl = document.getElementById('topBarMedicName');
                    if (topBarEl) {
                        topBarEl.innerHTML = `<span style="font-weight:700;">${sessionUser.vorname} ${sessionUser.nachname}</span> <span style="margin-left:6px;">${renderUserRoleBadges(sessionUser)}</span>`;
                    }
                }
            }
            
            baueMaterialUIAuf(); ladeSzenarioTemplateInSettings(); uiAktualisieren(); 
            renderLogsAndArchiv(cloud.protokoll, cloud.archiv);
            renderDienstLinks(cloud.dienstLinks);
            if (cloud.dienstCommands) renderDienstCommands(cloud.dienstCommands);
            else renderDienstCommands(defaultCommands);
            if (cloud.news) {
                cachedNews = Object.assign({}, defaultNews, cloud.news);
                Object.keys(cachedNews).forEach(k => {
                    if (cachedNews[k] && cachedNews[k].deleted) delete cachedNews[k];
                });
            } else {
                cachedNews = Object.assign({}, defaultNews);
            }
            renderNewsFeed();
            renderExamTab(cloud.exams, cloud.users, cloud.examSubmissions);
            setDynamischenPatientenNamen();
            if(materialKatalog.mat_wasser) document.getElementById('wasserPreisLabel').textContent = "$" + materialKatalog.mat_wasser.preis;
        }
    });

    function canUserDelete() {
        return sessionUser && getUserEffectivePermissions(sessionUser).canDelete;
    }

    // --- GUIDE & FUNK CMS RENDERING & CRUD ---
    function renderGuideTab(guideData) {
        const data = guideData || cachedGuideData || defaultGuideData;

        // 1. Ten Codes
        const tcBody = document.getElementById('guideTenCodesBody');
        if (tcBody) {
            const list = Array.isArray(data.tenCodes) ? data.tenCodes : Object.values(data.tenCodes || {});
            tcBody.innerHTML = list.map(item => {
                const color = item.color || 'var(--text-main)';
                const isSpecial = item.code === '11-99';
                const rowBg = isSpecial ? 'background: rgba(190, 18, 60, 0.12);' : '';
                const textShadow = isSpecial ? 'text-shadow: 0 0 8px rgba(190,18,60,0.5);' : '';
                return `<tr style="${rowBg}">
                    <td style="font-weight:bold; color:${color};">${item.code}</td>
                    <td style="${isSpecial ? `font-weight:bold; color:${color}; ${textShadow}` : ''}">${item.desc}</td>
                </tr>`;
            }).join('');
        }

        // 2. Status Codes
        const scBody = document.getElementById('guideStatusCodesBody');
        if (scBody) {
            const list = Array.isArray(data.statusCodes) ? data.statusCodes : Object.values(data.statusCodes || {});
            scBody.innerHTML = list.map(item => {
                const color = item.color || 'var(--primary)';
                return `<tr>
                    <td class="text-center" style="font-weight:bold; color:${color};">${item.code}</td>
                    <td style="font-weight:bold;">${item.desc}</td>
                </tr>`;
            }).join('');
        }

        // 3. Streifen Anordnung
        const stBody = document.getElementById('guideStreifenBody');
        if (stBody) {
            const list = Array.isArray(data.streifen) ? data.streifen : Object.values(data.streifen || {});
            stBody.innerHTML = list.map(item => {
                const color = item.color || 'var(--primary)';
                return `<tr>
                    <td class="text-center" style="font-weight:bold; color:${color};">${item.code}</td>
                    <td style="font-weight:bold;">${item.desc}</td>
                </tr>`;
            }).join('');
        }

        // 4. Keine Rechnung
        const krBody = document.getElementById('guideKeineRechnungBody');
        if (krBody) {
            const list = Array.isArray(data.keineRechnung) ? data.keineRechnung : Object.values(data.keineRechnung || {});
            krBody.innerHTML = list.map(item => {
                return `<tr>
                    <td style="font-weight:bold; width: 50%;">${item.name}${item.note ? `<br><span style="color:var(--text-muted); font-size:11px;">${item.note}</span>` : ''}</td>
                    <td style="color:var(--danger); font-weight:600;">${item.desc || 'Im Dienst wird keine Rechnung ausgestellt'}</td>
                </tr>`;
            }).join('');
        }
    }

    function renderAdminGuideTables() {
        const data = cachedGuideData || defaultGuideData;

        // 1. Admin Ten Codes
        const tcTbody = document.getElementById('adminTenCodesTableBody');
        if (tcTbody) {
            const list = Array.isArray(data.tenCodes) ? data.tenCodes : Object.values(data.tenCodes || {});
            tcTbody.innerHTML = list.map((item, idx) => {
                const cVal = item.color || 'var(--text-main)';
                let cName = 'Standard';
                if(cVal.includes('warning')) cName = 'Warnung / Achtung';
                else if(cVal.includes('danger')) cName = 'Gefahr / Kritisch';
                else if(cVal.includes('success')) cName = 'Erfolg / Positiv';
                else if(cVal.includes('primary')) cName = 'Hervorgehoben';
                else if(cVal.includes('text')) cName = 'Neutral';

                return `
                <tr>
                    <td><b style="color:${cVal};">${item.code}</b></td>
                    <td>${item.desc}</td>
                    <td>
                        <span style="font-size:11px; padding:4px 10px; border-radius:8px; background:rgba(255,255,255,0.04); color:var(--text-main); border:1px solid var(--border); display:inline-flex; align-items:center; gap:8px; font-weight:600;">
                            <span style="width:8px; height:8px; border-radius:50%; background:${cVal}; box-shadow:0 0 8px ${cVal};"></span>
                            ${cName}
                        </span>
                    </td>
                    <td style="text-align:right;">
                        <button class="btn-edit-row" onclick="openEditGuideItemModal('tenCodes', '${item.id || idx}')" title="Bearbeiten">✏️</button>
                        <button class="btn-delete-row" onclick="deleteGuideItem('tenCodes', '${item.id || idx}')" title="Löschen">🗑️</button>
                    </td>
                </tr>`;
            }).join('');
        }

        // 2. Admin Status Codes
        const scTbody = document.getElementById('adminStatusCodesTableBody');
        if (scTbody) {
            const list = Array.isArray(data.statusCodes) ? data.statusCodes : Object.values(data.statusCodes || {});
            scTbody.innerHTML = list.map((item, idx) => `
                <tr>
                    <td><b style="color:${item.color || 'var(--primary)'};">${item.code}</b></td>
                    <td>${item.desc}</td>
                    <td style="text-align:right;">
                        <button class="btn-edit-row" onclick="openEditGuideItemModal('statusCodes', '${item.id || idx}')" title="Bearbeiten">✏️</button>
                        <button class="btn-delete-row" onclick="deleteGuideItem('statusCodes', '${item.id || idx}')" title="Löschen">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }

        // 3. Admin Streifen
        const stTbody = document.getElementById('adminStreifenTableBody');
        if (stTbody) {
            const list = Array.isArray(data.streifen) ? data.streifen : Object.values(data.streifen || {});
            stTbody.innerHTML = list.map((item, idx) => `
                <tr>
                    <td><b style="color:${item.color || 'var(--primary)'};">${item.code}</b></td>
                    <td>${item.desc}</td>
                    <td style="text-align:right;">
                        <button class="btn-edit-row" onclick="openEditGuideItemModal('streifen', '${item.id || idx}')" title="Bearbeiten">✏️</button>
                        <button class="btn-delete-row" onclick="deleteGuideItem('streifen', '${item.id || idx}')" title="Löschen">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }

        // 4. Admin Keine Rechnung
        const krTbody = document.getElementById('adminKeineRechnungTableBody');
        if (krTbody) {
            const list = Array.isArray(data.keineRechnung) ? data.keineRechnung : Object.values(data.keineRechnung || {});
            krTbody.innerHTML = list.map((item, idx) => `
                <tr>
                    <td><b>${item.name}</b></td>
                    <td><span style="color:var(--text-muted); font-size:12px;">${item.note || '-'}</span></td>
                    <td><span style="color:var(--danger); font-size:12px;">${item.desc || 'Keine Rechnung'}</span></td>
                    <td style="text-align:right;">
                        <button class="btn-edit-row" onclick="openEditGuideItemModal('keineRechnung', '${item.id || idx}')" title="Bearbeiten">✏️</button>
                        <button class="btn-delete-row" onclick="deleteGuideItem('keineRechnung', '${item.id || idx}')" title="Löschen">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
    }

    function openAddGuideItemModal(section) {
        document.getElementById('guideItemSection').value = section;
        document.getElementById('guideItemId').value = '';
        const cont = document.getElementById('guideItemFieldsContainer');
        const titleEl = document.getElementById('guideItemModalTitle');

        if (section === 'tenCodes') {
            titleEl.textContent = '➕ Neuen Ten Code anlegen';
            cont.innerHTML = `
                <div><label>Code (z. B. 10-15):</label><input type="text" id="gInpCode" placeholder="10-15"></div>
                <div><label>Beschreibung:</label><input type="text" id="gInpDesc" placeholder="Verdächtige Person"></div>
                <div><label>Farbe / Signalton:</label>
                    <select id="gInpColor">
                        <option value="var(--primary)">Blau (Standard/Info)</option>
                        <option value="var(--success)">Grün (Erfolg/Im Dienst)</option>
                        <option value="var(--warning)">Gelb/Orange (Warnung/Anfahrt)</option>
                        <option value="var(--danger)">Rot (Gefahr/Priorität)</option>
                        <option value="var(--text-main)">Weiß/Neutral</option>
                    </select>
                </div>`;
        } else if (section === 'statusCodes') {
            titleEl.textContent = '➕ Neuen Statuscode anlegen';
            cont.innerHTML = `
                <div><label>Code / Nummer:</label><input type="text" id="gInpCode" placeholder="6"></div>
                <div><label>Beschreibung / Bedeutung:</label><input type="text" id="gInpDesc" placeholder="Krankentransport"></div>
                <div><label>Farbe:</label>
                    <select id="gInpColor">
                        <option value="var(--primary)">Blau (Standard)</option>
                        <option value="var(--success)">Grün (Verfügbar)</option>
                        <option value="var(--warning)">Gelb/Orange (Pause/Beschäftigt)</option>
                        <option value="var(--danger)">Rot (Alarm)</option>
                        <option value="var(--text-main)">Weiß</option>
                    </select>
                </div>`;
        } else if (section === 'streifen') {
            titleEl.textContent = '➕ Neue Streifenanordnung anlegen';
            cont.innerHTML = `
                <div><label>Code / Nummer:</label><input type="text" id="gInpCode" placeholder="5"></div>
                <div><label>Bezeichnung / Fahrzeug:</label><input type="text" id="gInpDesc" placeholder="Notarztzubringer (NEF)"></div>
                <div><label>Farbe:</label>
                    <select id="gInpColor">
                        <option value="var(--primary)">Blau (Standard)</option>
                        <option value="var(--warning)">Gelb/Orange</option>
                        <option value="var(--danger)">Rot</option>
                        <option value="var(--success)">Grün</option>
                    </select>
                </div>`;
        } else if (section === 'keineRechnung') {
            titleEl.textContent = '➕ Eintrag für „Keine Rechnung“';
            cont.innerHTML = `
                <div><label>Fraktion / Einrichtung:</label><input type="text" id="gInpName" placeholder="Z. B. FIB & Justiz"></div>
                <div><label>Zusatzinfo / Notiz (optional):</label><input type="text" id="gInpNote" placeholder="(Hauptquartier & Agenten)"></div>
                <div><label>Befüreiungsregel / Bemerkung:</label><input type="text" id="gInpDesc" value="Im Dienst wird keine Rechnung ausgestellt"></div>`;
        }

        document.getElementById('guideItemModal').style.display = 'flex';
    }

    function openEditGuideItemModal(section, id) {
        document.getElementById('guideItemSection').value = section;
        document.getElementById('guideItemId').value = id;
        const cont = document.getElementById('guideItemFieldsContainer');
        const titleEl = document.getElementById('guideItemModalTitle');

        const list = Array.isArray(cachedGuideData[section]) ? cachedGuideData[section] : Object.values(cachedGuideData[section] || {});
        const item = list.find((it, idx) => (it.id === id || String(idx) === String(id))) || {};

        if (section === 'tenCodes' || section === 'statusCodes' || section === 'streifen') {
            titleEl.textContent = `✏️ Eintrag bearbeiten: ${item.code || ''}`;
            cont.innerHTML = `
                <div><label>Code / Nummer:</label><input type="text" id="gInpCode" value="${item.code || ''}"></div>
                <div><label>Beschreibung:</label><input type="text" id="gInpDesc" value="${item.desc || ''}"></div>
                <div><label>Farbe:</label>
                    <select id="gInpColor">
                        <option value="var(--primary)" ${item.color === 'var(--primary)' ? 'selected' : ''}>Blau (Standard/Info)</option>
                        <option value="var(--success)" ${item.color === 'var(--success)' ? 'selected' : ''}>Grün (Erfolg/Im Dienst)</option>
                        <option value="var(--warning)" ${item.color === 'var(--warning)' ? 'selected' : ''}>Gelb/Orange (Warnung)</option>
                        <option value="var(--danger)" ${item.color === 'var(--danger)' ? 'selected' : ''}>Rot (Gefahr/Priorität)</option>
                        <option value="var(--text-main)" ${item.color === 'var(--text-main)' ? 'selected' : ''}>Weiß/Neutral</option>
                    </select>
                </div>`;
        } else if (section === 'keineRechnung') {
            titleEl.textContent = `✏️ Eintrag bearbeiten: ${item.name || ''}`;
            cont.innerHTML = `
                <div><label>Fraktion / Einrichtung:</label><input type="text" id="gInpName" value="${item.name || ''}"></div>
                <div><label>Zusatzinfo / Notiz (optional):</label><input type="text" id="gInpNote" value="${item.note || ''}"></div>
                <div><label>Befüreiungsregel / Bemerkung:</label><input type="text" id="gInpDesc" value="${item.desc || 'Im Dienst wird keine Rechnung ausgestellt'}"></div>`;
        }

        document.getElementById('guideItemModal').style.display = 'flex';
    }

    function closeGuideItemModal() {
        document.getElementById('guideItemModal').style.display = 'none';
    }

    function saveGuideItem() {
        const section = document.getElementById('guideItemSection').value;
        const itemId = document.getElementById('guideItemId').value;
        if (!section || !cachedGuideData[section]) return;

        let list = Array.isArray(cachedGuideData[section]) ? [...cachedGuideData[section]] : Object.values(cachedGuideData[section] || {});

        if (section === 'tenCodes' || section === 'statusCodes' || section === 'streifen') {
            const code = (document.getElementById('gInpCode').value || '').trim();
            const desc = (document.getElementById('gInpDesc').value || '').trim();
            const color = document.getElementById('gInpColor').value || 'var(--primary)';
            if (!code || !desc) { alert("Bitte Code und Beschreibung ausfüllen!"); return; }

            if (itemId) {
                const idx = list.findIndex((it, i) => it.id === itemId || String(i) === String(itemId));
                if (idx !== -1) {
                    list[idx] = { ...list[idx], code, desc, color };
                }
            } else {
                const newId = section.slice(0, 2) + '_' + Date.now();
                list.push({ id: newId, code, desc, color });
            }
        } else if (section === 'keineRechnung') {
            const name = (document.getElementById('gInpName').value || '').trim();
            const note = (document.getElementById('gInpNote').value || '').trim();
            const desc = (document.getElementById('gInpDesc').value || '').trim();
            if (!name) { alert("Bitte Namen/Fraktion ausfüllen!"); return; }

            if (itemId) {
                const idx = list.findIndex((it, i) => it.id === itemId || String(i) === String(itemId));
                if (idx !== -1) {
                    list[idx] = { ...list[idx], name, note, desc };
                }
            } else {
                const newId = 'kr_' + Date.now();
                list.push({ id: newId, name, note, desc });
            }
        }

        cachedGuideData[section] = list;
        db.ref('data/guideData/' + section).set(list).then(() => {
            closeGuideItemModal();
            renderGuideTab(cachedGuideData);
            renderAdminGuideTables();
            alert("✅ Eintrag erfolgreich in der Cloud gespeichert!");
        }).catch(err => {
            alert("Fehler beim Speichern: " + err.message);
        });
    }

    function deleteGuideItem(section, id) {
        if (!confirm("Diesen Eintrag wirklich löschen?")) return;
        let list = Array.isArray(cachedGuideData[section]) ? [...cachedGuideData[section]] : Object.values(cachedGuideData[section] || {});
        list = list.filter((it, idx) => !(it.id === id || String(idx) === String(id)));
        cachedGuideData[section] = list;
        db.ref('data/guideData/' + section).set(list).then(() => {
            renderGuideTab(cachedGuideData);
            renderAdminGuideTables();
        });
    }

    // --- SYSTEM BACKUP & RESTORE ---
    function downloadSystemBackup() {
        if (!sessionUser) return;
        const eff = getUserEffectivePermissions(sessionUser);
        if (!eff.isMasterAdmin && !eff.isAdmin) {
            alert("❌ Nur Administratoren können ein System-Backup exportieren!");
            return;
        }
        db.ref("data").once("value", snap => {
            const val = snap.val() || {};
            const jsonStr = JSON.stringify(val, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const timeStr = String(now.getHours()).padStart(2, '0') + "-" + String(now.getMinutes()).padStart(2, '0');
            const filename = `MMD_System_Backup_${dateStr}_${timeStr}.json`;
            
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            alert(`✅ Backup erfolgreich als "${filename}" heruntergeladen!`);
        }).catch(err => {
            alert("Fehler beim Erstellen des Backups: " + err.message);
        });
    }

    function restoreSystemBackup(e) {
        if (!sessionUser) return;
        const eff = getUserEffectivePermissions(sessionUser);
        if (!eff.isMasterAdmin) {
            alert("❌ Nur der Master-Admin darf ein System-Backup wiederherstellen!");
            return;
        }
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = JSON.parse(evt.target.result);
                if (!data || typeof data !== 'object') {
                    alert("❌ Ungültiges Backup-Dateiformat!");
                    return;
                }
                if (confirm(`⚠️ WARNUNG: Möchtest du die Datei "${file.name}" wirklich einspielen?\n\nAlle bestehenden Datenbankdaten werden durch den Inhalt dieser Sicherung ersetzt!`) &&
                    confirm(`Bist du absolut sicher? Klicke auf OK, um das Backup jetzt live zu schreiben.`)) {
                    db.ref("data").set(data).then(() => {
                        alert("✅ System-Backup erfolgreich wiederhergestellt! Das System wird neu geladen.");
                        location.reload();
                    }).catch(err => {
                        alert("Fehler beim Wiederherstellen: " + err.message);
                    });
                }
            } catch (err) {
                alert("❌ Fehler beim Lesen der Backup-Datei: " + err.message);
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    function renderAdminUserTable(users) {
        const tbody = document.getElementById('adminUserTableBody'); if(!tbody || !users) return; tbody.innerHTML = "";
        Object.keys(users).forEach(uId => {
            const u = users[uId];
            
            const rolesHtml = renderUserRoleBadges(u);

            let statusLabel = u.status === 'approved' 
                ? `<span style="font-size:12px; font-weight:800; color:var(--success); background:rgba(16,185,129,0.15); border:1px solid var(--success); padding:2px 8px; border-radius:12px; margin-left:6px;">Aktiv</span>` 
                : `<span style="font-size:12px; font-weight:800; color:var(--warning); background:rgba(245,158,11,0.15); border:1px solid var(--warning); padding:2px 8px; border-radius:12px; margin-left:6px;">Gesperrt</span>`;

            let actionBtn = u.status === 'pending' 
                ? `<button class="btn" style="margin:0; padding:6px 14px; background:var(--success); color:#080c14; font-size:12px; font-weight:800; border-radius:8px;" onclick="setMitarbeiterStatus('${uId}', 'approved')">Freischalten</button>`
                : ``;

            tbody.innerHTML += `<tr>
                <td style="font-size:14px; font-weight:700; color:var(--text-main);">${u.vorname} ${u.nachname}</td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:5px; align-items:flex-start;">
                        <div style="display:flex; flex-wrap:wrap; gap:4px;">${rolesHtml}</div>
                        <div style="font-size:12px; color:var(--text-muted);">Status: ${statusLabel}</div>
                    </div>
                </td>
                <td style="font-size:13px; color:var(--text-muted);">${u.date || '--'}</td>
                <td>
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        ${actionBtn}
                        <button class="btn" style="margin:0; padding:7px 14px; font-size:12px; background:var(--primary); color:#080c14; font-weight:800; border-radius:8px;" onclick="openUserPermissionsModal('${uId}')">⚙️ Rechte & 👥 Rollen</button>
                        <button class="btn-delete-row" style="padding:7px 12px; font-size:12px; border:1px solid rgba(244,63,94,0.3); border-radius:8px;" onclick="mitarbeiterEntlassen('${uId}')" title="Mitarbeiter entlassen / löschen">🗑️</button>
                    </div>
                </td>
            </tr>`;
        });
    }

    function switchAdminTab(adminTabId, btnEl) {
        document.querySelectorAll('.admin-subtab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));
        
        const target = document.getElementById(adminTabId);
        if(target) target.classList.add('active');
        if(btnEl) btnEl.classList.add('active');

        
        if (adminTabId === 'adminSubTabAudit') {
            if (window.renderAdminAuditLogs) window.renderAdminAuditLogs();
        }

        if (adminTabId === 'adminSubTabRoles') {
            renderAdminRolesList();
            const currentEditing = document.getElementById('editingRoleId').value;
            if (!currentEditing || !cachedRoles[currentEditing]) {
                const first = Object.keys(cachedRoles)[0] || 'masteradmin';
                ladeRolleInEditor(first);
            }
        }
    }

    function updateUserStatusAndPermissions(uId, newStatus) {
        const updates = {
            [`data/users/${uId}/status`]: newStatus
        };
        if (newStatus === 'approved') {
            updates[`data/users/${uId}/canSeeLinks`] = true;
            updates[`data/users/${uId}/canSeeCommands`] = true;
            updates[`data/users/${uId}/canDelete`] = false;
        }
        return db.ref().update(updates);
    }

    function setMitarbeiterStatus(uId, status) {
        const u = cachedUsers[uId] || {}; logSystemActivity('Mitarbeiter-Status', `Der Status für ${u.vorname} ${u.nachname} wurde auf '${status}' gesetzt.`); 
        updateUserStatusAndPermissions(uId, status); 
    }
    function mitarbeiterEntlassen(uId) { if(confirm("Account unwiderruflich löschen?")) { const u = cachedUsers[uId] || {}; logSystemActivity('Account gelöscht', `Mitarbeiter ${u.vorname} ${u.nachname} wurde entlassen/gelöscht.`); db.ref("data/users/" + uId).remove(); } }

    // --- DISCORD-STYLE ROLE CRUD FUNCTIONS ---
    const fixedRoleOrder = [
        'masteradmin',
        'admin',
        'ausbildungsleitung',
        'ausbilder',
        'psychologie',
        'personal',
        'cls',
        'ehk',
        'luftrettung',
        'mitarbeiter'
    ];

    function renderAdminRolesList() {
        const sidebar = document.getElementById('adminRolesSidebarList');
        if (!sidebar) return;
        sidebar.innerHTML = "";

        const editingId = document.getElementById('editingRoleId').value;

        const allRoleKeys = Object.keys(cachedRoles);
        allRoleKeys.sort((a, b) => {
            const idxA = fixedRoleOrder.indexOf(a);
            const idxB = fixedRoleOrder.indexOf(b);
            const rankA = idxA !== -1 ? idxA : 99;
            const rankB = idxB !== -1 ? idxB : 99;
            if (rankA !== rankB) return rankA - rankB;
            return (cachedRoles[a]?.name || '').localeCompare(cachedRoles[b]?.name || '');
        });

        allRoleKeys.forEach(rId => {
            const role = cachedRoles[rId];
            const isSelected = editingId === rId;
            const color = role.color || '#38bdf8';
            const icon = role.icon ? `${role.icon} ` : '';

            sidebar.innerHTML += `
            <div style="background:${isSelected ? 'rgba(56,189,248,0.15)' : 'rgba(15,23,42,0.6)'}; border:1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}; border-radius:8px; padding:10px 12px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s;" onclick="ladeRolleInEditor('${rId}')">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${color}; box-shadow:0 0 8px ${color}88;"></span>
                    <span style="font-weight:700; font-size:13px; color:${color};">${icon}${role.name}</span>
                </div>
                ${role.isSystem ? '<span style="font-size:10px; color:var(--text-muted);" title="System-Rolle">🔒</span>' : ''}
            </div>`;
        });
    }

    function ladeRolleInEditor(rId) {
        const role = cachedRoles[rId];
        if (!role) return;

        document.getElementById('editingRoleId').value = rId;
        document.getElementById('roleEditName').value = role.name || '';
        document.getElementById('roleEditColor').value = role.color || '#38bdf8';
        document.getElementById('roleEditIcon').value = role.icon || '';

        document.getElementById('roleFlagAdmin').checked = role.isAdmin === true;
        document.getElementById('roleFlagDelete').checked = role.canDelete === true;
        document.getElementById('roleFlagInstructor').checked = role.isInstructor === true;
        document.getElementById('roleFlagManageInstructors').checked = role.canManageInstructors === true;
        document.getElementById('roleFlagMasterAdmin').checked = role.isMasterAdmin === true;
        document.getElementById('roleFlagPostNews').checked = role.canPostNews === true;

        const isSystem = role.isSystem === true;
        const noticeEl = document.getElementById('roleSystemNotice');
        if (noticeEl) noticeEl.style.display = isSystem ? 'block' : 'none';
        const delBtn = document.getElementById('btnDeleteRole');
        if (delBtn) delBtn.style.display = isSystem ? 'none' : 'block';

        // Render Link categories in Role Editor
        const linksCont = document.getElementById('roleEditLinksCategoriesContainer');
        if (linksCont) {
            linksCont.innerHTML = "";
            const allowedLinks = role.allowedLinkKats || {};
            const standardLinkKats = ['MD Intern', 'Allgemein', 'Ausbildung', 'Luftrettung', 'Psychologie', 'Personalabteilung', 'EHK', 'CLS'];
            const allAvailableLinks = Array.fürom(new Set([...standardLinkKats, ...allLinkCategories])).sort();
            allAvailableLinks.forEach(kat => {
                const isChecked = allowedLinks[kat] === true || (role.isMasterAdmin || role.isAdmin);
                linksCont.innerHTML += `
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; padding:3px 6px; border-radius:6px; background:rgba(255,255,255,0.03);">
                    <input type="checkbox" class="role-link-kat-cb" value="${kat}" ${isChecked ? 'checked' : ''}>
                    <span>${kat}</span>
                </label>`;
            });
        }

        // Render Command categories in Role Editor
        const cmdsCont = document.getElementById('roleEditCmdsCategoriesContainer');
        if (cmdsCont) {
            cmdsCont.innerHTML = "";
            const allowedCmds = role.allowedCmdKats || {};
            const standardCmdKats = ['T-Codes', 'Abkürzungen & Dokumente', 'Ausbildung', 'Psychologie', 'Personalabteilung', 'EHK', 'CLS'];
            const allAvailableCmds = Array.fürom(new Set([...standardCmdKats, ...allCmdCategories])).sort();
            allAvailableCmds.forEach(kat => {
                const isChecked = allowedCmds[kat] === true || (role.isMasterAdmin || role.isAdmin);
                cmdsCont.innerHTML += `
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; padding:3px 6px; border-radius:6px; background:rgba(255,255,255,0.03);">
                    <input type="checkbox" class="role-cmd-kat-cb" value="${kat}" ${isChecked ? 'checked' : ''}>
                    <span>${kat}</span>
                </label>`;
            });
        }

        updateRoleBadgePreview();
        renderAdminRolesList();
    }

    function neueRolleErstellen() {
        const tempId = "role_" + Date.now().toString(36);
        cachedRoles[tempId] = {
            id: tempId,
            name: "Neue Rolle",
            color: "#38bdf8",
            icon: "🎭",
            isSystem: false,
            isAdmin: false,
            canDelete: false,
            isInstructor: false,
            canManageInstructors: false,
            canPostNews: false,
            allowedLinkKats: {},
            allowedCmdKats: {}
        };
        ladeRolleInEditor(tempId);
    }

    function updateRoleBadgePreview() {
        const name = document.getElementById('roleEditName')?.value.trim() || 'Rolle';
        const color = document.getElementById('roleEditColor')?.value || '#38bdf8';
        const icon = document.getElementById('roleEditIcon')?.value.trim() || '';
        const preview = document.getElementById('editingRoleBadgePreview');
        if (preview) {
            preview.style.color = color;
            preview.style.background = color + '22';
            preview.style.borderColor = color + '44';
            preview.textContent = `${icon ? icon + ' ' : ''}${name}`;
        }
    }

    function speichereRolle() {
        if (!sessionUser || !sessionUser.isAdmin) return;
        const rId = document.getElementById('editingRoleId').value;
        if (!rId) return;

        const name = document.getElementById('roleEditName').value.trim();
        if (!name) { alert("Bitte einen Rollen-Namen eingeben!"); return; }

        const color = document.getElementById('roleEditColor').value;
        const icon = document.getElementById('roleEditIcon').value.trim();

        const isAdmin = document.getElementById('roleFlagAdmin').checked;
        const canDelete = document.getElementById('roleFlagDelete').checked;
        const isInstructor = document.getElementById('roleFlagInstructor').checked;
        const canManageInstructors = document.getElementById('roleFlagManageInstructors').checked;
        const isMasterAdmin = document.getElementById('roleFlagMasterAdmin').checked;
        const canPostNews = document.getElementById('roleFlagPostNews').checked;

        const allowedLinkKats = {};
        document.querySelectorAll('.role-link-kat-cb:checked').forEach(cb => {
            allowedLinkKats[cb.value] = true;
        });

        const allowedCmdKats = {};
        document.querySelectorAll('.role-cmd-kat-cb:checked').forEach(cb => {
            allowedCmdKats[cb.value] = true;
        });

        const roleData = {
            id: rId,
            name: name,
            color: color,
            icon: icon,
            isSystem: cachedRoles[rId]?.isSystem === true,
            isAdmin: isAdmin,
            canDelete: canDelete,
            isInstructor: isInstructor,
            canManageInstructors: canManageInstructors,
            isMasterAdmin: isMasterAdmin,
            canPostNews: canPostNews,
            allowedLinkKats: allowedLinkKats,
            allowedCmdKats: allowedCmdKats
        };

        db.ref(`data/roles/${rId}`).set(roleData).then(() => {
            alert(`✅ Rolle "${name}" erfolgreich gespeichert!`);
            cachedRoles[rId] = roleData;
            renderAdminRolesList();
        });
    }

    function loescheRolle() {
        if (!sessionUser || !sessionUser.isAdmin) return;
        const rId = document.getElementById('editingRoleId').value;
        if (!rId) return;

        if (cachedRoles[rId]?.isSystem) {
            alert("❌ System-Rollen können nicht gelöscht werden!");
            return;
        }

        if (confirm(`Möchtest du die Rolle "${cachedRoles[rId]?.name || rId}" wirklich unwiderruflich löschen?`)) {
            db.ref(`data/roles/${rId}`).remove().then(() => {
                delete cachedRoles[rId];
                alert("✅ Rolle gelöscht!");
                const remaining = Object.keys(cachedRoles);
                if (remaining.length > 0) ladeRolleInEditor(remaining[0]);
            });
        }
    }

    // --- HELPER TO BUILD STRUCTURED ROLE SELECTION GRID ---
    function buildRolesSelectionHtml(userRoleIds, checkboxClass) {
        const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
        const isTopAdmin = eff.isAdmin || eff.isMasterAdmin;

        let adminRolesList = [];
        if (eff.isMasterAdmin) {
            adminRolesList = ['masteradmin', 'admin', 'ausbildungsleitung'];
        } else if (eff.isAdmin) {
            adminRolesList = ['admin', 'ausbildungsleitung'];
        }

        const groups = [
            {
                title: "👑 Leitung & Admin",
                roles: adminRolesList
            },
            {
                title: "🎓 Ausbildung",
                roles: ['ausbilder', 'ehk', 'cls']
            },
            {
                title: "⚕️ Medizinischer Dienst",
                roles: ['personal', 'psychologie', 'luftrettung']
            },
            {
                title: "👨‍⚕️ Allgemein",
                roles: ['mitarbeiter']
            }
        ];

        let html = '';
        const covered = new Set();

        groups.forEach(grp => {
            const grpRoles = grp.roles.filter(rId => cachedRoles[rId]);
            if (grpRoles.length > 0) {
                html += `<div style="margin-bottom:18px; width:100%;">
                    <div style="font-size:13px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px;">${grp.title}</div>
                    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1für)); gap:12px;">`;
                grpRoles.forEach(rId => {
                    covered.add(rId);
                    const role = cachedRoles[rId];
                    const isChecked = userRoleIds.includes(rId);
                    const color = role.color || '#38bdf8';
                    const icon = role.icon ? role.icon : '🔸';
                    
                    const bg = isChecked ? `${color}15` : 'rgba(15,23,42,0.6)';
                    const border = isChecked ? `${color}` : 'rgba(255,255,255,0.1)';
                    const shadow = isChecked ? `0 0 15px ${color}33` : 'none';
                    const iconFilter = isChecked ? 'grayscale(0%)' : 'grayscale(100%) opacity(50%)';
                    const textColor = isChecked ? '#fff' : 'var(--text-muted)';
                    const checkDisplay = isChecked ? 'block' : 'none';

                    html += `
                    <label style="position:relative; display:flex; flex-direction:column; gap:8px; background:${bg}; border:1px solid ${border}; box-shadow:${shadow}; padding:14px; border-radius:12px; cursor:pointer; transition:all 0.2s; user-select:none; overflow:hidden;">
                        <input type="checkbox" class="${checkboxClass}" value="${rId}" ${isChecked ? 'checked' : ''} style="display:none;" onchange="
                            const c = this.checked;
                            this.parentNode.style.background = c ? '${color}15' : 'rgba(15,23,42,0.6)';
                            this.parentNode.style.borderColor = c ? '${color}' : 'rgba(255,255,255,0.1)';
                            this.parentNode.style.boxShadow = c ? '0 0 15px ${color}33' : 'none';
                            this.parentNode.querySelector('.role-icon').style.filter = c ? 'grayscale(0%)' : 'grayscale(100%) opacity(50%)';
                            this.parentNode.querySelector('.role-name').style.color = c ? '#fff' : 'var(--text-muted)';
                            this.parentNode.querySelector('.role-check').style.display = c ? 'block' : 'none';
                            this.parentNode.querySelector('.role-bar').style.opacity = c ? '1' : '0';
                        ">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span class="role-icon" style="font-size:22px; filter:${iconFilter}; transition:all 0.2s;">${icon}</span>
                            <span class="role-check" style="display:${checkDisplay}; color:${color}; font-size:16px;">✔️</span>
                        </div>
                        <span class="role-name" style="font-size:14px; font-weight:800; color:${textColor}; transition:all 0.2s;">${role.name}</span>
                        <div class="role-bar" style="position:absolute; bottom:0; left:0; height:3px; width:100%; background:${color}; opacity:${isChecked ? '1' : '0'}; transition:opacity 0.2s;"></div>
                    </label>`;
                });
                html += `</div></div>`;
            }
        });

        const customRoles = Object.keys(cachedRoles).filter(rId => !covered.has(rId));
        if (customRoles.length > 0) {
            html += `<div style="margin-bottom:18px; width:100%;">
                <div style="font-size:13px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px;">🛠️ Eigene Rollen</div>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1für)); gap:12px;">`;
            customRoles.forEach(rId => {
                const role = cachedRoles[rId];
                const isChecked = userRoleIds.includes(rId);
                const color = role.color || '#38bdf8';
                const icon = role.icon ? role.icon : '🔸';
                
                const bg = isChecked ? `${color}15` : 'rgba(15,23,42,0.6)';
                const border = isChecked ? `${color}` : 'rgba(255,255,255,0.1)';
                const shadow = isChecked ? `0 0 15px ${color}33` : 'none';
                const iconFilter = isChecked ? 'grayscale(0%)' : 'grayscale(100%) opacity(50%)';
                const textColor = isChecked ? '#fff' : 'var(--text-muted)';
                const checkDisplay = isChecked ? 'block' : 'none';

                html += `
                <label style="position:relative; display:flex; flex-direction:column; gap:8px; background:${bg}; border:1px solid ${border}; box-shadow:${shadow}; padding:14px; border-radius:12px; cursor:pointer; transition:all 0.2s; user-select:none; overflow:hidden;">
                    <input type="checkbox" class="${checkboxClass}" value="${rId}" ${isChecked ? 'checked' : ''} style="display:none;" onchange="
                        const c = this.checked;
                        this.parentNode.style.background = c ? '${color}15' : 'rgba(15,23,42,0.6)';
                        this.parentNode.style.borderColor = c ? '${color}' : 'rgba(255,255,255,0.1)';
                        this.parentNode.style.boxShadow = c ? '0 0 15px ${color}33' : 'none';
                        this.parentNode.querySelector('.role-icon').style.filter = c ? 'grayscale(0%)' : 'grayscale(100%) opacity(50%)';
                        this.parentNode.querySelector('.role-name').style.color = c ? '#fff' : 'var(--text-muted)';
                        this.parentNode.querySelector('.role-check').style.display = c ? 'block' : 'none';
                        this.parentNode.querySelector('.role-bar').style.opacity = c ? '1' : '0';
                    ">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <span class="role-icon" style="font-size:22px; filter:${iconFilter}; transition:all 0.2s;">${icon}</span>
                        <span class="role-check" style="display:${checkDisplay}; color:${color}; font-size:16px;">✔️</span>
                    </div>
                    <span class="role-name" style="font-size:14px; font-weight:800; color:${textColor}; transition:all 0.2s;">${role.name}</span>
                    <div class="role-bar" style="position:absolute; bottom:0; left:0; height:3px; width:100%; background:${color}; opacity:${isChecked ? '1' : '0'}; transition:opacity 0.2s;"></div>
                </label>`;
            });
            html += `</div></div>`;
        }

        return html;
    }

    // --- ASSIGN ROLES MODAL (AUSBILDUNGSLEITUNG & ADMIN) ---
    function openAssignRolesModal(uId) {
        console.log(">>> TRIGGER TEST: openAssignRolesModal wurde geklickt mit ID:", uId);
        console.log("?? openAssignRolesModal called for uId:", uId);
        if (!uId) return;

        function showRolesModal(u) {
            document.getElementById('assignRoleUserId').value = uId;
            document.getElementById('assignRoleUserName').textContent = `${u.vorname || ''} ${u.nachname || ''}`;

            const cont = document.getElementById('assignRolesContainer');
            if (cont) {
                const userRoleIds = getUserRolesList(u);
                cont.innerHTML = buildRolesSelectionHtml(userRoleIds, 'assign-user-role-cb');
            }

            const modal = document.getElementById('assignRolesModal');
            console.log("Found assignRolesModal?", !!modal);
            if (modal) modal.style.display = 'flex';
        }

        if (cachedUsers && cachedUsers[uId]) {
            showRolesModal(cachedUsers[uId]);
        } else {
            db.ref("data/users/" + uId).once("value", snap => {
                const u = snap.val();
                if (u) {
                    if (!cachedUsers) cachedUsers = {};
                    cachedUsers[uId] = u;
                    showRolesModal(u);
                } else {
                    alert("⚠️ Mitarbeiter konnte nicht geladen werden.");
                }
            });
        }
    }

    function closeAssignRolesModal() {
        const modal = document.getElementById('assignRolesModal');
        if (modal) modal.style.display = 'none';
    }

    function saveAssignedRoles() {
        const uId = document.getElementById('assignRoleUserId').value;
        if (!uId) return;

        const u = (cachedUsers && cachedUsers[uId]) ? cachedUsers[uId] : {};
        const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
        const isTopAdmin = eff.isAdmin || eff.isMasterAdmin;

        const selectedRoles = {};
        document.querySelectorAll('.assign-user-role-cb:checked').forEach(cb => {
            selectedRoles[cb.value] = true;
        });

        // If actor is not Top-Admin (e.g. Ausbildungsleitung), preserve any existing admin roles the target user already had
        const currRoles = getUserRolesList(u);
        if (!eff.isMasterAdmin && currRoles.includes('masteradmin')) selectedRoles.masteradmin = true;
        if (!eff.isAdmin && !eff.isMasterAdmin && currRoles.includes('admin')) selectedRoles.admin = true;
        if (!eff.isAdmin && !eff.isMasterAdmin && currRoles.includes('ausbildungsleitung')) selectedRoles.ausbildungsleitung = true;
        if (!eff.isAdmin && !eff.isMasterAdmin && currRoles.includes('ausbildungsleitung')) selectedRoles.ausbildungsleitung = true;

        db.ref(`data/users/${uId}/roles`).set(selectedRoles).then(() => {
            logSystemActivity('Rollen geändert', `Rollen für ${u.vorname} ${u.nachname} wurden aktualisiert.`);
            alert("✅ Rollen erfolgreich zugewiesen!");
            closeAssignRolesModal();
            if (cachedUsers && cachedUsers[uId]) {
                cachedUsers[uId].roles = selectedRoles;
            }
        }).catch(err => {
            alert("Fehler beim Zuweisen der Rollen: " + err.message);
        });
    }

    // --- FULL USER PERMISSIONS MODAL (MASTER-ADMIN & ADMIN) ---
    function openUserPermissionsModal(uId) {
        console.log(">>> TRIGGER TEST: openUserPermissionsModal wurde geklickt mit ID:", uId);
        console.log("?? openUserPermissionsModal called for uId:", uId);
        if (!uId) {
            alert("⚠️ Kein Mitarbeiter ausgewählt.");
            return;
        }

        function showPermModal(u) {
            try {
                document.getElementById('permModalUserId').value = uId;
                document.getElementById('permVorname').value = u.vorname || '';
                document.getElementById('permNachname').value = u.nachname || '';

                document.getElementById('permStatus').value = u.status || 'approved';
                document.getElementById('permDN').value = u.dn || '';

                // Master-Admin can view the password, Admins only reset it
                const sessionEff = sessionUser ? getUserEffectivePermissions(sessionUser) : { isMasterAdmin: false };
                const isMaster = sessionEff.isMasterAdmin;

                const passInput = document.getElementById('permPassword');
                const passLabel = document.getElementById('permPasswordLabel');
                const passToggleBtn = document.getElementById('btnTogglePermPass');

                if (isMaster) {
                    if (passLabel) passLabel.textContent = "Passwort (Master-Admin Einsicht):";
                    if (passInput) {
                        passInput.type = "text";
                        passInput.value = u.pass || '';
                        passInput.placeholder = "Passwort eingeben...";
                    }
                    if (passToggleBtn) {
                        passToggleBtn.style.display = 'inline-block';
                        passToggleBtn.textContent = '🔒 Verbergen';
                    }
                } else {
                    if (passLabel) passLabel.textContent = "Passwort zurücksetzen:";
                    if (passInput) {
                        passInput.type = "password";
                        passInput.value = '';
                        passInput.placeholder = "Neues Passwort (leer = unverändert)";
                    }
                    if (passToggleBtn) passToggleBtn.style.display = 'none';
                }

                const rolesCont = document.getElementById('permRolesContainer');
                if (rolesCont) {
                    const userRoleIds = getUserRolesList(u);
                    rolesCont.innerHTML = buildRolesSelectionHtml(userRoleIds, 'perm-user-role-cb');
                }

                const eff = getUserEffectivePermissions(u);
                const canSeeLinksEl = document.getElementById('permCanSeeLinks');
                if (canSeeLinksEl) canSeeLinksEl.checked = u.canSeeLinks !== false;
                const canSeeCmdsEl = document.getElementById('permCanSeeCommands');
                if (canSeeCmdsEl) canSeeCmdsEl.checked = u.canSeeCommands !== false;
                const canDeleteEl = document.getElementById('permCanDelete');
                if (canDeleteEl) canDeleteEl.checked = u.canDelete === true || eff.canDelete === true;
                const canPostNewsEl = document.getElementById('permCanPostNews');
                if (canPostNewsEl) canPostNewsEl.checked = u.canPostNews === true || eff.canPostNews === true;

                const standardLinkKats = ['MD Intern', 'Allgemein', 'Ausbildung', 'Luftrettung', 'Psychologie', 'Personalabteilung', 'EHK', 'CLS'];
                const allAvailableLinks = Array.fürom(new Set([...standardLinkKats, ...allLinkCategories])).sort();

                const linksCont = document.getElementById('permLinksCategoriesContainer');
                if (linksCont) {
                    linksCont.innerHTML = "";
                    const allowedLinkKats = u.allowedLinkKats || {};

                    allAvailableLinks.forEach(kat => {
                        const isChecked = allowedLinkKats[kat] !== false;
                        linksCont.innerHTML += `
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; padding:3px 6px; border-radius:6px; background:rgba(255,255,255,0.03);">
                            <input type="checkbox" class="perm-link-kat-cb" value="${kat}" ${isChecked ? 'checked' : ''}>
                            <span>${kat}</span>
                        </label>`;
                    });
                }

                const standardCmdKats = ['T-Codes', 'Abkürzungen & Dokumente', 'Ausbildung', 'Psychologie', 'Personalabteilung', 'EHK', 'CLS'];
                const allAvailableCmds = Array.fürom(new Set([...standardCmdKats, ...allCmdCategories])).sort();

                const cmdsCont = document.getElementById('permCmdsCategoriesContainer');
                if (cmdsCont) {
                    cmdsCont.innerHTML = "";
                    const allowedCmdKats = u.allowedCmdKats || {};

                    allAvailableCmds.forEach(kat => {
                        const isChecked = allowedCmdKats[kat] !== false;
                        cmdsCont.innerHTML += `
                        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; padding:3px 6px; border-radius:6px; background:rgba(255,255,255,0.03);">
                            <input type="checkbox" class="perm-cmd-kat-cb" value="${kat}" ${isChecked ? 'checked' : ''}>
                            <span>${kat}</span>
                        </label>`;
                    });
                }

                const modal = document.getElementById('userPermissionsModal');
                console.log("Found userPermissionsModal?", !!modal);
                if (modal) {
                    modal.style.display = 'flex';
                    modal.style.zIndex = '99999';
                }
            } catch (err) {
                console.error("Fehler in showPermModal:", err);
                alert("Fehler beim Öffnen des Fensters: " + err.message);
            }
        }

        if (cachedUsers && cachedUsers[uId]) {
            showPermModal(cachedUsers[uId]);
        } else {
            db.ref("data/users/" + uId).once("value", snap => {
                const u = snap.val();
                if (u) {
                    if (!cachedUsers) cachedUsers = {};
                    cachedUsers[uId] = u;
                    showPermModal(u);
                } else {
                    alert("⚠️ Mitarbeiterdaten für '" + uId + "' konnten nicht gefunden werden.");
                }
            }).catch(err => {
                alert("Verbindungsfehler beim Laden: " + err.message);
            });
        }
    }

    function togglePermPasswordVisibility() {
        const input = document.getElementById('permPassword');
        const btn = document.getElementById('btnTogglePermPass');
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            if (btn) btn.textContent = '🔒 Verbergen';
        } else {
            input.type = 'password';
            if (btn) btn.textContent = '▶ Anzeigen';
        }
    }

    function closeUserPermissionsModal() {
        document.getElementById('userPermissionsModal').style.display = 'none';
    }

    function saveUserPermissions() {try {

        const currUId = document.getElementById('permModalUserId').value; const cUser = cachedUsers[currUId] || {}; logSystemActivity('Stammdaten / Rechte', `Die Stammdaten oder Spezial-Rechte für ${cUser.vorname} ${cUser.nachname} wurden aktualisiert.`);
        const oldUId = document.getElementById('permModalUserId').value;
        if (!oldUId) return;

        const oldUser = (cachedUsers && cachedUsers[oldUId]) ? cachedUsers[oldUId] : {};
        const newVorname = (document.getElementById('permVorname').value || '').trim();
        const newNachname = (document.getElementById('permNachname').value || '').trim();

        if (!newVorname || !newNachname) {
            alert("⚠️ Vorname und Nachname dürfen nicht leer sein!");
            return;
        }

        const newUId = (newVorname + "_" + newNachname).toLowerCase().replace(/[^a-z0-9_]/g, "");

        if (newUId !== oldUId && cachedUsers && cachedUsers[newUId]) {
            alert("❌ Ein Mitarbeiter mit dem Namen '" + newVorname + " " + newNachname + "' existiert bereits!");
            return;
        }

        const selectedRoles = {};
        document.querySelectorAll('.perm-user-role-cb:checked').forEach(cb => {
            selectedRoles[cb.value] = true;
        });

        const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : {};
        const currRoles = getUserRolesList(oldUser);
        if (!eff.isMasterAdmin && currRoles.includes('masteradmin')) selectedRoles.masteradmin = true;
        if (!eff.isAdmin && !eff.isMasterAdmin && currRoles.includes('admin')) selectedRoles.admin = true;
        if (!eff.isAdmin && !eff.isMasterAdmin && currRoles.includes('ausbildungsleitung')) selectedRoles.ausbildungsleitung = true;
        if (!eff.isAdmin && !eff.isMasterAdmin && currRoles.includes('ausbildungsleitung')) selectedRoles.ausbildungsleitung = true;

        const canSeeLinks = document.getElementById('permCanSeeLinks').checked;
        const canSeeCommands = document.getElementById('permCanSeeCommands').checked;
        const canDelete = document.getElementById('permCanDelete').checked;
        const canPostNews = document.getElementById('permCanPostNews').checked;

        const statusVal = document.getElementById('permStatus').value;
        const newPass = document.getElementById('permPassword').value.trim();
        const dnVal = document.getElementById('permDN').value.trim();

        const allowedLinkKats = {};
        document.querySelectorAll('.perm-link-kat-cb').forEach(cb => {
            allowedLinkKats[cb.value] = cb.checked;
        });

        const allowedCmdKats = {};
        document.querySelectorAll('.perm-cmd-kat-cb').forEach(cb => {
            allowedCmdKats[cb.value] = cb.checked;
        });

        // Clone existing user data to retain exam history, dates, passed exams, etc.
        const updatedUserData = Object.assign({}, oldUser, {
            vorname: newVorname,
            nachname: newNachname,
            roles: selectedRoles,
            canSeeLinks: canSeeLinks,
            canSeeCommands: canSeeCommands,
            canDelete: canDelete,
            canPostNews: canPostNews,
            allowedLinkKats: allowedLinkKats,
            allowedCmdKats: allowedCmdKats,
            status: statusVal,
            dn: dnVal
        });

        // Only update password if a new password was provided
        if (newPass) {
            updatedUserData.pass = newPass;
        }

        const finishSave = () => {
            alert("✅ Mitarbeiterdaten & Berechtigungen erfolgreich gespeichert!");
            if (sessionUser && (sessionUser.vorname + "_" + sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g, "") === oldUId) {
                sessionUser = updatedUserData;
                sessionStorage.setItem('mmd_session_user', JSON.stringify(sessionUser));
                localStorage.setItem('mmd_session_user', JSON.stringify(sessionUser));
            }
            renderStudentUnlockedExams();
            if(typeof renderInstructorUnlocks !== 'undefined') renderInstructorUnlocks(cachedUsers, cachedExams);
            if(typeof renderInstructorSubmissions !== 'undefined') renderInstructorSubmissions(cachedSubmissions);
            if (cachedUsers) {
                if (newUId !== oldUId) delete cachedUsers[oldUId];
                cachedUsers[newUId] = updatedUserData;
            }
            closeUserPermissionsModal();
        };

        if (newUId !== oldUId) {
            // Renamed employee: copy to new node and remove old node
            db.ref(`data/users/${newUId}`).set(updatedUserData).then(() => {
                db.ref(`data/users/${oldUId}`).remove().then(finishSave);
            }).catch(err => {
                alert("Fehler beim Speichern: " + err.message);
            });
        } else {
            // Same UId: update node
            db.ref(`data/users/${oldUId}`).set(updatedUserData).then(finishSave).catch(err => {
                alert("Fehler beim Speichern: " + err.message);
            });
        }
    }

     catch (err) {
        console.error('Error in saveUserPermissions:', err);
        alert('Fehler: ' + err.message + '\nZeile: ' + err.stack);
    }
}
function linkHinzufuegen() {
        if (!sessionUser) return;
        const eff = getUserEffectivePermissions(sessionUser);
        if (!eff.isAdmin && !eff.isMasterAdmin) {
            alert("❌ Nur Administratoren können neue Links hinzufügen!");
            return;
        }
        const name = document.getElementById('linkName').value.trim();
        const url = document.getElementById('linkUrl').value.trim();
        const thema = document.getElementById('linkThema').value.trim();
        if(!name || !url) { alert("Bitte Name und Internetadresse ausfüllen!"); return; }
        db.ref("data/dienstLinks").push({ name: name, url: url, thema: thema || "Allgemein" }).then(() => {
            document.getElementById('linkName').value = "";
            document.getElementById('linkUrl').value = "";
            document.getElementById('linkThema').value = "";
            alert("✅ Link erfolgreich gespeichert!");
        });
    }

    function renderDienstLinks(links) {
        const container = document.getElementById('linksAccordionContainer'); if (!container) return; container.innerHTML = "";
        if (!links) { container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 20px;">Keine Links hinterlegt.</p>`; return; }
        let gruppierteLinks = {};
        Object.keys(links).forEach(key => { 
            let item = links[key]; 
            let themaName = (item.thema || item.kat || "Allgemein").trim(); 
            if (themaName.toLowerCase() === "ausbildungsabteilung") themaName = "Ausbildung";
            if (!gruppierteLinks[themaName]) gruppierteLinks[themaName] = []; 
            gruppierteLinks[themaName].push({ id: key, name: item.name, url: item.url }); 
        });
        
        const hasDeletePermission = canUserDelete();

        let allThemaKeys = Object.keys(gruppierteLinks).sort();
        allLinkCategories = allThemaKeys; // Update dynamic cache

        let meinaLinkKats = getUserAllowedLinkCategories(sessionUser, allThemaKeys);

        const linkDatalist = document.getElementById('linkThemaList');
        if (linkDatalist && allThemaKeys.length > 0) {
            linkDatalist.innerHTML = allThemaKeys.map(k => `<option value="${k}">`).join('');
        }

        if (meinaLinkKats.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 20px;">Keine füreigegebenen Dokumente für dich vorhanden.</p>`;
            return;
        }

        meinaLinkKats.forEach(thema => {
            if (!gruppierteLinks[thema]) return;
            let safeThemaId = "theme-" + thema.replace(/[^a-z0-9]/gi, '-'); let linksListe = gruppierteLinks[thema]; let istEingeklappt = localStorage.getItem('mmd_collapse_' + thema) === 'true';
            let tableRows = linksListe.map(l => {
                let trashBtn = hasDeletePermission 
                    ? `<td style="width: 40px; text-align: center; padding:8px 2px;"><button class="btn-delete-row" onclick="deleteDienstLink('${l.id}')">🗑️</button></td>` 
                    : '';
                return `<tr><td style="font-weight:600; color:var(--text-main); white-space:normal; word-break:break-word; padding:8px 4px;">${l.name}</td><td style="width: 90px; text-align: center; padding:8px 2px;"><a href="${l.url}" target="_blank" class="link-btn-clickable" style="padding:5px 8px; font-size:11px; display:inline-block;">Öffnen ↗</a></td>${trashBtn}</tr>`;
            }).join('');

            container.innerHTML += `<div class="theme-accordion-group ${istEingeklappt ? 'collapsed' : ''}" id="${safeThemaId}"><div class="theme-accordion-header" onclick="toggleThemeCollapse('${thema}', '${safeThemaId}')">📂 ${thema} (${linksListe.length})</div><div class="theme-accordion-content"><div class="table-responsive" style="margin:0; border:none; overflow-x:hidden;"><table style="table-layout: fixed; width: 100%; box-sizing: border-box;"><tbody>${tableRows}</tbody></table></div></div></div>`;
        });
    }

    function renderDienstCommands(commands) {
        const container = document.getElementById('commandsAccordionContainer'); 
        if (!container) return; 
        container.innerHTML = "";
        const listData = Object.assign({}, defaultCommands, commands || {});
        
        const ignoredKats = ['funkcodes', 'luftrettung', 'allgemein'];
        const ignoredNames = ['/t1', '/t2', '/t3', '/t4', '/t5', '/t6', '/t7', '/t8', 'ga', 'dv'];

        let gruppierteCommands = {};
        Object.keys(listData).forEach(key => { 
            let item = listData[key]; 
            if (!item || !item.name) return;
            let katName = (item.kat || item.thema || "").trim(); 
            if (katName.toLowerCase() === "ausbildungsabteilung") katName = "Ausbildung";
            if (!katName) katName = "Abkürzungen & Dokumente";

            // Filter out deleted categories and commands
            if (ignoredKats.includes(katName.toLowerCase())) return;
            if (ignoredNames.includes(item.name.trim().toLowerCase())) return;

            if (!gruppierteCommands[katName]) gruppierteCommands[katName] = []; 
            gruppierteCommands[katName].push({ id: key, name: item.name, desc: item.desc }); 
        });

        let allCmdKeys = Object.keys(gruppierteCommands).sort();
        allCmdCategories = allCmdKeys; // Update dynamic cache

        let meinaCmdKats = getUserAllowedCmdCategories(sessionUser, allCmdKeys);

        const cmdDatalist = document.getElementById('cmdKatList');
        if (cmdDatalist && allCmdKeys.length > 0) {
            cmdDatalist.innerHTML = allCmdKeys.map(k => `<option value="${k}">`).join('');
        }

        if (meinaCmdKats.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 20px;">Keine füreigegebenen Commands für dich vorhanden.</p>`;
            return;
        }

        const hasDeletePermission = canUserDelete();

        meinaCmdKats.forEach(kat => {
            if (!gruppierteCommands[kat]) return;
            let safeKatId = "cmd-kat-" + kat.replace(/[^a-z0-9]/gi, '-'); 
            let itemsListe = gruppierteCommands[kat]; 
            let istEingeklappt = localStorage.getItem('mmd_cmd_collapse_' + kat) === 'true';
            
            let icon = "💻";
            if (kat === "Psychologie") icon = "🧠";
            else if (kat === "T-Codes") icon = "📻";
            else if (kat === "Abkürzungen & Dokumente") icon = "📝";
            else if (kat === "Ausbildung") icon = "🎓";

            let tableRows = itemsListe.map(item => {
                let trashBtn = hasDeletePermission 
                    ? `<td style="width: 40px; text-align: center; padding:8px 2px;"><button class="btn-delete-row" onclick="deleteDienstCommand('${item.id}')">🗑️</button></td>` 
                    : '';
                return `<tr>
                    <td style="font-weight:700; color:var(--primary); width: 35%; padding:8px 6px;">${item.name}</td>
                    <td style="font-weight:600; color:var(--text-main); padding:8px 6px;">${item.desc}</td>
                    ${trashBtn}
                </tr>`;
            }).join('');

            let trashTh = hasDeletePermission ? `<th style="width:40px;" class="sub-head text-center">🗑️</th>` : '';

            container.innerHTML += `
            <div class="theme-accordion-group ${istEingeklappt ? 'collapsed' : ''}" id="${safeKatId}">
                <div class="theme-accordion-header" onclick="toggleCmdCollapse('${kat}', '${safeKatId}')">${icon} ${kat} (${itemsListe.length})</div>
                <div class="theme-accordion-content">
                    <div class="table-responsive" style="margin:0; border:none; overflow-x:hidden;">
                        <table style="table-layout: fixed; width: 100%; box-sizing: border-box;" class="guide-table">
                            <thead>
                                <tr>
                                    <th class="sub-head" style="width:35%;">Command / Kürzel</th>
                                    <th class="sub-head">Beschreibung / Bedeutung</th>
                                    ${trashTh}
                                </tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        });
    }

    function toggleCmdCollapse(katName, elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.classList.toggle('collapsed');
        localStorage.setItem('mmd_cmd_collapse_' + katName, el.classList.contains('collapsed'));
    }

    function commandHinzufuegen() {
        if (!sessionUser) return;
        const eff = getUserEffectivePermissions(sessionUser);
        if (!eff.isAdmin && !eff.isMasterAdmin) {
            alert("❌ Nur Administratoren können neue Commands hinzufügen!");
            return;
        }
        const name = document.getElementById('cmdName').value.trim();
        const desc = document.getElementById('cmdDesc').value.trim();
        const kat = document.getElementById('cmdKat').value.trim() || "Allgemein";
        if (!name || !desc) { alert("Bitte Command/Kürzel und Beschreibung ausfüllen!"); return; }
        db.ref("data/dienstCommands").push({ name: name, desc: desc, kat: kat }).then(() => {
            document.getElementById('cmdName').value = "";
            document.getElementById('cmdDesc').value = "";
            alert("✅ Command erfolgreich in Cloud gespeichert!");
        });
    }

    function bulkCommandsImportieren() {
        if (!sessionUser) return;
        const eff = getUserEffectivePermissions(sessionUser);
        if (!eff.isAdmin && !eff.isMasterAdmin) {
            alert("❌ Nur Administratoren können Commands hinzufügen!");
            return;
        }
        const rawText = document.getElementById('bulkCmdTextarea').value;
        const fallbackKat = document.getElementById('bulkCmdCategoryFallback').value.trim() || "Allgemein";
        
        if (!rawText.trim()) {
            alert("Bitte füge mindestens eine Zeile mit Commands ein!");
            return;
        }

        const lines = rawText.split('\n');
        let addedCount = 0;
        let updates = {};

        lines.forEach(line => {
            let trimmed = line.trim();
            if (!trimmed) return;

            let parts = [];
            if (trimmed.includes('|')) parts = trimmed.split('|');
            else if (trimmed.includes(';')) parts = trimmed.split(';');
            else if (trimmed.includes('\t')) parts = trimmed.split('\t');
            else if (trimmed.includes(' - ')) parts = trimmed.split(' - ');
            else parts = [trimmed];

            let name = (parts[0] || "").trim();
            let desc = (parts[1] || "").trim();
            let kat = (parts[2] || "").trim() || fallbackKat;

            if (name) {
                let newKey = db.ref("data/dienstCommands").push().key;
                updates["data/dienstCommands/" + newKey] = {
                    name: name,
                    desc: desc || name,
                    kat: kat
                };
                addedCount++;
            }
        });

        if (addedCount === 0) {
            alert("Keine gültigen Commands in den Zeilen gefunden.");
            return;
        }

        db.ref().update(updates).then(() => {
            document.getElementById('bulkCmdTextarea').value = "";
            alert(`✅ Erfolgreich ${addedCount} Commands gleichzeitig in die Cloud gespeichert!`);
        }).catch(err => {
            alert("Fehler beim Speichern: " + err.message);
        });
    }

    // NEWS & SCHWARZES BRETT (THREAD-KANAL)
    let defaultNews = {
        news_1: {
            id: "news_1",
            title: "Ablauf einer Behandlungssperre",
            category: "Dienstanweisung",
            author: "Klinikleitung",
            date: "20.07.2026",
            time: "12:00 Uhr",
            timestamp: "20.07.2026, 12:00 Uhr",
            pinned: true,
            content: `Behandlungssperren können über den dafür vorgesehenen Bot eingetragen werden. Diesen findet ihr unter MD Intern → Behandlungssperren.
Dort könnt ihr auswählen, wie lange die Sperre gelten soll und den Namen der jeweiligen Fraktion eintragen.

Dauer der Behandlungssperren nach Command-Ebene:
• Low Command: Behandlungssperre bis zu 12 Stunden
• Mid Command: Behandlungssperre bis zu 12 Stunden
• High Command: Behandlungssperre zwischen 1 und 3 Tagen
• Chief-Ebene: Behandlungssperre zwischen 12 Stunden und 7 Tagen

Nach Absprache und in Härtefällen können Sperren bis zu einem Monat ausgesprochen werden.`
        },
        news_2: {
            id: "news_2",
            title: "Staatliche Sonderregeln für die Medics",
            category: "Regelwerk",
            author: "Klinikleitung",
            date: "20.07.2026",
            time: "12:00 Uhr",
            timestamp: "20.07.2026, 12:00 Uhr",
            pinned: true,
            content: `§13.1
Medics dürfen die Beteiligten bei einer Schießerei erst hochholen, wenn von einer Seite alle Personen, die an der Situation beteiligt sind, bewusstlos sind und von keinem Schuss mehr ausgegangen werden kann. Dabei muss der Medic die Situation prüfen und trägt dafür die volle Verantwortung.

§13.2
Medics dürfen Personen erst wiederbeleben, nachdem eine Schießerei beendet ist.

§13.3
Einen Medic von seiner Arbeit abzuhalten, ist untersagt.

§13.4
Den Medizinern steht es fürei, den Tod eines Bewusstlosen festzustellen, wenn die Verletzungen nicht realistisch behandelbar sind.

§13.5
Es gilt Medic-RP zu führen, darunter zählt z. B. das Angeben realistischer Schmerzen oder das Ausspielen einer Behandlung.

§13.6
Die Medics haben die alleinige Entscheidung zu treffen, welche Personen nach einer Schießerei zuerst wiederbelebt werden.`
        }
    };
    let cachedNews = Object.assign({}, defaultNews);

    function getNewsUserKey() {
        if (sessionUser && sessionUser.vorname && sessionUser.nachname) {
            return (sessionUser.vorname + "_" + sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g, "");
        }
        return "guest";
    }

    function isNewsRead(newsId) {
        const uId = getNewsUserKey();
        const item = cachedNews[newsId];
        if (item && item.readBy && item.readBy[uId]) return true;
        return localStorage.getItem(`mmd_news_read_${uId}_${newsId}`) === 'true';
    }

    function toggleNewsRead(newsId) {
        const uId = getNewsUserKey();
        const current = isNewsRead(newsId);
        const item = cachedNews[newsId] || {};
        
        if (!current) {
            // Mark as read
            const readerInfo = {
                name: sessionUser ? `${sessionUser.vorname} ${sessionUser.nachname}` : uId,
                dn: sessionUser?.dn || '',
                time: new Date().toLocaleDateString('de-DE') + ', ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
            };
            localStorage.setItem(`mmd_news_read_${uId}_${newsId}`, 'true');
            if (!item.readBy) item.readBy = {};
            item.readBy[uId] = readerInfo;
            db.ref(`data/news/${newsId}/readBy/${uId}`).set(readerInfo);
        } else {
            // Mark as unread
            localStorage.setItem(`mmd_news_read_${uId}_${newsId}`, 'false');
            if (item.readBy) delete item.readBy[uId];
            db.ref(`data/news/${newsId}/readBy/${uId}`).remove();
        }
        renderNewsFeed();
    }

    function togglePostNewsForm() {
        const cont = document.getElementById('postNewsContainer');
        if (!cont) return;
        cont.style.display = cont.style.display === 'none' ? 'block' : 'none';
        if (cont.style.display === 'block') {
            document.getElementById('newNewsTitle').focus();
        }
    }

    function speichereNeueNews() {
        if (!sessionUser) return;
        const eff = getUserEffectivePermissions(sessionUser);
        if (!eff.canPostNews && !eff.isAdmin && !eff.isMasterAdmin) {
            alert("⛔ Sie besitzen keine Berechtigung zum Verfassen von News-Threads!");
            return;
        }

        const title = document.getElementById('newNewsTitle').value.trim();
        const category = document.getElementById('newNewsCategory').value.trim();
        const content = document.getElementById('newNewsContent').value.trim();

        if (!title || !content) {
            alert("Bitte Titel und Text für die News ausfüllen!");
            return;
        }

        const newsId = "news_" + Date.now().toString(36);
        const author = `${sessionUser.vorname} ${sessionUser.nachname}`;
        const now = new Date();
        const dateStr = now.toLocaleDateString('de-DE');
        const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
        const timestamp = `${dateStr}, ${timeStr}`;

        const newsData = {
            id: newsId,
            title: title,
            category: category || "Allgemein",
            author: author,
            date: dateStr,
            time: timeStr,
            timestamp: timestamp,
            pinned: false,
            content: content,
            readBy: {}
        };

        db.ref(`data/news/${newsId}`).set(newsData).then(() => {
            alert("✅ News-Thread erfolgreich veröffentlicht!");
            document.getElementById('newNewsTitle').value = "";
            document.getElementById('newNewsContent').value = "";
            togglePostNewsForm();
        });
    }

    function deleteNews(newsId) {
        if (!sessionUser) return;
        const eff = getUserEffectivePermissions(sessionUser);
        const canDeleteThis = eff.canDelete || eff.isAdmin || eff.isMasterAdmin;
        if (!canDeleteThis) {
            alert("⛔ Sie besitzen keine Berechtigung zum Löschen von News-Threads!");
            return;
        }
        if (confirm("Möchtest du diesen News-Thread wirklich unwiderruflich löschen?")) {
            db.ref(`data/news/${newsId}`).set({ deleted: true }).then(() => {
                delete cachedNews[newsId];
                renderNewsFeed();
            });
        }
    }

    function renderNewsFeed() {
        const container = document.getElementById('newsFeedList');
        if (!container) return;
        container.innerHTML = "";

        const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : { isAdmin: false, isMasterAdmin: false, canDelete: false, canPostNews: false, canManageInstructors: false };
        const postBtn = document.getElementById('btnOpenPostNews');
        if (postBtn) {
            postBtn.style.display = (eff.canPostNews || eff.isAdmin || eff.isMasterAdmin) ? 'inline-block' : 'none';
        }

        const canSeeReaders = eff.isMasterAdmin || eff.isAdmin || eff.canManageInstructors;

        // Sort news descending by creation timestamp / ID (newest first)
        const newsKeys = Object.keys(cachedNews)
            .filter(k => !cachedNews[k].deleted)
            .sort((a, b) => b.localeCompare(a));

        if (newsKeys.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:40px; background:rgba(15,23,42,0.4); border-radius:12px; border:1px solid var(--border); font-size:14px;">Noch keine Ankündigungen vorhanden.</div>`;
            return;
        }

        const top5Keys = newsKeys.slice(0, 5);
        const archiveKeys = newsKeys.slice(5);

        function buildNewsCardHtml(nId) {
            const item = cachedNews[nId];
            const isRead = isNewsRead(nId);

            let tagColor = 'var(--primary)';
            let tagBg = 'rgba(56, 189, 248, 0.15)';
            if (item.category === 'Regelwerk') { tagColor = '#ec4899'; tagBg = 'rgba(236, 72, 153, 0.15)'; }
            else if (item.category === 'Dienstanweisung') { tagColor = '#f59e0b'; tagBg = 'rgba(245, 158, 11, 0.15)'; }
            else if (item.category === 'Ankündigung') { tagColor = '#a855f7'; tagBg = 'rgba(168, 85, 247, 0.15)'; }

            const readBadge = isRead 
                ? `<span style="font-size:12px; font-weight:800; color:var(--success); background:rgba(16,185,129,0.15); border:1px solid var(--success); padding:3px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">✅ Gelesen</span>`
                : `<span style="font-size:12px; font-weight:800; color:var(--danger); background:rgba(190,18,60,0.15); border:1px solid var(--danger); padding:3px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">🔴 Neu / Ungelesen</span>`;

            const canDeleteThis = eff.canDelete || eff.isMasterAdmin || eff.isAdmin;
            const deleteBtn = canDeleteThis 
                ? `<button class="btn-delete-row" style="margin:0; padding:5px 12px; font-size:12px; border-radius:8px; display:inline-flex; align-items:center; gap:4px;" onclick="event.stopPropagation(); deleteNews('${nId}')" title="News-Thread löschen">🗑️ Löschen</button>` 
                : '';

            const timeDisplay = item.timestamp || (item.date + (item.time ? ', ' + item.time : ''));

            let readersHtml = '';
            if (canSeeReaders) {
                const readersObj = item.readBy || {};
                const readersList = Object.keys(readersObj).map(k => readersObj[k]);
                readersHtml = `
                <div style="margin-top:16px; padding:12px 16px; background:rgba(30,41,59,0.5); border:1px solid rgba(56,189,248,0.25); border-radius:10px;">
                    <div style="font-size:13px; font-weight:800; color:var(--primary); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                        <span>👁️ Gelesen von (${readersList.length} Mitarbeiter${readersList.length === 1 ? '' : 'n'}):</span>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${readersList.length > 0
                            ? readersList.map(r => `<span style="font-size:12px; font-weight:700; color:var(--text-main); background:rgba(15,23,42,0.8); border:1px solid var(--border); padding:4px 10px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">👤 <b>${r.name}</b> ${r.dn ? `<span style="color:var(--primary); font-size:11px;">(${r.dn})</span>` : ''} <span style="color:var(--text-muted); font-size:11px; margin-left:2px;">🕒 ${r.time}</span></span>`).join('')
                            : '<span style="font-size:12px; color:var(--text-muted); font-style:italic;">Noch von keinem Mitarbeiter als gelesen markiert.</span>'
                        }
                    </div>
                </div>`;
            }

            return `
            <div class="news-thread-card ${isRead ? 'is-read' : ''}" style="background:rgba(15, 23, 42, 0.65); border:1px solid ${isRead ? 'var(--border)' : 'rgba(56, 189, 248, 0.4)'}; border-left: 5px solid ${isRead ? 'var(--success)' : tagColor}; border-radius:14px; overflow:hidden; transition:all 0.2s; box-shadow: 0 4px 18px rgba(0,0,0,0.25); margin-bottom:18px;">
                <!-- HEADER (VOLL SICHTBAR) -->
                <div class="news-card-header" onclick="if(this.parentNode.classList.contains('is-read')) this.parentNode.classList.toggle('expanded')" style="padding:16px 22px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; background:${isRead ? 'transparent' : 'rgba(56, 189, 248, 0.04)'}; border-bottom:1px solid var(--border);">
                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                        <span style="font-size:12px; font-weight:800; color:${tagColor}; background:${tagBg}; padding:4px 10px; border-radius:6px; text-transform:uppercase; letter-spacing:0.5px;">${item.category || 'Allgemein'}</span>
                        <h3 style="margin:0; font-size:18px; color:var(--text-main); font-weight:800; letter-spacing:-0.2px;">${item.title}</h3>
                        ${readBadge}
                    </div>
                    <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
                        <span style="font-size:13px; color:var(--text-muted); font-weight:500;">🕒 ${timeDisplay} (${item.author || 'Leitung'})</span>
                        ${deleteBtn}
                    </div>
                </div>

                <!-- CONTENT / THREAD BODY -->
                <div class="news-card-content" style="padding:18px 22px 22px 22px;">
                    <div style="font-size:15px; color:#f8fafc; line-height:1.8; white-space:pre-wrap; letter-spacing:0.1px;">${item.content}</div>
                    
                    ${readersHtml}

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; padding-top:16px; border-top:1px dashed var(--border); flex-wrap:wrap; gap:12px;">
                        <span style="font-size:12px; color:var(--text-muted);">Erstellt am <b>${timeDisplay}</b> von <b>${item.author || 'Klinikleitung'}</b></span>
                        <button class="btn" style="width:auto; margin:0; padding:8px 20px; font-size:13px; font-weight:800; background:${isRead ? 'rgba(255,255,255,0.08)' : 'var(--success)'}; color:${isRead ? 'var(--text-main)' : '#080c14'}; border:${isRead ? '1px solid var(--border)' : 'none'};" onclick="event.stopPropagation(); toggleNewsRead('${nId}')">
                            ${isRead ? '⭕ Als ungelesen markieren' : '✔️ Als gelesen markieren'}
                        </button>
                    </div>
                </div>
            </div>`;
        }

        top5Keys.forEach(nId => {
            container.innerHTML += buildNewsCardHtml(nId);
        });

        if (archiveKeys.length > 0) {
            let archiveHtml = `
            <div style="margin-top:28px; border:1px solid var(--border); border-radius:14px; overflow:hidden; background:rgba(8,12,20,0.4);">
                <div style="background:rgba(30,41,59,0.7); padding:16px 20px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;" onclick="toggleNewsArchiveSection()">
                    <div style="display:flex; align-items:center; gap:8px; font-size:15px; font-weight:800; color:var(--warning);">
                        <span>📂 News-Archiv (${archiveKeys.length} ältere Beiträge)</span>
                    </div>
                    <span id="newsArchiveToggleArrow" style="font-size:13px; font-weight:700; color:var(--primary);">▶ Archiv anzeigen</span>
                </div>
                <div id="newsArchiveBody" style="display:none; padding:18px;">
                    ${archiveKeys.map(nId => buildNewsCardHtml(nId)).join('')}
                </div>
            </div>`;
            container.innerHTML += archiveHtml;
        }
    }

    function toggleNewsArchiveSection() {
        const body = document.getElementById('newsArchiveBody');
        const arrow = document.getElementById('newsArchiveToggleArrow');
        if (!body || !arrow) return;
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        arrow.textContent = isHidden ? '▼ Archiv schließen' : '▶ Archiv anzeigen';
    }

    // AUSBILDUNGS- & PRÜFUNGSSYSTEM LOGIK
    let defaultExams = {
        exam_ga1: {
            id: "exam_ga1",
            title: "Grundausbildung 1 (GA1)",
            kat: "Grundausbildung",
            timeLimitMinutes: 30,
            passPercentage: 60,
            passScore: 15,
            introHeader: "Grundausbildung 1",
            introText: "Willkommen bei der Grundausbildung.\nIn dieser Prüfung geht es um das Thema: Grundausbildung 1\n\nDu benötigst mindestens 15 Punkte (60%), um die Prüfung zu bestehen.\nWir wünschen dir bei der Beantwortung der Fragen viel Erfolg!",
            questions: [
                { id: 1, text: "Wie viel kostet ein MRT?", options: ["10.000 $", "7.500 $", "5.000 $", "2.500 $"], correctAnswers: [3] },
                { id: 2, text: "Wie viel kostet eine Reanimation? Im Zeitraum von 0 - 6Uhr!", options: ["2.500 $", "5.000 $", "7.500 $", "10.000 $"], correctAnswers: [3] },
                { id: 3, text: "Wie melde ich, dass mein Dispatch erledigt ist?", options: ["Ich fahre einfach weg und melde es nicht.", "Ich schreibe der Leitstelle eine SMS mit dem Inhalt \"Einsatz beendet\"", "Ich melde das im Funk wie folgt: [Meine Unit] 10-5.", "Ich sende einen Dispatch und schreibe rein \"Einsatz beendet\""], correctAnswers: [2] },
                { id: 4, text: "Was bedeutet der Funkcode 10-3?", options: ["Unterwegs", "Verstanden, Ende", "Weg ins MD", "Funkstille", "Warte auf Zuteilung"], correctAnswers: [2] },
                { id: 5, text: "Was bedeutet der Funkcode 10-10?", options: ["Statusbericht / Standort", "Am Einsatzort angekommen", "Unterwegs", "weiterer RTW benötigt", "Im Dienst", "Verstanden, Ende"], correctAnswers: [3] },
                { id: 6, text: "Streife 2 nimmt einen Einsatz an, der zuvor als abgebrochen (10-13) gemeldet wurde. Trotzdem fährt Streife 2 zu diesem Einsatz. Als sie vor Ort eintrifft, funkt die Leitstelle Streife 2 an und füragt nach 10-8.", options: ["Streife 2 muss den Einsatz abbrechen und zum MD zurückkehren", "Streife 2 muss auf weitere Anweisungen der Leitstelle warten und darf nicht eingreifen", "Streife 2 muss den Status 10-10 ignorieren und macht einfach weiter", "Streife 2 meldet ihren Status", "Streife 2 muss sofort Verstärkung anfordern, da der Einsatz als abgebrochen gemeldet wurde"], correctAnswers: [3] },
                { id: 7, text: "Wie meldest du dich im Funk an?", options: ["DN, meldet sich Status 10-4", "DN, meldet sich Status 10-5", "DN, meldet sich 10-11", "DN, meldet sich Status 10-3", "DN, meldet sich Code 10-2", "DN, meldet sich 10-1"], correctAnswers: [2] },
                { id: 8, text: "In welches GPS loggst du dich ein?", options: ["Kanal 1", "Kanal 4", "Kanal 2", "Kanal 3", "Kanal 5"], correctAnswers: [3] },
                { id: 9, text: "Wo stempelst du dich ein?", options: ["Hinter dem Tresen", "Gar nicht", "In der Mensa", "Bei den Sammelbetten hinter dem Tresen"], correctAnswers: [0] },
                { id: 10, text: "Was ziehst du bei Dienstantritt an?", options: ["Außendienstkleidung", "Innendienstkleidung", "Leitstellen Outfit", "Ich fordere eine 10-5 an", "Zivilkleidung"], correctAnswers: [3] },
                { id: 11, text: "Wo trage ich mich ein? (Mehrere Antworten möglich!)", options: ["Ich trage mich in der Ausbildungsliste ein", "Sollte eine Leitstelle bereits eingetragen sein wird diese mich eintragen", "Ich trage mich ins Wöchentlich Besprechungsprotokoll ein", "Ich trage mich selbständig im MDT als Leitstelle und in eine Streife ein. (keine Leitstelle)", "Ich muss mich gar nicht eintragen, wenn ich eingestempelt bin reicht es"], correctAnswers: [1, 3] },
                { id: 12, text: "Wie meldest du dich aus dem Funk ab?", options: ["DN, meldet sich 10-5", "DN, meldet sich Code 2", "DN, meldet sich 10-12", "DN, meldet sich 10-2", "ich melde mich nicht ab"], correctAnswers: [2] },
                { id: 13, text: "Was ist bei Dienstaustritt zu beachten? (Mehrere Antworten möglich!)", options: ["Ich lege meine Dienstkleidung ab", "Ich melde mich im Funk ab und verlasse den Funkkanal", "Ich bleibe im Funk und lege meine Medkits ab", "Ich verlasse den Dienst und lasse dabei meine Dienstkleidung an", "Ich lege meine Medkits ab", "Ich lege mein Innendienstequipment zurück."], correctAnswers: [0, 1, 4, 5] },
                { id: 14, text: "Wie verhältst du dich als Zivilist?", options: ["Ich hantiere mit Illegalen Gegenständen", "Ich verhalte mich wie ein MDler und mache nichts Illegales", "Ich stelle mich ins MD und lenke meine Kollegen ab"], correctAnswers: [1] },
                { id: 15, text: "Sie sind gerade mit Ihrem Fahrzeug unterwegs, als Sie von einem Beamten des SAPD angehalten werden, weil Sie zu schnell gefahren sind... Wie gehen Sie da jetzt vor?", options: ["Ich fahre weiter um den Problemen mit dem SAPD aus dem Weg zugehen", "Ich zeige keine Gegenwehr und bin Kooperativ", "Da ich meinen Job nicht verlieren möchte, fahre ich weiter, damit ich keine Akteneinträge bekomme"], correctAnswers: [1] },
                { id: 16, text: "Was ist der Funkcode 10-4?", options: ["10-4 steht für 'Notruf'", "10-4 steht für 'Hilfe benötigt'", "10-4 steht für 'Streife unterwegs'", "10-4 steht für 'Gefahr erkannt'", "10-4 steht für 'Verstanden'"], correctAnswers: [4] },
                { id: 17, text: "Was ist der Funkcode 10-6?", options: ["10-6 steht für 'In Gefahr'", "10-6 steht für 'Komme sofort'", "10-6 steht für 'Bitte Wiederholen'", "10-6 steht für 'Auf Zuteilung'", "10-6 steht für 'Verbindung verloren'", "10-6 steht für 'Brauche Verstärkung'"], correctAnswers: [3] },
                { id: 18, text: "Was bedeutet der Statuscode 5?", options: ["Status 5 bedeutet 'Aktive Gefahrenzone'", "Status 5 bedeutet 'Unterwegs zum Einsatz'", "Status 5 bedeutet 'Brauche Unterstützung'", "Status 5 bedeutet 'In Besprechung'", "Status 5 bedeutet 'Einsatz abgeschlossen'"], correctAnswers: [3] },
                { id: 19, text: "Was bedeutet Status 3 bei Mitarbeitern?", options: ["Arbeitsbereit", "Beschäftigt / Pause", "Ausbildung", "Besprechung"], correctAnswers: [1] },
                { id: 20, text: "Wer nimmt Die Funksprüche an von DOJ und PD (Sonderstreife im Dienst)?", options: ["Die Leitstelle", "Sonderstreife", "Jeder Mitarbeiter der im Dienst ist"], correctAnswers: [1] }
            ]
        },
        exam_para2: {
            id: "exam_para2",
            title: "Paramedic 2 (Erweiterte Notfallmedizin)",
            kat: "Paramedic",
            timeLimitMinutes: 30,
            passPercentage: 75,
            passScore: 15,
            introHeader: "Paramedic Stufe 2",
            introText: "Vertiefung der erweiterten Notfallversorgung, Reanimation nach ACLS-Leitlinien und schwierige Atemwegs-Sicherung.",
            questions: [
                { id: 1, text: "Welche Medikamente werden bei einer Reanimation (Asystolie / PEA) nach ACLS-Standard verabreicht?", options: ["1mg Adrenalin alle 3-5 Minuten", "100mg Morphin sofort", "Nur Kochsalzlösung", "Aspirin 500mg"], correctAnswers: [0] },
                { id: 2, text: "Wie ist das Vorgehen bei einem Spannungspneumothorax im Außeneinsatz?", options: ["Sofortige Nadeldekompression im 2. ICR Medioklavikularlinie oder 4./5. ICR vordere Axillarlinie", "Nur Sauerstoffgabe über Maske", "Den Patienten flach hinlegen und abwarten", "Sofortige Intubation ohne Entlastung"], correctAnswers: [0] },
                { id: 3, text: "Welches Verfahren wird angewendet, wenn eine konventionelle Intubation fehlgeschlagen ist (Cannot intubate, cannot oxygenate)?", options: ["Koniotomie / Not-Krikothyreoidotomie", "Patient aufgeben", "Einfach weiter Mund-zu-Mund beatmen", "Reanimation abbrechen"], correctAnswers: [0] },
                { id: 4, text: "Welche Dosierung von Amiodaron wird bei refüraktärem Kammerflimmern nach der 3. Defibrillation verabreicht?", options: ["300 mg i.v. Bolus", "50 mg i.v.", "1000 mg i.v.", "10 mg subkutan"], correctAnswers: [0] },
                { id: 5, text: "Was bedeutet das 'cABCDE'-Schema in der präklinischen Traumabehandlung?", options: ["critical bleeding, Airway, Breathing, Circulation, Disability, Exposure", "control, Ambulance, Blood, Care, Doctor, Emergency", "cardiac, Asthma, Brain, Defibrillation, ECG", "clinical, Airway, Bone, Circulation, Drugs, Evacuation"], correctAnswers: [0] }
            ]
        },
    };

    function isUserInstructor() {
        if (!sessionUser) return false;
        const eff = getUserEffectivePermissions(sessionUser);
        return eff.isAdmin || eff.isMasterAdmin || eff.isInstructor || eff.canManageInstructors;
    }

    function switchInstructorTab(tabId, btnEl) {
        document.querySelectorAll('#examInstructorView .admin-subtab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('#examInstructorView .admin-tab-btn').forEach(el => el.classList.remove('active'));
        const target = document.getElementById(tabId);
        if(target) target.classList.add('active');
        if(btnEl) btnEl.classList.add('active');
    }

    
    function ensureExamHasDefaultHeaderFields(exam) {
        if (!exam || !exam.questions) return exam;
        
        let hasDN = exam.questions.some(q => q.type === 'info_dn' || (q.text || "").toLowerCase().includes("dienstnummer des mitarbeiters"));
        let hasPruefer = exam.questions.some(q => q.type === 'info_pruefer' || (q.text || "").toLowerCase().includes("dienstnummer des prüfers"));
        let hasName = exam.questions.some(q => q.type === 'info_name' || (q.text || "").toLowerCase().includes("vor- und nachname"));
        
        let newQuestions = [];
        if (!hasDN) {
            newQuestions.push({
                type: "info_dn",
                text: "Dienstnummer des Mitarbeiters",
                options: [],
                correctAnswers: [],
                points: []
            });
        }
        if (!hasPruefer) {
            newQuestions.push({
                type: "info_pruefer",
                text: "Dienstnummer des Prüfers",
                options: [],
                correctAnswers: [],
                points: []
            });
        }
        if (!hasName) {
            newQuestions.push({
                type: "info_name",
                text: "Vor- und Nachname des Mitarbeiters",
                options: [],
                correctAnswers: [],
                points: []
            });
        }
        
        if (newQuestions.length > 0) {
            exam.questions = [...newQuestions, ...exam.questions];
        }
        
        exam.questions.forEach((q, idx) => {
            q.id = idx + 1;
            if (!q.type) q.type = "choice";
            if (q.type === 'choice' && (!q.correctAnswers || q.correctAnswers.length === 0)) {
                q.correctAnswers = [0];
            }
        });
        
        return exam;
    }

    function renderExamTab(examsData, usersData, submissionsData) {
        let rawExams = Object.assign({}, defaultExams, examsData || {});
        
        // Remove obsolete exams & duplicate exams explicitly
        const obsoleteKeys = [
            'exam_ehk', 'exam_cls', 'exam_psgu', 'exam_dv1', 'exam_dv2', 'exam_para3', 'exam_arzt3',
            'paramedic_1_theorie', 'paramedic_2_notfall', 'arzt_1_allgemein', 'arzt_2_chirurgie'
        ];
        obsoleteKeys.forEach(k => delete rawExams[k]);

        Object.keys(rawExams).forEach(eId => {
            const t = (rawExams[eId]?.title || "").toLowerCase();
            if (t.includes("praxis und theorie") || 
                t.includes("erweiterte notfallmedizin") || 
                t.includes("allgemeinmedizin und notfallversorgung") || 
                t.includes("notfallchirurgie und chefarztqualifikation") ||
                t.includes("paramedic 3") || 
                t.includes("arzt 3") || 
                t.includes("erste hilfe") || 
                t.includes("combat life saver") || 
                t.includes("psychologie") || 
                t.includes("ehk") || 
                t.includes("cls") || 
                t.includes("psgu")) {
                delete rawExams[eId];
                db.ref("data/exams/" + eId).remove();
            }
        });

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

                const allowedExamsBtn = document.getElementById('instrAllowedExamsTabBtn');
                if (allowedExamsBtn) {
                    allowedExamsBtn.style.display = canManageInstructors(sessionUser) ? '' : 'none';
                }
                if (canManageInstructors(sessionUser)) {
                    renderInstructorAllowedExams(cachedUsers, cachedExams);
                }
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
            let idxA = cachedExamOrder.indexOf(a);
            let idxB = cachedExamOrder.indexOf(b);
            if (idxA === -1) idxA = 999999;
            if (idxB === -1) idxB = 999999;
            if (idxA !== idxB) return idxA - idxB;
            
            const titleA = (examsMap[a] && examsMap[a].title) ? examsMap[a].title.toLowerCase() : '';
            const titleB = (examsMap[b] && examsMap[b].title) ? examsMap[b].title.toLowerCase() : '';
            return titleA.localeCompare(titleB);
        });
    }

    function renderStudentUnlockedExams() {
        const container = document.getElementById('studentUnlockedExamsContainer');
        if(!container) return;
        container.innerHTML = "";

        if(!sessionUser) {
            container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:20px;">Bitte melde dich an, um deinen Prüfungsstatus einzusehen.</p>`;
            return;
        }

        const myUserId = (sessionUser.vorname + "_" + sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g, "");
        const unlockedObj = sessionUser.unlockedExams || {};
        const passedObj = sessionUser.passedExams || {};
        const statusObj = sessionUser.examStatus || {};

        // Collect all exam IDs: directly unlocked, passed, or previously attempted
        const examIdSet = new Set();
        Object.keys(unlockedObj).forEach(k => { if (unlockedObj[k] === true) examIdSet.add(k); });
        Object.keys(passedObj).forEach(k => { if (passedObj[k] === true) examIdSet.add(k); });
        if (cachedSubmissions) {
            Object.values(cachedSubmissions).forEach(sub => {
                if (sub.userId === myUserId && sub.examId) examIdSet.add(sub.examId);
            });
        }

        let relevantExamIds = Array.fürom(examIdSet).filter(k => cachedExams[k] && !cachedExams[k].isPractical);
        relevantExamIds = sortExamIdsDynamically(relevantExamIds, cachedExams);

        if(relevantExamIds.length === 0) {
            container.innerHTML = `
            <div style="background:rgba(245,158,11,0.05); border:1px solid rgba(245,158,11,0.2); padding:24px; border-radius:14px; text-align:center; width:100%;">
                <h4 style="color:var(--warning); margin-top:0;">🔒 Keine Prüfungen freigeschaltet</h4>
                <p style="color:var(--text-muted); font-size:13px; max-width:600px; margin:8px auto 0 auto;">
                    Du hast aktuell noch keine freigeschalteten Prüfungen. Sobald du im Dienstgrad aufsteigst, schaltet die <b>Ausbildungsabteilung</b> Prüfungen für dich fürei.
                </p>
            </div>`;
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
            let hasFailed = false;
            let lastSub = null;
            let bestSub = null;

            if (cachedSubmissions) {
                const userSubs = Object.values(cachedSubmissions).filter(sub => sub.userId === myUserId && sub.examId === examId);
                if (userSubs.length > 0) {
                    lastSub = userSubs[userSubs.length - 1];
                    const passedSubs = userSubs.filter(s => s.passed === true);
                    if (passedSubs.length > 0) {
                        bestSub = passedSubs[passedSubs.length - 1];
                        isPassed = true;
                        hasFailed = false;
                    } else {
                        if (!isPassed) {
                            hasFailed = true;
                        }
                    }
                }
            }

            let statusBadge = "";
            let actionBtn = "";

            if (isPassed) {
                const displaySub = bestSub || lastSub;
                statusBadge = `<span style="background:rgba(16,185,129,0.15); color:var(--success); border:1px solid var(--success); padding:3px 10px; border-radius:20px; font-size:11px; font-weight:800;">🏆 Bestanden ${displaySub ? `(${displaySub.percentage}%)` : ''}</span>`;
                actionBtn = ""; // Passed exams require no button
            } else if (isUnlocked) {
                // Exam is unlocked by instructor (first time OR re-unlocked for retake)
                if (hasFailed) {
                    statusBadge = `<span style="background:rgba(56,189,248,0.15); color:var(--primary); border:1px solid var(--primary); padding:3px 10px; border-radius:20px; font-size:11px; font-weight:800;">🔓 Wiederholung freigeschaltet (Letzter Versuch: ${lastSub ? lastSub.percentage + '%' : '--'})</span>`;
                    actionBtn = `<button class="btn" style="background:var(--primary); color:#080c14; font-weight:800; margin-top:14px;" onclick="startExam('${examId}')">🚀 Prüfung wiederholen</button>`;
                } else {
                    statusBadge = `<span style="background:rgba(56,189,248,0.15); color:var(--primary); border:1px solid var(--primary); padding:3px 10px; border-radius:20px; font-size:11px; font-weight:800;">🔓 Bereit zur Prüfung</span>`;
                    actionBtn = `<button class="btn" style="background:var(--primary); color:#080c14; font-weight:800; margin-top:14px;" onclick="startExam('${examId}')">🚀 Prüfung jetzt starten</button>`;
                }
            } else {
                // Exam is locked (failed and not yet re-unlocked by instructor)
                statusBadge = `<span style="background:rgba(244,63,94,0.15); color:var(--danger); border:1px solid var(--danger); padding:3px 10px; border-radius:20px; font-size:11px; font-weight:800;">❌ Nicht bestanden ${lastSub ? `(${lastSub.percentage}%)` : ''} - 🔒 Gesperrt</span>`;
                actionBtn = `<div style="background:rgba(244,63,94,0.08); border:1px solid rgba(244,63,94,0.25); padding:10px 14px; border-radius:8px; text-align:center; font-size:12px; color:var(--danger); font-weight:700; margin-top:14px;">🔒 Prüfung gesperrt – Bitte an Ausbilder zur Freischaltung wenden</div>`;
            }

            const cardHtml = `
            <div class="exam-card ${isPassed ? 'completed' : (isUnlocked ? 'unlocked' : 'locked')}" data-id="${examId}" style="${!isPassed && !isUnlocked ? 'border-color: rgba(244,63,94,0.4); opacity:0.85;' : ''}">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                        <span style="font-size:11px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">${exam.kat || 'Prüfung'}</span>
                        ${statusBadge}
                    </div>
                    <h4 style="margin:0 0 8px 0; color:var(--text-main); font-size:16px;">${exam.title}</h4>
                    <p style="color:var(--text-muted); font-size:12px; margin:0 0 12px 0;">
                        ⏱️ Dauer: ca. <b>${exam.timeLimitMinutes || 15} Min</b> &nbsp;|&nbsp; ❓ Fragen: <b>${exam.questions ? exam.questions.length : 0}</b> &nbsp;|&nbsp; 🎯 Mindestquote: <b>${exam.passPercentage || 60}%</b>
                    </p>
                </div>
                ${actionBtn}
            </div>`;

            if (isPassed) {
                completedExamsHtml += cardHtml;
                completedCount++;
            } else {
                activeExamsHtml += cardHtml;
            }
        });

        let finalHtml = `
        <div id="studentActiveExamsContainer" class="exam-grid">
            ${activeExamsHtml || '<p style="color:var(--text-muted); text-align:center; padding:10px; grid-column: 1/-1;">Keine ausstehenden Prüfungen zu erledigen.</p>'}
        </div>`;

        if (completedCount > 0) {
            let isCollapsed = localStorage.getItem('mmd_student_completed_collapsed') === 'true';
            finalHtml += `
            <div style="margin-top:24px; border:1px solid var(--border); border-radius:12px; background:rgba(30,41,59,0.2); overflow:hidden;">
                <div id="studentCompletedExamsHeader" style="padding:14px 20px; background:rgba(16,185,129,0.05); cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-weight:800; font-size:13px; color:var(--success); border-bottom: ${isCollapsed ? 'none' : '1px solid var(--border)'};" onclick="toggleStudentCompletedExamsCollapse()">
                    <span>✅ Bereits bestandene Prüfungen (${completedCount})</span>
                    <span id="studentCompletedExamsCollapseArrow" style="font-size:12px;">${isCollapsed ? '▶ Anzeigen' : '▼ Ausblenden'}</span>
                </div>
                <div id="studentCompletedExamsContainer" style="display:${isCollapsed ? 'none' : 'grid'}; padding:20px;" class="exam-grid">
                    ${completedExamsHtml}
                </div>
            </div>`;
        }

        container.innerHTML = finalHtml;

        // Initialize drag and drop reordering inside active exams grid
        makeContainerSortable('studentActiveExamsContainer', '.exam-card', saveExamOrder);


    }

    function startExam(examId) {
        const exam = cachedExams[examId];
        if(!exam) { alert("Prüfung nicht gefunden!"); return; }

        if(!confirm(`Möchtest du die Prüfung "${exam.title}" jetzt starten?\n\nDie Zeitmessung beginnt sofort!`)) return;

        activeExam = exam;
        activeExamSecondsElapsed = 0;
        if(activeExamTimerInterval) clearInterval(activeExamTimerInterval);

        activeExamTimerInterval = setInterval(() => {
            activeExamSecondsElapsed++;
            const m = String(Math.floor(activeExamSecondsElapsed / 60)).padStart(2, '0');
            const s = String(activeExamSecondsElapsed % 60).padStart(2, '0');
            const display = document.getElementById('activeExamTimerDisplay');
            if(display) display.textContent = `${m}:${s}`;
        }, 1000);

        document.getElementById('activeExamTitle').textContent = exam.title;
        document.getElementById('activeExamSubtitle').textContent = `Kategorie: ${exam.kat || 'Allgemein'} | Fragen: ${exam.questions.length}`;
        
        const qContainer = document.getElementById('activeExamQuestionsContainer');
        
        let introHtml = "";
        if (exam.introText) {
            introHtml = `
            <div style="background:rgba(168, 85, 247, 0.08); border:1px solid rgba(168, 85, 247, 0.3); padding:18px 22px; border-radius:14px; margin-bottom:20px;">
                <h3 style="margin:0 0 10px 0; color:#a855f7; font-size:18px;">${exam.introHeader || exam.title}</h3>
                <p style="margin:0; font-size:13px; color:var(--text-main); white-space:pre-line; line-height:1.6;">${exam.introText}</p>
            </div>`;
        }

        let questionsHtml = "";

        exam.questions.forEach((q, idx) => {
            const qType = q.type || 'choice';
            let itemHtml = "";

            if (['info_dn', 'info_pruefer', 'info_name'].includes(qType)) {
                let placeholder = "Bitte ausfüllen...";
                let defVal = "";
                if (qType === 'info_dn') placeholder = "z.B. DN 42";
                else if (qType === 'info_pruefer') placeholder = "z.B. DN 07";
                else if (qType === 'info_name') {
                    placeholder = "z.B. Tim Sanddorn";
                    defVal = sessionUser ? `${sessionUser.vorname} ${sessionUser.nachname}` : "";
                }

                itemHtml = `
                <div class="exam-q-box info-field-box" style="background:rgba(56, 189, 248, 0.05); border:1px solid rgba(56, 189, 248, 0.2); padding:16px 20px; border-radius:14px; margin-bottom:20px;">
                    <h4 style="margin:0 0 10px 0; color:var(--primary); font-size:14px; line-height:1.4;">${q.text}</h4>
                    <input type="text" name="q_ans_${q.id}" data-type="${qType}" value="${defVal}" placeholder="${placeholder}" style="width:100%; max-width:400px; padding:10px; border-radius:8px; border:1px solid var(--border); background:rgba(30,41,59,0.6); color:var(--text-main); font-size:13px;">
                </div>`;
            } else if (qType === 'text') {
                itemHtml = `
                <div class="exam-q-box text-field-box">
                    <h4 style="margin:0 0 10px 0; color:var(--text-main); font-size:14px; line-height:1.4;">
                        Frage ${idx + 1}: ${q.text} <span style="font-size:11px; color:var(--text-muted); margin-left:8px;">(Freitext-Antwort)</span>
                    </h4>
                    <textarea name="q_ans_${q.id}" data-type="text" rows="4" placeholder="Deine Antwort / Feedback hier eingeben..." style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border); background:rgba(30,41,59,0.6); color:var(--text-main); font-size:13px;"></textarea>
                </div>`;
            } else if (qType === 'checkbox_weighted') {
                let optionsHtml = "";
                q.options.forEach((opt, oIdx) => {
                    const pts = q.points ? q.points[oIdx] || 0 : 0;
                    optionsHtml += `
                    <label class="exam-opt-label">
                        <input type="checkbox" name="q_ans_${q.id}" data-type="checkbox_weighted" value="${oIdx}">
                        <span>${opt} <span style="font-size:10px; color:var(--text-muted);">(${pts >= 0 ? '+' : ''}${pts} Pkt)</span></span>
                    </label>`;
                });

                itemHtml = `
                <div class="exam-q-box weighted-choice-box">
                    <h4 style="margin:0 0 10px 0; color:var(--text-main); font-size:14px; line-height:1.4;">
                        Frage ${idx + 1}: ${q.text} <span style="font-size:11px; color:var(--warning); margin-left:8px;">(Mehrfachauswahl mit Punktewertung)</span>
                    </h4>
                    ${optionsHtml}
                </div>`;
            } else {
                const isMulti = q.correctAnswers && q.correctAnswers.length > 1;
                let optionsHtml = "";

                q.options.forEach((opt, oIdx) => {
                    const inputType = isMulti ? 'checkbox' : 'radio';
                    const inputName = `q_ans_${q.id}`;
                    optionsHtml += `
                    <label class="exam-opt-label">
                        <input type="${inputType}" name="${inputName}" data-type="choice" value="${oIdx}">
                        <span>${opt}</span>
                    </label>`;
                });

                itemHtml = `
                <div class="exam-q-box choice-box">
                    <h4 style="margin:0 0 10px 0; color:var(--text-main); font-size:14px; line-height:1.4;">
                        Frage ${idx + 1}: ${q.text}
                        ${isMulti ? '<span style="font-size:11px; color:var(--warning); margin-left:8px;">(Mehrere Antworten richtig!)</span>' : ''}
                    </h4>
                    ${optionsHtml}
                </div>`;
            }

            questionsHtml += itemHtml;
        });

        qContainer.innerHTML = introHtml + questionsHtml;

        document.getElementById('activeExamResultContainer').style.display = 'none';
        document.getElementById('activeExamContainer').style.display = 'block';
        document.getElementById('activeExamContainer').scrollIntoView({ behavior: 'smooth' });
    }

    function cancelActiveExam() {
        if(confirm("Möchtest du die laufende Prüfung abbrechen? Deine Eingaben gehen verloren.")) {
            if(activeExamTimerInterval) clearInterval(activeExamTimerInterval);
            activeExam = null;
            document.getElementById('activeExamContainer').style.display = 'none';
        }
    }

    function submitActiveExam(btn) {
        if(!activeExam || !sessionUser) return;

        let userDN = "";
        let prueferDN = "";
        let userFullName = "";

        activeExam.questions.forEach(q => {
            const qType = q.type || 'choice';
            if (['info_dn', 'info_pruefer', 'info_name'].includes(qType)) {
                const el = document.querySelector(`input[name="q_ans_${q.id}"]`);
                const val = el ? el.value.trim() : "";
                if (qType === 'info_dn') userDN = val;
                else if (qType === 'info_pruefer') prueferDN = val;
                else if (qType === 'info_name') userFullName = val;
            }
        });

        if (!userFullName) userFullName = sessionUser ? `${sessionUser.vorname} ${sessionUser.nachname}` : "Mitarbeiter";

        if(!userDN || !prueferDN) {
            alert("⚠️ Bitte trage deine Dienstnummer (DN) und die Dienstnummer deines Prüfers (DN Prüfer) in den dafür vorgesehenen Feldern ein!");
            return;
        }

        if(!confirm("Möchtest du deine Antworten jetzt einreichen und die Prüfung beenden?")) return;

        if (btn) {
            btn.disabled = true;
            btn.innerText = "Wird übermittelt...";
        }

        if(activeExamTimerInterval) clearInterval(activeExamTimerInterval);

        const durationSec = activeExamSecondsElapsed;
        const minutes = Math.floor(durationSec / 60);
        const seconds = durationSec % 60;
        const durationFormatted = `${minutes}m ${seconds}s`;

        let totalPossibleScore = 0;
        let earnedScore = 0;
        let details = [];

        try {
            activeExam.questions.forEach((q, idx) => {
                const qType = q.type || 'choice';
                const inputName = `q_ans_${q.id}`;

                if (['info_dn', 'info_pruefer', 'info_name'].includes(qType)) {
                    const el = document.querySelector(`input[name="${inputName}"]`);
                    const val = el ? el.value.trim() : "";
                    details.push({
                        questionText: q.text,
                        selectedOptions: [val || 'Keine Angabe'],
                        correctOptions: [],
                        isCorrect: true,
                        isInfo: true
                    });
                    return;
                }

                if (qType === 'text') {
                    const el = document.querySelector(`textarea[name="${inputName}"]`);
                    const val = el ? el.value.trim() : "";
                    details.push({
                        questionText: q.text,
                        selectedOptions: [val || 'Keine Antwort'],
                        correctOptions: [],
                        isCorrect: true,
                        isFreeText: true
                    });
                    return;
                }

                const optionsArr = q.options || [];

                if (qType === 'checkbox_weighted') {
                    const selectedNodes = document.querySelectorAll(`input[name="${inputName}"]:checked`);
                    const selectedIndices = Array.fürom(selectedNodes).map(node => parseInt(node.value));
                    
                    let qMaxPoints = 0;
                    let qEarnedPoints = 0;
                    
                    (q.points || []).forEach(p => {
                        if (p > 0) qMaxPoints += p;
                    });
                    if (qMaxPoints === 0) qMaxPoints = 1;

                    selectedIndices.forEach(idx => {
                        const pts = q.points ? q.points[idx] || 0 : 0;
                        qEarnedPoints += pts;
                    });

                    totalPossibleScore += qMaxPoints;
                    earnedScore += qEarnedPoints;

                    details.push({
                        questionText: q.text,
                        selectedOptions: selectedIndices.map(i => `${optionsArr[i] || 'Unbekannt'} (${q.points[i]} Pkt)`),
                        correctOptions: (q.points || []).map((p, i) => p > 0 ? `${optionsArr[i] || 'Unbekannt'} (${p} Pkt)` : null).filter(Boolean),
                        isCorrect: qEarnedPoints >= qMaxPoints,
                        earnedPoints: qEarnedPoints,
                        maxPoints: qMaxPoints
                    });
                    return;
                }

                // Default Choice
                const selectedNodes = document.querySelectorAll(`input[name="${inputName}"]:checked`);
                const selectedIndices = Array.fürom(selectedNodes).map(node => parseInt(node.value));
                const expectedIndices = q.correctAnswers || [];

                let isCorrect = selectedIndices.length === expectedIndices.length &&
                    selectedIndices.every(val => expectedIndices.includes(val));

                totalPossibleScore += 1;
                if(isCorrect) earnedScore += 1;

                details.push({
                    questionText: q.text,
                    selectedOptions: selectedIndices.map(i => optionsArr[i] || 'Keine'),
                    correctOptions: expectedIndices.map(i => optionsArr[i]),
                    isCorrect: isCorrect
                });
            });
        } catch (err) {
            console.error("Error parsing answers:", err);
            alert("Fehler beim Auswerten der Antworten. Bitte prüfe die Eingaben oder wende dich an einen Admin.");
            if(btn) {
                btn.disabled = false;
                btn.innerText = "Prüfung jetzt einreichen";
            }
            return;
        }

        if (totalPossibleScore === 0) totalPossibleScore = 1;
        const percentage = Math.round((earnedScore / totalPossibleScore) * 100);
        const passTargetPercent = Number(activeExam.passPercentage) || 60;
        const passed = percentage >= passTargetPercent;

        const userId = (sessionUser.vorname + "_" + sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g, "");

        let feedbackVal = "";
        activeExam.questions.forEach(q => {
            if (q.isFeedbackField) {
                const el = document.querySelector(`textarea[name="q_ans_${q.id}"]`);
                if (el) feedbackVal = el.value.trim();
            }
        });

        const submission = {
            userId: userId,
            userName: userFullName,
            userDN: userDN,
            prueferDN: prueferDN,
            examId: activeExam.id,
            examTitle: activeExam.title,
            durationSeconds: durationSec,
            durationFormatted: durationFormatted,
            score: earnedScore,
            totalQuestions: totalPossibleScore,
            percentage: percentage,
            passed: passed,
            details: details,
            datum: new Date().toLocaleDateString('de-DE') + " " + new Date().toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'}),
            feedback: feedbackVal,
            isPractical: activeExam.isPractical === true,
            status: "submitted",
            submittedAt: Date.now()
        };

        const updates = {};
        const newSubRef = db.ref("data/examSubmissions").push();
        updates[`data/examSubmissions/${newSubRef.key}`] = submission;
        updates[`data/users/${userId}/passedExams/${activeExam.id}`] = passed;
        updates[`data/users/${userId}/unlockedExams/${activeExam.id}`] = passed ? true : false;
        
        // Zwingend den Status beim User eintragen
        updates[`data/users/${userId}/examStatus/${activeExam.id}`] = "submitted";
        updates[`data/users/${userId}/examSubmittedAt/${activeExam.id}`] = Date.now();

        if (passed && sessionUser && sessionUser.isInstructor) {
            updates[`data/users/${userId}/instructorAllowedSeeExams/${activeExam.id}`] = true;
            updates[`data/users/${userId}/instructorAllowedManageExams/${activeExam.id}`] = true;
        }

        db.ref().update(updates).then(() => {
            logSystemActivity(passed ? 'Prüfung bestanden' : 'Prüfung nicht bestanden', `Der Mitarbeiter ${userFullName} hat die Prüfung '${activeExam.title}' mit ${percentage}% abgeschlossen.`);
            
            const cleanId = (sessionUser.vorname + "_" + sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g, "");
            if (userId === cleanId) {
                if (!sessionUser.passedExams) sessionUser.passedExams = {};
                sessionUser.passedExams[activeExam.id] = passed;
                if (!sessionUser.examStatus) sessionUser.examStatus = {};
                sessionUser.examStatus[activeExam.id] = "submitted";
                
                if (passed && sessionUser.isInstructor) {
                    if (!sessionUser.instructorAllowedSeeExams) sessionUser.instructorAllowedSeeExams = {};
                    if (!sessionUser.instructorAllowedManageExams) sessionUser.instructorAllowedManageExams = {};
                    sessionUser.instructorAllowedSeeExams[activeExam.id] = true;
                    sessionUser.instructorAllowedManageExams[activeExam.id] = true;
                }
                localStorage.setItem('mmd_session_user', JSON.stringify(sessionUser));
            }

            renderStudentUnlockedExams();
            if(typeof renderInstructorSubmissions !== 'undefined') renderInstructorSubmissions(cachedSubmissions);

            document.getElementById('activeExamContainer').style.display = 'none';
            alert("Deine Prüfung wurde erfolgreich eingereicht und liegt dem Prüfer zur Korrektur vor.");
            
            // Zurück zum Dashboard
            switchTab('examTab', document.getElementById('btnExamTab'));
            
        }).catch(err => {
            console.error("Firebase Update Error:", err);
            alert("Fehler beim Speichern der Prüfung! Bitte überprüfe deine Verbindung.");
            if (btn) {
                btn.disabled = false;
                btn.innerText = "Prüfung jetzt einreichen";
            }
        });
    }

    
    
    function isExamAllowedToSee(u, examId) {
        if (!u) return false;
        const eff = getUserEffectivePermissions(u);
        if (eff.isAdmin || eff.isMasterAdmin || eff.canManageInstructors) return true;
        if (!eff.isInstructor) return false;
        const allowed = u.instructorAllowedSeeExams;
        if (allowed && Object.keys(allowed).length > 0) {
            return allowed[examId] === true;
        }
        return true;
    }

    function isExamAllowedToManage(u, examId) {
        if (!u) return false;
        const eff = getUserEffectivePermissions(u);
        if (eff.isAdmin || eff.isMasterAdmin || eff.canManageInstructors) return true;
        if (u.canCreateExams === true) return true;
        const allowed = u.instructorAllowedManageExams;
        if (allowed && allowed[examId] === true) {
            return true;
        }
        return false;
    }

    function canInstructorDeleteSubmission() {
        if (!sessionUser) return false;
        const eff = getUserEffectivePermissions(sessionUser);
        if (eff.isAdmin || eff.isMasterAdmin || eff.canDelete) return true;
        return eff.isInstructor && (sessionUser.canDeleteSubmissions === true);
    }

    function isExamAllowedForInstructor(examId) {
        return isExamAllowedToSee(sessionUser, examId);
    }

    function renderInstructorAllowedExams(users, exams) {
        // 1. Render Member Approvals Table (for Ausbildungsleitung and Admin)
        const approvalTbody = document.getElementById('instructorMembersApprovalTableBody');
        if (approvalTbody && users) {
            approvalTbody.innerHTML = "";
            Object.keys(users).forEach(uId => {
                const u = users[uId];
                const rolesHtml = renderUserRoleBadges(u);

                const isApproved = u.status === 'approved';
                const statusBadge = isApproved 
                    ? `<span style="background:rgba(16,185,129,0.15); color:var(--success); border:1px solid var(--success); padding:2px 8px; border-radius:12px; font-size:10px; font-weight:800;">Zugelassen</span>`
                    : `<span style="background:rgba(245,158,11,0.15); color:var(--warning); border:1px solid var(--warning); padding:2px 8px; border-radius:12px; font-size:10px; font-weight:800;">Gesperrt / Beantragt</span>`;

                const actionButton = isApproved
                    ? `<button class="btn" style="margin:0; width:auto; padding:4px 8px; font-size:10px; background:rgba(190,18,60,0.15); color:var(--danger); border:1px solid var(--danger); font-weight:800;" onclick="toggleInstructorUserStatus('${uId}', 'pending')">Sperren</button>`
                    : `<button class="btn" style="margin:0; width:auto; padding:4px 8px; font-size:10px; background:rgba(16,185,129,0.15); color:var(--success); border:1px solid var(--success); font-weight:800;" onclick="toggleInstructorUserStatus('${uId}', 'approved')">Zulassen</button>`;

                approvalTbody.innerHTML += `
                <tr>
                    <td style="white-space:normal;"><b>${u.vorname} ${u.nachname}</b></td>
                    <td><span style="font-family:monospace; font-size:11px;">${u.dn || 'Keine DN'}</span></td>
                    <td style="white-space:normal;"><div style="display:flex; flex-wrap:wrap; gap:3px;">${rolesHtml}</div></td>
                    <td>${statusBadge}</td>
                    <td style="white-space:normal;">
                        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                            ${actionButton}
                            <button class="btn" style="margin:0; width:auto; padding:4px 8px; font-size:10px; background:rgba(168,85,247,0.15); color:#a855f7; border:1px solid #a855f7; font-weight:800;" onclick="openAssignRolesModal('${uId}')">👥 Rollen</button>
                        </div>
                    </td>
                </tr>`;
            });
        }

        // 2. Render Allowed Exams Table (for Ausbildungsleitung and Admin)
        const tbody = document.getElementById('instructorAllowedExamsTableBody');
        if (tbody && users) {
            tbody.innerHTML = "";

            Object.keys(users).forEach(uId => {
                const u = users[uId];
                const eff = getUserEffectivePermissions(u);
                if (!eff.isInstructor && !eff.isAdmin) return; // Only show instructors and admins

                const canCreateExams = u.canCreateExams === true;
                const canDeleteSubmissions = u.canDeleteSubmissions === true;

                const globalCheckboxes = `
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:11px; margin:0;">
                        <input type="checkbox" ${canCreateExams ? 'checked' : ''} onchange="toggleInstructorGlobalPermission('${uId}', 'canCreateExams', this.checked)">
                        <span>Neue Prüfungen anlegen</span>
                    </label>
                    <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:11px; margin:0;">
                        <input type="checkbox" ${canDeleteSubmissions ? 'checked' : ''} onchange="toggleInstructorGlobalPermission('${uId}', 'canDeleteSubmissions', this.checked)">
                        <span style="color:var(--danger);">Ergebnisse löschen</span>
                    </label>
                </div>`;

                const allowedSee = u.instructorAllowedSeeExams || {};
                const allowedManage = u.instructorAllowedManageExams || {};

                let examCompetenciesHtml = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1für)); gap:6px; padding:4px; background:rgba(8,12,20,0.3); border-radius:8px; border:1px solid var(--border);">`;
                
                // Sort exams dynamically to prevent mixed representation
                let sortedExamIds = sortExamIdsDynamically(Object.keys(exams), exams);
                sortedExamIds.forEach(eId => {
                    const exam = exams[eId];
                    const isSeeChecked = allowedSee[eId] === true;
                    const isManageChecked = allowedManage[eId] === true;
                    examCompetenciesHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(30,41,59,0.5); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); gap: 8px;">
                        <span style="font-size:11px; font-weight:700; color:var(--text-main); overflow:hidden; text-overflow:ellipsis;">${exam.title}</span>
                        <div style="display: flex; gap: 8px; align-items:center; flex-shrink:0;">
                            <label style="display: inline-flex; align-items: center; gap: 2px; cursor: pointer; font-size: 11px; margin:0;">
                                <input type="checkbox" ${isSeeChecked ? 'checked' : ''} onchange="toggleInstructorExamPermission('${uId}', '${eId}', 'see', this.checked)"> 👁️ Sehen
                            </label>
                            <label style="display: inline-flex; align-items: center; gap: 2px; cursor: pointer; font-size: 11px; margin:0;">
                                <input type="checkbox" ${isManageChecked ? 'checked' : ''} onchange="toggleInstructorExamPermission('${uId}', '${eId}', 'manage', this.checked)"> 🛠️ Verwalten
                            </label>
                        </div>
                    </div>`;
                });

                examCompetenciesHtml += `</div>`;

                tbody.innerHTML += `
                <tr>
                    <td style="white-space:normal; min-width:180px;">
                        <b>${u.vorname} ${u.nachname}</b>
                        <div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:3px;">${renderUserRoleBadges(u)}</div>
                    </td>
                    <td style="white-space:normal; min-width:160px;">${globalCheckboxes}</td>
                    <td style="white-space:normal;">${examCompetenciesHtml}</td>
                </tr>`;
            });
        }
    }

    function toggleInstructorGlobalPermission(uId, field, value) {
        db.ref(`data/users/${uId}/${field}`).set(value);
    }

    function toggleInstructorExamPermission(uId, examId, type, value) {
        const node = type === 'see' ? 'instructorAllowedSeeExams' : 'instructorAllowedManageExams';
        db.ref(`data/users/${uId}/${node}/${examId}`).set(value);
    }

    function toggleInstructorUserStatus(uId, newStatus) {
        updateUserStatusAndPermissions(uId, newStatus).then(() => {
            alert(`✅ Status für ${uId.replace('_', ' ')} wurde auf '${newStatus === 'approved' ? 'Zugelassen' : 'Gesperrt'}' geändert.`);
        });
    }



    function toggleStudentCompletedExamsCollapse() {
        const body = document.getElementById('studentCompletedExamsContainer');
        const header = document.getElementById('studentCompletedExamsHeader');
        const arrow = document.getElementById('studentCompletedExamsCollapseArrow');
        if(!body || !arrow || !header) return;

        const isCollapsed = body.style.display === 'none';
        if(isCollapsed) {
            body.style.display = 'grid';
            arrow.textContent = '▼ Ausblenden';
            header.style.borderBottom = '1px solid var(--border)';
            localStorage.setItem('mmd_student_completed_collapsed', 'false');
        } else {
            body.style.display = 'none';
            arrow.textContent = '▶ Anzeigen';
            header.style.borderBottom = 'none';
            localStorage.setItem('mmd_student_completed_collapsed', 'true');
        }
    }

    function makeContainerSortable(containerId, itemSelector, onOrderChange) {
        if (!isUserInstructor()) return; // Restricted to instructors/admins
        const container = document.getElementById(containerId);
        if (!container) return;

        container.querySelectorAll(itemSelector).forEach(item => {
            if (item.dataset.sortableInit) return;
            item.dataset.sortableInit = 'true';
            item.setAttribute('draggable', 'true');
            item.classList.add('draggable-item');

            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.setData('text/plain', item.getAttribute('data-id'));
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                const items = Array.fürom(container.querySelectorAll(itemSelector));
                const newOrder = items.map(el => el.getAttribute('data-id'));
                onOrderChange(newOrder);
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingItem = container.querySelector('.dragging');
                if (!draggingItem) return;
                const siblings = Array.fürom(container.querySelectorAll(`${itemSelector}:not(.dragging)`));
                const nextSibling = siblings.find(sibling => {
                    const box = sibling.getBoundingClientRect();
                    const offset = e.clientY - box.top - box.height / 2;
                    return offset < 0;
                });
                container.insertBefore(draggingItem, nextSibling);
            });
        });
    }

    function saveExamOrder(newOrder) {
        db.ref("data/examOrder").set(newOrder).then(() => {
            console.log("Exam order updated:", newOrder);
        });
    }

    function deleteExamSubmission(subId) {
        if (!canInstructorDeleteSubmission()) {
            alert("⛔ Sie besitzen keine Berechtigung zum Löschen von Prüfungsergebnissen!");
            return;
        }
        if (confirm("Möchtest du dieses Prüfungsergebnis wirklich unwiderruflich löschen?")) {
            if(typeof logSystemActivity !== 'undefined') logSystemActivity('Prüfung gelöscht', `Einreichung gelöscht.`);
            db.ref(`data/examSubmissions/${subId}`).remove().then(() => {
                alert("✅ Prüfungsergebnis erfolgreich gelöscht!");
            });
        }
    }

    function renderInstructorUnlocks(users, exams) {
        const tbody = document.getElementById('instructorUserUnlocksTableBody');
        if(!tbody || !users) return;
        tbody.innerHTML = "";

        Object.keys(users).forEach(uId => {
            const u = users[uId];

            const unlocked = u.unlockedExams || {};
            const passedMap = u.passedExams || {};
            let sortedExamIds = sortExamIdsDynamically(Object.keys(exams), exams);
            let examCheckboxes = sortedExamIds.map(eId => {
                if (!isExamAllowedToManage(sessionUser, eId)) return '';
                const exam = exams[eId];
                const isChecked = unlocked[eId] === true;
                const isPassed = passedMap[eId] === true;
                return `
                <div style="display:flex; flex-direction:column; gap:4px; padding:8px 12px; background:rgba(30,41,59,0.5); border:1px solid var(--border); border-radius:10px; margin:2px; min-width:210px; text-align:left;">
                    <div style="font-weight:700; font-size:11px; color:var(--text-main); line-height:1.2; margin-bottom:4px;">${exam.title}</div>
                    <div style="display:flex; gap:10px; align-items:center; margin-top:2px; flex-wrap:wrap;">
                        <label style="display:inline-flex; align-items:center; gap:4px; font-size:10px; margin:0; cursor:pointer;" title="Prüfung für Mitarbeiter füreischalten">
                            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleExamUnlockForUser('${uId}', '${eId}', this.checked)" style="margin:0; transform:scale(0.95);">
                            <span>🔓 Freigabe</span>
                        </label>
                        <label style="display:inline-flex; align-items:center; gap:4px; font-size:10px; margin:0; cursor:pointer;" title="Als bestanden markieren (Altsystem)">
                            <input type="checkbox" ${isPassed ? 'checked' : ''} onchange="toggleExamPassedForUser('${uId}', '${eId}', this.checked)" style="margin:0; transform:scale(0.95);">
                            <span style="color:var(--success); font-weight:700;">✅ Bestanden</span>
                        </label>
                        <button class="btn" style="margin:0; width:auto; padding:2px 8px; font-size:10px; background:rgba(245,158,11,0.15); color:var(--warning); border:1px solid var(--warning); font-weight:700; border-radius:6px;" onclick="allowExamRetake('${uId}', '${eId}')" title="Prüfungsstatus zurücksetzen & zur Wiederholung füreischalten">🔄 Reset</button>
                    </div>
                </div>`;
            }).filter(h => h !== '').join('');

            tbody.innerHTML += `
            <tr>
                <td><b>${u.vorname} ${u.nachname}</b></td>
                <td>${u.date || '--'}</td>
                <td>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${examCheckboxes || '<span style="color:var(--text-muted); font-size:11px;">Keine Prüfungen definiert</span>'}
                    </div>
                </td>
            </tr>`;
        });
    }

    function toggleExamUnlockForUser(uId, examId, isUnlocked) {
        db.ref(`data/users/${uId}/unlockedExams/${examId}`).set(isUnlocked);
        const u = cachedUsers[uId] || {}; if(typeof logSystemActivity !== 'undefined') logSystemActivity('Prüfung-Freigabe', `Die Prüfung '${examId}' wurde für ${u.vorname} ${u.nachname} ${isUnlocked ? 'freigeschaltet' : 'gesperrt'}.`);
     }

    function toggleExamPassedForUser(uId, examId, isPassed) {
        const u = cachedUsers[uId] || {}; if(typeof logSystemActivity !== 'undefined') logSystemActivity('Prüfung-Status (Manuell)', `Der Status der Prüfung '${examId}' für ${u.vorname} ${u.nachname} wurde auf ${isPassed ? 'Bestanden' : 'Nicht bestanden'} gesetzt.`);
        const updates = {
            [`data/users/${uId}/passedExams/${examId}`]: isPassed
        };
        
        // Auto-grant instructor permissions if they are marked passed
        if (isPassed && cachedUsers[uId] && cachedUsers[uId].isInstructor) {
            updates[`data/users/${uId}/instructorAllowedSeeExams/${examId}`] = true;
            updates[`data/users/${uId}/instructorAllowedManageExams/${examId}`] = true;
        }

        db.ref().update(updates).then(() => {
            const cleanId = (sessionUser.vorname + "_" + sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g, "");
            if (uId === cleanId) {
                if (!sessionUser.passedExams) sessionUser.passedExams = {};
                sessionUser.passedExams[examId] = isPassed;
                if (isPassed && sessionUser.isInstructor) {
                    if (!sessionUser.instructorAllowedSeeExams) sessionUser.instructorAllowedSeeExams = {};
                    if (!sessionUser.instructorAllowedManageExams) sessionUser.instructorAllowedManageExams = {};
                    sessionUser.instructorAllowedSeeExams[examId] = true;
                    sessionUser.instructorAllowedManageExams[examId] = true;
                }
                sessionStorage.setItem('mmd_session_user', JSON.stringify(sessionUser));
                localStorage.setItem('mmd_session_user', JSON.stringify(sessionUser));
            }
        });
    }

    function allowExamRetake(uId, examId, subId) {
        if (!isUserInstructor()) {
            alert("⛔ Sie besitzen keine Ausbilder-Berechtigung!");
            return;
        }
        const examTitle = (cachedExams && cachedExams[examId]) ? cachedExams[examId].title : "Prüfung";
        let userName = uId;
        if (cachedUsers && cachedUsers[uId]) {
            userName = `${cachedUsers[uId].vorname} ${cachedUsers[uId].nachname}`;
        }
        
        if (!confirm(`Möchtest du die Prüfung "${examTitle}" für ${userName} zur Wiederholung füreischalten?\n\nDie Prüfung wird auf 'Freigegeben' gesetzt und der 'Bestanden'-Status wird zurückgesetzt, sodass der Prüfling sofort erneut antreten kann.`)) {
            return;
        }

        const updates = {
            [`data/users/${uId}/unlockedExams/${examId}`]: true,
            [`data/users/${uId}/passedExams/${examId}`]: false
        };

        if (subId) {
            db.ref(`data/examSubmissions/${subId}`).remove();
        }

        db.ref().update(updates).then(() => {
            const cleanMyId = sessionUser ? (sessionUser.vorname + "_" + sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g, "") : "";
            if (uId === cleanMyId) {
                if (!sessionUser.unlockedExams) sessionUser.unlockedExams = {};
                if (!sessionUser.passedExams) sessionUser.passedExams = {};
                sessionUser.unlockedExams[examId] = true;
                sessionUser.passedExams[examId] = false;
                sessionStorage.setItem('mmd_session_user', JSON.stringify(sessionUser));
                localStorage.setItem('mmd_session_user', JSON.stringify(sessionUser));
            }
            alert(`âœ… Prüfung "${examTitle}" wurde für ${userName} erfolgreich zur Wiederholung freigeschaltet!`);
            closeSubmissionDetailsModal();
            renderStudentUnlockedExams();
        });
    }

function renderInstructorSubmissions(submissions) {
        const tbody = document.getElementById('instructorSubmissionsTableBody');
        if(!tbody) return;
        tbody.innerHTML = "";

        if(!submissions) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:20px;">Noch keine Prüfungen absolviert.</td></tr>`;
            return;
        }

        Object.keys(submissions).reverse().forEach(subId => {
            const sub = submissions[subId];
            if (!isExamAllowedForInstructor(sub.examId)) return; // Skip unauthorized exams
            let statusBadge = sub.passed
                ? `<span style="color:var(--success); font-weight:800;">Bestanden ✔</span>`
                : `<span style="color:var(--danger); font-weight:800;">Nicht bestanden ✖</span>`;

            tbody.innerHTML += `
            <tr>
                <td style="font-size:11px;">${sub.datum || '--'}</td>
                <td><b>${sub.userName || '--'}</b> <br><span style="font-size:11px; color:var(--primary); font-weight:700;">DN: ${sub.userDN || '--'}</span></td>
                <td><span style="font-size:11px; color:var(--warning); font-weight:700;">DN: ${sub.prueferDN || '--'}</span></td>
                <td style="font-weight:600; color:var(--primary);">${sub.examTitle || '--'}</td>
                <td><span style="font-family:monospace; color:var(--warning); font-weight:700;">⏱️ ${sub.durationFormatted || '--'}</span></td>
                <td><b>${sub.percentage}%</b> (${sub.score}/${sub.totalQuestions})</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                        <button class="btn" style="margin:0; padding:4px 8px; font-size:11px;" onclick="viewSubmissionDetails('${subId}')">🔎 Details</button>
                        <button class="btn" style="margin:0; padding:4px 8px; font-size:11px; background:rgba(245,158,11,0.15); color:var(--warning); border:1px solid var(--warning); font-weight:700;" onclick="allowExamRetake('${sub.userId}', '${sub.examId}', '${subId}')" title="Prüfung für Mitarbeiter zur Wiederholung füreischalten">🔄 Wiederholen</button>
                        <button class="btn-delete-row" onclick="deleteExamSubmission('${subId}')" title="Ergebnis löschen">🗑️</button>
                    </div>
                </td>
            </tr>`;
        });
    }

    function viewSubmissionDetails(subId) {
        if(!cachedSubmissions || !cachedSubmissions[subId]) return;
        const sub = cachedSubmissions[subId];

        const modal = document.getElementById('submissionDetailsModal');
        if(!modal) return;

        document.getElementById('subModalTitle').textContent = `📋 Auswertung: ${sub.examTitle || 'Prüfung'}`;

        const statusBadge = sub.passed 
            ? `<span style="color:var(--success); font-weight:800;">Bestanden ✔ (${sub.percentage}%)</span>`
            : `<span style="color:var(--danger); font-weight:800;">Nicht bestanden ✖ (${sub.percentage}%)</span>`;

        document.getElementById('subModalHeaderInfo').innerHTML = `
            <div>👤 Prüfling: <b style="color:var(--text-main);">${sub.userName || '--'}</b> (${sub.userDN || 'Keine DN'})</div>
            <div>👨‍🏫 Prüfer: <b style="color:var(--warning);">${sub.prueferDN || 'Keine DN'}</b></div>
            <div>⏱️ Bearbeitungszeit: <b style="color:var(--warning);">${sub.durationFormatted || '--'}</b></div>
            <div>📊 Status: ${statusBadge}</div>
            <div>📅 Datum: <b style="color:var(--text-muted);">${sub.datum || '--'}</b></div>
        `;

        const actionsDiv = document.getElementById('subModalActions');
        if (actionsDiv) {
            actionsDiv.innerHTML = `
            <button class="btn" style="background:var(--warning); color:#080c14; font-weight:800; width:auto; padding:8px 18px; font-size:12px;" onclick="allowExamRetake('${sub.userId}', '${sub.examId}', '${subId}')">🔄 Prüfung zur Wiederholung füreischalten</button>
            `;
        }

        const qBody = document.getElementById('subModalQuestionsBody');
        qBody.innerHTML = "";

        (sub.details || []).forEach((d, idx) => {
            if (d.isInfo) {
                qBody.innerHTML += `
                <div style="background:rgba(30,41,59,0.4); border:1px solid rgba(56,189,248,0.3); border-radius:12px; padding:14px; text-align:left;">
                    <div style="font-weight:700; font-size:13px; color:var(--primary);">
                        ℹ️ ${d.questionText}
                    </div>
                    <div style="font-size:12px; color:var(--text-main); margin-top:6px;">
                        Eingabe: <b>${(d.selectedOptions || []).join(', ') || 'Keine Angabe'}</b>
                    </div>
                </div>`;
                return;
            }
            if (d.isFreeText) {
                qBody.innerHTML += `
                <div style="background:rgba(30,41,59,0.4); border:1px solid rgba(168,85,247,0.3); border-radius:12px; padding:14px; text-align:left;">
                    <div style="font-weight:700; font-size:13px; color:#a855f7;">
                        📝 Freitext: ${d.questionText}
                    </div>
                    <div style="font-size:12px; color:var(--text-main); margin-top:6px; white-space:pre-wrap;">
                        Antwort: <i>${(d.selectedOptions || []).join('\n') || 'Keine Antwort'}</i>
                    </div>
                </div>`;
                return;
            }

            const isCorrect = d.isCorrect === true;
            const ptsLabel = d.earnedPoints !== undefined ? ` (${d.earnedPoints}/${d.maxPoints} Pkt)` : '';
            qBody.innerHTML += `
            <div style="background:rgba(30,41,59,0.4); border:1px solid ${isCorrect ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}; border-radius:12px; padding:14px; text-align:left;">
                <div style="font-weight:700; font-size:13px; color:${isCorrect ? 'var(--success)' : 'var(--danger)'}; display:flex; gap:8px;">
                    <span>${isCorrect ? '✔ Richtig' : '✖ Falsch'}</span>
                    <span>- Frage ${idx + 1}: ${d.questionText}${ptsLabel}</span>
                </div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:6px;">
                    Gegebene Antwort: <b style="color:var(--text-main);">${(d.selectedOptions || []).join(', ') || 'Keine Antwort'}</b>
                </div>
                ${(!isCorrect && d.correctOptions && d.correctOptions.length > 0) ? `<div style="font-size:12px; color:var(--success); margin-top:4px;">Richtige Lösung: <b>${(d.correctOptions || []).join(', ')}</b></div>` : ''}
            </div>`;
        });

        modal.style.display = 'flex';
    }

    function closeSubmissionDetailsModal() {
        const modal = document.getElementById('submissionDetailsModal');
        if(modal) modal.style.display = 'none';
    }

    function viewExamPreviewModal(examId) {
        const exam = cachedExams && cachedExams[examId];
        if (!exam) {
            alert("Prüfung nicht gefunden!");
            return;
        }

        const modal = document.getElementById('examPreviewModal');
        if (!modal) return;

        document.getElementById('examPreviewModalTitle').textContent = `👁️ Prüfung Einsehen: ${exam.title}`;

        document.getElementById('examPreviewModalHeaderInfo').innerHTML = `
            <div>📁 Kategorie: <b style="color:var(--primary);">${exam.kat || 'Allgemein'}</b></div>
            <div>⏱️ Zeitlimit: <b style="color:var(--warning);">${exam.timeLimitMinutes || 30} Minuten</b></div>
            <div>🎯 Mindestquote: <b style="color:var(--success);">${exam.passPercentage || 60}%</b></div>
            <div>❓ Fragen: <b style="color:var(--text-main);">${exam.questions ? exam.questions.length : 0}</b></div>
            ${exam.introText ? `<div style="width:100%; margin-top:6px; font-size:12px; color:var(--text-muted); white-space:pre-wrap;"><b>Einleitungstext:</b> ${exam.introText}</div>` : ''}
        `;

        const qBody = document.getElementById('examPreviewModalQuestionsBody');
        qBody.innerHTML = "";

        (exam.questions || []).forEach((q, idx) => {
            const qType = q.type || 'choice';
            let detailsHtml = "";

            if (['info_dn', 'info_pruefer', 'info_name'].includes(qType)) {
                detailsHtml = `<div style="font-size:12px; color:var(--text-muted); margin-top:4px;"><i>Standard-Eingabefeld (${qType})</i></div>`;
            } else if (qType === 'text') {
                detailsHtml = `<div style="font-size:12px; color:#a855f7; margin-top:4px;"><i>Freitextfürage (ohne automatische Bewertung)</i></div>`;
            } else {
                const correctIndices = q.correctAnswers || [];
                const optionsHtml = (q.options || []).map((opt, oIdx) => {
                    const isCorrect = correctIndices.includes(oIdx);
                    const pts = q.points ? q.points[oIdx] : undefined;
                    const ptsLabel = pts !== undefined ? ` <span style="color:var(--warning); font-size:11px;">(${pts} Pkt)</span>` : '';
                    return `
                    <div style="font-size:12px; padding:6px 10px; border-radius:6px; background:${isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(15,23,42,0.5)'}; border:1px solid ${isCorrect ? 'var(--success)' : 'var(--border)'}; margin-top:4px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:${isCorrect ? 'var(--success)' : 'var(--text-main)'}; font-weight:${isCorrect ? '700' : '500'};">${isCorrect ? '✔ ' : '• '}${opt}${ptsLabel}</span>
                        ${isCorrect ? '<span style="font-size:10px; font-weight:800; color:var(--success); background:rgba(16,185,129,0.2); padding:2px 8px; border-radius:4px;">Richtige Antwort</span>' : ''}
                    </div>`;
                }).join('');
                detailsHtml = `<div style="margin-top:6px;">${optionsHtml}</div>`;
            }

            qBody.innerHTML += `
            <div style="background:rgba(30,41,59,0.4); border:1px solid var(--border); border-radius:12px; padding:14px; text-align:left;">
                <div style="font-weight:700; font-size:13px; color:var(--primary);">
                    Frage ${idx + 1}: ${q.text}
                </div>
                ${detailsHtml}
            </div>`;
        });

        modal.style.display = 'flex';
    }

    function closeExamPreviewModal() {
        const modal = document.getElementById('examPreviewModal');
        if (modal) modal.style.display = 'none';
    }

    let hasCorrectedExamsThisSession = false;
    function korrigiereAlleBisherigenPruefungen(silent = false) {
        if (silent && hasCorrectedExamsThisSession) return;
        if (!cachedSubmissions) return;

        const updates = {};
        let updatedSubmissionsCount = 0;
        let updatedUsersCount = 0;

        // 1. Audit and correct all submissions
        Object.keys(cachedSubmissions).forEach(subKey => {
            const sub = cachedSubmissions[subKey];
            if (!sub) return;
            const exam = cachedExams[sub.examId];
            const passTargetPercent = (exam && exam.passPercentage) ? Number(exam.passPercentage) : 60;
            
            let percentage = Number(sub.percentage);
            if (isNaN(percentage)) {
                const earned = Number(sub.score) || 0;
                const total = Number(sub.totalQuestions) || 1;
                percentage = Math.round((earned / total) * 100);
                updates[`data/examSubmissions/${subKey}/percentage`] = percentage;
                sub.percentage = percentage;
            }

            const isActuallyPassed = percentage >= passTargetPercent;
            if (sub.passed !== isActuallyPassed) {
                updates[`data/examSubmissions/${subKey}/passed`] = isActuallyPassed;
                sub.passed = isActuallyPassed;
                updatedSubmissionsCount++;
            }
        });

        // 2. Reconcile user passedExams based on true latest exam submissions
        if (cachedUsers) {
            Object.keys(cachedUsers).forEach(uId => {
                const u = cachedUsers[uId];
                if (!u) return;
                const myCleanId = (u.vorname + "_" + u.nachname).toLowerCase().replace(/[^a-z0-9_]/g, "");

                // Check all exams the user took
                Object.keys(cachedExams).forEach(eId => {
                    const userSubs = Object.values(cachedSubmissions).filter(s => s.userId === myCleanId && s.examId === eId);
                    if (userSubs.length > 0) {
                        const exam = cachedExams[eId];
                        const passTargetPercent = (exam && exam.passPercentage) ? Number(exam.passPercentage) : 60;
                        const anyPassed = userSubs.some(s => (s.passed === true) || (Number(s.percentage) >= passTargetPercent));
                        const currentPassedStatus = u.passedExams && u.passedExams[eId] === true;

                        if (anyPassed && !currentPassedStatus) {
                            updates[`data/users/${uId}/passedExams/${eId}`] = true;
                            if (u.passedExams) u.passedExams[eId] = true;
                            updatedUsersCount++;
                        }
                    }
                });
            });
        }

        if (Object.keys(updates).length > 0) {
            db.ref().update(updates).then(() => {
                hasCorrectedExamsThisSession = true;
                if (!silent) {
                    alert(`✅ Korrektur erfolgreich abgeschlossen!\n\n• ${updatedSubmissionsCount} Prüfungsergebnisse wurden auf die Mindestquote korrigiert.\n• ${updatedUsersCount} Mitarbeiter-Prüfungsstatus wurden angepasst.`);
                }
                renderExamTab(cachedExams, cachedUsers, cachedSubmissions);
            });
        } else {
            hasCorrectedExamsThisSession = true;
            if (!silent) {
                alert("ℹ️ Alle bisherigen Prüfungsergebnisse und Freigaben entsprechen bereits exakt den Mindestquoten.");
            }
        }
    }

    function standardPruefungenWiederherstellen() {
        if (!sessionUser) return;
        const eff = getUserEffectivePermissions(sessionUser);
        if (!eff.isAdmin && !eff.isMasterAdmin && !eff.canManageInstructors) {
            alert("⛔ Sie besitzen keine Berechtigung zum Zurücksetzen/Aktualisieren des Prüfungskatalogs!");
            return;
        }

        if (confirm("Möchtest du den offiziellen Standard-Prüfungskatalog (GA1, GA2, DV1, DV2, Paramedic 1 & 2, Arzt 1 & 2) aktualisieren und in die richtige Standard-Reihenfolge bringen?")) {
            const updates = {};
            Object.keys(defaultExams).forEach(eId => {
                updates[`data/exams/${eId}`] = defaultExams[eId];
            });
            updates['data/exams/exam_ehk'] = null;
            updates['data/exams/exam_cls'] = null;
            updates['data/exams/exam_psgu'] = null;
            updates['data/exams/exam_dv1'] = null;
            updates['data/exams/exam_dv2'] = null;
            updates['data/exams/exam_para3'] = null;
            updates['data/exams/exam_arzt3'] = null;
            updates['data/examOrder'] = null;

            db.ref().update(updates).then(() => {
                alert("✅ Der offizielle Prüfungskatalog wurde erfolgreich aktualisiert und geordnet!");
                delete cachedExams.exam_ehk;
                delete cachedExams.exam_cls;
                delete cachedExams.exam_psgu;
                delete cachedExams.exam_dv1;
                delete cachedExams.exam_dv2;
                delete cachedExams.exam_para3;
                delete cachedExams.exam_arzt3;
                cachedExams = Object.assign({}, defaultExams, cachedExams);
                cachedExamOrder = [];
                renderExamTab(cachedExams, cachedUsers, cachedSubmissions);
            });
        }
    }

    function renderInstructorExistingExams(exams) {
        const container = document.getElementById('instructorExistingExamsList');
        if(!container) return;
        container.innerHTML = "";

        let eIds = Object.keys(exams).filter(eId => isExamAllowedForInstructor(eId));
        eIds = sortExamIdsDynamically(eIds, exams);

        const eff = sessionUser ? getUserEffectivePermissions(sessionUser) : { isAdmin: false, isMasterAdmin: false, canManageInstructors: false };
        const canManageAny = eff.isAdmin || eff.isMasterAdmin || eff.canManageInstructors || sessionUser?.canCreateExams === true;

        // Hide/show the exam builder editor form for non-managers
        const builderHeading = document.getElementById('examBuilderHeading');
        const builderBox = builderHeading ? builderHeading.closest('div') : null;
        if (builderBox) {
            builderBox.style.display = canManageAny ? 'block' : 'none';
        }

        const manageTabBtn = document.querySelector('#examInstructorView button[onclick*="instrTabManage"]');
        if (manageTabBtn) {
            manageTabBtn.textContent = canManageAny ? '📝 Prüfungen verwalten / anlegen' : '👁️ Prüfungen einsehen';
        }

        eIds.forEach(eId => {
            const exam = exams[eId];
            const canManageThis = isExamAllowedToManage(sessionUser, eId);
            const actionButtons = canManageThis
                ? `<button class="btn" style="width:auto; padding:5px 12px; font-size:12px; background:rgba(56,189,248,0.15); color:var(--primary); border:1px solid var(--primary); font-weight:700;" onclick="editExamInBuilder('${eId}')">✏️ Bearbeiten</button>
                   <button class="btn" style="width:auto; padding:5px 12px; font-size:12px; background:rgba(168,85,247,0.15); color:#a855f7; border:1px solid #a855f7; font-weight:700;" onclick="viewExamPreviewModal('${eId}')">👁️ Einsehen</button>
                   <button class="btn-delete-row" onclick="deleteCloudExam('${eId}')">🗑️</button>`
                : `<button class="btn" style="width:auto; padding:5px 14px; font-size:12px; background:rgba(168,85,247,0.15); color:#a855f7; border:1px solid #a855f7; font-weight:700;" onclick="viewExamPreviewModal('${eId}')">👁️ Prüfung Einsehen</button>`;

            container.innerHTML += `
            <div class="draggable-item" data-id="${eId}" style="background:rgba(15,23,42,0.6); border:1px solid var(--border); padding:12px 18px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    ${canManageAny ? '<span style="font-size:13px; color:var(--text-muted); margin-right:8px; cursor:grab;" title="Verschieben">☰</span>' : ''}
                    <b style="color:var(--text-main); font-size:14px;">${exam.title}</b> 
                    <span style="font-size:12px; color:var(--text-muted); margin-left:10px;">(${exam.kat || 'Allgemein'} | ❓ <b>${exam.questions ? exam.questions.length : 0} Fragen</b> | ⏱️ ${exam.timeLimitMinutes} Min)</span>
                </div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    ${actionButtons}
                </div>
            </div>`;
        });

        // Initialize drag and drop reordering only for users who can manage
        if (canManageAny) {
            makeContainerSortable('instructorExistingExamsList', '.draggable-item', saveExamOrder);
        }
    }

    function onQuestionTypeChange(selectEl) {
        const card = selectEl.closest('.builder-q-card');
        const qType = selectEl.value;
        const optionsSection = card.querySelector('.builder-options-section');
        const optionsList = card.querySelector('.builder-options-list');
        
        if (['choice', 'checkbox_weighted'].includes(qType)) {
            optionsSection.style.display = 'block';
            if (optionsList.children.length === 0) {
                addExamOptionRow(optionsList, "", true, 0, qType);
                addExamOptionRow(optionsList, "", false, 0, qType);
            } else {
                optionsList.querySelectorAll('.builder-opt-row').forEach(row => {
                    const cbCont = row.querySelector('.builder-opt-correct-container');
                    const ptsCont = row.querySelector('.builder-opt-points-container');
                    if (cbCont && ptsCont) {
                        cbCont.style.display = qType === 'choice' ? 'block' : 'none';
                        ptsCont.style.display = qType === 'checkbox_weighted' ? 'block' : 'none';
                    }
                });
            }
        } else {
            optionsSection.style.display = 'none';
        }
    }

    function addExamQuestionRow(qData = null) {
        const builder = document.getElementById('examQuestionsListBuilder');
        if(!builder) return;

        const qIdx = builder.children.length + 1;
        const qDiv = document.createElement('div');
        qDiv.className = 'builder-q-card';
        qDiv.style.cssText = 'background:rgba(30,41,59,0.5); border:1px solid var(--border); border-radius:12px; padding:14px; position:relative; margin-bottom: 12px;';

        const qText = qData ? qData.text : "";
        const qType = qData ? (qData.type || "choice") : "choice";
        const options = qData ? (qData.options || []) : (['choice', 'checkbox_weighted'].includes(qType) ? ["", ""] : []);
        const correctAnswers = qData ? (qData.correctAnswers || []) : [0];
        const points = qData ? (qData.points || []) : [];

        qDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <b style="color:var(--primary); font-size:13px;">Frage #${qIdx}</b>
                <button class="btn-delete-row" style="padding:2px 6px; font-size:11px;" onclick="this.closest('.builder-q-card').remove(); updateQuestionsCountDisplay();">🗑️ Frage löschen</button>
            </div>
            
            <div style="display:grid; grid-template-columns: 1für 1für; gap:12px; margin-bottom:10px;">
                <div>
                    <label style="font-size:11px; margin-bottom:4px; display:block;">Label / Fragetext:</label>
                    <input type="text" class="builder-q-text" value="${qText.replace(/"/g, '&quot;')}" placeholder="Fragetext..." style="font-weight:700;">
                </div>
                <div>
                    <label style="font-size:11px; margin-bottom:4px; display:block;">Fragentyp:</label>
                    <select class="builder-q-type" onchange="onQuestionTypeChange(this)" style="padding:6px; font-size:12px; border-radius:8px; border:1px solid var(--border); background:rgba(15,23,42,0.8); color:var(--text-main); width:100%;">
                        <option value="choice" ${qType === 'choice' ? 'selected' : ''}>Einfach-/Mehrfachauswahl</option>
                        <option value="text" ${qType === 'text' ? 'selected' : ''}>Freitext (ohne Bewertung)</option>
                        <option value="checkbox_weighted" ${qType === 'checkbox_weighted' ? 'selected' : ''}>Ankreuzen mit Punktegewichtung</option>
                        <option value="info_dn" ${qType === 'info_dn' ? 'selected' : ''}>Dienstnummer (Standardfeld)</option>
                        <option value="info_pruefer" ${qType === 'info_pruefer' ? 'selected' : ''}>Dienstnummer des Prüfers (Standardfeld)</option>
                        <option value="info_name" ${qType === 'info_name' ? 'selected' : ''}>Vor- und Nachname (Standardfeld)</option>
                    </select>
                </div>
            </div>

            <div class="builder-options-section" style="display:${['choice', 'checkbox_weighted'].includes(qType) ? 'block' : 'none'};">
                <div style="margin-bottom:6px; font-size:11px; color:var(--text-muted); font-weight:700;">Antwortmöglichkeiten:</div>
                <div class="builder-options-list" style="display:flex; flex-direction:column; gap:6px;"></div>
                <button class="btn" style="width:auto; padding:4px 10px; font-size:11px; margin-top:8px; background:rgba(255,255,255,0.06); color:var(--text-muted);" onclick="addExamOptionRow(this.previousElementSibling, '', false, 0, this.closest('.builder-q-card').querySelector('.builder-q-type').value)">➕ Antwort hinzufügen</button>
            </div>
        `;

        const optsContainer = qDiv.querySelector('.builder-options-list');
        options.forEach((optText, oIdx) => {
            const isChecked = correctAnswers.includes(oIdx);
            const pts = points[oIdx] || 0;
            addExamOptionRow(optsContainer, optText, isChecked, pts, qType);
        });

        builder.appendChild(qDiv);
        updateQuestionsCountDisplay();
    }

    function addExamOptionRow(container, optText = "", isCorrect = false, pts = 0, qType = "choice") {
        if(!container) return;
        const optDiv = document.createElement('div');
        optDiv.className = 'builder-opt-row';
        optDiv.style.cssText = 'display:flex; align-items:center; gap:8px; margin-top:4px;';
        optDiv.innerHTML = `
            <div class="builder-opt-correct-container" style="display:${qType === 'choice' ? 'block' : 'none'};">
                <label style="margin:0; display:flex; align-items:center; gap:4px; cursor:pointer;" title="Als richtige Antwort markieren">
                    <input type="checkbox" class="builder-opt-correct" ${isCorrect ? 'checked' : ''} style="margin:0;">
                    <span style="font-size:11px; color:var(--success); font-weight:700;">Richtig</span>
                </label>
            </div>
            <div class="builder-opt-points-container" style="display:${qType === 'checkbox_weighted' ? 'block' : 'none'};">
                <input type="number" class="builder-opt-points" value="${pts}" style="width:70px; padding:6px; font-size:11px; border-radius:6px; border:1px solid var(--border); background:rgba(15,23,42,0.8); color:var(--text-main);" placeholder="Punkte">
            </div>
            <input type="text" class="builder-opt-text" value="${optText.replace(/"/g, '&quot;')}" placeholder="Antwortmöglichkeit..." style="flex:1; padding:6px; font-size:12px;">
            <button class="btn-delete-row" style="padding:4px 8px;" onclick="this.closest('.builder-opt-row').remove()">🗑️</button>
        `;
        container.appendChild(optDiv);
    }

    function updateQuestionsCountDisplay() {
        const builder = document.getElementById('examQuestionsListBuilder');
        const display = document.getElementById('examQuestionsCountDisplay');
        if(builder && display) display.textContent = builder.children.length;
    }

    function parseBulkQuestionsText() {
        const raw = document.getElementById('examBulkTextarea').value;
        if(!raw.trim()) { alert("Bitte füge zuerst Text in das Massen-Import Feld ein!"); return; }

        const lines = raw.split('\n');
        let currentQ = null;
        let questions = [
            { type: 'info_dn', text: 'Dienstnummer des Mitarbeiters', options: [], correctAnswers: [] },
            { type: 'info_pruefer', text: 'Dienstnummer des Prüfers', options: [], correctAnswers: [] },
            { type: 'info_name', text: 'Vor- und Nachname des Mitarbeiters', options: [], correctAnswers: [] }
        ];

        lines.forEach(line => {
            let l = line.trim();
            if(!l) return;

            if(l.toLowerCase().startsWith('fürage') || /^\d+[\.\)]/.test(l)) {
                if(currentQ && currentQ.options.length > 0) questions.push(currentQ);
                let text = l.replace(/^fürage\s*\d*\s*[:\-\.]?\s*/i, '').replace(/^\d+[\.\)]\s*/, '').trim();
                currentQ = { type: 'choice', text: text || l, options: [], correctAnswers: [] };
            } else if(currentQ) {
                let isCorrect = l.startsWith('*') || l.toLowerCase().includes('(richtig)') || l.toLowerCase().includes('[richtig]');
                let cleanOpt = l.replace(/^[\*\-\•]\s*/, '').replace(/^[A-Z][\.\)]\s*/i, '').replace(/\(richtig\)/gi, '').replace(/\[richtig\]/gi, '').trim();
                if(cleanOpt) {
                    currentQ.options.push(cleanOpt);
                    if(isCorrect) {
                        currentQ.correctAnswers.push(currentQ.options.length - 1);
                    }
                }
            }
        });
        if(currentQ && currentQ.options.length > 0) questions.push(currentQ);

        const builder = document.getElementById('examQuestionsListBuilder');
        if(builder) builder.innerHTML = "";

        questions.forEach(q => {
            if(q.type === 'choice' && q.correctAnswers.length === 0 && q.options.length > 0) {
                q.correctAnswers = [0];
            }
            addExamQuestionRow(q);
        });

        document.getElementById('examBulkTextarea').value = "";
        alert(`✅ Erfolgreich ${questions.length - 3} Fragen aufbereitet! Standard-Felder wurden automatisch vorangestellt.`);
    }

    function neuePruefungSpeichern() {
        if(!isUserInstructor()) return;

        const title = document.getElementById('newExamTitle').value.trim();
        const kat = document.getElementById('newExamKat').value.trim() || "Grundausbildung";
        const timeLimit = parseInt(document.getElementById('newExamTime').value) || 30;
        const passRate = parseInt(document.getElementById('newExamPassRate').value) || 60;
        const passScore = parseInt(document.getElementById('newExamPassScore').value) || 15;
        const introText = document.getElementById('newExamIntroText').value.trim();

        if(!title) { alert("Bitte einen Prüfungstitel eingeben!"); return; }

        const builder = document.getElementById('examQuestionsListBuilder');
        const qCards = builder ? builder.querySelectorAll('.builder-q-card') : [];

        let questions = [];
        qCards.forEach((card, qIdx) => {
            const qText = card.querySelector('.builder-q-text').value.trim();
            const qType = card.querySelector('.builder-q-type').value;
            const optRows = card.querySelectorAll('.builder-options-list > .builder-opt-row');
            let options = [];
            let correctAnswers = [];
            let points = [];

            optRows.forEach((optRow, oIdx) => {
                const optText = optRow.querySelector('.builder-opt-text').value.trim();
                const isChecked = optRow.querySelector('.builder-opt-correct').checked;
                const pts = parseInt(optRow.querySelector('.builder-opt-points').value) || 0;
                if(optText || ['choice', 'checkbox_weighted'].indexOf(qType) === -1) {
                    options.push(optText || "");
                    if(isChecked) correctAnswers.push(options.length - 1);
                    points.push(pts);
                }
            });

            if(qText) {
                questions.push({
                    id: qIdx + 1,
                    text: qText,
                    type: qType,
                    options: options,
                    correctAnswers: correctAnswers,
                    points: points
                });
            }
        });

        if(questions.length === 0) {
            alert("⚠️ Bitte füge mindestens 1 Frage zur Prüfung hinzu!");
            return;
        }

        let existingId = document.getElementById('editingExamId').value;
        const eff = getUserEffectivePermissions(sessionUser);
        if (!existingId) {
            if (!eff.isAdmin && !eff.isMasterAdmin && !eff.canManageInstructors && sessionUser.canCreateExams !== true) {
                alert("⛔ Sie besitzen keine Berechtigung zum Anlegen neuer Prüfungen!");
                return;
            }
        } else {
            if (!isExamAllowedToManage(sessionUser, existingId)) {
                alert("⛔ Sie besitzen keine Berechtigung zum Bearbeiten dieser Prüfung!");
                return;
            }
        }
        const examId = existingId || ("exam_" + Date.now());

        const examData = {
            id: examId,
            title: title,
            kat: kat,
            timeLimitMinutes: timeLimit,
            passPercentage: passRate,
            passScore: passScore,
            introHeader: title,
            introText: introText,
            questions: questions
        };

        db.ref("data/exams/" + examId).set(examData).then(() => {
            logSystemActivity('Prüfung gespeichert', `Die Prüfung '${title}' (${kat}) wurde erstellt/bearbeitet.`);
            alert(`✅ Prüfung "${title}" mit ${questions.length} Fragen erfolgreich in der Cloud gespeichert!`);
            resetExamBuilderForm();
        });
    }

    function editExamInBuilder(examId) {
        if(!cachedExams || !cachedExams[examId]) return;
        const exam = cachedExams[examId];

        document.getElementById('editingExamId').value = exam.id;
        document.getElementById('newExamTitle').value = exam.title || "";
        document.getElementById('newExamKat').value = exam.kat || "";
        document.getElementById('newExamTime').value = exam.timeLimitMinutes || 30;
        document.getElementById('newExamPassRate').value = exam.passPercentage || 60;
        document.getElementById('newExamPassScore').value = exam.passScore || 15;
        document.getElementById('newExamIntroText').value = exam.introText || "";

        const builder = document.getElementById('examQuestionsListBuilder');
        if(builder) builder.innerHTML = "";

        (exam.questions || []).forEach(q => {
            addExamQuestionRow(q);
        });

        document.getElementById('examBuilderHeading').textContent = `✏️ Prüfung bearbeiten: ${exam.title}`;
        document.getElementById('instrTabManage').scrollIntoView({ behavior: 'smooth' });
    }

    function resetExamBuilderForm() {
        document.getElementById('editingExamId').value = "";
        document.getElementById('newExamTitle').value = "";
        document.getElementById('newExamKat').value = "Grundausbildung";
        document.getElementById('newExamTime').value = "30";
        document.getElementById('newExamPassRate').value = "60";
        document.getElementById('newExamPassScore').value = "15";
        document.getElementById('newExamIntroText').value = "";
        document.getElementById('examBulkTextarea').value = "";

        const builder = document.getElementById('examQuestionsListBuilder');
        if(builder) {
            builder.innerHTML = "";
            addExamQuestionRow({ type: 'info_dn', text: 'Dienstnummer des Mitarbeiters' });
            addExamQuestionRow({ type: 'info_pruefer', text: 'Dienstnummer des Prüfers' });
            addExamQuestionRow({ type: 'info_name', text: 'Vor- und Nachname des Mitarbeiters' });
        }

        document.getElementById('examBuilderHeading').innerHTML = "📝 Prüfungs-Editor <span style=\"font-size:12px; color:var(--text-muted); font-weight:normal;\">(Ein-/Ausklappen)</span>";
        updateQuestionsCountDisplay();
    }

    function deleteCloudExam(examId) {
        if(!isUserInstructor()) return;
        if(!isExamAllowedToManage(sessionUser, examId)) {
            alert("⛔ Sie besitzen keine Berechtigung zum Löschen dieser Prüfung!");
            return;
        }
        if(confirm("Möchtest du diese Prüfung wirklich unwiderruflich löschen?")) {
            const e = cachedExams[examId] || {}; logSystemActivity('Prüfung gelöscht', `Die Prüfung '${e.title || examId}' wurde unwiderruflich gelöscht.`); db.ref("data/exams/" + examId).remove();
        }
    }
    
    function resetChecklisteSteps() {
        const container = document.getElementById('checklisteContainer');
        if (!container) return;
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
            if (cb.parentNode) cb.parentNode.classList.remove('completed');
        });
    }

    function stepVerletzungenAnzahl(amount) { 
        anzahlVerletzungenFall = Math.max(1, anzahlVerletzungenFall + amount); 
        document.getElementById('val_pVerletzungenAnzahl').textContent = anzahlVerletzungenFall; 
        let gS = document.getElementById('verletzungSelect').value; 
        if(gS) { 
            let template = szenarioTemplates[gS] || {}; 
            for(let key in materialKatalog) { 
                if(key !== 'mat_wasser') fallMaterial[key] = (template[key] || 0) * anzahlVerletzungenFall; 
            } 
            recalcCosts(); 
        } 
        const resetBox = document.getElementById('checklisteMultiResetBox');
        if (resetBox) {
            resetBox.style.display = (anzahlVerletzungenFall >= 2 && gS) ? 'block' : 'none';
        }
    }
    function stepMat(id, amount) { fallMaterial[id] = Math.max(0, (fallMaterial[id] || 0) + amount); recalcCosts(); }
    function checkWasserAutomatik() { let summeMeds = 0; for(let k in materialKatalog) { if(materialKatalog[k].isMeds) summeMeds += (fallMaterial[k] || 0); } fallMaterial.mat_wasser = summeMeds; }
    function recalcCosts() { checkWasserAutomatik(); aktuellerFallKosten = 0; for (let key in fallMaterial) { if(materialKatalog[key]) aktuellerFallKosten += fallMaterial[key] * materialKatalog[key].preis; } for(let key in materialKatalog) { if(document.getElementById('val_' + key)) document.getElementById('val_' + key).textContent = fallMaterial[key] || 0; } document.getElementById('val_mat_wasser').textContent = fallMaterial.mat_wasser; document.getElementById('val_pKosten').textContent = "$" + aktuellerFallKosten.toLocaleString(); }
    function stepKosten(amount) { aktuellerFallKosten = Math.max(0, aktuellerFallKosten + amount); document.getElementById('val_pKosten').textContent = "$" + aktuellerFallKosten.toLocaleString(); }
    
    function ladeCheckliste() { 
        const select = document.getElementById('verletzungSelect'); 
        const container = document.getElementById('checklisteContainer'); 
        const gV = select.value; 
        container.innerHTML = ""; 
        if (!gV || !medicDatenbank[gV]) { 
            container.innerHTML = '<p style="color: var(--text-muted); font-size:12px;">Wähle links ein Szenario aus, um die Schritte zu sehen.</p>'; 
            return; 
        } 
        for(let key in materialKatalog) fallMaterial[key] = 0; 
        let template = szenarioTemplates[gV] || {}; 
        for(let key in template) fallMaterial[key] = template[key] * anzahlVerletzungenFall; 
        recalcCosts(); 
        
        let stepsHtml = "";
        medicDatenbank[gV].forEach((schritt, index) => { 
            stepsHtml += `<div class="todo-item"><input type="checkbox" id="step-${index}" onclick="this.parentNode.classList.toggle('completed')"><label style="margin:0; cursor:pointer;" for="step-${index}">Schritt ${index + 1}: ${schritt}</label></div>`; 
        }); 

        let resetBtnHtml = `
        <div id="checklisteMultiResetBox" style="display:${anzahlVerletzungenFall >= 2 ? 'block' : 'none'}; margin-top:12px; padding-top:10px; border-top:1px dashed rgba(245,158,11,0.3); text-align:center;">
            <button class="btn" style="background:rgba(245,158,11,0.15); color:var(--warning); border:1px solid var(--warning); font-size:12px; font-weight:800; padding:8px 16px; width:100%; border-radius:8px;" onclick="resetChecklisteSteps()">🔄 Häkchen für nächste Verletzung zurücksetzen</button>
        </div>`;

        container.innerHTML = stepsHtml + resetBtnHtml;
    }
    
    function patientHinzufuegen() { 
        if(!sessionUser) return; 
        const v = document.getElementById('verletzungSelect').value; 
        if (!v) { alert("Bitte Szenario wählen!"); return; } 
        let pNL = document.getElementById('pName').value.trim(); 
        if (!pNL) pNL = "Patient " + ((Number(daten.patienten) || 0) + 1); 
        const hD = new Date().toLocaleDateString('de-DE'); 
        let nP = (Number(daten.patienten) || 0) + 1; 
        let nV = (Number(daten.verletzungen) || 0) + Number(anzahlVerletzungenFall); 
        let nA = (Number(daten.ausgaben) || 0) + Number(aktuellerFallKosten); 
        let uP = { patienten: nP, verletzungen: nV, ausgaben: nA }; 
        Object.keys(materialKatalog).forEach(key => { uP[key] = (Number(daten[key]) || 0) + (Number(fallMaterial[key]) || 0); }); 
        const lP = { name: pNL, szenario: v, count: Number(anzahlVerletzungenFall), cash: Number(aktuellerFallKosten), medicName: sessionUser.vorname + " " + sessionUser.nachname, datum: hD, matVerbrauch: JSON.parse(JSON.stringify(fallMaterial)) }; 
        db.ref("data/protokoll").push(lP); 
        db.ref("data/daten").set(uP).then(() => { 
            resetChecklisteSteps();
            document.getElementById('verletzungSelect').value = ""; 
            document.getElementById('checklisteContainer').innerHTML = '<p style="color: var(--text-muted); font-size:12px;">Wähle links ein Szenario aus, um die Schritte zu sehen.</p>'; 
            anzahlVerletzungenFall = 1; 
            document.getElementById('val_pVerletzungenAnzahl').textContent = 1; 
            document.getElementById('pName').value = ""; 
            for(let key in materialKatalog) fallMaterial[key] = 0; 
            setDynamischenPatientenNamen(); 
            recalcCosts(); 
            alert("Erfolgreich live verbucht!"); 
        }); 
    }

    function schnellBehandlungBuchen() {
        if(!sessionUser) return;
        let pNL = document.getElementById('pName').value.trim();
        if (!pNL) pNL = "Patient " + ((Number(daten.patienten) || 0) + 1);
        const hD = new Date().toLocaleDateString('de-DE');
        
        let quickMat = { mat_verband: 1, mat_wasser: 1 };
        let quickKosten = (materialKatalog.mat_verband?.preis || 200) + (materialKatalog.mat_wasser?.preis || 200);

        let nP = (Number(daten.patienten) || 0) + 1;
        let nV = (Number(daten.verletzungen) || 0) + 1;
        let nA = (Number(daten.ausgaben) || 0) + quickKosten;
        
        let uP = { patienten: nP, verletzungen: nV, ausgaben: nA };
        Object.keys(materialKatalog).forEach(key => {
            uP[key] = (Number(daten[key]) || 0) + (quickMat[key] || 0);
        });

        const lP = { name: pNL, szenario: "Schnell-Behandlung", count: 1, cash: quickKosten, medicName: sessionUser.vorname + " " + sessionUser.nachname, datum: hD, matVerbrauch: quickMat };
        db.ref("data/protokoll").push(lP);
        db.ref("data/daten").set(uP).then(() => {
            document.getElementById('pName').value = "";
            setDynamischenPatientenNamen();
            alert("⚡ Schnell-Behandlung gebucht!");
        });
    }

    function speicherePreise() { for(let key in materialKatalog) materialKatalog[key].preis = parseFloat(document.getElementById(`setPrice_${key}`).value) || 0; db.ref("data/materialKatalog").set(materialKatalog); alert("Preise global synchronisiert!"); }
    
    function tagesstatistikZuruecksetzen() { 
        if(!sessionUser) return;
        const eff = getUserEffectivePermissions(sessionUser);
        if(!eff.isAdmin && !eff.isMasterAdmin) {
            alert("⛔ Nur Administratoren dürfen Schichten abschließen und archivieren.");
            return;
        }
        if ((Number(daten.patienten) || 0) === 0 && (Number(daten.ausgaben) || 0) === 0) { 
            alert("Keine aktiven Tagesdaten vorhanden."); 
            return; 
        } 
        if (confirm("Schicht beenden und Tagesdaten archivieren?")) { 
            let dV = {}; 
            Object.keys(materialKatalog).forEach(key => { 
                let verb = Number(daten[key]) || 0; 
                if(verb > 0) dV[materialKatalog[key].name] = verb; 
            }); 
            const aP = { tag: tagesZaehler + " (" + new Date().toLocaleDateString('de-DE') + ")", p: Number(daten.patienten) || 0, v: Number(daten.verletzungen) || 0, cash: Number(daten.ausgaben) || 0, matDetailsObj: dV }; 
            db.ref("data/archiv").push(aP).then(() => { 
                tagesZaehler++; 
                db.ref("data/tagesZaehler").set(tagesZaehler); 
                let rD = { patienten: 0, verletzungen: 0, ausgaben: 0 }; 
                Object.keys(materialKatalog).forEach(key => rD[key] = 0); 
                db.ref("data/daten").set(rD); 
                db.ref("data/protokoll").remove(); 
                alert("Schicht erfolgreich archiviert!"); 
            }); 
        } 
    }
    
    function allesKomplettLoeschen() { 
        if (!sessionUser) return;
        const eff = getUserEffectivePermissions(sessionUser);
        if (!eff.isMasterAdmin) {
            alert("⛔ Zugriff verweigert! Nur der Master-Admin darf einen vollständigen System-Reset durchführen.");
            return;
        }
        if (confirm("🚨 ACHTUNG: Möchtest du wirklich das KOMPLETTE System und alle Daten löschen?") && confirm("Bist du dir absolut sicher? Alle Accounts, Daten und Protokolle gehen unwiderruflich verloren!")) { 
            db.ref("data").remove().then(() => location.reload()); 
        } 
    }
    
    function uiAktualisieren() { 
        document.getElementById('statPatienten').textContent = daten.patienten || 0; 
        document.getElementById('statVerletzungen').textContent = daten.verletzungen || 0; 
        document.getElementById('statAusgaben').textContent = "$" + (Number(daten.ausgaben) || 0).toLocaleString(); 
        const tbody = document.getElementById('tagesVerbrauchTableBody'); 
        if(!tbody) return; 
        tbody.innerHTML = ""; 
        Object.keys(materialKatalog).forEach(key => { 
            tbody.innerHTML += `<tr><td>${materialKatalog[key].name}</td><td style="font-weight:bold; color:var(--primary);">${daten[key] || 0}</td></tr>`; 
        }); 
    }

    function renderLogsAndArchiv(protokoll, archiv) {
        const logBody = document.getElementById('logTableBody'); const archivBody = document.getElementById('archivTableBody'); if(!logBody) return; const sA = (sessionUser && sessionUser.isAdmin); logBody.innerHTML = "";
        if(protokoll) { 
            Object.keys(protokoll).reverse().forEach(k => { 
                const i = protokoll[k]; 
                let canEdit = sA || (sessionUser && i.medicName === (sessionUser.vorname + " " + sessionUser.nachname));
                let editBtns = `
                    <button class="btn-edit-row" onclick="openEditPatientModal('${k}')">✏️</button>
                    ${sA ? `<button class="btn-delete-row" onclick="deletePatient('${k}')">🗑️</button>` : ''}
                `;
                logBody.innerHTML += `<tr><td><b>${i.name}</b> <small style="color:var(--text-muted); display:block;">${i.datum || ''}</small></td><td><span style="color:var(--primary);">${i.szenario}</span></td><td>${i.count}</td><td><span style="color:var(--success);">$${(i.cash || 0).toLocaleString()}</span></td><td><span style="color:var(--warning); font-weight:600;">${i.medicName || 'Unbekannt'}</span></td><td>${canEdit ? editBtns : '--'}</td></tr>`; 
            }); 
        }
        archivBody.innerHTML = "";
        const archivFoot = document.getElementById('archivTableFoot');
        if(archivFoot) archivFoot.innerHTML = "";
        if(archiv) { 
            let totalP = 0;
            let totalV = 0;
            let totalCash = 0;
            let totalMatObj = {};

            Object.keys(archiv).reverse().forEach(k => { 
                const i = archiv[k]; 
                totalP += Number(i.p) || 0;
                totalV += Number(i.v) || 0;
                totalCash += Number(i.cash) || 0;

                let mHtml = '<ul class="archiv-details-list">'; 
                if(i.matDetailsObj && typeof i.matDetailsObj === 'object' && Object.keys(i.matDetailsObj).length > 0) { 
                    Object.keys(i.matDetailsObj).forEach(m => { 
                        let qty = Number(i.matDetailsObj[m]) || 0;
                        mHtml += `<li>${m}: <b>${qty}</b></li>`; 
                        totalMatObj[m] = (totalMatObj[m] || 0) + qty;
                    }); 
                } else if(Number(i.cash) > 0) { 
                    let vA = Number(i.v) || 1; 
                    mHtml += `<li>Schätzwert: Nähset/Verband/Meds x${vA}</li>`; 
                } else { 
                    mHtml += `<li>Kein Verbrauch</li>`; 
                } 
                mHtml += '</ul>'; 
                archivBody.innerHTML += `<tr><td><b>Schicht ${i.tag}</b></td><td>${i.p}</td><td>${i.v}</td><td><span style="color:var(--success);">$${(i.cash || 0).toLocaleString()}</span></td><td>${mHtml}</td><td style="display:${sA?'table-cell':'none'};"><button class="btn-delete-row" onclick="deleteArchivSchicht('${k}')">🗑️</button></td></tr>`; 
            }); 

            if(archivFoot) {
                let totalMatHtml = '<ul class="archiv-details-list">';
                const matKeys = Object.keys(totalMatObj);
                if(matKeys.length > 0) {
                    matKeys.sort().forEach(m => {
                        totalMatHtml += `<li>${m}: <b style="color:var(--primary);">${totalMatObj[m]}</b></li>`;
                    });
                } else {
                    totalMatHtml += `<li>Kein Verbrauch</li>`;
                }
                totalMatHtml += '</ul>';

                archivFoot.innerHTML = `<tr style="background: rgba(56, 189, 248, 0.08); font-weight: 800; border-top: 2px solid var(--primary); color: var(--text-main);">
                    <td><b style="color: var(--primary);">Gesamtsumme (Historie)</b></td>
                    <td style="font-size: 13px; color: var(--primary);">${totalP.toLocaleString()}</td>
                    <td style="font-size: 13px; color: var(--warning);">${totalV.toLocaleString()}</td>
                    <td style="font-size: 13px; color: var(--success);">$${totalCash.toLocaleString()}</td>
                    <td>${totalMatHtml}</td>
                    <td style="display:${sA?'table-cell':'none'};">--</td>
                </tr>`;
            }
        }
    }

    function openEditPatientModal(key) {
        db.ref("data/protokoll/" + key).once("value", snap => {
            const p = snap.val();
            if(!p) return;
            document.getElementById('editKey').value = key;
            document.getElementById('editName').value = p.name || '';
            document.getElementById('editSzenario').value = p.szenario || '';
            document.getElementById('editCount').value = p.count || 1;
            document.getElementById('editCash').value = p.cash || 0;
            document.getElementById('editModal').style.display = 'flex';
        });
    }

    function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }

    function speicherePatientEdit() {
        const key = document.getElementById('editKey').value;
        if(!key) return;
        const updateData = {
            name: document.getElementById('editName').value.trim(),
            szenario: document.getElementById('editSzenario').value.trim(),
            count: Number(document.getElementById('editCount').value) || 1,
            cash: Number(document.getElementById('editCash').value) || 0
        };
        db.ref("data/protokoll/" + key).update(updateData).then(() => {
            closeEditModal();
            alert("Eintrag aktualisiert!");
        });
    }

    function exportArchivCSV() {
        db.ref("data/archiv").once("value", snap => {
            const archiv = snap.val();
            if(!archiv) { alert("Keine Archiv-Daten zum Exportieren vorhanden!"); return; }
            let csvContent = "data:text/csv;charset=utf-8,Schicht;Patienten;Verletzungen;Ausgaben\n";
            Object.values(archiv).forEach(row => {
                csvContent += `"${row.tag}";"${row.p}";"${row.v}";"${row.cash}"\n`;
            });
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `MMD_Archiv_Export_${new Date().toLocaleDateString('de-DE')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    function deletePatient(key) { 
        if (!canUserDelete()) {
            alert("⛔ Sie besitzen keine Berechtigung zum Löschen!");
            return;
        }
        db.ref("data/protokoll/" + key).once("value", snapshot => { const p = snapshot.val(); if(p && confirm(`Eintrag von "${p.name}" löschen?`)) { daten.patienten = Math.max(0, (Number(daten.patienten) || 0) - 1); daten.verletzungen = Math.max(0, (Number(daten.verletzungen) || 0) - (Number(p.count) || 0)); daten.ausgaben = Math.max(0, (Number(daten.ausgaben) || 0) - (Number(p.cash) || 0)); if(p.matVerbrauch) { Object.keys(p.matVerbrauch).forEach(k => { if(daten[k] !== undefined) daten[k] = Math.max(0, (Number(daten[k]) || 0) - (Number(p.matVerbrauch[k]) || 0)); }); } db.ref("data/daten").set(daten); db.ref("data/protokoll/" + key).remove(); } }); 
    }
    function deleteArchivSchicht(key) { 
        if (!canUserDelete()) {
            alert("⛔ Sie besitzen keine Berechtigung zum Löschen!");
            return;
        }
        if(confirm("Schicht unwiderruflich löschen?")) db.ref("data/archiv/" + key).remove(); 
    }
    function setDynamischenPatientenNamen() { const nF = document.getElementById('pName'); if (nF && (!nF.value || nF.value.startsWith("Patient "))) { nF.value = "Patient " + ((Number(daten.patienten) || 0) + 1); } }
    
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
    
    
    function toggleThemeCollapse(tN, eId) { const el = document.getElementById(eId); el.classList.toggle('collapsed'); localStorage.setItem('mmd_collapse_' + tN, el.classList.contains('collapsed')); }
    function toggleGroupCollapse(gId) { const el = document.getElementById(gId); el.classList.toggle('collapsed'); }
    function deleteDienstLink(key) { 
        if (!canUserDelete()) {
            alert("⛔ Sie besitzen keine Berechtigung zum Löschen!");
            return;
        }
        if (confirm("Link löschen?")) db.ref("data/dienstLinks/" + key).remove(); 
    }
    function deleteDienstCommand(key) {
        if (!canUserDelete()) {
            alert("⛔ Sie besitzen keine Berechtigung zum Löschen!");
            return;
        }
        if (confirm("Command / Kürzel löschen?")) db.ref("data/dienstCommands/" + key).remove();
    }

    // window.toggleInstructorUserStatus removed
    window.deletePatient = deletePatient; 
    window.deleteArchivSchicht = deleteArchivSchicht; 
    window.toggleThemeCollapse = toggleThemeCollapse; 
    window.toggleGroupCollapse = toggleGroupCollapse; 
    window.deleteDienstLink = deleteDienstLink; 
    window.commandHinzufuegen = commandHinzufuegen; 
    window.bulkCommandsImportieren = bulkCommandsImportieren; 
    window.deleteDienstCommand = deleteDienstCommand; 
    window.toggleCmdCollapse = toggleCmdCollapse; 
    window.openUserPermissionsModal = openUserPermissionsModal; 
    window.closeUserPermissionsModal = closeUserPermissionsModal; 
    
    function logSystemActivity(type, message) {
        if (!sessionUser) return;
        const logEntry = {
            type: type,
            message: message,
            timestamp: Date.now(),
            dateFormatted: new Date().toLocaleDateString('de-DE') + ' ' + new Date().toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'}),
            user: sessionUser.vorname + ' ' + sessionUser.nachname,
            userId: (sessionUser.vorname + '_' + sessionUser.nachname).toLowerCase().replace(/[^a-z0-9_]/g, '')
        };
        db.ref('data/systemLogs').push(logEntry);
    }
    
    function renderAuditLog(logs) {
        const tbody = document.getElementById('adminAuditLogTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!logs) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-muted);">Keine Eintr&auml;ge gefunden.</td></tr>';
            return;
        }
        
        const logKeys = Object.keys(logs).reverse();
        logKeys.forEach(k => {
            const entry = logs[k];
            const dateStr = entry.dateFormatted || '';
            const userStr = entry.user || 'System';
            const typeStr = entry.type || 'Info';
            const msgStr = entry.message || '';
            
            tbody.innerHTML += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding:12px; font-size:12px; color:var(--text-muted);">${dateStr}</td>
                <td style="padding:12px; font-size:13px; font-weight:bold;">${userStr}</td>
                <td style="padding:12px; font-size:12px; color:var(--primary);">${typeStr}</td>
                <td style="padding:12px; font-size:13px;">${msgStr}</td>
            </tr>`;
        });
    }

    window.logSystemActivity = logSystemActivity;

    window.saveUserPermissions = saveUserPermissions; 
    window.togglePermPasswordVisibility = togglePermPasswordVisibility;
    window.openAssignRolesModal = openAssignRolesModal;
    window.closeAssignRolesModal = closeAssignRolesModal;
    window.saveAssignedRoles = saveAssignedRoles;
    window.renderAdminRolesList = renderAdminRolesList;
    window.ladeRolleInEditor = ladeRolleInEditor;
    window.neueRolleErstellen = neueRolleErstellen;
    window.updateRoleBadgePreview = updateRoleBadgePreview;
    window.speichereRolle = speichereRolle;
    window.loescheRolle = loescheRolle;
    window.resetChecklisteSteps = resetChecklisteSteps;
    window.switchInstructorTab = switchInstructorTab; 
    window.startExam = startExam; 
    window.cancelActiveExam = cancelActiveExam; 
    window.submitActiveExam = submitActiveExam; 
    window.toggleExamUnlockForUser = toggleExamUnlockForUser;
    window.toggleStudentCompletedExamsCollapse = toggleStudentCompletedExamsCollapse;
    window.toggleExamPassedForUser = toggleExamPassedForUser; 
    window.viewSubmissionDetails = viewSubmissionDetails; 
    window.closeSubmissionDetailsModal = closeSubmissionDetailsModal; 
    window.viewExamPreviewModal = viewExamPreviewModal;
    window.closeExamPreviewModal = closeExamPreviewModal;
    window.allowExamRetake = allowExamRetake; 
    window.korrigiereAlleBisherigenPruefungen = korrigiereAlleBisherigenPruefungen; 
    window.standardPruefungenWiederherstellen = standardPruefungenWiederherstellen;
    window.neuePruefungErstellen = neuePruefungSpeichern; 
    window.neuePruefungSpeichern = neuePruefungSpeichern; 
    window.editExamInBuilder = editExamInBuilder; 
    window.resetExamBuilderForm = resetExamBuilderForm; 
    window.addExamQuestionRow = addExamQuestionRow; 
    window.addExamOptionRow = addExamOptionRow; 
    window.parseBulkQuestionsText = parseBulkQuestionsText; 
    window.deleteCloudExam = deleteCloudExam; 
    window.deleteExamSubmission = deleteExamSubmission; 
    window.switchAdminTab = switchAdminTab; 
    window.berechneDienstTage = berechneDienstTage; 
    window.linkHinzufuegen = linkHinzufuegen; 
    window.schnellBehandlungBuchen = schnellBehandlungBuchen; 
    window.openEditPatientModal = openEditPatientModal; 
    window.closeEditModal = closeEditModal; 
    window.speicherePatientEdit = speicherePatientEdit; 
    window.passwortAendern = passwortAendern; 
    window.exportArchivCSV = exportArchivCSV; 
    window.openAdminKeyModal = openAdminKeyModal; 
    window.closeAdminAuthModal = closeAdminAuthModal; 
    window.verifyAdminKeyPassword = verifyAdminKeyPassword; 
    window.closeAdminManagementModal = closeAdminManagementModal; 
    window.setMitarbeiterStatus = setMitarbeiterStatus; 
    window.mitarbeiterEntlassen = mitarbeiterEntlassen; 
    window.aktualisiereAdminVerwaltung = aktualisiereAdminVerwaltung; 
    window.speichereHierarchieDaten = speichereHierarchieDaten; 
    window.renderNewsFeed = renderNewsFeed;

    window.toggleNewsRead = toggleNewsRead;
    window.togglePostNewsForm = togglePostNewsForm;
    window.speichereNeueNews = speichereNeueNews;
    window.deleteNews = deleteNews;
    window.switchTab = switchTab; 
    window.settingsTabClick = settingsTabClick;
    window.baueMaterialUIAuf = baueMaterialUIAuf;
    window.bauePreiseEinstellungenUI = bauePreiseEinstellungenUI;
    window.ladeSzenarioTemplateInSettings = ladeSzenarioTemplateInSettings;
    window.speichereSzenarioTemplate = speichereSzenarioTemplate;
    window.stepMat = stepMat;
    window.stepKosten = stepKosten;
    window.stepVerletzungenAnzahl = stepVerletzungenAnzahl;
    window.ladeCheckliste = ladeCheckliste;
    window.patientHinzufuegen = patientHinzufuegen;

    console.log("? APP.JS COMPLETELY LOADED AND ALL FUNCTIONS EXPORTED!");


    // Added table filter function
    window.filterTable = function(tbodyId, query) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        const q = query.toLowerCase();
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const txt = row.innerText.toLowerCase();
            row.style.display = txt.includes(q) ? '' : 'none';
        });
    };


    // Scroll to Top Logic
    window.addEventListener('scroll', () => {
        const btn = document.getElementById('scrollTopBtn');
        if (btn) {
            if (window.scrollY > 300) {
                btn.style.display = 'flex';
            } else {
                btn.style.display = 'none';
            }
        }
    });
