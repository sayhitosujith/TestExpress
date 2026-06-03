import './App.css';
import React, { useState, useEffect } from 'react';
import { Badge } from "@material-tailwind/react";
import { FaPowerOff } from "react-icons/fa";
import { IoIosNotificationsOutline } from "react-icons/io";

import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Typography,
  Select,
  Option,
  Breadcrumbs,
  Avatar,
  Button,

} from "@material-tailwind/react";



const CardItem = ({ item, onRestart, onLogs }) => (
  <Card className="w-full md:w-96">
    <CardHeader variant="gradient" color={item.status === 'Healthy' ? 'green' : 'amber'} className="mb-2 grid h-10 place-items-center">
      <Typography variant="h6" color="white">{item.name}</Typography>
    </CardHeader>

    <div className="flex justify-center items-center">
      <img style={{ width: '180px', height: '180px' }} src={item.src} alt={item.name} />
    </div>

    <CardBody className="flex flex-col gap-2">
      <div className="flex justify-between">
        <Typography variant="small">ID</Typography>
        <Typography variant="small" className="font-medium">{item.id}</Typography>
      </div>
      <div className="flex justify-between">
        <Typography variant="small">Status</Typography>
        <Typography variant="small" className="font-medium">{item.status}</Typography>
      </div>
      <div className="flex justify-between">
        <Typography variant="small">CPU</Typography>
        <Typography variant="small" className="font-medium">{item.cpu}%</Typography>
      </div>
      <div className="flex justify-between">
        <Typography variant="small">Memory</Typography>
        <Typography variant="small" className="font-medium">{item.mem}%</Typography>
      </div>
    </CardBody>

    <CardFooter className="pt-0 flex gap-2">
      <Button size="sm" color="blue" onClick={() => onRestart && onRestart()}>Restart</Button>
      <Button size="sm" color="gray" onClick={() => onLogs && onLogs()}>Logs</Button>
    </CardFooter>
  </Card>
);

function BillingDetails() {
  const [role, setRole] = useState('CEO');

  const invoices = [
    { id: 'INV-001', name: 'Acme Corp', amount: 1200, status: 'Paid', due: '2026-05-01' },
    { id: 'INV-002', name: 'Beta LLC', amount: 500, status: 'Overdue', due: '2026-05-20' },
    { id: 'INV-003', name: 'Gamma Inc', amount: 750, status: 'Due', due: '2026-06-10' },
  ];

  const [servers, setServers] = useState([
    { id: 'SVR-01', name: 'api-prod', src: 'https://via.placeholder.com/180', status: 'Healthy', cpu: 22, mem: 57 },
    { id: 'SVR-02', name: 'db-prod', src: 'https://via.placeholder.com/180', status: 'Degraded', cpu: 78, mem: 84 },
  ]);

  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [logsContent, setLogsContent] = useState([]);
  const [confirmServer, setConfirmServer] = useState(null);

  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);
  const overdueCount = invoices.filter(i => i.status === 'Overdue').length;

  return (
    <div className="p-10">
       
            <br></br>
            <Breadcrumbs>
      <a href="#" className="opacity-60">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      </a>

       <a href="/Welcome" className="opacity-60">Welcome</a>
      <a href="#">Profiles</a>

    </Breadcrumbs>


    <div className="absolute top-4 right-16 flex items-center space-x-3">
      <a href="#notifications">
        <Badge content="6">
          <IoIosNotificationsOutline color="black" size={30} />
        </Badge>
      </a>
      <a href="/my-app">
        <FaPowerOff color="black" size={20} />
      </a>
      <Avatar src="https://docs.material-tailwind.com/img/face-2.jpg" alt="avatar" size="xl" />
    </div>

    <Typography variant="h2" color="Black">Billing Details</Typography>
    <div style={{float: 'right'}}>
      <div className="w-74">
        <Select label="Profile">
          <Option>Profile</Option>
          <Option>About</Option>
          <Option>Change Password</Option>
        </Select>
      </div>
    </div>

    <div className="mt-6 flex items-center justify-between">
      <div>
        <label className="block text-sm font-medium text-gray-700">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mt-1 block w-40 rounded-md border-gray-300 shadow-sm p-2"
        >
          <option value="CEO">CEO</option>
          <option value="CTO">CTO</option>
        </select>
      </div>
    </div>

    <div className="mt-6">
      {role === 'CEO' ? (
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <CardBody>
              <Typography variant="h6">Total Invoices</Typography>
              <Typography variant="h4">${totalAmount}</Typography>
            </CardBody>
          </Card>
          <Card className="p-4">
            <CardBody>
              <Typography variant="h6">Overdue</Typography>
              <Typography variant="h4">{overdueCount}</Typography>
            </CardBody>
          </Card>
          <Card className="p-4">
            <CardBody>
              <Typography variant="h6">Open Invoices</Typography>
              <Typography variant="h4">{invoices.length}</Typography>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {servers.map((s) => (
            <CardItem
              key={s.id}
              item={s}
              onRestart={() => handleRestartRequest(s)}
              onLogs={() => handleOpenLogs(s)}
            />
          ))}
        </div>
      )}
    </div>
       
    </div>
 );
 
}


export default BillingDetails;