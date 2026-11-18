import { defineConfig } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const c = JSON.parse(
  execFileSync('rtk', ['supabase', 'status', '-o', 'json'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
);
if (!c.API_URL.startsWith('http://127.0.0.1:')) {
  throw Error('Refusing remote test database');
}
export default defineConfig({
  testDir: new URL('./tests', import.meta.url).pathname,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: {
    cwd: new URL('.', import.meta.url).pathname,
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: c.API_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: c.ANON_KEY,
    },
  },
});
