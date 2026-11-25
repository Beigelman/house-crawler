// deno-lint-ignore-file require-await
import assert from 'node:assert/strict';
import { logger, withLogContext } from '../../src/platform/logger.ts';
import { fetchWithRetry } from '../../src/platform/http-client.ts';
import { PropertyProvider } from '../../src/property/providers/base-property-provider.ts';
import { executeRun } from '../../src/property/application/execute-run.ts';
import { harness, listing, params } from '../support/property-fixtures.ts';

// deno-lint-ignore no-explicit-any
type AnyRecord = { [key: string]: any };

async function capture(action: () => Promise<void>) {
  const records: AnyRecord[] = [];
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  const write = (...args: unknown[]) => {
    assert.equal(args.length, 1);
    assert.equal(typeof args[0], 'string');
    records.push(JSON.parse(args[0] as string));
  };
  console.log = console.warn = console.error = write;
  try {
    await action();
  } finally {
    Object.assign(console, original);
  }
  return records;
}

Deno.test('JSON errors preserve stack, causes and object fields while redacting credentials', async () => {
  const cause = Object.assign(new Error('HTTP 503'), { status: 503 });
  const error = Object.assign(new Error('fetch failed', { cause }), {
    details: { code: 'UPSTREAM', api_key: 'private-key' },
  });
  const cyclic: AnyRecord = { code: 'DB001', message: 'database unavailable' };
  cyclic.self = cyclic;
  const records = await capture(async () => {
    logger.error('test.error', error, {
      token: 123,
      url: 'https://user:pass@example.test/?api_key=private-key&region=df',
      detail: 'Bearer abc SUPABASE_SECRET_KEY=xyz',
    });
    logger.error('test.object', cyclic);
  });
  assert.equal(records[0].error.name, 'Error');
  assert.equal(records[0].error.message, 'fetch failed');
  assert.match(records[0].error.stack, /logging_test.ts/);
  assert.equal(records[0].error.cause.status, 503);
  assert.equal(records[0].error.details.code, 'UPSTREAM');
  assert.equal(records[0].error_category, 'network');
  assert.equal(records[0].level, 'error');
  assert.ok(Number.isFinite(Date.parse(records[0].timestamp)));
  assert.equal(records[1].error.code, 'DB001');
  assert.equal(records[1].error.self, '[Circular]');
  const raw = JSON.stringify(records);
  for (const secret of ['private-key', 'user:pass', 'Bearer abc', '=xyz']) {
    assert.ok(!raw.includes(secret), secret);
  }
  assert.match(records[0].url, /region=df/);
});

Deno.test('async context remains isolated between concurrent runs and nested listings', async () => {
  const records = await capture(async () => {
    await Promise.all(
      ['a', 'b'].map((job_id) =>
        withLogContext({ job_id }, async () => {
          await Promise.resolve();
          await withLogContext(
            { listing_url: job_id + '/listing' },
            async () => {
              await Promise.resolve();
              logger.info('nested');
            },
          );
          logger.info('parent');
        })
      ),
    );
    logger.info('outside');
  });
  for (const record of records.filter((r) => r.event === 'nested')) {
    assert.equal(record.listing_url, record.job_id + '/listing');
  }
  assert.ok(
    records.filter((r) => r.event === 'parent').every((r) => !r.listing_url),
  );
  assert.equal(records.at(-1)!.job_id, undefined);
});

Deno.test('every crawled listing logs its URL and outcome including parse failures', async () => {
  class Provider extends PropertyProvider {
    constructor() {
      super('Test', params);
    }
    protected buildListUrl() {
      return 'https://example.test/search';
    }
    protected async collectListingLinks() {
      return [listing.url, listing.url + '/bad'];
    }
    protected async parseProperty(url: string) {
      if (url.endsWith('/bad')) throw new Error('parse title missing');
      return listing;
    }
    async isValid() {
      return true;
    }
  }
  const h = harness();
  const records = await capture(async () => {
    const result = await executeRun('collect', {
      ...h,
      providers: () => {
        const provider = new Provider();
        return {
          collect: () => provider.collectOutcome(),
          verify: (url) => provider.verify(url),
        };
      },
    });
    assert.equal(result.state, 'partial');
  });
  assert.deepEqual(
    records.filter((r) => r.event === 'listing.started').map((r) =>
      r.listing_url
    ),
    [listing.url, listing.url + '/bad'],
  );
  const success = records.find((r) => r.event === 'listing.completed')!;
  assert.equal(success.listing.title, listing.title);
  const failure = records.find((r) => r.event === 'listing.failed')!;
  assert.equal(failure.job_id, 'run');
  assert.equal(failure.search_id, 'profile');
  assert.equal(failure.provider, 'source0');
  assert.equal(failure.provider_name, 'Test');
  assert.deepEqual(failure.search_params, params);
  assert.equal(failure.listing_url, listing.url + '/bad');
  assert.equal(failure.error.message, 'parse title missing');
  assert.match(failure.error.stack, /parseProperty/);
});

Deno.test('HTTP retries include inherited listing context, attempts, status and final failure', async () => {
  const records = await capture(async () => {
    await withLogContext(
      { job_id: 'job', listing_url: listing.url },
      async () => {
        await assert.rejects(() =>
          fetchWithRetry(listing.url, {
            fetch: async () => new Response('', { status: 503 }),
            sleep: async () => {},
          })
        );
      },
    );
  });
  assert.deepEqual(records.map((r) => r.event), [
    'http.retry',
    'http.retry',
    'http.failed',
  ]);
  assert.deepEqual(records.map((r) => r.attempt), [1, 2, 3]);
  for (const record of records) {
    assert.equal(record.job_id, 'job');
    assert.equal(record.listing_url, listing.url);
    assert.equal(record.request_url, listing.url);
    assert.equal(record.error.status, 503);
  }
});

Deno.test('persistence and notification errors retain stage and listing context', async () => {
  const h = harness();
  const records = await capture(async () => {
    await assert.rejects(() =>
      executeRun('collect', {
        ...h,
        store: {
          ...h.store,
          save: async () => {
            throw { code: 'DB001', message: 'write failed' };
          },
        },
      })
    );
    await executeRun('collect', {
      ...h,
      sendEmail: async () => {
        throw new Error('delivery failed');
      },
    });
  });
  const failure = records.find((r) => r.event === 'provider.failed')!;
  assert.equal(failure.stage, 'save_listings');
  assert.equal(failure.job_id, 'run');
  assert.equal(failure.search_id, 'profile');
  assert.deepEqual(failure.listing_urls, [listing.url]);
  assert.equal(failure.error.code, 'DB001');
  const notification = records.find((r) => r.event === 'notification.failed')!;
  assert.equal(notification.job_id, 'run');
  assert.deepEqual(notification.listing_urls, [listing.url]);
  assert.equal(notification.error.message, 'delivery failed');
  assert.ok(!JSON.stringify(records).includes('test@example.test'));
});

Deno.test('validation failures include run, provider and listing URL', async () => {
  const h = harness();
  const records = await capture(async () => {
    await assert.rejects(() =>
      executeRun('validate', {
        ...h,
        store: {
          ...h.store,
          claim: async () => ({
            ...(await h.store.claim()),
            kind: 'validate' as const,
          }),
          listings: async () => [listing],
        },
        providers: () => ({
          ...h.providers('source0'),
          verify: async () => {
            throw new Error('verification failed');
          },
        }),
      })
    );
  });
  const failure = records.find((r) => r.event === 'listing.validation_failed')!;
  assert.equal(failure.job_id, 'run');
  assert.equal(failure.job_kind, 'validate');
  assert.equal(failure.listing_url, listing.url);
  assert.equal(failure.provider, 'wimoveis');
  assert.equal(failure.error.message, 'verification failed');
});

Deno.test('scheduler errors are structured and do not stop queue processing', async () => {
  const { pollWorker } = await import('../../src/runtime/poll-worker.ts');
  const h = harness();
  let claimed = false;
  const records = await capture(async () => {
    await pollWorker({
      ...h,
      schedule: async () => {
        throw new Error('schedule database failed');
      },
      store: {
        ...h.store,
        claim: async () => {
          claimed = true;
          return null;
        },
      },
      shouldStop: () => claimed,
    });
  });
  assert.equal(claimed, true);
  const failure = records.find((r) => r.event === 'schedule.failed')!;
  assert.equal(failure.error.message, 'schedule database failed');
  assert.match(failure.error.stack, /schedule/);
});
