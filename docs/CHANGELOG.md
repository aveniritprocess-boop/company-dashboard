# Changelog

All notable changes to the Company Portal project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-08-04

### Added
- Granted `md` (Managing Director) role 100% permission parity with `ceo` across all features, navigation links, widget actions, and API middleware.
- Exported `isCEOorMD` and `isAdminLevel` helper functions in `lib/auth-middleware.ts`.
- Added fallback fetching via `getAllUsers()` in `CreateTaskModal.tsx` when `users` prop is unpopulated.

### Fixed
- Fixed MD (`avenirdps@gmail.com`) login failure caused by strict `isCEO()` check in `firestore.rules`.
- Fixed empty permission object computation for MD users in `components/AuthProvider.tsx`.
- Fixed false client-side signout redirects in `DashboardClientLayout.tsx` during initial auth state hydration.
- Fixed Assignee dropdown population in `MultiSelect` to properly display all active team members.

### Security
- Verified that `employee_directory` collection exposes only safe non-sensitive profile fields (`uid`, `name`, `displayName`, `email`, `role`, `department`, `designation`, `profile_photo`, `status`, `portal_access`, `is_active`).

---

## [1.0.0] - 2026-08-01
- Initial production release of Avenir Company Dashboard portal.
