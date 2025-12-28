'use client';

import { useState, useRef } from 'react';
import AudioRecorder from './AudioRecorder';

/*
  FrameCard (Type C)
  Purpose: Controlled language generation & Pattern transfer.
  Shows a template with slots (e.g. "Prosím [NOUN]")
  User must speak a valid variation.
  Reveal shows examples.
*/
export default function FrameCard({ frame, examples = [], onResult, autoRecord = false }) {
    const [isRevealed, setIsRevealed] = useState(false);
    const [hasRecorded, setHasRecorded] = useState(false);
    const recorderRef = useRef(null);
    const audioRef = useRef(null);

    const handleResult = (success) => {
        setIsRevealed(false);
        setHasRecorded(false);
        if (success) {
            import('../utils/SoundManager').then(m => m.default.playSuccess());
        } else {
            import('../utils/SoundManager').then(m => m.default.playFail());
        }
        onResult(success);
    };

    return (
        <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-lg border-2 border-brand-blue flex flex-col items-center gap-6">

            {/* Header: Pattern Goal */}
            <div className="w-full text-center border-b pb-4">
                <span className="text-xs font-bold tracking-widest text-brand-blue uppercase">Pattern Drill</span>
                <h3 className="text-gray-500 text-sm mt-1">{frame.description}</h3>
            </div>

            {/* Pattern Template */}
            <div className="text-center py-4 relative group">
                {/* Audio Preview for Pattern */}
                <button
                    onClick={() => {
                        // Stop recorder playback if active
                        recorderRef.current?.stopPlayback();

                        // Stop any existing example audio 
                        if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current.currentTime = 0;
                        }

                        // Play pattern template
                        // Filter out brackets for better TTS? e.g. "Protože [CLAUSE]" -> "Protože..."
                        const cleanText = frame.template.replace(/\[.*?\]/g, "...").trim();
                        const audio = new Audio(`/api/tts?text=${encodeURIComponent(cleanText)}`);
                        audioRef.current = audio;
                        audio.play().catch(e => console.error("Audio play error:", e));
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 opacity-50 hover:opacity-100 hover:text-brand-blue transition-all p-2 bg-gray-50 rounded-full shadow-sm"
                    title="Hear Pattern"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                </button>

                <h2 className="text-3xl font-mono font-bold text-gray-800 tracking-wide">
                    {frame.template}
                </h2>
                {/* Slot Definitions */}
                <div className="mt-4 flex flex-col gap-2">
                    {Object.entries(frame.slot_definitions).map(([slot, desc]) => (
                        <div key={slot} className="text-sm px-3 py-1 bg-gray-100 rounded-full inline-block mx-auto text-gray-600">
                            <strong>[{slot}]</strong>: {desc}
                        </div>
                    ))}
                </div>
            </div>

            {/* Instruction */}
            <p className="text-center text-gray-600 italic">
                Create 3 different phrases using this pattern.
            </p>

            {/* Audio Recorder */}
            {/* Audio Recorder */}
            {/* Audio Recorder */}
            <div className="w-full">
                <AudioRecorder
                    ref={recorderRef}
                    onRecordingComplete={() => {
                        setHasRecorded(true);
                        setIsRevealed(true);
                    }}
                    autoStart={autoRecord}
                // For Frame cards, we don't have a single "native audio" to compare against easily
                // because the user creates their own variations. So we omit nativeAudioSrc here.
                />
            </div>

            {/* Reveal / Examples */}
            <div className="w-full flex flex-col items-center gap-4">
                {!isRevealed ? (
                    <button
                        onClick={() => {
                            recorderRef.current?.stopRecording();
                            setIsRevealed(true);
                        }}
                        className={`px-6 py-3 w-full font-semibold rounded-lg transition-colors ${hasRecorded
                            ? 'bg-brand-blue text-white hover:bg-opacity-90'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                        disabled={!hasRecorded} // Encourage recording first? Or make optional but urged?
                    >
                        {hasRecorded ? "Check Examples" : "Record to Check"}
                    </button>
                    /* Note: Enforcing recording for Frame Generative drills is good practice as per directive */
                ) : (
                    <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="w-full mb-6">
                            <p className="text-sm text-gray-400 font-semibold mb-2 uppercase">Valid Examples</p>
                            <ul className="flex flex-col gap-2">
                                {examples.map((ex) => (
                                    <li key={ex.id} className="p-3 bg-gray-50 rounded border-l-4 border-brand-teal flex justify-between items-center group">
                                        <div>
                                            <p className="font-medium text-gray-800">{ex.text}</p>
                                            <p className="text-xs text-gray-500">{ex.translation}</p>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                recorderRef.current?.stopPlayback(); // STOP RECORDER PLAYBACK
                                                const audio = new Audio(`/api/tts?text=${encodeURIComponent(ex.audio_text || ex.text)}`);
                                                audio.play().catch(e => console.error("Audio play error:", e));
                                            }}
                                            className="p-2 text-gray-400 hover:text-brand-blue rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                            title="Listen to example"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                            </svg>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <p className="text-sm text-gray-500 mb-3 text-center">Did you successfully produce valid phrases?</p>
                        <div className="grid grid-cols-2 gap-4 w-full">
                            <button
                                onClick={() => handleResult(false)}
                                className="px-4 py-3 bg-brand-orange text-white rounded-lg hover:bg-opacity-90 font-medium"
                            >
                                No, I struggled
                            </button>
                            <button
                                onClick={() => handleResult(true)}
                                className="px-4 py-3 bg-brand-teal text-white rounded-lg hover:bg-opacity-90 font-medium"
                            >
                                Yes, I made it work
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
