/* =========================================================
   CONFIG
========================================================= */
const API_URL =
"https://script.google.com/macros/s/AKfycbwo9WvDXsXPOSyceb8qA9szcqzcBaBhndQKsK_0vs1AYiuoUJ8DwKgEJJXNrAaoaNgEvg/exec";

/* =========================================================
   HELPERS
========================================================= */
const qid = id => document.getElementById(id);
const qs  = sel => document.querySelector(sel);

function populateSelect(id, list) {
  const sel = qid(id);
  if (!sel) return;

  sel.innerHTML = `<option value="">Select</option>`;
  [...new Set(list || [])]
    .filter(v => v && v.toString().trim() !== "")
    .sort((a,b)=>a.toString().localeCompare(b.toString()))
    .forEach(v => sel.add(new Option(v, v)));
}

function formatDateISO(d) {
  return d ? new Date(d).toISOString().split("T")[0] : "";
}

/* =========================================================
   EMAIL LOGIN (LOCAL STORAGE)
========================================================= */
async function ensureUserEmail() {
  let email = localStorage.getItem("loggedEmail");

  if (!email) {
    email = prompt("Enter your official email:");
    if (!email) throw new Error("Email required");
    localStorage.setItem("loggedEmail", email.trim().toLowerCase());
  }

  window.LOGGED_EMAIL = email.trim().toLowerCase();
}

/* =========================================================
   PERMISSION CHECK
========================================================= */
async function checkMissedPermission() {
  try {
    const res = await fetch(
      `${API_URL}?action=check_missed_permission&email=${encodeURIComponent(window.LOGGED_EMAIL)}`
    );
    const data = await res.json();

    if (!data.authorized) {
      const btn = qid("missedSubmitBtn");
      if (btn) btn.disabled = true;
      alert("You are NOT authorized for Missed Entry.");
    }
  } catch (err) {
    console.error(err);
  }
}

/* =========================================================
   BOOT
========================================================= */
window.addEventListener("DOMContentLoaded", async () => {

  await ensureUserEmail();
  await checkMissedPermission();

  qid("loginScreen")?.remove();
  qid("appRoot").style.display = "block";

  bindForms();
  loadDashboard();
  refreshRoutineDropdowns();
  loadPendingMakeup();

  qid("pendingTeacherSearch")
    ?.addEventListener("input", filterPendingTable);
});

/* =========================================================
   ROLE BASED UI
========================================================= */
const roleSelect = qid("roleSelect");
const controlPanel = qid("controlPanel");
const dashboardSection = document.querySelector(".dashboard");

qid("roleOffice").onclick = () => {
  roleSelect.classList.add("hidden");
  controlPanel.classList.remove("hidden");
  showDashboard();
  showButtons(["btn-missed","btnBackRole"]);
};

qid("roleFaculty").onclick = () => {
  roleSelect.classList.add("hidden");
  controlPanel.classList.remove("hidden");
  showDashboard();
  showButtons(["btn-makeup","btn_pending","btn_empty","btnBackRole"]);
};

qid("btnBackRole").onclick = () => {
  controlPanel.classList.add("hidden");
  roleSelect.classList.remove("hidden");
  hideAllSections();
};

function showButtons(list){
  ["btn-missed","btn-makeup","btn_pending","btn_empty","btnBackRole"]
    .forEach(id=>{
      const b = qid(id);
      if(b) b.style.display = list.includes(id) ? "inline-block" : "none";
    });
}

function hideAllSections(){
  dashboardSection.style.display = "none";
  qid("missedForm").classList.add("hidden");
  qid("makeupForm").classList.add("hidden");
  qid("pendingSection").classList.add("hidden");
  qid("emptyRoomSection").classList.add("hidden");
}

function showDashboard(){
  hideAllSections();
  dashboardSection.style.display = "grid";
}

/* =========================================================
   DASHBOARD
========================================================= */
function loadDashboard(){
  fetch(`${API_URL}?action=get_dashboard`)
    .then(r=>r.json())
    .then(d=>{
      if(d.status!=="success") return;
      qid("totalMissed").textContent = d.totalMissed||0;
      qid("completed").textContent = d.completed||0;
      qid("pending").textContent = d.pending||0;
      qid("extraCount").textContent = d.extra||0;
    })
    .catch(console.error);
}

/* =========================================================
   ROUTINE DROPDOWNS
========================================================= */
async function refreshRoutineDropdowns(){
  try{
    const res = await fetch(`${API_URL}?action=get_routine_master`);
    const d = await res.json();
    if(d.status!=="success") return;

    populateSelect("m_time", d.times);
    populateSelect("m_room", d.rooms);
    populateSelect("m_course", d.courses);
    populateSelect("m_teacher", d.teachers);

    populateSelect("k_time", d.times);
    populateSelect("k_room", d.rooms);
    populateSelect("k_course", d.courses);
    populateSelect("k_teacher", d.teachers);

  }catch(e){ console.error(e); }
}

/* =========================================================
   FORM BINDING
========================================================= */
function bindForms(){
  qid("missedForm")?.addEventListener("submit", submitMissed);
  qid("makeupForm")?.addEventListener("submit", submitMakeup);
}

/* =========================================================
   SAVE MISSED
========================================================= */
async function submitMissed(e){
  e.preventDefault();

  const payload = new URLSearchParams({
    action:"save_missed",
    email:window.LOGGED_EMAIL,
    date:formatDateISO(qid("m_date").value),
    department:qid("m_dept").value,
    course:qid("m_course").value,
    room:qid("m_room").value,
    timeSlot:qid("m_time").value,
    teacherInitial:qid("m_teacher").value,
    reason:qid("m_reason").value
  });

  const res = await fetch(API_URL,{method:"POST",body:payload})
    .then(r=>r.json());

  if(res.status==="success"){
    alert("Missed class saved.");
    e.target.reset();
    loadDashboard();
  }else{
    alert(res.message||"Failed");
  }
}

/* =========================================================
   SAVE MAKEUP (FIXED — NO PAGE RELOAD)
========================================================= */
async function submitMakeup(e){
  e.preventDefault();

  const btn = e.target.querySelector("button[type='submit']");
  btn.disabled = true;
  btn.textContent = "Saving...";

  const payload = new URLSearchParams({
    action:"save_makeup",
    scheduleDate:qid("k_schedule").value,
    department:qid("k_dept").value,
    course:qid("k_course").value,
    teacherInitial:qid("k_teacher").value,
    makeupDate:qid("k_date").value,
    makeupTime:qid("k_time").value,
    makeupRoom:qid("k_room").value,
    status:qid("k_status").value,
    remarks:qid("k_remarks").value
  });

  try{
    const res = await fetch(API_URL,{method:"POST",body:payload})
      .then(r=>r.json());

    if(res.status==="success"){
      alert(res.message);
      e.target.reset();
      loadDashboard();
      loadPendingMakeup();
    }else{
      alert(res.message||"Failed to save");
    }

  }catch(err){
    console.error(err);
    alert("Server error.");
  }

  btn.disabled=false;
  btn.textContent="Save Makeup Class";
}

/* =========================================================
   PENDING LIST
========================================================= */
function loadPendingMakeup(){
  fetch(`${API_URL}?action=get_pending_makeup`)
    .then(r=>r.json())
    .then(res=>{
      const tbody = qs("#pendingTable tbody");
      if(!tbody) return;
      tbody.innerHTML="";

      if(!res.data?.length){
        tbody.innerHTML=`<tr><td colspan="9">No pending classes</td></tr>`;
        return;
      }

      res.data.forEach(r=>{
        tbody.insertAdjacentHTML("beforeend",`
<tr id="row_${r.row}">
<td>${r.scheduleDate}</td>
<td>${r.department}</td>
<td>${r.course}</td>
<td>${r.teacher}</td>
<td>${r.makeupDate}</td>
<td>${r.makeupTime}</td>
<td>${r.makeupRoom}</td>
<td>
<select id="status_${r.row}">
<option value="Pending" selected>Pending</option>
<option value="Completed">Completed</option>
</select>
</td>
<td>
<input id="remarks_${r.row}" value="${r.remarks||""}">
<button onclick="updateMakeup(${r.row})">Update</button>
</td>
</tr>`);
      });
    });
}

function updateMakeup(row){
  const status=qid(`status_${row}`).value;
  const remarks=qid(`remarks_${row}`).value;

  fetch(`${API_URL}?action=update_makeup&row=${row}&status=${status}&remarks=${encodeURIComponent(remarks)}`)
    .then(r=>r.json())
    .then(res=>{
      if(res.status==="success"){
        alert("Updated.");
        loadPendingMakeup();
        loadDashboard();
      }else alert("Update failed");
    });
}

function filterPendingTable(){
  const term=qid("pendingTeacherSearch").value.toLowerCase();
  document.querySelectorAll("#pendingTable tbody tr")
    .forEach(r=>{
      r.style.display=r.innerText.toLowerCase().includes(term)?"":"none";
    });
}

/* =========================================================
   EMPTY ROOMS
========================================================= */
function loadEmptyRooms(){
  fetch(`${API_URL}?action=get_empty_rooms`)
    .then(r=>r.json())
    .then(res=>{
      const tbody=qs("#emptyRoomTable tbody");
      tbody.innerHTML="";

      if(!res.data?.length){
        tbody.innerHTML=`<tr><td colspan="4">No empty rooms</td></tr>`;
        return;
      }

      res.data.forEach(r=>{
        tbody.insertAdjacentHTML("beforeend",`
<tr>
<td>${r.day}</td>
<td>${r.time}</td>
<td>${r.room}</td>
<td>
<button onclick="autoFillMakeup('${r.day}','${r.time}','${r.room}')">
Book
</button>
</td>
</tr>`);
      });
    });
}

function searchEmptyRooms(){
  const term=qid("emptyRoomSearch").value.toLowerCase();
  qs("#emptyRoomTable tbody")
    .querySelectorAll("tr")
    .forEach(r=>{
      r.style.display=r.innerText.toLowerCase().includes(term)?"":"none";
    });
}

function autoFillMakeup(day,time,room){
  qid("k_time").value=time;
  qid("k_room").value=room;
  alert(`Selected: ${day} | ${time} | ${room}`);
}


