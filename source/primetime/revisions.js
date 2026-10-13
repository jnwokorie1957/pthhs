(() => {
  'use strict';
  const sourceId = value => typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value);
  const short = (value, limit = 1000) => typeof value === 'string' && value.length <= limit ? value : null;
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const human = value => String(value || 'unknown').replace(/_/g, ' ');
  function validDay(value) {
    return typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  }
  function normalizeStatus(payload) {
    if (payload?.ok !== true || payload.mode !== 'live' || typeof payload.dataApproved !== 'boolean' || payload.sourceWritesEnabled !== false
      || payload.officeId !== null && !sourceId(payload.officeId) || !payload.capabilities || ['diagnosis', 'records', 'monitoring', 'sms'].some(key => typeof payload.capabilities[key] !== 'boolean')) throw new Error('invalid_revision_status');
    return { officeId: payload.officeId, workspaceScope: payload.workspaceScope, dataApproved: payload.dataApproved, capabilities: { ...payload.capabilities },
      earlyReminderConfigured: payload.earlyReminderConfigured === true, blockedReason: short(payload.blockedReason),
      sourceAcceptance: payload.sourceAcceptance ? { version: short(payload.sourceAcceptance.version, 128), reference: short(payload.sourceAcceptance.reference, 500), validUntil: short(payload.sourceAcceptance.validUntil, 40) } : null };
  }
  function normalizeVisits(payload, expected) {
    if (payload?.ok !== true || payload.mode !== 'live' || payload.source !== 'hhaexchange' || payload.scope?.officeId !== expected.officeId
      || payload.scope?.date !== expected.date || !short(payload.scope.timezone, 128) || !Array.isArray(payload.items) || payload.items.length > 10
      || payload.completeness?.complete !== false || !/^[a-f0-9]{64}$/.test(payload.discovery || '')
      || payload.nextOffset !== null && (!Number.isInteger(payload.nextOffset) || payload.nextOffset <= expected.offset || payload.nextOffset >= 200)) throw new Error('invalid_revision_visits');
    const items = payload.items.map(item => {
      const evidence = item?.evidence, diagnosis = item?.diagnosis;
      if (!sourceId(evidence?.visitId) || !['ready', 'unavailable', 'unaccepted', 'stale', 'incomplete', 'failed'].includes(evidence.state)
        || evidence.scope?.officeId !== expected.officeId || evidence.scope?.date !== expected.date || evidence.scope?.timezone !== payload.scope.timezone
        || diagnosis?.visitId !== evidence.visitId || diagnosis.scope?.officeId !== expected.officeId || diagnosis.scope?.date !== expected.date
        || !['ready', 'unknown'].includes(diagnosis?.state) || !['blocked', 'verified', 'unverified', 'unknown'].includes(diagnosis.verification)
        || diagnosis.sourceMutationPermitted !== false || !Array.isArray(diagnosis.issues) || diagnosis.issues.length > 40
        || diagnosis.verification === 'verified' && (evidence.state !== 'ready' || diagnosis.state !== 'ready')
        || evidence.patientId !== null && evidence.patientId !== undefined && !sourceId(evidence.patientId)
        || evidence.caregiverId !== null && evidence.caregiverId !== undefined && !sourceId(evidence.caregiverId)) throw new Error('invalid_revision_visits');
      const times = Object.fromEntries(['scheduledStart', 'scheduledEnd', 'actualStart', 'actualEnd', 'evvStart', 'evvEnd'].map(key => [key, evidence.times?.[key] ? { raw: short(evidence.times[key].raw, 128), iso: short(evidence.times[key].iso, 40) } : null]));
      const issues = diagnosis.issues.map(issue => {
        if (!['blocker', 'review', 'information', 'unknown'].includes(issue?.level) || !short(issue.summary, 2000) || !Array.isArray(issue.reasonCodeCandidates) || issue.reasonCodeCandidates.some(code => !['110A', '110D'].includes(code))) throw new Error('invalid_revision_visits');
        return { id: short(issue.id, 128), kind: short(issue.kind, 128), level: issue.level, summary: issue.summary, nextAction: short(issue.nextAction, 2000),
          reasonCodeCandidates: issue.reasonCodeCandidates.slice(0, 2), suggestedNote: short(issue.suggestedNote, 2000),
          facts: Object.entries(issue.facts || {}).slice(0, 30).filter(([key, value]) => short(key, 128) && (value === null || short(value, 1000) !== null || number(value) !== null)) };
      });
      return { evidence: { visitId: evidence.visitId, state: evidence.state, patientId: evidence.patientId || null, caregiverId: evidence.caregiverId || null, times,
        rawTimes: Object.fromEntries(['ScheduleStartTime', 'ScheduleEndTime', 'VisitStartTime', 'VisitEndTime', 'EVVStartTime', 'EVVEndTime'].map(key => [key, short(evidence.raw?.[key], 128)])),
        reasons: Array.isArray(evidence.reasons) ? evidence.reasons.map(value => short(value)).filter(Boolean).slice(0, 30) : [],
        provenance: evidence.provenance ? { operation: short(evidence.provenance.operation, 128), fetchedAt: short(evidence.provenance.fetchedAt, 40), sourceRevision: short(evidence.provenance.sourceRevision, 128), acceptanceVersion: short(evidence.provenance.acceptanceVersion, 128) } : null },
      diagnosis: { state: diagnosis.state, verification: diagnosis.verification, issues, metrics: Object.fromEntries(['scheduledMinutes', 'actualMinutes', 'evvMinutes', 'varianceMinutes'].map(key => [key, number(diagnosis.metrics?.[key])])) } };
    });
    if (new Set(items.map(item => item.evidence.visitId)).size !== items.length) throw new Error('invalid_revision_visits');
    return { items, scope: { ...payload.scope }, evaluatedAt: short(payload.evaluatedAt, 40), nextOffset: payload.nextOffset, discovery: payload.discovery, truncated: payload.completeness.truncated === true };
  }
  function normalizeRecords(payload, kind, officeId) {
    if (payload?.ok !== true || payload.mode !== 'live' || payload.source !== 'primetime' || !Array.isArray(payload.items) || payload.items.length > 100
      || payload.nextCursor !== null && !short(payload.nextCursor, 4096)) throw new Error('invalid_revision_records');
    const items = payload.items.map(item => {
      if (!short(item?.id, 128) || !/^[A-Za-z0-9_-]+$/.test(item.id) || item.id.startsWith('DEMO-') || item.officeId !== officeId || !Number.isInteger(item.revision) || item.revision < 1) throw new Error('invalid_revision_records');
      const base = { id: item.id, officeId, revision: item.revision };
      if (kind === 'requirements') {
        if (!['supervisory_visit', 'initial_orientation', 'recurring_orientation'].includes(item.type) || !['member', 'caregiver'].includes(item.subject?.kind) || !sourceId(item.subject.id)
          || !Array.isArray(item.completions) || item.completions.length > 100 || !['not_configured', 'upcoming', 'due', 'overdue', 'completed', 'evidence_under_review', 'outside_effective_period'].includes(item.status)) throw new Error('invalid_revision_records');
        return { ...base, type: item.type, subject: { ...item.subject }, status: item.status, nextDueDate: short(item.nextDueDate, 10), program: short(item.program, 128), service: short(item.service, 128), assignedSupervisor: short(item.assignedSupervisor, 128), ruleReference: short(item.ruleReference, 500), cadenceMonths: number(item.cadenceMonths),
          completions: item.completions.map(completion => {
            if (!short(completion.id, 128) || !['pending_review', 'accepted', 'rejected'].includes(completion.reviewState)) throw new Error('invalid_revision_records');
            return { id: completion.id, completedOn: short(completion.completedOn, 10), performedBy: short(completion.performedBy, 128), documentReference: short(completion.documentReference, 500), note: short(completion.note), reviewState: completion.reviewState, reviewNote: short(completion.reviewNote) };
          }) };
      }
      if (!sourceId(item.visitId)) throw new Error('invalid_revision_records');
      if (kind === 'exceptions') {
        if (!['open', 'acknowledged', 'in_review', 'resolved'].includes(item.state) || item.hhaVerification !== 'not_established') throw new Error('invalid_revision_records');
        return { ...base, visitId: item.visitId, diagnosis: short(item.diagnosis, 2000), state: item.state, followUpAt: short(item.followUpAt, 40), assignee: short(item.assignee, 128) };
      }
      if (kind !== 'notifications' || !['queued', 'claimed', 'accepted', 'delivered', 'failed', 'unknown', 'suppressed'].includes(item.state)) throw new Error('invalid_revision_records');
      return { ...base, visitId: item.visitId, rule: short(item.rule, 128), state: item.state, deadlineAt: short(item.deadlineAt, 40), plannedSendAt: short(item.plannedSendAt, 40),
        acknowledgement: item.acknowledgement ? { at: short(item.acknowledgement.at, 40), note: short(item.acknowledgement.note) } : null };
    });
    return { items, nextCursor: payload.nextCursor };
  }
  function filterVisits(items, term = '', severity = 'all') {
    const search = term.trim().toLowerCase();
    return items.filter(item => {
      const { evidence, diagnosis } = item;
      const matching = !search || [evidence.visitId, evidence.patientId, evidence.caregiverId, ...diagnosis.issues.map(issue => `${issue.summary} ${issue.nextAction || ''}`)].join(' ').toLowerCase().includes(search);
      const selected = severity === 'all' || severity === 'verified' && diagnosis.verification === 'verified'
        || severity === 'unknown' && (diagnosis.state === 'unknown' || evidence.state !== 'ready')
        || severity === 'attention' && diagnosis.issues.some(issue => ['blocker', 'review'].includes(issue.level))
        || diagnosis.issues.some(issue => issue.level === severity);
      return matching && selected;
    });
  }
  function requirementInput(fields, officeId, id) {
    if (!sourceId(officeId) || !sourceId(fields.subjectId) || !validDay(fields.anchorDate) || !validDay(fields.effectiveFrom) || fields.effectiveUntil && !validDay(fields.effectiveUntil)) throw new Error('Check the references and calendar dates.');
    const cadenceMonths = fields.type === 'initial_orientation' || fields.cadenceMonths === '' ? null : Number(fields.cadenceMonths);
    if (cadenceMonths !== null && (!Number.isInteger(cadenceMonths) || cadenceMonths < 1 || cadenceMonths > 120)) throw new Error('Enter a whole number of calendar months, or leave the recurrence blank.');
    return { id, revision: 0, officeId, type: fields.type, subject: { kind: fields.subjectKind, id: fields.subjectId }, program: fields.program, service: fields.service,
      assignedSupervisor: fields.assignedSupervisor, ruleReference: fields.ruleReference, cadenceMonths, anchorMode: fields.anchorMode, anchorDate: fields.anchorDate,
      effectiveFrom: fields.effectiveFrom, effectiveUntil: fields.effectiveUntil || null, overrideDueDate: null, overrideReason: '', note: fields.note };
  }
  function formatClock(value, { timezone, serviceDate, synthetic = false } = {}) {
    if (!value) return 'Unavailable';
    const original = value.raw || value.iso;
    if (!original) return 'Unavailable';
    if (value.iso && /(?:Z|[+-]\d\d:\d\d)$/.test(value.iso) && timezone) {
      const instant = new Date(value.iso);
      if (Number.isFinite(instant.getTime())) {
        try {
          const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
          const day = ['year', 'month', 'day'].map(key => parts.find(part => part.type === key).value).join('-');
          const time = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(instant);
          return day === serviceDate ? time : `${new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', day: 'numeric' }).format(instant)} · ${time}`;
        } catch { return original; }
      }
    }
    // Synthetic fixture times are written clock labels; no timezone is inferred for live source values.
    if (synthetic) {
      const match = /^(\d{4}-\d\d-\d\d)T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(original);
      if (match) { const hour = Number(match[2]); return `${match[1] === serviceDate ? '' : match[1] + ' · '}${hour % 12 || 12}:${match[3]} ${hour < 12 ? 'AM' : 'PM'}`; }
    }
    return original;
  }
  window.primetimeRevisionModel = Object.freeze({ normalizeStatus, normalizeVisits, normalizeRecords, filterVisits, requirementInput, formatClock });
  if (typeof document === 'undefined') return;
  const controller = window.primetimeDataMode, fixtures = window.primetimeDemoData;
  const get = id => document.getElementById(id);
  const panel = get('revisionWorkspace');
  if (!controller || !fixtures || !panel) return;
  let ready = false, session = 0, serial = 0, active = false, loading = false, abort = null, status = null, visitPage = null, selectedId = null, demoOffset = 0;
  const pages = { requirements: null, exceptions: null, notifications: null };
  const localDay = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
  const dateInput = get('revisionDate');
  if (dateInput) dateInput.value = localDay();
  function node(tag, text, className) { const element = document.createElement(tag); if (text !== null && text !== undefined) element.textContent = String(text); if (className) element.className = className; return element; }
  function text(id, value) { const element = get(id); if (element) element.textContent = value; }
  function replace(id, ...children) { get(id)?.replaceChildren(...children); }
  function unavailable(id, message) { replace(id, node('p', message, 'dashboard-unavailable')); }
  function button(label, callback, className = 'btn secondary') { const element = node('button', label, className); element.type = 'button'; element.addEventListener('click', callback); return element; }
  function details(title, ...children) { const element = node('details'); element.append(node('summary', title), ...children); return element; }
  function duration(minutes) { return minutes === null ? 'Unknown' : `${(minutes / 60).toFixed(2)} h`; }
  function clock(value) { return formatClock(value, { timezone: visitPage?.scope?.timezone, serviceDate: dateInput?.value, synthetic: !controller.isLive() }); }
  function labels(entries) { const list = node('dl', null, 'revision-facts'); for (const [title, value] of entries) list.append(node('dt', title), node('dd', value || 'Unavailable')); return list; }
  function statePill(item) {
    const verified = item.diagnosis.verification === 'verified' && item.evidence.state === 'ready';
    const blocked = item.diagnosis.verification === 'blocked';
    return node('span', item.demo ? 'Synthetic example' : verified ? 'Verified' : blocked ? 'Blocking issue' : item.diagnosis.state === 'unknown' ? 'Unknown evidence' : 'Needs review', `status ${verified ? 'low' : blocked ? 'high' : 'medium'}`);
  }
  function context() { return { session, serial, generation: controller.getGeneration(), date: dateInput?.value, mode: controller.getMode() }; }
  function current(ticket) { return ready && active && ticket.session === session && ticket.serial === serial && ticket.generation === controller.getGeneration() && ticket.date === dateInput?.value && ticket.mode === controller.getMode(); }
  function invalidate() {
    serial += 1; abort?.abort(); abort = null; loading = false; status = null; visitPage = null; selectedId = null; demoOffset = 0;
    for (const kind of Object.keys(pages)) pages[kind] = null;
    for (const id of ['revisionVisits', 'revisionDetail', 'revisionExceptions', 'revisionRequirements', 'revisionNotifications']) replace(id);
    for (const id of ['revisionNext', 'revisionRequirementsNext', 'revisionExceptionsNext', 'revisionNotificationsNext']) { if (get(id)) get(id).hidden = true; }
    text('revisionScope', ''); text('revisionPageCount', ''); text('revisionCompleteness', '');
    if (get('revisionRequirementForm')) get('revisionRequirementForm').reset();
    controls();
  }
  function controls() {
    if (get('revisionRefresh')) get('revisionRefresh').disabled = !ready || loading;
    if (dateInput) dateInput.disabled = loading;
    if (get('revisionNext')) get('revisionNext').disabled = loading;
    const form = get('revisionRequirementForm');
    if (form) for (const element of form.elements || []) element.disabled = loading || !ready || !controller.isLive() || status?.capabilities.records !== true;
    const type = form?.querySelector('[name="type"]'), cadence = form?.querySelector('[name="cadenceMonths"]');
    if (type?.value === 'initial_orientation' && cadence) cadence.disabled = true;
    if (get('revisionCreateRequirement')) get('revisionCreateRequirement').hidden = !ready || !controller.isLive() || status?.capabilities.records !== true;
  }
  function renderMode() {
    invalidate();
    if (!ready) { text('revisionStatus', 'Sign in to open visit review.'); unavailable('revisionVisits', 'Visit review is unavailable until sign-in is complete.'); return; }
    if (!controller.isLive()) {
      text('revisionStatus', 'Demo examples use the same synthetic visits as the dashboard. Follow-up changes and messages are disabled.');
      renderDemo();
    } else {
      text('revisionStatus', 'Open Visit review or refresh to check approved source access.');
      for (const id of ['revisionVisits', 'revisionDetail', 'revisionExceptions', 'revisionRequirements', 'revisionNotifications']) unavailable(id, 'Unavailable until the server checks approved access.');
      if (active) void refresh();
    }
  }
  function renderDemo() {
    const raw = fixtures.visitPage(dateInput.value, demoOffset);
    const model = fixtures.dashboard(dateInput.value);
    visitPage = { items: raw.items.map(item => ({ demo: true, evidence: { visitId: item.id, patientId: item.patientId, caregiverId: item.caregiverId, state: 'unaccepted', times: Object.fromEntries(['scheduledStart', 'scheduledEnd', 'actualStart', 'actualEnd', 'evvStart', 'evvEnd'].map(key => [key, item[key] ? { raw: item[key], iso: null } : null])), reasons: ['Synthetic example; no live diagnosis.'], provenance: null },
      diagnosis: { state: 'unknown', verification: 'unknown', metrics: { scheduledMinutes: item.scheduledMinutes, actualMinutes: item.actualStart && item.actualEnd ? 240 : null, evvMinutes: null, varianceMinutes: null },
        issues: item.issue ? [{ id: item.id, kind: 'synthetic', level: item.priority === 'high' ? 'blocker' : 'review', summary: item.issue + ' (example)', nextAction: 'Review original punches and supporting evidence before proposing a change.', reasonCodeCandidates: [], suggestedNote: null, facts: [] }] : [] } })), nextOffset: raw.nextCursor ? Number(raw.nextCursor) : null };
    text('revisionScope', `Synthetic office · ${dateInput.value}`); text('revisionCompleteness', 'Synthetic preview · no messages or source changes.');
    unavailable('revisionRequirements', 'No example recurrence is assumed. Live requirements need an owner-defined program rule.');
    unavailable('revisionExceptions', 'Example issues appear with visits above. Persisted office follow-up is available only in approved Live mode.');
    replace('revisionNotifications', ...model.alerts.map(alert => { const article = node('article', null, 'revision-record'); article.append(node('strong', alert.title + ' (example)'), node('p', alert.detail), node('small', 'Synthetic · no delivery')); return article; }));
    renderVisits(); controls();
  }
  function renderVisits() {
    const all = visitPage?.items || [], visible = filterVisits(all, get('revisionSearch')?.value || '', get('revisionSeverity')?.value || 'all');
    text('revisionPageCount', `${visible.length} of ${all.length} on this page`);
    if (get('revisionNext')) get('revisionNext').hidden = !visitPage || visitPage.nextOffset === null;
    if (!visible.length) unavailable('revisionVisits', all.length ? 'No visits on this page match your filters.' : 'No visits were returned in this bounded preview.');
    else replace('revisionVisits', ...visible.map(item => {
      const article = node('article', null, 'revision-visit-card');
      article.append(statePill(item), node('h4', `Visit ${all.indexOf(item) + 1}`), labels([
        ['Scheduled', `${clock(item.evidence.times.scheduledStart)} → ${clock(item.evidence.times.scheduledEnd)}`], ['Expected hours', duration(item.diagnosis.metrics.scheduledMinutes)],
        ['Recorded actual', `${clock(item.evidence.times.actualStart)} → ${clock(item.evidence.times.actualEnd)}`], ['Actual hours', duration(item.diagnosis.metrics.actualMinutes)]
      ]));
      article.append(node('small', `Member reference: ${item.evidence.patientId || 'Unknown'} · Caregiver reference: ${item.evidence.caregiverId || 'Unknown'}`, 'source-metadata'));
      const issue = item.diagnosis.issues.find(value => value.level === 'blocker') || item.diagnosis.issues[0];
      article.append(node('p', issue?.summary || (item.demo ? 'Synthetic visit; policy diagnosis is unavailable.' : 'No issue was established from the available evidence.')));
      article.append(node('p', issue?.nextAction || 'Check the original evidence and validation state.', 'revision-next-action'));
      const select = button('Review details', () => {
        selectedId = item.evidence.visitId; renderDetail(item);
        if (window.matchMedia?.('(max-width: 1000px)').matches) {
          get('revisionDetailTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          get('revisionDetailTitle')?.focus({ preventScroll: true });
        }
      });
      select.setAttribute('aria-label', `Review details for visit ${all.indexOf(item) + 1}`);
      article.append(select); return article;
    }));
    const selected = visible.find(item => item.evidence.visitId === selectedId) || visible[0];
    selectedId = selected?.evidence.visitId || null;
    if (selected) renderDetail(selected); else unavailable('revisionDetail', 'Select a visit from the current page.');
  }
  function renderDetail(item) {
    text('revisionDetailTitle', `Visit ${(visitPage?.items || []).indexOf(item) + 1} details`);
    const box = node('div');
    box.append(statePill(item), labels([
      ['Schedule', `${clock(item.evidence.times.scheduledStart)} → ${clock(item.evidence.times.scheduledEnd)}`], ['Expected duration', duration(item.diagnosis.metrics.scheduledMinutes)],
      ['Recorded actual', `${clock(item.evidence.times.actualStart)} → ${clock(item.evidence.times.actualEnd)}`], ['Actual duration', duration(item.diagnosis.metrics.actualMinutes)],
      ['EVV punches', `${clock(item.evidence.times.evvStart)} → ${clock(item.evidence.times.evvEnd)}`], ['EVV duration', duration(item.diagnosis.metrics.evvMinutes)],
      ['Duration variance', item.diagnosis.metrics.varianceMinutes === null ? 'Unknown' : `${item.diagnosis.metrics.varianceMinutes} minutes`], ['Location / GPS', 'Unavailable until supported source evidence is validated']
    ]));
    for (const issue of item.diagnosis.issues) {
      const article = node('article', null, 'revision-issue');
      article.append(node('h4', issue.summary), node('p', `Next step: ${issue.nextAction || 'Review missing source evidence.'}`, 'revision-next-action'));
      if (issue.reasonCodeCandidates.length || issue.suggestedNote) {
        const suggestions = details('Suggestions requiring human review');
        suggestions.append(node('p', 'Review applicability and supporting evidence before using any note or reason code. Nothing is submitted here.'));
        if (issue.reasonCodeCandidates.length) suggestions.append(node('p', `Candidate reason codes: ${issue.reasonCodeCandidates.join(', ')}`));
        if (issue.suggestedNote) suggestions.append(node('p', issue.suggestedNote));
        article.append(suggestions);
      }
      if (issue.facts.length) article.append(details('Supporting facts', labels(issue.facts.map(([key, value]) => [human(key), value === null ? 'Unknown' : String(value)]))));
      box.append(article);
    }
    if (item.evidence.reasons.length) box.append(node('p', item.evidence.reasons.map(human).join('; '), 'source-metadata'));
    const provenance = item.evidence.provenance;
    if (item.evidence.rawTimes) box.append(details(item.evidence.state === 'ready' ? 'Original source values' : 'Original source values · interpretation pending', labels(Object.entries(item.evidence.rawTimes).map(([key, value]) => [key, value]))));
    box.append(details('Source references', labels([['Visit reference', item.evidence.visitId], ['Member reference', item.evidence.patientId], ['Caregiver reference', item.evidence.caregiverId], ['Evidence state', human(item.evidence.state)], ['Source operation', provenance?.operation], ['Fetched at', provenance?.fetchedAt], ['Source revision', provenance?.sourceRevision], ['Acceptance version', provenance?.acceptanceVersion]])));
    box.append(node('p', 'Office follow-up and suggestions do not establish HHA verification or change recorded work times.', 'source-metadata'));
    if (window.matchMedia?.('(max-width: 1000px)').matches) box.append(button('Back to visits', () => get('revisionVisits')?.scrollIntoView({ behavior: 'smooth', block: 'start' })));
    replace('revisionDetail', box);
  }
  const friendlyErrors = {
    operational_data_release_not_approved: 'Live operational data has not been approved.', source_acceptance_pending: 'Source interpretation is awaiting approval.',
    revision_reads_not_enabled: 'The office has not enabled the visit source reads. Open Settings to configure access.',
    revision_conflict: 'This record changed. Refresh before saving your review.', revision_policy_changed_restart: 'Office settings or policy changed. Refresh to start again.',
    revision_discovery_changed_restart: 'The visit list changed. Refresh to start again.', office_timezone_not_configured: 'The office timezone needs configuration.',
    demo_revision_actions_disabled: 'Switch to approved Live mode for this action.', revision_management_role_required: 'Administrator or office supervisor access is required.',
    invalid_record_text: 'Complete the required fields and keep the note within its limit.', completion_outside_rule_dates: 'The completion date must be within the requirement’s effective dates.',
    completion_review_final: 'This completion has already been reviewed. Its evidence is retained in the ledger.', requirement_period_already_completed: 'This due period already has an accepted completion.',
    completion_date_must_advance: 'A recurring completion must be later than the previously accepted completion.', requirement_cadence_not_configured_or_completed: 'Define the recurrence before recording completion, or review the existing completed requirement.',
    invalid_exception_transition: 'This office follow-up changed state. Refresh before choosing the next action.'
  };
  function errorText(error) { return friendlyErrors[error?.message] || 'This request could not be completed. Refresh and try again.'; }
  function clearRevokedAccess(error) {
    if (!['revision_policy_changed_restart', 'revision_discovery_changed_restart', 'operational_data_release_not_approved', 'office_timezone_not_configured', 'revision_management_role_required', 'office_scope_mismatch'].includes(error?.message)) return false;
    invalidate(); text('revisionStatus', errorText(error));
    for (const id of ['revisionVisits', 'revisionDetail', 'revisionExceptions', 'revisionRequirements', 'revisionNotifications']) unavailable(id, 'Access or source scope changed. Refresh before reviewing or saving.');
    return true;
  }
  async function request(path, ticket, options = {}) {
    if (!current(ticket) || ticket.mode !== 'live') throw new Error('stale_revision_request');
    const response = await window.primetimeApiFetch('/primetime/api/revisions/' + path, { ...options, signal: abort?.signal });
    if (!current(ticket)) throw new Error('stale_revision_request');
    const payload = await response.json();
    if (!current(ticket)) throw new Error('stale_revision_request');
    if (!response.ok || payload?.ok !== true) throw new Error(short(payload?.error, 128) || 'revision_request_failed');
    return payload;
  }
  function begin() { serial += 1; abort?.abort(); abort = new AbortController(); loading = true; const untrack = controller.trackRequest?.(abort); controls(); return { ticket: context(), untrack }; }
  async function refresh() {
    if (!ready || !active || loading) return;
    if (!controller.isLive()) { demoOffset = 0; renderDemo(); return; }
    if (!validDay(dateInput.value)) { text('revisionStatus', 'Choose a valid service date.'); return; }
    invalidate();
    const { ticket, untrack } = begin();
    text('revisionStatus', 'Checking review availability…');
    try {
      status = normalizeStatus(await request('status', ticket));
      if (!current(ticket)) return;
        if (controller.observeScope?.(status.workspaceScope)) return;
      text('revisionScope', `Office ${status.officeId || 'not configured'} · ${ticket.date}`);
      if (!status.dataApproved || !status.officeId) {
        text('revisionStatus', friendlyErrors[status.blockedReason] || 'Live review is unavailable until the office and data approvals are ready.');
        for (const id of ['revisionVisits', 'revisionDetail', 'revisionExceptions', 'revisionRequirements', 'revisionNotifications']) unavailable(id, 'Unavailable. No synthetic values are shown in Live mode.');
        return;
      }
      text('revisionStatus', status.capabilities.diagnosis ? `Review is available. ${status.capabilities.sms ? 'Approved reminders are managed by the server.' : 'Automatic text delivery is not enabled.'} ${status.earlyReminderConfigured ? '' : 'Early-ending reminder threshold is not configured.'}` : 'Original source evidence may be previewed; accepted interpretation is pending. Diagnosis remains unknown.');
      // The source and persisted records fail independently; one unavailable area does not fabricate another.
      await Promise.allSettled([loadVisits(ticket, 0), ...Object.keys(pages).map(kind => loadRecords(kind, ticket))]);
    } catch (error) { if (current(ticket)) { text('revisionStatus', errorText(error)); for (const id of ['revisionVisits', 'revisionDetail', 'revisionExceptions', 'revisionRequirements', 'revisionNotifications']) unavailable(id, 'Unavailable. Refresh to retry approved access.'); } }
    finally { untrack?.(); if (current(ticket)) { loading = false; controls(); } }
  }
  async function loadVisits(ticket, offset) {
    try {
      const query = new URLSearchParams({ date: ticket.date, offset: String(offset) });
      if (offset) query.set('discovery', visitPage.discovery);
      const result = normalizeVisits(await request('visits?' + query, ticket), { officeId: status.officeId, date: ticket.date, offset });
      if (!current(ticket)) return;
      visitPage = result;
      text('revisionScope', `Office ${result.scope.officeId} · ${result.scope.date} · ${result.scope.timezone} · Reviewed ${result.evaluatedAt || 'time unavailable'}`);
      text('revisionCompleteness', `Bounded source page. Complete office counts and cross-page overlap are not established.${result.truncated ? ' Source discovery was truncated.' : ''}`);
      renderVisits();
    } catch (error) { if (current(ticket) && !clearRevokedAccess(error)) { visitPage = null; selectedId = null; unavailable('revisionVisits', errorText(error)); unavailable('revisionDetail', 'No current visit evidence is available.'); text('revisionPageCount', ''); text('revisionCompleteness', ''); get('revisionNext').hidden = true; } }
  }
  async function loadRecords(kind, ticket, cursor) {
    const host = 'revision' + kind[0].toUpperCase() + kind.slice(1);
    try {
      const payload = await request(kind + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''), ticket);
      const result = normalizeRecords(payload, kind, status.officeId);
      if (!current(ticket)) return;
      pages[kind] = result; renderRecords(kind);
    } catch (error) { if (current(ticket) && !clearRevokedAccess(error)) { pages[kind] = null; unavailable(host, errorText(error)); get(host + 'Next').hidden = true; } }
  }
  function noteForm(label, actionOptions, callback) {
    const form = node('form', null, 'revision-note-form');
    const title = node('label', 'Review note'); const note = node('textarea'); note.required = true; note.maxLength = 1000; note.rows = 2; title.append(note); form.append(title);
    let selection = null;
    if (actionOptions) { const label = node('label', 'Action'); selection = node('select'); for (const [value, text] of actionOptions) { const option = node('option', text); option.value = value; selection.append(option); } label.append(selection); form.append(label); }
    const submit = node('button', label, 'btn secondary'); submit.type = 'submit'; const message = node('p', '', 'revision-form-message'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite'); form.append(submit, message);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!note.value.trim() || note.value.trim().length > 1000 || submit.disabled) { message.textContent = 'Add a review note before continuing.'; return; }
      await mutate(form, message, () => callback(note.value.trim(), selection?.value));
    });
    return form;
  }
  async function mutate(form, message, makeRequest) {
    if (!ready || !active || !controller.isLive() || status?.dataApproved !== true || loading) { message.textContent = 'Approved Live access is required for this action.'; return; }
    const { ticket, untrack } = begin();
    for (const element of form.elements || []) element.disabled = true;
    message.textContent = 'Saving office record…';
    try {
      const { path, body } = makeRequest();
      const result = await request(path, ticket, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!current(ticket)) return;
      if (result.mode !== 'live' || result.source !== 'primetime') throw new Error('invalid_revision_record_response');
      message.textContent = 'Saved to the office record. HHA verification has not changed.';
      const kind = path.split('/')[0];
      if (Object.hasOwn(pages, kind)) await loadRecords(kind, ticket);
      if (path === 'requirements/save') form.reset();
    } catch (error) { if (current(ticket) && !clearRevokedAccess(error)) message.textContent = errorText(error); }
    finally { untrack?.(); if (current(ticket)) { loading = false; for (const element of form.elements || []) element.disabled = false; controls(); } }
  }
  function completionForm(record) {
    const form = node('form', null, 'operational-form'); const fields = {};
    for (const [name, title, type, max] of [['completedOn', 'Completed on', 'date', 10], ['performedBy', 'Performed by', 'text', 128], ['documentReference', 'Supporting document reference', 'text', 500], ['note', 'Completion note', 'text', 1000]]) {
      const label = node('label', title); const input = node(name === 'note' ? 'textarea' : 'input'); if (name !== 'note') input.type = type; input.required = true; input.maxLength = max; label.append(input); fields[name] = input; form.append(label);
    }
    const submit = node('button', 'Record evidence for review', 'btn secondary'); submit.type = 'submit'; const message = node('p', '', 'revision-form-message'); message.setAttribute('role', 'status'); form.append(submit, message);
    form.addEventListener('submit', async event => { event.preventDefault(); if (!validDay(fields.completedOn.value) || Object.values(fields).some(input => !input.value.trim())) { message.textContent = 'Complete the date, performer, document reference and note.'; return; }
      await mutate(form, message, () => ({ path: 'requirements/complete', body: { id: record.id, revision: record.revision, officeId: record.officeId, completionId: crypto.randomUUID(), ...Object.fromEntries(Object.entries(fields).map(([name, input]) => [name, input.value.trim()])) } })); });
    return form;
  }
  function renderRecords(kind) {
    const host = 'revision' + kind[0].toUpperCase() + kind.slice(1), page = pages[kind];
    if (!page) return;
    get(host + 'Next').hidden = !page.nextCursor;
    if (!page.items.length) { unavailable(host, 'No persisted records were returned on this page.'); return; }
    replace(host, ...page.items.map(record => {
      const article = node('article', null, 'revision-record');
      if (kind === 'exceptions') {
        article.append(node('h4', record.diagnosis || 'Office review'), node('span', human(record.state), 'status ' + (record.state === 'resolved' ? 'pending' : 'medium')),
          labels([['Follow-up', record.followUpAt], ['Assigned to', record.assignee]]), details('References', labels([['Visit', record.visitId], ['Record', record.id]])));
        const actions = record.state === 'resolved' ? [['reopen', 'Reopen follow-up']] : [
          ...(record.state === 'open' ? [['acknowledge', 'Acknowledge']] : []),
          ...(['open', 'acknowledged'].includes(record.state) ? [['start_review', 'Start review']] : []), ['resolve', 'Resolve office follow-up']];
        article.append(noteForm('Save review', actions, (note, action) => ({ path: 'exceptions/review', body: { id: record.id, revision: record.revision, officeId: record.officeId, action, note } })));
      } else if (kind === 'requirements') {
        article.append(node('h4', human(record.type)), node('span', human(record.status), 'status ' + (['due', 'overdue'].includes(record.status) ? 'high' : 'pending')),
          labels([['Next due', record.nextDueDate], ['Program / service', [record.program, record.service].filter(Boolean).join(' / ')], ['Supervisor', record.assignedSupervisor], ['Rule', record.ruleReference], ['Recurrence', record.type === 'initial_orientation' ? 'One-time requirement' : record.cadenceMonths === null ? 'Not configured' : `${record.cadenceMonths} calendar months`]]),
          details('References', labels([['For', `${human(record.subject.kind)} ${record.subject.id}`], ['Record', record.id]])));
        for (const completion of record.completions) {
          const evidence = details(`${completion.completedOn || 'Completion'} · ${human(completion.reviewState)}`, labels([['Performed by', completion.performedBy], ['Document', completion.documentReference], ['Note', completion.note], ['Review note', completion.reviewNote]]));
          if (completion.reviewState === 'pending_review') evidence.append(noteForm('Save evidence review', [['accept', 'Accept documented completion'], ['reject', 'Reject evidence']], (note, action) => ({ path: 'requirements/review', body: { id: record.id, revision: record.revision, officeId: record.officeId, completionId: completion.id, action, note } })));
          article.append(evidence);
        }
        if (record.nextDueDate) article.append(details('Record completion evidence', completionForm(record)));
      } else {
        const delivery = { queued: 'Queued', claimed: 'Preparing delivery', accepted: 'Provider accepted · delivery unconfirmed', delivered: 'Delivery confirmed', failed: 'Delivery failed', unknown: 'Delivery state unknown', suppressed: 'Suppressed' };
        article.append(node('h4', human(record.rule)), node('span', delivery[record.state], 'status pending'), labels([['Planned send', record.plannedSendAt], ['Office deadline', record.deadlineAt]]), details('References', labels([['Visit', record.visitId], ['Alert', record.id]])));
        if (record.acknowledgement) article.append(node('p', `Office acknowledged ${record.acknowledgement.at || ''}: ${record.acknowledgement.note || ''}`));
        else article.append(noteForm('Acknowledge office alert', null, note => ({ path: 'notifications/acknowledge', body: { id: record.id, note } })));
      }
      return article;
    }));
  }
  get('revisionRefresh')?.addEventListener('click', () => void refresh());
  get('revisionSearch')?.addEventListener('input', renderVisits);
  get('revisionSeverity')?.addEventListener('change', renderVisits);
  dateInput?.addEventListener('change', () => { invalidate(); if (!validDay(dateInput.value)) { text('revisionStatus', 'Choose a valid service date.'); return; } if (controller.isLive()) { if (active) void refresh(); } else if (ready) renderDemo(); });
  get('revisionNext')?.addEventListener('click', async () => {
    if (loading || !visitPage || visitPage.nextOffset === null || !ready || !active) return;
    if (!controller.isLive()) { demoOffset = visitPage.nextOffset; renderDemo(); return; }
    const offset = visitPage.nextOffset, { ticket, untrack } = begin();
    try { await loadVisits(ticket, offset); } finally { untrack?.(); if (current(ticket)) { loading = false; controls(); } }
  });
  for (const kind of Object.keys(pages)) get('revision' + kind[0].toUpperCase() + kind.slice(1) + 'Next')?.addEventListener('click', async () => {
    if (loading || !pages[kind]?.nextCursor || !ready || !active || !controller.isLive()) return;
    const cursor = pages[kind].nextCursor, { ticket, untrack } = begin();
    try { await loadRecords(kind, ticket, cursor); } finally { untrack?.(); if (current(ticket)) { loading = false; controls(); } }
  });
  get('revisionRequirementForm')?.addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, message = form.querySelector('.revision-form-message');
    let body;
    try { body = requirementInput(Object.fromEntries(new FormData(form).entries()), status?.officeId, crypto.randomUUID()); } catch (error) { message.textContent = error.message; return; }
    await mutate(form, message, () => ({ path: 'requirements/save', body }));
  });
  get('revisionRequirementForm')?.querySelector('[name="type"]')?.addEventListener('change', controls);
  document.addEventListener('primetime-view-changed', event => { const next = event.detail?.view === 'revisions'; if (active && !next) { active = false; invalidate(); return; } active = next; if (active && ready) { if (controller.isLive()) void refresh(); else renderDemo(); } });
  document.addEventListener('primetime-ready', () => { ready = true; session += 1; active = panel.classList.contains('is-active'); renderMode(); });
  document.addEventListener('primetime-signed-out', () => { ready = false; session += 1; invalidate(); text('revisionStatus', 'Sign in to open visit review.'); });
  document.addEventListener('primetime-data-mode-changed', renderMode);
  renderMode();
})();
