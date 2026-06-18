# CI Snapshot

> **Generated**: [DATE]
> **PR**: #[NUMBER]
> **Commit**: [SHA]

## Status

| Job | Status |
|---|---|
| backend | ✅ |
| frontend | ✅ |
| docker | ✅ |
| security | ✅ |

## Details

- **Tests**: 855 passing
- **Lint**: Clean
- **Typecheck**: Clean
- **Build**: Clean
- **Secret Scan**: No secrets detected
- **Demo Safety**: Live flags blocked

## Verification

```bash
gh pr view [NUMBER] --json statusCheckRollup
```
