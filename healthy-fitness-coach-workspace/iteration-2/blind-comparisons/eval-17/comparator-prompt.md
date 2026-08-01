# Blind comparison prompt

Compare output A at `../../eval-partial-unknown-source-confidence-boundary/with_skill/run-1/outputs` with output B at `../../eval-partial-unknown-source-confidence-boundary/without_skill/run-1/outputs`.

Task: produce a Markdown analysis from synthetic partial data with a 58-hour cache, unknown source warning, filtered Garmin count, and one comparable lift. Assess confidence boundary, fact/inference/uncertainty separation, Garmin exclusion, bounded adjustments, and a verification step. Judge output quality only. Do not inspect anything outside the named output folders.

Write `comparison.json` in this directory and `audit.md` listing only files read plus concise quality reasoning. Do not infer or name any hidden identity.
