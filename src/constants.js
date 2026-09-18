/**
 * The payment options offered on the registration form.
 *
 * The list itself lives in paymentOptions.json, not here, because the server
 * validates against it too and cannot import an ES module. JSON is the one
 * format both halves read, and a second copy of these strings would be the
 * drift that lets the API store an option the form never offered.
 *
 * `value` is what is stored; `label` is what is shown.
 */
export { default as PAYMENT_OPTIONS } from "./paymentOptions.json";

export const practiceNames = {
  HerveyBay: "Duty Dentist",
  SunshineCoast: "Duty Dentist",
  Brisbane: "Duty Dentist",
};

export const practiceCities = {
  HerveyBay: "Hervey Bay",
  SunshineCoast: "Sunshine Coast",
  Brisbane: "Brisbane",
};

// Define services per practice
export const practiceServices = {
  HerveyBay: [
    { label: "SUPER ADMIN", icon: "IoSettingsOutline", link: "SuperAdmin" },
    { label: "DOCTOR PORTAL", icon: "RiAdminFill", link: "DoctorList" },
    { label: "PATIENT PORTAL", icon: "RiAdminFill", link: "PatientPortal" },
    { label: "CUSTOMER", icon: "CiUser", link: "Customer_Login" },
  ],
  SunshineCoast: [
    { label: "SUPER ADMIN", icon: "IoSettingsOutline", link: "SuperAdmin" },
    { label: "ANALYTICS", icon: "TbBrandGoogleAnalytics", link: "Admin_Analytics" },
    { label: "SUPPORT", icon: "FaUsers", link: "CustomerCare" },
    { label: "PROFILES", icon: "FaFileInvoiceDollar", link: "Profile" },
  ],
  Brisbane: [
    { label: "SUPER ADMIN", icon: "IoSettingsOutline", link: "SuperAdmin" },
    { label: "DOCTOR PORTAL", icon: "RiAdminFill", link: "DoctorList" },
    { label: "SETTINGS", icon: "IoSettingsOutline", link: "Settings" },
  ],
};
