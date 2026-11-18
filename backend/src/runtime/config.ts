import { load } from '@std/dotenv';

export async function loadConfiguration() {
  await load({ export: true });
  return {
    scheduleEnabled: Deno.env.get('WORKER_SCHEDULE_ENABLED') !== 'false',
  };
}
