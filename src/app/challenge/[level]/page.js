'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AudioRecorder from '../../../components/AudioRecorder';

/*
  Challenge Page (The "Boss Battle")
  - Scenario-based Speaking Test
*/

const CHALLENGES = {
    "1": {
        title: "Survival: Café & Intro",
        description: "Complete two tasks: Order in a café and introduce yourself.",
        steps: [
            // Task 1: Café
            { prompt: "Greet the barista politely.", hint: "Dobrý den / Ahoj", expected: "Dobrý den." },
            { prompt: "Order a coffee.", hint: "Prosím...", expected: "Prosím kávu." },
            { prompt: "Say thank you.", hint: "Děkuji", expected: "Děkuji." },
            { prompt: "Say goodbye.", hint: "Nashledanou", expected: "Nashledanou." },
            // Task 2: Intro
            { prompt: "Say your name.", hint: "Já jsem...", expected: "Já jsem [Name]." },
            { prompt: "Say 'I speak a little Czech'.", hint: "Mluvím...", expected: "Mluvím trochu česky." }
        ]
    },
    "2": {
        title: "Needs: Help & Wants",
        description: "Ask for help and express what you want.",
        steps: [
            // Task 1: Help
            { prompt: "Say you need help.", hint: "Potřebuji...", expected: "Potřebuji pomoc." },
            { prompt: "Ask how much a ticket costs.", hint: "Kolik...", expected: "Kolik stojí lístek?" },
            { prompt: "Say thank you.", hint: "Děkuji", expected: "Děkuji." },
            // Task 2: Wants
            { prompt: "Say you want a beer.", hint: "Chci...", expected: "Chci pivo." },
            { prompt: "Say you want to sleep.", hint: "Chci...", expected: "Chci spát." } // Or pracovat
        ]
    },
    "3": {
        title: "Routine: The Catch-Up",
        description: "Tell a friend about your past, present, and future.",
        steps: [
            { prompt: "Say what you did yesterday (worked).", hint: "Včera...", expected: "Včera jsem pracoval." },
            { prompt: "Say what you are doing today (working).", hint: "Dnes...", expected: "Dnes pracuji." },
            { prompt: "Say what you will do tomorrow (work).", hint: "Zítra...", expected: "Zítra budu pracovat." }
        ]
    },
    "4": {
        title: "Opinion: The Debate",
        description: "Express your opinion and obligation.",
        steps: [
            { prompt: "Say 'I think that it is good.'", hint: "Myslím si...", expected: "Myslím si, že je to dobré." },
            { prompt: "Say 'I must work.'", hint: "Musím...", expected: "Musím pracovat." },
            { prompt: "Add a reason (Optional: Because...)", hint: "Protože...", expected: "Protože [Reason]." }
        ]
    }
};

export default function ChallengePage() {
    const params = useParams();
    const router = useRouter();
    const level = params.level;
    const challenge = CHALLENGES[level] || CHALLENGES["1"];

    const [currentStep, setCurrentStep] = useState(0);
    const [hasRecorded, setHasRecorded] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);
    const [autoRecord, setAutoRecord] = useState(false);

    const handleNext = (success) => {
        if (!success) {
            alert("Try again! You need to handle this situation.");
            return;
        }

        if (currentStep < challenge.steps.length - 1) {
            setCurrentStep(prev => prev + 1);
            setHasRecorded(false);
            setIsRevealed(false);
        } else {
            completeChallenge();
        }
    };

    const completeChallenge = () => {
        const saved = localStorage.getItem('czech-app-progress-v2');
        let progress = saved ? JSON.parse(saved) : {};

        progress.challenges = progress.challenges || {};
        progress.challenges[level] = true;

        localStorage.setItem('czech-app-progress-v2', JSON.stringify(progress));

        alert("Challenge Complete! Level Unlocked! 🎉");
        router.push('/learn');
    };

    const step = challenge.steps[currentStep];

    return (
        <main className="min-h-screen flex flex-col items-center bg-gray-900 text-white p-6">
            <header className="w-full max-w-2xl flex flex-col gap-2 mb-8 text-center">
                <h1 className="text-2xl font-bold text-brand-teal uppercase tracking-widest">Final Challenge: Level {level}</h1>
                <p className="text-gray-400">{challenge.title}</p>
                <div className="w-full bg-gray-800 h-1 mt-4 rounded-full">
                    <div className="bg-brand-teal h-full transition-all duration-500" style={{ width: `${((currentStep) / challenge.steps.length) * 100}%` }}></div>
                </div>
                <div className="w-full bg-gray-800 h-1 mt-4 rounded-full">
                    <div className="bg-brand-teal h-full transition-all duration-500" style={{ width: `${((currentStep) / challenge.steps.length) * 100}%` }}></div>
                </div>
                <label className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-2 cursor-pointer hover:text-gray-300">
                    <input
                        type="checkbox"
                        checked={autoRecord}
                        onChange={(e) => setAutoRecord(e.target.checked)}
                        className="w-3 h-3 rounded bg-gray-700 border-gray-600 text-brand-teal focus:ring-brand-teal"
                    />
                    <span>Auto-Record</span>
                </label>
            </header>

            <div className="flex-1 w-full max-w-md flex flex-col items-center justify-center gap-8">

                <div className="text-center space-y-4">
                    <p className="text-sm font-bold text-brand-orange uppercase">Situation</p>
                    <h2 className="text-3xl font-bold leading-tight">{step.prompt}</h2>
                    {!isRevealed && <p className="text-gray-500 italic mt-2">Hint: {step.hint}</p>}
                </div>

                <div className="w-full bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <AudioRecorder
                        onRecordingComplete={() => setHasRecorded(true)}
                        autoStart={autoRecord}
                        nativeAudioSrc={`/api/tts?text=${encodeURIComponent(step.expected)}`}
                    />
                </div>

                <div className="w-full">
                    {!isRevealed ? (
                        <button
                            onClick={() => setIsRevealed(true)}
                            disabled={!hasRecorded}
                            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${hasRecorded ? 'bg-brand-teal text-white hover:bg-opacity-90' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                }`}
                        >
                            {hasRecorded ? "Evaluate Myself" : "Record First"}
                        </button>
                    ) : (
                        <div className="bg-gray-800 p-6 rounded-xl w-full animate-in fade-in slide-in-from-bottom-4">
                            <p className="text-gray-400 text-xs uppercase font-bold mb-2">Expected Response</p>
                            <p className="text-xl font-medium text-white mb-6">{step.expected}</p>

                            <p className="text-center text-gray-400 mb-4">Did you communicate this effectively?</p>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => handleNext(false)} className="py-3 bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg hover:bg-red-500/30">No</button>
                                <button onClick={() => handleNext(true)} className="py-3 bg-green-500/20 text-green-300 border border-green-500/50 rounded-lg hover:bg-green-500/30">Yes</button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </main>
    );
}
