export const calculateNextReview = (quality, lastInterval = 0, lastEase = 2.5) => {
    let interval;
    let ease = lastEase;

    // Quality: 0-5
    // 5 - perfect response
    // 4 - correct response after a hesitation
    // 3 - correct response recalled with serious difficulty
    // 2 - incorrect response; where the correct one seemed easy to recall
    // 1 - incorrect response; the correct one remembered
    // 0 - complete blackout.

    if (quality < 3) {
        interval = 1; // Reset to 1 day on fail (or could be 0 for same-day review)
    } else {
        if (lastInterval === 0) {
            interval = 1;
        } else if (lastInterval === 1) {
            interval = 6;
        } else {
            interval = Math.round(lastInterval * lastEase);
        }

        // Update ease based on SM-2 formula
        // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        ease = lastEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (ease < 1.3) ease = 1.3;
    }

    return { interval, ease };
};
