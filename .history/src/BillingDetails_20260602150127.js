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

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const BRAND = { primary: '#0b74ff', accent: '#06b6d4', success: '#10b981' };



const CardItem = ({ item, onRestart, onLogs }) => (
  <Card className="w-full md:w-96 h-full flex flex-col shadow-md">
    <CardHeader className="mb-2 flex items-center justify-between px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800">
      <Typography variant="h6" color="white">{item.name}</Typography>
      <Badge color={item.status === 'Healthy' ? 'green' : (item.status === 'Degraded' ? 'amber' : 'red')} className="!text-white">{item.status}</Badge>
    </CardHeader>

    <div className="w-full h-44 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-md p-3">
      <img
        style={{ width: '160px', height: '160px', objectFit: 'contain' }}
        src={item.src}
        alt={item.name}
        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://via.placeholder.com/160?text=No+Image'; }}
      />
    </div>

    <CardBody className="flex-1 flex flex-col gap-3 px-4 py-3">
      <div className="flex justify-between text-sm text-gray-600">
        <div>ID</div>
        <div className="font-medium text-gray-800">{item.id}</div>
      </div>
      <div className="flex justify-between text-sm text-gray-600">
        <div>CPU</div>
        <div className="font-medium text-gray-800">{item.cpu}%</div>
      </div>
      <div className="w-full mb-2">
        <div className="h-2 bg-blue-100 rounded-full">
          <div style={{ width: `${item.cpu}%` }} className="h-2 bg-blue-600 rounded-full" />
        </div>
      </div>
      <div className="flex justify-between text-sm text-gray-600">
        <div>Memory</div>
        <div className="font-medium text-gray-800">{item.mem}%</div>
      </div>
      <div className="w-full">
        <div className="h-2 bg-green-100 rounded-full">
          <div style={{ width: `${item.mem}%` }} className="h-2 bg-green-600 rounded-full" />
        </div>
      </div>
    </CardBody>

    <CardFooter className="pt-0 flex gap-2 mt-auto px-4 pb-4">
      <button onClick={() => onRestart && onRestart()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm">Restart</button>
      <button onClick={() => onLogs && onLogs()} className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-md text-sm">Logs</button>
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
  const [toast, setToast] = useState({ show: false, message: '' });
  const [auditLog, setAuditLog] = useState([]);
  const [logFilter, setLogFilter] = useState('');
  const streamingRef = React.useRef(null);

  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);
  const overdueCount = invoices.filter(i => i.status === 'Overdue').length;

  // Open logs modal for a server
  const handleOpenLogs = (server) => {
    // simulate fetching recent logs
    const now = new Date();
    const lines = [
      `${now.toISOString()} - ${server.name} - Info - service started`,
      `${now.toISOString()} - ${server.name} - Warn - high memory usage`,
      `${now.toISOString()} - ${server.name} - Error - connection timeout`,
    ];
    setLogsContent(lines);
    setLogFilter('');
    setLogsModalOpen(true);

    // add audit entry for opening logs
    const openEntry = `${new Date().toISOString()} - ${role} - Opened logs for ${server.name}`;
    setAuditLog(prev => [openEntry, ...prev].slice(0, 50));

    // start streaming new log lines while modal is open
    if (streamingRef.current) clearInterval(streamingRef.current);
    streamingRef.current = setInterval(() => {
      const t = new Date().toISOString();
      setLogsContent(prev => [...prev, `${t} - ${server.name} - Info - heartbeat`].slice(-200));
    }, 1500);
  };

  // Ask for restart confirmation
  const handleRestartRequest = (server) => {
    setConfirmServer(server);
  };

  // Perform restart (simulated API call)
  const performRestart = async (server) => {
    setConfirmServer(null);
    setServers(prev => prev.map(p => p.id === server.id ? { ...p, status: 'Restarting' } : p));
    try {
      // simulate API call
      await new Promise(r => setTimeout(r, 1200));
      // after restart, mark healthy and reset metrics
      setServers(prev => prev.map(p => p.id === server.id ? { ...p, status: 'Healthy', cpu: Math.max(5, Math.floor(Math.random()*30)), mem: Math.max(10, Math.floor(Math.random()*50)) } : p));
      // add audit log and toast
      const entry = `${new Date().toISOString()} - ${role} - Restarted ${server.name}`;
      setAuditLog(prev => [entry, ...prev].slice(0, 50));
      setToast({ show: true, message: 'Restart successful' });
      setTimeout(() => setToast({ show: false, message: '' }), 3000);
    } catch (e) {
      setServers(prev => prev.map(p => p.id === server.id ? { ...p, status: 'Error' } : p));
      setToast({ show: true, message: 'Restart failed' });
      setTimeout(() => setToast({ show: false, message: '' }), 3000);
    }
  };

  // record audit entry when role changes (CEO <-> CTO views)
  useEffect(() => {
    const entry = `${new Date().toISOString()} - ${role} viewed ${role === 'CEO' ? 'Billing summary' : 'Servers dashboard'}`;
    setAuditLog(prev => [entry, ...prev].slice(0, 50));
  }, [role]);

  // Poll health periodically (demo: random adjustments)
  useEffect(() => {
    // try fetching servers from an API if available (placeholder)
    const fetchServers = async () => {
      try {
        // const res = await fetch('/api/servers');
        // const data = await res.json();
        // setServers(data);
      } catch (e) {
        // silent - keep sample data
      }
    };
    fetchServers();

    const id = setInterval(() => {
      setServers(prev => prev.map(s => {
        const cpu = Math.min(99, Math.max(1, s.cpu + (Math.random()*10-5)));
        const mem = Math.min(99, Math.max(1, s.mem + (Math.random()*10-5)));
        const status = cpu > 85 || mem > 90 ? 'Degraded' : (cpu > 95 ? 'Critical' : 'Healthy');
        return { ...s, cpu: Math.round(cpu), mem: Math.round(mem), status };
      }));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // stop streaming when logs modal closed
  useEffect(() => {
    if (!logsModalOpen && streamingRef.current) {
      clearInterval(streamingRef.current);
      streamingRef.current = null;
    }
  }, [logsModalOpen]);


  return (
    <div className="max-w-6xl mx-auto p-8 bg-white rounded-lg shadow-sm relative">
       
            <br></br>
            <Breadcrumbs>
      <button type="button" className="opacity-60" aria-label="Home">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      </button>

       <a href="/Welcome" className="opacity-60">Welcome</a>
      <span className="text-gray-700">Profiles</span>

    </Breadcrumbs>


    <div className="absolute top-6 right-8 flex items-center space-x-4">
      <button aria-label="Notifications" className="relative p-1">
        <Badge content="6" className="!bg-red-600">
          <IoIosNotificationsOutline color="#111827" size={20} />
        </Badge>
      </button>
      <button aria-label="Sign out" className="p-1 rounded hover:bg-gray-100">
        <FaPowerOff color="#111827" size={18} />
      </button>
      <Avatar src="https://docs.material-tailwind.com/img/face-2.jpg" alt="avatar" size="md" />
    </div>

    <Typography variant="h2" color="Black" className="mb-4 text-3xl font-bold">Billing Details</Typography>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
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

      {/* Logs modal */}
      {logsModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-11/12 max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Recent Logs</h3>
              <div className="flex items-center gap-2">
                <input value={logFilter} onChange={e => setLogFilter(e.target.value)} placeholder="Filter logs" className="border rounded p-1 text-sm" />
                <Button size="sm" color="gray" onClick={() => setLogsModalOpen(false)}>Close</Button>
              </div>
            </div>
            <div className="h-64 overflow-auto bg-gray-50 p-3 rounded">
              {logsContent.filter(l => l.toLowerCase().includes(logFilter.toLowerCase())).map((l, idx) => (
                <div key={idx} className="text-sm font-mono mb-1">{l}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirm restart modal */}
      {confirmServer && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h3 className="text-lg font-medium mb-4">Confirm Restart</h3>
            <p className="mb-4">Restart <strong>{confirmServer.name}</strong> ?</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" color="gray" onClick={() => setConfirmServer(null)}>Cancel</Button>
              <Button size="sm" color="red" onClick={() => performRestart(confirmServer)}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed right-4 top-4 z-50">
          <div className="bg-green-600 text-white px-4 py-2 rounded shadow">{toast.message}</div>
        </div>
      )}

      {/* Audit log panel */}
      <div className="mt-6">
        <Typography variant="h6">Audit Log</Typography>
        <div className="max-h-40 overflow-auto bg-gray-50 p-2 rounded mt-2">
          {auditLog.length === 0 ? (
            <div className="text-sm text-gray-500">No actions yet</div>
          ) : (
            auditLog.map((a, i) => {
              const parts = a.split(' - ');
              const time = parts[0] || a;
              const role = parts[1] || '';
              const msg = parts.slice(2).join(' - ') || parts.slice(1).join(' - ');
              return (
                <div key={i} className="mb-2">
                  <div className="text-xs text-gray-500">{time}</div>
                  <div className="text-sm"><strong className="mr-2 text-gray-700">{role}</strong><span className="text-gray-800">{msg}</span></div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
 );
 
}


export default BillingDetails;