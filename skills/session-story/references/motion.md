# Motion: how the engine moves things, and why

The objects sell the film by moving like real ones. These are the rules the engine is tuned to. Keep them if you fix
or extend `scenes/director.js`.

## Everything is a pure function of t

HyperFrames seeks frames in any order, so nothing carries over from one frame to the next. Integrate from a fixed
start when you need history: the butterfly's wingbeat phase sums its frequency from its first frame, and the ribbon
walks back along the path the butterfly flew.

## Paper (`scenes/paper.js`)

- One model is the flat note, every stage of folding and the plane in flight. The classic dart folds in four stages:
  both top corners to the centre line, in half, then the wings down.
- Every crease is a line on the paper itself. Folds apply latest-first about their creases, so partial and
  overlapping folds are rigid and correct.
- Fold stages overlap by about 39% on the 7× ease (`cubic-bezier(.857, 0, .143, 1)`), and each crease springs back a
  hair as it settles.
- A hand holds a corner (`pin`), and the sheet folds around that point. A crease line draws only once its fold is made.
- Turn the plane three-quarters while the wings fold, or it reads as an edge-on sliver.

## Flight

- A paper plane glides at about 3:1, so from the window to the desk it needs a long banked path: a circle in at the
  window, behind the head, round the right side and down onto the pad. It porpoises (the phugoid), flares, touches
  down with a hop and slides to a stop on friction.
- A thrown plane leaves with the hand's velocity. Release while the arm still points up and back, so the hand moves
  up and toward the window.

## The mallet

- It is a real 3D object projected orthographically, so the swing, the bonk and the turn share one geometry.
- It hangs in frame on a short arc, cocks back (a held breath), accelerates into the hit and rebounds off the head
  it squashes. The head flattens, springs back past round, and settles.
- It lifts off the head before it turns. It's heavy, so the twist is a slow ease-in-out with a few degrees of
  overshoot, not a snap. The words sit on the striking face.
- Everything on the desk reacts to the hit on the same frame: the mug hops, the headphones swing, the keyboard jumps,
  the camera shakes.

## Butterflies

- The body lifts on the downstroke. The wingbeat speeds up to brake before landing and slows to a stop after it.
- The ribbon trails along the real flight path, then drapes from the head down to the desk.

## The agent

- No idle motion. Every stretch of the film belongs to an action: reading, typing, folding, throwing, reacting.
- A reaction starts on the frame of its cause. The bonk's squash comes from the blow, not from the mood.
- A heavy moment gets a beat of stillness before it: the mallet's hang, the held breath before the throw.
