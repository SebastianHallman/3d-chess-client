import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const defaultPieceModelFiles = {
  p: "pawn.glb",
  r: "rook.glb",
  n: "knight.glb",
  b: "bishop.glb",
  q: "queen.glb",
  k: "king.glb"
};

const defaultPieceModelHeights = {
  p: 0.6,
  r: 0.7,
  n: 0.72,
  b: 0.78,
  q: 0.9,
  k: 0.95
};

export function createPieceAssets({
  pieceModelBaseUrl = "/chess-piece-models",
  pieceModelFiles = defaultPieceModelFiles,
  pieceModelHeights = defaultPieceModelHeights
} = {}) {
  const pieceMaterials = {
    w: new THREE.MeshStandardMaterial({ color: 0xf5f0e6 }),
    b: new THREE.MeshStandardMaterial({
      color: 0x5b4a3a,
      emissive: 0x3a261b,
      emissiveIntensity: 0.75
    })
  };
  let pieceModels = null;
  let pieceModelPromise = null;

  function loadPieceModels() {
    if (pieceModelPromise) {
      return pieceModelPromise;
    }
    const loader = new GLTFLoader();
    pieceModelPromise = Promise.all(
      Object.entries(pieceModelFiles).map(([type, filename]) => new Promise((resolve, reject) => {
        loader.load(
          `${pieceModelBaseUrl}/${filename}`,
          (gltf) => {
            const root = gltf.scene;
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            box.getSize(size);
            const height = size.y || 1;
            const targetHeight = pieceModelHeights[type] ?? 0.8;
            const scale = targetHeight / height;
            const baseOffset = -box.min.y * scale;
            resolve([type, { root, scale, baseOffset }]);
          },
          undefined,
          (error) => reject(error)
        );
      }))
    )
      .then((entries) => {
        pieceModels = Object.fromEntries(entries);
        return pieceModels;
      })
      .catch((error) => {
        console.warn("Piece models failed to load", error);
        pieceModels = null;
        return null;
      });
    return pieceModelPromise;
  }

  function tintModel(object, color, isDark) {
    object.traverse((child) => {
      if (!child.isMesh) {
        return;
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map((material) => {
            const next = material.clone();
            if (next.color) {
              next.color.setHex(color);
            }
            if (isDark && next.emissive) {
              next.emissive.setHex(0x1a120d);
              next.emissiveIntensity = 0.35;
            }
            return next;
          });
        } else {
          const next = child.material.clone();
          if (next.color) {
            next.color.setHex(color);
          }
          if (isDark && next.emissive) {
            next.emissive.setHex(0x1a120d);
            next.emissiveIntensity = 0.35;
          }
          child.material = next;
        }
      } else {
        child.material = new THREE.MeshStandardMaterial({
          color,
          emissive: isDark ? 0x1a120d : 0x000000,
          emissiveIntensity: isDark ? 0.35 : 0
        });
      }
      child.castShadow = false;
      child.receiveShadow = false;
    });
  }

  function createModelPiece(type, color) {
    if (!pieceModels || !pieceModels[type]) {
      return null;
    }
    const { root, scale, baseOffset } = pieceModels[type];
    const instance = root.clone(true);
    instance.scale.setScalar(scale);
    instance.position.y = baseOffset;
    tintModel(instance, pieceMaterials[color].color.getHex(), color === "b");
    instance.userData.baseY = 0.1;
    return instance;
  }

  function createPrimitivePiece(type, color) {
    const material = pieceMaterials[color];
    const group = new THREE.Group();
    let geometry;
    switch (type) {
      case "p":
        geometry = new THREE.CylinderGeometry(0.22, 0.3, 0.5, 24);
        break;
      case "r":
        geometry = new THREE.CylinderGeometry(0.32, 0.36, 0.7, 24);
        break;
      case "n":
        geometry = new THREE.CylinderGeometry(0.28, 0.34, 0.75, 24);
        break;
      case "b":
        geometry = new THREE.ConeGeometry(0.28, 0.9, 24);
        break;
      case "q":
        geometry = new THREE.ConeGeometry(0.38, 1.15, 24);
        break;
      case "k":
        geometry = new THREE.CylinderGeometry(0.34, 0.42, 1.2, 24);
        break;
      default:
        geometry = new THREE.BoxGeometry(0.4, 0.6, 0.4);
        break;
    }
    const base = new THREE.Mesh(geometry, material);
    base.castShadow = false;
    group.add(base);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.4, 0.12, 24),
      material
    );
    pedestal.position.y = -0.35;
    group.add(pedestal);

    if (type === "p") {
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), material);
      head.position.y = 0.4;
      group.add(head);
    } else if (type === "r") {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.5), material);
      cap.position.y = 0.42;
      group.add(cap);
    } else if (type === "n") {
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 0.35, 16),
        material
      );
      neck.position.y = 0.48;
      group.add(neck);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.2), material);
      head.position.set(0.08, 0.68, 0.1);
      group.add(head);
    } else if (type === "b") {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), material);
      orb.position.y = 0.5;
      group.add(orb);
    } else if (type === "q") {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), material);
      crown.position.y = 0.7;
      group.add(crown);
    } else if (type === "k") {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), material);
      crown.position.y = 0.75;
      group.add(crown);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), material);
      cross.position.y = 0.95;
      group.add(cross);
    }
    group.userData.baseY = 0.45;
    return group;
  }

  function disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          material.map?.dispose?.();
          material.dispose?.();
        }
      }
    });
  }

  return {
    pieceMaterials,
    loadPieceModels,
    createModelPiece,
    createPrimitivePiece,
    disposeObject
  };
}
