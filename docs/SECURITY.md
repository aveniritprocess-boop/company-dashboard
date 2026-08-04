# Security Architecture & Rules

## Overview
This portal uses Firebase Authentication for identity, Firebase Admin SDK in API routes for privileged operations, and Firestore Security Rules for client database access control.

## Security Principles
1. **Zero Data Exposure**: Sensitive employee data (`salary`, `phone`, `address`, `emergency_contact`, `bank_details`, `twoFactorSecret`) is strictly kept inside the `users` collection and NEVER placed into `employee_directory`.
2. **Directory Separation**: All active employees can read `employee_directory` for directory and mention features. Only authorized administrative roles (`ceo`, `md`, `admin`, `manager`, `super_admin`) can query `/users`.
3. **Role Equivalence**: `md` (Managing Director) and `ceo` roles have full administrative parity (`CEO == MD`).
4. **Session Integrity**: Session cookies are verified server-side in Next.js middleware and `layout.tsx`.

## Critical Security Files
- [`firestore.rules`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/firestore.rules)
- [`lib/auth-middleware.ts`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/lib/auth-middleware.ts)
- [`components/AuthProvider.tsx`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/components/AuthProvider.tsx)
- [`middleware.ts`](file:///c:/Users/Himanshu%20sharma/OneDrive/Documents/GitHub/company-dashboard/middleware.ts)
