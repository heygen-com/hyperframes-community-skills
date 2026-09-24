# Story: the user's average session, beginning to end

The film is one ordinary session with **this** user, told in time order: how it starts, what the work usually is,
how the user checks in and corrects, how it ends, and what gets kept. It is built from their history, not from a
template day. A user who only codes gets a coding day; one who writes docs gets a writing day. The chapter types
below are a toolbox. The routine decides which ones appear, and in what order.

Every quote, stat and title on screen is a receipt. Captions are narration: the agent's own voice, which needs no
receipt. They still go in the approval table.

## 1. Harvest

```bash
python3 scripts/harvest.py --out <film>/receipts.json [--tz Area/City] [--project SUBSTR]
```

- If `enough` is false (fewer than 10 sessions or 5 active days), tell the user and stop. The session in progress is
  skipped automatically; ignore anything about making this film.
- `routine.steps` is the backbone. It lists what an average working session does, ordered by where it usually happens
  (`medianAt`, 0 = start, 1 = end). `share` is how many sessions do it at all. Steps with `share` of 0.25 or more are
  the user's routine.
- `routine.userLinesAt` says where the user's go-aheads, check-ins, notes and praise usually land in a session.
- `routine.tests.sessionsRedToGreen` counts sessions where a failing test run was later fixed. `routine.commits` and
  `routine.prs` hold real commit messages and PR titles.
- `day` gives the weekday with the most sessions and its usual start time, e.g. `monday, 9:40`.
- `candidates` holds quotable lines per chapter type, oldest to newest. Openers are whole messages; every other type
  is cut to one sentence. Each line carries `ts`, `session`, `flags` and `sessionOpener`, the first line of the
  session it came from.
- `stats` and `repeats` give counts for stickies, e.g. "1 hello in 40 sessions" or "status?" said 9 times.
- `memory.titles` (rules first) and `claudeMdCaps` fill the shelf. `firstEver` is the oldest message still on disk.

## 2. Build the timeline

1. **Frame (always):** `intro` first (arrive, type the command); `kept` then `tag` last (the lesson is shelved, the
   lamp goes out, the next morning).
2. **Middle:** walk `routine.steps` in order and give each common step one chapter, using the map below. Slot the
   user's own lines (`first-message`, `building`, `knock`, `notes`, `good-part`) where `userLinesAt` puts them.
   `first-message` goes right after the arrival.
3. **Budget:** 8 to 13 chapters in all. Merge or drop the weakest steps first. Never add a step the routine doesn't show.

| routine step / user line | chapter type | fill it with |
|---|---|---|
| reading memory / CLAUDE.md at the start | `shelf` | memory titles as spines, a capitals rule as the note |
| read (files) | `shelf` | the most-read file names as spines, the top one as `book` |
| the opener | `first-message` | a real opener from `candidates['first-message']`, plus a stat on the sticky |
| web | `watching` with `kind: "page"` | the page kind as `title` (e.g. "vitest docs") |
| videos / references | `watching` (reel) | `muted: true` only with a real mute ask |
| edit | `diff` | top edited `file`, a `stat` like "+42 -17"; `removed` / `added` only if safe to show |
| test | `terminal` | the real test command; `fail` / `pass` when red-to-green happened |
| build, run, install, deploy, data | `terminal` | the real command head; `done` for the result |
| render / frames | `frames` | a real fps or frame line on the `tape` |
| a go-ahead | `building` | the go-ahead, verbatim |
| a pause / brb / restart | `restart` | the message, verbatim |
| a check-in | `knock` | the repeated check-in, verbatim |
| corrections | `notes` | 3 to 5 notes, verbatim |
| "so close" | `side-by-side` | the line; `labels` from what was compared |
| commit / pr / deploy | `ship` | a real commit message or PR title as `label`; `status` "merged", "pushed" or "deployed" |
| praise | `good-part` | the praise, verbatim |
| the lesson | `kept` | `newBook` from a memory the work produced or a "from now on" ask |

- **Climax:** end the middle on the session's best moment. A `side-by-side` → `good-part` pair (swallow into an
  iris), or `terminal` red → green → `ship` → `good-part`. Give a chapter `"out": "swallow"` to push into ink before
  the payoff.
- **Worked shapes** (examples, not templates):
  - coding: `intro` → `shelf` → `first-message` → `watching`(page) → `diff` → `terminal` → `knock` → `notes` → `ship`
    → `good-part` → `kept` → `tag`.
  - video: `intro` → `shelf` → `first-message` → `watching` → `frames` → `building` → `restart` → `knock` → `notes`
    → `side-by-side` → `good-part` → `kept` → `tag`.

## 3. Write the lines

- **Captions:** lowercase, 1 to 4 words, no trailing period. Narrate what the agent is doing ("reading the docs",
  "running the tests", "a knock", "kept"). `tag` is `day 0`.
- **Quotes:** verbatim, with the user's own case and typos. Drop only a trailing period, cut to one sentence (a
  " - " aside counts as a break), and wrap into lines of 34 characters or fewer by hand. Never paraphrase inside a bubble.
- **Commands and file names:** as run or read, cut to the command head (`npm test`, `cargo build`) or the base name
  (`auth.test.ts`). No paths, flags with secrets, hostnames or project IDs.
- **Stickies:** a count from `stats` or `repeats`, 28 characters or fewer.
- **Title:** `["a day in my life", "as <name>'s agent"]`. Ask the user which name to use. The lettering has a to z,
  space and apostrophe.
- **Spines:** 22 characters or fewer. `newBook`: the lesson in 2 to 4 words.
- **`first-message.link`:** the index of a line that is only a link. It underlines the whole line.

## 4. Privacy gate (mandatory, before any render)

- **Read the context.** Check `sessionOpener` for every line you use, and open the session when unsure. A harmless
  line can come from a private session.
- **Never show:**
  - anything flagged `secret`, `email` or `path` (the validator refuses these)
  - other people's names, in any case (`name?` catches only capitalised ones)
  - private repos, clients, internal tools and their URLs (`url:<domain>` names the domain)
  - anything the user calls private
  - by default, anything whose session is about any of those
- **Approval:** show the user one table: chapter, every on-screen line (captions included), and its source. Take their
  edits. Set `"approved": true` only after an explicit yes.
- **Storage:** `receipts.json` and `story.json` hold the user's words. Keep them in the film folder. Never commit,
  upload or paste them elsewhere.

## `story.json`

```json
{
  "user": "sam",
  "approved": false,
  "chapters": [
    { "type": "intro", "title": ["a day in my life", "as sam's agent"], "caption": "monday, 9:40", "command": "claude" },
    { "type": "first-message", "caption": "a question, no hello", "lines": ["why does the login test only", "fail on ci?"], "sticky": "1 hello in 40 sessions" },
    { "type": "terminal", "caption": "running the tests", "commands": ["npm test"], "fail": "2 failed", "pass": "all passing" },
    { "type": "ship", "caption": "shipping", "label": "fix: mock the clock in auth tests", "status": "merged" },
    { "type": "kept", "caption": "kept", "newBook": "mock the clock", "spines": ["tests before merge", "small commits"] },
    { "type": "tag", "caption": "day 0", "command": "claude" }
  ],
  "receipts": [
    { "chapter": 2, "field": "lines", "session": "3f2a9c1e", "ts": "2026-03-02 09:41" },
    { "chapter": 2, "field": "sticky", "stat": "stats.hellos / stats.openers" },
    { "chapter": 5, "field": "newBook", "memory": "feedback_mock_the_clock.md" }
  ]
}
```

`receipts` is never rendered. `chapter` is 1-based. A source is `session` + `ts`, `stat` (the receipts.json path),
or `memory` (the file). Optional per chapter: `"out"` overrides the seam (`wipe` | `swallow` | `black`); `"events"`
overrides event times in seconds (keep them on the 0.625 s beat grid; the score follows).

Fields per type (the validator requires the first ones listed):
- `intro`: `title`, `caption`, `command`
- `shelf`: `caption`, `spines`, `note`, `book`
- `first-message`: `caption`, `lines`, `sticky`, `link`
- `watching`: `caption`, `kind` (`reel` | `page`), `title`, `muted`
- `frames`: `caption`, `tape`
- `diff`: `caption`, `file`, `stat`, `removed`, `added`
- `terminal`: `caption`, `commands`, `output`, `fail` + `pass` (or `done`)
- `building`, `restart`, `knock`, `good-part`: `caption`, `bubble`
- `notes`: `caption`, `notes`
- `side-by-side`: `caption`, `bubble`, `labels`
- `ship`: `caption`, `label`, `status`
- `kept`: `caption`, `newBook`, `spines`
- `tag`: `caption`, `command`
