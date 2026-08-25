# Worked recipes

All commands run from `scripts/`. Same seed = identical output; iterate one
dial at a time.

## A1 — phrase writes itself, camera pans along

```
node render-anim.mjs sketches/handwriting.anim.js out/master.mp4 \
  --size 4800x1350 --fps 24 --hold 48 --seed 23 --keep-frames 1 \
  --inject 'PHRASE="something about me is";SIZE=150'
```

Render WIDE (the paper world), then crop a 16:9 camera path through the kept
frames along `out/master.track.json`:

```python
# per frame i: viewport height 675, follow pen x with lag, LOCK y to baseline
cx += (pen[i][0] + 100 - cx) * 0.14          # +100 = lead ahead of the pen
y0  = BASELINE_Y - 40 - 675/2                 # constant — no vertical bounce
crop(int(cx - 600), int(y0), 1200, 675) -> resize to output
```

Stitch at the same fps. End the move with a cosine ease to a wider viewport,
or keep panning into the next element (elements slide, paper stays).

## A2 — word-synced writing over a voiceover

Transcribe the VO to word timestamps (`npx hyperframes transcribe`).
Give each word its own write window: start its strokes at the word's spoken
start. For big display words, render each word as its own element and slide it
in at its timestamp (expo-out ease `1-2^(-9t)`, ~0.65s, 500–750px travel,
directional smear: 3–7 stacked copies along the per-frame velocity).

## B1 — portrait photo → wallpaper-grade painting

```
ffmpeg -i photo.jpg -vf "crop=<4:5 or 9:16 crop centered on subject>" crop.jpg
node render.mjs sketches/repaint.anim.js out/painted.png \
  --size 1170x2532 --seed 11 --image crop.jpg --inject "STYLE=0;DETAIL=5"
```

DETAIL ladder: 2 fast painterly / 3 faces resolve / 5 hero-still polish.
Render two seeds, pick the cleaner face.

## B2 — photo paints itself, subject first, camera pulls out

```
node render-anim.mjs sketches/repaint.anim.js out/film.mp4 \
  --size 720x900 --seed 3 --image crop.jpg --fps 14 --hold 40 --keep-frames 1 \
  --inject 'STYLE=0;DETAIL=3;SUBJECT="0.5,0.5,0.44,0.55"'
```

The run prints `markers {"subject-done":N}`. Camera: tight on the face while
the subject paints (slow 1.95→1.85 creep so the hold breathes), then from
frame N ease to full frame over ~28 frames:

```
ffmpeg -i film.mp4 -vf "scale=2x:2x:flags=lanczos,zoompan=\
z='if(lte(in,N),1.95-0.1*in/N,1.85-0.85*(0.5-0.5*cos(PI*min((in-N)/28,1))))':\
x='iw/2-(iw/zoom/2)':y='(ih*(0.32+0.18*(0.5-0.5*cos(PI*min(max((in-N)/28,0),1)))))-(ih/zoom/2)':\
d=1:s=WxH:fps=FPS" out/final.mp4
```

If the subject ellipse clips hair/limbs, background strokes will paint over the
finished subject — widen the ellipse and re-render.

## C1 — Live Photo → breathing loop

```
# 1. triage motion
ffprobe -f lavfi "movie=live.mov,signalstats" \
  -show_entries frame_tags=lavfi.signalstats.YDIF -of csv=p=0
# 2. paint the calm window (say first 1.05s)
node render-video.mjs live.mov out/painted.mp4 \
  --size 720x900 --fps 12 --seed 7 --start 0 --dur 1.05 --inject "STYLE=0;DETAIL=2"
# 3. ping-pong loop
ffmpeg -i out/painted.mp4 -filter_complex \
  "[0]split[a][b];[b]reverse[r];[a][r]concat=n=2,loop=loop=2:size=<2xframes>" out/loop.mp4
```

## C2 — full clip with camera motion (world mode)

```
node render-video.mjs clip.mov out/painted.mp4 \
  --size 720x900 --fps 12 --seed 7 --inject "STYLE=0;DETAIL=2;WORLD=1"
```

Strokes ride the scene; new stroke tiles spawn as the camera reveals territory.
Expect painterly abstraction wherever the source is motion blur — that's the
source, not a bug. DETAIL=3 wires finer feature grids through video mode when
faces are close.

## C3 — subject-only painting on paper

```
mkdir mattes && for f in frames/*.png; do
  npx hyperframes remove-background "$f" -o "mattes/$(basename $f)"; done
node render-video.mjs ignored out/painted.mp4 --frames mattes \
  --size 1200x676 --fps 12 --seed 7 \
  --inject 'STYLE=0;DETAIL=1;MASKED=1;BG="#f6f5f0"'
```

Composite the result over ruled paper by diffing against the flat BG color
(diff > 8 → alpha): the strokes become an element; the paper shows through.
