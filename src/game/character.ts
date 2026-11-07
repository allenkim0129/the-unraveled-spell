import * as THREE from 'three';
import { t } from '../i18n';

export type Facing = 'down' | 'left' | 'right' | 'up';
export const FACING_ROWS: Record<Facing, number> = { down: 0, left: 1, right: 2, up: 3 };
export const FRAME_COLUMNS = 4;

export function facingForMovement(x: number, z: number, previous: Facing): Facing {
  if (Math.hypot(x, z) < 0.0001) return previous;
  return Math.abs(x) > Math.abs(z) ? (x < 0 ? 'left' : 'right') : (z < 0 ? 'up' : 'down');
}

export function setFrame(texture: THREE.Texture, facing: Facing, frame: number): void {
  texture.repeat.set(1 / FRAME_COLUMNS, 1 / 4);
  texture.offset.set(frame / FRAME_COLUMNS, 1 - (FACING_ROWS[facing] + 1) / 4);
}

export function footAnchoredGeometry(width: number, height: number): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(width, height).translate(0, height / 2, 0);
}

// Placeholder atlas: four direction rows, idle in column 0 and walking in columns 1-3.
export function createPlaceholderSheet(coat: string, trim: string, wand = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128 * FRAME_COLUMNS;
  canvas.height = 160 * 4;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(t('errorCanvas'));
  for (const [facing, row] of Object.entries(FACING_ROWS)) {
    for (let frame = 0; frame < FRAME_COLUMNS; frame++) {
      ctx.save();
      ctx.translate(frame * 128, row * 160);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#202236';
      const stride = frame === 1 ? -5 : frame === 3 ? 5 : 0;
      ctx.fillStyle = '#252338';
      ctx.fillRect(46 + stride, 137, 15, 23);
      ctx.fillRect(68 - stride, 137, 15, 23);
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.moveTo(46, 69);
      ctx.quadraticCurveTo(30, 97, 28, 138);
      ctx.quadraticCurveTo(64, 151, 100, 138);
      ctx.quadraticCurveTo(94, 91, 82, 69);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = trim;
      ctx.fillRect(58, 85, 12, 58);
      ctx.fillStyle = '#d9bdab';
      ctx.beginPath();
      ctx.ellipse(64, 53, 22, 27, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.moveTo(30, 46);
      ctx.quadraticCurveTo(37, 8, 64, 5);
      ctx.quadraticCurveTo(91, 8, 98, 46);
      ctx.lineTo(87, 59);
      ctx.quadraticCurveTo(84, 29, 64, 28);
      ctx.quadraticCurveTo(44, 29, 41, 59);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (facing === 'up') {
        ctx.fillStyle = coat;
        ctx.beginPath();
        ctx.ellipse(64, 52, 23, 28, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#29273d';
        const eyeX = facing === 'left' ? 51 : facing === 'right' ? 75 : 56;
        ctx.fillRect(eyeX, 51, 5, 7);
        if (facing === 'down') ctx.fillRect(73, 51, 5, 7);
      }
      ctx.fillStyle = trim;
      ctx.beginPath();
      ctx.moveTo(64, 76);
      ctx.lineTo(71, 85);
      ctx.lineTo(64, 94);
      ctx.lineTo(57, 85);
      ctx.closePath();
      ctx.fill();
      if (wand) {
        ctx.strokeStyle = '#f0d5a2';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(99, 128);
        ctx.lineTo(110, 78);
        ctx.stroke();
        ctx.fillStyle = trim;
        ctx.beginPath();
        ctx.arc(110, 78, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  setFrame(texture, 'down', 0);
  return texture;
}

export class CharacterSprite {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private facing: Facing = 'down';
  private strideDistance = 0;
  private moved = false;

  constructor(texture: THREE.Texture, camera: THREE.Camera, height = 1.8) {
    this.mesh = new THREE.Mesh(
      footAnchoredGeometry(height * 0.8, height),
      new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.35, depthTest: true, depthWrite: true }),
    );
    this.mesh.quaternion.copy(camera.quaternion);
    this.mesh.position.y = 0.025;
    this.mesh.name = 'foot-anchored-character';
  }

  move(dx: number, dz: number): void {
    const distance = Math.hypot(dx, dz);
    if (distance < 0.0001) return;
    this.facing = facingForMovement(dx, dz, this.facing);
    this.strideDistance += distance;
    this.moved = true;
  }

  animate(enabled: boolean): void {
    const frame = enabled && this.moved ? 1 + Math.floor(this.strideDistance / 0.18) % 3 : 0;
    const texture = this.mesh.material.map;
    if (texture) setFrame(texture, this.facing, frame);
    this.moved = false;
  }

  reset(): void {
    this.facing = 'down';
    this.strideDistance = 0;
    this.moved = false;
    this.animate(false);
  }
}
