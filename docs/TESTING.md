# Testing Strategy & E2E Verification

## Testing Hierarchy
1. **Type Checking**: `npx tsc --noEmit`
2. **Database Field Audits**: `node scripts/verify_employee_directory_fields.js`
3. **Role & Pipeline Verifications**: `node scripts/verify_all_roles_and_pipeline.js`
4. **E2E Playwright Browser Tests**: `node scripts/verify_all_routes_e2e.js`
5. **Task Creation & Receipt Tests**: `node scripts/verify_task_creation_and_receipt.js`
