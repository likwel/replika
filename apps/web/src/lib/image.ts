function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  return new Promise<{ img: HTMLImageElement; release: () => void }>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve({ img: el, release: () => URL.revokeObjectURL(url) });
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };
    el.src = url;
  });
}

// Image d'une publication : JPEG (seul format accepté par Instagram), 2 048 px au plus sur le grand côté
export async function toPublishableJpeg(file: File, maxSide = 2048): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choisissez une image (JPG, PNG, WebP)");
  if (file.size > 25 * 1024 * 1024) throw new Error("Image trop lourde (25 Mo maximum)");
  const { img, release } = await loadImage(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Traitement de l'image impossible");
    ctx.fillStyle = "#fff"; // fond blanc pour les PNG transparents
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) throw new Error("Traitement de l'image impossible");
    return blob;
  } finally {
    release();
  }
}

// Recadre une image au centre en carré et la compresse en JPEG (photo de profil ~20-40 Ko)
export async function toAvatarDataUrl(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choisissez une image (JPG, PNG…)");
  if (file.size > 10 * 1024 * 1024) throw new Error("Image trop lourde (10 Mo maximum)");

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image illisible"));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Traitement de l'image impossible");
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size
    );
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
