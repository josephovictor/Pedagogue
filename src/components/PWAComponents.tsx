import React, {useState} from 'react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import {usePWAInstall} from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="s flex items-center gap-2 !py-1.5 !px-3 !text-sm !rounded-full"
        title="Install Pedagogue for offline use"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>Install offline</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="s !py-1.5 !px-3 !text-sm !rounded-full"
        >
          Install offline
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-[#26262a] bg-[#0c0c0d] p-6 text-[#f5f5f3] shadow-xl">
              <h3 className="text-xl font-bold">Install Pedagogue Offline</h3>
              <p className="mt-2 text-base text-[#9a9a96]">
                1. Tap the <strong className="text-[#f5f5f3]">Share</strong>{' '}
                button in Safari.
                <br />
                2. Tap{' '}
                <strong className="text-[#f5f5f3]">Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-[#26262a] bg-[#0c0c0d] px-3 py-1.5 text-sm text-[#f5f5f3] shadow-lg">
      <span className="h-2 w-2 rounded-full bg-[#2fb36d]" />
      Offline mode ready
    </div>
  );
};
