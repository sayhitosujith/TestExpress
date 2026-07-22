import React, { useState, useEffect } from "react";
import { MdCloudUpload, MdAdd } from "react-icons/md";
import Banner_wallpaper from "./assets/DentalWallpaper.png";
import { useTreatments, gifForTreatment } from "./context/TreatmentsContext";

const TREATMENT_OPTIONS = [
  "Root Canal Treatment",
  "Dental Crowns",
  "Laser Dentistry",
  "Invisible Braces",
  "Dental Fillings",
  "Wisdom Tooth Removal",
  "Dental Braces",
  "Dental Implants",
  "Dentures",
  "Kids Dentistry",
  "Mouth Ulcers",
  "Gum Treatment",
];

function AddTreatment({ onAddTreatment, onCancel }) {
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [treatmentName, setTreatmentName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!agreed) {
      alert("Please agree to the terms and conditions.");
      return;
    }

    if (!treatmentName || !price || !description) {
      alert("Please fill all the required fields.");
      return;
    }

    // Use the uploaded image; otherwise fall back to the known GIF for this
    // treatment name (the old via.placeholder.com URL no longer resolves).
    const src = previewUrl || gifForTreatment(treatmentName, "https://via.placeholder.com/150");

    const newTreatment = {
      name: treatmentName,
      price,
      description,
      src,
    };

    onAddTreatment(newTreatment);

    setImageFile(null);
    setTreatmentName("");
    setPrice("");
    setDescription("");
    setAgreed(false);
  };

  const isSubmitDisabled = !treatmentName || !price || !description || !agreed;

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-stone-100 shadow-xl overflow-hidden">
          <div
            className="px-6 py-8 text-center"
            style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)" }}
          >
            <h1 className="text-2xl font-black text-white">Add Treatment</h1>
            <p className="text-white/80 text-sm mt-1">Add a new treatment to the customer catalog</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-stone-50 border border-stone-100 flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Treatment preview" className="w-full h-full object-cover" />
                ) : (
                  <MdCloudUpload size={28} className="text-stone-300" />
                )}
              </div>
            </div>

            <div>
              <label htmlFor="file_input" className="block mb-1.5 text-xs font-semibold text-stone-500">
                Upload Image (JPEG, PNG)
              </label>
              <input
                id="file_input"
                type="file"
                accept="image/png, image/jpeg"
                onChange={(e) => setImageFile(e.target.files[0])}
                className="block w-full text-sm text-stone-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100"
              />
            </div>

            <div>
              <label htmlFor="treatment_name" className="block mb-1.5 text-xs font-semibold text-stone-500">
                Treatment Name
              </label>
              <select
                id="treatment_name"
                value={treatmentName}
                onChange={(e) => setTreatmentName(e.target.value)}
                required
                className="w-full border border-stone-200 rounded-xl p-2.5 text-sm text-stone-700 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              >
                <option value="">Select a treatment</option>
                {TREATMENT_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="price_input" className="block mb-1.5 text-xs font-semibold text-stone-500">
                Price (£)
              </label>
              <input
                id="price_input"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
                className="w-full border border-stone-200 rounded-xl p-2.5 text-sm text-stone-700 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>

            <div>
              <label htmlFor="description_input" className="block mb-1.5 text-xs font-semibold text-stone-500">
                Description
              </label>
              <textarea
                id="description_input"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full border border-stone-200 rounded-xl p-2.5 text-sm text-stone-700 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none"
              />
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-stone-300 text-orange-600 focus:ring-orange-400"
              />
              <span className="text-xs text-stone-500">
                I agree to the{" "}
                <button type="button" className="font-semibold text-orange-600 hover:text-orange-700">
                  Terms and Conditions
                </button>
              </span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="flex-1 flex items-center justify-center gap-1.5 text-white font-bold text-sm py-2.5 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
                style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", boxShadow: "0 6px 18px rgba(234,88,12,0.25)" }}
              >
                <MdAdd size={18} /> Add Treatment
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 font-bold text-sm py-2.5 rounded-xl border-2 border-stone-200 text-stone-700 bg-white hover:border-orange-400 hover:text-orange-600 transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </form>

          <p className="px-6 pb-6 text-xs text-stone-400 text-center">
            Add a new treatment as offered by the clinic. Customers will see it once published.
          </p>
        </div>
      </div>

      <div className="hidden lg:block lg:flex-1">
        <img src={Banner_wallpaper} alt="Modern dental clinic" className="w-full h-full object-cover" />
      </div>
    </div>
  );
}

function ParentComponent() {
  const { treatments, addTreatment } = useTreatments();
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddTreatment = (newTreatment) => {
    addTreatment(newTreatment);
    setShowAddForm(false); // hide form after adding
  };

  const handleCancel = () => {
    setShowAddForm(false); // hide form on cancel
  };

  return (
    <div className="min-h-screen bg-white">
      {!showAddForm ? (
        <div className="max-w-2xl mx-auto p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-stone-900">Treatments</h2>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", boxShadow: "0 6px 18px rgba(234,88,12,0.25)" }}
            >
              <MdAdd size={18} /> Add Treatment
            </button>
          </div>
          <ul className="space-y-3">
            {treatments.map((t) => (
              <li key={t.id} className="flex items-center justify-between bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
                <div>
                  <p className="font-bold text-sm text-stone-900">{t.name}</p>
                  <p className="text-xs text-stone-500 mt-1">
                    {t.price ? `£${t.price}` : "No price set"}
                    {t.description ? ` · ${t.description}` : ""}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full flex-shrink-0 ${
                    t.published ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {t.published ? "Published" : "Draft"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <AddTreatment onAddTreatment={handleAddTreatment} onCancel={handleCancel} />
      )}
    </div>
  );
}

export default ParentComponent;
