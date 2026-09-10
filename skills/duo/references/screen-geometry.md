# Screen geometry

All numbers are source pixels on the 1448×1086 plate. They are baked into
`template/index.template.html`; this file explains them so you can trust them,
and shows how to re-measure if you ever swap in a different device photo.

## Measured

| Element | Value |
| --- | --- |
| Plate | 1448 × 1086 |
| Left screen | x 223–718, y 105–954 (495 × 849) |
| Right screen | x 724–1222, y 105–954 (498 × 849) |
| Outer corner radius (away from hinge) | 56 px |
| Hinge-side corner radius | 12 px |
| Hinge divider | x 719–723 (5 px), rgb(130,133,142), part of the plate |
| Status bar in the photo | `9:41` at left-screen x≈44, wifi + battery at right-screen right≈40, both y≈18 |
| Hands | Never overlap the screens — no foreground matte needed |
| Perspective | Edges fit straight lines to ≤1 px; no homography needed |

The rig implements this as two `position:absolute` boxes with CSS
`border-radius: 56px 12px 12px 56px` (left) and `12px 56px 56px 12px` (right).
`overflow:hidden` on each box is the mask. The divider and the dark bezel that
shows through the corners are the photo's own pixels, untouched.

## Why not segmentation masks

The first version of this rig segmented the bright screen pixels and used the
result as `mask-image`. It looked right at a glance and was wrong in two ways:

1. A morphological close (used to bridge text gaps) filled the 12 px hinge-side
   corners, so the screens ran square into the fold.
2. The brightness threshold swallowed the anti-aliased edge pixels of the hinge
   divider, so the fill painted over them and the divider read thin and pale.

Lesson: for device-screen replacement, measure edges and corners numerically
and build the mask from geometry. Never ship a morphology-cleaned segmentation
as a mask.

## Re-measuring for a new plate

1. Load the photo, convert to grayscale, and scan single rows and columns
   across a screen edge. The screen is bright (>200), the bezel dark (<70),
   the hinge mid-gray. Record the first/last bright pixel per row; a straight
   edge gives a constant value, a perspective edge gives a slope (fit a line).
2. For corner radius, walk rows down from the top edge and record the inset of
   the first bright pixel: inset(k) = r − √(2rk − k²). Solve for r from two rows
   (k=1 and k≈10); the two estimates should agree within a couple of pixels.
3. Blank the screens by drawing exact rounded rects (supersample 4×, then
   downsample) and alpha-blending a flat color only inside them. Leave every
   other pixel alone.
4. Write the rects and radii into `screen-spec.json` and the CSS; snapshot and
   compare 3× crops of each corner against the source before trusting it.
