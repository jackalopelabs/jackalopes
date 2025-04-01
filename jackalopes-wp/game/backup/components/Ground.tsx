import React from 'react';
import { RigidBody } from '@react-three/rapier';

// A simple ground component with physics
export const Ground: React.FC = () => {
  return (
    <RigidBody type="fixed" position={[0, -0.5, 0]} friction={0.7}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#303030" />
      </mesh>
    </RigidBody>
  );
};

export default Ground; 