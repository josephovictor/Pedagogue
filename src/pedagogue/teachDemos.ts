import {audioEngine, type SoundPreset} from './audioEngine';
import type {CurriculumModule, DrillPreset} from './curriculumData';

export interface ClassDemo {
  id: string;
  label: string;
  spellings: string;
  takeaway: string;
  sound?: SoundPreset;
  /** Each inner array is one chord or melodic step sounded together */
  steps: number[][];
  stepMs: number;
  holdSec?: number;
}

export const MODULE_CLASS_DEMOS: Record<string, ClassDemo[]> = {
  'm1-1': [
    {
      id: 'd-m11-c5',
      label: 'C Five-Finger Position (RH 1–2–3–4–5)',
      spellings: 'C4 (1) · D4 (2) · E4 (3) · F4 (4) · G4 (5)',
      takeaway:
        'Keep the wrist level and let the curved fingertips rest right over C–D–E–F–G with relaxed thumb and pinky.',
      steps: [[60], [62], [64], [65], [67], [65], [64], [62], [60]],
      stepMs: 320,
      holdSec: 0.55,
    },
    {
      id: 'd-m11-grand',
      label: 'Middle C Anchor (LH Bass → RH Treble)',
      spellings: 'C3 (LH 5) · G3 (LH 1) · C4 (Middle C) · E4 · G4',
      takeaway:
        'Middle C bridges bass clef and treble clef: anchor the left hand a fifth below on C3–G3 while treble plays C4–E4–G4.',
      steps: [[48], [55], [60], [64], [67], [48, 55, 60, 64, 67]],
      stepMs: 380,
      holdSec: 1.2,
    },
  ],
  'm1-2': [
    {
      id: 'd-m12-24',
      label: 'Backbeat Chords (Accents on 2 & 4)',
      spellings: 'Beat 1 (bass C3) · Beat 2 (C chord!) · Beat 3 (bass G2) · Beat 4 (C chord!)',
      takeaway:
        'A light bass root on beats 1 and 3 with crisp chord chops on beats 2 and 4 creates the contemporary pocket.',
      steps: [
        [48],
        [60, 64, 67],
        [43],
        [60, 64, 67],
        [48],
        [60, 64, 67],
      ],
      stepMs: 420,
      holdSec: 0.48,
    },
    {
      id: 'd-m12-swing',
      label: 'Straight vs. Swung Eighths',
      spellings: 'Straight: C–D–E–G (even) · Swing: long–short triplet lilt',
      takeaway:
        'Hear how the swung feel delays the off-beat eighth into the third triplet subdivision.',
      steps: [[60], [62], [64], [67], [60], [62], [64], [67]],
      stepMs: 340,
      holdSec: 0.4,
    },
  ],
  'm1-3': [
    {
      id: 'd-m13-inv',
      label: 'C Major Triad Across All 3 Inversions',
      spellings: 'Root (C–E–G, 1-3-5) · 1st Inv (E–G–C, 1-2-5) · 2nd Inv (G–C–E, 1-3-5)',
      takeaway:
        'Notice the 1–2–5 fingering on 1st inversion where the fourth between G and C sits comfortably under fingers 2 and 5.',
      steps: [
        [60, 64, 67],
        [64, 67, 72],
        [67, 72, 76],
      ],
      stepMs: 780,
      holdSec: 1.0,
    },
    {
      id: 'd-m13-majmin',
      label: 'Major → Minor → Diminished → Augmented',
      spellings: 'C (C–E–G) · Cm (C–E♭–G) · Cdim (C–E♭–G♭) · Caug (C–E–G♯)',
      takeaway:
        'Lowering the 3rd makes the chord minor; lowering both 3rd and 5th creates diminished tension; raising the 5th brightens into augmented.',
      steps: [
        [60, 64, 67],
        [60, 63, 67],
        [60, 63, 66],
        [60, 64, 68],
      ],
      stepMs: 850,
      holdSec: 1.1,
    },
  ],
  'm1-4': [
    {
      id: 'd-m14-diatonic',
      label: 'Diatonic Triads in C Major (I – ii – iii – IV – V – vi – vii° – I)',
      spellings: 'C · Dm · Em · F · G · Am · Bdim · C',
      takeaway:
        'Every major key produces the exact same Roman numeral qualities: I, IV, V major; ii, iii, vi minor; vii° diminished.',
      steps: [
        [60, 64, 67],
        [62, 65, 69],
        [64, 67, 71],
        [65, 69, 72],
        [67, 71, 74],
        [69, 72, 76],
        [71, 74, 77],
        [72, 76, 79],
      ],
      stepMs: 520,
      holdSec: 0.7,
    },
    {
      id: 'd-m14-1564',
      label: 'Nashville 1 – 5 – 6m – 4 Voice-Led',
      spellings: 'C (E–G–C) → G (D–G–B) → Am (E–A–C) → F (F–A–C)',
      takeaway:
        'Moving each upper voice to its nearest chord tone keeps the hand centered around middle C without leaping.',
      steps: [
        [48, 64, 67, 72],
        [43, 62, 67, 71],
        [45, 64, 69, 72],
        [41, 65, 69, 72],
      ],
      stepMs: 820,
      holdSec: 1.0,
    },
  ],
  'm1-5': [
    {
      id: 'd-m15-blues',
      label: '12-Bar Blues Turnaround Snippet (I7 – IV7 – V7 – I7)',
      spellings: 'C7 (E–G–B♭–C) → F7 (E♭–F–A–C) → G7 (F–G–B–D) → C7',
      takeaway:
        'Notice how the 7th of C7 (B♭) moves just a half step down to A (the 3rd of F7).',
      steps: [
        [48, 64, 67, 70],
        [41, 63, 65, 69],
        [43, 62, 65, 71],
        [48, 64, 67, 70],
      ],
      stepMs: 820,
      holdSec: 1.1,
    },
  ],
  'm2-1': [
    {
      id: 'd-m21-qualities',
      label: 'Five Essential 7th Qualities on C',
      spellings: 'Cmaj7 (B) → C7 (B♭) → Cm7 (E♭, B♭) → Cm7♭5 (G♭) → Cdim7 (B♭♭)',
      takeaway:
        'Walk down one half step at a time from major 7th to diminished 7th to hear each chord’s distinct tension.',
      sound: 'rhodes',
      steps: [
        [60, 64, 67, 71],
        [60, 64, 67, 70],
        [60, 63, 67, 70],
        [60, 63, 66, 70],
        [60, 63, 66, 69],
      ],
      stepMs: 880,
      holdSec: 1.15,
    },
  ],
  'm2-2': [
    {
      id: 'd-m22-ext',
      label: 'Cadd9 vs. Cmaj9 vs. C13 Color Comparison',
      spellings: 'Cadd9 (no 7th) → Cmaj9 (adds B) → C9sus4 → C13 (A on top)',
      takeaway:
        'Adding the 7th gives warmth and harmonic pull; omitting the 5th lets the 9th and 13th ring clearly without mud.',
      sound: 'rhodes',
      steps: [
        [48, 60, 62, 64, 67],
        [48, 64, 67, 71, 74],
        [48, 65, 67, 70, 74],
        [48, 64, 70, 74, 77, 81].slice(0, 5),
      ],
      stepMs: 920,
      holdSec: 1.25,
    },
  ],
  'm2-3': [
    {
      id: 'd-m23-rootless',
      label: 'Rootless Type A ii–V–I in C (LH Bass + RH 3-5-7-9)',
      spellings: 'Dm9 (F–A–C–E) → G13 (F–A–B–E) → Cmaj9 (E–G–B–D)',
      takeaway:
        'Between Dm9 and G13 only one note moves by step (C → B); between G13 and Cmaj9 F→E and A→G resolve downward.',
      sound: 'rhodes',
      steps: [
        [50, 65, 69, 72, 76],
        [43, 65, 69, 71, 76],
        [48, 64, 67, 71, 74],
      ],
      stepMs: 1050,
      holdSec: 1.4,
    },
  ],
  'm2-4': [
    {
      id: 'd-m24-lh',
      label: 'LH Root–5th Alternating Bass Under RH Block Chords',
      spellings: 'C2 → G2 (LH) with C–E–G (RH) · F2 → C3 with F–A–C',
      takeaway:
        'Anchor the bass on beats 1 & 3 while the right hand provides light harmonic punctuation.',
      steps: [
        [36],
        [60, 64, 67],
        [43],
        [60, 64, 67],
        [41],
        [65, 69, 72],
        [48],
        [65, 69, 72],
      ],
      stepMs: 380,
      holdSec: 0.45,
    },
  ],
  'm2-5': [
    {
      id: 'd-m25-slash',
      label: 'Diatonic Slash-Bass Walkdown (C – G/B – Am7 – F/G)',
      spellings: 'Bass: C → B → A → G under steady upper triad shapes',
      takeaway:
        'Slash chords separate the bass motion from the upper chord shape, producing smooth hymn- and ballad-style bass lines.',
      steps: [
        [48, 64, 67, 72],
        [47, 62, 67, 71],
        [45, 64, 67, 72],
        [43, 65, 69, 72],
      ],
      stepMs: 900,
      holdSec: 1.15,
    },
  ],
  'm3-1': [
    {
      id: 'd-m31-borrowed',
      label: 'Pop Borrowed Color (I – ♭VII – IV – I in C)',
      spellings: 'C → B♭/C → F/C → C (anthemic modal mixture)',
      takeaway:
        'Borrowing ♭VII (B♭ major) from Mixolydian lifts a straight pop chorus without leaving the tonal center.',
      steps: [
        [48, 64, 67, 72],
        [46, 62, 65, 70],
        [41, 65, 69, 72],
        [48, 64, 67, 72],
      ],
      stepMs: 850,
      holdSec: 1.15,
    },
  ],
  'm3-2': [
    {
      id: 'd-m32-ballad',
      label: 'Piano Ballad Arpeggio (Cadd9 – G/B – Am7 – Fmaj7)',
      spellings: 'LH 1–5–9 sweep under clean sustain pedal changes on every bar',
      takeaway:
        'Roll the left hand root–5th–9th softly and lift the damper pedal cleanly right as each new bass note lands.',
      steps: [
        [48, 55, 62, 64, 67],
        [47, 55, 62, 67, 71],
        [45, 52, 60, 64, 67],
        [41, 48, 57, 64, 69],
      ],
      stepMs: 1000,
      holdSec: 1.35,
    },
  ],
  'm4-1': [
    {
      id: 'd-m41-country',
      label: 'Country Major 3rd Slide & Pedal-Steel 6th (in C)',
      spellings: 'E♭→E + G · A→C + E6 resolution on C',
      takeaway:
        'Slipping quickly off the minor 3rd (E♭) onto the major 3rd (E) with your 2nd/3rd finger creates the classic country piano inflection.',
      sound: 'wurlitzer',
      steps: [[63, 67], [64, 67], [69, 76], [67, 72], [60, 64, 67]],
      stepMs: 360,
      holdSec: 0.75,
    },
  ],
  'm4-2': [
    {
      id: 'd-m42-motown',
      label: 'Motown Backbeat Piano Chops & Chromatic Bass Walk',
      spellings: 'C – F/C – C bass walk C → D → E → F',
      takeaway:
        'Crisp right-hand chord stabs on 2 & 4 leave pocket space for a melodic, stepwise left-hand bass walk-up.',
      sound: 'wurlitzer',
      steps: [
        [36, 60, 64, 67],
        [38],
        [40, 60, 64, 67],
        [41, 60, 65, 69],
      ],
      stepMs: 420,
      holdSec: 0.65,
    },
  ],
  'm5-1': [
    {
      id: 'd-m51-gospel',
      label: 'Gospel Plagal Amen + Passing Diminished (C – C♯dim7 – Dm7 – F/G – C)',
      spellings: 'C → C♯dim7 (C♯–E–G–B♭) → Dm9 → F/G → Csus4 → C',
      takeaway:
        'The chromatic passing diminished chord pushes the bass smoothly up by half steps into ii7, then resolves via IV/V (F/G).',
      steps: [
        [48, 64, 67, 72],
        [49, 64, 67, 70],
        [50, 65, 69, 72, 76],
        [43, 65, 69, 72],
        [48, 65, 67, 72],
        [48, 64, 67, 72],
      ],
      stepMs: 780,
      holdSec: 1.05,
    },
  ],
  'm5-2': [
    {
      id: 'd-m52-backdoor',
      label: 'R&B Backdoor Cadence (Fm9 → B♭13 → Cmaj9)',
      spellings: 'iv9 (F–A♭–C–E♭–G) → ♭VII13 (B♭–A♭–C–D–G) → Imaj9 (C–E–G–B–D)',
      takeaway:
        'Moving from iv minor to ♭VII13 resolves smoothly up a whole step to Imaj9 with signature modern R&B warmth.',
      sound: 'rhodes',
      steps: [
        [41, 63, 67, 68, 72],
        [46, 62, 67, 68, 72],
        [48, 64, 67, 71, 74],
      ],
      stepMs: 1050,
      holdSec: 1.45,
    },
  ],
  'm5-3': [
    {
      id: 'd-m53-neosoul',
      label: 'Neo Soul Quartal & Upper-Structure Rhodes Progression',
      spellings: 'Am11 (G–C–D–F♯–B) → D7♯9♭13 → Gmaj9 (F♯–A–B–D)',
      takeaway:
        'Stacking fourths (quartal voicings) removes the sharp edge of major triads and creates that floating Rhodes shimmer.',
      sound: 'rhodes',
      steps: [
        [45, 59, 64, 67, 72],
        [50, 60, 66, 70, 77],
        [43, 59, 62, 66, 69],
      ],
      stepMs: 1100,
      holdSec: 1.5,
    },
  ],
  'm5-4': [
    {
      id: 'd-m54-guidetones',
      label: 'Guide-Tone Lines (3rds & 7ths Through ii–V–I in C)',
      spellings: 'Dm7 (F + C) → G7 (F + B) → Cmaj7 (E + B)',
      takeaway:
        'Listen to just the two inner notes: the 7th of Dm7 (C) steps down a half step to B (3rd of G7), then the 7th of G7 (F) steps down to E.',
      sound: 'rhodes',
      steps: [
        [50, 65, 72],
        [43, 65, 71],
        [48, 64, 71],
      ],
      stepMs: 950,
      holdSec: 1.35,
    },
  ],
  'm6-1': [
    {
      id: 'd-m61-ear',
      label: 'Hearing Bass Roots vs. Upper Chord Color',
      spellings: 'Bass F → G → A while RH holds C–E–G (Fmaj9 → C/G → Am7)',
      takeaway:
        'One simple upper triad transforms completely depending on the bass note underneath — listen for the lowest note first.',
      sound: 'rhodes',
      steps: [
        [41, 60, 64, 67],
        [43, 60, 64, 67],
        [45, 60, 64, 67],
      ],
      stepMs: 950,
      holdSec: 1.3,
    },
  ],
  'm6-2': [
    {
      id: 'd-m62-dorian',
      label: 'D Dorian Scale & Pentatonic Fill Over Dm9',
      spellings: 'Dm9 shell (D–F–C–E) + D–F–G–A–C–D–E fill',
      takeaway:
        'Anchor the left hand on a light D–F–C shell while the right hand phrases pentatonic licks ending on chord tones (F, A, or E).',
      sound: 'rhodes',
      steps: [
        [50, 53, 60],
        [69],
        [72],
        [74],
        [76],
        [74],
        [72],
        [69],
      ],
      stepMs: 280,
      holdSec: 0.5,
    },
  ],
};

export const CHECK_ANSWERS: Record<string, string> = {
  'What notes are in a D major scale? Which key signature does it have?':
    'D – E – F♯ – G – A – B – C♯ – D. Its key signature has two sharps (F♯ and C♯).',
  'What is the difference between 4/4 and 12/8 feel?':
    '4/4 divides each of the 4 beats into 2 straight eighths (or swung pairs); 12/8 subdivides each of the 4 main beats into 3 steady triplet pulses (1-la-li 2-la-li 3-la-li 4-la-li), common in slow gospel and R&B ballads.',
  'Where does the backbeat fall in 4/4?':
    'On beats 2 and 4 — snapping or emphasizing chords on 2 & 4 locks the piano in with the snare drum.',
  'Which styles in this plan usually use 12/8 feel?':
    'Slow gospel hymns/ballads, classic soul slow jams, and dramatic piano ballads.',
  'What notes are in an A♭ minor triad?':
    'A♭ – C♭ (enharmonically B) – E♭.',
  'What is the relative minor of E♭ major?':
    'C minor (three flats: B♭, E♭, A♭), built on the 6th degree of E♭ major.',
  'Write the chords of a G major progression I–vi–IV–V.':
    'G – Em – C – D.',
  'How would you call out a "one, four, five" progression in A?':
    'A – D – E (in Nashville notation: 1 – 4 – 5 in A).',
  'What notes are in Dm7? Fmaj7? G7? Bm7♭5?':
    'Dm7: D–F–A–C · Fmaj7: F–A–C–E · G7: G–B–D–F · Bm7♭5: B–D–F–A.',
  'Which diatonic chord is the dominant 7th?':
    'The V chord (5th degree) — e.g. G7 in the key of C major.',
  'What is the difference between Cadd9 and Cmaj9?':
    'Cadd9 is a triad plus the 9th (C–E–G–D, no 7th). Cmaj9 includes the major 7th B as well (C–E–G–B–D).',
  'Why is the 5th often dropped in rootless or extended voicings?':
    'The 5th adds weight without defining chord quality or color; dropping it keeps space clear for the 3rd, 7th, 9th, and 13th.',
  'Which two notes define the quality of a dominant 7th chord?':
    'The major 3rd and minor (flat) 7th — they form a tritone that pulls strongly toward the tonic.',
  'Why do rootless voicings work with a bassist?':
    'Because the bassist already plays the root in the low register, letting the pianist place guide tones and color extensions (3–5–7–9) right in the sweet spot around middle C.',
  'How do you make the second chorus bigger than the first without changing chords?':
    'Shift voicings up an octave, add LH octave roots or active eighth-note pulse, expand dynamics, and double melody notes in octaves.',
  'How do you play "1–4–5–1 in the key of D" from numbers only?':
    'Translate 1 = D, 4 = G, 5 = A: play D → G → A → D.',
  'What makes a lick sound "country" instead of "bluesy"?':
    'Major pentatonic (1–2–3–5–6) with quick half-step slides from the minor 3rd up into the major 3rd and shimmering pedal-steel 6th double-stops, rather than lingering on the ♭7 or ♯4 blue note.',
  'What is different about the piano’s role in Motown vs a pop ballad?':
    'In Motown, the piano acts like a tight percussion section (crisp backbeat chops and driving eighth chords, light pedal), whereas in a ballad it weaves flowing arpeggios and sustains harmonic pads.',
  'What makes a chord sound "neo soul" instead of "pop"?':
    'Extended 9th/11th/13th colors, quartal fourth-stacks, minor-9th vamps, and laid-back behind-the-beat Rhodes articulation rather than plain root-position triads.',
  'How do you play "behind the beat" without dragging the tempo?':
    'Keep your internal pulse (or beat 2 & 4 foot tap) rock-solid with the click, and place only the chord attack a hair late while releasing on time.',
};

const KEY_BASE_MIDI: Record<string, number> = {
  C: 60,
  'C♯': 61,
  'D♭': 61,
  D: 62,
  'E♭': 63,
  E: 64,
  F: 65,
  'F♯': 66,
  'G♭': 66,
  G: 67,
  'A♭': 68,
  A: 69,
  'B♭': 70,
  B: 71,
};

export function buildKeyMasteryDemo(
  keyName: string,
  col: 'scale' | 'd7' | 'iivi' | 'gospel' | 'neo',
): ClassDemo {
  const root = KEY_BASE_MIDI[keyName] ?? 60;
  const bass = root - 12;

  if (col === 'scale') {
    const ints = [0, 2, 4, 5, 7, 9, 11, 12];
    return {
      id: `k-${keyName}-scale`,
      label: `${keyName} Major Scale`,
      spellings: `${keyName} Ionian (1 octave)`,
      takeaway: 'Listen for the whole-whole-half-whole-whole-whole-half spacing.',
      sound: 'grand',
      steps: ints.map(i => [root + i]),
      stepMs: 260,
      holdSec: 0.45,
    };
  }
  if (col === 'd7') {
    const ints = [0, 2, 4, 5, 7, 9, 11, 12];
    const chords = [0, 1, 2, 3, 4, 5, 6].map(deg => [
      root + ints[deg],
      root + ints[(deg + 2) % 7] + (deg + 2 >= 7 ? 12 : 0),
      root + ints[(deg + 4) % 7] + (deg + 4 >= 7 ? 12 : 0),
      root + ints[(deg + 6) % 7] + (deg + 6 >= 7 ? 12 : 0),
    ]);
    return {
      id: `k-${keyName}-d7`,
      label: `${keyName} Diatonic 7ths`,
      spellings: `Imaj7 → ii7 → iii7 → IVmaj7 → V7 → vi7 → viiø7`,
      takeaway: 'Hear each diatonic chord’s color ascending step-by-step through the key.',
      sound: 'rhodes',
      steps: chords,
      stepMs: 620,
      holdSec: 0.85,
    };
  }
  if (col === 'iivi') {
    const ii = [bass + 2, root + 5, root + 9, root + 12, root + 16];
    const V = [bass - 5, root + 5, root + 9, root + 11, root + 16];
    const I = [bass, root + 4, root + 7, root + 11, root + 14];
    return {
      id: `k-${keyName}-iivi`,
      label: `${keyName} Voice-Led ii–V–I`,
      spellings: `ii9 → V13 → Imaj9 in ${keyName}`,
      takeaway: 'Upper voices step smoothly down by half/whole step while bass outlines ii–V–I.',
      sound: 'rhodes',
      steps: [ii, V, I],
      stepMs: 900,
      holdSec: 1.25,
    };
  }
  if (col === 'gospel') {
    const I = [bass, root + 4, root + 7, root + 12];
    const IVoverI = [bass, root + 5, root + 9, root + 12];
    return {
      id: `k-${keyName}-gospel`,
      label: `${keyName} Gospel I – IV/I – I`,
      spellings: `${keyName} pedal bass under IV → I plagal resolution`,
      takeaway: 'Holding the tonic in the bass lets the upper voices breathe cleanly like a choir cadence.',
      sound: 'grand',
      steps: [I, IVoverI, I],
      stepMs: 850,
      holdSec: 1.2,
    };
  }
  // neo soul
  const ii9 = [bass + 2, root + 5, root + 9, root + 12, root + 16];
  const V13 = [bass - 5, root + 5, root + 9, root + 11, root + 16];
  const Imaj9 = [bass, root + 4, root + 7, root + 11, root + 14];
  return {
    id: `k-${keyName}-neo`,
    label: `${keyName} Neo Soul ii9 – V13 – Imaj9`,
    spellings: `Rootless Rhodes voicings in ${keyName}`,
    takeaway: 'Warm 9ths and 13ths on Rhodes give signature Neo Soul richness.',
    sound: 'rhodes',
    steps: [ii9, V13, Imaj9],
    stepMs: 980,
    holdSec: 1.35,
  };
}

export function getPrimaryDrillForModule(
  mod: CurriculumModule,
): DrillPreset {
  const fromDo = mod.doItems.find(d => d.drill)?.drill;
  if (fromDo) return fromDo;
  const fromRep = mod.repertoire?.find(r => r.drill)?.drill;
  if (fromRep) return fromRep;
  if (mod.drills && mod.drills.length > 0) return mod.drills[0];

  // Fallback sensible drill presets for modules without explicit per-task drills
  if (mod.id.startsWith('m1-')) {
    return {
      label: 'Triads & Major Scale Practice',
      ug: 'chord',
      focus: 't3',
      inmode: true,
      key: 'C',
      mode: 'Ionian',
      order: 'ord',
    };
  }
  if (mod.id.startsWith('m2-')) {
    return {
      label: '7th Chords & Voice Leading',
      ug: 'prog',
      focus: 'adv',
      key: 'rnd',
      vlead: true,
      sound: 'rhodes',
    };
  }
  if (mod.id.startsWith('m3-')) {
    return {
      label: 'Pop & Ballad Progressions',
      ug: 'prog',
      focus: 'basic',
      key: 'rnd',
      vlead: true,
      sound: 'grand',
    };
  }
  if (mod.id.startsWith('m4-')) {
    return {
      label: 'Nashville Charts & Groove Patterns',
      ug: 'prog',
      focus: 'basic',
      key: 'rnd',
      pfmt: 'nns',
      vlead: true,
    };
  }
  if (mod.id.startsWith('m5-')) {
    return {
      label: 'Extended & Rootless Voicings',
      ug: 'chord',
      focus: 'v_rootless',
      inmode: true,
      key: 'rnd',
      sound: 'rhodes',
    };
  }
  return {
    label: 'Ear & Improvisation Studio',
    ug: 'ear',
    focus: 'emel',
    sound: 'rhodes',
  };
}

export function playClassDemo(
  demo: ClassDemo,
  onStep?: (notes: number[]) => void,
  onDone?: () => void,
): () => void {
  audioEngine.resume();
  const timers: number[] = [];
  const snd: SoundPreset = demo.sound || 'grand';
  const dur = demo.holdSec ?? Math.max(0.45, (demo.stepMs / 1000) * 1.15);

  demo.steps.forEach((notes, idx) => {
    const id = window.setTimeout(() => {
      onStep?.(notes);
      notes.forEach((midi, nIdx) => {
        const vel = nIdx === 0 && notes.length >= 3 ? 0.68 : 0.78;
        audioEngine.playNote(midi, 0, dur, snd, vel);
      });
    }, idx * demo.stepMs);
    timers.push(id);
  });

  const endId = window.setTimeout(
    () => {
      onStep?.([]);
      onDone?.();
    },
    demo.steps.length * demo.stepMs + 250,
  );
  timers.push(endId);

  return () => {
    timers.forEach(t => window.clearTimeout(t));
    onStep?.([]);
  };
}
