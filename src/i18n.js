// App localization (i18n) setup — English + Kannada.
// Usage in a component:
//   import { useTranslation } from "react-i18next";
//   const { t } = useTranslation();
//   <h1>{t("customerHome.heroTitle")}</h1>
//
// Switch language anywhere with the <LanguageSwitcher /> component, or:
//   i18n.changeLanguage("kn");
//
// To localize another page, add its keys to BOTH `en` and `kn` below and
// replace the hard-coded strings in that component with t("...").
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
// Per-page phrasebooks live in src/locales/ so this file stays wiring rather
// than becoming one enormous literal. Add a page by adding a file there and
// one line in each of the two merges at the bottom.
import * as common from "./locales/common";
import * as receptionist from "./locales/receptionist";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "kn", label: "ಕನ್ನಡ" },
];

// BCP-47 tag for Intl / toLocaleDateString. Pages format dates through this so
// a Kannada UI does not render its dates in English.
export const localeFor = (lng) => (String(lng).startsWith("kn") ? "kn-IN" : "en-GB");

const resources = {
  en: {
    translation: {
      language: { english: "English", kannada: "Kannada" },
      nav: {
        location: "Location",
        currentLocationTitle: "Get your current location",
        accountMenu: "Account menu",
        myWallet: "My Wallet",
        about: "About",
        changePassword: "Change Password",
        cart: "Cart",
        notifications: "Notifications",
        logout: "Logout",
      },
      breadcrumb: { home: "Home", welcome: "Welcome", customerHome: "Customer Home" },
      location: {
        insecure:
          "Location detection needs a secure (HTTPS) connection. On a phone, open the app over HTTPS — or just pick your city manually below.",
        failed:
          "Could not detect your location. Please allow location access, or pick your city manually below.",
      },
      hero: {
        title: "A healthier smile, booked in a few clicks.",
        searchPlaceholder: "Search for a treatment…",
      },
      promo:
        "Struggling to get a GP appointment? Fed up of long queues? Frustrated waiting? Don’t worry – we’re here to help. Book a same day or next day consultation in just a few clicks.",
      treatments: {
        pill: "Book A Treatment",
        heading: "Choose Your Treatment",
        subtitle:
          "Select a procedure, then pick your country, city and clinic to book instantly.",
        support: "Support",
        showing: "Showing",
        one: "treatment",
        many: "treatments",
        for: "for",
        none: "No treatments found",
        new: "New",
        inCart: "In Cart",
        selectCountry: "Select Country",
        selectCity: "Select City",
        selectClinic: "Select Clinic",
        addToCart: "Add to Cart",
        addAgain: "Add Again",
        added: "Added ✓",
        selectAll: "Please select country, city, and clinic",
        learnMore: "Learn more about {{name}}",
      },
      cart: {
        title: "Your Cart",
        clear: "Clear",
        empty: "🦷 Your cart is empty",
        total: "Total",
        checkout: "Checkout",
        remove: "Remove",
      },
      notifications: {
        title: "Notifications",
        campaign: "🔔 New Campaign has been published",
        shipped: "📦 Your order has shipped",
        welcome: "🎉 Welcome to our platform!",
      },
      refreshIn: "This page will Refresh in - {{mins}}:{{secs}} min",
      footer: {
        tagline:
          "Providing trusted dental treatments with modern technology and expert dentists. Your smile is our priority.",
        company: "Company",
        home: "Home",
        aboutUs: "About Us",
        careers: "Careers",
        blog: "Blog",
        treatments: "Treatments",
        contact: "Contact",
        rights: "All rights reserved.",
        madeInIndia: "Made in India",
      },
    },
  },
  kn: {
    translation: {
      language: { english: "ಇಂಗ್ಲಿಷ್", kannada: "ಕನ್ನಡ" },
      nav: {
        location: "ಸ್ಥಳ",
        currentLocationTitle: "ನಿಮ್ಮ ಪ್ರಸ್ತುತ ಸ್ಥಳವನ್ನು ಪಡೆಯಿರಿ",
        accountMenu: "ಖಾತೆ ಮೆನು",
        myWallet: "ನನ್ನ ವಾಲೆಟ್",
        about: "ನಮ್ಮ ಬಗ್ಗೆ",
        changePassword: "ಪಾಸ್‌ವರ್ಡ್ ಬದಲಾಯಿಸಿ",
        cart: "ಕಾರ್ಟ್",
        notifications: "ಅಧಿಸೂಚನೆಗಳು",
        logout: "ಲಾಗ್ ಔಟ್",
      },
      breadcrumb: { home: "ಮುಖಪುಟ", welcome: "ಸ್ವಾಗತ", customerHome: "ಗ್ರಾಹಕ ಮುಖಪುಟ" },
      location: {
        insecure:
          "ಸ್ಥಳ ಪತ್ತೆಗೆ ಸುರಕ್ಷಿತ (HTTPS) ಸಂಪರ್ಕ ಬೇಕು. ಫೋನ್‌ನಲ್ಲಿ ಆ್ಯಪ್ ಅನ್ನು HTTPS ಮೂಲಕ ತೆರೆಯಿರಿ — ಅಥವಾ ಕೆಳಗೆ ನಿಮ್ಮ ನಗರವನ್ನು ಕೈಯಾರೆ ಆಯ್ಕೆಮಾಡಿ.",
        failed:
          "ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಪತ್ತೆ ಮಾಡಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಥಳ ಪ್ರವೇಶಕ್ಕೆ ಅನುಮತಿ ನೀಡಿ, ಅಥವಾ ಕೆಳಗೆ ನಿಮ್ಮ ನಗರವನ್ನು ಕೈಯಾರೆ ಆಯ್ಕೆಮಾಡಿ.",
      },
      hero: {
        title: "ಆರೋಗ್ಯಕರ ನಗು, ಕೆಲವೇ ಕ್ಲಿಕ್‌ಗಳಲ್ಲಿ ಬುಕ್ ಮಾಡಿ.",
        searchPlaceholder: "ಚಿಕಿತ್ಸೆಯನ್ನು ಹುಡುಕಿ…",
      },
      promo:
        "ಜಿಪಿ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಪಡೆಯಲು ಕಷ್ಟವಾಗುತ್ತಿದೆಯೇ? ಉದ್ದ ಸಾಲುಗಳಿಂದ ಬೇಸತ್ತಿದ್ದೀರಾ? ಚಿಂತಿಸಬೇಡಿ – ನಾವು ಸಹಾಯ ಮಾಡಲು ಇಲ್ಲಿದ್ದೇವೆ. ಕೆಲವೇ ಕ್ಲಿಕ್‌ಗಳಲ್ಲಿ ಇಂದೇ ಅಥವಾ ನಾಳೆ ಸಮಾಲೋಚನೆ ಬುಕ್ ಮಾಡಿ.",
      treatments: {
        pill: "ಚಿಕಿತ್ಸೆ ಬುಕ್ ಮಾಡಿ",
        heading: "ನಿಮ್ಮ ಚಿಕಿತ್ಸೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",
        subtitle:
          "ಒಂದು ಪ್ರಕ್ರಿಯೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ, ನಂತರ ನಿಮ್ಮ ದೇಶ, ನಗರ ಮತ್ತು ಕ್ಲಿನಿಕ್ ಆಯ್ಕೆಮಾಡಿ ತಕ್ಷಣ ಬುಕ್ ಮಾಡಿ.",
        support: "ಬೆಂಬಲ",
        showing: "ತೋರಿಸಲಾಗುತ್ತಿದೆ",
        one: "ಚಿಕಿತ್ಸೆ",
        many: "ಚಿಕಿತ್ಸೆಗಳು",
        for: "ಗಾಗಿ",
        none: "ಯಾವುದೇ ಚಿಕಿತ್ಸೆ ಸಿಗಲಿಲ್ಲ",
        new: "ಹೊಸದು",
        inCart: "ಕಾರ್ಟ್‌ನಲ್ಲಿ",
        selectCountry: "ದೇಶವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
        selectCity: "ನಗರವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
        selectClinic: "ಕ್ಲಿನಿಕ್ ಆಯ್ಕೆಮಾಡಿ",
        addToCart: "ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಿ",
        addAgain: "ಮತ್ತೆ ಸೇರಿಸಿ",
        added: "ಸೇರಿಸಲಾಗಿದೆ ✓",
        selectAll: "ದಯವಿಟ್ಟು ದೇಶ, ನಗರ ಮತ್ತು ಕ್ಲಿನಿಕ್ ಆಯ್ಕೆಮಾಡಿ",
        learnMore: "{{name}} ಬಗ್ಗೆ ಇನ್ನಷ್ಟು ತಿಳಿಯಿರಿ",
      },
      cart: {
        title: "ನಿಮ್ಮ ಕಾರ್ಟ್",
        clear: "ತೆರವುಗೊಳಿಸಿ",
        empty: "🦷 ನಿಮ್ಮ ಕಾರ್ಟ್ ಖಾಲಿಯಾಗಿದೆ",
        total: "ಒಟ್ಟು",
        checkout: "ಚೆಕ್‌ಔಟ್",
        remove: "ತೆಗೆದುಹಾಕಿ",
      },
      notifications: {
        title: "ಅಧಿಸೂಚನೆಗಳು",
        campaign: "🔔 ಹೊಸ ಅಭಿಯಾನವನ್ನು ಪ್ರಕಟಿಸಲಾಗಿದೆ",
        shipped: "📦 ನಿಮ್ಮ ಆರ್ಡರ್ ರವಾನೆಯಾಗಿದೆ",
        welcome: "🎉 ನಮ್ಮ ವೇದಿಕೆಗೆ ಸ್ವಾಗತ!",
      },
      refreshIn: "ಈ ಪುಟವು {{mins}}:{{secs}} ನಿಮಿಷಗಳಲ್ಲಿ ರಿಫ್ರೆಶ್ ಆಗುತ್ತದೆ",
      footer: {
        tagline:
          "ಆಧುನಿಕ ತಂತ್ರಜ್ಞಾನ ಮತ್ತು ಪರಿಣತ ದಂತವೈದ್ಯರೊಂದಿಗೆ ವಿಶ್ವಾಸಾರ್ಹ ದಂತ ಚಿಕಿತ್ಸೆಗಳನ್ನು ಒದಗಿಸುತ್ತಿದ್ದೇವೆ. ನಿಮ್ಮ ನಗುವೇ ನಮ್ಮ ಆದ್ಯತೆ.",
        company: "ಕಂಪನಿ",
        home: "ಮುಖಪುಟ",
        aboutUs: "ನಮ್ಮ ಬಗ್ಗೆ",
        careers: "ಉದ್ಯೋಗಗಳು",
        blog: "ಬ್ಲಾಗ್",
        treatments: "ಚಿಕಿತ್ಸೆಗಳು",
        contact: "ಸಂಪರ್ಕ",
        rights: "ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.",
        madeInIndia: "ಭಾರತದಲ್ಲಿ ತಯಾರಿಸಲಾಗಿದೆ",
      },
    },
  },
};

// Merge the per-page phrasebooks in beside the strings defined above.
resources.en.translation = { ...resources.en.translation, ...common.en, receptionist: receptionist.en };
resources.kn.translation = { ...resources.kn.translation, ...common.kn, receptionist: receptionist.kn };

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "kn"],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "appLanguage",
    },
  });

export default i18n;
