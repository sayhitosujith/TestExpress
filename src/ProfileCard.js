import './App.css';
import { Rating } from "@material-tailwind/react";


import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Typography,
  Tooltip,
  CheckIcon,
  Button

} from "@material-tailwind/react";

function ProfileCard() {
  return (
    
    <Card className="w-96">
    <CardHeader floated={false} className="h-80">
      <img src="https://media.licdn.com/dms/image/D5603AQFxv9b5cCxs2w/profile-displayphoto-shrink_800_800/0/1703428628673?e=1716422400&v=beta&t=VtQDfl43-_TcdxcF25jtqWBH0vbbTkI68tcAAT3W0iU" alt="profile-picture" />
    </CardHeader>
    <CardBody className="text-center">
      <Typography variant="h4" color="blue-gray" className="mb-2">
        SUJITH
      </Typography>
      <Typography color="blue-gray" className="font-medium" textGradient>
        CEO / Founder
      </Typography>
      <Typography color="blue-gray" className="font-medium" textGradient>
        MAVEN MEAL
      </Typography>
      <Button variant="text" className="flex items-center">
        Read More{" "}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3"
          />
        </svg>
      </Button>
    </CardBody>
    <CardFooter className="flex justify-center gap-7 pt-2">
      <Tooltip content="Like">
        <Typography
          as="a"
          href="#facebook"
          variant="lead"
          color="orange"
          textGradient
        >
          <i className="fab fa-facebook" />
        </Typography>
      </Tooltip>
      <Tooltip content="Follow">
        <Typography
          as="a"
          href="#twitter"
          variant="lead"
          color="light-orange"
          textGradient
        >
          <i className="fab fa-twitter" />
        </Typography>
      </Tooltip>
      <Tooltip content="Follow">
        <Typography
          as="a"
          href="#instagram"
          variant="lead"
          color="purple"
          textGradient
        >
          <i className="fab fa-instagram" />
           <Rating value={4} />

        </Typography>
      </Tooltip>
    </CardFooter>
  </Card>

  

  );
  (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="h-3 w-3"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  );
}
 
export function PricingCard() {
  return (
    <Card color="gray" variant="gradient" className="w-full max-w-[20rem] p-8">
      <CardHeader
        floated={false}
        shadow={false}
        color="transparent"
        className="m-0 mb-8 rounded-none border-b border-white/10 pb-8 text-center"
      >
        <Typography
          variant="small"
          color="white"
          className="font-normal uppercase"
        >
          standard
        </Typography>
        <Typography
          variant="h1"
          color="white"
          className="mt-6 flex justify-center gap-1 text-7xl font-normal"
        >
          <span className="mt-2 text-4xl">$</span>29{" "}
          <span className="self-end text-4xl">/mo</span>
        </Typography>
      </CardHeader>
      <CardBody className="p-0">
        <ul className="flex flex-col gap-4">
          <li className="flex items-center gap-4">
            <span className="rounded-full border border-white/20 bg-white/20 p-1">
              <CheckIcon />
            </span>
            <Typography className="font-normal">5 team members</Typography>
          </li>
          <li className="flex items-center gap-4">
            <span className="rounded-full border border-white/20 bg-white/20 p-1">
              <CheckIcon />
            </span>
            <Typography className="font-normal">200+ components</Typography>
          </li>
          <li className="flex items-center gap-4">
            <span className="rounded-full border border-white/20 bg-white/20 p-1">
              <CheckIcon />
            </span>
            <Typography className="font-normal">40+ built-in pages</Typography>
          </li>
          <li className="flex items-center gap-4">
            <span className="rounded-full border border-white/20 bg-white/20 p-1">
              <CheckIcon />
            </span>
            <Typography className="font-normal">1 year free updates</Typography>
          </li>
          <li className="flex items-center gap-4">
            <span className="rounded-full border border-white/20 bg-white/20 p-1">
              <CheckIcon />
            </span>
            <Typography className="font-normal">
              Life time technical support
            </Typography>
          </li>
        </ul>
      </CardBody>
      <CardFooter className="mt-12 p-0">
        <Button
          size="lg"
          color="white"
          className="hover:scale-[1.02] focus:scale-[1.02] active:scale-100"
          ripple={false}
          fullWidth={true}
        >
          Buy Now
        </Button>
      </CardFooter>
    </Card>
  );
  
}

export default ProfileCard;

