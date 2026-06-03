import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Typography,
  Textarea,
  Button,
  Select,
  Option,
  Checkbox,
} from "@material-tailwind/react";
import { Avatar } from "@material-tailwind/react";

function AddMeal({ onAddMeal, onCancel }) {
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
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

    if (!itemName || !quantity || !description) {
      alert("Please fill all the required fields.");
      return;
    }

    const src = previewUrl || "https://via.placeholder.com/150";

    const newMeal = {
      name: itemName,
      quantity,
      description,
      src,
    };

    onAddMeal(newMeal);

    // Reset form
    setImageFile(null);
    setItemName("");
    setQuantity("");
    setDescription("");
    setAgreed(false);
  };

  const isSubmitDisabled = !itemName || !quantity || !description || !agreed;

  return (
    <div className="flex flex-row gap-5">
      <div className="w-1/2 h-screen flex items-center justify-center">
        <Card className="w-98">
          <CardHeader variant="gradient" color="gray" className="mb-4 grid h-28 place-items-center">
            <Typography variant="h3" color="white">
              Add Meal Box
            </Typography>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <form onSubmit={handleSubmit}>
              <Avatar
                src={
                  previewUrl
                    ? previewUrl
                    : "https://www.pngitem.com/pimgs/m/78-786293_1240-x-1240-0-avatar-profile-icon-png.png"
                }
                alt="avatar"
                size="xxl"
                className="mb-4"
              />

              <label className="block mb-2 font-medium" htmlFor="file_input">
                Upload Image (JPEG, PNG)
              </label>
              <input
                id="file_input"
                type="file"
                accept="image/png, image/jpeg"
                onChange={(e) => setImageFile(e.target.files[0])}
                className="block w-full mb-4"
              />

              <Select
                label="Select Item"
                value={itemName}
                onChange={(value) => setItemName(value)}
                required
              >
                <Option value="Chapati">Chapati</Option>
                <Option value="Poori">Poori</Option>
              </Select>

              <label className="block mt-4 mb-2 font-medium" htmlFor="number-input">
                Select Quantity:
              </label>
              <input
                id="number-input"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full p-2 rounded border"
                required
              />

              <label className="block mt-4 mb-2 font-medium">Description:</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              <Checkbox
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                label={
                  <Typography variant="small" color="gray" className="flex items-center font-normal">
                    I agree to the{" "}
                    <button type="button" className="font-medium transition-colors hover:text-gray-900 ml-1">
                      Terms and Conditions
                    </button>
                  </Typography>
                }
                containerProps={{ className: "-ml-2.5 mt-4" }}
              />

              <CardFooter className="pt-6 flex gap-4">
                <Button type="submit" variant="gradient" fullWidth disabled={isSubmitDisabled}>
                  Add Meal
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={(e) => {
                    e.preventDefault();
                    onCancel();
                  }}
                >
                  Cancel
                </Button>
              </CardFooter>
            </form>
          </CardBody>

          <Typography variant="small" className="mt-6 flex justify-center">
            <b>
              NOTE : Add a new Meal box as per customer Request, User can request multiple meal boxes
            </b>
          </Typography>
        </Card>
      </div>
      <img
        style={{ width: "60%", height: "100vh" }}
        src="https://80a12acdf128618db717-c22bdc94c381e6a71ffe213927c1cf90.ssl.cf1.rackcdn.com/auto2.gif"
        alt="Animation"
      />
    </div>
  );
}

function ParentComponent() {
  const [meals, setMeals] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddMeal = (newMeal) => {
    setMeals((prev) => [...prev, { id: prev.length + 1, ...newMeal }]);
    setShowAddForm(false); // hide form after adding
  };

  const handleCancel = () => {
    setShowAddForm(false); // hide form on cancel
  };

  return (
    <div className="p-4">
      {!showAddForm ? (
        <>
          <Button variant="gradient" onClick={() => setShowAddForm(true)} className="mb-4">
            Add Meal
          </Button>
          <ul>
            {meals.map((meal) => (
              <li key={meal.id}>
                <b>{meal.name}</b> - Qty: {meal.quantity} - {meal.description}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <AddMeal onAddMeal={handleAddMeal} onCancel={handleCancel} />
      )}
    </div>
  );
}

export default ParentComponent;
