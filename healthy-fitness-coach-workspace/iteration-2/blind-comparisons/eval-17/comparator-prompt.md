# Blind comparison prompt

Compare candidate A at `candidate-a/submission.md` with candidate B at `candidate-b/submission.md`.

Task: assess two analyses from synthetic partial data with a 58-hour cache, an unknown-source warning, a filtered Garmin count, and one comparable lift. Consider confidence boundaries, fact/inference/uncertainty separation, Garmin exclusion, bounded adjustments, and a verification step. Judge output quality only. Read no files other than the two named candidate submissions and this prompt.

Write `comparison.json` and `audit.md` in this directory. The audit must list only the neutral candidate files read and concise quality reasoning. Do not infer or name a hidden identity.
