# Screen recipes

Patterns that have shipped inside the slots. Each assumes the slot's own
coordinate system (left 495×849, right 498×849) and the single shared `tl`.

## Full-screen snap feed (TikTok / Reels)

Stack posts vertically at the slot height and translate the stack.

```html
<div class="feed" id="tt-feed">                 <!-- position:absolute; top:0 -->
  <div class="post">                           <!-- width:495px; height:849px; position:relative; overflow:hidden -->
    <video class="clip" src="assets/clip1.mp4" data-start="0"   data-duration="3.0" muted playsinline></video>
    <!-- overlays: right rail, caption, music line -->
  </div>
  <div class="post">
    <video class="clip" src="assets/clip2.mp4" data-start="2.3" data-duration="3.3" muted playsinline></video>
  </div>
</div>
<!-- fixed chrome (status text, tabs, bottom bar) sits OUTSIDE .feed so it does not scroll -->
```

Clip windows overlap the swipe: post 1 ends at 3.0, post 2 starts at 2.3, the
swipe runs 2.35–2.95. Both are decoded while both are visible. Give each
`.post` a black background so a clip outside its window reads as a dark card,
not a hole.

## Swipe physics (drag → fling)

A real flick has two phases: the finger drags the content a short way, then
releases and the content flings to the snap point. Two chained tweens, an
accelerating ease then a decelerating one — the release is the visible cause of
the direction/speed change.

```js
const H = 849;
const flick = (sel, t, n, drag = 120, d1 = 0.18, d2 = 0.42) => {
  tl.to(sel, { y: -H * (n - 1) - drag, duration: d1, ease: 'power1.in' }, t);       // finger drag
  tl.to(sel, { y: -H * n,            duration: d2, ease: 'power3.out' }, t + d1);  // release fling
};
gsap.set('#tt-feed', { y: 0 });
flick('#tt-feed', 2.35, 1);
flick('#tt-feed', 4.95, 2);
flick('#tt-feed', 7.55, 3);
```

Offset the two screens' flick times so one side is always mid-swipe or landing
while the other side's clip plays (e.g. right screen at 1.15 / 3.75 / 6.25).
Never mirror: both feeds swipe up.

## Like tap (TikTok heart)

```js
gsap.set('#tt-heart2', { scale: 1, transformOrigin: '50% 50%' });
tl.to('#tt-heart2', { fill: '#fe2c55', duration: 0.06 }, 3.9);
tl.to('#tt-heart2', { keyframes: [
  { scale: 0.7, duration: 0.08, ease: 'power2.in'  },   // squash
  { scale: 1.3, duration: 0.14, ease: 'power2.out' },   // pop
  { scale: 1.0, duration: 0.18, ease: 'power2.inOut' }
] }, 3.9);
```

Fire it while that post is at rest, not mid-swipe. TikTok red is `#FE2C55`;
Instagram red is `#FF3040`.

## Double-tap like (Instagram big heart)

```js
gsap.set('#ig-bigheart', { autoAlpha: 0, scale: 0.4, transformOrigin: '50% 50%' });
tl.to('#ig-bigheart', { keyframes: [
  { autoAlpha: 1, scale: 1.15, duration: 0.20, ease: 'back.out(1.6)' },
  { scale: 1.0,  duration: 0.16, ease: 'power2.inOut' },
  { autoAlpha: 0, scale: 0.9, duration: 0.28, ease: 'power2.in', delay: 0.22 }
] }, 2.55);
tl.set('#ig-heart-use', { attr: { href: '#ig-like-filled' } }, 2.7);   // swap outline → filled glyph
tl.to('#ig-heart-svg', { fill: '#ff3040', duration: 0.08 }, 2.7);
```

Put the big heart inside the post it belongs to so it scrolls away with it.

## Chat typing (ChatGPT / Claude style)

Reveal a reply word by word with `tl.set` on `textContent`, or by toggling
pre-rendered `<span>`s with `autoAlpha` on a stagger. Use a scarce typing
indicator (three dots, finite `repeat`, never `-1`) before the reply lands, and
stop it the frame the first word appears. Both chats answering the same prompt
should start typing at different times so the two screens never sync.

## Metrics that read as "real" (from the live mobile DOMs, 375 px viewport)

Scale by ~1.2 for these 495/498 px slots.

| App | Element | Measured |
| --- | --- | --- |
| TikTok | rail icons | 32 px, 65 px vertical pitch, counts 13 px / 600 |
| TikTok | username / caption / music | 17 px 600 / 15 px / 15 px |
| TikTok | bottom tab bar | 49 px, icons 32 px, labels 10 px, `+` button 75×49 |
| Instagram Reels | rail icons | 24 px, 64 px pitch, counts 12 px / 400 |
| Instagram Reels | avatar / username / follow pill | 32 px / 14 px 600 / 58×32 bordered |
| Instagram Reels | bottom nav | 45 px, icons 24 px at x 26 / 101 / 176 / 251 / 326 |

Both apps use the system font (`-apple-system` stack).
