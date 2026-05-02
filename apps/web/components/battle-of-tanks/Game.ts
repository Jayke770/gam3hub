import * as THREE from "three";
import { Callbacks, Room } from "@colyseus/sdk";
import { Network } from "./Network";
import { TankEntity, preloadTankModel } from "./Tank";
import { MapRenderer } from "./MapRenderer";
import { Sound } from "./Sound";
import type { BattleState } from "./schema/BattleState";

const TEAM_COLORS = [0xff4444, 0x4488ff, 0x44ff44, 0xffff44];
const TEAM_NAMES = ["Red", "Blue", "Green", "Yellow"];

export class Game {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;

  network: Network;
  sound: Sound;
  map!: MapRenderer;
  room!: Room<BattleState>;

  tanks = new Map<string, TankEntity>();
  bulletMeshes = new Map<string, THREE.Mesh>();
  pickableMeshes = new Map<string, THREE.Group>();

  mySessionId = "";
  keys = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  mouseDown = false;

  lastSentDirX = -999;
  lastSentDirY = -999;
  lastSentAngle = -999;
  lastTargetSendTime = 0;

  // Joystick state
  joystickRawX = 0;
  joystickRawY = 0;
  joystickAimRawX = 0;
  joystickAimRawY = 0;
  isJoystickAiming = false;
  leftJoystickManager: any = null;
  rightJoystickManager: any = null;

  raycaster = new THREE.Raycaster();
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // HUD elements
  healthFill!: HTMLElement;
  shieldFill!: HTMLElement;
  scoresList!: HTMLElement;
  scoreElements = new Map<number, HTMLElement>();
  deathScreen!: HTMLElement;
  winnerScreen!: HTMLElement;
  ammoDisplay!: HTMLElement;
  connectStatus!: HTMLElement;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1b2a);
    this.scene.fog = new THREE.Fog(0x0d1b2a, 35, 65);

    // Orthographic camera
    const frustumSize = 22;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      200
    );
    // 45° isometric view
    this.camera.position.set(24 + 20, 20, 24 + 20);
    this.camera.lookAt(24, 0, 24);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const container = document.getElementById("game-container");
    if (container) {
      container.appendChild(this.renderer.domElement);
    } else {
      document.body.prepend(this.renderer.domElement);
    }

    // Lighting
    const ambient = new THREE.AmbientLight(0x8888aa, 0.7);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
    sun.position.set(30, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    this.scene.add(sun);

    // Map
    this.map = new MapRenderer(this.scene);

    // Sound
    this.sound = new Sound();

    // Network — allow overriding via ?server=wss://example.com
    const params = new URLSearchParams(window.location.search);
    const serverUrl = params.get("server")
      || process.env.NEXT_PUBLIC_GAME_SERVER_URL
      || `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:2567`;
    console.log("fassfas", serverUrl)
    this.network = new Network(serverUrl);

    // HUD refs
    this.healthFill = document.getElementById("health-fill")!;
    this.shieldFill = document.getElementById("shield-fill")!;
    this.scoresList = document.getElementById("scores-list")!;
    this.deathScreen = document.getElementById("death-screen")!;
    this.winnerScreen = document.getElementById("winner-screen")!;
    this.ammoDisplay = document.getElementById("ammo-display")!;
    this.connectStatus = document.getElementById("connect-status")!;

    // Input
    this.setupInput();

    // Resize
    window.addEventListener("resize", () => this.onResize());
  }

  async start() {
    await preloadTankModel();

    try {
      this.room = await this.network.connect();
      this.mySessionId = this.room.sessionId;
      this.connectStatus.style.display = "none";
      this.bindRoomEvents();
    } catch (e) {
      this.connectStatus.textContent = "Failed to connect. Is server running?";
      console.error(e);
      return;
    }

    this.animate();
  }

  private bindRoomEvents() {
    const state = this.room.state;

    const callbacks = Callbacks.get(this.room);

    // ── Tanks ──
    callbacks.onAdd("tanks", (tank, key: string) => {
      const entity = new TankEntity(tank.team);
      entity.targetX = tank.x;
      entity.targetZ = tank.y;
      entity.group.position.set(tank.x, 0, tank.y);
      entity.dead = tank.dead;
      entity.setHealth(tank.hp);
      this.scene.add(entity.group);
      this.tanks.set(key, entity);


      callbacks.listen(tank, "x", (val: number) => (entity.targetX = val));
      callbacks.listen(tank, "y", (val: number) => (entity.targetZ = val));
      callbacks.listen(tank, "angle", (val: number) => {
        // Skip server angle for the current player — the client already sets
        // its own turret angle from mouse input, and applying the delayed
        // server value causes visual glitches.
        if (key !== this.mySessionId) {
          entity.targetAngle = val;
        }
      });
      callbacks.listen(tank, "dead", (val: boolean, prev: boolean) => {
        entity.setDead(val);
        if (val && prev === false) {
          this.sound.explosion();
        }
        if (key === this.mySessionId) {
          if (val && prev === false) {
            this.deathScreen.style.display = "block";
          } else if (!val) {
            this.deathScreen.style.display = "none";
          }
        }
      });
      callbacks.listen(tank, "hp", (val: number, prev: number) => {
        entity.setHealth(val);
        if (val < prev) {
          // Volume based on distance from local player
          const myTank = this.tanks.get(this.mySessionId);
          if (myTank) {
            const dx = entity.group.position.x - myTank.group.position.x;
            const dz = entity.group.position.z - myTank.group.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const vol = Math.max(0, 0.25 * (1 - dist / 25));
            if (vol > 0.01) this.sound.hit(vol);
          }
        }
        if (key === this.mySessionId) {
          this.healthFill.style.width = `${Math.max(0, val) * 10}%`;
        }
      });
      callbacks.listen(tank, "shield", (val: number) => {
        entity.setShield(val);
        if (key === this.mySessionId) {
          this.shieldFill.style.width = `${Math.max(0, val) * 10}%`;
        }
      });
      callbacks.listen(tank, "score", (_val: number) => {
        this.updateScores();
      });
    });

    callbacks.onRemove("tanks", (_tank, key: string) => {
      const entity = this.tanks.get(key);
      if (entity) {
        this.scene.remove(entity.group);
        entity.dispose();
        this.tanks.delete(key);
      }
    });

    // ── Bullets ──
    callbacks.onAdd("bullets", (bullet, key: string) => {
      const isSpecial = bullet.special;

      // Color bullet by owner's team
      let bulletColor = isSpecial ? 0xff8800 : 0xffff66;
      const ownerTank = state.tanks.get(bullet.owner);
      if (ownerTank) {
        bulletColor = isSpecial
          ? 0xff8800
          : (TEAM_COLORS[ownerTank.team] || 0xffff66);
      }

      const geo = new THREE.SphereGeometry(isSpecial ? 0.35 : 0.2, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: bulletColor });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(bullet.x, 1.5, bullet.y);

      // Store target for client-side interpolation
      (mesh as any)._tx = bullet.tx;
      (mesh as any)._ty = bullet.ty;
      (mesh as any)._speed = bullet.speed;
      // Track server position — snap to it to avoid trailing ghosts
      (mesh as any)._sx = bullet.x;
      (mesh as any)._sy = bullet.y;

      this.scene.add(mesh);
      this.bulletMeshes.set(key, mesh);

      // Sync to server position on updates
      callbacks.listen(bullet, "x", (val: number) => { (mesh as any)._sx = val; });
      callbacks.listen(bullet, "y", (val: number) => { (mesh as any)._sy = val; });

      // Play shoot sound if it's from the local player
      if (bullet.owner === this.mySessionId) {
        isSpecial ? this.sound.shootSpecial() : this.sound.shoot();
      }
    });

    callbacks.onRemove("bullets", (_bullet, key: string) => {
      const mesh = this.bulletMeshes.get(key);
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.bulletMeshes.delete(key);
      }
    });

    // ── Pickables ──
    callbacks.onAdd("pickables", (pick, key: string) => {
      const group = new THREE.Group();
      const colorMap: Record<string, number> = {
        repair: 0x44ff44,
        damage: 0xff4444,
        shield: 0x4488ff,
      };

      const color = colorMap[pick.type] || 0xffffff;
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
      });

      if (pick.type === "repair") {
        // Plus/cross shape (aid kit) — standing upright
        const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.15), mat);
        const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.15), mat);
        group.add(hBar);
        group.add(vBar);
      } else if (pick.type === "shield") {
        // Shield shape — standing upright
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.4);
        shape.lineTo(0.35, 0.25);
        shape.lineTo(0.35, 0);
        shape.quadraticCurveTo(0.3, -0.3, 0, -0.45);
        shape.quadraticCurveTo(-0.3, -0.3, -0.35, 0);
        shape.lineTo(-0.35, 0.25);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
        geo.center();
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
      } else {
        // Default octahedron (damage)
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), mat);
        group.add(mesh);
      }

      // Glow
      const glowGeo = new THREE.SphereGeometry(0.5, 8, 8);
      const glowMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.15,
      });
      group.add(new THREE.Mesh(glowGeo, glowMat));

      group.position.set(pick.x, 0.6, pick.y);
      this.scene.add(group);
      this.pickableMeshes.set(key, group);
    });

    callbacks.onRemove("pickables", (pick, key: string) => {
      const group = this.pickableMeshes.get(key);
      if (group) {
        this.scene.remove(group);
        this.pickableMeshes.delete(key);
        if (pick.type === "repair") this.sound.pickupRepair();
        else if (pick.type === "shield") this.sound.pickupShield();
        else if (pick.type === "damage") this.sound.pickupDamage();
      }
    });

    // @ts-ignore
    window.game = this;

    // ── Teams / Winner ──
    callbacks.listen("winnerTeam", (val: number) => {
      if (val >= 0) {
        this.showWinnerScreen(val);
      }
    });

    // Update score display periodically
    callbacks.onAdd("teams", (team) => {
      callbacks.listen(team, "score", () => this.updateScores());
      callbacks.listen(team, "tanks", () => this.updateScores());
      this.updateScores();
    });
  }

  private updateScores() {
    const state = this.room.state as any;
    const teams: { id: number; score: number; count: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const team = state.teams[i];
      if (team) {
        teams.push({ id: i, score: team.score, count: team.tanks });
      }
    }
    teams.sort((a, b) => b.score - a.score);

    const rowHeight = 28;

    // Create elements on first call
    for (const t of teams) {
      if (!this.scoreElements.has(t.id)) {
        const el = document.createElement("div");
        const TEAM_CLASSES = [
          "text-[#ff6666] bg-[rgba(255,68,68,0.12)]",
          "text-[#66aaff] bg-[rgba(68,136,255,0.12)]",
          "text-[#66ff66] bg-[rgba(68,255,68,0.12)]",
          "text-[#ffff66] bg-[rgba(255,255,68,0.12)]"
        ];
        el.className = `absolute left-0 right-0 flex items-center justify-between py-[4px] px-[8px] my-[2px] rounded font-bold tracking-[0.2px] transition-[top] duration-[400ms] ease-out ${TEAM_CLASSES[t.id]}`;
        el.innerHTML = `
          <div class="flex items-center justify-between w-full">
            <span class="opacity-90 w-[60px] text-[11px] truncate">${TEAM_NAMES[t.id]}</span>
            <span class="team-count text-[14px] text-right">0</span>
          </div>
        `;
        this.scoresList.appendChild(el);
        this.scoreElements.set(t.id, el);
      }
    }

    // Update positions and counts
    for (let rank = 0; rank < teams.length; rank++) {
      const t = teams[rank] as any;
      if (!t) continue;
      const el = this.scoreElements.get(t.id);
      if (el) {
        el.style.top = `${rank * rowHeight}px`;
        el.querySelector(".team-count")!.textContent = `${t.count}`;
      }
    }

    this.scoresList.style.height = `${teams.length * rowHeight}px`;
  }

  private showWinnerScreen(winnerTeamId: number) {
    const teamHex = ["#ff4444", "#4488ff", "#44ff44", "#ffff44"];
    const stripeRgba = [
      "rgba(200,40,40,0.92)",
      "rgba(40,100,220,0.92)",
      "rgba(40,180,40,0.92)",
      "rgba(200,200,40,0.92)",
    ];
    const lineRgba = [
      "rgba(255,120,120,0.8)",
      "rgba(100,170,255,0.8)",
      "rgba(100,255,100,0.8)",
      "rgba(255,255,100,0.8)",
    ];
    const tintRgba = [
      "rgba(255,0,0,0.08)",
      "rgba(0,80,255,0.08)",
      "rgba(0,200,0,0.08)",
      "rgba(200,200,0,0.08)",
    ];

    const myTank = (this.room.state as any).tanks.get(this.mySessionId);
    const isWinner = myTank && myTank.team === winnerTeamId;

    const label = document.getElementById("winner-label")!;
    const teamLine = document.getElementById("winner-team")!;
    const stripe = document.getElementById("winner-stripe")!;
    const lineTop = document.getElementById("winner-line-top")!;
    const lineBot = document.getElementById("winner-line-bot")!;
    const tint = document.getElementById("winner-tint")!;

    label.textContent = isWinner ? "VICTORY" : "DEFEAT";
    label.style.color = "#fff";
    teamLine.textContent = `${TEAM_NAMES[winnerTeamId]} Team Wins`;
    teamLine.style.color = "rgba(255,255,255,0.9)";

    stripe.style.background = stripeRgba[winnerTeamId] || stripeRgba[0]!;
    lineTop.style.background = lineRgba[winnerTeamId] || lineRgba[0]!;
    lineBot.style.background = lineRgba[winnerTeamId] || lineRgba[0]!;
    tint.style.background = tintRgba[winnerTeamId] || tintRgba[0]!;

    // Show with display:flex but keep starting transforms, then animate in
    this.winnerScreen.classList.add("ready");
    void this.winnerScreen.offsetWidth; // force reflow so "ready" state renders
    this.winnerScreen.classList.add("active");

    setTimeout(() => {
      this.winnerScreen.classList.remove("active");
      this.winnerScreen.classList.add("exit");
      setTimeout(() => {
        this.winnerScreen.classList.remove("ready", "exit");
      }, 800);
    }, 2800);
  }

  private setupInput() {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener("mousemove", (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.network.sendShoot(true);
      }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
        this.network.sendShoot(false);
      }
    });
    window.addEventListener("contextmenu", (e) => e.preventDefault());

    // Mobile joysticks
    const isMobile = window.matchMedia("(max-width: 767px)").matches || ('ontouchstart' in window);
    if (isMobile) {
      const leftZone = document.getElementById("joystick-left");
      const rightZone = document.getElementById("joystick-right");
      if (leftZone && rightZone) {
        import("nipplejs").then((nipplejs) => {
          // Movement joystick — blue/cyan gradient
          this.leftJoystickManager = nipplejs.default.create({
            zone: leftZone,
            mode: "static",
            position: { left: "50%", bottom: "50%" },
            size: 120,
            color: {
              front: "linear-gradient(135deg, #818cf8, #38bdf8)",
              back: "rgba(99, 102, 241, 0.15)",
            },
            restOpacity: 0.6,
          });
          
          this.leftJoystickManager.on("move", (evt: any) => {
            const force = Math.min(evt.data.force, 1);
            this.joystickRawX = Math.cos(evt.data.angle.radian) * force;
            this.joystickRawY = -Math.sin(evt.data.angle.radian) * force;
          });
          this.leftJoystickManager.on("end", () => {
            this.joystickRawX = 0;
            this.joystickRawY = 0;
          });

          // Aim & shoot joystick — pink/fuchsia gradient
          this.rightJoystickManager = nipplejs.default.create({
            zone: rightZone,
            mode: "static",
            position: { left: "50%", bottom: "50%" },
            size: 120,
            color: {
              front: "linear-gradient(135deg, #e879f9, #ec4899)",
              back: "rgba(236, 72, 153, 0.15)",
            },
            restOpacity: 0.6,
          });

          this.rightJoystickManager.on("move", (evt: any) => {
            const force = Math.min(evt.data.force, 1);
            this.joystickAimRawX = Math.cos(evt.data.angle.radian) * force;
            this.joystickAimRawY = -Math.sin(evt.data.angle.radian) * force;
            this.isJoystickAiming = true;
            this.network.sendShoot(true);
          });
          this.rightJoystickManager.on("end", () => {
            this.isJoystickAiming = false;
            this.network.sendShoot(false);
          });
        });
      }
    }
  }

  private sendInput() {
    let rawX = 0;
    let rawY = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) rawY -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) rawY += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) rawX -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) rawX += 1;

    // Add joystick input
    if (this.joystickRawX !== 0 || this.joystickRawY !== 0) {
      rawX = this.joystickRawX;
      rawY = this.joystickRawY;
    } else {
      // Normalize keyboard input
      if (rawX !== 0 || rawY !== 0) {
        const len = Math.sqrt(rawX * rawX + rawY * rawY);
        rawX /= len;
        rawY /= len;
      }
    }

    // Rotate input by camera angle so "up" moves visually upward
    // Camera is at 45° (offset +20, +20), so rotate by -π/4
    const angle = -Math.PI / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotX = rawX * cos - rawY * sin;
    const rotY = rawX * sin + rawY * cos;

    // For keyboard input (integer values), round to -1/0/1.
    // For joystick input (fractional), preserve tsahe float values.
    const isJoystick = this.joystickRawX !== 0 || this.joystickRawY !== 0;
    const dirX = isJoystick ? rotX : Math.round(rotX);
    const dirY = isJoystick ? rotY : Math.round(rotY);

    if (dirX !== this.lastSentDirX || dirY !== this.lastSentDirY) {
      this.network.sendMove(dirX, dirY);
      this.lastSentDirX = dirX;
      this.lastSentDirY = dirY;
    }

    // Turret angle from mouse
    const myTank = this.tanks.get(this.mySessionId);
    if (myTank) {
      if (this.isJoystickAiming) {
        const aimAngleCam = -Math.PI / 4;
        const cos = Math.cos(aimAngleCam);
        const sin = Math.sin(aimAngleCam);
        const aimWorldDx = this.joystickAimRawX * cos - this.joystickAimRawY * sin;
        const aimWorldDz = this.joystickAimRawX * sin + this.joystickAimRawY * cos;
        
        let angle = Math.atan2(aimWorldDx, aimWorldDz) * (180 / Math.PI);
        angle = ((angle % 360) + 360) % 360;
        
        myTank.targetAngle = angle;
        
        const now = performance.now();
        if (Math.abs(angle - this.lastSentAngle) > 1 && now - this.lastTargetSendTime >= 100) {
          this.network.sendTarget(angle);
          this.lastSentAngle = angle;
          this.lastTargetSendTime = now;
        }
      } else {
        const mouse = new THREE.Vector2(
          (this.mouseX / window.innerWidth) * 2 - 1,
          -(this.mouseY / window.innerHeight) * 2 + 1
        );
        this.raycaster.setFromCamera(mouse, this.camera);
        const target = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.groundPlane, target);

        if (target) {
          const dx = target.x - myTank.group.position.x;
          const dz = target.z - myTank.group.position.z;
          // Game angle convention: bullet dir = (sin(a), cos(a))
          // So angle = atan2(dx, dz) maps screen direction to game angle
          let angle = Math.atan2(dx, dz) * (180 / Math.PI);
          angle = ((angle % 360) + 360) % 360;

          myTank.targetAngle = angle;

          const now = performance.now();
          if (Math.abs(angle - this.lastSentAngle) > 1 && now - this.lastTargetSendTime >= 100) {
            this.network.sendTarget(angle);
            this.lastSentAngle = angle;
            this.lastTargetSendTime = now;
          }
        }
      }
    }
  }

  private animate = () => {
    requestAnimationFrame(this.animate);

    if (this.room) {
      this.sendInput();
    }

    if (this.map) {
      this.map.update();
    }

    // Update tanks
    for (const [, tank] of this.tanks) {
      tank.update(0.016);
      if (this.map) {
        tank.group.position.y = this.map.getGroundHeight(tank.group.position.x, tank.group.position.z);
      }
    }

    // Animate pickables (float + rotate + hill height)
    const t = Date.now() * 0.001;
    for (const [, group] of this.pickableMeshes) {
      const h = this.map ? this.map.getGroundHeight(group.position.x, group.position.z) : 0;
      group.position.y = 0.6 + Math.sin(t * 2) * 0.15 + h;
      group.rotation.y = t;
    }

    // Client-side bullet interpolation — lerp toward server position
    for (const [, mesh] of this.bulletMeshes) {
      const data = mesh as any;
      if (data._sx !== undefined) {
        // Snap toward server-authoritative position
        mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, data._sx, 0.4);
        mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, data._sy, 0.4);
      }
    }

    // Camera follow with mouse look-ahead
    const myTank = this.tanks.get(this.mySessionId);
    if (myTank) {
      const tx = myTank.group.position.x;
      const ty = myTank.group.position.y;
      const tz = myTank.group.position.z;

      // Mouse offset from screen center, normalized to [-1, 1]
      const nx = (this.mouseX / window.innerWidth) * 2 - 1;
      const ny = (this.mouseY / window.innerHeight) * 2 - 1;

      // Screen-to-world mapping for isometric 45° camera
      // Screen right → world (1, 0, -1)/√2, Screen down → world (1, 0, 1)/√2
      const lookAhead = 3;
      const offsetX = (nx + ny) * 0.707 * lookAhead;
      const offsetZ = (-nx + ny) * 0.707 * lookAhead;

      this.camera.position.x = THREE.MathUtils.lerp(
        this.camera.position.x,
        tx + 20 + offsetX,
        0.08
      );
      this.camera.position.z = THREE.MathUtils.lerp(
        this.camera.position.z,
        tz + 20 + offsetZ,
        0.08
      );
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, ty + 20, 0.08);
      this.camera.lookAt(
        this.camera.position.x - 20,
        ty,
        this.camera.position.z - 20
      );
    }

    this.renderer.render(this.scene, this.camera);
  };

  private onResize() {
    const frustumSize = 22;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = (-frustumSize * aspect) / 2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
