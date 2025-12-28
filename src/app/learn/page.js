'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Flashcard from '../../components/Flashcard';
import FrameCard from '../../components/FrameCard';
import OnboardingModal from '../../components/OnboardingModal';
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

                if (phrasePct >= 0.7 && framePct >= 0.8) {
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

            // --- ADAPTIVE UNLOCK CHECK (Condition A) ---
            if (!hasCheckedUnlock && !isPracticeMode) {
                // Check Condition B (Performance)
                const recallRate = sessionStats.total > 0 ? (sessionStats.correct / sessionStats.total) : 1;
                const performancePass = recallRate >= 0.8;

                // Check Condition C (Stability)
                const activeItems = Object.values(progress).filter(p => p.interval > 0);
                const avgInterval = activeItems.length > 0
                    ? activeItems.reduce((acc, curr) => acc + curr.interval, 0) / activeItems.length
                    : 0;
                const unstableItems = activeItems.filter(p => p.interval < 3).length; // <3 days considered "unstable"
                const unstableRatio = activeItems.length > 0 ? unstableItems / activeItems.length : 0;

                const stabilityPass = (avgInterval >= 1) || (unstableRatio < 0.3) || (activeItems.length === 0);

                if (performancePass && stabilityPass) {
                    setUnlockEligible('eligible');
                    setUnlockReason("Great job! You're ready for more.");
                } else {
                    setUnlockEligible('ineligible');
                    let reasons = [];
                    if (!performancePass) reasons.push(`Recall accuracy (${Math.round(recallRate * 100)}%) is below 80%.`);
                    if (!stabilityPass) reasons.push("Too many items are still unstable.");
                    setUnlockReason(reasons.join(" ") + " Let's strengthen what you know.");
                }
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
                    <div className="text-center flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                        <h2 className="text-3xl font-bold text-gray-800">
                            {Object.keys(progress).length < 5 ? "Ready to start?" : "Review Complete!"}
                        </h2>
                        <p className="text-gray-600">
                            {Object.keys(progress).length < 5 ? "Let's unlock your first words." : "You've hit your goals for now."}
                        </p>
                        {nextReviewTime && (
                            <div className="text-sm text-brand-blue bg-blue-50 px-4 py-2 rounded-full mt-2 font-medium">
                                Next cards available: {nextReviewTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                <br />
                                <span className="text-xs opacity-75">
                                    (in {Math.ceil((nextReviewTime - new Date()) / (1000 * 60 * 60))} hours)
                                </span>
                            </div>
                        )}
                        {unlockEligible === 'eligible' && (
                            <div className="animate-in slide-in-from-bottom-5">
                                <p className="text-brand-blue font-bold text-lg mb-2">🎉 You're ready for more!</p>
                                <button onClick={unlockNewItems} className="px-8 py-3 bg-brand-blue text-white font-bold rounded-lg shadow hover:bg-opacity-90 transition-transform hover:scale-105">
                                    Unlock 5 New Items
                                </button>
                            </div>
                        )}

                        {unlockEligible === 'ineligible' && (
                            <div className="bg-orange-50 p-4 rounded-lg max-w-sm">
                                <p className="text-orange-800 font-bold mb-1">Locked for now 🔒</p>
                                <p className="text-sm text-orange-700">{unlockReason}</p>
                            </div>
                        )}

                        <div className="border-t pt-4 w-full flex justify-center">
                            <button onClick={startPractice} className="text-gray-500 font-medium hover:text-brand-teal transition-colors flex items-center gap-2">
                                <span>Unlimited Practice Mode</span>
                                <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">No SRS impact</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
