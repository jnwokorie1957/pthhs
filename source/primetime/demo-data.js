(() => {
  'use strict';
  // These fixtures stay in the browser. Their identifiers are never source IDs.
  const statuses = ['completed', 'in_progress', 'starting_soon', 'late_missing', 'scheduled'];
  const counts = [18, 11, 6, 3, 4];
  const visitStates = statuses.flatMap((state, index) => Array(counts[index]).fill(state));
  const issues = [
    ['Missing clock-out', 'high', 'Employee + manager'],
    ['Clock-in variance', 'medium', 'Manager only'],
    ['Verification incomplete', 'medium', 'Manager only'],
    ['Minor duration variance', 'low', 'Silent log'],
    ['Missing clock-in', 'high', 'Employee + manager'],
    ['Verification incomplete', 'medium', 'Manager only'],
    ['Missing clock-out', 'high', 'Manager only'],
    ['Minor duration variance', 'low', 'Silent log']
  ];
  const futureShifts = [
    { id: 'DEMO-S-014', dayOffset: 1, assigned: false, service: 'PAS', window: '8 AM–12 PM', eligible: ['DEMO-C-1', 'DEMO-C-2', 'DEMO-C-3', 'DEMO-C-4', 'DEMO-C-5'] },
    { id: 'DEMO-S-019', dayOffset: 1, assigned: false, service: 'Respite', window: '1 PM–5 PM', eligible: ['DEMO-C-1', 'DEMO-C-2', 'DEMO-C-3'] },
    { id: 'DEMO-S-W1', dayOffset: 6, assigned: false, service: 'PAS', window: '9 AM–1 PM', eligible: [] }
  ];
  const alerts = [
    { title: 'Late clock-in threshold', detail: 'Example manager rule triggered.', minutesAgo: 8, tone: 'danger' },
    { title: 'Visit requires review', detail: 'Example verification is incomplete.', minutesAgo: 21, tone: 'warn' },
    { title: 'Staffing gap', detail: 'An example shift is open tomorrow.', minutesAgo: 34, tone: 'info' }
  ];
  const rules = [
    { audience: 'Employee visible', tone: 'employee', title: 'Missing clock-in', detail: 'Example reminder after a grace period, followed by escalation.', channel: 'Demo channel not connected' },
    { audience: 'Manager only', tone: 'manager', title: 'Location discrepancy', detail: 'Example discrepancy held for a manager to review.', channel: 'Demo dashboard' },
    { audience: 'Silent log', tone: 'silent', title: 'Minor variance', detail: 'Example event recorded without sending a message.', channel: 'Demo audit' }
  ];
  const audit = [
    { time: 'Example event', actor: 'Demo system', action: 'Preview workspace opened', object: 'Demo workspace', result: 'Synthetic' },
    { time: 'Example event', actor: 'Demo system', action: 'Example reference check recorded', object: 'Demo integration', result: 'Synthetic' }
  ];
  const settings = [
    { title: 'Access control', detail: 'Example administrator and supervisor roles. Actual permissions are enforced by the server.' },
    { title: 'EVV thresholds', detail: 'Example rule settings. No live exception rules are activated by this preview.' },
    { title: 'Messaging', detail: 'Example audience and escalation policy. No messages are sent.' },
    { title: 'Data handling', detail: 'Synthetic records only. Live source records are kept out of browser storage.' }
  ];
  function visits(date) {
    return visitStates.map((state, index) => {
      const hour = 8 + (index % 6);
      const time = (value, minute = 0) => `${date}T${String(value).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
      const issue = issues[index];
      return {
        id: `DEMO-V-${1048 + index}`, patientId: `DEMO-P-${index + 1}`, caregiverId: index < 38 ? `DEMO-C-${(index % 12) + 1}` : null,
        scheduledStart: time(hour), scheduledEnd: time(hour + 4),
        actualStart: state === 'completed' || state === 'in_progress' ? time(hour) : null,
        actualEnd: state === 'completed' ? time(hour + 4) : null,
        evvStart: issue?.[0] === 'Missing clock-in' ? null : state === 'completed' || state === 'in_progress' ? time(hour, issue?.[0] === 'Clock-in variance' ? 18 : 0) : null,
        evvEnd: issue?.[0] === 'Missing clock-out' ? null : state === 'completed' ? (issue?.[0] === 'Minor duration variance' ? time(hour + 3, 55) : time(hour + 4)) : null,
        state: 'synthetic', demoActivity: state,
        scheduledMinutes: 240,
        demoBillingDisposition: state === 'completed' ? (issue ? 'blocked' : 'ready') : 'scheduled',
        demoAvailabilityConflict: index >= 35 && index < 38,
        ...(issue ? { issue: issue[0], priority: issue[1], visibility: issue[2] } : {})
      };
    });
  }
  function dashboard(date) {
    const items = visits(date);
    const exceptions = items.filter(item => item.issue);
    const today = items.map(item => ({ id: item.id.replace('DEMO-V-', 'DEMO-S-'), dayOffset: 0, assigned: item.caregiverId !== null, conflict: item.demoAvailabilityConflict, service: 'PAS', window: `${item.scheduledStart.slice(11, 16)}–${item.scheduledEnd.slice(11, 16)}`, eligible: [] }));
    const shifts = [...today, ...futureShifts];
    const minutes = predicate => items.filter(predicate).reduce((sum, item) => sum + item.scheduledMinutes, 0);
    return {
      mode: 'demo', date, visits: items, exceptions, alerts, rules, audit, settings,
      counts: Object.fromEntries(statuses.map(state => [state, items.filter(item => item.demoActivity === state).length])),
      highPriority: exceptions.filter(item => item.priority === 'high').length,
      coverage: {
        todayOpen: today.filter(shift => !shift.assigned).length,
        todayPercent: Math.round(today.filter(shift => shift.assigned).length / today.length * 100),
        tomorrowOpen: shifts.filter(shift => shift.dayOffset === 1 && !shift.assigned).length,
        weekOpen: shifts.filter(shift => !shift.assigned).length,
        conflicts: today.filter(shift => shift.conflict).length,
        shifts: shifts.filter(shift => !shift.assigned)
      },
      billing: {
        completedMinutes: minutes(item => item.demoActivity === 'completed'),
        readyMinutes: minutes(item => item.demoBillingDisposition === 'ready'),
        blockedMinutes: minutes(item => item.demoBillingDisposition === 'blocked'),
        projectedMinutes: minutes(() => true)
      }
    };
  }
  function visitPage(date, offset = 0, limit = 10) {
    const items = visits(date);
    const start = Number.isInteger(offset) && offset >= 0 ? offset : 0;
    const size = Number.isInteger(limit) && limit >= 1 ? Math.min(limit, 10) : 10;
    return {
      ok: true, mode: 'demo', source: 'synthetic', state: 'ready',
      scope: { officeId: 'DEMO-OFFICE', date, timezone: 'Example office time' },
      fetchedAt: null, validation: 'synthetic', timezone: 'synthetic',
      items: items.slice(start, start + size),
      nextCursor: start + size < items.length ? String(start + size) : null,
      completeness: { complete: false, truncated: false }, totals: null
    };
  }
  window.primetimeDemoData = Object.freeze({ dashboard, visitPage });
})();
