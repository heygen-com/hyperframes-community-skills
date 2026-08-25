# Plain-Sight Script

~150 words per 60s at a casual read. A full 9-beat spine at honest
density is ~225 words ≈ 90s — that is the CEILING. If the tightest honest
cut still exceeds it, cut a beat (cut-don't-fake); never speed the read
past ~1.1x to fit. Write the observation first, then the
sentence in front of it. When ghost-writing for a named person, load their
voice skill first — it outranks everything here except facts.

## Beat spine

1. **FAMILIAR** — [ordinary moment, nothing at stake] → [the noticing]. The
   on-ramp must be a habit anyone could swap into ("check your last ten
   texts", "have you ever seen the map of your district"). Never invented
   biography (no named relatives, hometowns, trips). The "I" is a camera any
   viewer can climb into; specificity lives in the artifacts.
2. **THE FAMILY** — 3-4 more instances, one per phrase; nicknames and real
   labels do the delight work.
3. **THE DIG** — one sentence: "So I looked into X - and it comes back to
   [person]." The cut IS the transition; name the person here. Source mode
   with person waived: the dig lands on the artifact instead — the code,
   the map, the number ("...and it comes back to a zoning map drawn in
   [year]"). Same shape, same cut.
4. **STORY** — date + place + the three facts, WITH the why (intent and
   method before result: "redraws the districts to capture votes - packing
   the opposition...").
5. **THE ARTIFACT** — the one physical receipt held on screen (a patent page,
   a scan, a first edition) while the VO states only what the eye confirms.
6. **MECHANISM** — the viewer-verifiable beat, written as what happens on
   screen ("Draw the lines one way... draw them the other way").
7. **SECOND WIND** — a constraint removed, stated as facts. Never a
   personification pivot ("the map met the computer") or an adjective doing a
   transition's job ("the trick got surgical").
8. **THESIS** — the earned generalization, ≤2 sentences, zero metaphors.
9. **CLOSE** — end on facts the viewer doesn't have, mirroring the open.
   Mirror-punchlines that restate the reveal ("It isn't an accident") are
   banned — same disease as scaffolding openers.

## The source is invisible

When the input is a supplied document (memo, strategy doc, report, deck), the VO never
refers to it. No "the memo says", "there's a table in it", "according to the doc", no
quoting the source AS a source. Facts and quoted lines come through as the film's own
assertions; attributed quotes live on screen with the speaker's name, never in narration.
Test: if a line only parses for someone who has read the original, cut it.

The document is the agent's input, not the viewer's context.

## Banned everywhere (the tells)

- Reveal-declaratives: "Nobody signed these", "It's a system".
- Source callbacks: "the memo", "the doc", "as written", "the four rows".
- Fake-candid openers: "Here's the trick", "Here's the thing".
- Restating what the demo just proved ("Different map." after showing it).
- Editorializing qualifiers: "the best answer ever given", "the honest way",
  "even America".
- Anything failing the deletion test: delete each sentence; if the reader
  loses no underivable fact, it stays deleted.

## VO production

- TTS input = pronunciation script: numbers as words ("nineteen sixty-three"),
  names spelled phonetically. Display text keeps real spellings.
- Whisper-transcribe the TTS output: it is both the timing source AND a cheap
  pronunciation audit.
- A replacement VO (e.g. a human ElevenLabs read) = a FULL retime; captions
  update to the performed wording verbatim, including ad-libs.
- Single-line edits: TTS the one sentence, splice the audio, shift all
  downstream times by the delta (raw step arrays too, not just wrapped times).
