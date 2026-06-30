/* eslint-disable */
import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Firestore } from "firebase/firestore";
import { readFileSync } from "fs";

export const PROJECT_ID = "avenir-portal-rules-test";
let testEnv: RulesTestEnvironment | null = null;

export async function initTestEnv() {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync("firestore.rules", "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  }
  return testEnv;
}

export function getAuthedDb(uid: string | null, customClaims?: Record<string, any>): any {
  if (!testEnv) {
    throw new Error("Test environment not initialized. Call initTestEnv() first.");
  }
  if (uid) {
    return testEnv.authenticatedContext(uid, customClaims).firestore();
  } else {
    return testEnv.unauthenticatedContext().firestore();
  }
}

export function getAdminDb(): any {
  if (!testEnv) {
    throw new Error("Test environment not initialized. Call initTestEnv() first.");
  }
  return testEnv.withSecurityRulesDisabled((context: any) => context.firestore());
}

export async function seedUser(
  adminDb: any,
  uid: string,
  data: Record<string, any>
) {
  const ref = doc(adminDb as Firestore, "users", uid);
  await setDoc(ref, {
    uid,
    is_active: true,
    is_locked: false,
    is_deleted: false,
    portal_access: true,
    role: "employee",
    email: `${uid}@example.com`,
    name: uid,
    ...data,
  });
}

export async function seedTask(
  adminDb: any,
  taskId: string,
  data: Record<string, any>
) {
  const ref = doc(adminDb as Firestore, "tasks", taskId);
  await setDoc(ref, {
    taskText: "Test Task",
    description: "Description",
    assignedTo: "employee1",
    assignedBy: "manager1",
    assigned_to: "employee1",
    assigned_by: "manager1",
    createdAt: new Date(),
    status: "pending",
    ...data,
  });
}

export async function seedProject(
  adminDb: any,
  projectId: string,
  data: Record<string, any>
) {
  const ref = doc(adminDb as Firestore, "projects", projectId);
  await setDoc(ref, {
    name: "Test Project",
    teamId: "team1",
    createdBy: "manager1",
    status: "active",
    ...data,
  });
}

export async function seedTeam(
  adminDb: any,
  teamId: string,
  data: Record<string, any>
) {
  const ref = doc(adminDb as Firestore, "teams", teamId);
  await setDoc(ref, {
    name: "Test Team",
    createdBy: "manager1",
    memberUids: [],
    ...data,
  });
}
