import React from "react";
import { Breadcrumbs } from "@material-tailwind/react";
import { Link, useNavigate } from "react-router-dom";

const WISDOM_IMG =
  "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Wisdom-Tooth-1.gif";

export default function WisdomTeethRemoval() {
  const navigate = useNavigate();

  return (
    <section className="bg-white py-16 px-6 md:px-20">

      {/* Breadcrumbs */}
      <div className="mb-6">
        <Breadcrumbs>

          <Link to="/" className="opacity-60">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </Link>

          <Link to="/HomePage" className="opacity-60">
            Home
          </Link>

          <Link to="/WhatWeTreatPage" className="opacity-60">
            What we Treat
          </Link>

          <span className="font-medium text-orange-900">
            Wisdom Teeth Removal
          </span>

        </Breadcrumbs>
      </div>

      {/* Heading */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-orange-900">
          Wisdom Teeth Removal
        </h1>
        <p className="text-gray-600 mt-3 italic">
          Safe, gentle extraction to relieve pain and protect your smile.
        </p>
      </div>

      {/* Introduction + Image */}
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">

        {/* Text */}
        <div className="text-gray-700 leading-7">
          <p>
            Wisdom teeth are the last molars to erupt, usually in the late teens
            or early twenties. When there isn't enough room in the jaw, they can
            become impacted, grow at an angle, or crowd neighbouring teeth,
            leading to pain, infection, and swelling.
          </p>

          <p className="mt-4">
            Our dental surgeons perform painless wisdom tooth extractions using
            modern techniques and local anaesthesia, ensuring a comfortable
            experience and a quick, well-guided recovery.
          </p>
        </div>

        {/* Image */}
        <div className="flex justify-center">
          <img
            src={WISDOM_IMG}
            alt="Wisdom Teeth Removal"
            className="rounded-xl shadow-lg w-full max-w-md object-cover"
          />
        </div>

      </div>

      {/* Symptoms */}
      <div className="max-w-5xl mx-auto mt-12">
        <h2 className="text-2xl font-semibold text-orange-800 mb-4">
          Signs You May Need Wisdom Teeth Removal
        </h2>

        <ul className="grid md:grid-cols-2 gap-4 text-gray-700 list-disc pl-6">
          <li>Pain or stiffness at the back of the jaw</li>
          <li>Swollen, red, or tender gums around the molars</li>
          <li>Difficulty opening your mouth or chewing</li>
          <li>Bad breath or an unpleasant taste</li>
          <li>Crowding or shifting of nearby teeth</li>
          <li>Repeated infections or trapped food debris</li>
        </ul>
      </div>

      {/* Procedure */}
      <div className="max-w-5xl mx-auto mt-12">
        <h2 className="text-2xl font-semibold text-orange-800 mb-4">
          The Extraction Procedure
        </h2>

        <div className="grid md:grid-cols-2 gap-6 text-gray-700">
          <div>
            <h3 className="font-semibold">1. Examination & X-Ray</h3>
            <p>The dentist assesses the tooth position and takes an X-ray.</p>
          </div>

          <div>
            <h3 className="font-semibold">2. Local Anesthesia</h3>
            <p>The area is numbed to ensure a painless procedure.</p>
          </div>

          <div>
            <h3 className="font-semibold">3. Accessing the Tooth</h3>
            <p>If impacted, a small incision exposes the tooth and bone.</p>
          </div>

          <div>
            <h3 className="font-semibold">4. Removing the Tooth</h3>
            <p>The tooth is gently loosened and removed, sometimes in sections.</p>
          </div>

          <div>
            <h3 className="font-semibold">5. Cleaning & Stitches</h3>
            <p>The socket is cleaned and stitched if needed to aid healing.</p>
          </div>

          <div>
            <h3 className="font-semibold">6. Recovery Guidance</h3>
            <p>Aftercare advice keeps you comfortable during healing.</p>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="max-w-5xl mx-auto mt-12">
        <h2 className="text-2xl font-semibold text-orange-800 mb-4">
          Benefits of Wisdom Teeth Removal
        </h2>

        <ul className="grid md:grid-cols-2 gap-4 text-gray-700 list-disc pl-6">
          <li>Relieves pain and pressure</li>
          <li>Prevents infection and gum disease</li>
          <li>Stops crowding of healthy teeth</li>
          <li>Protects against cysts and decay</li>
          <li>Improves overall oral health</li>
        </ul>
      </div>

      {/* CTA */}
      <div className="text-center mt-14">
        <h3 className="text-xl font-semibold text-orange-900">
          Book Your Appointment Today
        </h3>
        <p className="text-gray-600 mt-2">
          If you are experiencing pain or swelling, early assessment can prevent
          complications and make recovery easier.
        </p>

        <button
          onClick={() => navigate("/BookAppointment")}
          className="mt-5 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg shadow"
        >
          Book Appointment
        </button>
      </div>

    </section>
  );
}
