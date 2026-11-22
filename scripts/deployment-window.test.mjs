import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentWindow, PUBLICATION_START} from './deployment-window.mjs';

test('production publication begins January 1 in Central time for all release entry points', () => {
  assert.equal(new Date(PUBLICATION_START).toISOString(), '2027-01-01T06:00:00.000Z');
  for (const event of ['push', 'schedule', 'workflow_dispatch']) {
    assert.equal(deploymentWindow(event, new Date(PUBLICATION_START - 1)).allow, false, event);
    assert.equal(deploymentWindow(event, new Date(PUBLICATION_START)).allow, true, event);
  }
});

test('after January 1 a daytime push can proceed to scope verification', () => {
  const daytime = new Date('2027-01-04T20:00:00Z');
  assert.equal(deploymentWindow('push', daytime).allow, true);
  assert.equal(deploymentWindow('pull_request', daytime).allow, false);
  assert.equal(deploymentWindow('push', new Date(NaN)).allow, false);
});
