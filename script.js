let currentLoggedIn = ""; let isAdmin = false; 
// Unified Data Variables
let currentReportDataset = []; let currentReportColumns = []; let currentReportTitleStr = ""; let currentActiveFiltersArr = [];

window.onload = function() {
    try {
        const today = new Date(); 
        const todayStrForHeader = getSanskritDayAndDate(today.toISOString().split('T')[0]);
        const headerDateElem = document.getElementById('headerTodayDate');
        if(headerDateElem) { headerDateElem.innerText = `अद्यतन-दिनाङ्कः: ${todayStrForHeader}`; }
        
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const dp = document.getElementById('dashboardDatePicker');
        if(dp) { dp.max = today.toISOString().split('T')[0]; dp.value = yesterdayStr; }
        
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        
        if(document.getElementById('advFilterFrom')) document.getElementById('advFilterFrom').value = firstDay; 
        if(document.getElementById('advFilterTo')) document.getElementById('advFilterTo').value = today.toISOString().split('T')[0];
        if(document.getElementById('notifStartDate')) document.getElementById('notifStartDate').value = today.toISOString().split('T')[0]; 
        if(document.getElementById('notifEndDate')) document.getElementById('notifEndDate').value = today.toISOString().split('T')[0];
    } catch(e) { console.error("Startup Setup Error:", e); }
    
    fetchDataFromGoogleSheets(); 
};

function getSanskritDayAndDate(dateStr) {
    const d = new Date(dateStr); const days = ["भानुवासरः", "सोमवासरः", "मङ्गलवासरः", "बुधवासरः", "गुरुवासरः", "शुक्रवासरः", "शनिवासरः"];
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} - ${days[d.getDay()]}`;
}

function translateNumbersToDevanagari(num) { 
    const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']; 
    return String(num).split('').map(d => digits[d] || d).join(''); 
}

function normalizeSheetDate(dStr) {
    if(!dStr) return ""; dStr = String(dStr).trim();
    if(dStr.match(/^\d{4}-\d{2}-\d{2}/)) return dStr.substring(0, 10);
    if(dStr.includes('/')) { let p = dStr.split('/'); if(p.length === 3) { let p0 = p[0].padStart(2, '0'); let p1 = p[1].padStart(2, '0'); let p2 = p[2].split(' ')[0]; if(p2.length === 4) { let dd = p0, mm = p1, yyyy = p2; if(parseInt(mm) > 12) { mm = p0; dd = p1; } return `${yyyy}-${mm}-${dd}`; } } }
    if(dStr.includes('-')) { let p = dStr.split('-'); if(p.length === 3 && p[2].length >= 4) { let p0 = p[0].padStart(2, '0'); let p1 = p[1].padStart(2, '0'); let yyyy = p[2].substring(0,4); let dd = p0, mm = p1; if(parseInt(mm) > 12) { mm = p0; dd = p1; } return `${yyyy}-${mm}-${dd}`; } }
    let d = new Date(dStr); if(!isNaN(d.getTime())) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    if(dStr.includes('T')) return dStr.split('T')[0]; return dStr;
}

// ----------------------------------------------------
// BULLETPROOF KEY GENERATOR (Ignores spaces, hyphens, case)
// ----------------------------------------------------
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

// ----------------------------------------------------
// DYNAMIC DATA FETCHING ENGINE 
// ----------------------------------------------------
function fetchDataFromGoogleSheets() {
    const cacheBuster = GOOGLE_SCRIPT_URL + (GOOGLE_SCRIPT_URL.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
    fetch(cacheBuster).then(res => res.json()).then(data => {
        fetchedLogs = data.logs || []; 
        fetchedLogs.forEach(log => { log.normalizedDate = normalizeSheetDate(log['दिनाङ्कः (Date)']); });
        fetchedNotifications = data.notifications || [];
        
        studentsData = (data.students || []).map(s => ({name: s.Name, vibhaga: s.Vibhaga, gana: s.Gana, vedapatha: s.Vedapatha, rowIdx: s.rowIdx}));
        acharyaPasswords = {}; vedaAcharyaMapping = {};
        (data.acharyas || []).forEach(a => { if(!a.Name) return; acharyaPasswords[a.Name] = a.Password; if(a.Vedapatha_Mapping && a.Vedapatha_Mapping !== "-") vedaAcharyaMapping[a.Name] = a.Vedapatha_Mapping; });

        timetableData = {};
        (data.timetable || []).forEach(t => { if(!t.Acharya) return; if(!timetableData[t.Acharya]) timetableData[t.Acharya] = []; timetableData[t.Acharya].push({gana: t.Gana || "", time: t.Time || "", subject: t.Subject || "", vibhaga: t.Vibhaga || "", rowIdx: t.rowIdx}); });

        holidaysData = data.holidays || []; holidaysData.forEach(h => { h.normalizedDate = normalizeSheetDate(h.Date); });
        messagesData = data.messages || [];
        avalokanamData = data.avalokanam || [];
        
        settingsData = {};
        (data.settings || []).forEach(row => { if(row.Category) settingsData[row.Category] = row.Value; });

        populateAcharyaDropdowns(); renderYearlyTimetable(); updateTodayView(); changeDashboardDate(); displayActiveNotifications();
        
        if(currentLoggedIn && document.getElementById('entryFormSection').classList.contains('active')) {
             populateClassDropdown(currentLoggedIn, document.getElementById('dateInput').value); renderAcharyaMessages(); checkAvalokanamStatus();
        }
        if(isAdmin && document.getElementById('adminPanelView').classList.contains('active')) {
             populateCMSDropdowns(); updateAdminAvalokanamUI();
        }
    }).catch(err => {
        console.error(err); const errBox = document.getElementById('yesterdayDataContainer'); if(errBox) errBox.innerHTML = "<div class='log-desc' style='color:red; text-align:center; padding:20px;'>दत्तांश-प्राप्तौ दोषः जातः। (Network Error)</div>";
    });
}

function renderYearlyTimetable() {
    const times = ["06:30–07:55", "08:30–09:25", "11:00–11:55", "01:30–02:25", "02:30–03:25", "03:30–04:25", "06:30–07:25"]; const ganas = ["तपः", "तेजः", "ओजः", "वर्चः", "प्रेयः", "श्रेयः", "भ्राजः", "यशः"]; const tableGrid = {}; ganas.forEach(g => tableGrid[g] = {});
    for (const [ach, classes] of Object.entries(timetableData)) { classes.forEach(cls => { if(!cls.gana || cls.gana === "इतरकार्यम्") return; let clsTime = (cls.time || "").replace('-', '–'); cls.gana.split(' + ').forEach(g => { if(tableGrid[g]) { if(!tableGrid[g][clsTime]) tableGrid[g][clsTime] = []; tableGrid[g][clsTime].push({ach: ach, sub: cls.subject, vib: cls.vibhaga, originalGana: cls.gana, time: cls.time}); } }); }); }
    let html = `<div class="table-wrapper"><table><thead><tr><th>गणः</th>`; times.forEach(t => html += `<th>${t}</th>`); html += `</tr></thead><tbody>`;
    ganas.forEach(gana => {
        html += `<tr><th>${gana}</th>`;
        times.forEach(time => {
            const classes = tableGrid[gana][time];
            if(!classes || classes.length === 0) { html += `<td></td>`; } else if (classes.length === 1) { const cls = classes[0]; const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana'); html += `<td class="${vClass}">${cls.sub} <span class="acharya-name">${cls.ach}</span></td>`; } else { html += `<td style="padding:0;"><div class="split-cell">`; classes.forEach((cls, idx) => { const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana'); const btmBorder = idx === 0 ? 'split-top' : ''; html += `<div class="${btmBorder} ${vClass}" style="padding:5px; height:100%;">${cls.sub} <span class="acharya-name">${cls.ach}</span></div>`; }); html += `</div></td>`; }
        }); html += `</tr>`;
    }); html += `</tbody></table></div>`; const yearlyContainer = document.getElementById('yearlyTableContainer'); if(yearlyContainer) yearlyContainer.innerHTML = html;
}

// SAFE DROPDOWN RENDERING (Prevents Safari Bug)
function populateAcharyaDropdowns() { 
    const selectModal = document.getElementById('acharyaSelect'); if(!selectModal) return; 
    let htmlStr = '<option value="">-- आचार्यं चिनोतु --</option>'; 
    for(let ach in acharyaPasswords) { htmlStr += `<option value="${ach}">${ach}</option>`; } 
    selectModal.innerHTML = htmlStr;
}

function displayActiveNotifications() {
    const now = new Date(); const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0]; const currentTime = now.toTimeString().slice(0,5);
    let activeNotifs = fetchedNotifications.filter(n => {
        if (!n['StartDate'] || !n['EndDate']) return false; let sd = normalizeSheetDate(n['StartDate']); let ed = normalizeSheetDate(n['EndDate']);
        if (todayStr >= sd && todayStr <= ed) { try { if (n['StartTime'] && n['EndTime'] && String(n['StartTime']).includes(':') && String(n['EndTime']).includes(':')) { let stStr = String(n['StartTime']); let etStr = String(n['EndTime']); let st = stStr.includes('T') ? stStr.split('T')[1].slice(0,5) : stStr.slice(0,5); let et = etStr.includes('T') ? etStr.split('T')[1].slice(0,5) : etStr.slice(0,5); if (todayStr === sd && currentTime < st) return false; if (todayStr === ed && currentTime > et) return false; } } catch(e) {} return true; } return false;
    });
    const banner = document.getElementById('notificationBanner'); const marquee = document.getElementById('notificationText'); if(!banner || !marquee) return;
    if (activeNotifs.length > 0) { marquee.innerHTML = activeNotifs.map(n => `<span class="notif-item"><span class="notif-author">📢 ${n['Acharya']} :</span> ${n['Message']}</span>`).join(" &nbsp; | &nbsp; "); banner.style.display = "block"; } else { banner.style.display = "none"; }
}

function renderAcharyaMessages() {
    const container = document.getElementById('acharyaMessageContainer'); if(!container) return; container.innerHTML = ""; if(!currentLoggedIn || currentLoggedIn === "Admin") return;
    const todayStr = new Date().toISOString().split('T')[0]; let relevantMessages = messagesData.filter(m => { if(m.ExpiryDate && normalizeSheetDate(m.ExpiryDate) < todayStr) return false; return (m.Target_Acharya === "All" || m.Target_Acharya === currentLoggedIn); });
    if(relevantMessages.length > 0) { let msgHtml = `<div class="message-box"><h4>सन्देशः (Message from Admin)</h4>`; relevantMessages.forEach(m => { msgHtml += `<p style="margin-bottom:8px;">🔸 ${m.Message}</p>`; }); msgHtml += `</div>`; container.innerHTML = msgHtml; }
}

function checkFormHolidayState() {
    const dateInput = document.getElementById('dateInput'); if(!dateInput) return; const dateVal = dateInput.value;
    const isHolDeclared = fetchedLogs.some(log => log.normalizedDate === dateVal && log['विषयः (Subject)'] === "अनध्यायः");
    const isCMSHoliday = holidaysData.some(h => h.normalizedDate === dateVal);
    const banner = document.getElementById('holidayBannerForm'); const submitBtn = document.getElementById('submitBtn'); if(!banner || !submitBtn) return;
    if((isHolDeclared || isCMSHoliday) && !isAdmin) { banner.style.display = "block"; banner.innerText = "अद्य अनध्यायः / विशेषकार्यक्रमः अस्ति। पाठोल्लेखः न शक्यते। (Holiday Declared)"; submitBtn.disabled = true; } else { banner.style.display = "none"; submitBtn.disabled = false; }
}

// ----------------------------------------------------
// UI NAVIGATION & LOGIN
// ----------------------------------------------------
function switchView(viewId, btnElement) { document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active')); if(btnElement) { document.querySelectorAll('.btn-tab').forEach(el => el.classList.remove('active')); btnElement.classList.add('active'); } const v = document.getElementById(viewId); if(v) v.classList.add('active'); }
function goToDashboard() { const m = document.getElementById('mainTabs'); if(m) m.style.display = 'flex'; switchView('dashboardView', document.getElementById('tabDashboard')); }
function openLoginModal() { if (currentLoggedIn) { switchView('entryFormSection', null); populateClassDropdown(currentLoggedIn, document.getElementById('dateInput').value); renderAcharyaMessages(); checkAvalokanamStatus(); document.getElementById('attendanceSection').style.display = "none"; } else { document.getElementById('loginModal').style.display = 'flex'; } }
function openAdminModal() { if (isAdmin) { switchView('adminPanelView', null); resetAdvancedFilters(); populateCMSDropdowns(); updateAdminAvalokanamUI();} else { document.getElementById('adminModal').style.display = 'flex'; } }
function closeModals() { ['adminModal','loginModal','avalokanamModal'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; }); ['adminPin','acharyaPin','acharyaSelect'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); }

function verifyAdmin() { const pin = document.getElementById('adminPin').value; if(pin === '9999') { isAdmin = true; closeModals(); document.getElementById('mainTabs').style.display = 'none'; switchView('adminPanelView', null); resetAdvancedFilters(); populateCMSDropdowns(); updateAdminAvalokanamUI(); } else { alert("असमीचीनः कूटशब्दः!"); } }
function getVocative(name) { if (name === "विष्णुः") return "विष्णो"; if (name === "सुब्रह्मण्य. आ.") return name; return name.replace(/ः$/, ''); }

function verifyAcharya() {
    const name = document.getElementById('acharyaSelect').value; const pin = document.getElementById('acharyaPin').value; if(!name) return alert("कृपया आचार्यं चिनोतु!");
    if(acharyaPasswords[name] === pin) { closeModals(); isAdmin = false; currentLoggedIn = name; document.getElementById('mainTabs').style.display = 'none'; switchView('entryFormSection', null); document.getElementById('loggedInAcharya').innerText = "स्वागतम्, " + getVocative(name); document.getElementById('dateInput').value = new Date().toISOString().split('T')[0]; document.getElementById('dateInput').setAttribute('readonly', 'true'); populateClassDropdown(name, document.getElementById('dateInput').value); renderAcharyaMessages(); checkFormHolidayState(); checkAvalokanamStatus(); } else { alert("असमीचीनः कूटशब्दः!"); }
}

function logout() { currentLoggedIn = ""; isAdmin = false; document.getElementById('descriptionInput').value = ""; document.getElementById('attendanceSection').style.display="none"; const mbox = document.getElementById('acharyaMessageContainer'); if(mbox) mbox.innerHTML=""; goToDashboard(); }

// ----------------------------------------------------
// CMS: SYSTEM SETTINGS LOGIC
// ----------------------------------------------------
function switchReportCategory(category, btnElement) {
    document.querySelectorAll('.rep-tab').forEach(el => el.classList.remove('active')); btnElement.classList.add('active');
    document.getElementById('cmsSection').style.display = 'none'; document.getElementById('reportsSection').style.display = 'none';
    if(category === 'lesson') { document.getElementById('reportsSection').style.display = 'block'; document.getElementById('lessonSubTabs').style.display = 'flex'; document.getElementById('attendanceSubTabs').style.display = 'none'; document.querySelector('input[name="repType"][value="acharya_wise"]').checked = true; handleReportTypeChange();
    } else if(category === 'attendance') { document.getElementById('reportsSection').style.display = 'block'; document.getElementById('lessonSubTabs').style.display = 'none'; document.getElementById('attendanceSubTabs').style.display = 'flex'; document.querySelector('input[name="repType"][value="student_overall"]').checked = true; handleReportTypeChange();
    } else if(category === 'cms') { document.getElementById('cmsSection').style.display = 'block'; document.getElementById('reportSnapshotArea').style.display = 'none'; document.getElementById('reportSummaryContainer').style.display = 'none'; handleCMSChange(); }
}

function handleCMSChange() { document.querySelectorAll('.cms-section').forEach(el => el.classList.remove('active')); const cmsType = document.querySelector('input[name="cmsType"]:checked').value; document.getElementById(cmsType + '_form').classList.add('active'); }

function populateCMSDropdowns() { 
    const achSel = document.getElementById('cmsTimeAch'); const msgAch = document.getElementById('cmsMsgAch'); if(!achSel || !msgAch) return; 
    let achHtml = ""; let msgHtml = '<option value="All">Everyone (सामूहिक-सन्देशः)</option>'; 
    for(let ach in acharyaPasswords) { achHtml += `<option value="${ach}">${ach}</option>`; msgHtml += `<option value="${ach}">${ach}</option>`; } 
    achSel.innerHTML = achHtml; msgAch.innerHTML = msgHtml;
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
    const cmsType = document.querySelector('input[name="cmsType"]:checked').value; if(cmsType === 'cms_avalokanam') return alert("Avalokanam doesn't have a direct CMS table. View 'Avalokanam Report' in the Lesson Reports tab.");
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

// ----------------------------------------------------
// AVALOKANAM (FORTNIGHTLY EVALUATION) LOGIC
// ----------------------------------------------------
function updateAdminAvalokanamUI() {
    const pName = document.getElementById('cmsPakshaName'); const sText = document.getElementById('cmsAvalokanamStatusText'); if(!pName || !sText) return;
    pName.value = settingsData['Avalokanam_Paksha'] || "";
    if(settingsData['Avalokanam_Status'] === 'ON') { sText.innerText = "ON (Active)"; sText.style.color = "#2E7D32"; } else { sText.innerText = "OFF (Inactive)"; sText.style.color = "#D32F2F"; }
}

function setAvalokanamStatus(status) {
    let paksha = document.getElementById('cmsPakshaName').value.trim(); if(status === 'ON' && !paksha) return alert("Please enter the Paksha Name first!");
    Promise.all([
        fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: new URLSearchParams({action: 'updateSetting', key: 'Avalokanam_Status', value: status}) }),
        fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: new URLSearchParams({action: 'updateSetting', key: 'Avalokanam_Paksha', value: paksha}) })
    ]).then(() => { alert("Evaluation Status Updated!"); fetchDataFromGoogleSheets(); }).catch(err => alert("Error updating status."));
}

function checkAvalokanamStatus() {
    const banner = document.getElementById('avalokanamAlertBanner'); if(!banner) return;
    if(settingsData['Avalokanam_Status'] === 'ON') { document.getElementById('activePakshaName').innerText = settingsData['Avalokanam_Paksha'] || "पाक्षिक-अवलोकनम्"; banner.style.display = "block"; } else { banner.style.display = "none"; }
}

function openAvalokanamModal() {
    document.getElementById('avModalPakshaTitle').innerText = settingsData['Avalokanam_Paksha'] || ""; const sel = document.getElementById('avClassSelect'); 
    let htmlStr = '<option value="">-- कक्षां चिनोतु (Select Class) --</option>'; 
    const classes = timetableData[currentLoggedIn] || []; let submittedSets = new Set();
    avalokanamData.forEach(av => { if(av.Paksha === settingsData['Avalokanam_Paksha'] && av.Acharya === currentLoggedIn) { submittedSets.add(makeKey(currentLoggedIn, av.Gana, av.Subject)); } });
    classes.forEach(cls => {
        if(cls.gana === "इतरकार्यम्") return; let valStr = encodeURIComponent(JSON.stringify({acharya: currentLoggedIn, gana: cls.gana, subject: cls.subject, vibhaga: cls.vibhaga})); let key = makeKey(currentLoggedIn, cls.gana, cls.subject);
        if(submittedSets.has(key)) { htmlStr += `<option value="${valStr}" disabled style="color:#9E9E9E;">✅ सम्पन्नम् - ${cls.gana} (${cls.subject})</option>`; } else { htmlStr += `<option value="${valStr}">${cls.gana} | ${cls.subject}</option>`; }
    });
    sel.innerHTML = htmlStr;
    document.getElementById('avStudentsContainer').innerHTML = ""; document.getElementById('avalokanamModal').style.display = 'flex';
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
// UI ENGINE: SHARED TIMETABLE GRID GENERATOR
// ----------------------------------------------------
function getTimetableData(targetDateStr) {
    const yMap = {}; let yAch = new Set();
    fetchedLogs.forEach(log => {
        if (log.normalizedDate === targetDateStr && log['विषयः (Subject)'] !== "अनध्यायः") {
            if(log['गणः (Class/Gana)'] !== "इतरकार्यम्") {
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
    let missedList = []; let absentTally = {}; let alreadyCountedMissed = new Set(); let submittedDaily = 0;

    ganas.forEach(gana => {
        html += `<tr><th>${gana}</th>`;
        times.forEach(time => {
            const classes = tableGrid[gana][time];
            if(!classes || classes.length === 0) { html += `<td></td>`; }
            else if (classes.length === 1) {
                const cls = classes[0]; const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana');
                const key = makeKey(cls.ach, cls.originalGana, cls.sub);
                if(yMap[key]) { 
                    html += `<td class="cell-submitted ${vClass}" onclick="showDescModal('${cls.sub}', '${escapeQuotes(yMap[key].desc)}', '${escapeQuotes(yMap[key].att)}')"><div class="tooltip-text">${yMap[key].desc}</div>${cls.sub} <span class="acharya-name" style="color:#1B5E20; font-weight:bold;">${cls.ach}</span></td>`; 
                    getExpectedStudents(cls.originalGana, cls.sub, cls.vib, cls.ach).forEach(st => { if(st.gana === gana && !(yMap[key].att || "").includes(st.name)) { absentTally[st.name] = (absentTally[st.name] || 0) + 1; } }); submittedDaily++;
                } else { 
                    html += `<td class="cell-unsubmitted ${vClass}">${cls.sub} <span class="acharya-name">${cls.ach}</span></td>`; 
                    if(!alreadyCountedMissed.has(key)) { missedList.push(`<b>${cls.ach}</b>: ${cls.originalGana} (${cls.sub})`); alreadyCountedMissed.add(key); }
                }
            } else {
                html += `<td style="padding:0;"><div class="split-cell">`;
                classes.forEach((cls, idx) => {
                    const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana'); const btmBorder = idx === 0 ? 'split-top' : ''; 
                    const key = makeKey(cls.ach, cls.originalGana, cls.sub);
                    if(yMap[key]) { 
                        html += `<div class="${btmBorder} cell-submitted ${vClass}" style="padding:5px; height:100%;" onclick="showDescModal('${cls.sub}', '${escapeQuotes(yMap[key].desc)}', '${escapeQuotes(yMap[key].att)}')"><div class="tooltip-text">${yMap[key].desc}</div>${cls.sub} <span class="acharya-name" style="color:#1B5E20; font-weight:bold;">${cls.ach}</span></div>`; 
                        getExpectedStudents(cls.originalGana, cls.sub, cls.vib, cls.ach).forEach(st => { if(st.gana === gana && !(yMap[key].att || "").includes(st.name)) { absentTally[st.name] = (absentTally[st.name] || 0) + 1; } }); submittedDaily++;
                    } else { 
                        html += `<div class="${btmBorder} cell-unsubmitted ${vClass}" style="padding:5px; height:100%;">${cls.sub} <span class="acharya-name">${cls.ach}</span></div>`; 
                        if(!alreadyCountedMissed.has(key)) { missedList.push(`<b>${cls.ach}</b>: ${cls.originalGana} (${cls.sub})`); alreadyCountedMissed.add(key); }
                    }
                }); html += `</div></td>`;
            }
        }); html += `</tr>`;
    }); html += `</tbody></table></div>`; 
    
    let totDaily = 0; Object.values(timetableData).forEach(arr => { arr.forEach(c => { if(c.gana && c.gana !== 'इतरकार्यम्') { totDaily += c.gana.split(' + ').length; } }); });
    return { html, missedList, absentTally, submittedDaily, totDaily, yAch };
}

// ----------------------------------------------------
// DAILY LOGIC (LESSON ENTRY & DASHBOARD)
// ----------------------------------------------------
function updateTodayView() {
    const todayDataContainer = document.getElementById('todayDataContainer'); if(!todayDataContainer) return;
    const todayStr = new Date().toISOString().split('T')[0]; 
    let isHolidayOnTarget = fetchedLogs.some(log => log.normalizedDate === todayStr && log['विषयः (Subject)'] === "अनध्यायः") || holidaysData.some(h => h.normalizedDate === todayStr);

    if(isHolidayOnTarget) { todayDataContainer.innerHTML = "<div class='holiday-banner' style='display:block;'>अस्मिन् दिने अनध्यायः / विशेषकार्यक्रमः अस्ति। (Holiday)</div>"; return; }
    
    const tbData = getTimetableData(todayStr);
    todayDataContainer.innerHTML = tbData.html;
}

function escapeQuotes(str) { return str ? str.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n') : ''; }
function showDescModal(sub, desc, att) { document.getElementById('detailSubject').innerText = sub; document.getElementById('detailDescription').innerText = desc; document.getElementById('detailAttendance').innerText = att || "ಮಾಹಿತिः नास्ति"; document.getElementById('detailsModal').style.display = 'flex'; }

function getExpectedStudents(ganaStr, subject, vibhaga, acharya) {
    if(!ganaStr || ganaStr === "इतरकार्यम्") return []; const ganas = ganaStr.split(' + '); const isVeda = subject.includes('वेदः');
    if (isVeda) { const vedaGanaMatch = vedaAcharyaMapping[acharya]; if(vedaGanaMatch) return studentsData.filter(s => s.vedapatha === vedaGanaMatch); return []; } 
    else { return studentsData.filter(s => { if(!ganas.includes(s.gana)) return false; if(vibhaga === 'सामान्य') return true; return s.vibhaga === vibhaga; }); }
}

function renderTimetableForDate(targetDateStr) {
    const dashHeading = document.getElementById('dashboardDateHeading'); const yesterdayDataContainer = document.getElementById('yesterdayDataContainer'); if(!dashHeading || !yesterdayDataContainer) return;
    const formattedHeading = getSanskritDayAndDate(targetDateStr); dashHeading.innerText = `समयसारिणी (दिनाङ्कः: ${formattedHeading})`;
    const bannerDash = document.getElementById('holidayBannerDashboard'); const missedUL = document.getElementById('missedLogsList'); const absentUL = document.getElementById('absentStudentsList'); const otherTasksContainer = document.getElementById('otherTasksContainer');
    
    let isHolidayOnTarget = fetchedLogs.some(log => log.normalizedDate === targetDateStr && log['विषयः (Subject)'] === "अनध्यायः") || holidaysData.some(h => h.normalizedDate === targetDateStr);

    if(isHolidayOnTarget) {
        bannerDash.style.display = "block"; bannerDash.innerText = "अस्मिन् दिने अनध्यायः / विशेषकार्यक्रमः आसीत्। (Holiday)";
        yesterdayDataContainer.innerHTML = ""; otherTasksContainer.innerHTML = ""; missedUL.innerHTML = "<li>अनध्यायः (Holiday)</li>"; absentUL.innerHTML = "<li>अनध्यायः (Holiday)</li>"; document.getElementById('statSubmitted').innerText = "-"; document.getElementById('statPresent').innerText = "-"; document.getElementById('statCompleted').innerText = "-"; return;
    }
    bannerDash.style.display = "none";
    
    const tbData = getTimetableData(targetDateStr);
    yesterdayDataContainer.innerHTML = tbData.html;

    let otherTasksHtml = `<button onclick="const kt = document.getElementById('kalahTasksDiv'); kt.style.display = kt.style.display === 'none' ? 'flex' : 'none';" style="width:100%; background:#E8F5E9; border:1px solid #81C784; color:#2E7D32; font-family:'Laila', sans-serif; font-size:1.1rem; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px; transition:0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">➕ इतरकार्याणि पश्यतु (View Other Tasks / Kalah)</button><div id="kalahTasksDiv" style="display:none; flex-wrap:wrap; gap:15px; margin-top:15px;">`;
    let hasOtherTasks = false;
    for (const [ach, classes] of Object.entries(timetableData)) { classes.forEach(cls => { if(cls.gana === "इतरकार्यम्") { hasOtherTasks = true; let submittedLog = fetchedLogs.find(l => l.normalizedDate === targetDateStr && l['आचार्यः (Acharya)'] === ach && l['गणः (Class/Gana)'] === 'इतरकार्यम्' && l['विषयः (Subject)'] === cls.subject);
    if(submittedLog) { otherTasksHtml += `<div class="data-card" style="flex:1; min-width:220px; border-left-color:#4CAF50; padding:15px; margin-bottom:0; background:#FAFAFA;"><div style="font-weight:bold; color:#1B5E20; margin-bottom:5px; font-size:1.1rem;">${ach} <span style="color:#555; font-size:0.9rem;">(${cls.subject})</span></div><div style="font-size:0.95rem; color:#424242; border-top:1px dashed #C8E6C9; padding-top:5px; margin-top:5px;">✅ ${escapeQuotes(submittedLog['विवरणम् (Lesson Description)'])}</div></div>`; } else { otherTasksHtml += `<div class="data-card" style="flex:1; min-width:220px; border-left-color:#D32F2F; padding:15px; margin-bottom:0; background:#FFF5F5;"><div style="font-weight:bold; color:#D32F2F; margin-bottom:5px; font-size:1.1rem;">${ach} <span style="color:#555; font-size:0.9rem;">(${cls.subject})</span></div><div style="font-size:0.95rem; color:#D32F2F; border-top:1px dashed #FFCDD2; padding-top:5px; margin-top:5px;">❌ न उल्लिखितम् (Not Filled / Taken)</div></div>`; } } }); }
    otherTasksHtml += `</div>`; otherTasksContainer.innerHTML = hasOtherTasks ? otherTasksHtml : "";
    if(tbData.missedList.length === 0) { missedUL.innerHTML = "<li style='color:green; font-weight:bold;'>सर्वे पाठाः सम्पन्नाः (All logs submitted)</li>"; } else { missedUL.innerHTML = tbData.missedList.map(item => `<li>${item}</li>`).join(""); }
    let absentKeys = Object.keys(tbData.absentTally);
    if(absentKeys.length === 0) { absentUL.innerHTML = "<li style='color:green; font-weight:bold;'>सर्वे छात्राः उपस्थिताः (All students present)</li>"; } else { absentKeys.sort((a,b) => tbData.absentTally[b] - tbData.absentTally[a]); absentUL.innerHTML = absentKeys.map(name => `<li><b>${name}</b> : ${translateNumbersToDevanagari(tbData.absentTally[name])} वर्गेषु अनुपस्थितः</li>`).join(""); }

    let sPct = tbData.totDaily > 0 ? Math.round((tbData.submittedDaily / tbData.totDaily) * 100) : 0; let pPct = Object.keys(acharyaPasswords).length > 0 ? Math.round((tbData.yAch.size / Object.keys(acharyaPasswords).length) * 100) : 0;
    if(sPct > 100) sPct = 100; if(pPct > 100) pPct = 100;
    document.getElementById('statSubmitted').innerText = translateNumbersToDevanagari(sPct) + "%"; document.getElementById('circleSubmitted').style.background = `conic-gradient(#4CAF50 ${sPct}%, #E8F5E9 0)`;
    document.getElementById('statPresent').innerText = translateNumbersToDevanagari(pPct) + "%"; document.getElementById('circlePresent').style.background = `conic-gradient(#0288D1 ${pPct}%, #E1F5FE 0)`;
    document.getElementById('statCompleted').innerText = translateNumbersToDevanagari(sPct) + "%"; document.getElementById('circleCompleted').style.background = `conic-gradient(#E65100 ${sPct}%, #FFF3E0 0)`;
}

function changeDashboardDate() { const d = document.getElementById('dashboardDatePicker'); if(d && d.value) renderTimetableForDate(d.value); }
const dateInputObj = document.getElementById('dateInput');
if(dateInputObj) { dateInputObj.addEventListener('change', function() { checkFormHolidayState(); const dateStr = this.value; if(isAdmin) { populateAdminClassDropdown(dateStr); } else if(currentLoggedIn) { populateClassDropdown(currentLoggedIn, dateStr); } renderAttendanceChecklist(); }); }
function declareHoliday() { const dateVal = document.getElementById('dateInput').value; if(confirm(dateVal + " दिनाङ्के 'अनध्यायः' (Holiday) घोषणीयम् वा?")) { sendDataToSheet(dateVal, "ADMIN", "सर्वे", "-", "अनध्यायः", "विशेषकार्यक्रमः / अनध्यायः", "-"); } }
function toggleCheck(id) { const cb = document.getElementById(id); if(cb) cb.checked = !cb.checked; }

// FIX FOR SAFARI DROP-DOWN BUG (Using HTML string accumulation)
function populateClassDropdown(acharyaName, dateStr) {
    const select = document.getElementById('classSelect'); if(!select) return; 
    let htmlStr = '<option value="">-- कक्षां चिनोतु --</option>';
    let submittedKeys = new Set();
    fetchedLogs.forEach(log => { if (log.normalizedDate === dateStr && log['आचार्यः (Acharya)'] === acharyaName && log['विषयः (Subject)'] !== "अनध्यायः") { submittedKeys.add(makeKey(log['आचार्यः (Acharya)'], log['गणः (Class/Gana)'], log['विषयः (Subject)'])); } });
    const classes = timetableData[acharyaName] || []; let total = classes.length; let submittedCount = 0;
    classes.forEach(cls => {
        const key = makeKey(acharyaName, cls.gana, cls.subject); const isSubmitted = submittedKeys.has(key); if (isSubmitted) submittedCount++;
        const valStr = encodeURIComponent(JSON.stringify({acharya: acharyaName, gana: cls.gana, time: cls.time, subject: cls.subject, vibhaga: cls.vibhaga}));
        if (isSubmitted) { htmlStr += `<option value="${valStr}" disabled style="color: #9E9E9E; background: #EEEEEE;">✅ सम्पन्नम् (Submitted) - ${cls.gana} | ${cls.subject}</option>`; } 
        else { htmlStr += `<option value="${valStr}" style="color: #D35400; font-weight:bold;">⏳ ${cls.gana} गणः | ${cls.time} | ${cls.subject} (${cls.vibhaga})</option>`; }
    });
    select.innerHTML = htmlStr;
    const statusDiv = document.getElementById('submissionStatus');
    if(statusDiv) { let pending = total - submittedCount; if(pending === 0 && total > 0) { statusDiv.innerHTML = `<span style="color:#2E7D32;">🎉 अभिनन्दनानि! अद्यतनाः सर्वे पाठाः सम्पन्नाः! (${total}/${total})</span>`; } else { statusDiv.innerHTML = `<span style="color:#2E7D32;">सम्पन्नाः (Done): ${submittedCount}</span> | <span style="color:#D35400;">अवशिष्टाः (Pending): ${pending}</span>`; } }
}

function populateAdminClassDropdown(dateStr) {
    const select = document.getElementById('classSelect'); if(!select) return; 
    let htmlStr = '<option value="">-- सर्वाः कक्षाः --</option>';
    let submittedKeys = new Set();
    fetchedLogs.forEach(log => { if (log.normalizedDate === dateStr && log['विषयः (Subject)'] !== "अनध्यायः") { submittedKeys.add(makeKey(log['आचार्यः (Acharya)'], log['गणः (Class/Gana)'], log['विषयः (Subject)'])); } });
    for (const [achName, classes] of Object.entries(timetableData)) {
        classes.forEach(cls => {
            const key = makeKey(achName, cls.gana, cls.subject); const valStr = encodeURIComponent(JSON.stringify({acharya: achName, gana: cls.gana, time: cls.time, subject: cls.subject, vibhaga: cls.vibhaga}));
            if(submittedKeys.has(key)) { htmlStr += `<option value="${valStr}" disabled style="color: #9E9E9E; background: #EEEEEE;">✅ ${achName} - ${cls.gana} (${cls.subject})</option>`; } 
            else { htmlStr += `<option value="${valStr}">${achName} | ${cls.gana} | ${cls.time} | ${cls.subject}</option>`; }
        });
    }
    select.innerHTML = htmlStr;
    document.getElementById('submissionStatus').innerHTML = ""; 
}

function renderAttendanceChecklist() { const clsVal = document.getElementById('classSelect').value; const attSection = document.getElementById('attendanceSection'); const attContainer = document.getElementById('attendanceContainer'); if(!clsVal) { attSection.style.display = "none"; return; } const clsData = JSON.parse(decodeURIComponent(clsVal)); if(clsData.gana === "इतरकार्यम्") { attSection.style.display = "none"; return; } attSection.style.display = "block"; let filteredStudents = getExpectedStudents(clsData.gana, clsData.subject, clsData.vibhaga, clsData.acharya); if(filteredStudents.length === 0) { attContainer.innerHTML = "<span style='color:red;'>अस्मिन् वर्गे छात्राः न सन्ति।</span>"; return; } let html = `<div class="attendance-grid">`; filteredStudents.forEach(student => { html += `<div class="student-checkbox" onclick="toggleCheck('chk_${student.name}')"><input type="checkbox" id="chk_${student.name}" value="${student.name}" class="att-checkbox" onclick="event.stopPropagation()"><label for="chk_${student.name}" onclick="event.stopPropagation()">${student.name}</label></div>`; }); html += `</div>`; attContainer.innerHTML = html; }
function submitLesson() { const clsVal = document.getElementById('classSelect').value; const desc = document.getElementById('descriptionInput').value; const dateVal = document.getElementById('dateInput').value; if(!clsVal) return alert("कृपया कक्षां चिनोतु!"); if(!desc.trim()) return alert("कृपया पाठस्य विवरणं लिखतु!"); const clsData = JSON.parse(decodeURIComponent(clsVal)); let presentStudents = []; if(clsData.gana !== "इतरकार्यम्") { document.querySelectorAll('.att-checkbox').forEach(cb => { if(cb.checked) presentStudents.push(cb.value); }); } const attendanceStr = presentStudents.join(", "); sendDataToSheet(dateVal, clsData.acharya, clsData.gana, clsData.time, clsData.subject, desc, attendanceStr); }
function sendDataToSheet(date, acharya, gana, time, subject, description, attendance) { const formData = new URLSearchParams(); formData.append('action', 'addLog'); formData.append('date', date); formData.append('acharya', acharya); formData.append('gana', gana); formData.append('time', time); formData.append('subject', subject); formData.append('description', description); formData.append('attendance', attendance || "-"); const btn = document.getElementById('submitBtn'); const origText = btn.innerText; btn.innerText = "समर्प्यते..."; btn.disabled = true; fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData }).then(res => res.text()).then(data => { alert("सफलम्! (Success)"); document.getElementById('descriptionInput').value = ""; document.getElementById('attendanceSection').style.display="none"; btn.innerText = origText; btn.disabled = false; fetchDataFromGoogleSheets(); goToDashboard(); }).catch(err => { alert("दोषः जातः!"); btn.innerText = origText; btn.disabled = false; }); }

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

    if(repType === 'avalokanam_report') {
        let filteredAvalokanam = avalokanamData.filter(av => { if(fAcharya && av.Acharya !== fAcharya) return false; if(fGana && av.Gana !== fGana && !av.Gana.includes(fGana)) return false; if(fSubj && av.Subject !== fSubj) return false; if(fStudent && av.Student !== fStudent) return false; return true; });
        renderReportData(repType, filteredAvalokanam, {fFrom, fTo, fDept, fGana, fSubj, fAcharya, fStudent}); return;
    }

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

    if(repType === "avalokanam_report") {
        currentReportTitleStr = "पाक्षिक-अवलोकनम् Report (Evaluation)"; currentReportColumns = ["Paksha", "Acharya", "Gana", "Subject", "Student", "Lekhanam", "Anuvadah", "Sahabhagita", "Remarks"];
        thead = `<tr><th>Paksha</th><th>Acharya</th><th>Gana / Subject</th><th>Student</th><th>Lekhanam</th><th>Anuvadah</th><th>Participation</th><th>Remarks</th></tr>`;
        logs.forEach(av => { currentReportDataset.push({"Paksha": av.Paksha, "Acharya": av.Acharya, "Gana": av.Gana, "Subject": av.Subject, "Student": av.Student, "Lekhanam": av.Lekhanam, "Anuvadah": av.Anuvadah, "Sahabhagita": av.Sahabhagita, "Remarks": av.Tippani}); tbody += `<tr><td>${av.Paksha}</td><td style="color:#D35400; font-weight:bold;">${av.Acharya}</td><td>${av.Gana}<br><span style="font-size:0.8rem; color:#555;">${av.Subject}</span></td><td style="font-weight:bold; color:#1B5E20;">${av.Student}</td><td>${av.Lekhanam}</td><td>${av.Anuvadah}</td><td>${av.Sahabhagita}</td><td>${av.Tippani}</td></tr>`; stat1++; });
        summaryBox.innerHTML = `<div class="summary-card"><h4>Evaluation Records</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div>`;
    }
    else if(repType === "acharya_wise") {
        currentReportTitleStr = "Acharya-wise Lesson Report"; currentReportColumns = ["Acharya", "Subject / Class", "Total Lessons"]; let agMap = {};
        logs.forEach(l => { let ach = l['आचार्यः (Acharya)']; if(!agMap[ach]) agMap[ach] = {}; let subj = l['विषयः (Subject)']; agMap[ach][subj] = (agMap[ach][subj] || 0) + 1; stat1++; }); stat2 = Object.keys(agMap).length; 
        thead = `<tr><th>Acharya</th><th>Subject / Class</th><th>Total Lessons</th></tr>`;
        for(let ach in agMap) { for(let subj in agMap[ach]) { currentReportDataset.push({"Acharya": ach, "Subject / Class": subj, "Total Lessons": agMap[ach][subj]}); tbody += `<tr><td style="font-weight:bold; color:#E65100;">${ach}</td><td>${subj}</td><td>${translateNumbersToDevanagari(agMap[ach][subj])}</td></tr>`; } }
        summaryBox.innerHTML = `<div class="summary-card"><h4>Total Lessons</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div><div class="summary-card"><h4>Active Acharyas</h4><p class="val">${translateNumbersToDevanagari(stat2)}</p></div>`;
    }
    else if (repType === "gana_wise" || repType === "gana_class_wise") {
        currentReportTitleStr = repType === "gana_class_wise" ? "Gana & Class Breakdown Report" : "Gana-wise Breakdown Report"; currentReportColumns = ["Gana", "Acharya", "Subject / Class", "Total Lessons"]; let gMap = {};
        logs.forEach(l => { let gStr = l['गणः (Class/Gana)']; if(gStr === "इतरकार्यम्") return; gStr.split(' + ').forEach(g => { if(filters.fGana && g !== filters.fGana) return; if(!gMap[g]) gMap[g] = {}; let achSub = l['आचार्यः (Acharya)'] + "|" + l['विषयः (Subject)']; gMap[g][achSub] = (gMap[g][achSub] || 0) + 1; stat1++; }); }); stat2 = Object.keys(gMap).length;
        thead = `<tr><th>Gana</th><th>Acharya</th><th>Subject / Class</th><th>Total Lessons</th></tr>`;
        for(let g in gMap) { for(let item in gMap[g]) { let parts = item.split('|'); currentReportDataset.push({"Gana": g, "Acharya": parts[0], "Subject / Class": parts[1], "Total Lessons": gMap[g][item]}); tbody += `<tr><td style="font-weight:bold; color:#2E7D32;">${g}</td><td>${parts[0]}</td><td>${parts[1]}</td><td>${translateNumbersToDevanagari(gMap[g][item])}</td></tr>`; } }
        summaryBox.innerHTML = `<div class="summary-card"><h4>Total Lessons</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div><div class="summary-card"><h4>Ganas Covered</h4><p class="val">${translateNumbersToDevanagari(stat2)}</p></div>`;
    }
    else if (repType.startsWith("dept")) {
        currentReportTitleStr = filters.fDept ? `Academic Report: ${filters.fDept} Department` : "Department-wise Academic Report"; currentReportColumns = ["Department", "Acharya", "Subject", "Total Lessons"]; let dMap = {};
        logs.forEach(l => { let vib = "सामान्य"; let ach = l['आचार्यः (Acharya)']; let sub = l['विषयः (Subject)']; (timetableData[ach] || []).forEach(c => { if(c.subject === sub) vib = c.vibhaga; }); if(filters.fDept && vib !== filters.fDept) return; if(!dMap[vib]) dMap[vib] = {}; let combo = ach + "|" + sub; dMap[vib][combo] = (dMap[vib][combo] || 0) + 1; stat1++; });
        thead = `<tr><th>Department</th><th>Acharya</th><th>Subject</th><th>Total Lessons</th></tr>`;
        for(let v in dMap) { for(let item in dMap[v]) { let parts = item.split('|'); currentReportDataset.push({"Department": v, "Acharya": parts[0], "Subject": parts[1], "Total Lessons": dMap[v][item]}); tbody += `<tr><td style="font-weight:bold; color:#AD1457;">${v}</td><td>${parts[0]}</td><td>${parts[1]}</td><td>${translateNumbersToDevanagari(dMap[v][item])}</td></tr>`; } }
        summaryBox.innerHTML = `<div class="summary-card"><h4>Total Lessons</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div>`;
    }
    else if (repType === "advanced_combined" || repType === "student_class_date") {
        currentReportTitleStr = "Advanced Combined Log Viewer"; currentReportColumns = ["Date", "Acharya", "Gana", "Subject", "Description", "Attendance Info"]; thead = `<tr><th>Date</th><th>Acharya</th><th>Gana</th><th>Subject</th><th>Description</th><th>Attendance Info</th><th>Action</th></tr>`;
        logs.forEach(l => { let dt = l.normalizedDate; let isPresText = "-"; if(filters.fStudent) { isPresText = (l['उपस्थिताः (Present)']||"").includes(filters.fStudent) ? "Present" : "Absent"; } else { isPresText = l['उपस्थिताः (Present)']; } currentReportDataset.push({"Date": dt, "Acharya": l['आचार्यः (Acharya)'], "Gana": l['गणः (Class/Gana)'], "Subject": l['विषयः (Subject)'], "Description": l['विवरणम् (Lesson Description)'], "Attendance Info": isPresText}); tbody += `<tr><td>${dt}</td><td style="color:#D35400; font-weight:bold;">${l['आचार्यः (Acharya)']}</td><td>${l['गणः (Class/Gana)']}</td><td style="color:#2E7D32;">${l['विषयः (Subject)']}</td><td>${l['विवरणम् (Lesson Description)']}</td><td style="font-size:0.8rem;">${isPresText}</td><td><button class="btn-primary btn-danger" style="padding: 4px 8px; font-size:0.75rem; margin:0;" onclick="deleteRecord('deleteLog', 'Logs', ${l.rowIdx})">Del</button></td></tr>`; stat1++; });
        summaryBox.innerHTML = `<div class="summary-card"><h4>Matching Records</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div>`;
    }
    else if (repType.startsWith('student')) {
        let studentName = filters.fStudent; let expectedClasses = []; let totalExpected = 0, totalAttended = 0;
        logs.forEach(l => { let isExpected = false; let expectedList = getExpectedStudents(l['गणः (Class/Gana)'], l['विषयः (Subject)'], "Unknown", l['आचार्यः (Acharya)']); expectedList.forEach(s => { if(s.name === studentName) isExpected = true; }); if(isExpected) { totalExpected++; let isPresent = (l['उपस्थिताः (Present)'] || "").includes(studentName); if(isPresent) totalAttended++; expectedClasses.push({ date: l.normalizedDate, subj: l['विषयः (Subject)'], ach: l['आचार्यः (Acharya)'], status: isPresent ? "Present" : "Absent" }); } });
        let percent = totalExpected > 0 ? ((totalAttended / totalExpected) * 100).toFixed(2) : 0;
        summaryBox.innerHTML = `<div class="summary-card"><h4>Expected Classes</h4><p class="val">${translateNumbersToDevanagari(totalExpected)}</p></div><div class="summary-card"><h4>Attended (Present)</h4><p class="val" style="color:#2E7D32;">${translateNumbersToDevanagari(totalAttended)}</p></div><div class="summary-card"><h4>Missed (Absent)</h4><p class="val" style="color:#D32F2F;">${translateNumbersToDevanagari(totalExpected - totalAttended)}</p></div><div class="summary-card"><h4>Attendance %</h4><p class="val" style="color:#1565C0;">${translateNumbersToDevanagari(percent)}%</p></div>`;
        if(repType === "student_overall") {
            currentReportTitleStr = `Overall Attendance Summary: ${studentName}`; currentReportColumns = ["Status", "Count"]; currentReportDataset.push({"Status": "Present", "Count": totalAttended}); currentReportDataset.push({"Status": "Absent", "Count": (totalExpected - totalAttended)}); thead = `<tr><th>Status</th><th>Count</th></tr>`; tbody = `<tr><td>Present ✅</td><td style="color:#2E7D32; font-weight:bold;">${totalAttended}</td></tr><tr><td>Absent ❌</td><td style="color:#D32F2F; font-weight:bold;">${totalExpected - totalAttended}</td></tr>`;
        } else if (repType === "student_class_wise") {
            currentReportTitleStr = `Class-wise Attendance: ${studentName}`; currentReportColumns = ["Class / Subject", "Present", "Absent", "Total", "Percentage"]; let subjMap = {}; expectedClasses.forEach(c => { let sKey = c.subj; if(!subjMap[sKey]) subjMap[sKey] = {tot:0, pres:0}; subjMap[sKey].tot++; if(c.status === "Present") subjMap[sKey].pres++; }); thead = `<tr><th>Class / Subject</th><th>Present</th><th>Absent</th><th>Total</th><th>%</th></tr>`; for(let s in subjMap) { let obj = subjMap[s]; let p = ((obj.pres / obj.tot)*100).toFixed(2); currentReportDataset.push({"Class / Subject": s, "Present": obj.pres, "Absent": (obj.tot - obj.pres), "Total": obj.tot, "Percentage": p + "%"}); tbody += `<tr><td style="font-weight:bold; color:#1B5E20;">${s}</td><td style="color:#2E7D32;">${obj.pres}</td><td style="color:#D32F2F;">${obj.tot - obj.pres}</td><td>${obj.tot}</td><td style="font-weight:bold;">${p}%</td></tr>`; }
        } else if (repType === "student_date_wise") {
            currentReportTitleStr = `Date-wise Attendance Log: ${studentName}`; currentReportColumns = ["Date", "Subject", "Acharya", "Status"]; expectedClasses.sort((a,b) => b.date.localeCompare(a.date)); thead = `<tr><th>Date</th><th>Subject</th><th>Acharya</th><th>Status</th></tr>`; expectedClasses.forEach(c => { currentReportDataset.push({"Date": c.date, "Subject": c.subj, "Acharya": c.ach, "Status": c.status}); let statusCol = c.status === "Present" ? `<span style="color:#2E7D32; font-weight:bold;">Present ✅</span>` : `<span style="color:#D32F2F; font-weight:bold;">Absent ❌</span>`; tbody += `<tr><td>${c.date}</td><td style="color:#1B5E20;">${c.subj}</td><td>${c.ach}</td><td>${statusCol}</td></tr>`; });
        }
    }

    if(tbody === "") { tbody = `<tr><td colspan="9" style="text-align:center; padding:20px; color:#D32F2F; font-weight:bold;">No records found matching these criteria.</td></tr>`; currentReportDataset = []; document.getElementById('downloadControlsDiv').style.display = 'none'; }
    document.getElementById('reportHeaderTitle').innerText = currentReportTitleStr; document.getElementById('reportTableBody').innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody>`; summaryBox.style.display = 'grid'; document.getElementById('reportSnapshotArea').style.display = 'block';
}

function executeDownload() { if(currentReportDataset.length === 0) return alert("No data available to download!"); const format = document.getElementById('exportFormatSelect').value; if(format === 'png') downloadAsPNG(); else if(format === 'excel') downloadAsExcel(); else if(format === 'pdf') downloadAsPDF(); }
function downloadAsPNG() { const btns = document.querySelectorAll('.btn-danger'); btns.forEach(b => b.style.display = 'none'); html2canvas(document.getElementById('reportSnapshotArea'), { backgroundColor: "#FFFFFF", scale: 2 }).then(canvas => { const link = document.createElement('a'); link.download = `VVG_Report_${new Date().toISOString().split('T')[0]}.png`; link.href = canvas.toDataURL('image/png'); link.click(); btns.forEach(b => b.style.display = 'inline-block'); }); }
function downloadAsExcel() { const ws = XLSX.utils.json_to_sheet(currentReportDataset); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Gurukula_Report"); XLSX.writeFile(wb, `VVG_Report_${new Date().toISOString().split('T')[0]}.xlsx`); }
function downloadAsPDF() { const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(currentReportTitleStr, 14, 20); doc.setFontSize(10); doc.setFont("helvetica", "normal"); let yPos = 30; currentActiveFiltersArr.forEach(f => { doc.text(f, 14, yPos); yPos += 6; }); const rows = currentReportDataset.map(obj => Object.values(obj)); doc.autoTable({ startY: yPos + 5, head: [currentReportColumns], body: rows, theme: 'grid', headStyles: { fillColor: [46, 125, 50] }, styles: { font: 'helvetica', fontSize: 9 } }); doc.save(`VVG_Report_${new Date().toISOString().split('T')[0]}.pdf`); }