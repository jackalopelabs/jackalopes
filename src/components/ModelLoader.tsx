import React, { useEffect } from 'react';

// Simple placeholder component that does nothing
export const ModelLoader = () => {
  useEffect(() => {
    console.log('Using direct THREE.js geometry for character models - no external models to load');
  }, []);
  
  // This is an invisible component
  return null;
} 