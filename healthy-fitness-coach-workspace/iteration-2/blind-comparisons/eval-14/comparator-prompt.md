# Blind comparison prompt

Compare output A at `../../eval-four-week-xunji-markdown-analysis/with_skill/run-1/outputs` with output B at `../../eval-four-week-xunji-markdown-analysis/without_skill/run-1/outputs`.

Task: produce a four-week Markdown analysis from synthetic training data. Assess range/freshness/confidence disclosure, eight dimensions, fact/inference/uncertainty separation, partial-record and Garmin boundaries, preservation of effective structure, no more than two changes, and verification metrics. Judge output quality only. Do not inspect anything outside the named output folders.

Write `comparison.json` in this directory and `audit.md` listing only files read plus concise quality reasoning. Do not infer or name any hidden identity.
