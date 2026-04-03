"use client";

import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Stars } from "@react-three/drei";

interface ObjectData {
  position: [number, number, number];
  speed: number;
  rotationSpeed: [number, number, number];
  type: "star" | "bomb";
  scale: number;
}

export function Mines3DBackground() {
  const objects = useMemo(() => {
    return Array.from({ length: 40 }, () => ({
      position: [
        (Math.random() - 0.5) * 40,
        Math.random() * 40 - 20,
        (Math.random() - 0.5) * 20 - 10,
      ] as [number, number, number],
      speed: Math.random() * 0.02 + 0.01,
      rotationSpeed: [
        Math.random() * 0.01,
        Math.random() * 0.01,
        Math.random() * 0.01,
      ] as [number, number, number],
      type: Math.random() > 0.5 ? "star" as const : "bomb" as const,
      scale: Math.random() * 0.5 + 0.5,
    }));
  }, []);

  return (
    <>
      <color attach="background" args={["#020617"]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      {objects.map((obj, i) => (
        <FloatingObject key={i} data={obj} />
      ))}
    </>
  );
}

function FloatingObject({ data }: { data: ObjectData }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.position.y -= data.speed;
    ref.current.rotation.x += data.rotationSpeed[0];
    ref.current.rotation.y += data.rotationSpeed[1];
    ref.current.rotation.z += data.rotationSpeed[2];

    if (ref.current.position.y < -20) {
      ref.current.position.y = 20;
      ref.current.position.x = (Math.random() - 0.5) * 40;
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <group ref={ref} position={data.position} scale={data.scale}>
        {data.type === "star" ? (
          <StarMesh />
        ) : (
          <BombMesh />
        )}
      </group>
    </Float>
  );
}

function StarMesh() {
  return (
    <mesh>
      <octahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial
        color="#fbbf24"
        emissive="#f59e0b"
        emissiveIntensity={1}
        metalness={0.8}
        roughness={0.2}
      />
    </mesh>
  );
}

function BombMesh() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Fuse */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.2]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      {/* Spark */}
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}
