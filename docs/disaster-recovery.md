# Disaster Recovery & Backup Procedures

This document outlines the Disaster Recovery (DR) plan, Recovery Time Objectives (RTO), Recovery Point Objectives (RPO), and actionable steps to recover the Firestore database from a backup.

## 1. Objectives

- **Recovery Point Objective (RPO)**: 24 Hours. Daily automated backups run at 00:00 UTC. The maximum acceptable data loss in the event of a catastrophic failure is one day's worth of transactions.
- **Recovery Time Objective (RTO)**: 4 Hours. The system should be fully restored and operational within 4 hours of a disaster declaration.
- **Retention Policy**:
  - Daily Backups: Retained for 30 days.
  - Weekly Backups: Retained for 90 days.
  - Monthly Archive: Retained for 365 days.

## 2. Infrastructure Setup
The backup system utilizes native GCP Firestore Exports driven by Firebase Cloud Functions + Cloud Scheduler. 
- **Storage**: Backups are written to `gs://<project-id>-firestore-backups`.
- **IAM Roles**: The Cloud Function service account has `roles/datastore.importExportAdmin` and `roles/storage.admin`.

## 3. Incident Response Checklist

In the event of data corruption, accidental deletion, or catastrophic failure:

- [ ] **Assess the Damage**: Identify which collections or specific documents were impacted. (e.g., using the Audit Logs or Monitoring Dashboard).
- [ ] **Halt Operations**: If the system is actively writing corrupt data, change `firestore.rules` to reject all incoming writes temporarily or toggle "Maintenance Mode" if implemented.
- [ ] **Determine Recovery Scope**: 
  - If a single document is corrupted -> Perform a Single Document Restore.
  - If a collection is dropped -> Perform a Collection Restore.
  - If a global disaster occurred -> Perform a Full Firestore Restore.
- [ ] **Simulate Recovery**: Navigate to the `Backup & Restore` admin dashboard to run a Dry-Run preview to ensure the snapshot contains the correct data.
- [ ] **Execute Recovery**: Deploy the restoration.
- [ ] **Verify Recovery**: Check the `backup-health` and `verify-backup` scripts output to ensure database integrity is restored.
- [ ] **Resume Operations**: Re-enable Firestore write access.

## 4. Recovery Steps

### 4.1. Single Document / Partial Restore (Simulation UI)
Use the `Restore Simulator` within the dashboard to preview a backup. Since native full imports wipe out non-overlapping data, partial restorations are executed safely by downloading the snapshot via the Simulator, querying the specific Document ID, and writing it manually via the UI.

### 4.2. Full Database Restore (Native GCP)
For a complete wipe or corruption, a full GCP restore is required via the `gcloud` CLI.

```bash
# 1. Identify the backup prefix from the Cloud Storage bucket
gsutil ls gs://<your-project-id>-firestore-backups

# 2. Trigger the import process
gcloud firestore import gs://<your-project-id>-firestore-backups/2026-06-01T00:00:00_45624
```

*Note: The import process overrides existing documents but does not delete documents created after the backup timestamp unless explicitly handled.*

## 5. Emergency Contacts
| Role | Contact Name | Phone / Email |
|------|-------------|---------------|
| Lead Engineer | [Admin Name] | admin@company.com |
| GCP Admin | [GCP Lead] | it@company.com |

## 6. Audit Logging
Every backup and restore operation generates an audit event (`backup_started`, `backup_completed`, `restore_started`, `restore_completed`, `restore_failed`). These are stored immutably in the `audit_logs` collection to track all compliance and disaster recovery actions.
