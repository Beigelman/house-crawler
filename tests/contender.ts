// Local-only process used to exercise the shared production run boundary.
import { admin, sql } from './local.ts';
import { propertyStore } from '../src/property/store.ts';
import { executeRun } from '../src/property/runner.ts';
let contacted = false;
const observed = async () => {
  if (!contacted) {
    console.log('PROVIDER_CONTACT');
    contacted = true;
  }
  await new Promise((r) => setTimeout(r, 1500));
};
const result = await executeRun(Deno.args[0], {
  store: propertyStore(admin),
  providers: () => ({
    collect: async () => {
      await observed();
      return { properties: [], outcome: 'succeeded', error: null };
    },
    verify: async () => {
      await observed();
      return { verification: 'active' };
    },
  }),
  sendEmail: () => Promise.resolve({ success: true }),
});
console.log(result.state);
await sql.end();
