(()=>{const e=e=>document.getElementById(e),t=[...document.querySelectorAll("[data-manager-panel]")],a=[...document.querySelectorAll("[data-manager-go]")],n={fieldvisits:["Field Visits","Complete client visits and collect signatures securely."],applicants:["Applicants","Review submitted applications and job-related qualifications."],authorizations:["Authorizations","Track expiration dates and payer renewal follow-up."],overview:["Home","Your next actions and workforce activity."],accounts:["Caregivers","Find a caregiver and review their records."],applications:["Applications","Review each application, one step at a time."],opportunities:["Opportunities","Prepare and publish openings for your next great caregiver."],access:["Settings & access","Keep the right people connected to the right work."]};let r=null,o=0;const i=e=>r?.grant.permissions.includes(e);
const s = view => {
  const role = r?.grant.role;
  switch (view) {
    case 'overview': return r?.grant.active !== false;
    case 'fieldvisits': return i('field_visits.manage');
    case 'applicants': return i('applicants.review');
    case 'authorizations': return i('authorizations.manage');
    case 'accounts': return i('accounts.support');
    case 'applications': return i('applications.review');
    case 'opportunities': return i('opportunities.read');
    case 'access': return role === 'owner' && i('staff.manage') || role === 'office_manager' && i('staff.review');
    default: return false;
  }
};
  const teamReview = e('staff-team-review');
  const teamStatus = e('staff-team-review-status');
  const teamList = e('staff-team-review-list');
  async function reviewTeam() {
    const sequence = o;
    teamStatus.textContent = 'Loading team access…';
    try {
      const { items, limitPerOffice } = await window.workforceApi('/staff/team');
      if (sequence !== o) return;
      teamList.replaceChildren(...items.map(member => {
        const entry = document.createElement('li');
        const role = member.role.replaceAll('_', ' ');
        entry.textContent = [member.email, role, member.active ? 'Active' : 'Inactive',
          member.offices.join(', '), member.permissions.join(', ')].join(' · ');
        return entry;
      }));
      teamStatus.textContent = items.length
        ? 'Showing up to ' + limitPerOffice + ' staff accounts per assigned office.'
        : 'No staff accounts found for your assigned offices.';
    } catch (error) {
      if (sequence === o) teamStatus.textContent = error.message;
    }
  }
function c(a,writeHistory=true){if(!r||!n[a]||!s(a))return!1;
document.body?.classList.remove("manager-record-focus");
window.WorkforcePersonnel?.cancelRecordRequests?.();
if(writeHistory)window.WorkforceStaffNavigation?.set(a);
window.WorkforceFieldVisits?.show(a);window.WorkforceOfficeTools?.show(a);
if (a === 'access' && r.grant.role === 'office_manager') reviewTeam();
if (a === 'accounts' && writeHistory) Promise.resolve().then(() => window.WorkforcePersonnel?.browse());
for(const e of t)e.hidden=e.dataset.managerPanel!==a;e("manager-page-actions").hidden="overview"!==a;for(const e of document.querySelectorAll("[data-manager-view]"))e.setAttribute("aria-current",e.dataset.managerView===a?"page":"false");return e("manager-title").textContent=n[a][0],e("manager-subtitle").textContent=n[a][1],e("manager-breadcrumb").textContent=n[a][0],document.title=n[a][0]+" | Primetime Workforce",e("manager-title").focus({preventScroll:!0}),!0}window.WorkforceManagement={show:c};for(const t of a)t.addEventListener("click",()=>{const a=t.dataset.managerGo;c(a)&&("opportunities"===a?(e("staff-search").value="",e("staff-filter").value=t.dataset.managerFilter||"",e("staff-filter").dispatchEvent(new Event("change"))):"applications"===a&&(e("personnel-filter").value=t.dataset.managerFilter||"",e("personnel-filter").dispatchEvent(new Event("change"))))});function l(t,a){const n=Array.isArray(a?.items),o=e=>n?String(a.items.filter(t=>t.state===e).length):"—";if("applications"===t)e("manager-count-applications").textContent=o("submitted");else for(const t of["draft","review","approved","published"]){e("manager-pipeline-"+t).textContent=o(t);const a=e("manager-count-"+t);a&&(a.textContent=o(t))}e("manager-"+t+"-coverage").textContent=r?WorkforceContract.listCoverage(a,r.grant.offices.length,"applications"===t?"Applications":"Opportunities"):""}e("manager-refresh").onclick=async()=>{const t=e("manager-refresh"),a=o;t.disabled=!0;try{await Promise.allSettled([i("opportunities.read")?window.WorkforceRecruiting?.refresh():Promise.resolve(),s("applications")?window.WorkforcePersonnel?.refresh():Promise.resolve()])}finally{a===o&&(t.disabled=!1)}},e("manager-new").onclick=()=>{c("opportunities")&&e("staff-new").click()},document.addEventListener("workforce-opportunities-updated",e=>{r&&s("opportunities")&&l("opportunities",e.detail)}),document.addEventListener("workforce-applications-updated",e=>{r&&s("applications")&&l("applications",e.detail)}),document.addEventListener("workforce-session-cleared",()=>{teamReview.hidden = true; teamList.replaceChildren(); teamStatus.textContent = '';
o++,r=null,e("manager-nav").hidden=!0,e("manager-page-actions").hidden=!0,e("manager-login-card").hidden=!1;for(const e of t)e.hidden=!0;l("applications",null),l("opportunities",null),e("manager-refresh").disabled=!1,e("manager-title").textContent="Workforce management",e("manager-subtitle").textContent="Sign in to your team’s workspace.",e("manager-breadcrumb").textContent="Workforce",e("manager-scope").textContent="Staff workspace",e("manager-scope").title=""}),document.addEventListener("workforce-session",t=>{o++,r=t.detail,e("manager-nav").hidden=!1,e("manager-page-actions").hidden=!1,e("manager-login-card").hidden=!0,e("session-status").textContent="",e("manager-refresh").disabled=!1,l("applications",{state:"loading"}),l("opportunities",{state:"loading"}),e("manager-scope").textContent=r.grant.offices.length+" assigned "+(1===r.grant.offices.length?"office":"offices"),e("manager-scope").title=r.grant.offices.join(", ");for(const e of a)e.hidden=!s(e.dataset.managerGo);for(const e of document.querySelectorAll("[data-manager-feature]"))e.hidden=!s(e.dataset.managerFeature);e("manager-new").hidden=!i("opportunities.edit"),e("manager-application-stat").hidden=!s("applications"),e("staff-editor-panel").hidden=!i("opportunities.edit"),teamReview.hidden = !(r.grant.role === 'office_manager' && i('staff.review'));
e('manager-owner-links').hidden = r.grant.role !== 'owner';
e('staff-training-replay').hidden = !['owner', 'office_manager'].includes(r.grant.role);
const landing = ['overview', 'accounts', 'applications', 'opportunities', 'access'].find(s);
if (landing) c(landing,false);
else {
  e('manager-page-actions').hidden = true;
  e('session-status').textContent = 'No workspace tools are assigned to your account.';
}
})})();
