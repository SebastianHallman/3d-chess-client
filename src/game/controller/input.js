import * as THREE from "three";

export function getPointerFromEvent(event, pointer, renderer) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return pointer;
}

export function pickSquare(pointer, { camera, boardGroup }) {
  if (!camera || !boardGroup) {
    return null;
  }
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(boardGroup.children);
  const hit = hits.find((entry) => entry.object.userData?.type === "square");
  return hit ? hit.object : null;
}

export function findPieceRoot(object) {
  let current = object;
  while (current) {
    if (current.userData?.squareId) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

export function pickPiece(pointer, { camera, piecesGroup }) {
  if (!camera || !piecesGroup) {
    return null;
  }
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(piecesGroup.children, true);
  for (const hit of hits) {
    const root = findPieceRoot(hit.object);
    if (root) {
      return root;
    }
  }
  return null;
}

export function getDragIntersection(pointer, height, camera) {
  if (!camera) {
    return null;
  }
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height);
  const hit = new THREE.Vector3();
  const hasHit = raycaster.ray.intersectPlane(plane, hit);
  return hasHit ? hit : null;
}
