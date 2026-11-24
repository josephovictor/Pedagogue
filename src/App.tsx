import {BookOpen, Clock, Hourglass} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {
  CurriculumModal,
  loadCurriculumProgress,
} from './components/CurriculumModal';
import {OfflineIndicator, PWAInstallButton} from './components/PWAComponents';
import {SplashIntro} from './components/SplashIntro';
import type {DrillPreset} from './pedagogue/curriculumData';
import {
  initPedagogue,
  type PedagogueController,
  type PracticeScoreSnapshot,
} from './pedagogue/initPedagogue';

type AppView = 'home' | 'learn' | 'practice';

export default function App() {
  const controllerRef = useRef<PedagogueController | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [view, setView] = useState<AppView>('home');
  const [curOpen, setCurOpen] = useState(false);
  const [scoreSnap, setScoreSnap] = useState<PracticeScoreSnapshot>({
    ok: 0,
    tot: 0,
    str: 0,
    best: 0,
    gameLabel: 'Chords',
  });
  const [resetModalSnap, setResetModalSnap] =
    useState<PracticeScoreSnapshot | null>(null);

  const curStats = useMemo(() => loadCurriculumProgress(), [view, curOpen]);

  const enterLearn = (preset?: DrillPreset) => {
    setView('learn');
    window.requestAnimationFrame(() => {
      controllerRef.current?.setStudyMode('teach', preset);
      controllerRef.current?.refreshLayout();
    });
  };

  const enterPractice = (preset?: DrillPreset) => {
    setView('practice');
    window.requestAnimationFrame(() => {
      controllerRef.current?.setStudyMode('practice', preset);
      controllerRef.current?.refreshLayout();
    });
  };

  useEffect(() => {
    const ctrl = initPedagogue({
      onRequestResetScore: snap => setResetModalSnap(snap),
      onScoreChange: snap => setScoreSnap(snap),
      onMoveToPractice: () => enterPractice(),
    });
    controllerRef.current = ctrl;
    return () => {
      controllerRef.current = null;
      ctrl.destroy();
    };
  }, []);

  useEffect(() => {
    document.body.dataset.view = showIntro ? 'intro' : view;
    document.body.dataset.study = view === 'learn' ? 'teach' : 'practice';
  }, [showIntro, view]);

  useEffect(() => {
    if (resetModalSnap || curOpen) {
      document.body.dataset.modal = 'open';
    } else {
      delete document.body.dataset.modal;
    }
  }, [resetModalSnap, curOpen]);

  useEffect(() => {
    if (!resetModalSnap) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setResetModalSnap(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resetModalSnap]);

  const confirmResetScore = () => {
    controllerRef.current?.resetScore();
    setResetModalSnap(null);
  };

  const showWorkspace = !showIntro && (view === 'learn' || view === 'practice');

  return (
    <>
      {showIntro && <SplashIntro onComplete={() => setShowIntro(false)} />}

      <header className="top">
        <button
          id="gear"
          className="ic"
          hidden={!showWorkspace}
          aria-label="Show or hide settings"
          title="Hide settings"
        >
          <svg
            width="26"
            height="22"
            viewBox="0 0 28 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <rect x="2" y="3" width="24" height="18" rx="5" />
            <line x1="8.5" y1="9" x2="8.5" y2="15" />
          </svg>
        </button>

        <button
          type="button"
          className="logo-btn"
          onClick={() => setView('home')}
          title="Return to Learn / Practice home"
          aria-label="Pedagogue Home"
        >
          <img className="logo" alt="Pedagogue" src="/pedagogue-logo.png" />
        </button>

        <nav className="mode-nav" aria-label="Workspace mode">
          <button
            type="button"
            className={`mode-nav-btn ${view === 'home' ? 'on' : ''}`}
            onClick={() => setView('home')}
          >
            Home
          </button>
          <button
            type="button"
            className={`mode-nav-btn ${view === 'learn' ? 'on' : ''}`}
            onClick={() => enterLearn()}
          >
            Learn
          </button>
          <button
            type="button"
            className={`mode-nav-btn ${view === 'practice' ? 'on' : ''}`}
            onClick={() => enterPractice()}
          >
            Practice
          </button>
        </nav>

        {view === 'learn' && !showIntro && (
          <button
            type="button"
            className="s cur-open-btn"
            onClick={() => setCurOpen(true)}
            title="Open 52-Week Contemporary Piano Curriculum"
          >
            <BookOpen size={15} />
            <span>
              Curriculum ({curStats.done}/{curStats.total})
            </span>
          </button>
        )}

        <PWAInstallButton />
        <span id="midi" className="chip">
          Looking for MIDI…
        </span>
      </header>

      {!showIntro && view === 'home' && (
        <main className="home-stage">
          <div className="home-inner">
            <div className="home-intro">
              <h1 className="home-title">Select a workspace</h1>
            </div>

            <div className="home-cards">
              <article className="home-card home-card-learn">
                <h2 className="home-card-h2">Learn</h2>
                <p className="home-card-desc">
                  Guided study with open details, lit keyboard diagrams, audio
                  playback, and the 52-week curriculum.
                </p>
                <p className="home-card-tags">
                  Open details · 52-week curriculum · Untimed
                </p>

                <div className="home-card-foot">
                  <span className="home-card-meta">
                    {curStats.done}/{curStats.total} topics studied
                  </span>
                  <button
                    type="button"
                    className="home-cta"
                    onClick={() => enterLearn()}
                  >
                    Open Learn
                  </button>
                </div>
              </article>

              <article className="home-card home-card-practice">
                <h2 className="home-card-h2">Practice</h2>
                <p className="home-card-desc">
                  Hidden-answer recall across chords, scales, intervals,
                  progressions, harmony, and ear training.
                </p>
                <p className="home-card-tags">
                  Timed or untimed · Voice leading &amp; fingering
                </p>

                <div className="home-card-foot">
                  <span className="home-card-meta">
                    {scoreSnap.tot > 0
                      ? `${scoreSnap.ok}/${scoreSnap.tot} · Best streak ${scoreSnap.best}`
                      : 'MIDI & keyboard ready'}
                  </span>
                  <button
                    type="button"
                    className="home-cta"
                    onClick={() => enterPractice()}
                  >
                    Open Practice
                  </button>
                </div>
              </article>
            </div>
          </div>
        </main>
      )}

      <div
        className={`app ${!showWorkspace ? 'app-view-hidden' : ''}`}
        id="app"
        aria-hidden={!showWorkspace}
      >
        <section className="practice-col">
          <div className="card practice-card">
            <div className="prompt-top">
              <div className="adv-wrap time-wrap" id="timewrap">
                <button
                  type="button"
                  id="timebtn"
                  className="s adv-btn time-btn"
                  aria-haspopup="true"
                  aria-expanded="false"
                  title="Choose Untimed practice or Timed activity with a countdown over the keyboard"
                >
                  <Hourglass size={14} />
                  <span id="timelbl">Untimed</span>
                </button>
                <div className="adv-pop time-pop" id="timepop" hidden>
                  <div className="adv-title">Activity timing</div>
                  <div
                    className="adv-seg"
                    role="group"
                    aria-label="Practice timing mode"
                  >
                    <button
                      type="button"
                      data-timemode="untimed"
                      className="active"
                    >
                      Untimed practice
                    </button>
                    <button type="button" data-timemode="timed">
                      Timed activity
                    </button>
                  </div>
                  <div className="adv-sec" id="timesecwrap">
                    <div className="adv-sec-head">
                      <span>Play within</span>
                      <strong id="timeseclbl">5s</strong>
                    </div>
                    <div className="adv-presets" id="timepresets">
                      <button type="button" data-tsec="3">
                        3s
                      </button>
                      <button type="button" data-tsec="5">
                        5s
                      </button>
                      <button type="button" data-tsec="8">
                        8s
                      </button>
                      <button type="button" data-tsec="10">
                        10s
                      </button>
                      <button type="button" data-tsec="15">
                        15s
                      </button>
                      <button type="button" data-tsec="20">
                        20s
                      </button>
                    </div>
                    <div className="adv-custom">
                      <button
                        type="button"
                        className="s adv-step"
                        id="timeminus"
                        aria-label="Decrease time limit"
                      >
                        −
                      </button>
                      <input
                        id="timesec"
                        type="number"
                        min="1"
                        max="60"
                        step="1"
                        defaultValue="5"
                        aria-label="Seconds to play keys"
                      />
                      <span className="adv-unit">sec</span>
                      <button
                        type="button"
                        className="s adv-step"
                        id="timeplus"
                        aria-label="Increase time limit"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="adv-hint" id="timehint"></p>
                </div>
              </div>
              <div id="qtop"></div>
              <div className="adv-wrap" id="advwrap">
                <button
                  type="button"
                  id="advbtn"
                  className="s adv-btn"
                  aria-haspopup="true"
                  aria-expanded="false"
                  title="Set how long the result stays visible, or switch to manual Next / Enter"
                >
                  <Clock size={14} />
                  <span id="advlbl">Auto · 2s</span>
                </button>
                <div className="adv-pop" id="advpop" hidden>
                  <div className="adv-title">After result</div>
                  <div
                    className="adv-seg"
                    role="group"
                    aria-label="Next chord advance mode"
                  >
                    <button
                      type="button"
                      data-advmode="timed"
                      className="active"
                    >
                      Timed
                    </button>
                    <button type="button" data-advmode="manual">
                      Manual (Next / Enter)
                    </button>
                  </div>
                  <div className="adv-sec" id="advsecwrap">
                    <div className="adv-sec-head">
                      <span>Show result for</span>
                      <strong id="advseclbl">2s</strong>
                    </div>
                    <div className="adv-presets" id="advpresets">
                      <button type="button" data-sec="1">
                        1s
                      </button>
                      <button type="button" data-sec="1.5">
                        1.5s
                      </button>
                      <button type="button" data-sec="2">
                        2s
                      </button>
                      <button type="button" data-sec="3">
                        3s
                      </button>
                      <button type="button" data-sec="5">
                        5s
                      </button>
                      <button type="button" data-sec="8">
                        8s
                      </button>
                    </div>
                    <div className="adv-custom">
                      <button
                        type="button"
                        className="s adv-step"
                        id="advminus"
                        aria-label="Decrease seconds"
                      >
                        −
                      </button>
                      <input
                        id="advsec"
                        type="number"
                        min="0.5"
                        max="30"
                        step="0.5"
                        defaultValue="2"
                        aria-label="Seconds before next chord"
                      />
                      <span className="adv-unit">sec</span>
                      <button
                        type="button"
                        className="s adv-step"
                        id="advplus"
                        aria-label="Increase seconds"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="adv-hint" id="advhint"></p>
                </div>
              </div>
            </div>
            <div className="vl-bar" id="vlbar" hidden>
              <div className="vl-group" role="group" aria-label="Primary root degree">
                <span className="vl-label">Primary degree</span>
                <div className="vl-degs" id="vldeg">
                  {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'].map((rom, idx) => (
                    <button
                      key={rom}
                      type="button"
                      className={`s vl-deg-btn${idx === 0 ? ' on' : ''}`}
                      data-deg={idx}
                    >
                      {rom}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="s vl-lock-btn"
                id="vllock"
                aria-pressed="false"
                title="Lock or unlock usable keyboard range around the primary chord"
              >
                Range: Unlocked
              </button>
              <div
                className="vl-group"
                id="vldirgroup"
                role="group"
                aria-label="Voice leading direction"
              >
                <span className="vl-label">Direction</span>
                <div className="vl-degs" id="vldir">
                  <button
                    type="button"
                    className="s vl-dir-btn on"
                    data-vldir="auto"
                    title="Auto direction: choose smaller total movement"
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className="s vl-dir-btn"
                    data-vldir="up"
                    title="Move up the scale"
                  >
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    className="s vl-dir-btn"
                    data-vldir="down"
                    title="Move down the scale"
                  >
                    ↓ Down
                  </button>
                </div>
              </div>
              <div
                className="vl-group"
                id="vl7group"
                role="group"
                aria-label="Seventh chord voicing"
              >
                <span className="vl-label">7ths</span>
                <div className="vl-degs" id="vl7">
                  <button
                    type="button"
                    className="s vl-dir-btn on"
                    data-vl7="full"
                    title="Full 4-note 7th chord"
                  >
                    Full
                  </button>
                  <button
                    type="button"
                    className="s vl-dir-btn"
                    data-vl7="omit5"
                    title="Omit the 5th (3 notes: root, 3rd, 7th)"
                  >
                    Omit 5th
                  </button>
                  <button
                    type="button"
                    className="s vl-dir-btn"
                    data-vl7="auto"
                    title="Use full chord unless a finger adjustment is needed, then compare omit-5th for fewer finger changes"
                  >
                    Auto
                  </button>
                </div>
              </div>
            </div>
            <div className="vl-bar" id="scbar" hidden>
              <div
                className="vl-group"
                id="scmodegroup"
                role="group"
                aria-label="Answer mode"
              >
                <span className="vl-label">Answer mode</span>
                <div className="vl-degs" id="scmode">
                  <button
                    type="button"
                    className="s vl-dir-btn on"
                    data-scmode="play"
                    title="Play the matching answer directly on MIDI or keyboard"
                  >
                    Play on keyboard
                  </button>
                  <button
                    type="button"
                    className="s vl-dir-btn"
                    data-scmode="quiz"
                    title="Choose from multiple-choice options"
                  >
                    Multiple choice
                  </button>
                </div>
              </div>
              <div
                className="vl-group"
                id="scdiffgroup"
                role="group"
                aria-label="Chord-to-scale difficulty"
              >
                <span className="vl-label">Difficulty</span>
                <div className="vl-degs" id="scdiff">
                  <button
                    type="button"
                    className="s vl-dir-btn on"
                    data-scdiff="beginner"
                    title="One primary scale per chord quality (maj7, m7, dom7, m7♭5)"
                  >
                    Beginner
                  </button>
                  <button
                    type="button"
                    className="s vl-dir-btn"
                    data-scdiff="advanced"
                    title="Context-dependent scales and multiple valid matches"
                  >
                    Advanced
                  </button>
                </div>
              </div>
            </div>
            <div className="q-stage">
              <div
                className="q-shift q-shift-left"
                id="shiftleft"
                hidden
                aria-live="polite"
              />
              <div className="q-center">
                <div id="q">Press Start</div>
                <div id="sub"></div>
                <div className="vl-meta" id="vlmeta" hidden></div>
                <div className="fg-row" id="fgrow" hidden></div>
              </div>
              <div
                className="q-shift q-shift-right"
                id="shiftright"
                hidden
                aria-live="polite"
              />
            </div>
            <div className="stf-stage" id="stfstage">
              <div className="stat-wing stat-left" id="statleft"></div>
              <div id="stf"></div>
              <div className="stat-wing stat-right" id="statright"></div>
            </div>
            <div className="kb-wrap" id="kbwrap">
              <div id="kbcd" className="kb-cd" hidden>
                <div className="kb-cd-pill">
                  <span id="kbcdtxt">5.0s</span>
                </div>
                <div className="kb-cd-track">
                  <div className="kb-cd-fill" id="kbcdfill" />
                </div>
              </div>
              <div id="kb"></div>
            </div>
            <div id="fb"></div>
            <div id="ans"></div>
            <div className="bar">
              <button id="start">Start</button>
              <button className="s" id="pl">
                Play again
              </button>
              <button className="s" id="fgb">
                Show fingering
              </button>
              <button className="s" id="nx">
                Next
              </button>
              <button className="s" id="rv">
                Show answer
              </button>
              <button id="learn2prac" style={{display: 'none'}}>
                Move to Practice →
              </button>
            </div>
          </div>
          <p className="tip">
            No piano? Keys A W S E D F T G Y H U J K play C4–C5 (Z/X shift
            octave) – for testing only.
          </p>
        </section>

        <aside id="set" className="card panel"></aside>

        <aside id="ip" className="card panel">
          <div className="ih">
            <h3 id="it">Details</h3>
            <button className="ic" id="ix" aria-label="Close details">
              <svg
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </svg>
            </button>
          </div>
          <div id="ib"></div>
        </aside>
      </div>

      <div id="bd" hidden={!showWorkspace}></div>

      <CurriculumModal
        open={curOpen}
        onClose={() => setCurOpen(false)}
        onStudyInClass={preset => enterLearn(preset)}
        onLaunchPractice={preset => enterPractice(preset)}
      />

      {resetModalSnap && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          onClick={e => {
            if (e.target === e.currentTarget) setResetModalSnap(null);
          }}
        >
          <div className="card confirm-dialog">
            <div className="confirm-head">
              <div>
                <h2 id="reset-modal-title">Reset practice session?</h2>
                <p className="confirm-sub">{resetModalSnap.gameLabel}</p>
              </div>
            </div>

            <p className="confirm-body">
              {resetModalSnap.tot > 0
                ? `This will clear your current session score (${resetModalSnap.ok}/${resetModalSnap.tot} correct · Streak ${resetModalSnap.str} · Best ${resetModalSnap.best}) and start a fresh round in the current drill.`
                : 'This will restart the current drill from step 1 and reset your voice-leading anchor.'}
            </p>

            <div className="confirm-actions">
              <button
                type="button"
                className="s"
                onClick={() => setResetModalSnap(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-danger"
                onClick={confirmResetScore}
              >
                Reset score
              </button>
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />
    </>
  );
}
