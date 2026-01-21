import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function createSceneCore({
  canvas,
  cameraPositions,
  cameraTargets,
  cameraSide,
  boardSize,
  squareSize,
  lightSquare,
  darkSquare,
  createLabelSprite,
  boardToWorld,
  coordsToSquare,
  updateBoardLabelsForColor,
  boardSquaresById
}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf2efe9);

  const tableGroup = new THREE.Group();
  scene.add(tableGroup);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.copy(cameraPositions[cameraSide]);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(cameraTargets[cameraSide]);
  controls.enableRotate = false;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
  keyLight.position.set(8, 12, 6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.7);
  fillLight.position.set(-6, 8, -4);
  scene.add(fillLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcab38a, 0.5);
  hemiLight.position.set(0, 10, 0);
  scene.add(hemiLight);

  const boardGroup = new THREE.Group();
  for (let z = 0; z < boardSize; z += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      const isDark = (x + z) % 2 === 1;
      const square = new THREE.Mesh(
        new THREE.BoxGeometry(squareSize, 0.15, squareSize),
        isDark ? darkSquare : lightSquare
      );
      square.position.set(
        x - boardSize / 2 + squareSize / 2,
        0,
        z - boardSize / 2 + squareSize / 2
      );
      const rank = boardSize - 1 - z;
      const squareId = coordsToSquare(x, rank);
      square.userData = { file: x, rank, type: "square", isDark, squareId };
      boardSquaresById.set(squareId, square);
      boardGroup.add(square);
    }
  }
  const boardBase = new THREE.Mesh(
    new THREE.BoxGeometry(boardSize + 0.8, 0.4, boardSize + 0.8),
    new THREE.MeshStandardMaterial({ color: 0x4a3523 })
  );
  boardBase.position.y = -0.25;
  boardBase.userData = { type: "base" };
  boardGroup.add(boardBase);
  tableGroup.add(boardGroup);

  const labelsGroup = new THREE.Group();
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  for (let file = 0; file < boardSize; file += 1) {
    const label = createLabelSprite(files[file]);
    label.userData.kind = "file";
    label.userData.index = file;
    const { x } = boardToWorld(file, 0);
    label.position.set(x, 0.25, boardSize / 2 + 0.7);
    labelsGroup.add(label);
  }
  for (let rank = 0; rank < boardSize; rank += 1) {
    const label = createLabelSprite(String(rank + 1));
    label.userData.kind = "rank";
    label.userData.index = rank;
    const { z } = boardToWorld(0, rank);
    label.position.set(-boardSize / 2 - 0.7, 0.25, z);
    labelsGroup.add(label);
  }
  tableGroup.add(labelsGroup);
  updateBoardLabelsForColor(cameraSide === "black" ? "b" : "w");

  const piecesGroup = new THREE.Group();
  tableGroup.add(piecesGroup);

  const capturedWhiteGroup = new THREE.Group();
  const capturedBlackGroup = new THREE.Group();
  tableGroup.add(capturedWhiteGroup);
  tableGroup.add(capturedBlackGroup);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0xe8e3da })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  scene.add(ground);

  return {
    renderer,
    scene,
    tableGroup,
    camera,
    controls,
    boardGroup,
    labelsGroup,
    piecesGroup,
    capturedWhiteGroup,
    capturedBlackGroup
  };
}
