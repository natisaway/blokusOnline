const TEXTURE_PATHS = {
  red: "images/piece4.PNG",
  blue: "images/piece2.PNG",
  yellow: "images/piece3.PNG",
  green: "images/piece1.PNG",
};

export async function loadTextures() {
  const images = {};
  await Promise.all(Object.entries(TEXTURE_PATHS).map(async ([key, src]) => {
    const img = new Image(); img.src = src;
    try { await img.decode(); } catch { await new Promise(r => img.onload = r); }
    images[key] = img;
  }));
  return images;
}
