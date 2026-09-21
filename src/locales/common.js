// Strings shared by more than one page. Kept out of i18n.js so that file stays
// a wiring file rather than a phrasebook.
//
// Day and month names are keyed by their ENGLISH name, not by index, because
// the English name is simultaneously a data key: a doctor's `availableDays`
// holds "Monday", and matching against it must never depend on the UI
// language. Translate for display, look up by the English key.
export const en = {
  calendar: {
    dayShort: { Sun: "Sun", Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat" },
    day: {
      Sunday: "Sunday",
      Monday: "Monday",
      Tuesday: "Tuesday",
      Wednesday: "Wednesday",
      Thursday: "Thursday",
      Friday: "Friday",
      Saturday: "Saturday",
    },
    month: {
      January: "January",
      February: "February",
      March: "March",
      April: "April",
      May: "May",
      June: "June",
      July: "July",
      August: "August",
      September: "September",
      October: "October",
      November: "November",
      December: "December",
    },
  },
};

export const kn = {
  calendar: {
    dayShort: { Sun: "ಭಾನು", Mon: "ಸೋಮ", Tue: "ಮಂಗಳ", Wed: "ಬುಧ", Thu: "ಗುರು", Fri: "ಶುಕ್ರ", Sat: "ಶನಿ" },
    day: {
      Sunday: "ಭಾನುವಾರ",
      Monday: "ಸೋಮವಾರ",
      Tuesday: "ಮಂಗಳವಾರ",
      Wednesday: "ಬುಧವಾರ",
      Thursday: "ಗುರುವಾರ",
      Friday: "ಶುಕ್ರವಾರ",
      Saturday: "ಶನಿವಾರ",
    },
    month: {
      January: "ಜನವರಿ",
      February: "ಫೆಬ್ರವರಿ",
      March: "ಮಾರ್ಚ್",
      April: "ಏಪ್ರಿಲ್",
      May: "ಮೇ",
      June: "ಜೂನ್",
      July: "ಜುಲೈ",
      August: "ಆಗಸ್ಟ್",
      September: "ಸೆಪ್ಟೆಂಬರ್",
      October: "ಅಕ್ಟೋಬರ್",
      November: "ನವೆಂಬರ್",
      December: "ಡಿಸೆಂಬರ್",
    },
  },
};
