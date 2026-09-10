# Sourcing real app UI and clips

When the user asks for a real app (TikTok, Instagram, X, YouTube…) the screen
must look like that app and, if it plays video, play real posts. Do not draw
icons from memory and do not invent usernames or counts.

## Rights first

Every clip, avatar, and glyph you fetch belongs to someone. This recipe is for
parody / commentary / internal-review content the user is entitled to make. Tell
the user what you pulled and from whom (handles, post ids) so they can decide
what to publish. Prefer the user's own posts, or accounts they name.

## Pull the UI from the live mobile site (browser tool)

1. Open the site in the agent browser at a phone viewport (375×812). If the
   browser pane is hidden, clicks and screenshots time out — drive everything
   with JavaScript evaluation instead (`document.querySelector(...).click()`).
2. Mute immediately: `setInterval(() => document.querySelectorAll('video,audio').forEach(v => { v.muted = true; v.volume = 0; }), 300)`.
3. Extract every glyph and its metrics in one pass:

```js
[...document.querySelectorAll('svg')].map(s => {
  const r = s.getBoundingClientRect();
  return { label: s.getAttribute('aria-label') || s.closest('[data-e2e]')?.dataset.e2e || '',
           x: r.x, y: r.y, w: r.width, html: s.outerHTML };
}).filter(s => s.w > 8 && s.w < 80);
```

   TikTok labels glyphs with `data-e2e` (`like-icon`, `comment-icon`, …);
   Instagram uses `aria-label` (`Like`, `Comment`, `Share`, `Reels`, …). Save
   them as `<symbol>` defs — `assets/icons-tiktok.svg` and
   `assets/icons-instagram.svg` in this skill are exactly that output.
4. Read text metrics the same way (`getComputedStyle` → `fontSize`,
   `fontWeight`, `color`) for username, caption, counts, tab labels.

## Pull real posts

- **TikTok**: `yt-dlp "https://www.tiktok.com/@<user>" --playlist-items 1-2 --write-info-json`
  works logged out and returns caption, like/comment/share counts, and duration
  in the `.info.json`. Avatars: the profile page HTML contains
  `"avatarLarger":"…"` (send an iPhone user agent).
- **Instagram Reels**: `yt-dlp` cannot list a profile's reels, but the
  logged-out `instagram.com/reels/` page serves real reels with direct
  `scontent-*.cdninstagram.com/….mp4` URLs on each `<video>`; read them from the
  DOM along with the username, caption, counts and
  `img[alt*="profile picture"]`, then `curl` with a Safari user agent and an
  `instagram.com` Referer. URLs expire within hours — download immediately.
- Trim every clip to the slot: `ffmpeg -ss <start> -t 4.2 -i in.mp4 -vf "scale=540:960:force_original_aspect_ratio=increase,crop=540:960" -an …`.
  Check the trimmed range for hard black cuts (sample mean luma every 0.5 s);
  re-cut from a steady section if any frame drops near black.

## Fidelity checklist

- Real glyphs, real brand reds (`#FE2C55` TikTok, `#FF3040` Instagram).
- Real handles, real counts, real captions (truncate with the app's own
  `… more` treatment, never mid-word).
- App-specific chrome: TikTok `Following | For You` header, black tab bar with
  the two-tone `+`; Reels `Reels ⌄` header with camera, black nav with the
  Reels glyph active.
- Status bar split across the two screens as in the plate (`9:41` left,
  wifi/battery right).
