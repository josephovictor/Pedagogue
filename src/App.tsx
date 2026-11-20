import {BookOpen, Clock, Hourglass} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {CurriculumModal} from './components/CurriculumModal';
import {OfflineIndicator, PWAInstallButton} from './components/PWAComponents';
import {initPedagogue, type PedagogueController} from './pedagogue/initPedagogue';

export default function App() {
  const controllerRef = useRef<PedagogueController | null>(null);
  const [curOpen, setCurOpen] = useState(false);

  useEffect(() => {
    const ctrl = initPedagogue();
    controllerRef.current = ctrl;
    return () => {
      controllerRef.current = null;
      ctrl.destroy();
    };
  }, []);

  return (
    <>
      <header className="top">
        <button
          id="gear"
          className="ic"
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
        <img
          className="logo"
          alt="Pedagogue"
          src="/pedagogue-logo.png"
        />
        <button
          type="button"
          className="s cur-open-btn"
          onClick={() => setCurOpen(true)}
          title="Open 52-Week Contemporary Piano Curriculum"
        >
          <BookOpen size={15} />
          <span>Curriculum</span>
        </button>
        <PWAInstallButton />
        <span id="midi" className="chip">
          Looking for MIDI…
        </span>
      </header>

      <div className="app" id="app">
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
            <div id="q">Press Start</div>
            <div id="sub"></div>
            <div className="stf-stage" id="stfstage">
              <div className="stat-wing stat-left" id="statleft"></div>
              <div id="stf"></div>
              <div className="stat-wing stat-right" id="statright"></div>
            </div>
            <div className="kb-wrap" id="kbwrap">
              <div id="kbcd" className="kb-cd" hidden>
                <div className="kb-cd-pill">
                  <span className="kb-cd-dot" />
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
            <button
              className="ic"
              id="ix"
              aria-label="Close details"
            >
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
      <div id="bd"></div>
      <CurriculumModal
        open={curOpen}
        onClose={() => setCurOpen(false)}
        onLaunchDrill={preset => controllerRef.current?.applyDrill(preset)}
      />
      <OfflineIndicator />
    </>
  );
}
