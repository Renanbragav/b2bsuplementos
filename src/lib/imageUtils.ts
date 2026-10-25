/**
 * Utility functions for loading, compressing, and rendering product images safely
 * across all hosting environments (including Vercel) without CORS or tainted-canvas issues.
 */

// Cache for loaded base64 images so repeated renders/PDF/canvas calls are instantaneous
const imageCache = new Map<string, string>();

/**
 * Creates a high-fidelity SVG placeholder data URL for products without an image or when an external image fails.
 */
export function createSvgPlaceholder(name: string = 'Produto', category: string = 'Geral'): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase() || 'P';

  // Deterministic pleasant gradient colors based on name string
  const hash = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue1 = (hash * 47) % 360;
  const hue2 = (hue1 + 35) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue1}, 70%, 45%)"/>
        <stop offset="100%" stop-color="hsl(${hue2}, 80%, 30%)"/>
      </linearGradient>
    </defs>
    <rect width="300" height="300" rx="24" fill="url(#grad)"/>
    <circle cx="150" cy="130" r="60" fill="white" fill-opacity="0.15"/>
    <text x="150" y="145" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="white" text-anchor="middle" dominant-baseline="middle">${initials}</text>
    <rect x="30" y="220" width="240" height="34" rx="17" fill="white" fill-opacity="0.2"/>
    <text x="150" y="242" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="middle">${escapeXml(category.slice(0, 20))}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Loads an image from a URL or Base64 string and converts it to a safe Base64 Data URL.
 * Handles CORS issues transparently so that the image is guaranteed to render in HTML5 Canvas,
 * jsPDF, and html2canvas on Vercel or any remote domain.
 */
export async function getSafeImageBase64(imageUrl?: string, productName: string = 'Produto'): Promise<string> {
  if (!imageUrl || !imageUrl.trim()) {
    return createSvgPlaceholder(productName);
  }

  const trimmed = imageUrl.trim();

  // If already a base64 data URL, it has no CORS issues
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // Check cache
  if (imageCache.has(trimmed)) {
    return imageCache.get(trimmed)!;
  }

  // Attempt 1: Direct fetch with CORS
  try {
    const res = await fetch(trimmed, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const base64 = await blobToBase64(blob);
      if (base64) {
        imageCache.set(trimmed, base64);
        return base64;
      }
    }
  } catch {
    // Direct fetch failed (likely blocked by CORS in the browser)
  }

  // Attempt 2: Try with HTMLImageElement crossOrigin
  try {
    const dataUrl = await loadImageElementAsDataUrl(trimmed);
    if (dataUrl) {
      imageCache.set(trimmed, dataUrl);
      return dataUrl;
    }
  } catch {
    // Image element failed
  }

  // Attempt 3: Fetch via reliable CORS image proxy mirrors (essential for Vercel deployment when loading third-party supplier photos)
  const proxyUrls = [
    `https://images.weserv.nl/?url=${encodeURIComponent(trimmed)}&output=jpg&q=85&w=600`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(trimmed)}`,
  ];

  for (const proxyUrl of proxyUrls) {
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const blob = await res.blob();
        const base64 = await blobToBase64(blob);
        if (base64 && base64.startsWith('data:image/')) {
          imageCache.set(trimmed, base64);
          return base64;
        }
      }
    } catch {
      // Continue to next proxy
    }
  }

  // If all remote attempts fail, return the graceful SVG placeholder
  const fallback = createSvgPlaceholder(productName);
  imageCache.set(trimmed, fallback);
  return fallback;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImageElementAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Compresses an uploaded image file into a compact, self-contained Base64 Data URL.
 * Max dimension defaults to 800px and JPEG quality 0.82 (typically 30-70KB),
 * making it fast to persist directly in Firestore without any storage buckets.
 */
export async function compressImageFile(file: File, maxDimension: number = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(e.target?.result as string);
        }

        // Clean white background for transparent PNGs converted to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressed);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
