export const pieceSets = {
  classic: { label: "Classic", baseUrl: "/chess-piece-models" },
  d1sabl3d: {
    label: "D1sabl3d",
    baseUrl: "/chess-piece-models/d1sabl3d",
    rotations: { n: -Math.PI / 2 },
    heights: { p: 44.691 / 57, r: 57.5 / 57, n: 62.489 / 57,
      b: 68.171 / 57, q: 73.099 / 57, k: 83 / 57 }
  }
};

export function getSavedPieceSet() {
  try {
    const saved = localStorage.getItem("chess-piece-set");
    return Object.hasOwn(pieceSets, saved) ? saved : "classic";
  } catch {
    return "classic";
  }
}
