// 90° rotation around origin
export const rotate90 = ([x, y]) => [-y, x];

// mirror across X
export const flipX = (shape) => {
  const maxX = Math.max(...shape.map(([x]) => x));
  return shape.map(([x, y]) => [maxX - x, y]);
};

// mirror across Y
export const flipY = (shape) => {
  const maxY = Math.max(...shape.map(([, y]) => y));
  return shape.map(([x, y]) => [x, maxY - y]);
};

// shift shape so minX/minY become 0
export const normalize = (shape) => {
  const minX = Math.min(...shape.map(([x]) => x));
  const minY = Math.min(...shape.map(([, y]) => y));
  return shape.map(([x, y]) => [x - minX, y - minY]);
};

// apply a single-cell transform function to each cell, then normalize
export const transform = (shape, fn) => normalize(shape.map(fn));

// bounds helper
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
