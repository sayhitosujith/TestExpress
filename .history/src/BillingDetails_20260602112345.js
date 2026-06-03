import './App.css';
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

} from "@material-tailwind/react";



const CardItem = ({item}) => (
    <Card className="w-96">
          <CardHeader
              variant="gradient"
              color="orange"
              className="mb-5 grid h-10 place-items-center">
              <Typography variant="h3" color="white">
                {item.id} : {item.name}  
             </Typography>
            </CardHeader>

            <div className='flex justify-center items-center'>
            <img style={{width: '180px', height: '180px'}} src={item.src} />
            </div>
          <CardBody className="flex flex-col gap-4">
            <div className="-mr-50">
            </div>
          </CardBody>
          <CardFooter className="pt-0">

          </CardFooter>
         
        </Card>
)

function BillingDetails() {
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
       
    </div>
 );
 
}


export default BillingDetails;