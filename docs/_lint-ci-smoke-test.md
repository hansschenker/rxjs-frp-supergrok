# Lint CI Smoke Test

This is a temporary file used to verify the markdown-lint CI workflow.
It intentionally contains a **bare code fence** (no language identifier), which
should trip markdownlint rule **MD040** and make the CI check fail.

```
const x = 1; // this fence has no language label on purpose
```

If the markdownlint check fails on this PR, the workflow is working.
This file and branch will be deleted afterward.
