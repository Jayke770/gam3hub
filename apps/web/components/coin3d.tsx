"use client";

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

interface Coin3DProps {
  isFlipping: boolean;
  targetFace: "Heads" | "Tails" | null;
  onLanded: () => void;
  colors: {
    primary: string;
    primaryFg: string;
    secondary: string;
    secondaryFg: string;
  };
}

export function Coin3D({ isFlipping, targetFace, onLanded }: Coin3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Animation state
  const rotationX = useRef(0);
  const startRot = useRef(0);
  const targetRot = useRef(0);
  const flipStartTime = useRef(0);
  const dur = 2200;

  // Physical Gold Materials mimicking a real minted coin
  const materials = useMemo(() => {
    return {
      // Rougher inner face
      body: new THREE.MeshStandardMaterial({
        color: "#d4af37",
        metalness: 0.8,
        roughness: 0.35
      }),
      // Highly polished outer rim and text embossing
      polished: new THREE.MeshStandardMaterial({
        color: "#fde047",
        metalness: 1.0,
        roughness: 0.1
      }),
      // Slightly oxidized edge/base
      base: new THREE.MeshStandardMaterial({
        color: "#b48c22",
        metalness: 0.9,
        roughness: 0.5
      })
    };
  }, []);

  // Ornamental border stars (24 dots around the rim)
  const stars = useMemo(() => {
    const arr: [number, number][] = [];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      arr.push([Math.cos(angle) * 1.65, Math.sin(angle) * 1.65]);
    }
    return arr;
  }, []);

  // React to flip triggers
  useEffect(() => {
    if (isFlipping && targetFace) {
      startRot.current = rotationX.current;
      const base = Math.ceil(rotationX.current / (Math.PI * 2)) * (Math.PI * 2);
      const spins = 5 * Math.PI * 2;
      targetRot.current = base + spins + (targetFace === "Tails" ? Math.PI : 0);
      flipStartTime.current = performance.now();
    }
  }, [isFlipping, targetFace]);

  useFrame(() => {
    if (!groupRef.current) return;

    if (isFlipping) {
      const now = performance.now();
      let progress = (now - flipStartTime.current) / dur;
      if (progress > 1) progress = 1;

      // Cubic ease out rotation
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      rotationX.current = startRot.current + (targetRot.current - startRot.current) * easeProgress;
      groupRef.current.rotation.x = rotationX.current;

      // Parabolic Jump Arc with High-Fidelity Bounce
      const mainFlipProgress = Math.min(progress / 0.85, 1);
      const jumpHeight = 1.4;
      
      let y = 0;
      if (progress < 0.85) {
        // Initial high-velocity flip arc
        y = Math.sin(mainFlipProgress * Math.PI) * jumpHeight;
      } else {
        // Landing bounce logic
        const bounceP = (progress - 0.85) / 0.15;
        // Two diminishing bounces
        y = Math.abs(Math.sin(bounceP * Math.PI * 2.5)) * 0.12 * (1 - bounceP);
        
        // Add a slight landing wobble (tilt)
        const wobble = Math.sin(bounceP * Math.PI * 4) * 0.1 * (1 - bounceP);
        groupRef.current.rotation.z = wobble;
        groupRef.current.rotation.y = wobble * 0.5;
      }
      
      groupRef.current.position.y = y;

      if (progress === 1) {
        onLanded();
      }
    } else {
      // Keep rotation locked after landing but reset wobble gradually
      groupRef.current.rotation.x = rotationX.current;
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.1);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, 0.1);
    }
  });


  return (
    <group ref={groupRef}>
      {/* Root transform to angle the coin perfectly */}
      <group rotation={[Math.PI / 2, 0, 0]} scale={0.45}>

        {/* Core Coin Wedge / Edge Ribbing Area */}
        <mesh castShadow receiveShadow geometry={new THREE.CylinderGeometry(1.95, 1.95, 0.38, 64)}>
          <primitive object={materials.base} attach="material" />
        </mesh>

        {/* --- FRONT BASE (HEADS) --- */}
        <mesh receiveShadow position={[0, 0.191, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.9, 64]} />
          <primitive object={materials.body} attach="material" />
        </mesh>

        {/* Front Raised Outer Rim */}
        <mesh castShadow receiveShadow position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.85, 0.12, 16, 64]} />
          <primitive object={materials.polished} attach="material" />
        </mesh>

        {/* Front Engraved Details */}
        <group position={[0, 0.2, 0]}>
          {stars.map((pos, i) => (
            <mesh key={`top-star-${i}`} position={[pos[0], 0, pos[1]]} castShadow>
              <sphereGeometry args={[0.07, 12, 12]} />
              <primitive object={materials.polished} attach="material" />
            </mesh>
          ))}

          {/* Central Logo - Dollar Sign (Heads) */}
          <Text
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, -0.1]}
            fontSize={1.8}
            fontWeight="black"
            anchorX="center"
            anchorY="middle"
            material={materials.polished}
            castShadow
          >
            $
          </Text>
          <Text
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 1.0]}
            fontSize={0.3}
            letterSpacing={0.3}
            fontWeight="black"
            material={materials.polished}
            castShadow
          >
            HEADS
          </Text>
        </group>

        {/* --- BACK BASE (TAILS) --- */}
        <mesh receiveShadow position={[0, -0.191, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.9, 64]} />
          <primitive object={materials.body} attach="material" />
        </mesh>

        {/* Back Raised Outer Rim */}
        <mesh castShadow receiveShadow position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.85, 0.12, 16, 64]} />
          <primitive object={materials.polished} attach="material" />
        </mesh>

        {/* Back Engraved Details */}
        <group position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]}>
          {stars.map((pos, i) => (
            <mesh key={`bot-star-${i}`} position={[pos[0], 0, pos[1]]} castShadow>
              <sphereGeometry args={[0.07, 12, 12]} />
              <primitive object={materials.polished} attach="material" />
            </mesh>
          ))}

          {/* Central Logo - Tails Symbol */}
          <Text
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, -0.1]}
            fontSize={1.7}
            fontWeight="black"
            anchorX="center"
            anchorY="middle"
            material={materials.polished}
            castShadow
          >
            T
          </Text>

          <Text
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 1.0]}
            fontSize={0.3}
            letterSpacing={0.3}
            fontWeight="black"
            material={materials.polished}
            castShadow
          >
            TAILS
          </Text>
        </group>

      </group>
    </group>
  );
}
