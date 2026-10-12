/**
 * Material 3 Expressive / Material Design 3 theme engine.
 * ...
 */
/**
 * ============================================================================
 *  Material 3 Expressive / Material Design 3 theme engine
 * ============================================================================
 *
 *  A dependency-free, framework-agnostic implementation of the Material Design 3
 *  (2025 spec) colour system - the same colour science that powers
 *  `@material/material-color-utilities`, hand-ported so it can be:
 *
 *    • imported by an Astro `<script>` (bundled / tree-shaken), and
 *    • inlined verbatim into `<head>` to avoid a flash of unthemed content.
 *
 *  What it does
 *  ------------
 *  1. Takes an accent *source* (a hue + chroma, or a hex colour).
 *  2. Builds the six core tonal palettes from the chosen scheme variant
 *     (expressive, tonalSpot, vibrant, neutral, rainbow, monochrome, fidelity).
 *  3. Maps every Material colour *role* (primary, onPrimaryContainer, surface,
 *     outlineVariant, …) onto a tone of one of those palettes, per light/dark.
 *  4. Emits the full `--md-sys-color-*` custom property set as CSS, plus the
 *     `--md-sys-color-*` chromatic ramp used by the seed picker.
 *
 *  Colour science notes
 *  -------------------
 *  HCT (Hue / Chroma / Tone) is CAM16 appearance + CIE L* tone. `tone` is the
 *  L* of the colour, which is what makes Material's tonal palettes perceptually
 *  even. The HCT solver below is a faithful port of `HctSolver` from
 *  material-color-utilities (Apache-2.0).
 *
 *  Source: https://github.com/material-foundation/material-color-utilities
 *  License: Apache-2.0
 */

/* ---------------------------------------------------------------------------
 * Small numeric helpers
 * ------------------------------------------------------------------------- */

const clamp = (min, max, x) => (x < min ? min : x > max ? max : x);
const clampDouble = clamp;
const lerp = (start, stop, amount) => (1 - amount) * start + amount * stop;
const signum = (x) => (x < 0 ? -1 : x === 0 ? 0 : 1);

/** Wrap degrees into [0, 360). */
const sanitizeDegrees = (deg) => ((deg % 360) + 360) % 360;

/** Circular distance between two angles, in degrees. */
const differenceDegrees = (a, b) => 180 - Math.abs(Math.abs(a - b) - 180);

/** Multiply a 1x3 row vector by a 3x3 matrix. */
function matrixMultiply(row, matrix) {
  return [
    row[0] * matrix[0][0] + row[1] * matrix[0][1] + row[2] * matrix[0][2],
    row[0] * matrix[1][0] + row[1] * matrix[1][1] + row[2] * matrix[1][2],
    row[0] * matrix[2][0] + row[1] * matrix[2][1] + row[2] * matrix[2][2],
  ];
}

/* ---------------------------------------------------------------------------
 * sRGB <-> XYZ <-> L*a*b* primitives
 * ------------------------------------------------------------------------- */

const SRGB_TO_XYZ = [
  [0.41233895, 0.35762064, 0.18051042],
  [0.2126, 0.7152, 0.0722],
  [0.01932141, 0.11916382, 0.95034478],
];

const XYZ_TO_SRGB = [
  [3.2413774792388685, -1.5376652402851851, -0.49885366846268053],
  [-0.9691452513005321, 1.8758853451067872, 0.04156585616912061],
  [0.05562093689691305, -0.20395524564742123, 1.0571799111220335],
];

const WHITE_POINT_D65 = [95.047, 100.0, 108.883];

const linearized = (c) => {
  const n = c / 255;
  return n <= 0.040449936 ? (n / 12.92) * 100 : Math.pow((n + 0.055) / 1.055, 2.4) * 100;
};

const delinearized = (c) => {
  const n = c / 100;
  const v = n <= 0.0031308 ? n * 12.92 : 1.055 * Math.pow(n, 1 / 2.4) - 0.055;
  return Math.round(clamp(0, 255, v * 255));
};

const labF = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27) * t / 116 + 16 / 116);
const labInvf = (ft) => {
  const ft3 = ft * ft * ft;
  return ft3 > 216 / 24389 ? ft3 : (116 * ft - 16) / (24389 / 27);
};

/** CIE L* -> relative luminance Y. */
function yFromLstar(lstar) {
  return 100 * labInvf((lstar + 16) / 116);
}

/** Relative luminance Y -> CIE L*. */
function lstarFromY(y) {
  return 116 * labF(y / 100) - 16;
}

function argbFromRgb(r, g, b) {
  return ((255 << 24) | ((r & 255) << 16) | ((g & 255) << 8) | (b & 255)) >>> 0;
}

function argbFromLinrgb(linrgb) {
  return argbFromRgb(delinearized(linrgb[0]), delinearized(linrgb[1]), delinearized(linrgb[2]));
}

function argbFromXyz(x, y, z) {
  const m = XYZ_TO_SRGB;
  return argbFromLinrgb([
    m[0][0] * x + m[0][1] * y + m[0][2] * z,
    m[1][0] * x + m[1][1] * y + m[1][2] * z,
    m[2][0] * x + m[2][1] * y + m[2][2] * z,
  ]);
}

function xyzFromArgb(argb) {
  const r = linearized((argb & 0x00ff0000) >> 16);
  const g = linearized((argb & 0x0000ff00) >> 8);
  const b = linearized(argb & 0x000000ff);
  return matrixMultiply([r, g, b], SRGB_TO_XYZ);
}

function labFromArgb(argb) {
  const [x, y, z] = xyzFromArgb(argb);
  const fx = labF(x / WHITE_POINT_D65[0]);
  const fy = labF(y / WHITE_POINT_D65[1]);
  const fz = labF(z / WHITE_POINT_D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labFromLinrgb(linrgb) {
  const [x, y, z] = matrixMultiply(linrgb, SRGB_TO_XYZ);
  const fx = labF(x / WHITE_POINT_D65[0]);
  const fy = labF(y / WHITE_POINT_D65[1]);
  const fz = labF(z / WHITE_POINT_D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function lstarFromArgb(argb) {
  return lstarFromY(xyzFromArgb(argb)[1]);
}

function lstarFromLinrgb(linrgb) {
  return labFromLinrgb(linrgb)[0];
}

/** L* -> grayscale ARGB. */
function argbFromLstar(lstar) {
  const y = yFromLstar(lstar);
  const c = delinearized(y);
  return argbFromRgb(c, c, c);
}

/* ---------------------------------------------------------------------------
 * Hex <-> int
 * ------------------------------------------------------------------------- */

const hexFromArgb = (argb) => {
  const r = (argb & 0x00ff0000) >> 16;
  const g = (argb & 0x0000ff00) >> 8;
  const b = argb & 0x000000ff;
  const p = (n) => n.toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`;
};

function argbFromHex(hex) {
  let s = String(hex).trim().replace(/^#/, "");
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (s.length === 8) s = s.slice(2);
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error(`unexpected hex ${hex}`);
  }
  const n = parseInt(s, 16);
  return ((255 << 24) | n) >>> 0;
}

/** Relative luminance of an sRGB colour (for contrast ratios). */
function luminanceFromArgb(argb) {
  const [x, y] = xyzFromArgb(argb);
  return y / 100;
}

/** WCAG contrast ratio between two ARGB colours. */
function contrastRatio(a, b) {
  const la = luminanceFromArgb(a);
  const lb = luminanceFromArgb(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix two ARGB colours in linear space. `amount` 0 = a, 1 = b. */
function blendArgb(fg, bg, amount) {
  const f = [linearized((fg & 0xff0000) >> 16), linearized((fg & 0xff00) >> 8), linearized(fg & 0xff)];
  const b = [linearized((bg & 0xff0000) >> 16), linearized((bg & 0xff00) >> 8), linearized(bg & 0xff)];
  return argbFromLinrgb([
    lerp(f[0], b[0], amount),
    lerp(f[1], b[1], amount),
    lerp(f[2], b[2], amount),
  ]);
}

/**
 * Build a "state layer" colour: `onColor` at `opacity` over `containerColor`.
 * Material 3's interaction states are exactly this (8% hover, 10% press…).
 */
export function stateLayer(onColor, containerColor, opacity) {
  return hexFromArgb(blendArgb(argbFromHex(onColor), argbFromHex(containerColor), opacity));
}

/* ---------------------------------------------------------------------------
 * Viewing conditions (sRGB default) and CAM16
 * ------------------------------------------------------------------------- */

function makeViewingConditions() {
  const [x, y, z] = WHITE_POINT_D65;
  const rW = x * 0.401288 + y * 0.650173 + z * -0.051461;
  const gW = x * -0.250268 + y * 1.204414 + z * 0.045854;
  const bW = x * -0.002079 + y * 0.048952 + z * 0.953127;
  const f = 1.0; // surround = 2.0  ->  f = 0.8 + 2.0/10
  const c = lerp(0.59, 0.69, (f - 0.9) * 10);
  const adaptingLuminance = (200 / Math.PI) * yFromLstar(50) / 100;
  const d = f * (1 - (1 / 3.6) * Math.exp((-adaptingLuminance - 42) / 92));
  const dc = clamp(0, 1, d);
  const nc = f;
  const rgbD = [
    dc * (100 / rW) + 1 - dc,
    dc * (100 / gW) + 1 - dc,
    dc * (100 / bW) + 1 - dc,
  ];
  const k = 1 / (5 * adaptingLuminance + 1);
  const k4 = k * k * k * k;
  const k4F = 1 - k4;
  const fl = k4 * adaptingLuminance + 0.1 * k4F * k4F * Math.cbrt(5 * adaptingLuminance);
  const n = yFromLstar(50) / WHITE_POINT_D65[1];
  const zc = 1.48 + Math.sqrt(n);
  const nbb = 0.725 / Math.pow(n, 0.2);
  const ncb = nbb; // background 50
  const rgbAFactors = [
    Math.pow((fl * rgbD[0] * rW) / 100, 0.42),
    Math.pow((fl * rgbD[1] * gW) / 100, 0.42),
    Math.pow((fl * rgbD[2] * bW) / 100, 0.42),
  ];
  const rgbA = [
    (400 * rgbAFactors[0]) / (rgbAFactors[0] + 27.13),
    (400 * rgbAFactors[1]) / (rgbAFactors[1] + 27.13),
    (400 * rgbAFactors[2]) / (rgbAFactors[2] + 27.13),
  ];
  const aw = (2 * rgbA[0] + rgbA[1] + 0.05 * rgbA[2]) * nbb;
  return { n, aw, nbb, ncb, c, nc, rgbD, fl, fLRoot: Math.pow(fl, 0.25), z: zc };
}

const VIEWING_CONDITIONS = makeViewingConditions();
const VC = VIEWING_CONDITIONS;

/** ARGB -> {hue, chroma} in CAM16. */
function cam16FromInt(argb) {
  const r = linearized((argb & 0x00ff0000) >> 16);
  const g = linearized((argb & 0x0000ff00) >> 8);
  const b = linearized(argb & 0x000000ff);
  const x = 0.41233895 * r + 0.35762064 * g + 0.18051042 * b;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = 0.01932141 * r + 0.11916382 * g + 0.95034478 * b;
  const rC = 0.401288 * x + 0.650173 * y - 0.051461 * z;
  const gC = -0.250268 * x + 1.204414 * y + 0.045854 * z;
  const bC = -0.002079 * x + 0.048952 * y + 0.953127 * z;
  const rD = VC.rgbD[0] * rC;
  const gD = VC.rgbD[1] * gC;
  const bD = VC.rgbD[2] * bC;
  const rAF = Math.pow((VC.fl * Math.abs(rD)) / 100, 0.42);
  const gAF = Math.pow((VC.fl * Math.abs(gD)) / 100, 0.42);
  const bAF = Math.pow((VC.fl * Math.abs(bD)) / 100, 0.42);
  const rA = (signum(rD) * 400 * rAF) / (rAF + 27.13);
  const gA = (signum(gD) * 400 * gAF) / (gAF + 27.13);
  const bA = (signum(bD) * 400 * bAF) / (bAF + 27.13);
  const a = (11 * rA - 12 * gA + bA) / 11;
  const bChroma = (rA + gA - 2 * bA) / 9;
  const u = (20 * rA + 20 * gA + 21 * bA) / 20;
  const p2 = (40 * rA + 20 * gA + bA) / 20;
  const hue = sanitizeDegrees((Math.atan2(bChroma, a) * 180) / Math.PI);
  const ac = p2 * VC.nbb;
  const j = 100 * Math.pow(ac / VC.aw, VC.c * VC.z);
  const huePrime = hue < 20.14 ? hue + 360 : hue;
  const eHue = 0.25 * (Math.cos((huePrime * Math.PI) / 180 + 2) + 3.8);
  const p1 = (50000 / 13) * eHue * VC.nc * VC.ncb;
  const t = (p1 * Math.sqrt(a * a + bChroma * bChroma)) / (u + 0.305);
  const alpha = Math.pow(t, 0.9) * Math.pow(1.64 - Math.pow(0.29, VC.n), 0.73);
  return { hue, chroma: alpha * Math.sqrt(j / 100), j };
}

/** ARGB -> HCT {hue, chroma, tone}. */
export function hctFromInt(argb) {
  const { hue, chroma } = cam16FromInt(argb);
  return { hue, chroma, tone: lstarFromArgb(argb) };
}

/** HCT components -> ARGB (the solver proper follows). */
function intFromHct(hue, chroma, tone) {
  return HCT_SOLVER.solveToInt(hue, chroma, tone);
}

/**
 * Numeric constants for the HCT solver.
 *
 * Ported verbatim from material-color-utilities (Apache-2.0), file
 * hct/hct_solver.js. AUTO-EXTRACTED - do not edit by hand.
 */
export const SCALED_DISCOUNT_FROM_LINRGB = [ [ 0.001200833568784504, 0.002389694492170889, 0.0002795742885861124, ], [ 0.0005891086651375999, 0.0029785502573438758, 0.0003270666104008398, ], [ 0.00010146692491640572, 0.0005364214359186694, 0.0032979401770712076, ], ];
export const LINRGB_FROM_SCALED_DISCOUNT = [ [ 1373.2198709594231, -1100.4251190754821, -7.278681089101213, ], [ -271.815969077903, 559.6580465940733, -32.46047482791194, ], [ 1.9622899599665666, -57.173814538844006, 308.7233197812385, ], ];
export const Y_FROM_LINRGB = [0.2126, 0.7152, 0.0722];
export const CRITICAL_PLANES = [ 0.015176349177441876, 0.045529047532325624, 0.07588174588720938, 0.10623444424209313, 0.13658714259697685, 0.16693984095186062, 0.19729253930674434, 0.2276452376616281, 0.2579979360165119, 0.28835063437139563, 0.3188300904430532, 0.350925934958123, 0.3848314933096426, 0.42057480301049466, 0.458183274052838, 0.4976837250274023, 0.5391024159806381, 0.5824650784040898, 0.6277969426914107, 0.6751227633498623, 0.7244668422128921, 0.775853049866786, 0.829304845476233, 0.8848452951698498, 0.942497089126609, 1.0022825574869039, 1.0642236851973577, 1.1283421258858297, 1.1946592148522128, 1.2631959812511864, 1.3339731595349034, 1.407011200216447, 1.4823302800086415, 1.5599503113873272, 1.6398909516233677, 1.7221716113234105, 1.8068114625156377, 1.8938294463134073, 1.9832442801866852, 2.075074464868551, 2.1693382909216234, 2.2660538449872063, 2.36523901573795, 2.4669114995532007, 2.5710888059345764, 2.6777882626779785, 2.7870270208169257, 2.898822059350997, 3.0131901897720907, 3.1301480604002863, 3.2497121605402226, 3.3718988244681087, 3.4967242352587946, 3.624204428461639, 3.754355295633311, 3.887192587735158, 4.022731918402185, 4.160988767090289, 4.301978482107941, 4.445716283538092, 4.592217266055746, 4.741496401646282, 4.893568542229298, 5.048448422192488, 5.20615066083972, 5.3666897647573375, 5.5300801301023865, 5.696336044816294, 5.865471690767354, 6.037501145825082, 6.212438385869475, 6.390297286737924, 6.571091626112461, 6.7548350853498045, 6.941541251256611, 7.131223617812143, 7.323895587840543, 7.5195704746346665, 7.7182615035334345, 7.919981813454504, 8.124744458384042, 8.332562408825165, 8.543448553206703, 8.757415699253682, 8.974476575321063, 9.194643831691977, 9.417930041841839, 9.644347703669503, 9.873909240696694, 10.106627003236781, 10.342513269534024, 10.58158024687427, 10.8238400726681, 11.069304815507364, 11.317986476196008, 11.569896988756009, 11.825048221409341, 12.083451977536606, 12.345119996613247, 12.610063955123938, 12.878295467455942, 13.149826086772048, 13.42466730586372, 13.702830557985108, 13.984327217668513, 14.269168601521828, 14.55736596900856, 14.848930523210871, 15.143873411576273, 15.44220572664832, 15.743938506781891, 16.04908273684337, 16.35764934889634, 16.66964922287304, 16.985093187232053, 17.30399201960269, 17.62635644741625, 17.95219714852476, 18.281524751807332, 18.614349837764564, 18.95068293910138, 19.290534541298456, 19.633915083172692, 19.98083495742689, 20.331304511189067, 20.685334046541502, 21.042933821039977, 21.404114048223256, 21.76888489811322, 22.137256497705877, 22.50923893145328, 22.884842241736916, 23.264076429332462, 23.6469514538663, 24.033477234264016, 24.42366364919083, 24.817520537484558, 25.21505769858089, 25.61628489293138, 26.021211842414342, 26.429848230738664, 26.842203703840827, 27.258287870275353, 27.678110301598522, 28.10168053274597, 28.529008062403893, 28.96010235337422, 29.39497283293396, 29.83362889318845, 30.276079891419332, 30.722335150426627, 31.172403958865512, 31.62629557157785, 32.08401920991837, 32.54558406207592, 33.010999283389665, 33.4802739966603, 33.953417292456834, 34.430438229418264, 34.911345834551085, 35.39614910352207, 35.88485700094671, 36.37747846067349, 36.87402238606382, 37.37449765026789, 37.87891309649659, 38.38727753828926, 38.89959975977785, 39.41588851594697, 39.93615253289054, 40.460400508064545, 40.98864111053629, 41.520882981230194, 42.05713473317016, 42.597404951718396, 43.141702194811224, 43.6900349931913, 44.24241185063697, 44.798841244188324, 45.35933162437017, 45.92389141541209, 46.49252901546552, 47.065252796817916, 47.64207110610409, 48.22299226451468, 48.808024568002054, 49.3971762874833, 49.9904556690408, 50.587870934119984, 51.189430279724725, 51.79514187861014, 52.40501387947288, 53.0190544071392, 53.637271562750364, 54.259673423945976, 54.88626804504493, 55.517063457223934, 56.15206766869424, 56.79128866487574, 57.43473440856916, 58.08241284012621, 58.734331877617365, 59.39049941699807, 60.05092333227251, 60.715611475655585, 61.38457167773311, 62.057811747619894, 62.7353394731159, 63.417162620860914, 64.10328893648692, 64.79372614476921, 65.48848194977529, 66.18756403501224, 66.89098006357258, 67.59873767827808, 68.31084450182222, 69.02730813691093, 69.74813616640164, 70.47333615344107, 71.20291564160104, 71.93688215501312, 72.67524319850172, 73.41800625771542, 74.16517879925733, 74.9167682708136, 75.67278210128072, 76.43322770089146, 77.1981124613393, 77.96744375590167, 78.74122893956174, 79.51947534912904, 80.30219030335869, 81.08938110306934, 81.88105503125999, 82.67721935322541, 83.4778813166706, 84.28304815182372, 85.09272707154808, 85.90692527145302, 86.72564993000343, 87.54890820862819, 88.3767072518277, 89.2090541872801, 90.04595612594655, 90.88742016217518, 91.73345337380438, 92.58406282226491, 93.43925555268066, 94.29903859396902, 95.16341895893969, 96.03240364439274, 96.9059996312159, 97.78421388448044, 98.6670533535366, 99.55452497210776, ];

/* ---------------------------------------------------------------------------
 * HCT solver - ported from material-color-utilities (Apache-2.0)
 * ------------------------------------------------------------------------- */

const HCT_SOLVER = {
  sanitizeRadians: (angle) => (angle + Math.PI * 8) % (Math.PI * 2),

  trueDelinearized: (rgbComponent) => {
    const normalized = rgbComponent / 100;
    const v = normalized <= 0.0031308 ? normalized * 12.92 : 1.055 * Math.pow(normalized, 1 / 2.4) - 0.055;
    return v * 255;
  },

  chromaticAdaptation: (component) => {
    const af = Math.pow(Math.abs(component), 0.42);
    return (signum(component) * 400 * af) / (af + 27.13);
  },

  hueOf: (linrgb) => {
    const scaledDiscount = matrixMultiply(linrgb, SCALED_DISCOUNT_FROM_LINRGB);
    const rA = HCT_SOLVER.chromaticAdaptation(scaledDiscount[0]);
    const gA = HCT_SOLVER.chromaticAdaptation(scaledDiscount[1]);
    const bA = HCT_SOLVER.chromaticAdaptation(scaledDiscount[2]);
    const a = (11 * rA - 12 * gA + bA) / 11;
    const b = (rA + gA - 2 * bA) / 9;
    return Math.atan2(b, a);
  },

  areInCyclicOrder: (a, b, c) =>
    HCT_SOLVER.sanitizeRadians(b - a) < HCT_SOLVER.sanitizeRadians(c - a),

  intercept: (source, mid, target) => (mid - source) / (target - source),

  lerpPoint: (source, t, target) => [
    source[0] + (target[0] - source[0]) * t,
    source[1] + (target[1] - source[1]) * t,
    source[2] + (target[2] - source[2]) * t,
  ],

  setCoordinate: (source, coordinate, target, axis) =>
    HCT_SOLVER.lerpPoint(source, HCT_SOLVER.intercept(source[axis], coordinate, target[axis]), target),

  isBounded: (x) => 0 <= x && x <= 100,

  nthVertex: (y, n) => {
    const kR = Y_FROM_LINRGB[0];
    const kG = Y_FROM_LINRGB[1];
    const kB = Y_FROM_LINRGB[2];
    const coordA = n % 4 <= 1 ? 0 : 100;
    const coordB = n % 2 === 0 ? 0 : 100;
    if (n < 4) {
      const g = coordA;
      const b = coordB;
      const r = (y - g * kG - b * kB) / kR;
      return HCT_SOLVER.isBounded(r) ? [r, g, b] : [-1, -1, -1];
    } else if (n < 8) {
      const b = coordA;
      const r = coordB;
      const g = (y - r * kR - b * kB) / kG;
      return HCT_SOLVER.isBounded(g) ? [r, g, b] : [-1, -1, -1];
    } else {
      const r = coordA;
      const g = coordB;
      const b = (y - r * kR - g * kG) / kB;
      return HCT_SOLVER.isBounded(b) ? [r, g, b] : [-1, -1, -1];
    }
  },

  bisectToSegment: (y, targetHue) => {
    let left = [-1, -1, -1];
    let right = left;
    let leftHue = 0;
    let rightHue = 0;
    let initialized = false;
    let uncut = true;
    for (let n = 0; n < 12; n++) {
      const mid = HCT_SOLVER.nthVertex(y, n);
      if (mid[0] < 0) continue;
      const midHue = HCT_SOLVER.hueOf(mid);
      if (!initialized) {
        left = mid;
        right = mid;
        leftHue = midHue;
        rightHue = midHue;
        initialized = true;
        continue;
      }
      if (uncut || HCT_SOLVER.areInCyclicOrder(leftHue, midHue, rightHue)) {
        uncut = false;
        if (HCT_SOLVER.areInCyclicOrder(leftHue, targetHue, midHue)) {
          right = mid;
          rightHue = midHue;
        } else {
          left = mid;
          leftHue = midHue;
        }
      }
    }
    return [left, right];
  },

  midpoint: (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],

  criticalPlaneBelow: (x) => Math.floor(x - 0.5),
  criticalPlaneAbove: (x) => Math.ceil(x - 0.5),

  bisectToLimit: (y, targetHue) => {
    const segment = HCT_SOLVER.bisectToSegment(y, targetHue);
    let left = segment[0];
    let leftHue = HCT_SOLVER.hueOf(left);
    let right = segment[1];
    for (let axis = 0; axis < 3; axis++) {
      if (left[axis] !== right[axis]) {
        let lPlane = -1;
        let rPlane = 255;
        if (left[axis] < right[axis]) {
          lPlane = HCT_SOLVER.criticalPlaneBelow(HCT_SOLVER.trueDelinearized(left[axis]));
          rPlane = HCT_SOLVER.criticalPlaneAbove(HCT_SOLVER.trueDelinearized(right[axis]));
        } else {
          lPlane = HCT_SOLVER.criticalPlaneAbove(HCT_SOLVER.trueDelinearized(left[axis]));
          rPlane = HCT_SOLVER.criticalPlaneBelow(HCT_SOLVER.trueDelinearized(right[axis]));
        }
        for (let i = 0; i < 8; i++) {
          if (Math.abs(rPlane - lPlane) <= 1) break;
          const mPlane = Math.floor((lPlane + rPlane) / 2);
          const midPlaneCoordinate = CRITICAL_PLANES[mPlane];
          const mid = HCT_SOLVER.setCoordinate(left, midPlaneCoordinate, right, axis);
          const midHue = HCT_SOLVER.hueOf(mid);
          if (HCT_SOLVER.areInCyclicOrder(leftHue, targetHue, midHue)) {
            right = mid;
            rPlane = mPlane;
          } else {
            left = mid;
            leftHue = midHue;
            lPlane = mPlane;
          }
        }
      }
    }
    return HCT_SOLVER.midpoint(left, right);
  },

  inverseChromaticAdaptation: (adapted) => {
    const adaptedAbs = Math.abs(adapted);
    const base = Math.max(0, (27.13 * adaptedAbs) / (400 - adaptedAbs));
    return signum(adapted) * Math.pow(base, 1 / 0.42);
  },

  findResultByJ: (hueRadians, chroma, y) => {
    let j = Math.sqrt(y) * 11;
    const tInnerCoeff = 1 / Math.pow(1.64 - Math.pow(0.29, VC.n), 0.73);
    const eHue = 0.25 * (Math.cos(hueRadians + 2) + 3.8);
    const p1 = (eHue * 50000) / 13 * VC.nc * VC.ncb;
    const hSin = Math.sin(hueRadians);
    const hCos = Math.cos(hueRadians);
    for (let round = 0; round < 5; round++) {
      const jNormalized = j / 100;
      const alpha = chroma === 0 || j === 0 ? 0 : chroma / Math.sqrt(jNormalized);
      const t = Math.pow(alpha * tInnerCoeff, 1 / 0.9);
      const ac = VC.aw * Math.pow(jNormalized, 1 / VC.c / VC.z);
      const p2 = ac / VC.nbb;
      const gamma = (23 * (p2 + 0.305) * t) / (23 * p1 + 11 * t * hCos + 108 * t * hSin);
      const a = gamma * hCos;
      const b = gamma * hSin;
      const rA = (460 * p2 + 451 * a + 288 * b) / 1403;
      const gA = (460 * p2 - 891 * a - 261 * b) / 1403;
      const bA = (460 * p2 - 220 * a - 6300 * b) / 1403;
      const rCScaled = HCT_SOLVER.inverseChromaticAdaptation(rA);
      const gCScaled = HCT_SOLVER.inverseChromaticAdaptation(gA);
      const bCScaled = HCT_SOLVER.inverseChromaticAdaptation(bA);
      const linrgb = matrixMultiply([rCScaled, gCScaled, bCScaled], LINRGB_FROM_SCALED_DISCOUNT);
      if (linrgb[0] < 0 || linrgb[1] < 0 || linrgb[2] < 0) return 0;
      const fnj = Y_FROM_LINRGB[0] * linrgb[0] + Y_FROM_LINRGB[1] * linrgb[1] + Y_FROM_LINRGB[2] * linrgb[2];
      if (fnj <= 0) return 0;
      if (round === 4 || Math.abs(fnj - y) < 0.002) {
        if (linrgb[0] > 100.01 || linrgb[1] > 100.01 || linrgb[2] > 100.01) return 0;
        return argbFromLinrgb(linrgb);
      }
      j = j - ((fnj - y) * j) / (2 * fnj);
    }
    return 0;
  },

  /** hue (deg), chroma, tone (L*) -> nearest in-gamut ARGB. */
  solveToInt: (hueDegrees, chroma, lstar) => {
    if (chroma < 0.0001 || lstar < 0.0001 || lstar > 99.9999) return argbFromLstar(lstar);
    const hue = sanitizeDegrees(hueDegrees);
    const hueRadians = (hue * Math.PI) / 180;
    const y = yFromLstar(lstar);
    const exact = HCT_SOLVER.findResultByJ(hueRadians, chroma, y);
    if (exact !== 0) return exact;
    return argbFromLinrgb(HCT_SOLVER.bisectToLimit(y, hueRadians));
  },
};

/** hue/chroma/tone -> hex string. */
export function hctToHex(hue, chroma, tone) {
  return hexFromArgb(intFromHct(hue, chroma, tone));
}

/* ============================================================================
 * MATERIAL 3 DYNAMIC-COLOR ENGINE (faithful port)
 * ----------------------------------------------------------------------------
 * The remainder of this file is a dependency-free port of the reference
 * implementation from `@material/material-color-utilities` (Apache-2.0).
 * Keeping it faithful means every role relationship - tonal constraints,
 * contrast curves, and both the 2021 and 2025 specs - matches the canonical
 * Material 3 output.
 *
 *   Source: https://github.com/material-foundation/material-color-utilities
 * ========================================================================= */

/** Integer degree sanitizer (0 <= d < 360). */
const sanitizeDegreesInt = (degrees) => {
  degrees = degrees % 360;
  if (degrees < 0) degrees = degrees + 360;
  return degrees;
};

/* ----------------------------------------------------------------------------
 * HCT - hue / chroma / tone.
 * -------------------------------------------------------------------------- */

class Hct {
  constructor(argb) {
    const { hue, chroma, tone } = hctFromInt(argb);
    this.argb = argb;
    this.internalHue = hue;
    this.internalChroma = chroma;
    this.internalTone = tone;
  }
  static from(hue, chroma, tone) {
    return new Hct(HCT_SOLVER.solveToInt(hue, chroma, tone));
  }
  static fromInt(argb) {
    return new Hct(argb);
  }
  toInt() {
    return this.argb;
  }
  get hue() {
    return this.internalHue;
  }
  get chroma() {
    return this.internalChroma;
  }
  get tone() {
    return this.internalTone;
  }
  static isBlue(hue) {
    return hue >= 250 && hue < 270;
  }
  static isYellow(hue) {
    return hue >= 105 && hue < 125;
  }
  static isCyan(hue) {
    return hue >= 170 && hue < 207;
  }
}

/* ----------------------------------------------------------------------------
 * Tonal palettes + key colors.
 * -------------------------------------------------------------------------- */

class KeyColor {
  constructor(hue, requestedChroma) {
    this.hue = hue;
    this.requestedChroma = requestedChroma;
    this.chromaCache = new Map();
    this.maxChromaValue = 200.0;
  }
  create() {
    const pivotTone = 50;
    const toneStepSize = 1;
    const epsilon = 0.01;
    let lowerTone = 0;
    let upperTone = 100;
    while (lowerTone < upperTone) {
      const midTone = Math.floor((lowerTone + upperTone) / 2);
      const isAscending = this.maxChroma(midTone) < this.maxChroma(midTone + toneStepSize);
      const sufficientChroma = this.maxChroma(midTone) >= this.requestedChroma - epsilon;
      if (sufficientChroma) {
        if (Math.abs(lowerTone - pivotTone) < Math.abs(upperTone - pivotTone)) {
          upperTone = midTone;
        } else {
          if (lowerTone === midTone) {
            return Hct.from(this.hue, this.requestedChroma, lowerTone);
          }
          lowerTone = midTone;
        }
      } else {
        if (isAscending) {
          lowerTone = midTone + toneStepSize;
        } else {
          upperTone = midTone;
        }
      }
    }
    return Hct.from(this.hue, this.requestedChroma, lowerTone);
  }
  maxChroma(tone) {
    if (this.chromaCache.has(tone)) return this.chromaCache.get(tone);
    const chroma = Hct.from(this.hue, this.maxChromaValue, tone).chroma;
    this.chromaCache.set(tone, chroma);
    return chroma;
  }
}

class TonalPalette {
  constructor(hue, chroma, keyColor) {
    this.hue = hue;
    this.chroma = chroma;
    this.keyColor = keyColor;
    this.cache = new Map();
  }
  static fromInt(argb) {
    return TonalPalette.fromHct(Hct.fromInt(argb));
  }
  static fromHct(hct) {
    return new TonalPalette(hct.hue, hct.chroma, hct);
  }
  static fromHueAndChroma(hue, chroma) {
    const keyColor = new KeyColor(hue, chroma).create();
    return new TonalPalette(hue, chroma, keyColor);
  }
  tone(tone) {
    let argb = this.cache.get(tone);
    if (argb === undefined) {
      if (tone == 99 && Hct.isYellow(this.hue)) {
        argb = this.averageArgb(this.tone(98), this.tone(100));
      } else {
        argb = Hct.from(this.hue, this.chroma, tone).toInt();
      }
      this.cache.set(tone, argb);
    }
    return argb;
  }
  getHct(tone) {
    return Hct.fromInt(this.tone(tone));
  }
  averageArgb(argb1, argb2) {
    const red1 = (argb1 >>> 16) & 0xff;
    const green1 = (argb1 >>> 8) & 0xff;
    const blue1 = argb1 & 0xff;
    const red2 = (argb2 >>> 16) & 0xff;
    const green2 = (argb2 >>> 8) & 0xff;
    const blue2 = argb2 & 0xff;
    const red = Math.round((red1 + red2) / 2);
    const green = Math.round((green1 + green2) / 2);
    const blue = Math.round((blue1 + blue2) / 2);
    return ((255 << 24) | ((red & 255) << 16) | ((green & 255) << 8) | (blue & 255)) >>> 0;
  }
}

/* ----------------------------------------------------------------------------
 * Contrast helpers.
 * -------------------------------------------------------------------------- */

const Contrast = {
  ratioOfTones(toneA, toneB) {
    toneA = clampDouble(0.0, 100.0, toneA);
    toneB = clampDouble(0.0, 100.0, toneB);
    return Contrast.ratioOfYs(yFromLstar(toneA), yFromLstar(toneB));
  },
  ratioOfYs(y1, y2) {
    const lighter = y1 > y2 ? y1 : y2;
    const darker = lighter === y2 ? y1 : y2;
    return (lighter + 5.0) / (darker + 5.0);
  },
  lighter(tone, ratio) {
    if (tone < 0.0 || tone > 100.0) return -1.0;
    const darkY = yFromLstar(tone);
    const lightY = ratio * (darkY + 5.0) - 5.0;
    const realContrast = Contrast.ratioOfYs(lightY, darkY);
    const delta = Math.abs(realContrast - ratio);
    if (realContrast < ratio && delta > 0.04) return -1;
    const returnValue = lstarFromY(lightY) + 0.4;
    if (returnValue < 0 || returnValue > 100) return -1;
    return returnValue;
  },
  darker(tone, ratio) {
    if (tone < 0.0 || tone > 100.0) return -1.0;
    const lightY = yFromLstar(tone);
    const darkY = ((lightY + 5.0) / ratio) - 5.0;
    const realContrast = Contrast.ratioOfYs(lightY, darkY);
    const delta = Math.abs(realContrast - ratio);
    if (realContrast < ratio && delta > 0.04) return -1;
    const returnValue = lstarFromY(darkY) - 0.4;
    if (returnValue < 0 || returnValue > 100) return -1;
    return returnValue;
  },
  lighterUnsafe(tone, ratio) {
    const safe = Contrast.lighter(tone, ratio);
    return safe < 0.0 ? 100.0 : safe;
  },
  darkerUnsafe(tone, ratio) {
    const safe = Contrast.darker(tone, ratio);
    return safe < 0.0 ? 0.0 : safe;
  },
};

class ContrastCurve {
  constructor(low, normal, medium, high) {
    this.low = low;
    this.normal = normal;
    this.medium = medium;
    this.high = high;
  }
  get(contrastLevel) {
    if (contrastLevel <= -1.0) return this.low;
    else if (contrastLevel < 0.0) return lerp(this.low, this.normal, (contrastLevel - -1) / 1);
    else if (contrastLevel < 0.5) return lerp(this.normal, this.medium, (contrastLevel - 0) / 0.5);
    else if (contrastLevel < 1.0) return lerp(this.medium, this.high, (contrastLevel - 0.5) / 0.5);
    else return this.high;
  }
}

class ToneDeltaPair {
  constructor(roleA, roleB, delta, polarity, stayTogether, constraint) {
    this.roleA = roleA;
    this.roleB = roleB;
    this.delta = delta;
    this.polarity = polarity;
    this.stayTogether = stayTogether;
    this.constraint = constraint ?? 'exact';
  }
}

/* ----------------------------------------------------------------------------
 * Dislike analysis + temperature (fidelity / content tertiary palettes).
 * -------------------------------------------------------------------------- */

const DislikeAnalyzer = {
  isDisliked(hct) {
    const huePasses = Math.round(hct.hue) >= 90.0 && Math.round(hct.hue) <= 111.0;
    const chromaPasses = Math.round(hct.chroma) > 16.0;
    const tonePasses = Math.round(hct.tone) < 65.0;
    return huePasses && chromaPasses && tonePasses;
  },
  fixIfDisliked(hct) {
    if (DislikeAnalyzer.isDisliked(hct)) return Hct.from(hct.hue, hct.chroma, 70.0);
    return hct;
  },
};

class TemperatureCache {
  constructor(input) {
    this.input = input;
    this.hctsByTempCache = [];
    this.hctsByHueCache = [];
    this.tempsByHctCache = new Map();
    this.inputRelativeTemperatureCache = -1.0;
    this.complementCache = null;
  }
  get hctsByTemp() {
    if (this.hctsByTempCache.length > 0) return this.hctsByTempCache;
    const hcts = this.hctsByHue.concat([this.input]);
    const temperaturesByHct = this.tempsByHct;
    hcts.sort((a, b) => temperaturesByHct.get(a) - temperaturesByHct.get(b));
    this.hctsByTempCache = hcts;
    return hcts;
  }
  get warmest() {
    return this.hctsByTemp[this.hctsByTemp.length - 1];
  }
  get coldest() {
    return this.hctsByTemp[0];
  }
  analogous(count = 5, divisions = 12) {
    const startHue = Math.round(this.input.hue);
    const startHct = this.hctsByHue[startHue];
    let lastTemp = this.relativeTemperature(startHct);
    const allColors = [startHct];
    let absoluteTotalTempDelta = 0.0;
    for (let i = 0; i < 360; i++) {
      const hue = sanitizeDegreesInt(startHue + i);
      const hct = this.hctsByHue[hue];
      const temp = this.relativeTemperature(hct);
      const tempDelta = Math.abs(temp - lastTemp);
      lastTemp = temp;
      absoluteTotalTempDelta += tempDelta;
    }
    let hueAddend = 1;
    const tempStep = absoluteTotalTempDelta / divisions;
    let totalTempDelta = 0.0;
    lastTemp = this.relativeTemperature(startHct);
    while (allColors.length < divisions) {
      const hue = sanitizeDegreesInt(startHue + hueAddend);
      const hct = this.hctsByHue[hue];
      const temp = this.relativeTemperature(hct);
      const tempDelta = Math.abs(temp - lastTemp);
      totalTempDelta += tempDelta;
      const desiredTotalTempDeltaForIndex = allColors.length * tempStep;
      let indexSatisfied = totalTempDelta >= desiredTotalTempDeltaForIndex;
      let indexAddend = 1;
      while (indexSatisfied && allColors.length < divisions) {
        allColors.push(hct);
        const nextDesired = (allColors.length + indexAddend) * tempStep;
        indexSatisfied = totalTempDelta >= nextDesired;
        indexAddend++;
      }
      lastTemp = temp;
      hueAddend++;
      if (hueAddend > 360) {
        while (allColors.length < divisions) allColors.push(hct);
        break;
      }
    }
    const answers = [this.input];
    const increaseHueCount = Math.floor((count - 1) / 2.0);
    for (let i = 1; i < increaseHueCount + 1; i++) {
      let index = 0 - i;
      while (index < 0) index = allColors.length + index;
      if (index >= allColors.length) index = index % allColors.length;
      answers.splice(0, 0, allColors[index]);
    }
    const decreaseHueCount = count - increaseHueCount - 1;
    for (let i = 1; i < decreaseHueCount + 1; i++) {
      let index = i;
      while (index < 0) index = allColors.length + index;
      if (index >= allColors.length) index = index % allColors.length;
      answers.push(allColors[index]);
    }
    return answers;
  }
  get complement() {
    if (this.complementCache != null) return this.complementCache;
    const coldestHue = this.coldest.hue;
    const coldestTemp = this.tempsByHct.get(this.coldest);
    const warmestHue = this.warmest.hue;
    const warmestTemp = this.tempsByHct.get(this.warmest);
    const range = warmestTemp - coldestTemp;
    const startHueIsColdestToWarmest = TemperatureCache.isBetween(this.input.hue, coldestHue, warmestHue);
    const startHue = startHueIsColdestToWarmest ? warmestHue : coldestHue;
    const endHue = startHueIsColdestToWarmest ? coldestHue : warmestHue;
    const directionOfRotation = 1.0;
    let smallestError = 1000.0;
    let answer = this.hctsByHue[Math.round(this.input.hue)];
    const complementRelativeTemp = 1.0 - this.inputRelativeTemperature;
    for (let hueAddend = 0.0; hueAddend <= 360.0; hueAddend += 1.0) {
      const hue = sanitizeDegrees(startHue + directionOfRotation * hueAddend);
      if (!TemperatureCache.isBetween(hue, startHue, endHue)) continue;
      const possibleAnswer = this.hctsByHue[Math.round(hue)];
      const relativeTemp = (this.tempsByHct.get(possibleAnswer) - coldestTemp) / range;
      const error = Math.abs(complementRelativeTemp - relativeTemp);
      if (error < smallestError) {
        smallestError = error;
        answer = possibleAnswer;
      }
    }
    this.complementCache = answer;
    return this.complementCache;
  }
  relativeTemperature(hct) {
    const range = this.tempsByHct.get(this.warmest) - this.tempsByHct.get(this.coldest);
    const differenceFromColdest = this.tempsByHct.get(hct) - this.tempsByHct.get(this.coldest);
    if (range === 0.0) return 0.5;
    return differenceFromColdest / range;
  }
  get inputRelativeTemperature() {
    if (this.inputRelativeTemperatureCache >= 0.0) return this.inputRelativeTemperatureCache;
    this.inputRelativeTemperatureCache = this.relativeTemperature(this.input);
    return this.inputRelativeTemperatureCache;
  }
  get tempsByHct() {
    if (this.tempsByHctCache.size > 0) return this.tempsByHctCache;
    const allHcts = this.hctsByHue.concat([this.input]);
    const temperaturesByHct = new Map();
    for (const e of allHcts) temperaturesByHct.set(e, TemperatureCache.rawTemperature(e));
    this.tempsByHctCache = temperaturesByHct;
    return temperaturesByHct;
  }
  get hctsByHue() {
    if (this.hctsByHueCache.length > 0) return this.hctsByHueCache;
    const hcts = [];
    for (let hue = 0.0; hue <= 360.0; hue += 1.0) {
      hcts.push(Hct.from(hue, this.input.chroma, this.input.tone));
    }
    this.hctsByHueCache = hcts;
    return this.hctsByHueCache;
  }
  static isBetween(angle, a, b) {
    if (a < b) return a <= angle && angle <= b;
    return a <= angle || angle <= b;
  }
  static rawTemperature(color) {
    const lab = labFromArgb(color.toInt());
    const hue = sanitizeDegrees((Math.atan2(lab[2], lab[1]) * 180.0) / Math.PI);
    const chroma = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
    const temperature =
      -0.5 + 0.02 * Math.pow(chroma, 1.07) * Math.cos((sanitizeDegrees(hue - 50.0) * Math.PI) / 180.0);
    return temperature;
  }
}

/* ----------------------------------------------------------------------------
 * DynamicColor + per-spec calculation delegates.
 * -------------------------------------------------------------------------- */

class DynamicColor {
  static fromPalette(args) {
    return new DynamicColor(
      args.name ?? '',
      args.palette,
      args.tone ?? DynamicColor.getInitialToneFromBackground(args.background),
      args.isBackground ?? false,
      args.chromaMultiplier,
      args.background,
      args.secondBackground,
      args.contrastCurve,
      args.toneDeltaPair,
    );
  }
  static getInitialToneFromBackground(background) {
    if (background === undefined) return (s) => 50;
    return (s) => (background(s) ? background(s).getTone(s) : 50);
  }
  constructor(name, palette, tone, isBackground, chromaMultiplier, background, secondBackground, contrastCurve, toneDeltaPair) {
    this.name = name;
    this.palette = palette;
    this.tone = tone;
    this.isBackground = isBackground;
    this.chromaMultiplier = chromaMultiplier;
    this.background = background;
    this.secondBackground = secondBackground;
    this.contrastCurve = contrastCurve;
    this.toneDeltaPair = toneDeltaPair;
    this.hctCache = new Map();
    if (!background && secondBackground) {
      throw new Error(`Color ${name} has secondBackground defined, but background is not defined.`);
    }
    if (!background && contrastCurve) {
      throw new Error(`Color ${name} has contrastCurve defined, but background is not defined.`);
    }
    if (background && !contrastCurve) {
      throw new Error(`Color ${name} has background defined, but contrastCurve is not defined.`);
    }
  }
  clone() {
    return DynamicColor.fromPalette({
      name: this.name,
      palette: this.palette,
      tone: this.tone,
      isBackground: this.isBackground,
      chromaMultiplier: this.chromaMultiplier,
      background: this.background,
      secondBackground: this.secondBackground,
      contrastCurve: this.contrastCurve,
      toneDeltaPair: this.toneDeltaPair,
    });
  }
  clearCache() {
    this.hctCache.clear();
  }
  getArgb(scheme) {
    return this.getHct(scheme).toInt();
  }
  getHct(scheme) {
    const cachedAnswer = this.hctCache.get(scheme);
    if (cachedAnswer != null) return cachedAnswer;
    const answer = getCalculationSpec(scheme.specVersion).getHct(scheme, this);
    if (this.hctCache.size > 4) this.hctCache.clear();
    this.hctCache.set(scheme, answer);
    return answer;
  }
  getTone(scheme) {
    return getCalculationSpec(scheme.specVersion).getTone(scheme, this);
  }
  static foregroundTone(bgTone, ratio) {
    const lighterTone = Contrast.lighterUnsafe(bgTone, ratio);
    const darkerTone = Contrast.darkerUnsafe(bgTone, ratio);
    const lighterRatio = Contrast.ratioOfTones(lighterTone, bgTone);
    const darkerRatio = Contrast.ratioOfTones(darkerTone, bgTone);
    const preferLighter = DynamicColor.tonePrefersLightForeground(bgTone);
    if (preferLighter) {
      const negligibleDifference =
        Math.abs(lighterRatio - darkerRatio) < 0.1 && lighterRatio < ratio && darkerRatio < ratio;
      return lighterRatio >= ratio || lighterRatio >= darkerRatio || negligibleDifference
        ? lighterTone
        : darkerTone;
    } else {
      return darkerRatio >= ratio || darkerRatio >= lighterRatio ? darkerTone : lighterTone;
    }
  }
  static tonePrefersLightForeground(tone) {
    return Math.round(tone) < 60.0;
  }
  static toneAllowsLightForeground(tone) {
    return Math.round(tone) <= 49.0;
  }
  static enableLightForeground(tone) {
    if (DynamicColor.tonePrefersLightForeground(tone) && !DynamicColor.toneAllowsLightForeground(tone)) {
      return 49.0;
    }
    return tone;
  }
}

function extendSpecVersion(originalColor, specVersion, extendedColor) {
  if (originalColor.name !== extendedColor.name) {
    throw new Error(
      `Attempting to extend color ${originalColor.name} with color ${extendedColor.name} of different name for spec version ${specVersion}.`,
    );
  }
  if (originalColor.isBackground !== extendedColor.isBackground) {
    throw new Error(
      `Attempting to extend color ${originalColor.name} as a ${originalColor.isBackground ? 'background' : 'foreground'} with color ${extendedColor.name} as a ${extendedColor.isBackground ? 'background' : 'foreground'} for spec version ${specVersion}.`,
    );
  }
  return DynamicColor.fromPalette({
    name: originalColor.name,
    palette: (s) => (s.specVersion === specVersion ? extendedColor.palette(s) : originalColor.palette(s)),
    tone: (s) => (s.specVersion === specVersion ? extendedColor.tone(s) : originalColor.tone(s)),
    isBackground: originalColor.isBackground,
    chromaMultiplier: (s) => {
      const cm = s.specVersion === specVersion ? extendedColor.chromaMultiplier : originalColor.chromaMultiplier;
      return cm !== undefined ? cm(s) : 1;
    },
    background: (s) => {
      const background = s.specVersion === specVersion ? extendedColor.background : originalColor.background;
      return background !== undefined ? background(s) : undefined;
    },
    secondBackground: (s) => {
      const secondBackground =
        s.specVersion === specVersion ? extendedColor.secondBackground : originalColor.secondBackground;
      return secondBackground !== undefined ? secondBackground(s) : undefined;
    },
    contrastCurve: (s) => {
      const contrastCurve =
        s.specVersion === specVersion ? extendedColor.contrastCurve : originalColor.contrastCurve;
      return contrastCurve !== undefined ? contrastCurve(s) : undefined;
    },
    toneDeltaPair: (s) => {
      const toneDeltaPair =
        s.specVersion === specVersion ? extendedColor.toneDeltaPair : originalColor.toneDeltaPair;
      return toneDeltaPair !== undefined ? toneDeltaPair(s) : undefined;
    },
  });
}

class ColorCalculationDelegateImpl2021 {
  getHct(scheme, color) {
    const tone = color.getTone(scheme);
    const palette = color.palette(scheme);
    return palette.getHct(tone);
  }
  getTone(scheme, color) {
    const decreasingContrast = scheme.contrastLevel < 0;
    const toneDeltaPair = color.toneDeltaPair ? color.toneDeltaPair(scheme) : undefined;
    if (toneDeltaPair) {
      const roleA = toneDeltaPair.roleA;
      const roleB = toneDeltaPair.roleB;
      const delta = toneDeltaPair.delta;
      const polarity = toneDeltaPair.polarity;
      const stayTogether = toneDeltaPair.stayTogether;
      const aIsNearer =
        polarity === 'nearer' || (polarity === 'lighter' && !scheme.isDark) || (polarity === 'darker' && scheme.isDark);
      const nearer = aIsNearer ? roleA : roleB;
      const farther = aIsNearer ? roleB : roleA;
      const amNearer = color.name === nearer.name;
      const expansionDir = scheme.isDark ? 1 : -1;
      let nTone = nearer.tone(scheme);
      let fTone = farther.tone(scheme);
      if (color.background && nearer.contrastCurve && farther.contrastCurve) {
        const bg = color.background(scheme);
        const nContrastCurve = nearer.contrastCurve(scheme);
        const fContrastCurve = farther.contrastCurve(scheme);
        if (bg && nContrastCurve && fContrastCurve) {
          const bgTone = bg.getTone(scheme);
          const nContrast = nContrastCurve.get(scheme.contrastLevel);
          const fContrast = fContrastCurve.get(scheme.contrastLevel);
          if (Contrast.ratioOfTones(bgTone, nTone) < nContrast) {
            nTone = DynamicColor.foregroundTone(bgTone, nContrast);
          }
          if (Contrast.ratioOfTones(bgTone, fTone) < fContrast) {
            fTone = DynamicColor.foregroundTone(bgTone, fContrast);
          }
          if (decreasingContrast) {
            nTone = DynamicColor.foregroundTone(bgTone, nContrast);
            fTone = DynamicColor.foregroundTone(bgTone, fContrast);
          }
        }
      }
      if ((fTone - nTone) * expansionDir < delta) {
        fTone = clampDouble(0, 100, nTone + delta * expansionDir);
        if ((fTone - nTone) * expansionDir >= delta) {
        } else {
          nTone = clampDouble(0, 100, fTone - delta * expansionDir);
        }
      }
      if (50 <= nTone && nTone < 60) {
        if (expansionDir > 0) {
          nTone = 60;
          fTone = Math.max(fTone, nTone + delta * expansionDir);
        } else {
          nTone = 49;
          fTone = Math.min(fTone, nTone + delta * expansionDir);
        }
      } else if (50 <= fTone && fTone < 60) {
        if (stayTogether) {
          if (expansionDir > 0) {
            nTone = 60;
            fTone = Math.max(fTone, nTone + delta * expansionDir);
          } else {
            nTone = 49;
            fTone = Math.min(fTone, nTone + delta * expansionDir);
          }
        } else {
          if (expansionDir > 0) {
            fTone = 60;
          } else {
            fTone = 49;
          }
        }
      }
      return amNearer ? nTone : fTone;
    } else {
      let answer = color.tone(scheme);
      if (
        color.background == undefined ||
        color.background(scheme) === undefined ||
        color.contrastCurve == undefined ||
        color.contrastCurve(scheme) === undefined
      ) {
        return answer;
      }
      const bgTone = color.background(scheme).getTone(scheme);
      const desiredRatio = color.contrastCurve(scheme).get(scheme.contrastLevel);
      if (Contrast.ratioOfTones(bgTone, answer) >= desiredRatio) {
      } else {
        answer = DynamicColor.foregroundTone(bgTone, desiredRatio);
      }
      if (decreasingContrast) {
        answer = DynamicColor.foregroundTone(bgTone, desiredRatio);
      }
      if (color.isBackground && 50 <= answer && answer < 60) {
        if (Contrast.ratioOfTones(49, bgTone) >= desiredRatio) {
          answer = 49;
        } else {
          answer = 60;
        }
      }
      if (color.secondBackground == undefined || color.secondBackground(scheme) === undefined) {
        return answer;
      }
      const [bg1, bg2] = [color.background, color.secondBackground];
      const [bgTone1, bgTone2] = [bg1(scheme).getTone(scheme), bg2(scheme).getTone(scheme)];
      const [upper, lower] = [Math.max(bgTone1, bgTone2), Math.min(bgTone1, bgTone2)];
      if (
        Contrast.ratioOfTones(upper, answer) >= desiredRatio &&
        Contrast.ratioOfTones(lower, answer) >= desiredRatio
      ) {
        return answer;
      }
      const lightOption = Contrast.lighter(upper, desiredRatio);
      const darkOption = Contrast.darker(lower, desiredRatio);
      const availables = [];
      if (lightOption !== -1) availables.push(lightOption);
      if (darkOption !== -1) availables.push(darkOption);
      const prefersLight =
        DynamicColor.tonePrefersLightForeground(bgTone1) || DynamicColor.tonePrefersLightForeground(bgTone2);
      if (prefersLight) {
        return lightOption < 0 ? 100 : lightOption;
      }
      if (availables.length === 1) {
        return availables[0];
      }
      return darkOption < 0 ? 0 : darkOption;
    }
  }
}

class ColorCalculationDelegateImpl2025 {
  getHct(scheme, color) {
    const palette = color.palette(scheme);
    const tone = color.getTone(scheme);
    const hue = palette.hue;
    const chroma = palette.chroma * (color.chromaMultiplier ? color.chromaMultiplier(scheme) : 1);
    return Hct.from(hue, chroma, tone);
  }
  getTone(scheme, color) {
    const toneDeltaPair = color.toneDeltaPair ? color.toneDeltaPair(scheme) : undefined;
    if (toneDeltaPair) {
      const roleA = toneDeltaPair.roleA;
      const roleB = toneDeltaPair.roleB;
      const polarity = toneDeltaPair.polarity;
      const constraint = toneDeltaPair.constraint;
      const absoluteDelta =
        polarity === 'darker' ||
        (polarity === 'relative_lighter' && scheme.isDark) ||
        (polarity === 'relative_darker' && !scheme.isDark)
          ? -toneDeltaPair.delta
          : toneDeltaPair.delta;
      const amRoleA = color.name === roleA.name;
      const selfRole = amRoleA ? roleA : roleB;
      const refRole = amRoleA ? roleB : roleA;
      let selfTone = selfRole.tone(scheme);
      const refTone = refRole.getTone(scheme);
      const relativeDelta = absoluteDelta * (amRoleA ? 1 : -1);
      if (constraint === 'exact') {
        selfTone = clampDouble(0, 100, refTone + relativeDelta);
      } else if (constraint === 'nearer') {
        if (relativeDelta > 0) {
          selfTone = clampDouble(0, 100, clampDouble(refTone, refTone + relativeDelta, selfTone));
        } else {
          selfTone = clampDouble(0, 100, clampDouble(refTone + relativeDelta, refTone, selfTone));
        }
      } else if (constraint === 'farther') {
        if (relativeDelta > 0) {
          selfTone = clampDouble(refTone + relativeDelta, 100, selfTone);
        } else {
          selfTone = clampDouble(0, refTone + relativeDelta, selfTone);
        }
      }
      if (color.background && color.contrastCurve) {
        const background = color.background(scheme);
        const contrastCurve = color.contrastCurve(scheme);
        if (background && contrastCurve) {
          const bgTone = background.getTone(scheme);
          const selfContrast = contrastCurve.get(scheme.contrastLevel);
          selfTone =
            Contrast.ratioOfTones(bgTone, selfTone) >= selfContrast && scheme.contrastLevel >= 0
              ? selfTone
              : DynamicColor.foregroundTone(bgTone, selfContrast);
        }
      }
      if (color.isBackground && !color.name.endsWith('_fixed_dim')) {
        if (selfTone >= 57) {
          selfTone = clampDouble(65, 100, selfTone);
        } else {
          selfTone = clampDouble(0, 49, selfTone);
        }
      }
      return selfTone;
    } else {
      let answer = color.tone(scheme);
      if (
        color.background == undefined ||
        color.background(scheme) === undefined ||
        color.contrastCurve == undefined ||
        color.contrastCurve(scheme) === undefined
      ) {
        return answer;
      }
      const bgTone = color.background(scheme).getTone(scheme);
      const desiredRatio = color.contrastCurve(scheme).get(scheme.contrastLevel);
      answer =
        Contrast.ratioOfTones(bgTone, answer) >= desiredRatio && scheme.contrastLevel >= 0
          ? answer
          : DynamicColor.foregroundTone(bgTone, desiredRatio);
      if (color.isBackground && !color.name.endsWith('_fixed_dim')) {
        if (answer >= 57) {
          answer = clampDouble(65, 100, answer);
        } else {
          answer = clampDouble(0, 49, answer);
        }
      }
      if (color.secondBackground == undefined || color.secondBackground(scheme) === undefined) {
        return answer;
      }
      const [bg1, bg2] = [color.background, color.secondBackground];
      const [bgTone1, bgTone2] = [bg1(scheme).getTone(scheme), bg2(scheme).getTone(scheme)];
      const [upper, lower] = [Math.max(bgTone1, bgTone2), Math.min(bgTone1, bgTone2)];
      if (
        Contrast.ratioOfTones(upper, answer) >= desiredRatio &&
        Contrast.ratioOfTones(lower, answer) >= desiredRatio
      ) {
        return answer;
      }
      const lightOption = Contrast.lighter(upper, desiredRatio);
      const darkOption = Contrast.darker(lower, desiredRatio);
      const availables = [];
      if (lightOption !== -1) availables.push(lightOption);
      if (darkOption !== -1) availables.push(darkOption);
      const prefersLight =
        DynamicColor.tonePrefersLightForeground(bgTone1) || DynamicColor.tonePrefersLightForeground(bgTone2);
      if (prefersLight) {
        return lightOption < 0 ? 100 : lightOption;
      }
      if (availables.length === 1) {
        return availables[0];
      }
      return darkOption < 0 ? 0 : darkOption;
    }
  }
}

const calculationSpec2021 = new ColorCalculationDelegateImpl2021();
const calculationSpec2025 = new ColorCalculationDelegateImpl2025();
function getCalculationSpec(specVersion) {
  return specVersion === '2025' ? calculationSpec2025 : calculationSpec2021;
}

/* ----------------------------------------------------------------------------
 * Role specs (2021 base + 2025 overrides).
 * Variant enum: 0 monochrome, 1 neutral, 2 tonalSpot, 3 vibrant,
 *               4 expressive, 5 fidelity, 6 content, 7 rainbow, 8 fruitSalad.
 * -------------------------------------------------------------------------- */

function isFidelity(scheme) {
  return scheme.variant === 5 || scheme.variant === 6;
}
function isMonochrome(scheme) {
  return scheme.variant === 0;
}
function findDesiredChromaByTone(hue, chroma, tone, byDecreasingTone) {
  let answer = tone;
  let closestToChroma = Hct.from(hue, chroma, tone);
  if (closestToChroma.chroma < chroma) {
    let chromaPeak = closestToChroma.chroma;
    while (closestToChroma.chroma < chroma) {
      answer += byDecreasingTone ? -1.0 : 1.0;
      const potentialSolution = Hct.from(hue, chroma, answer);
      if (chromaPeak > potentialSolution.chroma) break;
      if (Math.abs(potentialSolution.chroma - chroma) < 0.4) break;
      const potentialDelta = Math.abs(potentialSolution.chroma - chroma);
      const currentDelta = Math.abs(closestToChroma.chroma - chroma);
      if (potentialDelta < currentDelta) closestToChroma = potentialSolution;
      chromaPeak = Math.max(chromaPeak, potentialSolution.chroma);
    }
  }
  return answer;
}
function findBestToneForChroma(hue, chroma, tone, byDecreasingTone) {
  let answer = tone;
  let bestCandidate = Hct.from(hue, chroma, answer);
  while (bestCandidate.chroma < chroma) {
    if (tone < 0 || tone > 100) break;
    tone += byDecreasingTone ? -1.0 : 1.0;
    const newCandidate = Hct.from(hue, chroma, tone);
    if (bestCandidate.chroma < newCandidate.chroma) {
      bestCandidate = newCandidate;
      answer = tone;
    }
  }
  return answer;
}
function tMaxC(palette, lowerBound = 0, upperBound = 100, chromaMultiplier = 1) {
  const answer = findBestToneForChroma(palette.hue, palette.chroma * chromaMultiplier, 100, true);
  return clampDouble(lowerBound, upperBound, answer);
}
function tMinC(palette, lowerBound = 0, upperBound = 100) {
  const answer = findBestToneForChroma(palette.hue, palette.chroma, 0, false);
  return clampDouble(lowerBound, upperBound, answer);
}
function getCurve(defaultContrast) {
  if (defaultContrast === 1.5) return new ContrastCurve(1.5, 1.5, 3, 5.5);
  else if (defaultContrast === 3) return new ContrastCurve(3, 3, 4.5, 7);
  else if (defaultContrast === 4.5) return new ContrastCurve(4.5, 4.5, 7, 11);
  else if (defaultContrast === 6) return new ContrastCurve(6, 6, 7, 11);
  else if (defaultContrast === 7) return new ContrastCurve(7, 7, 11, 21);
  else if (defaultContrast === 9) return new ContrastCurve(9, 9, 11, 21);
  else if (defaultContrast === 11) return new ContrastCurve(11, 11, 21, 21);
  else if (defaultContrast === 21) return new ContrastCurve(21, 21, 21, 21);
  else return new ContrastCurve(defaultContrast, defaultContrast, 7, 21);
}

class ColorSpecDelegateImpl2021 {
  primaryPaletteKeyColor() {
    return DynamicColor.fromPalette({
      name: 'primary_palette_key_color',
      palette: (s) => s.primaryPalette,
      tone: (s) => s.primaryPalette.keyColor.tone,
    });
  }
  secondaryPaletteKeyColor() {
    return DynamicColor.fromPalette({
      name: 'secondary_palette_key_color',
      palette: (s) => s.secondaryPalette,
      tone: (s) => s.secondaryPalette.keyColor.tone,
    });
  }
  tertiaryPaletteKeyColor() {
    return DynamicColor.fromPalette({
      name: 'tertiary_palette_key_color',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => s.tertiaryPalette.keyColor.tone,
    });
  }
  neutralPaletteKeyColor() {
    return DynamicColor.fromPalette({
      name: 'neutral_palette_key_color',
      palette: (s) => s.neutralPalette,
      tone: (s) => s.neutralPalette.keyColor.tone,
    });
  }
  neutralVariantPaletteKeyColor() {
    return DynamicColor.fromPalette({
      name: 'neutral_variant_palette_key_color',
      palette: (s) => s.neutralVariantPalette,
      tone: (s) => s.neutralVariantPalette.keyColor.tone,
    });
  }
  errorPaletteKeyColor() {
    return DynamicColor.fromPalette({
      name: 'error_palette_key_color',
      palette: (s) => s.errorPalette,
      tone: (s) => s.errorPalette.keyColor.tone,
    });
  }
  background() {
    return DynamicColor.fromPalette({
      name: 'background',
      palette: (s) => s.neutralPalette,
      tone: (s) => (s.isDark ? 6 : 98),
      isBackground: true,
    });
  }
  onBackground() {
    return DynamicColor.fromPalette({
      name: 'on_background',
      palette: (s) => s.neutralPalette,
      tone: (s) => (s.isDark ? 90 : 10),
      background: (s) => this.background(),
      contrastCurve: (s) => new ContrastCurve(3, 3, 4.5, 7),
    });
  }
  surface() {
    return DynamicColor.fromPalette({
      name: 'surface',
      palette: (s) => s.neutralPalette,
      tone: (s) => (s.isDark ? 6 : 98),
      isBackground: true,
    });
  }
  surfaceDim() {
    return DynamicColor.fromPalette({
      name: 'surface_dim',
      palette: (s) => s.neutralPalette,
      tone: (s) => (s.isDark ? 6 : new ContrastCurve(87, 87, 80, 75).get(s.contrastLevel)),
      isBackground: true,
    });
  }
  surfaceBright() {
    return DynamicColor.fromPalette({
      name: 'surface_bright',
      palette: (s) => s.neutralPalette,
      tone: (s) => (s.isDark ? new ContrastCurve(24, 24, 29, 34).get(s.contrastLevel) : 98),
      isBackground: true,
    });
  }
  surfaceContainerLowest() {
    return DynamicColor.fromPalette({
      name: 'surface_container_lowest',
      palette: (s) => s.neutralPalette,
      tone: (s) => (s.isDark ? new ContrastCurve(4, 4, 2, 0).get(s.contrastLevel) : 100),
      isBackground: true,
    });
  }
  surfaceContainerLow() {
    return DynamicColor.fromPalette({
      name: 'surface_container_low',
      palette: (s) => s.neutralPalette,
      tone: (s) =>
        s.isDark
          ? new ContrastCurve(10, 10, 11, 12).get(s.contrastLevel)
          : new ContrastCurve(96, 96, 96, 95).get(s.contrastLevel),
      isBackground: true,
    });
  }
  surfaceContainer() {
    return DynamicColor.fromPalette({
      name: 'surface_container',
      palette: (s) => s.neutralPalette,
      tone: (s) =>
        s.isDark
          ? new ContrastCurve(12, 12, 16, 20).get(s.contrastLevel)
          : new ContrastCurve(94, 94, 92, 90).get(s.contrastLevel),
      isBackground: true,
    });
  }
  surfaceContainerHigh() {
    return DynamicColor.fromPalette({
      name: 'surface_container_high',
      palette: (s) => s.neutralPalette,
      tone: (s) =>
        s.isDark
          ? new ContrastCurve(17, 17, 21, 25).get(s.contrastLevel)
          : new ContrastCurve(92, 92, 88, 85).get(s.contrastLevel),
      isBackground: true,
    });
  }
  surfaceContainerHighest() {
    return DynamicColor.fromPalette({
      name: 'surface_container_highest',
      palette: (s) => s.neutralPalette,
      tone: (s) =>
        s.isDark
          ? new ContrastCurve(22, 22, 26, 30).get(s.contrastLevel)
          : new ContrastCurve(90, 90, 84, 80).get(s.contrastLevel),
      isBackground: true,
    });
  }
  onSurface() {
    return DynamicColor.fromPalette({
      name: 'on_surface',
      palette: (s) => s.neutralPalette,
      tone: (s) => (s.isDark ? 90 : 10),
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21),
    });
  }
  surfaceVariant() {
    return DynamicColor.fromPalette({
      name: 'surface_variant',
      palette: (s) => s.neutralVariantPalette,
      tone: (s) => (s.isDark ? 30 : 90),
      isBackground: true,
    });
  }
  onSurfaceVariant() {
    return DynamicColor.fromPalette({
      name: 'on_surface_variant',
      palette: (s) => s.neutralVariantPalette,
      tone: (s) => (s.isDark ? 80 : 30),
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11),
    });
  }
  inverseSurface() {
    return DynamicColor.fromPalette({
      name: 'inverse_surface',
      palette: (s) => s.neutralPalette,
      tone: (s) => (s.isDark ? 90 : 20),
      isBackground: true,
    });
  }
  inverseOnSurface() {
    return DynamicColor.fromPalette({
      name: 'inverse_on_surface',
      palette: (s) => s.neutralPalette,
      tone: (s) => (s.isDark ? 20 : 95),
      background: (s) => this.inverseSurface(),
      contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21),
    });
  }
  outline() {
    return DynamicColor.fromPalette({
      name: 'outline',
      palette: (s) => s.neutralVariantPalette,
      tone: (s) => (s.isDark ? 60 : 50),
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(1.5, 3, 4.5, 7),
    });
  }
  outlineVariant() {
    return DynamicColor.fromPalette({
      name: 'outline_variant',
      palette: (s) => s.neutralVariantPalette,
      tone: (s) => (s.isDark ? 30 : 80),
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
    });
  }
  shadow() {
    return DynamicColor.fromPalette({
      name: 'shadow',
      palette: (s) => s.neutralPalette,
      tone: (s) => 0,
    });
  }
  scrim() {
    return DynamicColor.fromPalette({
      name: 'scrim',
      palette: (s) => s.neutralPalette,
      tone: (s) => 0,
    });
  }
  surfaceTint() {
    return DynamicColor.fromPalette({
      name: 'surface_tint',
      palette: (s) => s.primaryPalette,
      tone: (s) => (s.isDark ? 80 : 40),
      isBackground: true,
    });
  }
  primary() {
    return DynamicColor.fromPalette({
      name: 'primary',
      palette: (s) => s.primaryPalette,
      tone: (s) => {
        if (isMonochrome(s)) return s.isDark ? 100 : 0;
        return s.isDark ? 80 : 40;
      },
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 7),
      toneDeltaPair: (s) => new ToneDeltaPair(this.primaryContainer(), this.primary(), 10, 'nearer', false),
    });
  }
  primaryDim() {
    return undefined;
  }
  onPrimary() {
    return DynamicColor.fromPalette({
      name: 'on_primary',
      palette: (s) => s.primaryPalette,
      tone: (s) => {
        if (isMonochrome(s)) return s.isDark ? 10 : 90;
        return s.isDark ? 20 : 100;
      },
      background: (s) => this.primary(),
      contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21),
    });
  }
  primaryContainer() {
    return DynamicColor.fromPalette({
      name: 'primary_container',
      palette: (s) => s.primaryPalette,
      tone: (s) => {
        if (isFidelity(s)) return s.sourceColorHct.tone;
        if (isMonochrome(s)) return s.isDark ? 85 : 25;
        return s.isDark ? 30 : 90;
      },
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
      toneDeltaPair: (s) => new ToneDeltaPair(this.primaryContainer(), this.primary(), 10, 'nearer', false),
    });
  }
  onPrimaryContainer() {
    return DynamicColor.fromPalette({
      name: 'on_primary_container',
      palette: (s) => s.primaryPalette,
      tone: (s) => {
        if (isFidelity(s)) return DynamicColor.foregroundTone(this.primaryContainer().tone(s), 4.5);
        if (isMonochrome(s)) return s.isDark ? 0 : 100;
        return s.isDark ? 90 : 30;
      },
      background: (s) => this.primaryContainer(),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11),
    });
  }
  inversePrimary() {
    return DynamicColor.fromPalette({
      name: 'inverse_primary',
      palette: (s) => s.primaryPalette,
      tone: (s) => (s.isDark ? 40 : 80),
      background: (s) => this.inverseSurface(),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 7),
    });
  }
  secondary() {
    return DynamicColor.fromPalette({
      name: 'secondary',
      palette: (s) => s.secondaryPalette,
      tone: (s) => (s.isDark ? 80 : 40),
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 7),
      toneDeltaPair: (s) => new ToneDeltaPair(this.secondaryContainer(), this.secondary(), 10, 'nearer', false),
    });
  }
  secondaryDim() {
    return undefined;
  }
  onSecondary() {
    return DynamicColor.fromPalette({
      name: 'on_secondary',
      palette: (s) => s.secondaryPalette,
      tone: (s) => {
        if (isMonochrome(s)) return s.isDark ? 10 : 100;
        return s.isDark ? 20 : 100;
      },
      background: (s) => this.secondary(),
      contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21),
    });
  }
  secondaryContainer() {
    return DynamicColor.fromPalette({
      name: 'secondary_container',
      palette: (s) => s.secondaryPalette,
      tone: (s) => {
        const initialTone = s.isDark ? 30 : 90;
        if (isMonochrome(s)) return s.isDark ? 30 : 85;
        if (!isFidelity(s)) return initialTone;
        return findDesiredChromaByTone(s.secondaryPalette.hue, s.secondaryPalette.chroma, initialTone, !s.isDark);
      },
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
      toneDeltaPair: (s) => new ToneDeltaPair(this.secondaryContainer(), this.secondary(), 10, 'nearer', false),
    });
  }
  onSecondaryContainer() {
    return DynamicColor.fromPalette({
      name: 'on_secondary_container',
      palette: (s) => s.secondaryPalette,
      tone: (s) => {
        if (isMonochrome(s)) return s.isDark ? 90 : 10;
        if (!isFidelity(s)) return s.isDark ? 90 : 30;
        return DynamicColor.foregroundTone(this.secondaryContainer().tone(s), 4.5);
      },
      background: (s) => this.secondaryContainer(),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11),
    });
  }
  tertiary() {
    return DynamicColor.fromPalette({
      name: 'tertiary',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => {
        if (isMonochrome(s)) return s.isDark ? 90 : 25;
        return s.isDark ? 80 : 40;
      },
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 7),
      toneDeltaPair: (s) => new ToneDeltaPair(this.tertiaryContainer(), this.tertiary(), 10, 'nearer', false),
    });
  }
  tertiaryDim() {
    return undefined;
  }
  onTertiary() {
    return DynamicColor.fromPalette({
      name: 'on_tertiary',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => {
        if (isMonochrome(s)) return s.isDark ? 10 : 90;
        return s.isDark ? 20 : 100;
      },
      background: (s) => this.tertiary(),
      contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21),
    });
  }
  tertiaryContainer() {
    return DynamicColor.fromPalette({
      name: 'tertiary_container',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => {
        if (isMonochrome(s)) return s.isDark ? 60 : 49;
        if (!isFidelity(s)) return s.isDark ? 30 : 90;
        const proposedHct = s.tertiaryPalette.getHct(s.sourceColorHct.tone);
        return DislikeAnalyzer.fixIfDisliked(proposedHct).tone;
      },
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
      toneDeltaPair: (s) => new ToneDeltaPair(this.tertiaryContainer(), this.tertiary(), 10, 'nearer', false),
    });
  }
  onTertiaryContainer() {
    return DynamicColor.fromPalette({
      name: 'on_tertiary_container',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => {
        if (isMonochrome(s)) return s.isDark ? 0 : 100;
        if (!isFidelity(s)) return s.isDark ? 90 : 30;
        return DynamicColor.foregroundTone(this.tertiaryContainer().tone(s), 4.5);
      },
      background: (s) => this.tertiaryContainer(),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11),
    });
  }
  error() {
    return DynamicColor.fromPalette({
      name: 'error',
      palette: (s) => s.errorPalette,
      tone: (s) => (s.isDark ? 80 : 40),
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 7),
      toneDeltaPair: (s) => new ToneDeltaPair(this.errorContainer(), this.error(), 10, 'nearer', false),
    });
  }
  errorDim() {
    return undefined;
  }
  onError() {
    return DynamicColor.fromPalette({
      name: 'on_error',
      palette: (s) => s.errorPalette,
      tone: (s) => (s.isDark ? 20 : 100),
      background: (s) => this.error(),
      contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21),
    });
  }
  errorContainer() {
    return DynamicColor.fromPalette({
      name: 'error_container',
      palette: (s) => s.errorPalette,
      tone: (s) => (s.isDark ? 30 : 90),
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
      toneDeltaPair: (s) => new ToneDeltaPair(this.errorContainer(), this.error(), 10, 'nearer', false),
    });
  }
  onErrorContainer() {
    return DynamicColor.fromPalette({
      name: 'on_error_container',
      palette: (s) => s.errorPalette,
      tone: (s) => {
        if (isMonochrome(s)) return s.isDark ? 90 : 10;
        return s.isDark ? 90 : 30;
      },
      background: (s) => this.errorContainer(),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11),
    });
  }
  primaryFixed() {
    return DynamicColor.fromPalette({
      name: 'primary_fixed',
      palette: (s) => s.primaryPalette,
      tone: (s) => (isMonochrome(s) ? 40.0 : 90.0),
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
      toneDeltaPair: (s) => new ToneDeltaPair(this.primaryFixed(), this.primaryFixedDim(), 10, 'lighter', true),
    });
  }
  primaryFixedDim() {
    return DynamicColor.fromPalette({
      name: 'primary_fixed_dim',
      palette: (s) => s.primaryPalette,
      tone: (s) => (isMonochrome(s) ? 30.0 : 80.0),
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
      toneDeltaPair: (s) => new ToneDeltaPair(this.primaryFixed(), this.primaryFixedDim(), 10, 'lighter', true),
    });
  }
  onPrimaryFixed() {
    return DynamicColor.fromPalette({
      name: 'on_primary_fixed',
      palette: (s) => s.primaryPalette,
      tone: (s) => (isMonochrome(s) ? 100.0 : 10.0),
      background: (s) => this.primaryFixedDim(),
      secondBackground: (s) => this.primaryFixed(),
      contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21),
    });
  }
  onPrimaryFixedVariant() {
    return DynamicColor.fromPalette({
      name: 'on_primary_fixed_variant',
      palette: (s) => s.primaryPalette,
      tone: (s) => (isMonochrome(s) ? 90.0 : 30.0),
      background: (s) => this.primaryFixedDim(),
      secondBackground: (s) => this.primaryFixed(),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11),
    });
  }
  secondaryFixed() {
    return DynamicColor.fromPalette({
      name: 'secondary_fixed',
      palette: (s) => s.secondaryPalette,
      tone: (s) => (isMonochrome(s) ? 80.0 : 90.0),
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
      toneDeltaPair: (s) => new ToneDeltaPair(this.secondaryFixed(), this.secondaryFixedDim(), 10, 'lighter', true),
    });
  }
  secondaryFixedDim() {
    return DynamicColor.fromPalette({
      name: 'secondary_fixed_dim',
      palette: (s) => s.secondaryPalette,
      tone: (s) => (isMonochrome(s) ? 70.0 : 80.0),
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
      toneDeltaPair: (s) => new ToneDeltaPair(this.secondaryFixed(), this.secondaryFixedDim(), 10, 'lighter', true),
    });
  }
  onSecondaryFixed() {
    return DynamicColor.fromPalette({
      name: 'on_secondary_fixed',
      palette: (s) => s.secondaryPalette,
      tone: (s) => 10.0,
      background: (s) => this.secondaryFixedDim(),
      secondBackground: (s) => this.secondaryFixed(),
      contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21),
    });
  }
  onSecondaryFixedVariant() {
    return DynamicColor.fromPalette({
      name: 'on_secondary_fixed_variant',
      palette: (s) => s.secondaryPalette,
      tone: (s) => (isMonochrome(s) ? 25.0 : 30.0),
      background: (s) => this.secondaryFixedDim(),
      secondBackground: (s) => this.secondaryFixed(),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11),
    });
  }
  tertiaryFixed() {
    return DynamicColor.fromPalette({
      name: 'tertiary_fixed',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => (isMonochrome(s) ? 40.0 : 90.0),
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
      toneDeltaPair: (s) => new ToneDeltaPair(this.tertiaryFixed(), this.tertiaryFixedDim(), 10, 'lighter', true),
    });
  }
  tertiaryFixedDim() {
    return DynamicColor.fromPalette({
      name: 'tertiary_fixed_dim',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => (isMonochrome(s) ? 30.0 : 80.0),
      isBackground: true,
      background: (s) => this.highestSurface(s),
      contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
      toneDeltaPair: (s) => new ToneDeltaPair(this.tertiaryFixed(), this.tertiaryFixedDim(), 10, 'lighter', true),
    });
  }
  onTertiaryFixed() {
    return DynamicColor.fromPalette({
      name: 'on_tertiary_fixed',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => (isMonochrome(s) ? 100.0 : 10.0),
      background: (s) => this.tertiaryFixedDim(),
      secondBackground: (s) => this.tertiaryFixed(),
      contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21),
    });
  }
  onTertiaryFixedVariant() {
    return DynamicColor.fromPalette({
      name: 'on_tertiary_fixed_variant',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => (isMonochrome(s) ? 90.0 : 30.0),
      background: (s) => this.tertiaryFixedDim(),
      secondBackground: (s) => this.tertiaryFixed(),
      contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11),
    });
  }
  highestSurface(s) {
    return s.isDark ? this.surfaceBright() : this.surfaceDim();
  }
}

class ColorSpecDelegateImpl2025 extends ColorSpecDelegateImpl2021 {
  surface() {
    const color2025 = DynamicColor.fromPalette({
      name: 'surface',
      palette: (s) => s.neutralPalette,
      tone: (s) => {
        if (s.platform === 'phone') {
          if (s.isDark) return 4;
          if (Hct.isYellow(s.neutralPalette.hue)) return 99;
          if (s.variant === 3) return 97;
          return 98;
        }
        return 0;
      },
      isBackground: true,
    });
    return extendSpecVersion(super.surface(), '2025', color2025);
  }
  surfaceDim() {
    const color2025 = DynamicColor.fromPalette({
      name: 'surface_dim',
      palette: (s) => s.neutralPalette,
      tone: (s) => {
        if (s.isDark) return 4;
        if (Hct.isYellow(s.neutralPalette.hue)) return 90;
        if (s.variant === 3) return 85;
        return 87;
      },
      isBackground: true,
      chromaMultiplier: (s) => {
        if (!s.isDark) {
          if (s.variant === 1) return 2.5;
          else if (s.variant === 2) return 1.7;
          else if (s.variant === 4) return Hct.isYellow(s.neutralPalette.hue) ? 2.7 : 1.75;
          else if (s.variant === 3) return 1.36;
        }
        return 1;
      },
    });
    return extendSpecVersion(super.surfaceDim(), '2025', color2025);
  }
  surfaceBright() {
    const color2025 = DynamicColor.fromPalette({
      name: 'surface_bright',
      palette: (s) => s.neutralPalette,
      tone: (s) => {
        if (s.isDark) return 18;
        if (Hct.isYellow(s.neutralPalette.hue)) return 99;
        if (s.variant === 3) return 97;
        return 98;
      },
      isBackground: true,
      chromaMultiplier: (s) => {
        if (s.isDark) {
          if (s.variant === 1) return 2.5;
          else if (s.variant === 2) return 1.7;
          else if (s.variant === 4) return Hct.isYellow(s.neutralPalette.hue) ? 2.7 : 1.75;
          else if (s.variant === 3) return 1.36;
        }
        return 1;
      },
    });
    return extendSpecVersion(super.surfaceBright(), '2025', color2025);
  }
  surfaceContainerLowest() {
    const color2025 = DynamicColor.fromPalette({
      name: 'surface_container_lowest',
      palette: (s) => s.neutralPalette,
      tone: (s) => (s.isDark ? 0 : 100),
      isBackground: true,
    });
    return extendSpecVersion(super.surfaceContainerLowest(), '2025', color2025);
  }
  surfaceContainerLow() {
    const color2025 = DynamicColor.fromPalette({
      name: 'surface_container_low',
      palette: (s) => s.neutralPalette,
      tone: (s) => {
        if (s.platform === 'phone') {
          if (s.isDark) return 6;
          if (Hct.isYellow(s.neutralPalette.hue)) return 98;
          if (s.variant === 3) return 95;
          return 96;
        }
        return 15;
      },
      isBackground: true,
      chromaMultiplier: (s) => {
        if (s.platform === 'phone') {
          if (s.variant === 1) return 1.3;
          else if (s.variant === 2) return 1.25;
          else if (s.variant === 4) return Hct.isYellow(s.neutralPalette.hue) ? 1.3 : 1.15;
          else if (s.variant === 3) return 1.08;
        }
        return 1;
      },
    });
    return extendSpecVersion(super.surfaceContainerLow(), '2025', color2025);
  }
  surfaceContainer() {
    const color2025 = DynamicColor.fromPalette({
      name: 'surface_container',
      palette: (s) => s.neutralPalette,
      tone: (s) => {
        if (s.platform === 'phone') {
          if (s.isDark) return 9;
          if (Hct.isYellow(s.neutralPalette.hue)) return 96;
          if (s.variant === 3) return 92;
          return 94;
        }
        return 20;
      },
      isBackground: true,
      chromaMultiplier: (s) => {
        if (s.platform === 'phone') {
          if (s.variant === 1) return 1.6;
          else if (s.variant === 2) return 1.4;
          else if (s.variant === 4) return Hct.isYellow(s.neutralPalette.hue) ? 1.6 : 1.3;
          else if (s.variant === 3) return 1.15;
        }
        return 1;
      },
    });
    return extendSpecVersion(super.surfaceContainer(), '2025', color2025);
  }
  surfaceContainerHigh() {
    const color2025 = DynamicColor.fromPalette({
      name: 'surface_container_high',
      palette: (s) => s.neutralPalette,
      tone: (s) => {
        if (s.platform === 'phone') {
          if (s.isDark) return 12;
          if (Hct.isYellow(s.neutralPalette.hue)) return 94;
          if (s.variant === 3) return 90;
          return 92;
        }
        return 25;
      },
      isBackground: true,
      chromaMultiplier: (s) => {
        if (s.platform === 'phone') {
          if (s.variant === 1) return 1.9;
          else if (s.variant === 2) return 1.5;
          else if (s.variant === 4) return Hct.isYellow(s.neutralPalette.hue) ? 1.95 : 1.45;
          else if (s.variant === 3) return 1.22;
        }
        return 1;
      },
    });
    return extendSpecVersion(super.surfaceContainerHigh(), '2025', color2025);
  }
  surfaceContainerHighest() {
    const color2025 = DynamicColor.fromPalette({
      name: 'surface_container_highest',
      palette: (s) => s.neutralPalette,
      tone: (s) => {
        if (s.isDark) return 15;
        if (Hct.isYellow(s.neutralPalette.hue)) return 92;
        if (s.variant === 3) return 88;
        return 90;
      },
      isBackground: true,
      chromaMultiplier: (s) => {
        if (s.variant === 1) return 2.2;
        else if (s.variant === 2) return 1.7;
        else if (s.variant === 4) return Hct.isYellow(s.neutralPalette.hue) ? 2.3 : 1.6;
        else if (s.variant === 3) return 1.29;
        return 1;
      },
    });
    return extendSpecVersion(super.surfaceContainerHighest(), '2025', color2025);
  }
  onSurface() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_surface',
      palette: (s) => s.neutralPalette,
      tone: (s) => {
        if (s.variant === 3) return tMaxC(s.neutralPalette, 0, 100, 1.1);
        return DynamicColor.getInitialToneFromBackground((s2) =>
          s2.platform === 'phone' ? this.highestSurface(s2) : this.surfaceContainerHigh(),
        )(s);
      },
      chromaMultiplier: (s) => {
        if (s.platform === 'phone') {
          if (s.variant === 1) return 2.2;
          else if (s.variant === 2) return 1.7;
          else if (s.variant === 4)
            return Hct.isYellow(s.neutralPalette.hue) ? (s.isDark ? 3.0 : 2.3) : 1.6;
        }
        return 1;
      },
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : this.surfaceContainerHigh()),
      contrastCurve: (s) => (s.isDark && s.platform === 'phone' ? getCurve(11) : getCurve(9)),
    });
    return extendSpecVersion(super.onSurface(), '2025', color2025);
  }
  onSurfaceVariant() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_surface_variant',
      palette: (s) => s.neutralPalette,
      chromaMultiplier: (s) => {
        if (s.platform === 'phone') {
          if (s.variant === 1) return 2.2;
          else if (s.variant === 2) return 1.7;
          else if (s.variant === 4)
            return Hct.isYellow(s.neutralPalette.hue) ? (s.isDark ? 3.0 : 2.3) : 1.6;
        }
        return 1;
      },
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : this.surfaceContainerHigh()),
      contrastCurve: (s) =>
        s.platform === 'phone' ? (s.isDark ? getCurve(6) : getCurve(4.5)) : getCurve(7),
    });
    return extendSpecVersion(super.onSurfaceVariant(), '2025', color2025);
  }
  outline() {
    const color2025 = DynamicColor.fromPalette({
      name: 'outline',
      palette: (s) => s.neutralPalette,
      chromaMultiplier: (s) => {
        if (s.platform === 'phone') {
          if (s.variant === 1) return 2.2;
          else if (s.variant === 2) return 1.7;
          else if (s.variant === 4)
            return Hct.isYellow(s.neutralPalette.hue) ? (s.isDark ? 3.0 : 2.3) : 1.6;
        }
        return 1;
      },
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : this.surfaceContainerHigh()),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(3) : getCurve(4.5)),
    });
    return extendSpecVersion(super.outline(), '2025', color2025);
  }
  outlineVariant() {
    const color2025 = DynamicColor.fromPalette({
      name: 'outline_variant',
      palette: (s) => s.neutralPalette,
      chromaMultiplier: (s) => {
        if (s.platform === 'phone') {
          if (s.variant === 1) return 2.2;
          else if (s.variant === 2) return 1.7;
          else if (s.variant === 4)
            return Hct.isYellow(s.neutralPalette.hue) ? (s.isDark ? 3.0 : 2.3) : 1.6;
        }
        return 1;
      },
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : this.surfaceContainerHigh()),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(1.5) : getCurve(3)),
    });
    return extendSpecVersion(super.outlineVariant(), '2025', color2025);
  }
  inverseSurface() {
    const color2025 = DynamicColor.fromPalette({
      name: 'inverse_surface',
      palette: (s) => s.neutralPalette,
      tone: (s) => (s.isDark ? 98 : 4),
      isBackground: true,
    });
    return extendSpecVersion(super.inverseSurface(), '2025', color2025);
  }
  inverseOnSurface() {
    const color2025 = DynamicColor.fromPalette({
      name: 'inverse_on_surface',
      palette: (s) => s.neutralPalette,
      background: (s) => this.inverseSurface(),
      contrastCurve: (s) => getCurve(7),
    });
    return extendSpecVersion(super.inverseOnSurface(), '2025', color2025);
  }
  primary() {
    const color2025 = DynamicColor.fromPalette({
      name: 'primary',
      palette: (s) => s.primaryPalette,
      tone: (s) => {
        if (s.variant === 1) {
          if (s.platform === 'phone') return s.isDark ? 80 : 40;
          return 90;
        } else if (s.variant === 2) {
          if (s.platform === 'phone') {
            if (s.isDark) return 80;
            return tMaxC(s.primaryPalette);
          }
          return tMaxC(s.primaryPalette, 0, 90);
        } else if (s.variant === 4) {
          if (s.platform === 'phone') {
            return tMaxC(
              s.primaryPalette,
              0,
              Hct.isYellow(s.primaryPalette.hue) ? 25 : Hct.isCyan(s.primaryPalette.hue) ? 88 : 98,
            );
          }
          return tMaxC(s.primaryPalette);
        } else {
          if (s.platform === 'phone') {
            return tMaxC(s.primaryPalette, 0, Hct.isCyan(s.primaryPalette.hue) ? 88 : 98);
          }
          return tMaxC(s.primaryPalette);
        }
      },
      isBackground: true,
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : this.surfaceContainerHigh()),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(4.5) : getCurve(7)),
      toneDeltaPair: (s) =>
        s.platform === 'phone'
          ? new ToneDeltaPair(this.primaryContainer(), this.primary(), 5, 'relative_lighter', true, 'farther')
          : undefined,
    });
    return extendSpecVersion(super.primary(), '2025', color2025);
  }
  primaryDim() {
    return DynamicColor.fromPalette({
      name: 'primary_dim',
      palette: (s) => s.primaryPalette,
      tone: (s) => {
        if (s.variant === 1) return 85;
        else if (s.variant === 2) return tMaxC(s.primaryPalette, 0, 90);
        return tMaxC(s.primaryPalette);
      },
      isBackground: true,
      background: (s) => this.surfaceContainerHigh(),
      contrastCurve: (s) => getCurve(4.5),
      toneDeltaPair: (s) => new ToneDeltaPair(this.primaryDim(), this.primary(), 5, 'darker', true, 'farther'),
    });
  }
  onPrimary() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_primary',
      palette: (s) => s.primaryPalette,
      background: (s) => (s.platform === 'phone' ? this.primary() : this.primaryDim()),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(6) : getCurve(7)),
    });
    return extendSpecVersion(super.onPrimary(), '2025', color2025);
  }
  primaryContainer() {
    const color2025 = DynamicColor.fromPalette({
      name: 'primary_container',
      palette: (s) => s.primaryPalette,
      tone: (s) => {
        if (s.platform === 'watch') return 30;
        else if (s.variant === 1) return s.isDark ? 30 : 90;
        else if (s.variant === 2)
          return s.isDark ? tMinC(s.primaryPalette, 35, 93) : tMaxC(s.primaryPalette, 0, 90);
        else if (s.variant === 4)
          return s.isDark
            ? tMaxC(s.primaryPalette, 30, 93)
            : tMaxC(s.primaryPalette, 78, Hct.isCyan(s.primaryPalette.hue) ? 88 : 90);
        else
          return s.isDark
            ? tMinC(s.primaryPalette, 66, 93)
            : tMaxC(s.primaryPalette, 66, Hct.isCyan(s.primaryPalette.hue) ? 88 : 93);
      },
      isBackground: true,
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : undefined),
      toneDeltaPair: (s) =>
        s.platform === 'phone'
          ? undefined
          : new ToneDeltaPair(this.primaryContainer(), this.primaryDim(), 10, 'darker', true, 'farther'),
      contrastCurve: (s) => (s.platform === 'phone' && s.contrastLevel > 0 ? getCurve(1.5) : undefined),
    });
    return extendSpecVersion(super.primaryContainer(), '2025', color2025);
  }
  onPrimaryContainer() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_primary_container',
      palette: (s) => s.primaryPalette,
      background: (s) => this.primaryContainer(),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(6) : getCurve(7)),
    });
    return extendSpecVersion(super.onPrimaryContainer(), '2025', color2025);
  }
  primaryFixed() {
    const color2025 = DynamicColor.fromPalette({
      name: 'primary_fixed',
      palette: (s) => s.primaryPalette,
      tone: (s) => {
        const tempS = Object.assign({}, s, { isDark: false, contrastLevel: 0 });
        return this.primaryContainer().getTone(tempS);
      },
      isBackground: true,
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : undefined),
      contrastCurve: (s) => (s.platform === 'phone' && s.contrastLevel > 0 ? getCurve(1.5) : undefined),
    });
    return extendSpecVersion(super.primaryFixed(), '2025', color2025);
  }
  primaryFixedDim() {
    const color2025 = DynamicColor.fromPalette({
      name: 'primary_fixed_dim',
      palette: (s) => s.primaryPalette,
      tone: (s) => this.primaryFixed().getTone(s),
      isBackground: true,
      toneDeltaPair: (s) =>
        new ToneDeltaPair(this.primaryFixedDim(), this.primaryFixed(), 5, 'darker', true, 'exact'),
    });
    return extendSpecVersion(super.primaryFixedDim(), '2025', color2025);
  }
  onPrimaryFixed() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_primary_fixed',
      palette: (s) => s.primaryPalette,
      background: (s) => this.primaryFixedDim(),
      contrastCurve: (s) => getCurve(7),
    });
    return extendSpecVersion(super.onPrimaryFixed(), '2025', color2025);
  }
  onPrimaryFixedVariant() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_primary_fixed_variant',
      palette: (s) => s.primaryPalette,
      background: (s) => this.primaryFixedDim(),
      contrastCurve: (s) => getCurve(4.5),
    });
    return extendSpecVersion(super.onPrimaryFixedVariant(), '2025', color2025);
  }
  inversePrimary() {
    const color2025 = DynamicColor.fromPalette({
      name: 'inverse_primary',
      palette: (s) => s.primaryPalette,
      tone: (s) => tMaxC(s.primaryPalette),
      background: (s) => this.inverseSurface(),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(6) : getCurve(7)),
    });
    return extendSpecVersion(super.inversePrimary(), '2025', color2025);
  }
  secondary() {
    const color2025 = DynamicColor.fromPalette({
      name: 'secondary',
      palette: (s) => s.secondaryPalette,
      tone: (s) => {
        if (s.platform === 'watch') {
          return s.variant === 1 ? 90 : tMaxC(s.secondaryPalette, 0, 90);
        } else if (s.variant === 1) {
          return s.isDark ? tMinC(s.secondaryPalette, 0, 98) : tMaxC(s.secondaryPalette);
        } else if (s.variant === 3) {
          return tMaxC(s.secondaryPalette, 0, s.isDark ? 90 : 98);
        } else {
          return s.isDark ? 80 : tMaxC(s.secondaryPalette);
        }
      },
      isBackground: true,
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : this.surfaceContainerHigh()),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(4.5) : getCurve(7)),
      toneDeltaPair: (s) =>
        s.platform === 'phone'
          ? new ToneDeltaPair(this.secondaryContainer(), this.secondary(), 5, 'relative_lighter', true, 'farther')
          : undefined,
    });
    return extendSpecVersion(super.secondary(), '2025', color2025);
  }
  secondaryDim() {
    return DynamicColor.fromPalette({
      name: 'secondary_dim',
      palette: (s) => s.secondaryPalette,
      tone: (s) => {
        if (s.variant === 1) return 85;
        return tMaxC(s.secondaryPalette, 0, 90);
      },
      isBackground: true,
      background: (s) => this.surfaceContainerHigh(),
      contrastCurve: (s) => getCurve(4.5),
      toneDeltaPair: (s) =>
        new ToneDeltaPair(this.secondaryDim(), this.secondary(), 5, 'darker', true, 'farther'),
    });
  }
  onSecondary() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_secondary',
      palette: (s) => s.secondaryPalette,
      background: (s) => (s.platform === 'phone' ? this.secondary() : this.secondaryDim()),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(6) : getCurve(7)),
    });
    return extendSpecVersion(super.onSecondary(), '2025', color2025);
  }
  secondaryContainer() {
    const color2025 = DynamicColor.fromPalette({
      name: 'secondary_container',
      palette: (s) => s.secondaryPalette,
      tone: (s) => {
        if (s.platform === 'watch') return 30;
        else if (s.variant === 3)
          return s.isDark ? tMinC(s.secondaryPalette, 30, 40) : tMaxC(s.secondaryPalette, 84, 90);
        else if (s.variant === 4) return s.isDark ? 15 : tMaxC(s.secondaryPalette, 90, 95);
        return s.isDark ? 25 : 90;
      },
      isBackground: true,
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : undefined),
      toneDeltaPair: (s) =>
        s.platform === 'watch'
          ? new ToneDeltaPair(this.secondaryContainer(), this.secondaryDim(), 10, 'darker', true, 'farther')
          : undefined,
      contrastCurve: (s) => (s.platform === 'phone' && s.contrastLevel > 0 ? getCurve(1.5) : undefined),
    });
    return extendSpecVersion(super.secondaryContainer(), '2025', color2025);
  }
  onSecondaryContainer() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_secondary_container',
      palette: (s) => s.secondaryPalette,
      background: (s) => this.secondaryContainer(),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(6) : getCurve(7)),
    });
    return extendSpecVersion(super.onSecondaryContainer(), '2025', color2025);
  }
  secondaryFixed() {
    const color2025 = DynamicColor.fromPalette({
      name: 'secondary_fixed',
      palette: (s) => s.secondaryPalette,
      tone: (s) => {
        const tempS = Object.assign({}, s, { isDark: false, contrastLevel: 0 });
        return this.secondaryContainer().getTone(tempS);
      },
      isBackground: true,
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : undefined),
      contrastCurve: (s) => (s.platform === 'phone' && s.contrastLevel > 0 ? getCurve(1.5) : undefined),
    });
    return extendSpecVersion(super.secondaryFixed(), '2025', color2025);
  }
  secondaryFixedDim() {
    const color2025 = DynamicColor.fromPalette({
      name: 'secondary_fixed_dim',
      palette: (s) => s.secondaryPalette,
      tone: (s) => this.secondaryFixed().getTone(s),
      isBackground: true,
      toneDeltaPair: (s) =>
        new ToneDeltaPair(this.secondaryFixedDim(), this.secondaryFixed(), 5, 'darker', true, 'exact'),
    });
    return extendSpecVersion(super.secondaryFixedDim(), '2025', color2025);
  }
  onSecondaryFixed() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_secondary_fixed',
      palette: (s) => s.secondaryPalette,
      background: (s) => this.secondaryFixedDim(),
      contrastCurve: (s) => getCurve(7),
    });
    return extendSpecVersion(super.onSecondaryFixed(), '2025', color2025);
  }
  onSecondaryFixedVariant() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_secondary_fixed_variant',
      palette: (s) => s.secondaryPalette,
      background: (s) => this.secondaryFixedDim(),
      contrastCurve: (s) => getCurve(4.5),
    });
    return extendSpecVersion(super.onSecondaryFixedVariant(), '2025', color2025);
  }
  tertiary() {
    const color2025 = DynamicColor.fromPalette({
      name: 'tertiary',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => {
        if (s.platform === 'watch') {
          return s.variant === 2 ? tMaxC(s.tertiaryPalette, 0, 90) : tMaxC(s.tertiaryPalette);
        } else if (s.variant === 4 || s.variant === 3) {
          return tMaxC(
            s.tertiaryPalette,
            0,
            Hct.isCyan(s.tertiaryPalette.hue) ? 88 : s.isDark ? 98 : 100,
          );
        } else {
          return s.isDark ? tMaxC(s.tertiaryPalette, 0, 98) : tMaxC(s.tertiaryPalette);
        }
      },
      isBackground: true,
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : this.surfaceContainerHigh()),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(4.5) : getCurve(7)),
      toneDeltaPair: (s) =>
        s.platform === 'phone'
          ? new ToneDeltaPair(this.tertiaryContainer(), this.tertiary(), 5, 'relative_lighter', true, 'farther')
          : undefined,
    });
    return extendSpecVersion(super.tertiary(), '2025', color2025);
  }
  tertiaryDim() {
    return DynamicColor.fromPalette({
      name: 'tertiary_dim',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => {
        if (s.variant === 2) return tMaxC(s.tertiaryPalette, 0, 90);
        return tMaxC(s.tertiaryPalette);
      },
      isBackground: true,
      background: (s) => this.surfaceContainerHigh(),
      contrastCurve: (s) => getCurve(4.5),
      toneDeltaPair: (s) =>
        new ToneDeltaPair(this.tertiaryDim(), this.tertiary(), 5, 'darker', true, 'farther'),
    });
  }
  onTertiary() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_tertiary',
      palette: (s) => s.tertiaryPalette,
      background: (s) => (s.platform === 'phone' ? this.tertiary() : this.tertiaryDim()),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(6) : getCurve(7)),
    });
    return extendSpecVersion(super.onTertiary(), '2025', color2025);
  }
  tertiaryContainer() {
    const color2025 = DynamicColor.fromPalette({
      name: 'tertiary_container',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => {
        if (s.platform === 'watch') {
          return s.variant === 2 ? tMaxC(s.tertiaryPalette, 0, 90) : tMaxC(s.tertiaryPalette);
        }
        if (s.variant === 1) return s.isDark ? tMaxC(s.tertiaryPalette, 0, 93) : tMaxC(s.tertiaryPalette, 0, 96);
        else if (s.variant === 2) return tMaxC(s.tertiaryPalette, 0, s.isDark ? 93 : 100);
        else if (s.variant === 4)
          return tMaxC(
            s.tertiaryPalette,
            75,
            Hct.isCyan(s.tertiaryPalette.hue) ? 88 : s.isDark ? 93 : 100,
          );
        else return s.isDark ? tMaxC(s.tertiaryPalette, 0, 93) : tMaxC(s.tertiaryPalette, 72, 100);
      },
      isBackground: true,
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : undefined),
      toneDeltaPair: (s) =>
        s.platform === 'watch'
          ? new ToneDeltaPair(this.tertiaryContainer(), this.tertiaryDim(), 10, 'darker', true, 'farther')
          : undefined,
      contrastCurve: (s) => (s.platform === 'phone' && s.contrastLevel > 0 ? getCurve(1.5) : undefined),
    });
    return extendSpecVersion(super.tertiaryContainer(), '2025', color2025);
  }
  onTertiaryContainer() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_tertiary_container',
      palette: (s) => s.tertiaryPalette,
      background: (s) => this.tertiaryContainer(),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(6) : getCurve(7)),
    });
    return extendSpecVersion(super.onTertiaryContainer(), '2025', color2025);
  }
  tertiaryFixed() {
    const color2025 = DynamicColor.fromPalette({
      name: 'tertiary_fixed',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => {
        const tempS = Object.assign({}, s, { isDark: false, contrastLevel: 0 });
        return this.tertiaryContainer().getTone(tempS);
      },
      isBackground: true,
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : undefined),
      contrastCurve: (s) => (s.platform === 'phone' && s.contrastLevel > 0 ? getCurve(1.5) : undefined),
    });
    return extendSpecVersion(super.tertiaryFixed(), '2025', color2025);
  }
  tertiaryFixedDim() {
    const color2025 = DynamicColor.fromPalette({
      name: 'tertiary_fixed_dim',
      palette: (s) => s.tertiaryPalette,
      tone: (s) => this.tertiaryFixed().getTone(s),
      isBackground: true,
      toneDeltaPair: (s) =>
        new ToneDeltaPair(this.tertiaryFixedDim(), this.tertiaryFixed(), 5, 'darker', true, 'exact'),
    });
    return extendSpecVersion(super.tertiaryFixedDim(), '2025', color2025);
  }
  onTertiaryFixed() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_tertiary_fixed',
      palette: (s) => s.tertiaryPalette,
      background: (s) => this.tertiaryFixedDim(),
      contrastCurve: (s) => getCurve(7),
    });
    return extendSpecVersion(super.onTertiaryFixed(), '2025', color2025);
  }
  onTertiaryFixedVariant() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_tertiary_fixed_variant',
      palette: (s) => s.tertiaryPalette,
      background: (s) => this.tertiaryFixedDim(),
      contrastCurve: (s) => getCurve(4.5),
    });
    return extendSpecVersion(super.onTertiaryFixedVariant(), '2025', color2025);
  }
  error() {
    const color2025 = DynamicColor.fromPalette({
      name: 'error',
      palette: (s) => s.errorPalette,
      tone: (s) => {
        if (s.platform === 'phone') {
          return s.isDark ? tMinC(s.errorPalette, 0, 98) : tMaxC(s.errorPalette);
        }
        return tMinC(s.errorPalette);
      },
      isBackground: true,
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : this.surfaceContainerHigh()),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(4.5) : getCurve(7)),
      toneDeltaPair: (s) =>
        s.platform === 'phone'
          ? new ToneDeltaPair(this.errorContainer(), this.error(), 5, 'relative_lighter', true, 'farther')
          : undefined,
    });
    return extendSpecVersion(super.error(), '2025', color2025);
  }
  errorDim() {
    return DynamicColor.fromPalette({
      name: 'error_dim',
      palette: (s) => s.errorPalette,
      tone: (s) => tMinC(s.errorPalette),
      isBackground: true,
      background: (s) => this.surfaceContainerHigh(),
      contrastCurve: (s) => getCurve(4.5),
      toneDeltaPair: (s) => new ToneDeltaPair(this.errorDim(), this.error(), 5, 'darker', true, 'farther'),
    });
  }
  onError() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_error',
      palette: (s) => s.errorPalette,
      background: (s) => (s.platform === 'phone' ? this.error() : this.errorDim()),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(6) : getCurve(7)),
    });
    return extendSpecVersion(super.onError(), '2025', color2025);
  }
  errorContainer() {
    const color2025 = DynamicColor.fromPalette({
      name: 'error_container',
      palette: (s) => s.errorPalette,
      tone: (s) => {
        if (s.platform === 'watch') return 30;
        return s.isDark ? tMinC(s.errorPalette, 30, 93) : tMaxC(s.errorPalette, 0, 90);
      },
      isBackground: true,
      background: (s) => (s.platform === 'phone' ? this.highestSurface(s) : undefined),
      toneDeltaPair: (s) =>
        s.platform === 'watch'
          ? new ToneDeltaPair(this.errorContainer(), this.errorDim(), 10, 'darker', true, 'farther')
          : undefined,
      contrastCurve: (s) => (s.platform === 'phone' && s.contrastLevel > 0 ? getCurve(1.5) : undefined),
    });
    return extendSpecVersion(super.errorContainer(), '2025', color2025);
  }
  onErrorContainer() {
    const color2025 = DynamicColor.fromPalette({
      name: 'on_error_container',
      palette: (s) => s.errorPalette,
      background: (s) => this.errorContainer(),
      contrastCurve: (s) => (s.platform === 'phone' ? getCurve(4.5) : getCurve(7)),
    });
    return extendSpecVersion(super.onErrorContainer(), '2025', color2025);
  }
  surfaceVariant() {
    const color2025 = Object.assign(this.surfaceContainerHighest().clone(), { name: 'surface_variant' });
    return extendSpecVersion(super.surfaceVariant(), '2025', color2025);
  }
  surfaceTint() {
    const color2025 = Object.assign(this.primary().clone(), { name: 'surface_tint' });
    return extendSpecVersion(super.surfaceTint(), '2025', color2025);
  }
  background() {
    const color2025 = Object.assign(this.surface().clone(), { name: 'background' });
    return extendSpecVersion(super.background(), '2025', color2025);
  }
  onBackground() {
    const color2025 = Object.assign(this.onSurface().clone(), {
      name: 'on_background',
      tone: (s) => (s.platform === 'watch' ? 100.0 : this.onSurface().getTone(s)),
    });
    return extendSpecVersion(super.onBackground(), '2025', color2025);
  }
}

const COLOR_SPEC = new ColorSpecDelegateImpl2025();

class MaterialDynamicColors {
  constructor() {
    this.allColors = [
      this.background(),
      this.onBackground(),
      this.surface(),
      this.surfaceDim(),
      this.surfaceBright(),
      this.surfaceContainerLowest(),
      this.surfaceContainerLow(),
      this.surfaceContainer(),
      this.surfaceContainerHigh(),
      this.surfaceContainerHighest(),
      this.onSurface(),
      this.onSurfaceVariant(),
      this.outline(),
      this.outlineVariant(),
      this.inverseSurface(),
      this.inverseOnSurface(),
      this.primary(),
      this.primaryDim(),
      this.onPrimary(),
      this.primaryContainer(),
      this.onPrimaryContainer(),
      this.primaryFixed(),
      this.primaryFixedDim(),
      this.onPrimaryFixed(),
      this.onPrimaryFixedVariant(),
      this.inversePrimary(),
      this.secondary(),
      this.secondaryDim(),
      this.onSecondary(),
      this.secondaryContainer(),
      this.onSecondaryContainer(),
      this.secondaryFixed(),
      this.secondaryFixedDim(),
      this.onSecondaryFixed(),
      this.onSecondaryFixedVariant(),
      this.tertiary(),
      this.tertiaryDim(),
      this.onTertiary(),
      this.tertiaryContainer(),
      this.onTertiaryContainer(),
      this.tertiaryFixed(),
      this.tertiaryFixedDim(),
      this.onTertiaryFixed(),
      this.onTertiaryFixedVariant(),
      this.error(),
      this.errorDim(),
      this.onError(),
      this.errorContainer(),
      this.onErrorContainer(),
    ].filter((c) => c !== undefined);
  }
  highestSurface(s) {
    return COLOR_SPEC.highestSurface(s);
  }
  background() {
    return COLOR_SPEC.background();
  }
  onBackground() {
    return COLOR_SPEC.onBackground();
  }
  surface() {
    return COLOR_SPEC.surface();
  }
  surfaceDim() {
    return COLOR_SPEC.surfaceDim();
  }
  surfaceBright() {
    return COLOR_SPEC.surfaceBright();
  }
  surfaceContainerLowest() {
    return COLOR_SPEC.surfaceContainerLowest();
  }
  surfaceContainerLow() {
    return COLOR_SPEC.surfaceContainerLow();
  }
  surfaceContainer() {
    return COLOR_SPEC.surfaceContainer();
  }
  surfaceContainerHigh() {
    return COLOR_SPEC.surfaceContainerHigh();
  }
  surfaceContainerHighest() {
    return COLOR_SPEC.surfaceContainerHighest();
  }
  onSurface() {
    return COLOR_SPEC.onSurface();
  }
  surfaceVariant() {
    return COLOR_SPEC.surfaceVariant();
  }
  onSurfaceVariant() {
    return COLOR_SPEC.onSurfaceVariant();
  }
  outline() {
    return COLOR_SPEC.outline();
  }
  outlineVariant() {
    return COLOR_SPEC.outlineVariant();
  }
  inverseSurface() {
    return COLOR_SPEC.inverseSurface();
  }
  inverseOnSurface() {
    return COLOR_SPEC.inverseOnSurface();
  }
  shadow() {
    return COLOR_SPEC.shadow();
  }
  scrim() {
    return COLOR_SPEC.scrim();
  }
  surfaceTint() {
    return COLOR_SPEC.surfaceTint();
  }
  primary() {
    return COLOR_SPEC.primary();
  }
  primaryDim() {
    return COLOR_SPEC.primaryDim();
  }
  onPrimary() {
    return COLOR_SPEC.onPrimary();
  }
  primaryContainer() {
    return COLOR_SPEC.primaryContainer();
  }
  onPrimaryContainer() {
    return COLOR_SPEC.onPrimaryContainer();
  }
  inversePrimary() {
    return COLOR_SPEC.inversePrimary();
  }
  primaryFixed() {
    return COLOR_SPEC.primaryFixed();
  }
  primaryFixedDim() {
    return COLOR_SPEC.primaryFixedDim();
  }
  onPrimaryFixed() {
    return COLOR_SPEC.onPrimaryFixed();
  }
  onPrimaryFixedVariant() {
    return COLOR_SPEC.onPrimaryFixedVariant();
  }
  secondary() {
    return COLOR_SPEC.secondary();
  }
  secondaryDim() {
    return COLOR_SPEC.secondaryDim();
  }
  onSecondary() {
    return COLOR_SPEC.onSecondary();
  }
  secondaryContainer() {
    return COLOR_SPEC.secondaryContainer();
  }
  onSecondaryContainer() {
    return COLOR_SPEC.onSecondaryContainer();
  }
  secondaryFixed() {
    return COLOR_SPEC.secondaryFixed();
  }
  secondaryFixedDim() {
    return COLOR_SPEC.secondaryFixedDim();
  }
  onSecondaryFixed() {
    return COLOR_SPEC.onSecondaryFixed();
  }
  onSecondaryFixedVariant() {
    return COLOR_SPEC.onSecondaryFixedVariant();
  }
  tertiary() {
    return COLOR_SPEC.tertiary();
  }
  tertiaryDim() {
    return COLOR_SPEC.tertiaryDim();
  }
  onTertiary() {
    return COLOR_SPEC.onTertiary();
  }
  tertiaryContainer() {
    return COLOR_SPEC.tertiaryContainer();
  }
  onTertiaryContainer() {
    return COLOR_SPEC.onTertiaryContainer();
  }
  tertiaryFixed() {
    return COLOR_SPEC.tertiaryFixed();
  }
  tertiaryFixedDim() {
    return COLOR_SPEC.tertiaryFixedDim();
  }
  onTertiaryFixed() {
    return COLOR_SPEC.onTertiaryFixed();
  }
  onTertiaryFixedVariant() {
    return COLOR_SPEC.onTertiaryFixedVariant();
  }
  error() {
    return COLOR_SPEC.error();
  }
  errorDim() {
    return COLOR_SPEC.errorDim();
  }
  onError() {
    return COLOR_SPEC.onError();
  }
  errorContainer() {
    return COLOR_SPEC.errorContainer();
  }
  onErrorContainer() {
    return COLOR_SPEC.onErrorContainer();
  }
}

/* ----------------------------------------------------------------------------
 * Scheme palettes (2021 base + 2025 overrides) + DynamicScheme.
 * -------------------------------------------------------------------------- */

class DynamicSchemePalettesDelegateImpl2021 {
  getPrimaryPalette(variant, sourceColorHct) {
    switch (variant) {
      case 6:
      case 5:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma);
      case 8:
        return TonalPalette.fromHueAndChroma(sanitizeDegrees(sourceColorHct.hue - 50.0), 48.0);
      case 0:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
      case 1:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 12.0);
      case 7:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 48.0);
      case 2:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 36.0);
      case 4:
        return TonalPalette.fromHueAndChroma(sanitizeDegrees(sourceColorHct.hue + 240), 40);
      case 3:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 200.0);
      default:
        throw new Error(`Unsupported variant: ${variant}`);
    }
  }
  getSecondaryPalette(variant, sourceColorHct) {
    switch (variant) {
      case 6:
      case 5:
        return TonalPalette.fromHueAndChroma(
          sourceColorHct.hue,
          Math.max(sourceColorHct.chroma - 32.0, sourceColorHct.chroma * 0.5),
        );
      case 8:
        return TonalPalette.fromHueAndChroma(sanitizeDegrees(sourceColorHct.hue - 50.0), 36.0);
      case 0:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
      case 1:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 8.0);
      case 7:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16.0);
      case 2:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16.0);
      case 4:
        return TonalPalette.fromHueAndChroma(
          DynamicScheme.getRotatedHue(sourceColorHct, [0, 21, 51, 121, 151, 191, 271, 321, 360], [45, 95, 45, 20, 45, 90, 45, 45, 45]),
          24.0,
        );
      case 3:
        return TonalPalette.fromHueAndChroma(
          DynamicScheme.getRotatedHue(sourceColorHct, [0, 41, 61, 101, 131, 181, 251, 301, 360], [18, 15, 10, 12, 15, 18, 15, 12, 12]),
          24.0,
        );
      default:
        throw new Error(`Unsupported variant: ${variant}`);
    }
  }
  getTertiaryPalette(variant, sourceColorHct) {
    switch (variant) {
      case 6:
        return TonalPalette.fromHct(
          DislikeAnalyzer.fixIfDisliked(new TemperatureCache(sourceColorHct).analogous(3, 6)[2]),
        );
      case 5:
        return TonalPalette.fromHct(
          DislikeAnalyzer.fixIfDisliked(new TemperatureCache(sourceColorHct).complement),
        );
      case 8:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 36.0);
      case 0:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
      case 1:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16.0);
      case 7:
      case 2:
        return TonalPalette.fromHueAndChroma(sanitizeDegrees(sourceColorHct.hue + 60.0), 24.0);
      case 4:
        return TonalPalette.fromHueAndChroma(
          DynamicScheme.getRotatedHue(sourceColorHct, [0, 21, 51, 121, 151, 191, 271, 321, 360], [120, 120, 20, 45, 20, 15, 20, 120, 120]),
          32.0,
        );
      case 3:
        return TonalPalette.fromHueAndChroma(
          DynamicScheme.getRotatedHue(sourceColorHct, [0, 41, 61, 101, 131, 181, 251, 301, 360], [35, 30, 20, 25, 30, 35, 30, 25, 25]),
          32.0,
        );
      default:
        throw new Error(`Unsupported variant: ${variant}`);
    }
  }
  getNeutralPalette(variant, sourceColorHct) {
    switch (variant) {
      case 6:
      case 5:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma / 8.0);
      case 8:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 10.0);
      case 0:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
      case 1:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 2.0);
      case 7:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
      case 2:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 6.0);
      case 4:
        return TonalPalette.fromHueAndChroma(sanitizeDegrees(sourceColorHct.hue + 15), 8);
      case 3:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 10);
      default:
        throw new Error(`Unsupported variant: ${variant}`);
    }
  }
  getNeutralVariantPalette(variant, sourceColorHct) {
    switch (variant) {
      case 6:
      case 5:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma / 8.0 + 4.0);
      case 8:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16.0);
      case 0:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
      case 1:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 2.0);
      case 7:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0.0);
      case 2:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 8.0);
      case 4:
        return TonalPalette.fromHueAndChroma(sanitizeDegrees(sourceColorHct.hue + 15), 12);
      case 3:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 12);
      default:
        throw new Error(`Unsupported variant: ${variant}`);
    }
  }
  getErrorPalette() {
    return undefined;
  }
}

class DynamicSchemePalettesDelegateImpl2025 extends DynamicSchemePalettesDelegateImpl2021 {
  getPrimaryPalette(variant, sourceColorHct, isDark, platform) {
    switch (variant) {
      case 1:
        return TonalPalette.fromHueAndChroma(
          sourceColorHct.hue,
          platform === 'phone'
            ? Hct.isBlue(sourceColorHct.hue)
              ? 12
              : 8
            : Hct.isBlue(sourceColorHct.hue)
              ? 16
              : 12,
        );
      case 2:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, platform === 'phone' && isDark ? 26 : 32);
      case 4:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, platform === 'phone' ? (isDark ? 36 : 48) : 40);
      case 3:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, platform === 'phone' ? 74 : 56);
      default:
        return super.getPrimaryPalette(variant, sourceColorHct, isDark, platform);
    }
  }
  getSecondaryPalette(variant, sourceColorHct, isDark, platform) {
    switch (variant) {
      case 1:
        return TonalPalette.fromHueAndChroma(
          sourceColorHct.hue,
          platform === 'phone'
            ? Hct.isBlue(sourceColorHct.hue)
              ? 6
              : 4
            : Hct.isBlue(sourceColorHct.hue)
              ? 10
              : 6,
        );
      case 2:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16);
      case 4:
        return TonalPalette.fromHueAndChroma(
          DynamicScheme.getRotatedHue(sourceColorHct, [0, 105, 140, 204, 253, 278, 300, 333, 360], [-160, 155, -100, 96, -96, -156, -165, -160]),
          platform === 'phone' ? (isDark ? 16 : 24) : 24,
        );
      case 3:
        return TonalPalette.fromHueAndChroma(
          DynamicScheme.getRotatedHue(sourceColorHct, [0, 38, 105, 140, 333, 360], [-14, 10, -14, 10, -14]),
          platform === 'phone' ? 56 : 36,
        );
      default:
        return super.getSecondaryPalette(variant, sourceColorHct, isDark, platform);
    }
  }
  getTertiaryPalette(variant, sourceColorHct, isDark, platform) {
    switch (variant) {
      case 1:
        return TonalPalette.fromHueAndChroma(
          DynamicScheme.getRotatedHue(sourceColorHct, [0, 38, 105, 161, 204, 278, 333, 360], [-32, 26, 10, -39, 24, -15, -32]),
          platform === 'phone' ? 20 : 36,
        );
      case 2:
        return TonalPalette.fromHueAndChroma(
          DynamicScheme.getRotatedHue(sourceColorHct, [0, 20, 71, 161, 333, 360], [-40, 48, -32, 40, -32]),
          platform === 'phone' ? 28 : 32,
        );
      case 4:
        return TonalPalette.fromHueAndChroma(
          DynamicScheme.getRotatedHue(sourceColorHct, [0, 105, 140, 204, 253, 278, 300, 333, 360], [-165, 160, -105, 101, -101, -160, -170, -165]),
          48,
        );
      case 3:
        return TonalPalette.fromHueAndChroma(
          DynamicScheme.getRotatedHue(sourceColorHct, [0, 38, 71, 105, 140, 161, 253, 333, 360], [-72, 35, 24, -24, 62, 50, 62, -72]),
          56,
        );
      default:
        return super.getTertiaryPalette(variant, sourceColorHct, isDark, platform);
    }
  }
  static getExpressiveNeutralHue(sourceColorHct) {
    return DynamicScheme.getRotatedHue(sourceColorHct, [0, 71, 124, 253, 278, 300, 360], [10, 0, 10, 0, 10, 0]);
  }
  static getExpressiveNeutralChroma(sourceColorHct, isDark, platform) {
    const neutralHue = DynamicSchemePalettesDelegateImpl2025.getExpressiveNeutralHue(sourceColorHct);
    return platform === 'phone' ? (isDark ? (Hct.isYellow(neutralHue) ? 6 : 14) : 18) : 12;
  }
  static getVibrantNeutralHue(sourceColorHct) {
    return DynamicScheme.getRotatedHue(sourceColorHct, [0, 38, 105, 140, 333, 360], [-14, 10, -14, 10, -14]);
  }
  static getVibrantNeutralChroma(sourceColorHct, platform) {
    const neutralHue = DynamicSchemePalettesDelegateImpl2025.getVibrantNeutralHue(sourceColorHct);
    return platform === 'phone' ? 28 : Hct.isBlue(neutralHue) ? 28 : 20;
  }
  getNeutralPalette(variant, sourceColorHct, isDark, platform) {
    switch (variant) {
      case 1:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, platform === 'phone' ? 1.4 : 6);
      case 2:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, platform === 'phone' ? 5 : 10);
      case 4:
        return TonalPalette.fromHueAndChroma(
          DynamicSchemePalettesDelegateImpl2025.getExpressiveNeutralHue(sourceColorHct),
          DynamicSchemePalettesDelegateImpl2025.getExpressiveNeutralChroma(sourceColorHct, isDark, platform),
        );
      case 3:
        return TonalPalette.fromHueAndChroma(
          DynamicSchemePalettesDelegateImpl2025.getVibrantNeutralHue(sourceColorHct),
          DynamicSchemePalettesDelegateImpl2025.getVibrantNeutralChroma(sourceColorHct, platform),
        );
      default:
        return super.getNeutralPalette(variant, sourceColorHct, isDark, platform);
    }
  }
  getNeutralVariantPalette(variant, sourceColorHct, isDark, platform) {
    switch (variant) {
      case 1:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, (platform === 'phone' ? 1.4 : 6) * 2.2);
      case 2:
        return TonalPalette.fromHueAndChroma(sourceColorHct.hue, (platform === 'phone' ? 5 : 10) * 1.7);
      case 4: {
        const hue = DynamicSchemePalettesDelegateImpl2025.getExpressiveNeutralHue(sourceColorHct);
        const chroma = DynamicSchemePalettesDelegateImpl2025.getExpressiveNeutralChroma(
          sourceColorHct,
          isDark,
          platform,
        );
        return TonalPalette.fromHueAndChroma(
          hue,
          chroma * (hue >= 105 && hue < 125 ? 1.6 : 2.3),
        );
      }
      case 3: {
        const hue = DynamicSchemePalettesDelegateImpl2025.getVibrantNeutralHue(sourceColorHct);
        const chroma = DynamicSchemePalettesDelegateImpl2025.getVibrantNeutralChroma(sourceColorHct, platform);
        return TonalPalette.fromHueAndChroma(hue, chroma * 1.29);
      }
      default:
        return super.getNeutralVariantPalette(variant, sourceColorHct, isDark, platform);
    }
  }
  getErrorPalette(variant, sourceColorHct) {
    const errorHue = DynamicScheme.getPiecewiseHue(
      sourceColorHct,
      [0, 3, 13, 23, 33, 43, 153, 273, 360],
      [12, 22, 32, 12, 22, 32, 22, 12],
    );
    switch (variant) {
      case 1:
        return TonalPalette.fromHueAndChroma(errorHue, 50);
      case 2:
        return TonalPalette.fromHueAndChroma(errorHue, 60);
      case 4:
        return TonalPalette.fromHueAndChroma(errorHue, 64);
      case 3:
        return TonalPalette.fromHueAndChroma(errorHue, 80);
      default:
        return super.getErrorPalette(variant, sourceColorHct);
    }
  }
}

const paletteSpec2021 = new DynamicSchemePalettesDelegateImpl2021();
const paletteSpec2025 = new DynamicSchemePalettesDelegateImpl2025();
function getPaletteSpec(specVersion) {
  return specVersion === '2025' ? paletteSpec2025 : paletteSpec2021;
}

class DynamicScheme {
  static maybeFallbackSpecVersion(specVersion, variant) {
    switch (variant) {
      case 4:
      case 3:
      case 2:
      case 1:
        return specVersion;
      default:
        return '2021';
    }
  }
  static getPiecewiseHue(sourceColorHct, hueBreakpoints, hues) {
    const size = Math.min(hueBreakpoints.length - 1, hues.length);
    const sourceHue = sourceColorHct.hue;
    for (let i = 0; i < size; i++) {
      if (sourceHue >= hueBreakpoints[i] && sourceHue < hueBreakpoints[i + 1]) {
        return sanitizeDegrees(hues[i]);
      }
    }
    return sourceHue;
  }
  static getRotatedHue(sourceColorHct, hueBreakpoints, rotations) {
    let rotation = DynamicScheme.getPiecewiseHue(sourceColorHct, hueBreakpoints, rotations);
    if (Math.min(hueBreakpoints.length - 1, rotations.length) <= 0) rotation = 0;
    return sanitizeDegrees(sourceColorHct.hue + rotation);
  }
  constructor(args) {
    this.sourceColorArgb = args.sourceColorHct.toInt();
    this.variant = args.variant;
    this.contrastLevel = args.contrastLevel;
    this.isDark = args.isDark;
    this.platform = args.platform ?? 'phone';
    this.specVersion = DynamicScheme.maybeFallbackSpecVersion(args.specVersion ?? '2021', this.variant);
    this.sourceColorHct = args.sourceColorHct;
    this.primaryPalette =
      args.primaryPalette ??
      getPaletteSpec(this.specVersion).getPrimaryPalette(
        this.variant,
        args.sourceColorHct,
        this.isDark,
        this.platform,
        this.contrastLevel,
      );
    this.secondaryPalette =
      args.secondaryPalette ??
      getPaletteSpec(this.specVersion).getSecondaryPalette(
        this.variant,
        args.sourceColorHct,
        this.isDark,
        this.platform,
        this.contrastLevel,
      );
    this.tertiaryPalette =
      args.tertiaryPalette ??
      getPaletteSpec(this.specVersion).getTertiaryPalette(
        this.variant,
        args.sourceColorHct,
        this.isDark,
        this.platform,
        this.contrastLevel,
      );
    this.neutralPalette =
      args.neutralPalette ??
      getPaletteSpec(this.specVersion).getNeutralPalette(
        this.variant,
        args.sourceColorHct,
        this.isDark,
        this.platform,
        this.contrastLevel,
      );
    this.neutralVariantPalette =
      args.neutralVariantPalette ??
      getPaletteSpec(this.specVersion).getNeutralVariantPalette(
        this.variant,
        args.sourceColorHct,
        this.isDark,
        this.platform,
        this.contrastLevel,
      );
    this.errorPalette =
      args.errorPalette ??
      getPaletteSpec(this.specVersion).getErrorPalette(
        this.variant,
        args.sourceColorHct,
        this.isDark,
        this.platform,
        this.contrastLevel,
      ) ??
      TonalPalette.fromHueAndChroma(25.0, 84.0);
    this.colors = new MaterialDynamicColors();
  }
  getArgb(dynamicColor) {
    return dynamicColor.getArgb(this);
  }
  getHct(dynamicColor) {
    return dynamicColor.getHct(this);
  }
}

/* ----------------------------------------------------------------------------
 * Public API.
 * -------------------------------------------------------------------------- */

const VARIANT_ENUM = {
  monochrome: 0,
  neutral: 1,
  tonalSpot: 2,
  vibrant: 3,
  expressive: 4,
  fidelity: 5,
  content: 6,
  rainbow: 7,
  fruitSalad: 8,
};

const VARIANT_LABELS = {
  tonalSpot: 'Tonal spot',
  expressive: 'Expressive',
  vibrant: 'Vibrant',
  neutral: 'Neutral',
  fidelity: 'Fidelity',
  rainbow: 'Rainbow',
  fruitSalad: 'Fruit salad',
};

const VARIANT_ORDER = ['tonalSpot', 'expressive', 'vibrant', 'neutral', 'fidelity', 'rainbow', 'fruitSalad'];

const snakeToCamel = (name) => name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/**
 * Build the full Material 3 role -> hex map for one mode.
 * `hue`/`chroma`/`tone` define the HCT source color. All 50+ roles are
 * resolved exactly like `@material/material-color-utilities` schemes.
 */
export function schemeColors({
  hue,
  chroma,
  tone = 40,
  variant = 'tonalSpot',
  isDark = false,
  contrastLevel = 0,
  platform = 'phone',
  specVersion = '2021',
} = {}) {
  const sourceColorHct = Hct.from(hue, chroma, tone);
  const scheme = new DynamicScheme({
    sourceColorHct,
    variant: VARIANT_ENUM[variant] ?? VARIANT_ENUM.tonalSpot,
    contrastLevel,
    isDark,
    platform,
    specVersion,
  });
  const out = {};
  for (const color of scheme.colors.allColors) {
    out[snakeToCamel(color.name)] = hexFromArgb(scheme.getArgb(color));
  }
  out.surfaceVariant = hexFromArgb(scheme.getArgb(scheme.colors.surfaceVariant()));
  out.surfaceTint = hexFromArgb(scheme.getArgb(scheme.colors.surfaceTint()));
  out.shadow = hexFromArgb(scheme.getArgb(scheme.colors.shadow()));
  out.scrim = hexFromArgb(scheme.getArgb(scheme.colors.scrim()));
  return out;
}

/** Human readable scheme name. */
export function variantLabel(variant) {
  return VARIANT_LABELS[variant] ?? variant;
}

export const variants = VARIANT_ORDER;
