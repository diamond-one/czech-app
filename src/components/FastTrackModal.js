'use client';

import { useState, useEffect } from 'react';
import soundManager from '../utils/SoundManager';

export default function FastTrackModal({ isOpen, onClose, curriculum, userLevel, progress, onComplete }) {
    const [screen, setScreen] = useState('intro'); // intro, quiz, result, fail
    const [currentBatch, setCurrentBatch] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [batchesPassed, setBatchesPassed] = useState(0);
    const [learnedItems, setLearnedItems] = useState([]); // Items passed in this session

    // Options & Text for current question
    const [options, setOptions] = useState([]);
    const [currentQuestionText, setCurrentQuestionText] = useState(""); // Explicit state for question text

    if (!isOpen) return null;

    // Helper: Find next batch of 5 unlearned items
    const getNextBatch = (excludeIds) => {
        let candidates = [];
        // Scan current level and potentially next levels
        // For MVP, focus on userLevel first
        const lvlKeys = Object.keys(curriculum).sort(); // level_1, level_2...

        for (const key of lvlKeys) {
            // const lvlNum = parseInt(key.replace('level_', ''));
            // if (lvlNum < userLevel) continue; // Skip passed levels? Or just check if items unlearned?

            const lvlData = curriculum[key];
            const allItems = [...lvlData.phrases, ...lvlData.frames];

            for (const item of allItems) {
                if (!progress[item.id] && !excludeIds.has(item.id)) {
                    candidates.push(item);
                }
            }
            // If we have enough candidates, break early? Or allow mixing levels? 
            // Better to stick to level sequence.
            if (candidates.length >= 50) break;
        }

        return candidates.slice(0, 5); // Take first 5 available
    };

    const startQuiz = () => {
        const exclude = new Set(learnedItems.map(i => i.id));
        const batch = getNextBatch(exclude);

        if (batch.length === 0) {
            // No more items!
            setScreen('victory');
            return;
        }

        setCurrentBatch(batch);
        setCurrentQuestionIndex(0);
        setScore(0);
        setScreen('quiz');
        prepareQuestion(batch[0]);
    };

    const prepareQuestion = (item) => {
        let correct;
        let questionText;

        // Determine Correct Answer (Phrase vs Frame)
        if (item.type === 'phrase') {
            correct = item.text; // Fixed: Use 'text' (from curriculum) not 'text_cs'
            questionText = item.translation;
        } else {
            // Frame: Use an example phrase if available, otherwise template
            if (item.example_phrase_ids && item.example_phrase_ids.length > 0) {
                // Find first example
                let examplePhrase = null;
                // Scan curriculum to find the phrase object
                const allLevels = Object.values(curriculum);
                for (const lvl of allLevels) {
                    const found = lvl.phrases.find(p => p.id === item.example_phrase_ids[0]);
                    if (found) {
                        examplePhrase = found;
                        break;
                    }
                }

                if (examplePhrase) {
                    correct = examplePhrase.text;
                    questionText = examplePhrase.translation; // Use Example's translation
                } else {
                    // Fallback to template stripped of brackets
                    correct = item.template.replace(/\[.*?\]/g, "...").trim();
                    questionText = item.description; // Fallback to description
                }
            } else {
                correct = item.template.replace(/\[.*?\]/g, "...").trim();
                questionText = item.description;
            }
        }

        setCurrentQuestionText(questionText);

        // Distractors
        const allPhrases = [];
        Object.values(curriculum).forEach(l => {
            l.phrases.forEach(p => allPhrases.push(p.text)); // Fixed: Use 'text'
        });

        // Ensure distractors are not the same as correct
        const distractors = allPhrases
            .filter(text => text !== correct && text) // Ensure valid text
            .sort(() => Math.random() - 0.5)
            .slice(0, 4); // Fixed: 4 Distractors + 1 Correct = 5 Options

        const opts = [correct, ...distractors].sort(() => Math.random() - 0.5);
        setOptions(opts);
    };

    const handleAnswer = (selectedText) => {
        const currentItem = currentBatch[currentQuestionIndex];
        // We need to match selectedText against the 'correct' value we generated in prepareQuestion.
        // But prepareQuestion set state options only. 
        // We re-derive correct answer logic here OR we should have stored it?
        // Let's re-derive for consistency, carefully.

        let correct;
        if (currentItem.type === 'phrase') {
            correct = currentItem.text;
        } else {
            if (currentItem.example_phrase_ids && currentItem.example_phrase_ids.length > 0) {
                let examplePhrase = null;
                const allLevels = Object.values(curriculum);
                for (const lvl of allLevels) {
                    const found = lvl.phrases.find(p => p.id === currentItem.example_phrase_ids[0]);
                    if (found) {
                        examplePhrase = found;
                        break;
                    }
                }
                if (examplePhrase) {
                    correct = examplePhrase.text;
                } else {
                    correct = currentItem.template.replace(/\[.*?\]/g, "...").trim();
                }
            } else {
                correct = currentItem.template.replace(/\[.*?\]/g, "...").trim();
            }
        }

        if (selectedText === correct) {
            soundManager.playSuccess();
            setScore(prev => prev + 1);
        } else {
            soundManager.playFail();
        }

        // Next Question or End Batch
        if (currentQuestionIndex < currentBatch.length - 1) {
            const nextIdx = currentQuestionIndex + 1;
            setCurrentQuestionIndex(nextIdx);
            prepareQuestion(currentBatch[nextIdx]);
        } else {
            // Batch Complete
            finishBatch(selectedText === correct ? score + 1 : score);
        }
    };

    const finishBatch = (finalScore) => {
        if (finalScore === 5) {
            // PASS
            const newLearned = [...learnedItems, ...currentBatch];
            setLearnedItems(newLearned);
            setBatchesPassed(prev => prev + 1);

            // Immediate Next Round logic (Gauntlet style)
            // Show brief "Success! Nest level..." then allow continue
            setScreen('batch_success');
        } else {
            // FAIL
            setScreen('fail');
        }
    };

    const handleBatchSuccessContinue = () => {
        startQuiz(); // Fetch next batch and loop
    };

    const finalizeFail = () => {
        // Commit what we learned so far (if recursive enabled, but user said "if they fail... status is the level before")
        // Actually, "if they fail... their level becomes the level before... and all previous are unlocked"
        // So we keep successful batches.
        onComplete({ success: false, learnedItems: learnedItems }); // Pass learned, but flag as failed run
        onClose();
    };

    const finalizeVictory = () => {
        onComplete({ success: true, learnedItems: learnedItems });
        onClose();
    };


    // RENDER
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">

                {/* 1. INTRO */}
                {screen === 'intro' && (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                            ⚡
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Fast Track Gauntlet</h2>
                        <p className="text-gray-600 mb-6">
                            Test out of upcoming words. <br />
                            <strong>Rules:</strong> Must get 5/5 to pass. If you pass, you immediately face the next batch.
                            <br /><span className="text-red-500 font-bold text-sm">One mistake stops the streak.</span>
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button onClick={onClose} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={startQuiz} className="px-8 py-3 bg-brand-orange text-white font-bold rounded-lg shadow-lg hover:transform hover:scale-105 transition-all">
                                Start the Gauntlet
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. QUIZ QUESTIONS */}
                {screen === 'quiz' && (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-6 text-sm text-gray-500 font-bold uppercase tracking-wider">
                            <span>Streak: {batchesPassed} Batches</span>
                            <span>Q {currentQuestionIndex + 1} / 5</span>
                        </div>

                        <div className="mb-8 text-center">
                            <p className="text-gray-400 text-sm mb-2 uppercase">How do you say...</p>
                            <h3 className="text-2xl font-bold text-gray-800">
                                "{currentQuestionText}"
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {options.map((opt, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleAnswer(opt)}
                                    className="p-4 text-left border-2 border-gray-100 rounded-xl hover:border-brand-blue hover:bg-blue-50 font-medium text-lg text-black transition-all bg-white shadow-sm"
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. BATCH SUCCESS */}
                {screen === 'batch_success' && (
                    <div className="p-8 text-center bg-green-50">
                        <div className="text-6xl mb-4">🏆</div>
                        <h2 className="text-2xl font-bold text-green-700 mb-2">Batch Complete!</h2>
                        <p className="text-green-600 mb-6">You went 5/5. {currentBatch.length} items mastered.</p>
                        <button onClick={handleBatchSuccessContinue} className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 animate-pulse">
                            Continue Gauntlet →
                        </button>
                    </div>
                )}

                {/* 4. FAIL */}
                {screen === 'fail' && (
                    <div className="p-8 text-center">
                        <div className="text-6xl mb-4">💀</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Streak Broken</h2>
                        <p className="text-gray-600 mb-6">
                            You missed a question. The gauntlet ends here.
                            <br />
                            You kept {learnedItems.length} mastered items.
                        </p>
                        <button onClick={finalizeFail} className="px-8 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700">
                            Finish & Save Progress
                        </button>
                    </div>
                )}

                {/* 5. TOTAL VICTORY (No more content) */}
                {screen === 'victory' && (
                    <div className="p-8 text-center">
                        <h2 className="text-2xl font-bold text-brand-blue mb-2">Curriculum Complete!</h2>
                        <p className="text-gray-600 mb-6">There are no more words to test out of.</p>
                        <button onClick={finalizeVictory} className="px-8 py-3 bg-brand-blue text-white font-bold rounded-lg">
                            Finish
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
