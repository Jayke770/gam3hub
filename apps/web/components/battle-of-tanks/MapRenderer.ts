import * as THREE from "three";

// Same level data as server
const LEVEL: [number, number, number, number, number?][] = [
  [13.5, 2, 1, 4], [13.5, 12, 1, 2], [12.5, 13.5, 3, 1], [2, 13.5, 4, 1],
  [11.5, 15, 1, 2], [11.5, 23.5, 1, 5],
  [10, 26.5, 4, 1], [6, 26.5, 4, 1],
  [2, 34.5, 4, 1], [12.5, 34.5, 3, 1], [13.5, 36, 1, 2], [15, 36.5, 2, 1],
  [13.5, 46, 1, 4],
  [23.5, 36.5, 5, 1], [26.5, 38, 1, 4], [26.5, 42, 1, 4],
  [34.5, 46, 1, 4], [34.5, 36, 1, 2], [35.5, 34.5, 3, 1], [36.5, 33, 1, 2],
  [46, 34.5, 4, 1],
  [36.5, 24.5, 1, 5], [38, 21.5, 4, 1], [42, 21.5, 4, 1],
  [46, 13.5, 4, 1], [35.5, 13.5, 3, 1], [34.5, 12, 1, 2], [33, 11.5, 2, 1],
  [34.5, 2, 1, 4],
  [24.5, 11.5, 5, 1], [21.5, 10, 1, 4], [21.5, 6, 1, 4],
  // center
  [18.5, 22, 1, 6], [19, 18.5, 2, 1], [26, 18.5, 6, 1], [29.5, 19, 1, 2],
  [29.5, 26, 1, 6], [29, 29.5, 2, 1], [22, 29.5, 6, 1], [18.5, 29, 1, 2],
  // ── Animated obstacles (expanded area 80x80) ──
  [12, 12, 5, 5, 0], // NW Corner
  [68, 12, 5, 5, 0], // NE Corner
  [12, 68, 5, 5, 0], // SW Corner
  [68, 68, 5, 5, 0], // SE Corner
  [40, 6, 15, 1.8, 2], // North Piston
  [40, 74, 15, 1.8, 2], // South Piston
  [6, 40, 1.8, 15, 3], // West Piston
  [74, 40, 1.8, 15, 3], // East Piston
];

export class MapRenderer {
  group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.buildGround();
    this.buildBlocks();
    this.buildBoundary();
    scene.add(this.group);
  }

  private buildGround() {
    // Floor: white-to-blue gradient via vertex colors
    const segments = 40;
    const geo = new THREE.PlaneGeometry(80, 80, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const colors = new Float32Array(geo.attributes.position!.count * 3);
    const posAttr = geo.attributes.position!;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);

      // Hill logic: A gentle rise in the center
      const dx = x; // Local coordinates are -40 to 40
      const dz = z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const hillHeight = Math.max(0, 4 * Math.exp(-dist * dist / 500));
      posAttr.setY(i, hillHeight);

      // t=0 at north edge (z=-40), t=1 at south edge (z=40)
      const normalizedT = (z + 40) / 80;
      // White (0.92, 0.94, 0.96) to soft blue (0.2, 0.35, 0.6)
      colors[i * 3] = 0.92 - normalizedT * 0.72;
      colors[i * 3 + 1] = 0.94 - normalizedT * 0.59;
      colors[i * 3 + 2] = 0.96 - normalizedT * 0.36;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Load Grass PNG Texture
    const texLoader = new THREE.TextureLoader();
    const grassTex = texLoader.load("/battle-of-tanks/grass.png");
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(6, 6); // Repeat for detail
    grassTex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 1.0,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.position.set(40, -0.01, 40);
    ground.receiveShadow = true;
    this.group.add(ground);

    // Subtle dark border around the play area instead of a grid
    const borderGeo = new THREE.PlaneGeometry(80.5, 80.5);
    const borderMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.set(40, -0.02, 40);
    this.group.add(border);
  }

  private blockMeshes: THREE.Mesh[] = [];

  private buildBlocks() {
    const blockMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Slate 700
      roughness: 0.7,
      metalness: 0.2,
    });

    for (const [bx, by, bw, bh] of LEVEL) {
      const geo = new THREE.BoxGeometry(bw, 1.2, bh);

      // Solid block
      const mesh = new THREE.Mesh(geo, blockMat);
      // Sink slightly into the ground to avoid "floating" feel
      mesh.position.set(bx, 0.5, by);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.blockMeshes.push(mesh);
    }
  }

  getGroundHeight(x: number, z: number): number {
    const dx = x - 40;
    const dz = z - 40;
    const dist = Math.sqrt(dx * dx + dz * dz);
    return Math.max(0, 4 * Math.exp(-(dist * dist) / 500));
  }

  update() {
    const t = Date.now();
    for (let i = 0; i < LEVEL.length; i++) {
      const data = LEVEL[i];
      const type = data[4] || 0;
      const mesh = this.blockMeshes[i];
      if (!mesh) continue;

      if (type === 2) {
        mesh.position.x = data[0] + Math.sin(t * 0.002) * 5;
      } else if (type === 3) {
        mesh.position.z = data[1] + Math.sin(t * 0.002) * 5;
      }

      // Sync obstacle height to terrain
      mesh.position.y = 0.5 + this.getGroundHeight(mesh.position.x, mesh.position.z);
    }
  }

  private buildBoundary() {
    const thickness = 1.5;
    const height = 2.0;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Slate 800 for boundary walls
      roughness: 0.8,
      metalness: 0.1,
    });

    const walls: [number, number, number, number, number][] = [
      // [posX, posZ, sizeX, sizeZ] — North, South, East, West
      [40, -thickness / 2, 80 + thickness * 2, thickness, height],
      [40, 80 + thickness / 2, 80 + thickness * 2, thickness, height],
      [-thickness / 2, 40, thickness, 80 + thickness * 2, height],
      [80 + thickness / 2, 40, thickness, 80 + thickness * 2, height],
    ];

    for (const [x, z, sx, sz, h] of walls) {
      const geo = new THREE.BoxGeometry(sx, h, sz);

      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, h / 2, z);
      mesh.castShadow = true;
      this.group.add(mesh);
    }
  }
}
