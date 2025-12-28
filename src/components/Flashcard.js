'use client';

import { useState } from 'react';
import AudioRecorder from './AudioRecorder';

export default function Flashcard({ card, supportingWords = [], onRate, onRecording, progress = null }) {
    const [isRevealed, setIsRevealed] = useState(false);
    const [hasRecorded, setHasRecorded] = useState(false);

    const spokenCount = progress ? (progress.spokenCount || 0) : 0;

    const handleRate = (quality) => {
        setIsRevealed(false);
        // Rate card
        if (quality >= 3) {
            import('../utils/SoundManager').then(m => m.default.playSuccess());
        } else {
            import('../utils/SoundManager').then(m => m.default.playFail());
        }
        onRate(quality);
    };

    // Fallback for legacy data (during migration/dev)
    const mainText = card.text || card.czech;
    const subText = card.translation || card.english;
    const pron = card.pronunciation;
    const audioQuery = card.audio_text || mainText;

    return (
        <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col items-center gap-6">

            {/* Type Indicator */}
            <div className="w-full text-center border-b pb-2 flex justify-between items-center px-2">
                <span className="text-xs font-bold tracking-widest text-brand-teal uppercase">Phrase Card</span>
                {/* Spoken Progress Indicator */}
                <div className="flex items-center gap-1" title={`${spokenCount}/3 Spoken Repetitions Required`}>
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full border border-brand-teal ${i < spokenCount ? 'bg-brand-teal' : 'bg-transparent'}`}></div>
                    ))}
                </div>
            </div>

            {/* Front of card */}
            <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">{mainText}</h2>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const audio = new Audio(`/api/tts?text=${encodeURIComponent(audioQuery)}`);
                            audio.play().catch(e => console.error("Audio play error:", e));
                        }}
                        className="p-2 text-brand-blue hover:bg-blue-50 rounded-full transition-colors"
                        title="Listen"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    </button>
                </div>
                <p className="text-gray-500 italic">{pron}</p>
            </div>

            {/* Audio Recorder for practice */}
            <div className="w-full">
                <p className="text-sm text-gray-500 text-center mb-2">Speak it aloud:</p>
                <AudioRecorder onRecordingComplete={() => {
                    setHasRecorded(true);
                    if (onRecording) onRecording();
                }} />
                {hasRecorded && <p className="text-center text-xs text-green-500 font-bold mt-1">Recording Captured! (+1 Progress)</p>}
            </div>

            {/* Reveal / Back of card */}
            <div className="w-full flex flex-col items-center gap-4">
                {!isRevealed ? (
                    <button
                        onClick={() => setIsRevealed(true)}
                        className="px-6 py-2 bg-brand-blue text-white font-semibold rounded-lg hover:bg-opacity-90 transition-colors"
                    >
                        Show Answer
                    </button>
                ) : (
                    <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="mb-6 text-center p-4 bg-gray-50 rounded-lg w-full">
                            <p className="text-xl font-medium text-gray-900">{subText}</p>
                        </div>

                        {/* Supporting Words (Type A - Context) */}
                        {supportingWords.length > 0 && (
                            <div className="w-full mb-4">
                                <p className="text-xs text-gray-400 uppercase font-bold mb-2 text-center">Breakdown</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {supportingWords.map(w => (
                                        <span key={w.id} className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600 border border-gray-200" title={w.translation}>
                                            {w.lemma} ({w.translation})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <p className="text-sm text-gray-500 mb-3">How well did you know this?</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
                            <button
                                onClick={() => handleRate(0)}
                                className="px-3 py-2 bg-brand-orange text-white rounded hover:bg-opacity-90 transition-colors text-sm font-medium"
                            >
                                Again
                            </button>
                            <button
                                onClick={() => handleRate(3)}
                                className="px-3 py-2 bg-brand-yellow text-gray-800 rounded hover:bg-opacity-90 transition-colors text-sm font-medium"
                            >
                                Hard
                            </button>
                            <button
                                onClick={() => handleRate(4)}
                                className="px-3 py-2 bg-brand-teal text-white rounded hover:bg-opacity-90 transition-colors text-sm font-medium"
                            >
                                Good
                            </button>
                            <button
                                onClick={() => handleRate(5)}
                                className="px-3 py-2 bg-brand-blue text-white rounded hover:bg-opacity-90 transition-colors text-sm font-medium"
                            >
                                Easy
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
