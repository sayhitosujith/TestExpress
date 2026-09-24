import React, { useState, useEffect } from "react";
import { Typography, Input, Button } from "@material-tailwind/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import emailjs from "@emailjs/browser";
import { logAction } from "./api/actions";
// Shared with the Super Admin editor, so a face uploaded on either screen is
// stored at the same size and the avatar circle is sharp wherever it is drawn.
import { fileToAvatarDataUrl } from "./avatarImage";
import { PAYMENT_OPTIONS } from "./constants";
// The live catalogue, so a plan added or renamed in the database appears here.
// PAYMENT_OPTIONS is the shipped default underneath it — see ./plans — so this
// select renders either way. The price is deliberately NOT shown: it lives in
// the catalogue and in the Subscriptions panel, and this form is where somebody
// picks a plan rather than where they are quoted for one.
import { PLANS } from "./plans";
// The payment step a paid plan goes through before it can sign in.
import { openCheckout } from "./api/checkout";
// The credentials that step needs to sign the account in afterwards. In memory
// for one navigation — see ./pendingSignIn for why not storage.
import { remember } from "./pendingSignIn";
// Registration goes through the backend so the password is hashed there.
import { register } from "./api/auth";
// This screen is on a public route, so which roles it may hand out depends on
// who is filling it in — see assignableRoles.
import { useAuth } from "./context/AuthContext";
import { assignableRoles, PRIVILEGED_ROLES, roleAllowed } from "./routeAccess";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

function NewRegistration() {
  // Who is filling this form in, if anyone. A visitor signing themselves up has
  // no session at all, which is exactly the case assignableRoles narrows.
  const { user: actingUser } = useAuth() || {};
  const offeredRoles = assignableRoles(actingUser && actingUser.role);
  // An administrator adding someone else's account, as opposed to a visitor
  // signing themselves up. Only this case skips the password fields below —
  // the server issues a temporary access key and emails it instead, so an
  // administrator never has to invent a password and relay it by hand.
  const isAdminCreating = roleAllowed(PRIVILEGED_ROLES, actingUser && actingUser.role);

  const sendRegistrationEmail = async (user) => {
    const templateParams = {
      first_name: user.firstName,
      email: user.email,
      phone: user.phoneNumber,
    };

    try {
      await emailjs.send(
        "service_xxxxx",
        "template_xxxxx",
        templateParams,
        "public_xxxxx",
      );
      console.log("✅ Email sent successfully");
    } catch (error) {
      console.error("❌ Email failed:", error);
    }
  };

  const emptyForm = {
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    zipCode: "",
    payment: "",
    role: "",
    profilePicture: "",
  };
  const [users, setUsers] = useState(() => {
    const storedUsers = localStorage.getItem("registeredUsers");
    return storedUsers ? JSON.parse(storedUsers) : [];
  });

  const navigate = useNavigate();
  // Which plan they pressed "Get started" on. A query parameter rather than
  // router state so it survives a refresh and can be linked to — and so the
  // form still works when somebody arrives here directly with no plan in mind.
  const [params] = useSearchParams();
  const chosenPlan = params.get("plan");

  const [formData, setFormData] = useState(() =>
    chosenPlan && PLANS.some((o) => o.value === chosenPlan)
      ? { ...emptyForm, payment: chosenPlan }
      : emptyForm,
  );
  const [editIndex, setEditIndex] = useState(null);
  const [phoneError, setPhoneError] = useState("");

  // Load users on mount
  useEffect(() => {
    const loadUsers = () => {
      const data = JSON.parse(localStorage.getItem("registeredUsers")) || [];
      setUsers(data);
    };
    loadUsers();
    window.addEventListener("storage", loadUsers);
    return () => window.removeEventListener("storage", loadUsers);
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem("registeredUsers", JSON.stringify(users));
  }, [users]);

  // Unique ID generator
  const generateUniqueId = () => "_" + Math.random().toString(36).substr(2, 9);

  // Squared and cut down to the avatar's own size before it is stored, so the
  // round picture is sharp in every circle that draws it and the record does
  // not carry a whole phone photo — see ./avatarImage.
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileToAvatarDataUrl(file)
      .then((profilePicture) => {
        setFormData((prev) => ({ ...prev, profilePicture }));
      })
      .catch(() => {});
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "phoneNumber") {
      const onlyDigits = value.replace(/\D/g, "");
      if (onlyDigits.length <= 10) {
        setFormData((prev) => ({ ...prev, phoneNumber: onlyDigits }));
      }
      setPhoneError(
        onlyDigits.length > 0 && onlyDigits.length < 10
          ? "Phone number must be 10 digits"
          : "",
      );
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Submit form
  // Async: the password is hashed by the backend before anything is stored,
  // so the record this screen keeps has a hash on it and never a plaintext
  // password. See src/api/auth.js.
  const handleSubmit = async (e) => {
    e.preventDefault();
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      confirmPassword,
      zipCode,
      payment,
      role,
    } = formData;

    // On an edit the password boxes are optional: they start empty because
    // nothing readable is stored to prefill them with, and demanding one on
    // every save would mean retyping a password — or inventing a new one — to
    // correct a zip code. Left blank, the account keeps the password it has.
    //
    // The one exception is a record that carries no hash at all: a user created
    // before passwords were hashed, or one whose plaintext has been scrubbed
    // without ever being re-saved. Saving that without a password would leave an
    // account nobody can sign in to, so there it is still required.
    const changingPassword = !!password || !!confirmPassword;
    const editing = editIndex !== null;
    // An administrator adding someone else's account never types a password
    // for them — see isAdminCreating and the server-issued access key it
    // triggers — so the usual "a password is required" rule does not apply.
    const passwordRequired = !isAdminCreating && (!editing || !users[editIndex]?.passwordHash);

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phoneNumber ||
      (passwordRequired && (!password || !confirmPassword)) ||
      !zipCode ||
      !payment ||
      !role
    ) {
      alert(
        passwordRequired && editing && !password
          ? "This account has no password set yet — enter one to finish updating it."
          : "Please fill all fields",
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Enter a valid email");
      return;
    }

    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      setPhoneError("Phone number must be exactly 10 digits");
      return;
    }

    // Only meaningful when one of them was typed into; two blanks match, and
    // that is the "keep the current password" case rather than an error.
    if (changingPassword && password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    if (editIndex !== null) {
      if (
        users.some(
          (user, i) => user.phoneNumber === phoneNumber && i !== editIndex,
        )
      ) {
        setPhoneError("Phone number already registered");
        return;
      }

      const updatedUsers = [...users];
      updatedUsers[editIndex] = {
        ...updatedUsers[editIndex],
        firstName,
        lastName,
        email,
        phoneNumber,
        zipCode,
        payment,
        role,
        profilePicture: formData.profilePicture,
      };

      // Register through the backend so any new password is hashed there, and
      // keep the record it returns — safe fields plus the hash, no plaintext.
      // Awaited rather than fire-and-forget: an account whose password never
      // reached the server cannot be signed in to, so silently carrying on
      // would leave a user who looks saved and cannot log in.
      //
      // `password` is sent ONLY when one was typed. Sending an empty string
      // would read as "set the password to nothing"; omitting it entirely is
      // what tells the server to leave the stored hash alone.
      try {
        const saved = await register({
          ...updatedUsers[editIndex],
          ...(changingPassword ? { password } : {}),
        });
        updatedUsers[editIndex] = { ...updatedUsers[editIndex], ...saved };
      } catch (err) {
        alert(`Could not update this user: ${err.message}`);
        return;
      }
      setUsers(updatedUsers);

      // 🗄️ Log the profile update (never logs the password)
      logAction("user_updated", {
        appointmentId: updatedUsers[editIndex].id,
        patientName: `${firstName} ${lastName}`.trim(),
        phone: phoneNumber,
        email,
        role,
        payment,
        zipCode,
      }).catch((err) => console.warn("logAction failed:", err.message));

      alert("User Updated Successfully!");
    } else {
      if (users.some((user) => user.email === email)) {
        alert("Email already registered");
        return;
      }
      if (users.some((user) => user.phoneNumber === phoneNumber)) {
        setPhoneError("Phone number already registered");
        return;
      }

      // Whether this plan has to be paid for before the account may be used.
      // A strict lookup rather than planFor, which falls back to the first plan
      // for anything it does not recognise — here that would quietly treat an
      // unknown plan as free.
      const planRecord = PLANS.find((o) => o.value === payment);
      const paidPlan = Boolean(planRecord && planRecord.price);

      const newUser = {
        id: generateUniqueId(),
        firstName,
        lastName,
        email,
        phoneNumber,
        zipCode,
        payment,
        role,
        profilePicture: formData.profilePicture,
        // A paid plan starts unable to sign in, and the checkout below is the
        // only thing that switches this off. That rule is for a visitor
        // signing themselves up — the same browser continues straight to
        // payment. An administrator adding someone else's account has no
        // such next step to redirect through, so the account they created
        // would be silently stuck disabled with an access key that cannot
        // actually be used. Billing for an admin-provisioned account is the
        // administrator's business to arrange, not something this form can
        // enforce for them.
        ...(paidPlan && !isAdminCreating ? { signInDisabled: true } : {}),
      };

      // As in the edit path: the backend hashes, and what comes back is what is
      // stored locally and pushed by dbSync.
      let savedUser;
      try {
        savedUser = { ...newUser, ...(await register({ ...newUser, password })) };
      } catch (err) {
        alert(`Could not register this user: ${err.message}`);
        return;
      }
      setUsers([...users, savedUser]);

      sendRegistrationEmail(savedUser);

      // 🗄️ Log the registration (never logs the password)
      logAction("user_registered", {
        appointmentId: newUser.id,
        patientName: `${firstName} ${lastName}`.trim(),
        phone: phoneNumber,
        email,
        role,
        payment,
        zipCode,
      }).catch((err) => console.warn("logAction failed:", err.message));

      // Where a paid plan goes next. The account is real but cannot sign in
      // yet — see the signInDisabled above — so it is walked through the
      // payment step, which is the only thing that switches sign-in on.
      // Skipped entirely for an administrator creating someone else's
      // account: there is no self-checkout to send them through, and their
      // own browser paying for another account is not what this step means.
      //
      // The credentials are held in memory for that one navigation so the
      // person is signed in automatically when it settles; losing them (a
      // reload) costs the convenience and nothing else.
      if (paidPlan && !isAdminCreating) {
        try {
          const { checkout } = await openCheckout({ email, plan: payment });
          remember({ email, password });
          setFormData(emptyForm);
          setEditIndex(null);
          setPhoneError("");
          navigate("/Checkout?token=" + encodeURIComponent(checkout.token));
          return;
        } catch (err) {
          // The account exists and is blocked, so saying "registered" and
          // stopping would leave somebody unable to sign in with no idea why.
          alert(
            "Your account was created on " +
              payment +
              ", but the payment step could not be opened: " +
              err.message +
              "\n\nIt cannot sign in until the plan is paid for — an administrator can " +
              "switch sign-in on, or you can register again on the Free plan.",
          );
          return;
        }
      }

      alert("User Registered Successfully! Email sent.");
    }

    setFormData(emptyForm);
    setEditIndex(null);
    setPhoneError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-green-100 via-green-700 to-green-900 p-6 md:p-10">
      {/* CENTER WRAPPER */}
      <div className="flex items-center justify-center min-h-screen">
        {/* CARD */}
        <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl p-10">
          <h2 className="text-3xl font-bold text-center text-green-700 mb-8">
            {editIndex !== null ? "Edit User" : "New User Registration"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                Select Profile Picture
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="border rounded-md p-2 w-full"
              />

              {formData.profilePicture && (
                <img
                  src={formData.profilePicture}
                  alt="Preview"
                  className="mt-3 h-20 w-20 rounded-full object-cover border"
                />
              )}
            </div>
            <Input
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
            />
            <Input
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
            />
            <Input
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
            <div>
              <Input
                label="Phone Number"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                maxLength={10}
              />
              {phoneError && (
                <p className="text-red-500 text-sm mt-1">{phoneError}</p>
              )}
            </div>
            {/* An administrator adding someone else's account never types a
                password here — the server issues a temporary access key and
                emails it to the new account instead, so nobody has to invent
                one and relay it out of band. */}
            {isAdminCreating ? (
              <p className="text-gray-500 text-sm md:col-span-2">
                An access key will be generated and emailed to this person — no
                password needed here.
              </p>
            ) : (
              <>
                {/* On an edit these start empty and stay optional, so the label
                    has to say so — an empty required-looking box is how someone
                    ends up inventing a new password just to change a phone
                    number. */}
                <Input
                  label={editIndex !== null ? "New Password (optional)" : "Password"}
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <Input
                  label={
                    editIndex !== null ? "Confirm New Password" : "Confirm Password"
                  }
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                {editIndex !== null && (
                  <p className="text-gray-500 text-xs -mt-4 md:col-span-2">
                    Leave both password boxes empty to keep the current password.
                  </p>
                )}
              </>
            )}
            <Input
              label="Zip Code"
              name="zipCode"
              value={formData.zipCode}
              onChange={handleChange}
            />
            <select
              name="payment"
              value={formData.payment}
              onChange={handleChange}
              className="border rounded-md p-2"
            >
              <option value="">Select a plan</option>
              {(PLANS.length ? PLANS : PAYMENT_OPTIONS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="border rounded-md p-2"
            >
              <option value="">Select Role</option>
              {/* Not a hardcoded list any more. Super Admin was offered to
                  every visitor of this public page, which let anyone grant
                  themselves the one role the /SuperAdmin guard checks for. */}
              {offeredRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
              {/* An account that already holds a role this user may not assign
                  keeps it: the control has to be able to show the value it is
                  editing, or saving an unrelated field would silently demote
                  them. It cannot be chosen for anyone who does not have it. */}
              {formData.role && !offeredRoles.includes(formData.role) && (
                <option value={formData.role}>{formData.role}</option>
              )}
            </select>

            <div className="md:col-span-2 flex gap-4 mt-4">
              <Button
                type="submit"
                className="flex-1 text-white font-semibold py-2 rounded-md
             bg-black
             hover:bg-gray-800 transition"
              >
                {editIndex !== null ? "Update User" : "Register"}
              </Button>
              <Button
                variant="outlined"
                color="black"
                className="flex-1"
                onClick={() => {
                  setFormData(emptyForm);
                  setEditIndex(null);
                  setPhoneError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>

          <Typography variant="small" className="mt-6 text-center">
            Already have an account?{" "}
            <Link
              to="/my-app"
              className="inline-block text-white font-bold uppercase tracking-wide px-6 py-2 rounded-md
             bg-black hover:bg-gray-800
             hover:shadow-lg hover:scale-[1.02] transition-all"
            >
              Login
            </Link>
          </Typography>
        </div>
      </div>
    </div>
  );
}

export default NewRegistration;
