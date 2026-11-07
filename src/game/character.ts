import * as THREE from 'three';

export type Facing = 'down' | 'left' | 'right' | 'up';
export type Appearance = 'boy' | 'girl';
export type CharacterRole = Appearance | 'fireCaster' | 'motionCaster' | 'friend' | 'backgroundStudent' | 'mintFamiliar' | 'lavenderFamiliar';
export type CharacterArt = Record<CharacterRole, THREE.Texture>;
export const FACING_ROWS: Record<Facing, number> = { down: 0, left: 1, right: 2, up: 3 };
export const FRAME_COLUMNS = 4;

export interface SpriteLayout {
  columns: number;
  rows: number;
  directions: Record<Facing, number>;
  idle: readonly number[];
  walk: readonly number[];
  action: readonly number[];
  aspect: number;
  foot: number;
  fps: number;
}

export const STUDENT_LAYOUT: SpriteLayout = {
  columns: 4, rows: 4, directions: FACING_ROWS,
  idle: [0], walk: [1, 2], action: [1, 3, 3, 0],
  aspect: 256 / 288, foot: 276 / 288, fps: 6,
};
const FRONT_ONLY: Record<Facing, number> = { down: 0, left: 0, right: 0, up: 0 };
export const HUMAN_LAYOUT: SpriteLayout = {
  ...STUDENT_LAYOUT, rows: 3, directions: { down: 0, left: 1, right: 2, up: 0 }, action: [0, 3, 3, 0],
};
export const CASTER_LAYOUT: SpriteLayout = {
  ...STUDENT_LAYOUT, columns: 1, idle: [0], walk: [0], action: [],
};
export const FAMILIAR_LAYOUT: SpriteLayout = {
  ...HUMAN_LAYOUT, rows: 1, directions: FRONT_ONLY, idle: [0, 1, 2, 3], walk: [0, 1, 2, 3], action: [],
  aspect: 320 / 288, fps: 8,
};

export const CHARACTER_FILES: Record<CharacterRole, string> = {
  boy: 'student-boy.png', girl: 'student-girl.png',
  fireCaster: 'fire-caster.png', motionCaster: 'motion-caster.png',
  friend: 'friend.png', backgroundStudent: 'background-student.png',
  mintFamiliar: 'mint-familiar.png', lavenderFamiliar: 'lavender-familiar.png',
};

export async function loadCharacterArt(): Promise<CharacterArt> {
  const loader = new THREE.TextureLoader();
  const load = async (role: CharacterRole) => {
    const texture = await loader.loadAsync(`${import.meta.env.BASE_URL}characters/${CHARACTER_FILES[role]}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  };
  const [boy, girl, fireCaster, motionCaster, friend, backgroundStudent, mintFamiliar, lavenderFamiliar] =
    await Promise.all([
      load('boy'), load('girl'), load('fireCaster'), load('motionCaster'),
      load('friend'), load('backgroundStudent'), load('mintFamiliar'), load('lavenderFamiliar'),
    ]);
  return { boy, girl, fireCaster, motionCaster, friend, backgroundStudent, mintFamiliar, lavenderFamiliar };
}

export function facingForMovement(x: number, z: number, previous: Facing): Facing {
  if (Math.hypot(x, z) < 0.0001) return previous;
  return Math.abs(x) > Math.abs(z) ? (x < 0 ? 'left' : 'right') : (z < 0 ? 'up' : 'down');
}

export function setFrame(texture: THREE.Texture, facing: Facing, frame: number, layout = STUDENT_LAYOUT): void {
  texture.repeat.set(1 / layout.columns, 1 / layout.rows);
  texture.offset.set(frame / layout.columns, 1 - (layout.directions[facing] + 1) / layout.rows);
}

export function footAnchoredGeometry(width: number, height: number, foot = 1): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(width, height).translate(0, (foot - 0.5) * height, 0);
}

export class CharacterSprite {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private facing: Facing = 'down';
  private strideDistance = 0;
  private moved = false;
  private idleTime = 0;
  private actionTime = 0;
  private actionRemaining = 0;
  private casting = false;
  clip: 'idle' | 'walk' | 'action' = 'idle';
  frame = 0;

  constructor(texture: THREE.Texture, camera: THREE.Camera, height = 2.5, private readonly layout = STUDENT_LAYOUT) {
    this.mesh = new THREE.Mesh(
      footAnchoredGeometry(height * layout.aspect, height, layout.foot),
      new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.2, depthTest: true, depthWrite: true, toneMapped: false }),
    );
    this.mesh.quaternion.copy(camera.quaternion);
    this.mesh.position.y = 0.025;
    this.mesh.name = 'foot-anchored-character';
    this.mesh.userData.clip = 'idle';
    this.animate(false);
  }

  move(dx: number, dz: number): void {
    const distance = Math.hypot(dx, dz);
    if (distance < 0.0001) return;
    this.facing = facingForMovement(dx, dz, this.facing);
    this.strideDistance += distance;
    this.moved = true;
  }

  playAction(): void {
    if (!this.layout.action.length) return;
    this.actionTime = 0;
    this.actionRemaining = this.layout.action.length / this.layout.fps;
  }

  face(facing: Facing): void {
    this.facing = facing;
  }

  setCasting(casting: boolean): void {
    if (casting && !this.casting) this.actionTime = 0;
    this.casting = casting;
  }

  animate(enabled: boolean, seconds = 0): void {
    this.idleTime += seconds;
    this.actionTime += seconds;
    this.actionRemaining = Math.max(0, this.actionRemaining - seconds);
    const acting = this.layout.action.length > 0 && (this.casting || this.actionRemaining > 0);
    const clip = acting ? 'action' : enabled && this.moved ? 'walk' : 'idle';
    const frames = this.layout[clip];
    const index = !enabled ? acting ? frames.indexOf(3) : 0 :
      clip === 'walk' ? Math.floor(this.strideDistance / 0.22) :
      Math.floor((acting ? this.actionTime : this.idleTime) * this.layout.fps);
    const frame = frames[Math.max(0, index) % frames.length];
    const texture = this.mesh.material.map;
    if (texture) setFrame(texture, this.facing, frame, this.layout);
    this.mesh.userData.clip = clip;
    this.mesh.userData.frame = frame;
    this.clip = clip;
    this.frame = frame;
    this.moved = false;
  }

  reset(): void {
    this.facing = 'down';
    this.strideDistance = this.idleTime = this.actionTime = this.actionRemaining = 0;
    this.moved = this.casting = false;
    this.animate(false);
  }
}
