import React from "react";
import { MdOutlineWorkspacePremium } from "react-icons/md";

const plans = [
  {
    name: "Basic",
    price: "Free",
    billing: "month",
    features: ["Core Features", "Email Support", "Single User"],
  },
  {
    name: "Pro",
    price: 20000,
    billing: "month",
    features: ["All Basic Features", "Priority Support", "Team Access"],
    popular: true,
  },
  {
    name: "Enterprise",
    price: 30000,
    billing: "year",
    features: ["Full Access", "Dedicated Support", "Unlimited Users"],
  },
];

export default function Subscriptions() {
  const handleSubscribe = async (plan) => {
    const res = await fetch("http://localhost:5000/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: plan.price,
        plan: plan.name,
      }),
    });

    const data = await res.json();

    const options = {
      key: "YOUR_RAZORPAY_KEY_ID",
      amount: data.amount,
      currency: "INR",
      name: "Your Company",
      description: `${plan.name} Plan`,
      order_id: data.id,
      handler: function (response) {
        alert("Payment Successful!");
        console.log(response);
      },
      theme: {
        color: "#22c55e",
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

 return (
  <div className="min-h-screen bg-gradient-to-r from-orange-200 via-orange-700 to-orange-900 flex flex-col items-center py-16 px-4">
    
    <h1 className="text-4xl font-bold mb-12 text-white">
      Choose Your Plan
    </h1>

    <div className="grid md:grid-cols-3 gap-8 w-full max-w-6xl">
      {plans.map((plan) => (
        <div
          key={plan.name}
          className={`bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 flex flex-col items-center border ${
            plan.popular ? "border-orange-400 scale-105" : "border-gray-200"
          }`}
        >
          {plan.popular && (
            <span className="text-sm bg-gradient-to-r from-orange-600 to-orange-800 text-white px-3 py-1 rounded-full mb-4 flex items-center gap-1">
              <MdOutlineWorkspacePremium /> Most Popular
            </span>
          )}

          <h2 className="text-2xl font-semibold">{plan.name}</h2>

          <p className="text-3xl font-bold my-6">{plan.price}</p>

          <ul className="space-y-2 text-gray-700 mb-8">
            {plan.features.map((feature) => (
              <li key={feature}>✓ {feature}</li>
            ))}
          </ul>

          <button
            onClick={() => handleSubscribe(plan)}
            className="w-full bg-gradient-to-r from-orange-600 via-orange-700 to-orange-900 text-white shadow-lg hover:scale-105 transition duration-300 px-6 py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <MdOutlineWorkspacePremium size={20} />
            Subscribe
          </button>
        </div>
      ))}
    </div>
  </div>
);
}