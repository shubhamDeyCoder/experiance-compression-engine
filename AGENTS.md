# Next.js Agent Rules

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from previous versions.

Before writing any code, read the relevant guide in `node_modules/next/dist/docs/`, resolved from this file's directory. In monorepos, the `next` package may not be visible from the repository root. Follow all deprecation notices.

This block is written and re-added by `next dev`. Verify the behavior in `node_modules/next/dist/server/lib/generate-agent-files.js`.

Removing this block from a diff only causes it to be recreated as an uncommitted change. Commit `AGENTS.md` with this block to keep the working tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass.

When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the working tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues, including:

- Crashes, hangs, out-of-memory errors, or unexpected slowness.
- Incorrect behavior, output, errors, or diagnostics.
- Missing, unclear, or conflicting documentation.
- Unexpected CLI, codemod, skill, or upgrade behavior and non-obvious workarounds.

Continue the current request without reporting immediately. Routine debugging is not feedback.

Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around. Record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, execute the following command from this file's directory, without piping or truncating its output:

```bash
npx --no-install next internal agent-feedback-instructions
```

Run it once and follow its output or error guidance. If a network sandbox blocks it, retry with network access. If it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->
