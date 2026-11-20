/* eslint-disable @typescript-eslint/no-explicit-any */
import {audioEngine, type MetronomeFeel, type SoundPreset} from './audioEngine';
import type {DrillPreset} from './curriculumData';

export interface PedagogueController {
  destroy: () => void;
  applyDrill: (preset: DrillPreset) => void;
}

export function initPedagogue(): PedagogueController {
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

  const MODES: Record<string, number[]> = {
    Ionian: [0, 2, 4, 5, 7, 9, 11],
    Dorian: [0, 2, 3, 5, 7, 9, 10],
    Phrygian: [0, 1, 3, 5, 7, 8, 10],
    Lydian: [0, 2, 4, 6, 7, 9, 11],
    Mixolydian: [0, 2, 4, 5, 7, 9, 10],
    Aeolian: [0, 2, 3, 5, 7, 8, 10],
    Locrian: [0, 1, 3, 5, 6, 8, 10],
    'Harmonic minor': [0, 2, 3, 5, 7, 8, 11],
    'Melodic minor': [0, 2, 3, 5, 7, 9, 11],
    'Lydian dominant': [0, 2, 4, 6, 7, 9, 10],
    Altered: [0, 1, 3, 4, 6, 8, 10],
    'Phrygian dominant': [0, 1, 4, 5, 7, 8, 10],
    'Dorian ♭2': [0, 1, 3, 5, 7, 9, 10],
    'Lydian augmented': [0, 2, 4, 6, 8, 9, 11],
    'Mixolydian ♭6': [0, 2, 4, 5, 7, 8, 10],
    'Locrian ♮2': [0, 2, 3, 5, 6, 8, 10],
    'Locrian ♮6': [0, 1, 3, 5, 6, 9, 10],
    'Ionian ♯5': [0, 2, 4, 5, 8, 9, 11],
    'Dorian ♯4': [0, 2, 3, 6, 7, 9, 10],
    'Lydian ♯2': [0, 3, 4, 6, 7, 9, 11],
    'Super Locrian ♭♭7': [0, 1, 3, 4, 6, 8, 9],
  };

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
      ['alt', 'Altered & colourful dominants', 'A', 'Colour'],
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
      ['c_auth', 'Authentic cadence', 'B', 'Cadences'],
      ['c_plag', 'Plagal cadence (Gospel I–IV–I)', 'B', 'Cadences'],
      ['c_half', 'Half cadence', 'B', 'Cadences'],
      ['h_sec', 'Secondary dominants', 'I', 'Substitutions'],
      ['h_tri', 'Tritone substitution', 'I', 'Substitutions'],
      ['c_dec', 'Deceptive cadence', 'I', 'Cadences'],
      ['h_bor', 'Modal interchange (borrowed)', 'I', 'Colour'],
      ['h_mii', 'Minor ii–V–i', 'I', 'Minor'],
      ['h_guide', 'Guide-tone targeting (3rds & 7ths)', 'I', 'Voice leading'],
      ['h_close', 'Close-range voice leading (triads)', 'B', 'Voice leading'],
      ['h_close7', 'Close-range voice leading (7th chords)', 'I', 'Voice leading'],
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
    scale: 'Scales',
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
        ['scale', 'Scales'],
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
    fld('key', 'Key', [['rnd', 'Any (Random)'], ...OPT(KEYS)], 'C', ALL) +
    fld(
      'mode',
      'Mode',
      [['rnd', 'Any (Random)'], ...OPT(Object.keys(MODES))],
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
        ['1', '1 octave'],
        ['2', '2 octaves'],
      ],
      '1',
      'scale',
      1,
    ) +
    fld(
      'schands',
      'Scale hands',
      [
        ['one', 'One hand'],
        ['parallel', 'Hands together'],
        ['contrary', 'Contrary motion'],
      ],
      'one',
      'scale',
    ) +
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
      NOEAR,
      1,
    ) +
    swt(
      'vlead',
      'Relative voice leading',
      'Connects chords, harmony & progressions in close range using all chord inversions and dynamic fingering. Locks register from your start chord.',
      'chord,prog,harm',
    ) +
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
    `<select id=game>${['chord', 'slash', 'pass', 'scale', 'int', 'prog', 'harm_guide', 'harm_close', 'ear'].map(x => `<option>${x}</option>`).join('')}</select>` +
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
    relLocked: false,
    homeRhAvg: null as number | null,
    homeLhAvg: null as number | null,
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

  function setRange() {
    S.lo = +$('lowest').value;
    S.hi = Math.min(S.lo + +$('octs').value * 12, 108);
    $('rng').textContent = 'Range: ' + nm(S.lo) + ' – ' + nm(S.hi);
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
    const P: string[] | null = S.mp
      ? S.mp
      : m == 'rnd'
        ? Object.keys(MODES).slice(0, 7)
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
    const t = i[1],
      f = i[2],
      n = i.length;
    let b: string;

    if (t == 2 || t == 5) {
      b =
        (n > 3 ? ({11: 'maj7', 10: '7', 9: '6'} as any)[i[3]] || '' : '') +
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
          } as any
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

  function makeVoicingMidi(ints: number[], pc: number, inv: number, oct: number) {
    const a = ints.map(x => 12 * (oct + 1) + pc + x);
    for (let i = 0; i < inv; i++) a.push(a.shift()! + 12);
    return [...new Set(a)].sort((x, y) => x - y);
  }

  function put(ints: number[], pc: number, inv: number, z: number[]) {
    const fit = (a: number[], l: number, h: number) =>
      a[0] >= l && a.at(-1)! <= h;
    const A: number[][] = [];
    for (let o = -1; o < 9; o++) A.push(makeVoicingMidi(ints, pc, inv, o));

    let c = A.filter(a => fit(a, Math.max(S.lo, z[0]), Math.min(S.hi, z[1])));
    if (!c.length) c = A.filter(a => fit(a, S.lo, S.hi));
    return c.length ? c[rand(c.length)] : makeVoicingMidi(ints, pc, inv, 4);
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
        const a = makeVoicingMidi(ints, pc, inv, o);
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
      return {notes: put(ints, pc, inv, [loBound, hiBound]), inv};
    }

    const prevSorted = [...prevNotes].sort((a, b) => a - b);
    const prevAvg = prevSorted.reduce((s, n) => s + n, 0) / prevSorted.length;
    const searchLo = Math.max(S.lo, Math.min(loBound, prevSorted[0] - 12));
    const searchHi = Math.min(S.hi, Math.max(hiBound, prevSorted[prevSorted.length - 1] + 12));
    let best: {notes: number[]; inv: number; cost: number} | null = null;

    for (const inv of invs) {
      for (let o = -1; o <= 8; o++) {
        const a = makeVoicingMidi(ints, pc, inv, o);
        if (a[0] < searchLo || a.at(-1)! > searchHi) continue;
        // Respect caller's upper hand ceiling when LH must stay below RH
        if (zone[1] < 80 && a.at(-1)! > hiBound && prevSorted[prevSorted.length - 1] <= hiBound)
          continue;
        if (a.at(-1)! > zHi && zHi < 70) continue;
        const avg = a.reduce((s, n) => s + n, 0) / a.length;
        let dist = Math.abs(avg - prevAvg) * 0.12;
        if (homeAvg != null) dist += Math.abs(avg - homeAvg) * 0.08;
        if (a.length === prevSorted.length) {
          // Exact voice-to-voice finger travel distance
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
        if (!best || dist < best.cost) best = {notes: a, inv, cost: dist};
      }
    }

    if (best) return {notes: best.notes, inv: best.inv};
    const fallbackInv = invs[0];
    return {notes: put(ints, pc, fallbackInv, [loBound, hiBound]), inv: fallbackInv};
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
  ): VoicedChord {
    const c = $('clef').value;
    const maxRhInv = allowAllInv || smooth ? ints.length - 1 : undefined;
    const maxLhInv =
      allowAllInv || smooth
        ? ints.length - 1
        : Math.min(+$('lhinv').value, ints.length - 1);

    if (c == 'bass') {
      const bZone: [number, number] =
        smooth && prevLh && prevLh.length
          ? [Math.max(S.lo, prevLh[0] - 12), Math.min(S.hi, prevLh[prevLh.length - 1] + 12)]
          : [36, 59];
      const lhObj = smooth
        ? putVoiceLed(ints, pc, prevLh || null, undefined, bZone, maxRhInv, homeLhAvg)
        : {notes: put(ints, pc, inv, [28, 64]), inv};
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
        smooth && prevRh && prevRh.length
          ? [Math.max(S.lo, prevRh[0] - 12), Math.min(S.hi, prevRh[prevRh.length - 1] + 12)]
          : [57, 81];
      const rhObj = smooth
        ? putVoiceLed(ints, pc, prevRh || null, undefined, rZone, maxRhInv, homeRhAvg)
        : {notes: put(ints, pc, inv, [57, 96]), inv};
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
      smooth && prevRh && prevRh.length
        ? [Math.max(S.lo, prevRh[0] - 12), Math.min(S.hi, prevRh[prevRh.length - 1] + 12)]
        : [57, 81];
    const rhObj = smooth
      ? putVoiceLed(ints, pc, prevRh || null, undefined, rZone, maxRhInv, homeRhAvg)
      : {notes: put(ints, pc, inv, [58, 96]), inv};
    const r = rhObj.notes;

    if (bh == 'same' || bh == 'diff') {
      const lMin = Math.max(S.lo, 28);
      const lMax = Math.max(lMin + 12, Math.min(62, r[0] - 1));
      const lZone: [number, number] =
        smooth && prevLh && prevLh.length
          ? [Math.max(S.lo, prevLh[0] - 12), Math.min(r[0] - 1, Math.max(lMax, prevLh[prevLh.length - 1] + 12))]
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
          );
          l = lhObj.notes;
          lInv = rhObj.inv;
        }
      } else {
        lInv = bh == 'same' ? rhObj.inv : lhInvOverride ?? inv;
        l = put(ints, pc, lInv, [lMin, lMax]);
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
          const dA = Math.abs(a - target) + (homeLhAvg != null ? Math.abs(a - homeLhAvg) * 0.08 : 0);
          const dB = Math.abs(b - target) + (homeLhAvg != null ? Math.abs(b - homeLhAvg) * 0.08 : 0);
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
    ['7sus4', [0, 5, 7, 10], 4],
    ['7♭5', [0, 4, 6, 10], 4],
    ['7♯5', [0, 4, 8, 10], 4],
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

    ['m11', [0, 3, 7, 10, 14, 17], 6],
    ['maj9♯11', [0, 4, 7, 11, 14, 18], 6],
    ['9♯11', [0, 4, 7, 10, 14, 18], 6],
    ['7♭9♭13', [0, 4, 7, 10, 13, 20], 6],
    [p => pn((p + 8) % 12) + '/' + pn(p) + '7', [0, 4, 10, 15, 20], 6],

    ['13', [0, 4, 7, 10, 14, 21], 7],
    ['m13', [0, 3, 7, 10, 14, 17, 21], 7],
    ['maj13♯11', [0, 4, 7, 11, 14, 18, 21], 7],
    ['13sus4', [0, 5, 7, 10, 14, 21], 7],
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
        x => typeof x[0] == 'string' && /7[♭♯]|[♯♭]5|♯11|♭13/.test(x[0]),
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

    if ($('pool').value == 'all') {
      const L = chromaticChordList(F, g);
      let x: any, pc: number, inv: number, lhInv: number, rt: 'A' | 'B';

      if (o) {
        const items = chromaticChordItems(F, g, mi, lhi, exinv, smooth);
        const item = items[S.n % items.length];
        x = item.x;
        pc = item.pc;
        inv = item.inv;
        lhInv = item.lhInv;
        rt = item.rt;
      } else {
        x = L[rand(L.length)];
        pc = rand(12);
        const vLen =
          F == 'v_shell'
            ? 3
            : /^v_/.test(F) && F != 'v_ust' && F != 'v_quartal'
              ? 4
              : x[1].length;
        const mxRh = Math.min(mi, vLen - 1);
        const mxLh = Math.min(lhi, vLen - 1);
        inv = exinv ? mxRh : rand(mxRh + 1);
        lhInv = isDiff ? (exinv ? mxLh : rand(mxLh + 1)) : inv;
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
      const d = o ? S.n % 7 : rand(7);
      const sz = o
        ? 3 + (Math.floor(S.n / (7 * ms.length)) % 2)
        : 3 + rand(2);
      const mxRh = Math.min(mi, sz - 1);
      const mxLh = Math.min(lhi, sz - 1);
      const inv = exinv
        ? mxRh
        : o
          ? Math.floor(S.n / (7 * ms.length * 2)) % (mxRh + 1)
          : rand(mxRh + 1);
      const lhInv = isDiff ? (exinv ? mxLh : rand(mxLh + 1)) : inv;
      return buildDiatonicChord(C, F, sc, d, sz, 1, inv, lhInv);
    }

    if (o) {
      const items = diatonicChordItems(C, F, g, mi, lhi, exinv, smooth);
      return items[S.n % items.length];
    }

    if (F == 'sus') {
      const pool: any[] = [];
      for (let d = 0; d < 7; d++)
        pool.push(...diatonicSusOnDegree(C, C.sc, d, 0));
      const ch = pool[rand(pool.length)];
      const mxRh = Math.min(mi, ch.ints.length - 1);
      const mxLh = Math.min(lhi, ch.ints.length - 1);
      const inv = exinv ? mxRh : rand(mxRh + 1);
      const lhInv = isDiff ? (exinv ? mxLh : rand(mxLh + 1)) : inv;
      return {...ch, inv, lhInv};
    }

    const sizes = chordSizesForFocus(F, g);
    const sz = sizes[rand(sizes.length)];
    const d = rand(7);
    const vLen = F == 'v_shell' ? 3 : /^v_/.test(F) ? 4 : sz;
    const mxRh = Math.min(mi, vLen - 1);
    const mxLh = Math.min(lhi, vLen - 1);
    const inv = exinv ? mxRh : rand(mxRh + 1);
    const lhInv = isDiff ? (exinv ? mxLh : rand(mxLh + 1)) : inv;
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
  function runDP(ms: number[], h: string) {
    const s = h == 'R' ? 1 : -1,
      n = ms.length;
    if (!n) return [];

    const cost = (a: number, b: number, m1: number, m2: number) => {
      const d = (m2 - m1) * s,
        dl = b - a,
        ad = Math.abs(d);
      let c = 0;
      if (d == 0) c = a == b ? 0 : 1;
      else if (ad > 9) c = 1.5;
      else if (Math.sign(d) == Math.sign(dl))
        c =
          Math.max(0, ad - (Math.abs(dl) * 2 + 1)) * 3 +
          Math.max(0, Math.abs(dl) * 1.4 - ad) * 0.5;
      else if ((d > 0 && b == 1) || (d < 0 && a == 1)) {
        const o = d > 0 ? a : b;
        c = 2 + (o == 3 || o == 4 ? 0 : 3);
      } else return 99;
      if (b == 1 && BK(m2)) c += 2;
      if (b == 5 && BK(m2)) c += 1.5;
      return c;
    };

    const dp: [number, number][][] = [
      [1, 2, 3, 4, 5].map(f => [
        [0, 0.1, 0.4, 0.6, 0.4][f - 1] + (f == 1 && BK(ms[0]) ? 2 : 0),
        0,
      ]),
    ];
    for (let i = 1; i < n; i++)
      dp.push(
        [1, 2, 3, 4, 5].map(b => {
          let best: [number, number] = [1e9, 0];
          for (let a = 1; a <= 5; a++) {
            const v = dp[i - 1][a - 1][0] + cost(a, b, ms[i - 1], ms[i]);
            if (v < best[0]) best = [v, a];
          }
          return best;
        }),
      );

    const last = dp[n - 1].map((x, i) => x[0] + [0.2, 0.4, 0.4, 0.2, 0][i]);
    let f = last.indexOf(Math.min(...last)) + 1;
    const out = [f];
    for (let i = n - 1; i > 0; i--) {
      f = dp[i][f - 1][1];
      out.unshift(f);
    }
    return out;
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

    const sp = ns[n - 1] - ns[0];
    if (n == 2) {
      const f =
        sp <= 2
          ? [1, 2]
          : sp <= 4
            ? [1, 3]
            : sp <= 6
              ? [1, 4]
              : [1, 5];
      return h == 'L' ? [...f].reverse() : f;
    }

    if (n == 3) {
      const d1 = ns[1] - ns[0];
      const d2 = ns[2] - ns[1];
      if (h == 'R') {
        if (d1 <= 2 && d2 <= 2) return [1, 2, 3];
        if (d1 >= 5 && d2 <= 2) return [1, 4, 5];
        if (d1 >= 7 && d2 <= 4) return [1, 4, 5];
        if (d2 >= 5 && d1 <= 4) return [1, 2, 5];
        if (d1 >= 6 && d2 >= 5) return [1, 2, 5];
        return [1, 3, 5];
      } else {
        if (d1 <= 2 && d2 <= 2) return [3, 2, 1];
        if (d1 <= 2 && d2 >= 5) return [5, 4, 1];
        if (d1 >= 5 && d2 <= 5) return [5, 2, 1];
        if (d2 >= 7 && d1 <= 4) return [5, 2, 1];
        return [5, 3, 1];
      }
    }

    if (n == 4) {
      const d1 = ns[1] - ns[0];
      const d2 = ns[2] - ns[1];
      const d3 = ns[3] - ns[2];
      // Orient gaps from thumb-side -> pinky-side so both hands use the same ergonomic model
      const g = h == 'R' ? [d1, d2, d3] : [d3, d2, d1];
      const cands: [number, number, number, number][] = [
        [1, 2, 3, 5],
        [1, 2, 4, 5],
        [1, 3, 4, 5],
      ];
      if (g[0] <= 2 && g[1] <= 2 && g[2] <= 2) cands.push([1, 2, 3, 4]);

      const pairCost = (fA: number, fB: number, gap: number) => {
        const ideal: Record<string, [number, number]> = {
          '1,2': [2, 5],
          '1,3': [4, 6],
          '2,3': [1, 4],
          '2,4': [3, 5],
          '3,4': [1, 2],
          '3,5': [3, 5],
          '4,5': [1, 2],
        };
        const [lo, hi] = ideal[`${fA},${fB}`] || [1, 3];
        if (gap < lo) return (lo - gap) * 1.4;
        if (gap > hi) return (gap - hi) * 2.1;
        return 0;
      };

      let bestF: number[] = [1, 2, 3, 5];
      let bestScore = 1e9;

      for (const cand of cands) {
        let score =
          pairCost(cand[0], cand[1], g[0]) +
          pairCost(cand[1], cand[2], g[1]) +
          pairCost(cand[2], cand[3], g[2]);
        // Slight preference for classic [1, 2, 3, 5] on ties
        if (cand[1] === 2 && cand[2] === 3) score -= 0.15;

        if (prevNs && prevF && prevNs.length === prevF.length) {
          const oriented = h == 'L' ? [...cand].reverse() : cand;
          ns.forEach((m, idx) => {
            const pIdx = prevNs.indexOf(m);
            if (pIdx >= 0 && prevF[pIdx] === oriented[idx]) score -= 0.7;
          });
        }

        if (score < bestScore) {
          bestScore = score;
          bestF = cand;
        }
      }
      return h == 'L' ? [...bestF].reverse() : bestF;
    }

    const f = R(1, Math.min(5, n));
    while (f.length < n) f.push(5);
    return h == 'L' ? [...f].reverse() : f;
  }

  function fingers(
    st: number[][],
    hd: string[][],
    prevHandState?: {L?: {ns: number[]; f: (number | string)[]}; R?: {ns: number[]; f: (number | string)[]}},
  ) {
    const F: (number | string)[][] = st.map(s => s.map(() => ''));
    ['L', 'R'].forEach(h => {
      let run: [number, number][] = [];
      let prevChord = prevHandState?.[h as 'L' | 'R'] || null;
      const flush = () => {
        const f = runDP(
          run.map(r => st[r[0]][r[1]]),
          h,
        );
        run.forEach((r, i) => (F[r[0]][r[1]] = f[i]));
        run = [];
      };
      st.forEach((s, i) => {
        const ix = s.map((_m, j) => j).filter(j => hd[i][j] == h);
        if (!ix.length) return;
        if (ix.length == 1) {
          run.push([i, ix[0]]);
          prevChord = {ns: [s[ix[0]]], f: [h == 'L' ? 5 : 1]};
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
        prevHandState.L = {ns: q.prevLh, f: chordF(q.prevLh, 'L')};
      }
      if (q.prevRh?.length) {
        prevHandState.R = {ns: q.prevRh, f: chordF(q.prevRh, 'R')};
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
    } else if (q.g == 'scale' || q.g == 'mel') {
      if (q.steps && q.steps[0]?.length == 2) {
        st = q.steps;
        hd = q.steps.map(() => ['L', 'R']);
      } else {
        st = q.seq.map((m: number) => [m]);
        hd = st.map(() => [
          cl == 'bass' ? 'L' : cl == 'treble' ? 'R' : q.seq[0] >= 57 ? 'R' : 'L',
        ]);
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
    return [st, hd, fingers(st, hd, prevHandState)];
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

      if (on && id == 'mode') {
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
          why = 'Overridden by the selected Scale focus';
        } else if (ug == 'prog' || ug == 'pat') {
          on = false;
          why = 'Progressions set their own tonality from Key';
        } else if (ug == 'harm' && (g == 'prog' || g == 'harm_guide')) {
          on = false;
          why = 'Cadences and fixed progressions set their own tonality from Key';
        }
      }

      if (on && id == 'bhmode') {
        if (cl != 'grand') {
          on = false;
          why = 'Switch Clef to Grand (both hands) to enable';
        } else if (g == 'slash' || g == 'harm_guide') {
          on = false;
          why = 'Slash and guide-tone drills fix the bass hand';
        }
      }

      const relUnsupported =
        (ug == 'chord' && (g == 'slash' || fVal == 'v_ust')) ||
        g == 'harm_guide' ||
        g == 'harm_close';
      const relActive =
        ['chord', 'prog', 'harm'].includes(ug) &&
        $('vlead').checked &&
        !relUnsupported;

      if (on && id == 'lhinv') {
        if (cl != 'grand' || bh != 'diff' || g == 'slash' || g == 'harm_guide') {
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
          why = 'Used for arpeggio inversions in Scales';
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
        } else if (g == 'harm_close') {
          on = false;
          why = 'Always active in close-range voice-leading drills';
        }
      }

      if (on && id == 'exinv') {
        if (ug == 'scale' && !['arp3', 'arp7', 'arpd'].includes(fVal)) {
          on = false;
          why = 'Used for arpeggio inversions in Scales';
        } else if (relActive) {
          on = false;
          why = 'Disabled while Relative voice leading is on';
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
    $('pl').style.display = ug == 'ear' ? '' : 'none';
    segsync();
    CD.forEach(i => mkdd($(i)));
  }

  /* =====================================================================
     16. CUSTOM DROPDOWNS + SEGMENTED CONTROLS
     ===================================================================== */
  const CD = [
    'ug',
    'focus',
    'key',
    'mode',
    'bhmode',
    'inv',
    'lhinv',
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
    if (!q || q.g != 'ear') return;
    audioEngine.resume();
    const sndPreset = curSound();
    q.snd.forEach(([m, t, d]: [number, number, number]) =>
      audioEngine.playNote(m, t, d, sndPreset, 0.8),
    );
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
    '7sus4': ['Dominant 7th suspended 4th', 'C7sus4', 'Dominant colour without the 3rd: open and modern.'],
    '7♭5': ['Dominant 7th flat 5', 'C7♭5', 'Dominant 7th with a lowered 5th: tense, tritone sub flavour.'],
    '7♯5': ['Dominant 7th sharp 5', 'C7♯5, C+7', 'Dominant 7th over an augmented triad.'],
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
    m11: ['Minor 11th', 'C−11, Cm11', 'Minor 9th plus an 11th: wide and modern.'],
    'maj9♯11': ['Major 9th sharp 11', 'CΔ9♯11', 'Lydian tonic colour: floating and bright.'],
    '9♯11': ['Dominant 9th sharp 11', 'C9♯11', 'Lydian dominant: bright, jazzy dominant.'],
    '7♭9♭13': ['Dominant 7th flat 9 flat 13', 'C7♭9♭13', 'Altered dominant leading to a minor chord.'],
    '13': ['Dominant 13th', 'C13', 'Dominant 7th with 9th and 13th: the full, bluesy jazz dominant.'],
    m13: ['Minor 13th', 'C−13, Cm13', 'Minor 11th plus a 13th.'],
    'maj13♯11': ['Major 13th sharp 11', 'CΔ13♯11', 'The fullest Lydian major sound.'],
    '13sus4': ['Dominant 13th suspended 4th', 'C13sus4', 'Suspended dominant with a 13th: open and full.'],
  };
  NM['quartal (4 notes)'] = NM.quartal;
  NM.m7b5 = NM['m7♭5'];
  NM['7b5'] = NM['7♭5'];
  NM['maj7#5'] = NM['maj7♯5'];
  NM['7#5'] = NM['7♯5'];

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
    const n = NM[sf ?? '___'];
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

  function infoHTML(q: any) {
    const c = q.ci;
    if (!c) return '';
    if (c.k == 'chord') return chordInfo(c);
    if (c.k == 'scale') return scaleInfo(c);
    if (c.k == 'int') return intInfo(c);

    if (c.k == 'pat')
      return (
        `<h4>${q.pn.split(' · ')[1]}</h4>` +
        para(GF[c.g]) +
        row('Genre', GEN.find(g => g[0] == c.g)![1]) +
        row('Progression', c.prog + ' in ' + C.k) +
        row(
          'Steps',
          q.ch.filter((x: any) => !x.rest).length + ' notes or chords',
        ) +
        listInfo(q)
      );

    let t = '';
    if (q.hf && q.hf.startsWith('cad')) t = CTD[q.hf.slice(4)];
    else if (q.hf) t = HD[q.hf];

    return (
      `<h4>${q.pn}</h4>` +
      para(
        t ||
          'A chord progression: each Roman numeral / Nashville number is a chord built on that degree of the key.',
      ) +
      row('Key', C.k) +
      listInfo(q)
    );
  }

  function fillInfo() {
    const q = S.q;
    $('it').textContent =
      (
        {
          chord: 'Chord',
          scale: 'Scale',
          int: 'Interval',
          pat: 'Pattern',
          prog: 'Progression',
        } as any
      )[q.ci?.k] || 'Details';
    $('ib').innerHTML = infoHTML(q);
  }

  function openInfo() {
    if (S.ok) {
      $('app').classList.add('io');
      fillInfo();
    }
  }

  function syncInfo(q: any, nameOk: boolean, shown: boolean) {
    const ok = $('dtl').checked && !!q.ci && (q.g == 'ear' ? shown : nameOk);
    const el = $('q');
    S.ok = ok;
    el.classList.toggle('clk', ok);

    if (ok)
      el.insertAdjacentHTML(
        'beforeend',
        '<svg class=iq viewBox="0 0 20 20" width=18 height=18 fill=none stroke=currentColor stroke-width=1.6 stroke-linecap=round><circle cx=10 cy=10 r=8.2 /><line x1=10 y1=9 x2=10 y2=14 /><circle cx=10 cy=6.3 r=.5 /></svg>',
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
  function buildScaleQuestion(q: any, cl: string, CL: string) {
    let dir = $('dir').value;
    const mi = +$('inv').value;
    const exinv = $('exinv').checked;
    const octs = +$('scrange').value || 1;
    const hands = $('schands').value || 'one';
    const isArp = ['arp3', 'arp7', 'arpd'].includes(S.f);

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

    // Build octave-expanded note array (for 1 or 2 octaves)
    let fullInts: number[] = [];
    if (S.f == 'five' || S.f == 'hanon') {
      fullInts = baseInts;
    } else {
      for (let o = 0; o < octs; o++) {
        fullInts.push(...baseInts.map(x => x + 12 * o));
      }
      fullInts.push(12 * octs);
    }

    const rhZone = cl == 'bass' ? [36, 72] : [57, 96];
    let rhStart = put(fullInts, arpRootPc, 0, rhZone);
    if (
      (hands == 'parallel' || hands == 'contrary') &&
      Math.min(...rhStart) - 12 < S.lo &&
      Math.max(...rhStart) + 12 <= S.hi
    ) {
      rhStart = rhStart.map(m => m + 12);
    }
    const rhSeq = dir == 'up' ? rhStart : [...rhStart].reverse();

    if (hands == 'parallel' || hands == 'contrary') {
      S.cl = 'grand';
      const lhSeq =
        hands == 'contrary'
          ? [...rhStart].map((_, idx) => {
              // Mirror interval downward from octave below rhStart[0]
              const startBase =
                rhStart[0] - 12 >= S.lo ? rhStart[0] - 12 : rhStart[0];
              const invOffset = fullInts[idx] - fullInts[0];
              return dir == 'up'
                ? startBase - invOffset
                : startBase - (fullInts[fullInts.length - 1] - fullInts[idx]);
            })
          : rhSeq.map(m => (m - 12 >= S.lo ? m - 12 : m));

      // Ensure contrary stays inside range cleanly
      const minLh = Math.min(...lhSeq);
      const shift = minLh < S.lo ? 12 * Math.ceil((S.lo - minLh) / 12) : 0;
      const lhFinal = lhSeq.map(m => m + shift);

      const steps = rhSeq.map((rm, i) =>
        [lhFinal[i], rm].sort((a, b) => a - b),
      );
      q.steps = steps;
      q.seq = rhSeq;
      q.exp = [...new Set(steps.flat())].sort((a, b) => a - b);
      q.main = arpTitle + labelSuffix;
      q.lab = C.m + labelSuffix;
      const handLabel =
        hands == 'contrary'
          ? 'both hands (contrary)'
          : 'both hands (parallel)';
      q.top = `${C.k} ${C.m} · ${handLabel}`;
      q.topAnon = handLabel;
      q.startDesc =
        'LH ' + smOct(steps[0][0]) + ' · RH ' + smOct(steps[0][1]);
      q.startDescAny =
        'LH ' + sm(steps[0][0]).n + ' · RH ' + sm(steps[0][1]).n;
      q.sub =
        dir +
        ' · ' +
        (S.f == 'five' || S.f == 'hanon' ? 'pattern' : octs + ' oct');
      q.ans = rhSeq.map((m: number) => sm(m).n).join(' ');
    } else {
      const zone = cl == 'grand' && ORD() ? [57, 96] : Z();
      const singleStart = put(fullInts, arpRootPc, 0, zone);
      const seq = dir == 'up' ? singleStart : [...singleStart].reverse();
      const handLabel = cl == 'bass' ? 'left hand' : 'right hand';
      q.seq = seq;
      q.exp = seq;
      q.main = arpTitle + labelSuffix;
      q.lab = C.m + labelSuffix;
      q.top = `${C.k} ${C.m} · ${handLabel}`;
      q.topAnon = handLabel;
      q.startDesc = 'start ' + smOct(seq[0]);
      q.startDescAny = 'start ' + sm(seq[0]).n;
      q.sub =
        dir +
        ' · ' +
        (S.f == 'five' || S.f == 'hanon' ? 'pattern' : octs + ' oct');
      q.ans = seq.map((m: number) => sm(m).n).join(' ');
    }

    q.ci = {
      k: 'scale',
      m: C.m,
      sc: baseInts.slice(0, 8),
      r: C.r,
      ar: isArp,
      tech: S.f == 'five' || S.f == 'hanon',
    };
  }

  function newQ() {
    applyFocus();
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
        }

        const voiced = voice(
          c.ints,
          c.pc,
          useSmoothChord && !hasPrev ? 0 : inv,
          useSmoothChord && !hasPrev ? 0 : lhInv,
          undefined,
          useSmoothChord ? S.prevRh : null,
          useSmoothChord,
          useSmoothChord ? S.prevLh : null,
          useSmoothChord,
          useSmoothChord ? S.homeRhAvg : null,
          useSmoothChord ? S.homeLhAvg : null,
        );
        q.exp = voiced.notes;
        q.hd = voiced.hd;
        q.lhLen = voiced.lhLen;
        q.rhLen = voiced.rhLen;
        q.isRelChord = useSmoothChord;
        q.isRelAnchored = useSmoothChord && (tolExact || S.relLocked);

        const bh = curBh();
        const isBothSame = bh == 'same';
        const isBothDiff = bh == 'diff';
        actualInv = useSmoothChord ? voiced.rhInv : inv;
        actualLhInv = useSmoothChord ? voiced.lhInv : lhInv;

        // Only pre-seed Exact-octave chain on newQ; Any-octave locks once the player plays the start chord
        if (useSmoothChord && tolExact && !hasPrev) {
          S.prevRh =
            voiced.rhLen > 0 ? voiced.notes.slice(voiced.lhLen) : null;
          S.prevLh =
            voiced.lhLen > 0 ? voiced.notes.slice(0, voiced.lhLen) : null;
          if (S.prevRh?.length)
            S.homeRhAvg =
              S.prevRh.reduce((a: number, b: number) => a + b, 0) /
              S.prevRh.length;
          if (S.prevLh?.length)
            S.homeLhAvg =
              S.prevLh.reduce((a: number, b: number) => a + b, 0) /
              S.prevLh.length;
          S.relLocked = true;
        }

        const slashNme =
          g == 'chord' && actualInv && cl != 'grand' && !/[\/·]/.test(c.name)
            ? nme + '/' + pn((c.pc + c.ints[actualInv]) % 12)
            : nme;

        if (g == 'chord') {
          q.main = useSmoothChord && hasPrev ? nme : slashNme;
        }

        const invDesc = isBothDiff
          ? `LH: ${INV[voiced.lhInv]} · RH: ${INV[voiced.rhInv]}`
          : cl == 'grand' && bh == 'bass'
            ? `RH: ${INV[useSmoothChord ? voiced.rhInv : inv]}`
            : INV[isBothSame || useSmoothChord ? voiced.rhInv : inv];

        q.top = `${ctxT} · ${CL}`;
        q.topAnon = CL;
        if (useSmoothChord) {
          q.sub =
            (q.type ? 'Play the ' + q.type + ' · ' : '') +
            (hasPrev
              ? 'Closest position from previous chord'
              : startFreeAnyOct
                ? `Start in any octave · ${invDesc}`
                : `Start position · ${invDesc}`);
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
      q.ch = P[1].map(([o, sf, bassO], stepIdx) => {
        const x = Q.find(y => y[0] === sf)!;
        const pc = (C.r + o) % 12;
        const mx = Math.min(mi, x[1].length - 1);
        const inv =
          smooth && stepIdx === 0
            ? 0
            : $('exinv').checked
              ? mx
              : ORD()
                ? S.n % (mx + 1)
                : rand(mx + 1);
        const forceBass = bassO != null ? (C.r + bassO) % 12 : undefined;
        const slashTxt = forceBass != null ? '/' + pn(forceBass) : '';
        const voiced = voice(
          x[1],
          pc,
          inv,
          lhi,
          forceBass,
          prevRh,
          smooth && bassO == null,
          prevLh,
          smooth,
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

    if (q.opts)
      $('ans').innerHTML = q.opts
        .map((o: string) => `<button class=s data-a="${o}">${o}</button>`)
        .join('');

    render();
    vis();
    stats();
    syncMetronome();
    if (g == 'ear' || q.g == 'mel') setTimeout(() => {
      audioEngine.resume();
      const sndPreset = curSound();
      (q.snd || []).forEach(([m, t, d]: [number, number, number]) =>
        audioEngine.playNote(m, t, d, sndPreset, 0.8),
      );
    }, 300);
    startActivityCountdown(q);
    S.n++;
  }

  /* =====================================================================
     21. RENDERING (Viewport-contained, Toggleable Show/Hide, Staff-matched Keyboard Badges)
     ===================================================================== */
  function syncActionButtons(q: any) {
    const revBtn = $('rv');
    const fgBtn = $('fgb');
    const plBtn = $('pl');
    const nxBtn = $('nx');

    const active = !!q;
    const isShown = !!(q && (q.revealed || q.done));

    revBtn.disabled = !active || !!q?.done;
    revBtn.textContent = q?.revealed ? 'Hide answer' : 'Show answer';
    revBtn.classList.toggle('on', !!q?.revealed);

    // Fingering is greyed out (disabled) until Show answer (or completion) is on
    const canFing = active && isShown && q.g != 'ear';
    fgBtn.disabled = !canFing;
    const fOn = $('fing').checked;
    fgBtn.textContent = fOn ? 'Hide fingering' : 'Show fingering';
    fgBtn.classList.toggle('on', canFing && fOn);

    plBtn.style.display =
      $('ug').value == 'ear' || q?.g == 'mel' ? '' : 'none';

    const manualReady = !!(q?.done && advCfg.mode == 'manual');
    nxBtn.classList.toggle('ready', manualReady);
    nxBtn.textContent = 'Next';
  }

  function render() {
    const q = S.q;
    if (!q) {
      $('qtop').textContent = '';
      syncActionButtons(null);
      return;
    }

    const p = $('prompt').value;
    const none = $('clef').value == 'none';
    const d = !!q.done;
    const rev = !!q.revealed;
    const shown = d || rev;
    const nameOk = none || p != 'staff' || shown;
    const stf =
      !none && (q.g == 'ear' || q.g == 'mel' ? shown : p != 'symbol' || shown);

    $('qtop').textContent =
      q.g == 'ear' || q.g == 'mel' || nameOk
        ? q.top || ''
        : q.topAnon || '';

    const tolExact = $('tol').value == 'exact';

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
      if (q.g == 'int' || q.g == 'mel') {
        subMeta = tolExact ? ' · exact octave' : '';
      } else if (tolExact) {
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

    $('sub').textContent = q.sub + subMeta + (shown ? ' → ' + q.ans : '');

    if (rev && !d) {
      $('fb').style.color = 'var(--ac)';
      $('fb').textContent = 'Answer shown — click Hide answer to return';
    } else if (!d && $('fb').textContent.startsWith('Answer shown')) {
      $('fb').textContent = '';
    }

    const sn = q.g == 'int' && !shown ? [q.root] : q.exp;
    let fg: any = null,
      fh: any = null;

    const showFingNow = $('fing').checked && shown && q.g != 'ear' && sn === q.exp;
    if (showFingNow) {
      const D = (q.fgd = q.fgd || fgData(q));
      const i = q.ch ? Math.min(q.pos, D[2].length - 1) : 0;
      if ((q.g == 'scale' || q.g == 'mel') && !q.steps) {
        fg = D[2].map((x: any) => x[0]);
        fh = D[1].map((x: any) => x[0]);
      } else if (q.steps) {
        // Multi-step hands-together scale: flatten for staff/kb badges cleanly
        fg = D[2].flat();
        fh = D[1].flat();
      } else {
        fg = D[2][i];
        fh = D[1][i];
      }
    }

    const staffNotes = q.steps && showFingNow ? q.steps.flat() : sn;
    $('stf').innerHTML = stf
      ? staff(
          q.steps ? q.steps.flat() : sn,
          q.g == 'scale' || q.g == 'mel' || !!q.spread,
          fg,
          fh,
          !!q.steps,
        )
      : '';

    // 3-color keyboard feedback (octave-aware):
    // Green = exact target key played, Red = wrong key or wrong octave played, Yellow = target key that should have been played
    S.kbOk = new Set<number>();
    S.kbBad = new Set<number>();
    S.hl = new Set<number>();

    const allTargets: number[] = q.steps ? q.steps.flat() : q.exp || [];
    const targetSet = new Set<number>(allTargets);

    const exactKb =
      tolExact ||
      !!q.isRelAnchored ||
      (q.g == 'prog' && !!q.relProg && !!q.relLocked);

    if (d) {
      if (q.g == 'ear') {
        allTargets.forEach((m: number) => S.hl.add(m));
      } else if (q.g == 'scale' || q.g == 'mel') {
        if (tolExact) {
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
        (exactKb ? targetSet.has(m) : true)
          ? S.kbOk.add(m)
          : S.kbBad.add(m),
      );
      (q.bad as Set<number>)?.forEach((m: number) => {
        if (!S.kbOk.has(m)) S.kbBad.add(m);
      });
    }

    S.fm = {};
    if (showFingNow && fg && fh) {
      const notesForBadges = q.steps ? q.steps.flat() : staffNotes;
      notesForBadges.forEach((m: number, idx: number) => {
        const f = fg[idx];
        const h = fh[idx] || 'R';
        if (!f) return;
        const arr = S.fm[m] || (S.fm[m] = []);
        if (!arr.some((x: any) => x.f == f && x.h == h)) arr.push({f, h});
      });
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
        c: cl == 'grand' ? (m >= 60 ? 't' : 'b') : cl[0],
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
      const bd = (cx: number, y: number, t: number, RHand: boolean) =>
        `<circle cx=${cx} cy=${y} r=8.5 fill="${RHand ? '#243370' : '#6a3510'}" stroke="${RHand ? '#8fa6ff' : '#ffb35c'}" stroke-width=1.3 />` +
        `<text x=${cx} y=${y + 4.4} font-size=12 font-weight=700 text-anchor=middle fill="#fff" font-family="system-ui,sans-serif">${fg[t]}</text>`;

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
        .map(
          (b: {f: number | string; h: string}) =>
            `<span class="kfg ${b.h == 'R' ? 'rh' : 'lh'}">${b.f}</span>`,
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
      !!q?.isRelAnchored ||
      (q?.g == 'prog' && !!q?.relProg && !!q?.relLocked && q.pos > 0);
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

  function stats() {
    if (!S.go && !S.q) {
      $('statleft').innerHTML = '';
      $('statright').innerHTML = '';
      return;
    }
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
    $('statleft').innerHTML =
      `<div class="stat-row"><span class="stat-k">Score</span><span class="stat-v">${s.ok}/${s.tot} correct${pct}</span></div>` +
      `<div class="stat-row"><span class="stat-k">Streak</span><span class="stat-v">${s.str} · Best ${s.best}</span></div>` +
      weakHtml;

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
      $('fb').style.color = q.timedOut ? 'var(--bad)' : 'var(--mut)';
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
    if (timeCfg.mode != 'timed' || !S.go || !q || q.done) return;

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
    if (!q || !q.isRelChord) return;
    const tolExact = $('tol').value == 'exact';
    if (!tolExact && !S.relLocked && !ok) return;
    const played = q.played || [];
    const src = ok && played.length === q.exp?.length ? played : q.exp;
    if (!src || !src.length) return;
    S.prevLh = q.lhLen > 0 ? src.slice(0, q.lhLen) : null;
    S.prevRh = q.rhLen > 0 ? src.slice(q.lhLen || 0) : null;
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
    $('fb').style.color = timedOut ? 'var(--bad)' : 'var(--mut)';
    $('fb').textContent = q.fbBase;

    render();
    vis();
    stats();
    if (score) scheduleAdvance();
  }

  function next() {
    clearAdvanceTimers();
    clearActivityTimers();
    if (S.q && !S.q.done) syncRelativeAnchor(S.q, false);
    if (S.go) newQ();
  }

  /* =====================================================================
     23. INPUT: MIDI note on/off + velocity + sustain pedal
     ===================================================================== */
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
    if (!q || q.done || !S.go || q.g == 'ear') {
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
            const sortedH = [...h].sort((a, b) => a - b);
            const c0 = q.ch[0];
            let pLh: number[] | null =
              c0.lhLen > 0 ? sortedH.slice(0, c0.lhLen) : null;
            let pRh: number[] | null =
              c0.rhLen > 0 ? sortedH.slice(c0.lhLen || 0) : null;
            const hLhAvg =
              pLh && pLh.length
                ? pLh.reduce((a, b) => a + b, 0) / pLh.length
                : null;
            const hRhAvg =
              pRh && pRh.length
                ? pRh.reduce((a, b) => a + b, 0) / pRh.length
                : null;
            for (let idx = 1; idx < q.ch.length; idx++) {
              const step = q.ch[idx];
              const v = voice(
                step.ints,
                step.pc,
                0,
                0,
                step.forceBass,
                pRh,
                step.forceBass == null,
                pLh,
                true,
                hRhAvg,
                hLhAvg,
              );
              step.exp = v.notes;
              step.hd = v.hd;
              step.lhLen = v.lhLen;
              step.rhLen = v.rhLen;
              if (v.rhLen > 0) pRh = v.notes.slice(v.lhLen);
              if (v.lhLen > 0) pLh = v.notes.slice(0, v.lhLen);
            }
            q.relLocked = true;
            q.fgd = null;
          }
          if (q.beat && q.bm)
            q.tm.push(
              performance.now() - (q.bt0 + (4 + q.ch[q.pos].b) * q.bm),
            );
          if (S.pedal) S.pedalChanged = true;
          q.pos++;
          while (q.ch[q.pos] && q.ch[q.pos].rest) q.pos++;
          if (q.pos >= q.ch.length) {
            q.played = [...h].sort((a, b) => a - b);
            fin(q.err == 0 && tdone(q));
            return;
          }
          pset(q);
          $('fb').style.color = 'var(--mut)';
          $('fb').textContent = S.pedal ? 'Lift pedal on chord change' : '';
        } else {
          q.err++;
          const exact =
            $('tol').value == 'exact' || (!!q.relProg && !!q.relLocked && q.pos > 0);
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
          const exact = $('tol').value == 'exact';
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
        if ($('tol').value == 'exact' ? m == e : m % 12 == e % 12) {
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

    const h = [...S.held].filter((x: number) => !S.ign.has(x));
    if (h.length >= q.exp.length) {
      q.played = [...h].sort((a, b) => a - b);
      fin(match(h, q.exp));
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
  const isCompactViewport = () =>
    window.innerWidth <= 820 ||
    (window.innerWidth <= 960 &&
      window.innerHeight <= 480 &&
      window.innerWidth > window.innerHeight);

  $('start').onclick = (e: MouseEvent) => {
    if (e.detail > 0) (e.currentTarget as HTMLElement).blur();
    S.go = true;
    S.n = 0;
    S.prevRh = null;
    S.prevLh = null;
    S.relLocked = false;
    S.homeRhAvg = null;
    S.homeLhAvg = null;
    if (isCompactViewport()) $('app').classList.add('closed');
    next();
  };
  $('nx').onclick = (e: MouseEvent) => {
    if (e.detail > 0) (e.currentTarget as HTMLElement).blur();
    next();
  };

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
        !document.querySelector('.cur-backdrop')
      ) {
        e.preventDefault();
        if (S.go) next();
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
  $('ix').onclick = () => $('app').classList.remove('io');

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

  fillFocus();
  vis();
  syncActionButtons(null);

  const tg = (c?: boolean) => {
    $('app').classList.toggle('closed', c);
    $('gear').title = $('app').classList.contains('closed')
      ? 'Show settings'
      : 'Hide settings';
  };
  $('bd').onclick = () => {
    tg(true);
    $('app').classList.remove('io');
  };
  $('gear').onclick = () => tg();
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
      if (target.id == 'inmode') S.prefInMode = target.checked;
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
          'key',
          'mode',
          'bhmode',
          'inv',
          'lhinv',
          'scrange',
          'schands',
          'exinv',
          'dir',
          'tol',
          'order',
          'vlead',
          'clef',
        ].includes(target.id)
      ) {
        S.n = 0;
        S.prevRh = null;
        S.prevLh = null;
        S.relLocked = false;
        S.homeRhAvg = null;
        S.homeLhAvg = null;
      }

      vis();

      if (target.id == 'pfmt' && S.q?.ch && S.q.rom) {
        pset(S.q);
        render();
        return;
      }

      if (
        S.go &&
        ![
          'prompt',
          'fing',
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
    if (b && q && q.g == 'ear' && !q.done) fin(b.dataset.a == q.key);
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
    if (preset.mode) $('mode').value = preset.mode;
    if (preset.clef) $('clef').value = preset.clef;
    if (preset.bhmode) $('bhmode').value = preset.bhmode;
    if (preset.inv != null) $('inv').value = String(preset.inv);
    if (preset.lhinv != null) $('lhinv').value = String(preset.lhinv);
    if (preset.scrange) $('scrange').value = preset.scrange;
    if (preset.schands) $('schands').value = preset.schands;
    if (preset.pfmt) $('pfmt').value = preset.pfmt;
    $('vlead').checked = Boolean(preset.vlead);
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

    S.go = true;
    S.n = 0;
    S.prevRh = null;
    S.prevLh = null;
    S.relLocked = false;
    S.homeRhAvg = null;
    S.homeLhAvg = null;
    vis();
    next();
  }

  return {
    applyDrill,
    destroy: () => {
      clearAdvanceTimers();
      clearActivityTimers();
      audioEngine.stopMetronome();
      ac.abort();
    },
  };
}
