let currentLoggedIn = ""; let isAdmin = false; let allSettingsArray = [];
// Unified Data Variables
let currentReportDataset = []; let currentReportColumns = []; let currentReportTitleStr = ""; let currentActiveFiltersArr = [];
let charitryaData = [];
let pareeksheData = [];

window.onload = function() {
    try {
        const today = new Date(); 
        const todayStrForHeader = getSanskritDayAndDate(today.toISOString().split('T')[0]);
        const headerDateElem = document.getElementById('headerTodayDate');
        if(headerDateElem) { headerDateElem.innerText = `अद्यतन-दिनाङ्कः: ${todayStrForHeader}`; }
        
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        if(document.getElementById('advFilterFrom')) document.getElementById('advFilterFrom').value = firstDay; 
        if(document.getElementById('advFilterTo')) document.getElementById('advFilterTo').value = today.toISOString().split('T')[0];
        if(document.getElementById('notifStartDate')) document.getElementById('notifStartDate').value = today.toISOString().split('T')[0]; 
        if(document.getElementById('notifEndDate')) document.getElementById('notifEndDate').value = today.toISOString().split('T')[0];
        
        const dateInputObj = document.getElementById('dateInput');
        if(dateInputObj) { 
            dateInputObj.addEventListener('change', function() { 
                checkFormHolidayState(); 
                const dateStr = this.value; 
                if(isAdmin) { populateAdminClassDropdown(dateStr); } 
                else if(currentLoggedIn) { populateClassDropdown(currentLoggedIn, dateStr); } 
                handleClassSelection(); 
                switchEntryTab('classes'); 
            }); 
        }
    } catch(e) { console.error("Startup Setup Error:", e); }
    
    fetchDataFromGoogleSheets(); 
};

function getSanskritDayAndDate(dateStr) { const d = new Date(dateStr); const days = ["भानुवासरः", "सोमवासरः", "मङ्गलवासरः", "बुधवासरः", "गुरुवासरः", "शुक्रवासरः", "शनिवासरः"]; return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} - ${days[d.getDay()]}`; }
function translateNumbersToDevanagari(num) { const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']; return String(num).split('').map(d => digits[d] || d).join(''); }
function normalizeSheetDate(dStr) {
    if(!dStr) return ""; dStr = String(dStr).trim();
    if(dStr.match(/^\d{4}-\d{2}-\d{2}/)) return dStr.substring(0, 10);
    if(dStr.includes('/')) { let p = dStr.split('/'); if(p.length === 3) { let p0 = p[0].padStart(2, '0'); let p1 = p[1].padStart(2, '0'); let p2 = p[2].split(' ')[0]; if(p2.length === 4) { let dd = p0, mm = p1, yyyy = p2; if(parseInt(mm) > 12) { mm = p0; dd = p1; } return `${yyyy}-${mm}-${dd}`; } } }
    if(dStr.includes('-')) { let p = dStr.split('-'); if(p.length === 3 && p[2].length >= 4) { let p0 = p[0].padStart(2, '0'); let p1 = p[1].padStart(2, '0'); let yyyy = p[2].substring(0,4); let dd = p0, mm = p1; if(parseInt(mm) > 12) { mm = p0; dd = p1; } return `${yyyy}-${mm}-${dd}`; } }
    let d = new Date(dStr); if(!isNaN(d.getTime())) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    if(dStr.includes('T')) return dStr.split('T')[0]; return dStr;
}
function normalizeKeyStr(str) { return (str || "").toString().replace(/[\s\-\–\—_]/g, '').toLowerCase(); }
function makeKey(ach, gana, sub) { return normalizeKeyStr(ach) + '|' + normalizeKeyStr(gana) + '|' + normalizeKeyStr(sub); }

function setupDailyReminder() {
    const now = new Date(); const yyyy = now.getFullYear(); const mm = String(now.getMonth() + 1).padStart(2, '0'); const dd = String(now.getDate()).padStart(2, '0');
    const dtStart = yyyy + mm + dd + "T200000"; const dtEnd = yyyy + mm + dd + "T201000"; const websiteUrl = window.location.href;
    const icsData = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Veda Vijnana Gurukulam//Pathollekh//EN\nBEGIN:VEVENT\nDTSTART:" + dtStart + "\nDTEND:" + dtEnd + "\nRRULE:FREQ=DAILY\nSUMMARY:पाठोल्लेखः - स्मरणम्\nDESCRIPTION:आचार्य, कृपया अद्यतन-पाठस्य विवरणम् अत्र लिखतु।\nलिंक: " + websiteUrl + "\nBEGIN:VALARM\nTRIGGER:-PT0M\nACTION:DISPLAY\nDESCRIPTION:Reminder\nEND:VALARM\nEND:VEVENT\nEND:VCALENDAR";
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' }); const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Pathollekh_Reminder.ics'; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    document.getElementById('reminderBanner').style.display = 'none'; alert("अलारम्-सञ्चिका (Alarm file) अवतीर्णा अस्ति। कृपया 'Save' नोदयतु!");
}

function fetchDataFromGoogleSheets() {
    const cacheBuster = GOOGLE_SCRIPT_URL + (GOOGLE_SCRIPT_URL.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
    fetch(cacheBuster).then(res => res.json()).then(data => {
        fetchedLogs = data.logs || []; fetchedLogs.forEach(log => { log.normalizedDate = normalizeSheetDate(log['दिनाङ्कः (Date)']); });
        fetchedNotifications = data.notifications || [];
        studentsData = (data.students || []).map(s => ({name: s.Name, vibhaga: s.Vibhaga, gana: s.Gana, vedapatha: s.Vedapatha, rowIdx: s.rowIdx}));
        acharyaPasswords = {}; vedaAcharyaMapping = {};
        (data.acharyas || []).forEach(a => { if(!a.Name) return; acharyaPasswords[a.Name] = a.Password; if(a.Vedapatha_Mapping && a.Vedapatha_Mapping !== "-") vedaAcharyaMapping[a.Name] = a.Vedapatha_Mapping; });
        timetableData = {};
        (data.timetable || []).forEach(t => { if(!t.Acharya) return; if(!timetableData[t.Acharya]) timetableData[t.Acharya] = []; timetableData[t.Acharya].push({gana: t.Gana || "", time: t.Time || "", subject: t.Subject || "", vibhaga: t.Vibhaga || "", rowIdx: t.rowIdx}); });
        holidaysData = data.holidays || []; holidaysData.forEach(h => { h.normalizedDate = normalizeSheetDate(h.Date); });
        messagesData = data.messages || []; avalokanamData = data.avalokanam || []; charitryaData = data.charitrya || []; pareeksheData = data.pareekshe || [];
        allSettingsArray = data.settings || [];
        settingsData = {}; (data.settings || []).forEach(row => { if(row.Category) settingsData[row.Category] = row.Value; });
        
        populateAcharyaDropdowns(); 
        setupPareeksheDropdown();
        updateTodayView(); 
        displayActiveNotifications();
        checkAndShowAvalokanamBanner();
        
        if(currentLoggedIn && document.getElementById('entryFormSection').style.display === 'block') { 
            populateClassDropdown(currentLoggedIn, document.getElementById('dateInput').value); 
            renderAcharyaMessages(); 
            checkAndShowAvalokanamBanner();
            switchEntryTab('classes'); 
        }
        if(isAdmin && document.getElementById('adminPanelView').style.display === 'block') { 
            populateCMSDropdowns(); 
            updateAdminAvalokanamUI(); 
        }
    }).catch(err => {
        console.error(err); 
        const errBox = document.getElementById('todayDataContainer'); 
        if(errBox) errBox.innerHTML = "<div class='log-desc' style='color:red; text-align:center; padding:20px;'>दत्तांश-प्राप्तौ दोषः जातः। (Network Error)</div>";
    });
}

function populateAcharyaDropdowns() { const selectModal = document.getElementById('acharyaSelect'); if(!selectModal) return; let htmlStr = '<option value="">-- आचार्यं चिनोतु --</option>'; for(let ach in acharyaPasswords) { htmlStr += `<option value="${ach}">${ach}</option>`; } selectModal.innerHTML = htmlStr; }

function displayActiveNotifications() {
    const now = new Date(); const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0]; const currentTime = now.toTimeString().slice(0,5);
    let activeNotifs = fetchedNotifications.filter(n => { if (!n['StartDate'] || !n['EndDate']) return false; let sd = normalizeSheetDate(n['StartDate']); let ed = normalizeSheetDate(n['EndDate']); if (todayStr >= sd && todayStr <= ed) { try { if (n['StartTime'] && n['EndTime'] && String(n['StartTime']).includes(':') && String(n['EndTime']).includes(':')) { let stStr = String(n['StartTime']); let etStr = String(n['EndTime']); let st = stStr.includes('T') ? stStr.split('T')[1].slice(0,5) : stStr.slice(0,5); let et = etStr.includes('T') ? etStr.split('T')[1].slice(0,5) : etStr.slice(0,5); if (todayStr === sd && currentTime < st) return false; if (todayStr === ed && currentTime > et) return false; } } catch(e) {} return true; } return false; });
    const banner = document.getElementById('notificationBanner'); const marquee = document.getElementById('notificationText'); if(!banner || !marquee) return;
    if (activeNotifs.length > 0) { marquee.innerHTML = activeNotifs.map(n => `<span class="notif-item"><span class="notif-author">📢 ${n['Acharya']} :</span> ${n['Message']}</span>`).join(" &nbsp; | &nbsp; "); banner.style.display = "block"; } else { banner.style.display = "none"; }
}

// ----------------------------------------------------
// UI VIEW NAVIGATION ENGINE
// ----------------------------------------------------
function showSection(sectionId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
    document.querySelectorAll('.btn-tab').forEach(btn => btn.classList.remove('active'));
    
    const targetSec = document.getElementById(sectionId);
    if(targetSec) targetSec.style.display = 'block';
    
    if (sectionId === 'dashboard') {
        const dBtn = document.getElementById('btn-dashboard');
        if(dBtn) dBtn.classList.add('active');
    } else if (sectionId === 'pradarshini') {
        const pBtn = document.getElementById('btn-pradarshini');
        if(pBtn) pBtn.classList.add('active');
        generatePradarshiniBoard();
    } else if (sectionId === 'satraView') {
        document.getElementById('btn-satra').classList.add('active');
        if(isAdmin) {
            document.getElementById('satraAdminView').style.display = 'block';
            document.getElementById('satraAcharyaView').style.display = 'none';
        } else {
            document.getElementById('satraAcharyaView').style.display = 'block';
            document.getElementById('satraAdminView').style.display = 'none';
            populateGanacharyaDropdown();
        }
    } else if (sectionId === 'pareeksheView') {
        document.getElementById('btn-pareekshe').classList.add('active');
        if (typeof isAdmin !== 'undefined' && isAdmin === true) {
            document.getElementById('pareeksheAdminView').style.display = 'block';
            document.getElementById('pareeksheAcharyaView').style.display = 'none';
        } else {
            document.getElementById('pareeksheAcharyaView').style.display = 'block';
            document.getElementById('pareeksheAdminView').style.display = 'none';
            setupPareeksheDropdown();
        }
    }
}

function goToDashboard() { 
    const m = document.getElementById('mainTabs'); 
    if(m) m.style.display = 'flex'; 
    showSection('dashboard'); 
}

function openLoginModal() { 
    if (currentLoggedIn) { 
        showSection('entryFormSection'); 
        switchEntryTab('classes');
        populateClassDropdown(currentLoggedIn, document.getElementById('dateInput').value); 
        renderAcharyaMessages(); checkAvalokanamStatus(); 
        document.getElementById('attendanceSection').style.display = "none"; 
    } else if (isAdmin) {
        openAdminLogEntry(); 
    } else { 
        document.getElementById('loginModal').style.display = 'flex'; 
    } 
}

function openAdminLogEntry() {
    document.getElementById('mainTabs').style.display = 'none';
    showSection('entryFormSection');
    switchEntryTab('classes');
    document.getElementById('loggedInAcharya').innerText = "प्रबन्धकः (Admin Entry)";
    const dateInput = document.getElementById('dateInput');
    dateInput.removeAttribute('readonly'); 
    populateAdminClassDropdown(dateInput.value);
    document.getElementById('attendanceSection').style.display = "none";
    const msgContainer = document.getElementById('acharyaMessageContainer'); if(msgContainer) msgContainer.innerHTML = "";
    const avBanner = document.getElementById('avalokanamAlertBanner'); if(avBanner) avBanner.style.display = "none";
}

function openAdminModal() { 
    if (isAdmin) { 
        showSection('adminPanelView'); 
        resetAdvancedFilters(); populateCMSDropdowns(); updateAdminAvalokanamUI();
    } else { 
        document.getElementById('adminModal').style.display = 'flex'; 
    } 
}

function closeModals() { ['adminModal','loginModal','avalokanamModal'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; }); ['adminPin','acharyaPin','acharyaSelect'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); }

function verifyAdmin() { const pin = document.getElementById('adminPin').value; if(pin === '9999') { isAdmin = true; closeModals(); document.getElementById('mainTabs').style.display = 'flex'; showSection('adminPanelView'); resetAdvancedFilters(); populateCMSDropdowns(); updateAdminAvalokanamUI(); } else { alert("असमीचीनः कूटशब्दः!"); } }

function getVocative(name) { if (name === "विष्णुः") return "विष्णो"; if (name === "सुब्रह्मण्य. आ.") return name; return name.replace(/ः$/, ''); }

function verifyAcharya() { const name = document.getElementById('acharyaSelect').value; const pin = document.getElementById('acharyaPin').value; if(!name) return alert("कृपया आचार्यं चिनोतु!"); if(acharyaPasswords[name] === pin) { closeModals(); isAdmin = false; currentLoggedIn = name; document.getElementById('mainTabs').style.display = 'none'; showSection('entryFormSection'); document.getElementById('loggedInAcharya').innerText = "स्वागतम्, " + getVocative(name); document.getElementById('dateInput').value = new Date().toISOString().split('T')[0]; document.getElementById('dateInput').setAttribute('readonly', 'true'); switchEntryTab('classes'); populateClassDropdown(name, document.getElementById('dateInput').value); renderAcharyaMessages(); checkFormHolidayState(); checkAndShowAvalokanamBanner(); } else { alert("असमीचीनः कूटशब्दः!"); } }

function logout() { currentLoggedIn = ""; isAdmin = false; document.getElementById('descriptionInput').value = ""; document.getElementById('attendanceSection').style.display="none"; const mbox = document.getElementById('acharyaMessageContainer'); if(mbox) mbox.innerHTML=""; goToDashboard(); }


// ----------------------------------------------------
// 📊 ಪಾಠೋಲ್ಲೇಖ ಪ್ರದರ್ಶಿನಿ (PRADARSHINI BOARD GENERATOR)
// ----------------------------------------------------
function generatePradarshiniBoard() {
    let dateInput = document.getElementById('boardDate').value;
    if (!dateInput) {
        let today = new Date();
        let yyyy = today.getFullYear();
        let mm = String(today.getMonth() + 1).padStart(2, '0');
        let dd = String(today.getDate()).padStart(2, '0');
        dateInput = `${yyyy}-${mm}-${dd}`;
        document.getElementById('boardDate').value = dateInput;
    }

    let boardHtml = `<table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 1rem; text-align: left;">
                        <tr style="background-color: #E8F5E9; color: #1B5E20;">
                            <th style="padding: 12px; border: 1px solid #ccc; width: 200px; text-align: center;">आचार्यः (Acharya)</th>
                            <th style="padding: 12px; border: 1px solid #ccc;">पाठाः तथा दायित्वानि (Classes & Duties)</th>
                        </tr>`;

    for (let ach in acharyaPasswords) {
        let classes = timetableData[ach] || [];
        
        // ಪಾಠಗಳನ್ನು ಸಮಯದ ಆಧಾರದ ಮೇಲೆ (ಮೊದಲನೇ ಕ್ಲಾಸ್, ಎರಡನೇ ಕ್ಲಾಸ್...) ವಿಂಗಡಿಸುವುದು
        classes.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        
        let dutyStr = settingsData['Duty_' + ach] || "";
        let duties = dutyStr.split(',').map(d => d.trim()).filter(Boolean);
        
        // ಪಕ್ಕ-ಪಕ್ಕದಲ್ಲಿ ಬಾಕ್ಸ್‌ಗಳು ಬರಲು Flexbox ವಿನ್ಯಾಸ 
        let detailsHtml = `<div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: stretch;">`;
        let hasItems = false;

        classes.forEach(cls => {
            if(cls.gana === "इतरकार्यम्") return;
            hasItems = true;
            let log = fetchedLogs.find(l => l.normalizedDate === dateInput && l['आचार्यः (Acharya)'] === ach && l['विषयः (Subject)'] === cls.subject);
            
            let timeStr = cls.time ? `<div style="font-size:0.8rem; color:#555; margin-bottom:5px;">🕒 ${cls.time}</div>` : '';
            let titleStr = `<div style="font-size:1.05rem;">${cls.subject}</div><div style="font-size:0.9rem; margin-bottom:5px;">(${cls.gana})</div>`;

            if (log) {
                let attendance = log['उपस्थिताः (Present)'] || "";
                let desc = log['विवरणम् (Lesson Description)'] || "";
                
                if (desc.includes("ರದ್ದು") || desc.includes("ತಗೊಂಡಿಲ್ಲ") || desc.includes("Cancelled") || attendance === "0" || attendance.includes("ರದ್ದಮ್")) {
                    detailsHtml += `<div style="padding: 12px; border-radius: 8px; border: 1px solid #FFB74D; background-color: #FFF3E0; color: #E65100; font-weight: bold; min-width: 150px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        ${timeStr}${titleStr}
                        <div style="font-size:0.85rem; margin-top:8px; border-top:1px dashed #FFB74D; padding-top:5px;">⚠️ पाठः न जातः</div>
                    </div>`;
                } else {
                    detailsHtml += `<div style="padding: 12px; border-radius: 8px; border: 1px solid #81C784; background-color: #E8F5E9; color: #2E7D32; font-weight: bold; min-width: 150px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        ${timeStr}${titleStr}
                        <div style="font-size:0.85rem; margin-top:8px; border-top:1px dashed #81C784; padding-top:5px;">✅ सम्पन्नम्</div>
                    </div>`;
                }
            } else {
                detailsHtml += `<div style="padding: 12px; border-radius: 8px; border: 1px solid #E0E0E0; background-color: #F5F5F5; color: #757575; min-width: 150px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    ${timeStr}${titleStr}
                    <div style="font-size:0.85rem; margin-top:8px; border-top:1px dashed #CCC; padding-top:5px;">➖ उल्लेखः नास्ति</div>
                </div>`;
            }
        });

        duties.forEach(duty => {
            hasItems = true;
            let dutyLog = fetchedLogs.find(l => l.normalizedDate === dateInput && l['आचार्यः (Acharya)'] === ach && l['विषयः (Subject)'] === duty);
            
            let titleStr = `<div style="font-size:1.05rem;">${duty}</div><div style="font-size:0.9rem; margin-bottom:5px;">(दायित्वम्)</div>`;

            if (dutyLog) {
                detailsHtml += `<div style="padding: 12px; border-radius: 8px; border: 1px solid #64B5F6; background-color: #E3F2FD; color: #1565C0; font-weight: bold; min-width: 150px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    ${titleStr}
                    <div style="font-size:0.85rem; margin-top:8px; border-top:1px dashed #64B5F6; padding-top:5px;">🛡️ सम्पन्नम्</div>
                </div>`;
            } else {
                detailsHtml += `<div style="padding: 12px; border-radius: 8px; border: 1px solid #E0E0E0; background-color: #FAFAFA; color: #9E9E9E; min-width: 150px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    ${titleStr}
                    <div style="font-size:0.85rem; margin-top:8px; border-top:1px dashed #CCC; padding-top:5px;">➖ उल्लेखः नास्ति</div>
                </div>`;
            }
        });

        if (!hasItems) {
            detailsHtml += `<div style="padding: 12px; color: #9E9E9E; font-style: italic;">अस्मिन् दिने पाठाः न सन्ति (No classes assigned)</div>`;
        }
        
        detailsHtml += `</div>`;

        boardHtml += `<tr>
                        <td style="padding: 15px; border: 1px solid #ccc; font-weight: bold; background-color: #FAFAFA; vertical-align: middle; font-size: 1.1rem; color: #1B5E20; text-align: center;">${ach}</td>
                        <td style="padding: 15px; border: 1px solid #ccc; vertical-align: middle;">${detailsHtml}</td>
                      </tr>`;
    }

    boardHtml += `</table>`;
    document.getElementById('pradarshiniBoardContainer').innerHTML = boardHtml;
}

// ----------------------------------------------------
// UI ENGINE: SHARED TIMETABLE GRID GENERATOR
// ----------------------------------------------------
function getTimetableData(targetDateStr) {
    const yMap = {}; let yAch = new Set();
    fetchedLogs.forEach(log => {
        if (log.normalizedDate === targetDateStr && log['विषयः (Subject)'] !== "अनध्यायः") {
            if(log['गणः (Class/Gana)'] !== "इतरकार्यम्" && log['गणः (Class/Gana)'] !== "दायित्वम्") {
               const key = makeKey(log['आचार्यः (Acharya)'], log['गणः (Class/Gana)'], log['विषयः (Subject)']);
               yMap[key] = {desc: log['विवरणम् (Lesson Description)'], att: log['उपस्थिताः (Present)']};
            }
            yAch.add(log['आचार्यः (Acharya)']);
        }
    });

    const times = ["06:30–07:55", "08:30–09:25", "11:00–11:55", "01:30–02:25", "02:30–03:25", "03:30–04:25", "06:30–07:25"]; const ganas = ["तपः", "तेजः", "ओजः", "वर्चः", "प्रेयः", "श्रेयः", "भ्राजः", "यशः"]; const tableGrid = {}; ganas.forEach(g => tableGrid[g] = {});
    
    for (const [ach, classes] of Object.entries(timetableData)) {
        classes.forEach(cls => {
            if(!cls.gana || cls.gana === "इतरकार्यम्") return; 
            let clsTime = (cls.time || "").replace('-', '–');
            cls.gana.split(' + ').forEach(g => { if(tableGrid[g]) { if(!tableGrid[g][clsTime]) tableGrid[g][clsTime] = []; tableGrid[g][clsTime].push({ach: ach, sub: cls.subject, vib: cls.vibhaga, originalGana: cls.gana, time: cls.time}); } });
        });
    }

    let html = `<div class="table-wrapper"><table><thead><tr><th>गणः</th>`; times.forEach(t => html += `<th>${t}</th>`); html += `</tr></thead><tbody>`;
    
    ganas.forEach(gana => {
        html += `<tr><th>${gana}</th>`;
        times.forEach(time => {
            const classes = tableGrid[gana][time];
            if(!classes || classes.length === 0) { html += `<td></td>`; }
            else {
                html += classes.length === 1 ? `<td>` : `<td style="padding:0;"><div class="split-cell">`;
                classes.forEach((cls, idx) => {
                    const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana'); 
                    const btmBorder = (classes.length > 1 && idx === 0) ? 'split-top' : ''; 
                    const key = makeKey(cls.ach, cls.originalGana, cls.sub);
                    
                    if(yMap[key]) { 
                        let isCancelled = (yMap[key].att || "").includes('रद्दम्');
                        let cellStyle = isCancelled ? `background-color:#FFF3E0; border:2px solid #FFB74D; color:#E65100; cursor:pointer; height:100%; padding:5px;` : `padding:5px; height:100%;`;
                        let txtClass = isCancelled ? `` : vClass;
                        let achStyle = isCancelled ? `color:#E65100; font-weight:bold;` : `color:#1B5E20; font-weight:bold;`;

                        html += `<div class="${btmBorder} cell-submitted ${txtClass}" style="${cellStyle}" onclick="showDescModal('${cls.sub}', '${escapeQuotes(yMap[key].desc)}', '${escapeQuotes(yMap[key].att)}')"><div class="tooltip-text">${yMap[key].desc}</div>${cls.sub} <span class="acharya-name" style="${achStyle}">${cls.ach}</span></div>`; 
                    } else { 
                        html += `<div class="${btmBorder} cell-unsubmitted ${vClass}" style="padding:5px; height:100%;">${cls.sub} <span class="acharya-name">${cls.ach}</span></div>`; 
                    }
                }); 
                html += classes.length === 1 ? `</td>` : `</div></td>`;
            }
        }); html += `</tr>`;
    }); html += `</tbody></table></div>`; 
    
    return { html };
}

function updateTodayView() { 
    const todayDataContainer = document.getElementById('todayDataContainer'); 
    if(!todayDataContainer) return; 
    const todayStr = new Date().toISOString().split('T')[0]; 
    let isHolidayOnTarget = fetchedLogs.some(log => log.normalizedDate === todayStr && log['विषयः (Subject)'] === "अनध्यायः") || holidaysData.some(h => h.normalizedDate === todayStr); 
    if(isHolidayOnTarget) { 
        todayDataContainer.innerHTML = "<div class='holiday-banner' style='display:block;'>अस्मिन् दिने अनध्यायः / विशेषकार्यक्रमः अस्ति। (Holiday)</div>"; 
        return; 
    } 
    const tbData = getTimetableData(todayStr); 
    todayDataContainer.innerHTML = tbData.html; 
}

function escapeQuotes(str) { return str ? str.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n') : ''; }
function showDescModal(sub, desc, att) { document.getElementById('detailSubject').innerText = sub; document.getElementById('detailDescription').innerText = desc; document.getElementById('detailAttendance').innerText = att || "ಮಾಹಿತिः नास्ति"; document.getElementById('detailsModal').style.display = 'flex'; }


function getExpectedStudents(ganaStr, subject, vibhaga, acharya) {
    if(!ganaStr || ganaStr === "इतरकार्यम्" || ganaStr === "दायित्वम्") return []; 
    const ganas = ganaStr.split(' + '); 
    let isVedaClass = false; 
    let mappedVeda = vedaAcharyaMapping[acharya];
    
    if (subject.includes('वेद') && !subject.includes('वेदान्त') && !subject.includes('आयुर्वेद')) { 
        isVedaClass = true; 
    } else if (mappedVeda && subject.includes(mappedVeda)) { 
        isVedaClass = true; 
    } else if (["याज्ञवल्क्यः", "कपिलः", "जमदग्निः", "विश्वामित्रः", "कश्यपः", "अत्रिः", "भरद्वाजः", "वसिष्ठः"].some(v => subject.includes(v))) { 
        isVedaClass = true; 
    }

    if (isVedaClass && mappedVeda) { 
        return studentsData.filter(s => s.vedapatha === mappedVeda); 
    } else { 
        return studentsData.filter(s => { 
            if(!ganas.includes(s.gana)) return false; 
            if(vibhaga === 'सामान्य') return true; 
            return s.vibhaga === vibhaga; 
        }); 
    }
}

function checkFormHolidayState() { const dateInput = document.getElementById('dateInput'); if(!dateInput) return; const dateVal = dateInput.value; const isHolDeclared = fetchedLogs.some(log => log.normalizedDate === dateVal && log['विषयः (Subject)'] === "अनध्यायः"); const isCMSHoliday = holidaysData.some(h => h.normalizedDate === dateVal); const banner = document.getElementById('holidayBannerForm'); const submitBtn = document.getElementById('submitBtn'); if(!banner || !submitBtn) return; if((isHolDeclared || isCMSHoliday) && !isAdmin) { banner.style.display = "block"; banner.innerText = "अद्य अनध्यायः / विशेषकार्यक्रमः अस्ति। पाठोल्लेखः न शक्यते। (Holiday Declared)"; submitBtn.disabled = true; } else { banner.style.display = "none"; submitBtn.disabled = false; } }

function toggleCheck(id) { const cb = document.getElementById(id); if(cb) cb.checked = !cb.checked; }

// --- FORM HANDLING (WITH LEAVE & EDIT LOGIC) ---
function switchEntryTab(tab) {
    if(tab === 'classes') {
        document.getElementById('tabEntryClasses').classList.add('active');
        document.getElementById('tabEntryDuties').classList.remove('active');
        document.getElementById('entryClassesDiv').style.display = 'block';
        document.getElementById('entryDutiesDiv').style.display = 'none';
    } else {
        document.getElementById('tabEntryDuties').classList.add('active');
        document.getElementById('tabEntryClasses').classList.remove('active');
        document.getElementById('entryClassesDiv').style.display = 'none';
        document.getElementById('entryDutiesDiv').style.display = 'block';
        renderDutiesForm();
    }
}

function populateClassDropdown(acharyaName, dateStr) {
    const select = document.getElementById('classSelect'); if(!select) return; let htmlStr = '<option value="">-- कक्षां चिनोतु --</option>'; let submittedKeys = new Set();
    fetchedLogs.forEach(log => { if (log.normalizedDate === dateStr && log['आचार्यः (Acharya)'] === acharyaName && log['विषयः (Subject)'] !== "अनध्यायः") { submittedKeys.add(makeKey(log['आचार्यः (Acharya)'], log['गणः (Class/Gana)'], log['विषयः (Subject)'])); } });
    const classes = timetableData[acharyaName] || []; let total = classes.length; let submittedCount = 0;
    classes.forEach(cls => {
        if(cls.gana === "इतरकार्यम्") return;
        const key = makeKey(acharyaName, cls.gana, cls.subject); const isSubmitted = submittedKeys.has(key); if (isSubmitted) submittedCount++;
        const valStr = encodeURIComponent(JSON.stringify({acharya: acharyaName, gana: cls.gana, time: cls.time, subject: cls.subject, vibhaga: cls.vibhaga}));
        if (isSubmitted) { htmlStr += `<option value="${valStr}" disabled style="color: #9E9E9E; background: #EEEEEE;">✅ सम्पन्नम् (Submitted) - ${cls.gana} | ${cls.subject}</option>`; } else { htmlStr += `<option value="${valStr}" style="color: #D35400; font-weight:bold;">⏳ ${cls.gana} गणः | ${cls.time} | ${cls.subject} (${cls.vibhaga})</option>`; }
    });
    select.innerHTML = htmlStr; const statusDiv = document.getElementById('submissionStatus');
    if(statusDiv) { let pending = total - submittedCount; if(pending <= 0 && total > 0) { statusDiv.innerHTML = `<span style="color:#2E7D32;">🎉 अभिनन्दनानि! अद्यतनाः सर्वे पाठाः सम्पन्नाः!</span>`; } else { statusDiv.innerHTML = `<span style="color:#2E7D32;">सम्पन्नाः (Done): ${submittedCount}</span> | <span style="color:#D35400;">अवशिष्टाः (Pending): ${pending}</span>`; } }
}

function populateAdminClassDropdown(dateStr) {
    const select = document.getElementById('classSelect'); if(!select) return; let htmlStr = '<option value="">-- सर्वाः कक्षाः --</option>'; let submittedMap = new Map();
    fetchedLogs.forEach(log => { if (log.normalizedDate === dateStr && log['विषयः (Subject)'] !== "अनध्यायः" && log['गणः (Class/Gana)'] !== "दायित्वम्") { submittedMap.set(makeKey(log['आचार्यः (Acharya)'], log['गणः (Class/Gana)'], log['विषयः (Subject)']), log.rowIdx); } });
    for (const [achName, classes] of Object.entries(timetableData)) { classes.forEach(cls => { 
        if(cls.gana === "इतरकार्यम्") return;
        const key = makeKey(achName, cls.gana, cls.subject); 
        if(submittedMap.has(key)) { 
            const valStr = encodeURIComponent(JSON.stringify({acharya: achName, gana: cls.gana, time: cls.time, subject: cls.subject, vibhaga: cls.vibhaga, rowIdx: submittedMap.get(key)}));
            htmlStr += `<option value="${valStr}" style="color: #1B5E20; background: #E8F5E9;">✅ [EDIT] ${achName} - ${cls.gana} (${cls.subject})</option>`; 
        } else { 
            const valStr = encodeURIComponent(JSON.stringify({acharya: achName, gana: cls.gana, time: cls.time, subject: cls.subject, vibhaga: cls.vibhaga}));
            htmlStr += `<option value="${valStr}">${achName} | ${cls.gana} | ${cls.time} | ${cls.subject}</option>`; 
        }
    }); }
    select.innerHTML = htmlStr; document.getElementById('submissionStatus').innerHTML = ""; 
}

function handleClassSelection() { 
    const clsVal = document.getElementById('classSelect').value; const attSection = document.getElementById('attendanceSection'); const attContainer = document.getElementById('attendanceContainer'); const leaveGroup = document.getElementById('leaveGroup'); const applyAllDiv = document.getElementById('applyAllDiv');
    if(document.getElementById('leaveCheckbox')) document.getElementById('leaveCheckbox').checked = false; if(document.getElementById('applyAllCheckbox')) document.getElementById('applyAllCheckbox').checked = false;
    toggleLeaveMode(); document.getElementById('descriptionInput').value = "";
    if(!clsVal) { attSection.style.display = "none"; if(leaveGroup) leaveGroup.style.display = "none"; return; } 
    const clsData = JSON.parse(decodeURIComponent(clsVal)); 
    
    if(clsData.rowIdx) {
        if(leaveGroup) leaveGroup.style.display = "none"; document.getElementById('submitBtn').innerText = "पारीष्करोतु (Update Log)";
        let logEntry = fetchedLogs.find(l => l.rowIdx === clsData.rowIdx); if(logEntry) document.getElementById('descriptionInput').value = logEntry['विवरणम् (Lesson Description)'];
    } else {
        if(leaveGroup) leaveGroup.style.display = "block"; document.getElementById('submitBtn').innerText = "समर्पयतु (Submit)";
        if(!isAdmin && applyAllDiv) {
            let pendingCount = 0; const dateStr = document.getElementById('dateInput').value;
            (timetableData[currentLoggedIn] || []).forEach(c => { if(c.gana !== "इतरकार्यम्") { let isSub = fetchedLogs.some(l => l.normalizedDate === dateStr && l['आचार्यः (Acharya)'] === currentLoggedIn && makeKey(currentLoggedIn, l['गणः (Class/Gana)'], l['विषयः (Subject)']) === makeKey(currentLoggedIn, c.gana, c.subject)); if(!isSub) pendingCount++; } });
            applyAllDiv.style.display = pendingCount > 1 ? "block" : "none";
        } else if(applyAllDiv) { applyAllDiv.style.display = "none"; }
    }
    if(clsData.gana === "इतरकार्यम्") { attSection.style.display = "none"; return; } 
    attSection.style.display = "block"; let filteredStudents = getExpectedStudents(clsData.gana, clsData.subject, clsData.vibhaga, clsData.acharya); 
    if(filteredStudents.length === 0) { attContainer.innerHTML = "<span style='color:red;'>अस्मिन् वर्गे छात्राः न सन्ति।</span>"; return; } 
    
    let existingAtt = ""; if(clsData.rowIdx) { let logEntry = fetchedLogs.find(l => l.rowIdx === clsData.rowIdx); if(logEntry) existingAtt = logEntry['उपस्थिताः (Present)'] || ""; }
    let html = `<div class="attendance-grid">`; 
    filteredStudents.forEach(student => { let isChecked = clsData.rowIdx ? existingAtt.includes(student.name) : false; let checkedStr = isChecked ? "checked" : ""; html += `<div class="student-checkbox" onclick="toggleCheck('chk_${student.name}')"><input type="checkbox" id="chk_${student.name}" value="${student.name}" class="att-checkbox" onclick="event.stopPropagation()" ${checkedStr}><label for="chk_${student.name}" onclick="event.stopPropagation()">${student.name}</label></div>`; }); 
    html += `</div>`; attContainer.innerHTML = html; 
}

function toggleLeaveMode() {
    const leaveCb = document.getElementById('leaveCheckbox'); const isLeave = leaveCb ? leaveCb.checked : false; const attSection = document.getElementById('attendanceSection'); const descLabel = document.getElementById('descLabel'); const applyAllDiv = document.getElementById('applyAllDiv');
    if(isLeave) { if(attSection) attSection.style.display = "none"; if(descLabel) descLabel.innerText = "किं कारणम्? (Reason for Leave/Cancellation)"; if(applyAllDiv) applyAllDiv.style.opacity = "1"; } else { const clsVal = document.getElementById('classSelect').value; if(clsVal && attSection) { const clsData = JSON.parse(decodeURIComponent(clsVal)); if(clsData.gana !== "इतरकार्यम्") attSection.style.display = "block"; } if(descLabel) descLabel.innerText = "पाठस्य विवरणम् (Lesson Description)"; if(applyAllDiv) applyAllDiv.style.opacity = "0.4"; if(document.getElementById('applyAllCheckbox')) document.getElementById('applyAllCheckbox').checked = false; }
}

async function submitLesson() { 
    const clsVal = document.getElementById('classSelect').value; const desc = document.getElementById('descriptionInput').value; const dateVal = document.getElementById('dateInput').value; const isLeave = document.getElementById('leaveCheckbox') ? document.getElementById('leaveCheckbox').checked : false; const applyAll = document.getElementById('applyAllCheckbox') ? document.getElementById('applyAllCheckbox').checked : false;
    if(!clsVal) return alert("कृपया कक्षां चिनोतु!"); if(!desc.trim()) return alert(isLeave ? "कृपया कारणं लिखतु! (Please enter reason)" : "कृपया पाठस्य विवरणं लिखतु!"); 
    const clsData = JSON.parse(decodeURIComponent(clsVal)); let presentStudents = []; 
    if(!isLeave && clsData.gana !== "इतरकार्यम्") { document.querySelectorAll('.att-checkbox').forEach(cb => { if(cb.checked) presentStudents.push(cb.value); }); } 
    const attendanceStr = isLeave ? "रद्दम् (Cancelled)" : presentStudents.join(", "); 
    const btn = document.getElementById('submitBtn'); const origText = btn.innerText; btn.innerText = "समर्प्यते..."; btn.disabled = true; 

    if(clsData.rowIdx) {
        const formData = new URLSearchParams(); formData.append('action', 'updateLog'); formData.append('rowIdx', clsData.rowIdx); formData.append('description', desc); formData.append('attendance', attendanceStr); 
        try { await fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData }); alert("सफलम्! (Update Success)"); finishSubmit(btn, origText); } catch(e) { alert("दोषः जातः!"); btn.innerText = origText; btn.disabled = false; }
    } else if(isLeave && applyAll) {
        let pendingClasses = [];
        (timetableData[currentLoggedIn] || []).forEach(c => { if(c.gana !== "इतरकार्यम्") { let isSub = fetchedLogs.some(l => l.normalizedDate === dateVal && l['आचार्यः (Acharya)'] === currentLoggedIn && makeKey(currentLoggedIn, l['गणः (Class/Gana)'], l['विषयः (Subject)']) === makeKey(currentLoggedIn, c.gana, c.subject)); if(!isSub) pendingClasses.push(c); } });
        let promises = pendingClasses.map(c => { const fd = new URLSearchParams(); fd.append('action', 'addLog'); fd.append('date', dateVal); fd.append('acharya', currentLoggedIn); fd.append('gana', c.gana); fd.append('time', c.time); fd.append('subject', c.subject); fd.append('description', "[रद्दम्] " + desc); fd.append('attendance', attendanceStr); return fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: fd }); });
        try { await Promise.all(promises); alert("सफलम्! सर्वाभ्यः कक्षाभ्यः कारणं योजितम्। (Applied to all classes)"); finishSubmit(btn, origText); } catch(e) { alert("दोषः जातः!"); btn.innerText = origText; btn.disabled = false; }
    } else {
        const descFinal = isLeave ? "[रद्दम्] " + desc : desc; const fd = new URLSearchParams(); fd.append('action', 'addLog'); fd.append('date', dateVal); fd.append('acharya', clsData.acharya); fd.append('gana', clsData.gana); fd.append('time', clsData.time); fd.append('subject', clsData.subject); fd.append('description', descFinal); fd.append('attendance', attendanceStr);
        try { await fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: fd }); alert("सफलम्! (Success)"); finishSubmit(btn, origText); } catch(e) { alert("दोषः जातः!"); btn.innerText = origText; btn.disabled = false; }
    }
}
function finishSubmit(btn, origText) { document.getElementById('descriptionInput').value = ""; document.getElementById('attendanceSection').style.display="none"; if(document.getElementById('leaveGroup')) document.getElementById('leaveGroup').style.display="none"; btn.innerText = origText; btn.disabled = false; fetchDataFromGoogleSheets(); goToDashboard(); }

// --- EXTRA DUTIES LOGIC ---
function renderDutiesForm() {
    const container = document.getElementById('dutiesListContainer');
    if(isAdmin) { container.innerHTML = "<p style='color:#D32F2F; font-weight:bold;'>Admin cannot submit duties directly. Login as an Acharya.</p>"; document.getElementById('submitDutiesBtn').style.display='none'; return; }
    
    let dutyStr = settingsData['Duty_' + currentLoggedIn] || "";
    let duties = dutyStr.split(',').map(s => s.trim()).filter(s => s);
    
    if(duties.length === 0) { container.innerHTML = "<p style='color:#555;'>तदानीं किमपि विशेषदायित्वं नास्ति। (No duties assigned)</p>"; document.getElementById('submitDutiesBtn').style.display='none'; return; }
    
    document.getElementById('submitDutiesBtn').style.display='inline-block';
    const dateStr = document.getElementById('dateInput').value;
    let submittedDuties = new Set();
    fetchedLogs.forEach(l => { if(l.normalizedDate === dateStr && l['आचार्यः (Acharya)'] === currentLoggedIn && l['गणः (Class/Gana)'] === 'दायित्वम्') { submittedDuties.add(l['विषयः (Subject)']); } });

    let html = "";
    duties.forEach((d, i) => {
        let isDone = submittedDuties.has(d);
        if(isDone) {
            html += `<div class="data-card" style="border-left-color: #9E9E9E; background:#F5F5F5; padding:15px; margin-bottom:10px;"><h4 style="margin:0 0 5px 0; color:#757575;">${d}</h4><p style="margin:0; color:#2E7D32; font-weight:bold;">✅ सम्पन्नम् (Submitted)</p></div>`;
        } else {
            html += `<div class="data-card" style="border-left-color: #1565C0; padding:15px; margin-bottom:10px;">
                <h4 style="margin:0 0 10px 0; color:#0D47A1;">${d}</h4>
                <label style="display:flex; align-items:center; gap:8px; font-weight:bold; cursor:pointer; color:#1B5E20; margin-bottom:10px;">
                    <input type="checkbox" id="chk_duty_${i}" value="${d}" style="width:18px; height:18px;" onchange="document.getElementById('desc_duty_${i}').style.display = this.checked ? 'block' : 'none';">
                    अवलोकितम् / सम्पन्नम् (Observed / Done)
                </label>
                <div id="desc_duty_${i}" style="display:none;"><textarea id="txt_duty_${i}" class="form-control" rows="2" placeholder="किम् अवलोकितम्? (ಏನು ಗಮನಿಸಿದ್ದೀರಿ?)..."></textarea></div>
            </div>`;
        }
    });
    container.innerHTML = html;
}

async function submitDuties() {
    const dateVal = document.getElementById('dateInput').value;
    let dutyStr = settingsData['Duty_' + currentLoggedIn] || ""; let duties = dutyStr.split(',').map(s => s.trim()).filter(s => s);
    let toSubmit = []; let hasError = false;

    duties.forEach((d, i) => {
        let chk = document.getElementById('chk_duty_' + i);
        if(chk && chk.checked) { let txt = document.getElementById('txt_duty_' + i).value.trim(); if(!txt) hasError = true; toSubmit.push({ subject: d, desc: txt }); }
    });

    if(toSubmit.length === 0) return alert("कृपया किमपि दायित्वं चिनोतु! (Select at least one duty)");
    if(hasError) return alert("कृपया सर्वेषां दायित्वानां विवरणं लिखतु! (Provide description for all checked duties)");

    const btn = document.getElementById('submitDutiesBtn'); const origText = btn.innerText; btn.innerText = "समर्प्यते..."; btn.disabled = true;
    let promises = toSubmit.map(d => { const fd = new URLSearchParams(); fd.append('action', 'addLog'); fd.append('date', dateVal); fd.append('acharya', currentLoggedIn); fd.append('gana', 'दायित्वम्'); fd.append('time', '-'); fd.append('subject', d.subject); fd.append('description', d.desc); fd.append('attendance', 'अवलोकितम्'); return fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: fd }); });
    try { await Promise.all(promises); alert("सफलम्! (Duties Submitted)"); btn.innerText = origText; btn.disabled = false; fetchDataFromGoogleSheets(); goToDashboard(); } catch(e) { alert("दोषः जातः!"); btn.innerText = origText; btn.disabled = false; }
}


// ----------------------------------------------------
// CMS: SYSTEM SETTINGS LOGIC WITH AI & DUTIES TAB
// ----------------------------------------------------
function switchReportCategory(category, btnElement) {
    document.querySelectorAll('.rep-tab').forEach(el => el.classList.remove('active')); btnElement.classList.add('active');
    document.getElementById('cmsSection').style.display = 'none'; document.getElementById('reportsSection').style.display = 'none'; const aiSec = document.getElementById('aiChatSection'); if(aiSec) aiSec.style.display = 'none';
    if(category === 'lesson') { document.getElementById('reportsSection').style.display = 'block'; document.getElementById('lessonSubTabs').style.display = 'flex'; document.getElementById('attendanceSubTabs').style.display = 'none'; document.querySelector('input[name="repType"][value="acharya_wise"]').checked = true; handleReportTypeChange();
    } else if(category === 'attendance') { document.getElementById('reportsSection').style.display = 'block'; document.getElementById('lessonSubTabs').style.display = 'none'; document.getElementById('attendanceSubTabs').style.display = 'flex'; document.querySelector('input[name="repType"][value="student_overall"]').checked = true; handleReportTypeChange();
    } else if(category === 'cms') { document.getElementById('cmsSection').style.display = 'block'; document.getElementById('reportSnapshotArea').style.display = 'none'; document.getElementById('reportSummaryContainer').style.display = 'none'; handleCMSChange(); 
    } else if(category === 'ai_chat') { if(aiSec) aiSec.style.display = 'block'; document.getElementById('reportSnapshotArea').style.display = 'none'; document.getElementById('reportSummaryContainer').style.display = 'none'; }
}
function handleCMSChange() { document.querySelectorAll('.cms-section').forEach(el => el.classList.remove('active')); const cmsType = document.querySelector('input[name="cmsType"]:checked').value; document.getElementById(cmsType + '_form').classList.add('active'); }

function populateCMSDropdowns() { 
    const achSel = document.getElementById('cmsTimeAch'); const msgAch = document.getElementById('cmsMsgAch'); const dutyAch = document.getElementById('cmsDutyAch');
    if(!achSel || !msgAch || !dutyAch) return; 
    let achHtml = ""; let dutyHtml = '<option value="">-- Select Acharya --</option>'; let msgHtml = '<option value="All">Everyone (सामूहिक-सन्देशः)</option>'; 
    for(let ach in acharyaPasswords) { achHtml += `<option value="${ach}">${ach}</option>`; dutyHtml += `<option value="${ach}">${ach}</option>`; msgHtml += `<option value="${ach}">${ach}</option>`; } 
    achSel.innerHTML = achHtml; msgAch.innerHTML = msgHtml; dutyAch.innerHTML = dutyHtml;
}

function submitCMS(action) {
    const formData = new URLSearchParams(); formData.append('action', action);
    if(action === 'addStudent') { formData.append('name', document.getElementById('cmsStuName').value); formData.append('vibhaga', document.getElementById('cmsStuVibhaga').value); formData.append('gana', document.getElementById('cmsStuGana').value); formData.append('vedapatha', document.getElementById('cmsStuVeda').value || "-"); if(!document.getElementById('cmsStuName').value) return alert("Enter Student Name");
    } else if(action === 'addAcharya') { formData.append('name', document.getElementById('cmsAchName').value); formData.append('password', document.getElementById('cmsAchPass').value); formData.append('vedapatha_mapping', document.getElementById('cmsAchVeda').value || "-"); if(!document.getElementById('cmsAchName').value) return alert("Enter Acharya Name");
    } else if(action === 'addTimetable') { formData.append('acharya', document.getElementById('cmsTimeAch').value); formData.append('gana', document.getElementById('cmsTimeGana').value); formData.append('time', document.getElementById('cmsTimeSlot').value); formData.append('subject', document.getElementById('cmsTimeSubj').value); formData.append('vibhaga', document.getElementById('cmsTimeVib').value); if(!document.getElementById('cmsTimeSubj').value) return alert("Enter Subject");
    } else if(action === 'addHoliday') { formData.append('date', document.getElementById('cmsHolDate').value); formData.append('reason', document.getElementById('cmsHolReason').value); if(!document.getElementById('cmsHolDate').value) return alert("Select Date");
    } else if(action === 'addMessage') { formData.append('targetAcharya', document.getElementById('cmsMsgAch').value); formData.append('message', document.getElementById('cmsMsgText').value); formData.append('expiryDate', document.getElementById('cmsMsgExpiry').value); if(!document.getElementById('cmsMsgText').value) return alert("Type a message!"); }
    fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData }).then(res => res.text()).then(data => { alert("Saved Successfully!"); fetchDataFromGoogleSheets(); }).catch(err => alert("Error saving data."));
}

function renderCMSTable() {
    const cmsType = document.querySelector('input[name="cmsType"]:checked').value; 
    if(cmsType === 'cms_avalokanam') return alert("Avalokanam doesn't have a direct CMS table. View 'Avalokanam Report' in the Lesson Reports tab.");
    if(cmsType === 'cms_duties') return alert("Duties do not have a separate table. You can select an Acharya to see/edit their duties in the form above.");
    
    document.getElementById('reportSnapshotArea').style.display = 'block'; document.getElementById('downloadControlsDiv').style.display = 'none'; document.getElementById('deleteControlHeader').style.display = 'block';
    let thead = "", tbody = ""; currentReportTitleStr = "CMS Records"; currentReportDataset = [];
    if(cmsType === 'cms_student') { document.getElementById('reportHeaderTitle').innerText = "Students List"; thead = `<tr><th>Name</th><th>Vibhaga</th><th>Gana</th><th>Vedapatha</th><th>Action</th></tr>`; studentsData.forEach(s => { tbody += `<tr><td>${s.name}</td><td>${s.vibhaga}</td><td>${s.gana}</td><td>${s.vedapatha}</td><td><button class="btn-primary btn-danger" style="padding:4px 8px;font-size:0.8rem;margin:0;" onclick="deleteRecord('deleteRecord', 'Students', ${s.rowIdx})">Del</button></td></tr>`; });
    } else if(cmsType === 'cms_acharya') { document.getElementById('reportHeaderTitle').innerText = "Acharyas List"; thead = `<tr><th>Name</th><th>Password</th><th>Veda Mapping</th><th>Action</th></tr>`; for(let ach in acharyaPasswords) { tbody += `<tr><td style="color:#D35400; font-weight:bold;">${ach}</td><td>${acharyaPasswords[ach]}</td><td>${vedaAcharyaMapping[ach]||"-"}</td><td>Edit in Sheet</td></tr>`; }
    } else if(cmsType === 'cms_timetable') { document.getElementById('reportHeaderTitle').innerText = "Timetable List"; thead = `<tr><th>Acharya</th><th>Gana</th><th>Time</th><th>Subject</th><th>Vibhaga</th><th>Action</th></tr>`; for (const [ach, classes] of Object.entries(timetableData)) { classes.forEach(c => { tbody += `<tr><td>${ach}</td><td>${c.gana}</td><td>${c.time}</td><td>${c.subject}</td><td>${c.vibhaga}</td><td><button class="btn-primary btn-danger" style="padding:4px 8px;font-size:0.8rem;margin:0;" onclick="deleteRecord('deleteRecord', 'Timetable', ${c.rowIdx})">Del</button></td></tr>`; }); }
    } else if(cmsType === 'cms_holiday') { document.getElementById('reportHeaderTitle').innerText = "Holidays List"; thead = `<tr><th>Date</th><th>Reason</th><th>Action</th></tr>`; holidaysData.forEach(h => { tbody += `<tr><td>${h.normalizedDate}</td><td>${h.Reason}</td><td><button class="btn-primary btn-danger" style="padding:4px 8px;font-size:0.8rem;margin:0;" onclick="deleteRecord('deleteRecord', 'Holidays', ${h.rowIdx})">Del</button></td></tr>`; });
    } else if(cmsType === 'cms_message') { document.getElementById('reportHeaderTitle').innerText = "Sent Messages"; thead = `<tr><th>Target</th><th>Message</th><th>Expiry Date</th><th>Action</th></tr>`; messagesData.forEach(m => { tbody += `<tr><td>${m.Target_Acharya}</td><td>${m.Message}</td><td>${m.ExpiryDate?normalizeSheetDate(m.ExpiryDate):'-'}</td><td><button class="btn-primary btn-danger" style="padding:4px 8px;font-size:0.8rem;margin:0;" onclick="deleteRecord('deleteRecord', 'Messages', ${m.rowIdx})">Del</button></td></tr>`; }); }
    if(tbody === "") tbody = `<tr><td colspan="6" style="text-align:center;">No records found.</td></tr>`; document.getElementById('reportTableBody').innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody>`;
}

function deleteRecord(actionType, sheetNameOrRowIdx, actualRowIdx) {
    if(!confirm("ಖಚಿತವಾಗಿಯೂ ಈ ಮಾಹಿತಿಯನ್ನು अಳಿಸಬೇಕೇ? (Are you sure you want to delete this?)")) return; const formData = new URLSearchParams(); formData.append('action', actionType); 
    if(actionType === 'deleteRecord') { formData.append('sheetName', sheetNameOrRowIdx); formData.append('rowIdx', actualRowIdx); } else { formData.append('rowIdx', sheetNameOrRowIdx); } 
    fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData }).then(res => res.text()).then(data => { alert("अपाकृतम्! (Deleted Successfully)"); fetchDataFromGoogleSheets(); if(actionType === 'deleteLog') generateAdvancedReport(); }).catch(err => alert("दोषः जातः!"));
}

// AVALOKANAM LOGIC
function updateAdminAvalokanamUI() { const pName = document.getElementById('cmsPakshaName'); const sText = document.getElementById('cmsAvalokanamStatusText'); if(!pName || !sText) return; pName.value = settingsData['Avalokanam_Paksha'] || ""; if(settingsData['Avalokanam_Status'] === 'ON') { sText.innerText = "ON (Active)"; sText.style.color = "#2E7D32"; } else { sText.innerText = "OFF (Inactive)"; sText.style.color = "#D32F2F"; } }
function setAvalokanamStatus(status) { let paksha = document.getElementById('cmsPakshaName').value.trim(); if(status === 'ON' && !paksha) return alert("Please enter the Paksha Name first!"); Promise.all([ fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: new URLSearchParams({action: 'updateSetting', key: 'Avalokanam_Status', value: status}) }), fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: new URLSearchParams({action: 'updateSetting', key: 'Avalokanam_Paksha', value: paksha}) }) ]).then(() => { alert("Evaluation Status Updated!"); fetchDataFromGoogleSheets(); }).catch(err => alert("Error updating status.")); }
function checkAndShowAvalokanamBanner() {
    let settingsData = allSettingsArray;
    console.log("🔍 Checking Avalokanam Banner Status...");
    console.log("📦 settingsData array:", settingsData);
    
    let avStatus = 'OFF';
    let avPaksha = '';

    if (settingsData && settingsData.length > 0) {
        settingsData.forEach(row => {
            // Convert all values in the row to string and lowercase for safe checking
            let rowValues = Object.values(row).map(v => String(v).trim().toLowerCase());
            
            if (rowValues.includes('avalokanam_status')) {
                avStatus = String(row.Value || row.value || Object.values(row)[2] || Object.values(row)[1] || 'OFF').trim().toUpperCase();
            }
            if (rowValues.includes('avalokanam_paksha')) {
                avPaksha = String(row.Value || row.value || Object.values(row)[2] || Object.values(row)[1] || '').trim();
            }
        });
    }

    console.log("⚙️ Extracted Status:", avStatus, "| Paksha:", avPaksha);

    let banner = document.getElementById('avalokanamAlertBanner');
    if (banner) {
        if (avStatus === 'ON') {
            banner.style.display = 'block';
            let pakshaSpan = document.getElementById('activePakshaName');
            if(pakshaSpan) pakshaSpan.innerText = avPaksha + " ";
            let modalTitle = document.getElementById('avModalPakshaTitle');
            if(modalTitle) modalTitle.innerText = avPaksha;
            console.log("✅ Banner set to visible (block)");
        } else {
            banner.style.display = 'none';
            console.log("❌ Banner hidden (Status is OFF or not matched)");
        }
    } else {
        console.error("🚨 Banner element not found in DOM!");
    }
}

function openAvalokanamModal() {
    document.getElementById('avModalPakshaTitle').innerText = settingsData['Avalokanam_Paksha'] || ""; const sel = document.getElementById('avClassSelect'); 
    let htmlStr = '<option value="">-- कक्षां चिनोतु (Select Class) --</option>'; const classes = timetableData[currentLoggedIn] || []; let submittedSets = new Set();
    avalokanamData.forEach(av => { if(av.Paksha === settingsData['Avalokanam_Paksha'] && av.Acharya === currentLoggedIn) { submittedSets.add(makeKey(currentLoggedIn, av.Gana, av.Subject)); } });
    classes.forEach(cls => {
        if(cls.gana === "इतरकार्यम्") return; let valStr = encodeURIComponent(JSON.stringify({acharya: currentLoggedIn, gana: cls.gana, subject: cls.subject, vibhaga: cls.vibhaga})); let key = makeKey(currentLoggedIn, cls.gana, cls.subject);
        if(submittedSets.has(key)) { htmlStr += `<option value="${valStr}" disabled style="color:#9E9E9E;">✅ सम्पन्नम् - ${cls.gana} (${cls.subject})</option>`; } else { htmlStr += `<option value="${valStr}">${cls.gana} | ${cls.subject}</option>`; }
    });
    sel.innerHTML = htmlStr; document.getElementById('avStudentsContainer').innerHTML = ""; document.getElementById('avalokanamModal').style.display = 'flex';
}

function renderAvStudents() {
    const val = document.getElementById('avClassSelect').value; const container = document.getElementById('avStudentsContainer'); if(!val) { container.innerHTML = ""; return; }
    const cls = JSON.parse(decodeURIComponent(val)); let students = getExpectedStudents(cls.gana, cls.subject, cls.vibhaga, cls.acharya);
    if(students.length === 0) { container.innerHTML = "<p style='color:red;'>छात्राः न सन्ति।</p>"; return; }
    let html = `<table class="report-table" style="width:100%; min-width:650px;"><thead><tr><th>छात्रः (Student)</th><th>लेखनम् (Notes)</th><th>अनुवादः (Trans.)</th><th>सहभागिता (Part.)</th><th>टिप्पणी (Remarks)</th></tr></thead><tbody>`;
    const options = `<option value="">-</option><option value="A+">A+</option><option value="A">A</option><option value="B+">B+</option><option value="B">B</option><option value="C">C</option><option value="NA">NA (अनुपस्थितः)</option>`;
    students.forEach(st => { html += `<tr class="av-student-row" data-name="${st.name}"><td style="font-weight:bold; color:#1B5E20;">${st.name}</td><td><select class="form-control av-lekhanam" style="padding:6px; margin:0;">${options}</select></td><td><select class="form-control av-anuvadah" style="padding:6px; margin:0;">${options}</select></td><td><select class="form-control av-sahabhagita" style="padding:6px; margin:0;">${options}</select></td><td><input type="text" class="form-control av-tippani" style="padding:6px; margin:0;" placeholder="Optional"></td></tr>`; });
    html += `</tbody></table>`; container.innerHTML = html;
}

function submitAvalokanam() {
    const val = document.getElementById('avClassSelect').value; if(!val) return alert("कृपया कक्षां चिनोतु!"); const cls = JSON.parse(decodeURIComponent(val)); let evalsArr = []; let hasError = false;
    document.querySelectorAll('.av-student-row').forEach(row => { let name = row.getAttribute('data-name'); let l = row.querySelector('.av-lekhanam').value; let a = row.querySelector('.av-anuvadah').value; let s = row.querySelector('.av-sahabhagita').value; let t = row.querySelector('.av-tippani').value || "-"; if(!l || !a || !s) hasError = true; evalsArr.push({student: name, lekhanam: l, anuvadah: a, sahabhagita: s, tippani: t}); });
    if(hasError) return alert("कृपया सर्वेषां छात्राणां मूल्याङ्कनं पूर्णं कुरुतु! (Please select a grade for all students)");
    let btn = document.getElementById('avSubmitBtn'); btn.innerText = "समर्प्यते..."; btn.disabled = true;
    let formData = new URLSearchParams(); formData.append('action', 'addAvalokanam'); formData.append('paksha', settingsData['Avalokanam_Paksha']); formData.append('acharya', cls.acharya); formData.append('gana', cls.gana); formData.append('subject', cls.subject); formData.append('evaluations', JSON.stringify(evalsArr));
    fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData }).then(res => res.text()).then(data => { alert("सफलम्! (Evaluation Submitted)"); document.getElementById('avalokanamModal').style.display='none'; btn.innerText = "समर्पयतु (Submit Evaluation)"; btn.disabled = false; fetchDataFromGoogleSheets(); }).catch(err => { alert("दोषः जातः!"); btn.innerText = "समर्पयतु (Submit Evaluation)"; btn.disabled = false; });
}

// ----------------------------------------------------
// ADVANCED REPORTS LOGIC
// ----------------------------------------------------
function handleReportTypeChange() {
    const rRadio = document.querySelector('input[name="repType"]:checked'); if(!rRadio) return;
    const repType = rRadio.value; const isAttendance = repType.startsWith('student');
    const fStud = document.getElementById('advFilterStudent'); if(fStud) fStud.disabled = !isAttendance && repType !== 'avalokanam_report'; 
    const fAch = document.getElementById('advFilterAcharya'); if(fAch) fAch.disabled = (repType === 'student_overall');
    if(fStud) fStud.style.borderColor = (isAttendance && !fStud.value) ? "#E65100" : "#E0E0E0";
    const fDept = document.getElementById('advFilterDept');
    if(fDept) { if(repType === "dept_vedanta") fDept.value = "वेदान्त"; if(repType === "dept_vyakarana") fDept.value = "व्याकरण"; if(repType === "dept_all") fDept.value = ""; }
    if(repType.startsWith('dept') || repType === 'avalokanam_report') populateCascadingFilters();
}

function populateCascadingFilters() {
    const sDept = document.getElementById('advFilterDept'); const selDept = sDept ? sDept.value : "";
    const sGana = document.getElementById('advFilterGana'); const selGana = sGana ? sGana.value : "";
    const sSubj = document.getElementById('advFilterSubject'); const selSubj = sSubj ? sSubj.value : "";
    const sAch = document.getElementById('advFilterAcharya'); const selAcharya = sAch ? sAch.value : "";
    let validDepts = new Set(['सामान्य', 'वेदान्त', 'व्याकरण']); let validGanas = new Set(); let validSubjects = new Set(); let validAcharyas = new Set(); let validStudents = new Set();
    for (const [ach, classes] of Object.entries(timetableData)) { classes.forEach(cls => { if(cls.gana === "इतरकार्यम्") return; let matchDept = !selDept || cls.vibhaga === selDept; let matchGana = !selGana || cls.gana === selGana || cls.gana.includes(selGana); let matchSubj = !selSubj || cls.subject === selSubj; let matchAcharya = !selAcharya || ach === selAcharya; if (matchDept && matchGana && matchSubj) validAcharyas.add(ach); if (matchDept && matchSubj && matchAcharya) { cls.gana.split(' + ').forEach(g => validGanas.add(g)); } if (matchDept && matchGana && matchAcharya) validSubjects.add(cls.subject); }); }
    studentsData.forEach(s => { if((!selDept || s.vibhaga === selDept) && (!selGana || s.gana === selGana)) { validStudents.add(s.name); } });
    const updateSelect = (id, validSet, defaultText) => { const el = document.getElementById(id); if(!el) return; const currentVal = el.value; el.innerHTML = `<option value="">-- All ${defaultText} --</option>`; [...validSet].sort().forEach(val => { let selected = (val === currentVal) ? "selected" : ""; el.innerHTML += `<option value="${val}" ${selected}>${val}</option>`; }); if(!validSet.has(currentVal)) el.value = ""; };
    updateSelect('advFilterDept', validDepts, "Departments"); updateSelect('advFilterGana', validGanas, "Ganas"); updateSelect('advFilterSubject', validSubjects, "Classes/Subjects"); updateSelect('advFilterAcharya', validAcharyas, "Acharyas"); updateSelect('advFilterStudent', validStudents, "Students");
}

function resetAdvancedFilters() {
    const today = new Date().toISOString().split('T')[0]; const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const ids = ['advFilterFrom', 'advFilterTo', 'advFilterDept', 'advFilterGana', 'advFilterSubject', 'advFilterAcharya', 'advFilterStudent'];
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = (id === 'advFilterFrom' ? firstDay : (id === 'advFilterTo' ? today : "")); });
    const chips = document.getElementById('activeFilterChips'); if(chips) chips.innerHTML = ""; 
    const rArea = document.getElementById('reportSnapshotArea'); if(rArea) rArea.style.display = 'none'; 
    const rSumm = document.getElementById('reportSummaryContainer'); if(rSumm) rSumm.style.display = 'none'; 
    populateCascadingFilters(); handleReportTypeChange();
}

function generateAdvancedReport() {
    const fFrom = document.getElementById('advFilterFrom').value; const fTo = document.getElementById('advFilterTo').value; const fDept = document.getElementById('advFilterDept').value; const fGana = document.getElementById('advFilterGana').value; const fSubj = document.getElementById('advFilterSubject').value; const fAcharya = document.getElementById('advFilterAcharya').value; const fStudent = document.getElementById('advFilterStudent').value; const repType = document.querySelector('input[name="repType"]:checked').value;
    if(!fFrom || !fTo) return alert("Please select both From and To dates!"); if(repType.startsWith('student') && !fStudent) return alert("Please select a Student for Attendance Reports!");

    currentActiveFiltersArr = [`Date: ${fFrom} to ${fTo}`]; let chipsHtml = `<div class="chip"><span>Date:</span> ${fFrom} to ${fTo}</div>`;
    if(fDept) { chipsHtml += `<div class="chip"><span>Dept:</span> ${fDept}</div>`; currentActiveFiltersArr.push(`Dept: ${fDept}`); } if(fGana) { chipsHtml += `<div class="chip"><span>Gana:</span> ${fGana}</div>`; currentActiveFiltersArr.push(`Gana: ${fGana}`); } if(fSubj) { chipsHtml += `<div class="chip"><span>Subject:</span> ${fSubj}</div>`; currentActiveFiltersArr.push(`Subject: ${fSubj}`); } if(fAcharya) { chipsHtml += `<div class="chip"><span>Acharya:</span> ${fAcharya}</div>`; currentActiveFiltersArr.push(`Acharya: ${fAcharya}`); } if(fStudent) { chipsHtml += `<div class="chip"><span>Student:</span> ${fStudent}</div>`; currentActiveFiltersArr.push(`Student: ${fStudent}`); }
    document.getElementById('activeFilterChips').innerHTML = chipsHtml;

    if(repType === 'avalokanam_report') { let filteredAvalokanam = avalokanamData.filter(av => { if(fAcharya && av.Acharya !== fAcharya) return false; if(fGana && av.Gana !== fGana && !av.Gana.includes(fGana)) return false; if(fSubj && av.Subject !== fSubj) return false; if(fStudent && av.Student !== fStudent) return false; return true; }); renderReportData(repType, filteredAvalokanam, {fFrom, fTo, fDept, fGana, fSubj, fAcharya, fStudent}); return; }

    let filteredLogs = fetchedLogs.filter(log => {
        if(!log.normalizedDate) return false; const lDate = log.normalizedDate;
        if (lDate < fFrom || lDate > fTo) return false; if (log['विषयः (Subject)'] === "अनध्यायः") return false;
        const lAch = (log['आचार्यः (Acharya)']||"").trim(); const lGana = (log['गणः (Class/Gana)']||"").trim(); const lSubj = (log['विषयः (Subject)']||"").trim();
        if (fAcharya && lAch !== fAcharya) return false; if (fGana && lGana !== fGana && !lGana.includes(fGana)) return false; if (fSubj && lSubj !== fSubj) return false;
        if (fDept) { let classVibhaga = ""; (timetableData[lAch] || []).forEach(c => { if(c.subject === lSubj && c.gana === lGana) classVibhaga = c.vibhaga; }); if(classVibhaga !== fDept) return false; }
        if (!repType.startsWith('student') && fStudent) { if(!(log['उपस्थिताः (Present)']||"").includes(fStudent)) return false; } return true;
    });
    renderReportData(repType, filteredLogs, {fFrom, fTo, fDept, fGana, fSubj, fAcharya, fStudent});
}

function renderReportData(repType, logs, filters) {
    const tableBody = document.getElementById('reportTableBody'); const summaryBox = document.getElementById('reportSummaryContainer'); document.getElementById('downloadControlsDiv').style.display = 'flex'; document.getElementById('deleteControlHeader').style.display = (repType === "advanced_combined") ? "block" : "none";
    currentReportDataset = []; currentReportColumns = []; let thead = "", tbody = ""; let stat1 = 0, stat2 = 0; currentReportTitleStr = "";

    if(repType === "avalokanam_report") { currentReportTitleStr = "पाक्षिक-अवलोकनम् Report (Evaluation)"; currentReportColumns = ["Paksha", "Acharya", "Gana", "Subject", "Student", "Lekhanam", "Anuvadah", "Sahabhagita", "Remarks"]; thead = `<tr><th>Paksha</th><th>Acharya</th><th>Gana / Subject</th><th>Student</th><th>Lekhanam</th><th>Anuvadah</th><th>Participation</th><th>Remarks</th></tr>`; logs.forEach(av => { currentReportDataset.push({"Paksha": av.Paksha, "Acharya": av.Acharya, "Gana": av.Gana, "Subject": av.Subject, "Student": av.Student, "Lekhanam": av.Lekhanam, "Anuvadah": av.Anuvadah, "Sahabhagita": av.Sahabhagita, "Remarks": av.Tippani}); tbody += `<tr><td>${av.Paksha}</td><td style="color:#D35400; font-weight:bold;">${av.Acharya}</td><td>${av.Gana}<br><span style="font-size:0.8rem; color:#555;">${av.Subject}</span></td><td style="font-weight:bold; color:#1B5E20;">${av.Student}</td><td>${av.Lekhanam}</td><td>${av.Anuvadah}</td><td>${av.Sahabhagita}</td><td>${av.Tippani}</td></tr>`; stat1++; }); summaryBox.innerHTML = `<div class="summary-card"><h4>Evaluation Records</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div>`; }
    else if(repType === "acharya_wise") { currentReportTitleStr = "Acharya-wise Lesson Report"; currentReportColumns = ["Acharya", "Subject / Class", "Total Lessons"]; let agMap = {}; logs.forEach(l => { let ach = l['आचार्यः (Acharya)']; if(!agMap[ach]) agMap[ach] = {}; let subj = l['विषयः (Subject)']; agMap[ach][subj] = (agMap[ach][subj] || 0) + 1; stat1++; }); stat2 = Object.keys(agMap).length; thead = `<tr><th>Acharya</th><th>Subject / Class</th><th>Total Lessons</th></tr>`; for(let ach in agMap) { for(let subj in agMap[ach]) { currentReportDataset.push({"Acharya": ach, "Subject / Class": subj, "Total Lessons": agMap[ach][subj]}); tbody += `<tr><td style="font-weight:bold; color:#E65100;">${ach}</td><td>${subj}</td><td>${translateNumbersToDevanagari(agMap[ach][subj])}</td></tr>`; } } summaryBox.innerHTML = `<div class="summary-card"><h4>Total Lessons</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div><div class="summary-card"><h4>Active Acharyas</h4><p class="val">${translateNumbersToDevanagari(stat2)}</p></div>`; }
    else if (repType === "gana_wise" || repType === "gana_class_wise") { currentReportTitleStr = repType === "gana_class_wise" ? "Gana & Class Breakdown Report" : "Gana-wise Breakdown Report"; currentReportColumns = ["Gana", "Acharya", "Subject / Class", "Total Lessons"]; let gMap = {}; logs.forEach(l => { let gStr = l['गणः (Class/Gana)']; if(gStr === "इतरकार्यम्") return; gStr.split(' + ').forEach(g => { if(filters.fGana && g !== filters.fGana) return; if(!gMap[g]) gMap[g] = {}; let achSub = l['आचार्यः (Acharya)'] + "|" + l['विषयः (Subject)']; gMap[g][achSub] = (gMap[g][achSub] || 0) + 1; stat1++; }); }); stat2 = Object.keys(gMap).length; thead = `<tr><th>Gana</th><th>Acharya</th><th>Subject / Class</th><th>Total Lessons</th></tr>`; for(let g in gMap) { for(let item in gMap[g]) { let parts = item.split('|'); currentReportDataset.push({"Gana": g, "Acharya": parts[0], "Subject / Class": parts[1], "Total Lessons": gMap[g][item]}); tbody += `<tr><td style="font-weight:bold; color:#2E7D32;">${g}</td><td>${parts[0]}</td><td>${parts[1]}</td><td>${translateNumbersToDevanagari(gMap[g][item])}</td></tr>`; } } summaryBox.innerHTML = `<div class="summary-card"><h4>Total Lessons</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div><div class="summary-card"><h4>Ganas Covered</h4><p class="val">${translateNumbersToDevanagari(stat2)}</p></div>`; }
    else if (repType.startsWith("dept")) { currentReportTitleStr = filters.fDept ? `Academic Report: ${filters.fDept} Department` : "Department-wise Academic Report"; currentReportColumns = ["Department", "Acharya", "Subject", "Total Lessons"]; let dMap = {}; logs.forEach(l => { let vib = "सामान्य"; let ach = l['आचार्यः (Acharya)']; let sub = l['विषयः (Subject)']; (timetableData[ach] || []).forEach(c => { if(c.subject === sub) vib = c.vibhaga; }); if(filters.fDept && vib !== filters.fDept) return; if(!dMap[vib]) dMap[vib] = {}; let combo = ach + "|" + sub; dMap[vib][combo] = (dMap[vib][combo] || 0) + 1; stat1++; }); thead = `<tr><th>Department</th><th>Acharya</th><th>Subject</th><th>Total Lessons</th></tr>`; for(let v in dMap) { for(let item in dMap[v]) { let parts = item.split('|'); currentReportDataset.push({"Department": v, "Acharya": parts[0], "Subject": parts[1], "Total Lessons": dMap[v][item]}); tbody += `<tr><td style="font-weight:bold; color:#AD1457;">${v}</td><td>${parts[0]}</td><td>${parts[1]}</td><td>${translateNumbersToDevanagari(dMap[v][item])}</td></tr>`; } } summaryBox.innerHTML = `<div class="summary-card"><h4>Total Lessons</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div>`; }
    else if (repType === "advanced_combined" || repType === "student_class_date") { currentReportTitleStr = "Advanced Combined Log Viewer"; currentReportColumns = ["Date", "Acharya", "Gana", "Subject", "Description", "Attendance Info"]; thead = `<tr><th>Date</th><th>Acharya</th><th>Gana</th><th>Subject</th><th>Description</th><th>Attendance Info</th><th>Action</th></tr>`; logs.forEach(l => { let dt = l.normalizedDate; let isPresText = "-"; if(filters.fStudent) { isPresText = (l['उपस्थिताः (Present)']||"").includes(filters.fStudent) ? "Present" : "Absent"; } else { isPresText = l['उपस्थिताः (Present)']; } currentReportDataset.push({"Date": dt, "Acharya": l['आचार्यः (Acharya)'], "Gana": l['गणः (Class/Gana)'], "Subject": l['विषयः (Subject)'], "Description": l['विवरणम् (Lesson Description)'], "Attendance Info": isPresText}); tbody += `<tr><td>${dt}</td><td style="color:#D35400; font-weight:bold;">${l['आचार्यः (Acharya)']}</td><td>${l['गणः (Class/Gana)']}</td><td style="color:#2E7D32;">${l['विषयः (Subject)']}</td><td>${l['विवरणम् (Lesson Description)']}</td><td style="font-size:0.8rem;">${isPresText}</td><td><button class="btn-primary btn-danger" style="padding: 4px 8px; font-size:0.75rem; margin:0;" onclick="deleteRecord('deleteLog', 'Logs', ${l.rowIdx})">Del</button></td></tr>`; stat1++; }); summaryBox.innerHTML = `<div class="summary-card"><h4>Matching Records</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div>`; }
    else if (repType.startsWith('student')) {
        let studentName = filters.fStudent; let expectedClasses = []; let totalExpected = 0, totalAttended = 0;
        logs.forEach(l => { let isExpected = false; let expectedList = getExpectedStudents(l['गणः (Class/Gana)'], l['विषयः (Subject)'], "Unknown", l['आचार्यः (Acharya)']); expectedList.forEach(s => { if(s.name === studentName) isExpected = true; }); if(isExpected) { totalExpected++; let isPresent = (l['उपस्थिताः (Present)'] || "").includes(studentName); if(isPresent) totalAttended++; expectedClasses.push({ date: l.normalizedDate, subj: l['विषयः (Subject)'], ach: l['आचार्यः (Acharya)'], status: isPresent ? "Present" : "Absent" }); } });
        let percent = totalExpected > 0 ? ((totalAttended / totalExpected) * 100).toFixed(2) : 0;
        summaryBox.innerHTML = `<div class="summary-card"><h4>Expected Classes</h4><p class="val">${translateNumbersToDevanagari(totalExpected)}</p></div><div class="summary-card"><h4>Attended (Present)</h4><p class="val" style="color:#2E7D32;">${translateNumbersToDevanagari(totalAttended)}</p></div><div class="summary-card"><h4>Missed (Absent)</h4><p class="val" style="color:#D32F2F;">${translateNumbersToDevanagari(totalExpected - totalAttended)}</p></div><div class="summary-card"><h4>Attendance %</h4><p class="val" style="color:#1565C0;">${translateNumbersToDevanagari(percent)}%</p></div>`;
        if(repType === "student_overall") { currentReportTitleStr = `Overall Attendance Summary: ${studentName}`; currentReportColumns = ["Status", "Count"]; currentReportDataset.push({"Status": "Present", "Count": totalAttended}); currentReportDataset.push({"Status": "Absent", "Count": (totalExpected - totalAttended)}); thead = `<tr><th>Status</th><th>Count</th></tr>`; tbody = `<tr><td>Present ✅</td><td style="color:#2E7D32; font-weight:bold;">${totalAttended}</td></tr><tr><td>Absent ❌</td><td style="color:#D32F2F; font-weight:bold;">${totalExpected - totalAttended}</td></tr>`; } else if (repType === "student_class_wise") { currentReportTitleStr = `Class-wise Attendance: ${studentName}`; currentReportColumns = ["Class / Subject", "Present", "Absent", "Total", "Percentage"]; let subjMap = {}; expectedClasses.forEach(c => { let sKey = c.subj; if(!subjMap[sKey]) subjMap[sKey] = {tot:0, pres:0}; subjMap[sKey].tot++; if(c.status === "Present") subjMap[sKey].pres++; }); thead = `<tr><th>Class / Subject</th><th>Present</th><th>Absent</th><th>Total</th><th>%</th></tr>`; for(let s in subjMap) { let obj = subjMap[s]; let p = ((obj.pres / obj.tot)*100).toFixed(2); currentReportDataset.push({"Class / Subject": s, "Present": obj.pres, "Absent": (obj.tot - obj.pres), "Total": obj.tot, "Percentage": p + "%"}); tbody += `<tr><td style="font-weight:bold; color:#1B5E20;">${s}</td><td style="color:#2E7D32;">${obj.pres}</td><td style="color:#D32F2F;">${obj.tot - obj.pres}</td><td>${obj.tot}</td><td style="font-weight:bold;">${p}%</td></tr>`; } } else if (repType === "student_date_wise") { currentReportTitleStr = `Date-wise Attendance Log: ${studentName}`; currentReportColumns = ["Date", "Subject", "Acharya", "Status"]; expectedClasses.sort((a,b) => b.date.localeCompare(a.date)); thead = `<tr><th>Date</th><th>Subject</th><th>Acharya</th><th>Status</th></tr>`; expectedClasses.forEach(c => { currentReportDataset.push({"Date": c.date, "Subject": c.subj, "Acharya": c.ach, "Status": c.status}); tbody += `<tr><td>${c.date}</td><td>${c.subj}</td><td>${c.ach}</td><td style="font-weight:bold; color:${c.status==='Present'?'#2E7D32':'#D32F2F'}">${c.status}</td></tr>`; }); }
    }
    if(tbody === "") { tbody = `<tr><td colspan="9" style="text-align:center; padding:20px; color:#D32F2F; font-weight:bold;">No records found matching these criteria.</td></tr>`; currentReportDataset = []; document.getElementById('downloadControlsDiv').style.display = 'none'; }
    document.getElementById('reportHeaderTitle').innerText = currentReportTitleStr; document.getElementById('reportTableBody').innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody>`; summaryBox.style.display = 'grid'; document.getElementById('reportSnapshotArea').style.display = 'block';
}

function executeDownload() { if(currentReportDataset.length === 0) return alert("No data available to download!"); const format = document.getElementById('exportFormatSelect').value; if(format === 'png') downloadAsPNG(); else if(format === 'excel') downloadAsExcel(); else if(format === 'pdf') downloadAsPDF(); }
function downloadAsPNG() { const btns = document.querySelectorAll('.btn-danger'); btns.forEach(b => b.style.display = 'none'); html2canvas(document.getElementById('reportSnapshotArea'), { backgroundColor: "#FFFFFF", scale: 2 }).then(canvas => { const link = document.createElement('a'); link.download = `VVG_Report_${new Date().toISOString().split('T')[0]}.png`; link.href = canvas.toDataURL('image/png'); link.click(); btns.forEach(b => b.style.display = 'inline-block'); }); }
function downloadAsExcel() { const ws = XLSX.utils.json_to_sheet(currentReportDataset); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Gurukula_Report"); XLSX.writeFile(wb, `VVG_Report_${new Date().toISOString().split('T')[0]}.xlsx`); }
function downloadAsPDF() { const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(currentReportTitleStr, 14, 20); doc.setFontSize(10); doc.setFont("helvetica", "normal"); let yPos = 30; currentActiveFiltersArr.forEach(f => { doc.text(f, 14, yPos); yPos += 6; }); const rows = currentReportDataset.map(obj => Object.values(obj)); doc.autoTable({ startY: yPos + 5, head: [currentReportColumns], body: rows, theme: 'grid', headStyles: { fillColor: [46, 125, 50] }, styles: { font: 'helvetica', fontSize: 9 } }); doc.save(`VVG_Report_${new Date().toISOString().split('T')[0]}.pdf`); }

// ----------------------------------------------------
// 🤖 GEMINI AI INTEGRATION (CHAT BOT)
// ----------------------------------------------------
function askGeminiAI() {
    const inputEl = document.getElementById('aiPromptInput'); const prompt = inputEl.value.trim(); if(!prompt) return;
    const chatBox = document.getElementById('aiChatHistory'); const sendBtn = document.getElementById('aiSendBtn');
    chatBox.innerHTML += `<div class="user-msg">👤 ${escapeQuotes(prompt)}</div>`; inputEl.value = "";
    const loadingId = "load_" + Date.now(); chatBox.innerHTML += `<div class="ai-msg loading-msg" id="${loadingId}">🤖 चिन्तयन् अस्ति... (Thinking...)</div>`; chatBox.scrollTop = chatBox.scrollHeight;
    sendBtn.disabled = true; inputEl.disabled = true;
    const formData = new URLSearchParams(); formData.append('action', 'askGemini'); formData.append('prompt', prompt);
    fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData })
    .then(res => res.json())
    .then(data => {
        document.getElementById(loadingId).remove();
        if(data.status === "success") { let ans = data.answer.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>'); chatBox.innerHTML += `<div class="ai-msg">🤖 ${ans}</div>`; } else { chatBox.innerHTML += `<div class="ai-msg" style="background:#FFEBEE; color:#C62828;">❌ Error: ${data.message}</div>`; }
        chatBox.scrollTop = chatBox.scrollHeight; sendBtn.disabled = false; inputEl.disabled = false; inputEl.focus();
    }).catch(err => {
        document.getElementById(loadingId).remove(); chatBox.innerHTML += `<div class="ai-msg" style="background:#FFEBEE; color:#C62828;">❌ Network Error: Could not connect to AI.</div>`; chatBox.scrollTop = chatBox.scrollHeight; sendBtn.disabled = false; inputEl.disabled = false;
    });
}

function loadCMSDuties() { const ach = document.getElementById('cmsDutyAch').value; const txt = document.getElementById('cmsDutyText'); if(!ach) { txt.value = ""; return; } txt.value = settingsData['Duty_' + ach] || ""; }
function saveCMSDuties() { const ach = document.getElementById('cmsDutyAch').value; const duties = document.getElementById('cmsDutyText').value; if(!ach) return alert("Select Acharya!"); const btn = event.target; const orig = btn.innerText; btn.innerText = "Saving..."; btn.disabled = true; fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: new URLSearchParams({action: 'updateSetting', key: 'Duty_' + ach, value: duties}) }).then(res => res.text()).then(() => { alert("Saved!"); fetchDataFromGoogleSheets(); btn.innerText = orig; btn.disabled = false; }).catch(e => { alert("Error!"); btn.innerText = orig; btn.disabled = false; }); }

// ----------------------------------------------------
// 📑 SATRA AVALOKANAM & PDF GENERATION LOGIC
// ----------------------------------------------------
const charitryaPoints = [
    "१. श्रद्धा – ज्येष्ठानां वचसि प्रामाण्यम्, अनुष्ठानादिषु प्रवृत्तिः ।",
    "२. नीतिमत्ता – सत्यवचनम्, लोभादिदुर्गुणराहित्यम् ।",
    "३. निर्वहणकौशलम् – कर्तृत्वम्, नेतृत्वम् (श्रमसेवादिषु) ।",
    "४. स्वास्थ्यम् - शारीरिकम् ।",
    "५. मानवीयसम्बन्धः – अन्यैः सह हितमितसम्बन्धः ।",
    "६. सेवामनोभावः/प्राणिदया – ज्येष्ठानाम्, अतिथीनाम्, रुग्णानाम्/ गवाम्, ओषधिवनस्पतीनां च ।",
    "७. सक्रियता – शारीरिकः मानसिकः जाड्याभावः ।",
    "८. इन्द्रियसंयमः – ज्ञानेन्द्रियाणां कर्मेन्द्रियाणां सद्विनियोगः ।",
    "९. स्वच्छता, सरलता, सुभगता – शरीरम्, वस्त्रम्, स्थानम्, परिसरः, पुस्तकादि ।",
    "१०. राष्ट्रियप्रज्ञा – स्वदेशीभावः, राष्ट्रप्रेम, सामाजिकस्पन्दः ।",
    "११. योगः/क्रीडा – आसनम्, प्राणायामः, क्रीडायां भागग्रहणम् ।",
    "१२. मनस्सन्तुलनम् - अन्तःकरणभावनाः (सङ्कल्पः, विकल्पः)",
    "१३. एकाग्रता – अध्ययने, जपे, पाठे ।",
    "१४. कलाकौशलम्, प्रतिभा – सङ्गीतम्, चित्रकला इत्यादि ।",
    "१५. जिज्ञासा – पठ्येतरविषयेषु प्रवृत्तिः, विद्वद्भिः सह संवादः ।",
    "१६. सद्विनियोगः – संस्थावस्तूनाम्, परवस्तूनां च ।"
];

function populateGanacharyaDropdown() {
    let html = '<option value="">-- स्वस्य गणं चिनोतु (Select your Gana) --</option>';
    ["तपः", "तेजः", "ओजः", "वर्चः", "प्रेयः", "श्रेयः", "भ्राजः", "यशः"].forEach(g => { html += `<option value="${g}">${g}</option>`; });
    document.getElementById('satraGanaSelect').innerHTML = html;
}

function renderGanacharyaStudents() {
    let gana = document.getElementById('satraGanaSelect').value;
    let container = document.getElementById('ganacharyaStudentsContainer');
    if(!gana) { container.innerHTML = ""; return; }
    
    let filteredStudents = studentsData.filter(s => s.gana === gana);
    let html = `<table class="report-table" style="width:100%;"><thead><tr><th>छात्रः (Student)</th><th>Action</th></tr></thead><tbody>`;
    
    filteredStudents.forEach(st => {
        let isDone = charitryaData.some(c => c.Student === st.name);
        let btnStr = isDone ? `<button class="btn-primary" style="background:#4CAF50; margin:0; padding:6px 12px; font-size:0.9rem;" onclick="openCharitryaForm('${st.name}', '${gana}')">✅ सम्पादियतु (Edit)</button>` : `<button class="btn-primary" style="background:#F57C00; margin:0; padding:6px 12px; font-size:0.9rem;" onclick="openCharitryaForm('${st.name}', '${gana}')">📝 चारित्र्य-अवलोकनम्</button>`;
        html += `<tr><td style="font-weight:bold; font-size:1.1rem; color:#1B5E20;">${st.name}</td><td>${btnStr}</td></tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

function renderAdminSatraStudents() {
    let gana = document.getElementById('satraAdminGanaSelect').value;
    let container = document.getElementById('adminSatraStudentsContainer');
    if(!gana) { container.innerHTML = ""; return; }

    let filteredStudents = studentsData.filter(s => s.gana === gana);
    let html = `<table class="report-table" style="width:100%;"><thead><tr><th>छात्रः (Student)</th><th>Action</th></tr></thead><tbody>`;

    filteredStudents.forEach(st => {
        html += `<tr>
            <td style="font-weight:bold; font-size:1.1rem; color:#0D47A1;">${st.name}</td>
            <td>
                <button class="btn-primary" style="background:#0288D1; margin:0; margin-right:10px; padding:8px 15px;" onclick="viewStudentReport('${st.name}', '${gana}')">👁️ View</button>
                <button class="btn-primary" style="background:#E53935; margin:0; padding:8px 15px;" onclick="downloadStudentPDF('${st.name}', '${gana}')">📥 Download PDF</button>
            </td>
        </tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

function generateReportHTML(studentName, gana) {
    let wrapperStyle = "width: 794px; height: 1122px; padding: 45px; box-sizing: border-box; background: white; color: black; font-family: 'Laila', sans-serif; position: relative;";

    // PAGE 1 HTML with Logo and Signatures
    let page1Html = `
        <div id="pdfPage1" style="${wrapperStyle}">
            <div style="display:flex; align-items:center; justify-content:center; margin-bottom:20px;">
                <img src="logo.png" style="height:90px; margin-right:20px;" alt="Logo" onerror="this.style.display='none'">
                <div style="text-align:center;">
                    <h1 style="color:#1B5E20; margin:0; font-size: 36px;">वेदविज्ञानगुरुकुलम्</h1>
                    <h3 style="color:#424242; margin:5px 0; font-size: 22px;">पराभव-नाम संवत्सरस्य आकलनपत्रम् - 2025-26</h3>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:bold; font-size:18px;">
                <span>छात्रः : ${studentName}</span>
                <span>गणः : ${gana}</span>
            </div>
            <table border="1" style="width:100%; border-collapse:collapse; text-align:left; font-size:15px;">
                <tr style="background:#2E7D32; color:white;">
                    <th style="padding:12px;">विषयः (Subject)</th>
                    <th style="padding:12px;">स्वाध्यायपूरणम् (Notes)</th>
                    <th style="padding:12px;">विषयावधारणम् (Trans.)</th>
                    <th style="padding:12px;">भागग्रहणम् (Part.)</th>
                    <th style="padding:12px;">अभिप्रायः (Remarks)</th>
                </tr>
    `;
    let academicRows = "";
    avalokanamData.filter(a => a.Student === studentName).forEach(av => {
        academicRows += `<tr>
            <td style="padding:12px;"><b>${av.Subject}</b><br><small>(${av.Acharya})</small></td>
            <td style="padding:12px;">${av.Lekhanam}</td>
            <td style="padding:12px;">${av.Anuvadah}</td>
            <td style="padding:12px;">${av.Sahabhagita}</td>
            <td style="padding:12px;">${av.Tippani}</td>
        </tr>`;
    });
    if(!academicRows) academicRows = `<tr><td colspan="5" style="padding:12px; text-align:center;">Data Not Found</td></tr>`;
    page1Html += academicRows + `</table>
            <div style="display:flex; justify-content:space-between; position:absolute; bottom:50px; left:45px; right:45px; font-weight:bold; font-size:18px;">
                <span>आचार्यः (Acharya)</span>
                <span>गणाचार्यः (Ganacharya)</span>
            </div>
        </div>
    `;

    // PAGE 2 HTML with bottom Signatures
    let page2Html = `
        <div id="pdfPage2" style="${wrapperStyle} margin-top: 20px;">
            <div style="text-align:center; margin-bottom:20px;">
                <h2 style="color:#1565C0; font-size: 28px;">वैयक्तिक-चारित्र्य-अवलोकनम्</h2>
            </div>
            <table border="1" style="width:100%; border-collapse:collapse; text-align:left; font-size:15px;">
                <tr style="background:#1565C0; color:white;">
                    <th style="padding:12px; width:65%;">चारित्र्य-बिन्दवः (Character Points)</th>
                    <th style="padding:12px; width:35%;">गणाचार्यस्य अभिप्रायः (Remarks)</th>
                </tr>
    `;
    let charData = charitryaData.find(c => c.Student === studentName);
    charitryaPoints.forEach((point, index) => {
        let qKey = 'Q' + (index + 1);
        let ans = charData ? (charData[qKey] || charData[qKey.toLowerCase()] || "No Remark") : "No Remark";
        page2Html += `<tr><td style="padding:9px 12px;">${point}</td><td style="padding:9px 12px;">${ans}</td></tr>`;
    });
    page2Html += `</table>
            <div style="display:flex; justify-content:space-between; position:absolute; bottom:50px; left:45px; right:45px; font-weight:bold; font-size:18px;">
                <span>गणाचार्यः (Ganacharya)</span>
                <span>प्रधानाचार्यः (Principal)</span>
            </div>
        </div>
    `;

    return page1Html + page2Html;
}

function viewStudentReport(studentName, gana) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Report Card - ${studentName}</title>
            <link href="https://fonts.googleapis.com/css2?family=Laila:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
                body { background: #525659; display: flex; flex-direction: column; align-items: center; padding: 20px; margin: 0; }
                .page-container { box-shadow: 0 0 10px rgba(0,0,0,0.5); margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="page-container">${generateReportHTML(studentName, gana)}</div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function downloadStudentPDF(studentName, gana) {
    let btn = event.target;
    btn.innerText = "⏳ Generating...";
    btn.disabled = true;

    const reportDiv = document.createElement('div');
    reportDiv.style.position = 'absolute';
    reportDiv.style.top = '-9999px';
    reportDiv.style.left = '-9999px';
    reportDiv.innerHTML = generateReportHTML(studentName, gana);
    document.body.appendChild(reportDiv);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    Promise.all([
        html2canvas(document.getElementById('pdfPage1'), { scale: 2, useCORS: true }),
        html2canvas(document.getElementById('pdfPage2'), { scale: 2, useCORS: true })
    ]).then(canvases => {
        const imgData1 = canvases[0].toDataURL('image/jpeg', 1.0);
        pdf.addImage(imgData1, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        
        pdf.addPage();
        const imgData2 = canvases[1].toDataURL('image/jpeg', 1.0);
        pdf.addImage(imgData2, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        
        pdf.save(`ReportCard_${studentName}.pdf`);
        document.body.removeChild(reportDiv);
        btn.innerText = "📥 Download PDF";
        btn.disabled = false;
    }).catch(err => {
        alert("Error generating PDF");
        document.body.removeChild(reportDiv);
        btn.innerText = "📥 Download PDF";
        btn.disabled = false;
    });
}
// ----------------------------------------------------
// 🧘‍♂️ CHARITRYA EVALUATION FORM & AUTO-SAVE LOGIC
// ----------------------------------------------------

function openCharitryaForm(studentName, ganaName) {
    document.getElementById('charitryaStudentName').innerText = "छात्रः: " + studentName + " (" + ganaName + ")";
    document.getElementById('charitryaGana').value = ganaName;
    let html = "";
    charitryaPoints.forEach((point, index) => {
        let qNum = index + 1;
        html += `<div style="background: #FAFAFA; border: 1px solid #E0E0E0; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #424242;">${point}</p>
            <textarea id="char_q${qNum}" class="form-control" rows="2" placeholder="आचार्यस्य अभिप्रायः (Remarks)..." oninput="saveCharitryaDraft('${studentName}')"></textarea>
        </div>`;
    });
    document.getElementById('charitryaQuestionsContainer').innerHTML = html;
    document.getElementById('charitryaModal').style.display = 'flex';
    loadCharitryaDraft(studentName);
}

function closeCharitryaModal() { document.getElementById('charitryaModal').style.display = 'none'; }

let draftTimeout;
function saveCharitryaDraft(studentName) {
    clearTimeout(draftTimeout);
    draftTimeout = setTimeout(() => {
        let draftObj = {};
        for(let i=1; i<=16; i++) { draftObj['q'+i] = document.getElementById('char_q'+i).value; }
        localStorage.setItem('charitrya_draft_' + studentName, JSON.stringify(draftObj));
        let statusEl = document.getElementById('draftStatus');
        statusEl.innerText = "💾 Saving..."; statusEl.style.color = "#2E7D32";
        setTimeout(() => statusEl.innerText = "", 2000);
    }, 1000);
}

function loadCharitryaDraft(studentName) {
    let draftStr = localStorage.getItem('charitrya_draft_' + studentName);
    if(draftStr) {
        let draftObj = JSON.parse(draftStr);
        for(let i=1; i<=16; i++) { if(draftObj['q'+i]) document.getElementById('char_q'+i).value = draftObj['q'+i]; }
        document.getElementById('draftStatus').innerText = "📝 Draft Loaded"; document.getElementById('draftStatus').style.color = "#D35400";
    }
}

function submitCharitrya() {
    let studentName = document.getElementById('charitryaStudentName').innerText.replace("छात्रः: ", "").split(" (")[0];
    let ganaName = document.getElementById('charitryaGana').value;
    let satraName = document.getElementById('charitryaSatra').value;
    let formData = new URLSearchParams();
    formData.append('action', 'addCharitrya'); formData.append('satra', satraName); formData.append('gana', ganaName); formData.append('ganacharya', currentLoggedIn); formData.append('student', studentName);
    for(let i=1; i<=16; i++) { formData.append('q'+i, document.getElementById('char_q'+i).value); }
    let btn = document.getElementById('charitryaSubmitBtn');
    btn.innerText = "समर्प्यते... (Submitting)"; btn.disabled = true;
    fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData }).then(res => res.text()).then(data => {
        alert("सफलम्! चारीत्र्य-अवलोकनम् रक्षितम्। (Submitted Successfully)");
        localStorage.removeItem('charitrya_draft_' + studentName);
        closeCharitryaModal(); btn.innerText = "समर्पयतु (Submit Evaluation)"; btn.disabled = false;
        renderGanacharyaStudents(); // ಬಟನ್ ಹಸಿರು ಬಣ್ಣಕ್ಕೆ (✅ सम्पादियतु) ಬದಲಾಗಲು
    }).catch(err => {
        alert("दोषः जातः! (Error submitting)"); btn.innerText = "समर्पयतु (Submit Evaluation)"; btn.disabled = false;
    });
}

// ----------------------------------------------------
// 📜 VEDA PAREEKSHE (Veda Exam) LOGIC
// ----------------------------------------------------
let currentExaminer = "";
const pareeksheSubjectsList = [
    { id: "p1", name: "वल्लीत्रयम्", max: 30 }, { id: "p2", name: "अरुण-प्रश्नः", max: 25 },
    { id: "p3", name: "सह वै प्रश्नः", max: 15 }, { id: "p4", name: "चित्तिः", max: 20 },
    { id: "p5", name: "महानारायणोपनिषद्", max: 25 }, { id: "p6", name: "सूक्तानि", max: 20 },
    { id: "p7", name: "उदकशान्तिः (ब्राह्मणभागः)", max: 20 }, { id: "p8", name: "उदकशान्तिः (संहिताभागः)", max: 20 },
    { id: "p9", name: "रुद्र-प्रश्नः", max: 10 }, { id: "p10", name: "नम-प्रश्नः", max: 10 },
    { id: "p11", name: "सन्ध्यावन्दनम् + इतराणि", max: 20 }
];

function setupPareeksheDropdown() {
    if (!studentsData || studentsData.length === 0) return;

    let exHtml = '<option value="">-- परीक्षकं चिनोतु (Select Examiner) --</option>';
    if(typeof acharyasData !== 'undefined') {
        acharyasData.forEach(ach => {
            exHtml += `<option value="${ach.name}">${ach.name}</option>`;
        });
    }
    let exSelect = document.getElementById('pareeksheExaminerSelect');
    if(exSelect) exSelect.innerHTML = exHtml;

    let uniqueVedapatha = [...new Set(studentsData.map(s => s.vedapatha).filter(Boolean))];
    let html = '<option value="">-- वेदपाठं चिनोतु (Select Vedapatha) --</option>';
    uniqueVedapatha.forEach(v => { html += `<option value="${v}">${v}</option>`; });
    
    let acharyaSelect = document.getElementById('pareeksheGanaSelect');
    let adminSelect = document.getElementById('pareeksheAdminGanaSelect');
    if(acharyaSelect) acharyaSelect.innerHTML = html;
    if(adminSelect) adminSelect.innerHTML = html;
}

function setExaminerAndShowGana() {
    currentExaminer = document.getElementById('pareeksheExaminerSelect').value;
    if(currentExaminer) {
        document.getElementById('pareeksheGanaSelectBlock').style.display = 'block';
        renderPareeksheStudents();
    } else {
        document.getElementById('pareeksheGanaSelectBlock').style.display = 'none';
        document.getElementById('pareeksheStudentsContainer').innerHTML = "";
    }
}

function renderPareeksheStudents() {
    let vedapatha = document.getElementById('pareeksheGanaSelect').value;
    let container = document.getElementById('pareeksheStudentsContainer');
    if(!vedapatha) { container.innerHTML = ""; return; }
    
    let filtered = studentsData.filter(s => s.vedapatha === vedapatha);
    let html = `<table class="report-table" style="width:100%;"><thead><tr><th>छात्रः (Student)</th><th>Action</th></tr></thead><tbody>`;
    filtered.forEach(st => {
        let btnText = "📝 परीक्षा-अङ्काः";
        let btnColor = "#F57C00";
        // Update logic indicator if already evaluated by current selected Examiner
        let existing = typeof pareeksheData !== 'undefined' ? pareeksheData.find(p => (p.Student || p.student) === st.name && (p.Examiner || p.examiner) === currentExaminer) : null;
        if(existing) { btnText = "✅ सम्पादियतु (Edit/Update)"; btnColor = "#4CAF50"; }
        
        html += `<tr><td style="font-weight:bold; font-size:1.1rem; color:#1B5E20;">${st.name}</td>
        <td><button class="btn-primary" style="background:${btnColor}; margin:0; padding:6px 12px; font-size:0.9rem;" onclick="openPareeksheModal('${st.name}', '${vedapatha}')">${btnText}</button></td></tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

function openPareeksheModal(studentName, vedapathaName) {
    document.getElementById('parStudentName').innerText = studentName;
    document.getElementById('parGana').value = vedapathaName;
    document.getElementById('parAbhivyakti').value = 0;
    document.getElementById('parUchcharane').value = 0;
    document.getElementById('parRemarks').value = "";
    
    // Check for existing entry by current examiner
    let existing = typeof pareeksheData !== 'undefined' ? pareeksheData.find(p => p.Student === studentName && p.Examiner === currentLoggedIn) : null;
    
    let html = "";
    pareeksheSubjectsList.forEach((sub, i) => {
        let isChecked = false;
        let markVal = 0;
        if(existing && existing[sub.id]) {
            isChecked = true;
            markVal = existing[sub.id];
        }
        html += `<div style="display:flex; align-items:center; justify-content:space-between; background:#FAFAFA; padding:10px; border-radius:5px; border:1px solid #E0E0E0;">
            <label style="display:flex; align-items:center; gap:8px; font-weight:bold; color:#333; cursor:pointer; margin:0;">
                <input type="checkbox" id="chk_${sub.id}" style="width:18px; height:18px;" onchange="toggleParSubject('${sub.id}')" ${isChecked ? 'checked' : ''}> ${sub.name} (Max ${sub.max})
            </label>
            <input type="number" id="mark_${sub.id}" class="form-control" style="width:80px; margin:0; display:${isChecked ? 'block' : 'none'};" max="${sub.max}" min="0" value="${markVal}" oninput="calcPareeksheTotal()">
        </div>`;
    });
    document.getElementById('parSubjectsContainer').innerHTML = html;
    
    if(existing) {
        document.getElementById('parAbhivyakti').value = existing.Abhivyakti || 0;
        document.getElementById('parUchcharane').value = existing.Uchcharane || 0;
        document.getElementById('parRemarks').value = existing.Remarks || "";
    }
    calcPareeksheTotal();
    document.getElementById('pareeksheModal').style.display = 'flex';
}

function toggleParSubject(subId) {
    let chk = document.getElementById('chk_' + subId);
    let markInput = document.getElementById('mark_' + subId);
    markInput.style.display = chk.checked ? 'block' : 'none';
    if(!chk.checked) markInput.value = 0;
    calcPareeksheTotal();
}

function calcPareeksheTotal() {
    let totalObtained = 0;
    let totalMax = 30; // 10 (Abhivyakti) + 20 (Uchcharane) common base
    
    pareeksheSubjectsList.forEach(sub => {
        let chk = document.getElementById('chk_' + sub.id);
        if(chk && chk.checked) {
            totalMax += sub.max;
            let val = parseFloat(document.getElementById('mark_' + sub.id).value) || 0;
            totalObtained += val;
        }
    });
    
    let ab = parseFloat(document.getElementById('parAbhivyakti').value) || 0;
    let uc = parseFloat(document.getElementById('parUchcharane').value) || 0;
    totalObtained += (ab + uc);
    
    let percentage = ((totalObtained / totalMax) * 100).toFixed(2);
    
    document.getElementById('parTotalMarks').innerText = totalObtained;
    document.getElementById('parMaxMarks').innerText = totalMax;
    document.getElementById('parPercentage').innerText = percentage;
}

function submitPareekshe() {
    let studentName = document.getElementById('parStudentName').innerText;
    let vedapatha = document.getElementById('parGana').value; 
    let abhivyakti = document.getElementById('parAbhivyakti').value || 0;
    let uchcharane = document.getElementById('parUchcharane').value || 0;
    let remarks = document.getElementById('parRemarks').value || "";
    let total = document.getElementById('parTotalMarks').innerText;
    let max = document.getElementById('parMaxMarks').innerText;
    let percentage = document.getElementById('parPercentage').innerText;

    let subjectsData = [];
    pareeksheSubjectsList.forEach(sub => {
        let chk = document.getElementById('chk_' + sub.id);
        if(chk && chk.checked) {
            subjectsData.push({
                name: sub.name,
                max: sub.max,
                obtained: document.getElementById('mark_' + sub.id).value || 0
            });
        }
    });

    let formData = new URLSearchParams();
    formData.append('action', 'addVedaPareekshe');
    formData.append('student', studentName);
    formData.append('vedapatha', vedapatha);
    formData.append('examiner', currentExaminer);
    formData.append('abhivyakti', abhivyakti);
    formData.append('uchcharane', uchcharane);
    formData.append('remarks', remarks);
    formData.append('total', total);
    formData.append('max', max);
    formData.append('percentage', percentage);
    formData.append('subjectsData', JSON.stringify(subjectsData));

    let btn = document.getElementById('parSubmitBtn');
    btn.innerText = "समर्प्यते... (Submitting)";
    btn.disabled = true;

    fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData })
    .then(res => res.json())
    .then(data => {
        alert("सफलम्! परीक्षा-अङ्काः रक्षिताः। (Marks Submitted Successfully)");
        document.getElementById('pareeksheModal').style.display = 'none';
        btn.innerText = "समर्पयतु (Submit Marks)";
        btn.disabled = false;
        fetchDataFromGoogleSheets(); // Refresh data to show Edit option
    }).catch(err => {
        alert("दोषः जातः! (Error submitting data)");
        btn.innerText = "समर्पयतु (Submit Marks)";
        btn.disabled = false;
    });
}

function renderAdminPareekshe() {
    let vedapatha = document.getElementById('pareeksheAdminGanaSelect').value;
    let container = document.getElementById('adminPareeksheContainer');
    if(!vedapatha) { container.innerHTML = ""; return; }

    let filtered = studentsData.filter(s => s.vedapatha === vedapatha);
    
    let html = `<div style="background:#E3F2FD; padding:20px; border-radius:8px; border:1px solid #90CAF9; text-align:center;">
        <h4 style="margin-top:0; color:#1565C0;">${vedapatha} - वेदपाठ-समूहः (Total Students: ${filtered.length})</h4>
        <p style="color:#555; font-size:0.9rem; margin-bottom:15px;">अस्मिन् समूहे सर्वेषां छात्राणां अङ्काः पश्यन्तु अथवा डाउनलोड् कुर्वन्तु।</p>
        
        <div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap; margin-bottom:15px;">
            <button class="btn-primary" style="background:#0288D1; margin:0;" onclick="viewPareeksheGroup('${vedapatha}', 1)">👁️ View (परीक्षकः १)</button>
            <button class="btn-primary" style="background:#E53935; margin:0;" onclick="downloadPareeksheGroupPDF('${vedapatha}', 1)">📥 Download PDF (परीक्षकः १)</button>
        </div>
        
        <div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap;">
            <button class="btn-primary" style="background:#00796B; margin:0;" onclick="viewPareeksheGroup('${vedapatha}', 2)">👁️ View (परीक्षकः २)</button>
            <button class="btn-primary" style="background:#D84315; margin:0;" onclick="downloadPareeksheGroupPDF('${vedapatha}', 2)">📥 Download PDF (परीक्षकः २)</button>
        </div>
    </div>`;
    
    container.innerHTML = html;
}

function generatePareeksheGroupHTML(vedapatha, examinerNum) {
    let filteredStudents = studentsData.filter(s => s.vedapatha === vedapatha);
    
    // Dynamically find the examiner's name from the submitted data for this group
    let examinerName = "अनिर्दिष्टः (Pending)";
    if(typeof pareeksheData !== 'undefined') {
        let groupEvals = pareeksheData.filter(p => (p.Vedapatha || p.vedapatha) === vedapatha);
        let uniqueExaminers = [...new Set(groupEvals.map(p => p.Examiner || p.examiner).filter(Boolean))].sort();
        if(uniqueExaminers.length >= examinerNum) {
            examinerName = uniqueExaminers[examinerNum - 1];
        }
    }

    let html = `<div style="width: 794px; padding: 40px; background: white; color: black; font-family: 'Laila', sans-serif;">
        <div style="display:flex; align-items:center; justify-content:center; margin-bottom:20px; border-bottom: 2px solid #2E7D32; padding-bottom: 15px;">
            <img src="logo.png" style="height:90px; margin-right:20px;" alt="Logo" onerror="this.style.display='none'">
            <div style="text-align:center;">
                <h1 style="color:#1B5E20; font-size:32px; margin:0;">वेदविज्ञानगुरुकुलम्</h1>
                <h2 style="color:#1565C0; font-size:24px; margin:10px 0;">वेद-परीक्षा - ${vedapatha}</h2>
                <h3 style="color:#424242; font-size:20px; margin:0;">परीक्षकः : ${examinerName}</h3>
            </div>
        </div>`;

    filteredStudents.forEach((st) => {
        // Find evaluation specifically by this examiner
        let evalData = null;
        if(typeof pareeksheData !== 'undefined' && examinerName !== "अनिर्दिष्टः (Pending)") {
            evalData = pareeksheData.find(p => (p.Student || p.student) === st.name && (p.Examiner || p.examiner) === examinerName);
        }
        
        html += `<div style="border: 2px solid #A5D6A7; border-radius: 8px; padding: 15px; margin-bottom: 25px; page-break-inside: avoid;">
            <div style="display:flex; justify-content:space-between; border-bottom: 1px dashed #CCC; padding-bottom:10px; margin-bottom:10px;">
                <span style="font-size:20px; font-weight:bold; color:#D32F2F;">छात्रः : ${st.name}</span>
            </div>`;

        if(evalData) {
            let subs = [];
            try { subs = JSON.parse(evalData.Subjects_JSON || evalData.subjects_json || '[]'); } catch(e) {}
            
            html += `<table style="width:100%; border-collapse:collapse; text-align:left; font-size:15px;" border="1">
                <tr style="background:#E8F5E9;"><th style="padding:8px;">विषयः (Subject)</th><th style="padding:8px; width:80px;">Max</th><th style="padding:8px; width:100px;">Obtained</th></tr>
                <tr><td style="padding:8px;">अभिव्यक्ति-सामर्थ्यम्</td><td style="padding:8px;">10</td><td style="padding:8px; font-weight:bold;">${evalData.Abhivyakti || evalData.abhivyakti}</td></tr>
                <tr><td style="padding:8px;">उच्चारणम्</td><td style="padding:8px;">20</td><td style="padding:8px; font-weight:bold;">${evalData.Uchcharane || evalData.uchcharane}</td></tr>`;
            
            subs.forEach(s => {
                html += `<tr><td style="padding:8px;">${s.name}</td><td style="padding:8px;">${s.max}</td><td style="padding:8px; font-weight:bold;">${s.obtained}</td></tr>`;
            });

            html += `<tr style="background:#FFF3E0; font-weight:bold; font-size:16px;">
                <td style="padding:8px; text-align:right;">Total & Percentage:</td>
                <td style="padding:8px;">${evalData.Max || evalData.max}</td>
                <td style="padding:8px; color:#E65100;">${evalData.Total || evalData.total} (${evalData.Percentage || evalData.percentage}%)</td>
            </tr></table>
            <p style="margin-top:12px; font-size:15px; color:#333;"><b>अभिप्रायः (Remarks):</b> ${evalData.Remarks || evalData.remarks || 'No remarks'}</p>`;
        } else {
            html += `<p style="color:#757575; font-style:italic; font-size:15px;">अस्य छात्रस्य अङ्काः न प्रविष्टाः (Marks not entered yet).</p>`;
        }
        html += `</div>`;
    });
    
    html += `</div>`;
    return html;
}

function viewPareeksheGroup(vedapatha, examinerNum) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html><head>
        <title>Veda Pareekshe - ${vedapatha} (Examiner ${examinerNum})</title>
        <link href="https://fonts.googleapis.com/css2?family=Laila:wght@400;600;700&display=swap" rel="stylesheet">
        </head>
        <body style="background:#525659; display:flex; justify-content:center; padding:20px; margin:0;">
            <div style="box-shadow: 0 0 15px rgba(0,0,0,0.6);">${generatePareeksheGroupHTML(vedapatha, examinerNum)}</div>
        </body></html>
    `);
    printWindow.document.close();
}

function downloadPareeksheGroupPDF(vedapatha, examinerNum) {
    let btn = event.target;
    let originalText = btn.innerText;
    btn.innerText = "⏳ Generating PDF...";
    btn.disabled = true;

    const reportDiv = document.createElement('div');
    reportDiv.style.position = 'absolute';
    reportDiv.style.top = '-9999px';
    reportDiv.style.left = '-9999px';
    reportDiv.innerHTML = generatePareeksheGroupHTML(vedapatha, examinerNum);
    document.body.appendChild(reportDiv);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    html2canvas(reportDiv.firstElementChild, { scale: 2, useCORS: true }).then(canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        let imgHeight = (canvas.height * pdfWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        
        pdf.save(`VedaPareekshe_${vedapatha}_Examiner${examinerNum}.pdf`);
        document.body.removeChild(reportDiv);
        btn.innerText = originalText;
        btn.disabled = false;
    }).catch(err => {
        alert("Error generating PDF. Please try again.");
        document.body.removeChild(reportDiv);
        btn.innerText = originalText;
        btn.disabled = false;
    });
}
