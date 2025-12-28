'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import curriculum from '../data/curriculum.json';

export default function Home() {
  const [progress, setProgress] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Load data
    const saved = localStorage.getItem('czech-app-progress-v2');
    if (saved) {
      setProgress(JSON.parse(saved));
    }
    setIsLoaded(true);

    // Splash Timer
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Determine User's Current Level based on Challenge Completion
  // Level 1 is always unlocked. Level N is unlocked if Challenge N-1 is complete.
  const isLevelUnlocked = (lvlNum) => {
    if (lvlNum === 1) return true;
    return progress?.challenges?.[lvlNum - 1] === true;
  };

  const isLevelCompleted = (lvlNum) => {
    return progress?.challenges?.[lvlNum] === true;
  };

  if (showSplash || !isLoaded) {
    return (
      <div className="min-h-screen bg-brand-blue flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
        <div className="relative w-48 h-48 mb-6 animate-bounce">
          {/* Using the icon directly as an image */}
          <img src="/icons/icon-v3-192.png" alt="Czech Patterns Logo" className="w-full h-full object-contain rounded-3xl shadow-2xl" />
        </div>
        <h1 className="text-4xl font-bold text-white tracking-widest uppercase">Czech Patterns</h1>
        <p className="text-brand-teal text-opacity-80 mt-2 font-medium">Speak from Day One</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center p-6">

      {/* Header */}
      <header className="mb-10 text-center space-y-2">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Czech Patterns</h1>
        <p className="text-brand-teal font-medium">Speak from Day One.</p>
      </header>

      {/* Roadmap Container */}
      <div className="w-full max-w-md flex flex-col gap-6 relative">

        {/* Vertical Connecting Line */}
        <div className="absolute left-8 top-8 bottom-8 w-1 bg-gray-200 -z-10"></div>

        {/* Level Nodes */}
        {Object.entries(curriculum).map(([key, lvl]) => {
          const levelNum = parseInt(key.replace('level_', ''));
          const unlocked = isLevelUnlocked(levelNum);
          const completed = isLevelCompleted(levelNum);

          return (
            <div key={key} className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${unlocked
              ? 'bg-white border-brand-blue shadow-sm'
              : 'bg-gray-100 border-gray-200 opacity-75'
              }`}>
              {/* Status Icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 text-sm font-bold bg-white z-10 ${completed ? 'border-green-500 text-green-500' :
                unlocked ? 'border-brand-blue text-brand-blue animate-pulse' :
                  'border-gray-300 text-gray-400'
                }`}>
                {completed ? '✓' : levelNum}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h3 className={`font-bold ${unlocked ? 'text-gray-900' : 'text-gray-400'}`}>
                    Level {levelNum}: {lvl.title}
                  </h3>
                  {completed && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">MASTERED</span>}
                </div>
                <p className="text-xs text-gray-500 mb-3">{lvl.goal}</p>

                {/* Action Button */}
                {unlocked ? (
                  <Link
                    href="/learn"
                    className={`inline-block px-4 py-2 rounded-lg text-sm font-bold transition-colors ${completed
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-brand-blue text-white hover:bg-opacity-90 shadow-md'
                      }`}
                  >
                    {completed ? "Review" : "Continue Path"}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                    🔒 Complete Level {levelNum - 1} to unlock
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Coming Soon Teaser */}
        <div className="flex items-start gap-4 p-4 opacity-50">
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 bg-white z-10"></div>
          <p className="text-sm text-gray-400 font-medium pt-1">More levels coming soon...</p>
        </div>

      </div>
    </main>
  );
}
