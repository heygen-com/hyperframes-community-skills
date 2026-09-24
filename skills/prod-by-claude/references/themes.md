# Themes

The palettes are copied from Strudel's own CodeMirror theme definitions (the `settings` and
syntax `styles` of each theme in strudel.cc). `app.js` holds them in `RAW`.

Some original colors are too faint to read as text on video (comments, muted text, and most of
CutiePi on white). The template nudges each text color the smallest amount toward white (dark
themes) or black (light themes) until it reaches 4.6:1 against the background. Backgrounds are
never changed. The code is painted per frame, so `hyperframes check` may report 0 contrast
samples; the nudge is what keeps it readable.

Drops color their graffiti from the theme's syntax colors: fill = strings, outline = keywords,
shadow = numbers, shine = foreground. An outline under 3:1 against its fill is pushed lighter or
darker until it reaches 3:1, or the letters smear (dracula's pink outline darkens). Themes whose
syntax is all one color (bluescreen, blackscreen, whitescreen, archBtw) give one-color graffiti
with a darkened outline; pick a colorful theme for drops.

| Theme | Background | Foreground | Strings | Numbers | Keywords | Good for |
| --- | --- | --- | --- | --- | --- | --- |
| `bluescreen` | #051DB5 | white | white | white | white | the opening, Strudel's classic look |
| `blackscreen` | black | white | white | white | white | a stark intro or outro |
| `whitescreen` | white | black | black | black | black | a breakdown |
| `fruitDaw` | rgb(84, 93, 98) | mint | lime | sky blue | orange | parts entering, colorful syntax |
| `redText` | black | #bd312a | #ff5356 | #ff5356 | #bd312a | builds |
| `greenText` | black | #56bd2a | #8ed675 | #8ed675 | #56bd2a | builds, terminal feel |
| `archBtw` | black | cyan | cyan | cyan | cyan | a cold section |
| `sonicPink` | black | #ededed | #ff1493 | #4c83ff | #fbde2d | drops (pink, blue, yellow graffiti) |
| `CutiePi` | white | #5c019a | #9acd3f | #d19a66 | #5c019a | a breakdown after a dark drop |
| `dracula` | #282a36 | #f8f8f2 | #f1fa8c | #BD93F9 | #ff79c6 | drops, the ending |

To add another Strudel theme, copy its settings (`background`, `foreground`, `muted`,
`gutterForeground`, `lineHighlight`) and styles (`comment`, `string`, `number`, `keyword`,
`labelName`, function and property names, `variableName`) into `RAW` with the same keys.
