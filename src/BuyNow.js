import './App.css';
import React from 'react';
import { Radio } from "@material-tailwind/react";


import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Typography,
  Textarea,
  Button,
  Select,
  Option,
  Checkbox,
  Input
  
} from "@material-tailwind/react";
const LINKS = [
  {
    title: "Product",
    items: ["Overview", "Features", "Solutions", "Tutorials"],
  },
  {
    title: "Company",
    items: ["About us", "Careers", "Press", "News"],
  },
  {
    title: "Resource",
    items: ["Blog", "Newsletter", "Events", "Help center"],
  },
];
 
const currentYear = new Date().getFullYear();
<style>
.footer 
   position: fixed;
   left: 0;
   bottom: 0;
   width: 100%;
   background-color: red;
   color: white;
   text-align: center;
   clearfix overflow: auto;

</style>


function BuyNow() {
  return (

    <div className="flex flex-row gap-5b justify-center">
        <header>
        <Typography variant="small" className="mt-0 justify-center">
 <img style={{width: '45%', height: '25vh'}} src="data:image/png;base64,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" /> </Typography>      
 <br></br>
 <br></br>
   
  </header>

  <br></br>
  <br></br>
  <br></br>
  <br></br>

      <div className="flex flex-col gap-5">
      <br></br>
      <br></br>
      <br></br>
      <br></br>
      <br></br>
      <br></br>
      <b><hr class="separator" /></b>

      <Typography variant="h3" color="Black">
        <h1 style={{ color: 'orange' }}><b><div>Contact</div></b></h1> </Typography>  
          <b><hr class="separator" /></b>

          <CardBody className="flex flex-col gap-6">
          <Input label="Email or Mobile Number " size="lg" />
          <h1 style={{ color: 'orange' }}><b><div>Delivery </div></b></h1>

          <div className="w-72">
              <Select label="Country/Region">
                <Option>India</Option>
                <Option>Srlkanka</Option>
                <Option>Thailand</Option>
                <Option>China</Option>

              </Select>
              
            </div>
            <Input label="First Name " size="lg" />

            <Input label="Last Name " size="lg" />

            <Input label="Company (Optional) " size="lg" />

            <Input label="Address " size="lg" />
            <Input label="City " size="lg" />
            <Input label="State " size="lg" />
            <Input label="Pincode " size="lg" />
            <Input label="Phone " size="lg" />

          <Checkbox label="Save this information for next time" />
          <Checkbox label="Text me with news and offers" />
          
          
          <b><hr class="separator" /></b>

          <h1 style={{ color: 'orange' }}><b><div>PAYMENT </div></b></h1>

            <div className="flex gap-10">
      <Radio name="type" label=" Razorpay Secure (UPI, Cards, Wallets, NetBanking)" />
      <Radio name="type" label=" Cash on Delivery(COD)" defaultChecked />
    </div>
          
            <b><hr class="separator" /></b>

          </CardBody>
          <CardFooter className="pt-0">
          <Button color="orange" appearance="primary" > 
           <a href="/CheckoutForm">
           PROCEED (Check-out)
               </a> 
           </Button> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <Button color="orange" appearance="primary" > 

           CANCEL</Button> 
           <br></br>
           <br></br>

{/* Footer */}
            <Typography
          variant="p"
          sx={{ letterSpacing: '1.5px', marginLeft: '4px'  }}>
        </Typography>     
          </CardFooter>

          <footer className="relative w-full">
      <div className="mx-auto w-full max-w-7xl px-8">
        <div className="grid grid-cols-1 justify-between gap-4 md:grid-cols-2">
          <Typography variant="h5" className="mb-6">
            Food Maven
          </Typography>
          <div className="grid grid-cols-3 justify-between gap-4">
            {LINKS.map(({ title, items }) => (
              <ul key={title}>
                <Typography
                  variant="small"
                  color="blue-gray"
                  className="mb-3 font-medium opacity-40"
                >
                  {title}
                </Typography>
                {items.map((link) => (
                  <li key={link}>
                    <Typography
                      as="button"
                      type="button"
                      color="gray"
                      className="py-1.5 font-normal transition-colors hover:text-orange-gray-900"
                    >
                      {link}
                    </Typography>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
        <div className="mt-12 flex w-full flex-col items-center justify-center border-t border-orange-gray-50 py-4 md:flex-row md:justify-between">
          <Typography
            variant="small"
            className="mb-4 text-center font-normal text-orange-gray-900 md:mb-0"
          >
            &copy; {currentYear} <a href="https://material-tailwind.com/">Food Maven</a>. All
            Rights Reserved.
          </Typography>
          <div className="mt-2 mb-2 flex items-center justify-center gap-2 text-gray-600">
            <span className="text-sm">Made in India</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="32" height="21" role="img" aria-label="Indian flag" style={{ borderRadius: 2, border: "1px solid #ddd" }}>
              <rect width="900" height="200" fill="#FF9933"/>
              <rect y="200" width="900" height="200" fill="#FFFFFF"/>
              <rect y="400" width="900" height="200" fill="#138808"/>
              <circle cx="450" cy="300" r="90" fill="none" stroke="#000080" strokeWidth="8"/>
              <circle cx="450" cy="300" r="10" fill="#000080"/>
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i * 15 * Math.PI) / 180;
                return (<line key={i} x1={450 + 10 * Math.cos(angle)} y1={300 + 10 * Math.sin(angle)} x2={450 + 90 * Math.cos(angle)} y2={300 + 90 * Math.sin(angle)} stroke="#000080" strokeWidth="4"/>);
              })}
            </svg>
          </div>
          <div className="flex gap-4 text-orange-gray-900 sm:justify-center">
            <Typography as="button" type="button" className="opacity-80 transition-opacity hover:opacity-100">
              <svg className="h-5 w-5" fill="orange" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                  clip-rule="evenodd"
                />
              </svg>
            </Typography>
            <Typography as="button" type="button" className="opacity-80 transition-opacity hover:opacity-100">
              <svg className="h-5 w-5" fill="red" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                  clip-rule="evenodd"
                />
              </svg>
            </Typography>
            <Typography as="button" type="button" className="opacity-80 transition-opacity hover:opacity-100">
              <svg className="h-5 w-5" fill="orange" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
              </svg>
            </Typography>
            <Typography as="button" type="button" className="opacity-80 transition-opacity hover:opacity-100">
              <svg className="h-5 w-5" fill="black" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clip-rule="evenodd"
                />
              </svg>
            </Typography>
            <Typography as="button" type="button" className="opacity-80 transition-opacity hover:opacity-100">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.51 0 10-4.48 10-10S17.51 2 12 2zm6.605 4.61a8.502 8.502 0 011.93 5.314c-.281-.054-3.101-.629-5.943-.271-.065-.141-.12-.293-.184-.445a25.416 25.416 0 00-.564-1.236c3.145-1.28 4.577-3.124 4.761-3.362zM12 3.475c2.17 0 4.154.813 5.662 2.148-.152.216-1.443 1.941-4.48 3.08-1.399-2.57-2.95-4.675-3.189-5A8.687 8.687 0 0112 3.475zm-3.633.803a53.896 53.896 0 013.167 4.935c-3.992 1.063-7.517 1.04-7.896 1.04a8.581 8.581 0 014.729-5.975zM3.453 12.01v-.26c.37.01 4.512.065 8.775-1.215.25.477.477.965.694 1.453-.109.033-.228.065-.336.098-4.404 1.42-6.747 5.303-6.942 5.629a8.522 8.522 0 01-2.19-5.705zM12 20.547a8.482 8.482 0 01-5.239-1.8c.152-.315 1.888-3.656 6.703-5.337.022-.01.033-.01.054-.022a35.318 35.318 0 011.823 6.475 8.4 8.4 0 01-3.341.684zm4.761-1.465c-.086-.52-.542-3.015-1.659-6.084 2.679-.423 5.022.271 5.314.369a8.468 8.468 0 01-3.655 5.715z"
                  clip-rule="evenodd"
                />
              </svg>
            </Typography>
          </div>
        </div>
      </div>
    </footer>
        <Typography variant="small" className="mt-6 flex justify-center">
    
        <br></br>

           <Typography
                as="a"
                href="#signup"
                variant="small"
                color="blue-gray"
                className="ml-1 font-bold">
              </Typography>
           </Typography>
      </div>
      
      <br></br>
     

    </div>
    

  );

  
}

export default BuyNow;

