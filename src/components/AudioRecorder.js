'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

const AudioRecorder = forwardRef(({ onRecordingComplete, autoStart = false, nativeAudioSrc = null }, ref) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioURL, setAudioURL] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioRef = useRef(null);

    useEffect(() => {
        if (autoStart) {
            startRecording();
        }
    }, [autoStart]);

    useImperativeHandle(ref, () => ({
        stopRecording: () => {
            if (isRecording) {
                stopRecording();
            }
        },
        stopPlayback: () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        }
    }));

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                const url = URL.createObjectURL(audioBlob);
                setAudioURL(url);
                if (onRecordingComplete) {
                    onRecordingComplete(audioBlob);
                }
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please ensure permission is granted.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // Stop all tracks to release microphone
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4 border rounded-lg shadow-sm">
            <div className="flex gap-2">
                {!isRecording ? (
                    <button
                        onClick={startRecording}
                        className="px-4 py-2 bg-brand-orange text-white rounded-full hover:bg-opacity-90 transition-colors"
                    >
                        Record
                    </button>
                ) : (
                    <button
                        onClick={stopRecording}
                        className="px-4 py-2 bg-brand-blue text-white rounded-full hover:bg-opacity-90 transition-colors animate-pulse"
                    >
                        Stop
                    </button>
                )}
            </div>

            {audioURL && (
                <div className="w-full flex flex-col items-center gap-2">
                    <audio
                        ref={audioRef}
                        controls
                        autoPlay
                        src={audioURL}
                        className="w-full max-w-xs"
                        onEnded={() => {
                            if (nativeAudioSrc) {
                                // Play native comparison
                                const native = new Audio(nativeAudioSrc);
                                native.play().catch(console.error);
                            }
                        }}
                    />
                    {nativeAudioSrc && <p className="text-xs text-brand-blue font-bold">Auto-Compare Active</p>}
                </div>
            )}
        </div>
    );
});

export default AudioRecorder;
