import assert from 'node:assert/strict';
export async function browserProof(selector: string) {
  const p = await new Deno.Command('rtk', {
    args: [
      'npm',
      'exec',
      '--',
      'playwright',
      'test',
      '--grep',
      selector,
    ],
    cwd: new URL('../../../frontend/', import.meta.url),
    stdout: 'piped',
    stderr: 'piped',
  }).output();
  const out = new TextDecoder().decode(p.stdout);
  console.log(out);
  assert.equal(p.code, 0, out + new TextDecoder().decode(p.stderr));
}
