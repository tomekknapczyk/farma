/**
 * Shared 32-colour palette, based on DawnBringer DB32 with two farm tweaks (warmer gold `y`,
 * softer black `k`). One character per colour so pixel-map rows stay readable; '.' is reserved
 * for transparency.
 *
 * Ramps (light -> dark) used by the art; outlines take the next darker step of the fill:
 *   grass/leaves  G g D c        soil/wood/pony  s t b B p n     wheat/straw  y t A O
 *   snow/chicken  w P e E        water           C L l u i        roof/comb    R r p
 */
export const PALETTE = {
  k: '#140c1c', // black (eyes)
  n: '#222034', // night
  p: '#45283c', // plum (darkest brown, outlines of wood/soil)
  B: '#663931', // dark brown
  b: '#8f563b', // brown
  o: '#df7126', // orange
  t: '#d9a066', // tan
  s: '#eec39a', // sand / skin
  y: '#f6d64a', // gold (ripe wheat, coins)
  G: '#99e550', // light green
  g: '#6abe30', // green
  d: '#37946e', // teal green
  D: '#4b692f', // dark green
  O: '#524b24', // olive dark
  c: '#323c39', // charcoal (green-black outline)
  i: '#3f3f74', // indigo
  u: '#306082', // deep blue
  l: '#5b6ee1', // blue
  L: '#639bff', // light blue
  C: '#5fcde4', // cyan
  P: '#cbdbfc', // pale blue (snow shade)
  w: '#ffffff', // white
  e: '#9badb7', // light grey
  E: '#847e87', // grey
  m: '#696a6a', // mid grey
  M: '#595652', // dark grey
  v: '#76428a', // purple
  r: '#ac3232', // red
  R: '#d95763', // light red
  q: '#d77bba', // pink
  a: '#8f974a', // olive
  A: '#8a6f30', // ochre
} as const satisfies Record<string, string>;

export type PaletteChar = keyof typeof PALETTE;
