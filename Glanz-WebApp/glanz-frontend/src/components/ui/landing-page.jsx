import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Car from "./car";

// Reusable ScrollCar component following shadcn/ui patterns
function ScrollCar({ sections, carConfig = {}, className = "" }) {
  const [activeSection, setActiveSection] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [carTransform, setCarTransform] = useState("");
  const [showNavLabel, setShowNavLabel] = useState(false);
  const containerRef = useRef(null);
  const sectionRefs = useRef([]);
  const lastScrollTime = useRef(0);
  const animationFrameId = useRef();
  const navLabelTimeoutRef = useRef();

  const defaultCarConfig = {
    positions: [
      { top: "50%", left: "75%", scale: 1.4 },  // Hero: Right side
      { top: "25%", left: "50%", scale: 0.9 },  // Section 2: Top center
      { top: "15%", left: "90%", scale: 2 },    // Section 3: Top right
      { top: "50%", left: "50%", scale: 1.8 },  // Section 4: Center
    ]
  };

  const config = { ...defaultCarConfig, ...carConfig };

  // Parse percentage to number
  const parsePercent = (str) => parseFloat(String(str).replace("%", ""));

  // Pre-calculate positions
  const calculatedPositions = useMemo(() => {
    return config.positions.map(pos => ({
      top: parsePercent(pos.top),
      left: parsePercent(pos.left),
      scale: pos.scale
    }));
  }, [config.positions]);

  // Update scroll position
  const updateScrollPosition = useCallback(() => {
    const scrollTop = window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = Math.min(Math.max(scrollTop / docHeight, 0), 1);
    
    setScrollProgress(progress);

    // Detect active section
    const viewportCenter = window.innerHeight / 2;
    let newActiveSection = 0;
    let minDistance = Infinity;

    sectionRefs.current.forEach((ref, index) => {
      if (ref) {
        const rect = ref.getBoundingClientRect();
        const sectionCenter = rect.top + rect.height / 2;
        const distance = Math.abs(sectionCenter - viewportCenter);
        
        if (distance < minDistance) {
          minDistance = distance;
          newActiveSection = index;
        }
      }
    });

    // Update car position
    const currentPos = calculatedPositions[newActiveSection];
    const transform = `translate3d(${currentPos.left}vw, ${currentPos.top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${currentPos.scale}, ${currentPos.scale}, 1)`;
    
    setCarTransform(transform);
    setActiveSection(newActiveSection);
  }, [calculatedPositions]);

  // Scroll handler with RAF
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        animationFrameId.current = requestAnimationFrame(() => {
          updateScrollPosition();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateScrollPosition();
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (navLabelTimeoutRef.current) {
        clearTimeout(navLabelTimeoutRef.current);
      }
    };
  }, [updateScrollPosition]);

  // Initial car position
  useEffect(() => {
    const initialPos = calculatedPositions[0];
    const initialTransform = `translate3d(${initialPos.left}vw, ${initialPos.top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${initialPos.scale}, ${initialPos.scale}, 1)`;
    setCarTransform(initialTransform);
  }, [calculatedPositions]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full max-w-screen overflow-x-hidden min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white ${className}`}
    >
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-0.5 bg-gradient-to-r from-border/20 via-border/40 to-border/20 z-50">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-900"
          style={{ 
            transform: `scaleX(${scrollProgress})`,
            transformOrigin: 'left center',
            transition: 'transform 0.15s ease-out',
            filter: 'drop-shadow(0 0 2px rgba(59, 130, 246, 0.3))'
          }}
        />
      </div>

      {/* Navigation dots */}
      <div className="hidden sm:flex fixed right-2 sm:right-4 lg:right-8 top-1/2 -translate-y-1/2 z-40">
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="relative group">
              {/* Section label */}
              <div
                className={`nav-label absolute right-5 sm:right-6 lg:right-8 top-1/2 -translate-y-1/2 
                  px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap
                  bg-slate-900/95 backdrop-blur-md border border-slate-700/60 shadow-xl z-50
                  ${activeSection === index ? "opacity-100 animate-fadeOut" : "opacity-0"}`}
              >
                <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
                  <div className="w-1 sm:w-1.5 lg:w-2 h-1 sm:h-1.5 lg:h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-xs sm:text-sm lg:text-base">
                    {section.badge || `Section ${index + 1}`}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  sectionRefs.current[index]?.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'center'
                  });
                }}
                className={`relative w-2 h-2 sm:w-2.5 sm:h-2.5 lg:w-3 lg:h-3 rounded-full border-2 transition-all duration-300 hover:scale-125
                  before:absolute before:inset-0 before:rounded-full before:transition-all before:duration-300
                  ${activeSection === index 
                    ? "bg-blue-500 border-blue-500 shadow-lg before:animate-ping before:bg-blue-400/20" 
                    : "bg-transparent border-slate-600/40 hover:border-blue-400/60 hover:bg-blue-500/10"
                }`}
                aria-label={`Go to ${section.badge || `section ${index + 1}`}`}
              />
            </div>
          ))}
        </div>
        
        {/* Navigation line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 lg:w-px bg-gradient-to-b from-transparent via-blue-500/20 to-transparent -translate-x-1/2 -z-10" />
      </div>

      {/* Car */}
      <div
        className="fixed z-10 pointer-events-none will-change-transform transition-all duration-[1400ms]"
        style={{
          transform: carTransform,
          filter: `opacity(${activeSection === 3 ? 0.4 : 0.85})`,
        }}
      >
        <div className="scale-75 sm:scale-90 lg:scale-100">
          <Car />
        </div>
      </div>

      {/* Sections */}
      {sections.map((section, index) => (
        <section
          key={section.id}
          ref={(el) => (sectionRefs.current[index] = el)}
          className={`relative min-h-screen flex flex-col justify-center px-4 sm:px-6 md:px-8 lg:px-12 z-20 py-12 sm:py-16 lg:py-20 w-full max-w-full overflow-hidden
            ${section.align === 'center' && "items-center text-center"}
            ${section.align === 'right' && "items-end text-right"}
            ${section.align !== 'center' && section.align !== 'right' && "items-start text-left"}`}
        >
          <div className={`w-full max-w-sm sm:max-w-lg md:max-w-2xl lg:max-w-4xl xl:max-w-5xl will-change-transform transition-all duration-700 opacity-100 translate-y-0`}>
            
            <h1 className={`font-bold mb-6 sm:mb-8 leading-[1.1] tracking-tight
              ${index === 0 
                ? "text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl" 
                : "text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl"}`}>
              {section.subtitle ? (
                <div className="space-y-1 sm:space-y-2">
                  <div className="bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
                    {section.title}
                  </div>
                  <div className="text-slate-400/90 text-[0.6em] sm:text-[0.7em] font-medium tracking-wider">
                    {section.subtitle}
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-white via-white to-slate-200 bg-clip-text text-transparent">
                  {section.title}
                </div>
              )}
            </h1>
            
            <div className={`text-slate-300/80 leading-relaxed mb-8 sm:mb-10 text-base sm:text-lg lg:text-xl font-light
              ${section.align === 'center' ? "max-w-full mx-auto text-center" : "max-w-full"}`}>
              <p className="mb-3 sm:mb-4">{section.description}</p>
              {index === 0 && (
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-400/60 mt-4 sm:mt-6">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                    <span>Interactive Experience</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
                    <span>Scroll to Explore</span>
                  </div>
                </div>
              )}
            </div>

            {/* Features */}
            {section.features && (
              <div className="grid gap-3 sm:gap-4 mb-8 sm:mb-10">
                {section.features.map((feature, featureIndex) => (
                  <div 
                    key={feature.title}
                    className={`group p-4 sm:p-5 lg:p-6 rounded-lg sm:rounded-xl border bg-slate-800/30 backdrop-blur-sm hover:bg-slate-800/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5 hover:border-blue-500/20 hover:-translate-y-1 border-slate-700/40`}
                    style={{ animationDelay: `${featureIndex * 0.1}s` }}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-blue-400/60 mt-1.5 sm:mt-2 group-hover:bg-blue-400 transition-colors flex-shrink-0" />
                      <div className="flex-1 space-y-1.5 sm:space-y-2 min-w-0">
                        <h3 className="font-semibold text-white text-base sm:text-lg">{feature.title}</h3>
                        <p className="text-slate-300/80 leading-relaxed text-sm sm:text-base">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            {section.actions && (
              <div className={`flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4
                ${section.align === 'center' && "justify-center"}
                ${section.align === 'right' && "justify-end"}
                ${(!section.align || section.align === 'left') && "justify-start"}`}>
                {section.actions.map((action, actionIndex) => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className={`group relative px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-full sm:w-auto
                      ${action.variant === 'primary' 
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30" 
                        : "border-2 border-slate-600/60 bg-slate-900/30 backdrop-blur-sm hover:bg-slate-800/50 hover:border-blue-500/30 text-slate-100"
                    }`}
                    style={{ animationDelay: `${actionIndex * 0.1 + 0.2}s` }}
                  >
                    <span className="relative z-10">{action.label}</span>
                    {action.variant === 'primary' && (
                      <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

// Demo component
export default function CarScrollDemo() {
  const demoSections = [
    {
      id: "hero",
      badge: "Welcome",
      title: "Explore",
      subtitle: "The Drive",
      description: "Journey through an immersive automotive experience where technology meets performance. Watch as your perspective shifts and possibilities unfold with every interaction, creating a symphony of digital velocity.",
      align: "left",
      actions: [
        { label: "Begin Journey", variant: "primary", onClick: () => console.log("Get started clicked") },
        { label: "Learn More", variant: "secondary", onClick: () => console.log("Learn more clicked") },
      ]
    },
    {
      id: "performance",
      badge: "Performance",
      title: "Connected Speed",
      description: "From every corner of the road, we witness the interconnected web of automotive excellence. Each connection represents progress, every interaction drives innovation forward into uncharted territories.",
      align: "center",
    },
    {
      id: "innovation",
      badge: "Innovation",
      title: "Expanding",
      subtitle: "Horizons",
      description: "As we push beyond familiar boundaries, new worlds of automotive opportunity emerge. What seemed impossible yesterday becomes tomorrow's foundation for extraordinary achievements in mobility.",
      align: "left",
      features: [
        { title: "Advanced Engineering", description: "Discover next-generation vehicle technology and innovation" },
        { title: "Seamless Integration", description: "Where cutting-edge automotive tech meets human intuition" },
        { title: "Future-Ready Solutions", description: "Built for tomorrow's roads and driving challenges" }
      ]
    },
    {
      id: "future",
      badge: "Future",
      title: "Our Shared",
      subtitle: "Tomorrow",
      description: "In this moment of unity, we see not just vehicles, but a canvas of infinite automotive potential. Every innovation represents progress, every achievement builds bridges to our collective future of endless mobility.",
      align: "center",
      actions: [
        { label: "Join the Revolution", variant: "primary", onClick: () => console.log("Join clicked") },
        { label: "Explore Fleet", variant: "secondary", onClick: () => console.log("Explore clicked") }
      ]
    }
  ];

  return (
    <ScrollCar 
      sections={demoSections}
      className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
    />
  );
}
