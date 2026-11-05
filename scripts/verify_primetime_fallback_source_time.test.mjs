import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// Synthetic display-only evidence, not source acceptance or payable-time rules.
for (const tree of ['source', 'public']) {
  const script = readFileSync(new URL(`../${tree}/primetime/data-source.js`, import.meta.url), 'utf8');
  const fresh = () => {
    const window = {};
    vm.runInNewContext(script, { window, document: { getElementById: () => null, addEventListener() {} } });
    return window.primetimeSourceTime;
  };
  const clocks = ['2026-11-01T01:30:00-05:00', '2026-11-01T01:30:00-06:00'];

  test(`${tree}: fall-back source hours are not adjusted again or replaced by elapsed clocks`, () => {
    const time = fresh();
    // Deliberately disagreeing clocks/calculation make substitution detectable.
    assert.equal(time.sourceActualHours('2.25', 60, ...clocks), '2.25 h · HHA');
    assert.equal(time.sourceRoundedActualHours('2.50'), '2.50 h · HHA');
    assert.equal(time.sourceActualHours('0.00', 60, ...clocks), '0.00 h · HHA');
    assert.equal(time.sourceRecordedClockSpan(...clocks), '');
    assert.equal(time.sourceClockSpan(...clocks), null);
  });

  test(`${tree}: repeated local clocks cannot fill empty or unknown source durations`, () => {
    const time = fresh();
    const local = ['2026-11-01 01:30', '2026-11-01 01:30'];
    assert.equal(time.sourceClockSpan(...local), null);
    assert.equal(time.sourceRecordedClockSpan(...local), '');
    assert.equal(time.sourceActualHours('', 60, ...local), 'Empty HHA ActualHours');
    assert.equal(time.sourceActualHours(null, 60, ...local), 'Not supplied by HHA');
    assert.equal(time.sourceActualHours(undefined, 60, ...local), 'Not supplied by HHA');
    assert.equal(time.sourceRoundedActualHours(''), 'Empty HHA ActualHoursRounded');
    assert.equal(time.sourceRoundedActualHours(null), 'Not supplied by HHA');
  });

  test(`${tree}: source duration stays unchanged through synthetic serialization and fresh display contexts`, () => {
    const original = { ActualHours: '2.25', ActualHoursRounded: '2.50', start: clocks[0], end: clocks[1] };
    let replay = original;
    for (let pass = 0; pass < 3; pass++) {
      replay = JSON.parse(JSON.stringify(replay));
      const time = fresh();
      assert.equal(time.sourceActualHours(replay.ActualHours, 60, replay.start, replay.end), '2.25 h · HHA');
      assert.equal(time.sourceRoundedActualHours(replay.ActualHoursRounded), '2.50 h · HHA');
      assert.deepEqual(replay, original);
    }
  });

  test(`${tree}: offset-free spans remain labelled written times, never actual hours`, () => {
    const time = fresh();
    const local = ['2026-11-01 00:30', '2026-11-01 02:30'];
    assert.equal(time.sourceRecordedClockSpan(...local), 'Recorded clock span: 2.00 h · written times');
    assert.equal(time.sourceActualHours('3.00', null, ...local), '3.00 h · HHA');
    assert.equal(time.sourceActualHours(null, null, ...local), 'Not supplied by HHA');
    assert.equal(time.sourceRecordedClockSpan(local[0], null), '');
  });
}
