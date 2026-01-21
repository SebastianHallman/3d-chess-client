import * as THREE from "three";

export function createLabelTexture(text) {
  const size = 128;
  const canvasLabel = document.createElement("canvas");
  canvasLabel.width = size;
  canvasLabel.height = size;
  const context = canvasLabel.getContext("2d");
  context.clearRect(0, 0, size, size);
  context.fillStyle = "rgba(0, 0, 0, 0)";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#2c1f16";
  context.font = "bold 64px 'Trebuchet MS'";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, size / 2, size / 2);
  const texture = new THREE.CanvasTexture(canvasLabel);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

export function createLabelSprite(text, createTexture = createLabelTexture) {
  const texture = createTexture(text);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.5, 0.5, 0.5);
  sprite.userData = { text };
  return sprite;
}

export function updateBoardLabelsForColor({
  labelsGroup,
  boardSize,
  boardToWorld,
  color,
  createTexture = createLabelTexture
}) {
  if (!labelsGroup) {
    return;
  }
  const useColor = color === "b" ? "b" : "w";
  labelsGroup.children.forEach((label) => {
    const { kind, index } = label.userData || {};
    if (kind === "file") {
      const files = useColor === "b"
        ? ["h", "g", "f", "e", "d", "c", "b", "a"]
        : ["a", "b", "c", "d", "e", "f", "g", "h"];
      const filePosIndex = useColor === "b" ? boardSize - 1 - index : index;
      label.material.map?.dispose?.();
      label.material.map = createTexture(files[index]);
      label.material.needsUpdate = true;
      const { x } = boardToWorld(filePosIndex, 0);
      const edgeZ = useColor === "b" ? -boardSize / 2 - 0.7 : boardSize / 2 + 0.7;
      label.position.set(x, 0.25, edgeZ);
    } else if (kind === "rank") {
      const ranks = useColor === "b"
        ? ["8", "7", "6", "5", "4", "3", "2", "1"]
        : ["1", "2", "3", "4", "5", "6", "7", "8"];
      const rankPosIndex = useColor === "b" ? boardSize - 1 - index : index;
      label.material.map?.dispose?.();
      label.material.map = createTexture(ranks[index]);
      label.material.needsUpdate = true;
      const { z } = boardToWorld(0, rankPosIndex);
      const edgeX = useColor === "b" ? boardSize / 2 + 0.7 : -boardSize / 2 - 0.7;
      label.position.set(edgeX, 0.25, z);
    }
  });
}
