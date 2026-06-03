import React, { useState } from "react";
import './App.css';
import {
  Badge,
  Switch,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Typography,
  Button,
  Select,
  Option,
  Breadcrumbs,
  Avatar,
  Textarea,
  Chip,
} from "@material-tailwind/react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { MdDelete } from "react-icons/md";
import { CiHeart } from "react-icons/ci";
import { FaPowerOff } from "react-icons/fa6";
import { IoIosNotificationsOutline } from "react-icons/io";

const initialData = [
  { id: 1, name: "Veg orange Salad", src: "https://i.ytimg.com/vi/ln_P2jNCSA0/maxresdefault.jpg" },
  { id: 2, name: "Chole Meal", src: "https://homeal.co.in/wp-content/uploads/2024/06/food-6.png" },
  { id: 3, name: "Puliogre", src: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh8ZOpSI88oF6KK0CxFz8WkK8EwtKePlBg8ICRT2FXX6kcN-J6YCj46s4-XzxNQrFj1GycGVKZNX2e9WBQF4_taVCR1-NFtY7TZ-hjIP3lrGDxnsWaPRCfIV-7qOIEnuYhn_bkTfk7YRw43/s3823/DSC_3404+%25282%2529.JPG" },
  { id: 4, name: "Veg combo", src: "https://www.shutterstock.com/image-photo/indian-mini-meal-parcel-platter-600nw-2201280349.jpg" },
  { id: 5, name: "Non-veg Meal", src: "https://tse3.mm.bing.net/th?id=OIP.1SxzeKMtZ9qeVnA1JQ8IqgHaE8&pid=Api&P=0&h=220" },
  { id: 6, name: "Chicken biriyani", src: "https://thumbs.dreamstime.com/b/meal-lunch-boxes-packaging-meal-lunch-boxes-isolated-white-background-121017730.jpg" },
  { id: 7, name: "Veg salad", src: "https://sammyapproves.com/wp-content/uploads/2019/08/028-min.jpg" },
  { id: 8, name: "Rice & Curry", src: "https://images-na.ssl-images-amazon.com/images/I/61HFT-GD82L._AC_SY450_.jpg" },
  { id: 9, name: "Veg Sandwitch", src: "https://tse1.mm.bing.net/th?id=OIP.VHHFXZA8vZMlCfMN5BbwcAHaHa&pid=Api&P=0&h=220" },
  { id: 10, name: "Fish Meal", src: "https://tse3.mm.bing.net/th?id=OIP.yORsSgJVQYcn7xIZ3Aa12AHaFj&pid=Api&P=0&h=220" },
  { id: 11, name: "Veg Sandwitch", src: "https://tse1.mm.bing.net/th?id=OIP.VHHFXZA8vZMlCfMN5BbwcAHaHa&pid=Api&P=0&h=220" },
  { id: 12, name: "Fish Meal", src: "https://tse3.mm.bing.net/th?id=OIP.yORsSgJVQYcn7xIZ3Aa12AHaFj&pid=Api&P=0&h=220" },
  { id: 13, name: "veg Meal", src: "https://tse3.mm.bing.net/th?id=OIP.1SxzeKMtZ9qeVnA1JQ8IqgHaE8&pid=Api&P=0&h=220" },
  { id: 14, name: "Lemon Rice", src: "https://indiancurrytrail.com/wp-content/uploads/2019/03/Lunchbox-Idea-1-1.jpg" },
  { id: 15, name: "Cure Rice", src: "https://i.ytimg.com/vi/B2ZO4tN_8-c/sddefault.jpg" },
];

const CardItem = ({ item, onDelete, isPublished, onTogglePublish }) => (
  <Card className="w-96">
    <CardHeader variant="gradient" color="orange" className="mb-5 grid h-10 place-items-center">
      <Typography variant="h3" color="white">
        {item.id} : {item.name}
      </Typography>
    </CardHeader>

    <div className="flex items-center justify-between w-full">
      <CiHeart size={30} color="black" />
    </div>

    <div className="flex justify-center items-center">
      <img style={{ width: "180px", height: "180px" }} src={item.src} alt={item.name} />
    </div>

    <CardBody className="flex flex-col gap-4"></CardBody>

    <CardFooter className="pt-0">
      <Typography variant="h10" color="black">
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => onDelete(item.id)}
            className="focus:outline-none"
            aria-label="Delete item"
          >
            <MdDelete size={30} color="red" />
          </button>
        </div>

        <br />

        <div className="w-72">
          <Select label="Select Optional Item">
            <Option>Pickel pocket</Option>
            <Option>Extra salt</Option>
            <Option>Extra Fruits</Option>
            <Option>Soft drinks</Option>
          </Select>
        </div>

        <br />

        <div className="w-72">
          <form className="max-w-sm mx-auto">
            <label
              htmlFor="number-input"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              Select Quantity:
            </label>
            <input
              type="number"
              id="number-input"
              aria-describedby="helper-text-explanation"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-orange-500 dark:focus:border-orange-500"
              placeholder="0"
              required
            />
          </form>
        </div>

        <label>
          <b> Description:</b>
          <Textarea label="" />
        </label>
      </Typography>
    </CardFooter>

    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={isPublished}
        onChange={() => onTogglePublish(item.id, !isPublished)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
      <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300 cursor-pointer">
        Publish to Customer
      </span>
    </label>
    <br />
  </Card>
);

function App() {
  const [items, setItems] = useState(initialData);
  const [successMessage, setSuccessMessage] = useState("");
  const [publishedItems, setPublishedItems] = useState({});

  const handleDelete = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSuccessMessage("Item deleted successfully");
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleTogglePublish = (id, publish) => {
    setPublishedItems((prev) => ({ ...prev, [id]: publish }));
    if (publish) {
      setSuccessMessage("Published to Customer successfully!");
    } else {
      setSuccessMessage("Unpublished from Customer.");
    }
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  return (
    <div className="p-10 relative min-h-screen">
      {/* Success message centered */}
      {successMessage && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50"
          style={{ pointerEvents: "none" }}
        >
          <div className="bg-orange-200 text-orange-800 p-4 rounded-md font-semibold shadow-lg">
            {successMessage}
          </div>
        </div>
      )}

      <br />
      <Breadcrumbs>
        <button type="button" className="opacity-60">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </button>
        <a href="/Welcome">Welcome</a>
        <span>Admin Home</span>
      </Breadcrumbs>

      <div className="absolute top-4 right-4 flex items-center space-x-3">
        <a href="">
          <Badge content="6">
            <IoIosNotificationsOutline color="black" size={30} />
          </Badge>
        </a>
        <a href="/Logout">
          <FaPowerOff color="black" size={20} />
        </a>
      </div>

      <Avatar
        src="https://docs.material-tailwind.com/img/face-2.jpg"
        alt="avatar"
        size="xl"
        style={{ float: "right" }}
      />

      <Typography variant="h2" color="Black">
        <br />
        <div className="w-72">
          <Select label="Select Meal Status">
            <Option>
              <Chip
                variant="ghost"
                color="orange"
                size="sm"
                value="Available"
                icon={<span className="mx-auto mt-1 block h-2 w-2 rounded-full bg-orange-900" />}
              />
            </Option>
            <Option>
              <Chip
                variant="ghost"
                color="orange"
                size="sm"
                value="Not-Available"
                icon={<span className="mx-auto mt-1 block h-2 w-2 rounded-full bg-orange-900" />}
              />
            </Option>
            <Option>
              <Chip
                variant="ghost"
                color="gray"
                size="sm"
                value="Out Of Stock"
                icon={<span className="mx-auto mt-1 block h-2 w-2 rounded-full bg-gray-900" />}
              />
            </Option>
            <Option>
              <Chip
                variant="ghost"
                color="red"
                size="sm"
                value="Will be available soon"
                icon={<span className="mx-auto mt-1 block h-2 w-2 rounded-full bg-red-900" />}
              />
            </Option>
          </Select>
        </div>
      </Typography>

      <br />

      {/* Add Meal Button */}
      <div className="relative">
        <div className="absolute top-0 right-0 m-4 flex gap-4">
          <Button color="orange" appearance="primary">
            <a href="/AddMeal">+ Add Meal</a>
          </Button>

          {/* Download Button */}
          <Button className="flex items-center gap-3" size="sl">
            <ArrowDownTrayIcon strokeWidth={2} className="h-4 w-4" /> Download Report
          </Button>
        </div>

        <br />

        <Button color="orange" appearance="primary">
          <a href="/AddDoctor">+ Add Doctor</a>
        </Button>

        &nbsp;&nbsp;

        <div className="inline-flex items-left">
          <Switch color="orange" defaultChecked />
          <label
            htmlFor="desc"
            className="mt-px mb-0 ml-3 font-light text-gray-700 cursor-pointer select-none"
          >
            <div>
              <p className="block font-sans text-base antialiased font-medium leading-relaxed text-orange-gray-900">
                veg
              </p>
            </div>
          </label>
        </div>

        <div style={{ float: "right" }}>
          <br />
          <br />
          {/* Profile Select Dropdown */}
          <div className="w-full lg:w-1/2">
            <Select label="Profile">
              <Option>
                <a href="/HomePage">About</a>
              </Option>
              <Option>
                <a href="/ResetPassword">Change Password</a>
              </Option>
              <Option>
                <a href="/Settings">Settings</a>
              </Option>
            </Select>
          </div>
        </div>
      </div>
      <br />
      <br />

      <div className="w-full flex mt-35 gap-5 flex-wrap">
        {items.slice(0, 5).map((item) => (
          <CardItem
            key={item.id}
            item={item}
            onDelete={handleDelete}
            isPublished={!!publishedItems[item.id]}
            onTogglePublish={handleTogglePublish}
          />
        ))}
      </div>
      <div className="w-full flex mt-20 gap-5 flex-wrap">
        {items.slice(5, 10).map((item) => (
          <CardItem
            key={item.id}
            item={item}
            onDelete={handleDelete}
            isPublished={!!publishedItems[item.id]}
            onTogglePublish={handleTogglePublish}
          />
        ))}
      </div>
      <div className="w-full flex mt-20 gap-5 flex-wrap">
        {items.slice(10, 15).map((item) => (
          <CardItem
            key={item.id}
            item={item}
            onDelete={handleDelete}
            isPublished={!!publishedItems[item.id]}
            onTogglePublish={handleTogglePublish}
          />
        ))}
      </div>
      <br />
    </div>
  );
}

export default App;
