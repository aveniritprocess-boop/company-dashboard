# Company Portal Releases & Release Policy (v1.1)

## Release Policy Overview

Before every production deployment, a formal release is created following these standards:

### Release Manifest Requirements
Every release manifest must document:
1. **Release Name & Version** (e.g. `Release v1.0.1 – Post-Deployment Fixes & MD Role Parity`)
2. **Features Included**
3. **Files Changed** (with links)
4. **Database & Rule Changes**
5. **Breaking Changes** (if any)
6. **Rollback Plan**
7. **Risk Level** (🟢 Low / 🟡 Medium / 🔴 High)
8. **Test Evidence** (TypeScript, Build, Rules, E2E, Regression, Manual)
9. **Production Approval Verdict** (🟢 APPROVED FOR DEPLOYMENT)

---

## Release v1.0.1 – Post-Deployment Bug Fixes & MD Role Parity

- **Release Name**: `Release v1.0.1 – Post-Deployment Fixes & MD Role Parity`
- **Date**: 2026-08-04
- **Risk Level**: 🟡 Medium
- **Status**: 🟢 **APPROVED FOR DEPLOYMENT**

### 📌 Features Included
1. **MD (DPS Sir) Account & Role Parity**: Restored login for `avenirdps@gmail.com` and granted 100% permission parity with `ceo` across all features, navigation, widgets, and guards.
2. **Login Pipeline Fix**: Resolved authorization handling in `AuthProvider` and `auth-middleware` so non-CEO administrative roles and `md` sign in without permission errors.
3. **Assignee Dropdown Fix**: Resolved empty user state fallback in `CreateTaskModal.tsx` and option mapping in `multi-select.tsx` to render all active employees (Self + 10 active team members).
4. **Firestore Rules Update**: Updated `isCEO()` in `firestore.rules` to return `isRole('ceo') || isRole('md')` and restricted `/users/{userId}` non-self reads to `isManagerOrAbove()`.
5. **Auth Hydration Safety**: Updated `DashboardClientLayout.tsx` to prevent false client-side logouts during route navigation and initial auth hydration.
6. **Security & Data Exposure Hardening**: Enforced `portal_access !== false && u.is_locked !== true` filtering in `lib/users.ts` and set `<CommandItem value={option.value} keywords={[option.label]}>` in `MultiSelect` to prevent duplicate-name collisions.

### 📌 Files Changed
- [`firestore.rules`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/firestore.rules)
- [`lib/roles.ts`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/lib/roles.ts)
- [`lib/auth-middleware.ts`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/lib/auth-middleware.ts)
- [`lib/users.ts`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/lib/users.ts)
- [`components/AuthProvider.tsx`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/components/AuthProvider.tsx)
- [`components/Sidebar.tsx`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/components/Sidebar.tsx)
- [`components/CommandMenu.tsx`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/components/CommandMenu.tsx)
- [`components/DashboardClientLayout.tsx`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/components/DashboardClientLayout.tsx)
- [`components/tasks/CreateTaskModal.tsx`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/components/tasks/CreateTaskModal.tsx)
- [`components/ui/multi-select.tsx`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/components/ui/multi-select.tsx)
- [`app/dashboard/task-given-by-sir/page.tsx`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/app/dashboard/task-given-by-sir/page.tsx)
- [`app/dashboard/employees/page.tsx`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/app/dashboard/employees/page.tsx)
- [`app/dashboard/locations/page.tsx`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/app/dashboard/locations/page.tsx)
- [`app/dashboard/monitoring/page.tsx`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/app/dashboard/monitoring/page.tsx)
- [`app/dashboard/backup/page.tsx`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/app/dashboard/backup/page.tsx)

### 📌 Database & Rule Changes
- Updated `firestore.rules` helper `isCEO()` to evaluate `isRole('ceo') || isRole('md')`.
- Tightened `/users/{userId}` `allow get:` rule to restrict non-self reads to `isManagerOrAbove()`.

### 📌 Breaking Changes
- **None**.

### 📌 Rollback Plan
1. Revert Git commit to `v1.0.0`.
2. Restore previous `firestore.rules` via `firebase deploy --only firestore:rules`.
3. Redeploy previous Vercel deployment build.

### 📌 Test Evidence
- **TypeScript (`npx tsc --noEmit`)**: ✅ PASS (0 errors)
- **Production Build (`npm run build`)**: ✅ PASS (All 44 pages compiled in 2.0min)
- **Firestore Rules Inspection**: ✅ PASS
- **E2E Playwright Browser Tests**: ✅ PASS (All 4 Roles, 0 permission errors, 0 network 403s)
- **Employee Directory Sensitive Data Audit**: ✅ PASS (0 sensitive fields exposed)
- **Task Creation & Receipt Test**: ✅ PASS
