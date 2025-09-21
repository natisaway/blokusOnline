
// 90° rotation around original spot
export const rotate90 = (shape) => shape.map(([x,y]) => [-y, x]);

// Reflections/flipping
export const flipX = (shape) => { const m = Math.max(...shape.map(s=>s[0])); return shape.map(([x,y]) => [m-x, y]); };
export const flipY = (shape) => { const m = Math.max(...shape.map(s=>s[1])); return shape.map(([x,y]) => [x, m-y]); };

// Normalize normalization :D
export const normalize = (shape) => {
  const minX = Math.min(...shape.map(s=>s[0])); const minY = Math.min(...shape.map(s=>s[1]));
  return shape.map(([x,y]) => [x-minX, y-minY]);
};
// Bounds for shape and layout checks
export const bounds = (shape) => {
  const xs = shape.map(s=>s[0]), ys = shape.map(s=>s[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
};
