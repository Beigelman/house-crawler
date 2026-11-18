import assert from 'node:assert/strict';
import { pollWorker, type Store } from '../src/property/runner.ts';

for (const schedulerFails of [false, true]) {
  Deno.test(`SCHED-05 polling schedules before claim and handles scheduler failure=${schedulerFails}`, async () => {
    const events: string[] = [];
    let stopped = false;
    let queued = schedulerFails ? 'manual' : '';
    let completed = '';
    const store: Store = {
      heartbeat: () => Promise.resolve(),
      schedule: () => {
        events.push('schedule');
        if (schedulerFails) throw new Error('database unavailable');
        queued = 'scheduled';
        return Promise.resolve({
          outcome: 'accepted',
          scheduled_at: '2026-11-19T09:00:00Z',
        });
      },
      claim: () => {
        events.push('claim');
        assert.ok(queued);
        return Promise.resolve({
          run_id: queued,
          token: 1,
          kind: 'collect',
          profiles: [],
        });
      },
      renew: () => Promise.resolve(),
      save: () => Promise.resolve([]),
      source: () => Promise.resolve(),
      finish: (run, state) => {
        completed = run.run_id + ':' + state;
        queued = '';
        stopped = true;
        return Promise.resolve();
      },
      listings: () => Promise.resolve([]),
    };
    await pollWorker({
      store,
      schedule: store.schedule,
      providers: () => {
        throw new Error('No profiles');
      },
      sendEmail: () => Promise.resolve({ success: true }),
      shouldStop: () => stopped,
    });
    assert.deepEqual(events, ['schedule', 'claim']);
    assert.equal(
      completed,
      (schedulerFails ? 'manual' : 'scheduled') + ':succeeded',
    );
    assert.equal(queued, '');
  });
}
