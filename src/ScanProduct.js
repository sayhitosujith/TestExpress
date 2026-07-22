import React, { useEffect, useState } from "react";
import "./ScanProduct.css";
import {
  MdContentCopy,
  MdEdit,
  MdDelete,
  MdChevronLeft,
  MdChevronRight,
} from "react-icons/md";
import logo from "./assets/Jala.jpg";

export default function SareeScanner() {
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem("products");
    return saved ? JSON.parse(saved) : {};
  });

  const [form, setForm] = useState({
    code: "",
    name: "",
    price: "",
    qty: "",
    image: "",
  });

  const [editCode, setEditCode] = useState(null);

  const [selectedItems, setSelectedItems] = useState([]);
  const handleSelect = (code) => {
  setSelectedItems((prev) =>
    prev.includes(code)
      ? prev.filter((c) => c !== code)
      : [...prev, code]
  );
};

const handleSelectAll = () => {
  if (selectedItems.length === currentItems.length) {
    setSelectedItems([]);
  } else {
    setSelectedItems(currentItems.map(([code]) => code));
  }
};

const deleteSelected = () => {
  if (selectedItems.length === 0) return;

  if (!window.confirm("Delete selected products?")) return;

  setProducts((prev) => {
    const updated = { ...prev };
    selectedItems.forEach((code) => delete updated[code]);
    return updated;
  });

  setSelectedItems([]);
  setCurrentPage(1);
};

  const cloneProduct = (code) => {
  const product = products[code];
  if (!product) return;

  // create new unique code
  let newCode = code + "_copy";
  let counter = 1;

  while (products[newCode]) {
    newCode = `${code}_copy${counter}`;
    counter++;
  }

  setProducts((prev) => ({
    ...prev,
    [newCode]: {
      ...product,
    },
  }));

  setCurrentPage(1);
};

  // ✅ Pagination state (MOVE UP)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // ---------- TOTAL ----------
  const total = Object.values(products).reduce(
    (sum, p) => sum + (Number(p.price) || 0) * (Number(p.qty) || 0),
    0,
  );

  
  // ---------- ADD / UPDATE PRODUCT ----------
  const uploadProduct = (e) => {
  e.preventDefault();
  if (!form.code) return;

  setProducts((prev) => {
    const updated = { ...prev };

    // If editing and code changed → delete old key
    if (editCode && editCode !== form.code) {
      delete updated[editCode];
    }

    updated[form.code] = {
      name: form.name,
      price: Number(form.price) || 0,
      qty: Number(form.qty) || 1,
      image: form.image,
    };

    return updated;
  });

  setEditCode(null);

  setForm({
    code: "",
    name: "",
    price: "",
    qty: "",
    image: "",
  });
};

  // ---------- DELETE ----------
  const deleteProduct = (code) => {
    if (!window.confirm("Delete this product?")) return;

    setProducts((prev) => {
      const updated = { ...prev };
      delete updated[code];
      return updated;
    });

    setCurrentPage(1); // ✅ now safe
  };

  // ---------- EDIT ----------
  const handleEdit = (code) => {
  const product = products[code];

  setForm({
    code,
    name: product.name,
    price: product.price,
    qty: product.qty,
    image: product.image || "",
  });

  setEditCode(code);

  window.scrollTo({ top: 0, behavior: "smooth" }); // 👈 nice UX
};

  // ---------- PAGINATION ----------
  const entries = Object.entries(products);

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;

  const currentItems = entries.slice(indexOfFirst, indexOfLast);

  const totalPages = Math.max(1, Math.ceil(entries.length / itemsPerPage)); // ✅ fix

  // ---------- STORAGE ----------
  useEffect(() => {
    localStorage.setItem("products", JSON.stringify(products));
  }, [products]);

  return (
    <div className="app-container">
<div className="header">
  <div className="header-left">
    <img src={logo} alt="logo" className="logo" />
    <span>Saree Billing System</span>
  </div>
</div>
      {/* Upload */}
      <div className="card">
        <h3>Upload Saree</h3>

        <form onSubmit={uploadProduct} className="form-grid">
          <input
  placeholder="Saree code"
  value={form.code}
  readOnly={editCode !== null}   // ✅ use readOnly instead of disabled
  onChange={(e) => setForm({ ...form, code: e.target.value })}
/>

          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />

          <input
            placeholder="Qty"
            value={form.qty}
            onChange={(e) => setForm({ ...form, qty: e.target.value })}
          />

          {/* Image Upload */}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onloadend = () => {
                setForm((prev) => ({
                  ...prev,
                  image: reader.result,
                }));
              };
              reader.readAsDataURL(file);
            }}
          />

          <div style={{ gridColumn: "span 6", textAlign: "right" }}>
            <button type="submit" className="save-btn">
              {editCode ? "Update" : "Save"}
            </button>
          </div>
        </form>
      </div>

      {/* Stock */}
      <div className="card" style={{ width: "100%" }}>
<h3 style={{ textAlign: "center" }}>SAREE STOCK</h3>

<div style={{ marginBottom: "10px", textAlign: "right" }}>
  <button
  onClick={deleteSelected}
  disabled={selectedItems.length === 0}
  style={{
    backgroundColor: "red",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "5px",
    cursor: "pointer",
  }}
>
  Delete Selected
</button>
</div>

        <table className="table">
          <thead>
            <tr>
                 <th>
    <input
      type="checkbox"
      onChange={handleSelectAll}
      checked={
        selectedItems.length === currentItems.length &&
        currentItems.length > 0
      }
    />
  </th>
              <th>Saree Code</th>
              <th>Name</th>
              <th>Price</th>
              <th>Qty</th>
              <th>Image</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {currentItems.map(([code, p]) => (
              <tr key={code}>
  <td>
    <input
      type="checkbox"
      checked={selectedItems.includes(code)}
      onChange={() => handleSelect(code)}
    />
  </td>
  <td>{code}</td>
  <td>{p.name}</td>
  <td>₹{p.price}</td>
  <td>{p.qty}</td>
                <td>
                  {p.image && (
                    <img
                      src={p.image}
                      alt="saree"
                      style={{
                        width: "50px",
                        height: "50px",
                        objectFit: "cover",
                        borderRadius: "6px",
                      }}
                    />
                  )}
                </td>

   <td>
  <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
    
    <button className="icon-btn" onClick={() => handleEdit(code)}>
      <MdEdit size={55} />
    </button>

    <button className="icon-btn" onClick={() => cloneProduct(code)}>
      <MdContentCopy size={35}/>
    </button>

    <button
      className="icon-btn btn-delete"
      onClick={() => deleteProduct(code)}
    >
      <MdDelete size={35} />
    </button>

  </div>
</td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td colSpan="4"></td>
              <td
                colSpan="2"
                style={{
                  fontWeight: "bold",
                  textAlign: "right",
                }}
              >
                Total Price: ₹{total}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Pagination */}
        <div style={{ marginTop: "10px", textAlign: "center" }}>
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
          >
            <MdChevronLeft />
 
          </button>

          <span style={{ margin: "0 10px" }}>
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <MdChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}
