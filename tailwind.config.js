/** @type {import('tailwindcss').Config} */

const withMT = require("@material-tailwind/react/utils/withMT");

module.exports = withMT({
  // Dark mode follows a class, not the operating system. The preference is a
  // choice the user makes in User Settings and that choice has to win — with
  // the default ("media") a page could only ever be as dark as the OS already
  // was, and the toggle would appear to do nothing on a machine set to light.
  darkMode: "class",
  content: ["./src/**/*.{html,js,jsx}", "./public/index.html"],
  theme: {
    extend: {},
  },
  plugins: [],
});

