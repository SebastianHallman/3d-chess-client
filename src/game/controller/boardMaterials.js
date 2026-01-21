import * as THREE from "three";

export function createBoardMaterials() {
  const lightSquare = new THREE.MeshStandardMaterial({ color: 0xf1e7d0 });
  const darkSquare = new THREE.MeshStandardMaterial({ color: 0x7a5c3e });
  const moveMaterial = new THREE.MeshStandardMaterial({ color: 0xc9d8a5 });
  const hoverMaterial = new THREE.MeshStandardMaterial({ color: 0xd3b47b });
  const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0x9bb5e5 });
  const invalidMaterial = new THREE.MeshStandardMaterial({ color: 0xd66c6c });

  return {
    lightSquare,
    darkSquare,
    moveMaterial,
    hoverMaterial,
    selectedMaterial,
    invalidMaterial
  };
}
