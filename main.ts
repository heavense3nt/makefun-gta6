// VELDORA — a sun-soaked open-world crime game for make.fun's gta6-01 bounty.
// Entry v3: a fresh rebuild. The game is plain static files under game/ —
// index.html plus ES modules and a vendored three.js r152 (game/vendor/three.min.js),
// no build step, no network request at play time. Serve it with `node serve.ts`
// and open http://localhost:8080.
//
// What this program does: it hands the entry in. It copies game/ and
// screenshots/ from beside this file into the output directory (the grader's
// /output, or MAKEFUN_OUTPUT_DIR outside it) and writes /output/dossier.json,
// the summary the judge reads, using buildDossier from the kit's vendored
// library at vendor/makefun-game.ts. It runs twice in grading and both runs
// must write the same bytes, so it does nothing time- or order-dependent:
// a plain recursive copy, then the dossier built from what was copied.
//
// Run it locally the same way the grader does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's own caps, from the kit: the dossier text is capped at 160 KiB and
// the entry refuses anything the scorer would refuse outright — more than 4
// screenshots or one over 256 KiB, more than 993 files or 48 MiB under game/,
// or a game/ path over 1000 bytes. Veldora sits well inside all of them:
// one vendored library, sixteen small source modules, four screenshots.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
