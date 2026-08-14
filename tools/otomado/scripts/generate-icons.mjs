/**
 * PWA用PNGアイコンを依存ゼロで生成する（PNGエンコードを自前実装）。
 * デザインは public/icons/icon.svg と同一（紺地＋音の波紋）。
 *
 * 出力:
 *   public/icons/icon-192.png            (any, 角丸+透過)
 *   public/icons/icon-512.png            (any, 角丸+透過)
 *   public/icons/icon-512-maskable.png   (maskable, 全面塗り)
 *   public/icons/apple-touch-icon.png    (180, 全面塗り)
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const BG = [30, 64, 175] // #1e40af
const FG = [255, 255, 255]

// ---- PNG エンコード ----
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- 図形（符号付き距離場 + 1pxアンチエイリアス） ----
const aa = (d) => Math.min(1, Math.max(0, 0.5 - d))

function sdfRoundedRect(px, py, cx, cy, half, radius) {
  const qx = Math.abs(px - cx) - (half - radius)
  const qy = Math.abs(py - cy) - (half - radius)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - radius
}

const ARC_HALF_ANGLE = (55 * Math.PI) / 180

function drawIcon(size, { rounded }) {
  const s = size / 512
  const rgba = Buffer.alloc(size * size * 4)
  const dotX = 168 * s
  const dotY = 256 * s
  const dotR = 28 * s
  const arcs = [88 * s, 148 * s, 208 * s]
  const strokeHalf = 13 * s

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5

      const bgAlpha = rounded
        ? aa(sdfRoundedRect(px, py, size / 2, size / 2, size / 2, 96 * s))
        : 1

      // 白い図形までの最短距離
      const dx = px - dotX
      const dy = py - dotY
      const dist = Math.hypot(dx, dy)
      let whiteD = dist - dotR
      const angle = Math.abs(Math.atan2(dy, dx))
      for (const r of arcs) {
        let d
        if (angle <= ARC_HALF_ANGLE) {
          d = Math.abs(dist - r) - strokeHalf
        } else {
          // 端点の丸キャップ
          const ex = dotX + r * Math.cos(ARC_HALF_ANGLE)
          const ey1 = dotY - r * Math.sin(ARC_HALF_ANGLE)
          const ey2 = dotY + r * Math.sin(ARC_HALF_ANGLE)
          d = Math.min(Math.hypot(px - ex, py - ey1), Math.hypot(px - ex, py - ey2)) - strokeHalf
        }
        if (d < whiteD) whiteD = d
      }
      const whiteAlpha = aa(whiteD)

      const i = (y * size + x) * 4
      rgba[i] = Math.round(BG[0] + (FG[0] - BG[0]) * whiteAlpha)
      rgba[i + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * whiteAlpha)
      rgba[i + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * whiteAlpha)
      rgba[i + 3] = Math.round(bgAlpha * 255)
    }
  }
  return encodePng(size, rgba)
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'icon-192.png'), drawIcon(192, { rounded: true }))
writeFileSync(join(OUT_DIR, 'icon-512.png'), drawIcon(512, { rounded: true }))
writeFileSync(join(OUT_DIR, 'icon-512-maskable.png'), drawIcon(512, { rounded: false }))
writeFileSync(join(OUT_DIR, 'apple-touch-icon.png'), drawIcon(180, { rounded: false }))
console.log('icons generated in', OUT_DIR)
