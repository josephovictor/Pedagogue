/* eslint-disable @typescript-eslint/no-explicit-any */
import {audioEngine, type MetronomeFeel, type SoundPreset} from './audioEngine';
import type {DrillPreset} from './curriculumData';
import {
  DEFAULT_FINGERING_RULES,
  DEFAULT_VL_RANGE,
  assignWindowFingers,
  buildScaleDegreeLookup,
  computeNextVoiceLedChord,
  computeVoicingFingering,
  describeVoiceMovement,
  formatFingeringText,
  generateShapesNearChord,
  nextVoicing,
  pickStartVoicing,
  resolveOctaveVoiceLeadingSettings,
  resolveWindowFingersStrict,
  rotateInversionVoicing,
  windowForAnchor,
  type FingeringResult,
  type VLDirection,
  type VLDirectionSetting,
  type VLInversionKey,
  type VLSeventhMode,
  type VLStepOutput,
} from './voiceLeadingEngine';
import {
  CHORD_TO_SCALE_SPECS,
  MODE_CHARACTER_SPECS,
  MODE_INTERVALS,
  SCALE_FAMILIES,
  chordSuffixFromIntervals,
  getModeDisplayLabel,
  getScaleFamilyForMode,
  harmonizeScaleDegrees,
  prettyChordSuffix,
  type HarmonizedDegreeInfo,
} from './scaleChordTheory';
import {
  buildScaleHandSequences,
  computeScaleOctaveCapacity,
  type ContraryStartMode,
  type MultiOctaveChoice,
  type ScaleHandsMode,
  type ScaleRangeMode,
} from './scaleRange';
import {computeScaleOrMelFingering} from './scaleFingering';

export interface PracticeScoreSnapshot {
  ok: number;
  tot: number;
  str: number;
  best: number;
  gameLabel: string;
}

export interface PedagogueOptions {
  onRequestResetScore?: (snapshot: PracticeScoreSnapshot) => void;
  onScoreChange?: (snapshot: PracticeScoreSnapshot) => void;
  onMoveToPractice?: () => void;
}

export interface PedagogueController {
  destroy: () => void;
  applyDrill: (preset: DrillPreset) => void;
  setStudyMode: (mode: 'practice' | 'teach', preset?: DrillPreset) => void;
  resetScore: () => void;
  refreshLayout: () => void;
}

export function initPedagogue(opts?: PedagogueOptions): PedagogueController {
  const $ = (id: string) => document.getElementById(id) as any;
  const rand = (n: number) => (Math.random() * n) | 0;
  const R = (a: number, b: number) =>
    Array.from({length: b - a + 1}, (_, i) => a + i);

  const ac = new AbortController();
  const {signal} = ac;

  /* =====================================================================
     1. MUSIC DATA: notes, keys, modes, intervals, labels
     ===================================================================== */
  const LN = 'CDEFGAB';
  const LET = [0, 2, 4, 5, 7, 9, 11];
  const ACC: Record<string, string> = {
    '-2': '♭♭',
    '-1': '♭',
    '0': '',
    '1': '♯',
    '2': '♯♯',
  };

  const SH = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FL = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const KEYS = [
    'C',
    'G',
    'D',
    'A',
    'E',
    'B',
    'F♯',
    'C♯',
    'F',
    'B♭',
    'E♭',
    'A♭',
    'D♭',
    'G♭',
  ];

  const MODES: Record<string, number[]> = MODE_INTERVALS;

  const INT: [string, number][] = [
    ['minor 2nd', 1],
    ['major 2nd', 2],
    ['minor 3rd', 3],
    ['major 3rd', 4],
    ['perfect 4th', 5],
    ['tritone', 6],
    ['perfect 5th', 7],
    ['minor 6th', 8],
    ['major 6th', 9],
    ['minor 7th', 10],
    ['major 7th', 11],
    ['octave', 12],
  ];

  const INV = [
    'root position',
    '1st inversion',
    '2nd inversion',
    '3rd inversion',
    '4th inversion',
    '5th inversion',
    '6th inversion',
  ];

  const nm = (m: number) => SH[m % 12] + (Math.floor(m / 12) - 1);

  const GEN: [string, string][] = [
    ['classical', 'Classical'],
    ['pop', 'Pop & ballad'],
    ['jazz', 'Jazz'],
    ['blues', 'Blues & boogie'],
    ['gospel', 'Gospel & R&B'],
    ['latin', 'Latin'],
    ['neosoul', 'Neo soul'],
    ['motown', 'Motown'],
    ['country', 'Country'],
    ['rock', 'Rock & roll'],
    ['reggae', 'Reggae'],
    ['ragtime', 'Ragtime'],
    ['worship', 'Worship'],
  ];
  const LV: Record<string, string> = {
    B: 'Beginner',
    I: 'Intermediate',
    A: 'Advanced',
  };

  /* =====================================================================
     2. FOCUS OPTIONS PER GAME
     ===================================================================== */
  const FO: Record<string, [string, string, string, string][]> = {
    chord: [
      ['t3', 'Triads', 'B', 'Size'],
      ['t4only', '7th chords', 'B', 'Size'],
      ['t4', 'Triads + 7th chords', 'B', 'Size'],
      ['t5', 'Up to 9th chords', 'I', 'Size'],
      ['sus', 'Sus & add chords', 'I', 'Colour'],
      ['slash_c', 'Slash chords – chord-tone bass', 'I', 'Slash'],
      ['bor', 'Borrowed chords', 'I', 'Colour'],
      ['v_shell', 'Shell voicings', 'I', 'Voicing'],
      ['v_open', 'Open voicings', 'I', 'Voicing'],
      ['t6', 'Up to 11th chords', 'A', 'Size'],
      ['t7', 'Up to 13th chords', 'A', 'Size'],
      ['alt', 'Altered chords (all sizes)', 'I', 'Colour'],
      ['slash_o', 'Slash chords – outside bass', 'A', 'Slash'],
      ['v_drop2', 'Drop 2 voicings', 'A', 'Voicing'],
      ['v_rootless', 'Rootless voicings (Type A & B)', 'A', 'Voicing'],
      ['v_cluster', 'Cluster voicings', 'A', 'Voicing'],
      ['v_quartal', 'Quartal voicings', 'A', 'Voicing'],
      ['v_ust', 'Upper-structure triads', 'A', 'Voicing'],
      ['mix', 'Everything mixed', 'A', 'Mixed'],
    ],
    scale: [
      ['chosen', 'My chosen mode', 'B', 'Modes'],
      ['five', '5-finger positions', 'B', 'Technique'],
      ['church', 'Any church mode', 'B', 'Modes'],
      ['pent', 'Major & minor pentatonic', 'B', 'Pentatonic'],
      ['chrom', 'Chromatic scale', 'B', 'Chromatic'],
      ['arp3', 'Triad arpeggios', 'B', 'Arpeggios'],
      ['arpd', 'Dom7 & Dim7 arpeggios', 'B', 'Arpeggios'],
      ['hanon', 'Hanon finger drills (1–10)', 'B', 'Technique'],
      ['blues', 'Blues scales', 'I', 'Blues'],
      ['minor', 'Minor-family modes', 'I', 'Modes'],
      ['arp7', '7th-chord arpeggios', 'I', 'Arpeggios'],
      ['bebop', 'Bebop scales', 'A', 'Bebop'],
      ['sym', 'Symmetrical scales', 'A', 'Symmetrical'],
      ['ext', 'Melodic & harmonic minor modes', 'A', 'Modes'],
      ['exotic', 'Exotic modes', 'A', 'Modes'],
      ['world', 'World scales', 'A', 'World'],
      ['all', 'All scales & modes', 'A', 'Mixed'],
    ],
    int: [
      ['i1', '2nds & 3rds', 'B', 'Simple'],
      ['i2', '4ths & 5ths', 'B', 'Simple'],
      ['i3', '6ths & 7ths', 'I', 'Simple'],
      ['i0', 'All simple intervals', 'I', 'Simple'],
      ['icomp', 'Compound (9ths–13ths)', 'A', 'Compound'],
    ],
    prog: [
      ['basic', 'Basic & Blues', 'B', 'Progressions'],
      ['mix', 'Mixed', 'I', 'Progressions'],
      ['adv', 'Advanced (Jazz & Neo Soul)', 'A', 'Progressions'],
    ],
    harm: [
      ['h_harm3', 'Harmonize a scale (triads)', 'B', 'Scales & Chords'],
      ['c_auth', 'Authentic cadence', 'B', 'Cadences'],
      ['c_plag', 'Plagal cadence (Gospel I–IV–I)', 'B', 'Cadences'],
      ['c_half', 'Half cadence', 'B', 'Cadences'],
      ['h_close', 'Close-range voice leading (triads)', 'B', 'Voice leading'],
      ['h_vl_up', 'Voice leading: Up the keyboard', 'B', 'Voice leading'],
      ['h_harm7', 'Harmonize a scale (7th chords)', 'I', 'Scales & Chords'],
      ['h_c2s', 'Match scale to chord', 'I', 'Scales & Chords'],
      ['h_mchar', 'Mode character chords', 'I', 'Scales & Chords'],
      ['h_sec', 'Secondary dominants', 'I', 'Substitutions'],
      ['h_tri', 'Tritone substitution', 'I', 'Substitutions'],
      ['c_dec', 'Deceptive cadence', 'I', 'Cadences'],
      ['h_bor', 'Modal interchange (borrowed)', 'I', 'Colour'],
      ['h_mii', 'Minor ii–V–i', 'I', 'Minor'],
      ['h_guide', 'Guide-tone targeting (3rds & 7ths)', 'I', 'Voice leading'],
      ['h_close7', 'Close-range voice leading (7th chords)', 'I', 'Voice leading'],
      ['h_vl_down', 'Voice leading: Down the keyboard', 'I', 'Voice leading'],
      ['h_back', 'Backdoor dominant', 'A', 'Substitutions'],
      ['h_dim', 'Diminished passing chords', 'A', 'Substitutions'],
      ['h_all', 'All substitutions mixed', 'A', 'Substitutions'],
      ['c_phry', 'Phrygian half cadence', 'A', 'Cadences'],
      ['c_pic', 'Picardy third', 'A', 'Cadences'],
      ['h_med', 'Chromatic mediants', 'A', 'Colour'],
      ['h_nea', 'Neapolitan chord', 'A', 'Colour'],
      ['h_aug', 'Augmented 6th chords', 'A', 'Colour'],
      ['h_cli', 'Line clichés', 'A', 'Minor'],
      ['h_bd', 'Backdoor ii–V–I', 'A', 'Substitutions'],
    ],
    ear: [
      ['ec3', 'Chord quality – triads', 'B', 'Chords'],
      ['ei', 'Intervals', 'B', 'Intervals'],
      ['ein', 'Chord inversions', 'I', 'Chords'],
      ['ec4', 'Chord quality – 7ths', 'I', 'Chords'],
      ['es', 'Scales & modes', 'I', 'Scales'],
      ['es2', 'Pentatonic, blues & more', 'I', 'Scales'],
      ['emel', 'Play melody by ear', 'I', 'Melody'],
      ['ebass', 'Bass-line & progression ear', 'I', 'Harmony'],
      ['ecad', 'Cadences', 'I', 'Harmony'],
      ['ep1', 'Progressions (basic)', 'I', 'Harmony'],
      ['ec7', 'Chord quality – everything', 'A', 'Chords'],
      ['ep2', 'Progressions (advanced)', 'A', 'Harmony'],
    ],
  };

  const GN: Record<string, string> = {
    chord: 'Chords',
    harm: 'Harmony',
    scale: 'Scale runs',
    int: 'Intervals',
    prog: 'Progressions',
    pat: 'Patterns',
    ear: 'Ear training',
  };
  const ALL = 'chord,scale,int,prog,harm,pat,ear';
  const NOEAR = 'chord,scale,int,prog,harm,pat';
  const RHYTHM = 'scale,prog,harm,pat';

  /* =====================================================================
     3. SETTINGS PANEL (HTML generation)
     ===================================================================== */
  const fld = (
    id: string,
    l: string,
    o: [string | number, string][],
    d: string | number,
    g: string,
    seg?: number,
  ) =>
    `<div class=f data-g="${g}"><label for=${id}>${l}</label>${
      seg
        ? `<div class=seg data-for=${id}>${o.map(x => `<button type=button data-v="${x[0]}">${x[1]}</button>`).join('')}</div>`
        : ''
    }<select id=${id}${seg ? ' class=hid' : ''}>${o
      .map(
        x =>
          `<option value="${x[0]}"${x[0] == d ? ' selected' : ''}>${x[1]}</option>`,
      )
      .join('')}</select><small class=why></small></div>`;

  const swt = (id: string, t: string, d: string, g: string) =>
    `<div class=f data-g="${g}"><label class=sw><input type=checkbox id=${id}><span class=tr></span><span><b>${t}</b><small>${d}</small></span></label><small class=why></small></div>`;

  const OPT = (a: string[]): [string, string][] => a.map(x => [x, x]);

  $('set').innerHTML =
    '<h3>Practice</h3>' +
    fld(
      'ug',
      'Game',
      [
        ['chord', 'Chords'],
        ['scale', 'Scale runs'],
        ['int', 'Intervals'],
        ['prog', 'Progressions'],
        ['harm', 'Harmony'],
        ['pat', 'Patterns (left & right hand)'],
        ['ear', 'Ear training'],
      ],
      'chord',
      ALL,
    ) +
    fld('focus', 'Focus', [], '', ALL) +
    swt(
      'inmode',
      'Stay in key & mode',
      'Use only chords, intervals, or ear drills built from the notes of your chosen key and mode.',
      'chord,int,ear',
    ) +
    swt(
      'altchords',
      'Include altered chords',
      'Include non-diatonic & altered qualities (minor, dim, aug, ♭5, ♯5, ♭9, ♯9, ♯11, ♭13) at any chord size.',
      'chord',
    ) +
    fld('key', 'Key', [['rnd', 'Any (Random)'], ...OPT(KEYS)], 'C', ALL) +
    fld(
      'scale',
      'Scale',
      [
        ...SCALE_FAMILIES.map(f => [f.id, f.label] as [string, string]),
        ['rnd', 'Any (Random)'],
      ],
      'major',
      ALL,
    ) +
    fld(
      'mode',
      'Mode',
      [
        ['rnd', 'Any (Random)'],
        ...SCALE_FAMILIES[0].modes.map(
          m => [m, getModeDisplayLabel(m)] as [string, string],
        ),
      ],
      'Ionian',
      ALL,
    ) +
    '<h3>Playing</h3>' +
    fld(
      'clef',
      'Clef',
      [
        ['treble', 'Treble'],
        ['bass', 'Bass'],
        ['grand', 'Grand'],
      ],
      'grand',
      ALL,
      1,
    ) +
    fld(
      'bhmode',
      'Both-hands chords',
      [
        ['bass', 'Bass + chord'],
        ['same', 'Same chord in both hands'],
        ['diff', 'Different inversions (LH & RH)'],
      ],
      'bass',
      'chord,prog,harm',
    ) +
    fld(
      'inv',
      'Inversions (RH / main)',
      [
        [0, 'Root position only'],
        [1, 'Up to 1st'],
        [2, 'Up to 2nd'],
        [3, 'Up to 3rd'],
        [4, 'Up to 4th'],
        [5, 'Up to 5th'],
        [6, 'Up to 6th'],
      ],
      2,
      'chord,scale,prog,harm',
    ) +
    fld(
      'lhinv',
      'LH Inversion',
      [
        [0, 'Root position only'],
        [1, 'Up to 1st'],
        [2, 'Up to 2nd'],
        [3, 'Up to 3rd'],
        [4, 'Up to 4th'],
        [5, 'Up to 5th'],
        [6, 'Up to 6th'],
      ],
      0,
      'chord,prog,harm',
    ) +
    fld(
      'scrange',
      'Scale range',
      [
        ['1', 'Single octave'],
        ['multi', 'Multi-octave'],
      ],
      '1',
      'scale',
      1,
    ) +
    fld(
      'scmultioct',
      'Multi-octave count',
      [
        ['auto', 'Auto'],
        ['2', '2 oct'],
        ['3', '3 oct'],
        ['4', '4 oct'],
      ],
      'auto',
      'scale',
      1,
    ) +
    fld(
      'schands',
      'Scale hands',
      [
        ['right', 'Right hand'],
        ['left', 'Left hand'],
        ['parallel', 'Both hands'],
        ['contrary', 'Contrary motion'],
      ],
      'right',
      'scale',
    ) +
    fld(
      'sccontrary',
      'Contrary start',
      [
        ['unison', 'Same note'],
        ['octave', '1 oct apart'],
      ],
      'unison',
      'scale',
      1,
    ) +
    `<div class="set-note" id="scoctnote" hidden></div>` +
    fld(
      'prompt',
      'Show on screen',
      [
        ['symbol', 'Name'],
        ['both', 'Name + staff'],
        ['staff', 'Staff only'],
      ],
      'symbol',
      'chord,scale,int,prog,harm',
      1,
    ) +
    fld(
      'pfmt',
      'Chord labels',
      [
        ['name', 'Names'],
        ['roman', 'Roman'],
        ['nns', 'Nashville'],
      ],
      'name',
      'prog,harm',
      1,
    ) +
    fld(
      'dir',
      'Direction',
      [
        ['up', 'Up'],
        ['down', 'Down'],
        ['any', 'Any'],
      ],
      'any',
      'scale,int,ear',
      1,
    ) +
    fld(
      'tol',
      'Octave rule',
      [
        ['any', 'Any octave'],
        ['exact', 'Exact octave'],
      ],
      'exact',
      'chord,int,prog,harm,pat',
      1,
    ) +
    swt(
      'randoct',
      'Random octave',
      'Place chords in random octaves across your keyboard range. Automatically turns off when Voice leading is enabled.',
      'chord,prog,harm',
    ) +
    swt(
      'vlead',
      'Relative voice leading',
      'Connects chords, harmony & progressions smoothly inside C3–C6 using all chord inversions and ergonomic fingering.',
      'chord,prog,harm',
    ) +
    `<div class="set-note" id="vloctnote" hidden></div>` +
    fld(
      'order',
      'Order',
      [
        ['rnd', 'Random'],
        ['ord', 'In order'],
      ],
      'rnd',
      ALL,
      1,
    ) +
    '<h3>Rhythm & Sound</h3>' +
    fld(
      'sound',
      'Sound preset',
      [
        ['grand', 'Grand piano'],
        ['rhodes', 'Rhodes EP'],
        ['wurlitzer', 'Wurlitzer'],
        ['pad', 'Warm pad'],
      ],
      'grand',
      ALL,
    ) +
    fld(
      'audioout',
      'Keyboard sound',
      [
        ['off', 'Off'],
        ['pc', 'PC only'],
        ['all', 'MIDI + PC'],
      ],
      'pc',
      ALL,
      1,
    ) +
    fld(
      'tempo',
      'Tempo (BPM)',
      [
        ['60', '60'],
        ['80', '80'],
        ['90', '90'],
        ['100', '100'],
        ['120', '120'],
        ['140', '140'],
      ],
      '80',
      RHYTHM,
      1,
    ) +
    fld(
      'feel',
      'Time & feel',
      [
        ['4_straight', '4/4 straight'],
        ['2_4', 'Beats 2 & 4 (backbeat)'],
        ['4_swing', '4/4 swing'],
        ['3_4', '3/4 waltz'],
        ['12_8', '12/8 ballad'],
      ],
      '4_straight',
      RHYTHM,
    ) +
    swt(
      'beat',
      'Metronome',
      'Steady click in rhythm drills; Patterns are also scored on timing.',
      RHYTHM,
    ) +
    swt(
      'tramp',
      'Tempo ramp (+5 BPM)',
      'Automatically increases BPM by 5 after every 3-correct streak.',
      RHYTHM,
    ) +
    '<h3>Options</h3>' +
    swt(
      'exinv',
      'Largest inversion only',
      'Always use your inversion limit instead of a random one.',
      'chord,scale,prog,harm',
    ) +
    swt(
      'fing',
      'Show fingering',
      'Enabled once Show answer is on; shows Blue (RH) & Orange (LH) badges on staff and keys.',
      ALL,
    ) +
    fld(
      'fingcheck',
      'Fingering validation',
      [['guidance', 'Guidance only (notes checked)']],
      'guidance',
      'chord,prog,harm',
      1,
    ) +
    swt(
      'dtl',
      'Details on click',
      'Click a chord, scale or interval to open a panel with its notes, names and theory.',
      ALL,
    ) +
    '<h3>My keyboard</h3>' +
    fld(
      'octs',
      'Octaves',
      R(2, 8).map(o => [o, o + ' octaves']),
      5,
      ALL,
    ) +
    fld(
      'lowest',
      'Lowest key',
      R(12, 96).map(m => [m, nm(m)]),
      36,
      ALL,
    ) +
    `<div class=f data-g="${ALL}"><button class=s id=cal type=button>Calibrate: press lowest, then highest key</button><small id=calmsg></small> <b id=rng></b><small class=why></small></div>` +
    `<div hidden>` +
    `<select id=game>${['chord', 'slash', 'pass', 'scale', 'int', 'prog', 'harm_guide', 'harm_close', 'harm_vl_up', 'harm_vl_down', 'harm_scale', 'harm_c2s', 'harm_mchar', 'ear'].map(x => `<option>${x}</option>`).join('')}</select>` +
    `<select id=size>${R(3, 7).map(x => `<option>${x}</option>`).join('')}</select>` +
    `<select id=pool><option>all</option><option>key</option></select>` +
    `<select id=bass><option>any</option><option>chord</option><option>out</option></select>` +
    `<select id=plevel><option>basic</option><option>adv</option><option>mix</option></select>` +
    `<select id=eartype>${['chord', 'int', 'scale', 'scale2', 'mel', 'bassline', 'cad', 'prog', 'inv'].map(x => `<option>${x}</option>`).join('')}</select>` +
    `<input type=checkbox id=sus><input type=checkbox id=bor>` +
    `</div>`;

  /* =====================================================================
     4. STATE + KEYBOARD RANGE
     ===================================================================== */
  const S: any = {
    n: 0,
    fm: {} as Record<number, {f: number | string; h: string}[]>,
    held: new Set<number>(),
    ign: new Set<number>(),
    st: {ok: 0, tot: 0, str: 0, best: 0, by: {}},
    studyMode: 'practice' as 'practice' | 'teach',
    lo: 36,
    hi: 96,
    cal: null as number[] | null,
    go: false,
    hl: new Set<number>(),
    kbOk: new Set<number>(),
    kbBad: new Set<number>(),
    prefInMode: true,
    pedal: false,
    lastVel: null as number | null,
    pedalChanged: false,
    cdTm: null as ReturnType<typeof setInterval> | null,
    actTm: null as ReturnType<typeof setTimeout> | null,
    actWaitTm: null as ReturnType<typeof setTimeout> | null,
    actCd: null as ReturnType<typeof setInterval> | null,
    prevRh: null as number[] | null,
    prevLh: null as number[] | null,
    prevRhF: null as (number | string)[] | null,
    prevLhF: null as (number | string)[] | null,
    relLocked: false,
    primDeg: 0,
    rangeLocked: false,
    vlDir: 'up' as VLDirectionSetting,
    vlDirManual: false,
    vl7Mode: 'full' as VLSeventhMode,
    vlAnchorRh: null as number | null,
    vlAnchorLh: null as number | null,
    vlPrevDirRh: null as VLDirection | null,
    vlPrevDirLh: null as VLDirection | null,
    lockZoneRh: null as [number, number] | null,
    lockZoneLh: null as [number, number] | null,
    shiftTm: null as ReturnType<typeof setTimeout> | null,
    shiftManual: null as {tones: number; dir: 'up' | 'down'} | null,
    homeRhAvg: null as number | null,
    homeLhAvg: null as number | null,
    scMode: 'play' as 'play' | 'quiz',
    scDiff: 'beginner' as 'beginner' | 'advanced',
    prefFingering: {R: null as number[] | null, L: null as number[] | null},
    famAnchorChord: 'deg:0',
    vlNotice: '',
    vlWarn: '',
  };
  let C: any;

  const ADV_KEY = 'pedagogue_advance_v1';
  const clampAdvSec = (v: number) =>
    Math.min(30, Math.max(0.5, Math.round(v * 10) / 10));
  const fmtAdvSec = (v: number) => `${Number(v.toFixed(1))}s`;
  let advCfg: {mode: 'timed' | 'manual'; sec: number} = {
    mode: 'timed',
    sec: 2,
  };
  try {
    const rawAdv = localStorage.getItem(ADV_KEY);
    if (rawAdv) {
      const parsed = JSON.parse(rawAdv);
      const sec = Number(parsed?.sec);
      advCfg = {
        mode: parsed?.mode == 'manual' ? 'manual' : 'timed',
        sec: Number.isFinite(sec) ? clampAdvSec(sec) : 2,
      };
    }
  } catch {
    // ignore storage errors
  }

  const TIME_KEY = 'pedagogue_activity_time_v1';
  const clampTimeSec = (v: number) =>
    Math.min(60, Math.max(1, Math.round(v)));
  let timeCfg: {mode: 'untimed' | 'timed'; sec: number} = {
    mode: 'untimed',
    sec: 5,
  };
  try {
    const rawTime = localStorage.getItem(TIME_KEY);
    if (rawTime) {
      const parsed = JSON.parse(rawTime);
      const sec = Number(parsed?.sec);
      timeCfg = {
        mode: parsed?.mode == 'timed' ? 'timed' : 'untimed',
        sec: Number.isFinite(sec) ? clampTimeSec(sec) : 5,
      };
    }
  } catch {
    // ignore storage errors
  }

  function clearAdvanceTimers() {
    clearTimeout(S.tm);
    S.tm = null;
    if (S.cdTm) {
      clearInterval(S.cdTm);
      S.cdTm = null;
    }
  }

  function applyShiftSideBadges(shift: {tones: number; dir: 'up' | 'down'} | null) {
    const leftEl = $('shiftleft') as HTMLElement | null;
    const rightEl = $('shiftright') as HTMLElement | null;
    if (!leftEl || !rightEl) return;

    if (!shift || shift.tones <= 0) {
      leftEl.hidden = true;
      leftEl.innerHTML = '';
      delete leftEl.dataset.shiftKey;
      rightEl.hidden = true;
      rightEl.innerHTML = '';
      delete rightEl.dataset.shiftKey;
      return;
    }

    const safeTones = Math.max(1, Math.round(shift.tones));
    const unit = safeTones === 1 ? 'degree' : 'degrees';
    const leftChevronSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.5 4.5 C12.8 8.4 9.8 10.6 7 12 C9.8 13.4 12.8 15.6 15.5 19.5"/></svg>`;
    const rightChevronSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 4.5 C11.2 8.4 14.2 10.6 17 12 C14.2 13.4 11.2 15.6 8.5 19.5"/></svg>`;
    if (shift.dir === 'down') {
      const key = `down:${safeTones}`;
      rightEl.hidden = true;
      rightEl.innerHTML = '';
      delete rightEl.dataset.shiftKey;
      if (leftEl.dataset.shiftKey !== key || leftEl.hidden) {
        leftEl.dataset.shiftKey = key;
        leftEl.title = `Shift range ${safeTones} ${unit} left (down)`;
        leftEl.setAttribute('aria-label', leftEl.title);
        leftEl.innerHTML = `<span class="q-shift-arrow" aria-hidden="true">${leftChevronSvg}</span><span class="q-shift-num">${safeTones}</span>`;
        leftEl.hidden = false;
      }
    } else {
      const key = `up:${safeTones}`;
      leftEl.hidden = true;
      leftEl.innerHTML = '';
      delete leftEl.dataset.shiftKey;
      if (rightEl.dataset.shiftKey !== key || rightEl.hidden) {
        rightEl.dataset.shiftKey = key;
        rightEl.title = `Shift range ${safeTones} ${unit} right (up)`;
        rightEl.setAttribute('aria-label', rightEl.title);
        rightEl.innerHTML = `<span class="q-shift-num">${safeTones}</span><span class="q-shift-arrow" aria-hidden="true">${rightChevronSvg}</span>`;
        rightEl.hidden = false;
      }
    }
  }

  function hideShiftOverlay() {
    if (S.shiftTm) {
      clearTimeout(S.shiftTm);
      S.shiftTm = null;
    }
    S.shiftManual = null;
    applyShiftSideBadges(null);
  }

  function showShiftOverlay(tones: number, dir: 'up' | 'down') {
    if (S.shiftTm) {
      clearTimeout(S.shiftTm);
      S.shiftTm = null;
    }
    const safeTones = Math.max(1, Math.round(tones));
    S.shiftManual = {tones: safeTones, dir};
    applyShiftSideBadges(S.shiftManual);
    S.shiftTm = setTimeout(() => {
      S.shiftManual = null;
      S.shiftTm = null;
      const q = S.q;
      const mInfo = q?.vlInfo;
      if (
        q &&
        mInfo &&
        !S.rangeLocked &&
        !$('vlbar')?.hidden &&
        mInfo.handShift !== 0
      ) {
        applyShiftSideBadges({
          tones: Math.abs(mInfo.handShift),
          dir: mInfo.handShift > 0 ? 'up' : 'down',
        });
      } else {
        applyShiftSideBadges(null);
      }
    }, 1800);
  }

  function syncOctaveVLState(change: {vlead?: boolean; randomOctave?: boolean}) {
    const vlEl = $('vlead') as HTMLInputElement | null;
    const roEl = $('randoct') as HTMLInputElement | null;
    if (!vlEl || !roEl) return;
    const res = resolveOctaveVoiceLeadingSettings(
      {vlead: vlEl.checked, randomOctave: roEl.checked},
      change,
      DEFAULT_VL_RANGE,
    );
    vlEl.checked = res.vlead;
    roEl.checked = res.randomOctave;
    S.vlNotice = res.notice;
    S.vlWarn = res.warning;
    const noteEl = $('vloctnote') as HTMLElement | null;
    if (noteEl) {
      const msg = res.warning || res.notice;
      noteEl.textContent = msg;
      noteEl.classList.toggle('warn', !!res.warning);
      noteEl.hidden = !msg;
    }
  }

  function resetRelChain() {
    S.n = 0;
    S.prevRh = null;
    S.prevLh = null;
    S.prevRhF = null;
    S.prevLhF = null;
    S.relLocked = false;
    S.vlAnchorRh = null;
    S.vlAnchorLh = null;
    S.vlPrevDirRh = null;
    S.vlPrevDirLh = null;
    S.lockZoneRh = null;
    S.lockZoneLh = null;
    S.homeRhAvg = null;
    S.homeLhAvg = null;
    hideShiftOverlay();
  }

  function clearActivityTimers() {
    if (S.actWaitTm) {
      clearTimeout(S.actWaitTm);
      S.actWaitTm = null;
    }
    if (S.actTm) {
      clearTimeout(S.actTm);
      S.actTm = null;
    }
    if (S.actCd) {
      clearInterval(S.actCd);
      S.actCd = null;
    }
    const cd = $('kbcd');
    if (cd) {
      cd.hidden = true;
      cd.classList.remove('urgent');
    }
  }

  function syncScaleOctaveUI() {
    const scRangeEl = $('scrange') as HTMLSelectElement | null;
    const multiEl = $('scmultioct') as HTMLSelectElement | null;
    const handsEl = $('schands') as HTMLSelectElement | null;
    const contraryEl = $('sccontrary') as HTMLSelectElement | null;
    const noteEl = $('scoctnote') as HTMLElement | null;
    if (!scRangeEl || !multiEl || !handsEl || !contraryEl) return;

    const ug = $('ug')?.value || 'chord';
    const fVal = $('focus')?.value || '';
    const isFixedDrill = fVal === 'five' || fVal === 'hanon';
    const hands = (handsEl.value || 'right') as ScaleHandsMode;
    const contraryStart = (contraryEl.value || 'unison') as ContraryStartMode;
    const rangeVal = (scRangeEl.value || '1') as ScaleRangeMode;
    const keyVal = $('key')?.value || 'C';

    let rootPcs: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    if (keyVal !== 'rnd') {
      const L = LN.indexOf(keyVal[0]);
      const a = keyVal[1] == '♯' ? 1 : keyVal[1] == '♭' ? -1 : 0;
      if (L >= 0) rootPcs = [(LET[L] + a + 12) % 12];
    }

    const {maxGuaranteed, maxAnyKey} = computeScaleOctaveCapacity({
      lo: S.lo,
      hi: S.hi,
      hands,
      contraryStart,
      rootPcs,
    });

    const multiWrap = multiEl.closest('.f') as HTMLElement | null;
    const contraryWrap = contraryEl.closest('.f') as HTMLElement | null;
    if (multiWrap) {
      multiWrap.hidden = ug !== 'scale' || rangeVal !== 'multi';
    }
    if (contraryWrap) {
      contraryWrap.hidden = ug !== 'scale' || hands !== 'contrary';
    }

    const multiSegBtns = document.querySelectorAll<HTMLButtonElement>(
      '.seg[data-for="scmultioct"] button',
    );
    multiSegBtns.forEach(btn => {
      const v = btn.dataset.v || 'auto';
      const req = v === 'auto' ? 0 : Number(v);
      const disabledByCap = req > 0 && req > maxGuaranteed;
      btn.disabled = isFixedDrill || ug !== 'scale' || disabledByCap;
      btn.title = disabledByCap
        ? `Needs a wider keyboard range for ${req} octaves in this hand mode`
        : '';
    });

    if (multiEl.value !== 'auto') {
      const req = Number(multiEl.value);
      if (req > maxGuaranteed) {
        multiEl.value = maxGuaranteed >= 2 ? String(maxGuaranteed) : 'auto';
      }
    }

    if (noteEl) {
      if (ug !== 'scale' || isFixedDrill) {
        noteEl.hidden = true;
      } else {
        const kbOcts = +$('octs')?.value || 5;
        const rangeDesc = `${nm(S.lo)}–${nm(S.hi)}`;
        let msg = '';
        let warn = false;
        const handDescShort =
          hands === 'contrary'
            ? contraryStart === 'unison'
              ? 'contrary (same note)'
              : 'contrary (1 oct apart)'
            : hands === 'parallel'
              ? 'both hands'
              : hands === 'left'
                ? 'left hand'
                : 'right hand';

        if (hands === 'contrary' && contraryStart === 'octave' && maxAnyKey === 0) {
          warn = true;
          msg = `1 oct apart contrary needs 3+ octaves on your keyboard — using Same note inside ${rangeDesc}.`;
        } else if (rangeVal === 'multi' && maxGuaranteed < 2) {
          warn = true;
          if (hands === 'contrary' && contraryStart === 'octave' && maxAnyKey >= 2) {
            msg = `${rangeDesc}: 1 oct apart fits 2 oct only in C. Use Same note or 6+ octaves for 2 oct across keys.`;
          } else {
            msg = `${rangeDesc} fits 1 octave in ${handDescShort}. Expand My keyboard for multi-octave.`;
          }
        } else if (rangeVal === 'multi') {
          const extra =
            keyVal === 'rnd' && maxAnyKey > maxGuaranteed
              ? ` (${maxAnyKey} in some keys)`
              : '';
          msg = `${kbOcts}-octave keyboard (${rangeDesc}): ${handDescShort} fits up to ${maxGuaranteed} octaves${extra}.`;
        }

        noteEl.textContent = msg;
        noteEl.classList.toggle('warn', warn);
        noteEl.hidden = !msg;
      }
    }
  }

  function setRange() {
    S.lo = +$('lowest').value;
    S.hi = Math.min(S.lo + +$('octs').value * 12, 108);
    $('rng').textContent = 'Range: ' + nm(S.lo) + ' – ' + nm(S.hi);
    syncScaleOctaveUI();
    kb();
  }
  $('lowest').onchange = $('octs').onchange = setRange;
  setRange();

  $('cal').onclick = () => {
    S.cal = [];
    $('calmsg').textContent = 'Press your lowest key, then your highest key…';
  };

  /* =====================================================================
     5. KEY / MODE CONTEXT + NOTE SPELLING
     ===================================================================== */
  function buildCtx(k: string, m: string) {
    const L = LN.indexOf(k[0]);
    const a = k[1] == '♯' ? 1 : k[1] == '♭' ? -1 : 0;
    const r = (LET[L] + a + 12) % 12;
    const sc = MODES[m] || SCALES[m];
    const names: string[] = [];
    const sp: Record<number, {l: number; a: number}> = {};

    if (sc.length == 7)
      sc.forEach((s: number, i: number) => {
        const l = (L + i) % 7;
        const pc = (r + s) % 12;
        let ac = ((pc - LET[l]) % 12 + 12) % 12;
        if (ac > 6) ac -= 12;
        sp[pc] = {l, a: ac};
        names.push(LN[l] + ACC[ac]);
      });

    const fl = !['G', 'D', 'A', 'E', 'B', 'F♯', 'C♯'].includes(k);
    for (let p = 0; p < 12; p++)
      if (!sp[p]) {
        const n = (fl ? FL : SH)[p];
        sp[p] = {
          l: LN.indexOf(n[0]),
          a: n[1] == '♯' ? 1 : n[1] == '♭' ? -1 : 0,
        };
      }

    if (sc.length != 7)
      sc.forEach((s: number) => {
        const z = sp[(r + s) % 12];
        names.push(LN[z.l] + ACC[z.a]);
      });

    return {k, m, r, sc, names, sp};
  }

  function ordCycleLen(sampleCtx: any): number {
    const ug = $('ug').value;
    const f = $('focus').value;
    const g = $('game').value;
    const mi = +$('inv').value;
    const lhi = +$('lhinv').value;
    const exinv = $('exinv').checked;

    if ($('bor').checked) {
      return 7 * 6 * 2 * (exinv ? 1 : Math.min(mi, 3) + 1);
    }
    const smoothChord = ug == 'chord' && g == 'chord' && $('vlead').checked;
    if ((ug == 'chord' || g == 'slash') && $('pool').value == 'key') {
      const includeAlt =
        ($('altchords')?.checked || f == 'alt') &&
        f != 'sus' &&
        f != 'v_quartal' &&
        f != 'v_ust' &&
        g != 'slash';
      if (includeAlt) {
        return (
          chromaticChordList(f, g).length * (sampleCtx?.sc?.length || 7) || 7
        );
      }
      return (
        diatonicChordItems(sampleCtx, f, g, mi, lhi, exinv, smoothChord)
          .length || 7
      );
    }
    if ((ug == 'chord' || g == 'slash') && $('pool').value == 'all') {
      return (
        chromaticChordItems(f, g, mi, lhi, exinv, smoothChord).length || 12
      );
    }
    if (ug == 'scale') {
      const arInvCount = ['arp3', 'arp7', 'arpd'].includes(f)
        ? (exinv ? 1 : Math.min(mi, f == 'arp3' ? 2 : 3) + 1)
        : 1;
      const dirCount = $('dir').value == 'any' ? 2 : 1;
      return arInvCount * dirCount;
    }
    if (ug == 'int') {
      const IL = (S.ic ? INTC : INT).filter(
        i => i[1] >= S.ir[0] && i[1] <= S.ir[1],
      );
      const dirs =
        $('dir').value == 'up' ? [1] : $('dir').value == 'down' ? [0] : [1, 0];
      return (
        buildIntervalItems(sampleCtx, IL, dirs, $('inmode').checked).length ||
        IL.length
      );
    }
    if (ug == 'prog' && S.pat) {
      const [gn, lv] = f.split('|');
      const L = PAT.filter(p => (gn == 'all' || p[0] == gn) && p[3] == lv);
      return L.length || 1;
    }
    if (ug == 'prog' || (ug == 'harm' && g == 'prog')) {
      const lv = $('plevel').value;
      const L = PR.filter(p =>
        S.hf
          ? p[2] == S.hf
          : lv == 'mix'
            ? p[2] == 'basic' || p[2] == 'adv'
            : p[2] == lv,
      );
      return L.length || 1;
    }
    if (ug == 'harm' && g == 'pass') {
      return 7;
    }
    if (ug == 'harm' && g == 'harm_close') {
      return 42;
    }
    if (ug == 'harm' && g == 'harm_scale') {
      return 7;
    }
    if (ug == 'harm' && g == 'harm_c2s') {
      return (
        CHORD_TO_SCALE_SPECS.filter(s =>
          S.scDiff === 'beginner' ? s.difficulty === 'beginner' : true,
        ).length || 1
      );
    }
    if (ug == 'harm' && g == 'harm_mchar') {
      return MODE_CHARACTER_SPECS.length || 1;
    }
    if (ug == 'ear') {
      const et = $('eartype').value;
      const st = +$('size').value;
      const inModeEar = $('inmode').checked;
      const dirCount = $('dir').value == 'any' ? 2 : 1;
      if (et == 'chord') {
        const L = Q.filter(x => x[2] <= st && typeof x[0] == 'string');
        if (inModeEar) {
          const qNames = new Set(
            L.map(y => (y[0] as string).trim() || 'major'),
          );
          const sizes = st == 3 ? [3] : st == 4 ? [4] : [3, 4];
          const diaPool = sizes
            .flatMap(sz =>
              R(0, 6).map(deg =>
                buildDiatonicChord(sampleCtx, 'all', sampleCtx.sc, deg, sz, 0, 0),
              ),
            )
            .filter(ch => qNames.has(ch.sf.trim() || 'major'));
          if (diaPool.length >= 2) return diaPool.length;
        }
        return L.length || 1;
      }
      if (et == 'int') {
        const modeSet = new Set([
          ...sampleCtx.sc.filter((i: number) => i > 0),
          12,
        ]);
        const modeIL = INT.filter(i => modeSet.has(i[1]));
        const count =
          inModeEar && modeIL.length >= 3 ? modeIL.length : INT.length;
        return count * dirCount;
      }
      if (et == 'scale' || et == 'scale2') {
        const SS = et == 'scale' ? MODES : SCALES;
        return Object.keys(SS).length * dirCount;
      }
      if (et == 'bassline') return 6;
      if (et == 'cad' || et == 'prog') {
        return (
          PR.filter(p =>
            et == 'cad' ? p[2].startsWith('cad') : p[2] == S.ep,
          ).length || 1
        );
      }
      if (et == 'inv') {
        if (inModeEar) return 7 * (3 + 4);
        const L = Q.filter(
          x =>
            x[2] <= 4 &&
            typeof x[0] == 'string' &&
            x[1].length >= 3 &&
            x[1].length <= 4 &&
            !/quartal/.test(x[0]),
        );
        return L.reduce((acc, x) => acc + x[1].length, 0) || 1;
      }
      return 1;
    }
    return 1;
  }

  function ctx() {
    let k = $('key').value;
    let m = $('mode').value;
    const scFam = $('scale')?.value || 'major';
    const famModes =
      scFam === 'rnd'
        ? Object.keys(MODES)
        : SCALE_FAMILIES.find(f => f.id === scFam)?.modes ||
          Object.keys(MODES).slice(0, 7);
    const P: string[] | null = S.mp
      ? S.mp
      : m == 'rnd'
        ? famModes
        : null;

    if (ORD()) {
      const previewK = k == 'rnd' ? KEYS[0] : k;
      const previewM = P ? P[0] : m;
      const clen = ordCycleLen(buildCtx(previewK, previewM));
      const cycleIdx = Math.floor(S.n / clen);
      if (P) {
        m = P[cycleIdx % P.length];
        if (k == 'rnd')
          k = KEYS[Math.floor(cycleIdx / P.length) % KEYS.length];
      } else if (k == 'rnd') {
        k = KEYS[cycleIdx % KEYS.length];
      }
    } else {
      if (k == 'rnd') k = KEYS[rand(KEYS.length)];
      if (P) m = P[rand(P.length)];
    }

    C = buildCtx(k, m);
  }

  const sm = (m: number) => {
    const p = C.sp[m % 12];
    return {
      l: p.l,
      a: p.a,
      o: Math.floor((m - p.a) / 12) - 1,
      n: LN[p.l] + ACC[p.a],
    };
  };
  const smOct = (m: number) => {
    const s = sm(m);
    return s.n + s.o;
  };
  const pn = (pc: number) => LN[C.sp[pc].l] + ACC[C.sp[pc].a];

  /* =====================================================================
     6. CHORD NAMING (suffix from intervals)
     ===================================================================== */
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

  function suf(i: number[]) {
    return chordSuffixFromIntervals(i);
  }

  /* =====================================================================
     7. VOICING (single-hand, bass+chord, both-hands same/diff inversion, & voice leading)
     ===================================================================== */
  const Z = () => {
    const c = $('clef').value;
    return c == 'bass'
      ? [28, 64]
      : c == 'treble'
        ? [57, 96]
        : rand(2)
          ? [57, 96]
          : [28, 64];
  };

  function makeVoicingMidi(
    ints: number[],
    pc: number,
    inv: number,
    oct: number,
    drop2Base?: number[],
  ): number[] {
    if (drop2Base && drop2Base.length >= 4) {
      const close = makeVoicingMidi(drop2Base, 0, inv % drop2Base.length, oct);
      return [close[2] - 12, close[0], close[1], close[3]].map(
        m => m + pc,
      );
    }
    const rootMidi = 12 * (oct + 1) + pc;
    if (inv <= 0) {
      return [...new Set(ints.map(x => rootMidi + x))].sort((x, y) => x - y);
    }
    const hasCompound = ints.some(x => x < 0 || x >= 12);
    if (!hasCompound) {
      const a = ints.map(x => rootMidi + x);
      for (let i = 0; i < inv; i++) a.push(a.shift()! + 12);
      return [...new Set(a)].sort((x, y) => x - y);
    }
    // For compound chords (9th/11th/13th/add9), invert into close position with the target tone genuinely in the bass
    const targetIdx = inv % ints.length;
    const bassOff = ((ints[targetIdx] % 12) + 12) % 12;
    const offsets = ints.map(x => {
      const p = ((x % 12) + 12) % 12;
      return p >= bassOff ? p : p + 12;
    });
    return [...new Set(offsets.map(o => rootMidi + o))].sort((x, y) => x - y);
  }

  function put(
    ints: number[],
    pc: number,
    inv: number,
    z: number[],
    drop2Base?: number[],
  ) {
    const fit = (a: number[], l: number, h: number) =>
      a[0] >= l && a.at(-1)! <= h;
    const A: number[][] = [];
    for (let o = -1; o < 9; o++)
      A.push(makeVoicingMidi(ints, pc, inv, o, drop2Base));

    const loB = Math.max(S.lo, z[0]);
    const hiB = Math.min(S.hi, z[1]);
    let c = A.filter(a => fit(a, loB, hiB));
    if (!c.length) c = A.filter(a => fit(a, S.lo, S.hi));
    if (!c.length) return makeVoicingMidi(ints, pc, inv, 4, drop2Base);

    const roEl = $('randoct') as HTMLInputElement | null;
    const ugVal = $('ug')?.value;
    if (roEl && !roEl.checked && ugVal && ['chord', 'prog', 'harm'].includes(ugVal)) {
      const center = (Math.max(loB, DEFAULT_VL_RANGE[0]) + Math.min(hiB, DEFAULT_VL_RANGE[1])) / 2;
      const sortedC = [...c].sort((a, b) => {
        const avgA = a.reduce((s, n) => s + n, 0) / a.length;
        const avgB = b.reduce((s, n) => s + n, 0) / b.length;
        return Math.abs(avgA - center) - Math.abs(avgB - center);
      });
      return sortedC[0];
    }
    return c[rand(c.length)];
  }

  function scaleStepFrom(midi: number, dir: -1 | 1, sc = C?.sc || [0, 2, 4, 5, 7, 9, 11], root = C?.r ?? 0): number {
    const pcs = new Set(sc.map((s: number) => (root + s) % 12));
    for (let d = 1; d <= 5; d++) {
      const cand = midi + dir * d;
      if (pcs.has(((cand % 12) + 12) % 12)) return cand;
    }
    return midi + dir * 2;
  }

  function computeLockCorridor(notes: number[]): [number, number] | null {
    if (!notes || !notes.length) return null;
    const sorted = [...notes].sort((a, b) => a - b);
    const sc = C?.sc || [0, 2, 4, 5, 7, 9, 11];
    const r = C?.r ?? 0;
    const lo = Math.max(S.lo, scaleStepFrom(sorted[0], -1, sc, r));
    const hi = Math.min(S.hi, scaleStepFrom(sorted[sorted.length - 1], 1, sc, r));
    return [lo, Math.max(lo + 4, hi)];
  }

  function scaleStepsDelta(fromMidi: number, toMidi: number): {tones: number; dir: 'up' | 'down'} {
    const a = Math.round(fromMidi);
    const b = Math.round(toMidi);
    if (a === b) return {tones: 0, dir: 'up'};
    const dir: 'up' | 'down' = b > a ? 'up' : 'down';
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const sc = C?.sc || [0, 2, 4, 5, 7, 9, 11];
    const r = C?.r ?? 0;
    const pcs = new Set(sc.map((s: number) => (r + s) % 12));
    let count = 0;
    for (let m = lo + 1; m <= hi; m++) {
      if (pcs.has(((m % 12) + 12) % 12)) count++;
    }
    const tones = count > 0 ? count : Math.max(1, Math.round((hi - lo) / 2));
    return {tones, dir};
  }

  const INV_KEY_TO_NUM: Record<VLInversionKey, number> = {
    root: 0,
    '1st': 1,
    '2nd': 2,
    '3rd': 3,
    '4th': 4,
    '5th': 5,
    '6th': 6,
  };

  function getScaleIdxMapper(): (midi: number) => number {
    if (C?.sc?.length === 7) {
      return (m: number) => {
        const s = sm(m);
        return (s.o + 1) * 7 + s.l;
      };
    }
    return buildScaleDegreeLookup(C?.r ?? 0, C?.sc || [0, 2, 4, 5, 7, 9, 11]);
  }

  function windowMidiCorridor(
    anchorIdx: number,
    chordSize: number,
    bounds: [number, number] = [S.lo, S.hi],
  ): [number, number] {
    const scLen = C?.sc?.length || 7;
    const toIdx = getScaleIdxMapper();
    const win = windowForAnchor(anchorIdx, chordSize, scLen);
    let loM = bounds[1];
    let hiM = bounds[0];
    for (let m = bounds[0]; m <= bounds[1]; m++) {
      const idx = toIdx(m);
      if (idx >= win.winLoIdx && idx <= win.winHiIdx) {
        if (m < loM) loM = m;
        if (m > hiM) hiM = m;
      }
    }
    return loM <= hiM ? [loM, hiM] : [S.lo, S.hi];
  }

  function vlBoundsForHand(
    hand: 'R' | 'L',
    cl: string,
    bh: string,
  ): [number, number] {
    if (cl === 'grand' && hand === 'R') {
      const minR = Math.max(S.lo, Math.min(S.hi - 12, bh === 'bass' ? 48 : 53));
      return [minR, S.hi];
    }
    if (cl === 'grand' && hand === 'L') {
      const maxL = Math.min(S.hi, Math.max(S.lo + 12, 64));
      return [S.lo, maxL];
    }
    return [S.lo, S.hi];
  }

  const VL_INV_KEYS: VLInversionKey[] = [
    'root',
    '1st',
    '2nd',
    '3rd',
    '4th',
    '5th',
    '6th',
  ];
  const VL_INV_LABELS = [
    'Root position',
    '1st inversion',
    '2nd inversion',
    '3rd inversion',
    '4th inversion',
    '5th inversion',
    '6th inversion',
  ];

  interface EngineVoicedResult {
    notes: number[];
    hd: string[];
    lhLen: number;
    rhLen: number;
    lhInv: number;
    rhInv: number;
    rhOut: VLStepOutput | null;
    lhOut: VLStepOutput | null;
    rhFingering?: FingeringResult | null;
    lhFingering?: FingeringResult | null;
    vlF: (number | string)[];
    rhF: number[];
    lhF: number[];
    vlInfo: {
      direction: VLDirection;
      inversion: VLInversionKey;
      inversionLabel: string;
      handShift: number;
      shapeChange: boolean;
      dirFlipped: boolean;
      adjusted: boolean;
      omittedFifth: boolean;
      commonTonesKept: number;
      cost?: number;
      moveSummary?: string;
      rotated?: 'up' | 'down' | false;
      notRootPosition?: boolean;
      warning?: string;
    };
  }

  function runEngineVoice(opts: {
    ints: number[];
    pc: number;
    cl: string;
    bh: string;
    rangeMode: 'locked' | 'unlocked';
    direction: VLDirectionSetting;
    seventhMode?: VLSeventhMode;
    prevRh?: number[] | null;
    prevRhF?: (number | string)[] | null;
    prevAnchorRh?: number | null;
    prevDirRh?: VLDirection | null;
    prevLh?: number[] | null;
    prevLhF?: (number | string)[] | null;
    prevAnchorLh?: number | null;
    prevDirLh?: VLDirection | null;
    drop2Base?: number[];
    fixedInv?: number;
    forceBass?: number;
    isSlash?: boolean;
    slashName?: string;
  }): EngineVoicedResult {
    const {
      ints,
      pc,
      cl,
      bh,
      rangeMode,
      direction,
      seventhMode = S.vl7Mode,
      prevRh,
      prevRhF,
      prevAnchorRh,
      prevDirRh,
      prevLh,
      prevLhF,
      prevAnchorLh,
      prevDirLh,
      drop2Base,
      fixedInv,
      forceBass,
      isSlash,
      slashName,
    } = opts;
    const scRoot = C?.r ?? 0;
    const scInts = C?.sc || [0, 2, 4, 5, 7, 9, 11];
    const toScaleIdx = getScaleIdxMapper();

    // Unlocked anchor-free semitone-cost engine (pinned to C3-C6 / keyboard bounds)
    if (rangeMode === 'unlocked' && !drop2Base && !isSlash) {
      let useInts = [...ints];
      let omittedFifth = false;
      if (seventhMode === 'omit5' && useInts.length === 4) {
        const filtered = useInts.filter(i => i !== 7);
        if (filtered.length === 3) {
          useInts = filtered;
          omittedFifth = true;
        }
      }

      const clampRange = (lo: number, hi: number): [number, number] => {
        const a = Math.max(S.lo, lo);
        const b = Math.min(S.hi, hi);
        if (b - a >= 12) return [a, b];
        return [S.lo, S.hi];
      };

      const solveUnlockedHand = (
        hand: 'R' | 'L',
        range: [number, number],
        prevNotes: number[] | null | undefined,
        prevFingers: (number | string)[] | null | undefined,
        prevAnchor: number | null | undefined,
        fixedInversion?: number,
      ) => {
        const optDir = direction === 'auto' ? undefined : direction;
        const step =
          prevNotes && prevNotes.length
            ? nextVoicing(
                prevNotes,
                {root: pc, ints: useInts},
                {direction: optDir, range, maxSpan: 12},
              )
            : {
                ...pickStartVoicing(
                  {root: pc, ints: useInts},
                  fixedInversion ?? 0,
                  range,
                  12,
                ),
                cost: 0,
                rotated: false as const,
                voiceMoves: [] as number[],
              };

        const prevPrimary =
          prevFingers && prevNotes && prevFingers.length === prevNotes.length
            ? prevFingers.map(v => {
                const first = String(v).split('/')[0];
                const num = Number(first);
                return Number.isFinite(num) && num >= 1 && num <= 5 ? num : 1;
              })
            : null;
        const fing = computeVoicingFingering(
          step.notes,
          hand,
          prevNotes && prevPrimary ? {notes: prevNotes, primary: prevPrimary} : null,
          DEFAULT_FINGERING_RULES,
          S.prefFingering?.[hand] || null,
        );
        const tokens: (number | string)[] = fing.perNote.map(p =>
          p.fingers.length === 2 ? `${p.fingers[0]}/${p.fingers[1]}` : p.fingers[0],
        );
        const anchorIdx = toScaleIdx(step.notes[0]);
        const handShift = prevAnchor != null ? anchorIdx - prevAnchor : 0;
        const mv = prevNotes?.length
          ? describeVoiceMovement(prevNotes, step.notes, smOct)
          : {moves: [], summary: '', heldCount: 0, totalCost: 0};
        const invKey = VL_INV_KEYS[step.inversion] || 'root';
        const invLbl = VL_INV_LABELS[step.inversion] || INV[step.inversion] || 'Voicing';
        const avgPrev =
          prevNotes && prevNotes.length
            ? prevNotes.reduce((a, b) => a + b, 0) / prevNotes.length
            : null;
        const avgCur =
          step.notes.reduce((a, b) => a + b, 0) / (step.notes.length || 1);
        const outDir: VLDirection =
          avgPrev != null
            ? avgCur >= avgPrev
              ? 'up'
              : 'down'
            : direction === 'down'
              ? 'down'
              : 'up';

        const prevInv =
          prevNotes && prevNotes.length === useInts.length ? undefined : undefined;
        void prevInv;

        const outShim: VLStepOutput = {
          notes: step.notes,
          fingers: fing.primary,
          inversion: invKey,
          inversionLabel: invLbl,
          anchorIdx,
          window: {
            anchorIdx,
            winLoIdx: anchorIdx,
            winHiIdx: anchorIdx + Math.max(0, step.notes.length - 1),
          },
          handShift,
          shapeChange: false,
          direction: outDir,
          dirFlipped: false,
          adjusted: false,
          omittedFifth,
          commonTonesKept: mv.heldCount,
          notRootPosition:
            (!prevNotes || !prevNotes.length) && step.inversion !== 0,
        };
        return {step, fing, tokens, mv, outShim};
      };

      if (cl === 'bass') {
        const lhBounds = clampRange(Math.max(S.lo, 36), Math.min(S.hi, 67));
        const lhRes = solveUnlockedHand(
          'L',
          lhBounds,
          prevLh,
          prevLhF,
          prevAnchorLh,
          fixedInv,
        );
        return {
          notes: lhRes.step.notes,
          hd: lhRes.step.notes.map(() => 'L'),
          lhLen: lhRes.step.notes.length,
          rhLen: 0,
          lhInv: lhRes.step.inversion,
          rhInv: lhRes.step.inversion,
          rhOut: null,
          lhOut: lhRes.outShim,
          lhFingering: lhRes.fing,
          rhFingering: null,
          vlF: lhRes.tokens,
          rhF: [],
          lhF: lhRes.fing.primary,
          vlInfo: {
            direction: lhRes.outShim.direction,
            inversion: lhRes.outShim.inversion,
            inversionLabel: lhRes.outShim.inversionLabel,
            handShift: lhRes.outShim.handShift,
            shapeChange: false,
            dirFlipped: false,
            adjusted: false,
            omittedFifth,
            commonTonesKept: lhRes.mv.heldCount,
            cost: lhRes.step.cost,
            moveSummary: lhRes.mv.summary,
            rotated: lhRes.step.rotated || false,
            notRootPosition: lhRes.outShim.notRootPosition,
          },
        };
      }

      const rhLoBound =
        cl === 'grand' ? (bh === 'bass' ? 48 : 53) : DEFAULT_VL_RANGE[0];
      const rhBounds = clampRange(rhLoBound, DEFAULT_VL_RANGE[1]);
      const rhRes = solveUnlockedHand(
        'R',
        rhBounds,
        prevRh,
        prevRhF,
        prevAnchorRh,
        fixedInv,
      );

      if (cl !== 'grand') {
        return {
          notes: rhRes.step.notes,
          hd: rhRes.step.notes.map(() => 'R'),
          lhLen: 0,
          rhLen: rhRes.step.notes.length,
          lhInv: rhRes.step.inversion,
          rhInv: rhRes.step.inversion,
          rhOut: rhRes.outShim,
          lhOut: null,
          rhFingering: rhRes.fing,
          lhFingering: null,
          vlF: rhRes.tokens,
          rhF: rhRes.fing.primary,
          lhF: [],
          vlInfo: {
            direction: rhRes.outShim.direction,
            inversion: rhRes.outShim.inversion,
            inversionLabel: rhRes.outShim.inversionLabel,
            handShift: rhRes.outShim.handShift,
            shapeChange: false,
            dirFlipped: false,
            adjusted: false,
            omittedFifth,
            commonTonesKept: rhRes.mv.heldCount,
            cost: rhRes.step.cost,
            moveSummary: rhRes.mv.summary,
            rotated: rhRes.step.rotated || false,
            notRootPosition: rhRes.outShim.notRootPosition,
          },
        };
      }

      if (bh === 'same' || bh === 'diff') {
        const lhMaxHi = Math.min(S.hi, Math.max(S.lo + 12, rhRes.step.notes[0] - 1));
        const lhBounds = clampRange(36, lhMaxHi);
        const lhFixed = bh === 'same' ? rhRes.step.inversion : fixedInv;
        const lhRes = solveUnlockedHand(
          'L',
          lhBounds,
          prevLh,
          prevLhF,
          prevAnchorLh,
          lhFixed,
        );
        return {
          notes: [...lhRes.step.notes, ...rhRes.step.notes],
          hd: [
            ...lhRes.step.notes.map(() => 'L'),
            ...rhRes.step.notes.map(() => 'R'),
          ],
          lhLen: lhRes.step.notes.length,
          rhLen: rhRes.step.notes.length,
          lhInv: lhRes.step.inversion,
          rhInv: rhRes.step.inversion,
          rhOut: rhRes.outShim,
          lhOut: lhRes.outShim,
          rhFingering: rhRes.fing,
          lhFingering: lhRes.fing,
          vlF: [...lhRes.tokens, ...rhRes.tokens],
          rhF: rhRes.fing.primary,
          lhF: lhRes.fing.primary,
          vlInfo: {
            direction: rhRes.outShim.direction,
            inversion: rhRes.outShim.inversion,
            inversionLabel: rhRes.outShim.inversionLabel,
            handShift: rhRes.outShim.handShift,
            shapeChange: false,
            dirFlipped: false,
            adjusted: false,
            omittedFifth,
            commonTonesKept: rhRes.mv.heldCount,
            cost: rhRes.step.cost,
            moveSummary: rhRes.mv.summary,
            rotated: rhRes.step.rotated || false,
            notRootPosition:
              rhRes.outShim.notRootPosition || lhRes.outShim.notRootPosition,
          },
        };
      }

      // Grand clef, Bass + chord: LH plays closest bass root below RH
      const bassPc = forceBass ?? pc;
      const bassLo = Math.max(S.lo, 24);
      const bassHi = Math.min(S.hi, rhRes.step.notes[0] - 1);
      const bassCands: number[] = [];
      for (let o = 0; o <= 7; o++) {
        const m = 12 * (o + 1) + bassPc;
        if (m >= bassLo && m <= bassHi) bassCands.push(m);
      }
      let bassMidi: number;
      if (bassCands.length) {
        const targetBass = prevLh?.length ? prevLh[0] : 42;
        bassCands.sort((a, b) => Math.abs(a - targetBass) - Math.abs(b - targetBass));
        bassMidi = bassCands[0];
      } else {
        bassMidi = Math.max(S.lo, put([0], bassPc, 0, [Math.max(S.lo, 24), 59])[0]);
      }
      const prevBassState =
        prevLh?.length === 1
          ? {
              ns: prevLh,
              f: prevLhF?.length === 1 ? prevLhF : [5],
            }
          : null;
      const bassF = bassNoteF(bassMidi, 'L', prevBassState);
      return {
        notes: [bassMidi, ...rhRes.step.notes],
        hd: ['L', ...rhRes.step.notes.map(() => 'R')],
        lhLen: 1,
        rhLen: rhRes.step.notes.length,
        lhInv: 0,
        rhInv: rhRes.step.inversion,
        rhOut: rhRes.outShim,
        lhOut: null,
        rhFingering: rhRes.fing,
        lhFingering: {
          hand: 'L',
          perNote: [{midi: bassMidi, fingers: [bassF]}],
          notes: [bassMidi],
          primary: [bassF],
          score: 0,
        },
        vlF: [bassF, ...rhRes.tokens],
        rhF: rhRes.fing.primary,
        lhF: [bassF],
        vlInfo: {
          direction: rhRes.outShim.direction,
          inversion: rhRes.outShim.inversion,
          inversionLabel: rhRes.outShim.inversionLabel,
          handShift: rhRes.outShim.handShift,
          shapeChange: false,
          dirFlipped: false,
          adjusted: false,
          omittedFifth,
          commonTonesKept: rhRes.mv.heldCount,
          cost: rhRes.step.cost,
          moveSummary: rhRes.mv.summary,
          rotated: rhRes.step.rotated || false,
          notRootPosition: rhRes.outShim.notRootPosition,
        },
      };
    }

    const prevRhNums = prevRhF ? prevRhF.map(x => Number(String(x).split('/')[0]) || 1) : null;
    const prevLhNums = prevLhF ? prevLhF.map(x => Number(String(x).split('/')[0]) || 1) : null;

    if (cl === 'bass') {
      const lhOut = computeNextVoiceLedChord({
        ints,
        pc,
        hand: 'L',
        scaleRoot: scRoot,
        scaleIntervals: scInts,
        bounds: vlBoundsForHand('L', cl, bh),
        rangeMode,
        direction,
        seventhMode,
        prevNotes: prevLh || null,
        prevFingers: prevLhNums,
        prevAnchorIdx: prevAnchorLh ?? null,
        prevDirection: prevDirLh ?? null,
        drop2Base,
        fixedInv,
        isSlash,
        slashName,
        preferredMid: 52,
        noteToScaleIdx: toScaleIdx,
      });
      const invNum = INV_KEY_TO_NUM[lhOut.inversion] ?? 0;
      return {
        notes: lhOut.notes,
        hd: lhOut.notes.map(() => 'L'),
        lhLen: lhOut.notes.length,
        rhLen: 0,
        lhInv: invNum,
        rhInv: invNum,
        rhOut: null,
        lhOut,
        vlF: lhOut.fingers,
        rhF: [],
        lhF: lhOut.fingers,
        vlInfo: {
          direction: lhOut.direction,
          inversion: lhOut.inversion,
          inversionLabel: lhOut.inversionLabel,
          handShift: lhOut.handShift,
          shapeChange: lhOut.shapeChange,
          dirFlipped: lhOut.dirFlipped,
          adjusted: lhOut.adjusted,
          omittedFifth: lhOut.omittedFifth,
          commonTonesKept: lhOut.commonTonesKept,
          notRootPosition: lhOut.notRootPosition,
          warning: lhOut.warning,
        },
      };
    }

    const rhOut = computeNextVoiceLedChord({
      ints,
      pc,
      hand: 'R',
      scaleRoot: scRoot,
      scaleIntervals: scInts,
      bounds: vlBoundsForHand('R', cl, bh),
      rangeMode,
      direction,
      seventhMode,
      prevNotes: prevRh || null,
      prevFingers: prevRhNums,
      prevAnchorIdx: prevAnchorRh ?? null,
      prevDirection: prevDirRh ?? null,
      drop2Base,
      fixedInv,
      isSlash,
      slashName,
      preferredMid: 67,
      noteToScaleIdx: toScaleIdx,
    });
    const rhInv = INV_KEY_TO_NUM[rhOut.inversion] ?? 0;

    if (cl !== 'grand') {
      return {
        notes: rhOut.notes,
        hd: rhOut.notes.map(() => 'R'),
        lhLen: 0,
        rhLen: rhOut.notes.length,
        lhInv: rhInv,
        rhInv,
        rhOut,
        lhOut: null,
        vlF: rhOut.fingers,
        rhF: rhOut.fingers,
        lhF: [],
        vlInfo: {
          direction: rhOut.direction,
          inversion: rhOut.inversion,
          inversionLabel: rhOut.inversionLabel,
          handShift: rhOut.handShift,
          shapeChange: rhOut.shapeChange,
          dirFlipped: rhOut.dirFlipped,
          adjusted: rhOut.adjusted,
          omittedFifth: rhOut.omittedFifth,
          commonTonesKept: rhOut.commonTonesKept,
          notRootPosition: rhOut.notRootPosition,
          warning: rhOut.warning,
        },
      };
    }

    if (bh === 'same' || bh === 'diff') {
      const lhMaxHi = Math.min(S.hi, Math.max(S.lo + 12, rhOut.notes[0] - 1));
      const lhOut = computeNextVoiceLedChord({
        ints,
        pc,
        hand: 'L',
        scaleRoot: scRoot,
        scaleIntervals: scInts,
        bounds: [S.lo, lhMaxHi],
        rangeMode,
        direction,
        seventhMode,
        prevNotes: prevLh || null,
        prevFingers: prevLhNums,
        prevAnchorIdx: prevAnchorLh ?? null,
        prevDirection: prevDirLh ?? null,
        drop2Base,
        fixedInv: bh === 'same' ? rhInv : fixedInv,
        isSlash,
        slashName,
        preferredMid: 50,
        noteToScaleIdx: toScaleIdx,
      });
      const lhInv = INV_KEY_TO_NUM[lhOut.inversion] ?? 0;
      return {
        notes: [...lhOut.notes, ...rhOut.notes],
        hd: [...lhOut.notes.map(() => 'L'), ...rhOut.notes.map(() => 'R')],
        lhLen: lhOut.notes.length,
        rhLen: rhOut.notes.length,
        lhInv,
        rhInv,
        rhOut,
        lhOut,
        vlF: [...lhOut.fingers, ...rhOut.fingers],
        rhF: rhOut.fingers,
        lhF: lhOut.fingers,
        vlInfo: {
          direction: rhOut.direction,
          inversion: rhOut.inversion,
          inversionLabel: rhOut.inversionLabel,
          handShift: rhOut.handShift,
          shapeChange: rhOut.shapeChange,
          dirFlipped: rhOut.dirFlipped,
          adjusted: rhOut.adjusted || lhOut.adjusted,
          omittedFifth: rhOut.omittedFifth || lhOut.omittedFifth,
          commonTonesKept: rhOut.commonTonesKept,
          notRootPosition: rhOut.notRootPosition || lhOut.notRootPosition,
          warning: rhOut.warning || lhOut.warning,
        },
      };
    }

    // Grand clef, Bass + chord: LH plays closest bass root below RH
    const bassPc = forceBass ?? pc;
    const bassLo = Math.max(S.lo, 24);
    const bassHi = Math.min(S.hi, rhOut.notes[0] - 1);
    const bassCands: number[] = [];
    for (let o = 0; o <= 7; o++) {
      const m = 12 * (o + 1) + bassPc;
      if (m >= bassLo && m <= bassHi) bassCands.push(m);
    }
    let bassMidi: number;
    if (bassCands.length) {
      const targetBass = prevLh?.length ? prevLh[0] : 42;
      bassCands.sort((a, b) => Math.abs(a - targetBass) - Math.abs(b - targetBass));
      bassMidi = bassCands[0];
    } else {
      bassMidi = Math.max(S.lo, put([0], bassPc, 0, [Math.max(S.lo, 24), 59])[0]);
    }
    const prevBassState =
      prevLh?.length === 1
        ? {
            ns: prevLh,
            f: prevLhF?.length === 1 ? prevLhF : [5],
          }
        : null;
    const bassF = bassNoteF(bassMidi, 'L', prevBassState);
    return {
      notes: [bassMidi, ...rhOut.notes],
      hd: ['L', ...rhOut.notes.map(() => 'R')],
      lhLen: 1,
      rhLen: rhOut.notes.length,
      lhInv: 0,
      rhInv,
      rhOut,
      lhOut: null,
      vlF: [bassF, ...rhOut.fingers],
      rhF: rhOut.fingers,
      lhF: [bassF],
      vlInfo: {
        direction: rhOut.direction,
        inversion: rhOut.inversion,
        inversionLabel: rhOut.inversionLabel,
        handShift: rhOut.handShift,
        shapeChange: rhOut.shapeChange,
        dirFlipped: rhOut.dirFlipped,
        adjusted: rhOut.adjusted,
        omittedFifth: rhOut.omittedFifth,
        commonTonesKept: rhOut.commonTonesKept,
        notRootPosition: rhOut.notRootPosition,
        warning: rhOut.warning,
      },
    };
  }

  // Picks octave/inversion closest to previous chord notes for close-range voice leading
  function putVoiceLed(
    ints: number[],
    pc: number,
    prevNotes: number[] | null,
    fixedInv?: number,
    zone: [number, number] = [57, 81],
    maxInvLimit?: number,
    homeAvg?: number | null,
    drop2Base?: number[],
    lockCorridor?: [number, number] | null,
  ): {notes: number[]; inv: number} {
    const cap = maxInvLimit != null ? maxInvLimit : +$('inv').value;
    const invs =
      fixedInv != null
        ? [Math.min(fixedInv, ints.length - 1)]
        : R(0, Math.min(cap, ints.length - 1));
    const [zLo, zHi] = zone;
    let loBound = Math.max(S.lo, zLo);
    let hiBound = Math.min(S.hi, zHi);
    if (loBound > hiBound) {
      loBound = S.lo;
      hiBound = S.hi;
    }
    const midTarget = homeAvg != null ? homeAvg : (loBound + hiBound) / 2;

    if (!prevNotes || !prevNotes.length) {
      const inv = invs[0];
      const cands: number[][] = [];
      for (let o = 0; o <= 8; o++) {
        const a = makeVoicingMidi(ints, pc, inv, o, drop2Base);
        if (a[0] >= loBound && a.at(-1)! <= hiBound) cands.push(a);
      }
      if (cands.length) {
        cands.sort((a, b) => {
          const avgA = a.reduce((s, n) => s + n, 0) / a.length;
          const avgB = b.reduce((s, n) => s + n, 0) / b.length;
          return Math.abs(avgA - midTarget) - Math.abs(avgB - midTarget);
        });
        return {notes: cands[0], inv};
      }
      return {
        notes: put(ints, pc, inv, [loBound, hiBound], drop2Base),
        inv,
      };
    }

    const prevSorted = [...prevNotes].sort((a, b) => a - b);
    const prevAvg = prevSorted.reduce((s, n) => s + n, 0) / prevSorted.length;
    const searchLo = lockCorridor
      ? Math.max(S.lo, lockCorridor[0])
      : Math.max(S.lo, Math.min(loBound, prevSorted[0] - 12));
    const searchHi = lockCorridor
      ? Math.min(S.hi, lockCorridor[1])
      : Math.min(S.hi, Math.max(hiBound, prevSorted[prevSorted.length - 1] + 12));

    const scoreCand = (a: number[]) => {
      const avg = a.reduce((s, n) => s + n, 0) / a.length;
      let dist = Math.abs(avg - prevAvg) * 0.12;
      if (homeAvg != null && S.rangeLocked) dist += Math.abs(avg - homeAvg) * 0.08;
      if (a.length === prevSorted.length) {
        for (let i = 0; i < a.length; i++) {
          dist += Math.abs(a[i] - prevSorted[i]);
        }
      } else {
        for (const n of a) {
          let minD = 99;
          for (const p of prevSorted) minD = Math.min(minD, Math.abs(n - p));
          dist += minD;
        }
      }
      return dist;
    };

    let best: {notes: number[]; inv: number; cost: number} | null = null;
    for (const inv of invs) {
      for (let o = -1; o <= 8; o++) {
        const a = makeVoicingMidi(ints, pc, inv, o, drop2Base);
        if (a[0] < searchLo || a.at(-1)! > searchHi) continue;
        // Respect caller's upper hand ceiling when LH must stay below RH
        if (
          !lockCorridor &&
          zone[1] < 80 &&
          a.at(-1)! > hiBound &&
          prevSorted[prevSorted.length - 1] <= hiBound
        )
          continue;
        if (!lockCorridor && a.at(-1)! > zHi && zHi < 70) continue;
        const dist = scoreCand(a);
        if (!best || dist < best.cost) best = {notes: a, inv, cost: dist};
      }
    }

    // Fallback when a wide chord (11th/13th/open) physically exceeds the tight window
    if (!best) {
      for (const inv of invs) {
        for (let o = -1; o <= 8; o++) {
          const a = makeVoicingMidi(ints, pc, inv, o, drop2Base);
          if (a[0] < S.lo || a.at(-1)! > S.hi) continue;
          if (zHi < 70 && a.at(-1)! > zHi) continue;
          const dist = scoreCand(a);
          if (!best || dist < best.cost) best = {notes: a, inv, cost: dist};
        }
      }
    }

    if (best) return {notes: best.notes, inv: best.inv};
    const fallbackInv = invs[0];
    return {
      notes: put(ints, pc, fallbackInv, [loBound, hiBound], drop2Base),
      inv: fallbackInv,
    };
  }

  interface VoicedChord {
    notes: number[];
    hd: string[];
    lhLen: number;
    rhLen: number;
    lhInv: number;
    rhInv: number;
  }

  const curBh = () => {
    const c = S.cl || $('clef').value;
    const g = $('game').value;
    if (c != 'grand' || g == 'slash' || g == 'harm_guide') return 'bass';
    return $('bhmode').value || 'bass';
  };

  function voice(
    ints: number[],
    pc: number,
    inv: number,
    lhInvOverride?: number,
    forceBass?: number,
    prevRh?: number[] | null,
    smooth?: boolean,
    prevLh?: number[] | null,
    allowAllInv?: boolean,
    homeRhAvg?: number | null,
    homeLhAvg?: number | null,
    maxInvOverride?: number,
    drop2Base?: number[],
    lockRhZone?: [number, number] | null,
    lockLhZone?: [number, number] | null,
    rhShiftCenterOffset = 0,
  ): VoicedChord {
    const c = $('clef').value;
    const maxRhInv =
      maxInvOverride != null
        ? Math.min(maxInvOverride, ints.length - 1)
        : allowAllInv || smooth
          ? ints.length - 1
          : undefined;
    const maxLhInv =
      maxInvOverride != null
        ? Math.min(maxInvOverride, ints.length - 1)
        : allowAllInv || smooth
          ? ints.length - 1
          : Math.min(+$('lhinv').value, ints.length - 1);

    if (c == 'bass') {
      const bZone: [number, number] =
        lockLhZone
          ? lockLhZone
          : smooth && prevLh && prevLh.length
            ? [
                Math.max(S.lo, prevLh[0] - 12 + rhShiftCenterOffset),
                Math.min(S.hi, prevLh[prevLh.length - 1] + 12 + rhShiftCenterOffset),
              ]
            : [36, 59];
      const lhObj = smooth
        ? putVoiceLed(
            ints,
            pc,
            prevLh || null,
            undefined,
            bZone,
            maxRhInv,
            homeLhAvg,
            drop2Base,
            lockLhZone,
          )
        : {notes: put(ints, pc, inv, [28, 64], drop2Base), inv};
      return {
        notes: lhObj.notes,
        hd: lhObj.notes.map(() => 'L'),
        lhLen: lhObj.notes.length,
        rhLen: 0,
        lhInv: lhObj.inv,
        rhInv: lhObj.inv,
      };
    }
    if (c == 'treble') {
      const rZone: [number, number] =
        lockRhZone
          ? lockRhZone
          : smooth && prevRh && prevRh.length
            ? [
                Math.max(S.lo, prevRh[0] - 12 + rhShiftCenterOffset),
                Math.min(S.hi, prevRh[prevRh.length - 1] + 12 + rhShiftCenterOffset),
              ]
            : [57, 81];
      const rhObj = smooth
        ? putVoiceLed(
            ints,
            pc,
            prevRh || null,
            undefined,
            rZone,
            maxRhInv,
            homeRhAvg,
            drop2Base,
            lockRhZone,
          )
        : {notes: put(ints, pc, inv, [57, 96], drop2Base), inv};
      return {
        notes: rhObj.notes,
        hd: rhObj.notes.map(() => 'R'),
        lhLen: 0,
        rhLen: rhObj.notes.length,
        lhInv: rhObj.inv,
        rhInv: rhObj.inv,
      };
    }

    // Grand staff (both hands)
    const bh = curBh();
    const rZone: [number, number] =
      lockRhZone
        ? lockRhZone
        : smooth && prevRh && prevRh.length
          ? [
              Math.max(S.lo, prevRh[0] - 12 + rhShiftCenterOffset),
              Math.min(S.hi, prevRh[prevRh.length - 1] + 12 + rhShiftCenterOffset),
            ]
          : [57, 81];
    const rhObj = smooth
      ? putVoiceLed(
          ints,
          pc,
          prevRh || null,
          undefined,
          rZone,
          maxRhInv,
          homeRhAvg,
          drop2Base,
          lockRhZone,
        )
      : {notes: put(ints, pc, inv, [58, 96], drop2Base), inv};
    const r = rhObj.notes;

    if (bh == 'same' || bh == 'diff') {
      const lMin = Math.max(S.lo, 28);
      const lMax = Math.max(lMin + 12, Math.min(62, r[0] - 1));
      const lZone: [number, number] =
        lockLhZone
          ? [Math.max(S.lo, lockLhZone[0]), Math.min(r[0] - 1, lockLhZone[1])]
          : smooth && prevLh && prevLh.length
            ? [
                Math.max(S.lo, prevLh[0] - 12),
                Math.min(
                  r[0] - 1,
                  Math.max(lMax, prevLh[prevLh.length - 1] + 12),
                ),
              ]
            : [Math.max(lMin, 36), Math.min(lMax, 59)];
      let l: number[];
      let lInv: number;

      if (smooth) {
        if (bh == 'diff') {
          const lhObj = putVoiceLed(
            ints,
            pc,
            prevLh || null,
            undefined,
            lZone,
            maxLhInv,
            homeLhAvg,
            drop2Base,
            lockLhZone ? lZone : null,
          );
          l = lhObj.notes;
          lInv = lhObj.inv;
        } else {
          const lhObj = putVoiceLed(
            ints,
            pc,
            prevLh || null,
            rhObj.inv,
            lZone,
            undefined,
            homeLhAvg,
            drop2Base,
            lockLhZone ? lZone : null,
          );
          l = lhObj.notes;
          lInv = rhObj.inv;
        }
      } else {
        lInv = bh == 'same' ? rhObj.inv : lhInvOverride ?? inv;
        l = put(ints, pc, lInv, [lMin, lMax], drop2Base);
      }

      const all = [...l, ...r];
      return {
        notes: all,
        hd: [...l.map(() => 'L'), ...r.map(() => 'R')],
        lhLen: l.length,
        rhLen: r.length,
        lhInv: lInv,
        rhInv: rhObj.inv,
      };
    }

    const bassPc = forceBass ?? pc;
    let bass: number[];
    if (smooth && prevLh && prevLh.length) {
      const bassZoneLo = Math.max(S.lo, 24);
      const bassZoneHi = Math.min(S.hi, r[0] - 1);
      const cands: number[] = [];
      for (let o = 0; o <= 7; o++) {
        const m = 12 * (o + 1) + bassPc;
        if (m >= bassZoneLo && m <= bassZoneHi) cands.push(m);
      }
      if (cands.length) {
        const target = prevLh[0];
        cands.sort((a, b) => {
          const dA = Math.abs(a - target) + (homeLhAvg != null && S.rangeLocked ? Math.abs(a - homeLhAvg) * 0.08 : 0);
          const dB = Math.abs(b - target) + (homeLhAvg != null && S.rangeLocked ? Math.abs(b - homeLhAvg) * 0.08 : 0);
          return dA - dB;
        });
        bass = [cands[0]];
      } else {
        bass = put([0], bassPc, 0, [36, Math.min(59, r[0] - 1)]);
      }
    } else {
      bass = put([0], bassPc, 0, smooth ? [36, Math.min(59, r[0] - 1)] : [28, Math.min(64, r[0] - 1)]);
    }
    return {
      notes: [...bass, ...r],
      hd: [...bass.map(() => 'L'), ...r.map(() => 'R')],
      lhLen: bass.length,
      rhLen: r.length,
      lhInv: 0,
      rhInv: rhObj.inv,
    };
  }

  /* =====================================================================
     8. CHORD LIBRARY
     ===================================================================== */
  const Q: [string | ((p: number) => string), number[], number][] = [
    ['', [0, 4, 7], 3],
    ['m', [0, 3, 7], 3],
    ['dim', [0, 3, 6], 3],
    ['aug', [0, 4, 8], 3],
    ['(♭5)', [0, 4, 6], 3],
    ['m(♯5)', [0, 3, 8], 3],
    ['sus2', [0, 2, 7], 3],
    ['sus4', [0, 5, 7], 3],
    ['5', [0, 7], 3],
    ['6', [0, 4, 7, 9], 3],
    ['m6', [0, 3, 7, 9], 3],
    ['add9', [0, 4, 7, 14], 3],
    ['madd9', [0, 3, 7, 14], 3],
    [' quartal', [0, 5, 10], 3],
    [' quintal', [0, 7, 14], 3],

    ['maj7', [0, 4, 7, 11], 4],
    ['7', [0, 4, 7, 10], 4],
    ['m7', [0, 3, 7, 10], 4],
    ['m7♭5', [0, 3, 6, 10], 4],
    ['dim7', [0, 3, 6, 9], 4],
    ['mMaj7', [0, 3, 7, 11], 4],
    ['maj7♯5', [0, 4, 8, 11], 4],
    ['maj7♭5', [0, 4, 6, 11], 4],
    ['7sus4', [0, 5, 7, 10], 4],
    ['7♭5', [0, 4, 6, 10], 4],
    ['7♯5', [0, 4, 8, 10], 4],
    ['m7♯5', [0, 3, 8, 10], 4],
    ['dimMaj7', [0, 3, 6, 11], 4],
    ['mMaj7♯5', [0, 3, 8, 11], 4],
    [' quartal (4 notes)', [0, 5, 10, 15], 4],

    ['maj9', [0, 4, 7, 11, 14], 5],
    ['9', [0, 4, 7, 10, 14], 5],
    ['m9', [0, 3, 7, 10, 14], 5],
    ['mMaj9', [0, 3, 7, 11, 14], 5],
    ['6/9', [0, 4, 7, 9, 14], 5],
    ['9sus4', [0, 5, 7, 10, 14], 5],
    ['7♭9', [0, 4, 7, 10, 13], 5],
    ['7♯9', [0, 4, 7, 10, 15], 5],
    ['7♯11', [0, 4, 7, 10, 18], 5],
    ['7♭13', [0, 4, 7, 10, 20], 5],
    ['7♯5♯9', [0, 4, 8, 10, 15], 5],
    ['7♭5♭9', [0, 4, 6, 10, 13], 5],
    ['7♭5♯9', [0, 4, 6, 10, 15], 5],
    ['7♯5♭9', [0, 4, 8, 10, 13], 5],
    ['9♭5', [0, 4, 6, 10, 14], 5],
    ['9♯5', [0, 4, 8, 10, 14], 5],
    ['m9♭5', [0, 3, 6, 10, 14], 5],
    ['maj9♯5', [0, 4, 8, 11, 14], 5],

    ['m11', [0, 3, 7, 10, 14, 17], 6],
    ['maj9♯11', [0, 4, 7, 11, 14, 18], 6],
    ['9♯11', [0, 4, 7, 10, 14, 18], 6],
    ['7♭9♭13', [0, 4, 7, 10, 13, 20], 6],
    ['7♯9♭13', [0, 4, 7, 10, 15, 20], 6],
    ['11♭9', [0, 4, 7, 10, 13, 17], 6],
    [p => pn((p + 8) % 12) + '/' + pn(p) + '7', [0, 4, 10, 15, 20], 6],

    ['13', [0, 4, 7, 10, 14, 21], 7],
    ['m13', [0, 3, 7, 10, 14, 17, 21], 7],
    ['maj13♯11', [0, 4, 7, 11, 14, 18, 21], 7],
    ['13sus4', [0, 5, 7, 10, 14, 21], 7],
    ['13♭9', [0, 4, 7, 10, 13, 21], 7],
    ['13♯9', [0, 4, 7, 10, 15, 21], 7],
    ['13♯11', [0, 4, 7, 10, 14, 18, 21], 7],
    ['13♭5', [0, 4, 6, 10, 14, 21], 7],
    [p => pn((p + 2) % 12) + '/' + pn(p) + '7', [0, 4, 10, 14, 18, 21], 7],
  ];

  function chordSizesForFocus(f: string, g: string): number[] {
    if (f == 't3') return [3];
    if (f == 't4only') return [4];
    if (f == 't4') return [3, 4];
    if (f == 't5') return [3, 4, 5];
    if (f == 't6') return [3, 4, 5, 6];
    if (f == 't7') return [3, 4, 5, 6, 7];
    if (g == 'slash') return [3, 4];
    if (f == 'v_rootless') return [5];
    if (/^v_/.test(f)) return [4];
    return [3, 4, 5, 6, 7];
  }

  function applyVoicing(
    F: string,
    ints: number[],
    sc: number[],
    d: number | null,
    rootlessType: 'A' | 'B' = 'A',
  ): number[] | null {
    if (!/^v_/.test(F) || F == 'v_ust') return null;
    if (F == 'v_shell') return [ints[0], ints[1], ints[3]];
    if (F == 'v_open') return [0, ints[2], ints[3], ints[1] + 12];
    if (F == 'v_rootless') {
      if (rootlessType == 'B') {
        // 7 - 9 - 3 - 5 ascending
        return [ints[3], ints[4], ints[1] + 12, ints[2] + 12];
      }
      // Type A: 3 - 5 - 7 - 9
      return ints.slice(1, 5);
    }
    if (F == 'v_cluster') {
      const s = (i: number) => sc[i % 7] + 12 * Math.floor(i / 7);
      const sec = d != null ? s(d + 1) - s(d) : 2;
      return [0, sec, ints[1], ints[2]];
    }
    if (F == 'v_drop2') return [ints[2] - 12, 0, ints[1], ints[3]];
    if (F == 'v_quartal' && d != null) {
      const s = (i: number) => sc[i % 7] + 12 * Math.floor(i / 7);
      return [0, 3, 6, 9].map(j => s(d + j) - s(d));
    }
    return null;
  }

  function diatonicSusOnDegree(
    cx: any,
    sc: number[],
    d: number,
    bo: number,
  ): any[] {
    const s = (i: number) => sc[i % 7] + 12 * Math.floor(i / 7);
    const i2 = s(d + 1) - s(d);
    const i3 = s(d + 2) - s(d);
    const i4 = s(d + 3) - s(d);
    const i5 = s(d + 4) - s(d);
    const i6 = s(d + 5) - s(d);
    const i7 = s(d + 6) - s(d);
    const i9 = s(d + 8) - s(d);
    const pc = (cx.r + sc[d]) % 12;
    const rootName = bo ? LN[cx.sp[pc].l] + ACC[cx.sp[pc].a] : cx.names[d];
    const list: any[] = [];

    const push = (ints: number[], sfOverride?: string) => {
      const sf = sfOverride ?? suf(ints);
      if (sf.includes('?')) return;
      list.push({
        ints,
        base: ints,
        pc,
        sf,
        d,
        bo,
        v: '',
        name: rootName + sf,
        lab: sf || 'major',
      });
    };

    if (i2 == 2 && (i5 == 7 || i5 == 6 || i5 == 8)) push([0, i2, i5]);
    if (i4 == 5 && (i5 == 7 || i5 == 6 || i5 == 8)) push([0, i4, i5]);
    if (i4 == 5 && i5 == 7 && i7 >= 9 && i7 <= 11) push([0, i4, i5, i7]);
    if ((i3 == 3 || i3 == 4) && i5 == 7 && i6 == 9) push([0, i3, i5, i6]);
    if ((i3 == 3 || i3 == 4) && i5 == 7 && i9 == 14)
      push([0, i3, i5, i9], i3 == 3 ? 'madd9' : 'add9');

    return list;
  }

  function buildDiatonicChord(
    cx: any,
    f: string,
    sc: number[],
    d: number,
    sz: number,
    bo: number,
    inv: number,
    lhInv = 0,
    rootlessType: 'A' | 'B' = 'A',
  ) {
    const s = (i: number) => sc[i % 7] + 12 * Math.floor(i / 7);
    const ints = [0, 2, 4, 6, 8, 10, 12]
      .slice(0, sz)
      .map(j => s(d + j) - s(d));
    const pc = (cx.r + sc[d]) % 12;
    const rootName = bo ? LN[cx.sp[pc].l] + ACC[cx.sp[pc].a] : cx.names[d];

    if (f == 'v_quartal') {
      const V = applyVoicing(f, ints, sc, d)!;
      return {
        ints: V,
        base: V,
        pc,
        sf: ' quartal (4 notes)',
        d,
        bo,
        v: 'quartal',
        inv,
        lhInv,
        name: rootName + ' · quartal voicing',
        lab: 'quartal voicing',
      };
    }

    const V = applyVoicing(f, ints, sc, d, rootlessType);
    const sf = suf(ints);
    const vTag = f == 'v_rootless' ? `rootless ${rootlessType}` : f.slice(2);
    return {
      ints: V || ints,
      base: ints,
      pc,
      sf,
      d,
      bo,
      v: V ? vTag : '',
      inv,
      lhInv,
      name: rootName + sf + (V ? ' · ' + vTag + ' voicing' : ''),
      lab: V ? vTag + ' voicing' : bo ? 'borrowed' : sf || 'major',
    };
  }

  function invPairs(
    mxRh: number,
    mxLh: number,
    exinv: boolean,
  ): [number, number][] {
    const rhList = exinv ? [mxRh] : R(0, mxRh);
    const isDiff = curBh() == 'diff';
    if (!isDiff) return rhList.map(r => [r, r]);
    const lhList = exinv ? [mxLh] : R(0, mxLh);
    const pairs: [number, number][] = [];
    for (const r of rhList) {
      for (const l of lhList) pairs.push([r, l]);
    }
    return pairs;
  }

  function diatonicChordItems(
    cx: any,
    f: string,
    g: string,
    mi: number,
    lhi: number,
    exinv: boolean,
    smooth = false,
  ): any[] {
    const items: any[] = [];
    if (f == 'sus') {
      const degItems: any[][] = [];
      for (let d = 0; d < 7; d++) {
        degItems.push(diatonicSusOnDegree(cx, cx.sc, d, 0));
      }
      const pairs = smooth
        ? ([[0, 0]] as [number, number][])
        : invPairs(Math.min(mi, 3), Math.min(lhi, 3), exinv);
      for (const [rhI, lhI] of pairs) {
        for (let d = 0; d < 7; d++) {
          for (const ch of degItems[d]) {
            const maxI = ch.ints.length - 1;
            const rClamped = Math.min(rhI, maxI);
            const lClamped = Math.min(lhI, maxI);
            if (exinv || (rhI <= maxI && lhI <= maxI))
              items.push({...ch, inv: rClamped, lhInv: lClamped});
          }
        }
      }
      return items;
    }

    if (g == 'slash') {
      const sizes = chordSizesForFocus(f, g);
      for (const sz of sizes) {
        for (let bi = 1; bi < sz; bi++) {
          for (let d = 0; d < 7; d++) {
            const ch = buildDiatonicChord(cx, f, cx.sc, d, sz, 0, 0, 0);
            items.push({...ch, slashIdx: bi});
          }
        }
      }
      return items;
    }

    const sizes = chordSizesForFocus(f, g);
    for (const sz of sizes) {
      const vLen = f == 'v_shell' ? 3 : /^v_/.test(f) ? 4 : sz;
      const pairs = smooth
        ? ([[0, 0]] as [number, number][])
        : invPairs(
            Math.min(mi, vLen - 1),
            Math.min(lhi, vLen - 1),
            exinv,
          );
      const rTypes: ('A' | 'B')[] = f == 'v_rootless' ? ['A', 'B'] : ['A'];
      for (const rt of rTypes) {
        for (const [rhI, lhI] of pairs) {
          for (let d = 0; d < 7; d++) {
            items.push(
              buildDiatonicChord(cx, f, cx.sc, d, sz, 0, rhI, lhI, rt),
            );
          }
        }
      }
    }
    return items;
  }

  function chromaticChordList(f: string, g: string) {
    const st = +$('size').value;
    let L = Q.filter(x => x[2] <= st);

    if (f == 't3')
      L = Q.filter(
        x =>
          typeof x[0] == 'string' &&
          x[1].length <= 3 &&
          !/quartal|quintal/.test(x[0]),
      );
    else if (f == 't4only')
      L = Q.filter(
        x => typeof x[0] == 'string' && x[2] == 4 && !/quartal/.test(x[0]),
      );
    else if (f == 'sus')
      L = L.filter(x => typeof x[0] == 'string' && /sus|add|6/.test(x[0]));
    else if (f == 'alt')
      L = L.filter(
        x =>
          typeof x[0] == 'string' &&
          /(dim|aug|\(♭5\)|m\(♯5\)|[♭♯](5|9|11|13)|maj7[♭♯]5|m7[♭♯]5|mMaj7♯5|dimMaj7)/.test(
            x[0],
          ),
      );
    else if (f == 'v_ust') L = L.filter(x => typeof x[0] == 'function');
    else if (f == 'v_quartal')
      L = L.filter(
        x => typeof x[0] == 'string' && /quartal|quintal/.test(x[0]),
      );
    else if (f == 'v_rootless')
      L = Q.filter(
        x => typeof x[0] == 'string' && /^(maj9|9|m9|mMaj9)$/.test(x[0]),
      );
    else if (/^v_/.test(f))
      L = Q.filter(
        x =>
          typeof x[0] == 'string' && x[2] == 4 && !/quartal|sus/.test(x[0]),
      );
    else if (g == 'slash')
      L = Q.filter(
        x =>
          typeof x[0] == 'string' &&
          x[2] <= 5 &&
          !/quartal|quintal/.test(x[0]),
      );

    return L;
  }

  function chromaticChordItems(
    f: string,
    g: string,
    mi: number,
    lhi: number,
    exinv: boolean,
    smooth = false,
  ): {x: any; inv: number; lhInv: number; pc: number; rt: 'A' | 'B'}[] {
    const L = chromaticChordList(f, g);
    const items: {
      x: any;
      inv: number;
      lhInv: number;
      pc: number;
      rt: 'A' | 'B';
    }[] = [];
    const rTypes: ('A' | 'B')[] = f == 'v_rootless' ? ['A', 'B'] : ['A'];

    for (const x of L) {
      const vLen =
        f == 'v_shell'
          ? 3
          : /^v_/.test(f) && f != 'v_ust' && f != 'v_quartal'
            ? 4
            : x[1].length;
      const pairs =
        g == 'slash' || smooth
          ? ([[0, 0]] as [number, number][])
          : invPairs(Math.min(mi, vLen - 1), Math.min(lhi, vLen - 1), exinv);
      for (const rt of rTypes) {
        for (const [rhI, lhI] of pairs) {
          for (let k = 0; k < 12; k++) {
            items.push({x, inv: rhI, lhInv: lhI, pc: (k * 7) % 12, rt});
          }
        }
      }
    }
    return items;
  }

  function genChord(mi: number, lhi: number, exinv: boolean): any {
    const F = S.f || '';
    const g = $('game').value;
    const o = ORD();
    const isDiff = curBh() == 'diff';

    const smooth = g == 'chord' && $('vlead').checked;
    const startDeg = C.sc.length == 7 ? S.primDeg % 7 : 0;
    const isAnchorStart = smooth && S.n === 0 && !(S.prevRh?.length || S.prevLh?.length);
    const includeAlt = $('altchords')?.checked || F == 'alt';

    if ($('pool').value == 'all') {
      const L = chromaticChordList(F, g);
      let x: any, pc: number, inv: number, lhInv: number, rt: 'A' | 'B';

      if (o) {
        const items = chromaticChordItems(F, g, mi, lhi, exinv, smooth);
        const item = items[S.n % items.length];
        x = item.x;
        pc = isAnchorStart
          ? (C.r + (C.sc[startDeg] ?? 0)) % 12
          : item.pc;
        inv = isAnchorStart ? 0 : item.inv;
        lhInv = isAnchorStart ? 0 : item.lhInv;
        rt = item.rt;
      } else {
        x = L[rand(L.length)];
        pc = isAnchorStart
          ? (C.r + (C.sc[startDeg] ?? 0)) % 12
          : rand(12);
        const vLen =
          F == 'v_shell'
            ? 3
            : /^v_/.test(F) && F != 'v_ust' && F != 'v_quartal'
              ? 4
              : x[1].length;
        const mxRh = Math.min(mi, vLen - 1);
        const mxLh = Math.min(lhi, vLen - 1);
        inv = isAnchorStart ? 0 : exinv ? mxRh : rand(mxRh + 1);
        lhInv = isAnchorStart
          ? 0
          : isDiff
            ? exinv
              ? mxLh
              : rand(mxLh + 1)
            : inv;
        rt = F == 'v_rootless' && rand(2) ? 'B' : 'A';
      }

      const fn = typeof x[0] == 'function';
      if (!fn && /^v_/.test(F) && F != 'v_quartal') {
        const V = applyVoicing(F, x[1], C.sc, null, rt)!;
        const vTag = F == 'v_rootless' ? `rootless ${rt}` : F.slice(2);
        return {
          ints: V,
          base: x[1],
          pc,
          sf: x[0],
          v: vTag,
          inv,
          lhInv,
          name: pn(pc) + x[0] + ' · ' + vTag + ' voicing',
          lab: vTag + ' voicing',
        };
      }

      return {
        ints: x[1],
        pc,
        sf: fn ? null : x[0],
        inv,
        lhInv,
        name: fn ? (x[0] as (p: number) => string)(pc) : pn(pc) + x[0],
        lab: fn ? 'upper-structure' : (x[0] as string).trim() || 'major',
      };
    }

    if ($('bor').checked) {
      const ms = Object.keys(MODES)
        .slice(0, 7)
        .filter(m => m != C.m);
      const bMode = o
        ? ms[Math.floor(S.n / 7) % ms.length]
        : ms[rand(ms.length)];
      const sc = MODES[bMode];
      const d = isAnchorStart ? startDeg : o ? S.n % 7 : rand(7);
      const sz = o
        ? 3 + (Math.floor(S.n / (7 * ms.length)) % 2)
        : 3 + rand(2);
      const mxRh = Math.min(mi, sz - 1);
      const mxLh = Math.min(lhi, sz - 1);
      const inv = isAnchorStart
        ? 0
        : exinv
          ? mxRh
          : o
            ? Math.floor(S.n / (7 * ms.length * 2)) % (mxRh + 1)
            : rand(mxRh + 1);
      const lhInv = isAnchorStart
        ? 0
        : isDiff
          ? exinv
            ? mxLh
            : rand(mxLh + 1)
          : inv;
      return buildDiatonicChord(C, F, sc, d, sz, 1, inv, lhInv);
    }

    if (includeAlt && F != 'sus' && F != 'v_quartal' && F != 'v_ust' && g != 'slash') {
      if (isAnchorStart) {
        const sizes = chordSizesForFocus(F, g);
        const sz = sizes[0] || 3;
        return buildDiatonicChord(C, F, C.sc, startDeg, sz, 0, 0, 0, 'A');
      }
      const L = chromaticChordList(F, g);
      const degCount = C.sc.length;
      let x: any, d: number, inv: number, lhInv: number, rt: 'A' | 'B';
      if (o) {
        const items = L.flatMap(qItem =>
          R(0, degCount - 1).map(deg => ({qItem, deg})),
        );
        const pick = items[S.n % items.length];
        x = pick.qItem;
        d = pick.deg;
        inv = 0;
        lhInv = 0;
        rt = 'A';
      } else {
        x = L[rand(L.length)];
        d = rand(degCount);
        const vLen =
          F == 'v_shell'
            ? 3
            : /^v_/.test(F) && F != 'v_ust' && F != 'v_quartal'
              ? 4
              : x[1].length;
        const mxRh = Math.min(mi, vLen - 1);
        const mxLh = Math.min(lhi, vLen - 1);
        inv = smooth ? 0 : exinv ? mxRh : rand(mxRh + 1);
        lhInv = smooth ? 0 : isDiff ? (exinv ? mxLh : rand(mxLh + 1)) : inv;
        rt = F == 'v_rootless' && rand(2) ? 'B' : 'A';
      }
      const pc = (C.r + C.sc[d]) % 12;
      const fn = typeof x[0] == 'function';
      if (!fn && /^v_/.test(F) && F != 'v_quartal') {
        const V = applyVoicing(F, x[1], C.sc, d, rt)!;
        const vTag = F == 'v_rootless' ? `rootless ${rt}` : F.slice(2);
        return {
          ints: V,
          base: x[1],
          pc,
          sf: x[0],
          v: vTag,
          inv,
          lhInv,
          name: pn(pc) + x[0] + ' · ' + vTag + ' voicing',
          lab: vTag + ' voicing',
        };
      }
      return {
        ints: x[1],
        pc,
        sf: fn ? null : x[0],
        inv,
        lhInv,
        name: fn ? (x[0] as (p: number) => string)(pc) : pn(pc) + x[0],
        lab: fn ? 'upper-structure' : (x[0] as string).trim() || 'major',
      };
    }

    if (o) {
      const items = diatonicChordItems(C, F, g, mi, lhi, exinv, smooth);
      if (isAnchorStart) {
        const matchPrim = items.find(
          it => it.d === startDeg && (!it.inv || it.inv === 0),
        );
        if (matchPrim) return matchPrim;
      }
      return items[S.n % items.length];
    }

    if (F == 'sus') {
      const pool: any[] = [];
      for (let d = 0; d < 7; d++)
        pool.push(...diatonicSusOnDegree(C, C.sc, d, 0));
      const ch = isAnchorStart
        ? pool.find(p => p.d === startDeg) || pool[0]
        : pool[rand(pool.length)];
      const mxRh = Math.min(mi, ch.ints.length - 1);
      const mxLh = Math.min(lhi, ch.ints.length - 1);
      const inv = isAnchorStart ? 0 : exinv ? mxRh : rand(mxRh + 1);
      const lhInv = isAnchorStart
        ? 0
        : isDiff
          ? exinv
            ? mxLh
            : rand(mxLh + 1)
          : inv;
      return {...ch, inv, lhInv};
    }

    const sizes = chordSizesForFocus(F, g);
    const sz = sizes[rand(sizes.length)];
    const d = isAnchorStart ? startDeg : rand(7);
    const vLen = F == 'v_shell' ? 3 : /^v_/.test(F) ? 4 : sz;
    const mxRh = Math.min(mi, vLen - 1);
    const mxLh = Math.min(lhi, vLen - 1);
    const inv = isAnchorStart ? 0 : exinv ? mxRh : rand(mxRh + 1);
    const lhInv = isAnchorStart
      ? 0
      : isDiff
        ? exinv
          ? mxLh
          : rand(mxLh + 1)
        : inv;
    const rt: 'A' | 'B' = F == 'v_rootless' && rand(2) ? 'B' : 'A';
    return buildDiatonicChord(C, F, C.sc, d, sz, 0, inv, lhInv, rt);
  }

  /* =====================================================================
     9. PROGRESSIONS (expanded with 12-bar blues & Appendix B progressions)
     ===================================================================== */
  // Tuple: [displayRoman, [[semitoneOffset, suffix, optionalSlashBassOffset]], level]
  type ProgChordSpec = [number, string, number?];
  const PR: [string, ProgChordSpec[], string][] = [
    ['I – IV – V – I', [[0, ''], [5, ''], [7, ''], [0, '']], 'basic'],
    ['I – vi – IV – V', [[0, ''], [9, 'm'], [5, ''], [7, '']], 'basic'],
    ['ii – V – I', [[2, 'm'], [7, ''], [0, '']], 'basic'],
    ['I – V – vi – IV', [[0, ''], [7, ''], [9, 'm'], [5, '']], 'basic'],
    ['vi – IV – I – V', [[9, 'm'], [5, ''], [0, ''], [7, '']], 'basic'],
    ['i – iv – V – i', [[0, 'm'], [5, 'm'], [7, ''], [0, 'm']], 'basic'],
    ['i – ♭VI – ♭III – ♭VII', [[0, 'm'], [8, ''], [3, ''], [10, '']], 'basic'],
    ['I – IVsus4 – I', [[0, ''], [5, 'sus4'], [0, '']], 'basic'],
    ['IV – iv – I', [[5, ''], [5, 'm'], [0, '']], 'basic'],
    [
      'I – V/3 – vi – I/5 – IV',
      [[0, ''], [7, '', 11], [9, 'm'], [0, '', 7], [5, '']],
      'basic',
    ],
    [
      '12-bar blues (I7 – IV7 – V7)',
      [
        [0, '7'],
        [0, '7'],
        [0, '7'],
        [0, '7'],
        [5, '7'],
        [5, '7'],
        [0, '7'],
        [0, '7'],
        [7, '7'],
        [5, '7'],
        [0, '7'],
        [7, '7'],
      ],
      'basic',
    ],

    ['iim7 – V13 – Imaj9', [[2, 'm7'], [7, '13'], [0, 'maj9']], 'adv'],
    [
      'Imaj7 – VI7 – iim7 – V7',
      [[0, 'maj7'], [9, '7'], [2, 'm7'], [7, '7']],
      'adv',
    ],
    [
      'iiim7 – VI7 – iim7 – V7 – Imaj7',
      [[4, 'm7'], [9, '7'], [2, 'm7'], [7, '7'], [0, 'maj7']],
      'adv',
    ],
    ['iim7 – ♭II7 – Imaj7', [[2, 'm7'], [1, '7'], [0, 'maj7']], 'adv'],
    [
      'Imaj7 – IVmaj7 – ivm6 – Imaj7',
      [[0, 'maj7'], [5, 'maj7'], [5, 'm6'], [0, 'maj7']],
      'adv',
    ],
    ['iiø7 – V7♭9 – im9', [[2, 'm7♭5'], [7, '7♭9'], [0, 'm9']], 'adv'],
    [
      'I – ♯Idim7 – iim7 – V7',
      [[0, 'maj7'], [1, 'dim7'], [2, 'm7'], [7, '7']],
      'adv',
    ],
    ['iim7 – V7♯5♯9 – Imaj7', [[2, 'm7'], [7, '7♯5♯9'], [0, 'maj7']], 'adv'],
    [
      'Imaj7 – ♭III7 – ♭VImaj7 – ♭VII7 – ♭IIImaj7',
      [[0, 'maj7'], [3, '7'], [8, 'maj7'], [11, '7'], [4, 'maj7']],
      'adv',
    ],
    ['im7 – IV7 (Dorian vamp)', [[0, 'm7'], [5, '7'], [0, 'm7'], [5, '7']], 'adv'],
    [
      'Imaj7 – IVmaj7 – iim7 – V7sus4',
      [[0, 'maj7'], [5, 'maj7'], [2, 'm7'], [7, '7sus4']],
      'adv',
    ],
    [
      'Jazz 12-bar blues',
      [
        [0, '7'],
        [5, '7'],
        [0, '7'],
        [0, '7'],
        [5, '7'],
        [6, 'dim7'],
        [0, '7'],
        [9, '7'],
        [2, 'm7'],
        [7, '7'],
        [0, '7'],
        [7, '7'],
      ],
      'adv',
    ],

    ['I7 – IV7 – V7', [[0, '7'], [5, '7'], [7, '7']], 'pat'],
    ['i – iv – V', [[0, 'm'], [5, 'm'], [7, '']], 'pat'],

    ['V7 – I', [[7, '7'], [0, '']], 'cad:auth'],
    ['IV – V7 – I', [[5, ''], [7, '7'], [0, '']], 'cad:auth'],
    ['IV – I', [[5, ''], [0, '']], 'cad:plag'],
    ['I – IV – I', [[0, ''], [5, ''], [0, '']], 'cad:plag'],
    ['I – V', [[0, ''], [7, '']], 'cad:half'],
    ['ii – V', [[2, 'm'], [7, '']], 'cad:half'],
    ['IV – V', [[5, ''], [7, '']], 'cad:half'],
    ['V7 – vi', [[7, '7'], [9, 'm']], 'cad:dec'],
    ['I – V7 – vi', [[0, ''], [7, '7'], [9, 'm']], 'cad:dec'],
    ['iv – V', [[5, 'm'], [7, '']], 'cad:phry'],
    ['i – iv – V', [[0, 'm'], [5, 'm'], [7, '']], 'cad:phry'],
    ['i – V – I', [[0, 'm'], [7, ''], [0, '']], 'cad:pic'],

    ['iiø7 – V7♭9 – i', [[2, 'm7♭5'], [7, '7♭9'], [0, 'm']], 'h:mii'],
    ['iiø7 – V7♯5♯9 – im7', [[2, 'm7♭5'], [7, '7♯5♯9'], [0, 'm7']], 'h:mii'],
    ['i – i(maj7) – i7 – i6', [[0, 'm'], [0, 'mMaj7'], [0, 'm7'], [0, 'm6']], 'h:cli'],
    ['iv7 – ♭VII7 – Imaj7', [[5, 'm7'], [10, '7'], [0, 'maj7']], 'h:bd'],
    ['iim7 – ♭VII7 – Imaj7', [[2, 'm7'], [10, '7'], [0, 'maj7']], 'h:bd'],
  ];

  // Convert Roman numeral tokens into Nashville Number System (1, 2m, 4, 5/3, b7, etc.)
  const NNS_DEG: Record<string, string> = {
    '0': '1',
    '1': '♭2',
    '2': '2',
    '3': '♭3',
    '4': '3',
    '5': '4',
    '6': '♯4',
    '7': '5',
    '8': '♭6',
    '9': '6',
    '10': '♭7',
    '11': '7',
  };
  function toNashville(spec: ProgChordSpec): string {
    const [o, sf, bassO] = spec;
    const base = NNS_DEG[String(o)] || '1';
    let q = sf;
    if (q == 'dim7') q = '°7';
    const slash = bassO != null ? '/' + (NNS_DEG[String(bassO)] || '') : '';
    return base + q + slash;
  }

  /* =====================================================================
     10. SCALES, COMPOUND INTERVALS, HANON, SUBSTITUTIONS
     ===================================================================== */
  const SCALES: Record<string, number[]> = {
    'Major pentatonic': [0, 2, 4, 7, 9],
    'Minor pentatonic': [0, 3, 5, 7, 10],
    'Blues scale': [0, 3, 5, 6, 7, 10],
    'Major blues': [0, 2, 3, 4, 7, 9],
    'Whole-tone': [0, 2, 4, 6, 8, 10],
    'Diminished (half-whole)': [0, 1, 3, 4, 6, 7, 9, 10],
    'Diminished (whole-half)': [0, 2, 3, 5, 6, 8, 9, 11],
    Augmented: [0, 3, 4, 7, 8, 11],
    'Bebop dominant': [0, 2, 4, 5, 7, 9, 10, 11],
    'Bebop major': [0, 2, 4, 5, 7, 8, 9, 11],
    'Bebop Dorian': [0, 2, 3, 4, 5, 7, 9, 10],
    'Harmonic major': [0, 2, 4, 5, 7, 8, 11],
    'Double harmonic': [0, 1, 4, 5, 7, 8, 11],
    'Hungarian minor': [0, 2, 3, 6, 7, 8, 11],
    Hirajoshi: [0, 2, 3, 7, 8],
    Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };

  const EXT = [
    'Dorian ♭2',
    'Lydian augmented',
    'Mixolydian ♭6',
    'Locrian ♮2',
    'Locrian ♮6',
    'Ionian ♯5',
    'Dorian ♯4',
    'Lydian ♯2',
    'Super Locrian ♭♭7',
  ];

  const INTC: [string, number][] = [
    ['minor 9th', 13],
    ['major 9th', 14],
    ['minor 10th', 15],
    ['major 10th', 16],
    ['perfect 11th', 17],
    ['augmented 11th', 18],
    ['perfect 12th', 19],
    ['minor 13th', 20],
    ['major 13th', 21],
  ];

  const CT: Record<string, string> = {
    auth: 'Authentic',
    plag: 'Plagal',
    half: 'Half',
    dec: 'Deceptive',
    phry: 'Phrygian half',
    pic: 'Picardy third',
  };

  const TY: [string, number, number[], string, number?][] = [
    ['secondary dominant (V7 of the target)', 7, [0, 4, 7, 10], '7'],
    ['tritone substitute (♭II7 of the target)', 1, [0, 4, 7, 10], '7'],
    ['leading-tone diminished 7th (vii°7 of the target)', 11, [0, 3, 6, 9], 'dim7'],
    ['backdoor dominant (♭VII7 of the target)', 10, [0, 4, 7, 10], '7'],
    ['chromatic mediant (♭III major triad)', 3, [0, 4, 7], '', 1],
    ['chromatic mediant (♭VI major triad)', 8, [0, 4, 7], '', 1],
    ['chromatic mediant (III major triad)', 4, [0, 4, 7], '', 1],
    ['chromatic mediant (VI major triad)', 9, [0, 4, 7], '', 1],
    ['Neapolitan chord (♭II major triad)', 1, [0, 4, 7], '', 1],
    ['Italian augmented 6th (on ♭VI)', 8, [0, 4, 10], ' It+6', 1],
    ['German augmented 6th (on ♭VI)', 8, [0, 4, 7, 10], ' Ger+6', 1],
    ['French augmented 6th (on ♭VI)', 8, [0, 4, 6, 10], ' Fr+6', 1],
  ];

  /* =====================================================================
     11. PATTERNS
     ===================================================================== */
  const RAW_PAT: [string, string, string, string][] = [
    ['classical', 'Alberti bass', 'Lr L5 L3 L5', 'B'],
    ['classical', 'Broken-chord arpeggio', 'R0 R1 R2 R1', 'B'],
    ['classical', 'Bass note + block chord', 'Lr+RA', 'B'],
    ['classical', 'Waltz bass', 'Lr LT LT', 'B'],
    ['classical', 'Rolling arpeggio (LH)', 'Lr L5 L8 L10 L8 L5', 'I'],
    ['classical', 'Arpeggio up and down (RH)', 'R0 R1 R2 R3 R2 R1', 'I'],
    ['classical', 'Waltz accompaniment', 'Lr RA RA', 'I'],
    ['classical', 'Trill', 'R1 R2 R1 R2 R1 R2', 'A'],
    ['classical', 'Broken octaves', 'Lr L8 Lr L8', 'I'],

    ['pop', 'Root–5th–octave bass', 'Lr L5 L8', 'B'],
    ['pop', 'Pad chords', 'RA', 'B'],
    ['pop', 'Pulsing chords', 'Lr+RA RA RA RA', 'B'],
    ['pop', 'Arpeggio over a bass note', 'Lr R0 R1 R2 R1 R0', 'I'],
    ['pop', 'Flowing ballad arpeggio', 'R0 R1 R2 R3 R2 R1', 'I'],

    ['jazz', 'Walking bass', 'Lr L3 L5 L6', 'B'],
    ['jazz', 'Shell voicing (LH)', 'Lr+L7 L3', 'B'],
    ['jazz', 'Stride', 'Lr LC Ld LC', 'I'],
    ['jazz', 'Bass note, then voicing', 'Lr RA', 'I'],
    ['jazz', 'Charleston comping', 'Lr+RA _ RA', 'A'],
    ['jazz', 'Rootless voicing (RH)', 'RR', 'A'],
    ['jazz', 'Walking bass, chromatic approach', 'Lr L3 L5 La', 'A'],
    ['jazz', 'Rootless voicings over walking bass', 'Lr RR L5 RR', 'A'],

    ['blues', 'Shuffle', 'Lr+L5 Lr+L6 Lr+L5 Lr+L6', 'B'],
    ['blues', 'Blue-note slide (RH)', 'R1- R1 R2', 'B'],
    ['blues', 'Boogie-woogie bass', 'Lr L3 L5 L6 L7 L6 L5 L3', 'I'],
    ['blues', 'Boogie bass + chord', 'Lr+RA L5 L6 L7', 'I'],
    ['blues', 'Blues lick (RH)', 'R1- R1 R2 R3 R2 R1', 'A'],

    ['gospel', 'Octave bass walk-up', 'Lr+L8 L3 L5 L8', 'B'],
    ['gospel', 'Chord run and fill', 'Lr R0 R1 R2 R3 RA', 'I'],
    ['gospel', 'Chromatic walk-up', 'Lr L3 L5 La', 'I'],
    ['gospel', 'Chromatic fill into the next chord (RH)', 'R0 R1 R2 Ra', 'A'],
    ['gospel', 'Octave walk with RH chord', 'Lr+L8+RA L3 L5 La', 'A'],

    ['latin', 'Tumbao bass', 'Ld Lr Ld Lr', 'B'],
    ['latin', 'Bossa bass', 'Lr L5 L8 L5', 'B'],
    ['latin', 'Montuno', 'R0 R2 R1 R2 R0 R2', 'I'],
    ['latin', 'Montuno over tumbao', 'Ld+R0 Lr+R2 Ld+R1 Lr+R2', 'A'],
    ['latin', 'Chord stabs with bass', 'Ld+RA Lr+RA', 'A'],

    ['neosoul', 'Root–5th–9th bass', 'Lr L5 L9', 'I'],
    ['neosoul', 'Root + 10th, then rich voicing', 'Lr+L10 RA', 'I'],
    ['neosoul', 'Rootless voicing (RH)', 'RR', 'A'],
    ['neosoul', 'Root + 10th, rootless, full voicing', 'Lr+L10 RR RA', 'A'],

    ['motown', 'Walking bass', 'Lr L5 L6 L8', 'B'],
    ['motown', 'Pulsing chords + octave bass', 'Lr+L8+RA RA RA RA', 'B'],
    ['motown', 'Off-beat stabs over root + 5th', 'Lr+L5 RA RA', 'I'],

    ['country', 'Alternating bass', 'Lr L5 Lr L5', 'B'],
    ['country', 'Walk-up bass', 'Lr L3 L5', 'B'],
    ['country', 'Slide into the 3rd (RH)', 'R1- R1 R2', 'B'],
    ['country', 'Boom-chick', 'Lr RA L5 RA', 'B'],
    ['country', 'Double-stop 6ths (RH)', 'RD1 RD2 RD1', 'I'],

    ['rock', 'Driving octave bass', 'Lr+L8 Lr+L8 Lr+L8 Lr+L8', 'B'],
    ['rock', 'Pounding chords', 'RA RA RA RA', 'I'],
    ['rock', 'Octave bass + RH chord', 'Lr+L8+RA', 'I'],

    ['reggae', 'Off-beat chop (RH)', '_ RA _ RA', 'B'],
    ['reggae', 'Bass note + chops', 'Lr _ RA _ RA', 'I'],
    ['reggae', 'Bubble pattern (RH)', 'R0 R2 R1 R2', 'A'],

    ['ragtime', 'Oom-pah bass', 'Lr LT Ld LT', 'I'],
    ['ragtime', 'Syncopated RH chords', 'RA R0 RA', 'I'],
    ['ragtime', 'Oom-pah with RH run', 'Lr+R0 LT+R1 Ld+R2 LT+R3', 'A'],

    ['worship', 'Open 5th bass', 'Lr+L5', 'B'],
    ['worship', 'Pad + root', 'Lr+RA', 'B'],
    ['worship', 'Flowing arpeggio', 'Lr R0 R1 R2 R3 R2 R1', 'I'],
    ['worship', 'Pedal-tone pad', 'Lr+RA RA RA', 'I'],

    ['motown', 'Off-beat chord stabs (RH)', '_ RA _ RA', 'B'],
    ['motown', 'Repeated chord pulse (RH)', 'RA RA RA RA', 'B'],
    ['worship', 'Flowing arpeggio (RH)', 'R0 R1 R2 R1', 'B'],
    ['worship', 'Pad chords (RH)', 'RA', 'B'],
    ['reggae', 'One-drop bass', '_ Lr _ Ld', 'B'],
    ['reggae', 'Walking reggae bass', 'Lr _ L5 L3', 'I'],
    ['blues', 'Shuffle with RH chord', 'Lr+RA Lr+L6 Lr+RA Lr+L6', 'I'],
    ['country', 'Boom-chick-chick', 'Lr RA RA', 'B'],
    ['gospel', 'Chord stabs (RH)', 'RA RA RA', 'B'],
    ['pop', 'Octave bass pulse', 'Lr+L8 Lr+L8', 'I'],
    ['neosoul', 'Behind-the-beat chords (RH)', '_ RA _ RA', 'I'],
    ['neosoul', '10th bass with syncopation', 'Lr+L10 _ L5 _', 'A'],
    ['rock', 'Boogie-woogie bass', 'Lr L3 L5 L6 L7 L6 L5 L3', 'I'],
    ['jazz', 'Syncopated chord stabs (RH)', '_ RA _ RA', 'I'],
  ];

  const PAT: [string, string, string[][], string][] = RAW_PAT.map(p => [
    p[0],
    p[1],
    p[2].split(' ').map(s => s.split('+')),
    p[3],
  ]);

  const PG: Record<string, string> = {
    classical: 'I – IV – V – I',
    pop: 'I – V – vi – IV',
    jazz: 'Imaj7 – VI7 – iim7 – V7',
    blues: 'I7 – IV7 – V7',
    gospel: 'vi – IV – I – V',
    latin: 'i – iv – V',
    neosoul: 'iim7 – V13 – Imaj9',
    motown: 'I – vi – IV – V',
    country: 'I – IV – V – I',
    rock: 'I7 – IV7 – V7',
    reggae: 'I – V – vi – IV',
    ragtime: 'I – IV – V – I',
    worship: 'I – V – vi – IV',
  };

  const LBL: Record<string, string> = {
    Lr: 'LH root',
    L3: 'LH 3rd',
    L5: 'LH 5th',
    L6: 'LH 6th',
    L7: 'LH 7th',
    L8: 'LH octave',
    L9: 'LH 9th',
    L10: 'LH 10th',
    Ld: 'LH low 5th',
    LC: 'LH chord (3rd–5th–7th)',
    LT: 'LH triad above the bass',
    La: 'LH note a semitone below the next chord’s root',
    RA: 'RH chord',
    RR: 'RH rootless voicing',
    Ra: 'RH note a semitone below the next chord’s root',
    'R1-': 'RH slide up into the 3rd',
    RD1: 'RH double-stop 6th',
    RD2: 'RH double-stop 6th',
  };

  function patOpts() {
    const o: [string, string, string, string?][] = [];
    for (const L of ['B', 'I', 'A']) {
      GEN.forEach(([k, n]) => {
        if (PAT.some(p => p[0] == k && p[3] == L)) o.push([k + '|' + L, n, L]);
      });
      o.push(['all|' + L, 'All genres', L]);
    }
    return o;
  }

  const BK = (m: number) => [1, 3, 6, 8, 10].includes(m % 12);
  const ORD = () => $('order').value == 'ord';
  const pk = <T,>(L: T[]) => L[ORD() ? S.n % L.length : rand(L.length)];

  /* =====================================================================
     12. FINGERING
     ===================================================================== */
  function bassNoteF(
    m: number,
    h: string,
    prevChord?: {ns: number[]; f: (number | string)[]} | null,
  ): number {
    const def = h == 'L' ? 5 : 1;
    if (!prevChord || prevChord.ns.length !== 1) return def;
    const prevM = prevChord.ns[0];
    const prevF = Number(prevChord.f[0]);
    if (!Number.isFinite(prevF) || prevF < 1 || prevF > 5) return def;
    const diff = m - prevM;
    if (diff === 0) return prevF;
    // Reset to natural anchor on larger leaps (4th+)
    if (Math.abs(diff) > 5) {
      if (h == 'L') return BK(m) && diff > 0 ? 4 : 5;
      return BK(m) && diff < 0 ? 2 : 1;
    }
    // Stepwise / 3rd bass voice-leading motion
    const dir = h == 'L' ? -Math.sign(diff) : Math.sign(diff);
    const stepShift = Math.abs(diff) <= 2 ? 1 : 2;
    const cand = prevF + dir * stepShift;
    if (cand >= 1 && cand <= 5) {
      if (BK(m) && cand === 1 && stepShift === 1) return 2;
      return cand;
    }
    return def;
  }

  function chordF(
    ns: number[],
    h: string,
    prevNs?: number[] | null,
    prevF?: (number | string)[] | null,
  ) {
    const n = ns.length;
    if (!n) return [];
    if (n == 1) return [h == 'L' ? 5 : 1];

    const hand: 'R' | 'L' = h === 'L' ? 'L' : 'R';
    if (n <= 5) {
      const prevOpt =
        prevNs && prevF && prevNs.length === prevF.length && prevNs.length > 0
          ? {
              notes: prevNs,
              primary: prevF.map(
                v => Number(String(v).split('/')[0]) || (hand === 'L' ? 5 : 1),
              ),
            }
          : null;
      return computeVoicingFingering(
        ns,
        hand,
        prevOpt,
        DEFAULT_FINGERING_RULES,
        S.prefFingering?.[hand] || null,
      ).primary;
    }

    const f: number[] = [];
    while (f.length < n - 4) f.push(1);
    f.push(2, 3, 4, 5);
    return h == 'L' ? [...f].reverse() : f;
  }

  function fingers(
    st: number[][],
    hd: string[][],
    prevHandState?: {L?: {ns: number[]; f: (number | string)[]}; R?: {ns: number[]; f: (number | string)[]}},
    chordBassMode = false,
  ) {
    const F: (number | string)[][] = st.map(s => s.map(() => ''));
    ['L', 'R'].forEach(h => {
      let run: [number, number][] = [];
      let prevChord = prevHandState?.[h as 'L' | 'R'] || null;
      const flush = () => {
        if (!run.length) return;
        const f = computeScaleOrMelFingering(
          run.map(r => st[r[0]][r[1]]),
          h === 'L' ? 'L' : 'R',
          null,
        );
        run.forEach((r, i) => (F[r[0]][r[1]] = f[i]));
        run = [];
      };
      st.forEach((s, i) => {
        const ix = s.map((_m, j) => j).filter(j => hd[i][j] == h);
        if (!ix.length) return;
        if (ix.length == 1) {
          const m = s[ix[0]];
          if (chordBassMode) {
            flush();
            const fVal = bassNoteF(m, h, prevChord);
            F[i][ix[0]] = fVal;
            prevChord = {ns: [m], f: [fVal]};
          } else {
            run.push([i, ix[0]]);
            prevChord = {ns: [m], f: [h == 'L' ? 5 : 1]};
          }
        } else {
          flush();
          const curNs = ix.map(j => s[j]);
          const f = chordF(
            curNs,
            h,
            prevChord?.ns || null,
            prevChord?.f || null,
          );
          ix.forEach((j, k) => (F[i][j] = f[k] ?? '*'));
          prevChord = {ns: curNs, f};
        }
      });
      flush();
    });
    return F;
  }

  function fgData(q: any) {
    const cl = S.cl || $('clef').value;
    let st: number[][], hd: string[][];
    const prevHandState: {L?: {ns: number[]; f: (number | string)[]}; R?: {ns: number[]; f: (number | string)[]}} = {};

    if (!q.ch && (q.prevRh?.length || q.prevLh?.length)) {
      if (q.prevLh?.length) {
        prevHandState.L = {
          ns: q.prevLh,
          f: q.prevLhF?.length === q.prevLh.length ? q.prevLhF : chordF(q.prevLh, 'L'),
        };
      }
      if (q.prevRh?.length) {
        prevHandState.R = {
          ns: q.prevRh,
          f: q.prevRhF?.length === q.prevRh.length ? q.prevRhF : chordF(q.prevRh, 'R'),
        };
      }
    }

    if (q.ch) {
      st = q.ch.map((c: any) => c.exp);
      hd = q.ch.map(
        (c: any) =>
          c.hd ||
          c.exp.map((_m: number, j: number) =>
            cl == 'treble'
              ? 'R'
              : cl == 'bass'
                ? 'L'
                : j == 0 && c.exp.length > 1
                  ? 'L'
                  : 'R',
          ),
      );
    } else if (q.g == 'scale' || q.g == 'mel' || q.g == 'c2s_play') {
      if (q.lhSeq && q.rhSeq) {
        const lhF = computeScaleOrMelFingering(q.lhSeq, 'L', q.ci);
        const rhF = computeScaleOrMelFingering(q.rhSeq, 'R', q.ci);
        return [
          q.lhSeq.map((lm: number, idx: number) => [lm, q.rhSeq[idx]]),
          q.lhSeq.map(() => ['L', 'R']),
          q.lhSeq.map((_: number, idx: number) => [lhF[idx], rhF[idx]]),
        ];
      }
      if (q.steps && q.steps[0]?.length == 2) {
        st = q.steps;
        hd = q.steps.map(() => ['L', 'R']);
      } else {
        const singleHand: 'L' | 'R' =
          q.hand === 'L' || q.hand === 'R'
            ? q.hand
            : cl == 'bass'
              ? 'L'
              : cl == 'treble'
                ? 'R'
                : q.seq[0] >= 57
                  ? 'R'
                  : 'L';
        const fArr = computeScaleOrMelFingering(q.seq, singleHand, q.ci);
        return [
          q.seq.map((m: number) => [m]),
          q.seq.map(() => [singleHand]),
          fArr.map((f: number) => [f]),
        ];
      }
    } else {
      st = [q.exp];
      hd = [
        q.hd ||
          q.exp.map((_m: number, j: number) =>
            cl == 'treble'
              ? 'R'
              : cl == 'bass'
                ? 'L'
                : q.g == 'int'
                  ? q.exp[0] >= 57
                    ? 'R'
                    : 'L'
                  : j == 0 && q.exp.length > 1
                    ? 'L'
                    : 'R',
          ),
      ];
    }
    if (!q.ch && q.vlF && q.vlF.length === st[0]?.length) {
      return [st, hd, [q.vlF]];
    }
    const chordBassMode =
      !q.pat && q.g != 'scale' && q.g != 'mel' && q.g != 'int';
    const computedF = fingers(st, hd, prevHandState, chordBassMode);
    if (q.ch) {
      q.ch.forEach((step: any, idx: number) => {
        if (step.vlF && step.vlF.length === st[idx]?.length) {
          computedF[idx] = [...step.vlF];
        }
      });
    }
    return [st, hd, computedF];
  }

  /* =====================================================================
     13. METRONOME & PATTERN TIMING
     ===================================================================== */
  function syncMetronome() {
    const on =
      S.go &&
      $('beat').checked &&
      ['scale', 'prog', 'harm', 'pat'].includes($('ug').value);
    if (!on) {
      audioEngine.stopMetronome();
      return;
    }
    const bpm = +$('tempo').value || 80;
    const feel = ($('feel').value || '4_straight') as MetronomeFeel;
    audioEngine.startMetronome(bpm, feel);
  }

  function tdone(q: any) {
    if (!q.beat || !q.tm || !q.tm.length) return true;
    const w = q.bm * 0.3;
    const onBeat = q.tm.filter((e: number) => Math.abs(e) <= w).length;
    const avg = q.tm.reduce((a: number, b: number) => a + b, 0) / q.tm.length;
    q.tinfo =
      'on the beat ' +
      onBeat +
      '/' +
      q.tm.length +
      ' · avg ' +
      Math.abs(Math.round(avg)) +
      ' ms ' +
      (avg < 0 ? 'early' : 'late');
    return onBeat / q.tm.length >= 0.7;
  }

  function startBeat(q: any) {
    audioEngine.resume();
    const lead = 1.2;
    const nb = 4 + q.ch[q.ch.length - 1].b + 3;
    q.bt0 = performance.now() + lead * 1000;
    for (let i = 0; i < nb; i++)
      audioEngine.playClick(i % 4 ? 'mid' : 'high', lead + (i * q.bm) / 1000);
  }

  /* =====================================================================
     14. PATTERN QUESTION BUILDER
     ===================================================================== */
  function patQ(q: any) {
    const [gn, lv] = $('focus').value.split('|');
    const hd = ({treble: 'R', bass: 'L', grand: 'B'} as any)[$('clef').value];
    const has = (p: any, c: string) =>
      p[2].some((s: string[]) => s.some(t => t[0] == c));

    let L = PAT.filter(p => (gn == 'all' || p[0] == gn) && p[3] == lv);
    const F = L.filter(
      p =>
        (hd == 'L' && has(p, 'L') && !has(p, 'R')) ||
        (hd == 'R' && has(p, 'R') && !has(p, 'L')) ||
        (hd == 'B' && has(p, 'L') && has(p, 'R')),
    );
    if (F.length) L = F;

    const P = pk(L);
    const G = PR.find(x => x[0] == PG[P[0]])!;
    const n = P[2].length > 5 ? 2 : 3;
    const hl = has(P, 'L'),
      hr = has(P, 'R');

    S.cl = hl && hr ? 'grand' : hl ? 'bass' : 'treble';
    q.pat = 1;
    q.ch = [];
    let bi = 0;

    G[1].slice(0, n).forEach(([o, sf], ci) => {
      const x = Q.find(y => y[0] === sf)!;
      const ints = x[1];
      const pc = (C.r + o) % 12;
      const cn = pn(pc) + sf;
      const np = (C.r + (G[1][ci + 1] || G[1][0])[0]) % 12;
      const lr = put([-5, 0, 19], pc, 0, [28, 60])[1];
      const rc = put(ints.slice(0, 5), pc, 0, [57, 96]);
      const cl = (m: number) => {
        while (m > S.hi) m -= 12;
        return m;
      };
      const ap = (b: number) => {
        let m = b + ((np - 1 - pc + 12) % 12);
        if (m > b + 6) m -= 12;
        return m;
      };
      const O = (t: string) =>
        ({
          r: 0,
          3: ints[1],
          5: ints[2],
          6: 9,
          7: ints[3] ?? 10,
          8: 12,
          9: 14,
          10: ints[1] + 12,
          d: ints[2] - 12,
        } as any)[t];

      P[2].forEach(st => {
        const ex: [number, string][] = [],
          lb: string[] = [];
        const add = (m: number, h: string) => ex.push([m, h]);

        st.forEach(t => {
          const k = t.slice(1),
            nn = rc.length;
          if (t == '_') {
            lb.push('rest – wait for the beat');
            return;
          }

          if (t[0] == 'L') {
            if (k == 'C')
              [ints[1], ints[2], ints[3] ?? 10].forEach(i =>
                add(cl(lr + 12 + i), 'L'),
              );
            else if (k == 'T')
              [0, 1, 2].forEach(i => add(cl(lr + 12 + ints[i]), 'L'));
            else if (k == 'a') add(ap(lr), 'L');
            else add(cl(lr + O(k)), 'L');
          } else if (k == 'A') rc.forEach(m => add(m, 'R'));
          else if (k == 'R') rc.slice(1).forEach(m => add(m, 'R'));
          else if (k == 'a') add(ap(rc[0]), 'R');
          else if (k[0] == 'D') {
            const i = +k[1];
            add(rc[i % nn], 'R');
            add(rc[(i - 1) % nn] + 12, 'R');
          } else {
            const i = +k[0];
            add(
              rc[i % nn] + 12 * Math.floor(i / nn) - (k[1] == '-' ? 1 : 0),
              'R',
            );
          }
          lb.push(LBL[t] || 'RH note ' + (+t[1] + 1));
        });

        const pr = ex
          .filter((p, i, a) => a.findIndex(y => y[0] == p[0]) == i)
          .sort((a, b) => a[0] - b[0]);

        q.ch.push({
          sf,
          ints,
          pc,
          name: cn + ' · ' + lb.join(' + '),
          exp: pr.map(p => p[0]),
          hd: pr.map(p => p[1]),
          b: bi++,
          rest: !pr.length,
        });
      });
    });

    q.pn =
      GEN.find(g => g[0] == P[0])![1] +
      ' · ' +
      P[1] +
      ' · ' +
      G[0] +
      ' in ' +
      C.k;
    q.lab = 'pattern: ' + P[0];
    q.ans = P[1];
    q.ci = {k: 'pat', g: P[0], prog: G[0]};
    pset(q);
  }

  /* =====================================================================
     15. FOCUS -> INTERNAL SETTINGS + VISIBILITY
     ===================================================================== */
  const CHROMATIC_ONLY_CHORD = new Set([
    'bor',
    'alt',
    'slash_o',
    'v_ust',
    'mix',
  ]);

  function buildIntervalItems(
    cx: any,
    IL: [string, number][],
    dirs: number[],
    inMode: boolean,
  ): {pc: number; iv: [string, number]; up: number}[] {
    const items: {pc: number; iv: [string, number]; up: number}[] = [];
    if (inMode) {
      const modePcs = new Set(cx.sc.map((s: number) => (cx.r + s) % 12));
      for (let d = 0; d < cx.sc.length; d++) {
        const pc = (cx.r + cx.sc[d]) % 12;
        for (const iv of IL) {
          for (const up of dirs) {
            const target = (pc + (up ? iv[1] : 12 - (iv[1] % 12))) % 12;
            if (modePcs.has(target)) items.push({pc, iv, up});
          }
        }
      }
      if (items.length) return items;
    }
    for (const iv of IL) {
      for (let k = 0; k < 12; k++) {
        for (const up of dirs) {
          items.push({pc: (k * 7) % 12, iv, up});
        }
      }
    }
    return items;
  }

  function applyFocus() {
    const ug = $('ug').value,
      f = $('focus').value;
    const set = (i: string, v: any) => ($(i).value = v);
    const chk = (i: string, v: boolean) => ($(i).checked = v);
    const fk = ug + f;
    const changedFocus = S.fk != fk;

    if (changedFocus) {
      S.fk = fk;
      S.n = 0;
      S.prevRh = null;
      S.prevLh = null;
      S.prevRhF = null;
      S.prevLhF = null;
    }

    S.f = f;
    S.cl = null;
    S.mp = null;
    S.ir = [1, 12];
    S.ic = 0;
    S.pt = null;
    S.hf = null;
    S.pat = ug == 'pat';

    set('size', 7);
    const useInMode =
      (ug == 'chord' && !CHROMATIC_ONLY_CHORD.has(f) && S.prefInMode) ||
      (ug == 'int' && S.prefInMode) ||
      (ug == 'ear' &&
        ['ec3', 'ec4', 'ei', 'emel', 'ein'].includes(f) &&
        S.prefInMode);
    if (ug == 'chord' || ug == 'int' || ug == 'ear') chk('inmode', useInMode);

    set('pool', ug == 'chord' && useInMode ? 'key' : 'all');
    chk('sus', false);
    chk('bor', false);
    set('bass', 'any');

    let g = ug == 'pat' ? 'prog' : ug == 'harm' ? 'pass' : ug;

    if (ug == 'chord') {
      if (f == 't4only') set('size', 4);
      else if (/^t\d$/.test(f)) set('size', f[1]);
      else if (f == 'slash_c' || f == 'slash_o') {
        g = 'slash';
        set('size', 5);
        set('bass', f == 'slash_c' ? 'chord' : 'out');
        if (f == 'slash_o') set('pool', 'all');
      } else if (f == 'bor') {
        set('pool', 'key');
        chk('bor', true);
      } else if (/^v_/.test(f)) {
        const u = f == 'v_ust';
        set('size', u || f == 'v_quartal' ? 7 : 5);
        if (u) set('pool', 'all');
      }
    }

    if (ug == 'scale')
      S.mp =
        (
          {
            church: Object.keys(MODES).slice(0, 7),
            minor: ['Aeolian', 'Dorian', 'Harmonic minor', 'Melodic minor'],
            exotic: ['Lydian dominant', 'Altered', 'Phrygian dominant'],
            pent: ['Major pentatonic', 'Minor pentatonic'],
            blues: ['Blues scale', 'Major blues'],
            sym: [
              'Whole-tone',
              'Diminished (half-whole)',
              'Diminished (whole-half)',
              'Augmented',
            ],
            bebop: ['Bebop dominant', 'Bebop major', 'Bebop Dorian'],
            world: [
              'Harmonic major',
              'Double harmonic',
              'Hungarian minor',
              'Hirajoshi',
            ],
            chrom: ['Chromatic'],
            ext: EXT,
            all: [...Object.keys(MODES), ...Object.keys(SCALES)],
          } as Record<string, string[]>
        )[f] || null;

    if (ug == 'int') {
      S.ir = (
        {
          i0: [1, 12],
          i1: [1, 4],
          i2: [5, 7],
          i3: [8, 11],
          icomp: [13, 21],
        } as any
      )[f];
      S.ic = f == 'icomp';
    }

    if (ug == 'prog') set('plevel', f);

    if (ug == 'harm') {
      const H: Record<string, any> = {
        h_sec: 0,
        h_tri: 1,
        h_dim: 2,
        h_back: 3,
        h_all: null,
        h_med: 'med',
        h_nea: 'nea',
        h_aug: 'aug',
      };
      if (f in H) S.pt = H[f];
      else if (f == 'h_bor') {
        g = 'chord';
        set('pool', 'key');
        chk('bor', true);
      } else if (f == 'h_guide') {
        g = 'harm_guide';
      } else if (f == 'h_close' || f == 'h_close7') {
        g = 'harm_close';
        set('size', f == 'h_close7' ? 4 : 3);
        if (changedFocus && $('bhmode').value == 'bass') {
          set('bhmode', 'same');
        }
      } else if (f == 'h_vl_up' || f == 'h_vl_down') {
        g = f == 'h_vl_up' ? 'harm_vl_up' : 'harm_vl_down';
        S.vlDir = f == 'h_vl_up' ? 'up' : 'down';
      } else if (f == 'h_harm3' || f == 'h_harm7') {
        g = 'harm_scale';
        set('size', f == 'h_harm7' ? 4 : 3);
      } else if (f == 'h_c2s') {
        g = 'harm_c2s';
      } else if (f == 'h_mchar') {
        g = 'harm_mchar';
      } else {
        g = 'prog';
        S.hf =
          f[0] == 'c'
            ? 'cad:' + f.slice(2)
            : ({h_mii: 'h:mii', h_cli: 'h:cli', h_bd: 'h:bd'} as any)[f];
      }
    }

    if (ug == 'ear') {
      set(
        'eartype',
        (
          {
            ec3: 'chord',
            ec4: 'chord',
            ec7: 'chord',
            ei: 'int',
            es: 'scale',
            es2: 'scale2',
            emel: 'mel',
            ebass: 'bassline',
            ecad: 'cad',
            ep1: 'prog',
            ep2: 'prog',
            ein: 'inv',
          } as any
        )[f],
      );
      if (f == 'ec3') set('size', 3);
      if (f == 'ec4') set('size', 4);
      S.ep = f == 'ep2' ? 'adv' : 'basic';
    }

    set('game', g);
  }

  function fillModesForScale(preserveMode = false) {
    const scEl = $('scale') as HTMLSelectElement | null;
    const modeEl = $('mode') as HTMLSelectElement | null;
    if (!scEl || !modeEl) return;
    const prevMode = modeEl.value;
    const famId = scEl.value;
    const fam = SCALE_FAMILIES.find(f => f.id === famId);
    const modeList = fam ? fam.modes : Object.keys(MODES);
    const opts: [string, string][] = [
      ['rnd', 'Any (Random)'],
      ...modeList.map(m => [m, getModeDisplayLabel(m)] as [string, string]),
    ];
    modeEl.innerHTML = opts
      .map(([v, lbl]) => `<option value="${v}">${lbl}</option>`)
      .join('');
    if (preserveMode && opts.some(([v]) => v === prevMode)) {
      modeEl.value = prevMode;
    } else {
      modeEl.value = fam ? fam.modes[0] : 'rnd';
    }
    mkdd(modeEl);
  }

  function fillFocus() {
    const o = $('ug').value == 'pat' ? patOpts() : FO[$('ug').value];
    let h = '';
    for (const L of ['B', 'I', 'A']) {
      const g = o.filter(x => x[2] == L);
      if (g.length)
        h += `<optgroup label="${LV[L]}" data-l="${L}">${g
          .map(
            x =>
              `<option value="${x[0]}" data-c="${x[3] || ''}">${x[1]}</option>`,
          )
          .join('')}</optgroup>`;
    }
    $('focus').innerHTML = h;
  }

  function vis() {
    applyFocus();
    const ug = $('ug').value;
    const fVal = $('focus').value;
    const g = $('game').value;
    const inModeOn = $('inmode').checked;
    const cl = $('clef').value;
    const bh = $('bhmode').value;
    const relUnsupported =
      (ug == 'chord' && (g == 'slash' || fVal == 'v_ust')) ||
      g == 'harm_guide' ||
      g == 'harm_close' ||
      g == 'harm_c2s' ||
      g == 'harm_mchar';
    const relActive =
      ['chord', 'prog', 'harm'].includes(ug) &&
      $('vlead').checked &&
      !relUnsupported;

    document.querySelectorAll('#set .f').forEach((f: any) => {
      const gs = f.dataset.g.split(',');
      let on = gs.includes(ug);
      let why = on ? '' : 'Used in ' + gs.map((x: string) => GN[x]).join(', ');

      const inp = f.querySelector('input,select');
      const id = inp?.id;

      if (on && id == 'inmode') {
        if (ug == 'chord' && CHROMATIC_ONLY_CHORD.has(fVal)) {
          on = false;
          why = 'This focus uses chromatic notes outside the mode';
        } else if (ug == 'ear' && fVal == 'ec7') {
          on = false;
          why = 'Everything drill includes chromatic and extended chord qualities';
        } else if (
          ug == 'ear' &&
          !['chord', 'int', 'mel', 'inv'].includes($('eartype').value)
        ) {
          on = false;
          why = 'Scale and progression ear drills define their own tonality';
        }
      }

      if (on && id == 'altchords') {
        if (ug != 'chord' || ['bor', 'v_ust', 'v_quartal', 'slash_c', 'slash_o'].includes(fVal)) {
          on = false;
          why = 'Available across Triads, 7ths, 9ths, 11ths, 13ths & voicings';
        } else if (fVal == 'alt') {
          on = false;
          why = 'Always active in Altered chords focus';
        }
      }

      if (on && (id == 'mode' || id == 'scale')) {
        const earEt = $('eartype').value;
        if (ug == 'chord' && !inModeOn && fVal != 'bor') {
          on = false;
          why = 'Turn on Stay in key & mode to filter by mode';
        } else if (ug == 'int' && !inModeOn) {
          on = false;
          why = 'Turn on Stay in key & mode to filter by mode';
        } else if (
          ug == 'ear' &&
          (fVal == 'ec7' ||
            ['scale', 'scale2', 'bassline', 'cad', 'prog'].includes(earEt))
        ) {
          on = false;
          why =
            fVal == 'ec7'
              ? 'Everything drill includes chromatic chord qualities across modes'
              : 'This ear drill tests identifying the mode or progression itself';
        } else if (ug == 'ear' && earEt != 'mel' && !inModeOn) {
          on = false;
          why = 'Turn on Stay in key & mode to filter by mode';
        } else if (
          ug == 'scale' &&
          !['chosen', 'five', 'arp3', 'arp7', 'arpd', 'hanon'].includes(fVal)
        ) {
          on = false;
          why = 'Overridden by the selected Scale run focus';
        } else if (ug == 'prog' || ug == 'pat') {
          on = false;
          why = 'Progressions set their own tonality from Key';
        } else if (ug == 'harm' && (g == 'prog' || g == 'harm_guide')) {
          on = false;
          why = 'Cadences and fixed progressions set their own tonality from Key';
        } else if (ug == 'harm' && g == 'harm_c2s') {
          on = false;
          why = 'Candidate scales are determined by each chord';
        } else if (ug == 'harm' && g == 'harm_mchar') {
          on = false;
          why = 'This drill tests characteristic chords across modes';
        }
      }

      if (on && id == 'bhmode') {
        if (cl != 'grand') {
          on = false;
          why = 'Switch Clef to Grand (both hands) to enable';
        } else if (
          g == 'slash' ||
          g == 'harm_guide' ||
          g == 'harm_c2s' ||
          g == 'harm_mchar'
        ) {
          on = false;
          why = 'Not used in this drill focus';
        }
      }

      if (on && id == 'lhinv') {
        if (
          cl != 'grand' ||
          bh != 'diff' ||
          g == 'slash' ||
          g == 'harm_guide' ||
          g == 'harm_c2s' ||
          g == 'harm_mchar'
        ) {
          on = false;
          why = 'Set Clef to Grand and Both-hands chords to Different inversions';
        } else if (relActive) {
          on = false;
          why = 'Relative voice leading picks the closest LH inversion';
        }
      }

      if (on && id == 'inv') {
        if (
          ug == 'scale' &&
          !['arp3', 'arp7', 'arpd'].includes(fVal)
        ) {
          on = false;
          why = 'Used for arpeggio inversions in Scale runs';
        } else if (g == 'harm_c2s' || g == 'harm_mchar') {
          on = false;
          why = 'Inversions are fixed in this drill';
        } else if (relActive) {
          on = false;
          why = 'Relative voice leading uses all inversions of the chord';
        }
      }

      if (on && id == 'vlead') {
        if (ug == 'chord' && (g == 'slash' || fVal == 'v_ust')) {
          on = false;
          why = 'Slash and upper-structure drills fix voicing placement';
        } else if (ug == 'harm' && g == 'harm_guide') {
          on = false;
          why = 'Guide-tone targeting always uses smooth voice leading';
        } else if (g == 'harm_close' || g == 'harm_vl_up' || g == 'harm_vl_down') {
          on = false;
          why = 'Always active in close-range and keyboard voice-leading drills';
        } else if (g == 'harm_c2s' || g == 'harm_mchar') {
          on = false;
          why = 'Used in chord and progression voicing drills';
        }
      }

      if (on && id == 'exinv') {
        if (ug == 'scale' && !['arp3', 'arp7', 'arpd'].includes(fVal)) {
          on = false;
          why = 'Used for arpeggio inversions in Scale runs';
        } else if (g == 'harm_c2s' || g == 'harm_mchar') {
          on = false;
          why = 'Inversions are fixed in this drill';
        } else if (relActive || g == 'harm_vl_up' || g == 'harm_vl_down') {
          on = false;
          why = 'Disabled while Relative voice leading is on';
        }
      }

      if (on && id == 'pfmt') {
        if (g == 'harm_c2s') {
          on = false;
          why = 'Chord-to-scale displays full chord names and matching scales';
        }
      }

      if (on && (id == 'scrange' || id == 'scmultioct' || id == 'sccontrary')) {
        if (fVal == 'five' || fVal == 'hanon') {
          on = false;
          why = '5-finger and Hanon drills use a fixed pattern span';
        }
      }

      if (on && id == 'schands') {
        if (fVal == 'hanon') {
          on = true;
        }
      }

      if (on && id == 'fing') {
        const q = S.q;
        if (!q || !(q.revealed || q.done)) {
          on = false;
          why = 'Enabled once Show answer is clicked';
        }
      }

      f.classList.toggle('off', !on);
      f.querySelectorAll('input,select,button').forEach(
        (e: any) => (e.disabled = !on),
      );
      f.querySelector('.why').textContent = why;
    });
    const vlNoteEl = $('vloctnote') as HTMLElement | null;
    if (vlNoteEl) {
      const showVlNote =
        ['chord', 'prog', 'harm'].includes(ug) &&
        !relUnsupported &&
        Boolean(S.vlWarn || S.vlNotice);
      vlNoteEl.hidden = !showVlNote;
    }
    $('pl').style.display =
      S.studyMode == 'teach' ||
      ug == 'ear' ||
      S.q?.g == 'mel' ||
      S.q?.g == 'c2s_play' ||
      S.q?.g == 'mchar_play' ||
      S.q?.isMc
        ? ''
        : 'none';
    syncVlBar(relActive);
    syncScBar(g);
    syncScaleOctaveUI();
    segsync();
    CD.forEach(i => mkdd($(i)));
  }

  function syncScBar(gameVal?: string) {
    const bar = $('scbar') as HTMLElement | null;
    if (!bar) return;
    const g = gameVal ?? $('game')?.value;
    const isTeach = S.studyMode == 'teach';
    const isC2s = g == 'harm_c2s';
    const isMchar = g == 'harm_mchar';
    const show = isC2s || (isMchar && !isTeach);
    bar.hidden = !show;
    if (!show) return;

    const modeGroup = $('scmodegroup') as HTMLElement | null;
    if (modeGroup) modeGroup.hidden = isTeach;
    const modeEl = $('scmode') as HTMLElement | null;
    if (modeEl) {
      modeEl.querySelectorAll<HTMLButtonElement>('[data-scmode]').forEach(b => {
        const active = b.dataset.scmode === S.scMode;
        b.classList.toggle('on', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    const diffGroup = $('scdiffgroup') as HTMLElement | null;
    if (diffGroup) diffGroup.hidden = !isC2s;
    const diffEl = $('scdiff') as HTMLElement | null;
    if (diffEl) {
      diffEl.querySelectorAll<HTMLButtonElement>('[data-scdiff]').forEach(b => {
        const active = b.dataset.scdiff === S.scDiff;
        b.classList.toggle('on', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  }

  function syncVlBar(relActive?: boolean) {
    const bar = $('vlbar');
    if (!bar) return;
    if (relActive == null) {
      const ug = $('ug').value;
      const fVal = $('focus').value;
      const g = $('game').value;
      const relUnsupported =
        (ug == 'chord' && (g == 'slash' || fVal == 'v_ust')) ||
        g == 'harm_guide' ||
        g == 'harm_close' ||
        g == 'harm_c2s' ||
        g == 'harm_mchar';
      relActive =
        ['chord', 'prog', 'harm'].includes(ug) &&
        $('vlead').checked &&
        !relUnsupported;
    }
    bar.hidden = !relActive;
    if (!relActive) return;

    const previewCtx = C || ctx();
    const degEl = $('vldeg');
    if (degEl) {
      (degEl as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('[data-deg]')
        .forEach(b => {
          const d = Number(b.dataset.deg);
          b.classList.toggle('on', d === S.primDeg);
          const rootN = previewCtx?.names?.[d] || '';
          b.title = rootN
            ? `Anchor primary chord on degree ${IR[d]} (${rootN}) in root position`
            : `Anchor primary chord on degree ${IR[d]} in root position`;
        });
    }

    const lockBtn = $('vllock') as HTMLButtonElement | null;
    if (lockBtn) {
      lockBtn.classList.toggle('on', !!S.rangeLocked);
      lockBtn.setAttribute('aria-pressed', S.rangeLocked ? 'true' : 'false');
      const z = S.lockZoneRh || S.lockZoneLh;
      const rangeSpan =
        S.rangeLocked && z ? ` · ${sm(z[0]).n}–${sm(z[1]).n}` : '';
      lockBtn.textContent = S.rangeLocked
        ? `Range: Locked${rangeSpan}`
        : 'Range: Unlocked';
    }

    const dirGroup = $('vldirgroup') as HTMLElement | null;
    const dirEl = $('vldir') as HTMLElement | null;
    if (dirGroup) {
      dirGroup.hidden = !!S.rangeLocked;
    }
    if (dirEl) {
      dirEl.querySelectorAll<HTMLButtonElement>('[data-vldir]').forEach(b => {
        b.classList.toggle('on', b.dataset.vldir === S.vlDir);
      });
    }

    const ugNow = $('ug')?.value;
    const fValNow = $('focus')?.value;
    const triadOnlyFocus =
      ugNow === 'chord' && fValNow === 't3' && !$('altchords')?.checked;
    const seventhGroup = $('vl7group') as HTMLElement | null;
    const seventhEl = $('vl7') as HTMLElement | null;
    if (seventhGroup) {
      seventhGroup.hidden = triadOnlyFocus;
    }
    if (seventhEl) {
      seventhEl.querySelectorAll<HTMLButtonElement>('[data-vl7]').forEach(b => {
        const active = b.dataset.vl7 === S.vl7Mode;
        b.classList.toggle('on', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  }

  /* =====================================================================
     16. CUSTOM DROPDOWNS + SEGMENTED CONTROLS
     ===================================================================== */
  const CD = [
    'ug',
    'focus',
    'key',
    'scale',
    'mode',
    'bhmode',
    'inv',
    'lhinv',
    'fingcheck',
    'schands',
    'sound',
    'feel',
    'octs',
    'lowest',
  ];

  function mkdd(sel: HTMLSelectElement) {
    if (!sel) return;
    let w = sel.nextElementSibling as HTMLElement | null;
    if (!w || !w.classList.contains('dd')) {
      w = document.createElement('div');
      w.className = 'dd';
      sel.after(w);
      sel.classList.add('hid');
    }
    const op = (o: HTMLOptionElement) =>
      `<div class="ddo${o.selected ? ' on' : ''}" data-v="${o.value}" data-s="${sel.id}">${o.text}${
        o.dataset.c ? `<small class=ddc>${o.dataset.c}</small>` : ''
      }</div>`;
    const cur = sel.options[sel.selectedIndex];

    w.innerHTML = `<button type=button class=ddb${sel.disabled ? ' disabled' : ''}><span>${cur ? cur.text : ''}</span><span>▾</span></button><div class=ddl hidden>${[
      ...sel.children,
    ]
      .map((c: any) =>
        c.tagName == 'OPTGROUP'
          ? `<div class=ddh data-l="${c.dataset.l}">${c.label}</div>` +
            [...c.children].map(op).join('')
          : op(c),
      )
      .join('')}</div>`;
  }

  document.addEventListener(
    'click',
    e => {
      const target = e.target as HTMLElement;
      const b = target.closest('.ddb'),
        o = target.closest('.ddo') as HTMLElement | null;
      document.querySelectorAll('.ddl').forEach((l: any) => {
        if (!b || l.previousElementSibling !== b) l.hidden = true;
      });
      if (b) {
        const l = b.nextElementSibling as HTMLElement;
        l.hidden = !l.hidden;
        const on = l.querySelector('.on');
        if (!l.hidden && on) on.scrollIntoView({block: 'nearest'});
      }
      if (o) {
        const x = $(o.dataset.s!);
        x.value = o.dataset.v;
        x.dispatchEvent(new Event('change', {bubbles: true}));
      }
    },
    {signal},
  );

  window.addEventListener(
    'keydown',
    e => {
      if (e.key == 'Escape')
        document
          .querySelectorAll('.ddl')
          .forEach((l: any) => (l.hidden = true));
    },
    {capture: true, signal},
  );

  function segsync() {
    document.querySelectorAll('.seg').forEach((g: any) =>
      [...g.children].forEach((b: any) =>
        b.classList.toggle('on', b.dataset.v == $(g.dataset.for).value),
      ),
    );
  }

  /* =====================================================================
     17. AUDIO PLAYBACK
     ===================================================================== */
  function curSound(): SoundPreset {
    return ($('sound')?.value || 'grand') as SoundPreset;
  }

  function playQ() {
    const q = S.q;
    if (!q) return;
    audioEngine.resume();
    const sndPreset = curSound();

    if (q.g == 'ear' && q.snd) {
      q.snd.forEach(([m, t, d]: [number, number, number]) =>
        audioEngine.playNote(m, t, d, sndPreset, 0.8),
      );
      return;
    }

    if (q.g == 'scale' || q.g == 'mel' || q.g == 'c2s_play') {
      if (q.chordExp && q.chordExp.length) {
        q.chordExp.forEach((m: number, i: number) =>
          audioEngine.playNote(m, i * 0.035, 0.9, sndPreset, i === 0 ? 0.68 : 0.76),
        );
        if ((S.studyMode == 'teach' || q.done || q.revealed) && q.seq?.length) {
          q.seq.forEach((m: number, idx: number) =>
            audioEngine.playNote(m, 0.78 + idx * 0.22, 0.3, sndPreset, 0.76),
          );
        }
        return;
      }
      if (q.steps && q.steps.length) {
        q.steps.forEach((step: number[], idx: number) => {
          step.forEach((m: number, ni: number) =>
            audioEngine.playNote(m, idx * 0.28, 0.34, sndPreset, ni === 0 ? 0.68 : 0.78),
          );
        });
      } else if (q.seq && q.seq.length) {
        q.seq.forEach((m: number, idx: number) =>
          audioEngine.playNote(m, idx * 0.25, 0.32, sndPreset, 0.78),
        );
      }
      return;
    }

    if (q.g == 'harm_c2s' && q.chordExp?.length) {
      q.chordExp.forEach((m: number, i: number) =>
        audioEngine.playNote(m, i * 0.035, 1.0, sndPreset, i === 0 ? 0.68 : 0.76),
      );
      if ((q.done || q.revealed) && q.primarySeq?.length) {
        q.primarySeq.forEach((m: number, idx: number) =>
          audioEngine.playNote(m, 0.8 + idx * 0.22, 0.3, sndPreset, 0.76),
        );
      }
      return;
    }

    if ((q.g == 'mchar_play' || q.g == 'harm_mchar') && q.tonicExp?.length) {
      q.tonicExp.forEach((m: number, i: number) =>
        audioEngine.playNote(m, i * 0.03, 0.75, sndPreset, i === 0 ? 0.68 : 0.74),
      );
      if ((S.studyMode == 'teach' || q.done || q.revealed) && q.exp?.length) {
        q.exp.forEach((m: number, i: number) =>
          audioEngine.playNote(m, 0.68 + i * 0.035, 1.3, sndPreset, i === 0 ? 0.7 : 0.78),
        );
      }
      return;
    }

    if (q.g == 'int' && q.exp && q.exp.length >= 2) {
      audioEngine.playNote(q.exp[0], 0, 0.5, sndPreset, 0.76);
      audioEngine.playNote(q.exp[1], 0.36, 0.5, sndPreset, 0.78);
      audioEngine.playNote(q.exp[0], 0.86, 1.35, sndPreset, 0.74);
      audioEngine.playNote(q.exp[1], 0.86, 1.35, sndPreset, 0.76);
      return;
    }

    const notes: number[] = q.exp || [];
    if (!notes.length) return;
    notes.forEach((m: number, i: number) =>
      audioEngine.playNote(m, i * 0.04, 1.45, sndPreset, i === 0 ? 0.68 : 0.78),
    );
    if (notes.length >= 2 && notes.length <= 7 && q.g != 'prog' && q.g != 'pat') {
      const strikeAt = notes.length * 0.04 + 0.55;
      notes.forEach((m: number, i: number) =>
        audioEngine.playNote(m, strikeAt, 1.5, sndPreset, i === 0 ? 0.68 : 0.76),
      );
    }
  }

  function playFullSequence(q: any) {
    if (!q || !q.ch || !q.ch.length) {
      playQ();
      return;
    }
    audioEngine.resume();
    const sndPreset = curSound();
    let t = 0;
    q.ch.forEach((step: any) => {
      if (!step.rest && step.exp?.length) {
        step.exp.forEach((m: number, ni: number) =>
          audioEngine.playNote(m, t + ni * 0.025, 0.82, sndPreset, ni === 0 ? 0.66 : 0.76),
        );
      }
      t += step.rest ? 0.45 : 0.78;
    });
  }

  function pset(q: any) {
    const cl = $('clef').value;
    const CL =
      ({treble: 'treble clef', bass: 'bass clef', grand: 'both hands', none: 'no staff'} as any)[cl] ||
      'treble clef';
    q.top = `${C.k} ${C.m} · ${CL}`;
    q.topAnon = CL;

    if (q.pat) {
      while (q.ch[q.pos] && q.ch[q.pos].rest) q.pos++;
      const c = q.ch[q.pos];
      q.exp = c.exp;
      q.hd = c.hd;
      q.main = c.name;
      q.sub = q.pn + ' · step ' + (q.pos + 1) + '/' + q.ch.length;
      return;
    }
    const c = q.ch[q.pos];
    const fmt = $('pfmt').value;
    q.exp = c.exp;
    q.hd = c.hd;
    q.lhLen = c.lhLen;
    q.rhLen = c.rhLen;
    q.vlInfo = c.vlInfo || null;
    q.main =
      fmt == 'roman'
        ? q.rom[q.pos]
        : fmt == 'nns'
          ? q.nns[q.pos]
          : c.name;
    const seqNames =
      fmt == 'roman'
        ? q.rom
        : fmt == 'nns'
          ? q.nns
          : q.ch.map((x: any) => x.name);
    q.sub =
      (fmt == 'nns' ? q.nnsLine : q.pn) +
      ' · ' +
      seqNames
        .map((lbl: string, i: number) => (i == q.pos ? '[' + lbl + ']' : lbl))
        .join(' → ') +
      ' · chord ' +
      (q.pos + 1) +
      '/' +
      q.ch.length +
      (c.subHint ? ' · ' + c.subHint : '');
  }

  /* =====================================================================
     18. THEORY TEXT
     ===================================================================== */
  const DG: Record<number, string> = {
    0: '1',
    1: '♭2',
    2: '2',
    3: '♭3',
    4: '3',
    5: '4',
    6: '♭5',
    7: '5',
    8: '♯5',
    9: '6',
    10: '♭7',
    11: '7',
    12: '8',
    13: '♭9',
    14: '9',
    15: '♯9',
    16: '10',
    17: '11',
    18: '♯11',
    19: '12',
    20: '♭13',
    21: '13',
  };

  const IS: [string, string, string, string][] = [
    ['unison', 'P1', 'Perfect', 'The same note.'],
    ['minor 2nd', 'm2', 'Dissonant', 'A half step: tense and close.'],
    ['major 2nd', 'M2', 'Mild dissonance', 'A whole step, the building block of scales.'],
    ['minor 3rd', 'm3', 'Imperfect consonance', 'Dark, sad; defines minor chords.'],
    ['major 3rd', 'M3', 'Imperfect consonance', 'Bright, happy; defines major chords.'],
    ['perfect 4th', 'P4', 'Perfect (dissonant over a bass)', 'Open and stable; the inversion of a perfect 5th.'],
    ['tritone', 'TT (♭5 / ♯4)', 'Dissonant', 'Splits the octave in half; the core of the dominant 7th.'],
    ['perfect 5th', 'P5', 'Perfect consonance', 'The most stable interval after the octave.'],
    ['minor 6th', 'm6', 'Imperfect consonance', 'Warm and yearning.'],
    ['major 6th', 'M6', 'Imperfect consonance', 'Sweet and open.'],
    ['minor 7th', 'm7', 'Mild dissonance', 'Bluesy; gives the dominant 7th its pull.'],
    ['major 7th', 'M7', 'Dissonant', 'Bright and floating, a half step under the octave.'],
    ['octave', 'P8', 'Perfect consonance', 'Same note name, double the frequency.'],
  ];

  const NM: Record<string, [string, string, string]> = {
    '': ['Major triad', 'C, CM, Cmaj', 'Bright and stable: root, major 3rd, perfect 5th.'],
    m: ['Minor triad', 'Cm, Cmin, C−', 'Darker and sadder: root, minor 3rd, perfect 5th.'],
    dim: ['Diminished triad', 'C°, Cdim', 'Tense and unstable: two stacked minor 3rds.'],
    aug: ['Augmented triad', 'C+, Caug', 'Unresolved and dreamy: two stacked major 3rds.'],
    '(♭5)': ['Major flat-5 triad', 'C(♭5)', 'Altered major triad with a lowered 5th: tense tritone outline.'],
    'm(♯5)': ['Minor sharp-5 triad', 'Cm(♯5)', 'Altered minor triad with a raised 5th (enharmonic first-inversion major colour).'],
    sus2: ['Suspended 2nd', 'Csus2', 'Open and ambiguous: the 3rd is replaced by the 2nd.'],
    sus4: ['Suspended 4th', 'Csus4, Csus', 'Wants to resolve to a major or minor chord: the 3rd is replaced by the 4th.'],
    '5': ['Power chord', 'C5', 'Root and 5th only; neither major nor minor.'],
    '6': ['Major 6th chord', 'C6', 'A major triad plus a 6th: warm and restful.'],
    m6: ['Minor 6th chord', 'Cm6, C−6', 'A minor triad plus a major 6th: bittersweet.'],
    '6/9': ['Six-nine chord', 'C6/9', 'A major 6th chord plus a 9th: lush, no 7th.'],
    add9: ['Added-9th chord', 'Cadd9, C(add2)', 'A major triad plus a 9th, without a 7th: bright and open.'],
    madd9: ['Minor added-9th', 'Cm(add9)', 'A minor triad plus a 9th.'],
    maj7: ['Major 7th', 'CΔ7, CM7, Cmaj7', 'Dreamy and stable; a tonic or IV chord in major.'],
    '7': ['Dominant 7th', 'C7', 'Tense; wants to resolve down a 5th. Major triad plus minor 7th.'],
    m7: ['Minor 7th', 'C−7, Cmin7', 'Mellow; ii, iii or vi in a major key.'],
    'm7♭5': ['Half-diminished 7th', 'Cø7, Cm7♭5', 'Dark and unstable; the ii chord of a minor ii–V–i.'],
    dim7: ['Fully diminished 7th', 'C°7, Cdim7', 'Symmetrical stack of minor 3rds; a strong passing chord.'],
    mMaj7: ['Minor-major 7th', 'C−Δ7, Cm(maj7)', 'A minor triad with a major 7th: mysterious.'],
    'maj7♯5': ['Major 7th sharp 5', 'CΔ7♯5', 'Augmented triad with a major 7th: bright and floating.'],
    'maj7♭5': ['Major 7th flat 5', 'CΔ7♭5', 'Major 7th with a lowered 5th: luminous Lydian/altered colour.'],
    '7sus4': ['Dominant 7th suspended 4th', 'C7sus4', 'Dominant colour without the 3rd: open and modern.'],
    '7♭5': ['Dominant 7th flat 5', 'C7♭5', 'Dominant 7th with a lowered 5th: tense, tritone sub flavour.'],
    '7♯5': ['Dominant 7th sharp 5', 'C7♯5, C+7', 'Dominant 7th over an augmented triad.'],
    'm7♯5': ['Minor 7th sharp 5', 'Cm7♯5', 'Minor 7th with a raised 5th: warm, suspended-like neo-soul colour.'],
    dimMaj7: ['Diminished major 7th', 'C°(maj7)', 'Diminished triad topped with a major 7th: dark, cinematic pull.'],
    'mMaj7♯5': ['Minor-major 7th sharp 5', 'Cm(maj7♯5)', 'Minor-major 7th with a raised 5th: exotic melodic-minor colour.'],
    quartal: ['Quartal chord', 'C quartal', 'Notes stacked in perfect 4ths: open, modern, ambiguous.'],
    quintal: ['Quintal chord', 'C quintal', 'Notes stacked in perfect 5ths: wide and open.'],
    maj9: ['Major 9th', 'CΔ9, Cmaj9', 'Major 7th plus a 9th: rich and smooth.'],
    '9': ['Dominant 9th', 'C9', 'Dominant 7th plus a 9th: funky and full.'],
    m9: ['Minor 9th', 'C−9, Cm9', 'Minor 7th plus a 9th: soulful.'],
    mMaj9: ['Minor-major 9th', 'Cm(maj9)', 'Minor-major 7th plus a 9th.'],
    '9sus4': ['Dominant 9th suspended 4th', 'C9sus4', 'The gospel and R&B sus sound.'],
    '7♭9': ['Dominant 7th flat 9', 'C7♭9', 'Altered dominant: dark tension, often into a minor chord.'],
    '7♯9': ['Dominant 7th sharp 9', 'C7♯9, "Hendrix chord"', 'Major and minor 3rds clash: gritty and bluesy.'],
    '7♯11': ['Dominant 7th sharp 11', 'C7♯11', 'Lydian dominant colour: bright, jazzy.'],
    '7♭13': ['Dominant 7th flat 13', 'C7♭13', 'Mixolydian ♭6 colour: wistful tension.'],
    '7♯5♯9': ['Altered dominant', 'C7alt, C7♯5♯9', 'The most tense dominant: both altered 5th and 9th.'],
    '7♭5♭9': ['Dominant 7th flat 5 flat 9', 'C7♭5♭9', 'Altered dominant combining lowered 5th and lowered 9th.'],
    '7♭5♯9': ['Dominant 7th flat 5 sharp 9', 'C7♭5♯9', 'Altered dominant with tritone 5th and sharp 9th tension.'],
    '7♯5♭9': ['Dominant 7th sharp 5 flat 9', 'C7♯5♭9', 'Augmented dominant 7th topped with a flat 9th: strong pull to minor.'],
    '9♭5': ['Dominant 9th flat 5', 'C9♭5', 'Whole-tone flavoured dominant 9th with a flat 5th.'],
    '9♯5': ['Dominant 9th sharp 5', 'C9♯5', 'Whole-tone dominant 9th over an augmented triad.'],
    'm9♭5': ['Half-diminished 9th', 'Cm9♭5, Cø9', 'Minor 9th chord with a lowered 5th: rich minor-key ii chord.'],
    'maj9♯5': ['Major 9th sharp 5', 'CΔ9♯5', 'Augmented major 9th: dreamy melodic-minor III+ sound.'],
    m11: ['Minor 11th', 'C−11, Cm11', 'Minor 9th plus an 11th: wide and modern.'],
    'maj9♯11': ['Major 9th sharp 11', 'CΔ9♯11', 'Lydian tonic colour: floating and bright.'],
    '9♯11': ['Dominant 9th sharp 11', 'C9♯11', 'Lydian dominant: bright, jazzy dominant.'],
    '7♭9♭13': ['Dominant 7th flat 9 flat 13', 'C7♭9♭13', 'Altered dominant leading to a minor chord.'],
    '7♯9♭13': ['Dominant 7th sharp 9 flat 13', 'C7♯9♭13', 'Altered jazz dominant pairing ♯9 bite with ♭13 resolution.'],
    '11♭9': ['Dominant 11th flat 9', 'C11♭9', 'Suspended-feeling altered dominant with a flat 9th tension.'],
    '13': ['Dominant 13th', 'C13', 'Dominant 7th with 9th and 13th: the full, bluesy jazz dominant.'],
    m13: ['Minor 13th', 'C−13, Cm13', 'Minor 11th plus a 13th.'],
    'maj13♯11': ['Major 13th sharp 11', 'CΔ13♯11', 'The fullest Lydian major sound.'],
    '13sus4': ['Dominant 13th suspended 4th', 'C13sus4', 'Suspended dominant with a 13th: open and full.'],
    '13♭9': ['Dominant 13th flat 9', 'C13♭9', 'Half-whole diminished dominant sound: bright 13th over tense ♭9.'],
    '13♯9': ['Dominant 13th sharp 9', 'C13♯9', 'Blues-jazz 13th chord with gritty ♯9 tension.'],
    '13♯11': ['Dominant 13th sharp 11', 'C13♯11', 'Full Lydian dominant voicing with 9th, ♯11th, and 13th.'],
    '13♭5': ['Dominant 13th flat 5', 'C13♭5', 'Altered 13th replacing the perfect 5th with a tritone ♭5.'],
  };
  NM['quartal (4 notes)'] = NM.quartal;
  NM.m7b5 = NM['m7♭5'];
  NM['7b5'] = NM['7♭5'];
  NM['maj7#5'] = NM['maj7♯5'];
  NM['maj7b5'] = NM['maj7♭5'];
  NM['7#5'] = NM['7♯5'];
  NM['m7#5'] = NM['m7♯5'];
  NM['mMaj7#5'] = NM['mMaj7♯5'];
  NM['(b5)'] = NM['(♭5)'];
  NM['m(#5)'] = NM['m(♯5)'];

  const SCI: Record<string, string> = {
    Ionian: 'The major scale: bright and resolved.',
    Dorian: 'Minor with a raised 6th: soulful and jazzy.',
    Phrygian: 'Minor with a ♭2: dark, Spanish.',
    Lydian: 'Major with a ♯4: dreamy and floating.',
    Mixolydian: 'Major with a ♭7: bluesy, the dominant scale.',
    Aeolian: 'The natural minor scale: sad and serious.',
    Locrian: 'Diminished 5th above the tonic: unstable.',
    'Harmonic minor': 'Minor with a major 7th: classical and exotic (augmented 2nd).',
    'Melodic minor': 'Minor with major 6th and 7th: smooth and jazzy.',
    'Lydian dominant': 'Mixolydian with a ♯4: bright dominant sound.',
    Altered: 'Every tension altered: the super-tense dominant scale.',
    'Phrygian dominant': 'Phrygian with a major 3rd: flamenco and Middle Eastern.',
    'Major pentatonic': 'Five notes, no half steps: open and happy.',
    'Minor pentatonic': 'Five notes: the backbone of blues and rock solos.',
    'Blues scale': 'Minor pentatonic plus the ♭5 "blue note".',
    'Major blues': 'Major pentatonic plus a ♭3 blue note: sunny, country-blues.',
    'Whole-tone': 'Six notes all a whole step apart: dreamy, no resolution.',
    'Diminished (half-whole)': 'Alternating half and whole steps: played over dominant 7♭9 chords.',
    'Diminished (whole-half)': 'Alternating whole and half steps: played over diminished 7th chords.',
    Augmented: 'Alternating minor 3rd and half step: mysterious, symmetrical.',
    'Bebop dominant': 'Mixolydian plus a passing major 7th, so chord tones land on the beat.',
    'Bebop major': 'Major scale plus a passing ♯5.',
    'Bebop Dorian': 'Dorian plus a passing major 3rd.',
    'Harmonic major': 'Major scale with a ♭6: bittersweet.',
    'Double harmonic': 'Two augmented 2nds: Byzantine, Arabic colour.',
    'Hungarian minor': 'Harmonic minor with a ♯4: dramatic and Eastern European.',
    Hirajoshi: 'Japanese pentatonic scale: haunting and sparse.',
    Chromatic: 'All twelve notes, each a half step apart.',
  };

  const PX: Record<string, string> = {
    'secondary dominant': 'A dominant 7th a perfect 5th above the target chord. It borrows the pull of V7 to make that chord feel like a temporary tonic.',
    'tritone substitute': 'A dominant 7th a tritone away from the V7. It shares the same 3rd and 7th (swapped) and resolves down by a half step.',
    'leading-tone diminished 7th': 'A diminished 7th chord a half step below the target. It shares notes with V7♭9 and resolves up by a half step.',
    'backdoor dominant': 'A ♭VII7 borrowed from Mixolydian that resolves to the tonic from above: a gentler, plagal-style dominant.',
    'chromatic mediant': 'A chord whose root is a third from the tonic with little in common functionally: a cinematic colour shift.',
    'Neapolitan chord': 'A major chord on ♭II, usually in first inversion, that leads to V.',
    'Italian augmented 6th': 'Built on ♭6: ♭6, 1 and ♯4. The ♭6 and ♯4 resolve outward to 5.',
    'German augmented 6th': '♭6, 1, ♭3 and ♯4: sounds like a dominant 7th but resolves to V.',
    'French augmented 6th': '♭6, 1, 2 and ♯4: two tritones, a bright, symmetrical sound.',
  };

  const CTD: Record<string, string> = {
    auth: 'V → I: the strongest ending. The leading tone rises and the dominant root falls to the tonic.',
    plag: 'IV → I: the "Amen" cadence, softer, with no leading tone.',
    half: 'Ends on V: an open pause, like a comma.',
    dec: 'V → vi: the ear expects I but hears vi, so the phrase continues.',
    phry: 'iv → V in minor: the bass falls a half step to V, dramatic and old.',
    pic: 'A minor progression ending on a major tonic (the "Picardy third").',
  };

  const HD: Record<string, string> = {
    'h:mii': 'The minor ii–V–i: a half-diminished ii, an altered V and a minor tonic. The backbone of jazz minor tunes.',
    'h:cli': 'A chromatic line cliché: one voice descends (root, major 7th, 7th, 6th) over a static minor chord.',
    'h:bd': 'The backdoor: a minor iv or ii leading through ♭VII7 to I from above, using borrowed Mixolydian colour.',
  };

  const GF: Record<string, string> = {
    classical: 'Clear, balanced figures with steady, evenly spaced notes.',
    pop: 'Simple, supportive patterns; the harmony carries the song.',
    jazz: 'Swung and syncopated, with 7th chords and shell or rootless voicings.',
    blues: 'Shuffle feel; repeating left-hand riffs drive a 12-bar form.',
    gospel: 'Rich and soulful, with octave bass walks and rolling fills.',
    latin: 'Syncopated, cyclic grooves where the bass and the montuno interlock.',
    neosoul: 'Laid-back, behind the beat, with extended chords (9ths, 11ths, 13ths).',
    motown: 'Driving, melodic basslines and punchy repeated chords.',
    country: 'Alternating bass and slides: the "boom-chick" feel.',
    rock: 'Driving eighth-note octaves and hard-hitting chords.',
    reggae: 'Off-beat chops; the bass leaves space on the beat.',
    ragtime: 'Oom-pah bass with a syncopated right hand.',
    worship: 'Open, atmospheric pads and flowing arpeggios.',
  };

  const IR = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const DN = [
    'Tonic',
    'Supertonic',
    'Mediant',
    'Subdominant',
    'Dominant',
    'Submediant',
    'Leading tone / Subtonic',
  ];
  const FN = [
    'Tonic',
    'Predominant',
    'Tonic (substitute)',
    'Predominant',
    'Dominant',
    'Tonic (substitute)',
    'Dominant',
  ];

  /* =====================================================================
     19. DETAILS PANEL
     ===================================================================== */
  const row = (k: string, v: any) => `<div class=ir><span>${k}</span><b>${v}</b></div>`;
  const chips = (a: string[]) => a.map(n => `<span class=nt>${n}</span>`).join('');
  const para = (t: string) => `<p class=ip>${t}</p>`;
  const ivn = (s: number) =>
    s <= 12 ? IS[s][0] : IS[s - 12][0] + ' + octave';

  const place = (pc: number) => {
    const di = C.sc.length == 7 ? C.sc.indexOf((pc - C.r + 12) % 12) : -1;
    return di >= 0
      ? `${DN[di]} (${IR[di]}) of ${C.k} ${C.m} · ${FN[di]}`
      : 'Outside the key (chromatic)';
  };

  const LO: Record<number, number> = {
    0: 0,
    1: 1,
    2: 1,
    3: 2,
    4: 2,
    5: 3,
    6: 4,
    7: 4,
    8: 4,
    9: 5,
    10: 6,
    11: 6,
    12: 0,
    13: 1,
    14: 1,
    15: 1,
    16: 2,
    17: 3,
    18: 3,
    19: 4,
    20: 5,
    21: 5,
  };

  function spellChord(pc: number, I: number[], sf: string | null) {
    const L0 = LN.indexOf(pn(pc)[0]);
    return I.map((i, j) => {
      const o =
        sf && /quartal/.test(sf)
          ? (j * 3) % 7
          : sf && /dim7/.test(sf) && i == 9
            ? 6
            : LO[i] ?? 0;
      const l = (L0 + o) % 7;
      const t = (pc + i) % 12;
      let a = ((t - LET[l]) % 12 + 12) % 12;
      if (a > 6) a -= 12;
      return [t, l, a];
    });
  }

  function chordInfo(c: any) {
    const I = c.base || c.ints;
    const sf = c.sf == null ? null : c.sf.trim();
    const sfNorm =
      sf == null ? '___' : sf.replace(/b(?=\d)/g, '♭').replace(/#/g, '♯');
    const n = NM[sf ?? '___'] || NM[sfNorm];
    const ns = spellChord(c.pc, I, c.sf).map(([_t, l, a]) => LN[l] + ACC[a]);
    const rt = pn(c.pc);

    let h =
      `<h4>${c.n}</h4>` +
      (c.v
        ? para(
            'A ' +
              c.v +
              ' voicing: the same chord arranged in a particular way for the hands.',
          )
        : n
          ? para(n[2])
          : sf == null
            ? para(
                'An upper-structure triad: a major triad built above a dominant 7th chord, adding colourful extensions (9th, ♯11th, 13th).',
              )
            : '');

    if (c.ty && PX[c.ty.split(' (')[0]]) h += para(PX[c.ty.split(' (')[0]]);

    h +=
      row('Full name', n ? n[0] : 'Chord') +
      (n ? row('Also written', n[1].replace(/C/g, rt)) : '') +
      row('Root', rt) +
      row('Notes', chips(ns)) +
      row(
        'Formula',
        chips(
          I.map((i: number) =>
            sf && /dim7/.test(sf) && i == 9 ? '𝄫7' : DG[i] || String(i),
          ),
        ),
      ) +
      row('Intervals above root', I.slice(1).map(ivn).join(', '));

    if (c.lhInv != null && c.lhInv !== c.inv) {
      h += row('LH Inversion', INV[c.lhInv]);
    }
    if (c.inv) {
      const fg = I.length == 3 ? ['5/3', '6', '6/4'] : ['7', '6/5', '4/3', '4/2'];
      h +=
        row('Inversion', INV[c.inv] + ' (bass ' + (ns[c.inv] || rt) + ')') +
        row('Figured bass', fg[c.inv] || '–');
    } else if (c.inv === 0)
      h += row('Inversion', 'Root position (bass ' + rt + ')');

    if (c.bp != null)
      h += row(
        'Bass note',
        pn(c.bp) +
          (c.tone
            ? ' – a chord tone, so this is an inversion written as a slash chord'
            : ' – not in the chord, giving a hybrid or polychord sound'),
      );

    return (
      h +
      row(
        'In the key',
        c.bo ? 'Borrowed from a parallel mode' : place(c.pc),
      )
    );
  }

  function scaleInfo(c: any) {
    const sc = c.sc;
    const ns = sc.map((s: number) => pn((c.r + s) % 12));
    const M = [0, 2, 4, 5, 7, 9, 11];
    const full = sc.length == 7 && !c.ar && !c.tech;
    const fm = sc.map((s: number, i: number) =>
      full ? (s == M[i] ? '' : s < M[i] ? '♭' : '♯') + (i + 1) : DG[s],
    );
    const st = sc
      .map((s: number, i: number) => {
        const d = (i < sc.length - 1 ? sc[i + 1] : 12) - s;
        return d == 1 ? 'H' : d == 2 ? 'W' : d == 3 ? 'W+H' : d + ' st';
      })
      .join(' – ');

    let h =
      `<h4>${ns[0]} ${c.m}${c.ar ? ' arpeggio' : ''}</h4>` +
      para(
        c.ar
          ? 'The notes of the chord played one at a time.'
          : c.tech
            ? 'Technique exercise pattern across the selected key.'
            : SCI[c.m] ||
              'A mode of the melodic or harmonic minor family; see the formula for its character.',
      ) +
      row('Notes', chips(ns)) +
      row('Formula', chips(fm));

    if (!c.ar && !c.tech)
      h +=
        row('Step pattern', st) +
        row('Notes in scale', sc.length) +
        (sc.length == 7
          ? row(
              'Tonic chord',
              ns[0] + suf([0, sc[2] - sc[0], sc[4] - sc[0], sc[6] - sc[0]]),
            )
          : '');

    return h + (c.ar || c.tech ? '' : para('W = whole step, H = half step.'));
  }

  function intInfo(c: any) {
    const s = c.iv[1];
    const I = IS[s <= 12 ? s : s - 12];
    const ns = S.q.exp.map((m: number) => sm(m).n);

    return (
      `<h4>${c.iv[0]}</h4>` +
      para(I[3]) +
      row('Notes', chips(ns)) +
      row('Abbreviation', I[1]) +
      row('Semitones', s) +
      row('Quality', I[2]) +
      row('Direction', c.up ? 'Played above the root' : 'Played below the root') +
      (s <= 12
        ? row('Inversion', IS[12 - s][0] + ' (the octave complement)')
        : row('Simple form', IS[s - 12][0] + ' (an octave lower)'))
    );
  }

  function listInfo(q: any) {
    const rm = q.rom || [];
    return q.ch
      .filter((c: any) => !c.rest)
      .map((c: any, i: number) =>
        row(
          (rm[i] || '') + (rm[i] ? ' · ' : '') + c.name.split(' · ')[0],
          c.pc == null ? '' : place(c.pc),
        ),
      )
      .join('');
  }

  function teachGuideHTML(q: any) {
    if (S.studyMode != 'teach' || !q) return '';
    const bits: string[] = [];
    const activeItem = q.ch ? q.ch[q.pos] : q;
    if (activeItem?.vlFingeringRh || activeItem?.vlFingeringLh) {
      const fParts: string[] = [];
      if (activeItem.vlFingeringLh) {
        fParts.push(`LH ${formatFingeringText(activeItem.vlFingeringLh)}`);
      }
      if (activeItem.vlFingeringRh) {
        fParts.push(`RH ${formatFingeringText(activeItem.vlFingeringRh)}`);
      }
      if (fParts.length) {
        bits.push(row('Suggested fingering', fParts.join(' · ')));
      }
    } else if (q.fgd) {
      const D = q.fgd;
      const idx = q.ch ? Math.min(q.pos, D[2].length - 1) : 0;
      const fArr = ((q.g == 'scale' || q.g == 'mel') && !q.steps)
        ? D[2].map((x: any) => x[0])
        : q.steps
          ? D[2].flat()
          : D[2][idx];
      const hArr = ((q.g == 'scale' || q.g == 'mel') && !q.steps)
        ? D[1].map((x: any) => x[0])
        : q.steps
          ? D[1].flat()
          : D[1][idx];
      if (fArr?.length && hArr?.length && !q.steps && q.g != 'scale' && q.g != 'mel') {
        const lhF = fArr.filter((_: any, i: number) => hArr[i] == 'L');
        const rhF = fArr.filter((_: any, i: number) => hArr[i] == 'R');
        const fmtSingle = (v: number | string) =>
          String(v).includes('/') ? `(${v})` : String(v);
        const fmtF =
          lhF.length && rhF.length
            ? `LH ${lhF.map(fmtSingle).join(' ')} · RH ${rhF.map(fmtSingle).join(' ')}`
            : lhF.length
              ? `LH ${lhF.map(fmtSingle).join(' ')}`
              : `RH ${rhF.map(fmtSingle).join(' ')}`;
        bits.push(row('Suggested fingering', fmtF));
      }
    }
    if (q.vlInfo) {
      const m = q.vlInfo;
      const vlParts: string[] = [];
      if (S.rangeLocked) {
        vlParts.push('Locked window', m.inversionLabel);
      } else {
        const arr = m.direction === 'down' ? '↓' : '↑';
        const sh =
          m.handShift === 0
            ? 'shift 0'
            : `shift ${m.handShift > 0 ? '+' : ''}${m.handShift}`;
        vlParts.push(
          `${arr} ${m.direction}`,
          m.inversionLabel,
          sh,
          m.shapeChange ? 'shape changed' : 'same shape',
        );
      }
      if (m.commonTonesKept > 0) vlParts.push(`common ${m.commonTonesKept}`);
      if (m.adjusted) vlParts.push('adjusted');
      if (m.omittedFifth) vlParts.push('5th omitted');
      bits.push(row('Voice leading', vlParts.join(' · ')));
      if (m.warning) bits.push(row('Voice-leading note', m.warning));
    }
    if (q.tinfo) bits.push(para(q.tinfo));
    if (q.g == 'prog' || q.g == 'pat') {
      bits.push(
        para(
          'Click any chord step below the keyboard to inspect its voicing and voice-leading movement, or press Listen to hear it.',
        ),
      );
    } else if (q.g == 'ear') {
      bits.push(
        para(
          'Class listening mode: hear how the structure sounds and compare its shape on the staff and keyboard.',
        ),
      );
    } else {
      bits.push(
        para(
          'Untimed class mode: study the intervals, finger numbers, and keyboard shape—play along freely on MIDI or keyboard with zero scoring pressure.',
        ),
      );
    }
    return `<div class="teach-guide-sep"></div>` + bits.join('');
  }

  function degTableHTML(
    degrees: HarmonizedDegreeInfo[],
    activeDegrees: number[] = [],
  ) {
    return (
      `<div class="harm-deg-table">` +
      degrees
        .map(d => {
          const on = activeDegrees.includes(d.degree);
          return (
            `<div class="harm-deg-row${on ? ' on' : ''}">` +
            `<span class="deg-rom">${d.roman}</span>` +
            `<span class="deg-nns">${d.nashville}</span>` +
            `<span class="deg-name">${d.chordName}</span>` +
            `<span class="deg-qual">${d.qualityLabel}</span>` +
            `<span class="deg-notes">${d.noteNames.join(' ')}</span>` +
            `</div>`
          );
        })
        .join('') +
      `</div>`
    );
  }

  function shapesNearTonicHTML(q: any) {
    if (!C?.sc || C.sc.length < 7) return '';
    const degrees = harmonizeScaleDegrees(C.sc, 3, C.r, C.names);
    if (!degrees.length) return '';

    const specs = degrees.map(d => ({
      degreeIndex: d.degree,
      chordName: `${d.roman} · ${d.chordName}`,
      chord: {root: d.pc, ints: d.ints, name: d.chordName},
    }));

    const options: {val: string; label: string; chord: {root: number; ints: number[]; name: string}}[] = degrees.map(
      d => ({
        val: `deg:${d.degree}`,
        label: `${d.roman} (${d.chordName})`,
        chord: {root: d.pc, ints: d.ints, name: d.chordName},
      }),
    );

    if (q?.ci?.k === 'chord' && q.ci.pc != null && q.ci.ints?.length) {
      options.unshift({
        val: 'current',
        label: `Current: ${q.ci.n}`,
        chord: {root: q.ci.pc, ints: q.ci.ints, name: q.ci.n},
      });
    }

    const sel =
      options.find(o => o.val === S.famAnchorChord) ||
      options.find(o => o.val === 'deg:0') ||
      options[0];
    const families = generateShapesNearChord(
      sel.chord,
      C.r,
      C.sc,
      specs,
      DEFAULT_VL_RANGE,
    );

    return (
      `<div class="fam-box">` +
      `<div class="fam-head">` +
      `<h5>Shapes near ${sel.chord.name}</h5>` +
      `<select id="famAnchor" class="fam-select" aria-label="Re-anchor families on chord">` +
      options
        .map(
          o =>
            `<option value="${o.val}"${o.val === sel.val ? ' selected' : ''}>Anchor: ${o.label}</option>`,
        )
        .join('') +
      `</select>` +
      `</div>` +
      families
        .map(
          fam =>
            `<div class="fam-group">` +
            `<div class="fam-anchor-title">Near ${fam.anchorLabel}</div>` +
            `<div class="fam-grid">` +
            fam.shapes
              .map(
                sh =>
                  `<button type="button" class="fam-chip" data-notes="${sh.notes.join(',')}" title="Click to hear and highlight">${`<strong>${sh.chordName}</strong><span>${sh.notes.map(m => sm(m).n).join(' ')}</span>`}</button>`,
              )
              .join('') +
            `</div>` +
            `</div>`,
        )
        .join('') +
      `</div>`
    );
  }

  function infoHTML(q: any) {
    const c = q.ci;
    if (!c) return '';
    let base = '';
    if (c.k == 'chord') base = chordInfo(c);
    else if (c.k == 'scale') base = scaleInfo(c);
    else if (c.k == 'int') base = intInfo(c);
    else if (c.k == 'harm_scale') {
      const modeLbl = getModeDisplayLabel(C.m);
      const activeDegs =
        c.deg != null
          ? [c.deg]
          : q.ch
            ? [q.pos % c.degrees.length]
            : [];
      base =
        `<h4>${C.k} ${modeLbl} · Harmonized ${c.sz == 4 ? '7th chords' : 'triads'}</h4>` +
        para(
          `Chords are built by stacking thirds (${c.sz == 4 ? '1–3–5–7' : '1–3–5'}) from the scale notes. Every quality follows directly from the mode's interval steps.`,
        ) +
        row('Scale notes', chips(c.scaleNames || C.names)) +
        degTableHTML(c.degrees, activeDegs);
    } else if (c.k == 'harm_c2s') {
      base =
        `<h4>${c.chordName} → Matching Scales</h4>` +
        (c.contextLabel ? row('Context', c.contextLabel) : '') +
        row('Chord tones', chips(c.chordNotes)) +
        row('Primary scale', c.validNames[0]) +
        (c.validNames.length > 1
          ? row('Other valid options', c.validNames.slice(1).join(' · '))
          : '') +
        para(c.explanation) +
        row(`${c.validNames[0]} notes`, chips(c.scaleNotes));
    } else if (c.k == 'harm_mchar') {
      base =
        `<h4>${c.keyName} ${getModeDisplayLabel(c.mode)} · Mode Character</h4>` +
        row('Characteristic note', c.characteristicNote) +
        row(
          'Characteristic chord',
          `${c.primary.roman} · ${c.primary.chordName} (Nashville ${c.primary.nashville})`,
        ) +
        (c.alternates?.length
          ? row(
              'Also characteristic',
              c.alternates
                .map((a: HarmonizedDegreeInfo) => `${a.roman} (${a.chordName})`)
                .join(' · '),
            )
          : '') +
        para(c.summary) +
        para(c.cadenceHint) +
        degTableHTML(c.degrees, c.characteristicChordDegrees || []);
    } else if (c.k == 'pat')
      base =
        `<h4>${q.pn.split(' · ')[1]}</h4>` +
        para(GF[c.g]) +
        row('Genre', GEN.find(g => g[0] == c.g)![1]) +
        row('Progression', c.prog + ' in ' + C.k) +
        row(
          'Steps',
          q.ch.filter((x: any) => !x.rest).length + ' notes or chords',
        ) +
        listInfo(q);
    else {
      let t = '';
      if (q.hf && q.hf.startsWith('cad')) t = CTD[q.hf.slice(4)];
      else if (q.hf) t = HD[q.hf];
      base =
        `<h4>${q.pn}</h4>` +
        para(
          t ||
            'A chord progression: each Roman numeral / Nashville number is a chord built on that degree of the key.',
        ) +
        row('Key', C.k) +
        listInfo(q);
    }
    const famView = ['chord', 'prog', 'harm_scale'].includes(c.k)
      ? shapesNearTonicHTML(q)
      : '';
    return base + famView + teachGuideHTML(q);
  }

  function fillInfo() {
    const q = S.q;
    $('it').textContent =
      (
        {
          chord: S.studyMode == 'teach' ? 'Chord Class' : 'Chord',
          scale: S.studyMode == 'teach' ? 'Scale Class' : 'Scale',
          int: S.studyMode == 'teach' ? 'Interval Class' : 'Interval',
          pat: S.studyMode == 'teach' ? 'Pattern Class' : 'Pattern',
          prog: S.studyMode == 'teach' ? 'Progression Class' : 'Progression',
          harm_scale:
            S.studyMode == 'teach' ? 'Scale Harmony Class' : 'Scale Harmony',
          harm_c2s:
            S.studyMode == 'teach' ? 'Chord to Scale Class' : 'Chord to Scale',
          harm_mchar:
            S.studyMode == 'teach' ? 'Mode Character Class' : 'Mode Character',
        } as any
      )[q.ci?.k] || (S.studyMode == 'teach' ? 'Class Details' : 'Details');
    $('ib').innerHTML = infoHTML(q);
  }

  function openInfo() {
    if (S.ok || S.studyMode == 'teach') {
      const wasOpen = $('app').classList.contains('io');
      $('app').classList.add('io');
      fillInfo();
      if (wasOpen) {
        const ip = $('ip') as HTMLElement | null;
        ip?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
      }
    }
  }

  function syncInfo(q: any, nameOk: boolean, shown: boolean) {
    const isTeach = S.studyMode == 'teach';
    const ok =
      (isTeach || $('dtl').checked) &&
      !!q.ci &&
      (isTeach ? true : q.g == 'ear' ? shown : nameOk);
    const el = $('q');
    S.ok = ok;
    el.classList.toggle('clk', ok);

    if (ok)
      el.insertAdjacentHTML(
        'beforeend',
        '<svg class=iq viewBox="0 0 20 20" width=18 height=18 fill=none stroke=currentColor stroke-width=1.6 stroke-linecap=round aria-hidden="true"><circle cx=10 cy=10 r=8.2 /><line x1=10 y1=9 x2=10 y2=14 /><circle cx=10 cy=6.3 r=.5 /></svg>',
      );

    if ($('app').classList.contains('io')) {
      if (ok) fillInfo();
      else {
        $('it').textContent = 'Details';
        $('ib').innerHTML = para('Details appear once the name is visible.');
      }
    }
  }

  /* =====================================================================
     20. QUESTION GENERATION
     ===================================================================== */
  function buildScaleQuestion(q: any, cl: string, _CL: string) {
    let dir = $('dir').value;
    const mi = +$('inv').value;
    const exinv = $('exinv').checked;
    const rangeMode = ($('scrange').value || '1') as ScaleRangeMode;
    const multiChoice = ($('scmultioct')?.value || 'auto') as MultiOctaveChoice;
    const hands = ($('schands').value || 'right') as ScaleHandsMode;
    const contraryStart = ($('sccontrary')?.value || 'unison') as ContraryStartMode;
    const isArp = ['arp3', 'arp7', 'arpd'].includes(S.f);
    const isFixedPattern = S.f == 'five' || S.f == 'hanon';

    if (dir == 'any')
      dir = ORD() ? (S.n % 2 == 0 ? 'up' : 'down') : rand(2) ? 'up' : 'down';

    // Determine scale / arpeggio / technique intervals
    let baseInts: number[] = [];
    let arpInv = 0;
    let labelSuffix = '';
    let arpRootPc = C.r;
    let arpTitle = C.names[0] + ' ' + C.m;

    if (S.f == 'five') {
      baseInts = C.sc.slice(0, 5);
      labelSuffix = ' 5-finger position';
    } else if (S.f == 'hanon') {
      // Hanon #1 style ascending pattern in the key (1-3-4-5-6-5-4-3)
      const s = (i: number) => C.sc[i % 7] + 12 * Math.floor(i / 7);
      baseInts = [0, 2, 3, 4, 5, 4, 3, 2, 1, 3, 4, 5, 6, 5, 4, 3].map(j => s(j));
      labelSuffix = ' · Hanon #1 drill';
    } else if (isArp) {
      let rawInts =
        S.f == 'arp3'
          ? [0, 2, 4].map(i => C.sc[i])
          : S.f == 'arp7'
            ? [0, 2, 4, 6].map(i => C.sc[i])
            : ORD()
              ? S.n % 2 == 0
                ? [0, 4, 7, 10]
                : [0, 3, 6, 9]
              : rand(2)
                ? [0, 4, 7, 10]
                : [0, 3, 6, 9];

      if (S.f == 'arpd') {
        const isDom = rawInts[1] == 4;
        arpTitle = C.names[0] + (isDom ? '7' : 'dim7');
      }
      const mxInv = Math.min(mi, rawInts.length - 1);
      arpInv = exinv
        ? mxInv
        : ORD()
          ? Math.floor(S.n / ($('dir').value == 'any' ? 2 : 1)) % (mxInv + 1)
          : rand(mxInv + 1);
      baseInts = [...rawInts];
      for (let i = 0; i < arpInv; i++) baseInts.push(baseInts.shift()! + 12);
      baseInts = baseInts.map(x => x - baseInts[0]);
      arpRootPc = (C.r + (rawInts[arpInv] % 12)) % 12;
      labelSuffix = ' arpeggio' + (arpInv ? ' (' + INV[arpInv] + ')' : '');
    } else {
      baseInts = [...C.sc];
    }

    const built = buildScaleHandSequences({
      baseInts,
      rootPc: arpRootPc,
      rangeMode,
      multiChoice,
      dir: dir === 'down' ? 'down' : 'up',
      hands,
      contraryStart,
      clef:
        hands === 'left'
          ? 'bass'
          : hands === 'right'
            ? 'treble'
            : cl === 'bass'
              ? 'bass'
              : cl === 'treble'
                ? 'treble'
                : 'grand',
      lo: S.lo,
      hi: S.hi,
      isFixedPattern,
    });

    if (hands == 'parallel' || hands == 'contrary') {
      S.cl = 'grand';
      q.steps = built.steps;
      q.rhSeq = built.rhSeq;
      q.lhSeq = built.lhSeq;
      q.seq = built.rhSeq;
      q.exp = [...new Set(built.steps.flat())].sort((a, b) => a - b);
      q.main = arpTitle + labelSuffix;
      q.lab = C.m + labelSuffix;
      const handLabel =
        hands == 'contrary'
          ? built.effectiveContraryStart === 'unison'
            ? 'both hands (contrary · same note)'
            : 'both hands (contrary · 1 oct apart)'
          : 'both hands (parallel)';
      q.top = `${C.k} ${C.m} · ${handLabel}`;
      q.topAnon = handLabel;
      const lh0 = built.lhSeq![0];
      const rh0 = built.rhSeq[0];
      q.startDesc =
        lh0 === rh0
          ? 'start unison ' + smOct(rh0)
          : 'LH ' + smOct(lh0) + ' · RH ' + smOct(rh0);
      q.startDescAny = q.startDesc;
      q.sub =
        dir +
        ' · ' +
        (isFixedPattern ? 'pattern' : built.effectiveOctaves + ' oct');
      q.ans = built.rhSeq.map((m: number) => sm(m).n).join(' ');
    } else {
      const isLeft = hands === 'left' || (hands === 'one' && cl === 'bass');
      S.cl = isLeft ? 'bass' : 'treble';
      q.hand = isLeft ? 'L' : 'R';
      const handLabel = isLeft ? 'left hand' : 'right hand';
      q.seq = built.rhSeq;
      q.exp = built.rhSeq;
      q.main = arpTitle + labelSuffix;
      q.lab = C.m + labelSuffix;
      q.top = `${C.k} ${C.m} · ${handLabel}`;
      q.topAnon = handLabel;
      q.startDesc = 'start ' + smOct(built.rhSeq[0]);
      q.startDescAny = q.startDesc;
      q.sub =
        dir +
        ' · ' +
        (isFixedPattern ? 'pattern' : built.effectiveOctaves + ' oct');
      q.ans = built.rhSeq.map((m: number) => sm(m).n).join(' ');
    }

    q.ci = {
      k: 'scale',
      m: C.m,
      sc: baseInts.slice(0, 8),
      r: C.r,
      ar: isArp,
      tech: isFixedPattern,
    };
  }

  function newQ() {
    applyFocus();
    hideShiftOverlay();
    ctx();
    $('ans').innerHTML = '';

    const g = $('game').value;
    const mi = +$('inv').value;
    const lhi = +$('lhinv').value;
    const cl = $('clef').value;
    const ctxT = C.k + ' ' + C.m;
    const CL = (
      {
        treble: 'treble clef',
        bass: 'bass clef',
        grand: 'both hands',
        none: 'no staff',
      } as any
    )[cl] || 'treble clef';

    const q: any = {
      g,
      pos: 0,
      err: 0,
      revealed: false,
      peeked: false,
      hit: new Set<number>(),
      bad: new Set<number>(),
      played: [] as number[],
    };

    if (g == 'chord' || g == 'pass' || g == 'slash') {
      let c: any;
      const exinv = $('exinv').checked;

      if (g == 'pass') {
        const s = (i: number) => C.sc[i % 7] + 12 * Math.floor(i / 7);
        const pt = S.pt;
        const o = ORD();
        const T =
          typeof pt == 'number'
            ? TY[pt]
            : pt == 'med'
              ? TY[4 + (o ? Math.floor(S.n / 7) % 4 : rand(4))]
              : pt == 'nea'
                ? TY[8]
                : pt == 'aug'
                  ? TY[9 + (o ? Math.floor(S.n / 7) % 3 : rand(3))]
                  : TY[o ? Math.floor(S.n / 7) % 4 : rand(4)];
        const t = T[4] ? 0 : o ? S.n % 7 : rand(7);
        const tri = [0, 2, 4, 6].map(j => s(t + j) - s(t));
        const tr = (C.r + C.sc[t]) % 12;
        const tn = C.names[t] + suf(tri);
        const rp = (tr + T[1]) % 12;

        if ([1, 3, 8, 10].includes(T[1])) {
          const fx = (p: number) => {
            const f = FL[p];
            C.sp[p] = {l: LN.indexOf(f[0]), a: f[1] == '♭' ? -1 : 0};
          };
          if (T[3].includes('+6')) fx(rp);
          else
            T[2].forEach(i => {
              const p = (rp + i) % 12;
              if (!C.sc.some((x: number) => (C.r + x) % 12 == p)) fx(p);
            });
        }

        c = {
          ints: T[2],
          pc: rp,
          sf: T[3],
          name: pn(rp) + T[3],
          lab: T[0].split(' (')[0],
        };
        q.main = '→ ' + tn;
        q.type = T[0];
      } else c = genChord(mi, lhi, exinv);

      if (g != 'pass' && (c.d == null || c.bo))
        spellChord(c.pc, c.base || c.ints, c.sf).forEach(([t, l, a]) => {
          C.sp[t] = {l, a};
        });

      const mx = Math.min(mi, c.ints.length - 1);
      const inv =
        c.inv != null
          ? c.inv
          : exinv
            ? mx
            : ORD()
              ? S.n % (mx + 1)
              : rand(mx + 1);
      const lhInv = c.lhInv ?? inv;
      let actualInv = inv;
      let actualLhInv = lhInv;
      let nme = c.name;
      q.lab = c.lab;

      if (g == 'slash') {
        const bt = $('bass').value;
        const cp = c.ints.map((x: number) => (c.pc + x) % 12);
        const toneMatch = bt == 'chord' || (bt == 'any' && rand(2) == 1);
        let bp: number;

        if (toneMatch)
          bp =
            c.slashIdx != null
              ? cp[c.slashIdx % cp.length]
              : cp[1 + (ORD() ? S.n % (cp.length - 1) : rand(cp.length - 1))];
        else {
          const P = R(0, 11).filter(p => !cp.includes(p));
          bp = P[ORD() ? Math.floor(S.n / 12) % P.length : rand(P.length)];
        }

        const zU = cl == 'bass' ? [28, 64] : [57, 96];
        let ch: number[] = [],
          b: number | undefined;
        for (let k = 0; k < 25 && b == null; k++) {
          ch = put(c.ints, c.pc, ORD() ? 0 : rand(mx + 1), zU);
          const L = R(
            Math.max(S.lo, cl == 'grand' ? 28 : 0),
            Math.min(ch[0] - 1, cl == 'grand' ? 60 : 127),
          ).filter(m => m % 12 == bp);
          if (L.length) b = L[rand(L.length)];
        }
        if (b == null) b = ch[0] - ((ch[0] - bp + 120) % 12 || 12);

        q.exp = [b, ...ch];
        q.hd = ['L', ...ch.map(() => (cl == 'bass' ? 'L' : 'R'))];
        q.bp = bp;
        q.tone = toneMatch;
        nme = c.name + '/' + pn(bp);
        q.main = nme;
        q.lab = toneMatch ? 'slash (chord-tone bass)' : 'slash (outside bass)';
        q.top = `${ctxT} · ${CL}`;
        q.topAnon = CL;
        q.sub = 'Bass note low, chord above';
      } else {
        const useSmoothChord =
          (g == 'chord' || g == 'pass') && $('vlead').checked;
        const tolExact = $('tol').value == 'exact';
        const hasPrev = !!(S.prevRh?.length || S.prevLh?.length);
        const startFreeAnyOct = useSmoothChord && !tolExact && !S.relLocked;

        if (useSmoothChord && hasPrev) {
          q.prevRh = S.prevRh ? [...S.prevRh] : null;
          q.prevLh = S.prevLh ? [...S.prevLh] : null;
          q.prevRhF = S.prevRhF ? [...S.prevRhF] : null;
          q.prevLhF = S.prevLhF ? [...S.prevLhF] : null;
        }

        const isFixedShapeVoicing = c.v == 'open' || c.v == 'quartal';
        const isDrop2Voicing = c.v == 'drop2';
        const bh = curBh();
        const useSlidingEngine = useSmoothChord && !isFixedShapeVoicing;

        let voiced: {
          notes: number[];
          hd: string[];
          lhLen: number;
          rhLen: number;
          lhInv: number;
          rhInv: number;
        };
        let engRes: EngineVoicedResult | null = null;

        if (useSlidingEngine) {
          engRes = runEngineVoice({
            ints: c.ints,
            pc: c.pc,
            cl,
            bh,
            rangeMode: S.rangeLocked ? 'locked' : 'unlocked',
            direction: S.vlDir,
            prevRh: hasPrev ? S.prevRh : null,
            prevRhF: hasPrev ? (S.prevRhF as number[] | null) : null,
            prevAnchorRh: hasPrev ? S.vlAnchorRh : null,
            prevDirRh: hasPrev ? S.vlPrevDirRh : null,
            prevLh: hasPrev ? S.prevLh : null,
            prevLhF: hasPrev ? (S.prevLhF as number[] | null) : null,
            prevAnchorLh: hasPrev ? S.vlAnchorLh : null,
            prevDirLh: hasPrev ? S.vlPrevDirLh : null,
            drop2Base: isDrop2Voicing ? c.base : undefined,
            fixedInv: !hasPrev ? 0 : undefined,
          });
          voiced = engRes;
          q.vlF = engRes.vlF;
          q.vlRhF = engRes.rhF;
          q.vlLhF = engRes.lhF;
          q.vlFingeringRh = engRes.rhFingering || null;
          q.vlFingeringLh = engRes.lhFingering || null;
          q.vlInfo = engRes.vlInfo;
          q.nextVlAnchorRh = engRes.rhOut?.anchorIdx ?? null;
          q.nextVlAnchorLh = engRes.lhOut?.anchorIdx ?? null;
          q.nextVlDirRh = engRes.rhOut?.direction ?? null;
          q.nextVlDirLh = engRes.lhOut?.direction ?? null;

          if (engRes.vlInfo.dirFlipped && S.vlDir !== 'auto') {
            S.vlDir = engRes.vlInfo.direction;
          }
        } else {
          const lockRhZone =
            useSmoothChord && S.rangeLocked ? S.lockZoneRh : null;
          const lockLhZone =
            useSmoothChord && S.rangeLocked ? S.lockZoneLh : null;
          voiced = voice(
            c.ints,
            c.pc,
            isFixedShapeVoicing || (useSmoothChord && !hasPrev) ? 0 : inv,
            isFixedShapeVoicing || (useSmoothChord && !hasPrev) ? 0 : lhInv,
            undefined,
            useSmoothChord ? S.prevRh : null,
            useSmoothChord,
            useSmoothChord ? S.prevLh : null,
            useSmoothChord,
            useSmoothChord ? S.homeRhAvg : null,
            useSmoothChord ? S.homeLhAvg : null,
            isFixedShapeVoicing ? 0 : undefined,
            isDrop2Voicing ? c.base : undefined,
            lockRhZone,
            lockLhZone,
            0,
          );
        }

        q.exp = voiced.notes;
        q.hd = voiced.hd;
        q.lhLen = voiced.lhLen;
        q.rhLen = voiced.rhLen;
        q.isRelChord = useSmoothChord;
        q.relHasPrev = useSmoothChord && hasPrev;
        q.isRelAnchored =
          useSmoothChord &&
          (tolExact || (S.relLocked && S.rangeLocked));

        const isBothSame = bh == 'same';
        const isBothDiff = bh == 'diff';
        actualInv = isFixedShapeVoicing ? 0 : useSmoothChord ? voiced.rhInv : inv;
        actualLhInv = isFixedShapeVoicing ? 0 : useSmoothChord ? voiced.lhInv : lhInv;

        // Only pre-seed Exact-octave chain on newQ; Any-octave locks once the player plays the start chord
        if (useSmoothChord && tolExact && !hasPrev) {
          S.prevRh =
            voiced.rhLen > 0 ? voiced.notes.slice(voiced.lhLen) : null;
          S.prevLh =
            voiced.lhLen > 0 ? voiced.notes.slice(0, voiced.lhLen) : null;
          if (engRes) {
            S.prevRhF = engRes.rhF.length ? engRes.rhF : null;
            S.prevLhF = engRes.lhF.length ? engRes.lhF : null;
            S.vlAnchorRh = engRes.rhOut?.anchorIdx ?? null;
            S.vlAnchorLh = engRes.lhOut?.anchorIdx ?? null;
            S.vlPrevDirRh = engRes.rhOut?.direction ?? (S.vlDir === 'down' ? 'down' : 'up');
            S.vlPrevDirLh = engRes.lhOut?.direction ?? (S.vlDir === 'down' ? 'down' : 'up');
          }
          if (S.prevRh?.length)
            S.homeRhAvg =
              S.prevRh.reduce((a: number, b: number) => a + b, 0) /
              S.prevRh.length;
          if (S.prevLh?.length)
            S.homeLhAvg =
              S.prevLh.reduce((a: number, b: number) => a + b, 0) /
              S.prevLh.length;
          if (S.rangeLocked) {
            if (S.vlAnchorRh != null && S.prevRh?.length) {
              S.lockZoneRh = windowMidiCorridor(S.vlAnchorRh, S.prevRh.length, vlBoundsForHand('R', cl, bh));
            } else {
              S.lockZoneRh = S.prevRh?.length ? computeLockCorridor(S.prevRh) : null;
            }
            if (S.vlAnchorLh != null && S.prevLh?.length && S.prevLh.length > 1) {
              S.lockZoneLh = windowMidiCorridor(S.vlAnchorLh, S.prevLh.length, vlBoundsForHand('L', cl, bh));
            } else {
              S.lockZoneLh = S.prevLh?.length ? computeLockCorridor(S.prevLh) : null;
            }
          }
          S.relLocked = true;
        }

        const mainLowNote =
          voiced.rhLen > 0 ? voiced.notes[voiced.lhLen] : voiced.notes[0];
        const slashNme =
          g == 'chord' &&
          actualInv &&
          cl != 'grand' &&
          !/[\/·]/.test(c.name) &&
          mainLowNote != null &&
          mainLowNote % 12 != c.pc
            ? nme + '/' + pn(mainLowNote % 12)
            : nme;

        if (g == 'chord') {
          q.main = useSmoothChord && hasPrev ? nme : slashNme;
        }

        const invLabel = (iv: number) =>
          isFixedShapeVoicing
            ? c.v + ' stack'
            : c.v?.startsWith('rootless')
              ? iv === 0
                ? 'Type A'
                : iv === 2
                  ? 'Type B'
                  : INV[iv]
              : INV[iv];

        const invDesc = isBothDiff
          ? `LH: ${invLabel(voiced.lhInv)} · RH: ${invLabel(voiced.rhInv)}`
          : cl == 'grand' && bh == 'bass'
            ? `RH: ${invLabel(useSmoothChord ? voiced.rhInv : inv)}`
            : invLabel(isBothSame || useSmoothChord ? voiced.rhInv : inv);

        q.top = `${ctxT} · ${CL}`;
        q.topAnon = CL;
        if (useSmoothChord) {
          const lockStatus = S.rangeLocked ? 'Locked range' : 'Unlocked sliding';
          q.sub =
            (q.type ? 'Play the ' + q.type + ' · ' : '') +
            (hasPrev
              ? `${invDesc} (${lockStatus})`
              : startFreeAnyOct
                ? `Start in any octave · ${invDesc}`
                : `Primary anchor (${IR[S.primDeg]}) · ${invDesc}`);
        } else {
          q.sub = (q.type ? 'Play the ' + q.type + ' · ' : '') + invDesc;
        }

        const ansInvTag = useSmoothChord ? ` · ${invDesc}` : '';
        q.ans =
          (useSmoothChord && hasPrev ? slashNme : g == 'chord' ? q.main : nme) +
          ansInvTag +
          ' (' +
          q.exp.map((m: number) => sm(m).n).join(' ') +
          ')';
      }

      if (g == 'slash') {
        q.ans = nme + ' (' + q.exp.map((m: number) => sm(m).n).join(' ') + ')';
      }
      q.ci = {
        k: 'chord',
        n: nme,
        sf: c.sf,
        ints: c.ints,
        base: c.base,
        pc: c.pc,
        inv: g == 'slash' || c.v ? undefined : actualInv,
        lhInv: curBh() == 'diff' ? actualLhInv : undefined,
        d: c.d,
        bo: c.bo,
        v: c.v,
        ty: q.type,
        bp: q.bp,
      };
    } else if (g == 'harm_close') {
      // Close-range voice leading across two diatonic chords in the chosen key & mode
      q.g = 'prog';
      const sz = +$('size').value == 4 ? 4 : 3;
      const degRoman = (deg: number, sf: string) => {
        const baseRom = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][deg];
        const isMin = sf.startsWith('m') && !sf.startsWith('maj');
        const isDim = sf.includes('dim') || sf.includes('m7♭5');
        const isAug = sf.includes('aug') || sf.includes('♯5');
        const rText = isMin || isDim ? baseRom.toLowerCase() : baseRom;
        const qual = isDim ? (sz == 4 ? 'ø7' : '°') : isAug ? '+' : sz == 4 ? sf.replace(/^m/, '') : '';
        return rText + qual;
      };
      const degNns = (deg: number, sf: string) => {
        const num = String(deg + 1);
        if (sf.includes('m7♭5')) return num + 'm7♭5';
        if (sf.includes('dim')) return num + '°';
        if (sf.startsWith('m') && !sf.startsWith('maj')) return num + 'm';
        return num + sf;
      };

      let d1 = 0;
      let d2 = 2;
      if (ORD()) {
        // Systematically pair I -> ii, iii, IV, V, vi, vii°, then ii -> ...
        const pairIdx = S.n % 42;
        d1 = Math.floor(pairIdx / 6);
        const offset = (pairIdx % 6) + 1;
        d2 = (d1 + offset) % 7;
      } else {
        d1 = rand(7);
        d2 = (d1 + 1 + rand(6)) % 7;
      }

      const c1 = buildDiatonicChord(C, 'all', C.sc, d1, sz, 0, 0, 0);
      const c2 = buildDiatonicChord(C, 'all', C.sc, d2, sz, 0, 0, 0);

      const mx1 = Math.min(mi, c1.ints.length - 1);
      const mxL1 = Math.min(lhi, c1.ints.length - 1);
      const startInv = $('exinv').checked
        ? mx1
        : ORD()
          ? Math.floor(S.n / 42) % (mx1 + 1)
          : rand(mx1 + 1);
      const startLhInv =
        curBh() == 'diff'
          ? $('exinv').checked
            ? mxL1
            : rand(mxL1 + 1)
          : startInv;

      // Anchor starting chord in comfortable middle register for both hands
      const anchorRh = putVoiceLed(c1.ints, c1.pc, null, startInv, [57, 84]);
      const anchorLhMin = Math.max(S.lo, 28);
      const anchorLhMax = Math.max(anchorLhMin + 12, Math.min(62, anchorRh.notes[0] - 1));
      const anchorLh = putVoiceLed(
        c1.ints,
        c1.pc,
        null,
        startLhInv,
        [anchorLhMin, anchorLhMax],
      );

      let exp1: number[];
      let hd1: string[];
      let lhLen1 = 0;
      let rhLen1 = 0;
      let lhInv1 = startInv;
      let rhInv1 = startInv;

      if (cl == 'bass') {
        const b1 = putVoiceLed(c1.ints, c1.pc, null, startInv, [28, 64]);
        exp1 = b1.notes;
        hd1 = exp1.map(() => 'L');
        lhLen1 = exp1.length;
        lhInv1 = b1.inv;
        rhInv1 = b1.inv;
      } else if (cl == 'treble') {
        exp1 = anchorRh.notes;
        hd1 = exp1.map(() => 'R');
        rhLen1 = exp1.length;
        rhInv1 = anchorRh.inv;
      } else if (curBh() == 'same' || curBh() == 'diff') {
        lhInv1 = curBh() == 'same' ? anchorRh.inv : anchorLh.inv;
        exp1 = [...anchorLh.notes, ...anchorRh.notes];
        hd1 = [...anchorLh.notes.map(() => 'L'), ...anchorRh.notes.map(() => 'R')];
        lhLen1 = anchorLh.notes.length;
        rhLen1 = anchorRh.notes.length;
        rhInv1 = anchorRh.inv;
      } else {
        const bass1 = put([0], c1.pc, 0, [Math.max(S.lo, 36), Math.min(59, anchorRh.notes[0] - 1)]);
        exp1 = [...bass1, ...anchorRh.notes];
        hd1 = [...bass1.map(() => 'L'), ...anchorRh.notes.map(() => 'R')];
        lhLen1 = bass1.length;
        rhLen1 = anchorRh.notes.length;
        lhInv1 = 0;
        rhInv1 = anchorRh.inv;
      }

      const prevRh1 = rhLen1 > 0 ? exp1.slice(lhLen1) : null;
      const prevLh1 = lhLen1 > 0 ? exp1.slice(0, lhLen1) : null;

      // Target chord finds the closest inversion from Chord 1 in BOTH hands
      const v2 = voice(
        c2.ints,
        c2.pc,
        0,
        0,
        undefined,
        prevRh1,
        true,
        prevLh1,
        true,
      );

      const describeMotion = (fromNotes: number[], toNotes: number[]) => {
        if (!fromNotes.length || fromNotes.length !== toNotes.length) return '';
        const a = [...fromNotes].sort((x, y) => x - y);
        const b = [...toNotes].sort((x, y) => x - y);
        return a
          .map((m, i) => {
            const diff = b[i] - m;
            return diff === 0
              ? `${sm(m).n}=${sm(b[i]).n}`
              : `${sm(m).n}→${sm(b[i]).n}`;
          })
          .join(', ');
      };

      const rh2 = v2.rhLen > 0 ? v2.notes.slice(v2.lhLen) : [];
      const lh2 = v2.lhLen > 0 ? v2.notes.slice(0, v2.lhLen) : [];
      const sampleFrom = prevRh1 && prevRh1.length ? prevRh1 : prevLh1 || [];
      const sampleTo = rh2.length ? rh2 : lh2;
      const motion = describeMotion(sampleFrom, sampleTo);

      const startHint =
        cl == 'grand' && curBh() == 'diff'
          ? `LH: ${INV[lhInv1]} · RH: ${INV[rhInv1]}`
          : cl == 'grand' && curBh() == 'bass'
            ? `RH: ${INV[rhInv1]}`
            : INV[rhInv1];
      const targetInvText =
        cl == 'grand' && curBh() == 'diff'
          ? `LH: ${INV[v2.lhInv]} · RH: ${INV[v2.rhInv]}`
          : cl == 'grand' && curBh() == 'bass'
            ? `RH: ${INV[v2.rhInv]}`
            : INV[v2.rhInv];

      const tolExact = $('tol').value == 'exact';
      q.pn = 'Close-range voice leading';
      q.relProg = true;
      q.relLocked = tolExact;
      q.rom = [degRoman(d1, c1.sf), degRoman(d2, c2.sf)];
      q.nns = [degNns(d1, c1.sf), degNns(d2, c2.sf)];
      q.nnsLine = `Close-range · ${q.nns[0]} – ${q.nns[1]}`;
      q.ch = [
        {
          name: c1.name,
          sf: c1.sf,
          ints: c1.ints,
          pc: c1.pc,
          exp: exp1,
          hd: hd1,
          lhLen: lhLen1,
          rhLen: rhLen1,
          subHint: tolExact ? startHint : `start in any octave · ${startHint}`,
        },
        {
          name: c2.name,
          sf: c2.sf,
          ints: c2.ints,
          pc: c2.pc,
          exp: v2.notes,
          hd: v2.hd,
          lhLen: v2.lhLen,
          rhLen: v2.rhLen,
          subHint: 'find closest inversion from current position',
        },
      ];
      q.lab = 'close-range voice leading';
      q.ci = {k: 'prog'};
      q.ans = `${c1.name} → ${c2.name} (${targetInvText}${motion ? ' · ' + motion : ''})`;
      pset(q);
    } else if (g == 'harm_vl_up' || g == 'harm_vl_down') {
      // Up / Down the keyboard voice-leading drill across 3 inversion-rotating cycles
      q.g = 'prog';
      const dir: 'up' | 'down' = g === 'harm_vl_up' ? 'up' : 'down';
      const bh = curBh();
      const tolExact = $('tol').value == 'exact';
      const degrees = harmonizeScaleDegrees(C.sc, 3, C.r, C.names);
      const templates: number[][] =
        C.sc.length >= 7
          ? [
              [0, 3, 4, 0],
              [1, 4, 0],
              [0, 5, 3, 4],
              [0, 4, 5, 3],
            ]
          : [[0, 1, 2, 0]];
      const pat = ORD()
        ? templates[S.n % templates.length]
        : templates[rand(templates.length)];
      const cycles = 3;
      const roms: string[] = [];
      const nnss: string[] = [];
      const chList: any[] = [];

      const safeClamp = (lo: number, hi: number): [number, number] => {
        const a = Math.max(S.lo, lo);
        const b = Math.min(S.hi, hi);
        return b - a >= 12 ? [a, b] : [S.lo, S.hi];
      };
      const handIsLhOnly = cl === 'bass';
      const rhRange = safeClamp(
        cl === 'grand' ? (bh === 'bass' ? 48 : 53) : DEFAULT_VL_RANGE[0],
        DEFAULT_VL_RANGE[1],
      );
      const lhRange = safeClamp(36, handIsLhOnly ? 67 : 60);

      let prevRh: number[] | null = null;
      let prevLh: number[] | null = null;
      let prevRhF: number[] | null = null;
      let prevLhF: number[] | null = null;

      for (let cyc = 0; cyc < cycles; cyc++) {
        for (let pIdx = 0; pIdx < pat.length; pIdx++) {
          const degInfo = degrees[pat[pIdx] % degrees.length];
          roms.push(degInfo.roman);
          nnss.push(degInfo.nashville);

          if (cyc === 0 && pIdx === 0) {
            // Start low in range for 'up', high in range for 'down'
            const seedMid =
              dir === 'up'
                ? rhRange[0] + 6
                : rhRange[1] - 6;
            const lhSeedMid = dir === 'up' ? lhRange[0] + 5 : lhRange[1] - 5;
            const pickCorner = (
              ints: number[],
              pc: number,
              range: [number, number],
              targetMid: number,
            ) => {
              const allC: {notes: number[]; inversion: number}[] = [];
              for (let inv = 0; inv < ints.length; inv++) {
                for (let oct = -1; oct <= 8; oct++) {
                  const shifted = makeVoicingMidi(ints, pc, inv, oct);
                  if (
                    shifted[0] >= range[0] &&
                    shifted[shifted.length - 1] <= range[1] &&
                    shifted[shifted.length - 1] - shifted[0] <= 12
                  ) {
                    allC.push({notes: shifted, inversion: inv});
                  }
                }
              }
              if (!allC.length) return pickStartVoicing({root: pc, ints}, 0, range);
              allC.sort((a, b) => {
                const ma = a.notes.reduce((s, x) => s + x, 0) / a.notes.length;
                const mb = b.notes.reduce((s, x) => s + x, 0) / b.notes.length;
                return Math.abs(ma - targetMid) - Math.abs(mb - targetMid);
              });
              return allC[0];
            };

            if (handIsLhOnly) {
              const stL = pickCorner(degInfo.ints, degInfo.pc, lhRange, lhSeedMid);
              const fL = computeVoicingFingering(stL.notes, 'L', null, DEFAULT_FINGERING_RULES, S.prefFingering.L);
              prevLh = stL.notes;
              prevLhF = fL.primary;
              chList.push({
                name: degInfo.chordName,
                sf: degInfo.suffix,
                ints: degInfo.ints,
                pc: degInfo.pc,
                exp: stL.notes,
                hd: stL.notes.map(() => 'L'),
                lhLen: stL.notes.length,
                rhLen: 0,
                vlF: fL.perNote.map(p => (p.fingers.length === 2 ? `${p.fingers[0]}/${p.fingers[1]}` : p.fingers[0])),
                vlFingeringLh: fL,
                vlFingeringRh: null,
                vlInfo: {
                  direction: dir,
                  inversion: VL_INV_KEYS[stL.inversion] || 'root',
                  inversionLabel: VL_INV_LABELS[stL.inversion] || INV[stL.inversion],
                  handShift: 0,
                  shapeChange: false,
                  dirFlipped: false,
                  adjusted: false,
                  omittedFifth: false,
                  commonTonesKept: 0,
                  cost: 0,
                },
                subHint: `Cycle 1/${cycles} · start ${dir === 'up' ? 'low' : 'high'}`,
              });
            } else {
              const stR = pickCorner(degInfo.ints, degInfo.pc, rhRange, seedMid);
              const fR = computeVoicingFingering(stR.notes, 'R', null, DEFAULT_FINGERING_RULES, S.prefFingering.R);
              prevRh = stR.notes;
              prevRhF = fR.primary;
              let expNotes = stR.notes;
              let hd = stR.notes.map(() => 'R');
              let lhLen = 0;
              let fLh: FingeringResult | null = null;
              let tokens: (number | string)[] = fR.perNote.map(p =>
                p.fingers.length === 2 ? `${p.fingers[0]}/${p.fingers[1]}` : p.fingers[0],
              );
              if (cl === 'grand') {
                if (bh === 'bass') {
                  const bm = Math.max(S.lo, put([0], degInfo.pc, 0, [Math.max(S.lo, 24), Math.min(59, stR.notes[0] - 1)])[0]);
                  const bf = bassNoteF(bm, 'L', null);
                  prevLh = [bm];
                  prevLhF = [bf];
                  expNotes = [bm, ...stR.notes];
                  hd = ['L', ...stR.notes.map(() => 'R')];
                  lhLen = 1;
                  fLh = {hand: 'L', perNote: [{midi: bm, fingers: [bf]}], notes: [bm], primary: [bf], score: 0};
                  tokens = [bf, ...tokens];
                } else {
                  const lhB: [number, number] = [Math.max(S.lo, 36), Math.min(S.hi, stR.notes[0] - 1)];
                  const stL = pickCorner(degInfo.ints, degInfo.pc, lhB, lhB[1] - 6);
                  fLh = computeVoicingFingering(stL.notes, 'L', null, DEFAULT_FINGERING_RULES, S.prefFingering.L);
                  prevLh = stL.notes;
                  prevLhF = fLh.primary;
                  expNotes = [...stL.notes, ...stR.notes];
                  hd = [...stL.notes.map(() => 'L'), ...stR.notes.map(() => 'R')];
                  lhLen = stL.notes.length;
                  tokens = [
                    ...fLh.perNote.map(p => (p.fingers.length === 2 ? `${p.fingers[0]}/${p.fingers[1]}` : p.fingers[0])),
                    ...tokens,
                  ];
                }
              }
              chList.push({
                name: degInfo.chordName,
                sf: degInfo.suffix,
                ints: degInfo.ints,
                pc: degInfo.pc,
                exp: expNotes,
                hd,
                lhLen,
                rhLen: stR.notes.length,
                vlF: tokens,
                vlFingeringRh: fR,
                vlFingeringLh: fLh,
                vlInfo: {
                  direction: dir,
                  inversion: VL_INV_KEYS[stR.inversion] || 'root',
                  inversionLabel: VL_INV_LABELS[stR.inversion] || INV[stR.inversion],
                  handShift: 0,
                  shapeChange: false,
                  dirFlipped: false,
                  adjusted: false,
                  omittedFifth: false,
                  commonTonesKept: 0,
                  cost: 0,
                },
                subHint: `Cycle 1/${cycles} · start ${dir === 'up' ? 'low' : 'high'}`,
              });
            }
            continue;
          }

          // At start of each new cycle, rotate the previous chord up/down one inversion family
          let seedRh = prevRh;
          let seedLh = prevLh;
          const isCycleTurn = cyc > 0 && pIdx === 0;
          if (isCycleTurn) {
            if (seedRh && seedRh.length >= 2) {
              seedRh = rotateInversionVoicing(seedRh, dir, rhRange);
            }
            if (seedLh && seedLh.length >= 2) {
              seedLh = rotateInversionVoicing(seedLh, dir, lhRange);
            }
          }

          const eRes = runEngineVoice({
            ints: degInfo.ints,
            pc: degInfo.pc,
            cl,
            bh,
            rangeMode: 'unlocked',
            direction: dir,
            prevRh: seedRh,
            prevRhF,
            prevLh: seedLh,
            prevLhF,
          });
          if (eRes.rhLen > 0) prevRh = eRes.notes.slice(eRes.lhLen);
          if (eRes.lhLen > 0) prevLh = eRes.notes.slice(0, eRes.lhLen);
          if (eRes.rhF.length) prevRhF = eRes.rhF;
          if (eRes.lhF.length) prevLhF = eRes.lhF;
          chList.push({
            name: degInfo.chordName,
            sf: degInfo.suffix,
            ints: degInfo.ints,
            pc: degInfo.pc,
            exp: eRes.notes,
            hd: eRes.hd,
            lhLen: eRes.lhLen,
            rhLen: eRes.rhLen,
            vlF: eRes.vlF,
            vlFingeringRh: eRes.rhFingering || null,
            vlFingeringLh: eRes.lhFingering || null,
            vlInfo: eRes.vlInfo,
            subHint: isCycleTurn
              ? `Cycle ${cyc + 1}/${cycles} · rotate ${dir}`
              : `Cycle ${cyc + 1}/${cycles} · ${eRes.vlInfo.inversionLabel}`,
          });
        }
      }

      q.pn =
        dir === 'up'
          ? 'Voice leading: Up the keyboard'
          : 'Voice leading: Down the keyboard';
      q.relProg = true;
      q.relLocked = tolExact;
      q.rom = roms;
      q.nns = nnss;
      q.nnsLine = `${dir === 'up' ? '↑ Up' : '↓ Down'} · ${nnss.slice(0, pat.length).join(' – ')} ×${cycles}`;
      q.ch = chList;
      q.lab = `voice leading (${dir} the keyboard)`;
      q.ci = {k: 'prog'};
      q.ans = chList.slice(0, pat.length).map((c: any) => c.name).join(' → ') + ` (×${cycles})`;
      pset(q);
    } else if (g == 'harm_guide') {
      // Guide-tone targeting (3rds & 7ths of ii-V-I)
      q.g = 'prog';
      const steps: [string, number, number[], string][] = [
        ['iim7', 2, [3, 10], '3rd & 7th'],
        ['V7', 7, [4, 10], '3rd & 7th'],
        ['Imaj7', 0, [4, 11], '3rd & 7th'],
      ];
      q.pn = 'Guide tones (3rds & 7ths) · ii–V–I';
      q.rom = ['iim7 (3 & ♭7)', 'V7 (3 & ♭7)', 'Imaj7 (3 & 7)'];
      q.nns = ['2m7 (3 & ♭7)', '5(7) (3 & ♭7)', '1maj7 (3 & 7)'];
      q.nnsLine = 'Guide tones · 2m7 – 5(7) – 1maj7';
      let prevRh: number[] | null = null;
      q.ch = steps.map(([rn, o, gt]) => {
        const pc = (C.r + o) % 12;
        const rh = putVoiceLed(gt, pc, prevRh, 0).notes;
        prevRh = rh;
        const bass = put([0], pc, 0, [36, Math.min(59, rh[0] - 1)]);
        const all = cl == 'grand' ? [...bass, ...rh] : rh;
        return {
          name: pn(pc) + rn.slice(rn.indexOf('m') >= 0 ? 3 : 1) + ' (3 & 7)',
          ints: gt,
          pc,
          exp: all,
          hd: cl == 'grand' ? ['L', ...rh.map(() => 'R')] : rh.map(() => 'R'),
          lhLen: cl == 'grand' ? 1 : 0,
          rhLen: rh.length,
        };
      });
      q.lab = 'guide tones';
      q.ci = {k: 'prog'};
      q.ans = q.ch.map((c: any) => c.name).join(' → ');
      pset(q);
    } else if (g == 'harm_scale') {
      const sz: 3 | 4 = +$('size').value == 4 ? 4 : 3;
      const degrees = harmonizeScaleDegrees(C.sc, sz, C.r, C.names);
      const smooth = $('vlead').checked;
      const tolExact = $('tol').value == 'exact';
      const bh = curBh();

      if (ORD()) {
        q.g = 'prog';
        q.pn = `${C.k} ${getModeDisplayLabel(C.m)} (${sz == 4 ? '7ths' : 'triads'})`;
        q.relProg = smooth;
        q.relLocked = smooth && tolExact;
        q.rom = degrees.map(d => d.roman);
        q.nns = degrees.map(d => d.nashville);
        q.nnsLine = q.nns.join(' – ');

        let prevRh: number[] | null = null;
        let prevLh: number[] | null = null;
        let prevRhF: number[] | null = null;
        let prevLhF: number[] | null = null;
        let prevAnchorRh: number | null = null;
        let prevAnchorLh: number | null = null;
        let prevDirRh: VLDirection | null = S.vlDir === 'down' ? 'down' : 'up';
        let prevDirLh: VLDirection | null = S.vlDir === 'down' ? 'down' : 'up';
        let progDir: VLDirectionSetting = S.vlDir;

        if (smooth && S.primDeg > 0 && C.sc.length == 7) {
          const anchorD = degrees[S.primDeg % 7];
          const aRes = runEngineVoice({
            ints: anchorD.ints,
            pc: anchorD.pc,
            cl,
            bh,
            rangeMode: S.rangeLocked ? 'locked' : 'unlocked',
            direction: progDir,
            fixedInv: 0,
          });
          prevRh = aRes.rhLen > 0 ? aRes.notes.slice(aRes.lhLen) : null;
          prevLh = aRes.lhLen > 0 ? aRes.notes.slice(0, aRes.lhLen) : null;
          prevRhF = aRes.rhF.length ? aRes.rhF : null;
          prevLhF = aRes.lhF.length ? aRes.lhF : null;
          prevAnchorRh = aRes.rhOut?.anchorIdx ?? null;
          prevAnchorLh = aRes.lhOut?.anchorIdx ?? null;
          prevDirRh = aRes.rhOut?.direction ?? prevDirRh;
          prevDirLh = aRes.lhOut?.direction ?? prevDirLh;
        }

        q.ch = degrees.map((dInfo, stepIdx) => {
          const mx = Math.min(mi, dInfo.ints.length - 1);
          const inv =
            smooth && stepIdx === 0 && !prevRh && !prevLh
              ? 0
              : $('exinv').checked
                ? mx
                : rand(mx + 1);
          if (smooth) {
            const eRes = runEngineVoice({
              ints: dInfo.ints,
              pc: dInfo.pc,
              cl,
              bh,
              rangeMode: S.rangeLocked ? 'locked' : 'unlocked',
              direction: progDir,
              prevRh,
              prevRhF,
              prevAnchorRh,
              prevDirRh,
              prevLh,
              prevLhF,
              prevAnchorLh,
              prevDirLh,
              fixedInv: stepIdx === 0 && !prevRh && !prevLh ? 0 : undefined,
            });
            if (eRes.vlInfo.dirFlipped && progDir !== 'auto') {
              progDir = eRes.vlInfo.direction;
            }
            if (eRes.rhLen > 0) prevRh = eRes.notes.slice(eRes.lhLen);
            if (eRes.lhLen > 0) prevLh = eRes.notes.slice(0, eRes.lhLen);
            if (eRes.rhF.length) prevRhF = eRes.rhF;
            if (eRes.lhF.length) prevLhF = eRes.lhF;
            if (eRes.rhOut) {
              prevAnchorRh = eRes.rhOut.anchorIdx;
              prevDirRh = eRes.rhOut.direction;
            }
            if (eRes.lhOut) {
              prevAnchorLh = eRes.lhOut.anchorIdx;
              prevDirLh = eRes.lhOut.direction;
            }
            if (stepIdx === 0 && S.rangeLocked && !S.lockZoneRh) {
              if (prevAnchorRh != null && prevRh?.length) {
                S.lockZoneRh = windowMidiCorridor(
                  prevAnchorRh,
                  prevRh.length,
                  vlBoundsForHand('R', cl, bh),
                );
              }
              if (prevAnchorLh != null && prevLh?.length && prevLh.length > 1) {
                S.lockZoneLh = windowMidiCorridor(
                  prevAnchorLh,
                  prevLh.length,
                  vlBoundsForHand('L', cl, bh),
                );
              }
            }
            return {
              name: dInfo.chordName,
              sf: dInfo.suffix,
              ints: dInfo.ints,
              pc: dInfo.pc,
              exp: eRes.notes,
              hd: eRes.hd,
              lhLen: eRes.lhLen,
              rhLen: eRes.rhLen,
              vlF: eRes.vlF,
              vlFingeringRh: eRes.rhFingering || null,
              vlFingeringLh: eRes.lhFingering || null,
              vlInfo: eRes.vlInfo,
            };
          }
          const voiced = voice(
            dInfo.ints,
            dInfo.pc,
            inv,
            lhi,
            undefined,
            prevRh,
            false,
            prevLh,
            false,
          );
          if (voiced.rhLen > 0) prevRh = voiced.notes.slice(voiced.lhLen);
          if (voiced.lhLen > 0) prevLh = voiced.notes.slice(0, voiced.lhLen);
          return {
            name: dInfo.chordName,
            sf: dInfo.suffix,
            ints: dInfo.ints,
            pc: dInfo.pc,
            exp: voiced.notes,
            hd: voiced.hd,
            lhLen: voiced.lhLen,
            rhLen: voiced.rhLen,
          };
        });
        q.lab = `harmonize ${C.m} (${sz == 4 ? '7ths' : 'triads'})`;
        q.ci = {k: 'harm_scale', degrees, sz, scaleNames: C.names};
        q.ans = degrees.map(d => d.chordName).join(' → ');
        pset(q);
      } else {
        const deg = rand(degrees.length);
        const dInfo = degrees[deg];
        const hasPrev = !!(S.prevRh?.length || S.prevLh?.length);
        if (smooth && hasPrev) {
          q.prevRh = S.prevRh ? [...S.prevRh] : null;
          q.prevLh = S.prevLh ? [...S.prevLh] : null;
          q.prevRhF = S.prevRhF ? [...S.prevRhF] : null;
          q.prevLhF = S.prevLhF ? [...S.prevLhF] : null;
        }
        const mx = Math.min(mi, dInfo.ints.length - 1);
        const inv = $('exinv').checked ? mx : rand(mx + 1);
        const mxL = Math.min(lhi, dInfo.ints.length - 1);
        const lhInv = curBh() == 'diff' ? ($('exinv').checked ? mxL : rand(mxL + 1)) : inv;

        let voiced: {
          notes: number[];
          hd: string[];
          lhLen: number;
          rhLen: number;
          lhInv: number;
          rhInv: number;
        };
        let engRes: EngineVoicedResult | null = null;
        if (smooth) {
          engRes = runEngineVoice({
            ints: dInfo.ints,
            pc: dInfo.pc,
            cl,
            bh,
            rangeMode: S.rangeLocked ? 'locked' : 'unlocked',
            direction: S.vlDir,
            prevRh: hasPrev ? S.prevRh : null,
            prevRhF: hasPrev ? (S.prevRhF as number[] | null) : null,
            prevAnchorRh: hasPrev ? S.vlAnchorRh : null,
            prevDirRh: hasPrev ? S.vlPrevDirRh : null,
            prevLh: hasPrev ? S.prevLh : null,
            prevLhF: hasPrev ? (S.prevLhF as number[] | null) : null,
            prevAnchorLh: hasPrev ? S.vlAnchorLh : null,
            prevDirLh: hasPrev ? S.vlPrevDirLh : null,
            fixedInv: !hasPrev ? 0 : undefined,
          });
          voiced = engRes;
          q.vlF = engRes.vlF;
          q.vlRhF = engRes.rhF;
          q.vlLhF = engRes.lhF;
          q.vlFingeringRh = engRes.rhFingering || null;
          q.vlFingeringLh = engRes.lhFingering || null;
          q.vlInfo = engRes.vlInfo;
          q.nextVlAnchorRh = engRes.rhOut?.anchorIdx ?? null;
          q.nextVlAnchorLh = engRes.lhOut?.anchorIdx ?? null;
          q.nextVlDirRh = engRes.rhOut?.direction ?? null;
          q.nextVlDirLh = engRes.lhOut?.direction ?? null;
          if (engRes.vlInfo.dirFlipped && S.vlDir !== 'auto') {
            S.vlDir = engRes.vlInfo.direction;
          }
        } else {
          voiced = voice(dInfo.ints, dInfo.pc, inv, lhInv);
        }

        q.g = 'chord';
        q.exp = voiced.notes;
        q.hd = voiced.hd;
        q.lhLen = voiced.lhLen;
        q.rhLen = voiced.rhLen;
        q.isRelChord = smooth;
        q.relHasPrev = smooth && hasPrev;
        q.isRelAnchored = smooth && (tolExact || (S.relLocked && S.rangeLocked));

        if (smooth && tolExact && !hasPrev) {
          S.prevRh = voiced.rhLen > 0 ? voiced.notes.slice(voiced.lhLen) : null;
          S.prevLh = voiced.lhLen > 0 ? voiced.notes.slice(0, voiced.lhLen) : null;
          if (engRes) {
            S.prevRhF = engRes.rhF.length ? engRes.rhF : null;
            S.prevLhF = engRes.lhF.length ? engRes.lhF : null;
            S.vlAnchorRh = engRes.rhOut?.anchorIdx ?? null;
            S.vlAnchorLh = engRes.lhOut?.anchorIdx ?? null;
            S.vlPrevDirRh = engRes.rhOut?.direction ?? (S.vlDir === 'down' ? 'down' : 'up');
            S.vlPrevDirLh = engRes.lhOut?.direction ?? (S.vlDir === 'down' ? 'down' : 'up');
          }
          if (S.prevRh?.length)
            S.homeRhAvg = S.prevRh.reduce((a: number, b: number) => a + b, 0) / S.prevRh.length;
          if (S.prevLh?.length)
            S.homeLhAvg = S.prevLh.reduce((a: number, b: number) => a + b, 0) / S.prevLh.length;
          if (S.rangeLocked) {
            if (S.vlAnchorRh != null && S.prevRh?.length) {
              S.lockZoneRh = windowMidiCorridor(S.vlAnchorRh, S.prevRh.length, vlBoundsForHand('R', cl, bh));
            }
            if (S.vlAnchorLh != null && S.prevLh?.length && S.prevLh.length > 1) {
              S.lockZoneLh = windowMidiCorridor(S.vlAnchorLh, S.prevLh.length, vlBoundsForHand('L', cl, bh));
            }
          }
          S.relLocked = true;
        }

        const invDesc =
          cl == 'grand' && bh == 'diff'
            ? `LH: ${INV[voiced.lhInv]} · RH: ${INV[voiced.rhInv]}`
            : cl == 'grand' && bh == 'bass'
              ? `RH: ${INV[voiced.rhInv]}`
              : INV[voiced.rhInv];

        q.refreshLabels = () => {
          const fmt = $('pfmt').value;
          const modeLbl = getModeDisplayLabel(C.m);
          if (fmt == 'roman') {
            q.main = `${dInfo.roman} in ${C.k} ${modeLbl}`;
            q.sub = `${dInfo.qualityLabel} · Nashville ${dInfo.nashville} · ${invDesc}`;
          } else if (fmt == 'nns') {
            q.main = `${dInfo.nashville} in ${C.k} ${modeLbl}`;
            q.sub = `${dInfo.qualityLabel} · Roman ${dInfo.roman} · ${invDesc}`;
          } else {
            q.main = `${dInfo.chordName} in ${C.k} ${modeLbl}`;
            q.sub = `Degree ${dInfo.roman} (Nashville ${dInfo.nashville}) · ${dInfo.qualityLabel} · ${invDesc}`;
          }
          if (smooth && !hasPrev && !tolExact && !S.relLocked) {
            q.sub += ' · Start in any octave';
          }
        };
        q.refreshLabels();
        q.top = `${C.k} ${getModeDisplayLabel(C.m)} · ${CL}`;
        q.topAnon = CL;
        q.lab = `harmonize ${C.m} ${dInfo.roman}`;
        q.ans = `${dInfo.chordName} (${dInfo.roman} · ${q.exp.map((m: number) => sm(m).n).join(' ')})`;
        q.ci = {k: 'harm_scale', degrees, sz, deg, scaleNames: C.names};
      }
    } else if (g == 'harm_c2s') {
      const pool = CHORD_TO_SCALE_SPECS.filter(s =>
        S.scDiff === 'beginner' ? s.difficulty === 'beginner' : true,
      );
      const spec = ORD() ? pool[S.n % pool.length] : pk(pool);
      const pc = C.r;
      const spList = spellChord(pc, spec.ints, spec.suffix);
      spList.forEach(([t, l, a]) => {
        C.sp[t] = {l, a};
      });
      const chordNotes = spList.map(([_t, l, a]) => LN[l] + ACC[a]);
      const chordName = pn(pc) + prettyChordSuffix(spec.suffix);
      const validNames = (
        S.scDiff === 'beginner' ? spec.beginnerScales : spec.advancedScales
      ).filter(n => !!(MODES[n] || SCALES[n]));
      const validScaleOpts = validNames.map(name => ({
        name,
        fullInts: [...(MODES[name] || SCALES[name]), 12],
      }));
      const primarySeq = put(validScaleOpts[0].fullInts, pc, 0, [57, 84]);
      const primaryScaleNames = (MODES[validNames[0]] || SCALES[validNames[0]]).map(
        (iv: number) => {
          const p = (pc + iv) % 12;
          const z = C.sp[p];
          return z ? LN[z.l] + ACC[z.a] : pn(p);
        },
      );
      const chordExp = put(spec.ints, pc, 0, cl == 'bass' ? [36, 62] : [48, 76]);
      const allModeScales = [...Object.keys(MODES), ...Object.keys(SCALES)];

      if (S.scMode == 'quiz' && S.studyMode != 'teach') {
        q.g = 'harm_c2s';
        q.isMc = true;
        q.chordExp = chordExp;
        q.primarySeq = primarySeq;
        q.exp = chordExp;
        q.validSet = new Set(validNames);
        q.validNames = validNames;
        q.key = validNames[0];
        const distractorPool = allModeScales.filter(n => !validNames.includes(n));
        const pickedDistractors: string[] = [];
        while (pickedDistractors.length < 3 && distractorPool.length) {
          const idx = rand(distractorPool.length);
          pickedDistractors.push(distractorPool.splice(idx, 1)[0]);
        }
        q.opts = [...new Set([validNames[0], ...pickedDistractors])].sort(
          () => Math.random() - 0.5,
        );
        q.onChoice = (picked: string) => {
          const isOk = q.validSet.has(picked);
          const others = validNames.filter((n: string) => n !== picked);
          q.tinfo = isOk
            ? others.length
              ? `✓ Accepted: ${picked} (also valid: ${others.join(', ')})`
              : `✓ Accepted: ${picked}`
            : `Not quite — valid scales: ${validNames.join(' · ')}`;
          const rawInts = MODES[picked] || SCALES[picked];
          if (rawInts) {
            const seqToPlay = put([...rawInts, 12], pc, 0, [57, 84]);
            audioEngine.resume();
            const sndPreset = curSound();
            seqToPlay.forEach((m: number, idx: number) =>
              audioEngine.playNote(m, idx * 0.2, 0.28, sndPreset, 0.74),
            );
          }
          return isOk;
        };
        q.main = spec.contextLabel
          ? `${chordName} (${spec.contextLabel})`
          : chordName;
        q.sub = 'Choose a scale that fits this chord';
      } else {
        q.g = 'c2s_play';
        q.exp = primarySeq;
        q.seq = primarySeq;
        q.spread = true;
        q.chordExp = chordExp;
        q.primarySeq = primarySeq;
        q.validScaleOpts = validScaleOpts;
        q.validNames = validNames;
        q.pc = pc;
        q.c2sNotes = [];
        q.main = spec.contextLabel
          ? `${chordName} (${spec.contextLabel})`
          : chordName;
        q.sub =
          S.studyMode == 'teach'
            ? `Valid: ${validNames.join(' · ')} — play ascending`
            : `Play any matching scale ascending (${validNames.length > 1 ? validNames.length + ' valid scales' : 'root to octave'})`;
      }

      q.top = `${pn(pc)} chord · ${S.scDiff === 'beginner' ? 'Beginner' : 'Advanced'}`;
      q.topAnon = CL;
      q.lab = `chord→scale: ${spec.suffix}`;
      q.ans = `${validNames[0]}${validNames.length > 1 ? ' (or ' + validNames.slice(1).join(', ') + ')' : ''} · ${primaryScaleNames.join(' ')}`;
      q.ci = {
        k: 'harm_c2s',
        chordName,
        chordNotes,
        contextLabel: spec.contextLabel,
        validNames,
        explanation: spec.explanation,
        scaleNotes: primaryScaleNames,
      };
    } else if (g == 'harm_mchar') {
      const spec = ORD()
        ? MODE_CHARACTER_SPECS[S.n % MODE_CHARACTER_SPECS.length]
        : pk(MODE_CHARACTER_SPECS);
      C = buildCtx(C.k, spec.mode);
      const degrees = harmonizeScaleDegrees(C.sc, spec.chordSize, C.r, C.names);
      const primary = degrees[spec.primaryChordDegree];
      const alternates = (spec.alternateChordDegrees || [])
        .map(idx => degrees[idx])
        .filter(Boolean);
      const tonicDeg = degrees[0];
      const tonicZone = cl == 'bass' ? [36, 62] : [57, 81];
      const tonicExp = put(tonicDeg.ints, tonicDeg.pc, 0, tonicZone);
      const primaryExp = put(primary.ints, primary.pc, 0, tonicZone);
      const acceptedList = [primary, ...alternates];
      const acceptedExps = acceptedList.map(d => put(d.ints, d.pc, 0, tonicZone));
      const acceptedNames = new Set(acceptedList.map(d => d.chordName));

      const fmtDegLbl = (d: HarmonizedDegreeInfo) => {
        const fmt = $('pfmt').value;
        if (fmt == 'roman') return `${d.roman} (${d.chordName})`;
        if (fmt == 'nns') return `${d.nashville} (${d.chordName})`;
        return `${d.chordName} (${d.roman})`;
      };

      if (S.scMode == 'quiz' && S.studyMode != 'teach') {
        q.g = 'harm_mchar';
        q.isMc = true;
        q.tonicExp = tonicExp;
        q.exp = primaryExp;
        q.key = primary.chordName;
        q.validSet = acceptedNames;
        const distPool = degrees.filter(d => !acceptedNames.has(d.chordName));
        const pickedDist: HarmonizedDegreeInfo[] = [];
        while (pickedDist.length < 3 && distPool.length) {
          pickedDist.push(distPool.splice(rand(distPool.length), 1)[0]);
        }
        q.mcDegrees = [primary, ...pickedDist].sort(() => Math.random() - 0.5);
        q.mcItems = q.mcDegrees.map((d: HarmonizedDegreeInfo) => ({
          val: d.chordName,
          lbl: fmtDegLbl(d),
        }));
        q.onChoice = (picked: string) => {
          const isOk = q.validSet.has(picked);
          q.tinfo = isOk
            ? `✓ ${spec.characteristicNote} creates ${primary.roman} (${primary.chordName})`
            : `Not quite — ${spec.characteristicNote} creates ${primary.roman} (${primary.chordName})`;
          const chosenDeg = degrees.find(d => d.chordName === picked) || primary;
          const chordNotes = put(chosenDeg.ints, chosenDeg.pc, 0, tonicZone);
          audioEngine.resume();
          const sndPreset = curSound();
          tonicExp.forEach((m: number, i: number) =>
            audioEngine.playNote(m, i * 0.025, 0.65, sndPreset, 0.7),
          );
          chordNotes.forEach((m: number, i: number) =>
            audioEngine.playNote(m, 0.55 + i * 0.03, 1.1, sndPreset, 0.78),
          );
          return isOk;
        };
      } else {
        q.g = 'mchar_play';
        q.exp = primaryExp;
        q.tonicExp = tonicExp;
        q.acceptedExps = acceptedExps;
        q.acceptedList = acceptedList;
      }

      q.refreshLabels = () => {
        const fmt = $('pfmt').value;
        const pLbl =
          fmt == 'roman'
            ? primary.roman
            : fmt == 'nns'
              ? `Nashville ${primary.nashville}`
              : `${primary.chordName} (${primary.roman})`;
        q.main = `${C.k} ${getModeDisplayLabel(spec.mode)}`;
        if (S.studyMode == 'teach') {
          q.sub = `Characteristic chord: ${pLbl} · Note: ${spec.characteristicNote}`;
        } else if (S.scMode == 'quiz') {
          q.sub = `Which chord gives ${getModeDisplayLabel(spec.mode)} its characteristic sound?`;
          if (q.mcDegrees) {
            q.mcItems = q.mcDegrees.map((d: HarmonizedDegreeInfo) => ({
              val: d.chordName,
              lbl: fmtDegLbl(d),
            }));
            $('ans').innerHTML = q.mcItems
              .map(
                (item: {val: string; lbl: string}) =>
                  `<button class=s data-a="${item.val}">${item.lbl}</button>`,
              )
              .join('');
          }
        } else {
          q.sub = `Play the characteristic chord · hint: ${spec.characteristicNote}`;
        }
      };
      q.refreshLabels();
      q.top = `Mode character · ${CL}`;
      q.topAnon = CL;
      q.lab = `mode character: ${spec.mode}`;
      q.ans = `${primary.chordName} (${primary.roman} · ${spec.characteristicNote})`;
      q.ci = {
        k: 'harm_mchar',
        mode: spec.mode,
        keyName: C.k,
        characteristicNote: spec.characteristicNote,
        characteristicChordDegrees: [
          spec.primaryChordDegree,
          ...(spec.alternateChordDegrees || []),
        ],
        primary,
        alternates,
        degrees,
        summary: spec.summary,
        cadenceHint: spec.cadenceHint,
      };
    } else if (g == 'prog' && S.pat) {
      patQ(q);
    } else if (g == 'prog') {
      const lv = $('plevel').value;
      const L = PR.filter(p =>
        S.hf
          ? p[2] == S.hf
          : lv == 'mix'
            ? p[2] == 'basic' || p[2] == 'adv'
            : p[2] == lv,
      );
      const P = pk(L);
      const smooth = $('vlead').checked;
      const tolExact = $('tol').value == 'exact';

      q.pn = P[0];
      q.relProg = smooth;
      q.relLocked = smooth && tolExact;
      q.rom = P[0].split(' – ');
      q.nns = P[1].map(spec => toNashville(spec));
      q.nnsLine = q.nns.join(' – ');

      let prevRh: number[] | null = null;
      let prevLh: number[] | null = null;
      let prevRhF: number[] | null = null;
      let prevLhF: number[] | null = null;
      let prevAnchorRh: number | null = null;
      let prevAnchorLh: number | null = null;
      let prevDirRh: VLDirection | null = S.vlDir === 'down' ? 'down' : 'up';
      let prevDirLh: VLDirection | null = S.vlDir === 'down' ? 'down' : 'up';
      let progDir: VLDirectionSetting = S.vlDir;
      const bh = curBh();

      if (smooth && S.primDeg > 0 && C.sc.length == 7) {
        const anchorChord = buildDiatonicChord(
          C,
          't4only',
          C.sc,
          S.primDeg % 7,
          4,
          0,
          0,
          0,
        );
        const aRes = runEngineVoice({
          ints: anchorChord.ints,
          pc: anchorChord.pc,
          cl,
          bh,
          rangeMode: S.rangeLocked ? 'locked' : 'unlocked',
          direction: progDir,
          fixedInv: 0,
        });
        prevRh = aRes.rhLen > 0 ? aRes.notes.slice(aRes.lhLen) : null;
        prevLh = aRes.lhLen > 0 ? aRes.notes.slice(0, aRes.lhLen) : null;
        prevRhF = aRes.rhF.length ? aRes.rhF : null;
        prevLhF = aRes.lhF.length ? aRes.lhF : null;
        prevAnchorRh = aRes.rhOut?.anchorIdx ?? null;
        prevAnchorLh = aRes.lhOut?.anchorIdx ?? null;
        prevDirRh = aRes.rhOut?.direction ?? prevDirRh;
        prevDirLh = aRes.lhOut?.direction ?? prevDirLh;
        if (S.rangeLocked) {
          S.lockZoneRh =
            prevAnchorRh != null && prevRh?.length
              ? windowMidiCorridor(prevAnchorRh, prevRh.length, vlBoundsForHand('R', cl, bh))
              : prevRh?.length
                ? computeLockCorridor(prevRh)
                : null;
          S.lockZoneLh =
            prevAnchorLh != null && prevLh?.length && prevLh.length > 1
              ? windowMidiCorridor(prevAnchorLh, prevLh.length, vlBoundsForHand('L', cl, bh))
              : prevLh?.length
                ? computeLockCorridor(prevLh)
                : null;
        }
      }

      q.ch = P[1].map(([o, sf, bassO], stepIdx) => {
        const x = Q.find(y => y[0] === sf)!;
        const pc = (C.r + o) % 12;
        const mx = Math.min(mi, x[1].length - 1);
        const inv =
          smooth && stepIdx === 0 && !prevRh && !prevLh
            ? 0
            : $('exinv').checked
              ? mx
              : ORD()
                ? S.n % (mx + 1)
                : rand(mx + 1);
        const forceBass = bassO != null ? (C.r + bassO) % 12 : undefined;
        const slashTxt = forceBass != null ? '/' + pn(forceBass) : '';

        if (smooth) {
          const eRes = runEngineVoice({
            ints: x[1],
            pc,
            cl,
            bh,
            rangeMode: S.rangeLocked ? 'locked' : 'unlocked',
            direction: progDir,
            prevRh,
            prevRhF,
            prevAnchorRh,
            prevDirRh,
            prevLh,
            prevLhF,
            prevAnchorLh,
            prevDirLh,
            fixedInv: stepIdx === 0 && !prevRh && !prevLh ? 0 : undefined,
            forceBass,
            isSlash: forceBass != null,
            slashName: forceBass != null ? pn(pc) + sf + slashTxt : undefined,
          });
          if (eRes.vlInfo.dirFlipped && progDir !== 'auto') {
            progDir = eRes.vlInfo.direction;
          }
          if (eRes.rhLen > 0) prevRh = eRes.notes.slice(eRes.lhLen);
          if (eRes.lhLen > 0) prevLh = eRes.notes.slice(0, eRes.lhLen);
          if (eRes.rhF.length) prevRhF = eRes.rhF;
          if (eRes.lhF.length) prevLhF = eRes.lhF;
          if (eRes.rhOut) {
            prevAnchorRh = eRes.rhOut.anchorIdx;
            prevDirRh = eRes.rhOut.direction;
          }
          if (eRes.lhOut) {
            prevAnchorLh = eRes.lhOut.anchorIdx;
            prevDirLh = eRes.lhOut.direction;
          }
          if (stepIdx === 0 && S.rangeLocked && !S.lockZoneRh) {
            if (prevAnchorRh != null && prevRh?.length) {
              S.lockZoneRh = windowMidiCorridor(prevAnchorRh, prevRh.length, vlBoundsForHand('R', cl, bh));
            }
            if (prevAnchorLh != null && prevLh?.length && prevLh.length > 1) {
              S.lockZoneLh = windowMidiCorridor(prevAnchorLh, prevLh.length, vlBoundsForHand('L', cl, bh));
            }
          }
          return {
            name: pn(pc) + sf + slashTxt,
            sf,
            ints: x[1],
            pc,
            forceBass,
            exp: eRes.notes,
            hd: eRes.hd,
            lhLen: eRes.lhLen,
            rhLen: eRes.rhLen,
            vlF: eRes.vlF,
            vlFingeringRh: eRes.rhFingering || null,
            vlFingeringLh: eRes.lhFingering || null,
            vlInfo: eRes.vlInfo,
          };
        }

        const voiced = voice(
          x[1],
          pc,
          inv,
          lhi,
          forceBass,
          prevRh,
          false,
          prevLh,
          false,
        );
        if (voiced.rhLen > 0) prevRh = voiced.notes.slice(voiced.lhLen);
        if (voiced.lhLen > 0) prevLh = voiced.notes.slice(0, voiced.lhLen);
        return {
          name: pn(pc) + sf + slashTxt,
          sf,
          ints: x[1],
          pc,
          forceBass,
          exp: voiced.notes,
          hd: voiced.hd,
          lhLen: voiced.lhLen,
          rhLen: voiced.rhLen,
        };
      });
      q.lab = 'progression (' + P[2] + ')';
      q.ci = {k: 'prog'};
      q.ans = q.ch.map((c: any) => c.name).join(' → ');
      pset(q);
    } else if (g == 'ear') {
      const et = $('eartype').value;
      const st = +$('size').value;
      const pc = C.r;
      const base = 48 + pc;
      const keyChosen = $('key').value != 'rnd';
      const inModeEar = $('inmode').checked;
      const snd: [number, number, number][] = [];
      const d = $('dir').value;
      const up =
        d == 'up' ? 1 : d == 'down' ? 0 : ORD() ? (S.n % 2 == 0 ? 1 : 0) : rand(2);

      const earTop = (scopedMode = false) =>
        scopedMode ? `${C.k} ${C.m}` : keyChosen ? `Key: ${C.k}` : '';

      q.main = 'Listen';
      q.top = earTop(false);
      q.sub = 'Identify what you hear · Play again replays it';

      if (et == 'chord') {
        const L = Q.filter(x => x[2] <= st && typeof x[0] == 'string');
        const qNames = new Set(L.map(y => (y[0] as string).trim() || 'major'));
        let picked: {
          pc: number;
          ints: number[];
          sf: string;
          label: string;
        } | null = null;
        let modeOpts: string[] | null = null;

        if (inModeEar) {
          const sizes = st == 3 ? [3] : st == 4 ? [4] : [3, 4];
          const diaPool = sizes
            .flatMap(sz =>
              R(0, 6).map(deg =>
                buildDiatonicChord(C, 'all', C.sc, deg, sz, 0, 0),
              ),
            )
            .filter(ch => qNames.has(ch.sf.trim() || 'major'));
          const uniqueDiaOpts = [
            ...new Set(diaPool.map(ch => ch.sf.trim() || 'major')),
          ];
          if (diaPool.length && uniqueDiaOpts.length >= 2) {
            const ch = pk(diaPool);
            picked = {
              pc: ch.pc,
              ints: ch.ints,
              sf: ch.sf,
              label: ch.sf.trim() || 'major',
            };
            modeOpts = uniqueDiaOpts;
            q.top = earTop(true);
          }
        }

        if (!picked) {
          const x = pk(L);
          picked = {
            pc,
            ints: x[1],
            sf: x[0] as string,
            label: (x[0] as string).trim() || 'major',
          };
        }

        const cBase = 48 + picked.pc;
        q.key = picked.label;
        q.opts =
          modeOpts || [
            ...new Set(L.map(y => (y[0] as string).trim() || 'major')),
          ];
        q.exp = picked.ints.map(i => cBase + i);
        q.exp.forEach((m: number) => snd.push([m, 0, 2.2]));
        q.ci = {
          k: 'chord',
          n: pn(picked.pc) + picked.sf,
          sf: picked.sf,
          ints: picked.ints,
          pc: picked.pc,
        };
        q.ans =
          pn(picked.pc) +
          picked.sf +
          ' (' +
          q.exp.map((m: number) => sm(m).n).join(' ') +
          ')';
      } else if (et == 'int') {
        const modeSet = new Set([...C.sc.filter((i: number) => i > 0), 12]);
        const modeIL = INT.filter(i => modeSet.has(i[1]));
        const IL = inModeEar && modeIL.length >= 3 ? modeIL : INT;
        if (inModeEar && modeIL.length >= 3) q.top = earTop(true);

        const iv = ORD()
            ? IL[Math.floor(S.n / (d == 'any' ? 2 : 1)) % IL.length]
            : IL[rand(IL.length)],
          a = base,
          b = base + iv[1];
        q.key = iv[0];
        q.opts = IL.map(i => i[0]);
        q.exp = [a, b];
        snd.push([up ? a : b, 0, 1.2], [up ? b : a, 0.8, 1.6]);
        q.ci = {k: 'int', iv, up: !!up};
        q.ans =
          iv[0] +
          ' (' +
          (up ? 'up' : 'down') +
          ': ' +
          q.exp.map((m: number) => sm(m).n).join(' + ') +
          ')';
      } else if (et == 'scale' || et == 'scale2') {
        const SS = et == 'scale' ? MODES : SCALES;
        const k = Object.keys(SS);
        const m = ORD()
          ? k[Math.floor(S.n / (d == 'any' ? 2 : 1)) % k.length]
          : k[rand(k.length)];
        const a = [...SS[m], 12].map(i => base + i);
        if (!up) a.reverse();
        q.key = m;
        q.opts = k;
        q.exp = a;
        q.spread = 1;
        a.forEach((x, i) => snd.push([x, i * 0.45, 0.7]));
        q.ci = {k: 'scale', m, sc: SS[m], r: pc};
        q.ans = pn(pc) + ' ' + m + ' (' + a.map(x => sm(x).n).join(' ') + ')';
      } else if (et == 'mel') {
        // Play a 4-note melody in the chosen key & mode and play it back
        const pool = [...C.sc, 12];
        const startMidi = 60 + pc;
        const seq = [0, 1, 2, 3].map((_, idx) =>
          startMidi + (idx == 0 ? 0 : pool[rand(pool.length)]),
        );
        q.g = 'mel';
        q.seq = seq;
        q.exp = seq;
        q.spread = 1;
        q.main = 'Play back the melody';
        q.top = `${C.k} ${C.m}`;
        q.sub = `Starts on ${smOct(seq[0])} · Listen, then play the 4 notes on your keyboard`;
        seq.forEach((m, i) => snd.push([m, i * 0.55, 0.65]));
        q.snd = snd;
        q.lab = 'ear: melody playback';
        q.ans = seq.map(m => sm(m).n).join(' → ');
        q.ci = {k: 'scale', m: C.m, sc: C.sc, r: pc, ar: true};
      } else if (et == 'bassline') {
        const L = PR.filter(p => p[2] == 'basic').slice(0, 6);
        const P = pk(L);
        const bassNotes = P[1].map(([o]) => 36 + ((pc + o) % 12));
        q.key = P[0];
        q.opts = L.map(p => p[0]);
        q.exp = bassNotes;
        q.spread = 1;
        bassNotes.forEach((m, i) => {
          snd.push([m, i * 1.1, 1.1]);
          snd.push([m + 12, i * 1.1, 1.1]);
        });
        q.ans = P[0] + ' in ' + pn(pc);
      } else if (et == 'cad' || et == 'prog') {
        const L = PR.filter(p =>
          et == 'cad' ? p[2].startsWith('cad') : p[2] == S.ep,
        );
        const P = pk(L);
        const ch = P[1].map(([o, sf]) => {
          const x = Q.find(y => y[0] === sf)!;
          const r = 48 + ((pc + o) % 12);
          return x[1].map(k => r + k);
        });
        q.key = et == 'cad' ? CT[P[2].slice(4)] : P[0];
        q.opts =
          et == 'cad'
            ? Object.values(CT)
            : [...new Set(L.map(p => p[0]))];
        q.exp = ch[0];
        ch.forEach((c, i) => c.forEach(m => snd.push([m, i * 1.2, 1.3])));
        q.ans =
          (et == 'cad' ? q.key + ' cadence: ' : '') + P[0] + ' in ' + pn(pc);
      } else if (et == 'inv') {
        let chPc = pc;
        let chSf = '';
        let chInts: number[] = [];
        let k = 0;

        if (inModeEar) {
          const invPool = [3, 4].flatMap(sz =>
            R(0, 6).flatMap(deg => {
              const ch = buildDiatonicChord(C, 'all', C.sc, deg, sz, 0, 0);
              return R(0, ch.ints.length - 1).map(invK => ({
                pc: ch.pc,
                sf: ch.sf,
                ints: ch.ints,
                invK,
              }));
            }),
          );
          const pick = pk(invPool);
          chPc = pick.pc;
          chSf = pick.sf;
          chInts = pick.ints;
          k = pick.invK;
          q.top = earTop(true);
        } else {
          const L = Q.filter(
            x =>
              x[2] <= 4 &&
              typeof x[0] == 'string' &&
              x[1].length >= 3 &&
              x[1].length <= 4 &&
              !/quartal/.test(x[0]),
          );
          const invPool = L.flatMap(x =>
            R(0, x[1].length - 1).map(invK => ({
              sf: x[0] as string,
              ints: x[1],
              invK,
            })),
          );
          const pick = pk(invPool);
          chSf = pick.sf;
          chInts = pick.ints;
          k = pick.invK;
        }

        const cBase = 48 + chPc;
        const a = chInts.map(i => cBase + i);
        for (let i = 0; i < k; i++) a.push(a.shift()! + 12);
        a.sort((u, v) => u - v);
        q.key = INV[k];
        q.opts = INV.slice(0, chInts.length);
        q.exp = a;
        a.forEach(m => snd.push([m, 0, 2.2]));
        q.ans =
          pn(chPc) +
          chSf +
          ' – ' +
          INV[k] +
          ' (' +
          a.map(m => sm(m).n).join(' ') +
          ')';
      }

      if (q.g == 'ear') {
        q.snd = snd;
        q.lab = 'ear: ' + q.key;
      }
    } else if (g == 'scale') {
      buildScaleQuestion(q, cl, CL);
    } else {
      const IL = (S.ic ? INTC : INT).filter(
        i => i[1] >= S.ir[0] && i[1] <= S.ir[1],
      );
      const d = $('dir').value;
      const dirs = d == 'up' ? [1] : d == 'down' ? [0] : [1, 0];
      const items = buildIntervalItems(C, IL, dirs, $('inmode').checked);
      const item = items[ORD() ? S.n % items.length : rand(items.length)];
      const iv = item.iv;
      const up = item.up;
      const pc = item.pc;
      const zone = cl == 'grand' && ORD() ? [57, 96] : Z();
      const a = put(up ? [0, iv[1]] : [-iv[1], 0], pc, 0, zone);

      q.exp = a;
      q.root = up ? a[0] : a[1];
      q.mainExact = 'Root: ' + smOct(q.root);
      q.mainAny = 'Root: ' + sm(q.root).n;
      q.main = q.mainExact;
      q.top = ($('inmode').checked ? ctxT + ' · ' : '') + CL;
      q.topAnon = CL;
      q.sub =
        'Play a ' +
        iv[0] +
        ' ' +
        (up ? 'above' : 'below') +
        ' it · both notes together';
      q.lab = iv[0];
      q.ci = {k: 'int', iv, up: !!up};
      q.ans = a.map(m => sm(m).n).join(' + ');
    }

    q.t0 = Date.now();
    S.q = q;
    S.ign = new Set(S.held);
    S.pedalChanged = false;
    $('fb').textContent = '';

    if (q.pat && $('beat').checked) {
      q.beat = 1;
      q.bpm = +$('tempo').value;
      q.bm = 60000 / q.bpm;
      q.tm = [];
      startBeat(q);
    }

    if (q.mcItems && S.studyMode != 'teach')
      $('ans').innerHTML = q.mcItems
        .map(
          (item: {val: string; lbl: string}) =>
            `<button class=s data-a="${item.val}">${item.lbl}</button>`,
        )
        .join('');
    else if (q.opts && S.studyMode != 'teach')
      $('ans').innerHTML = q.opts
        .map((o: string) => `<button class=s data-a="${o}">${o}</button>`)
        .join('');

    render();
    vis();
    stats();
    syncMetronome();
    if (q.vlInfo?.warning && !$('fb').textContent) {
      $('fb').style.color = 'var(--ac)';
      $('fb').textContent = q.vlInfo.warning;
    }
    if ((g == 'ear' || q.g == 'mel') && S.studyMode != 'teach')
      setTimeout(() => {
        audioEngine.resume();
        const sndPreset = curSound();
        (q.snd || []).forEach(([m, t, d]: [number, number, number]) =>
          audioEngine.playNote(m, t, d, sndPreset, 0.8),
        );
      }, 300);
    if (S.studyMode != 'teach') startActivityCountdown(q);
    S.n++;
  }

  /* =====================================================================
     21. RENDERING (Viewport-contained, Toggleable Show/Hide, Staff-matched Keyboard Badges)
     ===================================================================== */
  function syncActionButtons(q: any) {
    const startBtn = $('start');
    const revBtn = $('rv');
    const fgBtn = $('fgb');
    const plBtn = $('pl');
    const nxBtn = $('nx');
    const l2pBtn = $('learn2prac');

    const isTeach = S.studyMode == 'teach';
    const active = !!q;
    const isShown = !!(q && (isTeach || q.revealed || q.done));

    if (startBtn) startBtn.style.display = isTeach ? 'none' : '';
    revBtn.style.display = isTeach ? 'none' : '';
    revBtn.disabled = !active || !!q?.done;
    revBtn.textContent = q?.revealed ? 'Hide answer' : 'Show answer';
    revBtn.classList.toggle('on', !!q?.revealed);

    // Fingering is unlocked right away in Teach Mode; in Practice it unlocks when revealed/done
    const canFing = active && isShown && q.g != 'ear' && !q.isMc;
    fgBtn.disabled = !canFing;
    const fOn = $('fing').checked;
    fgBtn.textContent = fOn ? 'Hide fingering' : 'Show fingering';
    fgBtn.classList.toggle('on', canFing && fOn);

    plBtn.style.display =
      isTeach ||
      $('ug').value == 'ear' ||
      q?.g == 'mel' ||
      q?.g == 'c2s_play' ||
      q?.g == 'mchar_play' ||
      q?.isMc
        ? ''
        : 'none';
    plBtn.textContent = isTeach ? 'Listen' : 'Play again';

    const manualReady = !isTeach && !!(q?.done && advCfg.mode == 'manual');
    nxBtn.classList.toggle('ready', manualReady);
    nxBtn.textContent =
      isTeach && q?.ch && q.ch.length > 1 ? 'Next chord' : 'Next';

    if (l2pBtn) l2pBtn.style.display = isTeach ? '' : 'none';
  }

  function render() {
    const q = S.q;
    if (!q) {
      $('qtop').textContent = '';
      applyShiftSideBadges(null);
      syncActionButtons(null);
      return;
    }

    const isTeach = S.studyMode == 'teach';
    const p = $('prompt').value;
    const none = $('clef').value == 'none';
    const d = !!q.done;
    const rev = !!q.revealed;
    const shown = isTeach || d || rev;
    const nameOk = isTeach || none || p != 'staff' || shown;
    const stf = isTeach
      ? !none
      : !none &&
        (q.g == 'ear' || q.g == 'mel'
          ? shown
          : q.g == 'c2s_play' || q.g == 'mchar_play' || q.isMc
            ? true
            : p != 'symbol' || shown);

    $('qtop').textContent =
      isTeach || q.g == 'ear' || q.g == 'mel' || nameOk
        ? q.top || ''
        : q.topAnon || '';

    const tolExact = q.g == 'scale' ? true : $('tol').value == 'exact';

    $('q').textContent =
      q.g == 'ear'
        ? shown
          ? q.ans.split(' (')[0]
          : 'Listen'
        : q.g == 'mel'
          ? shown
            ? q.ans
            : q.main
          : nameOk
            ? q.g == 'int'
              ? tolExact
                ? q.mainExact || q.main
                : q.mainAny || q.main
              : q.main
            : '?';

    const octSpan = (notes: number[]) => {
      const sorted = [...notes].sort((a, b) => a - b);
      const lo = sm(sorted[0]).o;
      const hi = sm(sorted[sorted.length - 1]).o;
      return lo == hi ? `oct ${lo}` : `oct ${lo}–${hi}`;
    };
    let subMeta = '';
    if (q.startDesc && nameOk) {
      const desc = tolExact ? q.startDesc : q.startDescAny || '';
      if (desc) subMeta = ` · ${desc}`;
    } else if (nameOk && q.g != 'ear' && q.exp?.length) {
      const isRelFollowUp =
        !!q.relHasPrev || (q.g == 'prog' && !!q.relProg && q.pos > 0);
      if (q.g == 'int' || q.g == 'mel') {
        subMeta = tolExact ? ' · exact octave' : '';
      } else if (tolExact && !isRelFollowUp) {
        const lhNotes = q.hd
          ? q.exp.filter((_: number, i: number) => q.hd[i] == 'L')
          : q.lhLen > 0
            ? q.exp.slice(0, q.lhLen)
            : [];
        const rhNotes = q.hd
          ? q.exp.filter((_: number, i: number) => q.hd[i] != 'L')
          : q.lhLen > 0
            ? q.exp.slice(q.lhLen)
            : q.exp;
        const handOcts =
          lhNotes.length && rhNotes.length
            ? `LH ${octSpan(lhNotes)} · RH ${octSpan(rhNotes)}`
            : lhNotes.length
              ? `LH ${octSpan(lhNotes)}`
              : `RH ${octSpan(rhNotes)}`;
        subMeta = ` · ${handOcts}`;
      }
    }

    const baseSub =
      isTeach && q.g == 'int' && q.ci?.iv
        ? `${q.ci.iv[0]} ${q.ci.up ? 'above' : 'below'} root`
        : q.sub;
    $('sub').textContent = baseSub + subMeta + (shown ? ' → ' + q.ans : '');

    const vlMetaEl = $('vlmeta') as HTMLElement | null;
    if (vlMetaEl) {
      const mInfo = q.vlInfo;
      const showVlMeta =
        !!mInfo &&
        nameOk &&
        !$('vlbar')?.hidden;
      vlMetaEl.hidden = !showVlMeta;
      if (showVlMeta) {
        const bits: string[] = [];
        if (S.rangeLocked) {
          bits.push(
            `<span class="vl-meta-item"><strong>Locked window</strong></span>`,
            `<span class="vl-meta-item"><strong>${mInfo.inversionLabel}</strong></span>`,
          );
        } else {
          const dirArrow = mInfo.direction === 'down' ? '↓' : '↑';
          const shiftText =
            mInfo.handShift === 0
              ? 'shift 0'
              : `shift ${mInfo.handShift > 0 ? '+' : ''}${mInfo.handShift}`;
          bits.push(
            `<span class="vl-meta-item"><strong>${dirArrow} ${mInfo.direction}</strong></span>`,
            `<span class="vl-meta-item"><strong>${mInfo.inversionLabel}</strong></span>`,
            `<span class="vl-meta-item ${mInfo.handShift !== 0 ? 'vl-meta-shift' : ''}">${shiftText}</span>`,
          );
        }
        if (mInfo.commonTonesKept > 0) {
          bits.push(`<span class="vl-meta-item">common ${mInfo.commonTonesKept}</span>`);
        }
        if (mInfo.cost != null && mInfo.cost > 0) {
          bits.push(`<span class="vl-meta-item">cost ${mInfo.cost}</span>`);
        }
        if (mInfo.moveSummary) {
          bits.push(`<span class="vl-meta-item">${mInfo.moveSummary}</span>`);
        }
        if (mInfo.adjusted) {
          bits.push(`<span class="vl-meta-item vl-meta-adj">adjusted</span>`);
        }
        if (mInfo.omittedFifth) {
          bits.push(`<span class="vl-meta-item vl-meta-adj">5th omitted</span>`);
        }
        if (!S.rangeLocked) {
          bits.push(
            `<span class="vl-meta-item ${mInfo.shapeChange ? 'vl-meta-shape' : ''}">${mInfo.shapeChange ? 'shape changed' : 'same shape'}</span>`,
          );
        }
        if (mInfo.warning) {
          bits.push(`<span class="vl-meta-item vl-meta-warn">${mInfo.warning}</span>`);
        }
        vlMetaEl.innerHTML = bits.join('<span>·</span>');
      } else {
        vlMetaEl.innerHTML = '';
      }
    }

    const autoShift =
      q.vlInfo &&
      nameOk &&
      !S.rangeLocked &&
      !$('vlbar')?.hidden &&
      q.vlInfo.handShift !== 0
        ? {
            tones: Math.abs(q.vlInfo.handShift),
            dir: (q.vlInfo.handShift > 0 ? 'up' : 'down') as 'up' | 'down',
          }
        : null;
    applyShiftSideBadges(S.shiftManual || autoShift);

    if (isTeach) {
      if (q.ch && q.ch.length > 1) {
        const fmt = $('pfmt').value;
        const stepLabels = q.ch.map((chItem: any, idx: number) => {
          if (chItem.rest) return null;
          const lbl =
            q.pat
              ? chItem.name
              : fmt == 'roman'
                ? q.rom?.[idx] || chItem.name
                : fmt == 'nns'
                  ? q.nns?.[idx] || chItem.name
                  : chItem.name;
          return `<button type="button" class="s teach-step-btn ${idx === q.pos ? 'on' : ''}" data-step="${idx}">${lbl}</button>`;
        });
        $('ans').innerHTML =
          stepLabels.filter(Boolean).join('') +
          `<button type="button" class="s teach-step-play" id="progplay">Hear all</button>`;
        ($('ans') as HTMLElement)
          .querySelectorAll<HTMLButtonElement>('[data-step]')
          .forEach((btn: HTMLButtonElement) => {
            btn.onclick = () => {
              const sIdx = Number(btn.dataset.step);
              if (!Number.isNaN(sIdx) && q.ch[sIdx]) {
                q.pos = sIdx;
                q.hit?.clear();
                q.bad?.clear();
                pset(q);
                render();
                stats();
                playQ();
              }
            };
          });
        const progPlay = $('progplay') as HTMLButtonElement | null;
        if (progPlay) progPlay.onclick = () => playFullSequence(q);
      } else {
        $('ans').innerHTML = '';
      }
    }

    if (!isTeach) {
      if (rev && !d) {
        $('fb').style.color = 'var(--ac)';
        $('fb').textContent = 'Answer shown — click Hide answer to return';
      } else if (!d && $('fb').textContent.startsWith('Answer shown')) {
        $('fb').textContent = '';
      }
    }

    const sn =
      q.g == 'int' && !shown
        ? [q.root]
        : q.g == 'c2s_play' && !shown
          ? q.chordExp
          : (q.g == 'mchar_play' || (q.isMc && q.tonicExp)) && !shown
            ? q.tonicExp
            : q.exp;
    let fg: any = null,
      fh: any = null;

    const showFingNow =
      $('fing').checked && shown && q.g != 'ear' && !q.isMc && sn === q.exp;
    if (showFingNow) {
      const D = (q.fgd = q.fgd || fgData(q));
      const i = q.ch ? Math.min(q.pos, D[2].length - 1) : 0;
      if ((q.g == 'scale' || q.g == 'mel' || q.g == 'c2s_play') && !q.steps) {
        fg = D[2].map((x: any) => x[0]);
        fh = D[1].map((x: any) => x[0]);
      } else if (q.steps) {
        fg = D[2].flat();
        fh = D[1].flat();
      } else {
        fg = D[2][i];
        fh = D[1][i];
      }
    }

    const staffNotes =
      q.lhSeq && q.rhSeq
        ? q.lhSeq.flatMap((lm: number, idx: number) => [lm, q.rhSeq[idx]])
        : q.steps && showFingNow
          ? q.steps.flat()
          : sn;
    const stepHandsForStaff =
      q.lhSeq && q.rhSeq ? q.lhSeq.flatMap(() => ['L', 'R']) : fh;
    const staffSpread =
      (q.g == 'scale' ||
        q.g == 'mel' ||
        (q.g == 'c2s_play' && shown) ||
        !!q.spread) &&
      !(q.g == 'c2s_play' && !shown);
    $('stf').innerHTML = stf
      ? staff(
          staffNotes,
          staffSpread,
          fg,
          stepHandsForStaff,
          !!q.steps,
        )
      : '';

    S.kbOk = new Set<number>();
    S.kbBad = new Set<number>();
    S.hl = new Set<number>();

    const allTargets: number[] = q.steps
      ? q.steps.flat()
      : q.g == 'harm_c2s' && q.isMc && (d || rev) && q.primarySeq
        ? q.primarySeq
        : q.exp || [];
    const targetSet = new Set<number>(allTargets);

    const exactKb =
      tolExact ||
      !!q.isRelAnchored ||
      (q.g == 'prog' && !!q.relProg && !!q.relLocked);

    if (isTeach) {
      (q.hit as Set<number>)?.forEach((m: number) => S.kbOk.add(m));
      allTargets.forEach((m: number) => {
        if (!S.kbOk.has(m)) S.hl.add(m);
      });
    } else if (d) {
      if (q.g == 'ear' || q.isMc) {
        allTargets.forEach((m: number) => S.hl.add(m));
      } else if (q.g == 'scale' || q.g == 'mel' || q.g == 'c2s_play') {
        if (q.g == 'c2s_play' && q.ok) {
          (q.hit as Set<number>).forEach((m: number) => S.kbOk.add(m));
          (q.bad as Set<number>).forEach((m: number) => {
            if (!S.kbOk.has(m)) S.kbBad.add(m);
          });
        } else if (tolExact) {
          (q.hit as Set<number>).forEach((m: number) =>
            targetSet.has(m) ? S.kbOk.add(m) : S.kbBad.add(m),
          );
          (q.bad as Set<number>).forEach((m: number) => {
            if (!S.kbOk.has(m)) S.kbBad.add(m);
          });
          allTargets.forEach((t: number) => {
            if (!S.kbOk.has(t)) S.hl.add(t);
          });
        } else {
          (q.hit as Set<number>).forEach((m: number) => S.kbOk.add(m));
          (q.bad as Set<number>).forEach((m: number) => {
            if (!S.kbOk.has(m)) S.kbBad.add(m);
          });
          if (!q.ok) {
            const okPcs = new Set([...S.kbOk].map(x => x % 12));
            allTargets.forEach((t: number) => {
              if (!okPcs.has(t % 12)) S.hl.add(t);
            });
          }
        }
      } else {
        const played: number[] = [...new Set<number>(q.played || [])].sort(
          (a, b) => a - b,
        );
        const sortedTargets = [...allTargets].sort((a, b) => a - b);
        if (!played.length) {
          sortedTargets.forEach((m: number) => S.hl.add(m));
        } else if (exactKb) {
          played.forEach((m: number) =>
            targetSet.has(m) ? S.kbOk.add(m) : S.kbBad.add(m),
          );
          sortedTargets.forEach((e: number) => {
            if (!S.kbOk.has(e)) S.hl.add(e);
          });
        } else if (q.ok) {
          played.forEach((m: number) => S.kbOk.add(m));
        } else {
          const targetPcs = new Set(sortedTargets.map(x => x % 12));
          played.forEach((m: number) =>
            targetPcs.has(m % 12) ? S.kbOk.add(m) : S.kbBad.add(m),
          );
          const okPcs = new Set([...S.kbOk].map(x => x % 12));
          sortedTargets.forEach((e: number) => {
            if (!okPcs.has(e % 12)) S.hl.add(e);
          });
          if (!S.hl.size && !S.kbBad.size) {
            sortedTargets.forEach((e: number) => S.hl.add(e));
          }
        }
      }
    } else if (rev) {
      allTargets.forEach((m: number) => S.hl.add(m));
    } else {
      (q.hit as Set<number>)?.forEach((m: number) =>
        (exactKb && q.g != 'c2s_play' ? targetSet.has(m) : true)
          ? S.kbOk.add(m)
          : S.kbBad.add(m),
      );
      (q.bad as Set<number>)?.forEach((m: number) => {
        if (!S.kbOk.has(m)) S.kbBad.add(m);
      });
    }

    S.fm = {};
    if (showFingNow && fg && fh) {
      let notesForBadges: number[] =
        q.lhSeq && q.rhSeq
          ? q.lhSeq.flatMap((lm: number, idx: number) => [lm, q.rhSeq[idx]])
          : q.steps
            ? q.steps.flat()
            : staffNotes;
      let fgForBadges = fg;
      let fhForBadges = fh;
      const exactKbCheck =
        tolExact ||
        !!q.isRelAnchored ||
        (q.g == 'prog' && !!q.relProg && !!q.relLocked);
      if (
        !isTeach &&
        d &&
        q.ok &&
        !exactKbCheck &&
        !q.ch &&
        !q.steps &&
        q.g != 'scale' &&
        q.g != 'mel' &&
        q.played?.length &&
        q.played.length === q.exp?.length
      ) {
        const playedSorted = [...new Set<number>(q.played)].sort((a, b) => a - b);
        if (playedSorted.length === q.exp.length) {
          const playedHd =
            q.hd && q.hd.length === playedSorted.length ? q.hd : fh;
          if (q.playedVlF && q.playedVlF.length === playedSorted.length) {
            notesForBadges = playedSorted;
            fgForBadges = q.playedVlF;
            fhForBadges = playedHd;
          } else {
            const playedPrevState: {L?: {ns: number[]; f: (number | string)[]}; R?: {ns: number[]; f: (number | string)[]}} = {};
            if (q.prevLh?.length)
              playedPrevState.L = {
                ns: q.prevLh,
                f: q.prevLhF?.length === q.prevLh.length ? q.prevLhF : chordF(q.prevLh, 'L'),
              };
            if (q.prevRh?.length)
              playedPrevState.R = {
                ns: q.prevRh,
                f: q.prevRhF?.length === q.prevRh.length ? q.prevRhF : chordF(q.prevRh, 'R'),
              };
            const playedF = fingers(
              [playedSorted],
              [playedHd],
              playedPrevState,
              q.g != 'int',
            );
            notesForBadges = playedSorted;
            fgForBadges = playedF[0];
            fhForBadges = playedHd;
          }
        }
      }
      const activeFingItem = q.ch ? q.ch[q.pos] : q;
      const rhFingObj: FingeringResult | null = activeFingItem?.vlFingeringRh || null;
      const lhFingObj: FingeringResult | null = activeFingItem?.vlFingeringLh || null;

      notesForBadges.forEach((m: number, idx: number) => {
        const f = fgForBadges[idx];
        const h = fhForBadges[idx] || 'R';
        if (!f) return;
        const fObj = h === 'R' ? rhFingObj : lhFingObj;
        const noteOpt = fObj?.perNote?.find(p => p.midi === m);
        const alts =
          noteOpt && noteOpt.fingers.length === 2 ? [...noteOpt.fingers] : undefined;
        const arr = S.fm[m] || (S.fm[m] = []);
        if (!arr.some((x: any) => x.f == f && x.h == h)) arr.push({f, h, alts});
      });
    }

    const fgRowEl = $('fgrow') as HTMLElement | null;
    if (fgRowEl) {
      const canShowRow =
        showFingNow &&
        fg &&
        fh &&
        q.g != 'scale' &&
        q.g != 'mel' &&
        !q.steps;
      if (!canShowRow) {
        fgRowEl.hidden = true;
        fgRowEl.innerHTML = '';
      } else {
        const activeFingItem = q.ch ? q.ch[q.pos] : q;
        const rhNotes = staffNotes.filter((_: number, idx: number) => fh[idx] === 'R');
        const lhNotes = staffNotes.filter((_: number, idx: number) => fh[idx] === 'L');
        const rhFing: FingeringResult | null =
          activeFingItem?.vlFingeringRh ||
          (rhNotes.length
            ? computeVoicingFingering(
                rhNotes,
                'R',
                q.prevRh?.length && q.prevRhF?.length === q.prevRh.length
                  ? {
                      notes: q.prevRh,
                      primary: q.prevRhF.map((x: any) => Number(String(x).split('/')[0]) || 1),
                    }
                  : null,
                DEFAULT_FINGERING_RULES,
                S.prefFingering?.R || null,
              )
            : null);
        const lhFing: FingeringResult | null =
          activeFingItem?.vlFingeringLh ||
          (lhNotes.length
            ? computeVoicingFingering(
                lhNotes,
                'L',
                q.prevLh?.length && q.prevLhF?.length === q.prevLh.length
                  ? {
                      notes: q.prevLh,
                      primary: q.prevLhF.map((x: any) => Number(String(x).split('/')[0]) || 1),
                    }
                  : null,
                DEFAULT_FINGERING_RULES,
                S.prefFingering?.L || null,
              )
            : null);

        const buildHandGroup = (res: FingeringResult | null) => {
          if (!res || !res.perNote.length) return '';
          const h = res.hand;
          const handCls = h === 'R' ? 'rh' : 'lh';
          const handLabel = h === 'R' ? 'RH' : 'LH';
          const prefShape = S.prefFingering?.[h];
          const isPref =
            !!prefShape &&
            prefShape.length === res.primary.length &&
            prefShape.every((v: number, i: number) => v === res.primary[i]);
          const posHtml = res.perNote
            .map((p, idx) => {
              if (p.fingers.length === 2) {
                const alt1Shape = [...res.primary];
                alt1Shape[idx] = p.fingers[0];
                const alt2Shape = [...res.primary];
                alt2Shape[idx] = p.fingers[1];
                return (
                  `<span class="fg-pos fg-alt-btn${isPref ? ' fg-pref' : ''}" title="Click top or bottom finger to remember your preferred fingering">` +
                  `<span class="fg-stack">` +
                  `<span class="fg-stack-opt${res.primary[idx] === p.fingers[0] ? ' on' : ''}" data-hand="${h}" data-shape="${alt1Shape.join(',')}">${p.fingers[0]}</span>` +
                  `<span class="fg-stack-opt${res.primary[idx] === p.fingers[1] ? ' on' : ''}" data-hand="${h}" data-shape="${alt2Shape.join(',')}">${p.fingers[1]}</span>` +
                  `</span>` +
                  `</span>`
                );
              }
              return `<span class="fg-pos">${p.fingers[0]}</span>`;
            })
            .join('');
          return (
            `<div class="fg-hand-group">` +
            `<span class="fg-hand-lbl ${handCls}">${handLabel}</span>` +
            `<span class="fg-notes">${posHtml}</span>` +
            `</div>`
          );
        };

        const rowHtml = buildHandGroup(lhFing) + buildHandGroup(rhFing);
        fgRowEl.innerHTML = rowHtml;
        fgRowEl.hidden = !rowHtml;
      }
    }

    kb();
    syncInfo(q, nameOk, shown);
    syncActionButtons(q);
  }

  function staff(
    notes: number[],
    spread: boolean,
    fg: any,
    fh: any,
    paired = false,
  ) {
    const cl = S.cl || $('clef').value;
    if (cl == 'none' || !notes.length) return '';

    const st: [string, number][] =
      cl == 'grand'
        ? [
            ['t', 0],
            ['b', 100],
          ]
        : [[cl[0], 0]];
    const tops: Record<string, number> = {t: 0, b: cl == 'grand' ? 100 : 0};
    const stepCount = paired ? Math.ceil(notes.length / 2) : notes.length;
    const W = spread ? 110 + stepCount * 28 : 240;
    let minY = -12,
      maxY = st.at(-1)![1] + 52,
      g = '';

    st.forEach(([c, top]) => {
      for (let i = 0; i < 5; i++)
        g += `<line x1=4 x2=${W - 4} y1=${top + i * 10} y2=${top + i * 10} stroke="#6e6e78"/>`;
      g +=
        c == 't'
          ? `<text x=6 y=${top + 31} font-size=46 font-family="'Noto Music', serif" fill="#d6d6dc">𝄞</text>`
          : `<text x=6 y=${top + 19} font-size=38 font-family="'Noto Music', serif" fill="#d6d6dc">𝄢</text>`;
    });

    const its: any[] = notes.map((m, i) => {
      const n = sm(m);
      return {
        m,
        i,
        col: paired ? Math.floor(i / 2) : i,
        s: n.l + 7 * n.o,
        a: n.a,
        c:
          cl == 'grand'
            ? fh?.[i] == 'L'
              ? 'b'
              : fh?.[i] == 'R'
                ? 't'
                : m >= 60
                  ? 't'
                  : 'b'
            : cl[0],
      };
    });

    ['t', 'b'].forEach(c => {
      let pv: any = null;
      its
        .filter(x => x.c == c)
        .sort((a, b) => a.s - b.s)
        .forEach(x => {
          x.d = !spread && pv && x.s - pv.s == 1 && !pv.d;
          pv = x;
        });
    });

    its.forEach(x => {
      const s0 = x.c == 't' ? 30 : 18;
      const top = tops[x.c];
      const y = top + 40 - (x.s - s0) * 5;
      const cx = (spread ? 70 + x.col * 28 : 120) + (x.d ? 12 : 0);

      minY = Math.min(minY, y - 12);
      maxY = Math.max(maxY, y + 12);

      for (let k = s0 - 2; k >= x.s; k -= 2)
        g += `<line x1=${cx - 11} x2=${cx + 11} y1=${top + 40 - (k - s0) * 5} y2=${top + 40 - (k - s0) * 5} stroke="#6e6e78"/>`;
      for (let k = s0 + 10; k <= x.s; k += 2)
        g += `<line x1=${cx - 11} x2=${cx + 11} y1=${top + 40 - (k - s0) * 5} y2=${top + 40 - (k - s0) * 5} stroke="#6e6e78"/>`;

      g += `<ellipse cx=${cx} cy=${y} rx=6.5 ry=4.6 fill="#f4f4f2"/>`;
      x.cx = cx;
      x.y = y;
      if (x.a)
        g += `<text x=${cx - (x.d ? 30 : 20)} y=${y + 5} font-size=15 font-family="'Acc', 'Noto Music', serif" fill="#f4f4f2">${ACC[x.a]}</text>`;
    });

    if (fg) {
      const dg = its.filter(x => fg[x.i]);
      const bd = (cx: number, y: number, t: number, RHand: boolean) => {
        const lbl = String(fg[t]);
        const fSize = lbl.includes('/') ? 9 : 12;
        return (
          `<circle cx=${cx} cy=${y} r=8.5 fill="${RHand ? '#243370' : '#6a3510'}" stroke="${RHand ? '#8fa6ff' : '#ffb35c'}" stroke-width=1.3 />` +
          `<text x=${cx} y=${y + (lbl.includes('/') ? 3.4 : 4.4)} font-size=${fSize} font-weight=700 text-anchor=middle fill="#fff" font-family="system-ui,sans-serif">${lbl}</text>`
        );
      };

      if (spread) {
        const hr = dg.filter(x => fh[x.i] == 'R');
        const hl = dg.filter(x => fh[x.i] != 'R');
        const ry = minY - 8,
          ly = maxY + 8;
        hr.forEach(x => (g += bd(x.cx, ry, x.i, true)));
        hl.forEach(x => (g += bd(x.cx, ly, x.i, false)));
        if (hr.length) minY = ry - 14;
        if (hl.length) maxY = ly + 14;
      } else {
        const xr = Math.max(...its.map(x => x.cx)) + 30;
        let last = -99;
        dg.sort((a, b) => a.y - b.y).forEach(x => {
          const by = Math.max(x.y, last + 19);
          const RHand = fh[x.i] == 'R';
          last = by;
          g +=
            `<line x1=${x.cx + 9} y1=${x.y} x2=${xr - 10} y2=${by} stroke="#55555f" stroke-width=1 />` +
            bd(xr, by, x.i, RHand);
          minY = Math.min(minY, by - 14);
          maxY = Math.max(maxY, by + 14);
        });
      }
    }

    return `<svg viewBox="0 ${minY} ${W} ${maxY - minY}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
  }

  function kb() {
    const bl = [1, 3, 6, 8, 10];
    let w = 0;
    for (let m = S.lo; m <= S.hi; m++) if (!bl.includes(m % 12)) w++;
    const u = 100 / w;
    let h = '',
      i = 0;

    const badgesFor = (m: number) => {
      const list = S.fm[m];
      if (!list || !list.length) return '';
      return `<span class="kfg-wrap">${list
        .slice(0, 2)
        .map((b: {f: number | string; h: string; alts?: number[]}) =>
          b.alts && b.alts.length === 2
            ? `<span class="kfg ${b.h == 'R' ? 'rh' : 'lh'} kfg-alt"><span>${b.alts[0]}</span><span>${b.alts[1]}</span></span>`
            : `<span class="kfg ${b.h == 'R' ? 'rh' : 'lh'}">${b.f}</span>`,
        )
        .join('')}</span>`;
    };

    const isDone = !!S.q?.done;
    for (let m = S.lo; m <= S.hi; m++) {
      const b = bl.includes(m % 12);
      const cls = isDone
        ? S.kbBad.has(m)
          ? 'k-bad'
          : S.kbOk.has(m)
            ? 'k-ok'
            : S.hl.has(m)
              ? 'k-miss'
              : S.held.has(m)
                ? 'k-held'
                : ''
        : S.held.has(m)
          ? 'k-held'
          : S.kbBad.has(m)
            ? 'k-bad'
            : S.kbOk.has(m)
              ? 'k-ok'
              : S.hl.has(m)
                ? 'k-miss'
                : '';
      const clsAttr = cls ? ` class="${cls}"` : '';
      if (!b) {
        const octTag =
          m % 12 === 0
            ? `<span class="koct${m === 60 ? ' c4' : ''}">${nm(m)}</span>`
            : '';
        h += `<i${clsAttr} style="left:${i * u}%;width:${u}%">${octTag}${badgesFor(m)}</i>`;
        i++;
      } else {
        h += `<b${clsAttr} style="left:${i * u - u * 0.3}%;width:${u * 0.6}%">${badgesFor(m)}</b>`;
      }
    }
    $('kb').innerHTML = h;
  }

  /* =====================================================================
     22. ANSWER CHECKING + SCORING
     ===================================================================== */
  function match(h: number[], e: number[]) {
    h = [...h].sort((a, b) => a - b);
    e = [...e].sort((a, b) => a - b);

    const q = S.q;
    const forceExact =
      $('tol').value == 'exact' ||
      (!!q?.isRelAnchored && !!S.rangeLocked) ||
      (q?.g == 'prog' && !!q?.relProg && !!q?.relLocked && q.pos > 0 && !!S.rangeLocked);
    if (forceExact)
      return h.length == e.length && h.every((v, i) => v == e[i]);

    const cl = S.cl || $('clef').value;
    if (
      cl == 'grand' &&
      q &&
      ['chord', 'pass', 'prog'].includes(q.g) &&
      q.lhLen > 0 &&
      q.rhLen > 0
    ) {
      const bh = curBh();
      if (q.lhLen > 1 && (bh == 'same' || bh == 'diff')) {
        if (h.length < e.length) return false;
        const lhE = e.slice(0, q.lhLen);
        const rhE = e.slice(q.lhLen);
        const lhH = h.slice(0, q.lhLen);
        const rhH = h.slice(q.lhLen);
        const pcs = (a: number[]) =>
          [...new Set(a.map(x => x % 12))].sort((a, b) => a - b).join();
        return (
          lhH[0] % 12 == lhE[0] % 12 &&
          rhH[0] % 12 == rhE[0] % 12 &&
          pcs(lhH) == pcs(lhE) &&
          pcs(rhH) == pcs(rhE)
        );
      }
      if (h.length > 1 && h[1] % 12 != e[1] % 12) return false;
    }

    const p = (a: number[]) =>
      [...new Set(a.map(x => x % 12))].sort((a, b) => a - b).join();
    return p(h) == p(e) && h[0] % 12 == e[0] % 12;
  }

  function velLabel(v: number): string {
    if (v < 36) return 'pp';
    if (v < 58) return 'p';
    if (v < 76) return 'mp';
    if (v < 96) return 'mf';
    if (v < 114) return 'f';
    return 'ff';
  }

  function getScoreSnapshot(): PracticeScoreSnapshot {
    const ugEl = $('ug') as HTMLSelectElement | null;
    const fEl = $('focus') as HTMLSelectElement | null;
    const ugLabel = ugEl?.selectedOptions?.[0]?.textContent?.trim() || 'Practice';
    const focusLabel = fEl?.selectedOptions?.[0]?.textContent?.trim() || '';
    const gameLabel = focusLabel ? `${ugLabel} · ${focusLabel}` : ugLabel;
    return {
      ok: S.st.ok,
      tot: S.st.tot,
      str: S.st.str,
      best: S.st.best,
      gameLabel,
    };
  }

  function stats() {
    opts?.onScoreChange?.(getScoreSnapshot());
    if (!S.go && !S.q) {
      $('statleft').innerHTML = '';
      $('statright').innerHTML = '';
      return;
    }

    if (S.studyMode == 'teach') {
      const vlNote = S.q?.tinfo
        ? `<div class="stat-weak"><span>Voice leading</span>${S.q.tinfo}</div>`
        : '';
      $('statleft').innerHTML =
        `<div class="stat-row"><span class="stat-k">Class</span><span class="stat-v on">Untimed · No test</span></div>` +
        `<div class="stat-row"><span class="stat-k">Guide</span><span class="stat-v">Open keys &amp; details</span></div>` +
        vlNote;
    } else {
      const s = S.st;
      const pct = s.tot ? ` (${Math.round((100 * s.ok) / s.tot)}%)` : '';
      const w = Object.entries(s.by)
        .filter(([, v]: any) => v[1] >= 2)
        .sort((a: any, b: any) => a[1][0] / a[1][1] - b[1][0] / b[1][1])
        .slice(0, 3)
        .map(([k, v]: any) => `${k} ${Math.round((100 * v[0]) / v[1])}%`);
      const weakHtml = w.length
        ? `<div class="stat-weak"><span>Weakest</span>${w.join(' · ')}</div>`
        : '';
      const resetBtnHtml =
        s.tot > 0 || S.go
          ? `<button type="button" class="stat-reset" id="statreset" title="Reset session score">Reset</button>`
          : '';
      $('statleft').innerHTML =
        `<div class="stat-row"><span class="stat-k">Score</span><span class="stat-v">${s.ok}/${s.tot} correct${pct}</span>${resetBtnHtml}</div>` +
        `<div class="stat-row"><span class="stat-k">Streak</span><span class="stat-v">${s.str} · Best ${s.best}</span></div>` +
        weakHtml;

      const resetBtn = $('statreset') as HTMLButtonElement | null;
      if (resetBtn) {
        resetBtn.onclick = (e: MouseEvent) => {
          if (e.detail > 0) resetBtn.blur();
          opts?.onRequestResetScore?.(getScoreSnapshot());
        };
      }
    }

    const touchVal =
      S.lastVel != null ? `${velLabel(S.lastVel)} (${S.lastVel})` : '—';
    const pedCls = S.pedal ? (S.pedalChanged ? ' warn' : ' on') : '';
    const pedVal = S.pedal
      ? S.pedalChanged
        ? 'ON · blurred'
        : 'ON'
      : 'OFF';
    $('statright').innerHTML =
      `<div class="stat-row"><span class="stat-k">Touch</span><span class="stat-v">${touchVal}</span></div>` +
      `<div class="stat-row"><span class="stat-k">Pedal</span><span class="stat-v${pedCls}">${pedVal}</span></div>`;
  }

  function scheduleAdvance() {
    clearAdvanceTimers();
    const q = S.q;
    if (!q || !q.done || !q.scored) return;
    const base = q.fbBase || '';
    if (advCfg.mode == 'manual') {
      $('fb').style.color =
        q.timedOut || (q.isMc && !q.ok)
          ? 'var(--bad)'
          : q.isMc && q.ok
            ? 'var(--ok)'
            : 'var(--mut)';
      $('fb').textContent = base;
      return;
    }
    const ms = Math.round(advCfg.sec * 1000);
    if (base) {
      const deadline = Date.now() + ms;
      const drawCd = () => {
        const rem = Math.max(0, (deadline - Date.now()) / 1000);
        const shownSec = rem >= 1 ? Math.ceil(rem) : Math.max(0.5, Math.ceil(rem * 2) / 2);
        $('fb').textContent = base + ' · next in ' + fmtAdvSec(shownSec);
      };
      drawCd();
      S.cdTm = setInterval(() => {
        if (!S.q || S.q !== q || !S.go) {
          clearAdvanceTimers();
          return;
        }
        drawCd();
      }, 250);
    } else {
      $('fb').textContent = '';
    }
    S.tm = setTimeout(next, ms);
  }

  function scheduleLearnAdvance(q: any, baseText: string, ok: boolean) {
    clearAdvanceTimers();
    if (!q || S.studyMode != 'teach') return;
    $('fb').style.color = ok ? 'var(--ok)' : 'var(--bad)';
    if (advCfg.mode == 'manual') {
      $('fb').textContent = baseText;
      return;
    }
    const ms = Math.round(advCfg.sec * 1000);
    const deadline = Date.now() + ms;
    const drawCd = () => {
      const rem = Math.max(0, (deadline - Date.now()) / 1000);
      const shownSec = rem >= 1 ? Math.ceil(rem) : Math.max(0.5, Math.ceil(rem * 2) / 2);
      $('fb').textContent = `${baseText} · next in ${fmtAdvSec(shownSec)}`;
    };
    drawCd();
    S.cdTm = setInterval(() => {
      if (!S.q || S.q !== q || !S.go || S.studyMode != 'teach') {
        clearAdvanceTimers();
        return;
      }
      drawCd();
    }, 250);
    S.tm = setTimeout(() => {
      if (S.q !== q || !S.go || S.studyMode != 'teach') return;
      $('nx').click();
    }, ms);
  }

  function playAnswerKeys(q: any) {
    if (!q) return;
    audioEngine.resume();
    const sndPreset = curSound();
    if (q.snd && q.snd.length) {
      (q.snd as [number, number, number][]).forEach(([m, t, d]) =>
        audioEngine.playNote(m, t, d, sndPreset, 0.78),
      );
      return;
    }
    if (q.ch && q.ch.length) {
      const gap = q.pat ? 0.38 : 0.72;
      q.ch.forEach((step: any, i: number) => {
        if (step.rest) return;
        (step.exp || []).forEach((m: number) =>
          audioEngine.playNote(m, i * gap, gap * 0.9, sndPreset, 0.72),
        );
      });
      return;
    }
    if (q.steps && q.steps.length) {
      q.steps.forEach((pair: number[], i: number) =>
        pair.forEach(m =>
          audioEngine.playNote(m, i * 0.28, 0.34, sndPreset, 0.72),
        ),
      );
      return;
    }
    if (q.chordExp && q.primarySeq) {
      q.chordExp.forEach((m: number, i: number) =>
        audioEngine.playNote(m, i * 0.03, 0.85, sndPreset, 0.72),
      );
      q.primarySeq.forEach((m: number, i: number) =>
        audioEngine.playNote(m, 0.72 + i * 0.2, 0.3, sndPreset, 0.74),
      );
      return;
    }
    if (q.tonicExp && q.exp) {
      q.tonicExp.forEach((m: number, i: number) =>
        audioEngine.playNote(m, i * 0.025, 0.65, sndPreset, 0.68),
      );
      q.exp.forEach((m: number, i: number) =>
        audioEngine.playNote(m, 0.62 + i * 0.03, 1.4, sndPreset, 0.76),
      );
      return;
    }
    if (q.seq && q.seq.length) {
      q.seq.forEach((m: number, i: number) =>
        audioEngine.playNote(m, i * 0.22, 0.32, sndPreset, 0.72),
      );
      return;
    }
    if (q.exp && q.exp.length) {
      q.exp.forEach((m: number) =>
        audioEngine.playNote(m, 0, 1.8, sndPreset, 0.75),
      );
    }
  }

  function startActivityCountdown(q: any) {
    clearActivityTimers();
    if (S.studyMode == 'teach' || timeCfg.mode != 'timed' || !S.go || !q || q.done) return;

    const cd = $('kbcd');
    const fill = $('kbcdfill');
    const txt = $('kbcdtxt');
    const audioLenMs =
      q.snd && q.snd.length
        ? 300 +
          Math.round(
            Math.max(...q.snd.map((x: [number, number, number]) => x[1] + x[2]), 0) *
              1000,
          )
        : 0;

    const beginCount = () => {
      if (S.q !== q || q.done || !S.go || timeCfg.mode != 'timed') return;
      const limitMs = Math.round(timeCfg.sec * 1000);
      const deadline = Date.now() + limitMs;
      cd.hidden = false;

      const tick = () => {
        if (S.q !== q || q.done || !S.go || timeCfg.mode != 'timed') {
          clearActivityTimers();
          return;
        }
        const rem = Math.max(0, deadline - Date.now());
        fill.style.width = `${(rem / limitMs) * 100}%`;
        txt.textContent = `${(rem / 1000).toFixed(1)}s`;
        cd.classList.toggle('urgent', rem <= Math.min(2000, limitMs * 0.35));
      };
      tick();
      S.actCd = setInterval(tick, 50);
      S.actTm = setTimeout(() => {
        clearActivityTimers();
        if (S.q === q && !q.done && S.go) {
          fin(false, true, true);
          playAnswerKeys(q);
        }
      }, limitMs);
    };

    if (audioLenMs > 0) {
      cd.hidden = false;
      cd.classList.remove('urgent');
      fill.style.width = '100%';
      txt.textContent = 'Listen…';
      S.actWaitTm = setTimeout(beginCount, audioLenMs);
    } else {
      beginCount();
    }
  }

  function syncRelativeAnchor(q: any, ok: boolean) {
    if (!q || !q.isRelChord || q.relSynced) return;
    const tolExact = $('tol').value == 'exact';
    if (!tolExact && !S.relLocked && !ok && S.studyMode != 'teach') return;
    const played = q.played || [];
    const allowPlayedAnchor =
      ok &&
      played.length === q.exp?.length &&
      (!S.rangeLocked || !S.relLocked);
    const src = allowPlayedAnchor ? played : q.exp;
    if (!src || !src.length) return;
    const nextLh = q.lhLen > 0 ? src.slice(0, q.lhLen) : null;
    const nextRh = q.rhLen > 0 ? src.slice(q.lhLen || 0) : null;

    const toScaleIdx = getScaleIdxMapper();
    const playedMatchesExp =
      src.length === q.exp?.length && src.every((v: number, i: number) => v === q.exp[i]);

    if (!S.rangeLocked && S.relLocked && S.prevRh?.length && nextRh?.length && allowPlayedAnchor && !playedMatchesExp) {
      const prevAvg =
        S.prevRh.reduce((a: number, b: number) => a + b, 0) / S.prevRh.length;
      const newAvg =
        nextRh.reduce((a: number, b: number) => a + b, 0) / nextRh.length;
      if (Math.abs(newAvg - prevAvg) >= 4) {
        const {tones, dir} = scaleStepsDelta(prevAvg, newAvg);
        showShiftOverlay(tones, dir);
      }
    }

    const cl = S.cl || $('clef').value;
    const bh = curBh();

    if (playedMatchesExp && q.vlRhF?.length === (nextRh?.length || 0) && q.nextVlAnchorRh !== undefined) {
      S.prevRhF = nextRh?.length ? [...q.vlRhF] : null;
      S.prevLhF = nextLh?.length ? [...(q.vlLhF || [])] : null;
      S.vlAnchorRh = q.nextVlAnchorRh ?? null;
      S.vlAnchorLh = q.nextVlAnchorLh ?? null;
      if (q.nextVlDirRh) S.vlPrevDirRh = q.nextVlDirRh;
      if (q.nextVlDirLh) S.vlPrevDirLh = q.nextVlDirLh;
      q.playedVlF = q.vlF ? [...q.vlF] : null;
    } else {
      const prevLhState =
        q.prevLh?.length && q.prevLhF?.length === q.prevLh.length
          ? {ns: q.prevLh, f: q.prevLhF}
          : q.prevLh?.length
            ? {ns: q.prevLh, f: chordF(q.prevLh, 'L')}
            : null;
      const baseExpLh = q.lhLen > 0 ? q.exp?.slice(0, q.lhLen) || [] : [];
      const baseExpRh = q.rhLen > 0 ? q.exp?.slice(q.lhLen || 0) || [] : [];
      const newRhAnchor = nextRh?.length
        ? q.nextVlAnchorRh != null &&
          baseExpRh.length === nextRh.length &&
          nextRh[0] % 12 === baseExpRh[0] % 12
          ? q.nextVlAnchorRh + (toScaleIdx(nextRh[0]) - toScaleIdx(baseExpRh[0]))
          : toScaleIdx(nextRh[0])
        : null;
      const newLhAnchor =
        nextLh?.length && nextLh.length > 1
          ? q.nextVlAnchorLh != null &&
            baseExpLh.length === nextLh.length &&
            nextLh[0] % 12 === baseExpLh[0] % 12
            ? q.nextVlAnchorLh + (toScaleIdx(nextLh[0]) - toScaleIdx(baseExpLh[0]))
            : toScaleIdx(nextLh[0])
          : null;

      const fRhRes = nextRh?.length
        ? nextRh.length === 1
          ? {fingers: [bassNoteF(nextRh[0], 'R', null)], adjusted: false, valid: true}
          : resolveWindowFingersStrict(
              nextRh.map((m: number) => toScaleIdx(m) - newRhAnchor!),
              'R',
            )
        : null;
      const fRh = fRhRes
        ? fRhRes.valid
          ? fRhRes.fingers
          : assignWindowFingers(
              nextRh!.map((m: number) => toScaleIdx(m) - newRhAnchor!),
              'R',
              q.ci?.ints,
            )
        : null;
      const fLhRes = nextLh?.length
        ? nextLh.length === 1
          ? {fingers: [bassNoteF(nextLh[0], 'L', prevLhState)], adjusted: false, valid: true}
          : resolveWindowFingersStrict(
              nextLh.map((m: number) => toScaleIdx(m) - newLhAnchor!),
              'L',
            )
        : null;
      const fLh = fLhRes
        ? fLhRes.valid
          ? fLhRes.fingers
          : assignWindowFingers(
              nextLh!.map((m: number) => toScaleIdx(m) - newLhAnchor!),
              'L',
              q.ci?.ints,
            )
        : null;

      if (q.vlInfo && fRhRes) {
        q.vlInfo.adjusted = fRhRes.adjusted || !!fLhRes?.adjusted;
      }
      S.prevRhF = fRh;
      S.prevLhF = fLh;
      S.vlAnchorRh = newRhAnchor;
      S.vlAnchorLh = newLhAnchor;
      if (!S.vlPrevDirRh) S.vlPrevDirRh = S.vlDir === 'down' ? 'down' : 'up';
      if (!S.vlPrevDirLh) S.vlPrevDirLh = S.vlDir === 'down' ? 'down' : 'up';
      q.playedVlF = [...(fLh || []), ...(fRh || [])];
    }

    S.prevLh = nextLh;
    S.prevRh = nextRh;
    if (ok) q.relSynced = true;
    if (!S.relLocked) {
      S.homeLhAvg =
        S.prevLh && S.prevLh.length
          ? S.prevLh.reduce((a: number, b: number) => a + b, 0) /
            S.prevLh.length
          : null;
      S.homeRhAvg =
        S.prevRh && S.prevRh.length
          ? S.prevRh.reduce((a: number, b: number) => a + b, 0) /
            S.prevRh.length
          : null;
      if (S.rangeLocked) {
        S.lockZoneRh =
          S.vlAnchorRh != null && S.prevRh?.length
            ? windowMidiCorridor(S.vlAnchorRh, S.prevRh.length, vlBoundsForHand('R', cl, bh))
            : S.prevRh?.length
              ? computeLockCorridor(S.prevRh)
              : null;
        S.lockZoneLh =
          S.vlAnchorLh != null && S.prevLh?.length && S.prevLh.length > 1
            ? windowMidiCorridor(S.vlAnchorLh, S.prevLh.length, vlBoundsForHand('L', cl, bh))
            : S.prevLh?.length
              ? computeLockCorridor(S.prevLh)
              : null;
        syncVlBar();
      }
      S.relLocked = true;
    }
  }

  function fin(ok: boolean, score = true, timedOut = false) {
    const q = S.q;
    if (!q || q.done) return;
    q.done = true;
    q.ok = ok;
    q.scored = score;
    q.timedOut = timedOut;
    clearAdvanceTimers();
    clearActivityTimers();
    syncRelativeAnchor(q, ok);

    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && activeEl.closest('#ans, .bar')) activeEl.blur();

    const counted = score && !q.peeked;
    if (counted) {
      const s = S.st;
      const b = s.by[q.lab] || (s.by[q.lab] = [0, 0]);
      s.tot++;
      b[1]++;
      if (ok) {
        s.ok++;
        b[0]++;
        s.str++;
        s.best = Math.max(s.best, s.str);
        // Tempo ramp +5 BPM on 3-streak
        if ($('tramp').checked && s.str > 0 && s.str % 3 == 0) {
          const cur = +$('tempo').value || 80;
          const nxt = Math.min(160, cur + 5);
          if (nxt != cur) {
            const opt = [...$('tempo').options].find(
              (o: HTMLOptionElement) => +o.value == nxt,
            );
            if (!opt) {
              const o = document.createElement('option');
              o.value = String(nxt);
              o.text = String(nxt);
              $('tempo').add(o);
            }
            $('tempo').value = String(nxt);
            syncMetronome();
          }
        }
      } else s.str = 0;
    }

    q.fbBase = timedOut ? "Time's up" : q.tinfo ? q.tinfo : '';
    $('fb').style.color =
      timedOut || (q.isMc && !ok)
        ? 'var(--bad)'
        : q.isMc && ok
          ? 'var(--ok)'
          : 'var(--mut)';
    $('fb').textContent = q.fbBase;

    render();
    vis();
    stats();
    if (score) scheduleAdvance();
  }

  function next() {
    clearAdvanceTimers();
    clearActivityTimers();
    if (S.q && !S.q.done && !S.q.relSynced) syncRelativeAnchor(S.q, false);
    if (S.go) newQ();
  }

  /* =====================================================================
     23. INPUT: MIDI note on/off + velocity + sustain pedal
     ===================================================================== */
  function evalC2sNote(q: any, m: number, exact: boolean): {status: 'step' | 'complete' | 'wrong'; matchedName?: string; hintPc?: number} {
    const prev: number[] = q.c2sNotes || [];
    const attempt = [...prev, m];
    const opts = (q.validScaleOpts || []) as {name: string; fullInts: number[]}[];
    const fits = (cand: {name: string; fullInts: number[]}, notes: number[]) =>
      notes.length <= cand.fullInts.length &&
      notes.every((n, j) =>
        exact
          ? n === q.primarySeq[0] + cand.fullInts[j]
          : n % 12 === (q.pc + cand.fullInts[j]) % 12,
      );
    const matching = opts.filter(cand => fits(cand, attempt));
    if (matching.length > 0) {
      q.c2sNotes = attempt;
      q.hit.add(m);
      q.bad.delete(m);
      const completed = matching.find(c => c.fullInts.length === attempt.length);
      if (completed) {
        const others = (q.validNames || []).filter((n: string) => n !== completed.name);
        q.tinfo = others.length
          ? `Accepted: ${completed.name} (also valid: ${others.join(', ')})`
          : `Accepted: ${completed.name}`;
        return {status: 'complete', matchedName: completed.name};
      }
      return {status: 'step'};
    }
    q.bad.add(m);
    const prevFitting = prev.length ? opts.filter(c => fits(c, prev)) : opts;
    const hintCand = prevFitting[0] || opts[0];
    const hintInt = hintCand?.fullInts[prev.length] ?? 0;
    return {status: 'wrong', hintPc: (q.pc + hintInt) % 12};
  }

  function matchMcharChord(q: any, h: number[], exact: boolean): boolean {
    const exps: number[][] = q.acceptedExps || [q.exp];
    if (exact) {
      return exps.some(ex => match(h, ex));
    }
    const hPcs = [...new Set(h.map(x => x % 12))].sort((a, b) => a - b).join();
    return exps.some(ex => {
      const exPcs = [...new Set(ex.map(x => x % 12))].sort((a, b) => a - b).join();
      return hPcs === exPcs;
    });
  }

  function on(m: number, vel = 96, source: 'midi' | 'pc' = 'midi') {
    if (S.cal) {
      S.cal.push(m);
      if (S.cal.length == 2) {
        const [a, b] = S.cal.sort((x: number, y: number) => x - y);
        $('lowest').value = a;
        $('octs').value = Math.max(2, Math.min(8, Math.round((b - a) / 12)));
        S.cal = null;
        $('calmsg').textContent = 'Done.';
        setRange();
        S.lo = a;
        S.hi = b;
        $('rng').textContent = 'Range: ' + nm(a) + ' – ' + nm(b);
        kb();
      }
      return;
    }

    S.lastVel = vel;
    const kbSnd = $('audioout').value;
    if ((kbSnd == 'all' || (kbSnd == 'pc' && source == 'pc')) && !S.held.has(m)) {
      audioEngine.playNote(m, 0, 1.3, curSound(), vel / 127);
    }

    S.held.add(m);
    kb();

    const q = S.q;
    if (!q || q.done || !S.go || q.g == 'ear' || q.isMc) {
      stats();
      return;
    }

    // In Teach Mode (Class), playing keys guides the student without scoring, following voice-leading & auto-advance rules
    if (S.studyMode == 'teach') {
      const targetList: number[] = q.steps ? q.steps[q.pos] || [] : q.exp || [];
      const exact =
        q.g == 'scale' ||
        $('tol').value == 'exact' ||
        (!!q.isRelAnchored && !!S.rangeLocked) ||
        (q.g == 'prog' && !!q.relProg && !!q.relLocked && q.pos > 0 && !!S.rangeLocked);
      const targetPcs = new Set(targetList.map((x: number) => x % 12));
      const matched = exact ? targetList.includes(m) : targetPcs.has(m % 12);

      if (q.g == 'c2s_play') {
        const res = evalC2sNote(q, m, $('tol').value == 'exact');
        if (res.status === 'complete') {
          q.c2sNotes = [];
          q.hit.clear();
          q.bad.clear();
          render();
          scheduleLearnAdvance(q, q.tinfo || 'Nice scale!', true);
        } else if (res.status === 'step') {
          render();
        } else {
          render();
          scheduleLearnAdvance(
            q,
            res.hintPc != null ? `Target note: ${pn(res.hintPc)}` : 'Check scale note',
            false,
          );
        }
        stats();
        return;
      }

      if (q.g == 'mchar_play') {
        const h = [...S.held].filter((x: number) => !S.ign.has(x));
        const allAccNotes = (q.acceptedExps || [q.exp]).flat();
        const isNoteOk = exact
          ? allAccNotes.includes(m)
          : allAccNotes.some((x: number) => x % 12 === m % 12);
        if (isNoteOk) q.hit.add(m);
        else q.bad.add(m);
        if (h.length >= q.exp.length) {
          S.ign = new Set(S.held);
          const ok = matchMcharChord(q, h, exact);
          q.played = [...h].sort((a, b) => a - b);
          q.hit.clear();
          q.bad.clear();
          if (ok) {
            h.forEach(x => q.hit.add(x));
            scheduleLearnAdvance(q, 'Characteristic chord!', true);
          } else {
            const expPcs = new Set(q.exp.map((x: number) => x % 12));
            h.forEach(x => {
              const isOk = exact ? q.exp.includes(x) : expPcs.has(x % 12);
              if (isOk) q.hit.add(x);
              else q.bad.add(x);
            });
            scheduleLearnAdvance(
              q,
              `Target: ${q.exp.map((n: number) => sm(n).n).join(' ')}`,
              false,
            );
          }
        }
        render();
        stats();
        return;
      }

      if (q.g == 'scale' || q.g == 'mel') {
        if (q.steps) {
          const h = [...S.held].filter((x: number) => !S.ign.has(x));
          if (h.length >= targetList.length) {
            const okStep =
              h.length == targetList.length &&
              targetList.every((em: number, i: number) =>
                exact ? h.sort((a, b) => a - b)[i] == em : h.sort((a, b) => a - b)[i] % 12 == em % 12,
              );
            if (okStep) {
              S.ign = new Set(S.held);
              h.forEach(x => q.hit.add(x));
              q.pos++;
              if (q.pos >= q.steps.length) {
                q.pos = 0;
                scheduleLearnAdvance(q, 'Clean hands-together pass!', true);
              }
              render();
            }
          }
        } else {
          const e = q.seq[q.pos];
          if (exact ? m == e : m % 12 == e % 12) {
            q.hit.add(m);
            q.pos++;
            if (q.pos >= q.seq.length) {
              q.pos = 0;
              scheduleLearnAdvance(q, 'Clean scale pass!', true);
            }
            render();
          } else {
            q.bad.add(m);
            render();
            scheduleLearnAdvance(q, `Target note: ${sm(e).n}`, false);
          }
        }
        stats();
        return;
      }

      if (q.g == 'prog') {
        const h = [...S.held].filter((x: number) => !S.ign.has(x));
        if (matched) q.hit.add(m);
        else q.bad.add(m);
        if (h.length >= q.exp.length) {
          S.ign = new Set(S.held);
          const ok = match(h, q.exp);
          q.hit.clear();
          q.bad.clear();
          if (ok) {
            h.forEach(x => q.hit.add(x));
            if (
              q.pos === 0 &&
              q.relProg &&
              !q.relLocked &&
              $('tol').value != 'exact' &&
              q.ch.length > 1
            ) {
              const cl = S.cl || $('clef').value;
              const bh = curBh();
              const toScaleIdx = getScaleIdxMapper();
              const sortedH = [...h].sort((a, b) => a - b);
              const c0 = q.ch[0];
              c0.exp = sortedH;
              if (q.pos === 0) q.exp = sortedH;
              let pLh: number[] | null =
                c0.lhLen > 0 ? sortedH.slice(0, c0.lhLen) : null;
              let pRh: number[] | null =
                c0.rhLen > 0 ? sortedH.slice(c0.lhLen || 0) : null;
              let aRh: number | null = pRh?.length ? toScaleIdx(pRh[0]) : null;
              let aLh: number | null = pLh?.length && pLh.length > 1 ? toScaleIdx(pLh[0]) : null;
              let pRhF: number[] | null = pRh?.length
                ? S.rangeLocked && aRh != null
                  ? assignWindowFingers(pRh.map((m: number) => toScaleIdx(m) - aRh!), 'R', c0.ints)
                  : computeVoicingFingering(pRh, 'R', null, DEFAULT_FINGERING_RULES, S.prefFingering?.R).primary
                : null;
              let pLhF: number[] | null = pLh?.length
                ? pLh.length === 1
                  ? [bassNoteF(pLh[0], 'L', null)]
                  : S.rangeLocked && aLh != null
                    ? assignWindowFingers(pLh.map((m: number) => toScaleIdx(m) - aLh!), 'L', c0.ints)
                    : computeVoicingFingering(pLh, 'L', null, DEFAULT_FINGERING_RULES, S.prefFingering?.L).primary
                : null;
              c0.vlF = [...(pLhF || []), ...(pRhF || [])];
              let pDirRh: VLDirection = S.vlDir === 'down' ? 'down' : 'up';
              let pDirLh: VLDirection = S.vlDir === 'down' ? 'down' : 'up';
              if (S.rangeLocked) {
                S.lockZoneRh = aRh != null && pRh?.length ? windowMidiCorridor(aRh, pRh.length, vlBoundsForHand('R', cl, bh)) : null;
                S.lockZoneLh = aLh != null && pLh?.length && pLh.length > 1 ? windowMidiCorridor(aLh, pLh.length, vlBoundsForHand('L', cl, bh)) : null;
                syncVlBar();
              }
              for (let idx = 1; idx < q.ch.length; idx++) {
                const step = q.ch[idx];
                const eRes = runEngineVoice({
                  ints: step.ints,
                  pc: step.pc,
                  cl,
                  bh,
                  rangeMode: S.rangeLocked ? 'locked' : 'unlocked',
                  direction: S.vlDir,
                  prevRh: pRh,
                  prevRhF: pRhF,
                  prevAnchorRh: aRh,
                  prevDirRh: pDirRh,
                  prevLh: pLh,
                  prevLhF: pLhF,
                  prevAnchorLh: aLh,
                  prevDirLh: pDirLh,
                  forceBass: step.forceBass,
                });
                step.exp = eRes.notes;
                step.hd = eRes.hd;
                step.lhLen = eRes.lhLen;
                step.rhLen = eRes.rhLen;
                step.vlF = eRes.vlF;
                step.vlFingeringRh = eRes.rhFingering || null;
                step.vlFingeringLh = eRes.lhFingering || null;
                step.vlInfo = eRes.vlInfo;
                if (eRes.rhLen > 0) pRh = eRes.notes.slice(eRes.lhLen);
                if (eRes.lhLen > 0) pLh = eRes.notes.slice(0, eRes.lhLen);
                if (eRes.rhF.length) pRhF = eRes.rhF;
                if (eRes.lhF.length) pLhF = eRes.lhF;
                if (eRes.rhOut) {
                  aRh = eRes.rhOut.anchorIdx;
                  pDirRh = eRes.rhOut.direction;
                }
                if (eRes.lhOut) {
                  aLh = eRes.lhOut.anchorIdx;
                  pDirLh = eRes.lhOut.direction;
                }
              }
              q.relLocked = true;
              q.fgd = null;
            }
            const nextExists = q.ch.slice(q.pos + 1).some((c: any) => !c.rest);
            const mvStep =
              q.relProg && q.pos > 0 && q.ch[q.pos - 1]?.exp
                ? describeVoiceMovement(q.ch[q.pos - 1].exp, h, smOct)
                : null;
            const mvText =
              mvStep && mvStep.summary
                ? `Cost ${mvStep.totalCost} · ${mvStep.summary}`
                : nextExists
                  ? 'Nice chord'
                  : 'Completed progression!';
            scheduleLearnAdvance(q, mvText, true);
          } else {
            const expPcs = new Set(q.exp.map((x: number) => x % 12));
            h.forEach(x => {
              const isOk = exact ? q.exp.includes(x) : expPcs.has(x % 12);
              if (isOk) q.hit.add(x);
              else q.bad.add(x);
            });
            scheduleLearnAdvance(
              q,
              `Check notes (${q.exp.map((n: number) => sm(n).n).join(' ')})`,
              false,
            );
          }
        }
        render();
        stats();
        return;
      }

      const h = [...S.held].filter((x: number) => !S.ign.has(x));
      if (matched) q.hit.add(m);
      else q.bad.add(m);
      if (h.length >= q.exp.length) {
        S.ign = new Set(S.held);
        const ok = match(h, q.exp);
        q.played = [...h].sort((a, b) => a - b);
        q.hit.clear();
        q.bad.clear();
        if (ok) {
          h.forEach(x => q.hit.add(x));
          syncRelativeAnchor(q, true);
          scheduleLearnAdvance(q, 'Cleanly played', true);
        } else {
          const expPcs = new Set(q.exp.map((x: number) => x % 12));
          h.forEach(x => {
            const isOk = exact ? q.exp.includes(x) : expPcs.has(x % 12);
            if (isOk) q.hit.add(x);
            else q.bad.add(x);
          });
          syncRelativeAnchor(q, false);
          scheduleLearnAdvance(
            q,
            `Target: ${q.exp.map((n: number) => sm(n).n).join(' ')}`,
            false,
          );
        }
      }
      render();
      stats();
      return;
    }

    if (q.g == 'prog') {
      const h = [...S.held].filter((x: number) => !S.ign.has(x));
      if (h.length >= q.exp.length) {
        S.ign = new Set(S.held);
        if (match(h, q.exp)) {
          q.bad.clear();
          q.hit.clear();
          // In Any octave + Relative/Close-range mode, lock remaining chords to the start octave played on step 1
          if (
            q.pos === 0 &&
            q.relProg &&
            !q.relLocked &&
            $('tol').value != 'exact' &&
            q.ch.length > 1
          ) {
            const cl = S.cl || $('clef').value;
            const bh = curBh();
            const toScaleIdx = getScaleIdxMapper();
            const sortedH = [...h].sort((a, b) => a - b);
            const c0 = q.ch[0];
            c0.exp = sortedH;
            let pLh: number[] | null =
              c0.lhLen > 0 ? sortedH.slice(0, c0.lhLen) : null;
            let pRh: number[] | null =
              c0.rhLen > 0 ? sortedH.slice(c0.lhLen || 0) : null;
            let aRh: number | null = pRh?.length ? toScaleIdx(pRh[0]) : null;
            let aLh: number | null = pLh?.length && pLh.length > 1 ? toScaleIdx(pLh[0]) : null;
            let pRhF: number[] | null = pRh?.length
              ? S.rangeLocked && aRh != null
                ? assignWindowFingers(pRh.map((m: number) => toScaleIdx(m) - aRh!), 'R', c0.ints)
                : computeVoicingFingering(pRh, 'R', null, DEFAULT_FINGERING_RULES, S.prefFingering?.R).primary
              : null;
            let pLhF: number[] | null = pLh?.length
              ? pLh.length === 1
                ? [bassNoteF(pLh[0], 'L', null)]
                : S.rangeLocked && aLh != null
                  ? assignWindowFingers(pLh.map((m: number) => toScaleIdx(m) - aLh!), 'L', c0.ints)
                  : computeVoicingFingering(pLh, 'L', null, DEFAULT_FINGERING_RULES, S.prefFingering?.L).primary
              : null;
            c0.vlF = [...(pLhF || []), ...(pRhF || [])];
            let pDirRh: VLDirection = S.vlDir === 'down' ? 'down' : 'up';
            let pDirLh: VLDirection = S.vlDir === 'down' ? 'down' : 'up';
            if (S.rangeLocked) {
              S.lockZoneRh = aRh != null && pRh?.length ? windowMidiCorridor(aRh, pRh.length, vlBoundsForHand('R', cl, bh)) : null;
              S.lockZoneLh = aLh != null && pLh?.length && pLh.length > 1 ? windowMidiCorridor(aLh, pLh.length, vlBoundsForHand('L', cl, bh)) : null;
              syncVlBar();
            }
            for (let idx = 1; idx < q.ch.length; idx++) {
              const step = q.ch[idx];
              const eRes = runEngineVoice({
                ints: step.ints,
                pc: step.pc,
                cl,
                bh,
                rangeMode: S.rangeLocked ? 'locked' : 'unlocked',
                direction: S.vlDir,
                prevRh: pRh,
                prevRhF: pRhF,
                prevAnchorRh: aRh,
                prevDirRh: pDirRh,
                prevLh: pLh,
                prevLhF: pLhF,
                prevAnchorLh: aLh,
                prevDirLh: pDirLh,
                forceBass: step.forceBass,
              });
              step.exp = eRes.notes;
              step.hd = eRes.hd;
              step.lhLen = eRes.lhLen;
              step.rhLen = eRes.rhLen;
              step.vlF = eRes.vlF;
              step.vlFingeringRh = eRes.rhFingering || null;
              step.vlFingeringLh = eRes.lhFingering || null;
              step.vlInfo = eRes.vlInfo;
              if (eRes.rhLen > 0) pRh = eRes.notes.slice(eRes.lhLen);
              if (eRes.lhLen > 0) pLh = eRes.notes.slice(0, eRes.lhLen);
              if (eRes.rhF.length) pRhF = eRes.rhF;
              if (eRes.lhF.length) pLhF = eRes.lhF;
              if (eRes.rhOut) {
                aRh = eRes.rhOut.anchorIdx;
                pDirRh = eRes.rhOut.direction;
              }
              if (eRes.lhOut) {
                aLh = eRes.lhOut.anchorIdx;
                pDirLh = eRes.lhOut.direction;
              }
            }
            q.relLocked = true;
            q.fgd = null;
          }
          if (q.beat && q.bm)
            q.tm.push(
              performance.now() - (q.bt0 + (4 + q.ch[q.pos].b) * q.bm),
            );
          if (S.pedal) S.pedalChanged = true;
          const prevStepExp = q.pos > 0 ? q.ch[q.pos - 1]?.exp : null;
          const stepMv =
            q.relProg && prevStepExp
              ? describeVoiceMovement(prevStepExp, h, smOct)
              : null;
          q.pos++;
          while (q.ch[q.pos] && q.ch[q.pos].rest) q.pos++;
          if (q.pos >= q.ch.length) {
            q.played = [...h].sort((a, b) => a - b);
            if (stepMv && stepMv.summary) {
              q.tinfo = `Cost ${stepMv.totalCost} · ${stepMv.summary}`;
            }
            fin(q.err == 0 && tdone(q));
            return;
          }
          pset(q);
          $('fb').style.color = 'var(--mut)';
          $('fb').textContent = S.pedal
            ? 'Lift pedal on chord change'
            : stepMv && stepMv.summary
              ? `Cost ${stepMv.totalCost} · ${stepMv.summary}`
              : '';
        } else {
          q.err++;
          const exact =
            $('tol').value == 'exact' ||
            (!!q.relProg && !!q.relLocked && q.pos > 0 && !!S.rangeLocked);
          const expPcs = new Set(q.exp.map((x: number) => x % 12));
          q.hit.clear();
          q.bad.clear();
          h.forEach((x: number) => {
            const isOk = exact ? q.exp.includes(x) : expPcs.has(x % 12);
            if (isOk) q.hit.add(x);
            else q.bad.add(x);
          });
          $('fb').textContent = '';
        }
        render();
      }
      stats();
      return;
    }

    if (q.g == 'scale' || q.g == 'mel') {
      if (q.steps) {
        const expected = q.steps[q.pos];
        const h = [...S.held]
          .filter((x: number) => !S.ign.has(x))
          .sort((a, b) => a - b);
        if (h.length >= expected.length) {
          S.ign = new Set(S.held);
          const exact = q.g == 'scale' ? true : $('tol').value == 'exact';
          const okStep =
            h.length == expected.length &&
            expected.every((em: number, i: number) =>
              exact ? h[i] == em : h[i] % 12 == em % 12,
            );
          if (okStep) {
            h.forEach((x: number) => {
              q.hit.add(x);
              q.bad.delete(x);
            });
            q.pos++;
            if (q.pos >= q.steps.length) {
              fin(q.err == 0);
              return;
            }
          } else {
            q.err++;
            const expPcs = new Set(expected.map((x: number) => x % 12));
            h.forEach((x: number) => {
              const isOk = exact ? expected.includes(x) : expPcs.has(x % 12);
              if (isOk) {
                q.hit.add(x);
                q.bad.delete(x);
              } else {
                q.bad.add(x);
              }
            });
            $('fb').textContent = '';
          }
          render();
        }
      } else {
        const e = q.seq[q.pos];
        const exact = q.g == 'scale' ? true : $('tol').value == 'exact';
        if (exact ? m == e : m % 12 == e % 12) {
          q.hit.add(m);
          q.bad.delete(m);
          q.pos++;
          if (q.pos >= q.seq.length) {
            fin(q.err == 0);
            return;
          }
        } else {
          q.err++;
          q.bad.add(m);
          $('fb').textContent = '';
        }
        render();
      }
      stats();
      return;
    }

    if (q.g == 'c2s_play') {
      const res = evalC2sNote(q, m, $('tol').value == 'exact');
      if (res.status === 'complete') {
        fin(q.err == 0);
        return;
      }
      if (res.status === 'wrong') {
        q.err++;
        $('fb').textContent = '';
      }
      render();
      stats();
      return;
    }

    if (q.g == 'mchar_play') {
      const h = [...S.held].filter((x: number) => !S.ign.has(x));
      if (h.length >= q.exp.length) {
        q.played = [...h].sort((a, b) => a - b);
        fin(matchMcharChord(q, h, $('tol').value == 'exact'));
      } else {
        stats();
      }
      return;
    }

    const h = [...S.held].filter((x: number) => !S.ign.has(x));
    if (h.length >= q.exp.length) {
      q.played = [...h].sort((a, b) => a - b);
      const isOk = match(h, q.exp);
      if (isOk && q.isRelChord && (q.prevRh?.length || q.prevLh?.length)) {
        const prevSlice = q.prevRh?.length ? q.prevRh : q.prevLh;
        const curSlice =
          q.rhLen > 0 && q.played.length >= (q.lhLen || 0) + q.rhLen
            ? q.played.slice(q.lhLen || 0)
            : q.played;
        const mv = describeVoiceMovement(prevSlice, curSlice, smOct);
        if (mv.summary) {
          q.tinfo = `Cost ${mv.totalCost} · ${mv.summary}`;
        }
      }
      fin(isOk);
    } else stats();
  }

  function off(m: number) {
    S.held.delete(m);
    S.ign.delete(m);
    kb();
  }

  /* =====================================================================
     24. EVENT WIRING
     ===================================================================== */
  const isCompactLandscape = () =>
    window.innerWidth <= 960 &&
    window.innerHeight <= 480 &&
    window.innerWidth > window.innerHeight;
  const isCompactViewport = () =>
    window.innerWidth <= 820 || isCompactLandscape();

  $('start').onclick = (e: MouseEvent) => {
    if (e.detail > 0) (e.currentTarget as HTMLElement).blur();
    S.go = true;
    resetRelChain();
    if (isCompactViewport()) $('app').classList.add('closed');
    next();
  };
  $('nx').onclick = (e: MouseEvent) => {
    if (e.detail > 0) (e.currentTarget as HTMLElement).blur();
    clearAdvanceTimers();
    if (S.studyMode == 'teach' && S.q?.ch && S.q.ch.length > 1) {
      const q = S.q;
      let nxt = q.pos + 1;
      while (q.ch[nxt] && q.ch[nxt].rest) nxt++;
      if (nxt < q.ch.length) {
        q.pos = nxt;
        q.hit?.clear();
        q.bad?.clear();
        $('fb').textContent = '';
        pset(q);
        render();
        stats();
        return;
      }
    }
    next();
  };

  if ($('vldeg')) {
    ($('vldeg') as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('[data-deg]')
      .forEach((btn: HTMLButtonElement) => {
        btn.onclick = (e: MouseEvent) => {
          if (e.detail > 0) btn.blur();
          const deg = Number(btn.dataset.deg);
          if (Number.isNaN(deg)) return;
          S.primDeg = deg;
          resetRelChain();
          syncVlBar();
          if (S.go) next();
        };
      });
  }

  if ($('vllock')) {
    $('vllock').onclick = (e: MouseEvent) => {
      if (e.detail > 0) (e.currentTarget as HTMLElement).blur();
      S.rangeLocked = !S.rangeLocked;
      const cl = S.cl || $('clef').value;
      const bh = curBh();
      if (S.rangeLocked) {
        const rhSrc =
          S.prevRh?.length
            ? S.prevRh
            : S.q?.rhLen > 0 && S.q?.exp?.length
              ? S.q.exp.slice(S.q.lhLen || 0)
              : null;
        const lhSrc =
          S.prevLh?.length
            ? S.prevLh
            : S.q?.lhLen > 0 && S.q?.exp?.length
              ? S.q.exp.slice(0, S.q.lhLen)
              : null;
        S.lockZoneRh =
          S.vlAnchorRh != null && rhSrc?.length
            ? windowMidiCorridor(S.vlAnchorRh, rhSrc.length, vlBoundsForHand('R', cl, bh))
            : rhSrc?.length
              ? computeLockCorridor(rhSrc)
              : null;
        S.lockZoneLh =
          S.vlAnchorLh != null && lhSrc?.length && lhSrc.length > 1
            ? windowMidiCorridor(S.vlAnchorLh, lhSrc.length, vlBoundsForHand('L', cl, bh))
            : lhSrc?.length
              ? computeLockCorridor(lhSrc)
              : null;
      } else {
        S.lockZoneRh = null;
        S.lockZoneLh = null;
      }
      syncVlBar();
      render();
      vis();
    };
  }
  if ($('vldir')) {
    ($('vldir') as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('[data-vldir]')
      .forEach((btn: HTMLButtonElement) => {
        btn.onclick = (e: MouseEvent) => {
          if (e.detail > 0) btn.blur();
          const dir = btn.dataset.vldir as VLDirectionSetting | undefined;
          if (!dir || (dir !== 'auto' && dir !== 'up' && dir !== 'down')) return;
          S.vlDir = dir;
          S.vlDirManual = true;
          if (dir !== 'auto') {
            S.vlPrevDirRh = dir;
            S.vlPrevDirLh = dir;
          }
          syncVlBar();
          if (S.go) {
            if (!S.relLocked) resetRelChain();
            newQ();
          }
        };
      });
  }
  if ($('vl7')) {
    ($('vl7') as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('[data-vl7]')
      .forEach((btn: HTMLButtonElement) => {
        btn.onclick = (e: MouseEvent) => {
          if (e.detail > 0) btn.blur();
          const m = btn.dataset.vl7 as VLSeventhMode | undefined;
          if (!m || (m !== 'full' && m !== 'omit5' && m !== 'auto')) return;
          S.vl7Mode = m;
          syncVlBar();
          if (S.go) {
            if (!S.relLocked) resetRelChain();
            newQ();
          }
        };
      });
  }
  if ($('scmode')) {
    ($('scmode') as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('[data-scmode]')
      .forEach((btn: HTMLButtonElement) => {
        btn.onclick = (e: MouseEvent) => {
          if (e.detail > 0) btn.blur();
          const m = btn.dataset.scmode;
          if (m !== 'play' && m !== 'quiz') return;
          S.scMode = m;
          syncScBar();
          if (S.go) next();
        };
      });
  }
  if ($('scdiff')) {
    ($('scdiff') as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('[data-scdiff]')
      .forEach((btn: HTMLButtonElement) => {
        btn.onclick = (e: MouseEvent) => {
          if (e.detail > 0) btn.blur();
          const d = btn.dataset.scdiff;
          if (d !== 'beginner' && d !== 'advanced') return;
          S.scDiff = d;
          syncScBar();
          if (S.go) next();
        };
      });
  }
  if ($('learn2prac')) {
    $('learn2prac').onclick = (e: MouseEvent) => {
      if (e.detail > 0) (e.currentTarget as HTMLElement).blur();
      opts?.onMoveToPractice?.();
    };
  }

  // Toggleable Show answer / Hide answer button
  $('rv').onclick = (e: MouseEvent) => {
    if (e.detail > 0) (e.currentTarget as HTMLElement).blur();
    const q = S.q;
    if (!q || q.done) return;
    q.revealed = !q.revealed;
    if (q.revealed) q.peeked = true;
    render();
    vis();
  };

  const advBtn = $('advbtn');
  const advPop = $('advpop');
  const advWrap = $('advwrap');
  const advSecInput = $('advsec') as HTMLInputElement;

  const timeBtn = $('timebtn');
  const timePop = $('timepop');
  const timeWrap = $('timewrap');
  const timeSecInput = $('timesec') as HTMLInputElement;

  function saveAdvCfg() {
    try {
      localStorage.setItem(ADV_KEY, JSON.stringify(advCfg));
    } catch {
      // ignore
    }
  }

  function saveTimeCfg() {
    try {
      localStorage.setItem(TIME_KEY, JSON.stringify(timeCfg));
    } catch {
      // ignore
    }
  }

  function syncAdvanceUI() {
    $('advlbl').textContent =
      advCfg.mode == 'manual'
        ? 'Manual · Enter'
        : `Auto · ${fmtAdvSec(advCfg.sec)}`;
    advBtn.classList.toggle('manual', advCfg.mode == 'manual');
    $('advsecwrap').classList.toggle('dim', advCfg.mode == 'manual');
    $('advseclbl').textContent = fmtAdvSec(advCfg.sec);
    if (document.activeElement !== advSecInput) {
      advSecInput.value = String(advCfg.sec);
    }
    (advPop as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('[data-advmode]')
      .forEach(b => b.classList.toggle('active', b.dataset.advmode == advCfg.mode));
    (advPop as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('[data-sec]')
      .forEach(b =>
        b.classList.toggle('active', Number(b.dataset.sec) == advCfg.sec),
      );
    $('advhint').textContent =
      advCfg.mode == 'manual'
        ? 'Result stays visible so you can check notes & fingering. Click Next or press Enter for the next chord.'
        : `Next chord loads automatically after ${fmtAdvSec(advCfg.sec)}. Click Next or press Enter anytime to skip ahead.`;
  }

  function syncTimeUI() {
    $('timelbl').textContent =
      timeCfg.mode == 'timed' ? `Timed · ${timeCfg.sec}s` : 'Untimed';
    timeBtn.classList.toggle('timed', timeCfg.mode == 'timed');
    $('timesecwrap').classList.toggle('dim', timeCfg.mode == 'untimed');
    $('timeseclbl').textContent = `${timeCfg.sec}s`;
    if (document.activeElement !== timeSecInput) {
      timeSecInput.value = String(timeCfg.sec);
    }
    (timePop as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('[data-timemode]')
      .forEach(b =>
        b.classList.toggle('active', b.dataset.timemode == timeCfg.mode),
      );
    (timePop as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('[data-tsec]')
      .forEach(b =>
        b.classList.toggle('active', Number(b.dataset.tsec) == timeCfg.sec),
      );
    $('timehint').textContent =
      timeCfg.mode == 'timed'
        ? `Countdown runs over the keyboard. When ${timeCfg.sec}s finishes, the target keys are shown and played.`
        : 'Practice at your own pace with no countdown over the keyboard.';
  }

  function setAdvOpen(open: boolean) {
    advPop.hidden = !open;
    advBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setTimeOpen(false);
  }

  function setTimeOpen(open: boolean) {
    timePop.hidden = !open;
    timeBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      advPop.hidden = true;
      advBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function applyAdvChange() {
    saveAdvCfg();
    syncAdvanceUI();
    syncActionButtons(S.q);
    if (S.q?.done && S.q?.scored) scheduleAdvance();
  }

  function applyTimeChange() {
    saveTimeCfg();
    syncTimeUI();
    if (S.go && S.q && !S.q.done) {
      if (timeCfg.mode == 'timed') startActivityCountdown(S.q);
      else clearActivityTimers();
    } else if (timeCfg.mode == 'untimed') {
      clearActivityTimers();
    }
  }

  advBtn.onclick = (e: MouseEvent) => {
    e.stopPropagation();
    if (e.detail > 0) advBtn.blur();
    setAdvOpen(advPop.hidden);
  };

  timeBtn.onclick = (e: MouseEvent) => {
    e.stopPropagation();
    if (e.detail > 0) timeBtn.blur();
    setTimeOpen(timePop.hidden);
  };

  advPop.addEventListener(
    'click',
    (e: Event) => {
      const target = e.target as HTMLElement;
      const modeBtn = target.closest<HTMLButtonElement>('[data-advmode]');
      if (modeBtn) {
        advCfg.mode =
          modeBtn.dataset.advmode == 'manual' ? 'manual' : 'timed';
        applyAdvChange();
        return;
      }
      const secBtn = target.closest<HTMLButtonElement>('[data-sec]');
      if (secBtn) {
        advCfg.mode = 'timed';
        advCfg.sec = clampAdvSec(Number(secBtn.dataset.sec));
        applyAdvChange();
      }
    },
    {signal},
  );

  timePop.addEventListener(
    'click',
    (e: Event) => {
      const target = e.target as HTMLElement;
      const modeBtn = target.closest<HTMLButtonElement>('[data-timemode]');
      if (modeBtn) {
        timeCfg.mode =
          modeBtn.dataset.timemode == 'timed' ? 'timed' : 'untimed';
        applyTimeChange();
        return;
      }
      const secBtn = target.closest<HTMLButtonElement>('[data-tsec]');
      if (secBtn) {
        timeCfg.mode = 'timed';
        timeCfg.sec = clampTimeSec(Number(secBtn.dataset.tsec));
        applyTimeChange();
      }
    },
    {signal},
  );

  $('advminus').onclick = () => {
    advCfg.mode = 'timed';
    advCfg.sec = clampAdvSec(advCfg.sec - 0.5);
    applyAdvChange();
  };
  $('advplus').onclick = () => {
    advCfg.mode = 'timed';
    advCfg.sec = clampAdvSec(advCfg.sec + 0.5);
    applyAdvChange();
  };
  advSecInput.addEventListener(
    'input',
    () => {
      const v = Number(advSecInput.value);
      if (Number.isFinite(v) && v >= 0.5 && v <= 30) {
        advCfg.mode = 'timed';
        advCfg.sec = clampAdvSec(v);
        applyAdvChange();
      }
    },
    {signal},
  );
  advSecInput.addEventListener(
    'change',
    () => {
      const v = Number(advSecInput.value);
      advCfg.mode = 'timed';
      advCfg.sec = Number.isFinite(v) ? clampAdvSec(v) : 2;
      advSecInput.value = String(advCfg.sec);
      applyAdvChange();
    },
    {signal},
  );
  advSecInput.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key == 'Enter') {
        e.preventDefault();
        advSecInput.blur();
        setAdvOpen(false);
      }
    },
    {signal},
  );

  $('timeminus').onclick = () => {
    timeCfg.mode = 'timed';
    timeCfg.sec = clampTimeSec(timeCfg.sec - 1);
    applyTimeChange();
  };
  $('timeplus').onclick = () => {
    timeCfg.mode = 'timed';
    timeCfg.sec = clampTimeSec(timeCfg.sec + 1);
    applyTimeChange();
  };
  timeSecInput.addEventListener(
    'input',
    () => {
      const v = Number(timeSecInput.value);
      if (Number.isFinite(v) && v >= 1 && v <= 60) {
        timeCfg.mode = 'timed';
        timeCfg.sec = clampTimeSec(v);
        applyTimeChange();
      }
    },
    {signal},
  );
  timeSecInput.addEventListener(
    'change',
    () => {
      const v = Number(timeSecInput.value);
      timeCfg.mode = 'timed';
      timeCfg.sec = Number.isFinite(v) ? clampTimeSec(v) : 5;
      timeSecInput.value = String(timeCfg.sec);
      applyTimeChange();
    },
    {signal},
  );
  timeSecInput.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key == 'Enter') {
        e.preventDefault();
        timeSecInput.blur();
        setTimeOpen(false);
      }
    },
    {signal},
  );

  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      const n = e.target as Node;
      if (!advPop.hidden && !advWrap.contains(n)) setAdvOpen(false);
      if (!timePop.hidden && !timeWrap.contains(n)) setTimeOpen(false);
    },
    {signal},
  );

  syncAdvanceUI();
  syncTimeUI();

  if (navigator.requestMIDIAccess)
    navigator
      .requestMIDIAccess()
      .then(a => {
        const hook = () => {
          const n: string[] = [];
          a.inputs.forEach(i => {
            i.onmidimessage = e => {
              if (!e.data) return;
              const [s, d, v] = e.data,
                c = s & 240;
              if (c == 144 && v > 0) on(d, v, 'midi');
              else if (c == 128 || c == 144) off(d);
              else if (c == 176 && d == 64) {
                S.pedal = v >= 64;
                if (!S.pedal) S.pedalChanged = false;
                stats();
              }
            };
            if (i.name) n.push(i.name);
          });
          if ($('midi'))
            $('midi').textContent = n.length
              ? 'MIDI connected: ' + n.join(', ')
              : 'No MIDI device found – plug in your piano';
        };
        a.onstatechange = hook;
        hook();
      })
      .catch(() => {
        if ($('midi'))
          $('midi').textContent =
            'MIDI access blocked – allow it in the browser, or test with the computer keyboard';
      });
  else if ($('midi'))
    $('midi').textContent = 'This browser has no Web MIDI – use Chrome or Edge';

  const KM = 'awsedftgyhujkolp;';
  const kd: Record<string, number> = {};
  let ko = 60;

  window.addEventListener(
    'keydown',
    e => {
      const v = document.body.dataset.view;
      if (
        (v !== 'practice' && v !== 'learn') ||
        document.body.dataset.modal === 'open'
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && (advWrap.contains(target) || timeWrap.contains(target))) {
        if (e.key == 'Escape') {
          setAdvOpen(false);
          setTimeOpen(false);
          advBtn.blur();
          timeBtn.blur();
        }
        return;
      }
      const tag = target?.tagName || '';
      if (/SELECT|INPUT|TEXTAREA/.test(tag) || e.repeat || e.ctrlKey) return;
      const i = KM.indexOf(e.key);
      if (i >= 0) {
        kd[e.key] = ko + i;
        on(ko + i, 90, 'pc');
      } else if (e.key == 'z') ko -= 12;
      else if (e.key == 'x') ko += 12;
      else if (
        (e.key == 'Enter' || e.key == ' ') &&
        tag != 'BUTTON' &&
        !document.querySelector('.cur-overlay, .confirm-overlay')
      ) {
        e.preventDefault();
        if (S.go) $('nx').click();
        else if (e.key == 'Enter') $('start').click();
      }
    },
    {signal},
  );

  window.addEventListener(
    'keyup',
    e => {
      const m = kd[e.key];
      if (m != null) {
        off(m);
        delete kd[e.key];
      }
    },
    {signal},
  );

  $('inmode').checked = true;
  $('vlead').checked = true;
  $('fing').checked = true;
  $('dtl').checked = true;
  syncOctaveVLState({vlead: true});
  try {
    const savedKbAudio = localStorage.getItem('pedagogue_kbaudio_v1');
    if (savedKbAudio && ['off', 'pc', 'all'].includes(savedKbAudio)) {
      $('audioout').value = savedKbAudio;
    } else {
      $('audioout').value = 'pc';
    }
  } catch {
    $('audioout').value = 'pc';
  }

  $('q').onclick = $('stf').onclick = openInfo;
  if ($('ix')) {
    $('ix').onclick = () => {
      $('app').classList.remove('io');
    };
  }

  if ($('ib')) {
    $('ib').addEventListener(
      'change',
      (e: Event) => {
        const t = e.target as HTMLSelectElement;
        if (t?.id === 'famAnchor') {
          S.famAnchorChord = t.value;
          fillInfo();
        }
      },
      {signal},
    );
    $('ib').addEventListener(
      'click',
      (e: MouseEvent) => {
        const chip = (e.target as HTMLElement).closest('.fam-chip') as HTMLElement | null;
        if (!chip) return;
        const notes = (chip.dataset.notes || '')
          .split(',')
          .map(Number)
          .filter(n => Number.isFinite(n) && n > 0);
        if (!notes.length) return;
        audioEngine.resume();
        const sndPreset = curSound();
        notes.forEach((n, idx) => audioEngine.playNote(n, idx * 0.03, 1.1, sndPreset, 0.78));
        S.hl = new Set(notes);
        kb();
      },
      {signal},
    );
  }

  if ($('fgrow')) {
    $('fgrow').addEventListener(
      'click',
      (e: MouseEvent) => {
        const opt = (e.target as HTMLElement).closest('.fg-stack-opt') as HTMLElement | null;
        if (!opt || !S.q) return;
        const hand = opt.dataset.hand === 'L' ? 'L' : 'R';
        const shape = (opt.dataset.shape || '')
          .split(',')
          .map(Number)
          .filter(n => Number.isFinite(n) && n >= 1 && n <= 5);
        if (!shape.length) return;
        S.prefFingering[hand] = shape;

        const q = S.q;
        const item = q.ch ? q.ch[q.pos] : q;
        const notes: number[] = item?.exp || q.exp || [];
        const hd: string[] =
          item?.hd ||
          q.hd ||
          notes.map(() => ($('clef').value === 'bass' ? 'L' : 'R'));
        const handNotes = notes.filter((_, idx) => (hd[idx] || 'R') === hand);
        if (handNotes.length) {
          const prevNs = hand === 'R' ? q.prevRh : q.prevLh;
          const prevFs = hand === 'R' ? q.prevRhF : q.prevLhF;
          const newF = computeVoicingFingering(
            handNotes,
            hand,
            prevNs?.length && prevFs?.length === prevNs.length
              ? {
                  notes: prevNs,
                  primary: prevFs.map((x: any) => Number(String(x).split('/')[0]) || 1),
                }
              : null,
            DEFAULT_FINGERING_RULES,
            shape,
          );
          if (hand === 'R') {
            item.vlFingeringRh = newF;
            if (item === q) q.vlRhF = newF.primary;
          } else {
            item.vlFingeringLh = newF;
            if (item === q) q.vlLhF = newF.primary;
          }
          const lTokens =
            item.vlFingeringLh?.perNote.map((p: any) =>
              p.fingers.length === 2 ? `${p.fingers[0]}/${p.fingers[1]}` : p.fingers[0],
            ) || [];
          const rTokens =
            item.vlFingeringRh?.perNote.map((p: any) =>
              p.fingers.length === 2 ? `${p.fingers[0]}/${p.fingers[1]}` : p.fingers[0],
            ) || [];
          if (lTokens.length + rTokens.length === notes.length) {
            item.vlF = [...lTokens, ...rTokens];
          }
          q.fgd = null;
        }
        render();
      },
      {signal},
    );
  }

  $('fgb').onclick = (e: MouseEvent) => {
    if (e.detail > 0) (e.currentTarget as HTMLElement).blur();
    if ($('fgb').disabled) return;
    $('fing').checked = !$('fing').checked;
    $('fing').dispatchEvent(new Event('change', {bubbles: true}));
  };

  window.addEventListener(
    'keydown',
    e => {
      if (e.key == 'Escape') {
        $('app').classList.remove('io');
        setAdvOpen(false);
        setTimeOpen(false);
      }
    },
    {signal},
  );

  $('fing').onchange = () => {
    render();
    vis();
  };

  S.vlDir = ORD() ? 'up' : 'auto';
  fillModesForScale(true);
  fillFocus();
  vis();
  syncActionButtons(null);

  const tg = (c?: boolean) => {
    $('app')?.classList.toggle('closed', c);
    if ($('gear')) {
      $('gear').title = $('app')?.classList.contains('closed')
        ? 'Show settings'
        : 'Hide settings';
    }
  };
  if ($('bd')) {
    $('bd').onclick = () => {
      tg(true);
      $('app')?.classList.remove('io');
    };
  }
  if ($('gear')) {
    $('gear').onclick = () => tg();
  }
  tg(isCompactViewport());

  document.querySelectorAll('.seg button').forEach((b: any) => {
    b.onclick = () => {
      const e = $(b.parentNode.dataset.for);
      e.value = b.dataset.v;
      e.dispatchEvent(new Event('change', {bubbles: true}));
    };
  });

  $('set').addEventListener(
    'change',
    (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.id == 'ug') fillFocus();
      if (target.id == 'scale') fillModesForScale(false);
      if (target.id == 'inmode') S.prefInMode = target.checked;
      if (target.id == 'vlead') syncOctaveVLState({vlead: target.checked});
      if (target.id == 'randoct') syncOctaveVLState({randomOctave: target.checked});
      if (target.id == 'audioout') {
        try {
          localStorage.setItem('pedagogue_kbaudio_v1', target.value);
        } catch {
          // ignore
        }
      }
      if (target.id == 'beat' || target.id == 'tempo' || target.id == 'feel') {
        syncMetronome();
      }
      if (
        [
          'ug',
          'focus',
          'inmode',
          'altchords',
          'key',
          'scale',
          'mode',
          'bhmode',
          'inv',
          'lhinv',
          'scrange',
          'scmultioct',
          'schands',
          'sccontrary',
          'exinv',
          'dir',
          'tol',
          'order',
          'randoct',
          'vlead',
          'clef',
        ].includes(target.id)
      ) {
        if (target.id == 'order' && !S.vlDirManual) {
          S.vlDir = ORD() ? 'up' : 'auto';
        }
        resetRelChain();
      }

      vis();

      if (target.id == 'pfmt') {
        if (S.q?.ch && S.q.rom) {
          pset(S.q);
          render();
          return;
        }
        if (S.q?.refreshLabels) {
          S.q.refreshLabels();
          render();
          return;
        }
      }

      if (
        S.go &&
        ![
          'prompt',
          'fing',
          'fingcheck',
          'dtl',
          'beat',
          'tempo',
          'feel',
          'sound',
          'audioout',
          'tramp',
        ].includes(target.id)
      )
        next();
    },
    {signal},
  );

  $('pl').onclick = (e: MouseEvent) => {
    if (e.detail > 0) (e.currentTarget as HTMLElement).blur();
    playQ();
  };

  $('ans').onclick = (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest('button'),
      q = S.q;
    if (b && e.detail > 0) b.blur();
    if (!b || !q || q.done) return;
    if (q.g == 'ear') {
      fin(b.dataset.a == q.key);
    } else if (q.isMc) {
      const picked = b.dataset.a || '';
      const ok = q.onChoice
        ? !!q.onChoice(picked)
        : q.validSet
          ? q.validSet.has(picked)
          : picked == q.key;
      b.classList.add(ok ? 'mc-pick-ok' : 'mc-pick-bad');
      if (!ok && q.validSet) {
        ($('ans') as HTMLElement)
          .querySelectorAll<HTMLButtonElement>('[data-a]')
          .forEach(btn => {
            if (q.validSet.has(btn.dataset.a || '')) {
              btn.classList.add('mc-ans-valid');
            }
          });
      }
      fin(ok);
    }
  };

  $('clef').onchange = $('prompt').onchange = () => {
    if (S.go && $('clef').value == 'grand') next();
    else render();
  };

  /* =====================================================================
     25. CURRICULUM DRILL LAUNCHER BRIDGE
     ===================================================================== */
  function applyDrill(preset: DrillPreset) {
    $('ug').value = preset.ug;
    fillFocus();
    $('focus').value = preset.focus;
    if (preset.inmode != null) {
      $('inmode').checked = preset.inmode;
      S.prefInMode = preset.inmode;
    }
    if (preset.key) $('key').value = preset.key;
    if (preset.mode) {
      const fam = getScaleFamilyForMode(preset.mode);
      if ($('scale')) $('scale').value = fam;
      fillModesForScale(false);
      $('mode').value = preset.mode;
    }
    if (preset.clef) $('clef').value = preset.clef;
    if (preset.bhmode) $('bhmode').value = preset.bhmode;
    if (preset.inv != null) $('inv').value = String(preset.inv);
    if (preset.lhinv != null) $('lhinv').value = String(preset.lhinv);
    if (preset.scrange) {
      if (preset.scrange === '1') {
        $('scrange').value = '1';
      } else {
        $('scrange').value = 'multi';
        if ($('scmultioct')) {
          $('scmultioct').value =
            preset.scrange === '2' ? '2' : preset.scmultioct || 'auto';
        }
      }
    }
    if (preset.scmultioct && $('scmultioct')) {
      $('scmultioct').value = preset.scmultioct;
    }
    if (preset.schands) {
      $('schands').value =
        preset.schands === 'one'
          ? preset.clef === 'bass'
            ? 'left'
            : 'right'
          : preset.schands;
    }
    if (preset.sccontrary && $('sccontrary')) {
      $('sccontrary').value = preset.sccontrary;
    }
    if (preset.pfmt) $('pfmt').value = preset.pfmt;
    $('vlead').checked = Boolean(preset.vlead);
    syncOctaveVLState({vlead: Boolean(preset.vlead)});
    if ($('altchords')) $('altchords').checked = false;
    if (preset.order) $('order').value = preset.order;
    if (preset.dir) $('dir').value = preset.dir;
    if (preset.beat != null) $('beat').checked = preset.beat;
    if (preset.tempo) {
      if (
        ![...$('tempo').options].some(
          (o: HTMLOptionElement) => o.value == preset.tempo,
        )
      ) {
        const o = document.createElement('option');
        o.value = preset.tempo;
        o.text = preset.tempo;
        $('tempo').add(o);
      }
      $('tempo').value = preset.tempo;
    }
    if (preset.feel) $('feel').value = preset.feel;
    if (preset.sound) $('sound').value = preset.sound;
    if (preset.prompt) $('prompt').value = preset.prompt;

    if (!S.vlDirManual) S.vlDir = ORD() ? 'up' : 'auto';
    S.go = true;
    resetRelChain();
    vis();
    next();
  }

  function resetScore() {
    clearAdvanceTimers();
    clearActivityTimers();
    S.st = {ok: 0, tot: 0, str: 0, best: 0, by: {}};
    resetRelChain();
    S.held.clear();
    S.ign.clear();
    stats();
    if (S.go) {
      next();
    } else {
      render();
      kb();
    }
  }

  function refreshLayout() {
    kb();
    if (S.q) render();
    stats();
  }

  function setStudyMode(mode: 'practice' | 'teach', preset?: DrillPreset) {
    clearAdvanceTimers();
    clearActivityTimers();
    S.studyMode = mode;
    S.held.clear();
    S.ign.clear();

    if (mode === 'teach') {
      if (!isCompactLandscape()) $('app').classList.add('io');
      else $('app').classList.remove('io');
      if (preset) {
        applyDrill(preset);
      } else {
        S.go = true;
        if (S.q) {
          S.q.done = false;
          S.q.revealed = false;
          S.q.hit?.clear();
          S.q.bad?.clear();
          $('fb').textContent = '';
          render();
          vis();
          stats();
        } else {
          next();
        }
      }
      return;
    }

    if (preset) {
      $('app').classList.remove('io');
      applyDrill(preset);
      return;
    }

    $('app').classList.remove('io');
    S.go = true;
    resetRelChain();
    vis();
    next();
  }

  return {
    applyDrill,
    setStudyMode,
    resetScore,
    refreshLayout,
    destroy: () => {
      clearAdvanceTimers();
      clearActivityTimers();
      hideShiftOverlay();
      audioEngine.stopMetronome();
      ac.abort();
    },
  };
}
