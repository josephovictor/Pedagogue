import {BookOpen, Check, Play, RotateCcw, Timer, X} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {
  APPENDIX_12_KEYS,
  CURRICULUM_PHASES,
  EQUIPMENT_POSTURE,
  GLOSSARY,
  PLACEMENT_ITEMS,
  RUBRIC_SKILLS,
  STYLE_SWITCH_MAP,
  TECHNIQUE_TRACK,
  TROUBLESHOOTING,
  WEEKLY_ROUTINE,
  type DrillPreset,
} from '../pedagogue/curriculumData';

interface CurriculumModalProps {
  open: boolean;
  onClose: () => void;
  onLaunchDrill: (preset: DrillPreset) => void;
}

type TabId = 'overview' | 'phases' | 'technique' | 'keys' | 'reference';

interface LogEntry {
  id: string;
  date: string;
  minutes: string;
  win: string;
  problem: string;
}

const STORAGE_CHECKS = 'pedagogue_curriculum_checks_v1';
const STORAGE_RUBRIC = 'pedagogue_curriculum_rubric_v1';
const STORAGE_LOGS = 'pedagogue_curriculum_logs_v1';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function CurriculumModal({
  open,
  onClose,
  onLaunchDrill,
}: CurriculumModalProps) {
  const [tab, setTab] = useState<TabId>('overview');
  const [activePhaseId, setActivePhaseId] = useState<string>('phase-1');
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    loadJson(STORAGE_CHECKS, {}),
  );
  const [rubric, setRubric] = useState<Record<string, number>>(() =>
    loadJson(STORAGE_RUBRIC, {}),
  );
  const [logs, setLogs] = useState<LogEntry[]>(() =>
    loadJson(STORAGE_LOGS, []),
  );

  // Practice session timer (60m or 30m)
  const [sessionMode, setSessionMode] = useState<'60' | '30'>('60');
  const [blockIdx, setBlockIdx] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const blocks = useMemo(
    () =>
      sessionMode === '60'
        ? [
            {name: '1. Warm-up & technique', mins: 12},
            {name: '2. Theory in action (12 keys)', mins: 15},
            {name: '3. Repertoire', mins: 23},
            {name: '4. Ear & play-by-ear', mins: 10},
          ]
        : [
            {name: '1. Warm-up & technique', mins: 5},
            {name: '3. Repertoire', mins: 20},
            {name: '4. Ear & play-by-ear', mins: 5},
          ],
    [sessionMode],
  );

  const [secLeft, setSecLeft] = useState(blocks[0].mins * 60);

  // Practice log form
  const [logMinutes, setLogMinutes] = useState('45');
  const [logWin, setLogWin] = useState('');
  const [logProblem, setLogProblem] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CHECKS, JSON.stringify(checks));
    } catch {
      // ignore storage quota
    }
  }, [checks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_RUBRIC, JSON.stringify(rubric));
    } catch {
      // ignore
    }
  }, [rubric]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs));
    } catch {
      // ignore
    }
  }, [logs]);

  useEffect(() => {
    setBlockIdx(0);
    setSecLeft(blocks[0].mins * 60);
    setTimerRunning(false);
  }, [blocks]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecLeft(prev => {
        if (prev > 1) return prev - 1;
        const nextBlock = blockIdx + 1;
        if (nextBlock < blocks.length) {
          setBlockIdx(nextBlock);
          return blocks[nextBlock].mins * 60;
        }
        setTimerRunning(false);
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, blockIdx, blocks]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const toggleCheck = (id: string) => {
    setChecks(prev => ({...prev, [id]: !prev[id]}));
  };

  const placementCount = PLACEMENT_ITEMS.filter(p => checks[p.id]).length;
  const placementRecommendation =
    placementCount <= 2
      ? {label: 'Start at Phase 1 (Week 1)', phaseId: 'phase-1'}
      : placementCount <= 5
        ? {label: 'Skim Phase 1; start Phase 2 (Week 9)', phaseId: 'phase-2'}
        : {
            label: 'Skim Phases 1–2; start Phase 3 (Week 17)',
            phaseId: 'phase-3',
          };

  const allTaskIds = useMemo(() => {
    const ids: string[] = [];
    CURRICULUM_PHASES.forEach(ph => {
      ph.modules.forEach(m => {
        m.learn.forEach(t => ids.push(t.id));
        m.doItems.forEach(t => ids.push(t.id));
        m.repertoire?.forEach(t => ids.push(t.id));
      });
      ph.milestone.forEach(t => ids.push(t.id));
    });
    TECHNIQUE_TRACK.forEach(lv => {
      lv.exercises.forEach(t => ids.push(t.id));
      lv.classicalPieces.forEach(t => ids.push(t.id));
      lv.jazzTech.forEach(t => ids.push(t.id));
    });
    APPENDIX_12_KEYS.forEach(row => {
      ['scale', 'd7', 'iivi', 'gospel', 'neo'].forEach(col =>
        ids.push(`k12-${row.key}-${col}`),
      );
    });
    return ids;
  }, []);

  const doneCount = allTaskIds.filter(id => checks[id]).length;
  const progressPct = allTaskIds.length
    ? Math.round((100 * doneCount) / allTaskIds.length)
    : 0;

  const launch = (preset: DrillPreset) => {
    onLaunchDrill(preset);
    onClose();
  };

  const addLog = () => {
    if (!logWin.trim() && !logProblem.trim()) return;
    const entry: LogEntry = {
      id: String(Date.now()),
      date: new Date().toLocaleDateString(),
      minutes: logMinutes || '45',
      win: logWin.trim(),
      problem: logProblem.trim(),
    };
    setLogs(prev => [entry, ...prev].slice(0, 40));
    setLogWin('');
    setLogProblem('');
  };

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!open) return null;

  const activePhase =
    CURRICULUM_PHASES.find(p => p.id === activePhaseId) || CURRICULUM_PHASES[0];

  return (
    <div
      className="cur-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Contemporary Piano Curriculum"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cur-modal card">
        <div className="cur-head">
          <div className="cur-title-wrap">
            <BookOpen size={20} className="cur-ico" />
            <div>
              <h2>Contemporary Piano Curriculum (52 Weeks)</h2>
              <p className="cur-sub">
                R&amp;B · Neo Soul · Ballads · Country · Pop · Motown ·{' '}
                {doneCount}/{allTaskIds.length} completed ({progressPct}%)
              </p>
            </div>
          </div>
          <button
            type="button"
            className="ic"
            onClick={onClose}
            aria-label="Close curriculum"
          >
            <X size={18} />
          </button>
        </div>

        <div className="cur-tabs" role="tablist">
          {(
            [
              ['overview', 'Placement & Timer'],
              ['phases', 'Phases 1–6'],
              ['technique', 'Technique Track'],
              ['keys', '12-Key Grid'],
              ['reference', 'Rubric & Guides'],
            ] as [TabId, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`s cur-tab ${tab === id ? 'on' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="cur-body">
          {tab === 'overview' && (
            <div className="cur-grid-2">
              <div className="cur-box">
                <h3>1. Placement Self-Check</h3>
                <p className="cur-muted">
                  Tick every statement that is currently comfortable for you:
                </p>
                <div className="cur-list">
                  {PLACEMENT_ITEMS.map(item => (
                    <label key={item.id} className="cur-chk">
                      <input
                        type="checkbox"
                        checked={!!checks[item.id]}
                        onChange={() => toggleCheck(item.id)}
                      />
                      <span>{item.text}</span>
                    </label>
                  ))}
                </div>
                <div className="cur-callout">
                  <div>
                    <strong>Result ({placementCount}/9):</strong>{' '}
                    {placementRecommendation.label}
                  </div>
                  <button
                    type="button"
                    className="cur-launch"
                    onClick={() => {
                      setActivePhaseId(placementRecommendation.phaseId);
                      setTab('phases');
                    }}
                  >
                    Open Recommended Phase →
                  </button>
                </div>
              </div>

              <div className="cur-box">
                <h3>
                  <Timer size={15} style={{display: 'inline', marginRight: 6}} />
                  Session Timer &amp; Practice Log
                </h3>
                <div className="cur-row-gap">
                  <div className="seg">
                    <button
                      type="button"
                      className={sessionMode === '60' ? 'on' : ''}
                      onClick={() => setSessionMode('60')}
                    >
                      60-Min Full
                    </button>
                    <button
                      type="button"
                      className={sessionMode === '30' ? 'on' : ''}
                      onClick={() => setSessionMode('30')}
                    >
                      30-Min Quick
                    </button>
                  </div>
                </div>
                <div className="cur-timer-box">
                  <div className="cur-timer-block">{blocks[blockIdx]?.name}</div>
                  <div className="cur-timer-clock">{fmtTime(secLeft)}</div>
                  <div className="cur-row-gap">
                    <button
                      type="button"
                      onClick={() => setTimerRunning(r => !r)}
                    >
                      {timerRunning ? 'Pause' : 'Start Block'}
                    </button>
                    <button
                      type="button"
                      className="s"
                      onClick={() => {
                        setTimerRunning(false);
                        setBlockIdx(0);
                        setSecLeft(blocks[0].mins * 60);
                      }}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                  <div className="cur-blocks">
                    {blocks.map((b, i) => (
                      <button
                        key={b.name}
                        type="button"
                        className={`s cur-pill ${i === blockIdx ? 'on' : ''}`}
                        onClick={() => {
                          setTimerRunning(false);
                          setBlockIdx(i);
                          setSecLeft(b.mins * 60);
                        }}
                      >
                        {b.name} ({b.mins}m)
                      </button>
                    ))}
                  </div>
                </div>

                <h4>Quick Practice Log</h4>
                <div className="cur-log-form">
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={logMinutes}
                    onChange={e => setLogMinutes(e.target.value)}
                    placeholder="Min"
                    aria-label="Minutes practiced"
                  />
                  <input
                    type="text"
                    value={logWin}
                    onChange={e => setLogWin(e.target.value)}
                    placeholder="One win today…"
                    aria-label="One win"
                  />
                  <input
                    type="text"
                    value={logProblem}
                    onChange={e => setLogProblem(e.target.value)}
                    placeholder="One problem to fix…"
                    aria-label="One problem"
                  />
                  <button type="button" onClick={addLog}>
                    Save
                  </button>
                </div>
                {logs.length > 0 && (
                  <div className="cur-logs">
                    {logs.slice(0, 6).map(l => (
                      <div key={l.id} className="cur-log-item">
                        <b>
                          {l.date} · {l.minutes}m
                        </b>
                        {l.win && <span> ✓ {l.win}</span>}
                        {l.problem && <span> · ⚑ {l.problem}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'phases' && (
            <div>
              <div className="cur-phase-bar">
                {CURRICULUM_PHASES.map(ph => (
                  <button
                    key={ph.id}
                    type="button"
                    className={`s cur-pill ${ph.id === activePhase.id ? 'on' : ''}`}
                    onClick={() => setActivePhaseId(ph.id)}
                  >
                    {ph.title.replace('Phase ', 'P')} ({ph.weeks})
                  </button>
                ))}
              </div>
              <div className="cur-box">
                <h3>
                  {activePhase.title} · {activePhase.weeks}
                </h3>
                <p className="cur-muted">{activePhase.summary}</p>
                {activePhase.modules.map(mod => (
                  <div key={mod.id} className="cur-mod">
                    <h4>{mod.title}</h4>
                    {mod.learn.length > 0 && (
                      <div className="cur-subsec">
                        <span className="cur-tag">Learn</span>
                        {mod.learn.map(t => (
                          <label key={t.id} className="cur-chk">
                            <input
                              type="checkbox"
                              checked={!!checks[t.id]}
                              onChange={() => toggleCheck(t.id)}
                            />
                            <span>{t.text}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {mod.doItems.length > 0 && (
                      <div className="cur-subsec">
                        <span className="cur-tag">Be able to do</span>
                        {mod.doItems.map(t => (
                          <div key={t.id} className="cur-task-row">
                            <label className="cur-chk">
                              <input
                                type="checkbox"
                                checked={!!checks[t.id]}
                                onChange={() => toggleCheck(t.id)}
                              />
                              <span>{t.text}</span>
                            </label>
                            {t.drill && (
                              <button
                                type="button"
                                className="cur-launch"
                                onClick={() => launch(t.drill!)}
                              >
                                <Play size={12} /> {t.drill.label}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {mod.repertoire && mod.repertoire.length > 0 && (
                      <div className="cur-subsec">
                        <span className="cur-tag">Repertoire</span>
                        {mod.repertoire.map(t => (
                          <div key={t.id} className="cur-task-row">
                            <label className="cur-chk">
                              <input
                                type="checkbox"
                                checked={!!checks[t.id]}
                                onChange={() => toggleCheck(t.id)}
                              />
                              <span>{t.text}</span>
                            </label>
                            {t.drill && (
                              <button
                                type="button"
                                className="cur-launch"
                                onClick={() => launch(t.drill!)}
                              >
                                <Play size={12} /> {t.drill.label}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {mod.checkQuestions.length > 0 && (
                      <div className="cur-checkq">
                        <strong>Check yourself:</strong>{' '}
                        {mod.checkQuestions.join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
                <div className="cur-callout">
                  <strong>Milestone:</strong>
                  {activePhase.milestone.map(m => (
                    <label key={m.id} className="cur-chk">
                      <input
                        type="checkbox"
                        checked={!!checks[m.id]}
                        onChange={() => toggleCheck(m.id)}
                      />
                      <span>{m.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'technique' && (
            <div className="cur-stack">
              {TECHNIQUE_TRACK.map(lv => (
                <div key={lv.id} className="cur-box">
                  <h3>
                    {lv.title} · {lv.weeks}
                  </h3>
                  {lv.exercises.map(t => (
                    <div key={t.id} className="cur-task-row">
                      <label className="cur-chk">
                        <input
                          type="checkbox"
                          checked={!!checks[t.id]}
                          onChange={() => toggleCheck(t.id)}
                        />
                        <span>{t.text}</span>
                      </label>
                      {t.drill && (
                        <button
                          type="button"
                          className="cur-launch"
                          onClick={() => launch(t.drill!)}
                        >
                          <Play size={12} /> {t.drill.label}
                        </button>
                      )}
                    </div>
                  ))}
                  {lv.classicalPieces.length > 0 && (
                    <div className="cur-subsec">
                      <span className="cur-tag">Classical pieces</span>
                      {lv.classicalPieces.map(t => (
                        <label key={t.id} className="cur-chk">
                          <input
                            type="checkbox"
                            checked={!!checks[t.id]}
                            onChange={() => toggleCheck(t.id)}
                          />
                          <span>{t.text}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {lv.jazzTech.length > 0 && (
                    <div className="cur-subsec">
                      <span className="cur-tag">Jazz / Blues technique</span>
                      {lv.jazzTech.map(t => (
                        <div key={t.id} className="cur-task-row">
                          <label className="cur-chk">
                            <input
                              type="checkbox"
                              checked={!!checks[t.id]}
                              onChange={() => toggleCheck(t.id)}
                            />
                            <span>{t.text}</span>
                          </label>
                          {t.drill && (
                            <button
                              type="button"
                              className="cur-launch"
                              onClick={() => launch(t.drill!)}
                            >
                              <Play size={12} /> {t.drill.label}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'keys' && (
            <div className="cur-box">
              <h3>Appendix A: 12-Key Mastery Grid</h3>
              <p className="cur-muted">
                Check off each milestone per key or click Play to launch that exact drill in Pedagogue.
              </p>
              <div className="cur-table-wrap">
                <table className="cur-table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Major Scale</th>
                      <th>Diatonic 7ths</th>
                      <th>ii–V–I</th>
                      <th>Gospel I–IV–I</th>
                      <th>Neo Soul</th>
                    </tr>
                  </thead>
                  <tbody>
                    {APPENDIX_12_KEYS.map(row => {
                      const cols: {
                        id: string;
                        text: string;
                        drill: DrillPreset;
                      }[] = [
                        {
                          id: 'scale',
                          text: row.scaleNotes,
                          drill: {
                            label: `${row.key} Major`,
                            ug: 'scale',
                            focus: 'chosen',
                            key: row.key,
                            mode: 'Ionian',
                            scrange: '2',
                            schands: 'parallel',
                          },
                        },
                        {
                          id: 'd7',
                          text: row.diatonic7ths,
                          drill: {
                            label: `${row.key} Diatonic 7ths`,
                            ug: 'chord',
                            focus: 't4only',
                            inmode: true,
                            key: row.key,
                            mode: 'Ionian',
                            order: 'ord',
                          },
                        },
                        {
                          id: 'iivi',
                          text: row.iiVI,
                          drill: {
                            label: `${row.key} ii–V–I`,
                            ug: 'prog',
                            focus: 'adv',
                            key: row.key,
                            vlead: true,
                          },
                        },
                        {
                          id: 'gospel',
                          text: row.gospel,
                          drill: {
                            label: `${row.key} Gospel I–IV–I`,
                            ug: 'harm',
                            focus: 'c_plag',
                            key: row.key,
                          },
                        },
                        {
                          id: 'neo',
                          text: row.neoSoul,
                          drill: {
                            label: `${row.key} Neo Soul`,
                            ug: 'chord',
                            focus: 'v_rootless',
                            inmode: true,
                            key: row.key,
                            mode: 'Ionian',
                            sound: 'rhodes',
                            order: 'ord',
                          },
                        },
                      ];
                      return (
                        <tr key={row.key}>
                          <td>
                            <strong>{row.key}</strong>
                          </td>
                          {cols.map(col => {
                            const cid = `k12-${row.key}-${col.id}`;
                            const done = !!checks[cid];
                            return (
                              <td key={col.id} className={done ? 'done' : ''}>
                                <div className="cur-cell">
                                  <button
                                    type="button"
                                    className={`s cur-cell-chk ${done ? 'on' : ''}`}
                                    onClick={() => toggleCheck(cid)}
                                    title={col.text}
                                  >
                                    <Check size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    className="cur-cell-play"
                                    onClick={() => launch(col.drill)}
                                    title={`Practice ${col.drill.label}`}
                                  >
                                    <Play size={11} />
                                  </button>
                                  <span className="cur-cell-txt">
                                    {col.text}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'reference' && (
            <div className="cur-stack">
              <div className="cur-box">
                <h3>Self-Assessment Rubric (1–5)</h3>
                <div className="cur-rubric">
                  {RUBRIC_SKILLS.map(sk => (
                    <div key={sk.id} className="cur-rubric-row">
                      <div>
                        <strong>{sk.name}</strong>
                        <small>{sk.target}</small>
                      </div>
                      <div className="cur-stars">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            type="button"
                            className={`s cur-star ${(rubric[sk.id] || 0) === n ? 'on' : ''}`}
                            onClick={() =>
                              setRubric(prev => ({...prev, [sk.id]: n}))
                            }
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cur-box">
                <h3>Style Switching Map</h3>
                <div className="cur-table-wrap">
                  <table className="cur-table">
                    <thead>
                      <tr>
                        <th>Style</th>
                        <th>Tempo</th>
                        <th>Feel</th>
                        <th>Left Hand</th>
                        <th>Right Hand</th>
                        <th>Harmony</th>
                        <th>Sound</th>
                      </tr>
                    </thead>
                    <tbody>
                      {STYLE_SWITCH_MAP.map(r => (
                        <tr key={r.style}>
                          <td>
                            <strong>{r.style}</strong>
                          </td>
                          <td>{r.tempo}</td>
                          <td>{r.feel}</td>
                          <td>{r.lh}</td>
                          <td>{r.rh}</td>
                          <td>{r.harmony}</td>
                          <td>{r.sound}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="cur-grid-2">
                <div className="cur-box">
                  <h3>Weekly Focus Rotation</h3>
                  {WEEKLY_ROUTINE.map(w => (
                    <div key={w.day} className="ir">
                      <span>{w.day}</span>
                      <b>{w.focus}</b>
                    </div>
                  ))}
                  <h4 style={{marginTop: 14}}>Equipment &amp; Posture Rules</h4>
                  <ul className="cur-ul">
                    {EQUIPMENT_POSTURE.map(p => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>

                <div className="cur-box">
                  <h3>Troubleshooting &amp; Glossary</h3>
                  {TROUBLESHOOTING.map(t => (
                    <div key={t.problem} className="cur-trouble">
                      <strong>{t.problem}</strong> ({t.cause}) → {t.fix}
                    </div>
                  ))}
                  <h4 style={{marginTop: 14}}>Key Terms</h4>
                  {GLOSSARY.map(([k, v]) => (
                    <div key={k} className="cur-trouble">
                      <strong>{k}:</strong> {v}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
