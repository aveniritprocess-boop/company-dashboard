const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "company-portal-6ec50";

console.log(`Initializing Firebase Admin SDK with project ID: ${projectId}...`);
admin.initializeApp({ projectId });

const db = admin.firestore();

const departments = ["Engineering", "HR", "Sales", "Finance", "Operations", "Marketing"];
const designations = {
    super_admin: "System Administrator",
    hr_admin: "HR Director",
    hr_executive: "Talent Acquisition Specialist",
    manager: "Engineering Manager",
    team_lead: "Tech Lead",
    employee: "Software Engineer",
    viewer: "Read-Only Auditor"
};

const locations = ["San Francisco, CA", "London, UK", "Noida, IN", "Singapore"];

// Mock names
const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Elizabeth", "William", "Linda", 
                      "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen",
                      "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra"];

const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
                     "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];

// Generating 30 employees
async function seedEmployees() {
    console.log("Starting seed process for 30 mock employees via Admin SDK...");
    
    const ceoUid = "ceo"; 
    const managerUids = ["mgr_uid_1", "mgr_uid_2", "mgr_uid_3", "mgr_uid_4", "mgr_uid_5"];
    
    const employees = [];
    
    for (let i = 1; i <= 30; i++) {
        const roleRand = i <= 2 ? "super_admin" :
                         i <= 4 ? "hr_admin" :
                         i <= 7 ? "hr_executive" :
                         i <= 12 ? "manager" :
                         i <= 17 ? "team_lead" :
                         i <= 28 ? "employee" : "viewer";
                         
        const fName = firstNames[i - 1] || "User";
        const lName = lastNames[i % lastNames.length];
        const name = `${fName} ${lName}`;
        const email = `${fName.toLowerCase()}.${lName.toLowerCase()}@avenir.com`;
        
        let dept = departments[i % departments.length];
        if (roleRand.startsWith("hr")) dept = "HR";
        if (roleRand === "super_admin") dept = "IT Operations";
        
        const desig = designations[roleRand];
        
        // Reporting manager mapping
        let repMgrId = "";
        if (roleRand === "manager" || roleRand === "super_admin" || roleRand === "hr_admin") {
            repMgrId = "ceo"; // reports to CEO
        } else if (roleRand === "hr_executive") {
            repMgrId = "hr_admin_1"; // reports to HR Admin
        } else if (roleRand === "team_lead") {
            repMgrId = managerUids[i % managerUids.length];
        } else if (roleRand === "employee") {
            repMgrId = `tl_uid_${(i % 5) + 1}`; // reports to Team Lead
        }
        
        const uid = roleRand === "manager" ? managerUids[i - 8] :
                    roleRand === "team_lead" ? `tl_uid_${i - 12}` :
                    roleRand === "hr_admin" ? `hr_admin_${i - 2}` :
                    `mock_uid_${i}`;
                    
        const empId = `EMP-${1000 + i}`;
        
        employees.push({
            uid,
            name,
            email,
            mobile: `+1 555-01${i.toString().padStart(2, '0')}`,
            role: roleRand,
            reporting_manager_id: repMgrId,
            department: dept,
            location: locations[i % locations.length],
            location_id: `loc_${i % 4}`,
            employee_id: empId,
            is_active: true,
            portal_access: true,
            is_locked: false,
            is_deleted: false,
            must_change_password: true,
            designation: desig,
            joining_date: `2025-0${(i % 9) + 1}-10`,
            employee_type: i % 10 === 0 ? "contract" : "permanent",
            address: `12${i} Corporate Blvd, Suite ${i * 10}`,
            emergency_contact: {
                name: `Emergency Contact ${i}`,
                relationship: i % 3 === 0 ? "Spouse" : "Parent",
                mobile: `+1 555-02${i.toString().padStart(2, '0')}`
            },
            profile_photo: `https://images.unsplash.com/photo-${1500000000000 + i * 1000}?w=150&h=150&fit=crop&crop=face`,
            gender: i % 2 === 0 ? "male" : "female",
            status: "active"
        });
    }
    
    // Commit to firestore
    for (const emp of employees) {
        const docRef = db.collection("users").doc(emp.uid);
        await docRef.set(emp);
        console.log(`Seeded: ${emp.name} as ${emp.role} (${emp.employee_id})`);
    }
    
    console.log("All 30 employees seeded successfully!");
    process.exit(0);
}

seedEmployees().catch(err => {
    console.error("Error seeding employees:", err);
    process.exit(1);
});
