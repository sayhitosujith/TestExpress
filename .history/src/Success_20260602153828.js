import './App.css';


import {
  Card,
  CardBody,
  Typography,
  Button,
  IconButton,
  
} from "@material-tailwind/react";


function Success() {
  return (
   
    <section>
    <div className="w-full px-4">
      <div className="grid h-screen place-items-center">
        <Card className="max-w-xl">
          <CardBody>
            <div className="flex w-full justify-end">
              <IconButton variant="text">
                <i className="fas fa-close text-xl"></i>
              </IconButton>
            </div>
            <div className="text-center px-6">
              <Typography
                color="orange-gray"
                className="mb-6 mt-10"
                variant="h4"
              >
              </Typography>
              <Typography className="text-[20px] font-normal justify-center">
                <img style={{width: '100%', height: '50vh'}} alt="Payment success" src="https://fcs3pub.s3.amazonaws.com/photo-book/images/payment/success.gif" />

              Don&apos;t miss out on the latest deals and promotions.
              </Typography>
              <Button size="lg" className="mt-8">
              <a href="/Welcome">
               Success 
               </a>   
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  </section>
  )
}

export default Success;

