import React, { useState, useEffect } from 'react';

interface ScoreDisplayProps {
  jackalopesScore: number;
  mercsScore: number;
  className?: string;
}

/**
 * ScoreDisplay component shows the current score for both teams
 */
export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  jackalopesScore = 0,
  mercsScore = 0,
  className = '',
}) => {
  // Add state to track score changes for animation
  const [lastJackalopesScore, setLastJackalopesScore] = useState(jackalopesScore);
  const [lastMercsScore, setLastMercsScore] = useState(mercsScore);
  const [jackalopesFlash, setJackalopesFlash] = useState(false);
  const [mercsFlash, setMercsFlash] = useState(false);
  
  // Watch for score changes and trigger animation
  useEffect(() => {
    if (jackalopesScore > lastJackalopesScore) {
      setJackalopesFlash(true);
      setTimeout(() => setJackalopesFlash(false), 2000); // 2 second flash
    }
    setLastJackalopesScore(jackalopesScore);
  }, [jackalopesScore, lastJackalopesScore]);
  
  useEffect(() => {
    if (mercsScore > lastMercsScore) {
      setMercsFlash(true);
      setTimeout(() => setMercsFlash(false), 2000); // 2 second flash
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
      
      {/* Add CSS animation */}
      <style>{`
        @keyframes scoreFlash {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        
        .score-flash {
          animation: scoreFlash 0.5s ease-in-out 3;
        }
      `}</style>
    </div>
  );
};

export default ScoreDisplay; 