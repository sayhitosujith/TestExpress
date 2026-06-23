import logo from "./assets/Toothx_Logo.png";

export default function AppLogo() {
  return (
    <div className="py-4 px-4">
      <img src={logo} alt="Toothx_Logo" className="w-28 mx-auto object-contain" />
    </div>
  );
}
