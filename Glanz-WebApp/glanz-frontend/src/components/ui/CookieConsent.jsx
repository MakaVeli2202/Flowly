import React, { useState, useEffect } from "react";
import { Button } from "./button";

function CookieConsent({ privacyHref = "#", className = "" }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) setShow(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 dark:bg-black/50"
    >
      <div
        className={`relative w-full max-w-md rounded-2xl border bg-white text-neutral-800 border-neutral-200 shadow-xl dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-800 p-5 sm:p-7 ${className}`}
      >
        <div className="mx-auto mb-4 sm:mb-5 h-16 w-16 drop-shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="12.44 20.16 231.08 206.86"
            className="h-full w-full"
            role="img"
            aria-label="Cookie illustration"
          >
            <g fill="none" stroke="none">
              <g transform="scale(4,4)">
                <path d="M57.8,20.28l-3.8,-0.49l-1.09,-2.55l-2.91,-1.25h-2l-2.5,-2.19c0,0 -3.5,-0.81 -3.5,-2.81c0,-0.61 -0.09,-1.6 -0.22,-2.68c-0.59,0.03 -1.19,0.07 -1.78,0.07c-2.1,0 -4.25,-0.43 -6.15,0.19c-1.97,0.64 -3.45,2.27 -5.08,3.46c-1.65,1.2 -3.66,2.12 -4.86,3.77c-1.19,1.64 -1.45,3.82 -2.09,5.78c-0.62,1.9 -1.71,3.8 -1.71,5.91c0,2.11 1.09,4.01 1.71,5.91c0.64,1.97 0.9,4.15 2.09,5.78c1.2,1.65 3.21,2.57 4.86,3.77c1.64,1.19 3.12,2.82 5.08,3.46c1.9,0.62 4.04,0.19 6.15,0.19c2.11,0 4.25,0.43 6.15,-0.19c1.97,-0.64 3.45,-2.27 5.08,-3.46c1.65,-1.2 3.66,-2.12 4.86,-3.77c1.19,-1.64 1.45,-3.82 2.09,-5.78c0.62,-1.9 1.71,-3.8 1.71,-5.91c0,-2.11 -1.09,-4.01 -1.71,-5.91c-0.14,-0.43 -0.26,-0.87 -0.38,-1.31z" fill="#894c3d"></path>
                <circle cx="52" cy="29" r="2" fill="#702e24"></circle>
                <circle cx="36" cy="15" r="2" fill="#702e24"></circle>
                <path d="M46,7l3,5l1,-3.16v-2.79c0,0 -4,-0.05 -4,0.95z" fill="#894c3d"></path>
                <path d="M54,10.9l-0.62,1.1c1.02,1.49 2.2,2.03 3.62,1c0,0 -1,-4.2 -3,-2.1z" fill="#894c3d"></path>
                <path d="M43.89,36.5c0,2.1 -1.09,4.01 -1.71,5.91c-0.62,1.9 -0.9,4.15 -2.09,5.78c-1.19,1.63 -3.21,2.57 -4.86,3.77c-1.65,1.2 -3.12,2.82 -5.08,3.46c-1.96,0.64 -4.04,0.19 -6.15,0.19c-2.11,0 -4.25,0.43 -6.15,-0.19c-1.9,-0.62 -3.45,-2.27 -5.08,-3.46c-1.63,-1.19 -3.66,-2.12 -4.86,-3.77c-1.2,-1.65 -1.45,-3.82 -2.09,-5.78c-0.64,-1.96 -1.71,-3.8 -1.71,-5.91c0,-2.11 1.09,-4.01 1.71,-5.91c0.62,-1.9 0.9,-4.15 2.09,-5.78c1.19,-1.63 3.21,-2.57 4.86,-3.77c1.65,-1.2 3.12,-2.82 5.08,-3.46c1.96,-0.64 4.04,-0.19 6.15,-0.19c2.11,0 4.25,-0.43 6.15,0.19c1.9,0.62 3.45,2.27 5.08,3.46c1.63,1.19 3.66,2.12 4.86,3.77c1.2,1.65 1.45,3.82 2.09,5.78c0.64,1.96 1.71,3.8 1.71,5.91z" fill="#a26a55"></path>
                <circle cx="36" cy="38" r="2" fill="#702e24"></circle>
                <circle cx="23" cy="37" r="2" fill="#702e24"></circle>
                <circle cx="20" cy="26" r="2" fill="#702e24"></circle>
                <circle cx="18" cy="46" r="2" fill="#702e24"></circle>
                <path d="M59.72,22.87c-0.21,-0.53 -0.42,-1.06 -0.59,-1.59c-0.13,-0.41 -0.25,-0.83 -0.36,-1.26c-0.1,-0.39 -0.44,-0.68 -0.84,-0.74l-3.24,-0.42l-0.86,-2.02c-0.1,-0.24 -0.29,-0.43 -0.53,-0.53l-2.91,-1.25c-0.12,-0.05 -0.26,-0.08 -0.39,-0.08h-1.62l-2.22,-1.94c-0.12,-0.11 -0.27,-0.18 -0.43,-0.22c-0.85,-0.2 -2.73,-0.94 -2.73,-1.83c0,-0.59 -0.08,-1.5 -0.23,-2.8c-0.06,-0.53 -0.54,-0.9 -1.05,-0.88c-1.17,0.07 -2.34,0.06 -3.51,0c-1.55,-0.09 -3.15,-0.19 -4.67,0.31c-1.58,0.51 -2.82,1.54 -4.02,2.53c-0.45,0.37 -0.89,0.74 -1.35,1.07c-0.46,0.34 -0.96,0.65 -1.45,0.97c-1.31,0.83 -2.66,1.7 -3.62,3.02c-0.24,0.33 -0.45,0.7 -0.65,1.11c-0.08,0 -0.16,0 -0.24,0c-1.55,-0.09 -3.15,-0.19 -4.67,0.31c-1.58,0.51 -2.82,1.54 -4.02,2.53c-0.45,0.37 -0.89,0.74 -1.35,1.07c-0.46,0.34 -0.96,0.65 -1.45,0.97c-1.31,0.83 -2.66,1.7 -3.62,3.02c-0.96,1.32 -1.37,2.88 -1.76,4.38c-0.15,0.57 -0.29,1.13 -0.47,1.68c-0.17,0.53 -0.38,1.05 -0.59,1.59c-0.57,1.45 -1.17,2.94 -1.17,4.63c0,1.69 0.59,3.18 1.17,4.63c0.21,0.53 0.42,1.06 0.59,1.59c0.18,0.55 0.33,1.12 0.47,1.68c0.39,1.51 0.8,3.06 1.76,4.38c0.96,1.33 2.32,2.19 3.62,3.02c0.5,0.32 0.99,0.63 1.46,0.97c0.46,0.33 0.9,0.7 1.35,1.07c1.2,0.99 2.44,2.02 4.01,2.53c0.92,0.3 1.86,0.38 2.8,0.38c0.62,0 1.25,-0.04 1.86,-0.07c1.19,-0.07 2.39,-0.07 3.58,0c1.55,0.09 3.15,0.19 4.67,-0.31c1.58,-0.51 2.82,-1.54 4.02,-2.53c0.45,-0.37 0.89,-0.74 1.35,-1.07c0.46,-0.34 0.96,-0.65 1.45,-0.97c1.31,-0.83 2.66,-1.7 3.62,-3.02c0.26,-0.35 0.47,-0.73 0.66,-1.11h0.23c0.62,0.05 1.24,0.09 1.87,0.09c0.94,0 1.89,-0.08 2.8,-0.38c1.58,-0.51 2.82,-1.54 4.02,-2.53c0.45,-0.37 0.89,-0.74 1.35,-1.07c0.46,-0.34 0.96,-0.65 1.45,-0.97c1.31,-0.83 2.66,-1.7 3.62,-3.02c0.96,-1.32 1.37,-2.88 1.76,-4.38c0.15,-0.57 0.29,-1.13 0.47,-1.68c0.17,-0.53 0.38,-1.05 0.59,-1.59c0.57,-1.45 1.17,-2.94 1.17,-4.63c0,-1.69 -0.59,-3.18 -1.17,-4.63z" fill="#1a2c3d"></path>
                <path d="M52,26c-1.65,0 -3,1.35 -3,3c0,1.65 1.35,3 3,3c1.65,0 3,-1.35 3,-3c0,-1.65 -1.35,-3 -3,-3zM52,30c-0.55,0 -1,-0.45 -1,-1c0,-0.55 0.45,-1 1,-1c0.55,0 1,0.45 1,1c0,0.55 -0.45,1 -1,1z" fill="#1a2c3d"></path>
                <circle cx="49.5" cy="38.5" r="1.5" fill="#1a2c3d"></circle>
                <circle cx="47.5" cy="22.5" r="1.5" fill="#1a2c3d"></circle>
                <path d="M36,12c-1.65,0 -3,1.35 -3,3c0,1.65 1.35,3 3,3c1.65,0 3,-1.35 3,-3c0,-1.65 -1.35,-3 -3,-3zM36,16c-0.55,0 -1,-0.45 -1,-1c0,-0.55 0.45,-1 1,-1c0.55,0 1,0.45 1,1c0,0.55 -0.45,1 -1,1z" fill="#1a2c3d"></path>
                <circle cx="36" cy="14" r="2" fill="#1a2c3d"></circle>
                <circle cx="49" cy="38" r="1.5" fill="#1a2c3d"></circle>
                <circle cx="48" cy="22" r="1.5" fill="#1a2c3d"></circle>
                <path d="M23,34c-1.65,0 -3,1.35 -3,3c0,1.65 1.35,3 3,3c1.65,0 3,-1.35 3,-3c0,-1.65 -1.35,-3 -3,-3zM23,38c-0.55,0 -1,-0.45 -1,-1c0,-0.55 0.45,-1 1,-1c0.55,0 1,0.45 1,1c0,0.55 -0.45,1 -1,1z" fill="#1a2c3d"></path>
                <path d="M20,29c1.65,0 3,-1.35 3,-3c0,-1.65 -1.35,-3 -3,-3c-1.65,0 -3,1.35 -3,3c0,1.65 1.35,3 3,3zM20,25c0.55,0 1,0.45 1,1c0,0.55 -0.45,1 -1,1c-0.55,0 -1,-0.45 -1,-1c0,-0.55 0.45,-1 1,-1z" fill="#1a2c3d"></path>
                <path d="M18,43c-1.65,0 -3,1.35 -3,3c0,1.65 1.35,3 3,3c1.65,0 3,-1.35 3,-3c0,-1.65 -1.35,-3 -3,-3zM18,47c-0.55,0 -1,-0.45 -1,-1c0,-0.55 0.45,-1 1,-1c0.55,0 1,0.45 1,1c0,0.55 -0.45,1 -1,1z" fill="#1a2c3d"></path>
              </g>
            </g>
          </svg>
        </div>

        <div className="text-center mb-5">
          <h2 id="cookie-title" className="text-lg sm:text-xl font-bold text-[var(--heading-color)]">
            Freshly Baked Cookies!
          </h2>
          <p className="mt-2 text-sm sm:text-base leading-relaxed text-[var(--muted-color)]">
            Our site uses cookies to provide you with a smooth and personalized experience.
            By clicking "Accept", you agree to our{" "}
            <a
              href={privacyHref}
              className="font-semibold underline text-primary hover:text-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              Privacy Policy
            </a>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button onClick={handleAccept} className="w-full sm:w-auto">
            Accept
          </Button>
          <Button variant="outline" onClick={handleDecline} className="w-full sm:w-auto">
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
