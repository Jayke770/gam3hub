"use client";

import * as THREE from "three";
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";

interface StarProps {
  count?: number;
  color?: string;
}

type StarData = {
  position: THREE.Vector3;
  speed: number;
  length: number;
  opacity: number;
  drift: number;
};

export function FallingStars({ count = 100, color = "#A78BFA" }: StarProps) {
  const meshRef = useRef<THREE.Group>(null);
  
  // Use state with a lazy initializer for initial random values
  const [stars] = useState<StarData[]>(() => 
    Array.from({ length: count }, () => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 35,
        Math.random() * 25 - 10,
        (Math.random() - 0.5) * 15 - 10
      ),
      speed: Math.random() * 0.05 + 0.02,
      length: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.8 + 0.2,
      drift: (Math.random() - 0.5) * 0.01,
    }))
  );

  useFrame(() => {
    if (!meshRef.current || stars.length === 0) return;

    meshRef.current.children.forEach((child, i) => {
      const star = stars[i];
      if (!star) return;

      // Update position
      child.position.y -= star.speed;
      child.position.x += star.drift;

      // Reset when off screen (looping)
      if (child.position.y < -15) {
        child.position.y = 15;
        child.position.x = (Math.random() - 0.5) * 35;
      }
    });
  });

  return (
    <group ref={meshRef}>
      {stars.map((star: StarData, i: number) => (
        <mesh key={i} position={star.position} rotation={[0, 0, 0]}>
          <circleGeometry args={[0.06, 8]} />
          <meshBasicMaterial
            transparent
            opacity={star.opacity}
            color={color}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
