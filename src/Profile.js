import React, { useEffect, useState } from "react";
import {
  getPatients,
  savePatient,
  savePatients,
  deletePatient,
} from "./api/patients";
import {
  Card,
  CardBody,
  CardFooter,
  Typography,
  Button,
  Avatar,
  Badge,
  Rating,
  Input,
  Breadcrumbs,
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Switch,
} from "@material-tailwind/react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { FaWhatsapp } from "react-icons/fa";
import { MdNotificationsNone, MdPowerSettingsNew, MdRefresh } from "react-icons/md";
import { Select, Option } from "@material-tailwind/react";

// Helper functions
const validateAadhaar = (aadhaar) => /^[2-9][0-9]{11}$/.test(aadhaar);
const maxDigits = (value, max) => value.replace(/\D/g, "").slice(0, max);
const isProfileValid = (profile) => {
  if (!profile) return false;
  const phoneValid = profile.phone && profile.phone.length === 10;
  const aadhaarValid = profile.aadhaar
    ? validateAadhaar(profile.aadhaar)
    : true;
  const policyValid = profile.policyNumber
    ? profile.policyNumber.length <= 10
    : true;
  return phoneValid && aadhaarValid && policyValid;
};

const CardItem = ({
  item,
  onDelete,
  onEdit,
  searchTerm,
  listView,
  onBook,
  onUpdateAppointment,
}) => {
  const [expanded, setExpanded] = useState(false);

  const highlightPhone = (phone, term) => {
    if (!phone) return "";
    if (!term) return phone;

    const parts = phone.split(new RegExp(`(${term})`, "gi"));
    return parts.map((part, idx) =>
      part.toLowerCase() === term.toLowerCase() ? (
        <span key={idx} className="bg-yellow-200 px-1 rounded">
          {part}
        </span>
      ) : (
        <span key={idx}>{part}</span>
      ),
    );
  };

  return (
    <Card
      className={`rounded-xl shadow-sm border border-gray-200
  transition-all duration-300 hover:shadow-lg hover:-translate-y-1
  ${
    item.pregnancyStatus === "Pregnant"
      ? "border-pink-400 bg-pink-50"
      : "border-gray-200"
  }

  ${
    listView
      ? "w-full flex flex-row gap-3 items-start p-3"
      : "w-full flex flex-col p-3 min-h-[300px]"
  }`}
    >
      {/* Avatar */}
      <div
        className={`${listView ? "w-16 flex-shrink-0 flex justify-center" : "flex justify-center mt-2"}`}
      >
        {" "}
        <Avatar
          src={
            item?.image ||
            "https://fellows.ias.ac.in/public/images/stock/avatar.svg?v=105894425"
          }
          alt="Profile"
          variant={listView ? "circular" : "square"}
          className={`border-2 border-gray-300 shadow-md object-cover
  ${listView ? "w-16 h-16 rounded-full" : "w-24 h-24 md:w-28 md:h-28 rounded-lg"}          `}
        />
      </div>

      <CardBody
        className={`flex flex-col gap-2 text-sm justify-start ${
          listView ? "flex-1 p-0" : "p-2"
        }`}
      >
        <div className="flex flex-col gap-2">
          {/* Name + ID */}
          <div>
            <Typography className="font-semibold text-gray-800 text-base">
              {item?.firstName} {item?.lastName}
            </Typography>

            <Typography className="text-xs text-gray-500">
              System ID: {item?.patientId}
            </Typography>
          </div>

          {/* Medical Badges

      Restoring these needs the badge back with them, which is why it lives in
      here rather than above as an unused component:

        const AlertBadge = ({ color, text }) => (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${color}`}>
            {text}
          </span>
        );

      <div className="flex flex-wrap gap-2 mt-2">
        {item?.pregnancyStatus === "Pregnant" && (
          <AlertBadge color="bg-pink-100 text-pink-700" text="🤰 Pregnant" />
        )}

        {item?.diabetes && (
          <AlertBadge color="bg-yellow-100 text-yellow-700" text="💊 Diabetes" />
        )}

        {item?.hypertension && (
          <AlertBadge color="bg-red-100 text-red-700" text="❤️ Hypertension" />
        )}

        {item?.bloodThinners && (
          <AlertBadge
            color="bg-purple-100 text-purple-700"
            text="🩸 Blood Thinners"
          />
        )}
      </div> */}
        </div>

        {/* Contact Info */}
        <Typography>
          <span className="font-bold underline">Email:</span>{" "}
          {item?.email ? (
            <a
              href={`mailto:${item.email}`}
              className="text-green-600 underline hover:text-green-800"
            >
              {item.email}
            </a>
          ) : (
            "Not Provided"
          )}
        </Typography>

        <Typography>
          <span className="font-bold underline">Phone:</span>{" "}
          <a href={`tel:${item?.phone}`} className="text-green-600">
            {highlightPhone(item?.phone || "", searchTerm)}
          </a>
        </Typography>

        <Typography>
          <span className="font-bold underline">Sex:</span> {item?.sex}
        </Typography>

        {item?.sex === "Female" && (
          <Typography>
            <span className="font-bold underline">Pregnancy Status:</span>{" "}
            {item?.pregnancyStatus || "Not Specified"}
          </Typography>
        )}

        {/* Pregnancy Alert */}
        {item?.pregnancyStatus === "Pregnant" && (
          <div className="mt-2 bg-pink-200 text-pink-900 text-xs p-2 rounded text-center">
            ⚠️ High Risk - Pregnant Patient
            {item?.trimester && <div>Trimester: {item.trimester}</div>}
            {item?.highRisk && (
              <div className="text-red-8  00 font-semibold"></div>
            )}
          </div>
        )}

        {/* Appointment Badge */}
        <div className="mt-2 flex flex-col items-center gap-3">
          <Badge
            color={
              item?.appointmentStatus === "Scheduled - Confirmed"
                ? "green"
                : item?.appointmentStatus === "Scheduled - Pending"
                  ? "amber"
                  : item?.appointmentStatus === "Scheduled -Completed"
                    ? "green"
                    : item?.appointmentStatus === "Cancelled"
                      ? "red"
                      : "gray"
            }
            content={item?.appointmentStatus || "Not Scheduled"}
          />
        </div>

        {item?.appointmentStatus &&
          item?.appointmentStatus !== "Not Scheduled" && (
            <Typography className="text-xs text-gray-600 text-center mt-2">
              👨‍⚕️ {item?.doctorName || "Doctor"} <br />
              📅 {item?.appointmentDate || "-"} <br />⏰{" "}
              {item?.appointmentTime || "-"}
            </Typography>
          )}

        {/* ================= EXPANDED SECTION ================= */}
        {expanded && (
          <div className="flex flex-col gap-1 mt-2">
            <Typography>
              <span className="font-bold underline">Aadhaar:</span>{" "}
              {item?.aadhaar || "Not Provided"}
            </Typography>

            <Typography>
              <span className="font-bold underline">Address:</span>{" "}
              {item?.address || "Not Provided"}
            </Typography>

            <Typography>
              <span className="font-bold underline">Referred By:</span>{" "}
              {item?.referredBy || "Not Provided"}
            </Typography>

            <Typography>
              <span className="font-bold underline">Occupation:</span>{" "}
              {item?.occupation || "Not Provided"}
            </Typography>

            <Typography>
              <span className="font-bold underline">Contact Preference:</span>{" "}
              {item?.contactPreference || "Not Selected"}
            </Typography>

            {/* Xray Reports */}
            {item?.xrayReports?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-3">
                {item.xrayReports.map((file, idx) => (
                  <div
                    key={idx}
                    className="w-20 h-20 border rounded overflow-hidden shadow-sm bg-white"
                  >
                    {file?.type === "application/pdf" ? (
                      <embed
                        src={file?.data}
                        type="application/pdf"
                        width="100%"
                        height="100%"
                      />
                    ) : (
                      <img
                        src={file?.data}
                        alt="xray"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Severity Rating */}
            <div className="mt-2">
              <Typography className="text-xs font-semibold text-red-500 mb-1">
                Rate Patient Severity
              </Typography>
              <Rating unratedColor="amber" ratedColor="amber" size="sm" />
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <Button
          size="sm"
          variant="text"
          color="black"
          className="mt-2 w-fit p-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show Less ▲" : "Show More ▼"}
        </Button>
      </CardBody>

      <CardFooter className="flex justify-between items-center pt-2">
        <div className="flex items-center justify-between mt-4">
          <div className="flex flex-wrap gap-2 justify-between items-center mt-4">
            <Button
              size="sm"
              className="bg-black hover:bg-gray-800 text-white shadow-md hover:scale-105 transition duration-300"
              onClick={() => onBook(item.phone, item.pregnancyStatus)}
            >
              Book Appointment
            </Button>

            <Button
              size="xs"
              variant="outlined"
              color="black"
              onClick={() => onEdit(item)}
            >
              Edit
            </Button>

            <Button
              size="xs"
              variant="outlined"
              color="black"
              onClick={() => item?.patientId && onDelete(item.patientId)}
            >
              Delete
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};

// Profile Component
function Profile() {
  const [profiles, setProfiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [editProfile, setEditProfile] = useState(null);
  const [showToast, setShowToast] = useState("");
  const [listView, setListView] = useState(true);

  const handleBookAppointment = (phone, pregnancyStatus) => {
    if (pregnancyStatus === "Pregnant") {
      alert(
        "⚠️ Patient is pregnant. Please confirm treatment safety before booking.",
      );
    }

    window.location.href = `/MyCart?phone=${encodeURIComponent(phone)}`;
  };

  const [patients, setPatients] = useState(() => {
    const saved = localStorage.getItem("patients");
    return saved ? JSON.parse(saved) : [];
  });

  const handleUpdateAppointment = () => {
    const updatedPatients = patients.map((p) => {
      if (p.patientId === editProfile.patientId) {
        return {
          ...p,
          appointmentDate: editProfile.appointmentDate,
          appointmentTime: editProfile.appointmentTime,
          doctorName: editProfile.doctorName,

          appointmentStatus:
            p.appointmentStatus === "Cancelled"
              ? "Rescheduled"
              : editProfile.appointmentStatus,
        };
      }
      return p;
    });

    setPatients(updatedPatients);
    localStorage.setItem("patients", JSON.stringify(updatedPatients));
    setEditProfile(null);
  };

  useEffect(() => {
    const loadProfiles = () => {
      const storedProfiles =
        JSON.parse(localStorage.getItem("allProfiles")) || [];

      const appointments =
        JSON.parse(localStorage.getItem("appointments")) || [];

      const payments = JSON.parse(localStorage.getItem("payments")) || [];

      const updatedProfiles = storedProfiles.map((profile) => {
        const patientAppointments = appointments.filter(
          (a) =>
            String(a.phone || "").trim() === String(profile.phone || "").trim(),
        );

        const appointment =
          patientAppointments.length > 0
            ? patientAppointments.sort((a, b) => b.id - a.id)[0]
            : null;

        const payment = payments.find(
          (p) =>
            String(p.phone || "").trim() === String(profile.phone || "").trim(),
        );

        return {
          ...profile,

          sex: profile.sex || "-",
          pregnancyStatus: profile.pregnancyStatus || "-",

          appointmentStatus: appointment?.status || "Not Scheduled",
          appointmentDate: appointment?.date || "",
          appointmentTime: appointment?.time || "",
          doctorName: appointment?.doctor || appointment?.dentist || "",

          paymentStatus: payment?.status || "Unpaid",
        };
      });

      setProfiles(updatedProfiles);
    };

    // Pull the durable copy from the backend before rendering the list.
    // - Server has data  -> refresh the local cache from it (source of truth).
    // - Server empty but local has profiles -> migrate the existing local data up.
    // - Server unreachable -> fall back to whatever is in localStorage.
    const hydrate = async () => {
      try {
        const serverProfiles = await getPatients();
        const localProfiles =
          JSON.parse(localStorage.getItem("allProfiles")) || [];

        if (Array.isArray(serverProfiles) && serverProfiles.length > 0) {
          localStorage.setItem("allProfiles", JSON.stringify(serverProfiles));
        } else if (localProfiles.length > 0) {
          savePatients(localProfiles).catch((err) =>
            console.warn("savePatients (migration) failed:", err.message),
          );
        }
      } catch (err) {
        console.warn(
          "Patient hydrate failed, using local cache:",
          err.message,
        );
      } finally {
        loadProfiles();
      }
    };

    hydrate();

    const handleStorage = (e) => {
      if (
        e.key === "appointments" ||
        e.key === "payments" ||
        e.key === "cart"
      ) {
        loadProfiles();
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const confirmDelete = (id) => setDeleteId(id);

  const handleDelete = () => {
    const filteredProfiles = profiles.filter(
      (profile) => String(profile.patientId) !== String(deleteId),
    );
    setProfiles(filteredProfiles);
    localStorage.setItem("allProfiles", JSON.stringify(filteredProfiles));
    deletePatient(deleteId).catch((err) =>
      console.warn("deletePatient failed:", err.message),
    );
    setDeleteId(null);
    showSuccessToast("Profile Deleted Successfully!");
  };

  const handleEditSave = () => {
    const updatedProfiles = profiles.map((profile) =>
      profile.patientId === editProfile.patientId ? editProfile : profile,
    );

    setProfiles(updatedProfiles);

    localStorage.setItem("allProfiles", JSON.stringify(updatedProfiles));
    savePatient(editProfile).catch((err) =>
      console.warn("savePatient failed:", err.message),
    );

    setEditProfile(null);

    showSuccessToast("Profile Updated Successfully!");
  };

  const showSuccessToast = (message) => {
    setShowToast(message);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () =>
        setEditProfile({ ...editProfile, image: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleXrayChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length) {
      Promise.all(
        files.map((file) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                data: reader.result,
                type: file.type,
                name: file.name,
              });
            reader.readAsDataURL(file);
          });
        }),
      ).then((newXrays) => {
        setEditProfile((prev) => ({
          ...prev,
          xrayReports: prev.xrayReports
            ? [...prev.xrayReports, ...newXrays]
            : newXrays,
        }));
      });
    }
  };

  const filteredProfiles = profiles.filter((profile) =>
    (profile?.phone || "").includes(searchTerm),
  );

  return (
    <div className="p-4 sm:p-6 relative pb-32">
      <Breadcrumbs className="mb-4 flex-wrap">
        <a href="/HomePage" className="opacity-60">
          Home
        </a>
        <span>Profiles</span>
      </Breadcrumbs>

      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button className="whitespace-nowrap bg-black hover:bg-gray-800 text-white shadow-lg hover:scale-105 transition duration-300">
            <span className="font-semibold">+ Add Patient</span>
          </Button>

          <div className="relative w-44">
            <Input
              label="Search by Phone"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.replace(/\D/g, ""))}
              className="pr-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-2/4 transform -translate-y-1/2 text-gray-500 hover:text-black"
                aria-label="Clear search"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-end">
          <b>
            <Switch
              label="List View"
              color="green"
              checked={listView}
              onChange={() => setListView(!listView)}
            />
          </b>
          <MdNotificationsNone color="black" size={28} />
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => {
              localStorage.removeItem("isLoggedIn");
              localStorage.removeItem("user");
              localStorage.removeItem("loggedInUser");
              window.location.href = "/my-app";
            }}
          >
            <MdPowerSettingsNew color="black" size={18} />
          </button>
          <Avatar
            src="https://fellows.ias.ac.in/public/images/stock/avatar.svg?v=105894425"
            alt="User"
            size="sm"
          />
        </div>
      </div>

      <div
        className={`grid gap-6 ${
          listView
            ? "grid-cols-1"
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        }`}
      >
        {" "}
        {filteredProfiles.length > 0 ? (
          filteredProfiles.map((item) => (
            <CardItem
              key={item.patientId}
              item={item}
              onDelete={confirmDelete}
              onEdit={setEditProfile}
              searchTerm={searchTerm}
              listView={listView}
              onBook={handleBookAppointment}
              onUpdateAppointment={handleUpdateAppointment}
            />
          ))
        ) : (
          <p className="col-span-full text-center text-gray-500 mt-10">
            No profiles found.
          </p>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteId !== null}
        handler={() => setDeleteId(null)}
        size="xs"
        className="max-h-[90vh] flex flex-col"
      >
        <DialogHeader className="shrink-0">Confirm Deletion</DialogHeader>
        <DialogBody divider className="flex-1 min-h-0 overflow-y-auto">
          Are you sure you want to delete this profile?
        </DialogBody>
        <DialogFooter className="shrink-0">
          <Button
            variant="text"
            color="black"
            onClick={() => setDeleteId(null)}
          >
            Cancel
          </Button>
          <Button variant="gradient" color="black" onClick={handleDelete}>
            Delete
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Edit Profile Dialog with validation */}
      <Dialog
        handler={() => setEditProfile(null)}
        open={Boolean(editProfile)}
        size="md"
        className="max-h-[90vh] flex flex-col"
      >
        <DialogHeader className="shrink-0">Edit Profile</DialogHeader>
        <DialogBody
          divider
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4"
        >
          {" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Medical Conditions */}
            <div className="col-span-full grid grid-cols-2 gap-4 mt-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={editProfile?.diabetes || false}
                  onChange={(e) =>
                    setEditProfile({
                      ...editProfile,
                      diabetes: e.target.checked,
                    })
                  }
                />
                <span>Diabetes</span>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editProfile?.hypertension || false}
                  onChange={(e) =>
                    setEditProfile({
                      ...editProfile,
                      hypertension: e.target.checked,
                    })
                  }
                />
                <span>Hypertension</span>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editProfile?.bloodThinners || false}
                  onChange={(e) =>
                    setEditProfile({
                      ...editProfile,
                      bloodThinners: e.target.checked,
                    })
                  }
                />
                <span>Blood Thinners</span>
              </div>
            </div>
            <Input
              label="First Name"
              value={editProfile?.firstName || ""}
              onChange={(e) =>
                setEditProfile({ ...editProfile, firstName: e.target.value })
              }
            />
            <Input
              label="Last Name"
              value={editProfile?.lastName || ""}
              onChange={(e) =>
                setEditProfile({ ...editProfile, lastName: e.target.value })
              }
            />
            <Input
              label="Allergies"
              value={editProfile?.allergies || ""}
              onChange={(e) =>
                setEditProfile({
                  ...editProfile,
                  allergies: e.target.value,
                })
              }
            />
            <Input
              label="Email"
              type="email"
              value={editProfile?.email || ""}
              onChange={(e) =>
                setEditProfile({ ...editProfile, email: e.target.value })
              }
            />
            <Input
              label="Phone"
              value={editProfile?.phone || ""}
              maxLength={10}
              onChange={(e) =>
                setEditProfile({
                  ...editProfile,
                  phone: maxDigits(e.target.value, 10),
                })
              }
            />
            {(!editProfile?.phone || editProfile?.phone.length !== 10) && (
              <Typography color="red" className="text-xs mt-1">
                Phone must be 10 digits
              </Typography>
            )}
            {editProfile?.aadhaar && !validateAadhaar(editProfile.aadhaar) && (
              <Typography color="red" className="text-xs mt-1">
                Invalid Aadhaar (12 digits, cannot start with 0 or 1)
              </Typography>
            )}
            {/* Sex */}
            <Select
              label="Sex"
              value={editProfile?.sex || ""}
              onChange={(val) => setEditProfile({ ...editProfile, sex: val })}
            >
              <Option value="Male">Male</Option>
              <Option value="Female">Female</Option>
              <Option value="Other">Other</Option>
            </Select>
            {editProfile?.sex === "Female" && (
              <Select
                label="Pregnancy Status"
                value={editProfile?.pregnancyStatus || ""}
                onChange={(val) =>
                  setEditProfile({ ...editProfile, pregnancyStatus: val })
                }
              >
                <Option value="Not Pregnant">Not Pregnant</Option>
                <Option value="Pregnant">Pregnant</Option>
                <Option value="Unknown">Unknown</Option>
              </Select>
            )}
            {editProfile?.pregnancyStatus === "Pregnant" && (
              <div className="flex items-center gap-3">
                <Switch
                  color="red"
                  checked={editProfile?.highRisk || false}
                  onChange={(e) =>
                    setEditProfile({
                      ...editProfile,
                      highRisk: e.target.checked,
                    })
                  }
                />
                <span className="text-sm font-semibold text-red-600">
                  High Risk Pregnancy
                </span>
              </div>
            )}
            {editProfile?.pregnancyStatus === "Pregnant" && (
              <Input
                label="Pregnancy Notes"
                value={editProfile?.pregnancyNotes || ""}
                onChange={(e) =>
                  setEditProfile({
                    ...editProfile,
                    pregnancyNotes: e.target.value,
                  })
                }
              />
            )}
            {editProfile?.sex === "Female" &&
              editProfile?.pregnancyStatus === "Pregnant" && (
                <Select
                  label="Pregnancy Trimester"
                  value={editProfile?.trimester || ""}
                  onChange={(val) =>
                    setEditProfile({ ...editProfile, trimester: val })
                  }
                >
                  <Option value="1st Trimester">1st Trimester</Option>
                  <Option value="2nd Trimester">2nd Trimester</Option>
                  <Option value="3rd Trimester">3rd Trimester</Option>
                </Select>
              )}
            {/* Referred By */}
            <Input
              label="Referred By"
              value={editProfile?.referredBy || ""}
              onChange={(e) =>
                setEditProfile({ ...editProfile, referredBy: e.target.value })
              }
            />
            {/* Occupation */}
            <Input
              label="Occupation"
              value={editProfile?.occupation || ""}
              onChange={(e) =>
                setEditProfile({ ...editProfile, occupation: e.target.value })
              }
            />
            {/* Contact Preference */}
            <Select
              label="Contact Preference"
              value={editProfile?.contactPreference || ""}
              onChange={(val) =>
                setEditProfile({ ...editProfile, contactPreference: val })
              }
            >
              <Option value="Phone">Phone</Option>
              <Option value="Email">Email</Option>
              <Option value="WhatsApp">WhatsApp</Option>
              <Option value="SMS">SMS</Option>
            </Select>
            <Input
              label="Policy Number"
              value={editProfile?.policyNumber || ""}
              maxLength={10}
              onChange={(e) =>
                setEditProfile({
                  ...editProfile,
                  policyNumber: maxDigits(e.target.value, 10),
                })
              }
              error={editProfile?.policyNumber?.length >= 10}
              helperText={
                editProfile?.policyNumber?.length > 10
                  ? "Max 10 digits allowed"
                  : ""
              }
            />
            <Input
              label="Aadhaar Number"
              value={editProfile?.aadhaar || ""}
              maxLength={12}
              onChange={(e) =>
                setEditProfile({
                  ...editProfile,
                  aadhaar: maxDigits(e.target.value, 12),
                })
              }
              error={
                editProfile?.aadhaar && !validateAadhaar(editProfile.aadhaar)
              }
              helperText={
                editProfile?.aadhaar && !validateAadhaar(editProfile.aadhaar)
                  ? "Invalid Aadhaar (12 digits, cannot start with 0 or 1)"
                  : ""
              }
            />
            <Input
              label="Address"
              value={editProfile?.address || ""}
              onChange={(e) =>
                setEditProfile({ ...editProfile, address: e.target.value })
              }
            />
            <div>
              <label className="block mb-1 font-medium">Profile Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {editProfile?.image && (
                <img
                  src={editProfile.image}
                  alt="Profile Preview"
                  className="mt-2 w-28 h-28 object-cover rounded"
                />
              )}
            </div>
            <div className="col-span-full">
              <label className="block mb-1 font-medium">
                X-ray Reports (Images/PDFs)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={handleXrayChange}
              />
              <div className="mt-2 flex flex-wrap gap-2 max-h-40 overflow-auto border rounded p-2 bg-gray-50">
                {editProfile?.xrayReports &&
                editProfile.xrayReports.length > 0 ? (
                  editProfile.xrayReports.map((file, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 border rounded overflow-hidden shadow-sm bg-white"
                    >
                      {/* Delete Button */}
                      <button
                        type="button"
                        className="absolute top-0 right-0 bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-xs z-10"
                        onClick={() => {
                          const updatedXrays = editProfile.xrayReports.filter(
                            (_, i) => i !== idx,
                          );
                          setEditProfile({
                            ...editProfile,
                            xrayReports: updatedXrays,
                          });
                        }}
                      >
                        X
                      </button>

                      {file.type === "application/pdf" ? (
                        <>
                          <embed
                            src={file.data}
                            type="application/pdf"
                            width="100%"
                            height="100%"
                            className="object-cover"
                          />
                          <a
                            href={file.data}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute bottom-0 left-0 w-full bg-black bg-opacity-50 text-white text-xs text-center truncate"
                            title={file.name}
                          >
                            View PDF
                          </a>
                        </>
                      ) : (
                        <img
                          src={file.data}
                          alt={`X-ray-${idx}`}
                          className="w-full h-full object-cover"
                          title={file.name}
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-xs">No X-rays uploaded.</p>
                )}
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="shrink-0">
          {" "}
          <Button
            variant="text"
            color="black"
            onClick={() => setEditProfile(null)}
          >
            Cancel
          </Button>
          <Button
            variant="gradient"
            color="black"
            onClick={handleEditSave}
            disabled={!isProfileValid(editProfile)}
          >
            Save
          </Button>
        </DialogFooter>
      </Dialog>

      {showToast && (
        <div className="fixed bottom-5 right-5 bg-green-500 text-white px-4 py-2 rounded shadow-lg">
          {showToast}
        </div>
      )}

      {/* Fixed Footer */}
      <footer className="fixed bottom-0 left-0 w-full bg-white border-t shadow-md z-50">
        <div className="max-w-screen-xl mx-auto px-4 py-6 flex justify-between items-center text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-600">© {new Date().getFullYear()} DentalCare CRM</span>
            <div className="flex items-center gap-1.5 text-gray-500 text-xs">
              <span>Made in India</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="26" height="17" role="img" aria-label="Indian flag" style={{ borderRadius: 2, border: "1px solid #ddd" }}>
                <rect width="900" height="200" fill="#FF9933"/>
                <rect y="200" width="900" height="200" fill="#FFFFFF"/>
                <rect y="400" width="900" height="200" fill="#138808"/>
                <circle cx="450" cy="300" r="90" fill="none" stroke="#000080" strokeWidth="8"/>
                <circle cx="450" cy="300" r="10" fill="#000080"/>
                {Array.from({ length: 24 }).map((_, i) => {
                  const angle = (i * 15 * Math.PI) / 180;
                  return (<line key={i} x1={450 + 10 * Math.cos(angle)} y1={300 + 10 * Math.sin(angle)} x2={450 + 90 * Math.cos(angle)} y2={300 + 90 * Math.sin(angle)} stroke="#000080" strokeWidth="4"/>);
                })}
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a href="/Help" className="text-green-600 hover:underline">
              Help
            </a>

            <a
              href="https://wa.me/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-green-600 hover:underline"
            >
              <FaWhatsapp />
              Support
            </a>

            {/* Refresh Button */}
            <div className="absolute top-4 right-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded bg-black hover:bg-gray-800 text-white shadow-md hover:scale-105 transition duration-300"
              >
                <MdRefresh size={24} />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Profile;
