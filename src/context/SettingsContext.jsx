import React, { createContext, useContext, useEffect, useState } from "react";

const DEFAULT_SETTINGS = {
  // SUPER ADMIN
  allow24x7: false,
  allowCancellation: false,
  allowCustomerCare: false,
  allowPaymentOnline: false,
  allowCOD: false,
  allowEditOrder: false,
  allowRating: false,
  allowAddTip: false,
  enableQRCode: false,

  // CUSTOMER
  allowCustomerLogin: false,
  allowScheduleTasks: false,
  allowCustomerUpdateOrder: false,
  allowCustomerManageUsers: false,
  allowInternationalAccess: false,
  allowRejectOrder: false,

  // ADMIN PAGE
  allowCustomerPage: false,
  allowAnalytics: false,
  allowAdminCustomerCare: false,
  allowProfiles: false,
  allowBilling: false,
  allowDeliveryCaptain: false,
  allowAddMealAdmin: false,
  allowCopyright: false,

  // RESTAURANT
  restaurantAddMeal: false,
  restaurant24x7: false,
  restaurantCancellation: false,
  restaurantPhoneAccess: false,
  restaurantPaymentOnline: false,
  restaurantCOD: false,
  restaurantEditOrder: false,
  restaurantRating: false,
  restaurantAddTip: false,
  restaurantInvoice: false,
};

const ROLE_SETTINGS = {
  admin: [
    "allow24x7",
    "allowCancellation",
    "allowCustomerCare",
    "allowPaymentOnline",
    "allowCOD",
    "allowEditOrder",
    "allowRating",
    "allowAddTip",
    "enableQRCode",
    "allowCustomerPage",
    "allowAnalytics",
    "allowAdminCustomerCare",
    "allowProfiles",
    "allowBilling",
    "allowDeliveryCaptain",
    "allowAddMealAdmin",
    "allowCopyright",
  ],
  customer: [
    "allowCustomerLogin",
    "allowScheduleTasks",
    "allowCustomerUpdateOrder",
    "allowCustomerManageUsers",
    "allowInternationalAccess",
    "allowRejectOrder",
  ],
  restaurant: [
    "restaurantAddMeal",
    "restaurant24x7",
    "restaurantCancellation",
    "restaurantPhoneAccess",
    "restaurantPaymentOnline",
    "restaurantCOD",
    "restaurantEditOrder",
    "restaurantRating",
    "restaurantAddTip",
    "restaurantInvoice",
  ],
};

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("adminSettings");
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [role, setRole] = useState("admin"); // default role

  const toggleSetting = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getRoleSettings = () => {
    return ROLE_SETTINGS[role] || [];
  };

  useEffect(() => {
    localStorage.setItem("adminSettings", JSON.stringify(settings));
  }, [settings]);

  return (
    <SettingsContext.Provider
      value={{ settings, toggleSetting, role, setRole, getRoleSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
