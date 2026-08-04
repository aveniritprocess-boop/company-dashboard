import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken, isAdminLevel } from '@/lib/auth-middleware';

interface Cache {
  counts: {
    employees: number;
    tasks: number;
    projects: number;
    teams: number;
    auditLogs: number;
    notifications: number;
    attendance: number;
  } | null;
  lastUpdated: number;
}

const cache: Cache = {
  counts: null,
  lastUpdated: 0,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // 1. Verify token and authorize CEO/Admin
    const user = await verifyFirebaseToken(request);
    if ('error' in user) {
      return NextResponse.json({ error: user.error }, { status: user.status });
    }

    if (!isAdminLevel(user.role)) {
      return NextResponse.json({ error: 'Forbidden: Only CEO or Admin can access monitoring stats' }, { status: 403 });
    }

    const now = Date.now();
    if (cache.counts && (now - cache.lastUpdated < CACHE_TTL)) {
      return NextResponse.json({ counts: cache.counts, cached: true });
    }

    // 2. Perform aggregate count queries using the Admin SDK
    const [
      employeesSnap,
      tasksSnap,
      projectsSnap,
      teamsSnap,
      auditLogsSnap,
      notificationsSnap,
      attendanceSnap,
    ] = await Promise.all([
      adminDb.collection('users').count().get(),
      adminDb.collection('tasks').count().get(),
      adminDb.collection('projects').count().get(),
      adminDb.collection('teams').count().get(),
      adminDb.collection('audit_logs').count().get(),
      adminDb.collection('notifications').count().get(),
      adminDb.collectionGroup('attendance').count().get(),
    ]);

    const counts = {
      employees: employeesSnap.data().count,
      tasks: tasksSnap.data().count,
      projects: projectsSnap.data().count,
      teams: teamsSnap.data().count,
      auditLogs: auditLogsSnap.data().count,
      notifications: notificationsSnap.data().count,
      attendance: attendanceSnap.data().count,
    };

    // 3. Cache the counts
    cache.counts = counts;
    cache.lastUpdated = now;

    return NextResponse.json({ counts, cached: false });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Failed to fetch monitoring stats:", error);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
