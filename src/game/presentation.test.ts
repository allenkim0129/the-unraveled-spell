import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CharacterSprite, facingForMovement, setFrame } from './character';
import { createBirdEyeCamera, fitBirdEyeCamera } from './view';

describe('fixed bird-eye framing', () => {
  it.each([
    [980, 600, { top: 30, bottom: 70, left: 30, right: 30 }],
    [412, 730, { top: 125, bottom: 170, left: 14, right: 14 }],
    [851, 303, { top: 12, bottom: 58, left: 220, right: 220 }],
  ])('fits the room inside usable space at %i by %i', (width, height, padding) => {
    const camera = createBirdEyeCamera();
    const pose = camera.matrixWorld.clone();
    fitBirdEyeCamera(camera, width, height, padding);
    expect(camera.isOrthographicCamera).toBe(true);
    expect(camera.matrixWorld.equals(pose)).toBe(true);
    for (const x of [-6.4, 6.4]) for (const z of [-10.3, 10.3]) for (const y of [-0.8, 4.2]) {
      const point = new THREE.Vector3(x, y, z).project(camera);
      const pixelX = (point.x + 1) * width / 2;
      const pixelY = (1 - point.y) * height / 2;
      expect(pixelX).toBeGreaterThanOrEqual(padding.left - 0.001);
      expect(pixelX).toBeLessThanOrEqual(width - padding.right + 0.001);
      expect(pixelY).toBeGreaterThanOrEqual(padding.top - 0.001);
      expect(pixelY).toBeLessThanOrEqual(height - padding.bottom + 0.001);
    }
    const center = new THREE.Vector3(0, 0, 0).project(camera);
    const right = new THREE.Vector3(1, 0, 0).project(camera);
    const up = new THREE.Vector3(0, 0, -1).project(camera);
    expect(right.x).toBeGreaterThan(center.x);
    expect(up.y).toBeGreaterThan(center.y);
  });
});

describe('replaceable foot-anchored sprite sheets', () => {
  it('maps each direction row and frame without rotating or moving the feet', () => {
    const camera = createBirdEyeCamera();
    const texture = new THREE.Texture();
    const sprite = new CharacterSprite(texture, camera);
    const position = sprite.mesh.position.clone();
    const orientation = sprite.mesh.quaternion.clone();
    const foot = sprite.mesh.localToWorld(new THREE.Vector3(0, 0, 0));
    expect(foot.distanceTo(position)).toBeLessThan(0.0001);
    sprite.mesh.geometry.computeBoundingBox();
    expect(sprite.mesh.geometry.boundingBox?.min.y).toBeCloseTo(0, 6);
    expect(sprite.mesh.material.depthTest).toBe(true);
    expect(sprite.mesh.material.depthWrite).toBe(true);
    expect(sprite.mesh.material.transparent).toBe(false);
    expect(sprite.mesh.material.alphaTest).toBeGreaterThan(0);
    sprite.move(-0.2, 0);
    sprite.animate(true);
    expect(texture.offset.x).toBe(0.5);
    expect(texture.offset.y).toBe(0.5);
    expect(texture.repeat.toArray()).toEqual([0.25, 0.25]);
    expect(sprite.mesh.position.equals(position)).toBe(true);
    expect(sprite.mesh.quaternion.equals(orientation)).toBe(true);
    sprite.animate(true);
    expect(texture.offset.x).toBe(0);
    sprite.move(0, -0.2);
    sprite.animate(false);
    expect(texture.offset.toArray()).toEqual([0, 0]);
    sprite.reset();
    expect(texture.offset.toArray()).toEqual([0, 0.75]);
    setFrame(texture, 'right', 3);
    expect(texture.offset.toArray()).toEqual([0.75, 0.25]);
    sprite.mesh.geometry.dispose();
    sprite.mesh.material.dispose();
    texture.dispose();
  });

  it('keeps idle facing and chooses screen-aligned direction for movement', () => {
    expect(facingForMovement(0, 0, 'left')).toBe('left');
    expect(facingForMovement(-1, 0.3, 'down')).toBe('left');
    expect(facingForMovement(1, 0, 'down')).toBe('right');
    expect(facingForMovement(0, -1, 'down')).toBe('up');
    expect(facingForMovement(0, 1, 'up')).toBe('down');
  });
});
