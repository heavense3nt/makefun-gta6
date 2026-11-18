// main.ts — hands in the VELDORA entry (Node 22, standard library only).
// The game lives in game/ as plain static files and the screenshots in screenshots/;
// this program copies both into /output and writes /output/dossier.json with the
// kit's vendored buildDossier. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output, so `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` writes out/.
// Both runs must write identical bytes: the copy is deterministic and the dossier
// is built from the copied files, so nothing here depends on time or randomness.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

// The scorer's caps, checked here first so a bad entry fails loudly instead of
// silently: at most 4 screenshots, each at most 256 KiB; game/ at most 993 files
// and 48 MiB in all; no path under game/ over 1000 bytes.
function countTree(dir) {
  let files = 0, bytes = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { const sub = countTree(p); files += sub.files; bytes += sub.bytes; }
    else if (st.isFile()) { files += 1; bytes += st.size; }
    if (p.length > 1000) fail(`path over 1000 bytes: ${p}`);
  }
  return { files, bytes };
}

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');

const gameSize = countTree(gameDir);
if (gameSize.files > 993) fail(`game/ holds ${gameSize.files} files, over the 993 cap`);
if (gameSize.bytes > 48 * 1024 * 1024) fail(`game/ is ${gameSize.bytes} bytes, over the 48 MiB cap`);

const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((n) => !n.startsWith('.')) : [];
if (shots.length < 3 || shots.length > 4) fail(`screenshots/ holds ${shots.length} images, need 3 or 4`);
for (const name of shots) {
  const st = statSync(join(shotsDir, name));
  if (st.size > 256 * 1024) fail(`screenshot ${name} is ${st.size} bytes, over the 256 KiB cap`);
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(name)) fail(`screenshot name ${name} is not allowed`);
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`main.ts: wrote ${join(out, 'dossier.json')} (${gameSize.files} game files, ${shots.length} screenshots)`);
