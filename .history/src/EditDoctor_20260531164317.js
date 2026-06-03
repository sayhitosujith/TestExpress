import React, { useState, useEffect } from "react";
import {
  Button,
  Typography,
  Input,
  Breadcrumbs,
  Avatar,
} from "@material-tailwind/react";
import { useNavigate, useParams } from "react-router-dom";

function EditDoctor() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [doctor, setDoctor] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    specialization: "",
    experience: "",
    clinic: [],
    license: "",
    address: "",
    image: "",
    appointments: [],
  });
  const [errors, setErrors] = useState({});

  const specializations = ["Dentist", "Orthodontist", "Periodontist", "Endodontist", "Prosthodontist"];
  const clinics = ["City Clinic", "Dental Care", "Smile Studio", "Healthy Teeth"];

  useEffect(() => {
    const storedDoctors = JSON.parse(localStorage.getItem("doctors")) || [];
    const doc = storedDoctors[id];
    if (doc) {
      setDoctor({ ...doc, clinic: Array.isArray(doc.clinic) ? doc.clinic : [] });
    } else {
      navigate("/DoctorList");
    }
  }, [id, navigate]);

  const handleChange = (e) => setDoctor({ ...doctor, [e.target.name]: e.target.value });

  const handleClinicToggle = (clinicName) => {
    if (doctor.clinic.includes(clinicName)) {
      setDoctor({ ...doctor, clinic: doctor.clinic.filter(c => c !== clinicName) });
    } else {
      setDoctor({ ...doctor, clinic: [...doctor.clinic, clinicName] });
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => setDoctor({ ...doctor, image: reader.result });
    if (file) reader.readAsDataURL(file);
  };

  const validate = () => {
    const newErrors = {};
    if (!doctor.firstName.trim()) newErrors.firstName = "First Name is required";
    if (!doctor.lastName.trim()) newErrors.lastName = "Last Name is required";
    if (!doctor.email.trim()) newErrors.email = "Email is required";
    if (!doctor.phone.trim()) newErrors.phone = "Phone is required";
    if (!doctor.specialization) newErrors.specialization = "Specialization is required";
    if (!doctor.experience.trim()) newErrors.experience = "Experience is required";
    if (!doctor.clinic.length) newErrors.clinic = "At least one clinic is required";
    if (!doctor.license.trim()) newErrors.license = "License is required";
    if (!doctor.address.trim()) newErrors.address = "Address is required";
    if (!doctor.image) newErrors.image = "Doctor image is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const storedDoctors = JSON.parse(localStorage.getItem("doctors")) || [];
    storedDoctors[id] = doctor;
    localStorage.setItem("doctors", JSON.stringify(storedDoctors));
    navigate("/DoctorList");
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <Breadcrumbs className="mb-4">
        <Typography as="a" color="orange-gray" className="cursor-pointer" onClick={() => navigate("/")}>
          Home
        </Typography>
        <Typography as="a" color="orange-gray" className="cursor-pointer" onClick={() => navigate("/DoctorList")}>
          Doctors
        </Typography>
        <Typography color="orange-gray">Edit Doctor</Typography>
      </Breadcrumbs>

      <Button color="orange" className="mb-4" onClick={() => navigate("/DoctorList")}>
        &larr; Back
      </Button>

      <Typography variant="h4" className="mb-4 text-center">
        Edit Doctor
      </Typography>

      <div className="flex flex-col gap-4">
        <Input name="firstName" label="First Name" value={doctor.firstName} onChange={handleChange} error={!!errors.firstName} helperText={errors.firstName} />
        <Input name="lastName" label="Last Name" value={doctor.lastName} onChange={handleChange} error={!!errors.lastName} helperText={errors.lastName} />
        <Input name="email" label="Email" value={doctor.email} onChange={handleChange} error={!!errors.email} helperText={errors.email} />
        <Input name="phone" label="Phone" value={doctor.phone} onChange={handleChange} error={!!errors.phone} helperText={errors.phone} />

        <select
          className="border p-2 rounded"
          value={doctor.specialization}
          onChange={(e) => setDoctor({ ...doctor, specialization: e.target.value })}
        >
          <option value="">Select Specialization</option>
          {specializations.map((spec, i) => <option key={i} value={spec}>{spec}</option>)}
        </select>
        {errors.specialization && <Typography color="red" className="text-xs">{errors.specialization}</Typography>}

        <Input name="experience" label="Experience (years)" value={doctor.experience} onChange={handleChange} error={!!errors.experience} helperText={errors.experience} />

        <div>
          <label className="block mb-1 font-medium">Clinic(s):</label>
          <div className="flex flex-col gap-1">
            {clinics.map((clinic, i) => (
              <label key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={doctor.clinic.includes(clinic)}
                  onChange={() => handleClinicToggle(clinic)}
                />
                <span>{clinic}</span>
              </label>
            ))}
          </div>
          {errors.clinic && <Typography color="red" className="text-xs">{errors.clinic}</Typography>}
        </div>

        <Input name="license" label="License" value={doctor.license} onChange={handleChange} error={!!errors.license} helperText={errors.license} />
        <Input name="address" label="Address" value={doctor.address} onChange={handleChange} error={!!errors.address} helperText={errors.address} />

        <div>
          <label className="block mb-1 font-medium">Upload Image:</label>
          <input type="file" accept="image/*" onChange={handleImageUpload} />
          {errors.image && <Typography color="red" className="text-xs mt-1">{errors.image}</Typography>}
        </div>

        {doctor.image && (
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full overflow-hidden border-4 border-orange-500 shadow-lg mx-auto">
            <img src={doctor.image} alt={`${doctor.firstName} ${doctor.lastName}`} className="w-full h-full object-cover" />
          </div>
        )}

        <Button color="orange" className="mt-4" onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

export default EditDoctor;
