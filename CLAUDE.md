# CLAUDE.md

Instructions for Claude Code when working in this repository (Karate Event App — React Native + Supabase). Follow these before any project-specific request in a prompt or issue.

## Project context (read once, don't re-derive)

- Mobile app: React Native (Expo), iOS + Android, offline-first (WatermelonDB/RxDB over SQLite).
- Backend: Supabase (Postgres + Auth + Realtime + Edge Functions), RLS-scoped per event role (Organizer / Tournament Director / Scorekeeper). Clubs register via a tokenized public link with no account.
- Design tokens live in `DESIGN.md` — use those values, don't invent new colors/spacing/type sizes.
- Full specs live in the project's PRD and technical-spec docs — check those before assuming a requirement; don't guess at business logic (bracket formats, retention window, scoring rules) that's already written down.

## Token efficiency

- **Don't read a whole file to change one function.** Search/grep for the relevant symbol first; open only the range you need.
- **Don't print full file contents back in chat/commit messages** when a diff or a one-line pointer says the same thing.
- **Don't re-explain the plan after every step.** State the plan once, then execute; a short one-line status per step is enough.
- **Don't re-read files you already have open in context** in the same session unless they've changed on disk.
- **Batch related edits** into one pass over a file instead of multiple round-trips for adjacent lines.
- **Skip preamble.** No "I'll now..." / "Let me..." narration before tool calls — just do the thing, then report what changed.
- When a task is genuinely simple (rename, one-line fix), don't produce a multi-paragraph writeup — one sentence and the diff is enough.

## Clean code

- **No dead code.** Delete unused imports, variables, functions, and commented-out blocks — don't leave them "just in case."
- **No redundant comments.** A comment should explain *why*, never restate *what* the code already says (`// increment i` above `i++` is noise, not documentation).
- **Match existing patterns.** Before introducing a new utility, hook, or pattern, check if one already exists in the codebase and reuse it — don't create a second way to do the same thing.
- **Small, single-purpose functions/components.** If a function needs a comment to explain its sections, it should probably be split.
- **Types over comments.** Prefer a precise TypeScript type/interface to a comment describing the shape of something.
- **No speculative abstraction.** Don't build a generic/configurable version of something for a future case that doesn't exist yet — solve the current requirement plainly.
- **Consistent naming.** Match the casing and naming conventions already in the file/module you're editing rather than introducing your own style.
- **Delete, don't comment out.** If code is being replaced, remove the old version — git history is the backup, not a commented block.

## Do

- Run the linter/formatter and fix what it flags before considering a change done.
- Keep diffs scoped to the request — don't reformat or refactor unrelated code in the same change.
- Write self-explanatory code first; add a comment only where the *reason* for a decision isn't obvious from reading it (a workaround, a non-obvious constraint, a reference to the spec section it implements).
- Flag ambiguity against the spec/PRD explicitly rather than silently picking an interpretation for anything security- or data-retention-related (auth, RLS policies, the purge job).
- Prefer editing an existing file over creating a new one, unless the new concern genuinely doesn't belong anywhere that exists.

## Don't

- Don't add a new dependency for something a few lines of code or an existing dependency already covers.
- Don't add defensive code (extra null checks, try/catch swallowing errors) for cases that can't actually happen given the types — it hides real bugs instead of preventing them.
- Don't leave `console.log` / debug statements in committed code.
- Don't write a docstring/comment block for a function whose name and types already make its behavior obvious.
- Don't restate the task back in full before doing it — assume the person read their own request.
- Don't generate placeholder/mock data logic that could be mistaken for the real thing — if something isn't implemented yet, say so plainly rather than stubbing it silently.
- Don't touch `DESIGN.md`, migration files, or RLS policies as a side effect of an unrelated change — those need their own deliberate, called-out change.
