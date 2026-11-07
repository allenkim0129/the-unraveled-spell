import * as THREE from 'three';
import { t } from '../i18n';
import type { MessageKey } from '../i18n';
import {
  evaluateOutcome, EXECUTION_SECONDS, SPELL_IDS, SPELL_NAMES, TARGET_NAMES,
} from './state';
import type { GameState, SpellId, TargetId } from './state';

const FORCE_COLOR = 0xff995a;
const MOTION_COLOR = 0x65c9ff;
const TARGET_COLOR = 0x9be8c4;
const START = new THREE.Vector3(0, 0, 7);
const SOURCE_POSITIONS: Record<SpellId, THREE.Vector3> = {
  force: new THREE.Vector3(-3, 1.8, 4.5),
  motion: new THREE.Vector3(3, 1.8, 4.5),
};
const TARGET_POSITIONS: Record<TargetId, THREE.Vector3> = {
  anchor: new THREE.Vector3(-1.7, 0.9, 2.7),
  debris: new THREE.Vector3(-3.4, 2.1, -3.7),
  mechanism: new THREE.Vector3(1.7, 0.9, 2.7),
};
const COLORS: Record<SpellId, number> = { force: FORCE_COLOR, motion: MOTION_COLOR };

function material(color: number, emissive = 0x000000): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.75, metalness: 0.15 });
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function place(parent: THREE.Object3D, mesh: THREE.Object3D, x: number, y: number, z: number): void {
  mesh.position.set(x, y, z);
  parent.add(mesh);
}

function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(t('errorCanvas'));
  ctx.fillStyle = 'rgba(6, 14, 26, 0.9)';
  ctx.fillRect(0, 0, 512, 80);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 508, 76);
  ctx.font = 'bold 27px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 40, 480);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function label(text: string, color: string): THREE.Sprite {
  const texture = labelTexture(text, color);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    transparent: true,
  }));
  sprite.scale.set(2.35, 0.37, 1);
  return sprite;
}

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1, 0.1, 90);
  private player = new THREE.Group();
  private bridge = new THREE.Group();
  private anchor = new THREE.Group();
  private debris = new THREE.Group();
  private exit = new THREE.Group();
  private sourceGroups: Record<SpellId, THREE.Group> = {
    force: new THREE.Group(),
    motion: new THREE.Group(),
  };
  private threads: Record<SpellId, THREE.Mesh> = {
    force: new THREE.Mesh(),
    motion: new THREE.Mesh(),
  };
  private projectiles: Record<SpellId, THREE.Mesh> = {
    force: new THREE.Mesh(new THREE.IcosahedronGeometry(0.23, 1), material(FORCE_COLOR, FORCE_COLOR)),
    motion: new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), material(MOTION_COLOR, MOTION_COLOR)),
  };
  private targetMarkers = new THREE.Group();
  private spellLabels = new THREE.Group();
  private localizedLabels: { sprite: THREE.Sprite; key: MessageKey; color: string }[] = [];
  private targetRings: Record<TargetId, THREE.Mesh> = {
    anchor: new THREE.Mesh(),
    debris: new THREE.Mesh(),
    mechanism: new THREE.Mesh(),
  };
  private seams = new THREE.Group();
  private resizeObserver: ResizeObserver;
  private yaw = 0;
  private pitch = 0.42;
  private cameraDistance = 5.8;
  private visualTime = 0;
  private lastSignature = '';
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private temporaryPosition = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private collisions = [
    { x: -3, z: 4.5, radius: 0.8 },
    { x: 3, z: 4.5, radius: 0.8 },
    { x: -1.7, z: 2.7, radius: 0.65 },
    { x: 1.7, z: 2.7, radius: 0.65 },
  ];

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.domElement.dataset.i18nAria = 'cameraAria';
    this.renderer.domElement.setAttribute('aria-label', t('cameraAria'));
    this.host.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x0a101b);
    this.scene.fog = new THREE.Fog(0x0a101b, 16, 42);
    this.scene.add(new THREE.HemisphereLight(0xc7d8ff, 0x37304c, 2.4));
    const moon = new THREE.DirectionalLight(0xc7d9ff, 3.5);
    moon.position.set(-3, 12, -5);
    this.scene.add(moon);
    this.buildRoom();
    this.buildSpells();
    this.buildPlayer();
    this.reset();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }

  private makeLabel(key: MessageKey, color: string): THREE.Sprite {
    const sprite = label(t(key), color);
    this.localizedLabels.push({ sprite, key, color });
    return sprite;
  }

  setLanguage(): void {
    for (const { sprite, key, color } of this.localizedLabels) {
      sprite.material.map?.dispose();
      sprite.material.map = labelTexture(t(key), color);
      sprite.material.needsUpdate = true;
    }
  }

  private buildRoom(): void {
    const stone = material(0x39475e);
    const edge = material(0x777993);
    const gold = material(0xb49b6c);
    const dark = material(0x1a2335);
    place(this.scene, box(12, 0.7, 7.7, stone), 0, -0.45, 6.25);
    place(this.scene, box(12, 0.7, 8.6, stone), 0, -0.45, -5.7);
    for (const z of [2.5, -1.5]) {
      place(this.scene, box(12, 0.14, 0.15, gold), 0, 0.01, z);
    }
    for (let z = -9; z <= 9; z += 1.5) {
      if (z > -1.5 && z < 2.5) continue;
      for (let x = -5; x <= 5; x += 1.5) {
        const seam = box(1.42, 0.015, 1.42, material((Math.round(x + z) % 2) ? 0x45516a : 0x3a465d));
        place(this.seams, seam, x, -0.085, z);
      }
    }
    this.scene.add(this.seams);
    for (const x of [-5.8, 5.8]) {
      place(this.scene, box(0.35, 2.4, 20, dark), x, 1.1, 0);
      for (let z = -8; z <= 8; z += 4) {
        place(this.scene, box(0.75, 5.8, 0.75, stone), x, 2.75, z);
        place(this.scene, box(1, 0.3, 1, edge), x, 5.5, z);
        place(this.scene, box(0.2, 3.5, 0.2, gold), x + (x < 0 ? 0.42 : -0.42), 2.7, z);
        const window = box(0.04, 2.5, 1.9, material(0x375986, 0x193350));
        place(this.scene, window, x + (x < 0 ? 0.2 : -0.2), 3.1, z + 2);
        const point = box(0.04, 1.25, 1.25, material(0x446696, 0x193350));
        point.rotation.x = Math.PI / 4;
        place(this.scene, point, x + (x < 0 ? 0.21 : -0.21), 4.45, z + 2);
      }
    }
    for (const z of [-9.8, 9.8]) place(this.scene, box(12, 1.2, 0.3, dark), 0, 0.45, z);
    // The bridge hinges around the near edge; only the resolved safe state grants a walkable floor.
    for (let i = 0; i < 8; i++) {
      const board = box(2.5, 0.17, 0.48, edge);
      place(this.bridge, board, 0, 0, -0.26 - i * 0.5);
    }
    for (const x of [-1.15, 1.15]) place(this.bridge, box(0.1, 0.15, 4, gold), x, 0.05, -2);
    this.bridge.position.set(0, -0.1, 2.5);
    this.scene.add(this.bridge);
    place(this.anchor, box(0.8, 0.8, 0.8, gold), 0, 0.4, 0);
    const anchorCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), material(TARGET_COLOR, 0x254f48));
    place(this.anchor, anchorCrystal, 0, 1, 0);
    this.anchor.position.set(-1.7, 0, 2.7);
    this.scene.add(this.anchor);
    const mechanism = new THREE.Group();
    place(mechanism, box(0.8, 0.65, 0.8, gold), 0, 0.3, 0);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.09, 8, 16), material(MOTION_COLOR, 0x18445a));
    place(mechanism, wheel, 0, 0.9, 0);
    place(this.scene, mechanism, 1.7, 0, 2.7);
    for (let i = 0; i < 5; i++) {
      const fragment = box(0.35 + i * 0.08, 0.25, 0.45, stone);
      fragment.rotation.set(i * 0.5, i * 0.7, i * 0.2);
      place(this.debris, fragment, (i % 2 - 0.5) * 0.7, i * 0.27, 0);
    }
    this.debris.position.copy(TARGET_POSITIONS.debris);
    this.scene.add(this.debris);
    const doorMat = material(0x96ebcd, 0x376c61);
    place(this.exit, box(0.2, 3.3, 0.5, gold), -1, 1.55, 0);
    place(this.exit, box(0.2, 3.3, 0.5, gold), 1, 1.55, 0);
    place(this.exit, box(2.2, 0.25, 0.5, gold), 0, 3.2, 0);
    const portal = box(1.7, 2.9, 0.07, doorMat);
    place(this.exit, portal, 0, 1.4, 0);
    const exitLabel = this.makeLabel('exitName', '#9be8c4');
    place(this.exit, exitLabel, 0, 3.65, 0);
    this.exit.position.set(0, 0, -8);
    this.scene.add(this.exit);
    for (let i = 0; i < 22; i++) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.055 + i % 3 * 0.02), material(0xb2d4ee, 0x162334));
      place(this.scene, shard, Math.sin(i * 7) * 4.4, 2.5 + (i % 7) * 0.4, Math.cos(i * 3) * 7);
      shard.rotation.set(i, i * 2, i * 3);
    }
    const banner = this.makeLabel('roomName', '#ddc799');
    place(this.scene, banner, 0, 4.8, -9.2);
  }

  private buildSpells(): void {
    for (const id of SPELL_IDS) {
      const group = this.sourceGroups[id];
      group.position.set(SOURCE_POSITIONS[id].x, 0, SOURCE_POSITIONS[id].z);
      place(group, new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.3, 8), material(0x607087)), 0, 0.1, 0);
      const robe = new THREE.Mesh(new THREE.ConeGeometry(0.33, 1.1, 8), material(id === 'force' ? 0x914e46 : 0x476997));
      place(group, robe, 0, 0.85, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), material(0xaaa6b2));
      place(group, head, 0, 1.5, 0);
      const arm = box(0.6, 0.12, 0.12, material(0xaaa6b2));
      arm.rotation.z = id === 'force' ? -0.5 : 0.5;
      place(group, arm, id === 'force' ? 0.3 : -0.3, 1.3, -0.15);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.03, 6, 28), material(COLORS[id], COLORS[id]));
      place(group, ring, 0, 1.8, 0);
      this.scene.add(group);
      const light = new THREE.PointLight(COLORS[id], 4, 5);
      light.position.copy(SOURCE_POSITIONS[id]);
      this.scene.add(light);
      this.projectiles[id].position.copy(SOURCE_POSITIONS[id]);
      this.scene.add(this.projectiles[id]);
      const text = this.makeLabel(SPELL_NAMES[id], id === 'force' ? '#ffb781' : '#89d8ff');
      place(this.spellLabels, text, group.position.x, 2.65, group.position.z);
      this.threads[id].material = new THREE.MeshBasicMaterial({ color: COLORS[id], transparent: true, opacity: 0.85 });
      this.scene.add(this.threads[id]);
    }
    this.scene.add(this.spellLabels);
    for (const id of ['anchor', 'debris', 'mechanism'] as const) {
      const pos = TARGET_POSITIONS[id];
      const text = this.makeLabel(TARGET_NAMES[id], '#b9ead7');
      place(this.targetMarkers, text, pos.x, pos.y + 0.85, pos.z);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.035, 6, 24),
        new THREE.MeshBasicMaterial({ color: TARGET_COLOR }),
      );
      ring.rotation.x = Math.PI / 2;
      place(this.targetMarkers, ring, pos.x, 0.08, pos.z);
      this.targetRings[id] = ring;
    }
    this.scene.add(this.targetMarkers);
  }

  private buildPlayer(): void {
    const coat = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 8), material(0xb2a1d1));
    place(this.player, coat, 0, 0.65, 0);
    place(this.player, new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), material(0xdaccc3)), 0, 1.2, 0);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 8), material(0x3f3559));
    place(this.player, hat, 0, 1.58, 0);
    place(this.player, box(0.18, 0.4, 0.08, material(0x81d8cf, 0x23453e)), 0, 0.86, -0.27);
    const aura = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.02, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xb8a1f2 }),
    );
    aura.rotation.x = Math.PI / 2;
    place(this.player, aura, 0, 0.02, 0);
    this.scene.add(this.player);
  }

  private resize(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    const portrait = this.camera.aspect < 0.8;
    this.camera.fov = portrait ? 80 : 58;
    this.cameraDistance = portrait ? 7.5 : 5.8;
    this.camera.updateProjectionMatrix();
  }

  reset(): void {
    this.player.position.copy(START);
    this.player.rotation.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0.42;
    this.visualTime = 0;
    this.lastSignature = '';
    this.updateCamera(1);
  }

  private canStand(x: number, z: number, state: GameState): boolean {
    if (Math.abs(x) > 5.15 || z > 9.1 || z < -9.1) return false;
    if (z < 2.55 && z > -1.55 && !(state.outcome?.safe && Math.abs(x) < 0.93)) return false;
    return this.collisions.every((obstacle) => Math.hypot(x - obstacle.x, z - obstacle.z) > obstacle.radius + 0.28);
  }

  move(x: number, y: number, seconds: number, state: GameState): void {
    if (state.phase === 'executing' || state.won) return;
    const speed = 3.2;
    const dx = (x * Math.cos(this.yaw) - y * Math.sin(this.yaw)) * speed * seconds;
    const dz = (-x * Math.sin(this.yaw) - y * Math.cos(this.yaw)) * speed * seconds;
    if (this.canStand(this.player.position.x + dx, this.player.position.z, state)) this.player.position.x += dx;
    if (this.canStand(this.player.position.x, this.player.position.z + dz, state)) this.player.position.z += dz;
    if (Math.hypot(dx, dz) > 0.001) this.player.rotation.y = Math.atan2(-dx, -dz);
  }

  orbit(x: number, y: number): void {
    this.yaw -= x;
    this.pitch = THREE.MathUtils.clamp(this.pitch + y, 0.18, 0.85);
  }

  nearestSpell(): SpellId | null {
    let nearest: SpellId | null = null;
    let distance = 2.5;
    for (const id of SPELL_IDS) {
      const d = Math.hypot(
        this.player.position.x - SOURCE_POSITIONS[id].x,
        this.player.position.z - SOURCE_POSITIONS[id].z,
      );
      if (d < distance) { nearest = id; distance = d; }
    }
    return nearest;
  }

  atExit(): boolean {
    return Math.hypot(this.player.position.x, this.player.position.z + 8) < 1.2;
  }

  private updateCamera(seconds: number): void {
    this.cameraTarget.copy(this.player.position).add(new THREE.Vector3(0, 1.15, 0));
    const horizontal = this.cameraDistance * Math.cos(this.pitch);
    this.temporaryPosition.set(
      THREE.MathUtils.clamp(this.player.position.x + Math.sin(this.yaw) * horizontal, -5.35, 5.35),
      1.15 + this.cameraDistance * Math.sin(this.pitch),
      THREE.MathUtils.clamp(this.player.position.z + Math.cos(this.yaw) * horizontal, -9.4, 14),
    );
    this.camera.position.lerp(this.temporaryPosition, this.reducedMotion ? 1 : 1 - Math.exp(-12 * seconds));
    this.camera.lookAt(this.cameraTarget);
  }

  render(state: GameState, sight: boolean, selected: SpellId | null, seconds: number): void {
    this.visualTime += seconds;
    const signature = SPELL_IDS.map((id) => `${id}:${state.spells[id].connected}:${state.spells[id].target}`).join('|');
    if (signature !== this.lastSignature) {
      for (const id of SPELL_IDS) {
        const from = SOURCE_POSITIONS[id];
        const to = TARGET_POSITIONS[state.spells[id].target];
        const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 1.1, 0));
        const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
        this.threads[id].geometry.dispose();
        this.threads[id].geometry = new THREE.TubeGeometry(curve, 28, 0.028, 5, false);
      }
      this.lastSignature = signature;
    }
    const progress = state.elapsed / EXECUTION_SECONDS;
    const outcome = evaluateOutcome(state);
    const travel = THREE.MathUtils.smoothstep(progress, 0.04, 0.52);
    for (const id of SPELL_IDS) {
      const spell = state.spells[id];
      this.threads[id].visible = sight && spell.connected;
      this.projectiles[id].visible = spell.connected;
      this.projectiles[id].position.copy(SOURCE_POSITIONS[id]).lerp(TARGET_POSITIONS[spell.target], travel);
      if (state.phase !== 'editing' && progress > 0.6) this.projectiles[id].visible = false;
      const scale = selected === id ? 1.15 : 1;
      this.sourceGroups[id].scale.setScalar(scale);
    }
    this.spellLabels.visible = sight;
    this.targetMarkers.visible = sight;
    for (const id of ['anchor', 'debris', 'mechanism'] as const) {
      const targeted = selected !== null && state.spells[selected].target === id;
      this.targetRings[id].scale.setScalar(targeted ? 1.4 : 1);
    }
    const unfold = outcome.bridgeRaised ? THREE.MathUtils.smoothstep(progress, 0.3, 0.86) : 0;
    this.bridge.rotation.x = -1.1 * (1 - unfold);
    this.bridge.rotation.z = !outcome.anchorIntact ? THREE.MathUtils.smoothstep(progress, 0.52, 0.96) * 0.5 : 0;
    this.anchor.rotation.z = !outcome.anchorIntact ? THREE.MathUtils.smoothstep(progress, 0.52, 0.8) * -1.05 : 0;
    this.anchor.position.y = !outcome.anchorIntact ? -THREE.MathUtils.smoothstep(progress, 0.52, 0.9) * 0.5 : 0;
    const debrisMotion = state.spells.motion.connected && state.spells.motion.target === 'debris';
    const debrisBurn = state.spells.force.connected && state.spells.force.target === 'debris';
    this.debris.position.copy(TARGET_POSITIONS.debris);
    if (debrisMotion) this.debris.position.x += THREE.MathUtils.smoothstep(progress, 0.4, 0.95) * 2;
    this.debris.scale.setScalar(debrisBurn ? 1 - THREE.MathUtils.smoothstep(progress, 0.5, 0.9) * 0.95 : 1);
    this.exit.visible = true;
    this.exit.children[3].scale.x = state.outcome?.safe ? 1 : 0.28;
    if (!this.reducedMotion && state.phase === 'editing') {
      this.projectiles.force.rotation.y = this.visualTime * 0.35;
      this.projectiles.motion.rotation.y = -this.visualTime * 0.35;
    }
    this.updateCamera(seconds);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
      } else if (object instanceof THREE.Sprite) {
        object.material.map?.dispose();
        materials.add(object.material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((mat) => mat.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
