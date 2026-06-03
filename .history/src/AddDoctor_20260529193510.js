import { useState } from "react";
import {
  Button,
  Input,
  Typography,
  Avatar,
  Breadcrumbs,
} from "@material-tailwind/react";
import { useNavigate } from "react-router-dom";
import { Bars3Icon, Squares2X2Icon } from "@heroicons/react/24/solid";

function AddDoctor() {
  const navigate = useNavigate();
  const [newDoctor, setNewDoctor] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    specialization: "",
    experience: "",
    clinic: "",
    license: "",
    address: "",
    image: "",
    consultationFee: "",
    isActive: true,
    availableDays: [],   

  });
  const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

  const [errors, setErrors] = useState({});
  const [previewGrid, setPreviewGrid] = useState(true);

  const handleChange = (e) => {
    setNewDoctor({ ...newDoctor, [e.target.name]: e.target.value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewDoctor({ ...newDoctor, image: reader.result });
    };
    if (file) reader.readAsDataURL(file);
  };

  // Validation function
  const validate = () => {
    const newErrors = {};

    if (!newDoctor.firstName.trim())
      newErrors.firstName = "First Name is required";
    if (!newDoctor.lastName.trim())
      newErrors.lastName = "Last Name is required";

    if (!newDoctor.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newDoctor.email)) {
      newErrors.email = "Invalid email format";
    }
if (newDoctor.availableDays.length === 0) {
  newErrors.availableDays = "Select at least one available day";
}
    if (!newDoctor.phone.trim()) {
      newErrors.phone = "Phone is required";
    } else if (!/^\d{10}$/.test(newDoctor.phone)) {
      newErrors.phone = "Phone must be 10 digits";
    }

    if (!newDoctor.specialization.trim())
      newErrors.specialization = "Specialization is required";

    if (!newDoctor.experience.trim()) {
      newErrors.experience = "Experience is required";
    } else if (
      isNaN(newDoctor.experience) ||
      Number(newDoctor.experience) < 0
    ) {
      newErrors.experience = "Experience must be a positive number";
    }

    if (!newDoctor.clinic.trim()) newErrors.clinic = "Clinic is required";
    if (!newDoctor.license.trim()) newErrors.license = "License is required";
    if (!newDoctor.address.trim()) newErrors.address = "Address is required";

    if (!newDoctor.consultationFee.trim()) {
      newErrors.consultationFee = "Consultation fee is required";
    } else if (isNaN(newDoctor.consultationFee) || Number(newDoctor.consultationFee) <= 0) {
      newErrors.consultationFee = "Consultation fee must be a positive number";
    }

    if (!newDoctor.image) newErrors.image = "Doctor image is required";

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return; // stop if validation fails

    const storedDoctors = JSON.parse(localStorage.getItem("doctors")) || [];
    storedDoctors.push(newDoctor);
    localStorage.setItem("doctors", JSON.stringify(storedDoctors));
    navigate("/DoctorList");
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <Breadcrumbs className="mb-4">
        <Typography
          as="a"
          href="/Welcome"
          color="orange-gray"
          className="cursor-pointer hover:underline"
          onClick={() => navigate("/")}
        >
          Home
        </Typography>
        <Typography
          as="a"
          href="/DoctorList"
          color="orange-gray"
          className="cursor-pointer hover:underline"
          onClick={() => navigate("/DoctorList")}
        >
          Doctors
        </Typography>
        <Typography color="orange-gray">Add Dentist</Typography>
      </Breadcrumbs>

      <Typography variant="h4" className="mb-4 text-center">
        Add Dentist
      </Typography>

      <div className="flex flex-col gap-4">
        <Input
          name="firstName"
          label="First Name"
          value={newDoctor.firstName}
          onChange={handleChange}
          error={!!errors.firstName}
          helperText={errors.firstName}
        />
        <Input
          name="lastName"
          label="Last Name"
          value={newDoctor.lastName}
          onChange={handleChange}
          error={!!errors.lastName}
          helperText={errors.lastName}
        />
        <Input
          name="email"
          label="Email"
          value={newDoctor.email}
          onChange={handleChange}
          error={!!errors.email}
          helperText={errors.email}
        />
        <Input
          name="phone"
          label="Phone"
          value={newDoctor.phone}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, ""); // remove non-digits
            if (value.length <= 10) {
              setNewDoctor({ ...newDoctor, phone: value });
            }
          }}
          inputProps={{ maxLength: 10 }}
          error={!!errors.phone}
          helperText={errors.phone}
        />
        <Input
          name="specialization"
          label="Specialization"
          value={newDoctor.specialization}
          onChange={handleChange}
          error={!!errors.specialization}
          helperText={errors.specialization}
        />
        <Input
          name="experience"
          label="Experience (years)"
          value={newDoctor.experience}
          onChange={handleChange}
          error={!!errors.experience}
          helperText={errors.experience}
        />
        <Input
          name="clinic"
          label="Clinic"
          value={newDoctor.clinic}
          onChange={handleChange}
          error={!!errors.clinic}
          helperText={errors.clinic}
        />
        <Input
          name="license"
          label="License"
          value={newDoctor.license}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, ""); // allow only digits
            if (value.length <= 10) {
              setNewDoctor({ ...newDoctor, license: value });
            }
          }}
          inputProps={{
            maxLength: 10,
            inputMode: "numeric",
            pattern: "[0-9]*",
  }}
  error={!!errors.license}
  helperText={errors.license}
/>
        <Input
          name="address"
          label="Address"
          value={newDoctor.address}
          onChange={handleChange}
          error={!!errors.address}
          helperText={errors.address}
        />
        <Input
          name="consultationFee"
          label="Consultation Fee (₹)"
          value={newDoctor.consultationFee}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, ""); // allow only digits
            setNewDoctor({ ...newDoctor, consultationFee: value });
          }}
          inputProps={{
            inputMode: "numeric",
            pattern: "[0-9]*",
          }}
          error={!!errors.consultationFee}
          helperText={errors.consultationFee}
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={newDoctor.isActive}
            onChange={(e) =>
              setNewDoctor({ ...newDoctor, isActive: e.target.checked })
            }
            className="w-4 h-4 cursor-pointer"
          />
          <label htmlFor="isActive" className="font-medium cursor-pointer">
            Is Active
          </label>
        </div>

        <div>
  <Typography className="font-medium mb-2">
    Available Days
  </Typography>

  <div className="grid grid-cols-2 gap-2">
    {daysOfWeek.map((day) => (
      <label
        key={day}
        className="flex items-center gap-2 border rounded p-2 cursor-pointer"
      >
        <input
          type="checkbox"
          checked={newDoctor.availableDays.includes(day)}
          onChange={(e) => {
            if (e.target.checked) {
              setNewDoctor({
                ...newDoctor,
                availableDays: [...newDoctor.availableDays, day],
              });
            } else {
              setNewDoctor({
                ...newDoctor,
                availableDays: newDoctor.availableDays.filter(
                  (d) => d !== day
                ),
              });
            }
          }}
          className="w-4 h-4"
        />
        {day}
      </label>
    ))}
  </div>

  {errors.availableDays && (
    <Typography color="red" className="text-xs mt-1">
      {errors.availableDays}
    </Typography>
  )}
</div>

        <div>
          <label className="block mb-1 font-medium">Upload Image:</label>
          <input type="file" accept="image/*" onChange={handleImageUpload} />
          {errors.image && (
            <Typography color="red" className="text-xs mt-1">
              {errors.image}
            </Typography>
          )}
        </div>

        {newDoctor.image && (
          <div className="flex items-center justify-center gap-2 my-2">
            <button
              className={`p-2 rounded ${!previewGrid ? "bg-orange-500 text-white" : "bg-gray-200"}`}
              onClick={() => setPreviewGrid(false)}
              title="List Preview"
            >
              <Bars3Icon className="w-5 h-5" />
            </button>
            <button
              className={`p-2 rounded ${previewGrid ? "bg-orange-500 text-white" : "bg-gray-200"}`}
              onClick={() => setPreviewGrid(true)}
              title="Grid Preview"
            >
              <Squares2X2Icon className="w-5 h-5" />
            </button>
          </div>
        )}

        {newDoctor.image &&
          (previewGrid ? (
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-orange-500 shadow-lg mx-auto">
              <img
                src={newDoctor.image}
                alt={`${newDoctor.firstName} ${newDoctor.lastName}`}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 border p-2 rounded shadow-sm">
              <Avatar
                src={newDoctor.image}
                size="sm"
                className="border-2 border-orange-500"
              />
              <div>
                <Typography className="text-sm font-medium">
                  {newDoctor.firstName} {newDoctor.lastName}
                </Typography>
                <Typography className="text-xs">
                  {newDoctor.specialization}
                </Typography>
              </div>
            </div>
          ))}

        <Button color="orange" className="mt-4" onClick={handleSave}>
          Save Doctor
        </Button>
      </div>
    </div>
  );
}

export default AddDoctor;
