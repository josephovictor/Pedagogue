import type {MetronomeFeel, SoundPreset} from './audioEngine';

export interface DrillPreset {
  label: string;
  ug: 'chord' | 'scale' | 'int' | 'prog' | 'harm' | 'pat' | 'ear';
  focus: string;
  inmode?: boolean;
  key?: string;
  mode?: string;
  inv?: number;
  lhinv?: number;
  bhmode?: 'bass' | 'same' | 'diff';
  clef?: 'treble' | 'bass' | 'grand';
  scrange?: '1' | '2';
  schands?: 'one' | 'parallel' | 'contrary';
  pfmt?: 'name' | 'roman' | 'nns';
  vlead?: boolean;
  order?: 'rnd' | 'ord';
  dir?: 'up' | 'down' | 'any';
  beat?: boolean;
  tempo?: string;
  feel?: MetronomeFeel;
  sound?: SoundPreset;
  prompt?: 'symbol' | 'both' | 'staff';
}

export interface CurriculumTask {
  id: string;
  text: string;
  drill?: DrillPreset;
}

export interface CurriculumModule {
  id: string;
  title: string;
  learn: CurriculumTask[];
  doItems: CurriculumTask[];
  checkQuestions: string[];
  repertoire?: CurriculumTask[];
  drills?: DrillPreset[];
}

export interface CurriculumPhase {
  id: string;
  title: string;
  weeks: string;
  summary: string;
  modules: CurriculumModule[];
  milestone: CurriculumTask[];
}

export interface TechniqueLevel {
  id: string;
  title: string;
  weeks: string;
  exercises: CurriculumTask[];
  classicalPieces: CurriculumTask[];
  jazzTech: CurriculumTask[];
}

export const PLACEMENT_ITEMS: {id: string; text: string}[] = [
  {id: 'pl-1', text: 'I can sit with good posture and find middle C and all white-key names'},
  {id: 'pl-2', text: 'I can read treble and bass clef notes at slow speed'},
  {id: 'pl-3', text: 'I can play a major scale in one octave in at least 3 keys'},
  {id: 'pl-4', text: 'I can play major and minor triads in root position in all 12 keys'},
  {id: 'pl-5', text: 'I can play a simple song with both hands (melody right, chords left)'},
  {id: 'pl-6', text: 'I can play 7th chords and inversions'},
  {id: 'pl-7', text: 'I can follow a chord chart with a steady beat'},
  {id: 'pl-8', text: 'I can play a 12-bar blues pattern'},
  {id: 'pl-9', text: 'I can learn a simple melody by ear'},
];

export const TECHNIQUE_TRACK: TechniqueLevel[] = [
  {
    id: 'tech-a',
    title: 'Level A: Foundations',
    weeks: 'Weeks 1–16',
    exercises: [
      {
        id: 'ta-1',
        text: 'Five-finger positions in all keys, hands separate then together, slow and even',
        drill: {
          label: 'Practice 5-finger positions',
          ug: 'scale',
          focus: 'five',
          key: 'rnd',
          mode: 'Ionian',
          schands: 'parallel',
          order: 'ord',
          dir: 'up',
        },
      },
      {
        id: 'ta-2',
        text: 'Major scales in 1 octave, then 2 octaves, hands separate then together (C, G, D, A, E, F, B♭, E♭)',
        drill: {
          label: '2-octave major scales (hands together)',
          ug: 'scale',
          focus: 'chosen',
          key: 'C',
          mode: 'Ionian',
          scrange: '2',
          schands: 'parallel',
          order: 'ord',
          dir: 'any',
        },
      },
      {
        id: 'ta-3',
        text: 'Natural minor scales in the same keys',
        drill: {
          label: 'Natural minor scales',
          ug: 'scale',
          focus: 'chosen',
          key: 'C',
          mode: 'Aeolian',
          scrange: '2',
          schands: 'parallel',
          order: 'ord',
          dir: 'any',
        },
      },
      {
        id: 'ta-4',
        text: 'Arpeggios (major and minor triads, root position, 2 octaves)',
        drill: {
          label: '2-octave triad arpeggios',
          ug: 'scale',
          focus: 'arp3',
          key: 'C',
          mode: 'Ionian',
          scrange: '2',
          schands: 'parallel',
          inv: 0,
          order: 'ord',
        },
      },
      {
        id: 'ta-5',
        text: 'Hanon Exercises 1–10 (slow, relaxed, with metronome)',
        drill: {
          label: 'Hanon finger drills',
          ug: 'scale',
          focus: 'hanon',
          key: 'C',
          mode: 'Ionian',
          schands: 'parallel',
          beat: true,
          tempo: '60',
          order: 'ord',
        },
      },
      {
        id: 'ta-6',
        text: 'Contrary-motion scales (hands moving in opposite directions)',
        drill: {
          label: 'Contrary-motion C major',
          ug: 'scale',
          focus: 'chosen',
          key: 'C',
          mode: 'Ionian',
          scrange: '1',
          schands: 'contrary',
          order: 'ord',
        },
      },
      {
        id: 'ta-7',
        text: 'Legato & staccato touch drills; dynamics from pp to ff (check MIDI velocity meter)',
      },
    ],
    classicalPieces: [
      {id: 'ta-c1', text: 'Easy pieces from Anna Magdalena Notebook (Minuet in G, Minuet in G minor)'},
      {id: 'ta-c2', text: 'Burgmüller 25 Progressive Pieces, Op. 100 (Nos. 1–8)'},
      {id: 'ta-c3', text: 'Clementi or Kuhlau sonatinas (first movements) when ready'},
    ],
    jazzTech: [
      {
        id: 'ta-j1',
        text: 'Blues scale in C, G, F (both hands)',
        drill: {
          label: 'Blues scale drill',
          ug: 'scale',
          focus: 'blues',
          key: 'C',
          scrange: '1',
          schands: 'parallel',
          order: 'ord',
        },
      },
      {
        id: 'ta-j2',
        text: 'Swing eighths with metronome on beats 2 and 4',
        drill: {
          label: 'Beats 2 & 4 swing click',
          ug: 'scale',
          focus: 'blues',
          key: 'C',
          beat: true,
          tempo: '80',
          feel: '2_4',
        },
      },
      {
        id: 'ta-j3',
        text: 'Simple walking bass line in left hand',
        drill: {
          label: 'Jazz walking bass pattern',
          ug: 'pat',
          focus: 'jazz|B',
          key: 'C',
          beat: true,
          tempo: '80',
          feel: '4_swing',
        },
      },
    ],
  },
  {
    id: 'tech-b',
    title: 'Level B: Speed & Independence',
    weeks: 'Weeks 17–32',
    exercises: [
      {
        id: 'tb-1',
        text: 'All 12 major scales, 2–4 octaves, building to 80–100 bpm with tempo ramp',
        drill: {
          label: '12-key 2-octave scales',
          ug: 'scale',
          focus: 'chosen',
          key: 'rnd',
          mode: 'Ionian',
          scrange: '2',
          schands: 'parallel',
          beat: true,
          tempo: '80',
          order: 'ord',
        },
      },
      {
        id: 'tb-2',
        text: 'All harmonic and melodic minor scales',
        drill: {
          label: 'Harmonic & melodic minor',
          ug: 'scale',
          focus: 'chosen',
          key: 'C',
          mode: 'Harmonic minor',
          scrange: '2',
          schands: 'parallel',
          order: 'ord',
        },
      },
      {
        id: 'tb-3',
        text: 'Arpeggios in root position and inversions, all keys',
        drill: {
          label: 'Inverted triad arpeggios',
          ug: 'scale',
          focus: 'arp3',
          key: 'rnd',
          mode: 'Ionian',
          scrange: '2',
          inv: 2,
          order: 'ord',
        },
      },
      {id: 'tb-4', text: 'Hanon 11–20, then select exercises from 21–30'},
      {id: 'tb-5', text: 'Czerny Op. 599 (first 30 exercises) or Op. 849 for evenness'},
      {id: 'tb-6', text: 'Bach Two-Part Inventions Nos. 1 (C), 4 (Dm), 8 (F)'},
      {
        id: 'tb-7',
        text: 'Chromatic scales, 2 octaves, hands together',
        drill: {
          label: '2-octave chromatic scale',
          ug: 'scale',
          focus: 'chrom',
          key: 'C',
          scrange: '2',
          schands: 'parallel',
        },
      },
      {
        id: 'tb-8',
        text: 'Dominant 7th and diminished 7th arpeggios',
        drill: {
          label: 'Dom7 & Dim7 arpeggios',
          ug: 'scale',
          focus: 'arpd',
          key: 'C',
          scrange: '2',
          inv: 3,
          order: 'ord',
        },
      },
    ],
    classicalPieces: [],
    jazzTech: [
      {
        id: 'tb-j1',
        text: 'Major, Dorian, and Mixolydian modes in several keys',
        drill: {
          label: 'Church modes drill',
          ug: 'scale',
          focus: 'church',
          key: 'C',
          scrange: '1',
          order: 'ord',
        },
      },
      {
        id: 'tb-j2',
        text: 'Major and minor pentatonic scales as vocabulary',
        drill: {
          label: 'Pentatonic scales',
          ug: 'scale',
          focus: 'pent',
          key: 'C',
          scrange: '2',
          order: 'ord',
        },
      },
    ],
  },
  {
    id: 'tech-c',
    title: 'Level C: Refinement',
    weeks: 'Weeks 33–52',
    exercises: [
      {id: 'tc-1', text: 'Scales and arpeggios in thirds, sixths, and tenths'},
      {id: 'tc-2', text: 'Bach Three-Part Sinfonias or WTC C Major Prelude'},
      {id: 'tc-3', text: 'Chopin Prelude (Op. 28 No. 4/7) or Nocturne for tone control & rubato'},
      {id: 'tc-4', text: 'Satie Gymnopédie No. 1 for ballad space, pedaling, and tone'},
      {
        id: 'tc-5',
        text: 'Left-hand strength: broken octaves, rolling tenths, stride root–chord alternation',
        drill: {
          label: 'Jazz stride & LH strength',
          ug: 'pat',
          focus: 'jazz|I',
          key: 'C',
          beat: true,
          tempo: '90',
        },
      },
      {id: 'tc-6', text: 'Speed bursts: 16th-note passages at 100–120 bpm, relaxed with zero tension'},
    ],
    classicalPieces: [],
    jazzTech: [
      {
        id: 'tc-j1',
        text: 'Play a standard with guide-tone lines and shell voicings',
        drill: {
          label: 'Shell voicings ii–V–I',
          ug: 'chord',
          focus: 'v_shell',
          inmode: true,
          key: 'C',
          mode: 'Ionian',
          sound: 'rhodes',
          order: 'ord',
        },
      },
    ],
  },
];

export const CURRICULUM_PHASES: CurriculumPhase[] = [
  {
    id: 'phase-1',
    title: 'Phase 1: Foundations',
    weeks: 'Weeks 1–8',
    summary: 'Keyboard geography, reading, rhythm & pulse, triads, diatonic Roman numerals & Nashville numbers.',
    modules: [
      {
        id: 'm1-1',
        title: '1.1 Reading & Keyboard Geography',
        learn: [
          {id: '1.1-l1', text: 'Keyboard layout: white/black keys, octaves, groups of 2 & 3'},
          {id: '1.1-l2', text: 'Note names (A–G), sharps, flats, enharmonic equivalents'},
          {id: '1.1-l3', text: 'Treble & bass clef, grand staff, ledger lines, middle C'},
          {id: '1.1-l4', text: 'Time signatures (4/4, 3/4, 6/8, 12/8), note values, key signatures'},
        ],
        doItems: [
          {
            id: '1.1-d1',
            text: 'Read notes on Grand Staff (Staff only mode) at slow speed',
            drill: {
              label: 'Staff reading drill',
              ug: 'int',
              focus: 'i1',
              inmode: true,
              key: 'C',
              mode: 'Ionian',
              clef: 'grand',
              prompt: 'staff',
            },
          },
          {
            id: '1.1-d2',
            text: 'Play simple 5-finger melodies with steady RH/LH posture',
            drill: {
              label: '5-finger geography',
              ug: 'scale',
              focus: 'five',
              key: 'C',
              mode: 'Ionian',
              schands: 'one',
            },
          },
        ],
        checkQuestions: [
          'What notes are in a D major scale? Which key signature does it have?',
          'What is the difference between 4/4 and 12/8 feel?',
        ],
      },
      {
        id: 'm1-2',
        title: '1.2 Rhythm & Feel Foundations',
        learn: [
          {id: '1.2-l1', text: 'Pulse, beat, subdivision, tempo (bpm)'},
          {id: '1.2-l2', text: 'Straight eighths vs swung eighths vs shuffle vs 12/8 ballad feel'},
          {id: '1.2-l3', text: 'Backbeat (beats 2 & 4), syncopation, anticipations, ghost notes'},
        ],
        doItems: [
          {
            id: '1.2-d1',
            text: 'Play chords against a Beats 2 & 4 backbeat click',
            drill: {
              label: '2 & 4 backbeat chords',
              ug: 'chord',
              focus: 't3',
              inmode: true,
              key: 'C',
              mode: 'Ionian',
              beat: true,
              tempo: '80',
              feel: '2_4',
              order: 'ord',
            },
          },
          {
            id: '1.2-d2',
            text: 'Switch between straight 4/4 and swung feel on a pattern',
            drill: {
              label: 'Swing vs straight pattern',
              ug: 'pat',
              focus: 'blues|B',
              key: 'C',
              beat: true,
              tempo: '80',
              feel: '4_swing',
            },
          },
        ],
        checkQuestions: [
          'Where does the backbeat fall in 4/4?',
          'Which styles in this plan usually use 12/8 feel?',
        ],
      },
      {
        id: 'm1-3',
        title: '1.3 Intervals, Triads & the Major Scale',
        learn: [
          {id: '1.3-l1', text: 'Whole/half steps and major scale formula (W-W-H-W-W-W-H)'},
          {id: '1.3-l2', text: 'Intervals: minor 2nd through octave (sight & ear)'},
          {id: '1.3-l3', text: 'Triads (major, minor, diminished, augmented) + root, 1st & 2nd inversions'},
          {id: '1.3-l4', text: 'Natural minor scale and relative major/minor'},
        ],
        doItems: [
          {
            id: '1.3-d1',
            text: 'Play major & minor triads in all 12 keys, root & inversions (try both hands!)',
            drill: {
              label: 'Triads (both hands, inversions)',
              ug: 'chord',
              focus: 't3',
              inmode: false,
              clef: 'grand',
              bhmode: 'same',
              inv: 2,
              order: 'ord',
            },
          },
          {
            id: '1.3-d2',
            text: 'Identify intervals by sight & ear (2nd to octave)',
            drill: {
              label: 'Interval ear training',
              ug: 'ear',
              focus: 'ei',
            },
          },
          {
            id: '1.3-d3',
            text: 'Play I–IV–V–I in 6 keys using smooth voice leading',
            drill: {
              label: 'Smooth I–IV–V–I',
              ug: 'prog',
              focus: 'basic',
              key: 'rnd',
              vlead: true,
            },
          },
        ],
        checkQuestions: [
          'What notes are in an A♭ minor triad?',
          'What is the relative minor of E♭ major?',
        ],
      },
      {
        id: 'm1-4',
        title: '1.4 Diatonic Chords, Roman Numerals & Nashville Numbers',
        learn: [
          {id: '1.4-l1', text: 'Building triads on each degree: I, ii, iii, IV, V, vi, vii°'},
          {id: '1.4-l2', text: 'Tonic, subdominant, and dominant chord function'},
          {id: '1.4-l3', text: 'Nashville Number System (1, 2m, 3m, 4, 5, 6m) for fast transposition'},
        ],
        doItems: [
          {
            id: '1.4-d1',
            text: 'Play all diatonic triads in order within your selected key & mode',
            drill: {
              label: 'Diatonic triads in order',
              ug: 'chord',
              focus: 't3',
              inmode: true,
              key: 'C',
              mode: 'Ionian',
              inv: 0,
              order: 'ord',
            },
          },
          {
            id: '1.4-d2',
            text: 'Practice progressions displayed in Nashville Numbers (1 – 5 – 6m – 4)',
            drill: {
              label: 'Nashville Number progressions',
              ug: 'prog',
              focus: 'basic',
              key: 'rnd',
              pfmt: 'nns',
              vlead: true,
            },
          },
        ],
        checkQuestions: [
          'Write the chords of a G major progression I–vi–IV–V.',
          'How would you call out a "one, four, five" progression in A?',
        ],
      },
      {
        id: 'm1-5',
        title: '1.5 First Songs (Phase 1 Repertoire)',
        learn: [],
        doItems: [],
        checkQuestions: [],
        repertoire: [
          {id: '1.5-r1', text: 'Simple pop song with I–V–vi–IV (melody & block chords)'},
          {id: '1.5-r2', text: 'Slow country song in C or G with I–IV–V and root–fifth left hand'},
          {id: '1.5-r3', text: 'Simple gospel hymn in 3/4 or 6/8 (e.g. Amazing Grace)'},
          {
            id: '1.5-r4',
            text: 'Basic 12-bar blues in C',
            drill: {
              label: '12-Bar Blues drill',
              ug: 'prog',
              focus: 'basic',
              key: 'C',
              order: 'ord',
            },
          },
        ],
      },
    ],
    milestone: [
      {id: 'p1-m1', text: 'Record a 2-minute video: one scale, one progression in 3 keys, one song with both hands'},
    ],
  },
  {
    id: 'phase-2',
    title: 'Phase 2: Harmony Core & Comping',
    weeks: 'Weeks 9–16',
    summary: '7th chords, extensions (9/11/13/sus/add), shell & rootless voicings, smooth voice leading, LH patterns.',
    modules: [
      {
        id: 'm2-1',
        title: '2.1 Seventh Chords',
        learn: [
          {id: '2.1-l1', text: 'Types: maj7, dominant 7, m7, m7♭5, dim7 + formulas'},
          {id: '2.1-l2', text: 'Diatonic 7ths: Imaj7, ii7, iii7, IVmaj7, V7, vi7, viiø7'},
          {id: '2.1-l3', text: 'All 4 inversions of 7th chords'},
        ],
        doItems: [
          {
            id: '2.1-d1',
            text: 'Play diatonic 7th chords in order across any key & mode',
            drill: {
              label: 'Diatonic 7th chords in mode',
              ug: 'chord',
              focus: 't4only',
              inmode: true,
              key: 'C',
              mode: 'Ionian',
              inv: 3,
              order: 'ord',
            },
          },
          {
            id: '2.1-d2',
            text: 'Practice 7ths in both hands with independent inversions',
            drill: {
              label: 'Both-hands 7th inversions',
              ug: 'chord',
              focus: 't4only',
              inmode: true,
              clef: 'grand',
              bhmode: 'diff',
              inv: 2,
              lhinv: 1,
            },
          },
          {
            id: '2.1-d3',
            text: 'Hear maj7 vs dom7 vs m7 by ear',
            drill: {label: '7th chord ear training', ug: 'ear', focus: 'ec4'},
          },
        ],
        checkQuestions: [
          'What notes are in Dm7? Fmaj7? G7? Bm7♭5?',
          'Which diatonic chord is the dominant 7th?',
        ],
      },
      {
        id: 'm2-2',
        title: '2.2 Chord Extensions & Color Tones',
        learn: [
          {id: '2.2-l1', text: '9ths, 11ths, 13ths; sus2, sus4, 7sus4; add9 vs maj9'},
          {id: '2.2-l2', text: 'Slash chords (C/E, F/G) & altered tones (♭9, ♯9, ♯11, ♭13)'},
        ],
        doItems: [
          {
            id: '2.2-d1',
            text: 'Play diatonic sus & add chords inside your mode',
            drill: {
              label: 'Diatonic sus & add chords',
              ug: 'chord',
              focus: 'sus',
              inmode: true,
              key: 'C',
              mode: 'Ionian',
              order: 'ord',
              sound: 'rhodes',
            },
          },
          {
            id: '2.2-d2',
            text: 'Play up to 9th / 11th / 13th chords',
            drill: {
              label: '9th–13th extensions',
              ug: 'chord',
              focus: 't7',
              inmode: true,
              key: 'C',
              sound: 'rhodes',
            },
          },
        ],
        checkQuestions: [
          'What is the difference between Cadd9 and Cmaj9?',
          'Why is the 5th often dropped in rootless or extended voicings?',
        ],
      },
      {
        id: 'm2-3',
        title: '2.3 Voicings & Smooth Voice Leading',
        learn: [
          {id: '2.3-l1', text: 'Close vs open (spread) voicings and Shell voicings (1–3–7)'},
          {id: '2.3-l2', text: 'Rootless voicings: Type A (3-5-7-9) and Type B (7-9-3-5)'},
          {id: '2.3-l3', text: 'Voice leading: common tones & guide tones (3rds & 7ths)'},
        ],
        doItems: [
          {
            id: '2.3-d1',
            text: 'Play Rootless voicings (Type A & Type B) across degrees',
            drill: {
              label: 'Rootless Type A & B',
              ug: 'chord',
              focus: 'v_rootless',
              inmode: true,
              key: 'C',
              mode: 'Ionian',
              order: 'ord',
              sound: 'rhodes',
            },
          },
          {
            id: '2.3-d2',
            text: 'Practice voice-led ii–V–I progressions in 12 keys',
            drill: {
              label: 'Voice-led ii–V–I',
              ug: 'prog',
              focus: 'adv',
              key: 'rnd',
              vlead: true,
              sound: 'rhodes',
            },
          },
        ],
        checkQuestions: [
          'Which two notes define the quality of a dominant 7th chord?',
          'Why do rootless voicings work with a bassist?',
        ],
      },
      {
        id: 'm2-4',
        title: '2.4 Left-Hand Patterns Foundation',
        learn: [
          {id: '2.4-l1', text: 'Root–fifth alternating, broken arpeggio, boogie/shuffle, octave stabs'},
          {id: '2.4-l2', text: 'Walking bass, syncopated soul/R&B bass, ostinato'},
        ],
        doItems: [
          {
            id: '2.4-d1',
            text: 'Practice LH & RH accompaniment patterns with a beat',
            drill: {
              label: 'Beginner patterns with beat',
              ug: 'pat',
              focus: 'all|B',
              key: 'C',
              beat: true,
              tempo: '80',
            },
          },
        ],
        checkQuestions: [],
      },
      {
        id: 'm2-5',
        title: '2.5 Lead Sheets & Chord Charts',
        learn: [
          {id: '2.5-l1', text: 'Reading chord symbols, slash chords, repeats, codas, song roadmaps'},
        ],
        doItems: [
          {
            id: '2.5-d1',
            text: 'Read & transpose progressions using Chord Names, Roman, or Nashville numbers',
            drill: {
              label: 'Chart transposition drill',
              ug: 'prog',
              focus: 'mix',
              key: 'rnd',
              pfmt: 'nns',
              vlead: true,
            },
          },
        ],
        checkQuestions: [],
      },
      {
        id: 'm2-6',
        title: '2.6 Phase 2 Repertoire (6 Styles Intro)',
        learn: [],
        doItems: [],
        checkQuestions: [],
        repertoire: [
          {id: '2.6-r1', text: 'Pop (axis chords) · Country (I–IV–V + slide) · Motown · Ballad · R&B/Soul · 12-bar Blues'},
        ],
      },
    ],
    milestone: [
      {id: 'p2-m1', text: 'Record a 4-minute video: ii–V–I in 3 keys, 3 LH patterns, and 1 song from 3 styles'},
    ],
  },
  {
    id: 'phase-3',
    title: 'Phase 3: Pop & Ballads',
    weeks: 'Weeks 17–24',
    summary: 'Axis progressions, borrowed color chords, descending slash-bass ballads, dynamics & singer accompaniment.',
    modules: [
      {
        id: 'm3-1',
        title: '3.1 Pop Piano Language',
        learn: [
          {id: '3.1-l1', text: 'Pop forms & axis progressions (I–V–vi–IV, vi–IV–I–V, I–vi–IV–V)'},
          {id: '3.1-l2', text: 'Borrowed chords (♭VII, iv) & steady 8ths / syncopated stabs / octave melody'},
        ],
        doItems: [
          {
            id: '3.1-d1',
            text: 'Play Pop patterns with Grand Piano & metronome',
            drill: {
              label: 'Pop piano patterns',
              ug: 'pat',
              focus: 'pop|B',
              key: 'rnd',
              beat: true,
              tempo: '100',
              sound: 'grand',
            },
          },
          {
            id: '3.1-d2',
            text: 'Practice borrowed chords for chorus color',
            drill: {
              label: 'Borrowed chords',
              ug: 'chord',
              focus: 'bor',
              key: 'C',
              mode: 'Ionian',
            },
          },
        ],
        checkQuestions: [
          'How do you make the second chorus bigger than the first without changing chords?',
        ],
      },
      {
        id: 'm3-2',
        title: '3.2 Pop Ballads',
        learn: [
          {id: '3.2-l1', text: 'Ballad feel (55–80 bpm, 4/4, 3/4, 12/8) & descending slash-bass lines (C – G/B – Am – Am/G – F)'},
          {id: '3.2-l2', text: 'Clean sustain pedaling (change on each chord; check MIDI pedal indicator)'},
        ],
        doItems: [
          {
            id: '3.2-d1',
            text: 'Practice descending-bass & ballad progressions with smooth voice leading',
            drill: {
              label: 'Ballad slash progressions',
              ug: 'prog',
              focus: 'basic',
              key: 'C',
              vlead: true,
              sound: 'pad',
              beat: true,
              tempo: '60',
              feel: '12_8',
            },
          },
          {
            id: '3.2-d2',
            text: 'Slash chords with chord-tone bass',
            drill: {
              label: 'Slash chords (chord-tone bass)',
              ug: 'chord',
              focus: 'slash_c',
              inmode: true,
              key: 'C',
              mode: 'Ionian',
              order: 'ord',
            },
          },
        ],
        checkQuestions: [],
        repertoire: [
          {id: '3.2-r1', text: 'Elton John/Billy Joel style · Modern piano ballad (Adele/John Legend) · Carole King · Beatles gospel-pop'},
        ],
      },
      {
        id: 'm3-3',
        title: '3.3 Accompanying a Singer',
        learn: [
          {id: '3.3-l1', text: 'Leave space during vocals, fills only at phrase ends, transpose quickly to singer range'},
        ],
        doItems: [],
        checkQuestions: [],
      },
    ],
    milestone: [
      {id: 'p3-m1', text: 'Record 2 pop/ballad songs (1 upbeat, 1 slow) and play 1 live for a listener'},
    ],
  },
  {
    id: 'phase-4',
    title: 'Phase 4: Country & Motown',
    weeks: 'Weeks 25–32',
    summary: 'Nashville Numbers, two-beat/waltz, major pentatonic & 6th slides, active Motown basslines & backbeat chops.',
    modules: [
      {
        id: 'm4-1',
        title: '4.1 Country Piano',
        learn: [
          {id: '4.1-l1', text: 'Nashville Numbers (1, 4, 5, 6m, 1/3) & country keys (G, C, D, A, E)'},
          {id: '4.1-l2', text: 'Grace-note m3→M3 slides, pedal-steel 6ths, major pentatonic fills, two-beat & waltz'},
        ],
        doItems: [
          {
            id: '4.1-d1',
            text: 'Play Country patterns (boom-chick, slides, double-stop 6ths)',
            drill: {
              label: 'Country patterns',
              ug: 'pat',
              focus: 'country|B',
              key: 'G',
              beat: true,
              tempo: '100',
              sound: 'grand',
            },
          },
          {
            id: '4.1-d2',
            text: 'Play Country charts strictly from Nashville Numbers',
            drill: {
              label: 'Nashville chart drill',
              ug: 'prog',
              focus: 'basic',
              key: 'D',
              pfmt: 'nns',
              vlead: true,
            },
          },
        ],
        checkQuestions: [
          'How do you play "1–4–5–1 in the key of D" from numbers only?',
          'What makes a lick sound "country" instead of "bluesy"?',
        ],
      },
      {
        id: 'm4-2',
        title: '4.2 Motown & Classic Soul',
        learn: [
          {id: '4.2-l1', text: 'Funk Brothers groove: repeated 8th chords, backbeat chops, gospel triplets, tremolos'},
          {id: '4.2-l2', text: 'Jamerson-style chromatic walk-ups, ♭VII, and I/3 & IV/5 slash chords'},
        ],
        doItems: [
          {
            id: '4.2-d1',
            text: 'Practice Motown driving patterns with Wurlitzer sound',
            drill: {
              label: 'Motown Wurlitzer groove',
              ug: 'pat',
              focus: 'motown|B',
              key: 'C',
              beat: true,
              tempo: '120',
              sound: 'wurlitzer',
            },
          },
        ],
        checkQuestions: [
          'What is different about the piano’s role in Motown vs a pop ballad?',
        ],
      },
    ],
    milestone: [
      {id: 'p4-m1', text: 'Record 2 country songs + 2 Motown/soul songs; write a Nashville number chart'},
    ],
  },
  {
    id: 'phase-5',
    title: 'Phase 5: R&B, Gospel, Neo Soul & Jazz Harmony',
    weeks: 'Weeks 33–44',
    summary: 'Gospel passing chords & plagal cadence, R&B 9/11/13/backdoor/tritone subs, Neo Soul rootless/quartal/UST, Jazz ii–V–I.',
    modules: [
      {
        id: 'm5-1',
        title: '5.1 Gospel Foundations',
        learn: [
          {id: '5.1-l1', text: 'Plagal I–IV–I with sus4 resolution, IV–iv–I, V/vi–vi'},
          {id: '5.1-l2', text: 'Passing diminished chords (♯Idim7, ♯IVdim7) & 12/8 slow gospel arpeggios'},
        ],
        doItems: [
          {
            id: '5.1-d1',
            text: 'Practice passing diminished & secondary dominant harmony',
            drill: {
              label: 'Passing dim7 & sec dom',
              ug: 'harm',
              focus: 'h_dim',
              key: 'C',
              mode: 'Ionian',
              sound: 'grand',
            },
          },
          {
            id: '5.1-d2',
            text: 'Gospel patterns (octave bass walk-ups & fills)',
            drill: {
              label: 'Gospel patterns',
              ug: 'pat',
              focus: 'gospel|B',
              key: 'F',
              beat: true,
              tempo: '80',
              feel: '12_8',
            },
          },
        ],
        checkQuestions: [],
      },
      {
        id: 'm5-2',
        title: '5.2 Contemporary R&B Piano',
        learn: [
          {id: '5.2-l1', text: '16th-note syncopation, ghost notes, tritone sub & backdoor ii–V (♭VII7 → Imaj7)'},
          {id: '5.2-l2', text: 'Half-step & whole-step modulations for final choruses'},
        ],
        doItems: [
          {
            id: '5.2-d1',
            text: 'Backdoor ii–V–I (iv7 – ♭VII7 – Imaj7) & tritone substitutions',
            drill: {
              label: 'Backdoor ii–V–I',
              ug: 'harm',
              focus: 'h_bd',
              key: 'C',
              sound: 'rhodes',
              vlead: true,
            },
          },
        ],
        checkQuestions: [],
      },
      {
        id: 'm5-3',
        title: '5.3 Neo Soul Piano',
        learn: [
          {id: '5.3-l1', text: 'maj9, m9, m11, 13, 7♯9, 7♭13, 6/9 on Rhodes'},
          {id: '5.3-l2', text: 'Upper-structure triads (e.g. D/C), Quartal voicings, Dorian/Mixolydian vamps, behind-the-beat feel'},
        ],
        doItems: [
          {
            id: '5.3-d1',
            text: 'Neo Soul patterns on Rhodes (root–5th–9th, root+10th, rootless)',
            drill: {
              label: 'Neo Soul Rhodes patterns',
              ug: 'pat',
              focus: 'neosoul|I',
              key: 'C',
              beat: true,
              tempo: '80',
              sound: 'rhodes',
            },
          },
          {
            id: '5.3-d2',
            text: 'Quartal voicings inside Dorian mode',
            drill: {
              label: 'Dorian quartal voicings',
              ug: 'chord',
              focus: 'v_quartal',
              inmode: true,
              key: 'D',
              mode: 'Dorian',
              order: 'ord',
              sound: 'rhodes',
            },
          },
          {
            id: '5.3-d3',
            text: 'Upper-structure triads over dominant 7ths',
            drill: {
              label: 'Upper-structure triads',
              ug: 'chord',
              focus: 'v_ust',
              sound: 'rhodes',
            },
          },
        ],
        checkQuestions: [
          'What makes a chord sound "neo soul" instead of "pop"?',
          'How do you play "behind the beat" without dragging the tempo?',
        ],
      },
      {
        id: 'm5-4',
        title: '5.4 Jazz Discipline for Versatility',
        learn: [
          {id: '5.4-l1', text: 'Major & minor ii–V–I in 12 keys, Jazz 12-bar blues, guide-tone lines (3rds & 7ths)'},
          {id: '5.4-l2', text: 'Charleston comping & approach notes over standards'},
        ],
        doItems: [
          {
            id: '5.4-d1',
            text: 'Minor iiø7 – V7♭9 – i drill',
            drill: {
              label: 'Minor ii–V–i',
              ug: 'harm',
              focus: 'h_mii',
              key: 'C',
              vlead: true,
              sound: 'rhodes',
            },
          },
          {
            id: '5.4-d2',
            text: 'Chord-tone targeting (land on 3rds & 7ths)',
            drill: {
              label: 'Guide-tone targeting',
              ug: 'harm',
              focus: 'h_guide',
              key: 'C',
              sound: 'rhodes',
            },
          },
        ],
        checkQuestions: [],
      },
    ],
    milestone: [
      {id: 'p5-m1', text: 'Record 3-song R&B/Neo Soul set (gospel ballad, mid-tempo R&B, neo soul vamp with improv)'},
    ],
  },
  {
    id: 'phase-6',
    title: 'Phase 6: Ear, Improvisation & Performance',
    weeks: 'Weeks 45–52',
    summary: 'Melodic & bass-line transcription, pentatonic/chord-tone fills, style switching, recording & 8-piece capstone.',
    modules: [
      {
        id: 'm6-1',
        title: '6.1 Playing by Ear & Transcription',
        learn: [
          {id: '6.1-l1', text: 'Intervals, chord qualities, bass-line root movement, melodies by ear'},
        ],
        doItems: [
          {
            id: '6.1-d1',
            text: 'Play-back melody by ear drill',
            drill: {label: 'Melody by ear', ug: 'ear', focus: 'emel', sound: 'grand'},
          },
          {
            id: '6.1-d2',
            text: 'Bass-line & progression recognition by ear',
            drill: {label: 'Bass-line ear drill', ug: 'ear', focus: 'ebass', sound: 'rhodes'},
          },
        ],
        checkQuestions: [],
      },
      {
        id: 'm6-2',
        title: '6.2 Improvisation & Fills',
        learn: [
          {id: '6.2-l1', text: 'Major/minor pentatonic, blues scale, chord-tone targeting, enclosures, call & response'},
        ],
        doItems: [
          {
            id: '6.2-d1',
            text: 'Dorian & Mixolydian mode vocabulary across 2 octaves',
            drill: {
              label: 'Dorian mode 2 octaves',
              ug: 'scale',
              focus: 'chosen',
              key: 'D',
              mode: 'Dorian',
              scrange: '2',
            },
          },
        ],
        checkQuestions: [],
      },
      {
        id: 'm6-3',
        title: '6.3 Arranging & Style Switching',
        learn: [
          {id: '6.3-l1', text: 'Arrange 1 four-chord song across Pop, Ballad, Country, Motown, R&B, and Neo Soul (see Reference tab)'},
        ],
        doItems: [],
        checkQuestions: [],
      },
      {
        id: 'm6-4',
        title: '6.4 Performance, Band Play & Recording',
        learn: [
          {id: '6.4-l1', text: 'Count-ins, chart memorization, DAW MIDI/audio recording, band space & dynamics'},
        ],
        doItems: [],
        checkQuestions: [],
      },
      {
        id: 'm6-5',
        title: '6.5 Capstone Versatility Showcase (Weeks 51–52)',
        learn: [],
        doItems: [],
        checkQuestions: [],
        repertoire: [
          {id: 'cap-1', text: 'Pop song (original intro, groove change, ending)'},
          {id: 'cap-2', text: 'Ballad (arpeggios, clean pedal, dynamic arc)'},
          {id: 'cap-3', text: 'Country song from Nashville chart (slide lick & fill)'},
          {id: 'cap-4', text: 'Motown groove (driving chords & active LH bass)'},
          {id: 'cap-5', text: 'R&B ballad (extended voicings & key modulation)'},
          {id: 'cap-6', text: 'Neo soul vamp (rootless voicings, behind-the-beat, short solo)'},
          {id: 'cap-7', text: 'Jazz tune or 12-bar blues (shell voicings + pentatonic solo)'},
          {id: 'cap-8', text: 'Classical/technique piece (Bach, Chopin, or Satie)'},
        ],
      },
    ],
    milestone: [
      {id: 'p6-m1', text: 'Record all 8 capstone pieces and write your 12-month review'},
    ],
  },
];

export interface KeyMasteryRow {
  key: string;
  scaleNotes: string;
  diatonic7ths: string;
  iiVI: string;
  gospel: string;
  neoSoul: string;
}

export const APPENDIX_12_KEYS: KeyMasteryRow[] = [
  {key: 'C', scaleNotes: 'C D E F G A B', diatonic7ths: 'Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7♭5', iiVI: 'Dm7 G7 Cmaj7', gospel: 'C F/C C', neoSoul: 'Dm9 G13 Cmaj9'},
  {key: 'G', scaleNotes: 'G A B C D E F♯', diatonic7ths: 'Gmaj7 Am7 Bm7 Cmaj7 D7 Em7 F♯m7♭5', iiVI: 'Am7 D7 Gmaj7', gospel: 'G C/G G', neoSoul: 'Am9 D13 Gmaj9'},
  {key: 'D', scaleNotes: 'D E F♯ G A B C♯', diatonic7ths: 'Dmaj7 Em7 F♯m7 Gmaj7 A7 Bm7 C♯m7♭5', iiVI: 'Em7 A7 Dmaj7', gospel: 'D G/D D', neoSoul: 'Em9 A13 Dmaj9'},
  {key: 'A', scaleNotes: 'A B C♯ D E F♯ G♯', diatonic7ths: 'Amaj7 Bm7 C♯m7 Dmaj7 E7 F♯m7 G♯m7♭5', iiVI: 'Bm7 E7 Amaj7', gospel: 'A D/A A', neoSoul: 'Bm9 E13 Amaj9'},
  {key: 'E', scaleNotes: 'E F♯ G♯ A B C♯ D♯', diatonic7ths: 'Emaj7 F♯m7 G♯m7 Amaj7 B7 C♯m7 D♯m7♭5', iiVI: 'F♯m7 B7 Emaj7', gospel: 'E A/E E', neoSoul: 'F♯m9 B13 Emaj9'},
  {key: 'B', scaleNotes: 'B C♯ D♯ E F♯ G♯ A♯', diatonic7ths: 'Bmaj7 C♯m7 D♯m7 Emaj7 F♯7 G♯m7 A♯m7♭5', iiVI: 'C♯m7 F♯7 Bmaj7', gospel: 'B E/B B', neoSoul: 'C♯m9 F♯13 Bmaj9'},
  {key: 'F♯', scaleNotes: 'F♯ G♯ A♯ B C♯ D♯ E♯', diatonic7ths: 'F♯maj7 G♯m7 A♯m7 Bmaj7 C♯7 D♯m7 E♯m7♭5', iiVI: 'G♯m7 C♯7 F♯maj7', gospel: 'F♯ B/F♯ F♯', neoSoul: 'G♯m9 C♯13 F♯maj9'},
  {key: 'D♭', scaleNotes: 'D♭ E♭ F G♭ A♭ B♭ C', diatonic7ths: 'D♭maj7 E♭m7 Fm7 G♭maj7 A♭7 B♭m7 Cm7♭5', iiVI: 'E♭m7 A♭7 D♭maj7', gospel: 'D♭ G♭/D♭ D♭', neoSoul: 'E♭m9 A♭13 D♭maj9'},
  {key: 'A♭', scaleNotes: 'A♭ B♭ C D♭ E♭ F G', diatonic7ths: 'A♭maj7 B♭m7 Cm7 D♭maj7 E♭7 Fm7 Gm7♭5', iiVI: 'B♭m7 E♭7 A♭maj7', gospel: 'A♭ D♭/A♭ A♭', neoSoul: 'B♭m9 E♭13 A♭maj9'},
  {key: 'E♭', scaleNotes: 'E♭ F G A♭ B♭ C D', diatonic7ths: 'E♭maj7 Fm7 Gm7 A♭maj7 B♭7 Cm7 Dm7♭5', iiVI: 'Fm7 B♭7 E♭maj7', gospel: 'E♭ A♭/E♭ E♭', neoSoul: 'Fm9 B♭13 E♭maj9'},
  {key: 'B♭', scaleNotes: 'B♭ C D E♭ F G A', diatonic7ths: 'B♭maj7 Cm7 Dm7 E♭maj7 F7 Gm7 Am7♭5', iiVI: 'Cm7 F7 B♭maj7', gospel: 'B♭ E♭/B♭ B♭', neoSoul: 'Cm9 F13 B♭maj9'},
  {key: 'F', scaleNotes: 'F G A B♭ C D E', diatonic7ths: 'Fmaj7 Gm7 Am7 B♭maj7 C7 Dm7 Em7♭5', iiVI: 'Gm7 C7 Fmaj7', gospel: 'F B♭/F F', neoSoul: 'Gm9 C13 Fmaj9'},
];

export const STYLE_SWITCH_MAP: {
  style: string;
  tempo: string;
  feel: string;
  lh: string;
  rh: string;
  harmony: string;
  pedal: string;
  sound: string;
}[] = [
  {style: 'Pop', tempo: '100–130', feel: 'Straight 8ths', lh: 'Octaves, root–5th', rh: 'Block chords, octave melody', harmony: 'Triads, add9, sus', pedal: 'Moderate', sound: 'Grand, bright'},
  {style: 'Ballad', tempo: '55–80', feel: '12/8 or slow 4/4', lh: 'Arpeggios, pedal bass', rh: 'Arpeggios, rich voicings', harmony: '7ths, slash chords', pedal: 'Heavy & flowing', sound: 'Warm grand'},
  {style: 'Country', tempo: '80–140', feel: 'Two-beat, waltz, shuffle', lh: 'Root–5th, walking', rh: 'Slides, 6ths, pedal-steel licks', harmony: 'I–IV–V, 6ths', pedal: 'Light, dry', sound: 'Bright / honky-tonk'},
  {style: 'Motown', tempo: '110–140', feel: 'Driving 8ths, backbeat', lh: 'Active bass line', rh: 'Repeated chords, tremolo', harmony: 'Triads, 7ths, chromatic bass', pedal: 'Light, rhythmic', sound: 'Upright, Wurlitzer'},
  {style: 'R&B', tempo: '65–100', feel: 'Syncopated 16ths', lh: 'Sparse bass, syncopated', rh: 'Extended chords, fills', harmony: '7ths, 9ths, 11ths, 13ths', pedal: 'Moderate', sound: 'Grand, Rhodes'},
  {style: 'Neo Soul', tempo: '60–95', feel: 'Laid-back, swung 16ths', lh: 'Minimal or rootless split', rh: 'Rootless, quartal, UST', harmony: 'maj9, m9, 13, altered', pedal: 'Subtle, rhythmic', sound: 'Rhodes, Wurlitzer, pad'},
];

export const WEEKLY_ROUTINE: {day: string; focus: string}[] = [
  {day: 'Mon', focus: 'Technique + theory + new repertoire'},
  {day: 'Tue', focus: 'Left-hand patterns and groove'},
  {day: 'Wed', focus: 'Voicings and harmony in 3 keys'},
  {day: 'Thu', focus: 'Ear training and transcription'},
  {day: 'Fri', focus: 'Repertoire polishing and recording'},
  {day: 'Sat', focus: 'Improvisation, free play, and jamming with backing tracks'},
  {day: 'Sun', focus: 'Rest or light play for enjoyment; review the week'},
];

export const RUBRIC_SKILLS = [
  {id: 'reading', name: 'Reading', target: 'Sight-reads simple music and lead sheets accurately'},
  {id: 'rhythm', name: 'Rhythm', target: 'Holds steady time and switches feels (straight, swing, 12/8)'},
  {id: 'scales', name: 'Scales & arpeggios', target: 'All keys, even and relaxed at target tempo'},
  {id: 'technique', name: 'Technique', target: 'Clean, controlled, no tension, wide dynamic range'},
  {id: 'triads7', name: 'Triads & 7ths', target: 'Instant recall in all keys'},
  {id: 'voicings', name: 'Extensions & voicings', target: 'Plays rootless, quartal, and upper-structure voicings smoothly'},
  {id: 'lh', name: 'Left-hand patterns', target: 'Plays 8+ patterns with consistent groove'},
  {id: 'nns', name: 'Nashville numbers', target: 'Plays any simple chart in any key'},
  {id: 'pop', name: 'Pop & ballads', target: 'Arranges a full song with dynamics'},
  {id: 'country', name: 'Country', target: 'Idiomatic slides, fills, and patterns'},
  {id: 'motown', name: 'Motown / soul', target: 'Drives with energy and a real groove'},
  {id: 'rnb', name: 'R&B / gospel', target: 'Fills, passing chords, and expressive voicings'},
  {id: 'neosoul', name: 'Neo soul', target: 'Behind-the-beat feel with extended harmony'},
  {id: 'jazz', name: 'Jazz basics', target: 'Comps and plays simple solos over standards'},
  {id: 'ear', name: 'Ear', target: 'Finds chords and melodies by ear quickly'},
  {id: 'improv', name: 'Improvisation', target: 'Creates coherent phrases and fills'},
  {id: 'pedal', name: 'Pedaling', target: 'Clean changes, appropriate to style'},
  {id: 'perf', name: 'Performance', target: 'Plays through mistakes, sets tempo, finishes strongly'},
  {id: 'rec', name: 'Recording', target: 'Produces clean audio or video takes'},
];

export const EQUIPMENT_POSTURE = [
  '88 weighted keys (hammer action) + real sustain pedal',
  'Adjustable bench: forearms roughly level with the keys; sit on front half',
  'Back upright, wrists level, curved fingers, relaxed shoulders & thumbs',
  'Stop immediately if you feel pain — relax and lower tempo',
  'Practice rules: Slow is fast (+4–5 bpm only at 0 mistakes) · Hands separate first · Small chunks · Record weekly',
];

export const TROUBLESHOOTING: {problem: string; cause: string; fix: string}[] = [
  {problem: 'Uneven scales', cause: 'Rushing, weak fingers, tension', fix: 'Slow metronome, accent patterns, shorter ranges'},
  {problem: 'Muddy sound', cause: 'Too much sustain pedal', fix: 'Change pedal cleanly with each chord; use half-pedal'},
  {problem: 'Rushing the groove', cause: 'Anxiety, no internal pulse', fix: 'Practice with beats 2 & 4 click; tap foot; record yourself'},
  {problem: 'Chords sound "plain"', cause: 'Only playing root triads', fix: 'Add 7ths, 9ths, sus resolutions, slash chords & voice leading'},
  {problem: 'Left hand sounds clunky', cause: 'Low-register dense chords', fix: 'Use single roots, 5ths, or shells low; keep full chords near middle C+'},
  {problem: 'Cannot coordinate L + R', cause: 'Hands not independent', fix: 'Hands separate first, then slowest tempo together'},
  {problem: 'Overplaying', cause: 'Filling every space', fix: 'Play fewer notes; leave room for the singer & bass'},
];

export const GLOSSARY: [string, string][] = [
  ['Comping', 'Rhythmic chordal accompaniment behind a soloist or singer'],
  ['Diatonic', 'Belonging strictly to the notes of the chosen key & mode'],
  ['Guide tones', 'The 3rd and 7th of a chord — they carry the harmonic movement'],
  ['Nashville Number System', 'Writing chords as numbers (1, 2m, 4, 5, 6m, 1/3) relative to the key'],
  ['Quartal voicing', 'Chord built by stacking fourths (McCoy Tyner / Neo Soul color)'],
  ['Rootless voicing', '3-5-7-9 (Type A) or 7-9-3-5 (Type B) leaving room for a bassist'],
  ['Shell voicing', 'Root, 3rd, and 7th only — clean foundation for LH or standards'],
  ['Tritone substitution', 'Replacing V7 with ♭II7 (shares the exact same 3rd & 7th)'],
  ['Upper-structure triad', 'A triad stacked over a dominant chord (e.g. D triad over C7 = 9, ♯11, 13)'],
  ['Voice leading', 'Moving individual chord tones the shortest distance between chords'],
];
