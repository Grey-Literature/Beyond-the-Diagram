import * as THREE from 'three';

export interface TextItem {
  text: string;
  x: number; // metres, device-local (centre = 0)
  y: number; // metres from bottom
  size?: number; // metres (cap height-ish)
  color?: string;
  align?: CanvasTextAlign;
  bold?: boolean;
  bg?: string; // label tape background
  mono?: boolean;
}

const cache = new Map<string, THREE.CanvasTexture>();

/** Draw printed text/silkscreen for a face of width w, height h (metres). mirror=true for rear-facing planes */
export function faceTexture(key: string, w: number, h: number, items: TextItem[], ppm = 3000): THREE.CanvasTexture {
  const k = key + JSON.stringify(items) + w + h;
  const hit = cache.get(k);
  if (hit) return hit;
  const cw = Math.min(2048, Math.ceil(w * ppm));
  const ch = Math.min(2048, Math.ceil(h * ppm));
  const sx = cw / w, sy = ch / h;
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, cw, ch);
  for (const it of items) {
    const size = (it.size ?? 0.004) * sy;
    g.font = `${it.bold ? '700' : '500'} ${size}px ${it.mono ? 'ui-monospace, Menlo, Consolas, monospace' : 'Inter, "Segoe UI", Arial, sans-serif'}`;
    g.textAlign = it.align ?? 'center';
    g.textBaseline = 'middle';
    const px = (it.x + w / 2) * sx;
    const py = ch - it.y * sy;
    if (it.bg) {
      const m = g.measureText(it.text);
      const pad = size * 0.35;
      const bw = m.width + pad * 2;
      const bx = it.align === 'left' ? px - pad : it.align === 'right' ? px - bw + pad : px - bw / 2;
      g.fillStyle = it.bg;
      g.fillRect(bx, py - size * 0.75, bw, size * 1.5);
    }
    g.fillStyle = it.color ?? '#d8dde3';
    g.fillText(it.text, px, py);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  cache.set(k, tex);
  return tex;
}

/** hexagonal perforation alpha map for doors */
export function perfTexture(): THREE.CanvasTexture {
  const k = '__perf';
  if (cache.has(k)) return cache.get(k)!;
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#000';
  const r = 12;
  for (let row = -1; row < 6; row++) {
    for (let col = -1; col < 6; col++) {
      const x = col * 32 + (row % 2 ? 16 : 0);
      const y = row * 28;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
      }
      g.closePath();
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(k, t);
  return t;
}

export function gridTexture(tile: string, line: string, px = 256, lw = 3): THREE.CanvasTexture {
  const k = `grid${tile}${line}${px}`;
  if (cache.has(k)) return cache.get(k)!;
  const cv = document.createElement('canvas');
  cv.width = px;
  cv.height = px;
  const g = cv.getContext('2d')!;
  g.fillStyle = tile;
  g.fillRect(0, 0, px, px);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * px, Math.random() * px, 3, 3);
  }
  g.strokeStyle = line;
  g.lineWidth = lw;
  g.strokeRect(0, 0, px, px);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(k, t);
  return t;
}

/** vented mesh pattern (dark holes) for chassis faces */
export function ventTexture(): THREE.CanvasTexture {
  const k = '__vent';
  if (cache.has(k)) return cache.get(k)!;
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#3a3f46';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#0c0d0f';
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.beginPath();
    g.arc(x * 16 + 8 + (y % 2 ? 4 : 0), y * 16 + 8, 5, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(k, t);
  return t;
}

export const MAT = {
  chassis: new THREE.MeshStandardMaterial({ color: '#2a2e35', metalness: 0.5, roughness: 0.55 }),
  chassisLight: new THREE.MeshStandardMaterial({ color: '#8a9099', metalness: 0.6, roughness: 0.45 }),
  steel: new THREE.MeshStandardMaterial({ color: '#b7bcc4', metalness: 0.75, roughness: 0.35 }),
  zinc: new THREE.MeshStandardMaterial({ color: '#9aa1aa', metalness: 0.8, roughness: 0.4 }),
  black: new THREE.MeshStandardMaterial({ color: '#141518', metalness: 0.2, roughness: 0.7 }),
  hole: new THREE.MeshStandardMaterial({ color: '#050506', metalness: 0, roughness: 1 }),
  pcb: new THREE.MeshStandardMaterial({ color: '#1f5c3a', metalness: 0.1, roughness: 0.6 }),
  pcbBlue: new THREE.MeshStandardMaterial({ color: '#1e3f6e', metalness: 0.1, roughness: 0.6 }),
  pcbMobo: new THREE.MeshStandardMaterial({ color: '#23452f', metalness: 0.1, roughness: 0.7 }),
  chip: new THREE.MeshStandardMaterial({ color: '#1b1c1f', metalness: 0.3, roughness: 0.5 }),
  gold: new THREE.MeshStandardMaterial({ color: '#c9a64a', metalness: 0.9, roughness: 0.3 }),
  alu: new THREE.MeshStandardMaterial({ color: '#c6ccd3', metalness: 0.85, roughness: 0.3 }),
  plastic: new THREE.MeshStandardMaterial({ color: '#202226', metalness: 0.05, roughness: 0.8 }),
  shroud: new THREE.MeshStandardMaterial({ color: '#1a1b1e', metalness: 0.05, roughness: 0.9, transparent: true, opacity: 0.92 }),
  blue: new THREE.MeshStandardMaterial({ color: '#2f6fb8', metalness: 0.2, roughness: 0.5 }),
  touch: new THREE.MeshStandardMaterial({ color: '#2f6fb8', metalness: 0.1, roughness: 0.6 }), // blue touch points
  terracotta: new THREE.MeshStandardMaterial({ color: '#c2562b', metalness: 0.1, roughness: 0.6 }), // hot-swap touch points
  ledGreen: new THREE.MeshBasicMaterial({ color: '#35ff6b' }),
  ledAmber: new THREE.MeshBasicMaterial({ color: '#ffb020' }),
  ledBlue: new THREE.MeshBasicMaterial({ color: '#4aa8ff' }),
  ledOff: new THREE.MeshStandardMaterial({ color: '#2a2d2a', roughness: 0.4 }),
  hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
};

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 20);
