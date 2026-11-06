import test from 'node:test';
import assert from 'node:assert/strict';
import { assessMarketingBudget, MARKETING_BUDGET_BYTES, MARKETING_WARNING_BYTES } from './marketing-budget.mjs';

test('marketing growth capacity is bounded at 5 MB with an early 4 MB warning', () => {
  assert.equal(MARKETING_BUDGET_BYTES, 5_000_000);
  assert.equal(MARKETING_WARNING_BYTES, 4_000_000);
});

test('ordinary growth above the former 2 MB cap passes without warning', () => {
  for (const bytes of [0, 1_968_953, 2_000_000, 2_000_001, 3_999_999]) {
    assert.deepEqual(assessMarketingBudget(bytes), { error: null, warning: null });
  }
});

test('the exact warning boundary through the exact cap warns but passes', () => {
  for (const bytes of [4_000_000, 4_999_999, 5_000_000]) {
    const result = assessMarketingBudget(bytes);
    assert.equal(result.error, null);
    assert.match(result.warning, /4 MB review threshold/);
    assert.match(result.warning, new RegExp(String(bytes)));
  }
});

test('one byte above the cap and larger outputs still fail', () => {
  for (const bytes of [5_000_001, 10_000_000, Number.MAX_SAFE_INTEGER]) {
    const result = assessMarketingBudget(bytes);
    assert.match(result.error, /exceeds 5 MB growth budget/);
    assert.match(result.error, new RegExp(String(bytes)));
    assert.equal(result.warning, null);
  }
});

test('invalid accounting cannot silently pass', () => {
  for (const bytes of [-1, 0.5, NaN, Infinity, '2000000', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => assessMarketingBudget(bytes), /non-negative safe integer/);
  }
});
