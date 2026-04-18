/**
 * Intel HEX format parser.
 * Converts Intel HEX string data into a flat Uint8Array binary.
 */

interface HexRecord {
  byteCount: number;
  address: number;
  type: number;
  data: Uint8Array;
  checksum: number;
}

function parseHexLine(line: string): HexRecord | null {
  line = line.trim();
  if (!line.startsWith(':')) return null;
  const hex = line.slice(1);
  if (hex.length < 10) return null;

  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }

  const byteCount = bytes[0];
  const address = (bytes[1] << 8) | bytes[2];
  const type = bytes[3];
  const data = new Uint8Array(bytes.slice(4, 4 + byteCount));
  const checksum = bytes[bytes.length - 1];

  // Verify checksum
  let sum = 0;
  for (let i = 0; i < bytes.length - 1; i++) sum += bytes[i];
  const expected = ((~sum & 0xFF) + 1) & 0xFF;
  if (expected !== checksum) {
    console.warn(`HEX checksum mismatch on line: ${line}`);
  }

  return { byteCount, address, type, data, checksum };
}

/**
 * Parse Intel HEX string into a flat binary Uint8Array.
 * Handles record types 00 (data), 01 (EOF), 02 (ext segment addr), 04 (ext linear addr).
 */
export function parseIntelHex(hexString: string): Uint8Array {
  const lines = hexString.split('\n');
  let baseAddress = 0;
  let maxAddress = 0;

  // First pass: determine total size
  const records: Array<{ address: number; data: Uint8Array }> = [];

  for (const line of lines) {
    const rec = parseHexLine(line);
    if (!rec) continue;

    switch (rec.type) {
      case 0x00: { // Data record
        const addr = baseAddress + rec.address;
        records.push({ address: addr, data: rec.data });
        const end = addr + rec.data.length;
        if (end > maxAddress) maxAddress = end;
        break;
      }
      case 0x01: // EOF
        break;
      case 0x02: // Extended segment address
        baseAddress = ((rec.data[0] << 8) | rec.data[1]) << 4;
        break;
      case 0x04: // Extended linear address
        baseAddress = ((rec.data[0] << 8) | rec.data[1]) << 16;
        break;
    }
  }

  // Second pass: fill buffer
  const buffer = new Uint8Array(maxAddress).fill(0xFF); // Flash default is 0xFF
  for (const { address, data } of records) {
    buffer.set(data, address);
  }

  return buffer;
}

/**
 * Convert a raw binary ArrayBuffer into an Intel HEX string.
 */
export function binaryToIntelHex(data: ArrayBuffer): string {
  const view = new Uint8Array(data);
  const RECORD_SIZE = 16;
  const lines: string[] = [];

  for (let offset = 0; offset < view.length; offset += RECORD_SIZE) {
    const chunk = view.slice(offset, Math.min(offset + RECORD_SIZE, view.length));
    const byteCount = chunk.length;
    const addrHi = (offset >> 8) & 0xFF;
    const addrLo = offset & 0xFF;
    let sum = byteCount + addrHi + addrLo + 0x00;
    let dataStr = '';
    chunk.forEach(b => { dataStr += b.toString(16).padStart(2, '0').toUpperCase(); sum += b; });
    const checksum = ((~sum & 0xFF) + 1) & 0xFF;
    lines.push(`:${byteCount.toString(16).padStart(2, '0')}${addrHi.toString(16).padStart(2, '0')}${addrLo.toString(16).padStart(2, '0')}00${dataStr}${checksum.toString(16).padStart(2, '0')}`.toUpperCase());
  }
  lines.push(':00000001FF');
  return lines.join('\n');
}
