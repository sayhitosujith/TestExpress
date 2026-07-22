import logo from "./assets/Toothx_Logo_trimmed.png";

export default function AppLogo() {
  return (
    <div className="py-3 px-2 flex items-center justify-center">
      <img src={logo} alt="Toothx_Logo" className="w-28 object-contain drop-shadow-sm" />
    </div>
  );
}
