let currentLoggedIn = ""; let isAdmin = false; let fetchedLogs = []; let fetchedNotifications = [];
let isHolidayToday = false; let isHolidayYesterday = false;

// Global Unified Dataset for Exports
let currentReportDataset = []; 
let currentReportColumns = []; 
let currentReportTitleStr = ""; 
let currentActiveFiltersArr = [];

window.onload = function() {
    populateAcharyaDropdowns(); renderYearlyTimetable(); fetchDataFromGoogleSheets();
    const today = new Date(); 
    const todayStrForHeader = getSanskritDayAndDate(today.toISOString().split('T')[0]);
    const headerDateElem = document.getElementById('headerTodayDate');
    if(headerDateElem) { headerDateElem.innerText = `अद्यतन-दिनाङ्कः: ${todayStrForHeader}`; }

    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const dp = document.getElementById('dashboardDatePicker');
    dp.max = today.toISOString().split('T')[0]; dp.value = yesterdayStr;

    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    document.getElementById('filterFrom').value = firstDay; document.getElementById('filterTo').value = today.toISOString().split('T')[0];
    document.getElementById('notifStartDate').value = today.toISOString().split('T')[0]; document.getElementById('notifEndDate').value = today.toISOString().split('T')[0];
};

function getSanskritDayAndDate(dateStr) {
    const d = new Date(dateStr);
    const days = ["भानुवासरः", "सोमवासरः", "मङ्गलवासरः", "बुधवासरः", "गुरुवासरः", "शुक्रवासरः", "शनिवासरः"];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy} - ${days[d.getDay()]}`;
}

function translateNumbersToDevanagari(num) { 
    const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']; 
    return String(num).split('').map(d => digits[d] || d).join(''); 
}

function setupDailyReminder() {
    const now = new Date(); const yyyy = now.getFullYear(); const mm = String(now.getMonth() + 1).padStart(2, '0'); const dd = String(now.getDate()).padStart(2, '0');
    const dtStart = yyyy + mm + dd + "T200000"; const dtEnd = yyyy + mm + dd + "T201000"; const websiteUrl = window.location.href;
    const icsData = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Veda Vijnana Gurukulam//Pathollekh//EN\nBEGIN:VEVENT\nDTSTART:" + dtStart + "\nDTEND:" + dtEnd + "\nRRULE:FREQ=DAILY\nSUMMARY:पाठोल्लेखः - स्मरणम्\nDESCRIPTION:आचार्य, कृपया अद्यतन-पाठस्य विवरणम् अत्र लिखतु।\nलिंक: " + websiteUrl + "\nBEGIN:VALARM\nTRIGGER:-PT0M\nACTION:DISPLAY\nDESCRIPTION:Reminder\nEND:VALARM\nEND:VEVENT\nEND:VCALENDAR";
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' }); const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Pathollekh_Reminder.ics'; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    document.getElementById('reminderBanner').style.display = 'none'; alert("अलारम्-सञ्चिका (Alarm file) अवतीर्णा अस्ति। कृपया 'Save' नोदयतु!");
}

function populateAcharyaDropdowns() {
    const selectModal = document.getElementById('acharyaSelect'); 
    for(let ach in acharyaPasswords) { selectModal.innerHTML += `<option value="${ach}">${ach}</option>`; }
}

function fetchDataFromGoogleSheets() {
    const cacheBuster = GOOGLE_SCRIPT_URL + (GOOGLE_SCRIPT_URL.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
    fetch(cacheBuster).then(res => res.json()).then(data => {
        fetchedLogs = data.logs || []; fetchedNotifications = data.notifications || [];
        updateTodayView(); changeDashboardDate(); displayActiveNotifications();
        if(currentLoggedIn && document.getElementById('entryFormSection').classList.contains('active')) {
             populateClassDropdown(currentLoggedIn, document.getElementById('dateInput').value);
        }
    }).catch(err => {
        console.error(err); document.getElementById('yesterdayDataContainer').innerHTML = "<div class='log-desc' style='color:red;'>दत्तांश-प्राप्तौ दोषः जातः। (ದಯವಿಟ್ಟು Apps Script ಅನ್ನು New Version ಆಗಿ Deploy ಮಾಡಿ!)</div>";
    });
}

function displayActiveNotifications() {
    const now = new Date(); 
    const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0,5);
    
    let activeNotifs = fetchedNotifications.filter(n => {
        if (!n['StartDate'] || !n['EndDate']) return false;
        let sd = String(n['StartDate']).split('T')[0]; 
        let ed = String(n['EndDate']).split('T')[0];
        if (todayStr >= sd && todayStr <= ed) {
            try {
                if (n['StartTime'] && n['EndTime'] && String(n['StartTime']).includes(':') && String(n['EndTime']).includes(':')) {
                    let stStr = String(n['StartTime']); let etStr = String(n['EndTime']);
                    let st = stStr.includes('T') ? stStr.split('T')[1].slice(0,5) : stStr.slice(0,5);
                    let et = etStr.includes('T') ? etStr.split('T')[1].slice(0,5) : etStr.slice(0,5);
                    if (todayStr === sd && currentTime < st) return false;
                    if (todayStr === ed && currentTime > et) return false;
                }
            } catch(e) { console.error(e); }
            return true;
        }
        return false;
    });
    const banner = document.getElementById('notificationBanner'); const marquee = document.getElementById('notificationText');
    if (activeNotifs.length > 0) {
        let msgStr = activeNotifs.map(n => `<span class="notif-item"><span class="notif-author">📢 ${n['Acharya']} :</span> ${n['Message']}</span>`).join(" &nbsp; | &nbsp; ");
        marquee.innerHTML = msgStr; banner.style.display = "block";
    } else { banner.style.display = "none"; }
}

function submitNotification() {
    const msg = document.getElementById('notifMessage').value; const sDate = document.getElementById('notifStartDate').value; const eDate = document.getElementById('notifEndDate').value;
    const sTime = document.getElementById('notifStartTime').value; const eTime = document.getElementById('notifEndTime').value;
    if(!msg.trim() || !sDate || !eDate) return alert("कृपया सूचनां दिनाङ्कं च लिखतु!");
    const formData = new URLSearchParams(); formData.append('action', 'addNotification'); formData.append('acharya', currentLoggedIn || "Admin"); formData.append('message', msg); formData.append('startDate', sDate); formData.append('endDate', eDate); formData.append('startTime', sTime); formData.append('endTime', eTime);
    const btn = document.getElementById('notifSubmitBtn'); const orig = btn.innerText; btn.innerText = "समर्प्यते..."; btn.disabled = true;
    fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData }).then(res => res.text()).then(data => { alert("सूचना योजिता!"); document.getElementById('notifMessage').value = ""; btn.innerText = orig; btn.disabled = false; document.getElementById('addNotifModal').style.display = 'none'; fetchDataFromGoogleSheets(); }).catch(err => { alert("दोषः जातः!"); btn.innerText = orig; btn.disabled = false; });
}

function updateTodayView() {
    const todayStr = new Date().toISOString().split('T')[0]; let todayHtml = "";
    fetchedLogs.forEach(log => {
        if (log['दिनाङ्कः (Date)'] && log['दिनाङ्कः (Date)'].startsWith(todayStr) && log['विषयः (Subject)'] !== "अनध्यायः") {
            todayHtml += `<div class="log-entry" onclick="showDescModal('${log['विषयः (Subject)']}', '${escapeQuotes(log['विवरणम् (Lesson Description)']||'')}', '${escapeQuotes(log['उपस्थिताः (Present)']||'')}')"><div class="log-title">${log['आचार्यः (Acharya)']} - ${log['विषयः (Subject)']}</div><div class="log-subtitle">${log['गणः (Class/Gana)']} | ${log['समयः (Time)']}</div></div>`;
        }
    });
    document.getElementById('todayDataContainer').innerHTML = todayHtml === "" ? "<div style='text-align:center; padding:15px; color:#777;'>अद्य कोऽपि पाठः न उल्लिखितः।</div>" : todayHtml;
}

function escapeQuotes(str) { return str ? str.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n') : ''; }
function showDescModal(sub, desc, att) { 
    document.getElementById('detailSubject').innerText = sub; document.getElementById('detailDescription').innerText = desc; 
    document.getElementById('detailAttendance').innerText = att || "ಮಾಹಿತिः नास्ति"; document.getElementById('detailsModal').style.display = 'flex'; 
}

function getExpectedStudents(ganaStr, subject, vibhaga, acharya) {
    if(ganaStr === "इतरकार्यम्") return [];
    const ganas = ganaStr.split(' + ');
    const isVeda = subject.includes('वेदः');
    if (isVeda) {
        const vedaGanaMatch = vedaAcharyaMapping[acharya];
        if(vedaGanaMatch) return studentsData.filter(s => s.vedapatha === vedaGanaMatch);
        return [];
    } else {
        return studentsData.filter(s => {
            if(!ganas.includes(s.gana)) return false;
            if(vibhaga === 'सामान्य') return true;
            return s.vibhaga === vibhaga;
        });
    }
}

function changeDashboardDate() {
    const dateStr = document.getElementById('dashboardDatePicker').value;
    if(dateStr) renderTimetableForDate(dateStr);
}

function renderTimetableForDate(targetDateStr) {
    const formattedHeading = getSanskritDayAndDate(targetDateStr);
    document.getElementById('dashboardDateHeading').innerText = `समयसारिणी (दिनाङ्कः: ${formattedHeading})`;

    const bannerDash = document.getElementById('holidayBannerDashboard');
    const missedUL = document.getElementById('missedLogsList'); const absentUL = document.getElementById('absentStudentsList');
    const otherTasksContainer = document.getElementById('otherTasksContainer');
    let isHolidayOnTarget = fetchedLogs.some(log => log['दिनाङ्कः (Date)'] && log['दिनाङ्कः (Date)'].startsWith(targetDateStr) && log['विषयः (Subject)'] === "अनध्यायः");

    if(isHolidayOnTarget) {
        bannerDash.style.display = "block"; bannerDash.innerText = "अस्मिन् दिने अनध्यायः / विशेषकार्यक्रमः आसीत्। (Holiday)";
        document.getElementById('yesterdayDataContainer').innerHTML = ""; 
        otherTasksContainer.innerHTML = "";
        missedUL.innerHTML = "<li>अनध्यायः (Holiday)</li>"; absentUL.innerHTML = "<li>अनध्यायः (Holiday)</li>";
        document.getElementById('statSubmitted').innerText = "-"; document.getElementById('statPresent').innerText = "-"; document.getElementById('statCompleted').innerText = "-";
        return;
    }
    bannerDash.style.display = "none";
    
    const yMap = {}; let yComp = 0; let yAch = new Set();
    fetchedLogs.forEach(log => {
        if (log['दिनाङ्कः (Date)'] && log['दिनाङ्कः (Date)'].startsWith(targetDateStr) && log['विषयः (Subject)'] !== "अनध्यायः") {
            if(log['गणः (Class/Gana)'] !== "इतरकार्यम्") {
               let gStr = (log['गणः (Class/Gana)'] || "").toString().trim();
               let tStr = (log['समयः (Time)'] || "").toString().replace(/\s/g, '').replace('-', '–');
               let subStr = (log['विषयः (Subject)'] || "").toString().trim();
               yMap[gStr + '|' + tStr + '|' + subStr] = {desc: log['विवरणम् (Lesson Description)'], att: log['उपस्थिताः (Present)']};
            }
            yComp++; if(log['आचार्यः (Acharya)']) yAch.add(log['आचार्यः (Acharya)']);
        }
    });

    const times = ["06:30–07:55", "08:30–09:25", "11:00–11:55", "01:30–02:25", "02:30–03:25", "03:30–04:25", "06:30–07:25"];
    const ganas = ["तपः", "तेजः", "ओजः", "वर्चः", "प्रेयः", "श्रेयः", "भ्राजः", "यशः"];
    const tableGrid = {}; ganas.forEach(g => tableGrid[g] = {});
    
    for (const [ach, classes] of Object.entries(timetableData)) {
        classes.forEach(cls => {
            if(cls.gana === "इतरकार्यम्") return;
            let clsTime = cls.time.replace('-', '–');
            let targetGanas = cls.gana.split(' + ');
            targetGanas.forEach(g => {
                if(tableGrid[g]) {
                    if(!tableGrid[g][clsTime]) tableGrid[g][clsTime] = [];
                    tableGrid[g][clsTime].push({ach: ach, sub: cls.subject, vib: cls.vibhaga, originalGana: cls.gana, time: cls.time}); 
                }
            });
        });
    }

    let html = `<div class="table-wrapper"><table><thead><tr><th>गणः</th>`;
    times.forEach(t => html += `<th>${t}</th>`); html += `</tr></thead><tbody>`;
    
    let missedList = []; let absentTally = {};
    let alreadyCountedMissed = new Set(); 

    ganas.forEach(gana => {
        html += `<tr><th>${gana}</th>`;
        times.forEach(time => {
            const classes = tableGrid[gana][time];
            if(!classes || classes.length === 0) { html += `<td></td>`; }
            else if (classes.length === 1) {
                const cls = classes[0]; const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana');
                let clsGStr = cls.originalGana.toString().trim(); let clsTStr = time.toString().replace(/\s/g, '').replace('-', '–'); let clsSubStr = cls.sub.toString().trim();
                const key = clsGStr + '|' + clsTStr + '|' + clsSubStr;
                if(yMap[key]) { 
                    html += `<td class="cell-submitted ${vClass}" onclick="showDescModal('${cls.sub}', '${escapeQuotes(yMap[key].desc)}', '${escapeQuotes(yMap[key].att)}')"><div class="tooltip-text">${yMap[key].desc}</div>${cls.sub} <span class="acharya-name" style="color:#1B5E20; font-weight:bold;">${cls.ach}</span></td>`; 
                    let expected = getExpectedStudents(cls.originalGana, cls.sub, cls.vib, cls.ach);
                    let presentStr = yMap[key].att || "";
                    expected.forEach(st => { if(st.gana === gana && !presentStr.includes(st.name)) { absentTally[st.name] = (absentTally[st.name] || 0) + 1; } });
                } else { 
                    html += `<td class="cell-unsubmitted ${vClass}">${cls.sub} <span class="acharya-name">${cls.ach}</span></td>`; 
                    if(!alreadyCountedMissed.has(key)) { missedList.push(`<b>${cls.ach}</b>: ${cls.originalGana} (${cls.sub})`); alreadyCountedMissed.add(key); }
                }
            } else {
                html += `<td style="padding:0;"><div class="split-cell">`;
                classes.forEach((cls, idx) => {
                    const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana');
                    const btmBorder = idx === 0 ? 'split-top' : ''; 
                    let clsGStr = cls.originalGana.toString().trim(); let clsTStr = time.toString().replace(/\s/g, '').replace('-', '–'); let clsSubStr = cls.sub.toString().trim();
                    const key = clsGStr + '|' + clsTStr + '|' + clsSubStr;
                    if(yMap[key]) { 
                        html += `<div class="${btmBorder} cell-submitted ${vClass}" style="padding:5px; height:100%;" onclick="showDescModal('${cls.sub}', '${escapeQuotes(yMap[key].desc)}', '${escapeQuotes(yMap[key].att)}')"><div class="tooltip-text">${yMap[key].desc}</div>${cls.sub} <span class="acharya-name" style="color:#1B5E20; font-weight:bold;">${cls.ach}</span></div>`; 
                        let expected = getExpectedStudents(cls.originalGana, cls.sub, cls.vib, cls.ach);
                        let presentStr = yMap[key].att || "";
                        expected.forEach(st => { if(st.gana === gana && !presentStr.includes(st.name)) { absentTally[st.name] = (absentTally[st.name] || 0) + 1; } });
                    } else { 
                        html += `<div class="${btmBorder} cell-unsubmitted ${vClass}" style="padding:5px; height:100%;">${cls.sub} <span class="acharya-name">${cls.ach}</span></div>`; 
                        if(!alreadyCountedMissed.has(key)) { missedList.push(`<b>${cls.ach}</b>: ${cls.originalGana} (${cls.sub})`); alreadyCountedMissed.add(key); }
                    }
                }); html += `</div></td>`;
            }
        }); html += `</tr>`;
    }); html += `</tbody></table></div>`;
    document.getElementById('yesterdayDataContainer').innerHTML = html;

    let otherTasksHtml = `<button onclick="const kt = document.getElementById('kalahTasksDiv'); kt.style.display = kt.style.display === 'none' ? 'flex' : 'none';" style="width:100%; background:#E8F5E9; border:1px solid #81C784; color:#2E7D32; font-family:'Laila', sans-serif; font-size:1.1rem; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px; transition:0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">➕ इतरकार्याणि पश्यतु (View Other Tasks / Kalah)</button>`;
    otherTasksHtml += `<div id="kalahTasksDiv" style="display:none; flex-wrap:wrap; gap:15px; margin-top:15px;">`;
    let hasOtherTasks = false;
    for (const [ach, classes] of Object.entries(timetableData)) {
        classes.forEach(cls => {
            if(cls.gana === "इतरकार्यम्") {
                hasOtherTasks = true;
                let submittedLog = fetchedLogs.find(l => l['दिनाङ्कः (Date)'].startsWith(targetDateStr) && l['आचार्यः (Acharya)'] === ach && l['गणः (Class/Gana)'] === 'इतरकार्यम्' && l['विषयः (Subject)'] === cls.subject);
                if(submittedLog) {
                    otherTasksHtml += `<div class="data-card" style="flex:1; min-width:220px; border-left-color:#4CAF50; padding:15px; margin-bottom:0; background:#FAFAFA;">
                        <div style="font-weight:bold; color:#1B5E20; margin-bottom:5px; font-size:1.1rem;">${ach} <span style="color:#555; font-size:0.9rem;">(${cls.subject})</span></div>
                        <div style="font-size:0.95rem; color:#424242; border-top:1px dashed #C8E6C9; padding-top:5px; margin-top:5px;">✅ ${escapeQuotes(submittedLog['विवरणम् (Lesson Description)'])}</div>
                    </div>`;
                } else {
                    otherTasksHtml += `<div class="data-card" style="flex:1; min-width:220px; border-left-color:#D32F2F; padding:15px; margin-bottom:0; background:#FFF5F5;">
                        <div style="font-weight:bold; color:#D32F2F; margin-bottom:5px; font-size:1.1rem;">${ach} <span style="color:#555; font-size:0.9rem;">(${cls.subject})</span></div>
                        <div style="font-size:0.95rem; color:#D32F2F; border-top:1px dashed #FFCDD2; padding-top:5px; margin-top:5px;">❌ न उल्लिखितम् (Not Filled / Taken)</div>
                    </div>`;
                }
            }
        });
    }
    otherTasksHtml += `</div>`;
    otherTasksContainer.innerHTML = hasOtherTasks ? otherTasksHtml : "";

    if(missedList.length === 0) { missedUL.innerHTML = "<li style='color:green; font-weight:bold;'>सर्वे पाठाः सम्पन्नाः (All logs submitted)</li>"; } 
    else { missedUL.innerHTML = missedList.map(item => `<li>${item}</li>`).join(""); }

    let absentKeys = Object.keys(absentTally);
    if(absentKeys.length === 0) { absentUL.innerHTML = "<li style='color:green; font-weight:bold;'>सर्वे छात्राः उपस्थिताः (All students present)</li>"; } 
    else { absentKeys.sort((a,b) => absentTally[b] - absentTally[a]); absentUL.innerHTML = absentKeys.map(name => `<li><b>${name}</b> : ${translateNumbersToDevanagari(absentTally[name])} वर्गेषु अनुपस्थितः</li>`).join(""); }

    let totDaily = 0; Object.values(timetableData).forEach(arr => { arr.forEach(c => { if(c.gana !== 'इतरकार्यम्') { let gn = c.gana.split(' + '); totDaily += gn.length; } }); });
    let submittedDaily = 0; Object.values(tableGrid).forEach(times => { Object.values(times).forEach(classes => { classes.forEach(c => { 
        let clsGStr = c.originalGana.toString().trim(); let clsTStr = c.time.toString().replace(/\s/g, '').replace('-', '–'); let clsSubStr = c.sub.toString().trim();
        const key = clsGStr + '|' + clsTStr + '|' + clsSubStr; if(yMap[key]) submittedDaily++; }); }); 
    });
    const totAch = Object.keys(acharyaPasswords).length;
    let sPct = totDaily > 0 ? Math.round((submittedDaily / totDaily) * 100) : 0;
    let pPct = totAch > 0 ? Math.round((yAch.size / totAch) * 100) : 0;
    if(sPct > 100) sPct = 100; if(pPct > 100) pPct = 100;
    document.getElementById('statSubmitted').innerText = translateNumbersToDevanagari(sPct) + "%"; document.getElementById('circleSubmitted').style.background = `conic-gradient(#4CAF50 ${sPct}%, #E8F5E9 0)`;
    document.getElementById('statPresent').innerText = translateNumbersToDevanagari(pPct) + "%"; document.getElementById('circlePresent').style.background = `conic-gradient(#0288D1 ${pPct}%, #E1F5FE 0)`;
    document.getElementById('statCompleted').innerText = translateNumbersToDevanagari(sPct) + "%"; document.getElementById('circleCompleted').style.background = `conic-gradient(#E65100 ${sPct}%, #FFF3E0 0)`;
}

function goToDashboard() { document.getElementById('mainTabs').style.display = 'flex'; switchView('dashboardView', document.getElementById('tabDashboard')); }
function switchView(viewId, btnElement) { document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active')); if(btnElement) { document.querySelectorAll('.btn-tab').forEach(el => el.classList.remove('active')); btnElement.classList.add('active'); } document.getElementById(viewId).classList.add('active'); }
function openLoginModal() { if (currentLoggedIn) { switchView('entryFormSection', null); populateClassDropdown(currentLoggedIn, document.getElementById('dateInput').value); document.getElementById('attendanceSection').style.display = "none"; } else { document.getElementById('loginModal').style.display = 'flex'; } }
function openAdminModal() { if (isAdmin) { switchView('adminPanelView', null); resetAdvancedFilters(); } else { document.getElementById('adminModal').style.display = 'flex'; } }
function closeModals() { document.getElementById('adminModal').style.display = 'none'; document.getElementById('loginModal').style.display = 'none'; document.getElementById('adminPin').value = ''; document.getElementById('acharyaPin').value = ''; document.getElementById('acharyaSelect').value = ''; }

function verifyAdmin() {
    const pin = document.getElementById('adminPin').value;
    if(pin === '9999') { isAdmin = true; closeModals(); document.getElementById('mainTabs').style.display = 'none'; switchView('adminPanelView', null); resetAdvancedFilters(); }
    else { alert("असमीचीनः कूटशब्दः!"); }
}

function goToAdminEntry() {
    switchView('entryFormSection', null); document.getElementById('loggedInAcharya').innerText = "प्रबन्धक-व्यवस्था (Admin Mode)";
    document.getElementById('dateInput').removeAttribute('readonly'); document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
    document.getElementById('holidayBtn').style.display = 'block'; populateAdminClassDropdown(document.getElementById('dateInput').value); checkFormHolidayState();
}

function getVocative(name) { if (name === "विष्णुः") return "विष्णो"; if (name === "सुब्रह्मण्य. आ.") return name; return name.replace(/ः$/, ''); }

function verifyAcharya() {
    const name = document.getElementById('acharyaSelect').value; const pin = document.getElementById('acharyaPin').value;
    if(!name) return alert("कृपया आचार्यं चिनोतु!");
    if(acharyaPasswords[name] === pin) { closeModals(); isAdmin = false; currentLoggedIn = name; document.getElementById('mainTabs').style.display = 'none'; switchView('entryFormSection', null); document.getElementById('holidayBtn').style.display = 'none'; document.getElementById('loggedInAcharya').innerText = "स्वागतम्, " + getVocative(name); document.getElementById('dateInput').value = new Date().toISOString().split('T')[0]; document.getElementById('dateInput').setAttribute('readonly', 'true'); populateClassDropdown(name, document.getElementById('dateInput').value); checkFormHolidayState(); } else { alert("असमीचीनः कूटशब्दः!"); }
}

function populateClassDropdown(acharyaName, dateStr) {
    const select = document.getElementById('classSelect'); select.innerHTML = '<option value="">-- कक्षां चिनोतु --</option>';
    let submittedKeys = new Set();
    fetchedLogs.forEach(log => {
        if (log['दिनाङ्कः (Date)'] && log['दिनाङ्कः (Date)'].startsWith(dateStr) && log['आचार्यः (Acharya)'] === acharyaName && log['विषयः (Subject)'] !== "अनध्यायः") {
            let gStr = (log['गणः (Class/Gana)'] || "").toString().trim(); let tStr = (log['समयः (Time)'] || "").toString().replace(/\s/g, '').replace('-', '–'); let subStr = (log['विषयः (Subject)'] || "").toString().trim(); submittedKeys.add(gStr + '|' + tStr + '|' + subStr);
        }
    });
    const classes = timetableData[acharyaName] || []; let total = classes.length; let submittedCount = 0;
    classes.forEach(cls => {
        let clsGStr = cls.gana.toString().trim(); let clsTStr = cls.time.toString().replace(/\s/g, '').replace('-', '–'); let clsSubStr = cls.subject.toString().trim();
        const key = clsGStr + '|' + clsTStr + '|' + clsSubStr; const isSubmitted = submittedKeys.has(key);
        if (isSubmitted) submittedCount++;
        const valStr = encodeURIComponent(JSON.stringify({acharya: acharyaName, gana: cls.gana, time: cls.time, subject: cls.subject, vibhaga: cls.vibhaga}));
        if (isSubmitted) { select.innerHTML += `<option value="${valStr}" disabled style="color: #9E9E9E; background: #EEEEEE;">✅ सम्पन्नम् (Submitted) - ${cls.gana} | ${cls.subject}</option>`; } 
        else { select.innerHTML += `<option value="${valStr}" style="color: #D35400; font-weight:bold;">⏳ ${cls.gana} गणः | ${cls.time} | ${cls.subject} (${cls.vibhaga})</option>`; }
    });
    const statusDiv = document.getElementById('submissionStatus');
    if(statusDiv) {
        let pending = total - submittedCount;
        if(pending === 0 && total > 0) { statusDiv.innerHTML = `<span style="color:#2E7D32;">🎉 अभिनन्दनानि! अद्यतनाः सर्वे पाठाः सम्पन्नाः! (${total}/${total})</span>`; } 
        else { statusDiv.innerHTML = `<span style="color:#2E7D32;">सम्पन्नाः (Done): ${submittedCount}</span> | <span style="color:#D35400;">अवशिष्टाः (Pending): ${pending}</span>`; }
    }
}

function populateAdminClassDropdown(dateStr) {
    const select = document.getElementById('classSelect'); select.innerHTML = '<option value="">-- सर्वाः कक्षाः --</option>';
    let submittedKeys = new Set();
    fetchedLogs.forEach(log => {
        if (log['दिनाङ्कः (Date)'] && log['दिनाङ्कः (Date)'].startsWith(dateStr) && log['विषयः (Subject)'] !== "अनध्यायः") {
            let achStr = (log['आचार्यः (Acharya)'] || "").toString().trim(); let gStr = (log['गणः (Class/Gana)'] || "").toString().trim(); let tStr = (log['समयः (Time)'] || "").toString().replace(/\s/g, '').replace('-', '–'); let subStr = (log['विषयः (Subject)'] || "").toString().trim(); submittedKeys.add(achStr + '|' + gStr + '|' + tStr + '|' + subStr);
        }
    });
    for (const [achName, classes] of Object.entries(timetableData)) {
        classes.forEach(cls => {
            let clsAchStr = achName.toString().trim(); let clsGStr = cls.gana.toString().trim(); let clsTStr = cls.time.toString().replace(/\s/g, '').replace('-', '–'); let clsSubStr = cls.subject.toString().trim();
            const key = clsAchStr + '|' + clsGStr + '|' + clsTStr + '|' + clsSubStr;
            const valStr = encodeURIComponent(JSON.stringify({acharya: achName, gana: cls.gana, time: cls.time, subject: cls.subject, vibhaga: cls.vibhaga}));
            if(submittedKeys.has(key)) { select.innerHTML += `<option value="${valStr}" disabled style="color: #9E9E9E; background: #EEEEEE;">✅ ${achName} - ${cls.gana} (${cls.subject})</option>`; } 
            else { select.innerHTML += `<option value="${valStr}">${achName} | ${cls.gana} | ${cls.time} | ${cls.subject}</option>`; }
        });
    }
    document.getElementById('submissionStatus').innerHTML = ""; 
}

function checkFormHolidayState() {
    const dateVal = document.getElementById('dateInput').value; const isHol = fetchedLogs.some(log => log['दिनाङ्कः (Date)'] && log['दिनाङ्कः (Date)'].startsWith(dateVal) && log['विषयः (Subject)'] === "अनध्यायः"); const banner = document.getElementById('holidayBannerForm'); const submitBtn = document.getElementById('submitBtn');
    if(isHol && !isAdmin) { banner.style.display = "block"; banner.innerText = "अद्य अनध्यायः / विशेषकार्यक्रमः अस्ति। पाठोल्लेखः न शक्यते। (Holiday Declared)"; submitBtn.disabled = true; } else { banner.style.display = "none"; submitBtn.disabled = false; }
}

document.getElementById('dateInput').addEventListener('change', function() { checkFormHolidayState(); const dateStr = this.value; if(isAdmin) { populateAdminClassDropdown(dateStr); } else if(currentLoggedIn) { populateClassDropdown(currentLoggedIn, dateStr); } renderAttendanceChecklist(); });

function declareHoliday() { const dateVal = document.getElementById('dateInput').value; if(confirm(dateVal + " दिनाङ्के 'अनध्यायः' (Holiday) घोषणीयम् वा?")) { sendDataToSheet(dateVal, "ADMIN", "सर्वे", "-", "अनध्यायः", "विशेषकार्यक्रमः / अनध्यायः", "-"); } }

function renderAttendanceChecklist() {
    const clsVal = document.getElementById('classSelect').value; const attSection = document.getElementById('attendanceSection'); const attContainer = document.getElementById('attendanceContainer');
    if(!clsVal) { attSection.style.display = "none"; return; }
    const clsData = JSON.parse(decodeURIComponent(clsVal)); if(clsData.gana === "इतरकार्यम्") { attSection.style.display = "none"; return; }
    attSection.style.display = "block";
    let filteredStudents = getExpectedStudents(clsData.gana, clsData.subject, clsData.vibhaga, clsData.acharya);
    if(filteredStudents.length === 0) { attContainer.innerHTML = "<span style='color:red;'>अस्मिन् वर्गे छात्राः न सन्ति।</span>"; return; }
    let html = `<div class="attendance-grid">`;
    filteredStudents.forEach(student => { html += `<div class="student-checkbox" onclick="toggleCheck('chk_${student.name}')"><input type="checkbox" id="chk_${student.name}" value="${student.name}" class="att-checkbox" onclick="event.stopPropagation()"><label for="chk_${student.name}" onclick="event.stopPropagation()">${student.name}</label></div>`; });
    html += `</div>`; attContainer.innerHTML = html;
}

function toggleCheck(id) { const cb = document.getElementById(id); cb.checked = !cb.checked; }

function submitLesson() {
    const clsVal = document.getElementById('classSelect').value; const desc = document.getElementById('descriptionInput').value; const dateVal = document.getElementById('dateInput').value;
    if(!clsVal) return alert("कृपया कक्षां चिनोतु!"); if(!desc.trim()) return alert("कृपया पाठस्य विवरणं लिखतु!");
    const clsData = JSON.parse(decodeURIComponent(clsVal)); let presentStudents = [];
    if(clsData.gana !== "इतरकार्यम्") { document.querySelectorAll('.att-checkbox').forEach(cb => { if(cb.checked) presentStudents.push(cb.value); }); }
    const attendanceStr = presentStudents.join(", "); sendDataToSheet(dateVal, clsData.acharya, clsData.gana, clsData.time, clsData.subject, desc, attendanceStr);
}

function sendDataToSheet(date, acharya, gana, time, subject, description, attendance) {
    const formData = new URLSearchParams(); formData.append('action', 'addLog'); formData.append('date', date); formData.append('acharya', acharya); formData.append('gana', gana); formData.append('time', time); formData.append('subject', subject); formData.append('description', description); formData.append('attendance', attendance || "-");
    const btn = document.getElementById('submitBtn'); const origText = btn.innerText; btn.innerText = "समर्प्यते..."; btn.disabled = true;
    fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData }).then(res => res.text()).then(data => { alert("सफलम्! (Success)"); document.getElementById('descriptionInput').value = ""; document.getElementById('attendanceSection').style.display="none"; btn.innerText = origText; btn.disabled = false; fetchDataFromGoogleSheets(); goToDashboard(); }).catch(err => { alert("दोषः जातः!"); btn.innerText = origText; btn.disabled = false; });
}

function deleteRecord(actionType, rowIdx) {
    if(!confirm("ಖಚಿತವಾಗಿಯೂ ಈ ಮಾಹಿತಿಯನ್ನು ಅಳಿಸಬೇಕೇ? (Are you sure you want to delete this?)")) return;
    const formData = new URLSearchParams(); formData.append('action', actionType); formData.append('rowIdx', rowIdx);
    fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData }).then(res => res.text()).then(data => { alert("अपाकृतम्! (Deleted Successfully)"); fetchDataFromGoogleSheets(); if(actionType === 'deleteLog') generateAdvancedReport(); if(actionType === 'deleteNotification') renderAdminNotifications(); }).catch(err => alert("दोषः जातः!"));
}

function renderYearlyTimetable() {
    const times = ["06:30–07:55", "08:30–09:25", "11:00–11:55", "01:30–02:25", "02:30–03:25", "03:30–04:25", "06:30–07:25"]; const ganas = ["तपः", "तेजः", "ओजः", "वर्चः", "प्रेयः", "श्रेयः", "भ्राजः", "यशः"]; const tableGrid = {}; ganas.forEach(g => tableGrid[g] = {});
    for (const [ach, classes] of Object.entries(timetableData)) { classes.forEach(cls => { if(cls.gana === "इतरकार्यम्") return; let clsTime = cls.time.replace('-', '–'); let targetGanas = cls.gana.split(' + '); targetGanas.forEach(g => { if(tableGrid[g]) { if(!tableGrid[g][clsTime]) tableGrid[g][clsTime] = []; tableGrid[g][clsTime].push({ach: ach, sub: cls.subject, vib: cls.vibhaga, originalGana: cls.gana}); } }); }); }
    let html = `<table><thead><tr><th>गणः</th>`; times.forEach(t => html += `<th>${t}</th>`); html += `</tr></thead><tbody>`;
    ganas.forEach(gana => {
        html += `<tr><th>${gana}</th>`;
        times.forEach(time => {
            const classes = tableGrid[gana][time];
            if(!classes || classes.length === 0) { html += `<td></td>`; } else if (classes.length === 1) { const cls = classes[0]; const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana'); html += `<td class="${vClass}">${cls.sub} <span class="acharya-name">${cls.ach}</span></td>`; } else { html += `<td style="padding:0;"><div class="split-cell">`; classes.forEach((cls, idx) => { const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana'); const btmBorder = idx === 0 ? 'split-top' : ''; html += `<div class="${btmBorder} ${vClass}" style="padding:5px;">${cls.sub} <span class="acharya-name">${cls.ach}</span></div>`; }); html += `</div></td>`; }
        }); html += `</tr>`;
    }); html += `</tbody></table>`; document.getElementById('yearlyTableContainer').innerHTML = html;
}

function logout() { currentLoggedIn = ""; isAdmin = false; document.getElementById('descriptionInput').value = ""; document.getElementById('attendanceSection').style.display="none"; goToDashboard(); }

// ==========================================
// ADVANCED ADMIN REPORTING & FILTERING
// ==========================================

function switchReportCategory(category, btnElement) {
    document.querySelectorAll('.rep-tab').forEach(el => el.classList.remove('active'));
    btnElement.classList.add('active');
    
    if(category === 'lesson') {
        document.getElementById('lessonSubTabs').style.display = 'flex';
        document.getElementById('attendanceSubTabs').style.display = 'none';
        document.querySelector('input[name="repType"][value="acharya_wise"]').checked = true;
    } else {
        document.getElementById('lessonSubTabs').style.display = 'none';
        document.getElementById('attendanceSubTabs').style.display = 'flex';
        document.querySelector('input[name="repType"][value="student_overall"]').checked = true;
    }
    handleReportTypeChange();
}

function handleReportTypeChange() {
    const repType = document.querySelector('input[name="repType"]:checked').value;
    const isAttendance = repType.startsWith('student');
    
    // Enable/disable relevant filters based on report type
    document.getElementById('advFilterStudent').disabled = !isAttendance;
    document.getElementById('advFilterAcharya').disabled = (repType === 'student_overall');
    
    if(isAttendance && !document.getElementById('advFilterStudent').value) {
        document.getElementById('advFilterStudent').style.borderColor = "#E65100";
    } else {
        document.getElementById('advFilterStudent').style.borderColor = "#E0E0E0";
    }

    // Auto-set Department for Dept-wise reports
    if(repType === "dept_vedanta") document.getElementById('advFilterDept').value = "वेदान्त";
    if(repType === "dept_vyakarana") document.getElementById('advFilterDept').value = "व्याकरण";
    if(repType === "dept_all") document.getElementById('advFilterDept').value = "";
    
    if(repType.startsWith('dept')) populateCascadingFilters();
}

// Cascading Dependent Filters Logic
function populateCascadingFilters() {
    const selDept = document.getElementById('advFilterDept').value;
    const selGana = document.getElementById('advFilterGana').value;
    const selSubj = document.getElementById('advFilterSubject').value;
    const selAcharya = document.getElementById('advFilterAcharya').value;

    let validDepts = new Set(['सामान्य', 'वेदान्त', 'व्याकरण']);
    let validGanas = new Set();
    let validSubjects = new Set();
    let validAcharyas = new Set();
    let validStudents = new Set();

    for (const [ach, classes] of Object.entries(timetableData)) {
        classes.forEach(cls => {
            if(cls.gana === "इतरकार्यम्") return;
            
            let matchDept = !selDept || cls.vibhaga === selDept;
            let matchGana = !selGana || cls.gana === selGana || cls.gana.includes(selGana);
            let matchSubj = !selSubj || cls.subject === selSubj;
            let matchAcharya = !selAcharya || ach === selAcharya;

            if (matchDept && matchGana && matchSubj) validAcharyas.add(ach);
            if (matchDept && matchSubj && matchAcharya) {
                cls.gana.split(' + ').forEach(g => validGanas.add(g));
            }
            if (matchDept && matchGana && matchAcharya) validSubjects.add(cls.subject);
        });
    }

    studentsData.forEach(s => {
        if((!selDept || s.vibhaga === selDept) && (!selGana || s.gana === selGana)) {
            validStudents.add(s.name);
        }
    });

    const updateSelect = (id, validSet, defaultText) => {
        const el = document.getElementById(id);
        const currentVal = el.value;
        el.innerHTML = `<option value="">-- All ${defaultText} --</option>`;
        [...validSet].sort().forEach(val => {
            let selected = (val === currentVal) ? "selected" : "";
            el.innerHTML += `<option value="${val}" ${selected}>${val}</option>`;
        });
        if(!validSet.has(currentVal)) el.value = ""; 
    };

    updateSelect('advFilterDept', validDepts, "Departments");
    updateSelect('advFilterGana', validGanas, "Ganas");
    updateSelect('advFilterSubject', validSubjects, "Classes/Subjects");
    updateSelect('advFilterAcharya', validAcharyas, "Acharyas");
    updateSelect('advFilterStudent', validStudents, "Students");
}

function resetAdvancedFilters() {
    const today = new Date().toISOString().split('T')[0];
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
    document.getElementById('advFilterFrom').value = firstDay;
    document.getElementById('advFilterTo').value = today;
    document.getElementById('advFilterDept').value = "";
    document.getElementById('advFilterGana').value = "";
    document.getElementById('advFilterSubject').value = "";
    document.getElementById('advFilterAcharya').value = "";
    document.getElementById('advFilterStudent').value = "";
    
    document.getElementById('activeFilterChips').innerHTML = "";
    document.getElementById('reportSnapshotArea').style.display = 'none';
    document.getElementById('reportSummaryContainer').style.display = 'none';
    
    populateCascadingFilters();
    handleReportTypeChange();
}

function generateAdvancedReport() {
    const fFrom = document.getElementById('advFilterFrom').value;
    const fTo = document.getElementById('advFilterTo').value;
    const fDept = document.getElementById('advFilterDept').value;
    const fGana = document.getElementById('advFilterGana').value;
    const fSubj = document.getElementById('advFilterSubject').value;
    const fAcharya = document.getElementById('advFilterAcharya').value;
    const fStudent = document.getElementById('advFilterStudent').value;
    const repType = document.querySelector('input[name="repType"]:checked').value;

    if(!fFrom || !fTo) return alert("Please select both From and To dates!");
    if(repType.startsWith('student') && !fStudent) return alert("Please select a Student for Attendance Reports!");

    currentActiveFiltersArr = [`Date: ${fFrom} to ${fTo}`];
    let chipsHtml = `<div class="chip"><span>Date:</span> ${fFrom} to ${fTo}</div>`;
    if(fDept) { chipsHtml += `<div class="chip"><span>Dept:</span> ${fDept}</div>`; currentActiveFiltersArr.push(`Dept: ${fDept}`); }
    if(fGana) { chipsHtml += `<div class="chip"><span>Gana:</span> ${fGana}</div>`; currentActiveFiltersArr.push(`Gana: ${fGana}`); }
    if(fSubj) { chipsHtml += `<div class="chip"><span>Subject:</span> ${fSubj}</div>`; currentActiveFiltersArr.push(`Subject: ${fSubj}`); }
    if(fAcharya) { chipsHtml += `<div class="chip"><span>Acharya:</span> ${fAcharya}</div>`; currentActiveFiltersArr.push(`Acharya: ${fAcharya}`); }
    if(fStudent) { chipsHtml += `<div class="chip"><span>Student:</span> ${fStudent}</div>`; currentActiveFiltersArr.push(`Student: ${fStudent}`); }
    document.getElementById('activeFilterChips').innerHTML = chipsHtml;

    // Filter Global Data
    let filteredLogs = fetchedLogs.filter(log => {
        if(!log['दिनाङ्कः (Date)']) return false;
        const lDate = log['दिनाङ्कः (Date)'].split('T')[0];
        
        // Exact Date Match Support
        if (lDate < fFrom || lDate > fTo) return false;
        if (log['विषयः (Subject)'] === "अनध्यायः") return false;
        
        const lAch = (log['आचार्यः (Acharya)']||"").trim();
        const lGana = (log['गणः (Class/Gana)']||"").trim();
        const lSubj = (log['विषयः (Subject)']||"").trim();
        
        if (fAcharya && lAch !== fAcharya) return false;
        if (fGana && lGana !== fGana && !lGana.includes(fGana)) return false;
        if (fSubj && lSubj !== fSubj) return false;
        
        // Accurate Department check from Timetable
        if (fDept) {
            let classVibhaga = "";
            (timetableData[lAch] || []).forEach(c => {
                if(c.subject === lSubj && c.gana === lGana) classVibhaga = c.vibhaga;
            });
            if(classVibhaga !== fDept) return false;
        }
        
        if (!repType.startsWith('student') && fStudent) {
            if(!(log['उपस्थिताः (Present)']||"").includes(fStudent)) return false;
        }
        return true;
    });

    renderReportData(repType, filteredLogs, {fFrom, fTo, fDept, fGana, fSubj, fAcharya, fStudent});
}

function renderReportData(repType, logs, filters) {
    const tableBody = document.getElementById('reportTableBody');
    const summaryBox = document.getElementById('reportSummaryContainer');
    document.getElementById('deleteControlHeader').style.display = (repType === "advanced_combined") ? "block" : "none";
    
    currentReportDataset = []; 
    currentReportColumns = [];

    let thead = "", tbody = "";
    let stat1 = 0, stat2 = 0;
    currentReportTitleStr = "";

    // 1. ACHARYA-WISE LESSON REPORT
    if(repType === "acharya_wise") {
        currentReportTitleStr = "Acharya-wise Lesson Report";
        currentReportColumns = ["Acharya", "Subject / Class", "Total Lessons"];
        let agMap = {};
        logs.forEach(l => {
            let ach = l['आचार्यः (Acharya)'];
            if(!agMap[ach]) agMap[ach] = {};
            let subj = l['विषयः (Subject)'];
            agMap[ach][subj] = (agMap[ach][subj] || 0) + 1;
            stat1++; 
        });
        stat2 = Object.keys(agMap).length; 

        thead = `<tr><th>Acharya</th><th>Subject / Class</th><th>Total Lessons</th></tr>`;
        for(let ach in agMap) {
            for(let subj in agMap[ach]) {
                currentReportDataset.push({"Acharya": ach, "Subject / Class": subj, "Total Lessons": agMap[ach][subj]});
                tbody += `<tr><td style="font-weight:bold; color:#E65100;">${ach}</td><td>${subj}</td><td>${translateNumbersToDevanagari(agMap[ach][subj])}</td></tr>`;
            }
        }
        summaryBox.innerHTML = `<div class="summary-card"><h4>Total Lessons</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div><div class="summary-card"><h4>Active Acharyas</h4><p class="val">${translateNumbersToDevanagari(stat2)}</p></div>`;
    }
    
    // 2. GANA-WISE & GANA+CLASS REPORT
    else if (repType === "gana_wise" || repType === "gana_class_wise") {
        currentReportTitleStr = repType === "gana_class_wise" ? "Gana & Class Breakdown Report" : "Gana-wise Breakdown Report";
        currentReportColumns = ["Gana", "Acharya", "Subject / Class", "Total Lessons"];
        let gMap = {};
        logs.forEach(l => {
            let gStr = l['गणः (Class/Gana)'];
            if(gStr === "इतरकार्यम्") return;
            // Split common ganas (e.g. Shreyas + Bhrajah) and count as one entity strictly
            gStr.split(' + ').forEach(g => {
                if(filters.fGana && g !== filters.fGana) return; 
                if(!gMap[g]) gMap[g] = {};
                let achSub = l['आचार्यः (Acharya)'] + "|" + l['विषयः (Subject)'];
                gMap[g][achSub] = (gMap[g][achSub] || 0) + 1;
                stat1++;
            });
        });
        stat2 = Object.keys(gMap).length;

        thead = `<tr><th>Gana</th><th>Acharya</th><th>Subject / Class</th><th>Total Lessons</th></tr>`;
        for(let g in gMap) {
            for(let item in gMap[g]) {
                let parts = item.split('|');
                currentReportDataset.push({"Gana": g, "Acharya": parts[0], "Subject / Class": parts[1], "Total Lessons": gMap[g][item]});
                tbody += `<tr><td style="font-weight:bold; color:#2E7D32;">${g}</td><td>${parts[0]}</td><td>${parts[1]}</td><td>${translateNumbersToDevanagari(gMap[g][item])}</td></tr>`;
            }
        }
        summaryBox.innerHTML = `<div class="summary-card"><h4>Total Lessons</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div><div class="summary-card"><h4>Ganas Covered</h4><p class="val">${translateNumbersToDevanagari(stat2)}</p></div>`;
    }

    // 3. DEPARTMENT-WISE REPORT
    else if (repType.startsWith("dept")) {
        currentReportTitleStr = filters.fDept ? `Academic Report: ${filters.fDept} Department` : "Department-wise Academic Report";
        currentReportColumns = ["Department", "Acharya", "Subject", "Total Lessons"];
        let dMap = {};
        logs.forEach(l => {
            let vib = "सामान्य"; 
            let ach = l['आचार्यः (Acharya)'];
            let sub = l['विषयः (Subject)'];
            (timetableData[ach] || []).forEach(c => { if(c.subject === sub) vib = c.vibhaga; });
            
            if(filters.fDept && vib !== filters.fDept) return;
            if(!dMap[vib]) dMap[vib] = {};
            let combo = ach + "|" + sub;
            dMap[vib][combo] = (dMap[vib][combo] || 0) + 1;
            stat1++;
        });

        thead = `<tr><th>Department</th><th>Acharya</th><th>Subject</th><th>Total Lessons</th></tr>`;
        for(let v in dMap) {
            for(let item in dMap[v]) {
                let parts = item.split('|');
                currentReportDataset.push({"Department": v, "Acharya": parts[0], "Subject": parts[1], "Total Lessons": dMap[v][item]});
                tbody += `<tr><td style="font-weight:bold; color:#AD1457;">${v}</td><td>${parts[0]}</td><td>${parts[1]}</td><td>${translateNumbersToDevanagari(dMap[v][item])}</td></tr>`;
            }
        }
        summaryBox.innerHTML = `<div class="summary-card"><h4>Total Lessons</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div>`;
    }

    // 4. ADVANCED COMBINED LOG (Raw Data)
    else if (repType === "advanced_combined" || repType === "student_class_date") {
        currentReportTitleStr = "Advanced Combined Log Viewer";
        currentReportColumns = ["Date", "Acharya", "Gana", "Subject", "Description", "Attendance Info"];
        thead = `<tr><th>Date</th><th>Acharya</th><th>Gana</th><th>Subject</th><th>Description</th><th>Attendance Info</th><th>Action</th></tr>`;
        logs.forEach(l => {
            let dt = l['दिनाङ्कः (Date)'].split('T')[0];
            let isPresText = "-";
            if(filters.fStudent) {
                 isPresText = (l['उपस्थिताः (Present)']||"").includes(filters.fStudent) ? "Present" : "Absent";
            } else {
                 isPresText = l['उपस्थिताः (Present)'];
            }
            
            currentReportDataset.push({"Date": dt, "Acharya": l['आचार्यः (Acharya)'], "Gana": l['गणः (Class/Gana)'], "Subject": l['विषयः (Subject)'], "Description": l['विवरणम् (Lesson Description)'], "Attendance Info": isPresText});
            tbody += `<tr><td>${dt}</td><td style="color:#D35400; font-weight:bold;">${l['आचार्यः (Acharya)']}</td><td>${l['गणः (Class/Gana)']}</td><td style="color:#2E7D32;">${l['विषयः (Subject)']}</td><td>${l['विवरणम् (Lesson Description)']}</td><td style="font-size:0.8rem;">${isPresText}</td><td><button class="btn-primary btn-danger" style="padding: 4px 8px; font-size:0.75rem; margin:0;" onclick="deleteRecord('deleteLog', ${l.rowIdx})">Del</button></td></tr>`;
            stat1++;
        });
        summaryBox.innerHTML = `<div class="summary-card"><h4>Matching Records</h4><p class="val">${translateNumbersToDevanagari(stat1)}</p></div>`;
    }

    // 5. STUDENT ATTENDANCE CALCULATIONS
    else if (repType.startsWith('student')) {
        let studentName = filters.fStudent;
        let expectedClasses = [];
        let totalExpected = 0, totalAttended = 0;

        logs.forEach(l => {
            let isExpected = false;
            // We use the unified getExpectedStudents to handle merged Ganas correctly (e.g. Shreyas + Bhrajah)
            let expectedList = getExpectedStudents(l['गणः (Class/Gana)'], l['विषयः (Subject)'], "Unknown", l['आचार्यः (Acharya)']); 
            expectedList.forEach(s => { if(s.name === studentName) isExpected = true; });

            if(isExpected) {
                totalExpected++;
                let isPresent = (l['उपस्थिताः (Present)'] || "").includes(studentName);
                if(isPresent) totalAttended++;
                
                expectedClasses.push({
                    date: l['दिनाङ्कः (Date)'].split('T')[0],
                    subj: l['विषयः (Subject)'],
                    ach: l['आचार्यः (Acharya)'],
                    status: isPresent ? "Present" : "Absent"
                });
            }
        });

        let percent = totalExpected > 0 ? ((totalAttended / totalExpected) * 100).toFixed(2) : 0;
        
        summaryBox.innerHTML = `
            <div class="summary-card"><h4>Expected Classes</h4><p class="val">${translateNumbersToDevanagari(totalExpected)}</p></div>
            <div class="summary-card"><h4>Attended (Present)</h4><p class="val" style="color:#2E7D32;">${translateNumbersToDevanagari(totalAttended)}</p></div>
            <div class="summary-card"><h4>Missed (Absent)</h4><p class="val" style="color:#D32F2F;">${translateNumbersToDevanagari(totalExpected - totalAttended)}</p></div>
            <div class="summary-card"><h4>Attendance %</h4><p class="val" style="color:#1565C0;">${translateNumbersToDevanagari(percent)}%</p></div>`;

        if(repType === "student_overall") {
            currentReportTitleStr = `Overall Attendance Summary: ${studentName}`;
            currentReportColumns = ["Status", "Count"];
            currentReportDataset.push({"Status": "Present", "Count": totalAttended});
            currentReportDataset.push({"Status": "Absent", "Count": (totalExpected - totalAttended)});
            
            thead = `<tr><th>Status</th><th>Count</th></tr>`;
            tbody = `<tr><td>Present ✅</td><td style="color:#2E7D32; font-weight:bold;">${totalAttended}</td></tr>
                     <tr><td>Absent ❌</td><td style="color:#D32F2F; font-weight:bold;">${totalExpected - totalAttended}</td></tr>`;
        }
        else if (repType === "student_class_wise") {
            currentReportTitleStr = `Class-wise Attendance: ${studentName}`;
            currentReportColumns = ["Class / Subject", "Present", "Absent", "Total", "Percentage"];
            let subjMap = {};
            expectedClasses.forEach(c => {
                let sKey = c.subj;
                if(!subjMap[sKey]) subjMap[sKey] = {tot:0, pres:0};
                subjMap[sKey].tot++;
                if(c.status === "Present") subjMap[sKey].pres++;
            });
            thead = `<tr><th>Class / Subject</th><th>Present</th><th>Absent</th><th>Total</th><th>%</th></tr>`;
            for(let s in subjMap) {
                let obj = subjMap[s];
                let p = ((obj.pres / obj.tot)*100).toFixed(2);
                currentReportDataset.push({"Class / Subject": s, "Present": obj.pres, "Absent": (obj.tot - obj.pres), "Total": obj.tot, "Percentage": p + "%"});
                tbody += `<tr><td style="font-weight:bold; color:#1B5E20;">${s}</td><td style="color:#2E7D32;">${obj.pres}</td><td style="color:#D32F2F;">${obj.tot - obj.pres}</td><td>${obj.tot}</td><td style="font-weight:bold;">${p}%</td></tr>`;
            }
        }
        else if (repType === "student_date_wise") {
            currentReportTitleStr = `Date-wise Attendance Log: ${studentName}`;
            currentReportColumns = ["Date", "Subject", "Acharya", "Status"];
            expectedClasses.sort((a,b) => b.date.localeCompare(a.date)); // Descending
            thead = `<tr><th>Date</th><th>Subject</th><th>Acharya</th><th>Status</th></tr>`;
            expectedClasses.forEach(c => {
                currentReportDataset.push({"Date": c.date, "Subject": c.subj, "Acharya": c.ach, "Status": c.status});
                let statusCol = c.status === "Present" ? `<span style="color:#2E7D32; font-weight:bold;">Present ✅</span>` : `<span style="color:#D32F2F; font-weight:bold;">Absent ❌</span>`;
                tbody += `<tr><td>${c.date}</td><td style="color:#1B5E20;">${c.subj}</td><td>${c.ach}</td><td>${statusCol}</td></tr>`;
            });
        }
    }

    if(tbody === "") {
        tbody = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#D32F2F; font-weight:bold;">No records found matching these criteria.</td></tr>`;
        currentReportDataset = [];
    }

    document.getElementById('reportHeaderTitle').innerText = currentReportTitleStr;
    document.getElementById('reportTableBody').innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody>`;
    summaryBox.style.display = 'grid';
    document.getElementById('reportSnapshotArea').style.display = 'block';
}

function renderAdminNotifications() {
    document.getElementById('reportHeaderTitle').innerText = "सक्रियाः सूचनाः (Active Notifications)"; 
    document.getElementById('reportSnapshotArea').style.display = 'block';
    document.getElementById('reportSummaryContainer').style.display = 'none';
    document.getElementById('activeFilterChips').innerHTML = "";
    currentReportDataset = [];
    
    if(fetchedNotifications.length === 0) return alert("सूचनाः न सन्ति! (No Notifications)");
    let thead = `<tr><th>Timestamp</th><th>Acharya</th><th>Message</th><th>Start Date</th><th>End Date</th><th>Action</th></tr>`;
    let tbody = "";
    fetchedNotifications.forEach(row => { 
        let sDate = row['StartDate'] ? row['StartDate'].split('T')[0] : ''; let eDate = row['EndDate'] ? row['EndDate'].split('T')[0] : '';
        tbody += `<tr><td>${row['Timestamp'] ? row['Timestamp'].split('T')[0] : ''}</td><td style="color:#D35400; font-weight:bold;">${row['Acharya'] || ''}</td><td>${row['Message'] || ''}</td><td>${sDate}</td><td>${eDate}</td><td><button class="btn-primary btn-danger" style="padding: 5px 10px; font-size:0.8rem; margin:0;" onclick="deleteRecord('deleteNotification', ${row.rowIdx})">Delete</button></td></tr>`; 
    });
    document.getElementById('reportTableBody').innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody>`; 
}

// ==========================================
// UNIFIED REPORT DOWNLOAD EXPORT ENGINE
// ==========================================

function executeDownload() {
    if(currentReportDataset.length === 0) return alert("No data available to download!");
    const format = document.getElementById('exportFormatSelect').value;
    if(format === 'png') downloadAsPNG();
    else if(format === 'excel') downloadAsExcel();
    else if(format === 'pdf') downloadAsPDF();
}

function downloadAsPNG() { 
    const btns = document.querySelectorAll('.btn-danger'); btns.forEach(b => b.style.display = 'none');
    html2canvas(document.getElementById('reportSnapshotArea'), { backgroundColor: "#FFFFFF", scale: 2 }).then(canvas => { 
        const link = document.createElement('a'); 
        link.download = `VVG_Report_${new Date().toISOString().split('T')[0]}.png`; 
        link.href = canvas.toDataURL('image/png'); 
        link.click(); 
        btns.forEach(b => b.style.display = 'inline-block'); 
    }); 
}

function downloadAsExcel() {
    // We use the EXACT unified dataset ensuring screen matches export 100%
    const ws = XLSX.utils.json_to_sheet(currentReportDataset);
    const wb = XLSX.utils.book_new();
    
    // Add some meta context to sheet name
    XLSX.utils.book_append_sheet(wb, ws, "Gurukula_Report");
    XLSX.writeFile(wb, `VVG_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function downloadAsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(currentReportTitleStr, 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    let yPos = 30;
    currentActiveFiltersArr.forEach(f => {
        doc.text(f, 14, yPos);
        yPos += 6;
    });

    const rows = currentReportDataset.map(obj => Object.values(obj));
    
    doc.autoTable({
        startY: yPos + 5,
        head: [currentReportColumns],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [46, 125, 50] }, // Primary Green
        styles: { font: 'helvetica', fontSize: 9 }
    });
    
    doc.save(`VVG_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}