import { main } from './property/cli.ts';
if (import.meta.main) Deno.exit(await main('worker'));
