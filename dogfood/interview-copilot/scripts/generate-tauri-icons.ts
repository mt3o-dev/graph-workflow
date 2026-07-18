/**
 * Generates placeholder PNG icons under src-tauri/icons/ so `tauri build`
 * (run elsewhere — see docs/deferred-verification.md) has real, valid PNG
 * files to bundle instead of missing paths. These are solid-color 1x1-pixel-
 * scaled placeholders, NOT a designed app icon; replace them with a real
 * icon (e.g. via `pnpm tauri icon <source.png>`) before shipping.
 *
 * Not part of the pnpm test/typecheck/build pipeline — run manually:
 *   pnpm tsx scripts/generate-tauri-icons.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'src-tauri', 'icons');

/** Minimal, dependency-free 8-bit RGBA PNG encoder for a solid-color square. */
function solidColorPng(size: number, [r, g, b, a]: [number, number, number, number]): Buffer {
	const crcTable = (() => {
		const table = new Uint32Array(256);
		for (let n = 0; n < 256; n++) {
			let c = n;
			for (let k = 0; k < 8; k++) {
				c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			}
			table[n] = c >>> 0;
		}
		return table;
	})();
	function crc32(buf: Buffer): number {
		let c = 0xffffffff;
		for (const byte of buf) {
			c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
		}
		return (c ^ 0xffffffff) >>> 0;
	}
	function chunk(type: string, data: Buffer): Buffer {
		const len = Buffer.alloc(4);
		len.writeUInt32BE(data.length, 0);
		const typeBuf = Buffer.from(type, 'ascii');
		const crcBuf = Buffer.alloc(4);
		crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
		return Buffer.concat([len, typeBuf, data, crcBuf]);
	}

	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

	const ihdrData = Buffer.alloc(13);
	ihdrData.writeUInt32BE(size, 0);
	ihdrData.writeUInt32BE(size, 4);
	ihdrData[8] = 8; // bit depth
	ihdrData[9] = 6; // color type: RGBA
	ihdrData[10] = 0;
	ihdrData[11] = 0;
	ihdrData[12] = 0;
	const ihdr = chunk('IHDR', ihdrData);

	const rowBytes = size * 4;
	const raw = Buffer.alloc((rowBytes + 1) * size);
	for (let y = 0; y < size; y++) {
		const rowStart = y * (rowBytes + 1);
		raw[rowStart] = 0; // filter type: none
		for (let x = 0; x < size; x++) {
			const px = rowStart + 1 + x * 4;
			raw[px] = r;
			raw[px + 1] = g;
			raw[px + 2] = b;
			raw[px + 3] = a;
		}
	}
	const idat = chunk('IDAT', deflateSync(raw));
	const iend = chunk('IEND', Buffer.alloc(0));

	return Buffer.concat([signature, ihdr, idat, iend]);
}

const brandColor: [number, number, number, number] = [0x2b, 0x59, 0xff, 0xff]; // placeholder blue, opaque

const targets: Array<{ file: string; size: number }> = [
	{ file: '32x32.png', size: 32 },
	{ file: '128x128.png', size: 128 },
	{ file: '128x128@2x.png', size: 256 },
	{ file: 'icon.png', size: 512 }
];

mkdirSync(iconsDir, { recursive: true });
for (const { file, size } of targets) {
	writeFileSync(join(iconsDir, file), solidColorPng(size, brandColor));
	console.log(`wrote ${join('src-tauri', 'icons', file)} (${size}x${size} placeholder)`);
}
