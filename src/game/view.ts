import * as THREE from 'three';

export interface ViewPadding { top: number; right: number; bottom: number; left: number }

export function createBirdEyeCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  camera.position.set(0, 18, 26);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

export function fitBirdEyeCamera(
  camera: THREE.OrthographicCamera, width: number, height: number, padding: ViewPadding,
): void {
  const usableWidth = Math.max(width * 0.4, width - padding.left - padding.right);
  const usableHeight = Math.max(height * 0.35, height - padding.top - padding.bottom);
  const bounds = new THREE.Box3();
  // Include floor edges, raised spell labels and the exit, not just the player's position.
  for (const x of [-6.4, 6.4]) for (const z of [-10.3, 10.3]) for (const y of [-0.8, 4.2]) {
    bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
  }
  const scale = Math.min(usableWidth / (bounds.max.x - bounds.min.x), usableHeight / (bounds.max.y - bounds.min.y));
  const halfWidth = width / scale / 2;
  const halfHeight = height / scale / 2;
  const centerX = (bounds.min.x + bounds.max.x) / 2 + (padding.right - padding.left) / (2 * scale);
  const centerY = (bounds.min.y + bounds.max.y) / 2 + (padding.top - padding.bottom) / (2 * scale);
  camera.left = centerX - halfWidth;
  camera.right = centerX + halfWidth;
  camera.top = centerY + halfHeight;
  camera.bottom = centerY - halfHeight;
  camera.updateProjectionMatrix();
}
