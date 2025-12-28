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

    // Computed state
    const [userLevel, setUserLevel] = useState(1);
    const [levelStats, setLevelStats] = useState({
        phrasesMastered: 0,
        totalPhrases: 0,
        framesUsable: 0,
        totalFrames: 0
    });
    const [isPracticeMode, setIsPracticeMode] = useState(false);

    // Load progress from localStorage
    useEffect(() => {
        const savedProgress = localStorage.getItem('czech-app-progress-v2'); // New key for new system
        if (savedProgress) {
            setProgress(JSON.parse(savedProgress));
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

                // New Item (Only for current level)
                if (!prog) {
                    if (levelNum === calculatedLevel) {
                        newQueue.push(item);
                    }
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

        // Randomize queue slightly to mix phrases/frames?
        // Prioritize: Phrases first? 
        // Let's just keep standard order but randomly sort ensures variety
        // newQueue.sort(() => Math.random() - 0.5); 

        setQueue(newQueue);

    }, [isLoaded, progress, isPracticeMode]);

    // Set current card
    useEffect(() => {
        if (queue.length > 0 && !currentCard) {
            setCurrentCard(queue[0]);
        } else if (queue.length === 0) {
            setCurrentCard(null);
            if (isPracticeMode) setIsPracticeMode(false);
        }
    }, [queue, currentCard, isPracticeMode]);


    // --- HANDLERS ---

    const handleRecording = () => {
        if (!currentCard) return;
        const cardId = currentCard.id;
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
                    <div className="flex items-center gap-4">
                        <div className="bg-white px-4 py-2 rounded-full shadow-sm text-sm font-bold text-brand-blue border border-gray-200">
                            {currentLevelData ? currentLevelData.title : `Level ${userLevel}`}
                        </div>
                        <span className="text-sm text-gray-500">{queue.length} due</span>
                    </div>
                </div>

                {/* Level Stats Bar */}
                {currentLevelData && (
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
                        </div>
                        {levelStats.readyForChallenge && (
                            <Link href={`/challenge/${userLevel}`} className="mt-2 block w-full text-center py-2 bg-brand-orange text-white font-bold rounded-lg animate-pulse hover:animate-none shadow-lg transform transition hover:scale-105">
                                🔥 UNLOCK LEVEL {userLevel + 1} CHALLENGE 🔥
                            </Link>
                        )}
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
                        />
                    ) : (
                        <FrameCard
                            key={currentCard.id}
                            frame={currentCard}
                            examples={getFrameExamples(currentCard)}
                            onResult={handleFrameResult}
                        />
                    )
                ) : (
                    <div className="text-center flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                        <h2 className="text-3xl font-bold text-gray-800">Review Complete!</h2>
                        <p className="text-gray-600">You've hit your goals for now.</p>
                        <button onClick={startPractice} className="mt-4 px-8 py-3 bg-brand-teal text-white font-bold rounded-lg shadow hover:bg-opacity-90 transition-transform hover:scale-105">
                            Keep Practicing
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
