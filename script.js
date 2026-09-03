let currentLoggedIn = ""; let isAdmin = false; let fetchedLogs = []; let fetchedNotifications = [];
let isHolidayToday = false; let isHolidayYesterday = false;

window.onload = function() {
    populateAcharyaDropdowns(); renderYearlyTimetable(); fetchDataFromGoogleSheets();
    const today = new Date(); 
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const dp = document.getElementById('dashboardDatePicker');
    dp.max = today.toISOString().split('T')[0];
    dp.value = yesterdayStr;

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

function setupDailyReminder() {
    const now = new Date(); const yyyy = now.getFullYear(); const mm = String(now.getMonth() + 1).padStart(2, '0'); const dd = String(now.getDate()).padStart(2, '0');
    const dtStart = yyyy + mm + dd + "T200000"; const dtEnd = yyyy + mm + dd + "T201000"; const websiteUrl = window.location.href;
    const icsData = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Veda Vijnana Gurukulam//Pathollekh//EN\nBEGIN:VEVENT\nDTSTART:" + dtStart + "\nDTEND:" + dtEnd + "\nRRULE:FREQ=DAILY\nSUMMARY:पाठोल्लेखः - स्मरणम्\nDESCRIPTION:आचार्य, कृपया अद्यतन-पाठस्य विवरणम् अत्र लिखतु।\nलिंक: " + websiteUrl + "\nBEGIN:VALARM\nTRIGGER:-PT0M\nACTION:DISPLAY\nDESCRIPTION:Reminder\nEND:VALARM\nEND:VEVENT\nEND:VCALENDAR";
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' }); const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Pathollekh_Reminder.ics'; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    document.getElementById('reminderBanner').style.display = 'none'; alert("ಅಲಾರಂ ಫೈಲ್ ಡೌನ್‌ಲೋಡ್ ಆಗಿದೆ. 'Save' ಒತ್ತಿದರೆ ರಿಮೈಂಡರ್ ಬರುತ್ತದೆ!");
}

function populateAcharyaDropdowns() {
    const selectModal = document.getElementById('acharyaSelect'); const selectFilter = document.getElementById('filterAcharya');
    for(let ach in acharyaPasswords) { selectModal.innerHTML += `<option value="${ach}">${ach}</option>`; selectFilter.innerHTML += `<option value="${ach}">${ach}</option>`; }
}

function fetchDataFromGoogleSheets() {
    fetch(GOOGLE_SCRIPT_URL).then(res => res.json()).then(data => {
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
    const now = new Date(); const todayStr = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0,5);
    let activeNotifs = fetchedNotifications.filter(n => {
        if (!n['StartDate'] || !n['EndDate']) return false;
        let sd = n['StartDate'].split('T')[0]; let ed = n['EndDate'].split('T')[0];
        if (todayStr >= sd && todayStr <= ed) {
            if (n['StartTime'] && n['EndTime']) {
                let st = n['StartTime'].split('T')[1].slice(0,5); let et = n['EndTime'].split('T')[1].slice(0,5);
                if (todayStr === sd && currentTime < st) return false;
                if (todayStr === ed && currentTime > et) return false;
            }
            return true;
        }
        return false;
    });
    const banner = document.getElementById('notificationBanner'); const marquee = document.getElementById('notificationText');
    if (activeNotifs.length > 0) {
        let msgStr = activeNotifs.map(n => `<span class="notif-item"><span class="notif-author">📢 ${n['Acharya']} :</span> ${n['Message']}</span>`).join(" ");
        marquee.innerHTML = msgStr; banner.style.display = "block";
    } else { banner.style.display = "none"; }
}

function submitNotification() {
    const msg = document.getElementById('notifMessage').value; const sDate = document.getElementById('notifStartDate').value; const eDate = document.getElementById('notifEndDate').value;
    const sTime = document.getElementById('notifStartTime').value; const eTime = document.getElementById('notifEndTime').value;
    if(!msg.trim() || !sDate || !eDate) return alert("ದಯವಿಟ್ಟು ಸಂದೇಶ ಮತ್ತು ದಿನಾಂಕವನ್ನು ನಮೂದಿಸಿ!");

    const formData = new URLSearchParams(); formData.append('action', 'addNotification'); formData.append('acharya', currentLoggedIn || "Admin"); formData.append('message', msg); formData.append('startDate', sDate); formData.append('endDate', eDate); formData.append('startTime', sTime); formData.append('endTime', eTime);
    const btn = document.getElementById('notifSubmitBtn'); const orig = btn.innerText; btn.innerText = "समर्प्यते..."; btn.disabled = true;

    fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData }).then(res => res.text()).then(data => {
        alert("सूचना योजिता! (Notification Added)"); document.getElementById('notifMessage').value = ""; btn.innerText = orig; btn.disabled = false;
        document.getElementById('addNotifModal').style.display = 'none'; fetchDataFromGoogleSheets();
    }).catch(err => { alert("दोषः जातः!"); btn.innerText = orig; btn.disabled = false; });
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
    document.getElementById('detailAttendance').innerText = att || "ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ"; document.getElementById('detailsModal').style.display = 'flex'; 
}

function getExpectedStudents(gana, subject, vibhaga, acharya) {
    if(gana === "इतरकार्यम्") return [];
    const isVeda = subject.includes('वेदः');
    if (isVeda) {
        const vedaGanaMatch = vedaAcharyaMapping[acharya];
        if(vedaGanaMatch) return studentsData.filter(s => s.vedapatha === vedaGanaMatch);
        return [];
    } else {
        return studentsData.filter(s => {
            if(s.gana !== gana) return false;
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
    document.getElementById('dashboardDateHeading').innerText = `समयसारिणी (${formattedHeading})`;

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
               yMap[log['गणः (Class/Gana)'] + '|' + log['समयः (Time)'].replace('-', '–') + '|' + log['आचार्यः (Acharya)']] = {desc: log['विवरणम् (Lesson Description)'], att: log['उपस्थिताः (Present)']};
            }
            yComp++; if(log['आचार्यः (Acharya)']) yAch.add(log['आचार्यः (Acharya)']);
        }
    });

    const times = ["06:30–07:55", "08:30–09:25", "11:00–11:55", "01:30–02:25", "02:30–03:25", "03:30–04:25", "06:30–07:25"];
    const ganas = ["तपः", "तेजः", "ओजः", "वर्चः", "प्रेयः", "श्रेयः", "भ्राजः", "यशः"];
    const tableGrid = {}; ganas.forEach(g => tableGrid[g] = {});
    
    for (const [ach, classes] of Object.entries(timetableData)) {
        classes.forEach(cls => {
            if(!tableGrid[cls.gana]) return; 
            let clsTime = cls.time.replace('-', '–');
            if(!tableGrid[cls.gana][clsTime]) tableGrid[cls.gana][clsTime] = [];
            tableGrid[cls.gana][clsTime].push({ach: ach, sub: cls.subject, vib: cls.vibhaga});
        });
    }

    let html = `<div class="table-wrapper"><table><thead><tr><th>गणः</th>`;
    times.forEach(t => html += `<th>${t}</th>`); html += `</tr></thead><tbody>`;
    
    let missedList = []; let absentTally = {};

    ganas.forEach(gana => {
        html += `<tr><th>${gana}</th>`;
        times.forEach(time => {
            const classes = tableGrid[gana][time];
            if(!classes || classes.length === 0) { html += `<td></td>`; }
            else if (classes.length === 1) {
                const cls = classes[0]; const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana');
                const key = gana + '|' + time + '|' + cls.ach;
                if(yMap[key]) { 
                    html += `<td class="cell-submitted ${vClass}" onclick="showDescModal('${cls.sub}', '${escapeQuotes(yMap[key].desc)}', '${escapeQuotes(yMap[key].att)}')"><div class="tooltip-text">${yMap[key].desc}</div>${cls.sub} <span class="acharya-name" style="color:#1B5E20; font-weight:bold;">${cls.ach}</span></td>`; 
                    let expected = getExpectedStudents(gana, cls.sub, cls.vib, cls.ach);
                    let presentStr = yMap[key].att || "";
                    expected.forEach(st => { if(!presentStr.includes(st.name)) { absentTally[st.name] = (absentTally[st.name] || 0) + 1; } });
                } else { 
                    html += `<td class="cell-unsubmitted ${vClass}">${cls.sub} <span class="acharya-name">${cls.ach}</span></td>`; 
                    missedList.push(`<b>${cls.ach}</b>: ${gana} (${cls.sub})`);
                }
            } else {
                html += `<td style="padding:0;"><div class="split-cell">`;
                classes.forEach((cls, idx) => {
                    const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana');
                    const btmBorder = idx === 0 ? 'split-top' : ''; const key = gana + '|' + time + '|' + cls.ach;
                    if(yMap[key]) { 
                        html += `<div class="${btmBorder} cell-submitted ${vClass}" style="padding:5px; height:100%;" onclick="showDescModal('${cls.sub}', '${escapeQuotes(yMap[key].desc)}', '${escapeQuotes(yMap[key].att)}')"><div class="tooltip-text">${yMap[key].desc}</div>${cls.sub} <span class="acharya-name" style="color:#1B5E20; font-weight:bold;">${cls.ach}</span></div>`; 
                        let expected = getExpectedStudents(gana, cls.sub, cls.vib, cls.ach);
                        let presentStr = yMap[key].att || "";
                        expected.forEach(st => { if(!presentStr.includes(st.name)) { absentTally[st.name] = (absentTally[st.name] || 0) + 1; } });
                    } else { 
                        html += `<div class="${btmBorder} cell-unsubmitted ${vClass}" style="padding:5px; height:100%;">${cls.sub} <span class="acharya-name">${cls.ach}</span></div>`; 
                        missedList.push(`<b>${cls.ach}</b>: ${gana} (${cls.sub})`);
                    }
                }); html += `</div></td>`;
            }
        }); html += `</tr>`;
    }); html += `</tbody></table></div>`;
    document.getElementById('yesterdayDataContainer').innerHTML = html;

    // --- NEW: Render Other Tasks (Kalah 1, 2, 3) as an Expandable Toggle ---
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

    // Lists
    if(missedList.length === 0) { missedUL.innerHTML = "<li style='color:green; font-weight:bold;'>सर्वे पाठाः सम्पन्नाः (All logs submitted)</li>"; } 
    else { missedUL.innerHTML = missedList.map(item => `<li>${item}</li>`).join(""); }

    let absentKeys = Object.keys(absentTally);
    if(absentKeys.length === 0) { absentUL.innerHTML = "<li style='color:green; font-weight:bold;'>सर्वे छात्राः उपस्थिताः (All students present)</li>"; } 
    else { absentKeys.sort((a,b) => absentTally[b] - absentTally[a]); absentUL.innerHTML = absentKeys.map(name => `<li><b>${name}</b> : ${absentTally[name]} वर्गेषु अनुपस्थितः</li>`).join(""); }

    // Analytics percentage
    let totDaily = 0; Object.values(timetableData).forEach(arr => { arr.forEach(c => { if(c.gana !== 'इतरकार्यम्') totDaily++; }); });
    const totAch = Object.keys(acharyaPasswords).length;
    let sPct = totDaily > 0 ? Math.round((yComp / totDaily) * 100) : 0;
    let pPct = totAch > 0 ? Math.round((yAch.size / totAch) * 100) : 0;
    if(sPct > 100) sPct = 100; if(pPct > 100) pPct = 100;
    document.getElementById('statSubmitted').innerText = translateNumbersToDevanagari(sPct) + "%"; document.getElementById('circleSubmitted').style.background = `conic-gradient(#4CAF50 ${sPct}%, #E8F5E9 0)`;
    document.getElementById('statPresent').innerText = translateNumbersToDevanagari(pPct) + "%"; document.getElementById('circlePresent').style.background = `conic-gradient(#0288D1 ${pPct}%, #E1F5FE 0)`;
    document.getElementById('statCompleted').innerText = translateNumbersToDevanagari(sPct) + "%"; document.getElementById('circleCompleted').style.background = `conic-gradient(#E65100 ${sPct}%, #FFF3E0 0)`;
}

function goToDashboard() { document.getElementById('mainTabs').style.display = 'flex'; switchView('dashboardView', document.getElementById('tabDashboard')); }
function switchView(viewId, btnElement) { document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active')); if(btnElement) { document.querySelectorAll('.btn-tab').forEach(el => el.classList.remove('active')); btnElement.classList.add('active'); } document.getElementById(viewId).classList.add('active'); }

function openLoginModal() { 
    if (currentLoggedIn) {
        switchView('entryFormSection', null);
        populateClassDropdown(currentLoggedIn, document.getElementById('dateInput').value);
        document.getElementById('attendanceSection').style.display = "none";
    } else {
        document.getElementById('loginModal').style.display = 'flex'; 
    }
}

function openAdminModal() { 
    if (isAdmin) { switchView('adminPanelView', null); } 
    else { document.getElementById('adminModal').style.display = 'flex'; }
}

function closeModals() { document.getElementById('adminModal').style.display = 'none'; document.getElementById('loginModal').style.display = 'none'; document.getElementById('adminPin').value = ''; document.getElementById('acharyaPin').value = ''; document.getElementById('acharyaSelect').value = ''; }

function verifyAdmin() {
    const pin = document.getElementById('adminPin').value;
    if(pin === '9999') { isAdmin = true; closeModals(); document.getElementById('mainTabs').style.display = 'none'; switchView('adminPanelView', null); }
    else { alert("असमीचीनः कूटशब्दः!"); }
}

function goToAdminEntry() {
    switchView('entryFormSection', null); document.getElementById('loggedInAcharya').innerText = "प्रबन्धक-व्यवस्था (Admin Mode)";
    document.getElementById('dateInput').removeAttribute('readonly'); document.getElementById('dateInput').value = new Date().toISOString().split('T')[0];
    document.getElementById('holidayBtn').style.display = 'block';
    populateAdminClassDropdown(document.getElementById('dateInput').value);
    checkFormHolidayState();
}

function getVocative(name) { if (name === "विष्णुः") return "विष्णो"; if (name === "सुब्रह्मण्य. आ.") return name; return name.replace(/ः$/, ''); }

function verifyAcharya() {
    const name = document.getElementById('acharyaSelect').value; const pin = document.getElementById('acharyaPin').value;
    if(!name) return alert("कृपया आचार्यं चिनोतु!");
    if(acharyaPasswords[name] === pin) {
        closeModals(); isAdmin = false; currentLoggedIn = name; document.getElementById('mainTabs').style.display = 'none';
        switchView('entryFormSection', null); document.getElementById('holidayBtn').style.display = 'none';
        document.getElementById('loggedInAcharya').innerText = "स्वागतम्, " + getVocative(name);
        document.getElementById('dateInput').value = new Date().toISOString().split('T')[0]; document.getElementById('dateInput').setAttribute('readonly', 'true');
        
        populateClassDropdown(name, document.getElementById('dateInput').value);
        checkFormHolidayState();
    } else { alert("असमीचीनः कूटशब्दः!"); }
}

function populateClassDropdown(acharyaName, dateStr) {
    const select = document.getElementById('classSelect');
    select.innerHTML = '<option value="">-- कक्षां चिनोतु --</option>';

    let submittedKeys = new Set();
    fetchedLogs.forEach(log => {
        if (log['दिनाङ्कः (Date)'] && log['दिनाङ्कः (Date)'].startsWith(dateStr) && log['आचार्यः (Acharya)'] === acharyaName && log['विषयः (Subject)'] !== "अनध्यायः") {
            const key = log['गणः (Class/Gana)'] + '|' + log['समयः (Time)'].replace('-', '–') + '|' + log['विषयः (Subject)'];
            submittedKeys.add(key);
        }
    });

    const classes = timetableData[acharyaName] || [];
    let total = classes.length;
    let submittedCount = 0;

    classes.forEach(cls => {
        const key = cls.gana + '|' + cls.time.replace('-', '–') + '|' + cls.subject;
        const isSubmitted = submittedKeys.has(key);
        if (isSubmitted) submittedCount++;

        const valStr = encodeURIComponent(JSON.stringify({acharya: acharyaName, gana: cls.gana, time: cls.time, subject: cls.subject, vibhaga: cls.vibhaga}));
        if (isSubmitted) {
            select.innerHTML += `<option value="${valStr}" disabled style="color: #9E9E9E; background: #EEEEEE;">✅ सम्पन्नम् (Submitted) - ${cls.gana} | ${cls.subject}</option>`;
        } else {
            select.innerHTML += `<option value="${valStr}" style="color: #D35400; font-weight:bold;">⏳ ${cls.gana} गणः | ${cls.time} | ${cls.subject} (${cls.vibhaga})</option>`;
        }
    });

    const statusDiv = document.getElementById('submissionStatus');
    if(statusDiv) {
        let pending = total - submittedCount;
        if(pending === 0 && total > 0) {
            statusDiv.innerHTML = `<span style="color:#2E7D32;">🎉 अभिनन्दनानि! अद्यतनाः सर्वे पाठाः सम्पन्नाः! (${total}/${total})</span>`;
        } else {
            statusDiv.innerHTML = `<span style="color:#2E7D32;">सम्पन्नाः (Done): ${submittedCount}</span> | <span style="color:#D35400;">अवशिष्टाः (Pending): ${pending}</span>`;
        }
    }
}

function populateAdminClassDropdown(dateStr) {
    const select = document.getElementById('classSelect');
    select.innerHTML = '<option value="">-- सर्वाः कक्षाः --</option>';
    let submittedKeys = new Set();
    fetchedLogs.forEach(log => {
        if (log['दिनाङ्कः (Date)'] && log['दिनाङ्कः (Date)'].startsWith(dateStr) && log['विषयः (Subject)'] !== "अनध्यायः") {
            const key = log['आचार्यः (Acharya)'] + '|' + log['गणः (Class/Gana)'] + '|' + log['समयः (Time)'].replace('-', '–') + '|' + log['विषयः (Subject)'];
            submittedKeys.add(key);
        }
    });

    for (const [achName, classes] of Object.entries(timetableData)) {
        classes.forEach(cls => {
            const key = achName + '|' + cls.gana + '|' + cls.time.replace('-', '–') + '|' + cls.subject;
            const valStr = encodeURIComponent(JSON.stringify({acharya: achName, gana: cls.gana, time: cls.time, subject: cls.subject, vibhaga: cls.vibhaga}));
            if(submittedKeys.has(key)) {
                 select.innerHTML += `<option value="${valStr}" disabled style="color: #9E9E9E; background: #EEEEEE;">✅ ${achName} - ${cls.gana} (${cls.subject})</option>`;
            } else {
                 select.innerHTML += `<option value="${valStr}">${achName} | ${cls.gana} | ${cls.time} | ${cls.subject}</option>`;
            }
        });
    }
    document.getElementById('submissionStatus').innerHTML = ""; 
}

function checkFormHolidayState() {
    const dateVal = document.getElementById('dateInput').value;
    const isHol = fetchedLogs.some(log => log['दिनाङ्कः (Date)'] && log['दिनाङ्कः (Date)'].startsWith(dateVal) && log['विषयः (Subject)'] === "अनध्यायः");
    const banner = document.getElementById('holidayBannerForm'); const submitBtn = document.getElementById('submitBtn');
    if(isHol && !isAdmin) { banner.style.display = "block"; banner.innerText = "अद्य अनध्यायः / विशेषकार्यक्रमः अस्ति। पाठोल्लेखः न शक्यते। (Holiday Declared)"; submitBtn.disabled = true; }
    else { banner.style.display = "none"; submitBtn.disabled = false; }
}

document.getElementById('dateInput').addEventListener('change', function() {
    checkFormHolidayState();
    const dateStr = this.value;
    if(isAdmin) { populateAdminClassDropdown(dateStr); } 
    else if(currentLoggedIn) { populateClassDropdown(currentLoggedIn, dateStr); }
    renderAttendanceChecklist();
});

function declareHoliday() {
    const dateVal = document.getElementById('dateInput').value;
    if(confirm(dateVal + " दिनाङ्के 'अनध्यायः' (Holiday) घोषणीयम् वा?")) { sendDataToSheet(dateVal, "ADMIN", "सर्वे", "-", "अनध्यायः", "विशेषकार्यक्रमः / अनध्यायः", "-"); }
}

function renderAttendanceChecklist() {
    const clsVal = document.getElementById('classSelect').value;
    const attSection = document.getElementById('attendanceSection');
    const attContainer = document.getElementById('attendanceContainer');
    
    if(!clsVal) { attSection.style.display = "none"; return; }
    const clsData = JSON.parse(decodeURIComponent(clsVal));
    if(clsData.gana === "इतरकार्यम्") { attSection.style.display = "none"; return; }
    
    attSection.style.display = "block";
    let filteredStudents = getExpectedStudents(clsData.gana, clsData.subject, clsData.vibhaga, clsData.acharya);

    if(filteredStudents.length === 0) { attContainer.innerHTML = "<span style='color:red;'>अस्मिन् वर्गे छात्राः न सन्ति।</span>"; return; }

    let html = `<div class="attendance-grid">`;
    filteredStudents.forEach(student => {
        html += `<div class="student-checkbox" onclick="toggleCheck('chk_${student.name}')">
                    <input type="checkbox" id="chk_${student.name}" value="${student.name}" class="att-checkbox" onclick="event.stopPropagation()">
                    <label for="chk_${student.name}" onclick="event.stopPropagation()">${student.name}</label>
                 </div>`;
    });
    html += `</div>`;
    attContainer.innerHTML = html;
}

function toggleCheck(id) { const cb = document.getElementById(id); cb.checked = !cb.checked; }

function submitLesson() {
    const clsVal = document.getElementById('classSelect').value; const desc = document.getElementById('descriptionInput').value; const dateVal = document.getElementById('dateInput').value;
    if(!clsVal) return alert("कृपया कक्षां चिनोतु!"); if(!desc.trim()) return alert("कृपया पाठस्य विवरणं लिखतु!");
    
    const clsData = JSON.parse(decodeURIComponent(clsVal));
    let presentStudents = [];
    if(clsData.gana !== "इतरकार्यम्") {
        const checkboxes = document.querySelectorAll('.att-checkbox');
        checkboxes.forEach(cb => { if(cb.checked) presentStudents.push(cb.value); });
    }
    const attendanceStr = presentStudents.join(", ");
    sendDataToSheet(dateVal, clsData.acharya, clsData.gana, clsData.time, clsData.subject, desc, attendanceStr);
}

function sendDataToSheet(date, acharya, gana, time, subject, description, attendance) {
    const formData = new URLSearchParams(); formData.append('action', 'addLog'); formData.append('date', date); formData.append('acharya', acharya); formData.append('gana', gana); formData.append('time', time); formData.append('subject', subject); formData.append('description', description); formData.append('attendance', attendance || "-");
    const btn = document.getElementById('submitBtn'); const origText = btn.innerText; btn.innerText = "समर्प्यते..."; btn.disabled = true;
    fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData }).then(res => res.text()).then(data => { alert("सफलम्! (Success)"); document.getElementById('descriptionInput').value = ""; document.getElementById('attendanceSection').style.display="none"; btn.innerText = origText; btn.disabled = false; fetchDataFromGoogleSheets(); goToDashboard(); }).catch(err => { alert("दोषः जातः!"); btn.innerText = origText; btn.disabled = false; });
}

function deleteRecord(actionType, rowIdx) {
    if(!confirm("ಖಚಿತವಾಗಿಯೂ ಈ ಮಾಹಿತಿಯನ್ನು अಳಿಸಬೇಕೇ? (Are you sure you want to delete this?)")) return;
    const formData = new URLSearchParams(); formData.append('action', actionType); formData.append('rowIdx', rowIdx);
    fetch(GOOGLE_SCRIPT_URL, { method: "POST", body: formData }).then(res => res.text()).then(data => {
        alert("ಅಳಿಸಲಾಗಿದೆ! (Deleted Successfully)"); fetchDataFromGoogleSheets();
        if(actionType === 'deleteLog') generateReport(); 
        if(actionType === 'deleteNotification') renderAdminNotifications();
    }).catch(err => alert("दोषः जातः!"));
}

function generateReport() {
    document.getElementById('reportHeaderTitle').innerText = "वेदविज्ञानगुरुकुलम् - पाठोल्लेख-वरदिः";
    const fromDate = document.getElementById('filterFrom').value; const toDate = document.getElementById('filterTo').value; const acharya = document.getElementById('filterAcharya').value; const gana = document.getElementById('filterGana').value; 
    const studentName = document.getElementById('filterStudent') ? document.getElementById('filterStudent').value.trim().toLowerCase() : "";

    if(!fromDate || !toDate) return alert("Please select a date range!");
    let filtered = fetchedLogs.filter(log => {
        if(!log['दिनाङ्कः (Date)']) return false; const logDate = log['दिनाङ्कः (Date)'].split('T')[0];
        if (logDate < fromDate || logDate > toDate) return false; 
        if (acharya && log['आचार्यः (Acharya)'] !== acharya) return false; 
        if (gana && log['गणः (Class/Gana)'] !== gana) return false; 
        if (studentName) { let att = log['उपस्थिताः (Present)'] || ""; if(!att.toLowerCase().includes(studentName)) return false; }
        return true;
    });
    
    if(filtered.length === 0) return alert("No data found for this filter!");
    let metaText = `दिनाङ्कः: ${fromDate} तः ${toDate} पर्यन्तम्`; if(acharya) metaText += ` | आचार्यः: ${acharya}`; if(gana) metaText += ` | गणः: ${gana}`; document.getElementById('reportMetaText').innerText = metaText;
    
    let tableHtml = `<tr><th>दिनाङ्कः</th><th>आचार्यः</th><th>गणः</th><th>समयः</th><th>विषयः</th><th>विवरणम्</th><th>उपस्थिताः</th><th>Action</th></tr>`;
    filtered.forEach(row => { 
        let dStr = row['दिनाङ्कः (Date)'].split('T')[0]; 
        tableHtml += `<tr><td>${dStr}</td><td style="color:#D35400; font-weight:bold;">${row['आचार्यः (Acharya)'] || ''}</td><td>${row['गणः (Class/Gana)'] || ''}</td><td>${row['समयः (Time)'] || ''}</td><td style="color:#2E7D32;">${row['विषयः (Subject)'] || ''}</td><td>${row['विवरणम् (Lesson Description)'] || ''}</td><td style="font-size:0.8rem; color:#555;">${row['उपस्थिताः (Present)'] || ''}</td><td><button class="btn-primary btn-danger" style="padding: 5px 10px; font-size:0.8rem; margin:0;" onclick="deleteRecord('deleteLog', ${row.rowIdx})">Delete</button></td></tr>`; 
    });
    document.getElementById('reportTableBody').innerHTML = tableHtml; document.getElementById('reportSnapshotArea').style.display = 'block'; document.getElementById('downloadPhotoBtnDiv').style.display = 'block';
}

function renderAdminNotifications() {
    document.getElementById('reportHeaderTitle').innerText = "वेदविज्ञानगुरुकुलम् - सक्रियाः सूचनाः (Notifications)"; document.getElementById('reportMetaText').innerText = "All Active & Past Notifications";
    if(fetchedNotifications.length === 0) return alert("No Notifications found!");
    let tableHtml = `<tr><th>Timestamp</th><th>आचार्यः</th><th>Message</th><th>Start Date</th><th>End Date</th><th>Action</th></tr>`;
    fetchedNotifications.forEach(row => { 
        let sDate = row['StartDate'] ? row['StartDate'].split('T')[0] : ''; let eDate = row['EndDate'] ? row['EndDate'].split('T')[0] : '';
        tableHtml += `<tr><td>${row['Timestamp'] ? row['Timestamp'].split('T')[0] : ''}</td><td style="color:#D35400; font-weight:bold;">${row['Acharya'] || ''}</td><td>${row['Message'] || ''}</td><td>${sDate}</td><td>${eDate}</td><td><button class="btn-primary btn-danger" style="padding: 5px 10px; font-size:0.8rem; margin:0;" onclick="deleteRecord('deleteNotification', ${row.rowIdx})">Delete</button></td></tr>`; 
    });
    document.getElementById('reportTableBody').innerHTML = tableHtml; document.getElementById('reportSnapshotArea').style.display = 'block'; document.getElementById('downloadPhotoBtnDiv').style.display = 'none';
}

function downloadAsPhoto() { 
    const rows = document.querySelectorAll('#reportTableBody tr'); rows.forEach(row => row.lastElementChild.style.display = 'none');
    html2canvas(document.getElementById('reportSnapshotArea'), { backgroundColor: "#FFFFFF", scale: 2 }).then(canvas => { const link = document.createElement('a'); link.download = 'Pathollekh_Report.png'; link.href = canvas.toDataURL('image/png'); link.click(); rows.forEach(row => row.lastElementChild.style.display = ''); }); 
}

function downloadFilteredCSV() {
    const fromDate = document.getElementById('filterFrom').value; const toDate = document.getElementById('filterTo').value; const acharya = document.getElementById('filterAcharya').value; const gana = document.getElementById('filterGana').value; const studentName = document.getElementById('filterStudent') ? document.getElementById('filterStudent').value.trim().toLowerCase() : "";
    let filtered = fetchedLogs.filter(log => { if(!log['दिनाङ्कः (Date)']) return false; const logDate = log['दिनाङ्कः (Date)'].split('T')[0]; if (logDate < fromDate || logDate > toDate) return false; if (acharya && log['आचार्यः (Acharya)'] !== acharya) return false; if (gana && log['गणः (Class/Gana)'] !== gana) return false; if (studentName) { let att = log['उपस्थिताः (Present)'] || ""; if(!att.toLowerCase().includes(studentName)) return false; } return true; });
    const headers = ["दिनाङ्कः (Date)", "आचार्यः (Acharya)", "गणः (Class/Gana)", "समयः (Time)", "विषयः (Subject)", "विवरणम् (Lesson Description)", "उपस्थिताः (Present)"];
    let csvContent = headers.join(",") + "\n";
    filtered.forEach(row => { let rowData = headers.map(h => `"${(row[h] || "").toString().replace(/"/g, '""')}"`); csvContent += rowData.join(",") + "\n"; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.setAttribute("href", url); link.setAttribute("download", `Pathollekh_${fromDate}_to_${toDate}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function renderYearlyTimetable() {
    const times = ["06:30–07:55", "08:30–09:25", "11:00–11:55", "01:30–02:25", "02:30–03:25", "03:30–04:25", "06:30–07:25"];
    const ganas = ["तपः", "तेजः", "ओजः", "वर्चः", "प्रेयः", "श्रेयः", "भ्राजः", "यशः"];
    const tableGrid = {}; ganas.forEach(g => tableGrid[g] = {});
    for (const [ach, classes] of Object.entries(timetableData)) {
        classes.forEach(cls => { if(!tableGrid[cls.gana]) return; let clsTime = cls.time.replace('-', '–'); if(!tableGrid[cls.gana][clsTime]) tableGrid[cls.gana][clsTime] = []; tableGrid[cls.gana][clsTime].push({ach: ach, sub: cls.subject, vib: cls.vibhaga}); });
    }
    let html = `<table><thead><tr><th>गणः</th>`; times.forEach(t => html += `<th>${t}</th>`); html += `</tr></thead><tbody>`;
    ganas.forEach(gana => {
        html += `<tr><th>${gana}</th>`;
        times.forEach(time => {
            const classes = tableGrid[gana][time];
            if(!classes || classes.length === 0) { html += `<td></td>`; }
            else if (classes.length === 1) { const cls = classes[0]; const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana'); html += `<td class="${vClass}">${cls.sub} <span class="acharya-name">${cls.ach}</span></td>`; }
            else {
                html += `<td style="padding:0;"><div class="split-cell">`;
                classes.forEach((cls, idx) => { const vClass = cls.vib === 'सामान्य' ? 'samanya' : (cls.vib === 'वेदान्त' ? 'vedanta' : 'vyakarana'); const btmBorder = idx === 0 ? 'split-top' : ''; html += `<div class="${btmBorder} ${vClass}" style="padding:5px;">${cls.sub} <span class="acharya-name">${cls.ach}</span></div>`; });
                html += `</div></td>`;
            }
        }); html += `</tr>`;
    }); html += `</tbody></table>`;
    document.getElementById('yearlyTableContainer').innerHTML = html;
}

function logout() { currentLoggedIn = ""; isAdmin = false; document.getElementById('descriptionInput').value = ""; document.getElementById('attendanceSection').style.display="none"; goToDashboard(); }