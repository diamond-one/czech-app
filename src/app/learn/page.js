'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Flashcard from '../../components/Flashcard';
import FrameCard from '../../components/FrameCard';
import OnboardingModal from '../../components/OnboardingModal';
import FastTrackModal from '../../components/FastTrackModal';
import { calculateNextReview } from '../../utils/srs';
import curriculum from '../../data/curriculum.json';

export default function LearnPage() {
    const [queue, setQueue] = useState([]);
    const [currentCard, setCurrentCard] = useState(null);
    // Progress Schema: { itemId: { interval, ease, nextReviewDate, spokenCount, isUsable } }
    const [progress, setProgress] = useState({});
    const [isLoaded, setIsLoaded] = useState(false);

    // Adaptive Session State
    const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
    const [unlockEligible, setUnlockEligible] = useState(null); // null, 'eligible', or 'ineligible'
    const [unlockReason, setUnlockReason] = useState("");
    const [hasCheckedUnlock, setHasCheckedUnlock] = useState(false);

    // Computed state
    const [userLevel, setUserLevel] = useState(1);
    const [levelStats, setLevelStats] = useState({
        phrasesMastered: 0,
        totalPhrases: 0,
        framesUsable: 0,
        totalFrames: 0
    });
    const [isPracticeMode, setIsPracticeMode] = useState(false);

    // UI Settings
    const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
    const [autoRecord, setAutoRecord] = useState(false); // Default false for safety

    // Retention State
    const [streak, setStreak] = useState(0);
    const [nextReviewTime, setNextReviewTime] = useState(null);
    const [showFastTrack, setShowFastTrack] = useState(false);

    // Load progress & streak from localStorage
    useEffect(() => {
        const savedProgress = localStorage.getItem('czech-app-progress-v2');
        if (savedProgress) {
            setProgress(JSON.parse(savedProgress));
        }

        // Streak Logic: Check/Reset on load
        const streakData = JSON.parse(localStorage.getItem('czech-app-streak') || '{"count": 0, "lastDate": ""}');
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        if (streakData.lastDate === today) {
            setStreak(streakData.count);
        } else if (streakData.lastDate === yesterday) {
            setStreak(streakData.count); // Pending increment today
        } else {
            setStreak(0); // Broken streak
        }

        setIsLoaded(true);
    }, []);

    // Save progress helper
    const saveProgress = (newProgress) => {
        setProgress(newProgress);
        localStorage.setItem('czech-app-progress-v2', JSON.stringify(newProgress));
    };

    // Main Engine: Calculate Level & Queue
    useEffect(() => {
        if (!isLoaded) return;
        if (isPracticeMode) return;
        if (queue.length > 0) return; // Prevent queue rebuild if we have active cards (Fixes onboarding wipe)

        let calculatedLevel = 1;
        let stats = { phrasesMastered: 0, totalPhrases: 0, framesUsable: 0, totalFrames: 0 };

        // 1. Determine Level Logic
        // We assume levels are sequential: level_1, level_2... 
        // For MVP we only have level_1 in curriculum, so max logic applies.

        const levelKeys = Object.keys(curriculum);

        for (const levelKey of levelKeys) {
            const lvlData = curriculum[levelKey];
            const levelNum = parseInt(levelKey.replace('level_', ''));

            // Calculate Mastery for this level
            const phrases = lvlData.phrases;
            const frames = lvlData.frames;

            const masteredPhrases = phrases.filter(p => {
                const prog = progress[p.id];
                // Mastery: Interval > 3days AND Spoken >= 3 (AND Ease 'Easy' checked implicitly by interval somewhat, but directive says "rated easy once". Let's stick to simple first: Interval > 3 + Spoken > 3)
                return prog && prog.interval > 3 && (prog.spokenCount || 0) >= 3;
            });

            const usableFrames = frames.filter(f => {
                const prog = progress[f.id];
                return prog && prog.isUsable;
            });

            // Update stats if this is our current calc level
            if (levelNum === calculatedLevel) {
                // Granular Spoken Progress
                const currentSpokenSum = phrases.reduce((sum, p) => {
                    const prog = progress[p.id];
                    const count = prog ? (prog.spokenCount || 0) : 0;
                    return sum + Math.min(count, 3);
                }, 0);
                const totalSpokenTarget = phrases.length * 3;

                stats = {
                    phrasesMastered: masteredPhrases.length,
                    totalPhrases: phrases.length,
                    // New Granular Stats
                    spokenCurrent: currentSpokenSum,
                    spokenTarget: totalSpokenTarget,
                    framesUsable: usableFrames.length,
                    totalFrames: frames.length
                };

                // Unlock Check
                // Unlock Check
                const phrasePct = phrases.length > 0 ? masteredPhrases.length / phrases.length : 1;
                const framePct = frames.length > 0 ? usableFrames.length / frames.length : 1;

                const challengePassed = progress.challenges && progress.challenges[levelNum];

                if (phrasePct >= 0.0 && framePct >= 0.0) {
                    if (challengePassed) {
                        calculatedLevel = levelNum + 1;
                    } else {
                        stats.readyForChallenge = true;
                        break;
                    }
                } else {
                    break; // Stuck at this level
                }
            }
        }

        // Cap level (if we exceeded known content)
        if (!curriculum[`level_${calculatedLevel}`]) {
            calculatedLevel -= 1; // Stay at max
        }

        setUserLevel(calculatedLevel);
        setLevelStats(stats);

        // 2. Build Queue
        // Strategy: Due items from all unlocked levels + New items from CURRENT level only
        const now = new Date();
        let newQueue = [];

        for (const levelKey of levelKeys) {
            const levelNum = parseInt(levelKey.replace('level_', ''));
            if (levelNum > calculatedLevel) break; // Locked

            const lvlData = curriculum[levelKey];
            const items = [...lvlData.phrases, ...lvlData.frames];

            for (const item of items) {
                const prog = progress[item.id];

                // New Item (Only for current level) - BLOCKED BY DEFAULT
                // In Adaptive Mode, we do NOT auto-push new items.
                // We only push DUE items. 
                if (!prog) {
                    // Skip new items initially
                    continue;
                }

                // Existing Item (Check Due)
                if (item.type === 'phrase') {
                    const nextDate = new Date(prog.nextReviewDate);
                    if (nextDate <= now) {
                        newQueue.push(item);
                    }
                } else if (item.type === 'frame') {
                    // Frame Logic: If not usable, keep showing (or daily?). If usable, maybe less valid SRS?
                    // For MVP: Treat as "Review if not usable OR if interval passes"
                    // Let's rely on standard SRS for frames too to keep them fresh.
                    const nextDate = new Date(prog.nextReviewDate || 0); // Default to now if missing
                    if (nextDate <= now) {
                        newQueue.push(item);
                    }
                }
            }
        }

        // onBoarding check: If progress is empty, auto-inject first 5 items
        const isFreshUser = Object.keys(progress).length === 0;

        if (isFreshUser && newQueue.length === 0) {
            const lvl1 = curriculum['level_1'];
            const allItems = [...lvl1.phrases, ...lvl1.frames];
            // Take first 5
            for (let i = 0; i < 5 && i < allItems.length; i++) {
                newQueue.push(allItems[i]);
            }
        }

        // Randomize queue slightly to mix phrases/frames?
        // Prioritize: Phrases first? 
        // Let's just keep standard order but randomly sort ensures variety
        // newQueue.sort(() => Math.random() - 0.5); 

        setQueue(newQueue);

    }, [isLoaded, progress, isPracticeMode]);

    // Set current card & Calculate Next Review / Unlock Status
    useEffect(() => {
        if (queue.length > 0 && !currentCard) {
            setCurrentCard(queue[0]);
        } else if (queue.length === 0) {
            setCurrentCard(null);
            if (isPracticeMode) setIsPracticeMode(false);

            // --- ADAPTIVE UNLOCK CHECK (Redesigned) ---
            if (!hasCheckedUnlock && !isPracticeMode) {
                // REMOVED THROTTLING: Always allow unlocking new items
                setUnlockEligible('eligible');
                setHasCheckedUnlock(true);
            }

            // Calculate next review time
            const now = new Date();
            let earliest = null;
            Object.values(progress).forEach(p => {
                if (p.nextReviewDate) {
                    const date = new Date(p.nextReviewDate);
                    if (date > now) {
                        if (!earliest || date < earliest) earliest = date;
                    }
                }
            });
            setNextReviewTime(earliest);
        }
    }, [queue, currentCard, isPracticeMode, progress, sessionStats, hasCheckedUnlock]);


    // --- HANDLERS ---

    const handleRecording = () => {
        if (!currentCard) return;
        const cardId = currentCard.id;

        // --- STREAK UPDATE ---
        const today = new Date().toDateString();
        const streakData = JSON.parse(localStorage.getItem('czech-app-streak') || '{"count": 0, "lastDate": ""}');

        if (streakData.lastDate !== today) {
            // First action of the day!
            const newCount = (streakData.lastDate === new Date(Date.now() - 86400000).toDateString())
                ? streakData.count + 1
                : 1;

            setStreak(newCount);
            localStorage.setItem('czech-app-streak', JSON.stringify({ count: newCount, lastDate: today }));
        }
        // ---------------------

        const prev = progress[cardId] || { interval: 0, ease: 2.5, spokenCount: 0 };

        const newStats = {
            ...prev,
            spokenCount: (prev.spokenCount || 0) + 1
        };
        const newProgress = { ...progress, [cardId]: newStats };
        saveProgress(newProgress);
    };

    const handlePhraseRate = (quality) => {
        if (!currentCard) return;
        const cardId = currentCard.id;
        const prev = progress[cardId] || { interval: 0, ease: 2.5, spokenCount: 0 };

        const { interval, ease } = calculateNextReview(quality, prev.interval, prev.ease);

        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + interval);

        const newStats = {
            ...prev,
            interval,
            ease,
            nextReviewDate: nextReviewDate.toISOString()
            // spokenCount is updated in handleRecording now
        };

        const newProgress = { ...progress, [cardId]: newStats };
        saveProgress(newProgress);

        // Track Session Stats
        setSessionStats(prev => ({
            correct: prev.correct + (quality >= 3 ? 1 : 0),
            total: prev.total + 1
        }));

        // Advance Queue
        setQueue(prev => prev.slice(1));
        setCurrentCard(null);
    };

    const handleFrameResult = (success) => {
        if (!currentCard) return;
        const cardId = currentCard.id;
        const prev = progress[cardId] || { interval: 0, ease: 2.5, isUsable: false };

        // Simple logic for Frames: 
        // If success -> Mark usable. Set interval to 3 days to keep it fresh.
        // If fail -> Interval 1 day.

        let interval = success ? 3 : 1;
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + interval);

        const newStats = {
            ...prev,
            interval,
            nextReviewDate: nextReviewDate.toISOString(),
            isUsable: success ? true : prev.isUsable // Keep true if once true? Or require maintenance? Directive says "Usable when successfully produces...". Let's stick with sticky true for now to unlock level, but keep reviewing.
        };

        const newProgress = { ...progress, [cardId]: newStats };
        saveProgress(newProgress);

        setQueue(prev => prev.slice(1));
        setCurrentCard(null);
    };

    const startPractice = () => {
        // Collect all known items
        let practiceItems = [];
        Object.keys(curriculum).forEach(k => {
            const lvl = curriculum[k];
            if (parseInt(k.replace('level_', '')) <= userLevel) {
                practiceItems.push(...lvl.phrases);
                practiceItems.push(...lvl.frames);
            }
        });

        // Shuffle
        practiceItems.sort(() => Math.random() - 0.5);
        setQueue(practiceItems.slice(0, 10));
        setIsPracticeMode(true);
    };

    // Unlock New Items Handler
    const unlockNewItems = () => {
        let newItems = [];
        // Scan curriculum for unlearned items in userLevel
        // Limit to 5 items (Load Control)

        const lvlData = curriculum[`level_${userLevel}`];
        if (lvlData) {
            const allItems = [...lvlData.phrases, ...lvlData.frames];
            for (const item of allItems) {
                if (!progress[item.id] && newItems.length < 5) {
                    newItems.push(item);
                }
            }
        }

        if (newItems.length > 0) {
            setQueue(newItems);
            // Reset check state so we can check again after this mini-session? 
            // Or typically we do 1 inject per session. User says "Introduce at most 5-10 new items per session".
            // So we treat this as the injection. 
            setUnlockEligible('claimed');
        } else {
            // No new items in this level? Maybe bump level?
            // For MVP, we just say "Level Complete!"
            setUnlockReason("Level complete! Challenge unlocked?");
            setUnlockEligible('level_complete'); // Force UI update
        }
    };



    // Fast Track Handler
    const handleFastTrackComplete = (result) => {
        // Result: { success: bool, learnedItems: [] }
        const newProgress = { ...progress };
        const now = new Date();

        // 1. Commit passed items
        if (result.learnedItems && result.learnedItems.length > 0) {
            result.learnedItems.forEach(item => {
                newProgress[item.id] = {
                    id: item.id,
                    level: 1, // Assume mastered
                    interval: 10, // Jump to 10 days
                    ease: 2.5,
                    nextReviewDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
                    spokenCount: 3,
                    history: [{ date: now.toISOString(), rating: 'fast_track' }]
                };
            });
            saveProgress(newProgress);
            setProgress(newProgress);
        }

        setShowFastTrack(false);

        // Force refresh if success to update queue
        if (result.success) {
            window.location.reload();
        }
    };

    // Helper: Get supporting words for current phrase
    const getSupportingWords = (phrase) => {
        if (!phrase.word_ids) return [];
        // Flatten all words from all levels (efficient enough for MVP)
        const allWords = {};
        Object.values(curriculum).forEach(lvl => {
            lvl.words.forEach(w => allWords[w.id] = w);
        });
        return phrase.word_ids.map(id => allWords[id]).filter(Boolean);
    };

    // Attempt to resolve Frame Examples (lazy way)
    const getFrameExamples = (frame) => {
        if (!frame.example_phrase_ids) return [];
        const allPhrases = {};
        Object.values(curriculum).forEach(lvl => {
            lvl.phrases.forEach(p => allPhrases[p.id] = p);
        });
        return frame.example_phrase_ids.map(id => allPhrases[id]).filter(Boolean);
    };


    if (!isLoaded) return <div className="p-8 text-center text-gray-500">Loading curriculum...</div>;

    const currentLevelData = curriculum[`level_${userLevel}`];

    return (
        <main className="min-h-screen flex flex-col items-center bg-gray-50 p-6">
            <OnboardingModal />
            {/* Header */}
            <header className="w-full max-w-4xl flex flex-col gap-4 mb-8">
                <div className="flex justify-between items-center">
                    <Link href="/" className="text-gray-600 hover:text-gray-900 font-medium flex items-center gap-2">← Home</Link>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
                            className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                            {isHeaderExpanded ? '🔼' : '🔽'}
                        </button>
                        <div className="bg-white px-4 py-2 rounded-full shadow-sm text-sm font-bold text-brand-blue border border-gray-200">
                            Lv {userLevel}
                        </div>
                        <div className="bg-white px-3 py-2 rounded-full shadow-sm text-sm font-bold text-orange-500 border border-gray-200 flex items-center gap-1">
                            🔥 {streak}
                        </div>
                        <span className="text-sm text-gray-500 whitespace-nowrap">{queue.length} left</span>
                    </div>
                </div>

                {/* Level Stats Bar (Collapsible) */}
                {currentLevelData && isHeaderExpanded && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
                        <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                            <span>Voice Confidence ({Math.round(((levelStats.spokenCurrent || 0) / (levelStats.spokenTarget || 1)) * 100)}%)</span>
                            <span>Patterns ({Math.round(((levelStats.framesUsable || 0) / (levelStats.totalFrames || 1)) * 100)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden flex">
                            <div className="bg-brand-blue h-full transition-all duration-300" style={{ width: `${((levelStats.spokenCurrent || 0) / (levelStats.spokenTarget || 1)) * 100}%` }}></div>
                            <div className="bg-brand-teal h-full transition-all duration-300" style={{ width: `${((levelStats.framesUsable || 0) / (levelStats.totalFrames || 1)) * 100}%` }}></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            Current Level Progress: {Math.round(((levelStats.spokenCurrent || 0) / (levelStats.spokenTarget || 1)) * 100)}% Spoken Mastery
                            {levelStats.readyForChallenge && (
                                <Link href={`/challenge/${userLevel}`} className="mt-2 block w-full text-center py-2 bg-brand-orange text-white font-bold rounded-lg animate-pulse hover:animate-none shadow-lg transform transition hover:scale-105">
                                    🔥 UNLOCK LEVEL {userLevel + 1} CHALLENGE 🔥
                                </Link>
                            )}
                        </div>

                        {/* Settings Toggles */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoRecord}
                                    onChange={(e) => setAutoRecord(e.target.checked)}
                                    className="w-4 h-4 text-brand-blue rounded focus:ring-brand-blue"
                                />
                                <span>Auto-Record</span>
                            </label>
                        </div>
                    </div>
                )}
            </header>

            {/* Card Area */}
            <div className="flex-1 w-full flex justify-center">
                {currentCard ? (
                    currentCard.type === 'phrase' ? (
                        <Flashcard
                            key={currentCard.id}
                            card={currentCard}
                            supportingWords={getSupportingWords(currentCard)}
                            onRate={handlePhraseRate}
                            onRecording={handleRecording}
                            progress={progress[currentCard.id]}
                            autoRecord={autoRecord}
                        />
                    ) : (
                        <FrameCard
                            key={currentCard.id}
                            frame={currentCard}
                            examples={getFrameExamples(currentCard)}
                            onResult={handleFrameResult}
                            autoRecord={autoRecord}
                        />
                    )
                ) : (
                    <div className="text-center flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300 max-w-md mx-auto">

                        {/* STATE A: ONBOARDING */}
                        {Object.keys(progress).length < 5 ? (
                            <>
                                <h2 className="text-3xl font-bold text-gray-800">Ready to start?</h2>
                                <p className="text-gray-600">Let's unlock your first words.</p>
                                <button onClick={unlockNewItems} className="px-8 py-3 bg-brand-blue text-white font-bold rounded-lg shadow-lg hover:bg-opacity-90 transform hover:scale-105 transition-all">
                                    Unlock First 5 Words
                                </button>
                            </>
                        ) : (
                            /* REVIEW COMPLETE STATES */
                            <>
                                {/* Header Logic */}
                                {unlockEligible === 'eligible' ? (
                                    <h2 className="text-3xl font-bold text-brand-blue">Great Job! 🎉</h2>
                                ) : unlockEligible === 'stable_block' ? (
                                    <h2 className="text-2xl font-bold text-gray-800">All Caught Up! ivore</h2>
                                ) : (
                                    <h2 className="text-2xl font-bold text-gray-800">Keep Practicing 💪</h2>
                                )}

                                {/* Subtext Logic */}
                                <p className="text-gray-600 px-4">
                                    {unlockEligible === 'eligible'
                                        ? "Your recall is strong. You're ready for more."
                                        : unlockEligible === 'stable_block'
                                            ? "We recommend letting these words sink in for a bit."
                                            : "Let's improve your recall accuracy before adding new words."}
                                </p>

                                {/* Actions Area */}
                                <div className="flex flex-col gap-3 w-full px-8">

                                    {/* 1. Unlock Button (Primary if Eligible) */}
                                    {unlockEligible === 'eligible' && (
                                        <button onClick={unlockNewItems} className="w-full py-3 bg-brand-blue text-white font-bold rounded-lg shadow-lg hover:bg-opacity-90 transition-all">
                                            Unlock 5 New Words
                                        </button>
                                    )}

                                    {/* 2. Review Button (Primary if Locked) */}
                                    <button onClick={startPractice} className={`w-full py-3 font-bold rounded-lg transition-colors ${unlockEligible === 'eligible' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-brand-teal text-white shadow-md hover:bg-opacity-90'}`}>
                                        Review All Words
                                    </button>

                                    {/* 3. Override Option (Only for Stability Block) */}
                                    {unlockEligible === 'stable_block' && (
                                        <button onClick={unlockNewItems} className="text-xs text-gray-400 hover:text-brand-blue underline mt-2">
                                            I found this lesson easy - Unlock More
                                        </button>
                                    )}

                                    {/* 5. Fast Track Button (Gauntlet) */}
                                    {(unlockEligible === 'stable_block' || unlockEligible === 'eligible') && (
                                        <button
                                            onClick={() => setShowFastTrack(true)}
                                            className="mt-4 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-lg shadow-md hover:scale-105 transition-transform flex items-center justify-center gap-2"
                                        >
                                            <span>⚡ Fast Track</span>
                                        </button>
                                    )}

                                    {/* 4. Return Home (Always available fallback) */}
                                    <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 mt-2">
                                        Return Home
                                    </Link>
                                </div>

                                {/* Next Review info */}
                                {nextReviewTime && (
                                    <div className="text-xs text-center text-gray-400 mt-4 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                                        Next review due: {nextReviewTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            <FastTrackModal
                isOpen={showFastTrack}
                onClose={() => setShowFastTrack(false)}
                curriculum={curriculum}
                userLevel={userLevel}
                progress={progress}
                onComplete={handleFastTrackComplete}
            />
        </main>
    );
}
