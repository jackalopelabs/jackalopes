import React from 'react';

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
  // Styles for the score display
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '30px',
    left: '30px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '8px',
    padding: '10px 15px',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: 'white',
    fontFamily: 'monospace',
    userSelect: 'none',
    gap: '15px',
  };

  const scoreStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 'bold',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
  };

  const jackalopesStyle: React.CSSProperties = {
    ...scoreStyle,
    color: '#4682B4', // Blue for Jackalopes
  };

  const mercsStyle: React.CSSProperties = {
    ...scoreStyle,
    color: '#ff4500', // Red-orange for Mercs
  };

  return (
    <div style={containerStyle} className={`score-display ${className}`}>
      <span style={jackalopesStyle}>Jackalopes: {jackalopesScore}</span>
      <span style={scoreStyle}>·</span>
      <span style={mercsStyle}>Mercs: {mercsScore}</span>
    </div>
  );
};

export default ScoreDisplay; 