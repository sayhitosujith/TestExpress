import './App.css';
import { Typography } from "@material-tailwind/react";
import React, { useEffect, useState } from 'react';
import packageJson from '../package.json';
import RCB from './assets/RCB.png';

import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
} from "@material-tailwind/react";

function Logout() {
  const [rating, setRating] = useState(null);

  useEffect(() => {
    localStorage.removeItem("isLoggedIn");
    const savedRating = localStorage.getItem("logoutFeedbackRating");
    if (savedRating !== null) {
      setRating(parseInt(savedRating, 10));
      localStorage.removeItem("logoutFeedbackRating"); // ✅ clear after showing
    }
  }, []);

  const getRatingColor = () => {
    if (rating <= 6) return "text-red-600";     
    if (rating === 7) return "text-yellow-600"; 
    return "text-orange-600";                    
  };

  const getEmoji = () => {
    if (rating <= 6) return "😡";
    if (rating === 7) return "😐";
    return "😀";
  };

  return (
    <div className="flex flex-row gap-5">
      {/* Left Section */}
      <div className="w-1/2 h-screen flex items-center justify-center bg-orange-100">
        <Card className="w-92">
          <CardHeader
            variant="gradient"
            color="orange"
            className="mb-4 grid h-28 place-items-center"
          >
            <Typography variant="h3" color="white">
              LOGOUT
            </Typography>
          </CardHeader>

          <CardBody className="flex flex-col gap-4">
            <div className="w-[32rem]">
              <Typography
                variant="small"
                color="gray"
                className="mt-2 flex items-center gap-1 font-normal"
              >
                ✅ User has been successfully logged out. Thank you for using our service!
              </Typography>

              {/* Show Feedback Rating with Emoji */}
              {rating !== null ? (
                <Typography
                  variant="h6"
                  className={`mt-4 text-center font-semibold ${getRatingColor()}`}
                >
                  {getEmoji()} Thanks for your feedback! You rated us {rating}/10
                </Typography>
              ) : (
                <Typography
                  variant="h6"
                  color="gray"
                  className="mt-4 text-center"
                >
                  No feedback provided.
                </Typography>
              )}
            </div>
          </CardBody>

          <CardFooter className="pt-0 flex flex-col items-center gap-4">
            <div className="flex justify-center items-center h-full">
              <a
                href="/my-app"
                className="underline text-red-700 text-lg font-medium"
              >
                Click here to LOGIN
              </a>
            </div>

            <div className="mt-4">
              <Typography variant="small" color="black" className="text-center">
                Application Build Version: {packageJson.version}
              </Typography>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Right Section - Image */}
      <img
        style={{ width: '130vh', height: '100vh' }}
        src={RCB}
        alt="Lunch box"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export default Logout;
