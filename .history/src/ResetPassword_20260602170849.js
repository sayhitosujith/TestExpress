import './App.css';
import { FaPowerOff } from "react-icons/fa6";
import { IoIosNotificationsOutline } from "react-icons/io";
import { Badge } from "@material-tailwind/react";

import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Typography,
  Input,
  Button,
  Checkbox,
} from "@material-tailwind/react";




function ResetPassword() {
  return (
    <div 
      className="flex flex-row gap-5 bg-cover bg-center h-screen w-full" 
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f')" }}
    >
      <div className='w-1/2 h-screen flex items-center justify-center'>
<Card className="w-[800px] ">
          <CardHeader
            variant="gradient"
            color="gray"
            className="mb-4 grid h-28 place-items-center">
            <Typography variant="h3" color="white">
              RESET PASSWORD 
            </Typography>
          </CardHeader>

          <CardBody className="flex flex-col gap-4">
            <Input
              label={
                <>
                  Old Password <span className="text-red-500"> *</span>
                </>
              }
              size="lg"
            />
            <Input
              label={
                <>
                  New Password <span className="text-red-500"> *</span>
                </>
              }
              size="lg"
            />
            <Input
              label={
                <>
                  Confirm Password <span className="text-red-500"> *</span>
                </>
              }
              size="lg"
            />
            <Checkbox
              label={
                <Typography
                  variant="small"
                  color="gray"
                  className="flex items-center font-normal"
                >
                  I agree the
                  <button type="button" className="font-medium transition-colors hover:text-gray-900">
                    &nbsp;Terms and Conditions
                  </button>
                </Typography>
              }
              containerProps={{ className: "-ml-2.5" }}
            />
          </CardBody>

          <CardFooter className="pt-0">
            <Button variant="gradient" fullWidth>
              <a href="/Success">RESET</a>
            </Button>
            <br />
            <Button variant="gradient" fullWidth>
              <a href="/resetpassword">CANCEL</a>
            </Button>
          </CardFooter>

          <Typography variant="small" className="mt-6 flex justify-center">
            <b>
              Please enter old password , Password and confirm password to reset
              your password
            </b>
          </Typography>
        </Card>

        {/* Logout + Notifications */}
        <div className="absolute top-4 right-4 flex items-center space-x-8">
          <a href="">
            <Badge content="6">
              <IoIosNotificationsOutline color="black" size={30} />
            </Badge>
          </a>
          <a href="/my-app">
            <FaPowerOff color="black" size={20} />
          </a>
        </div>
      </div>

      <img
        style={{ width: "50%", height: "100vh" }}
        alt="Registration illustration"
        src="https://courseuniv.com/app/assets/images/register_02.gif"
      />
    </div>
  );
}


export default ResetPassword;

