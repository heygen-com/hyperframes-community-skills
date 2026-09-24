#!/bin/sh
# build.sh: compose → render → master → check. Run from anywhere: sh score/build.sh
#   compose  python3 score.py            events.json + score.mid, from timeline.json
#   render   macOS: swift render.swift   Apple's built-in General MIDI orchestra, offline (no downloads)
#            elsewhere: fluidsynth       with a General MIDI soundfont you point SOUNDFONT at
#   master   ffmpeg loudnorm             -16 LUFS, into assets/audio/score.wav
#   check    python3 qc.py               loudness at every beat, and any dead air
set -e
cd "$(dirname "$0")"
[ -f timeline.json ] || { echo "no score/timeline.json: run scripts/schedule.mjs on this project first"; exit 1; }
python3 score.py
D=$(python3 -c "import json; print(json.load(open('timeline.json'))['duration'])")
DLS=/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls
if [ "$(uname)" = "Darwin" ] && [ -f "$DLS" ] && command -v swift >/dev/null; then
  swift render.swift events.json score-raw.wav
elif command -v fluidsynth >/dev/null && [ -n "$SOUNDFONT" ]; then
  fluidsynth -ni -F score-raw.wav -r 48000 "$SOUNDFONT" score.mid
else
  echo "no renderer here. macOS renders with its built-in orchestra (needs swift: xcode-select --install)."
  echo "Elsewhere: install fluidsynth and set SOUNDFONT to a General MIDI .sf2, or take score/score.mid to any synth."
  exit 1
fi
FADE=$(python3 -c "print(max(0, $D - 0.3))")
mkdir -p ../assets/audio
ffmpeg -y -loglevel error -i score-raw.wav -af "loudnorm=I=-16:TP=-1.5:LRA=14,atrim=0:$D,afade=t=in:st=0:d=0.05,afade=t=out:st=$FADE:d=0.3" -ar 48000 -c:a pcm_s16le ../assets/audio/score.wav
python3 qc.py ../assets/audio/score.wav timeline.json
