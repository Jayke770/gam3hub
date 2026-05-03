import * as THREE from "three";
import { Callbacks, Room } from "@colyseus/sdk";
import { Network } from "./Network";
import { TankEntity, preloadTankModel } from "./Tank";
import { MapRenderer } from "./MapRenderer";
import confetti from "canvas-confetti";
import { Sound } from "./Sound";
import type { BattleState } from "./schema/BattleState";
import { gameServerUrl } from "@/lib/constants";

interface BulletMesh extends THREE.Mesh {
  _tx: number;
  _ty: number;
  _speed: number;
  _sx: number;
  _sy: number;
  _vx: number;
  _vy: number;
}

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
  bulletMeshes = new Map<string, BulletMesh>();
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
  scoresList!: HTMLElement;
  scoreElements = new Map<string, HTMLElement>();
  deathScreen!: HTMLElement;
  respawnTimerEl!: HTMLElement;
  winnerScreen!: HTMLElement;
  nextRoundTimerEl!: HTMLElement;
  ammoDisplay!: HTMLElement;
  connectStatus!: HTMLElement;
  gameTimerEl!: HTMLElement;
  killFeedEl!: HTMLElement;
  pingEl!: HTMLElement;

  private lastPingTime = 0;
  private pingInterval: any = null;

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
    this.network = new Network(gameServerUrl);

    // HUD refs
    this.scoresList = document.getElementById("scores-list")!;
    this.deathScreen = document.getElementById("death-screen")!;
    this.respawnTimerEl = document.getElementById("respawn-timer")!;
    this.winnerScreen = document.getElementById("winner-screen")!;
    this.ammoDisplay = document.getElementById("ammo-display")!;
    this.connectStatus = document.getElementById("connect-status")!;
    this.gameTimerEl = document.getElementById("game-timer")!;
    this.killFeedEl = document.getElementById("kill-feed")!;
    this.nextRoundTimerEl = document.getElementById("next-round-timer")!;
    this.pingEl = document.getElementById("ping-display")!;

    // Input
    this.setupInput();

    // Resize
    window.addEventListener("resize", () => this.onResize());
  }

  async start(username?: string) {
    await preloadTankModel();

    try {
      this.room = await this.network.connect(username);
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
        if (key !== this.mySessionId) {
          entity.targetAngle = val;
        }
      });
      callbacks.listen(tank, "tSpeedBoost", (val: number) => {
        entity.setSpeedBoost(val);
      });
      callbacks.listen(tank, "dead", (val: boolean, prev: boolean) => {
        entity.setDead(val);
        if (val && prev === false) {
          // If match just ended, don't show death or play destruction sound
          if (this.room.state.winnerTeam === -1) {
            this.sound.destroyed();
            if (key === this.mySessionId) {
              this.showDeathScreen();
            }
          }
        } else if (!val) {
          if (key === this.mySessionId) {
            this.hideDeathScreen();
          }
        }
      });
      callbacks.listen(tank, "hp", (val: number, prev: number) => {
        entity.setHealth(val);
        if (val < prev) {
          const myTank = this.tanks.get(this.mySessionId);
          if (myTank) {
            const dx = entity.group.position.x - myTank.group.position.x;
            const dz = entity.group.position.z - myTank.group.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const vol = Math.max(0, 0.25 * (1 - dist / 25));
            if (vol > 0.01) this.sound.hit(vol);
          }
        }
      });
      callbacks.listen(tank, "shield", (val: number) => {
        entity.setShield(val);
      });
      callbacks.listen(tank, "name", (val: string) => {
        entity.setName(val);
      });
      entity.setName(tank.name);
      callbacks.listen(tank, "score", () => {
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

      let bulletColor = isSpecial ? 0xff8800 : 0xffff66;
      const ownerTank = state.tanks.get(bullet.owner);
      if (ownerTank) {
        bulletColor = isSpecial
          ? 0xff8800
          : (TEAM_COLORS[ownerTank.team] || 0xffff66);
      }

      const geo = new THREE.SphereGeometry(isSpecial ? 0.45 : 0.3, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: bulletColor });
      const mesh = new THREE.Mesh(geo, mat) as unknown as BulletMesh;
      mesh.position.set(bullet.x, 1.5, bullet.y);

      mesh._tx = bullet.tx;
      mesh._ty = bullet.ty;
      mesh._speed = bullet.speed;
      mesh._sx = bullet.x;
      mesh._sy = bullet.y;

      this.scene.add(mesh);
      this.bulletMeshes.set(key, mesh);

      const dx = bullet.tx - bullet.x;
      const dy = bullet.ty - bullet.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      mesh._vx = (dx / dist) * bullet.speed;
      mesh._vy = (dy / dist) * bullet.speed;

      callbacks.listen(bullet, "x", (val: number) => { mesh._sx = val; });
      callbacks.listen(bullet, "y", (val: number) => { mesh._sy = val; });

      if (bullet.owner === this.mySessionId) {
        if (isSpecial) {
          this.sound.shootSpecial();
        } else {
          this.sound.shoot();
        }
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
        speed: 0xffff44,
      };

      const color = colorMap[pick.type] || 0xffffff;
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
      });

      if (pick.type === "repair") {
        const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.15), mat);
        const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.15), mat);
        group.add(hBar);
        group.add(vBar);
      } else if (pick.type === "shield") {
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
      } else if (pick.type === "speed") {
        const shape = new THREE.Shape();
        shape.moveTo(0.15, 0.5);
        shape.lineTo(-0.25, 0.05);
        shape.lineTo(0.05, 0.05);
        shape.lineTo(-0.15, -0.5);
        shape.lineTo(0.25, -0.05);
        shape.lineTo(-0.05, -0.05);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
        geo.center();
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
      } else {
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), mat);
        group.add(mesh);
      }

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
        else if (pick.type === "speed") this.sound.pickupSpeed();
      }
    });

    callbacks.listen("winnerTeam", (val: number) => {
      if (val !== -1) {
        this.showWinnerScreen(val);
        this.hideDeathScreen();
      } else {
        this.hideWinnerScreen();
      }
    });
    callbacks.listen("nextRoundTimer", (val: number) => {
      if (this.nextRoundTimerEl) {
        this.nextRoundTimerEl.textContent = val.toString();
      }
    });

    callbacks.listen("gameTimer", (val: number) => {
      const mins = Math.floor(val / 60);
      const secs = val % 60;
      if (this.gameTimerEl) {
        this.gameTimerEl.textContent = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }
    });

    this.room.onMessage("kill", (data) => {
      this.showKillMessage(data);
    });

    callbacks.onAdd("teams", (team) => {
      callbacks.listen(team, "score", () => this.updateScores());
      callbacks.listen(team, "tanks", () => this.updateScores());
      this.updateScores();
    });

    this.room.onMessage("pong", () => {
      const ping = Date.now() - this.lastPingTime;
      if (this.pingEl) {
        this.pingEl.textContent = `Ping: ${ping}ms`;
        // Color coding based on ping
        if (ping < 100) this.pingEl.style.color = "rgba(102, 255, 102, 0.4)";
        else if (ping < 250) this.pingEl.style.color = "rgba(255, 255, 102, 0.4)";
        else this.pingEl.style.color = "rgba(255, 102, 102, 0.4)";
      }
    });

    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      this.lastPingTime = Date.now();
      this.room.send("ping");
    }, 2000);
  }

  private updateScores() {
    const state = this.room.state;
    const players: { id: string; name: string; score: number; team: number }[] = [];

    state.tanks.forEach((tank, key: string) => {
      players.push({
        id: key,
        name: tank.name || "Player",
        score: tank.score || 0,
        team: tank.team
      });
    });

    players.sort((a, b) => b.score - a.score);

    const rowHeight = 32;
    const TEAM_CLASSES = [
      "text-[#ff6666] bg-[rgba(255,68,68,0.12)]",
      "text-[#66aaff] bg-[rgba(68,136,255,0.12)]",
      "text-[#66ff66] bg-[rgba(68,255,68,0.12)]",
      "text-[#ffff66] bg-[rgba(255,255,68,0.12)]"
    ];

    for (const [id, el] of this.scoreElements.entries()) {
      if (!state.tanks.has(id)) {
        this.scoresList.removeChild(el);
        this.scoreElements.delete(id);
      }
    }

    players.forEach((p, rank) => {
      let el = this.scoreElements.get(p.id);
      if (!el) {
        el = document.createElement("div");
        el.innerHTML = `
          <div class="flex items-center justify-between w-full">
            <span class="player-name opacity-90 text-[11px] font-bold truncate max-w-[80px]"></span>
            <span class="player-score text-[14px] font-black text-right">0</span>
          </div>
        `;
        this.scoresList.appendChild(el);
        this.scoreElements.set(p.id, el);
      }

      el.className = `absolute left-0 right-0 flex items-center justify-between py-[6px] px-[10px] my-[2px] rounded transition-all duration-[400ms] ease-out ${TEAM_CLASSES[p.team] || "text-white bg-white/10"}`;
      el.style.top = `${rank * rowHeight}px`;

      const nameEl = el.querySelector(".player-name")!;
      const scoreEl = el.querySelector(".player-score")!;

      nameEl.textContent = p.name + (p.id === this.mySessionId ? " (You)" : "");
      scoreEl.textContent = p.score.toString();
    });

    this.scoresList.style.height = `${players.length * rowHeight}px`;
    this.updateLeader(players);
  }

  private updateLeader(players: { id: string; name: string; score: number; team: number }[]) {
    if (players.length === 0) return;
    const topScore = players[0]?.score || 0;
    // Tie condition: only crown if one person has the top score and score > 0
    const leaders = players.filter(p => p.score === topScore && p.score > 0);
    
    this.tanks.forEach((tank, id) => {
      const isLeader = leaders.length === 1 && leaders[0]?.id === id;
      tank.setLeader(isLeader);
    });
  }

  private respawnInterval: any = null;
  private showDeathScreen() {
    this.deathScreen.classList.remove("exit");
    this.deathScreen.classList.add("ready");
    // Force reflow
    const _reflow = this.deathScreen.offsetWidth;
    this.deathScreen.classList.add("active");

    let timeLeft = 3.0;
    if (this.respawnInterval) clearInterval(this.respawnInterval);

    if (this.respawnTimerEl) {
      this.respawnTimerEl.textContent = timeLeft.toFixed(1);
      this.respawnInterval = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft < 0) timeLeft = 0;
        this.respawnTimerEl.textContent = timeLeft.toFixed(1);
        if (timeLeft <= 0) clearInterval(this.respawnInterval);
      }, 100);
    }
  }

  private hideDeathScreen() {
    if (this.respawnInterval) clearInterval(this.respawnInterval);
    this.deathScreen.classList.remove("active");
    this.deathScreen.classList.add("exit");
    setTimeout(() => {
      this.deathScreen.classList.remove("ready", "exit");
    }, 500);
  }

  private showWinnerScreen(winnerTeamId: number) {
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

    const myTank = this.room.state.tanks.get(this.mySessionId);
    const isDraw = winnerTeamId === -2;
    const isWinner = !isDraw && myTank && myTank.team === winnerTeamId;

    const label = document.getElementById("winner-label")!;
    const teamLine = document.getElementById("winner-team")!;
    const stripe = document.getElementById("winner-stripe")!;
    const lineTop = document.getElementById("winner-line-top")!;
    const lineBot = document.getElementById("winner-line-bot")!;
    const tint = document.getElementById("winner-tint")!;

    if (isDraw) {
      label.textContent = "DRAW";
      label.style.color = "#fff";
      teamLine.textContent = "No Clear Victory";
      teamLine.style.color = "rgba(255,255,255,0.6)";

      stripe.style.background = "rgba(100,100,100,0.92)";
      lineTop.style.background = "rgba(150,150,150,0.8)";
      lineBot.style.background = "rgba(150,150,150,0.8)";
      tint.style.background = "rgba(255,255,255,0.05)";
    } else {
      label.textContent = isWinner ? "VICTORY" : "DEFEAT";
      label.style.color = isWinner ? "#fff" : "#ff4444";
      teamLine.textContent = `${TEAM_NAMES[winnerTeamId]} Team Wins`;
      teamLine.style.color = "rgba(255,255,255,0.9)";

      const colorIndex = isWinner ? winnerTeamId : 0;
      stripe.style.background = stripeRgba[colorIndex] || stripeRgba[0]!;
      lineTop.style.background = lineRgba[colorIndex] || lineRgba[0]!;
      lineBot.style.background = lineRgba[colorIndex] || lineRgba[0]!;
      tint.style.background = tintRgba[colorIndex] || tintRgba[0]!;
    }

    this.winnerScreen.classList.add("ready");
    // Force reflow
    const _reflowWinner = this.winnerScreen.offsetWidth;
    this.winnerScreen.classList.add("active");

    if (isWinner) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#ffffff", "#FFD700", "#FFA500", "#FF4500"],
      });
    }
  }

  private hideWinnerScreen() {
    this.winnerScreen.classList.remove("active");
    this.winnerScreen.classList.add("exit");
    setTimeout(() => {
      this.winnerScreen.classList.remove("ready", "exit");
    }, 800);
  }

  private showKillMessage(data: { killer: string; victim: string; killerTeam: number; victimTeam: number }) {
    const el = document.createElement("div");
    const TEAM_COLORS = ["text-[#ff4444]", "text-[#4488ff]", "text-[#44ff44]", "text-[#ffff44]"];

    el.className = "flex items-center gap-3 bg-black/60 backdrop-blur-md border border-white/5 py-1.5 px-4 rounded-full text-[11px] font-bold tracking-wider animate-in slide-in-from-bottom-2 fade-in duration-300";
    el.innerHTML = `
      <span class="${TEAM_COLORS[data.killerTeam]} uppercase">${data.killer}</span>
      <span class="text-white/40 italic">destroyed</span>
      <span class="${TEAM_COLORS[data.victimTeam]} uppercase">${data.victim}</span>
    `;

    this.killFeedEl.appendChild(el);
    setTimeout(() => {
      el.classList.add("opacity-0", "translate-y-[-10px]", "transition-all", "duration-500");
      setTimeout(() => el.remove(), 500);
    }, 4000);
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

    const leftZone = document.getElementById("joystick-left");
    const rightZone = document.getElementById("joystick-right");
    if (leftZone && rightZone && !this.leftJoystickManager) {
      import("nipplejs").then((nipplejs) => {
        this.leftJoystickManager = nipplejs.default.create({
          zone: leftZone,
          mode: "static",
          position: { left: "50%", bottom: "50%" },
          size: 120,
          color: {
            front: "linear-gradient(135deg, #818cf8, #38bdf8)",
            back: "rgba(99, 102, 241, 0.15)",
          },
          restOpacity: 0.8,
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

        this.rightJoystickManager = nipplejs.default.create({
          zone: rightZone,
          mode: "static",
          position: { left: "50%", bottom: "50%" },
          size: 120,
          color: {
            front: "linear-gradient(135deg, #e879f9, #ec4899)",
            back: "rgba(236, 72, 153, 0.25)",
          },
          restOpacity: 0.8,
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

  private sendInput() {
    let rawX = 0;
    let rawY = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) rawY -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) rawY += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) rawX -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) rawX += 1;

    if (this.joystickRawX !== 0 || this.joystickRawY !== 0) {
      rawX = this.joystickRawX;
      rawY = this.joystickRawY;
    } else {
      if (rawX !== 0 || rawY !== 0) {
        const len = Math.sqrt(rawX * rawX + rawY * rawY);
        rawX /= len;
        rawY /= len;
      }
    }

    const angle = -Math.PI / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotX = rawX * cos - rawY * sin;
    const rotY = rawX * sin + rawY * cos;

    const isJoystick = this.joystickRawX !== 0 || this.joystickRawY !== 0;
    const dirX = isJoystick ? rotX : Math.round(rotX);
    const dirY = isJoystick ? rotY : Math.round(rotY);

    if (dirX !== this.lastSentDirX || dirY !== this.lastSentDirY) {
      this.network.sendMove(dirX, dirY);
      this.lastSentDirX = dirX;
      this.lastSentDirY = dirY;
    }

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

    for (const [, tank] of this.tanks) {
      tank.update();
      if (this.map) {
        tank.group.position.y = this.map.getGroundHeight(tank.group.position.x, tank.group.position.z);
      }
    }

    const t = Date.now() * 0.001;
    for (const [, group] of this.pickableMeshes) {
      const h = this.map ? this.map.getGroundHeight(group.position.x, group.position.z) : 0;
      group.position.y = 0.6 + Math.sin(t * 2) * 0.15 + h;
      group.rotation.y = t;
    }

    for (const [, mesh] of this.bulletMeshes) {
      const stepFactor = 1 / 3;
      if (mesh._vx !== undefined) {
        mesh.position.x += mesh._vx * stepFactor;
        mesh.position.z += mesh._vy * stepFactor;
      }

      if (mesh._sx !== undefined) {
        mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, mesh._sx, 0.15);
        mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, mesh._sy, 0.15);

        if (this.map) {
          mesh.position.y = this.map.getGroundHeight(mesh.position.x, mesh.position.z) + 0.8;
        } else {
          mesh.position.y = 1.0;
        }
      }
    }

    const myTank = this.tanks.get(this.mySessionId);
    if (myTank) {
      const tx = myTank.group.position.x;
      const ty = myTank.group.position.y;
      const tz = myTank.group.position.z;

      const nx = (this.mouseX / window.innerWidth) * 2 - 1;
      const ny = (this.mouseY / window.innerHeight) * 2 - 1;

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
