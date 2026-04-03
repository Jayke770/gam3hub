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
  const rotationY = useRef(0.4); 
  const startRot = useRef(0);
  const targetRot = useRef(0);
  const dur = 1500; 

  const materials = useMemo(() => {
    return {
      body: new THREE.MeshStandardMaterial({
        color: "#d4af37",
        metalness: 0.8,
        roughness: 0.4
      }),
      polished: new THREE.MeshStandardMaterial({
        color: "#ffd700", // Vibrant Bright Gold
        metalness: 1.0,
        roughness: 0.05,
        emissive: "#ffb800", // Orange-Gold emissive
        emissiveIntensity: 0.4 // Stronger internal glow for visibility
      }),
      base: new THREE.MeshStandardMaterial({
        color: "#b48c22",
        metalness: 0.9,
        roughness: 0.5
      })
    };
  }, []);

  const stars = useMemo(() => {
    const arr: [number, number][] = [];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      arr.push([Math.cos(angle) * 1.65, Math.sin(angle) * 1.65]);
    }
    return arr;
  }, []);

  const landingStartTime = useRef(0);
  const wasWaiting = useRef(false);

  useEffect(() => {
    if (isFlipping && !targetFace) {
      wasWaiting.current = true;
    }

    if (isFlipping && targetFace && wasWaiting.current) {
      startRot.current = rotationX.current;
      const base = Math.ceil(rotationX.current / (Math.PI * 2)) * (Math.PI * 2);
      const extraSpins = 4 * Math.PI * 2;
      targetRot.current = base + extraSpins + (targetFace === "Tails" ? Math.PI : 0);
      landingStartTime.current = performance.now();
      wasWaiting.current = false;
    } else if (isFlipping && targetFace && !wasWaiting.current && landingStartTime.current === 0) {
      startRot.current = rotationX.current;
      const base = Math.ceil(rotationX.current / (Math.PI * 2)) * (Math.PI * 2);
      targetRot.current = base + 5 * Math.PI * 2 + (targetFace === "Tails" ? Math.PI : 0);
      landingStartTime.current = performance.now();
    }

    if (!isFlipping) {
      landingStartTime.current = 0;
      wasWaiting.current = false;
    }
  }, [isFlipping, targetFace]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (isFlipping) {
      const now = performance.now();
      if (!targetFace) {
        rotationX.current += delta * 12;
        rotationY.current = THREE.MathUtils.lerp(rotationY.current, 0.4, 0.1);
        groupRef.current.rotation.set(rotationX.current, rotationY.current, 0);
        groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0.8, 0.1);
      } else {
        if (landingStartTime.current === 0) return;
        let progress = (now - landingStartTime.current) / dur;
        if (progress > 1) progress = 1;
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        rotationX.current = startRot.current + (targetRot.current - startRot.current) * easeProgress;
        rotationY.current = THREE.MathUtils.lerp(rotationY.current, 0.4, 0.05);
        groupRef.current.rotation.set(rotationX.current, rotationY.current, 0);
        groupRef.current.position.y = 0.8 * (1 - easeProgress);
        if (progress === 1) onLanded();
      }
    } else {
      rotationY.current += delta * 0.4;
      groupRef.current.rotation.set(rotationX.current, rotationY.current, 0);
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, 0.1);
    }
  });

  return (
    <group ref={groupRef}>
      <group rotation={[Math.PI / 2, 0, 0]} scale={0.55}>

        {/* Rim Edge Mesh - Slightly shrunk Y to prevent Z-fighting with faces */}
        <mesh castShadow receiveShadow geometry={new THREE.CylinderGeometry(1.95, 1.95, 0.48, 64)}>
          <primitive object={materials.base} attach="material" />
        </mesh>

        {/* --- FRONT SIDE (HEADS - $) --- */}
        <group position={[0, 0.25, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[1.9, 64]} />
            <primitive object={materials.body} attach="material" />
          </mesh>

          {/* Central Logo '$' */}
          <Text
            position={[0, 0.12, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={1.6}
            fontWeight={900}
            anchorX="center"
            anchorY="middle"
            material={materials.polished}
          >
            $
          </Text>

          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.85, 0.08, 16, 64]} />
            <primitive object={materials.polished} attach="material" />
          </mesh>

          {stars.map((pos, i) => (
            <mesh key={`top-star-${i}`} position={[pos[0], 0, pos[1]]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <primitive object={materials.polished} attach="material" />
            </mesh>
          ))}
        </group>

        {/* --- BACK SIDE (TAILS - 0) --- */}
        <group position={[0, -0.25, 0]} rotation={[Math.PI, 0, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[1.9, 64]} />
            <primitive object={materials.body} attach="material" />
          </mesh>

          {/* Central Logo '0' */}
          <Text
            position={[0, 0.12, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={1.5}
            fontWeight={900}
            anchorX="center"
            anchorY="middle"
            material={materials.polished}
          >
            0
          </Text>

          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.85, 0.08, 16, 64]} />
            <primitive object={materials.polished} attach="material" />
          </mesh>

          {stars.map((pos, i) => (
            <mesh key={`bot-star-${i}`} position={[pos[0], 0, pos[1]]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <primitive object={materials.polished} attach="material" />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
