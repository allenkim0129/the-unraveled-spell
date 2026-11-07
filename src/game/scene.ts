import * as THREE from 'three';
import { t } from '../i18n';
import type { MessageKey } from '../i18n';
import {
  evaluateOutcome, EXECUTION_SECONDS, SPELL_IDS,
} from './state';
import type { GameState, SpellId, TargetId } from './state';
import { CASTER_LAYOUT, CharacterSprite, FAMILIAR_LAYOUT, HUMAN_LAYOUT, STUDENT_LAYOUT } from './character';
import type { Appearance, CharacterArt, CharacterRole, SpriteLayout } from './character';
import { createBirdEyeCamera, fitBirdEyeCamera } from './view';
import type { AdventureState, Interaction } from './adventure';

const FORCE_COLOR = 0xff995a;
const MOTION_COLOR = 0x65c9ff;
const TARGET_COLOR = 0x9be8c4;
const START = new THREE.Vector3(0, 0, 7);
const CASTER_POSITIONS: Record<SpellId, THREE.Vector3> = {
  force: new THREE.Vector3(-3, 0, 4.5),
  motion: new THREE.Vector3(3, 0, 4.5),
};
const SOURCE_POSITIONS: Record<SpellId, THREE.Vector3> = {
  force: new THREE.Vector3(-4.1, 2.8, 4.1),
  motion: new THREE.Vector3(2.05, 2.8, 4.1),
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
  ctx.font = 'bold 44px sans-serif';
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
  sprite.scale.set(3.1, 0.65, 1);
  return sprite;
}

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = createBirdEyeCamera();
  private player = new THREE.Group();
  private playerSprite: CharacterSprite;
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
    force: new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), material(FORCE_COLOR, FORCE_COLOR)),
    motion: new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), material(MOTION_COLOR, MOTION_COLOR)),
  };
  private sourceHalos: Record<SpellId, THREE.Mesh> = { force: new THREE.Mesh(), motion: new THREE.Mesh() };
  private wandOrigins: Record<SpellId, THREE.Mesh> = { force: new THREE.Mesh(), motion: new THREE.Mesh() };
  private targetMarkers = new THREE.Group();
  private spellLabels = new THREE.Group();
  private localizedLabels: { sprite: THREE.Sprite; key: MessageKey; color: string }[] = [];
  private targetRings: Record<TargetId, THREE.Mesh> = {
    anchor: new THREE.Mesh(),
    debris: new THREE.Mesh(),
    mechanism: new THREE.Mesh(),
  };
  private seams = new THREE.Group();
  private book = new THREE.Group();
  private memoryFragment = new THREE.Group();
  private ward = new THREE.Group();
  private creatures: { character: CharacterSprite; origin: THREE.Vector3 }[] = [];
  private people: { character: CharacterSprite; origin: THREE.Vector3; awake: boolean }[] = [];
  private resizeObserver: ResizeObserver;
  private visualTime = 0;
  private lastSignature = '';
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private collisions = [
    { x: -3, z: 4.5, radius: 0.8 },
    { x: 3, z: 4.5, radius: 0.8 },
    { x: -1.7, z: 2.7, radius: 0.65 },
    { x: 1.7, z: 2.7, radius: 0.65 },
  ];

  constructor(private host: HTMLElement, private adventure: AdventureState, private art: CharacterArt, private appearance: Appearance) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.domElement.dataset.i18nAria = 'cameraAria';
    this.renderer.domElement.dataset.view = 'fixed-bird-eye';
    this.renderer.domElement.setAttribute('aria-label', t('cameraAria'));
    this.host.append(this.renderer.domElement);
    this.host.dataset.appearance = appearance;
    this.scene.background = adventure.chapter === 'academy' ? null : new THREE.Color(0x0a101b);
    this.scene.fog = new THREE.Fog(0x0a101b, 42, 70);
    this.scene.add(new THREE.HemisphereLight(0xc7d8ff, 0x37304c, 2.4));
    const moon = new THREE.DirectionalLight(0xc7d9ff, 3.5);
    moon.position.set(-3, 12, -5);
    this.scene.add(moon);
    this.buildRoom();
    if (adventure.chapter === 'academy') this.buildSpells();
    this.buildAdventure();
    this.playerSprite = this.makeCharacter(appearance, STUDENT_LAYOUT);
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
    if (this.adventure.chapter !== 'academy') {
      this.buildJourneyRoom();
      return;
    }
    const stone = material(0x39475e);
    const edge = material(0x777993);
    const gold = material(0xb49b6c);
    const dark = material(0x1a2335);
    place(this.scene, box(12, 0.7, 7.7, stone), 0, -0.35, 6.25);
    place(this.scene, box(12, 0.7, 8.6, stone), 0, -0.35, -5.7);
    for (const z of [2.5, -1.5]) {
      place(this.scene, box(12, 0.14, 0.15, gold), 0, 0.01, z);
    }

    for (let z = -9; z <= 9; z += 1.5) {
      if (z > -1.5 && z < 2.5) continue;
      for (let x = -5; x <= 5; x += 1.5) {
        const seam = box(1.42, 0.015, 1.42, material((Math.round(x + z) % 2) ? 0x45516a : 0x3a465d));
        place(this.seams, seam, x, 0.0075, z);
      }
    }
    this.scene.add(this.seams);
    for (const x of [-5.8, 5.8]) {
      place(this.scene, box(0.35, 0.55, 20, dark), x, 0.2, 0);
      for (let z = -8; z <= 8; z += 4) {
        place(this.scene, box(0.75, 1.4, 0.75, stone), x, 0.6, z);
        place(this.scene, box(1, 0.2, 1, edge), x, 1.3, z);
        place(this.scene, box(0.16, 0.8, 0.16, gold), x + (x < 0 ? 0.42 : -0.42), 0.6, z);
        const window = box(0.04, 0.4, 1.9, material(0x375986, 0x193350));
        place(this.scene, window, x + (x < 0 ? 0.2 : -0.2), 0.32, z + 2);
      }
    }
    for (const z of [-9.8, 9.8]) place(this.scene, box(12, 1.2, 0.3, dark), 0, 0.45, z);
    // The bridge hinges around the near edge; only the resolved safe state grants a walkable floor.
    for (let i = 0; i < 8; i++) {
      const board = box(2.5, 0.17, 0.48, edge);
      place(this.bridge, board, 0, 0, -0.26 - i * 0.5);
    }
    for (const x of [-1.15, 1.15]) place(this.bridge, box(0.1, 0.15, 4, gold), x, 0.05, -2);
    this.bridge.position.set(0, -0.085, 2.5);
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
    const exitLabel = this.makeLabel('exitLabel', '#9be8c4');
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

  private buildJourneyRoom(): void {
    const memory = this.adventure.chapter === 'memory';
    const source = this.adventure.chapter === 'source';
    const ground = material(memory ? 0x827164 : source ? 0x3b3b60 : 0x334b48);
    place(this.scene, box(12, 0.7, 20, ground), 0, -0.35, 0);
    place(this.scene, box(3.5, 0.025, 19, material(memory ? 0xb89e78 : 0x76817e)), 0, 0.01, 0);
    for (const x of [-5.2, 5.2]) for (const z of [-7, -2, 3, 8]) {
      if (memory) {
        place(this.scene, box(0.7, 2.5, 0.7, material(0x806950)), x, 1.25, z);
      } else {
        place(this.scene, box(0.3, 1.7, 0.3, material(0x614e55)), x, 0.85, z);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), material(source ? 0x71587e : 0x517c74));
        place(this.scene, crown, x, 1.9, z);
      }
    }
    if (this.adventure.chapter === 'path') {
      place(this.ward, box(10.5, 1.7, 0.22, material(0x33264a, 0x221230)), 0, 0.85, 2.2);
      place(this.ward, this.makeLabel('wardAction', '#bbdcff'), 0, 2, 2.2);
      this.scene.add(this.ward);
    }
    if (source) {
      for (const x of [-3, 3]) {
        place(this.scene, box(0.8, 1, 0.8, material(0x70708e)), x, 0.5, 2);
        place(this.scene, this.makeLabel(x < 0 ? 'reasonAction' : 'motiveAction', '#dfc799'), x, 1.8, 2);
      }
      place(this.scene, new THREE.Mesh(new THREE.OctahedronGeometry(1), material(0xb686ba, 0x4e2359)), 0, 1.4, -6);
      place(this.scene, this.makeLabel('sourceAction', '#e7bbed'), 0, 3, -6);
    } else if (!memory) {
      place(this.scene, box(1.7, 2.7, 0.12, material(0x96ebcd, 0x376c61)), 0, 1.35, -8);
      place(this.scene, this.makeLabel('exitLabel', '#b9ead7'), 0, 3, -8);
    }
    if (memory) this.scene.background = null;
  }

  private buildAdventure(): void {
    const chapter = this.adventure.chapter;
    if (chapter === 'academy') {
      place(this.book, box(0.6, 0.13, 0.75, material(0xbba375, 0x473d23)), 0, 0.45, 6);
      place(this.book, this.makeLabel('bookAction', '#efdaa7'), 0, 1.4, 6);
      this.scene.add(this.book);
      this.memoryFragment.position.set(-4.2, 0, 7);
      place(this.memoryFragment, new THREE.Mesh(new THREE.OctahedronGeometry(0.28),
        material(0xe4baf5, 0x68466a)), 0, 0.5, 0);
      place(this.memoryFragment, new THREE.Mesh(new THREE.OctahedronGeometry(0.4),
        new THREE.MeshBasicMaterial({ color: 0xe4baf5, transparent: true, opacity: 0.16, depthWrite: false })), 0, 0.5, 0);
      const memoryRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0xe4baf5, transparent: true, opacity: 0.65 }));
      memoryRing.rotation.x = -Math.PI / 2;
      place(this.memoryFragment, memoryRing, 0, 0.06, 0);
      place(this.memoryFragment, this.makeLabel('memoryLabel', '#ebc1f8'), 0.2, 0.05, 1.4);
      this.scene.add(this.memoryFragment);
    }
    const positions = chapter === 'memory' ? [[0, 3], [-3, -4]] :
      chapter === 'academy' ? [[-4.2, 6], [4, -4]] : [[-3.8, 5], [3.8, -4]];
    for (const [index, [x, z]] of positions.entries()) {
      const character = this.makeCharacter(index === 0 ? 'friend' : 'backgroundStudent', HUMAN_LAYOUT);
      character.mesh.position.set(x, 0.025, z);
      this.scene.add(character.mesh);
      this.people.push({ character, origin: character.mesh.position.clone(), awake: false });
    }
    if (chapter === 'memory') place(this.scene, this.makeLabel('friendAction', '#f2d6ba'), 0, 2.3, 3);
    for (let i = 0; i < 2; i++) {
      const character = this.makeCharacter(i === 0 ? 'mintFamiliar' : 'lavenderFamiliar', FAMILIAR_LAYOUT, 1.7);
      character.mesh.position.set(i === 0 ? -2 : 2, 1.3, i === 0 ? 0 : -5);
      this.scene.add(character.mesh);
      this.creatures.push({ character, origin: character.mesh.position.clone() });
    }
  }

  getPosition(): THREE.Vector3 { return this.player.position.clone(); }
  setPosition(position: THREE.Vector3): void { this.player.position.copy(position); }

  playPlayerAction(): void { this.playerSprite.playAction(); }

  waveFriend(): void {
    if (this.adventure.chapter === 'memory' || this.adventure.restored) {
      this.people[0]?.character.face('down');
      this.people[0]?.character.playAction();
    }
  }

  interaction(state: GameState): Interaction | null {
    if (state.phase === 'executing' || this.adventure.restored) return null;
    const near = (x: number, z: number, radius = 2) =>
      Math.hypot(this.player.position.x - x, this.player.position.z - z) < radius;
    switch (this.adventure.chapter) {
      case 'academy':
        if (!this.adventure.bookFound && near(0, 6)) return 'book';
        if (!this.adventure.memorySeen && near(-4.2, 7)) return 'memory';
        return this.nearestSpell();
      case 'path': return near(0, 3.2, 2.6) ? 'ward' : null;
      case 'memory': return near(0, 3) ? 'friend' : null;
      case 'source':
        if (near(-3, 2)) return 'reason';
        if (near(3, 2)) return 'motive';
        return near(0, -6, 2.3) ? 'source' : null;
    }
  }

  private buildSpells(): void {
    for (const id of SPELL_IDS) {
      const group = this.sourceGroups[id];
      group.position.copy(CASTER_POSITIONS[id]);
      place(group, new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.3, 8), material(0x607087)), 0, 0.1, 0);
      const caster = this.makeCharacter(id === 'force' ? 'fireCaster' : 'motionCaster', CASTER_LAYOUT);
      caster.mesh.position.y = 0.27;
      group.add(caster.mesh);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.03, 6, 28),
        new THREE.MeshBasicMaterial({ color: COLORS[id], transparent: true, opacity: 0.9, toneMapped: false }));
      ring.quaternion.copy(this.camera.quaternion);
      ring.position.copy(SOURCE_POSITIONS[id]);
      this.sourceHalos[id] = ring;
      this.scene.add(ring);
      place(group, this.makeLabel(id === 'force' ? 'forceCasterLabel' : 'motionCasterLabel',
        id === 'force' ? '#ffb781' : '#89d8ff'), 0, 0.2, 1.1);
      this.scene.add(group);
      // The supplied front caster frames share a wand tip near image pixel (66, 76).
      const wandTip = caster.mesh.localToWorld(new THREE.Vector3((66 - 128) * 2.5 / 288, (276 - 76) * 2.5 / 288, 0));
      const origin = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.LineCurve3(wandTip, SOURCE_POSITIONS[id]), 1, 0.015, 6, false),
        new THREE.MeshBasicMaterial({ color: COLORS[id], transparent: true, opacity: 0.6, toneMapped: false }),
      );
      this.wandOrigins[id] = origin;
      this.scene.add(origin);
      const light = new THREE.PointLight(COLORS[id], 4, 5);
      light.position.copy(SOURCE_POSITIONS[id]);
      this.scene.add(light);
      this.projectiles[id].position.copy(SOURCE_POSITIONS[id]);
      this.scene.add(this.projectiles[id]);
      const text = this.makeLabel(id === 'force' ? 'forceLabel' : 'motionLabel', id === 'force' ? '#ffb781' : '#89d8ff');
      place(this.spellLabels, text, SOURCE_POSITIONS[id].x, SOURCE_POSITIONS[id].y + 0.75, SOURCE_POSITIONS[id].z);
      this.threads[id].material = new THREE.MeshBasicMaterial({ color: COLORS[id], transparent: true, opacity: 0.85 });
      this.scene.add(this.threads[id]);
    }
    this.scene.add(this.spellLabels);
    for (const id of ['anchor', 'debris', 'mechanism'] as const) {
      const pos = TARGET_POSITIONS[id];
      const text = this.makeLabel(id === 'anchor' ? 'anchorLabel' : id === 'debris' ? 'debrisLabel' : 'mechanismLabel', '#b9ead7');
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

  private makeCharacter(role: CharacterRole, layout: SpriteLayout, height = 2.5): CharacterSprite {
    const character = new CharacterSprite(this.art[role].clone(), this.camera, height, layout);
    character.mesh.userData.role = role;
    return character;
  }

  private buildPlayer(): void {
    this.player.add(this.playerSprite.mesh);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24),
      new THREE.MeshBasicMaterial({ color: 0x080e1a, transparent: true, opacity: 0.5, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    place(this.player, shadow, 0, 0.006, 0);
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
    const compact = window.matchMedia('(pointer: coarse), (max-width: 800px)').matches;
    const landscape = compact && window.innerHeight <= 620;
    fitBirdEyeCamera(this.camera, width, height, {
      top: compact ? (landscape ? 12 : 125) : 30,
      bottom: compact ? (landscape ? 58 : 170) : 70,
      left: compact ? (landscape ? 220 : 14) : 30,
      right: compact ? (landscape ? 220 : 14) : 30,
    });
  }

  reset(): void {
    this.player.position.copy(START);
    this.playerSprite.reset();
    this.visualTime = 0;
    this.lastSignature = '';
  }

  private canStand(x: number, z: number, state: GameState): boolean {
    if (Math.abs(x) > 5.15 || z > 9.1 || z < -9.1) return false;
    if (this.adventure.chapter === 'path' && !this.adventure.lightLearned && z < 2.6) return false;
    if (this.adventure.chapter !== 'academy') return true;
    if (z < 2.55 && z > -1.55 && !(state.outcome?.safe && Math.abs(x) < 0.93)) return false;
    return this.collisions.every((obstacle) => Math.hypot(x - obstacle.x, z - obstacle.z) > obstacle.radius + 0.28);
  }

  move(x: number, y: number, seconds: number, state: GameState): void {
    if (state.phase === 'executing' || state.won || this.adventure.restored) return;
    const speed = 3.2;
    const dx = x * speed * seconds;
    const dz = -y * speed * seconds;
    const previousX = this.player.position.x;
    const previousZ = this.player.position.z;
    if (this.canStand(this.player.position.x + dx, this.player.position.z, state)) this.player.position.x += dx;
    if (this.canStand(this.player.position.x, this.player.position.z + dz, state)) this.player.position.z += dz;
    this.playerSprite.move(this.player.position.x - previousX, this.player.position.z - previousZ);
  }

  nearestSpell(): SpellId | null {
    if (this.adventure.chapter !== 'academy') return null;
    let nearest: SpellId | null = null;
    let distance = 2.5;
    for (const id of SPELL_IDS) {
      const d = Math.hypot(
        this.player.position.x - CASTER_POSITIONS[id].x,
        this.player.position.z - CASTER_POSITIONS[id].z,
      );
      if (d < distance) { nearest = id; distance = d; }
    }
    return nearest;
  }

  atExit(): boolean {
    return Math.hypot(this.player.position.x, this.player.position.z + 8) < 1.2;
  }

  private keepPlayerLegible(): void {
    const geometry = this.playerSprite.mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (!bounds) throw new Error(t('errorRendering'));
    const position = new THREE.Vector3();
    // World labels yield to the player; interaction names remain available in the HUD.
    for (const { sprite } of this.localizedLabels) {
      this.playerSprite.mesh.worldToLocal(sprite.getWorldPosition(position));
      const halfWidth = sprite.scale.x / 2 + 0.08;
      const halfHeight = sprite.scale.y / 2 + 0.08;
      sprite.visible = position.x + halfWidth < bounds.min.x || position.x - halfWidth > bounds.max.x ||
        position.y + halfHeight < bounds.min.y || position.y - halfHeight > bounds.max.y;
    }
  }

  render(state: GameState, sight: boolean, selected: SpellId | null, seconds: number): void {
    const x = this.player.position.x.toFixed(2);
    const z = this.player.position.z.toFixed(2);
    if (this.host.dataset.playerX !== x) this.host.dataset.playerX = x;
    if (this.host.dataset.playerZ !== z) this.host.dataset.playerZ = z;
    this.visualTime += seconds;
    this.book.visible = !this.adventure.bookFound;
    this.memoryFragment.visible = !this.adventure.memorySeen;
    this.host.dataset.memoryObject = this.adventure.chapter === 'academy' && !this.adventure.memorySeen ? 'fragment' : 'none';
    this.ward.visible = !this.adventure.lightLearned;
    for (const [i, { character, origin }] of this.creatures.entries()) {
      character.mesh.position.x = origin.x + Math.sin(this.visualTime * 0.65 + i) * 0.65;
      character.mesh.position.y = origin.y + Math.sin(this.visualTime * 2 + i) * 0.08;
      character.animate(!this.reducedMotion, seconds);
    }
    for (const person of this.people) {
      const { character, origin } = person;
      const awake = this.adventure.chapter === 'memory' || this.adventure.restored;
      if (awake && !person.awake) character.playAction();
      person.awake = awake;
      const previous = character.mesh.position.x;
      character.mesh.position.x = origin.x + (awake ? Math.sin(this.visualTime * 0.9) * 0.35 : 0);
      character.move(character.mesh.position.x - previous, 0);
      character.animate(awake && !this.reducedMotion, seconds);
    }
    this.playerSprite.setCasting(state.phase === 'executing');
    this.playerSprite.animate(!this.reducedMotion, seconds);
    this.host.dataset.playerClip = this.playerSprite.clip;
    this.host.dataset.playerFrame = String(this.playerSprite.frame);
    this.host.dataset.familiarFrame = String(this.creatures[0]?.character.frame ?? 0);
    this.host.dataset.humans = this.adventure.chapter === 'memory' || this.adventure.restored ? 'awake' : 'frozen';
    this.host.dataset.motionSpellShape = this.projectiles.motion.geometry.type;
    this.host.dataset.fireSpellShape = this.projectiles.force.geometry.type;
    this.keepPlayerLegible();
    if (this.adventure.chapter !== 'academy') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
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
      this.wandOrigins[id].visible = spell.connected && state.phase === 'editing';
      this.projectiles[id].position.copy(SOURCE_POSITIONS[id]).lerp(TARGET_POSITIONS[spell.target], travel);
      if (state.phase !== 'editing' && progress > 0.6) this.projectiles[id].visible = false;
      const scale = selected === id ? 1.15 : 1;
      this.sourceHalos[id].scale.setScalar(scale);
      this.projectiles[id].scale.setScalar(scale);
      const haloMaterial = this.sourceHalos[id].material;
      if (haloMaterial instanceof THREE.MeshBasicMaterial) haloMaterial.opacity = spell.connected ? 0.9 : 0.2;
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
    const textures = new Set<THREE.Texture>();
    materials.forEach((mat) => {
      if (mat instanceof THREE.MeshBasicMaterial && mat.map) textures.add(mat.map);
      mat.dispose();
    });
    textures.forEach((texture) => texture.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
