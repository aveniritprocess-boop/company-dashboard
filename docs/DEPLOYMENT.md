# Deployment & Release Guide

## Deployment Checklist
1. `npx tsc --noEmit` returns 0 errors.
2. `npm run build` succeeds without syntax or SSR errors.
3. All E2E browser tests pass cleanly.
4. Security rules reviewed and verified.
5. Create Git commit and push to `main` branch.
6. Vercel automatically deploys build.
7. Conduct production smoke test on live Vercel URL.
