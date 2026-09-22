#!/usr/bin/env bash
# Cut the portion, build the padded plate + alpha matte + audio for a camera-3d-captions project.
#   prep-take.sh <take.mp4> <start_s> <dur_s> <project/assets> [padTop=480] [padBottom=240] [padSide=240]
# Outputs: portion.mp4 (audio source), plate-tall.mp4 (reflect-padded on all sides so whips, trucks and pull-backs
#          never show an edge),
#          person.webm (VP9 alpha matte of the SAME portion, frame-exact with the plate).
set -euo pipefail
IN="${1:?take}"; SS="${2:?start}"; DUR="${3:?dur}"; OUT="${4:?assets dir}"; PT="${5:-480}"; PB="${6:-240}"; PS="${7:-240}"
mkdir -p "$OUT"
ffmpeg -v error -y -ss "$SS" -i "$IN" -t "$DUR" -r 30 -c:v libx264 -crf 12 -pix_fmt yuv420p -c:a aac -b:a 192k "$OUT/portion.mp4"
ffmpeg -v error -y -i "$OUT/portion.mp4" -filter_complex \
  "[0:v]split=3[m][t][b];[t]crop=iw:${PT}:0:0,vflip[top];[b]crop=iw:${PB}:0:ih-${PB},vflip[bot];[top][m][bot]vstack=inputs=3,split=3[c][l][r];[l]crop=${PS}:ih:0:0,hflip[ll];[r]crop=${PS}:ih:iw-${PS}:0,hflip[rr];[ll][c][rr]hstack=inputs=3[v]" \
  -map "[v]" -an -c:v libx264 -crf 12 -pix_fmt yuv420p "$OUT/plate-tall.mp4"
npx hyperframes@latest remove-background "$OUT/portion.mp4" -o "$OUT/person.webm" --quality best 2>&1 | tr "\r" "\n" | tail -1
ffprobe -v error -show_entries stream=width,height,r_frame_rate:format=duration -of compact "$OUT/plate-tall.mp4" "$OUT/person.webm" 2>/dev/null || true
