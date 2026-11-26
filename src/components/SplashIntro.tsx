import {useEffect, useRef, useState} from 'react';

interface SplashIntroProps {
  onComplete: () => void;
}

export function SplashIntro({onComplete}: SplashIntroProps) {
  const [exiting, setExiting] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const completedRef = useRef(false);
  const skipTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const finish = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onCompleteRef.current();
    };

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const fadeMs = reduced ? 160 : 1650;
    const endMs = reduced ? 320 : 2100;

    const tFade = window.setTimeout(() => setExiting(true), fadeMs);
    const tEnd = window.setTimeout(finish, endMs);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setExiting(true);
        if (skipTimerRef.current != null) window.clearTimeout(skipTimerRef.current);
        skipTimerRef.current = window.setTimeout(finish, 220);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(tFade);
      window.clearTimeout(tEnd);
      if (skipTimerRef.current != null) window.clearTimeout(skipTimerRef.current);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleSkip = () => {
    if (exiting || completedRef.current) return;
    setExiting(true);
    if (skipTimerRef.current != null) window.clearTimeout(skipTimerRef.current);
    skipTimerRef.current = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onCompleteRef.current();
    }, 220);
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
