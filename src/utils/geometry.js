// src/utils/geometry.js
// Geometry helpers for piece transforms. All transforms return shapes normalized
// to a (0,0) top-left origin so they don't drift after multiple operations.

// A shape is an array of [x, y] integer tuples, e.g. [[0,0],[1,0],[1,1]]

// 90° rotation (counter-clockwise) around origin
export const rotate90 = ([x, y]) => [-y, x];

// Mirror across X using the shape's own bounds
export const flipX = (shape) => {
  const maxX = Math.max(...shape.map(([x]) => x));
  return shape.map(([x, y]) => [maxX - x, y]);
};

// Mirror across Y using the shape's own bounds
export const flipY = (shape) => {
  const maxY = Math.max(...shape.map(([, y]) => y));
  return shape.map(([x, y]) => [x, maxY - y]);
};

// Shift shape so minX/minY become 0
export const normalize = (shape) => {
  const minX = Math.min(...shape.map(([x]) => x));
  const minY = Math.min(...shape.map(([, y]) => y));
  return shape.map(([x, y]) => [x - minX, y - minY]);
};

// Apply a single-cell transform function to each cell, then normalize
export const transform = (shape, fn) => normalize(shape.map(fn));

// (Optional) bounds helper
export const bounds = (shape) => {
  const xs = shape.map(([x]) => x);
  const ys = shape.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs) + 1,
    height: Math.max(...ys) - Math.min(...ys) + 1,
  };
};
