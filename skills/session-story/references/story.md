# Story: an average session, beginning to end

The film is what a normal session with your user looks like: their routine, in the order it happens, from their first
message to their last. It is not the most dramatic session, and not the example's shape. A developer's film is red
builds, tests and deploys. A writer's is drafts and edits, an analyst's is queries and charts. Tell yours.

## Find the routine

`harvest.py` prints it before the session list: how many messages a session runs, how long, when it usually starts,
how often they correct or praise, and the words that come up most (what you do together).

- Take the most typical session. The harvest lists those first. Read it in order with `--session <id>`.
- Keep its beats in the order they happened, with their real times.
- Put in what happens every time. A rare blow-up stays out unless it's typical.
- Leave out what their sessions don't have. If they rarely correct you, there's no mallet. If they never praise you,
  there's no butterfly.
- A composite of several typical sessions is fine when one alone is too thin. Keep it in time order, and say so in
  the privacy table.

## Building blocks

| what happened | beat | on screen |
|---|---|---|
| an ask, a follow-up, a pasted error, "yes go ahead", "how's it going?" | `request` | a paper plane glides in and unfolds into their words |
| "that's wrong", "why did you…", "no, not that" | `correction` | a mallet bonks you, then turns to show the words on its face |
| "thanks", "nice", "perfect" | `praise` | a butterfly tows the words on a ribbon and lands on your head |
| you working | `work` | you type; the monitor shows the work (see "The screen") |
| your answer, or a question you asked | `reply` | you type it on a sheet, fold a plane and throw it back |

- A correction is friction: the moment they told you that you got it wrong. A bug report is a request.
- A question you asked goes out as a reply ("Which branch?"). Their answer is the next request.
- A break or a long gap: a `long` work between the two timed beats, so the sky moves while you work.
- Any order the session really had works. The first beat is a message from the user, and `schedule.mjs` adds a work
  before any reply that lacks one.
- Up to two butterflies sit on your head. The next correction scares them off, and so does a third praise.

## Beats

| type | text | limit | options |
|---|---|---|---|
| `request` | their words, verbatim | 3 lines, 16 chars a line, 48 total | `"flight": "loop"` for a joyful one. `"react": "excited"` instead of the lightbulb |
| `work` | none | none | `"size"`: `short` (1.25 s), `normal` (1.9 s, a result lands), `long` (4 s, a long run). `"shows"`: see below |
| `reply` | your words | 3 lines, 16 chars a line, 44 total | none |
| `correction` | their words, verbatim | 3 lines, 13 chars a line, 40 total | none |
| `praise` | their words, verbatim | one line, 26 chars | none |

Every beat can take `"time": "HH:MM"` (local, 24-hour). Every user line takes a `"source"`; replies don't need one.
`text` is a string (wrapped for you) or an array of lines (your breaks).

## The screen

`"screen"` is what their work looks like on your monitor: `code` (the default), `tests`, `terminal`, `page` (a web
page), `doc`, `chart` or `image`. A work beat can show something else for itself with `"shows"`. A long run fills in
the same kind of screen, with its progress along the bottom (`image` shows a plain progress bar).

## Time

Put each beat's real local time on it: the harvest gives `local` for their messages and `reply_local` for your
replies. With times, the window and the wall clock follow the session: morning light, the afternoon, dusk, and the
desk lamp at night. A beat without a time sits between its neighbours: work right after what it answers, a reply just
before their next message. With no times at all, the day wears on and the last long work runs into night.

## Ending

`"ending": "next"` (the default): the next request is already on its way in, a wink, the iris closes.
`"ending": "sleep"`: the session's over. You yawn and put your head down, and the monitor goes dark, which bookends the
open. Pick what their sessions do: `next` if they always come back with more, `sleep` if a session wraps up.

## story.json

```json
{
  "user": "Ana",
  "nameplate": "Ana’s favorite agent",
  "hook": ["Initiating session", "with Ana"],
  "screen": "tests",
  "ending": "sleep",
  "cast": "clawd",
  "approved": false,
  "room": { "sill": "succulent", "wallC": "clock", "shelf": ["books", "camera"], "desk": "rubber-duck", "why": { "rubber-duck": "..." } },
  "beats": [
    { "type": "request", "text": "morning! the build is red again", "time": "09:12", "source": "claude-code 1a2b3c4d 09:12" },
    { "type": "request", "text": "also the flaky login test", "time": "09:14", "source": "…" },
    { "type": "work", "size": "long", "shows": "terminal" },
    { "type": "reply", "text": "Both green now", "time": "11:00" },
    { "type": "praise", "text": "nice", "time": "11:02", "source": "…" }
  ]
}
```

- `hook`: up to 3 lines of 19 characters. The default is "Initiating session / with <user>".
- `nameplate`: up to 30 characters. The default is "<user>'s favorite agent".
- `room`: see [room.md](room.md). `cast`: see [cast.md](cast.md). `approved`: see [sources.md](sources.md).

## Three routines

Shapes only, to show how far apart two films can be. The quotes are made up. Yours come from your user.

- **A developer:** "morning! the build is red again" (09:12). "also the flaky login test". A long terminal run.
  "Both green now". "nice". "can you add the export button", with the page on screen. "wait that broke staging" (the
  mallet). "Reverted". "ok ship it" at 19:55. "Shipped". Back to sleep.
- **A writer:** "can you tighten the intro", with the doc on screen. "Cut 40 words". "now the conclusion". "too
  short, bring back the example" (the mallet). "Example's back". "perfect". The next request on its way.
- **An analyst:** "pull last month's signups". A long run, with a chart. "Up 12% on August". "split by country".
  "Done, 14 countries". "exactly what I needed".

## Choosing the spans

- The first request is the session's real first message.
- A correction reads best as the part that stings, not the paragraph around it.
- Praise is short by nature: "so cool", "perfect". The ribbon holds one line.
- Keep their spelling. The marker hand is all capitals, so case doesn't show; spelling does. If they want a typo
  fixed, they'll say so at the privacy gate.
