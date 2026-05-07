import React from "react";

const Car = () => {
  return (
    <>
      <style>
        {`
          @keyframes carRotate {
            0% { transform: rotateZ(0deg) rotateX(15deg); }
            100% { transform: rotateZ(360deg) rotateX(15deg); }
          }
          @keyframes twinkling {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 1; }
          }
          @keyframes twinkling-slow {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 1; }
          }
          @keyframes twinkling-long {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 1; }
          }
          @keyframes twinkling-fast {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 1; }
          }
          @keyframes carGlow {
            0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), -5px 0 8px #3b82f6 inset; }
            50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.6), -5px 0 12px #60a5fa inset, 15px 2px 25px rgba(0, 0, 0, 0.3) inset; }
          }
        `}
      </style>
      <div className="flex items-center justify-center h-screen">
        <div
          className="relative w-[300px] h-[300px] rounded-3xl overflow-hidden"
          style={{
            animation: "carGlow 4s ease-in-out infinite",
          }}
        >
          {/* Car SVG - Modern sports car in isometric view */}
          <svg
            viewBox="0 0 300 200"
            className="w-full h-full"
            style={{
              animation: "carRotate 20s linear infinite",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Road background */}
            <rect width="300" height="200" fill="#1a1a2e" />
            <line x1="0" y1="100" x2="300" y2="100" stroke="#c3f4ff" strokeWidth="2" strokeDasharray="10,10" opacity="0.3" />

            {/* Car body - Modern sedan */}
            <g id="car">
              {/* Chassis */}
              <rect x="60" y="90" width="180" height="50" fill="#ff6b35" rx="5" />
              
              {/* Car roof */}
              <ellipse cx="150" cy="75" rx="70" ry="25" fill="#ff8555" opacity="0.9" />
              
              {/* Windshield */}
              <polygon points="100,75 200,75 190,95 110,95" fill="#60a5fa" opacity="0.6" />
              
              {/* Wheels */}
              <circle cx="95" cy="145" r="18" fill="#000" />
              <circle cx="205" cy="145" r="18" fill="#000" />
              
              {/* Wheel rims */}
              <circle cx="95" cy="145" r="12" fill="none" stroke="#c3f4ff" strokeWidth="2" opacity="0.8" />
              <circle cx="205" cy="145" r="12" fill="none" stroke="#c3f4ff" strokeWidth="2" opacity="0.8" />
              
              {/* Headlights */}
              <circle cx="65" cy="100" r="6" fill="#ffff00" opacity="0.8" />
              <circle cx="75" cy="100" r="6" fill="#ffff00" opacity="0.8" />
              
              {/* Taillights */}
              <circle cx="235" cy="100" r="6" fill="#ff4444" opacity="0.8" />
              <circle cx="225" cy="100" r="6" fill="#ff4444" opacity="0.8" />
              
              {/* Window reflection */}
              <line x1="120" y1="80" x2="180" y2="80" stroke="#fff" strokeWidth="1" opacity="0.4" />
            </g>
          </svg>

          {/* Ambient stars around car */}
          <div
            className="absolute left-[-40px] top-[20px] w-1.5 h-1.5 bg-blue-400 rounded-full"
            style={{ animation: "twinkling 3s infinite" }}
          />
          <div
            className="absolute left-[-60px] top-[80px] w-1 h-1 bg-white rounded-full"
            style={{ animation: "twinkling-slow 2s infinite" }}
          />
          <div
            className="absolute right-[-50px] top-[60px] w-1.5 h-1.5 bg-blue-300 rounded-full"
            style={{ animation: "twinkling-long 4s infinite" }}
          />
          <div
            className="absolute left-[20px] bottom-[-30px] w-1 h-1 bg-blue-400 rounded-full"
            style={{ animation: "twinkling 3s infinite" }}
          />
          <div
            className="absolute right-[30px] bottom-[-40px] w-1.5 h-1.5 bg-white rounded-full"
            style={{ animation: "twinkling-fast 1.5s infinite" }}
          />
          <div
            className="absolute right-[-70px] bottom-[50px] w-1 h-1 bg-blue-300 rounded-full"
            style={{ animation: "twinkling-long 4s infinite" }}
          />
          <div
            className="absolute left-[-80px] bottom-[20px] w-1 h-1 bg-blue-400 rounded-full"
            style={{ animation: "twinkling-slow 2.5s infinite" }}
          />
        </div>
      </div>
    </>
  );
};

export default Car;
