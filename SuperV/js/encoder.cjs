'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const childProcess = require('child_process');
const zlib = require('zlib');

function number(v, min, max, name) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(name + ' must be between ' + min + ' and ' + max + '.');
  return n;
}
function backgroundRgb(o) {
  if (!/^#[0-9a-f]{6}$/i.test(o.background)) throw new Error('Invalid background colour.');
  return [1, 3, 5].map(i => parseInt(o.background.slice(i, i + 2), 16));
}
function inputArgs(o, fps) {
  const args = ['-hide_banner', '-nostdin', '-y'];
  if (o.sequence) args.push('-framerate', String(fps), '-start_number', '0');
  args.push('-i', o.input);
  return args;
}
function flattenOnBackground(rgb) {
  return ',split[fg][bg];[bg]lutrgb=r=' + rgb[0] + ':g=' + rgb[1] + ':b=' + rgb[2] + ',lut=a=255[base];[base][fg]overlay=shortest=1:format=auto';
}
// WebM: VP9 video. "RGB + alpha" keeps real, soft-edged transparency (yuva420p); the other two channels are opaque.
const WEBM_QUALITY = { high: 24, balanced: 32, small: 40 };
function buildWebmArgs(o) {
  let width = Math.round(number(o.width, 16, 4096, 'Width'));
  width -= width % 2; // yuv420p needs even dimensions
  const fps = number(o.fps, 1, 60, 'FPS');
  if (!['rgb', 'rgba', 'alpha'].includes(o.channels)) throw new Error('Invalid channels.');
  const quality = o.quality === undefined ? 'balanced' : o.quality;
  if (!Object.prototype.hasOwnProperty.call(WEBM_QUALITY, quality)) throw new Error('Invalid WebM quality.');
  const rgb = backgroundRgb(o);
  const args = inputArgs(o, fps);
  let graph = '[0:v]fps=' + fps + ':round=up,scale=' + width + ':-2:flags=lanczos,setsar=1,format=rgba';
  let pix = 'yuv420p';
  if (o.channels === 'alpha') graph += ',alphaextract,format=yuv420p[out]';
  else if (o.channels === 'rgb') graph += flattenOnBackground(rgb) + ',format=yuv420p[out]';
  else { graph += ',format=yuva420p[out]'; pix = 'yuva420p'; }
  args.push('-filter_complex', graph, '-map', '[out]', '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', pix,
    '-b:v', '0', '-crf', String(WEBM_QUALITY[quality]), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2');
  // libvpx-vp9 can only store alpha when the alt-ref frame is off.
  if (pix === 'yuva420p') args.push('-auto-alt-ref', '0', '-metadata:s:v:0', 'alpha_mode=1');
  args.push('-progress', 'pipe:1', '-f', 'webm', o.output);
  return args;
}
// Compress levels: fewer colours, a pattern dither that LZW packs well, only changed pixels stored, and a frame-rate ceiling.
const GIF_COMPRESS = {
  none: { colours: 256, dither: 'sierra2_4a', fps: 50, diff: false },
  low: { colours: 128, dither: 'sierra2_4a', fps: 50, diff: true },
  medium: { colours: 64, dither: 'bayer:bayer_scale=5', fps: 24, diff: true },
  high: { colours: 32, dither: 'bayer:bayer_scale=4', fps: 15, diff: true },
  insane: { colours: 16, dither: 'bayer:bayer_scale=3', fps: 10, diff: true },
};
function buildArgs(o) {
  if (o.format === 'webm') return buildWebmArgs(o);
  if (o.format !== undefined && o.format !== 'gif') throw new Error('Invalid export format.');
  const width = Math.round(number(o.width, 16, 4096, 'Width'));
  const level = o.compress === undefined ? 'none' : o.compress;
  if (!Object.prototype.hasOwnProperty.call(GIF_COMPRESS, level)) throw new Error('Invalid compression level.');
  const squeeze = GIF_COMPRESS[level];
  const sourceFps = number(o.fps, 1, 60, 'FPS');
  const fps = Math.min(sourceFps, squeeze.fps, 50);
  const colours = Math.min(number(o.colours, 4, 256, 'Colours'), squeeze.colours);
  const threshold = number(o.threshold, 0, 255, 'Alpha threshold');
  const loops = number(o.loop, -1, 65535, 'Loop count');
  if (!['rgb', 'rgba', 'alpha'].includes(o.channels)) throw new Error('Invalid channels.');
  const rgb = backgroundRgb(o);
  const args = inputArgs(o, sourceFps);
  let graph = '[0:v]fps=' + fps + ':round=up,scale=' + width + ':-1:flags=lanczos,setsar=1,format=rgba';
  if (o.channels === 'alpha') {
    graph += ',alphaextract[clean];';
  } else if (o.channels === 'rgb') {
    graph += flattenOnBackground(rgb) + ',format=rgb24[clean];';
  } else {
    graph += '[clean];';
  }
  graph += '[clean]split[palin][pixels];[palin]palettegen=max_colors=' + colours + (squeeze.diff ? ':stats_mode=diff' : '') + ':reserve_transparent=' + (o.channels === 'rgba' ? '1' : '0') + '[palette];[pixels][palette]paletteuse=dither=' + squeeze.dither + (squeeze.diff ? ':diff_mode=rectangle' : '') + ':alpha_threshold=' + threshold + '[gif]';
  args.push('-filter_complex', graph, '-map', '[gif]', '-an', '-loop', String(loops), '-progress', 'pipe:1', '-f', 'gif', o.output);
  return args;
}
// Ask FFmpeg whether a named encoder (for example libvpx-vp9) is built in, so a missing codec gives a clear message.
function hasEncoder(executable, name) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(executable, ['-hide_banner', '-encoders'], { windowsHide: true, timeout: 15000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(new Error('Cannot run FFmpeg. ' + err.message));
      resolve(new RegExp('^\\s*V\\S*\\s+' + name + '\\s', 'm').test(stdout));
    });
  });
}
function testEncoder(executable) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(executable, ['-version'], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(new Error('Cannot run FFmpeg. Choose a working ffmpeg.exe in SETTINGS. ' + err.message));
      if (!/^ffmpeg version/m.test(stdout)) return reject(new Error('The selected executable is not FFmpeg.'));
      resolve(stdout.split(/\r?\n/)[0]);
    });
  });
}
function makeTemp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'vk-gif-')); }
function cleanup(dir) {
  if (!dir) return;
  const resolved = path.resolve(dir), parent = path.resolve(os.tmpdir());
  if (path.dirname(resolved).toLowerCase() !== parent.toLowerCase() || !/^vk-gif-[a-z0-9]+$/i.test(path.basename(resolved))) throw new Error('Invalid temporary directory.');
  // Remove only files we created, never recursively follow another directory.
  fs.readdirSync(resolved).forEach(name => {
    if (/^frame_\d{6}\.png$/.test(name) && fs.lstatSync(path.join(resolved, name)).isFile()) fs.unlinkSync(path.join(resolved, name));
  });
  fs.rmdirSync(resolved);
}
function encode(executable, options, onProgress) {
  const token = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const temporaryOutput = options.output + '.vk-' + token + (options.format === 'webm' ? '.webm' : '.gif');
  const args = buildArgs(Object.assign({}, options, { output: temporaryOutput }));
  let child, cancelled = false;
  const promise = new Promise((resolve, reject) => {
    let stderr = '', ended = false;
    function finish(err) {
      if (ended) return; ended = true;
      if (err) { try { fs.unlinkSync(temporaryOutput); } catch (_) {} reject(err); return; }
      try {
        // Rename only after a successful complete encode; never erase an existing file on failure.
        if (fs.statSync(temporaryOutput).size === 0) throw new Error('No frames were encoded. Choose a longer source or higher frame rate.');
        fs.renameSync(temporaryOutput, options.output);
        resolve({ path: options.output, bytes: fs.statSync(options.output).size });
      } catch (e) { try { fs.unlinkSync(temporaryOutput); } catch (_) {} reject(e); }
    }
    try { child = childProcess.spawn(executable, args, { windowsHide: true, shell: false }); }
    catch (e) { finish(e); return; }
    child.stdout.on('data', chunk => { if (onProgress) onProgress(String(chunk)); });
    child.stderr.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-6000); });
    child.on('error', finish);
    child.on('close', code => finish(cancelled ? new Error('Encoding cancelled.') : code !== 0 ? new Error('FFmpeg failed: ' + stderr.slice(-1800)) : null));
  });
  return { promise, cancel: () => { cancelled = true; if (child) child.kill(); } };
}
function completePNG(filename) {
  let fd;
  try {
    fd = fs.openSync(filename, 'r');
    const size = fs.fstatSync(fd).size;
    if (size < 45) return false;
    const sig = Buffer.alloc(8), head = Buffer.alloc(8);
    if (fs.readSync(fd, sig, 0, 8, 0) !== 8 || sig.toString('hex') !== '89504e470d0a1a0a') return false;
    let offset = 8, seenData = false;
    while (offset + 12 <= size) {
      if (fs.readSync(fd, head, 0, 8, offset) !== 8) return false;
      const length = head.readUInt32BE(0), type = head.toString('ascii', 4, 8);
      if (offset === 8 && (type !== 'IHDR' || length !== 13)) return false;
      if (offset + length + 12 > size) return false;
      if (type === 'IDAT') seenData = true;
      if (type === 'IEND') return length === 0 && seenData && offset + 12 === size;
      offset += length + 12;
    }
    return false;
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'EBUSY' || e.code === 'EACCES') return false;
    throw e;
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}
function waitForPNG(filename, timeout) {
  const deadline = Date.now() + (timeout || 120000);
  return new Promise((resolve, reject) => {
    function poll() {
      try {
        if (completePNG(filename)) return resolve(filename);
        if (Date.now() >= deadline) return reject(new Error('AE did not finish writing a PNG. Enable Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network. Check for an AE render error. Missing/incomplete frame: ' + filename));
        setTimeout(poll, 20);
      } catch (e) { reject(e); }
    }
    poll();
  });
}
function validateSequence(directory, expected) {
  const count = Math.floor(number(expected, 1, 18000, 'Frame count'));
  let width = 0, height = 0;
  for (let i = 0; i < count; i++) {
    const filename = path.join(directory, 'frame_' + String(i).padStart(6, '0') + '.png');
    if (!completePNG(filename)) throw new Error('AE render is incomplete: missing or unfinished frame ' + i + '. ' + filename);
    const fd = fs.openSync(filename, 'r'), header = Buffer.alloc(26);
    try {
      if (fs.readSync(fd, header, 0, 26, 0) !== 26 || header.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('AE produced an invalid PNG: ' + filename);
    } finally { fs.closeSync(fd); }
    const w = header.readUInt32BE(16), h = header.readUInt32BE(20);
    if (!w || !h || (i && (w !== width || h !== height))) throw new Error('Rendered frames have inconsistent dimensions.');
    width = w; height = h;
  }
  return { input: path.join(directory, 'frame_%06d.png'), sequence: true, frames: count, width, height };
}
function alphaBounds(executable, sequence, onProgress) {
  const size = sequence.width * sequence.height;
  return new Promise((resolve, reject) => {
    const args = ['-hide_banner', '-nostdin', '-framerate', '1', '-start_number', '0', '-i', sequence.input,
      '-frames:v', String(sequence.frames), '-vf', 'alphaextract', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'];
    const child = childProcess.spawn(executable, args, { windowsHide: true, shell: false });
    let offset = 0, left = sequence.width, top = sequence.height, right = -1, bottom = -1, stderr = '', reported = 0;
    child.stdout.on('data', chunk => {
      for (let i = 0; i < chunk.length; i++, offset++) {
        if (!chunk[i]) continue;
        const pixel = offset % size, x = pixel % sequence.width, y = Math.floor(pixel / sequence.width);
        if (x < left) left = x; if (x > right) right = x;
        if (y < top) top = y; if (y > bottom) bottom = y;
      }
      const frame = Math.floor(offset / size);
      if (frame !== reported && onProgress) { reported = frame; onProgress(frame, sequence.frames); }
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2500); });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error('Could not measure rendered transparency: ' + stderr));
      if (offset !== size * sequence.frames) return reject(new Error('Crop measurement did not read every rendered frame.'));
      if (right < left) return reject(new Error('The selected range has no visible artwork. Nothing was cropped.'));
      resolve({ left, top, right: right + 1, bottom: bottom + 1 });
    });
  });
}

// The bundled encoder ships as gzip parts (ffmpeg.gz.000, .001 …) so every file
// stays under the size limits of GitHub and of file transfers. Join and unpack once.
function bundledParts(binDir) {
  try {
    return fs.readdirSync(binDir).filter(n => /^ffmpeg\.gz\.\d{3}$/.test(n)).sort().map(n => path.join(binDir, n));
  } catch (e) { return []; }
}
function bundledEncoderReady(binDir) {
  try { return fs.statSync(path.join(binDir, 'ffmpeg.exe')).size > 1000000; } catch (e) { return false; }
}
function unpackBundled(binDir) {
  const target = path.join(binDir, 'ffmpeg.exe');
  if (bundledEncoderReady(binDir)) return Promise.resolve(target);
  const parts = bundledParts(binDir);
  if (!parts.length) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const temp = path.join(binDir, 'ffmpeg.unpacking-' + Date.now() + '.tmp');
    const out = fs.createWriteStream(temp), gunzip = zlib.createGunzip();
    let done = false, index = 0;
    function fail(err) {
      if (done) return; done = true;
      try { out.destroy(); } catch (_) {}
      try { fs.unlinkSync(temp); } catch (_) {}
      reject(err);
    }
    function next() {
      if (index >= parts.length) { gunzip.end(); return; }
      const stream = fs.createReadStream(parts[index++]);
      stream.on('error', fail);
      stream.on('end', next);
      stream.pipe(gunzip, { end: false });
    }
    gunzip.on('error', fail);
    out.on('error', fail);
    out.on('close', () => {
      if (done) return;
      try {
        if (fs.statSync(temp).size < 1000000) throw new Error('The unpacked encoder looks incomplete.');
        fs.renameSync(temp, target);
        done = true;
        // The packed parts are only needed once; reclaim their disk space.
        parts.forEach(part => { try { fs.unlinkSync(part); } catch (_) {} });
        resolve(target);
      } catch (e) { fail(e); }
    });
    gunzip.pipe(out);
    next();
  });
}

module.exports = { hasEncoder, bundledParts, bundledEncoderReady, unpackBundled, buildArgs, testEncoder, makeTemp, cleanup, encode, validateSequence, alphaBounds, completePNG, waitForPNG };
