import React, { createContext, useContext, useState, useEffect } from "react";

const DEFAULT_TREATMENTS = [
  { id: 1, name: "Root Canal Treatment", src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/RCT.gif", price: "250", description: "", published: true, isNew: false },
  { id: 2, name: "Dental Crowns", src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Crowns.gif", price: "300", description: "", published: true, isNew: false },
  { id: 3, name: "Laser Dentistry", src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2022/09/Laser-Treatment-1.gif", price: "150", description: "", published: true, isNew: false },
  { id: 4, name: "Invisible Braces", src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2025/06/Invisible-Braces-1.gif", price: "2000", description: "", published: true, isNew: false },
  { id: 5, name: "Dental Fillings", src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dental-Fillings-1-1.gif", price: "90", description: "", published: true, isNew: false },
  { id: 6, name: "Wisdom Tooth Removal", src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Wisdom-Tooth-1.gif", price: "8000", description: "", published: true, isNew: false },
  { id: 7, name: "Dental Braces", src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2017/05/Braces-2.gif", price: "1500", description: "", published: true, isNew: false },
  { id: 8, name: "Dental Implants", src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dental-Implants.gif", price: "1200", description: "", published: true, isNew: false },
  { id: 9, name: "Dentures", src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dentures.gif", price: "500", description: "", published: true, isNew: false },
  { id: 10, name: "Kids Dentistry", src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Kids-Dentistery.gif", price: "60", description: "", published: true, isNew: false },
  { id: 11, name: "Mouth Ulcers", src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Mouth-ulcers-1-2.gif", price: "40", description: "", published: true, isNew: false },
  { id: 12, name: "Gum Treatment", src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2017/05/Gum-Treatment.gif", price: "120", description: "", published: true, isNew: false },
];

const STORAGE_KEY = "treatments";

// Known treatment name -> correct GIF, derived from the defaults above.
// Used to auto-fill the right image when a treatment is added without an
// uploaded picture, and to repair entries saved with a dead placeholder URL.
export const TREATMENT_IMAGE_BY_NAME = DEFAULT_TREATMENTS.reduce((map, t) => {
  map[t.name.trim().toLowerCase()] = t.src;
  return map;
}, {});

// Known treatment name -> default price (GBP), used to backfill entries that
// were saved before treatments carried a price (older data had price: "").
export const TREATMENT_PRICE_BY_NAME = DEFAULT_TREATMENTS.reduce((map, t) => {
  map[t.name.trim().toLowerCase()] = t.price;
  return map;
}, {});

const hasNoPrice = (price) => price === "" || price == null;

// Placeholder/broken sources that should be replaced with the correct GIF.
const isBrokenSrc = (src) =>
  !src || /via\.placeholder\.com|placeholder\.com/i.test(src);

export const gifForTreatment = (name, fallback) =>
  TREATMENT_IMAGE_BY_NAME[(name || "").trim().toLowerCase()] || fallback;

// Drop duplicate treatments that share the same name (case-insensitive),
// keeping the first occurrence. Guards against duplicates saved to storage.
const dedupeByName = (list) => {
  const seen = new Set();
  return list.filter((t) => {
    const key = (t.name || "").trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Repair saved treatments: swap dead placeholder images for the correct GIF,
// and backfill a missing price from the known defaults — both matched by name.
const repairTreatments = (list) =>
  dedupeByName(list).map((t) => {
    const key = (t.name || "").trim().toLowerCase();
    let next = t;
    if (isBrokenSrc(t.src) && TREATMENT_IMAGE_BY_NAME[key]) {
      next = { ...next, src: TREATMENT_IMAGE_BY_NAME[key] };
    }
    if (hasNoPrice(next.price) && TREATMENT_PRICE_BY_NAME[key]) {
      next = { ...next, price: TREATMENT_PRICE_BY_NAME[key] };
    }
    return next;
  });

// One-time price migration. Bump the version and list the prices to force
// (name -> price) whenever you need a stored catalog to pick up a new price on
// the next load. It runs a single time per browser, so any price the user
// later edits in the catalog is preserved and not overwritten again.
const PRICE_MIGRATION_KEY = "treatmentsPriceMigration";
const PRICE_MIGRATION_VERSION = "2026-07-17-wisdom-8000";
const FORCED_PRICES = { "wisdom tooth removal": "8000" };

const applyPriceMigration = (list) => {
  try {
    if (localStorage.getItem(PRICE_MIGRATION_KEY) === PRICE_MIGRATION_VERSION) {
      return list;
    }
    const migrated = list.map((t) => {
      const key = (t.name || "").trim().toLowerCase();
      return FORCED_PRICES[key] ? { ...t, price: FORCED_PRICES[key] } : t;
    });
    localStorage.setItem(PRICE_MIGRATION_KEY, PRICE_MIGRATION_VERSION);
    return migrated;
  } catch {
    return list;
  }
};

const TreatmentsContext = createContext();

export const TreatmentsProvider = ({ children }) => {
  const [treatments, setTreatments] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return applyPriceMigration(DEFAULT_TREATMENTS);
    const repaired = repairTreatments(JSON.parse(saved));
    // Fall back to defaults if the stored catalog is empty/corrupt, so the
    // booking dropdown always has treatments to offer.
    const base = repaired.length ? repaired : DEFAULT_TREATMENTS;
    return applyPriceMigration(base);
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(treatments));
  }, [treatments]);

  const addTreatment = (treatment) => {
    setTreatments((prev) => {
      const name = (treatment.name || "").trim().toLowerCase();
      // Skip if a treatment with the same name already exists.
      if (prev.some((t) => (t.name || "").trim().toLowerCase() === name)) return prev;
      const nextId = prev.reduce((max, t) => Math.max(max, t.id), 0) + 1;
      return [...prev, { published: false, ...treatment, id: nextId, isNew: true }];
    });
  };

  const deleteTreatment = (id) => {
    setTreatments((prev) => prev.filter((t) => t.id !== id));
  };

  const setPublished = (id, published) => {
    setTreatments((prev) => prev.map((t) => (t.id === id ? { ...t, published } : t)));
  };

  // Re-read the latest treatments from storage (e.g. changed in another tab / admin page)
  const refreshTreatments = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const next = dedupeByName(JSON.parse(saved));
      setTreatments((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      );
    } catch {}
  };

  return (
    <TreatmentsContext.Provider value={{ treatments, addTreatment, deleteTreatment, setPublished, refreshTreatments }}>
      {children}
    </TreatmentsContext.Provider>
  );
};

export const useTreatments = () => useContext(TreatmentsContext);
