import assert from 'node:assert/strict';
import {
  buildVoicingMidi,
  CHORD_QUALITY_INTERVALS,
  computeVoicingFingering,
  DEFAULT_FINGERING_RULES,
  DEFAULT_VL_RANGE,
  generateShapesNearChord,
  nextVoicing,
  pickStartVoicing,
  resolveChordIntervals,
  resolveOctaveVoiceLeadingSettings,
  rotateInversionVoicing,
  sortedVoiceCost,
  voiceProgression,
} from './voiceLeadingEngine';

function testCmajorProgressionIiiVI() {
  // C major: I -> ii -> V -> I
  const steps = voiceProgression('C', 0, ['Dm', 'G', 'C'], {
    range: DEFAULT_VL_RANGE,
  });
  assert.equal(steps.length, 4);
  // Step 0: I near center of C3..C6 -> C4 E4 G4 [60, 64, 67]
  assert.deepEqual(steps[0].notes, [60, 64, 67]);
  assert.equal(steps[0].cost, 0);

  // Step 1: I -> ii (D4 F4 A4 = [62, 65, 69]), cost 2+1+2 = 5, max move = 2
  assert.deepEqual(steps[1].notes, [62, 65, 69]);
  assert.equal(steps[1].cost, 5);
  assert.ok(steps[1].voiceMoves.every(d => Math.abs(d) <= 2));

  // Step 2: ii -> V (D4 G4 B4 = [62, 67, 71]), cost 0+2+2 = 4, max move = 2
  assert.deepEqual(steps[2].notes, [62, 67, 71]);
  assert.equal(steps[2].cost, 4);
  assert.ok(steps[2].voiceMoves.every(d => Math.abs(d) <= 2));

  // Step 3: V -> I (E4 G4 C5 = [64, 67, 72]), cost 2+0+1 = 3
  assert.deepEqual(steps[3].notes, [64, 67, 72]);
  assert.equal(steps[3].cost, 3);
}

function testCEGtoBDG() {
  // Moving from C E G [60, 64, 67] to G major (B D G [59, 62, 67]): voices move -1, -2, 0
  const res = nextVoicing([60, 64, 67], {root: 7, quality: ''}, {range: DEFAULT_VL_RANGE});
  assert.deepEqual(res.notes, [59, 62, 67]);
  assert.equal(res.cost, 3);
  assert.deepEqual(res.voiceMoves, [-1, -2, 0]);
}

function testMinimumCostPropertyAllKeysAndNonDiatonic() {
  const diatonicSpecs: [number, string][] = [
    [0, ''],
    [2, 'm'],
    [4, 'm'],
    [5, ''],
    [7, ''],
    [9, 'm'],
    [11, 'dim'],
  ];
  // Include non-diatonic secondary dominants, borrowed chords, augmented, dim7
  const nonDiatonicSpecs: [number, string][] = [
    [2, '7'],
    [9, ''],
    [8, ''],
    [1, ''],
    [6, 'dim7'],
    [4, 'aug'],
  ];
  const allSpecs = [...diatonicSpecs, ...nonDiatonicSpecs];

  for (let key = 0; key < 12; key++) {
    for (const [o1, q1] of allSpecs) {
      const ch1 = {root: (key + o1) % 12, quality: q1};
      const start = pickStartVoicing(ch1, 0, DEFAULT_VL_RANGE);
      const ints1 = resolveChordIntervals(ch1).ints;

      for (let inv = 0; inv < Math.min(3, ints1.length); inv++) {
        const prev = pickStartVoicing(ch1, inv, DEFAULT_VL_RANGE).notes;
        for (const [o2, q2] of allSpecs) {
          const ch2 = {root: (key + o2) % 12, quality: q2};
          const chosen = nextVoicing(prev, ch2, {range: DEFAULT_VL_RANGE});
          const {pc: pc2, ints: ints2} = resolveChordIntervals(ch2);

          // Brute-force minimum cost over EVERY candidate in DEFAULT_VL_RANGE (with span <= 12)
          let minCost = Infinity;
          for (let i2 = 0; i2 < ints2.length; i2++) {
            for (let oct = -1; oct <= 8; oct++) {
              const cand = buildVoicingMidi(ints2, pc2, i2, oct);
              if (
                cand[0] < DEFAULT_VL_RANGE[0] ||
                cand[cand.length - 1] > DEFAULT_VL_RANGE[1]
              ) {
                continue;
              }
              if (cand[cand.length - 1] - cand[0] > 12) continue;
              const c = sortedVoiceCost(prev, cand);
              if (c < minCost) minCost = c;
            }
          }
          assert.equal(
            chosen.cost,
            minCost,
            `Failed min cost for key ${key}: ${o1}${q1} (inv ${inv}) -> ${o2}${q2}`,
          );
          assert.ok(
            chosen.notes.every(
              n => n >= DEFAULT_VL_RANGE[0] && n <= DEFAULT_VL_RANGE[1],
            ),
          );
        }
      }
      assert.ok(start.notes.length >= 3);
    }
  }
}

function testStartAnywhereFromSecondInversionV() {
  // Start on V (G major) in 2nd inversion [D, G, B], then play I - vi - ii - V - I
  const steps = voiceProgression('G', 2, ['C', 'Am', 'Dm', 'G', 'C'], {
    range: DEFAULT_VL_RANGE,
  });
  assert.equal(steps[0].inversion, 2);
  for (const s of steps) {
    assert.ok(s.notes.every(n => n >= DEFAULT_VL_RANGE[0] && n <= DEFAULT_VL_RANGE[1]));
  }
  // Subsequent voice transitions should all stay smooth (cost <= 6)
  for (let i = 1; i < steps.length; i++) {
    assert.ok(steps[i].cost <= 6, `Step ${i} cost ${steps[i].cost} too high`);
  }
}

function testRangeSafetyLongUpwardProgression() {
  // Simulate 12 cycles upward with direction: 'up' and upward inversion rotations
  let cur = pickStartVoicing('C', 0, DEFAULT_VL_RANGE).notes;
  const cycle = ['F', 'G', 'C', 'Am', 'Dm', 'G', 'C'];
  for (let rep = 0; rep < 12; rep++) {
    for (const sym of cycle) {
      const nxt = nextVoicing(cur, sym, {
        direction: 'up',
        range: DEFAULT_VL_RANGE,
      });
      assert.ok(
        nxt.notes.every(
          n => n >= DEFAULT_VL_RANGE[0] && n <= DEFAULT_VL_RANGE[1],
        ),
        `Out of range: ${nxt.notes.join(',')}`,
      );
      cur = nxt.notes;
    }
    cur = rotateInversionVoicing(cur, 'up', DEFAULT_VL_RANGE);
    assert.ok(
      cur.every(n => n >= DEFAULT_VL_RANGE[0] && n <= DEFAULT_VL_RANGE[1]),
      `Rotated out of range: ${cur.join(',')}`,
    );
  }
}

function testSettingInteractionRandomOctaveOff() {
  const afterEnable = resolveOctaveVoiceLeadingSettings(
    {vlead: false, randomOctave: true},
    {vlead: true},
  );
  assert.equal(afterEnable.vlead, true);
  assert.equal(afterEnable.randomOctave, false);
  assert.ok(afterEnable.notice.toLowerCase().includes('random octaves'));

  const afterReEnableRandom = resolveOctaveVoiceLeadingSettings(
    {vlead: true, randomOctave: false},
    {randomOctave: true},
  );
  assert.equal(afterReEnableRandom.vlead, true);
  assert.equal(afterReEnableRandom.randomOctave, true);
  assert.ok(afterReEnableRandom.warning.toLowerCase().includes('warning'));
}

function testFingeringRulesAndAlternatives() {
  // 1. Right-hand C E G -> 1 (2/3) 5
  const rh = computeVoicingFingering([60, 64, 67], 'R');
  assert.deepEqual(rh.primary, [1, 3, 5]);
  assert.deepEqual(rh.perNote[0].fingers, [1]);
  assert.ok(
    rh.perNote[1].fingers.includes(3) && rh.perNote[1].fingers.length <= 2,
  );
  assert.deepEqual(rh.perNote[2].fingers, [5]);

  // 2. Left-hand fingering mirrors right-hand on symmetric triad (C3 E3 G3 -> 5 (2/3) 1)
  const lh = computeVoicingFingering([48, 52, 55], 'L');
  assert.deepEqual(lh.primary, [5, 3, 1]);
  assert.deepEqual(
    lh.perNote.map(p => p.fingers),
    [...rh.perNote].reverse().map(p => p.fingers),
  );

  // 3. Held note preserves same finger between chords: C4 E4 G4 (1 3 5) -> B3 D4 G4 holds G4 on finger 5
  const nextFg = computeVoicingFingering([59, 62, 67], 'R', {
    notes: [60, 64, 67],
    primary: rh.primary,
  });
  assert.equal(nextFg.primary[2], 5);

  // 4. Never more than 2 alternatives per position
  const fg7 = computeVoicingFingering([60, 64, 67, 71], 'R');
  for (const pos of fg7.perNote) {
    assert.ok(pos.fingers.length >= 1 && pos.fingers.length <= 2);
  }

  // 5. Alternatives appear ONLY when gap is within threshold
  const tightRules = {
    ...DEFAULT_FINGERING_RULES,
    alternativeThreshold: 0.05,
  };
  const noAlt = computeVoicingFingering([60, 64, 67], 'R', null, tightRules);
  assert.ok(noAlt.perNote.every(p => p.fingers.length === 1));
}

function testThreeFamiliesGeneratorNotHardcoded() {
  const specs = [
    {degreeIndex: 0, chordName: 'C', chord: {root: 0, quality: ''}},
    {degreeIndex: 1, chordName: 'Dm', chord: {root: 2, quality: 'm'}},
    {degreeIndex: 2, chordName: 'Em', chord: {root: 4, quality: 'm'}},
    {degreeIndex: 3, chordName: 'F', chord: {root: 5, quality: ''}},
    {degreeIndex: 4, chordName: 'G', chord: {root: 7, quality: ''}},
    {degreeIndex: 5, chordName: 'Am', chord: {root: 9, quality: 'm'}},
    {degreeIndex: 6, chordName: 'Bdim', chord: {root: 11, quality: 'dim'}},
  ];
  const families = generateShapesNearChord(
    {root: 0, quality: ''},
    0,
    [0, 2, 4, 5, 7, 9, 11],
    specs,
  );
  assert.equal(families.length, 3);
  assert.deepEqual(
    families.map(f => f.anchorNotes.length),
    [3, 3, 3],
  );
  assert.ok(Object.keys(CHORD_QUALITY_INTERVALS).length > 10);
}

testCmajorProgressionIiiVI();
testCEGtoBDG();
testMinimumCostPropertyAllKeysAndNonDiatonic();
testStartAnywhereFromSecondInversionV();
testRangeSafetyLongUpwardProgression();
testSettingInteractionRandomOctaveOff();
testFingeringRulesAndAlternatives();
testThreeFamiliesGeneratorNotHardcoded();

console.log('ALL VOICE LEADING & FINGERING ENGINE TESTS PASSED');
