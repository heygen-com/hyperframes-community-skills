#!/usr/bin/env bash
# Cut the portion, build the padded plate + alpha matte + audio for a camera-3d-captions project.
#   prep-take.sh <take.mp4> <start_s> <dur_s> <project/assets> [padTop=480] [padBottom=240] [padSide=240]
# Outputs: portion.mp4 (audio source), plate-tall.mp4 (reflect-padded on all sides so whips, trucks and pull-backs
#          never show an edge),
#          person.webm (VP9 alpha matte of the SAME portion, frame-exact with the plate).
set -euo pipefail
HF="hyperframes@0.8.62"                               # the tested CLI version (needs Node 22+)
IN="${1:?take}"; SS="${2:?start}"; DUR="${3:?dur}"; OUT="${4:?assets dir}"; PT="${5:-480}"; PB="${6:-240}"; PS="${7:-240}"
mkdir -p "$OUT"
ffmpeg -v error -y -ss "$SS" -i "$IN" -t "$DUR" -r 30 -c:v libx264 -crf 12 -pix_fmt yuv420p -c:a aac -b:a 192k "$OUT/portion.mp4"
ffmpeg -v error -y -i "$OUT/portion.mp4" -filter_complex \
  "[0:v]split=3[m][t][b];[t]crop=iw:${PT}:0:0,vflip[top];[b]crop=iw:${PB}:0:ih-${PB},vflip[bot];[top][m][bot]vstack=inputs=3,split=3[c][l][r];[l]crop=${PS}:ih:0:0,hflip[ll];[r]crop=${PS}:ih:iw-${PS}:0,hflip[rr];[ll][c][rr]hstack=inputs=3[v]" \
  -map "[v]" -an -c:v libx264 -crf 12 -pix_fmt yuv420p "$OUT/plate-tall.mp4"
npx -y "$HF" remove-background "$OUT/portion.mp4" -o "$OUT/person.webm" --quality best 2>&1 | tr "\r" "\n" | tail -1

# verify: plate and matte must match the portion frame for frame, or every composite drifts
probe() {                                                # -> "W H RATE FRAMES" of the first video stream
  local w h r n k v
  while IFS='=' read -r k v; do
    case "$k" in width) w=$v ;; height) h=$v ;; r_frame_rate) r=$v ;; nb_read_frames) n=$v ;; esac
  done < <(ffprobe -v error -count_frames -select_streams v:0 \
             -show_entries stream=width,height,r_frame_rate,nb_read_frames -of default=noprint_wrappers=1 "$1")
  echo "$w $h $r $n"
}
read -r pw ph pr pn <<< "$(probe "$OUT/portion.mp4")"
read -r tw th tr tn <<< "$(probe "$OUT/plate-tall.mp4")"
read -r mw mh mr mn <<< "$(probe "$OUT/person.webm")"
echo "portion ${pw}x${ph} @${pr} ${pn}f | plate ${tw}x${th} @${tr} ${tn}f | matte ${mw}x${mh} @${mr} ${mn}f"
fail() { echo "prep-take: $1" >&2; exit 1; }
[ "$tw" -eq $((pw + 2 * PS)) ] && [ "$th" -eq $((ph + PT + PB)) ] || fail "plate is ${tw}x${th}, expected $((pw + 2 * PS))x$((ph + PT + PB))"
[ "$mw" -eq "$pw" ] && [ "$mh" -eq "$ph" ] || fail "matte is ${mw}x${mh}, expected ${pw}x${ph}"
[ "$tr" = "$pr" ] && [ "$mr" = "$pr" ] || fail "frame rates differ: portion $pr, plate $tr, matte $mr"
[ "$tn" -eq "$pn" ] && [ "$mn" -eq "$pn" ] || fail "frame counts differ: portion $pn, plate $tn, matte $mn"
echo "prep-take: plate and matte aligned with the portion ($pn frames @ $pr)"
