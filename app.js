// ====== DOM Elements ======
const video = document.getElementById("video");
const canvasDisp = document.getElementById("display");
const ctxDisp = canvasDisp.getContext("2d", { willReadFrequently: true });
const overlayText = document.getElementById("overlayText");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const colorRadios = document.querySelectorAll('input[name="color"]');

// ====== Config ======
const SCAN_SIZE = 250; // square scan box in pixels
let scanBox = { x: 0, y: 0, size: SCAN_SIZE };
let lastDecoded = "";
let qrDecoderBusy = false;
let currentColor = "red";
let cvReady = false;

// ====== Helpers ======
function speak(text) {
  if (!text) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function updateOverlayText(color) {
  overlayText.textContent = `Scanning ${color} QR Codes`;
  overlayText.style.color = color;
}

// ====== Camera ======
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();

  canvasDisp.width = video.videoWidth;
  canvasDisp.height = video.videoHeight;

  scanBox.x = (canvasDisp.width - SCAN_SIZE) / 2;
  scanBox.y = (canvasDisp.height - SCAN_SIZE) / 2;
}

// ====== OpenCV Preprocessing ======
function preprocessWithOpenCV(imageData, color) {
  if (!cvReady) return imageData;

  const src = cv.matFromImageData(imageData);
  let processed = new cv.Mat();
  cv.cvtColor(src, processed, cv.COLOR_RGBA2RGB);
  cv.cvtColor(processed, processed, cv.COLOR_RGB2HSV);

  // Define HSV ranges
  let low, high;
  if (color === "red") {
    low = new cv.Mat(processed.rows, processed.cols, processed.type(), [0, 120, 80, 0]);
    high = new cv.Mat(processed.rows, processed.cols, processed.type(), [10, 255, 255, 255]);
  } else if (color === "green") {
    low = new cv.Mat(processed.rows, processed.cols, processed.type(), [35, 50, 50, 0]);
    high = new cv.Mat(processed.rows, processed.cols, processed.type(), [85, 255, 255, 255]);
  } else if (color === "blue") {
    low = new cv.Mat(processed.rows, processed.cols, processed.type(), [90, 50, 50, 0]);
    high = new cv.Mat(processed.rows, processed.cols, processed.type(), [130, 255, 255, 255]);
  }

  const mask = new cv.Mat();
  cv.inRange(processed, low, high, mask);

  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);

  const out = new ImageData(new Uint8ClampedArray(mask.data), mask.cols, mask.rows);

  src.delete(); processed.delete(); low.delete(); high.delete(); mask.delete(); kernel.delete();

  return out;
}

// ====== QR Decoding ======
function tryDecode() {
  if (qrDecoderBusy) return;
  qrDecoderBusy = true;

  let imageData = ctxDisp.getImageData(scanBox.x, scanBox.y, scanBox.size, scanBox.size);
  imageData = preprocessWithOpenCV(imageData, currentColor);

  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });

  if (code && code.data) {
    const decoded = code.data.trim();
    console.log("Decoded QR content:", decoded);

    if (decoded !== lastDecoded) {
      lastDecoded = decoded;
      let qrInfo = null;

      // Check current color
      if (qrData[currentColor] && qrData[currentColor][decoded]) {
        qrInfo = qrData[currentColor][decoded];
      }

      // Check all colors if not found
      if (!qrInfo) {
        for (const color in qrData) {
          if (qrData[color][decoded]) {
            qrInfo = { ...qrData[color][decoded], mismatchedColor: true, expectedColor: color };
            break;
          }
        }
      }

      if (qrInfo) {
        let displayText = qrInfo.text;
        let message = qrInfo.voice || qrInfo.text;

        // Next step direction
        if (qrInfo.next) {
          const nextInfo = qrData.red[qrInfo.next] || qrData.green[qrInfo.next] || qrData.blue[qrInfo.next];
          if (nextInfo) message += ` Next, go to ${nextInfo.text}.`;
        }

        if (qrInfo.mismatchedColor) {
          displayText = `[Expected ${qrInfo.expectedColor}] ${displayText}`;
          speak(`This QR code is not ${currentColor}, it belongs to ${qrInfo.expectedColor}. You scanned ${qrInfo.text}. Please find the correct ${currentColor} QR code.`);
        } else {
          speak(message);
        }

        resultEl.textContent = displayText;
        statusEl.textContent = "QR decoded!";
      } else {
        resultEl.textContent = `Unknown QR: ${decoded}`;
        speak("QR code is unknown");
        statusEl.textContent = "Unknown QR";
      }
    }
  } else {
    statusEl.textContent = "Align QR inside the box...";
  }

  setTimeout(() => { qrDecoderBusy = false; }, 250);
}

// ====== Main Loop ======
function processFrame() {
  ctxDisp.drawImage(video, 0, 0, canvasDisp.width, canvasDisp.height);

  // Draw scan box
  ctxDisp.strokeStyle = currentColor;
  ctxDisp.lineWidth = 3;
  ctxDisp.strokeRect(scanBox.x, scanBox.y, scanBox.size, scanBox.size);

  tryDecode();
  requestAnimationFrame(processFrame);
}

// ====== Color Toggle ======
function handleColorChange() {
  const selectedRadio = document.querySelector('input[name="color"]:checked');
  if (!selectedRadio) return;

  currentColor = selectedRadio.value;
  document.querySelectorAll(".toggle-option").forEach(opt => opt.classList.remove("active"));
  document.querySelector(`label[for="color-${currentColor}"]`).classList.add("active");

  updateOverlayText(currentColor);
  speak(`Scanning ${currentColor} QR codes`);
}

// ====== Initialize ======
function initEventListeners() {
  colorRadios.forEach(radio => radio.addEventListener("change", handleColorChange));
}

function onOpenCVReady() {
  cvReady = true;
  console.log("OpenCV ready");
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.cv) {
    cv.onRuntimeInitialized = onOpenCVReady;
  } else {
    window.addEventListener('opencvready', onOpenCVReady);
  }

  initEventListeners();
  updateOverlayText(currentColor);
  await startCamera();
  processFrame();
});
