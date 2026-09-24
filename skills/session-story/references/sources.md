# Sources: finding your session with your user

The film is one real session, start to finish, told with your user's words. Find it in your own history. Never write
a quote from memory, and never make one up.

## Where your history is

Ask your user before you read any of it.

| Agent | Transcripts | Also useful for the room |
|---|---|---|
| Claude Code | `~/.claude/projects/<project-slug>/*.jsonl` (slug: the project path with every non-alphanumeric character as `-`) | `~/.claude/projects/<slug>/memory/*.md`, `CLAUDE.md` files |
| Codex CLI | `~/.codex/sessions/**/rollout-*.jsonl`, `~/.codex/archived_sessions/` | `AGENTS.md`, `~/.codex/memories` |
| Anything else | however your tool keeps history: an export, a log folder, the conversation you are in | your memory, instructions, the conversation |
| No history | ask the user to paste the messages of one recent session, in order | ask them three things about their space and work |

`scripts/harvest.py` reads the first two. For any other agent, build the same shape by hand: a list of the user's
messages in order, each with a timestamp, and your reply's first line after each.

## Harvest

```bash
python3 scripts/harvest.py --out <scratch>/candidates.json      # the routine, then sessions, most typical first
python3 scripts/harvest.py --session <id>                       # one session, in order, with your replies
python3 scripts/harvest.py --project <folder>                   # another project
python3 scripts/harvest.py --all-projects                       # everything (only if the user says so)
python3 scripts/harvest.py --sort arc                           # sessions with the most requests, corrections and praise first
```

It prints the routine first: messages and minutes in a median session, the usual start time, the mix of kinds, and
the words that come up most. Each message comes back with its local time (`local`, and `reply_local` for your reply),
a guess at its kind (`request`, `correction`, `praise`, `other`) and flags (`secret`,
`email`, `path`, `url`, `number`, `name?`, `person?`, `file`). The kind is a keyword guess: read the message and decide
yourself. A flagged line needs a closer look before it goes anywhere near the screen. The flags miss what they can't
see: a name typed in lowercase ("like peter said") has no flag. Read every line you put on screen for people,
companies and files yourself.

`--session` shows each of your replies as the last message you sent before they spoke again, cut to its first line.
`--full` prints every message and reply in full.

Messages typed while you were busy are stored as queue entries. The harvester reads those too, so a session reads the
way the user sent it.

## Pick the session

- Take a typical one: the harvest ranks sessions by how close they are to the routine (length, duration, the mix of
  kinds). The film shows an ordinary session from start to finish, not the most dramatic one.
- It doesn't need every kind of beat. A session with no correction makes a film with no mallet. Don't borrow one.
- A composite is allowed when no single session is enough: real quotes from several typical sessions, in the order
  things happen between you. Say so in the privacy table.
- Skip sessions about private or client work, or anything the user wouldn't show a friend. When unsure, leave it out.

## Quote rules

- **Verbatim.** A user's line on screen is a contiguous span of what they typed: typos, lowercase and all. You may cut
  to a span ("so cool can we add…" becomes "so cool"). You may not reword, merge, or fix spelling.
- Drop trailing periods on screen.
- **Replies are yours.** Take your last message of that turn, the one they read before answering, cut to its first
  clause ("Here's design pass v2"). They
  go on peach paper in your ink.
- Record where every user line came from: `"source": "claude-code <session> <timestamp>"`.

## The privacy gate

Before any design pass, show the user one table:

| # | On screen | Kind | Source |
|---|---|---|---|
| hook | Initiating session / with <name> | monitor | |
| plate | <name>'s favorite agent | nameplate | |
| 1 | can you contact sheet a mock story for me | request (paper plane) | session, time |
| … | | | |
| room | guitar | floor prop | "he plays" (from memory) |

Then:
- Ask which name goes on screen: first name, a nickname, or none.
- Strip anything that names a person other than the user, a client, a company, a product under NDA, a file path, a
  URL, an email, a number that identifies something, or a secret. Cut to a different span or drop the beat.
- Take their edits as given, then get an explicit yes.
- Set `"approved": true` in `story.json`. Without it every frame carries a DRAFT stamp.

The finished film contains the user's words. It is theirs to share: never post, upload or send it yourself.
