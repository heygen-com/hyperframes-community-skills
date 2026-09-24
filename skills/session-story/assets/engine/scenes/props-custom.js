// props-custom.js: props you draw for your own user, when the library (props.js) has nothing true to them.
// Register each one for a slot, then name it in story.json's "room". Recipe and brush vocabulary: references/room.md.
//
// PROPS['bonsai'] = { slot: 'sill', draw(b, env, o) {
//   const { x, y } = b;                                   // the sill anchor: the pot's base centre
//   paint([[x - 30, y - 40], [x + 30, y - 40], [x + 24, y], [x - 24, y]], { wash: PAL.clay, ink: PAL.ink, sw: .7 });
//   paint(ellPts(x, y - 90, 44, 30, 16, 1), { wash: PAL.sap, ink: PAL.ink, sw: .6 });
// } };
