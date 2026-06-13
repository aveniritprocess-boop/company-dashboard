import { doc, getDocs, collection, writeBatch, Firestore } from "firebase/firestore";

export const DEFAULT_ROLES = {
  super_admin: {
    name: "Super Admin",
    is_system: true,
    permissions: {
      view_employees: true,
      add_employees: true,
      edit_employees: true,
      delete_employees: true,
      export_data: true,
      import_data: true,
      view_salary: true,
      manage_payroll: true,
      approve_leave: true,
      manage_attendance: true,
      manage_teams: true,
      manage_projects: true,
      manage_settings: true,
    }
  },
  hr_admin: {
    name: "HR Admin",
    is_system: true,
    permissions: {
      view_employees: true,
      add_employees: true,
      edit_employees: true,
      delete_employees: true,
      export_data: true,
      import_data: true,
      view_salary: false,
      manage_payroll: false,
      approve_leave: true,
      manage_attendance: true,
      manage_teams: true,
      manage_projects: false,
      manage_settings: false,
    }
  },
  hr_executive: {
    name: "HR Executive",
    is_system: true,
    permissions: {
      view_employees: true,
      add_employees: true,
      edit_employees: true,
      delete_employees: false,
      export_data: true,
      import_data: false,
      view_salary: false,
      manage_payroll: false,
      approve_leave: true,
      manage_attendance: true,
      manage_teams: false,
      manage_projects: false,
      manage_settings: false,
    }
  },
  finance: {
    name: "Finance",
    is_system: true,
    permissions: {
      view_employees: true,
      add_employees: false,
      edit_employees: false,
      delete_employees: false,
      export_data: true,
      import_data: false,
      view_salary: true,
      manage_payroll: true,
      approve_leave: false,
      manage_attendance: false,
      manage_teams: false,
      manage_projects: false,
      manage_settings: false,
    }
  },
  accounts: {
    name: "Accounts",
    is_system: true,
    permissions: {
      view_employees: true,
      add_employees: false,
      edit_employees: false,
      delete_employees: false,
      export_data: true,
      import_data: false,
      view_salary: true,
      manage_payroll: false,
      approve_leave: false,
      manage_attendance: false,
      manage_teams: false,
      manage_projects: false,
      manage_settings: false,
    }
  },
  sales: {
    name: "Sales",
    is_system: true,
    permissions: {
      view_employees: true,
      add_employees: false,
      edit_employees: false,
      delete_employees: false,
      export_data: true,
      import_data: false,
      view_salary: false,
      manage_payroll: false,
      approve_leave: false,
      manage_attendance: true,
      manage_teams: false,
      manage_projects: false,
      manage_settings: false,
    }
  },
  manager: {
    name: "Manager",
    is_system: true,
    permissions: {
      view_employees: true,
      add_employees: false,
      edit_employees: false,
      delete_employees: false,
      export_data: false,
      import_data: false,
      view_salary: false,
      manage_payroll: false,
      approve_leave: true,
      manage_attendance: true,
      manage_teams: true,
      manage_projects: true,
      manage_settings: false,
    }
  },
  team_lead: {
    name: "Team Lead",
    is_system: true,
    permissions: {
      view_employees: true,
      add_employees: false,
      edit_employees: false,
      delete_employees: false,
      export_data: false,
      import_data: false,
      view_salary: false,
      manage_payroll: false,
      approve_leave: false,
      manage_attendance: true,
      manage_teams: false,
      manage_projects: false,
      manage_settings: false,
    }
  },
  employee: {
    name: "Employee",
    is_system: true,
    permissions: {
      view_employees: true,
      add_employees: false,
      edit_employees: false,
      delete_employees: false,
      export_data: false,
      import_data: false,
      view_salary: false,
      manage_payroll: false,
      approve_leave: false,
      manage_attendance: false,
      manage_teams: false,
      manage_projects: false,
      manage_settings: false,
    }
  },
  viewer: {
    name: "Viewer",
    is_system: true,
    permissions: {
      view_employees: true,
      add_employees: false,
      edit_employees: false,
      delete_employees: false,
      export_data: false,
      import_data: false,
      view_salary: false,
      manage_payroll: false,
      approve_leave: false,
      manage_attendance: false,
      manage_teams: false,
      manage_projects: false,
      manage_settings: false,
    }
  }
};

export async function initializeRolesAndPermissions(db: Firestore): Promise<void> {
  try {
    const rolesCol = collection(db, "roles");
    const snap = await getDocs(rolesCol);
    if (!snap.empty) {
      // Roles are already seeded
      return;
    }

    console.log("Seeding default roles and permissions...");
    const batch = writeBatch(db);

    Object.entries(DEFAULT_ROLES).forEach(([roleId, roleData]) => {
      const docRef = doc(db, "roles", roleId);
      batch.set(docRef, roleData);
    });

    await batch.commit();
    console.log("Roles and permissions successfully seeded!");
  } catch (error) {
    console.error("Error seeding roles and permissions:", error);
  }
}
