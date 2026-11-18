import { main } from './runtime/main.ts';
if (import.meta.main) Deno.exit(await main('validate'));
