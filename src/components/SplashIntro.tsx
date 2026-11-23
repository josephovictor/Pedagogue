import {useEffect, useState} from 'react';

interface SplashIntroProps {
  onComplete: () => void;
}

export function SplashIntro({onComplete}: SplashIntroProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const fadeMs = reduced ? 160 : 1650;
    const endMs = reduced ? 320 : 2100;

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

  return (
    <div
      className={`splash-intro ${exiting ? 'is-exiting' : ''}`}
      role="status"
      aria-label="Pedagogue opening animation"
      onClick={handleSkip}
    >
      <div className="splash-center">
        <div className="splash-logo-frame">
          <img
            src="/pedagogue-logo.png"
            alt="Pedagogue"
            className="splash-logo"
          />
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
