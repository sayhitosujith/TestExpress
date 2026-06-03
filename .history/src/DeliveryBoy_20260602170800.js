import React, { useState } from "react";
import './App.css';
import { Badge, Card, CardHeader, CardBody, CardFooter, Typography, Button, Select, Option, Breadcrumbs, Avatar, Rating } from "@material-tailwind/react";
import { TrashIcon } from "@heroicons/react/24/solid";
import Popup from "reactjs-popup";
import 'reactjs-popup/dist/index.css'; // popup styles

const initialData = [
  { id: 1, name: "Captain 1", src: 'https://cdn-icons-png.flaticon.com/512/305/305976.png' },
  { id: 2, name: "Captain 2", src: 'https://cdn-icons-png.flaticon.com/512/305/305976.png' },
  { id: 3, name: "Captain 3", src: 'https://cdn-icons-png.flaticon.com/512/305/305976.png' },
  { id: 4, name: "Captain 4", src: 'https://cdn-icons-png.flaticon.com/512/305/305976.png' },
  { id: 5, name: "Captain 5", src: 'https://cdn-icons-png.flaticon.com/512/305/305976.png' },
  { id: 6, name: "Captain 6", src: 'https://cdn-icons-png.flaticon.com/512/305/305976.png' },
  { id: 7, name: "Captain 7", src: 'https://cdn-icons-png.flaticon.com/512/305/305976.png' },
  { id: 8, name: "Captain 8", src: 'https://cdn-icons-png.flaticon.com/512/305/305976.png' },
  { id: 9, name: "Captain 9", src: 'https://cdn-icons-png.flaticon.com/512/305/305976.png' },
  { id: 10, name: "Captain 10", src: 'https://cdn-icons-png.flaticon.com/512/305/305976.png' },
  { id: 11, name: "Captain 11", src: 'https://cdn-icons-png.flaticon.com/512/305/305976.png' },
];

const CardItem = ({ item, onDelete }) => {
  const [open, setOpen] = useState(false);

  return (
    <Card className="w-96">
      <CardHeader variant="gradient" color="orange" className="mb-5 grid h-10 place-items-center">
        <Typography variant="h3" color="white">{item.id} : {item.name}</Typography>
      </CardHeader>

      <div className='flex justify-center items-center'>
        <img style={{ width: '180px', height: '180px' }} src={item.src} alt={item.name} />
      </div>

      <CardBody className="flex flex-col gap-4"></CardBody>

      <CardFooter className="pt-0">
        <Typography variant="h10" color="black">
          <div className="w-72"></div>
          <label>
            <b> First Name:</b><br />
            <b> Last Name:</b><br />
            <b> Age:</b><br />
            <b> Phone Number:</b><br />
            <b> Email ID:</b><br />
            <b> Aadhar Number:</b><br />
            <b> Address:</b><br />
            <b> DL Number:</b><br />
            <Rating unratedColor="amber" ratedColor="amber" />
            <Button size="sm" variant="text" color="red" className="flex items-center gap-2" onClick={() => setOpen(true)}>
              <TrashIcon className="h-4 w-4 text-red-500" />
              <Typography className="!font-semibold text-xs text-red-500 md:block hidden">
                Delete Profile
              </Typography>
            </Button>
          </label>

          <Popup open={open} onClose={() => setOpen(false)} modal closeOnDocumentClick>
            <div className="p-6 text-center">
              <Typography variant="h6" color="black" className="mb-4">
                Profile Deleted Successfully
              </Typography>
              <div className="flex justify-center gap-4">
                <Button
                  color="orange"
                  onClick={() => {
                    onDelete(item.id); // call parent delete function
                    setOpen(false);    // close popup
                  }}
                >
                  OK
                </Button>
                <Button color="red" variant="outlined" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Popup>
        </Typography>
      </CardFooter>
    </Card>
  );
};

function DeliveryBoy() {
  const [data, setData] = useState(initialData);

  const handleDelete = (id) => {
    setData((prev) => prev.filter(item => item.id !== id));
  };

  return (
    <div className="p-10">
      <Breadcrumbs>
        <button type="button" className="opacity-60">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </button>

        <a href="/Welcome" className="opacity-60">Welcome</a>
        <span>Delivery Captains</span>
      </Breadcrumbs>

      <Avatar src="https://docs.material-tailwind.com/img/face-2.jpg" alt="avatar" size="xl" variant="square" style={{ float: 'right' }} />

      <Typography variant="h2" color="Black" className="mb-6">
        Doctors List
      </Typography>

      <Button>
        <a href="/AddDeliveryCaptain">+ ADD Doctor</a>
      </Button>

      <div style={{ float: 'right' }}>
        <div className="w-74">
          <Select label="Profile">
            <Option></Option>
            <Badge content="6">
              <Button>My cart</Button>
            </Badge>
            <Option>About</Option>
            <Option>Change Password</Option>
            <Option>Logout</Option>
          </Select>
        </div>
      </div>

      <div className='w-full flex mt-20 gap-5 flex-wrap'>
        {data.map((item) => (
          <CardItem key={item.id} item={item} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}

export default DeliveryBoy;
