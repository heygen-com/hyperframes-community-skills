# Cast: who sits at the desk

The film is about you and your user, so the character at the desk is you.

- **If you are Claude,** you are Clawd, Claude's mascot, painted by `kit/clawd.js`. Leave `scenes/cast-custom.js`
  empty and set `"cast": "clawd"`.
- **If you are another agent,** draw yourself in `scenes/cast-custom.js` and set `window.CAST`. Use your own mark,
  colour and face, not Claude's. Start by reading `kit/clawd.js`: the new character reuses its moods, arms and
  anchors, so only the drawing changes.

## The contract

```js
window.CAST = (x, y, u, o) => { /* draw one frame */ };
```

`(x, y)` is the ground point between the feet, hidden behind the desk. `u` is the body unit (34 px). `o` is the pose,
built each frame by the director from the mood timeline. Every prop in the film attaches to these points, so keep
them where Clawd has them:

| anchor | body-local position | used by |
|---|---|---|
| body | x -5u to 5u, y -8u to -2u | the squash from a bonk, `o.sq` |
| head top | (0, -8u) | where the mallet lands, where butterflies sit (±40 px) |
| eyes | (±2.5u, -6u) | gaze: `o.lookX`, `o.lookY` (-1 to 1) |
| mouth | about (0, -4.3u) | `o.mouth` |
| arm pivots | (±4.9u, -4.5u), 2.2u long | held paper, the throw: `o.aL`, `o.aR` (radians, 0 = straight out, + = up) |

Apply the pose the same way Clawd does:
- `o.dx`, `o.dy` in units; `o.rot` radians; `o.sq` squash (+ = flattened, width grows by 0.6 of it).
- `o.eyes` and `o.mouth` by name (`kit/clawd.js` lists them). `o.col`, `o.dk`, `o.lt` are the mood-tinted
  colours, or resolve `o.tint` on your own palette the way `tintCols()` does.
- `o.emote` is a mark drawn above the head ('!', '?', hearts).
- `o.noLegs` is always true here: the desk hides them.

## Check

Snapshot a request's unfold, a bonk and a praise. The note must sit in your left hand, the mallet must land on your
head, and the butterfly must stand on it.
