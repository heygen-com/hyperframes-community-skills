# Room: decorate it from what you know about your user

The room is your portrait of your user. Every prop should be something true about them that you learned from your
history: what they make, what they play, what's on their desk, the things you built together. Write the
reason for each prop in `room.why`. It goes in the privacy table.

Good sources: your memory files, their instruction files (`CLAUDE.md`, `AGENTS.md`), the projects in their history,
and things they told you. If you know nothing, ask: "what's on your desk, and what would be on the wall?"

## Slots

```
   window         wallA           wallB (above the monitor)      shelf: 3 items
  ┌──────┐     ┌─────────┐        ┌──────┐                  ═══════════════
  │      │     │ 250×170 │        │200×150│                  hook (hangs under it)
  │ sill │     └─────────┘        └──────┘                     wallC 170×170
  └──────┘
 floor (tall, left of the desk)     desk (left of the keyboard, behind you)
```

`story.json`:

```json
"room": {
  "palette": { "wall": "#E9E2F2", "wainscot": "#9FB7C9", "floor": "clayDk" },
  "sill": "roses",
  "wallA": { "prop": "corkboard", "cards": [{ "kind": "gradient", "a": "#F2A283", "b": "#7B5CA8" }, { "kind": "word", "word": "v2" }] },
  "wallB": { "prop": "painting", "scene": "sea" },
  "wallC": "clock",
  "shelf": ["clapperboard", "books", "cat"],
  "hook": "headphones",
  "floor": "guitar",
  "desk": "mic",
  "why": { "guitar": "plays in a band on weekends" }
}
```

A slot takes a prop name, or `{ "prop": name, ...options }`. Leave a slot `null` to keep it bare. Colours are hex or
a palette name (`paper ink clay clayDk clayLt night indigo rose ochre sap teal violet cream sky`).

## The library

| slot | props (options) |
|---|---|
| sill | `roses`, `succulent`, `cat-sill` |
| wallA | `corkboard` (`cards`: up to 3 of `landscape` / `blob` / `gradient` with `a`, `b` colours, or `word` with `word`, up to 8 chars), `poster` (`word` up to 10 chars, `a` ground, `b` ink) |
| wallB | `curve-print`, `painting` (`scene`: `mountains`, `sea`, `city`) |
| wallC | `record`, `clock` (shows the session's real time when the beats have times) |
| shelf | `clapperboard`, `books` (`colors`), `dachshund`, `cat` (`color`), `trophy`, `camera`, `plant-small` |
| hook | `headphones`, `tote` (`color`). Both swing when you get bonked |
| floor | `guitar` (`color`), `floor-plant` |
| desk | `mic`, `pencil-cup`, `rubber-duck` |

The monitor, keyboard, mug, lamp, notepad, paper tray and nameplate are always there.

## Draw your own prop

When nothing in the library is true to your user, draw it in `scenes/props-custom.js` and name it in `story.json`:

```js
PROPS['bonsai'] = { slot: 'sill', draw(b, env, o) {
  const { x, y } = b;                                      // sill: the pot's base centre
  inkLine([[x, y - 36], [x - 8, y - 70], [x + 6, y - 96]], 3, mixCol(PAL.clayDk, PAL.ink, .3), 'ink', .5);
  for (const [dx, dy, r] of [[-24, -92, 22], [12, -112, 26], [22, -80, 18]])
    paint(ellPts(x + dx, y + dy, r, r * .7, 16, 1), { wash: PAL.sap, ink: PAL.ink, sw: .5 });
  paint([[x - 34, y - 36], [x + 34, y - 36], [x + 28, y], [x - 28, y]], { wash: PAL.indigo, ink: PAL.ink, sw: .7 });
} };
```

- `b` is the slot: `{ x, y }` for sill, shelf spots (bottom-left), hook, floor and desk; `{ x, y, w, h }` for the
  wall boxes. `env` is `{ tod, night, t, fx, hour }`: time of day 0 to 1, night 0 to 1, `fx.phones` (the swing
  after a hit), and the session's clock hour when the beats have times (else null). `o` is the slot's options from `story.json`.
- Brush vocabulary (from `kit/core.js`): `paint(points, { wash, ink, sw, fill, fillOp })` fills a watercolour
  shape; `inkLine(points, weight, colour, 'ink' | 'inkfine' | 'dry', curve)` draws a stroke. Shapes come from
  `rectPts(x, y, w, h)`, `rrPts(x, y, w, h, r)`, `ellPts(cx, cy, rx, ry, n, jitter, rot)`, `ribbon(points, w0, w1)`
  and `through(points, n)`. `mixCol(a, b, k)` mixes colours. `push() / translate() / rotate() / pop()` work as in
  p5. Text: `letter(txt, x, y, size, colour, { font: \`${size}px ${HAND}\`, ink: false })`.
- Keep inside the slot's box. Keep x 1000 to 1600, y 360 to 460 clear: the mallet's handle swings through it.
- A prop is static. Only the hook slot moves, and only when it's hit.
- Check it in a design-pass frame before you move on.
