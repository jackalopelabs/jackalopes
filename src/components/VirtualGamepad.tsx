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

  // Initial touch position for calculations
  const startPositionRef = useRef({ x: 0, y: 0 });

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
        onMouseDown={handleJoystickStart}
      >
        <div className="joystick-knob" ref={joystickKnobRef}></div>
      </div>
      
      {/* Right side - Action buttons */}
      <div className="action-buttons">
        <button className="action-button jump" onTouchStart={onJump} onClick={onJump}>
          JUMP
        </button>
        <button className="action-button shoot" onTouchStart={onShoot} onClick={onShoot}>
          SHOOT
        </button>
      </div>
    </div>
  );
}; 