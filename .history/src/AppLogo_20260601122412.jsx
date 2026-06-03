import logo from "./assets/DutyDentist.png";

export default function AppLogo() {
  return (
    <div className="py-4 px-2">
      <img src={logo} alt="DutyDentist" className="w-28 mx-auto object-contain" />
    </div>
  );
}