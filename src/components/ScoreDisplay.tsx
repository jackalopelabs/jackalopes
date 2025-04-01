import React, { useState, useEffect, useCallback, useRef } from 'react';

interface ScoreDisplayProps {
  jackalopesScore: number;
  mercsScore: number;
  className?: string;
  onReset?: () => void; // Add callback for when timer reaches zero
}

/**
 * ScoreDisplay component shows the current score for both teams
 */
export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  jackalopesScore = 0,
  mercsScore = 0,
  className = '',
  onReset,
}) => {
  // Add state to track score changes for animation
  const [lastJackalopesScore, setLastJackalopesScore] = useState(jackalopesScore);
  const [lastMercsScore, setLastMercsScore] = useState(mercsScore);
  const [jackalopesFlash, setJackalopesFlash] = useState(false);
  const [mercsFlash, setMercsFlash] = useState(false);
  
  // Add state for countdown timer (5 minutes = 300 seconds)
  const [timeRemaining, setTimeRemaining] = useState(() => {
    // Try to load existing timer from localStorage first
    try {
      const savedTime = localStorage.getItem('timer_remaining');
      const savedTimestamp = localStorage.getItem('timer_timestamp');
      
      if (savedTime && savedTimestamp) {
        const elapsedSeconds = Math.floor((Date.now() - parseInt(savedTimestamp, 10)) / 1000);
        const remainingTime = Math.max(0, parseInt(savedTime, 10) - elapsedSeconds);
        
        if (remainingTime > 0 && remainingTime <= 300) {
          console.log(`⏱️ Restored timer from localStorage: ${remainingTime}s remaining`);
          return remainingTime;
        }
      }
    } catch (err) {
      console.error('Error loading timer from localStorage:', err);
    }
    
    // Default to 5 minutes (300 seconds)
    return 300;
  });
  
  // Track last reset time to avoid duplicate resets
  const lastResetTime = useRef(0);
  
  // Maintain a ref to the latest score values to avoid closure issues
  const scoresRef = useRef({ jackalopesScore, mercsScore });
  
  // Track first mount to avoid unnecessary resets
  const isFirstMount = useRef(true);
  
  // Track if timer is currently active
  const timerActiveRef = useRef(true);
  
  // Update ref whenever scores change
  useEffect(() => {
    scoresRef.current = { jackalopesScore, mercsScore };
  }, [jackalopesScore, mercsScore]);
  
  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Save timer state to localStorage
  const saveTimerState = (time: number) => {
    try {
      localStorage.setItem('timer_remaining', time.toString());
      localStorage.setItem('timer_timestamp', Date.now().toString());
      
      // Also save whether a recent score happened
      const lastScoreTime = localStorage.getItem('last_score_time');
      if (lastScoreTime) {
        const timeSinceLastScore = Date.now() - parseInt(lastScoreTime, 10);
        localStorage.setItem('timer_should_reset_scores', (timeSinceLastScore > 5000).toString());
      } else {
        localStorage.setItem('timer_should_reset_scores', 'true');
      }
    } catch (err) {
      console.error('Error saving timer to localStorage:', err);
    }
  };
  
  // Create a memoized reset function that only resets when timer reaches zero
  const resetTimer = useCallback(() => {
    // Prevent multiple resets within 3 seconds
    const now = Date.now();
    if (now - lastResetTime.current < 3000) {
      console.log('⏱️ Ignoring duplicate timer reset - too soon after previous reset');
      return;
    }
    
    console.log('⏱️ Timer reset: setting to 5 minutes');
    setTimeRemaining(300); // Reset to 5 minutes
    saveTimerState(300);
    lastResetTime.current = now;
    
    // Check if there was a recent score update before resetting scores
    const lastScoreTime = localStorage.getItem('last_score_time');
    const shouldResetScores = !lastScoreTime || (Date.now() - parseInt(lastScoreTime, 10) > 5000);
    
    // Only call onReset if we actually need to reset the scores
    // This ensures we're not constantly resetting scores to zero
    if (onReset && shouldResetScores && (scoresRef.current.jackalopesScore > 0 || scoresRef.current.mercsScore > 0)) {
      console.log('⏱️ Calling onReset to reset scores');
      onReset();
    } else if (onReset && !shouldResetScores) {
      console.log('⏱️ Skipping score reset because a score was updated recently');
    }
  }, [onReset]);
  
  // Initialize timer when component mounts
  useEffect(() => {
    if (isFirstMount.current) {
      console.log('⏱️ ScoreDisplay mounted - initializing timer');
      isFirstMount.current = false;
      
      // Check if scores were just reset recently
      const resetTime = localStorage.getItem('scores_reset_time');
      const now = Date.now();
      
      if (resetTime && now - parseInt(resetTime, 10) < 3000) {
        console.log('⏱️ Scores were just reset recently, not resetting again');
      }
    }
    
    // Listen for timer sync events from other clients
    const handleTimerSync = (e: StorageEvent) => {
      if (e.key === 'timer_timestamp' && e.newValue) {
        console.log('⏱️ Received timer sync from another client');
        
        try {
          const savedTime = localStorage.getItem('timer_remaining');
          if (savedTime) {
            const elapsedSeconds = Math.floor((Date.now() - parseInt(e.newValue, 10)) / 1000);
            const remainingTime = Math.max(0, parseInt(savedTime, 10) - elapsedSeconds);
            
            if (remainingTime > 0 && remainingTime <= 300 && Math.abs(remainingTime - timeRemaining) > 5) {
              console.log(`⏱️ Syncing timer from localStorage: ${remainingTime}s remaining`);
              setTimeRemaining(remainingTime);
            }
          }
        } catch (err) {
          console.error('Error syncing timer from localStorage:', err);
        }
      }
    };
    
    window.addEventListener('storage', handleTimerSync);
    
    return () => {
      // Save timer state when component unmounts
      saveTimerState(timeRemaining);
      window.removeEventListener('storage', handleTimerSync);
    };
  }, [timeRemaining]);
  
  // Timer countdown effect
  useEffect(() => {
    // Create a custom event for broadcasting timer resets
    const broadcastTimerReset = () => {
      try {
        window.dispatchEvent(new CustomEvent('timer_reset', {
          detail: {
            timestamp: Date.now(),
            id: `timer-reset-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          }
        }));
      } catch (err) {
        console.error('Error broadcasting timer reset:', err);
      }
    };
    
    const timerInterval = setInterval(() => {
      setTimeRemaining(prev => {
        if (!timerActiveRef.current) {
          return prev; // Don't update if timer is paused
        }
        
        const newTime = prev - 1;
        // Save every 10 seconds
        if (newTime % 10 === 0 || newTime <= 10) {
          saveTimerState(newTime);
        }
        
        // Warn when approaching zero
        if (newTime === 10) {
          console.log('⏱️ Timer approaching zero - 10 seconds remaining');
        }
        
        if (newTime <= 0) {
          // Timer reached zero, reset scores
          console.log('⏱️ Timer reached zero, resetting');
          resetTimer();
          broadcastTimerReset(); // Broadcast reset event
          return 300;
        }
        return newTime;
      });
    }, 1000);
    
    // Listen for timer reset events from other sources
    const handleTimerResetEvent = (e: CustomEvent) => {
      console.log('⏱️ Received timer reset event:', e.detail);
      
      // Only process if it's been more than 3 seconds since our last reset
      const now = Date.now();
      if (now - lastResetTime.current > 3000) {
        resetTimer();
      } else {
        console.log('⏱️ Ignoring timer reset event - too soon after our reset');
      }
    };
    
    window.addEventListener('timer_reset', handleTimerResetEvent as EventListener);
    
    return () => {
      clearInterval(timerInterval);
      window.removeEventListener('timer_reset', handleTimerResetEvent as EventListener);
    };
  }, [resetTimer]);
  
  // Watch for score changes and trigger animation
  useEffect(() => {
    if (jackalopesScore > lastJackalopesScore) {
      setJackalopesFlash(true);
      setTimeout(() => setJackalopesFlash(false), 2000); // 2 second flash
      
      // Update last score time in localStorage
      localStorage.setItem('last_score_time', Date.now().toString());
    }
    setLastJackalopesScore(jackalopesScore);
  }, [jackalopesScore, lastJackalopesScore]);
  
  useEffect(() => {
    if (mercsScore > lastMercsScore) {
      setMercsFlash(true);
      setTimeout(() => setMercsFlash(false), 2000); // 2 second flash
      
      // Update last score time in localStorage
      localStorage.setItem('last_score_time', Date.now().toString());
    }
    setLastMercsScore(mercsScore);
  }, [mercsScore, lastMercsScore]);

  // Styles for the score display
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '30px',
    left: '30px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '10px',
    padding: '12px 18px',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    border: '1px solid rgba(255, 255, 255, 0.3)',
    color: 'white',
    fontFamily: 'monospace',
    userSelect: 'none',
    gap: '20px',
    transition: 'all 0.3s ease-in-out',
  };

  const scoreStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 'bold',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
    transition: 'all 0.3s ease',
  };

  const jackalopesStyle: React.CSSProperties = {
    ...scoreStyle,
    color: jackalopesFlash ? '#ffffff' : '#4682B4', // Blue for Jackalopes
    textShadow: jackalopesFlash ? '0 0 15px #4682B4, 0 0 10px #4682B4, 0 0 5px #4682B4' : '1px 1px 2px rgba(0, 0, 0, 0.8)',
    fontSize: jackalopesFlash ? '22px' : '18px',
  };

  const mercsStyle: React.CSSProperties = {
    ...scoreStyle,
    color: mercsFlash ? '#ffffff' : '#ff4500', // Red-orange for Mercs
    textShadow: mercsFlash ? '0 0 15px #ff4500, 0 0 10px #ff4500, 0 0 5px #ff4500' : '1px 1px 2px rgba(0, 0, 0, 0.8)',
    fontSize: mercsFlash ? '22px' : '18px',
  };
  
  // Style for timer
  const timerStyle: React.CSSProperties = {
    ...scoreStyle,
    color: timeRemaining <= 60 ? '#ff3333' : '#ffffff', // Red when less than a minute
    fontSize: timeRemaining <= 10 ? '20px' : '16px',
    transition: 'all 0.3s ease',
  };

  return (
    <div 
      style={containerStyle} 
      className={`score-display ${className}`}
    >
      <span 
        style={jackalopesStyle}
        className={jackalopesFlash ? 'score-flash' : ''}
      >
        Jackalopes: {jackalopesScore}
      </span>
      <span style={scoreStyle}>·</span>
      <span 
        style={mercsStyle}
        className={mercsFlash ? 'score-flash' : ''}
      >
        Mercs: {mercsScore}
      </span>
      <span style={scoreStyle}>·</span>
      <span 
        style={timerStyle}
        className={timeRemaining <= 10 ? 'timer-flash' : ''}
      >
        {formatTime(timeRemaining)}
      </span>
      
      {/* Add CSS animation */}
      <style>{`
        @keyframes scoreFlash {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        
        .score-flash {
          animation: scoreFlash 0.5s ease-in-out 3;
        }
        
        @keyframes timerFlash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .timer-flash {
          animation: timerFlash 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ScoreDisplay; 