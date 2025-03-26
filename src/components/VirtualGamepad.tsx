import React, { useEffect, useRef, useState } from 'react';
import './VirtualGamepad.css';

interface JoystickState {
  active: boolean;
  position: { x: number; y: number };
  direction: { x: number; y: number };
}

interface VirtualGamepadProps {
  onMove: (x: number, y: number) => void;
  onJump: () => void;
  onShoot: () => void;
  visible: boolean;
}

// SVG Icons as components
const JumpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="gamepad-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
  </svg>
);

const FireIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="gamepad-icon">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
  </svg>
);

export const VirtualGamepad: React.FC<VirtualGamepadProps> = ({ 
  onMove, onJump, onShoot, visible 
}) => {
  const [joystick, setJoystick] = useState<JoystickState>({
    active: false,
    position: { x: 0, y: 0 },
    direction: { x: 0, y: 0 }
  });

  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track whether we're in a simulator
  const [isSimulator, setIsSimulator] = useState(false);
  
  // Track button states to prevent continuous firing
  const jumpButtonActive = useRef(false);
  const shootButtonActive = useRef(false);

  // Initial touch position for calculations
  const startPositionRef = useRef({ x: 0, y: 0 });

  // Detect iOS simulator on component mount
  useEffect(() => {
    // Check for simulator - this isn't perfect but can help
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSSimulator = (
      userAgent.includes('mac') && 
      userAgent.includes('safari') && 
      window.navigator.maxTouchPoints > 0
    );
    setIsSimulator(isIOSSimulator);
  }, []);

  // Handle joystick touch start
  const handleJoystickStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    
    // Get touch/click position
    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
    const pageY = 'touches' in e ? e.touches[0].pageY : e.pageY;
    
    if (joystickRef.current && containerRef.current) {
      const rect = joystickRef.current.getBoundingClientRect();
      
      // Center point of the joystick
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      startPositionRef.current = { x: centerX, y: centerY };
      
      setJoystick({
        ...joystick,
        active: true,
        position: { x: centerX, y: centerY }
      });
    }
  };

  // Handle joystick movement
  const handleJoystickMove = (e: TouchEvent | MouseEvent) => {
    if (!joystick.active) return;
    
    // Get touch/click position
    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
    const pageY = 'touches' in e ? e.touches[0].pageY : e.pageY;
    
    if (joystickRef.current && joystickKnobRef.current) {
      const joystickRect = joystickRef.current.getBoundingClientRect();
      const maxDistance = joystickRect.width / 2;
      
      // Calculate distance from center
      const deltaX = pageX - startPositionRef.current.x;
      const deltaY = pageY - startPositionRef.current.y;
      
      // Calculate angle and distance
      const angle = Math.atan2(deltaY, deltaX);
      const distance = Math.min(maxDistance, Math.hypot(deltaX, deltaY));
      
      // Calculate normalized direction
      const directionX = Math.cos(angle) * (distance / maxDistance);
      const directionY = Math.sin(angle) * (distance / maxDistance);
      
      // Update joystick knob position
      const knobX = Math.cos(angle) * distance;
      const knobY = Math.sin(angle) * distance;
      
      joystickKnobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`;
      
      // Update state
      setJoystick({
        ...joystick,
        direction: { x: directionX, y: directionY }
      });
      
      // Send movement values to parent
      onMove(directionX, directionY);
    }
  };

  // Handle joystick release
  const handleJoystickEnd = () => {
    if (!joystick.active) return;
    
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = 'translate(0px, 0px)';
    }
    
    setJoystick({
      active: false,
      position: { x: 0, y: 0 },
      direction: { x: 0, y: 0 }
    });
    
    // Send zero movement to parent
    onMove(0, 0);
  };
  
  // Handle jump button press
  const handleJumpStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event propagation
    
    if (!jumpButtonActive.current) {
      jumpButtonActive.current = true;
      
      // Add some visual feedback
      const target = e.currentTarget as HTMLElement;
      target.classList.add('active');
      
      // Call the jump callback
      console.log("Jump button pressed - triggering jump callback");
      onJump();
      
      // Reset state after delay
      setTimeout(() => {
        jumpButtonActive.current = false;
        if (target) {
          target.classList.remove('active');
        }
      }, 300);
    }
  };
  
  // Handle shoot button press
  const handleShootStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event propagation
    
    if (!shootButtonActive.current) {
      shootButtonActive.current = true;
      
      // Add some visual feedback
      const target = e.currentTarget as HTMLElement;
      target.classList.add('active');
      
      // Call the shoot callback
      console.log("Shoot button pressed - triggering shoot callback");
      onShoot();
      
      // Reset state after delay
      setTimeout(() => {
        shootButtonActive.current = false;
        if (target) {
          target.classList.remove('active');
        }
      }, 300);
    }
  };

  // Setup event listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleJoystickMove(e);
    const handleTouchMove = (e: TouchEvent) => handleJoystickMove(e);
    const handleEnd = () => handleJoystickEnd();
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [joystick.active]);

  if (!visible) return null;

  return (
    <div className="virtual-gamepad" ref={containerRef}>
      {/* Left side - Joystick */}
      <div 
        className="joystick" 
        ref={joystickRef}
        onTouchStart={handleJoystickStart}
        onMouseDown={isSimulator ? undefined : handleJoystickStart}
      >
        <div className="joystick-knob" ref={joystickKnobRef}></div>
      </div>
      
      {/* Right side - Action buttons */}
      <div className="action-buttons">
        <button 
          className="action-button jump" 
          onTouchStart={handleJumpStart} 
          onMouseDown={isSimulator ? undefined : handleJumpStart}
          aria-label="Jump"
        >
          <JumpIcon />
        </button>
        <button 
          className="action-button shoot" 
          onTouchStart={handleShootStart} 
          onMouseDown={isSimulator ? undefined : handleShootStart}
          aria-label="Shoot"
        >
          <FireIcon />
        </button>
      </div>
    </div>
  );
}; 