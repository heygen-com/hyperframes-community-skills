# Third-party code

`kit/core.js`, `kit/clawd.js` and `kit/timeline.js` are adapted from
[ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) by John Heibel, commit `b1d7e89`, under the
MIT license in `LICENSE-ClaudeAnimationBase`. Readable source, modified as follows:

- `core.js`: letters take an optional 2×2 matrix (`mat`) and axis scales (`sx`, `sy`) so text can lie on a 3D face;
  `setup()` hands control to the HyperFrames bridge when it is present; `window.paintAt(t)` paints a frame for it; a
  comment that pointed at the upstream guide is shortened.
- `clawd.js`: a mood change hands its colour cross-fade to the character as tint parameters (`tintFrom`, `tintMixK`),
  so the mood timeline works on any character's palette; per-leg `legLift` / `legSwing` and a stride weight `walkK`;
  one more mood, `ouch`.
- `timeline.js`: unchanged.

`kit/hf-bridge.js` and everything in `scenes/` are original to this skill.
Browser libraries are not copied here: `scripts/setup.sh` installs p5 2.3.3 (LGPL-2.1), p5.brush 2.2.3 (MIT) and the
Permanent Marker font (Apache-2.0, via @fontsource/permanent-marker 5.3.0) from npm, pinned by `scripts/package-lock.json`.
