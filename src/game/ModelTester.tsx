import React, { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { MercModel } from './MercModel'
import * as THREE from 'three'

// Import assets from centralized asset index
import { MercModelPath, AnimationNames } from '../assets'

/**
 * This is a test component to visualize the Mixamo model and test its animations.
 * Not used in the main game, but helpful for debugging.
 */
export const ModelTester = () => {
  const [animation, setAnimation] = useState('walk')
  const [availableAnimations, setAvailableAnimations] = useState<string[]>(['walk'])
  const [loading, setLoading] = useState(true)
  const [modelRotation, setModelRotation] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  // Load model to get animation names
  useEffect(() => {
    // Skip if we're in SSR
    if (typeof window === 'undefined') return
    
    setLoading(true)
    
    // First fetch the file to check its existence
    fetch(MercModelPath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Model file not found: ${response.status} ${response.statusText}`)
        }
        
        // Now load the model to check its animations
        // We wrap this in a try-catch since the type definitions are complex
        try {
          const gltf = useGLTF(MercModelPath)
          
          setLoading(false)
          if (gltf.animations && gltf.animations.length > 0) {
            const animNames = gltf.animations.map(animation => animation.name)
            setAvailableAnimations(animNames)
            console.log('Found animations in model:', animNames.join(', '))
            
            // Set the first animation as active if it exists
            if (animNames.length > 0 && animNames[0]) {
              setAnimation(animNames[0])
            }
          } else {
            console.warn('No animations found in the model file')
            setError('No animations found in model')
          }
        } catch (loadError) {
          console.error('Error loading model:', loadError)
          setError(`Error loading model: ${String(loadError)}`)
          setLoading(false)
        }
      })
      .catch(fetchError => {
        console.error('Error fetching model:', fetchError)
        setError(fetchError.message)
        setLoading(false)
      })
  }, [])
  
  // Periodically rotate the model to see all sides
  useEffect(() => {
    const interval = setInterval(() => {
      setModelRotation(prev => (prev + Math.PI/180) % (Math.PI * 2))
    }, 100)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%',
      backgroundColor: '#333'
    }}>
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        zIndex: 100,
        padding: '10px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: '5px',
        color: 'white',
        maxWidth: '400px'
      }}>
        <h2>Merc Model Tester</h2>
        <div style={{ marginBottom: '15px' }}>
          <p>Model: <code>{MercModelPath}</code></p>
          <p>Current Animation: <code>{animation}</code></p>
          <p>Status: {loading ? '⏳ Loading...' : error ? `❌ Error: ${error}` : '✅ Model Loaded'}</p>
          <p>Found {availableAnimations.length} animations</p>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <h3>Available Animations</h3>
          {availableAnimations.map(anim => (
            <button 
              key={anim}
              onClick={() => setAnimation(anim)}
              style={{
                margin: '5px',
                padding: '5px 10px',
                backgroundColor: animation === anim ? '#4CAF50' : '#ddd',
                color: animation === anim ? 'white' : 'black',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              {anim}
            </button>
          ))}
        </div>
        
        <div style={{ marginTop: '15px' }}>
          <p><small>Note: Use mouse to rotate view, scroll to zoom</small></p>
          <p><small>If you're seeing a red box or yellow cube, there was an error loading the model or animation.</small></p>
        </div>
      </div>
      
      <Canvas>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, 10, -5]} intensity={0.5} />
        <MercModel 
          animation={animation}
          rotation={[0, modelRotation, 0]} 
        />
        <gridHelper args={[10, 10]} />
        <OrbitControls />
      </Canvas>
    </div>
  )
}

export default ModelTester 