# Task 3: Implement the Skill V2 behavior layer

## Goal

Upgrade the existing `healthy-fitness-coach` Skill without renaming it or weakening V1 safety. Add deterministic output routing, optional Xunji use, eight-dimensional analysis, evidence-aware web research, and a complete Markdown report template. Make all V2 behavior contracts GREEN while keeping the entrypoint concise and progressively disclosed.

## Scope and files

- Update `healthy-fitness-coach/SKILL.md` and `healthy-fitness-coach/agents/openai.yaml`.
- Add:
  - `references/output-routing.md`
  - `references/output-routing.js`
  - `references/xunji-integration.md`
  - `references/multidimensional-analysis.md`
  - `references/web-research.md`
  - `assets/fitness-analysis-report-template.md`
- Add focused Skill behavior/static tests under `tests/` before editing production Skill files.
- Keep `SKILL.md` below 500 lines and preserve its existing `name: healthy-fitness-coach`.

## Output routing contract

Implement `routeOutput({taskType,userInstruction})` as a small deterministic CommonJS helper returning exactly `{mode, reason, override}`.

- Default `conversation`: `today_workout`, `set_by_set_coaching`, exercise/form adjustment, immediate symptom/safety routing.
- Default `markdown`: `training_plan`, `weekly_review`, `monthly_review`, `training_data_analysis`, reusable plan/report/profile artifacts.
- Explicit Chinese/English-equivalent commands take precedence:
  - “直接出报告” -> Markdown, override `direct_report`.
  - “进入跟练” -> conversation, override `enter_tracking`.
  - “保存刚才内容” -> Markdown, override `save_prior_content`.
- Normalize reasonable spacing/punctuation variants; do not over-match unrelated text.
- Skill instructions must require creating a real `.md` file in the current workspace when write tools exist. If writes are unavailable, return the complete Markdown and state that no file was created.
- Do not ask a modal/popup question by default. Ask only if the user explicitly requests mode selection or the requested artifact cannot be inferred safely.

## Xunji integration behavior

- The Skill works standalone. If the two Xunji tools are available and the user asks to analyze their recorded training, use the smallest date range needed, cache-first through the MCP.
- Never ask the user to paste an API key into chat. For missing credentials, point to the local interactive DPAPI setup script without exposing an absolute machine-specific path in packaged instructions.
- Treat the connector as read-only; never claim to edit or write back Xunji records.
- Preserve record IDs, train-time tokens, raw text, cache freshness, warnings, parse confidence, and data range in analysis/report evidence.
- Do not send Garmin-source data into model analysis. Respect connector warnings; if source cannot be identified, explicitly lower confidence and avoid source-sensitive conclusions.
- When tools are absent, accept pasted/exported training text or proceed with a manual log; clearly label the evidence boundary.
- Do not introduce any credential, real training record, or live API call.

## Eight-dimensional analysis

Create an executable decision matrix covering exactly these dimensions:

1. adherence and frequency;
2. volume and effective sets;
3. intensity/proximity to failure and effort quality;
4. performance/progressive overload under comparable conditions;
5. movement and muscle-pattern balance;
6. recovery/readiness (sleep, soreness, stress, session duration/rest);
7. pain, technique, and safety signals;
8. nutrition/body-composition context aligned with the user's goal.

For each dimension define: required inputs, calculation/observation method, comparison window, confidence downgrade rules, interpretation limits, and allowed action. Enforce:

- Compare same movement and similar conditions; volume is not stimulus quality.
- One session never proves a plateau.
- 2–3 weeks supports only a preliminary trend.
- At least 4 weeks before comparing training amount/frequency.
- At least 8 weeks before long-term plateau/cycle claims.
- Change at most 1–2 variables per iteration; preserve what is working.
- Separate facts, inferences, uncertainty, and recommended verification metrics.
- Safety screening and symptom escalation always outrank optimization.

## Evidence-aware web research

- Browse only when the user asks for current research/creator claims/product/API changes, provides a webpage, or current facts materially affect the answer. Personal training analysis does not require browsing by default.
- Prefer fetching a known public page, then search for discovery. Prefer primary research/official documentation; label creator content as experience-level evidence and cross-check it against higher-grade evidence.
- For login-gated platforms such as Xiaohongshu: try an installed authorized connector or user-authorized browser, then accept screenshots/pasted text. Never bypass login, CAPTCHA, robots, or anti-scraping controls; never build a crawler.
- When a requested creator/page is inaccessible, say what was and was not verified and avoid inventing a distilled claim.
- Keep the V1 creator cards as reusable principles, applicability, execution, risks, source mapping, and conflict resolution—not persona imitation or copied templates.

## Report template

The Markdown template must contain:

- title, generated date, user goal/context;
- core conclusions first;
- data scope, dates, cache freshness, source, missingness;
- data quality and confidence level;
- eight-dimensional analysis table;
- what to preserve;
- at most two adjustments, each with reason, exact change, risk, and stop/revert condition;
- next-cycle plan;
- measurable validation indicators and next review date/window;
- safety notes and data-source/privacy statement;
- clear labels for facts, inferences, uncertainties, and external evidence/citations.

The Skill should choose a concise safe filename and avoid overwriting an unrelated existing file; if a name exists, add a date/time or numeric suffix.

## V1 compatibility and tests

1. Before implementation, add/extend tests that fail for missing routing module/docs/template and required semantics.
2. Make the three existing routing contracts GREEN.
3. Validate frontmatter/YAML, reference links, line count, output-mode instructions, eight dimensions/windows, max-two-adjustment rule, Xunji no-key-in-chat/read-only/degrade behavior, web/login safety, and report sections.
4. Run all six V1 safety eval-manifest checks and the existing Skill validator.
5. Run connector `npm test` to ensure no regression, V2 contracts, snapshot verification, secret scan, and `git diff --check`.
6. Do not run a real Skill eval/baseline comparison in this task; that is Task 5.
7. Commit with subject `feat: add fitness coach v2 report and analysis workflow` and write `.superpowers/sdd/task-3-report.md` with RED/GREEN evidence.

## Out of scope

- Plugin manifest/package copies and installation guide (Task 4).
- Real Xunji API smoke test.
- Keep API, Xiaohongshu crawler, custom login bypass, cloud storage, write-back.
- Medical diagnosis, PED protocols, extreme dieting, or unsafe training advice.
