/**
 * STK500v1 programmer for AVR bootloader flashing over WebSerial.
 *
 * Protocol reference: Atmel AVR061 — STK500 Communication Protocol
 * Boards: Arduino Uno R3, Nano, Mega 2560 (Optiboot / STK500v1)
 *
 * Critical design note:
 *   WebSerial's ReadableStreamDefaultReader queues read() calls.
 *   If a read times out and is abandoned, the pending promise stays
 *   in the queue and silently steals future bytes.  To avoid this we
 *   run a single background read loop that pushes into a buffer, and
 *   all higher-level reads consume from that buffer.
 */

import { parseIntelHex } from "./intelHex";

// ── STK500v1 Constants ──────────────────────────────────────────
const STK_OK             = 0x10;
const STK_INSYNC         = 0x14;
const CRC_EOP            = 0x20;

const CMD_GET_SYNC       = 0x30;
const CMD_ENTER_PROGMODE  = 0x50;
const CMD_LEAVE_PROGMODE  = 0x51;
const CMD_LOAD_ADDRESS   = 0x55;
const CMD_PROG_PAGE      = 0x64;
const CMD_READ_SIGN      = 0x75;

const BAUD_RATE  = 115200;
const PAGE_SIZE  = 128;

// ── Buffered Serial I/O ─────────────────────────────────────────
//
// A single background loop calls reader.read() and pushes bytes
// into rxBuf.  Higher-level code pulls from rxBuf with timeouts,
// with no risk of orphaned pending reads.

let port_: any = null;
let writer_: WritableStreamDefaultWriter<Uint8Array> | null = null;
let reader_: ReadableStreamDefaultReader<Uint8Array> | null = null;
let rxBuf: number[] = [];
let loopRunning = false;

/** Callback set by `consumeBytes` when it's waiting for data. */
let notifyRx: (() => void) | null = null;

function launchReadLoop() {
  loopRunning = true;
  (async () => {
    while (loopRunning && reader_) {
      try {
        const { value, done } = await reader_!.read();
        if (done) break;
        if (value) {
          for (const b of value) rxBuf.push(b);
          if (notifyRx) { const cb = notifyRx; notifyRx = null; cb(); }
        }
      } catch {
        break;
      }
    }
    loopRunning = false;
  })();
}

async function send(data: number[]) {
  if (!writer_) throw new Error("Writer not initialised");
  await writer_.write(new Uint8Array(data));
}

/**
 * Consume exactly `count` bytes from the receive buffer.
 * Blocks up to `timeoutMs` ms waiting for data.
 */
async function consumeBytes(count: number, timeoutMs: number = 1500): Promise<Uint8Array> {
  const out = new Uint8Array(count);
  let got = 0;
  const deadline = Date.now() + timeoutMs;

  while (got < count) {
    // Pull whatever is available
    while (got < count && rxBuf.length > 0) {
      out[got++] = rxBuf.shift()!;
    }
    if (got >= count) return out;

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error(`Timeout: wanted ${count} B, got ${got}`);
    }

    // Wait for the read loop to push more data (or timeout)
    // JS is single-threaded so no race between the buffer check above
    // and the callback assignment below.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { notifyRx = null; reject(new Error("Timeout")); }, remaining);
      if (rxBuf.length > 0) { clearTimeout(timer); resolve(); return; }
      notifyRx = () => { clearTimeout(timer); resolve(); };
    });
  }
  return out;
}

function drainRx() { rxBuf = []; }

function releaseIO() {
  loopRunning = false;
  notifyRx = null;
  try { reader_?.releaseLock(); } catch {}
  try { writer_?.releaseLock(); } catch {}
  reader_ = null;
  writer_ = null;
  rxBuf = [];
}

// ── STK500 command helpers ──────────────────────────────────────

async function stkCommand(cmd: number[], timeoutMs = 1500): Promise<Uint8Array> {
  await send([...cmd, CRC_EOP]);
  const r = await consumeBytes(2, timeoutMs);
  if (r[0] !== STK_INSYNC) throw new Error(`Expected INSYNC, got 0x${r[0].toString(16)}`);
  if (r[1] !== STK_OK)     throw new Error(`Expected OK, got 0x${r[1].toString(16)}`);
  return r;
}

async function stkCommandWithData(cmd: number[], dataLen: number): Promise<Uint8Array> {
  await send([...cmd, CRC_EOP]);
  const hdr = await consumeBytes(1);
  if (hdr[0] !== STK_INSYNC) throw new Error(`Expected INSYNC, got 0x${hdr[0].toString(16)}`);
  const data = await consumeBytes(dataLen);
  const ftr  = await consumeBytes(1);
  if (ftr[0] !== STK_OK) throw new Error(`Expected OK, got 0x${ftr[0].toString(16)}`);
  return data;
}

// ── Protocol steps ──────────────────────────────────────────────

async function resetBoard(log: (m: string) => void) {
  log("[STK500] Resetting board via DTR pulse...");
  try {
    // Ensure DTR starts de-asserted
    await port_.setSignals({ dataTerminalReady: false, requestToSend: false });
    await sleep(100);
    // Assert DTR → falling edge through 100 nF cap → RESET pulse
    await port_.setSignals({ dataTerminalReady: true, requestToSend: false });
    await sleep(50);
    // De-assert to complete the pulse
    await port_.setSignals({ dataTerminalReady: false, requestToSend: false });
    // Let Optiboot initialise (~65 ms typical)
    await sleep(120);
  } catch {
    log("[STK500] DTR not available — press RESET on the board now!");
    await sleep(3000);
  }
}

async function trySync(log: (m: string) => void, attempts = 6): Promise<boolean> {
  for (let i = 1; i <= attempts; i++) {
    log(`[STK500] Sync attempt ${i}/${attempts}...`);
    try {
      await send([CMD_GET_SYNC, CRC_EOP]);
      const r = await consumeBytes(2, 350);
      if (r[0] === STK_INSYNC && r[1] === STK_OK) {
        log("[STK500] ✓ Bootloader sync established");
        return true;
      }
      log(`[STK500]   Got 0x${r[0].toString(16)} 0x${r[1].toString(16)}`);
    } catch {
      // timeout — try again
    }
    await sleep(20);
  }
  return false;
}

// ── Public API ──────────────────────────────────────────────────

export async function flashSTK500(
  port: any,
  hexData: string,
  onProgress: (msg: string) => void,
) {
  releaseIO();
  port_ = port;

  try {
    onProgress("[STK500] Parsing Intel HEX data...");
    const binary = parseIntelHex(hexData);
    onProgress(`[STK500] Binary size: ${binary.length} bytes (${(binary.length / 1024).toFixed(1)} KB)`);

    // Open the port
    if (!port.readable || !port.writable) {
      onProgress(`[STK500] Opening port at ${BAUD_RATE} baud...`);
      await port.open({ baudRate: BAUD_RATE });
    }

    // Acquire reader/writer and start background read loop
    writer_ = port.writable.getWriter();
    reader_ = port.readable.getReader();
    launchReadLoop();

    // ── Reset + sync (up to 3 reset cycles) ──
    let synced = false;
    for (let cycle = 0; cycle < 3 && !synced; cycle++) {
      if (cycle > 0) onProgress(`[STK500] Re-trying reset (${cycle + 1}/3)...`);
      drainRx();
      await resetBoard(onProgress);
      drainRx();
      synced = await trySync(onProgress, 6);
    }
    if (!synced) {
      throw new Error(
        "Could not sync with bootloader.\n" +
        "• Check that the correct board is selected\n" +
        "• Use a data-capable USB cable\n" +
        "• Close any other serial software"
      );
    }

    // Read signature (informational)
    try {
      onProgress("[STK500] Reading device signature...");
      const sig = await stkCommandWithData([CMD_READ_SIGN], 3);
      onProgress(`[STK500] Signature: ${[...sig].map(b => "0x" + b.toString(16).padStart(2, "0")).join(" ")}`);
    } catch { onProgress("[STK500] ⚠ Signature read failed (non-fatal)"); }

    // Enter programming mode
    onProgress("[STK500] Entering programming mode...");
    await stkCommand([CMD_ENTER_PROGMODE]);
    onProgress("[STK500] ✓ Programming mode active");

    // Write pages
    const totalPages = Math.ceil(binary.length / PAGE_SIZE);
    onProgress(`[STK500] Writing ${totalPages} pages (${PAGE_SIZE}B each)...`);

    for (let pg = 0; pg < totalPages; pg++) {
      const off = pg * PAGE_SIZE;
      const wordAddr = off >> 1;

      let page = binary.slice(off, off + PAGE_SIZE);
      if (page.length < PAGE_SIZE) {
        const padded = new Uint8Array(PAGE_SIZE);
        padded.fill(0xFF);
        padded.set(page);
        page = padded;
      }
      if (page.every(b => b === 0xFF)) continue;

      // Load address
      await stkCommand([CMD_LOAD_ADDRESS, wordAddr & 0xFF, (wordAddr >> 8) & 0xFF]);

      // Program page
      const szHi = (page.length >> 8) & 0xFF;
      const szLo = page.length & 0xFF;
      await send([CMD_PROG_PAGE, szHi, szLo, 0x46, ...Array.from(page), CRC_EOP]);
      const pr = await consumeBytes(2, 5000);
      if (pr[0] !== STK_INSYNC || pr[1] !== STK_OK) {
        throw new Error(`Page write failed at offset ${off}`);
      }

      const pct = Math.round(((pg + 1) / totalPages) * 100);
      if (pct % 10 === 0 || pg === totalPages - 1) {
        onProgress(`[Flash] Writing... ${pct}% (${((pg + 1) * PAGE_SIZE / 1024).toFixed(1)}KB / ${(binary.length / 1024).toFixed(1)}KB)`);
      }
    }

    // Leave programming mode
    onProgress("[STK500] Leaving programming mode...");
    await stkCommand([CMD_LEAVE_PROGMODE]);

    onProgress("[Flash] ✓ Complete! Device resetting...");
    releaseIO();

    // Final hard reset
    try {
      await port.setSignals({ dataTerminalReady: true, requestToSend: false });
      await sleep(50);
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    } catch {}

  } catch (e: any) {
    onProgress(`[Error] STK500: ${e.message}`);
    releaseIO();
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
