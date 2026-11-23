import {useEffect, useState} from 'react';

interface SplashIntroProps {
  onComplete: () => void;
}

const WORD_LETTERS = 'Pedagogue'.split('');
const CENTER_INDEX = Math.floor(WORD_LETTERS.length / 2); // 'g' at index 4

export function SplashIntro({onComplete}: SplashIntroProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const fadeMs = reduced ? 220 : 3100;
    const endMs = reduced ? 380 : 3550;

    const tFade = window.setTimeout(() => setExiting(true), fadeMs);
    const tEnd = window.setTimeout(() => onComplete(), endMs);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setExiting(true);
        window.setTimeout(onComplete, 220);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(tFade);
      window.clearTimeout(tEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, [onComplete]);

  const handleSkip = () => {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(onComplete, 220);
  };

  // Wave rollout from center outward:
  // Wave 0: middle 'g' (idx 4)
  // Wave 1: 1 letter L & R ('a' idx 3, 'o' idx 5)
  // Wave 2: 2 letters L & R ('e','d' idx 1,2 & 'g','u' idx 6,7)
  // Wave 3: outer 'P' (idx 0) & 'e' (idx 8)
  const waveForIndex = (idx: number) => {
    const dist = Math.abs(idx - CENTER_INDEX);
    if (dist === 0) return 0;
    if (dist === 1) return 1;
    if (dist <= 3) return 2;
    return 3;
  };

  return (
    <div
      className={`splash-intro ${exiting ? 'is-exiting' : ''}`}
      role="status"
      aria-label="Pedagogue opening animation"
      onClick={handleSkip}
    >
      <div className="splash-stage">
        <div className="splash-favicon-shell" aria-hidden="true" />
        <div className="splash-lockup">
          <svg
            className="splash-brace splash-brace-l"
            viewBox="0 0 110 380"
            aria-hidden="true"
          >
            <path
              d="M104 12 C66 16 44 40 44 82 L44 140 C44 166 28 182 0 190 C28 198 44 214 44 240 L44 298 C44 340 66 364 104 368 L104 350 C80 344 74 326 74 294 L74 236 C74 210 58 196 32 190 C58 184 74 170 74 144 L74 86 C74 54 80 36 104 30 Z"
              fill="currentColor"
            />
          </svg>

          <span className="splash-word" aria-label="Pedagogue">
            {WORD_LETTERS.map((ch, idx) => {
              const wave = waveForIndex(idx);
              return (
                <span
                  key={`${ch}-${idx}`}
                  className="splash-ch"
                  style={{['--w' as string]: wave}}
                >
                  {ch}
                </span>
              );
            })}
          </span>

          <svg
            className="splash-brace splash-brace-r"
            viewBox="0 0 110 380"
            aria-hidden="true"
          >
            <path
              d="M6 12 C44 16 66 40 66 82 L66 140 C66 166 82 182 110 190 C82 198 66 214 66 240 L66 298 C66 340 44 364 6 368 L6 350 C30 344 36 326 36 294 L36 236 C36 210 52 196 78 190 C52 184 36 170 36 144 L36 86 C36 54 30 36 6 30 Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>

      <button
        type="button"
        className="splash-skip"
        onClick={e => {
          e.stopPropagation();
          handleSkip();
        }}
      >
        Skip
      </button>
    </div>
  );
}
