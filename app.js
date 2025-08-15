// ====== DOM ======
const video = document.getElementById("video");
const canvasDisp = document.getElementById("display");
const ctxDisp = canvasDisp.getContext("2d");
const canvasProc = document.getElementById("process");
const ctxProc = canvasProc.getContext("2d");

const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const colorSelect = document.getElementById("colorSelect");
const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");

// ====== State ======
let running = false;
let cvReady = false;
let lastDecoded = "";
let lastSpeakAt = 0;
const SPEAK_COOLDOWN_MS = 2500;

let qrDecoderBusy = false; // throttle decoding attempts

// ====== Helpers ======
function speak(text) {
  const now = Date.now();
  if (now - lastSpeakAt < SPEAK_COOLDOWN_MS) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  speechSynthesis.speak(u);
  lastSpeakAt = now;
}

function vibrate(ms = 200) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function getHSVRangeFor(color, rows, cols, type) {
  // ranges tuned for indoor lighting; tweak as needed
  // red wraps around hue, so we combine two masks later
  if (color === "green") {
    return [[35, 80, 80, 0], [85, 255, 255, 255]];
  }
  if (color === "blue") {
    return [[90, 80, 80, 0], [130, 255, 255, 255]];
  }
  // default red
  return [[0, 120, 80, 0], [10, 255, 255, 255]]; // low red range
}

// ====== Camera ======
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false
  });
  video.srcObject = stream;

  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      // sync canvas sizes to the video feed
      const w = video.videoWidth;
      const h = video.videoHeight;
      canvasDisp.width = w;
      canvasDisp.height = h;
      canvasProc.width = w;
      canvasProc.height = h;
      resolve();
    };
  });
}

// ====== Main loop ======
function loop() {
  if (!running) return;

  // draw current frame to both canvases
  ctxProc.drawImage(video, 0, 0, canvasProc.width, canvasProc.height);
  ctxDisp.drawImage(video, 0, 0, canvasDisp.width, canvasDisp.height);

  // only proceed if OpenCV is loaded
  if (cvReady) {
    try {
      // Read frame into OpenCV
      const src = cv.imread(canvasProc);
      const hsv = new cv.Mat();
      cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
      cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

      // Build mask by color
      const [lowA, highA] = getHSVRangeFor(colorSelect.value, hsv.rows, hsv.cols, hsv.type());
      const low1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), lowA);
      const high1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), highA);
      const mask1 = new cv.Mat();
      cv.inRange(hsv, low1, high1, mask1);

      // If color is red, also add upper hue range (170–180)
      let mask = mask1;
      if (colorSelect.value === "red") {
        const low2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [170, 120, 80, 0]);
        const high2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 255, 255]);
        const mask2 = new cv.Mat();
        cv.inRange(hsv, low2, high2, mask2);
        const combined = new cv.Mat();
        cv.bitwise_or(mask1, mask2, combined);
        mask1.delete(); mask2.delete();
        mask = combined;
        low2.delete(); high2.delete();
      }

      // Morphology to clean noise
      const ksize = new cv.Size(5, 5);
      const kernel = cv.Mat.ones(ksize.height, ksize.width, cv.CV_8U);
      cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
      cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);

      // Find contours and pick largest area
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let bestRect = null;
      let bestArea = 0;

      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area > bestArea) {
          const rect = cv.boundingRect(cnt);
          // ignore super-thin shapes to reduce false positives
          if (rect.width > 20 && rect.height > 20) {
            bestArea = area;
            bestRect = rect;
          }
        }
      }

      // Draw tracking box if found
      if (bestRect) {
        ctxDisp.lineWidth = 3;
        ctxDisp.strokeStyle = "#00ff88";
        ctxDisp.strokeRect(bestRect.x, bestRect.y, bestRect.width, bestRect.height);

        // When big enough, attempt to decode the QR from the original frame
        const minDim = Math.min(bestRect.width, bestRect.height);
        if (minDim > Math.min(canvasProc.width, canvasProc.height) * 0.18) {
          tryDecodeFromRect(bestRect);
        } else {
          statusEl.textContent = "QR in view — move closer";
        }
      } else {
        statusEl.textContent = "Scanning for colored QR…";
      }

      // Cleanup
      src.delete(); hsv.delete();
      low1.delete(); high1.delete();
      if (mask !== mask1) mask1.delete();
      mask.delete();
      kernel.delete();
      contours.delete(); hierarchy.delete();
    } catch (e) {
      // Avoid crashing the loop
      console.warn("OpenCV frame error:", e);
    }
  }

  requestAnimationFrame(loop);
}

// ====== Decoding (jsQR) ======
function tryDecodeFromRect(rect) {
  if (qrDecoderBusy) return;
  qrDecoderBusy = true;

  // crop a small padding around the rect from the *display* canvas (original frame)
  const pad = Math.round(Math.min(rect.width, rect.height) * 0.12);
  const sx = Math.max(0, rect.x - pad);
  const sy = Math.max(0, rect.y - pad);
  const sw = Math.min(canvasDisp.width - sx, rect.width + pad * 2);
  const sh = Math.min(canvasDisp.height - sy, rect.height + pad * 2);

  const imageData = ctxDisp.getImageData(sx, sy, sw, sh);
  const code = jsQR(imageData.data, sw, sh);

  if (code && code.data) {
    const decoded = String(code.data).trim();
    if (decoded !== lastDecoded) {
      lastDecoded = decoded;

      let shown = `QR: ${decoded}`;
      if (qrData[decoded]) {
        shown = qrData[decoded].text;
        speak(qrData[decoded].voice || qrData[decoded].text);
        vibrate(250);
      } else {
        speak(`QR detected: ${decoded}`);
        vibrate(120);
      }
      resultEl.textContent = shown;
      statusEl.textContent = "Decoded successfully";
    }
  } else {
    statusEl.textContent = "QR present — acquiring…";
  }

  // allow next decode attempt shortly (throttle)
  setTimeout(() => (qrDecoderBusy = false), 220);
}

// ====== Controls ======
btnStart.addEventListener("click", async () => {
  try {
    await startCamera();
    running = true;
    statusEl.textContent = "Camera ready. Scanning…";
    speak("Scanning started");
    requestAnimationFrame(loop);
  } catch (e) {
    statusEl.textContent = "Camera permission or HTTPS required.";
    console.error(e);
  }
});

btnStop.addEventListener("click", () => {
  running = false;
  statusEl.textContent = "Stopped.";
  speak("Scanning stopped");
});

// ====== OpenCV ready ======
if (window.cv && cv.onRuntimeInitialized) {
  cv.onRuntimeInitialized = () => {
    cvReady = true;
    statusEl.textContent = "OpenCV ready. Tap Start.";
  };
} else {
  // Fallback if cv loads later
  window.addEventListener("opencvready", () => {
    cvReady = true;
    statusEl.textContent = "OpenCV ready. Tap Start.";
  });
}

// ====== HTTPS reminder (important for mobile camera) ======
if (location.protocol !== "https:" && location.hostname !== "localhost") {
  statusEl.textContent = "Tip: Serve over HTTPS for camera access.";
}
