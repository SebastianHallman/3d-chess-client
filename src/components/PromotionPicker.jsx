import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const pieceModelFiles = {
  q: "queen.glb",
  r: "rook.glb",
  b: "bishop.glb",
  n: "knight.glb"
};

const pieceModelHeights = {
  q: 0.9,
  r: 0.7,
  b: 0.78,
  n: 0.72
};

const pieceColors = {
  w: { color: 0xf5f0e6, emissive: 0x000000, emissiveIntensity: 0 },
  b: { color: 0x5b4a3a, emissive: 0x1a120d, emissiveIntensity: 0.35 }
};

function tintModel(object, { color, emissive, emissiveIntensity }) {
  object.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      child.material = materials.map((material) => {
        const next = material.clone();
        if (next.color) {
          next.color.setHex(color);
        }
        if (next.emissive) {
          next.emissive.setHex(emissive);
          next.emissiveIntensity = emissiveIntensity;
        }
        return next;
      });
    } else {
      child.material = new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity
      });
    }
    child.castShadow = false;
    child.receiveShadow = false;
  });
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

function PromotionModel({ piece, color }) {
  const canvasRef = useRef(null);
  const palette = pieceColors[color === "b" ? "b" : "w"];
  const filename = pieceModelFiles[piece];
  const targetHeight = pieceModelHeights[piece] ?? 0.8;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !filename) {
      return undefined;
    }
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    camera.position.set(0, 1.2, 2.4);
    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2, 3, 3);
    scene.add(key);

    let model = null;
    let frame = null;
    const loader = new GLTFLoader();

    const resize = () => {
      const width = canvas.clientWidth || 72;
      const height = canvas.clientHeight || 72;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    loader.load(
      `/chess-piece-models/${filename}`,
      (gltf) => {
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const height = size.y || 1;
        const scale = targetHeight / height;
        const baseOffset = -box.min.y * scale;
        model.scale.setScalar(scale);
        model.position.y = baseOffset;
        tintModel(model, palette);
        scene.add(model);
      },
      undefined,
      () => {}
    );

    const animate = () => {
      if (model) {
        model.rotation.y += 0.012;
      }
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      if (model) {
        disposeObject(model);
      }
      renderer.dispose();
    };
  }, [filename, palette, targetHeight]);

  return <canvas className="promotion-canvas" ref={canvasRef} />;
}

export default function PromotionPicker({ request, onPick, onCancel }) {
  const options = useMemo(() => request?.options || [], [request]);
  const color = request?.color || "w";

  return (
    <div className="promotion-overlay">
      <div className="promotion-card">
        <div className="promotion-title">Choose promotion</div>
        <div className="promotion-options">
          {options.map((piece) => (
            <button
              key={`promo-${piece}`}
              className="promotion-option"
              type="button"
              onClick={() => onPick(piece)}
            >
              <PromotionModel piece={piece} color={color} />
              <span className="promotion-option-label">{piece.toUpperCase()}</span>
            </button>
          ))}
        </div>
        <button className="promotion-cancel" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
