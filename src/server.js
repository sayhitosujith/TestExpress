require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Doctor Schema
const doctorSchema = new mongoose.Schema({
  name: String,
  specialization: String,
  experience: Number,
  email: String,
}, { timestamps: true });

const Doctor = mongoose.model("Doctor", doctorSchema);


// ================= CRUD APIs =================

// Get all doctors
app.get("/api/doctors", async (req, res) => {
  const doctors = await Doctor.find();
  res.json(doctors);
});

// Add doctor
app.post("/api/doctors", async (req, res) => {
  const doctor = new Doctor(req.body);
  await doctor.save();
  res.json(doctor);
});

// Update doctor
app.put("/api/doctors/:id", async (req, res) => {
  const updated = await Doctor.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(updated);
});

// Delete doctor
app.delete("/api/doctors/:id", async (req, res) => {
  await Doctor.findByIdAndDelete(req.params.id);
  res.json({ message: "Doctor deleted" });
});

app.listen(5000, () => console.log("Server running on port 5000"));