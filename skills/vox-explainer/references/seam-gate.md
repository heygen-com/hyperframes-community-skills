# seam-stamp.mjs + seam-gate.mjs — usage + ledger schema

Generate-and-verify pair for the seam verification gate. The scripts have zero npm
dependencies and require Node.js 22 or newer plus local Chrome. The verifier finds a
Puppeteer-cached Chrome or system Chrome, launches it with an isolated temporary profile,
and accepts only localhost preview URLs.

```bash
# STAMP: write the master seam block (base sets + all wrapper tweens) from the ledger.
# Replaces the // <seams:auto> … // </seams:auto> block (inserts after the
# window.__timelines["main"] registration if markers are absent). Stamped seams pass
# the gate by construction. match-cut/morph rows get visibility sets only — the
# carrier handoff stays hand-authored.
node <SKILL_DIR>/scripts/seam-stamp.mjs --ledger ledger.json --write index.html
```

Run the stamper from the project root. For safety, `--write` must resolve inside
the current project directory and refuses symlink targets.

Per-seam stamp options in the ledger: `exit.dur` / `entry.dur` (durations),
`entry.travel` (xPercent/yPercent offset, default 10 — use 8 for a soft entry),
`blur` (Z seams, default 18px full-frame / set 10 for text-scale).

```bash
# verify every seam in the ledger (exit 0 = gate passed)
node <SKILL_DIR>/scripts/seam-gate.mjs verify --ledger ledger.json --project <project-dir>

# reuse a RUNNING preview server (restart it after comp edits — stale bundle!)
node <SKILL_DIR>/scripts/seam-gate.mjs verify --ledger ledger.json --url http://localhost:5244

# discover movers around a cut time (use to author/fix ledger rows)
node <SKILL_DIR>/scripts/seam-gate.mjs probe --t 44.8 --project <project-dir>
```

`--project` runs the exact HyperFrames CLI version pinned in `seam-gate.mjs`, starts a
fresh preview server with `HYPERFRAME_RUNTIME_URL` unset, and kills it afterward. `npx`
may download that package from the npm registry when it is not cached. To avoid that
network access, start a compatible preview yourself and use
`--url http://localhost:<port>`. Use `--json` for machine output; `--fps 30` is the
default.

## ledger.json

Lives at the project root. One row per seam; this is the vector ledger as data.

```json
{
  "fps": 30,
  "seams": [
    { "id": "hook→claim", "cut": 4.2, "technique": "velocity-matched-transitions LEFT",
      "exit":  { "selector": "#el-hook",  "axis": "x", "dir": -1 },
      "entry": { "selector": "#el-claim", "axis": "x", "dir": -1 } },

    { "id": "claim→payoff", "cut": 10.2, "technique": "inverse zoom-through",
      "exit":  { "selector": "#el-claim",  "axis": "z", "dir": -1 },
      "entry": { "selector": "#el-payoff", "axis": "z", "dir": -1, "scanRoot": "#el-payoff" } },

    { "id": "ui→player (match cut)", "cut": 60.6, "type": "match-cut",
      "carrier": { "out": "#resting-card", "in": "#product-video" } }
  ]
}
```

- `cut` — seconds on the master clock, the frame the incoming side ignites.
- `type` — `"cut"` (default; full vector checks), `"match-cut"` / `"morph"`
  (carrier-continuity + overlap only; motion may start AT the boundary).
- `axis` — `"x"`, `"y"`, or `"z"` (z = scale). `dir` — sign of motion:
  x −1 = leftward, y −1 = upward, z +1 = push (growing), z −1 = pull (shrinking).
- `selector` — the element that CARRIES the seam motion. Use the wrapper when the
  master timeline moves the wrapper; use the in-comp hero (id or `[data-hf-id=…]`)
  when the seam motion is authored inside the sub-comp. `probe` tells you which.
- `entry.scanRoot` (z seams) — subtree scanned for sign-fighting internal entrances;
  defaults to the entry selector.
- `carrier` — optional on `"cut"` rows; required on match-cut/morph. `out`/`in` rects
  must match at cut±1 frame (12px center / 5% size tolerance, ancestors included).

## What each check enforces (seam verification gate rule ↔ report row)

| Report row | Rule |
|---|---|
| `ledger` | exit/entry vectors match in the PLAN (axis + dir) |
| `exit-moving` / `entry-moving` | rule 1/3 — no settled exits, no from-rest entries |
| `exit-direction` / `entry-direction` | rule 3 — measured sign matches the ledger |
| `speed-match` (WARN) | law §3 — entry velocity ≈ exit velocity |
| `zero-overlap` | rule 6 — one side visible per frame, never both |
| `z-sign-scan` | rule 7 — incoming scene's own entrances don't fight the Z sign |
| `carrier-*` | rules 3/4 — carrier rect continuity, ancestor scale included |

Velocities are measured on `getBoundingClientRect` (center for x/y, width-ratio for z),
so ancestor wrapper transforms are automatically included.

## Known constraints

- Full-frame incoming wrappers must start hidden in HTML/CSS (`opacity: 0`).
  The stamper's immediate `gsap.set` cannot satisfy static lint rules that
  inspect only the initial markup.
- Seek-safety: under the gate's random seeks, GSAP lazy `.to()` start-value
  capture breaks on multi-stage chains — author them as
  `fromTo(..., {immediateRender:false})`.
- Generated seams satisfy the generator's hard invariants, but the verifier may
  still report speed-match warnings. Review warnings and the rendered frame pair.
- Tolerances: the seam gate's carrier check (12px / 5%) is deliberately
  stricter than the layout skill's zoom-isolation spec (30px / 10%); the
  gate's numbers govern stamped seams, the skill's govern hand-built ones.
