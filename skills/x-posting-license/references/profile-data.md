# Getting the profile data

Everything on the card is real profile data. Two sources cover all of it.

## 1. The logged-out profile page — `https://x.com/<handle>`

Load it in a browser (a browser tool works; plain HTTP fetch gets a JS shell).
The logged-out view reliably shows:

- Display name and @handle (page title: `Name (@handle) / X`)
- Bio, location, **Joined <Month> <Year>**
- **Following** and **Followers** counts

Avatar: collect `img[src]` values containing `profile_images` and pick the
`_400x400` variant — that is the profile photo at full quality. Download it:

```bash
curl -sL "https://pbs.twimg.com/profile_images/<id>/<file>_400x400.jpg" -o avatar.jpg
```

## 2. Post count — the fxtwitter API

The logged-out page usually hides the post count. Fetch it (no auth):

```bash
curl -s "https://api.fxtwitter.com/<handle>"
```

`user.tweets` is the post count; `user.followers` / `user.following` should
match the page scrape (prefer the page numbers if they disagree — they're what
the person sees). If fxtwitter is unavailable, ask the user for their post
count rather than inventing one.

## Formatting

- `--joined` takes `"MMM YYYY"` uppercase (`"JAN 2026"`); the build derives the
  `ISS MM/YYYY` line from it.
- Counts are raw integers; the composition adds thousands separators itself.
- Bio: compress the real bio to one uppercase line, ≤ ~65 chars, fragments
  joined with ` · `. Keep their @mentions verbatim.
