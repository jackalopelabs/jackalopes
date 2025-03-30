import React from 'react'

type HealthBarProps = {
  health: number
  maxHealth?: number
}

export function HealthBar({ health, maxHealth = 100 }: HealthBarProps) {
  // Calculate health percentage
  const healthPercentage = Math.max(0, Math.min(100, (health / maxHealth) * 100))
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '30px',
      left: '30px',
      width: '200px',
      height: '8px',
      background: 'rgba(0, 0, 0, 0.5)',
      borderRadius: '4px',
      overflow: 'hidden',
      zIndex: 1000,
      pointerEvents: 'none'
    }}>
      <div style={{
        height: '100%',
        width: `${healthPercentage}%`,
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '4px',
        transition: 'width 0.3s ease-out'
      }} />
      
      {/* Health number display */}
      <div style={{
        position: 'absolute',
        top: '-20px',
        left: '0',
        color: 'white',
        fontSize: '14px',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
      }}>
        {Math.round(health)}/{maxHealth}
      </div>
    </div>
  )
} 