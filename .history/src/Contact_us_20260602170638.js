import './App.css';


import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Typography,
  Input,
  Checkbox,
  Button,
  Textarea,
} from "@material-tailwind/react";




function Contact_us() {
  return (
    <div className="flex flex-row gap-5">
      
      <div className='w-1/2 h-screen flex items-center justify-center'>
        <Card className="w-98">
          <CardHeader
            variant="gradient"
            color="gray"
            background= "red"

            className="mb-4 grid h-28 place-items-center">
            <Typography variant="h3" color="white">
            Contact Us
            </Typography>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <Input label="First Name" size="lg" />
            <Input label="Last Name" size="lg" />
            <Input label="Email" size="lg" />
            <Input label="Subject" size="lg" />
            <Textarea label="Comments" />

            
            
          </CardBody>
            <Button variant="gradient" fullWidth>
             Send message
            </Button>
            &nbsp;
            <Typography
          variant="p"
          sx={{ letterSpacing: '1.5px', marginLeft: '4px'  }}>
        </Typography>
          
          
        <Typography variant="small" className="mt-6 flex justify-center">
           <h1 style={{ color: 'orange' }}><b><div>Registered Address : #290, Medahalli, Banglore - 560049 , info@mumbaidabbawala.in</div></b></h1>

           <Typography
                as="a"
                href="#signup"
                variant="small"
                color="orange-gray"
                className="ml-1 font-bold">
              </Typography>
           </Typography>

        </Card>
      </div>
      <img style={{width: '60%', height: '100vh'}} alt="Dabbawalas animation" src="https://mocomi.com/wp-content/uploads/2016/09/MOC_GIFO_DABBAWALAS.gif" />
    </div>
   

   
  );

  
}

export default Contact_us;

