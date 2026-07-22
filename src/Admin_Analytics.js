import './App.css';
import { Select, Option } from "@material-tailwind/react";
import { Badge } from "@material-tailwind/react";
import { IconButton } from "@material-tailwind/react";
import { Card, Typography } from "@material-tailwind/react";
import { PencilIcon } from "@heroicons/react/24/solid";
import { Slider } from "@material-tailwind/react";
import FileDownloader from './FileDownloader';
import {
  MdDeleteOutline,
  MdFileCopy,
  MdPowerSettingsNew,
  MdNotificationsNone,
  MdShare,
  MdPhotoCamera,
  MdAnalytics,
  MdInsights,
  MdAreaChart,
  MdDashboard,
  MdSpeed,
  MdEmail,
} from "react-icons/md";
import { useState } from "react";

import {
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import campaignImage1 from './assets/campaign1.jpg'; // adjust the path as necessary

import {
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Breadcrumbs,
  Avatar,
  Chip,
  Tooltip,
  Input,
} from "@material-tailwind/react";

import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@material-tailwind/react";


const TABLE_HEAD = ["Transaction", "Amount", "Date", "Status", "Account", "Actions"];


const TABLE_ROWS = [
  {
    img: "https://docs.material-tailwind.com/img/logos/logo-spotify.svg",
    name: "Spotify",
    amount: "$2,500",
    date: "Wed 3:00pm",
    status: "paid",
    account: "visa",
    accountNumber: "1234",
    expiry: "06/2026",
  },
  {
    img: "https://docs.material-tailwind.com/img/logos/logo-amazon.svg",
    name: "Amazon",
    amount: "$5,000",
    date: "Wed 1:00pm",
    status: "paid",
    account: "master-card",
    accountNumber: "1234",
    expiry: "06/2026",
  },
  {
    img: "https://docs.material-tailwind.com/img/logos/logo-pinterest.svg",
    name: "Pinterest",
    amount: "$3,400",
    date: "Mon 7:40pm",
    status: "pending",
    account: "master-card",
    accountNumber: "1234",
    expiry: "06/2026",
  },
  {
    img: "https://docs.material-tailwind.com/img/logos/logo-google.svg",
    name: "Google",
    amount: "$1,000",
    date: "Wed 5:00pm",
    status: "paid",
    account: "visa",
    accountNumber: "1234",
    expiry: "06/2026",
  },
  {
    img: "https://docs.material-tailwind.com/img/logos/logo-netflix.svg",
    name: "netflix",
    amount: "$14,000",
    date: "Wed 3:30am",
    status: "cancelled",
    account: "visa",
    accountNumber: "1234",
    expiry: "06/2026",
  },
];


const data = [
  {
    id: 1,
    name: 'Registered Users',
    src: <MdAnalytics />, // replaced image URL with icon component
  },
  {
    id: 2,
    name: 'Todays Orders',
    src: <MdInsights />,
  },
  {
    id: 3,
    name: 'Added to Cart',
    src: <MdAnalytics />,
  },
  {
    id: 4,
    name: 'Total Sales',
    src: <MdSpeed />,
  },
  {
    id: 5,
    name: 'Active Countries',
    src: <MdAnalytics />,
  },
];


const CardItem = ({ item }) => (
  <Card className="w-200">
    <CardHeader
      variant="gradient"
      color="orange"
      className="mb-10 grid h-10 place-items-center"
    >
      <Typography variant="h3" color="white">
        {item.id} : {item.name}
      </Typography>
    </CardHeader>

    <div className="flex justify-center items-center" style={{ width: '200px', height: '200px' }}>
      {typeof item.src === "string" ? (
        <img
          style={{ width: "200px", height: "200px" }}
          src={item.src}
          alt={item.name}
          className="h-96 w-full object-cover object-center"
        />
      ) : (
        <div style={{ fontSize: 100, color: "orange" }}>
          {item.src}
        </div>
      )}
    </div>

    <CardBody className="flex flex-col gap-4">
      <div className="-mr-50"></div>
    </CardBody>

    <CardFooter className="pt-0">
      <Typography variant="h10" color="black">
        <div className="w-72">
          <Typography
            as="caption"
            variant="small"
            className="mt-2 text-center font-normal"
          >
            {/* Image caption */}
          </Typography>
        </div>
        <label></label>
      </Typography>
    </CardFooter>
  </Card>
);



function Admin_Analytics() {
  const [open, setOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const handleOpen = (item) => {
    setSelectedItem(item);
    setOpen(true);
  };

  const handleConfirmDelete = () => {
    // Perform delete action here, e.g., call an API or update state
    console.log("Deleting item:", selectedItem);
    setOpen(false);
    setSelectedItem(null);
  };

  

  return (
    <div className="p-10">

      <Breadcrumbs>
        <button type="button" className="opacity-60">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />

            <Typography className="!font-semibold text-xs text-red-500 md:block hidden">
              delete
            </Typography>
          </svg>
        </button>

        <a href="/Welcome" className="opacity-60">Welcome</a>
        <span className="opacity-60">Admin Analytics</span>
      </Breadcrumbs>


      <div className="absolute top-4 right-4 flex items-center space-x-3">
        <button type="button" aria-label="Notifications" className="opacity-90">
          <MdNotificationsNone color="black" size={30} />
        </button>
        <a href="/Logout" aria-label="Logout">
          <MdPowerSettingsNew color="black" size={20} />
        </a>
      </div>
      <br></br>
      <Typography variant="h3" color="Black">
      <MdDashboard />  Dashboard


        <div style={{ float: 'right' }}>
          <Avatar src="https://docs.material-tailwind.com/img/face-2.jpg" alt="avatar" size="xl" div style={{ float: 'right' }}></Avatar>
          <div className="w-74">
            <Select label="Sujith">
              <Option>
              </Option>
              <Badge content="6">
                <Button>My cart </Button>
              </Badge>
              <Option>About</Option>
              <Option>Change Password</Option>
              <button><Option>Logout</Option></button>
            </Select>
          </div>
        </div>
      </Typography>

<div className="w-full flex flex-wrap justify-center mt-20 gap-7">
        {
          data.slice(0, 5).map((item) => <CardItem item={item} />)
        }
      </div>
<div className="w-full flex flex-wrap justify-center mt-20 gap-7">
        {
          data.slice(6, 10).map((item) => <CardItem item={item} />)
        }
      </div>
<div className="w-full flex flex-wrap justify-center mt-20 gap-7">
        {
          data.slice(11, 15).map((item) => <CardItem item={item} />)
        }
      </div>

      <div className="p-8">
  {/* Heading */}
  <Typography variant="h3" color="black" className="mb-8 text-center">
    Public Campaigns on Social Media
  </Typography>

  <button
      className="px-6 py-2 bg-orange-800 text-white font-semibold rounded-lg hover:bg-orange-800 transition duration-300"
    >
      Create New Campaign
    </button>

  {/* Campaign Card Section */}
  <div className="flex justify-center gap-4">
    <Card className="w-92 bg-orange-50">
      <CardHeader
        variant="gradient"
        color="white"
        className="grid h-24 place-items-center mb-6 bg-orange-800"
      >
        <Typography variant="h5" className="font-bold text-white">
        Swiggy Food Drive on 15 - Oct - 2025
        </Typography>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        {/* Optional content like inputs or descriptions */}
      </CardBody>

      <CardFooter className="pt-0 flex flex-col items-center">
        <img
          src={campaignImage1}
          alt="Sujith Profile"
          style={{ width: '100%', height: '50vh', objectFit: 'cover' }}
          className="rounded-lg shadow-md"
        />

<button className="mt-6 px-6 py-2 bg-orange-800 text-white font-semibold rounded hover:bg-orange-800 transition">
  PUBLISH
</button>

        <div className="flex justify-center items-center gap-6 mt-4 flex-wrap">
  {/* Email */}
  <div className="flex items-center gap-2">
    <MdEmail size={24} color="orange" />
    <Typography variant="small" className="font-medium">
      Mail
    </Typography>
  </div>

  {/* Facebook */}
  <div className="flex items-center gap-2" title="Share on Facebook">
    <MdShare size={24} color="red" />
    <Typography variant="small" className="font-medium">
      Facebook
    </Typography>
  </div>

  {/* Twitter/X */}
  <div className="flex items-center gap-2" title="Share on Twitter/X">
    <MdShare size={24} color="black" />
    <Typography variant="small" className="font-medium">
      Twitter
    </Typography>
  </div>

  {/* Instagram */}
  <div className="flex items-center gap-2" title="Share on Instagram">
    <MdPhotoCamera size={24} color="orange" />
    <Typography variant="small" className="font-medium">
      Instagram
    </Typography>
  </div>
</div>

      </CardFooter>
    </Card>
  </div>
</div>



      <div className="w-96">
        <Slider
          defaultValue={50}
          className="text-[#2ec947]"
          barClassName="rounded-none bg-[#2ec946]"
          thumbClassName="[&::-moz-range-thumb]:rounded-none [&::-webkit-slider-thumb]:rounded-none [&::-moz-range-thumb]:-mt-[4px] [&::-webkit-slider-thumb]:-mt-[4px]"
          trackClassName="[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent rounded-none !bg-[#2ec946]/10 border border-[#2ec946]/20"
        />
      </div>

      <Card className="h-full w-full">
        <CardHeader floated={false} shadow={false} className="rounded-none">
          <div className="mb-4 flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div>
              <Typography variant="h5" color="blue-gray">
                Recent Transactions
              </Typography>
              <Typography color="gray" className="mt-1 font-normal">
                These are details about the last transactions
              </Typography>
            </div>
            <div className="flex w-full shrink-0 gap-2 md:w-max">
              <div className="w-full md:w-72">
                <Input
                  label="Search"
                  icon={<MagnifyingGlassIcon className="h-5 w-5" />}
                />
              </div>
              <Button className="flex items-center gap-3" size="sm">
                <ArrowDownTrayIcon strokeWidth={2} className="h-4 w-4" />
                <FileDownloader />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="overflow-scroll px-0">
          <table className="w-full min-w-max table-auto text-left">
            <thead>
              <tr>
                {TABLE_HEAD.map((head) => (
                  <th
                    key={head}
                    className="border-y border-orange-gray-100 bg-orange-gray-50/50 p-4"
                  >
                    <Typography
                      variant="small"
                      color="blue-gray"
                      className="font-normal leading-none opacity-70"
                    >
                      {head}
                    </Typography>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLE_ROWS.map(
                (
                  {
                    img,
                    name,
                    amount,
                    date,
                    status,
                    account,
                    accountNumber,
                    expiry,
                  },
                  index,
                ) => {
                  const isLast = index === TABLE_ROWS.length - 1;
                  const classes = isLast
                    ? "p-4"
                    : "p-4 border-b border-orange-gray-50";

                  return (
                    <tr key={name}>
                      <td className={classes}>
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={img}
                            alt={name}
                            size="md"
                            className="border border-orange-gray-50 bg-orange-gray-50/50 object-contain p-1"
                          />
                          <Typography
                            variant="small"
                            color="blue-gray"
                            className="font-bold"
                          >
                            {name}
                          </Typography>
                        </div>
                      </td>
                      <td className={classes}>
                        <Typography
                          variant="small"
                          color="blue-gray"
                          className="font-normal"
                        >
                          {amount}
                        </Typography>
                      </td>
                      <td className={classes}>
                        <Typography
                          variant="small"
                          color="blue-gray"
                          className="font-normal"
                        >
                          {date}
                        </Typography>
                      </td>
                      <td className={classes}>
                        <div className="w-max">
                          <Chip
                            size="sm"
                            variant="ghost"
                            value={status}
                            color={
                              status === "paid"
                                ? "orange"
                                : status === "pending"
                                  ? "amber"
                                  : "red"
                            }
                          />
                        </div>
                      </td>
                      <td className={classes}>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-12 rounded-md border border-orange-gray-50 p-1">
                            <Avatar
                              src={
                                account === "visa"
                                  ? "https://demos.creative-tim.com/test/corporate-ui-dashboard/assets/img/logos/visa.png"
                                  : "https://demos.creative-tim.com/test/corporate-ui-dashboard/assets/img/logos/mastercard.png"
                              }
                              size="sm"
                              alt={account}
                              variant="square"
                              className="h-full w-full object-contain p-1"
                            />
                          </div>
                          <div className="flex flex-col">
                            <Typography
                              variant="small"
                              color="blue-gray"
                              className="font-normal capitalize"
                            >
                              {account.split("-").join(" ")} {accountNumber}
                            </Typography>
                            <Typography
                              variant="small"
                              color="blue-gray"
                              className="font-normal opacity-70"
                            >
                              {expiry}
                            </Typography>
                          </div>
                        </div>
                      </td>
                      <td className={classes}>
                        <Tooltip content="Edit User">
                          <IconButton variant="text">
                            <PencilIcon className="h-6 w-6" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip content="Delete User">
                          <IconButton variant="text" color="red" onClick={() => handleOpen(name)}>
                            <MdDeleteOutline className="h-6 w-6" />
                          </IconButton>
                        </Tooltip>

                        <Dialog open={open} handler={setOpen}>
                          <DialogHeader>Confirm Deletion</DialogHeader>
                          <DialogBody>
                            Are you sure you want to delete <strong>{selectedItem}</strong>?
                          </DialogBody>
                          <DialogFooter>
                            <Button variant="text" color="gray" onClick={() => setOpen(false)}>
                              Cancel
                            </Button>
                            <Button variant="gradient" color="red" onClick={handleConfirmDelete}>
                              Confirm
                            </Button>
                          </DialogFooter>
                        </Dialog>


                        <Tooltip content="Clone User">
                          <IconButton color="orange" variant="text">
                            <MdFileCopy className="h-5 w-5" />
                          </IconButton>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </CardBody>
        <CardFooter className="flex items-center justify-between border-t border-orange-gray-50 p-4">
          <Button variant="outlined" size="sm">
            Previous
          </Button>
          <div className="flex items-center gap-2">
            <IconButton variant="outlined" size="sm">
              1
            </IconButton>
            <IconButton variant="text" size="sm">
              2
            </IconButton>
            <IconButton variant="text" size="sm">
              3
            </IconButton>
            <IconButton variant="text" size="sm">
              ...
            </IconButton>
            <IconButton variant="text" size="sm">
              8
            </IconButton>
            <IconButton variant="text" size="sm">
              9
            </IconButton>
            <IconButton variant="text" size="sm">
              10
            </IconButton>
          </div>
          <Button variant="outlined" size="sm">
            Next
          </Button>
        </CardFooter>
      </Card>
    </div>


  );

}


export default Admin_Analytics;



