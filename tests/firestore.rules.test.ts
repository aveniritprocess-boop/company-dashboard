/* eslint-disable */
import { describe, beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, serverTimestamp } from "firebase/firestore";
import { 
  initTestEnv, 
  getAuthedDb, 
  getAdminDb, 
  seedUser, 
  seedTask, 
  seedProject, 
  seedTeam 
} from "./helpers/firestoreTestUtils";

describe("Firestore Security Rules Tests", () => {
  beforeAll(async () => {
    await initTestEnv();
  });

  beforeEach(async () => {
    const adminDb = getAdminDb();
    // Clean up or clear is done by vitest automatically if clearFirestore is called.
    const testEnv = await initTestEnv();
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    const testEnv = await initTestEnv();
    await testEnv.cleanup();
  });

  // Helper to assert promise rejection (rules deny)
  async function assertDenied(promise: Promise<any>) {
    await expect(promise).rejects.toThrow();
  }

  // Helper to assert promise resolution (rules allow)
  async function assertAllowed(promise: Promise<any>) {
    await expect(promise).resolves.not.toThrow();
  }

  describe("Active User Gate (Recommendation 9)", () => {
    it("allows reads/writes for active users", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "active_user", { is_active: true, role: "employee" });
      
      const db = getAuthedDb("active_user");
      await assertAllowed(getDoc(doc(db, "users", "active_user")));
    });

    it("denies reads/writes for is_active = false users", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "inactive_user", { is_active: false, role: "employee" });
      
      const db = getAuthedDb("inactive_user");
      await assertDenied(getDoc(doc(db, "users", "inactive_user")));
    });

    it("denies reads/writes for is_locked = true users", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "locked_user", { is_active: true, is_locked: true, role: "employee" });
      
      const db = getAuthedDb("locked_user");
      await assertDenied(getDoc(doc(db, "users", "locked_user")));
    });

    it("denies reads/writes for is_deleted = true users", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "deleted_user", { is_active: true, is_deleted: true, role: "employee" });
      
      const db = getAuthedDb("deleted_user");
      await assertDenied(getDoc(doc(db, "users", "deleted_user")));
    });

    it("denies reads/writes for portal_access = false users", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "no_portal_user", { is_active: true, portal_access: false, role: "employee" });
      
      const db = getAuthedDb("no_portal_user");
      await assertDenied(getDoc(doc(db, "users", "no_portal_user")));
    });
  });

  describe("Attendance Rules", () => {
    it("allows employees to read/write their own attendance", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      
      const db = getAuthedDb("employee1");
      const attDocRef = doc(db, "users", "employee1", "attendance", "session1");
      
      await assertAllowed(setDoc(attDocRef, { clockInAt: new Date(), status: "active" }));
      await assertAllowed(getDoc(attDocRef));
      await assertAllowed(updateDoc(attDocRef, { clockOutAt: new Date(), status: "completed" }));
    });

    it("denies employees from reading/writing other employees' attendance", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      await seedUser(adminDb, "employee2", { role: "employee" });
      
      const db = getAuthedDb("employee2"); // employee2 trying to write employee1's attendance
      const attDocRef = doc(db, "users", "employee1", "attendance", "session1");
      
      await assertDenied(setDoc(attDocRef, { clockInAt: new Date(), status: "active" }));
      await assertDenied(getDoc(attDocRef));
    });

    it("allows managers to view and edit attendance only for direct reports", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "manager1", { role: "manager" });
      // employee1 reports to manager1
      await seedUser(adminDb, "employee1", { role: "employee", reporting_manager_id: "manager1" });
      // employee2 does not report to manager1
      await seedUser(adminDb, "employee2", { role: "employee", reporting_manager_id: "manager2" });
      
      const db = getAuthedDb("manager1");
      const attReportRef = doc(db, "users", "employee1", "attendance", "session1");
      const attNonReportRef = doc(db, "users", "employee2", "attendance", "session2");
      
      // manager1 should access employee1's attendance
      await assertAllowed(setDoc(attReportRef, { clockInAt: new Date(), status: "active" }));
      await assertAllowed(getDoc(attReportRef));
      
      // manager1 should NOT access employee2's attendance
      await assertDenied(setDoc(attNonReportRef, { clockInAt: new Date(), status: "active" }));
      await assertDenied(getDoc(attNonReportRef));
    });
  });

  describe("Todo Ownership Rules", () => {
    it("allows users to read/write their own todos", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      
      const db = getAuthedDb("employee1");
      const todoRef = doc(db, "users", "employee1", "todos", "todo1");
      
      await assertAllowed(setDoc(todoRef, { task: "My Todo", completed: false }));
      await assertAllowed(getDoc(todoRef));
    });

    it("denies users from reading/writing other users' todos", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      await seedUser(adminDb, "employee2", { role: "employee" });
      
      const db = getAuthedDb("employee2");
      const todoRef = doc(db, "users", "employee1", "todos", "todo1");
      
      await assertDenied(setDoc(todoRef, { task: "Stolen Todo", completed: false }));
      await assertDenied(getDoc(todoRef));
    });
  });

  describe("Task Comments rules", () => {
    it("allows users who can read the parent task to create task comments", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      await seedUser(adminDb, "manager1", { role: "manager" });
      await seedTask(adminDb, "task1", { assignedTo: "employee1", assignedBy: "manager1" });
      
      const db = getAuthedDb("employee1");
      const commentRef = doc(db, "tasks", "task1", "comments", "comment1");
      
      await assertAllowed(setDoc(commentRef, { commentedBy: "employee1", comment: "Hello" }));
      await assertAllowed(getDoc(commentRef));
    });

    it("denies users who cannot read the parent task from posting/reading comments", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      await seedUser(adminDb, "employee2", { role: "employee" });
      await seedTask(adminDb, "task1", { assignedTo: "employee1", assignedBy: "manager1" });
      
      const db = getAuthedDb("employee2"); // employee2 has no association with task1
      const commentRef = doc(db, "tasks", "task1", "comments", "comment1");
      
      await assertDenied(setDoc(commentRef, { commentedBy: "employee2", comment: "Hijacked comment" }));
      await assertDenied(getDoc(commentRef));
    });

    it("only permits the comment author or admin to update/delete comments", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      await seedUser(adminDb, "employee2", { role: "employee" });
      await seedTask(adminDb, "task1", { assignedTo: ["employee1", "employee2"], assignedBy: "manager1" });
      
      // Seed comment as employee1
      const commentRefAdmin = doc(adminDb, "tasks", "task1", "comments", "comment1");
      await setDoc(commentRefAdmin, { commentedBy: "employee1", comment: "First post" });
      
      // employee2 trying to edit employee1's comment -> Denied
      const db2 = getAuthedDb("employee2");
      const commentRefUser2 = doc(db2, "tasks", "task1", "comments", "comment1");
      await assertDenied(updateDoc(commentRefUser2, { comment: "Edited by stranger" }));
      
      // employee1 editing own comment -> Allowed
      const db1 = getAuthedDb("employee1");
      const commentRefUser1 = doc(db1, "tasks", "task1", "comments", "comment1");
      await assertAllowed(updateDoc(commentRefUser1, { comment: "Edited by author" }));
    });
  });

  describe("Teams & Projects visibility", () => {
    it("allows team members to read team and projects", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      await seedTeam(adminDb, "team1", { memberUids: ["employee1"] });
      await seedProject(adminDb, "project1", { teamId: "team1" });
      
      const db = getAuthedDb("employee1");
      await assertAllowed(getDoc(doc(db, "teams", "team1")));
      await assertAllowed(getDoc(doc(db, "projects", "project1")));
    });

    it("denies non-members from reading team and projects", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      await seedUser(adminDb, "employee2", { role: "employee" });
      await seedTeam(adminDb, "team1", { memberUids: ["employee1"] });
      await seedProject(adminDb, "project1", { teamId: "team1" });
      
      const db = getAuthedDb("employee2"); // employee2 is not in team1
      await assertDenied(getDoc(doc(db, "teams", "team1")));
      await assertDenied(getDoc(doc(db, "projects", "project1")));
    });
  });

  describe("Invitations Acceptance rules", () => {
    it("allows recipient to update only status field", async () => {
      const adminDb = getAdminDb();
      const inviteRefAdmin = doc(adminDb, "invites", "invite1");
      await setDoc(inviteRefAdmin, {
        email: "employee1@example.com",
        role: "employee",
        status: "pending"
      });
      
      const db = getAuthedDb("employee1", { email: "employee1@example.com" });
      const inviteRef = doc(db, "invites", "invite1");
      
      // Recipient can read invite
      await assertAllowed(getDoc(inviteRef));
      
      // Recipient accepts by modifying status -> Allowed
      await assertAllowed(updateDoc(inviteRef, { status: "accepted" }));
      
      // Recipient attempts to modify role or email -> Denied
      await assertDenied(updateDoc(inviteRef, { role: "admin" }));
    });
  });

  describe("Notifications privacy rules (Recommendation 11)", () => {
    it("allows users to read/update/delete their own notifications", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      
      const notifRefAdmin = doc(adminDb, "notifications", "notif1");
      await setDoc(notifRefAdmin, { userId: "employee1", title: "Task Alert", read: false });
      
      const db = getAuthedDb("employee1");
      const notifRef = doc(db, "notifications", "notif1");
      
      await assertAllowed(getDoc(notifRef));
      await assertAllowed(updateDoc(notifRef, { read: true }));
      await assertAllowed(deleteDoc(notifRef));
    });

    it("denies users from reading or altering other users' notifications", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      await seedUser(adminDb, "employee2", { role: "employee" });
      
      const notifRefAdmin = doc(adminDb, "notifications", "notif1");
      await setDoc(notifRefAdmin, { userId: "employee1", title: "Task Alert", read: false });
      
      const db = getAuthedDb("employee2");
      const notifRef = doc(db, "notifications", "notif1");
      
      await assertDenied(getDoc(notifRef));
      await assertDenied(updateDoc(notifRef, { read: true }));
    });
  });

  describe("Audit Logs Security Rules (Phase 5.1)", () => {
    it("allows CEO full access to read/write/delete audit logs", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "ceo1", { role: "ceo" });
      
      const db = getAuthedDb("ceo1");
      const logRef = doc(db, "audit_logs", "log_ceo");
      
      await assertAllowed(setDoc(logRef, {
        action: "employee_created",
        performedBy: "ceo1",
        performedByName: "CEO One",
        targetId: "employee1",
        targetType: "user",
        createdAt: serverTimestamp()
      }));
      await assertAllowed(getDoc(logRef));
      await assertAllowed(deleteDoc(logRef));
    });

    it("allows Admin and HR to read but not update/delete audit logs", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "admin1", { role: "admin" });
      await seedUser(adminDb, "hr1", { role: "hr" });
      
      const logRefAdmin = doc(adminDb, "audit_logs", "log1");
      await setDoc(logRefAdmin, {
        action: "employee_created",
        performedBy: "ceo1",
        performedByName: "CEO One",
        targetId: "employee1",
        targetType: "user",
        createdAt: new Date()
      });
      
      // Admin read allowed
      const dbAdmin = getAuthedDb("admin1");
      await assertAllowed(getDoc(doc(dbAdmin, "audit_logs", "log1")));
      await assertDenied(updateDoc(doc(dbAdmin, "audit_logs", "log1"), { action: "hacked" }));
      await assertDenied(deleteDoc(doc(dbAdmin, "audit_logs", "log1")));

      // HR read allowed
      const dbHR = getAuthedDb("hr1");
      await assertAllowed(getDoc(doc(dbHR, "audit_logs", "log1")));
      await assertDenied(updateDoc(doc(dbHR, "audit_logs", "log1"), { action: "hacked" }));
      await assertDenied(deleteDoc(doc(dbHR, "audit_logs", "log1")));
    });

    it("denies employees from reading, updating, or deleting audit logs", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      
      const logRefAdmin = doc(adminDb, "audit_logs", "log1");
      await setDoc(logRefAdmin, {
        action: "employee_created",
        performedBy: "ceo1",
        performedByName: "CEO One",
        targetId: "employee1",
        targetType: "user",
        createdAt: new Date()
      });
      
      const db = getAuthedDb("employee1");
      await assertDenied(getDoc(doc(db, "audit_logs", "log1")));
      await assertDenied(updateDoc(doc(db, "audit_logs", "log1"), { action: "hacked" }));
      await assertDenied(deleteDoc(doc(db, "audit_logs", "log1")));
    });

    it("allows employees to create audit logs only if they are the performing user and timestamps are valid", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "employee1", { role: "employee" });
      
      const db = getAuthedDb("employee1");
      
      // Creating log matching self (performedBy) with server timestamp -> Allowed
      await assertAllowed(addDoc(collection(db, "audit_logs"), {
        action: "leave_request_submitted",
        performedBy: "employee1",
        performedByName: "Employee One",
        targetId: "leave1",
        targetType: "leave",
        createdAt: serverTimestamp()
      }));

      // Creating log matching self (operator_id) with server timestamp -> Allowed
      await assertAllowed(addDoc(collection(db, "audit_logs"), {
        action: "leave_request_submitted",
        operator_id: "employee1",
        operator_name: "Employee One",
        target_id: "leave1",
        timestamp: serverTimestamp()
      }));

      // Creating log impersonating someone else (performedBy) -> Denied
      await assertDenied(addDoc(collection(db, "audit_logs"), {
        action: "leave_request_submitted",
        performedBy: "someone_else",
        performedByName: "Someone Else",
        targetId: "leave1",
        targetType: "leave",
        createdAt: serverTimestamp()
      }));

      // Creating log with a forged custom date instead of serverTimestamp -> Denied
      await assertDenied(addDoc(collection(db, "audit_logs"), {
        action: "leave_request_submitted",
        performedBy: "employee1",
        performedByName: "Employee One",
        targetId: "leave1",
        targetType: "leave",
        createdAt: new Date(Date.now() - 3600000) // 1 hour ago
      }));
    });
  });

  describe("Universal Task Role Permission Matrix Tests", () => {
    const roles = ["ceo", "md", "admin", "manager", "team_lead", "hr", "employee"] as const;

    roles.forEach((role) => {
      it(`evaluates universal task creation and permissions for active role: ${role}`, async () => {
        const adminDb = getAdminDb();
        const userId = `user_${role}`;
        await seedUser(adminDb, userId, { role, is_active: true, portal_access: true });
        await seedTask(adminDb, `task_${role}`, {
          taskText: `Test task for ${role}`,
          assignedBy: userId,
          assignedTo: userId,
        });

        const db = getAuthedDb(userId);
        const taskRef = doc(db, "tasks", `task_${role}`);
        const historyRef = doc(db, "tasks", `task_${role}`, "history", "hist1");

        // 1. Read Task
        await assertAllowed(getDoc(taskRef));

        // 2. Add History
        await assertAllowed(setDoc(historyRef, {
          taskId: `task_${role}`,
          message: "Created history",
          performedBy: userId,
          performedByName: role,
          createdAt: serverTimestamp(),
        }));

        // 3. Create Task (Universal for all active roles)
        const newTaskRef = doc(collection(db, "tasks"));
        await assertAllowed(setDoc(newTaskRef, {
          taskText: "Universal task creation test",
          assignedBy: userId,
          assignedTo: userId,
          status: "pending",
          priority: "medium",
          createdAt: serverTimestamp(),
        }));

        // 4. Update Task (Creator or admin/manager allowed)
        await assertAllowed(updateDoc(taskRef, { status: "in_progress" }));

        // 5. Delete Task (Admins/Managers or Creator allowed)
        const canDelete = ["ceo", "md", "admin", "manager"].includes(role);
        const deletePromise = deleteDoc(taskRef);
        if (canDelete) {
          await assertAllowed(deletePromise);
        }
      });
    });

    it("prevents privilege escalation when universal task creation is enabled", async () => {
      const adminDb = getAdminDb();
      await seedUser(adminDb, "emp_attacker", { role: "employee" });
      await seedUser(adminDb, "target_user", { role: "employee" });
      
      const db = getAuthedDb("emp_attacker");

      // Attacker trying to elevate role on target user -> Denied
      await assertDenied(updateDoc(doc(db, "users", "target_user"), { role: "admin" }));

      // Attacker trying to delete target user document -> Denied
      await assertDenied(deleteDoc(doc(db, "users", "target_user")));

      // Attacker trying to delete audit logs -> Denied
      await assertDenied(deleteDoc(doc(db, "audit_logs", "log1")));
    });
  });
});
