import React from "react";
import {
  Button,
  IconButton,
  Rating,
  Typography,
} from "@material-tailwind/react";
import { HeartIcon } from "@heroicons/react/24/outline";

export function OrderDetails() {
  return (
    <section className="py-16 px-8">
      <div className="mx-auto container grid place-items-center grid-cols-1 md:grid-cols-2">
      <img style={{width: '60%', height: '50vh'}} alt="Veg orange Salad" src="https://i.ytimg.com/vi/ln_P2jNCSA0/maxresdefault.jpg" />  
        <div>
          <Typography className="mb-4" variant="h3">
          Veg orange Salad 
          </Typography>
          <b><hr class="separator" /></b>
          <h1 style={{ color: 'orange' }}><b><div>Special Price </div></b></h1>
          <Typography variant="h5">₹199</Typography>
          <Typography className="mt-4 text-base font-normal leading-[27px] !text-gray-500">
          A refreshing vegetable salad using all different kinds of vegetables. You can use whatever you like, but the tomatoes and cucumbers make it taste great. It is very much like an Israeli salad. The homemade dressing is very good for any orange salad.
          </Typography>
          <div className="my-8 flex items-center gap-2">
            <Rating value={4} className="text-amber-500" />
            <Typography className="!text-sm font-bold !text-gray-700">
              4.0/5 (100 reviews)
            </Typography>
          </div>
          <Typography color="orange-gray" variant="h6">
            Box Color
          </Typography>
          <div className="my-8 mt-3 flex items-center gap-2">
            <div className="h-5 w-5 rounded border border-gray-900 bg-orange-gray-600 "></div>
            <div className="h-5 w-5 rounded border border-orange-gray-100 "></div>
            <div className="h-5 w-5 rounded border border-orange-red-100 bg-red-900 "></div>
          </div>
          <div className="mb-4 flex w-full items-center gap-3 md:w-1/2 ">
    <Button color="orange" appearance="primary"> 
              <a href="/MyCart">
              Add to Cart
               </a> 
            </Button>
            <IconButton color="gray" variant="text" className="shrink-0">
              <HeartIcon className="h-6 w-6" />
            </IconButton>
          </div>
          <b><hr class="separator" /></b>

        </div>
        <br></br>
        <div class="items-center hidden gap-x-2 lg:flex">
        <b>Delivery</b>
      <div class="relative flex w-full gap-2 md:w-max">
        <div class="relative h-10 w-full  min-w-[288px]">
          <input type="Enter Delivery Pincode" placeholder="Enter Delivery Pincode"
            class="peer h-full w-full rounded-[7px] border border-orange-gray-200 border-t-transparent !border-t-orange-gray-300 bg-transparent px-3 py-2.5 pl-9 font-sans text-sm font-normal text-orange-gray-700 outline outline-0 transition-all placeholder:text-orange-gray-300 placeholder-shown:border placeholder-shown:border-orange-gray-200 placeholder-shown:border-t-orange-gray-200 focus:border-2  focus:!border-orange-gray-300 focus:border-t-transparent focus:outline-0 disabled:border-0 disabled:bg-orange-gray-50" />
          <label
            class="before:content[' '] after:content[' '] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none !overflow-visible truncate text-[11px] font-normal leading-tight text-gray-500 transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-orange-gray-200 before:transition-all before:content-none after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-orange-gray-200 after:transition-all after:content-none peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-orange-gray-500 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-gray-900 peer-focus:before:border-t-2 peer-focus:before:border-l-2 peer-focus:before:!border-gray-900 peer-focus:after:border-t-2 peer-focus:after:border-r-2 peer-focus:after:!border-gray-900 peer-disabled:text-transparent peer-disabled:before:border-transparent peer-disabled:after:border-transparent peer-disabled:peer-placeholder-shown:text-orange-gray-500"></label>
        </div>
        <div class="!absolute left-3 top-[13px]">
          <svg width="13" height="14" viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M9.97811 7.95252C10.2126 7.38634 10.3333 6.7795 10.3333 6.16667C10.3333 4.92899 9.84167 3.742 8.9665 2.86683C8.09133 1.99167 6.90434 1.5 5.66667 1.5C4.42899 1.5 3.242 1.99167 2.36683 2.86683C1.49167 3.742 1 4.92899 1 6.16667C1 6.7795 1.12071 7.38634 1.35523 7.95252C1.58975 8.51871 1.93349 9.03316 2.36683 9.4665C2.80018 9.89984 3.31462 10.2436 3.88081 10.4781C4.447 10.7126 5.05383 10.8333 5.66667 10.8333C6.2795 10.8333 6.88634 10.7126 7.45252 10.4781C8.01871 10.2436 8.53316 9.89984 8.9665 9.4665C9.39984 9.03316 9.74358 8.51871 9.97811 7.95252Z"
              fill="#CFD8DC"></path>
            <path
              d="M13 13.5L9 9.5M10.3333 6.16667C10.3333 6.7795 10.2126 7.38634 9.97811 7.95252C9.74358 8.51871 9.39984 9.03316 8.9665 9.4665C8.53316 9.89984 8.01871 10.2436 7.45252 10.4781C6.88634 10.7126 6.2795 10.8333 5.66667 10.8333C5.05383 10.8333 4.447 10.7126 3.88081 10.4781C3.31462 10.2436 2.80018 9.89984 2.36683 9.4665C1.93349 9.03316 1.58975 8.51871 1.35523 7.95252C1.12071 7.38634 1 6.7795 1 6.16667C1 4.92899 1.49167 3.742 2.36683 2.86683C3.242 1.99167 4.42899 1.5 5.66667 1.5C6.90434 1.5 8.09133 1.99167 8.9665 2.86683C9.84167 3.742 10.3333 4.92899 10.3333 6.16667Z"
              stroke="#CFD8DC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </div>
      </div>
      <button
        class="select-none rounded-lg bg-gray-900 py-3 px-6 text-center align-middle font-sans text-xs font-bold uppercase text-white shadow-md shadow-gray-900/10 transition-all hover:shadow-lg hover:shadow-gray-900/20 focus:opacity-[0.85] focus:shadow-none active:opacity-[0.85] active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
        type="button">
        Search
      </button>
    </div>

      </div>
    </section>
  );
}

export default OrderDetails;