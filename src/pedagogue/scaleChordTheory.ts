export interface ScaleFamilySpec {
  id: 'major' | 'harmonic' | 'melodic';
  label: string;
  modes: string[];
}

export const MODE_INTERVALS: Record<string, number[]> = {
  Ionian: [0, 2, 4, 5, 7, 9, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Aeolian: [0, 2, 3, 5, 7, 8, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
  'Harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  'Locrian ♮6': [0, 1, 3, 5, 6, 9, 10],
  'Ionian ♯5': [0, 2, 4, 5, 8, 9, 11],
  'Dorian ♯4': [0, 2, 3, 6, 7, 9, 10],
  'Phrygian dominant': [0, 1, 4, 5, 7, 8, 10],
  'Lydian ♯2': [0, 3, 4, 6, 7, 9, 11],
  'Super Locrian ♭♭7': [0, 1, 3, 4, 6, 8, 9],
  'Melodic minor': [0, 2, 3, 5, 7, 9, 11],
  'Dorian ♭2': [0, 1, 3, 5, 7, 9, 10],
  'Lydian augmented': [0, 2, 4, 6, 8, 9, 11],
  'Lydian dominant': [0, 2, 4, 6, 7, 9, 10],
  'Mixolydian ♭6': [0, 2, 4, 5, 7, 8, 10],
  'Locrian ♮2': [0, 2, 3, 5, 6, 8, 10],
  Altered: [0, 1, 3, 4, 6, 8, 10],
};

export const SCALE_FAMILIES: ScaleFamilySpec[] = [
  {
    id: 'major',
    label: 'Major (Church modes)',
    modes: [
      'Ionian',
      'Dorian',
      'Phrygian',
      'Lydian',
      'Mixolydian',
      'Aeolian',
      'Locrian',
    ],
  },
  {
    id: 'harmonic',
    label: 'Harmonic minor',
    modes: [
      'Harmonic minor',
      'Locrian ♮6',
      'Ionian ♯5',
      'Dorian ♯4',
      'Phrygian dominant',
      'Lydian ♯2',
      'Super Locrian ♭♭7',
    ],
  },
  {
    id: 'melodic',
    label: 'Melodic minor',
    modes: [
      'Melodic minor',
      'Dorian ♭2',
      'Lydian augmented',
      'Lydian dominant',
      'Mixolydian ♭6',
      'Locrian ♮2',
      'Altered',
    ],
  },
];

export const MODE_DISPLAY_NAMES: Record<string, string> = {
  Ionian: 'Ionian (Major)',
  Aeolian: 'Aeolian (Natural minor)',
};

export function getModeDisplayLabel(mode: string): string {
  return MODE_DISPLAY_NAMES[mode] || mode;
}

export function getScaleFamilyForMode(
  mode: string,
): 'major' | 'harmonic' | 'melodic' {
  for (const fam of SCALE_FAMILIES) {
    if (fam.modes.includes(mode)) return fam.id;
  }
  return 'major';
}

const SEV: Record<string, string> = {
  '3,7,11': 'mMaj7',
  '3,7,10': 'm7',
  '3,6,10': 'm7b5',
  '3,6,9': 'dim7',
  '3,6,11': 'dimMaj7',
  '4,7,11': 'maj7',
  '4,7,10': '7',
  '4,8,11': 'maj7#5',
  '4,8,10': '7#5',
  '4,6,10': '7b5',
  '4,6,11': 'maj7b5',
  '3,8,10': 'm7#5',
  '3,8,11': 'mMaj7#5',
  '4,7,9': '6',
  '3,7,9': 'm6',
};

const XT: Record<number, string>[] = [
  {1: 'b9', 2: '9', 3: '#9'},
  {4: 'b11', 5: '11', 6: '#11'},
  {8: 'b13', 9: '13', 10: '#13'},
];

export function chordSuffixFromIntervals(i: number[]): string {
  const t = i[1];
  const f = i[2];
  const n = i.length;
  let b: string;

  if (t == 2 || t == 5) {
    b =
      (n > 3 ? ({11: 'maj7', 10: '7', 9: '6'} as Record<number, string>)[i[3]] || '' : '') +
      (t == 2 ? 'sus2' : 'sus4') +
      (f == 6 ? 'b5' : f == 8 ? '#5' : '');
  } else if (n < 4) {
    b =
      (
        {
          '4,7': '',
          '3,7': 'm',
          '3,6': 'dim',
          '4,8': 'aug',
          '4,6': '(b5)',
          '3,8': 'm(#5)',
        } as Record<string, string>
      )[t + ',' + f] ?? '?';
  } else {
    b = SEV[t + ',' + f + ',' + i[3]] || '?';
  }

  const ex = i.slice(4).map((x, j) => XT[j]?.[x - 12] || '?');
  const nat = ex.every(e => /^\d+$/.test(e));

  if (
    ex.length &&
    nat &&
    (ex.length == 1 || t == 3 || i[3] == 10) &&
    /^(maj7|m7|7|mMaj7)$/.test(b)
  )
    return b.replace('7', ex.at(-1)!);

  return b + (ex.length ? '(' + ex.join(',') + ')' : '');
}

export function prettyChordSuffix(sf: string): string {
  return sf
    .replace(/b(?=\d)/g, '♭')
    .replace(/#/g, '♯');
}

const MAJOR_REF = [0, 2, 4, 5, 7, 9, 11];
const ROMAN_UPPER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export function accidentalForScaleDegree(
  scaleIntervals: number[],
  degreeIndex: number,
): string {
  const d = ((degreeIndex % 7) + 7) % 7;
  let diff = (scaleIntervals[d] ?? MAJOR_REF[d]) - MAJOR_REF[d];
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  if (diff === -2) return '♭♭';
  if (diff === -1) return '♭';
  if (diff === 1) return '♯';
  if (diff === 2) return '♯♯';
  return '';
}

export interface HarmonizedDegreeInfo {
  degree: number;
  accidental: string;
  ints: number[];
  suffix: string;
  prettySuffix: string;
  chordName: string;
  roman: string;
  nashville: string;
  pc: number;
  noteNames: string[];
  qualityLabel: string;
}

function qualityDescription(sf: string): string {
  const map: Record<string, string> = {
    '': 'Major triad',
    m: 'Minor triad',
    dim: 'Diminished triad',
    aug: 'Augmented triad',
    '(b5)': 'Major flat-5 triad',
    'm(#5)': 'Minor sharp-5 triad',
    maj7: 'Major 7th',
    m7: 'Minor 7th',
    '7': 'Dominant 7th',
    m7b5: 'Half-diminished 7th',
    dim7: 'Diminished 7th',
    mMaj7: 'Minor-major 7th',
    'maj7#5': 'Major 7th sharp-5',
    '7#5': 'Dominant 7th sharp-5',
    '7b5': 'Dominant 7th flat-5',
    maj7b5: 'Major 7th flat-5',
    'm7#5': 'Minor 7th sharp-5',
    'mMaj7#5': 'Minor-major 7th sharp-5',
    dimMaj7: 'Diminished major 7th',
    '6': 'Major 6th',
    m6: 'Minor 6th',
  };
  return map[sf] || prettyChordSuffix(sf) || 'Chord';
}

export function formatDegreeRoman(
  scaleIntervals: number[],
  degreeIndex: number,
  ints: number[],
): string {
  const d = ((degreeIndex % 7) + 7) % 7;
  const acc = accidentalForScaleDegree(scaleIntervals, d);
  const base = ROMAN_UPPER[d];
  const third = ints[1];
  const fifth = ints[2];
  const isMinor3 = third === 3;
  const isDim5 = fifth === 6;
  const isAug5 = fifth === 8;
  const letter = isMinor3 || isDim5 ? base.toLowerCase() : base;

  if (ints.length <= 3) {
    if (isDim5 && isMinor3) return acc + letter + '°';
    if (isAug5 && !isMinor3) return acc + letter + '+';
    if (isMinor3 && isAug5) return acc + letter + '(♯5)';
    if (!isMinor3 && isDim5) return acc + letter + '(♭5)';
    return acc + letter;
  }

  const seventh = ints[3];
  if (isMinor3 && isDim5 && seventh === 9) return acc + letter + '°7';
  if (isMinor3 && isDim5 && seventh === 10) return acc + letter + 'ø7';
  if (isMinor3 && isDim5 && seventh === 11) return acc + letter + '°maj7';
  if (isMinor3 && !isDim5 && !isAug5 && seventh === 10) return acc + letter + '7';
  if (isMinor3 && !isDim5 && !isAug5 && seventh === 11) return acc + letter + 'maj7';
  if (isMinor3 && isAug5 && seventh === 10) return acc + letter + '7♯5';
  if (isMinor3 && isAug5 && seventh === 11) return acc + letter + 'maj7♯5';
  if (!isMinor3 && isAug5 && seventh === 11) return acc + letter + '+maj7';
  if (!isMinor3 && isAug5 && seventh === 10) return acc + letter + '+7';
  if (!isMinor3 && isDim5 && seventh === 10) return acc + letter + '7♭5';
  if (!isMinor3 && isDim5 && seventh === 11) return acc + letter + 'maj7♭5';
  if (!isMinor3 && seventh === 11) return acc + letter + 'maj7';
  if (!isMinor3 && seventh === 10) return acc + letter + '7';
  if (seventh === 9) return acc + letter + '6';
  return acc + letter + prettyChordSuffix(chordSuffixFromIntervals(ints));
}

export function formatDegreeNashville(
  scaleIntervals: number[],
  degreeIndex: number,
  ints: number[],
): string {
  const d = ((degreeIndex % 7) + 7) % 7;
  const acc = accidentalForScaleDegree(scaleIntervals, d);
  const num = String(d + 1);
  const sf = chordSuffixFromIntervals(ints);
  const pretty = prettyChordSuffix(sf);
  if (sf === 'dim7') return acc + num + '°7';
  if (sf === 'dim') return acc + num + '°';
  if (sf === 'm7b5') return acc + num + 'ø7';
  if (sf === '7') return acc + num + '(7)';
  return acc + num + pretty;
}

export function computeScaleDegreeInfo(
  scaleIntervals: number[],
  degreeIndex: number,
  chordSize: 3 | 4,
  rootPc: number,
  scaleNames: string[],
): HarmonizedDegreeInfo {
  const len = scaleIntervals.length || 7;
  const d = ((degreeIndex % len) + len) % len;
  const stepAt = (idx: number) =>
    scaleIntervals[idx % len] + 12 * Math.floor(idx / len);
  const stackedSteps = chordSize === 4 ? [0, 2, 4, 6] : [0, 2, 4];
  const ints = stackedSteps.map(offset => stepAt(d + offset) - stepAt(d));
  const sf = chordSuffixFromIntervals(ints);
  const pretty = prettyChordSuffix(sf);
  const rootName = scaleNames[d] || '';
  const noteNames = stackedSteps.map(offset => scaleNames[(d + offset) % len] || '');

  return {
    degree: d,
    accidental: accidentalForScaleDegree(scaleIntervals, d),
    ints,
    suffix: sf,
    prettySuffix: pretty,
    chordName: rootName + pretty,
    roman: formatDegreeRoman(scaleIntervals, d, ints),
    nashville: formatDegreeNashville(scaleIntervals, d, ints),
    pc: (rootPc + scaleIntervals[d]) % 12,
    noteNames,
    qualityLabel: qualityDescription(sf),
  };
}

export function harmonizeScaleDegrees(
  scaleIntervals: number[],
  chordSize: 3 | 4,
  rootPc: number,
  scaleNames: string[],
): HarmonizedDegreeInfo[] {
  const len = scaleIntervals.length || 7;
  return Array.from({length: len}, (_, d) =>
    computeScaleDegreeInfo(scaleIntervals, d, chordSize, rootPc, scaleNames),
  );
}

/* =====================================================================
   FEATURE 2: CHORD -> SCALE MAPPING TABLE
   ===================================================================== */
export interface ChordToScaleSpec {
  id: string;
  suffix: string;
  ints: number[];
  contextLabel?: string;
  beginnerScales: string[];
  advancedScales: string[];
  difficulty: 'beginner' | 'advanced';
  explanation: string;
}

export const CHORD_TO_SCALE_SPECS: ChordToScaleSpec[] = [
  {
    id: 'maj7_tonic',
    suffix: 'maj7',
    ints: [0, 4, 7, 11],
    beginnerScales: ['Ionian'],
    advancedScales: ['Ionian', 'Lydian'],
    difficulty: 'beginner',
    explanation:
      'Ionian (major) is the standard home major-7th sound; Lydian raises the 4th to ♯4 (♯11) to avoid a half-step clash with the 3rd.',
  },
  {
    id: 'm7_dorian',
    suffix: 'm7',
    ints: [0, 3, 7, 10],
    beginnerScales: ['Dorian'],
    advancedScales: ['Dorian', 'Aeolian', 'Phrygian'],
    difficulty: 'beginner',
    explanation:
      'Dorian (minor with ♮6) fits almost any m7 chord cleanly; Aeolian (♭6, vi/i) and Phrygian (♭2, iii) fit depending on harmonic role.',
  },
  {
    id: 'dom7_mixo',
    suffix: '7',
    ints: [0, 4, 7, 10],
    beginnerScales: ['Mixolydian'],
    advancedScales: [
      'Mixolydian',
      'Lydian dominant',
      'Altered',
      'Phrygian dominant',
    ],
    difficulty: 'beginner',
    explanation:
      'Mixolydian is the primary diatonic dominant scale; Lydian dominant (♯11), Altered, and Phrygian dominant add jazz or minor-key colour.',
  },
  {
    id: 'm7b5_loc',
    suffix: 'm7♭5',
    ints: [0, 3, 6, 10],
    beginnerScales: ['Locrian'],
    advancedScales: ['Locrian', 'Locrian ♮2'],
    difficulty: 'beginner',
    explanation:
      'Locrian fits half-diminished iiø7 chords; Locrian ♮2 (from melodic minor) smooths out the clash between the root and ♭2.',
  },
  {
    id: 'maj7_lydian',
    suffix: 'maj7',
    ints: [0, 4, 7, 11],
    contextLabel: 'IVmaj7 chord (subdominant colour)',
    beginnerScales: ['Ionian'],
    advancedScales: ['Lydian', 'Ionian'],
    difficulty: 'advanced',
    explanation:
      'On IVmaj7 (or any bright modal maj7), Lydian gives the scale-native ♯4 without the avoid-note ♮4.',
  },
  {
    id: 'm7_minor_context',
    suffix: 'm7',
    ints: [0, 3, 7, 10],
    contextLabel: 'iii7 / dark minor context',
    beginnerScales: ['Dorian'],
    advancedScales: ['Phrygian', 'Aeolian', 'Dorian'],
    difficulty: 'advanced',
    explanation:
      'As iii7 in major, Phrygian (with ♭2) matches the key signature; Aeolian and Dorian are brighter alternatives.',
  },
  {
    id: 'dom7_minor_v',
    suffix: '7',
    ints: [0, 4, 7, 10],
    contextLabel: 'V7 resolving to a minor key',
    beginnerScales: ['Mixolydian'],
    advancedScales: ['Phrygian dominant', 'Altered', 'Mixolydian ♭6'],
    difficulty: 'advanced',
    explanation:
      'Over V7 in a minor key, the target key has ♭6 and ♭3 of the tonic — giving V7 Phrygian dominant (♭9, ♭13), Altered, or Mixolydian ♭6.',
  },
  {
    id: 'dom7s11_lyd',
    suffix: '7♯11',
    ints: [0, 4, 7, 10, 18],
    contextLabel: 'tritone sub / non-resolving dom7',
    beginnerScales: ['Lydian dominant'],
    advancedScales: ['Lydian dominant'],
    difficulty: 'advanced',
    explanation:
      'Lydian dominant (4th mode of melodic minor: 1 2 3 ♯4 5 6 ♭7) is built directly for 7♯11, backdoor ♭VII7, and tritone substitutes.',
  },
  {
    id: 'dom7alt_alt',
    suffix: '7♯5♯9',
    ints: [0, 4, 8, 10, 15],
    contextLabel: 'altered dominant (V7alt)',
    beginnerScales: ['Altered'],
    advancedScales: ['Altered', 'Phrygian dominant'],
    difficulty: 'advanced',
    explanation:
      'The Altered scale (7th mode of melodic minor) supplies ♭9, ♯9, ♭5 (♯11), and ♯5 (♭13) above the 3rd and ♭7.',
  },
  {
    id: 'mmaj7_mm',
    suffix: 'mMaj7',
    ints: [0, 3, 7, 11],
    beginnerScales: ['Melodic minor'],
    advancedScales: ['Melodic minor', 'Harmonic minor'],
    difficulty: 'advanced',
    explanation:
      'Both Melodic minor (♮6, ♮7) and Harmonic minor (♭6, ♮7) outline the minor triad with a major 7th tonic.',
  },
  {
    id: 'dim7_wh',
    suffix: 'dim7',
    ints: [0, 3, 6, 9],
    beginnerScales: ['Diminished (whole-half)'],
    advancedScales: ['Diminished (whole-half)', 'Super Locrian ♭♭7'],
    difficulty: 'advanced',
    explanation:
      'Whole-half diminished (8 notes) puts a whole step above each dim7 chord tone; Super Locrian ♭♭7 fits Harmonic minor vii°7 chords.',
  },
  {
    id: 'maj7s5_lydaug',
    suffix: 'maj7♯5',
    ints: [0, 4, 8, 11],
    beginnerScales: ['Lydian augmented'],
    advancedScales: ['Lydian augmented', 'Ionian ♯5'],
    difficulty: 'advanced',
    explanation:
      'Lydian augmented (3rd mode of melodic minor) and Ionian ♯5 (3rd mode of harmonic minor) both feature the major 3rd, ♯5, and major 7th.',
  },
];

/* =====================================================================
   FEATURE 3: MODE CHARACTER & CHARACTERISTIC CHORDS
   ===================================================================== */
export interface ModeCharacterSpec {
  mode: string;
  characteristicNote: string;
  characteristicDegreeIndices: number[]; // indices (0..6) in the mode
  primaryChordDegree: number; // most iconic chord degree (0..6)
  alternateChordDegrees?: number[]; // other acceptable character chords on keyboard
  chordSize: 3 | 4;
  summary: string;
  cadenceHint: string;
}

export const MODE_CHARACTER_SPECS: ModeCharacterSpec[] = [
  {
    mode: 'Dorian',
    characteristicNote: 'Natural 6th (♮6)',
    characteristicDegreeIndices: [5],
    primaryChordDegree: 3, // Major IV
    alternateChordDegrees: [1], // minor ii
    chordSize: 3,
    summary:
      'Dorian is a minor mode brightened by its raised natural 6th (♮6). That ♮6 turns the subdominant into a major IV triad (and ii into minor), giving Dorian its soulful lift.',
    cadenceHint: 'Classic vamp: i7 – IV (or i – IV)',
  },
  {
    mode: 'Phrygian',
    characteristicNote: 'Flat 2nd (♭2)',
    characteristicDegreeIndices: [1],
    primaryChordDegree: 1, // Major ♭II
    alternateChordDegrees: [6], // minor vii
    chordSize: 3,
    summary:
      'Phrygian stands out by its dark half-step flat 2nd (♭2) right above the tonic. The major chord built on ♭II pulls down by half step into tonic i.',
    cadenceHint: 'Classic cadence: ♭II – i (Spanish / flamenco colour)',
  },
  {
    mode: 'Lydian',
    characteristicNote: 'Sharp 4th (♯4)',
    characteristicDegreeIndices: [3],
    primaryChordDegree: 1, // Major II
    alternateChordDegrees: [6], // minor vii
    chordSize: 3,
    summary:
      'Lydian raises the 4th degree to ♯4, eliminating the avoid note of major and turning the supertonic chord into a bright major II triad.',
    cadenceHint: 'Classic shimmer: Imaj7 – II/I (or II – I)',
  },
  {
    mode: 'Mixolydian',
    characteristicNote: 'Flat 7th (♭7)',
    characteristicDegreeIndices: [6],
    primaryChordDegree: 6, // Major ♭VII
    alternateChordDegrees: [4], // minor v
    chordSize: 3,
    summary:
      'Mixolydian flattens the leading tone to ♭7. Instead of a V–I leading-tone pull, the major triad on ♭VII (and minor v) gives Mixolydian its rock and modal groove.',
    cadenceHint: 'Classic groove: I – ♭VII – IV – I',
  },
  {
    mode: 'Aeolian',
    characteristicNote: 'Flat 6th (♭6) with minor 3rd & ♭7',
    characteristicDegreeIndices: [5],
    primaryChordDegree: 5, // Major ♭VI
    alternateChordDegrees: [3, 6], // iv, ♭VII
    chordSize: 3,
    summary:
      'Aeolian (natural minor) pairs a minor iv with a major ♭VI and ♭VII. Unlike Dorian (♮6), the ♭6 produces the epic ♭VI – ♭VII – i minor sound.',
    cadenceHint: 'Classic progression: i – ♭VI – ♭VII – i',
  },
  {
    mode: 'Locrian',
    characteristicNote: 'Flat 5th (♭5) & Flat 2nd (♭2)',
    characteristicDegreeIndices: [4, 1],
    primaryChordDegree: 0, // diminished i° / iø7
    alternateChordDegrees: [1, 4], // ♭II or ♭V
    chordSize: 3,
    summary:
      'Locrian is the only church mode with a diminished tonic triad (containing ♭5) and a ♭II major triad a half step above tonic.',
    cadenceHint: 'Characteristic tonic: iø7 (half-diminished) moving with ♭II',
  },
  {
    mode: 'Harmonic minor',
    characteristicNote: 'Raised Leading Tone (♮7) + ♭6',
    characteristicDegreeIndices: [6],
    primaryChordDegree: 4, // Major V (V7)
    alternateChordDegrees: [6], // vii°
    chordSize: 3,
    summary:
      'Harmonic minor raises the 7th degree to ♮7 so minor keys gain a strong dominant major V (and V7 / vii°7) pulling directly back to tonic i.',
    cadenceHint: 'Classic resolution: V7 – i (or iv – V – i)',
  },
  {
    mode: 'Phrygian dominant',
    characteristicNote: 'Major 3rd (♮3) + Flat 2nd (♭2)',
    characteristicDegreeIndices: [2, 1],
    primaryChordDegree: 1, // Major ♭II
    alternateChordDegrees: [0], // Major I7
    chordSize: 3,
    summary:
      'Phrygian dominant (5th mode of harmonic minor) combines a major tonic chord with the tense ♭2 step, making the ♭II major chord clash dramatically against tonic I.',
    cadenceHint: 'Classic flamenco vamp: I – ♭II – I',
  },
  {
    mode: 'Melodic minor',
    characteristicNote: 'Raised 6th (♮6) & 7th (♮7) over minor 3rd',
    characteristicDegreeIndices: [5, 6],
    primaryChordDegree: 3, // IV7
    alternateChordDegrees: [0], // i(maj7)
    chordSize: 4,
    summary:
      'Melodic minor supports a mysterious i(maj7) tonic alongside a jazz-bright dominant IV7 chord built on its raised ♮6.',
    cadenceHint: 'Characteristic sound: im(maj7) moving to IV7',
  },
  {
    mode: 'Lydian dominant',
    characteristicNote: 'Sharp 4th (♯4) + Flat 7th (♭7)',
    characteristicDegreeIndices: [3, 6],
    primaryChordDegree: 1, // II7
    alternateChordDegrees: [0], // I7
    chordSize: 3,
    summary:
      'Lydian dominant fuses Lydian’s ♯4 with Mixolydian’s ♭7, creating a bright major triad on II (giving upper extensions 9, ♯11, 13) above the I7 tonic.',
    cadenceHint: 'Characteristic sound: I7 with major II upper-structure colour',
  },
];
