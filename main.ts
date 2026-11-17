// VELDORA — the entrypoint for gta6-01 (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ beside this file into the
// output directory, then writes the dossier the judge reads, built by the
// vendored make.fun library from exactly those copied files.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The grader hands us a fresh /output; locally we start from a clean slate so
// a stale file from an earlier run can never sneak into the entry.
if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const gameSource = join(repoRoot, 'game');
const shotsSource = join(repoRoot, 'screenshots');
cpSync(gameSource, join(outputDir, 'game'), { recursive: true });
if (existsSync(shotsSource)) cpSync(shotsSource, join(outputDir, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the bytes; the rest refuse
// an entry the scorer would refuse, so passing them here fails the same way.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log('VELDORA entry written to ' + outputDir + ' (' + dossier.length + ' byte dossier)');
