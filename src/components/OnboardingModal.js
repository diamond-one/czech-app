'use client';

import { useState, useEffect } from 'react';

export default function OnboardingModal() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const hasVisited = localStorage.getItem('czech-app-visited');
        if (!hasVisited) {
            setIsOpen(true);
        }
    }, []);

    const handleStart = () => {
        setIsOpen(false);
        localStorage.setItem('czech-app-visited', 'true');
        // Play a welcome sound?
        import('../utils/SoundManager').then(m => m.default.playClick());
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border-4 border-brand-blue transform transition-all scale-100">
                <div className="w-16 h-16 bg-brand-yellow rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-md">
                    👋
                </div>

                <h2 className="text-2xl font-bold text-gray-800 mb-2">Vítejte! (Welcome)</h2>
                <p className="text-gray-600 mb-6 leading-relaxed">
                    This app is different.
                    <br /><br />
                    <strong>1. Speak Aloud:</strong> You must actually say the phrases.
                    <br />
                    <strong>2. Be Honest:</strong> You grade yourself.
                    <br />
                    <strong>3. Patterns First:</strong> You'll learn grammar by use, not rules.
                </p>

                <button
                    onClick={handleStart}
                    className="w-full py-3 bg-brand-blue text-white font-bold rounded-xl shadow-lg hover:bg-opacity-90 hover:scale-[1.02] transition-all"
                >
                    Let's Start Speaking
                </button>
            </div>
        </div>
    );
}
