import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import Home from './Home';
import NewRegistration from './NewRegistration';
import Contact_us from './Contact_us'
import Customer_Home from './Customer_Home';
import Profile from './Profile';
import Customer_Login from './Customer_Login';
import OTP from './OTP';
import Admin_Analytics from './Admin_Analytics';
import BuyNow from './BuyNow';
import AddMeal from './AddMeal';
import ResetPassword from './ResetPassword';
import Welcome from './Welcome';
import Addprofile from './Addprofile';
import MyCart from './MyCart';
import ProfileCard from './ProfileCard';
import HomePage from './HomePage';
import Pricing from './Pricing';
import CustomerCare from './CustomerCare';
import BillingDetails from './BillingDetails';
import Success from './Success';
import OrderDetails from './OrderDetails';
import CheckoutForm from './CheckoutForm';
import DeliveryBoy from './DeliveryBoy';
import AddDoctor from './AddDoctor.js';
import Settings from './Settings';
import Logout from './Logout';
import DailySummary from './DailySummary.jsx'
import BookAppointment from './BookAppointment';
import AppointmentHistory from './AppointmentHistory';
import DoctorList from './DoctorList';
import PatientPortal from './PatientPortal';
import DocumentCenter from './DocumentCenter';
import SuperAdmin from './SuperAdmin';
import { SettingsProvider } from "./context/SettingsContext";
import { AuthProvider } from './context/AuthContext';
import RevenueChart from './RevenueChart.js';
import WhatWeTreatPage from './WhatWeTreatPage.js';
import ServicePage from "./ServicePage";
import PatientList from "./PatientList";
import RootCanalTreatment from "./RootCanalTreatment.js";
import Subscriptions from "./Subscriptions.js";
import ScanProduct from "./ScanProduct.js";
import Jalavastra from "./Jalavastra.js";
import AuthRoute from './AuthRoute';

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const publicPaths = [
  "/Customer_Login",
  "/OTP",
  "/NewRegistration",
  "/my-app",
  "/Welcome",
  "/home",
  "/HomePage",
  "/Contact_us",
  "/Pricing",
];

const wrap = (path, el) => (publicPaths.includes(path) ? el : <AuthRoute>{el}</AuthRoute>);

const router = createBrowserRouter([
  
  {
    path: "/Jalavastra",
    element: wrap("/Jalavastra", <Jalavastra />),
  },
  {
    path: "/Subscriptions",
    element: wrap("/Subscriptions", <Subscriptions />),
  },
  {
    path: "/ScanProduct",
    element: wrap("/ScanProduct", <ScanProduct />),
  },
  {
    path: "/PatientList",
    element: wrap("/PatientList", <PatientList />),
  },
  {
    path: "/RootCanalTreatment",
    element: wrap("/RootCanalTreatment", <RootCanalTreatment />),
  },
   {
    path: "/ServicePage",
    element: wrap("/ServicePage", <ServicePage />),
  },
  {
    path: "/WhatWeTreatPage",
    element: wrap("/WhatWeTreatPage", <WhatWeTreatPage />),
  },
  {
    path: "/SuperAdmin",
    element: wrap("/SuperAdmin", <SuperAdmin />),
  },
  {
    path: "/my-app",
    element: wrap("/my-app", <App />),
  },
  {
    path: "/home",
    element: wrap("/home", <Home />),
  },
  {
    path: "/Customer_home",
    element: wrap("/Customer_home", <Customer_Home />),
  },
  {
    path: "/NewRegistration",
    element: wrap("/NewRegistration", <NewRegistration />),
  },
  {
    path: "/Contact_us",
    element: wrap("/Contact_us", <Contact_us/>),
  },
  {
    path: "/Profile",
    element: wrap("/Profile", <Profile/>),
  },
  {
    path: "/Customer_Login",
    element: wrap("/Customer_Login", <Customer_Login/>),
  },
  {
    path: "/OTP",
    element: wrap("/OTP", <OTP/>),
  },

  {
    path: "/Admin_Analytics",
    element: wrap("/Admin_Analytics", <Admin_Analytics/>),
  },
  
  {
    path: "/BuyNow",
    element: wrap("/BuyNow", <BuyNow/>),
  },
  {
    path: "/AddMeal",
    element: wrap("/AddMeal", <AddMeal/>),
  },
  
  {
    path: "/ResetPassword",
    element: wrap("/ResetPassword", <ResetPassword/>),
  },

  {
    path: "/Welcome",
    element: wrap("/Welcome", <Welcome/>),
  },
  {
    path: "/Addprofile",
    element: wrap("/Addprofile", <Addprofile/>),
  },
  {
    path: "/MyCart",
    element: wrap("/MyCart", <MyCart/>),
  },
  {
    path: "/ProfileCard",
    element: wrap("/ProfileCard", <ProfileCard/>),
  },
  {
    path: "/HomePage",
    element: wrap("/HomePage", <HomePage/>),
  },
  {
    path: "/Pricing",
    element: wrap("/Pricing", <Pricing/>),
  },
  {
    path: "/CustomerCare",
    element: wrap("/CustomerCare", <CustomerCare/>),
  },
  {
    path: "/BillingDetails",
    element: wrap("/BillingDetails", <BillingDetails/>),
  },
  {
    path: "/Success",
    element: wrap("/Success", <Success/>),
  },
  {
    path: "/OrderDetails",
    element: wrap("/OrderDetails", <OrderDetails/>),
  },
  {
    path: "/CheckoutForm",
    element: wrap("/CheckoutForm", <CheckoutForm/>),
  },
  {
    path: "/DeliveryBoy",
    element: wrap("/DeliveryBoy", <DeliveryBoy/>),
  },
  {
    path: "/Settings",
    element: wrap("/Settings", <Settings/>),
  },
  {
    path: "/Logout",
    element: wrap("/Logout", <Logout/>),
  },
  {
    path: "/AddDoctor",
    element: wrap("/AddDoctor", <AddDoctor/>),
  },
  {
    path: "/DailySummary",
    element: wrap("/DailySummary", <DailySummary/>),
  },
    {
    path: "/DocumentCenter",
    element: wrap("/DocumentCenter", <DocumentCenter/>),
  },
    {
    path: "/BookAppointment",
    element: wrap("/BookAppointment", <BookAppointment/>),
  },

  {
    path: "/AppointmentHistory",
    element: wrap("/AppointmentHistory", <AppointmentHistory/>),
  },
  {
    path: "/DoctorList",
    element: wrap("/DoctorList", <DoctorList/>),
  },

   {
    path: "/RevenueChart",
    element: wrap("/RevenueChart", <RevenueChart/>),
  },
  {
    path: "/PatientPortal",
    element: wrap("/PatientPortal", <PatientPortal/>),
  }
]);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </SettingsProvider>
  </React.StrictMode>
);
reportWebVitals();

