const fileInput = document.getElementById("file");
const enhanceBtn = document.getElementById("enhance");
const statusEl = document.getElementById("status");
const originalImg = document.getElementById("original");
const enhancedImg = document.getElementById("enhanced");
const comparison = document.getElementById("comparison");
const downloadLink = document.getElementById("download");
const settingsPanel = document.getElementById("settings-panel");

// Configurable Sliders
const sharpnessInput = document.getElementById("sharpness");
const contrastInput = document.getElementById("contrast");
const vibrancyInput = document.getElementById("vibrancy");

let currentFile = null;

/**
 * Injects an invisible SVG filter into the DOM.
 * This allows us to perform true, GPU-accelerated image sharpening 
 * in the browser using a convolution matrix.
 */
const injectSvgFilter = () => {
  if (document.getElementById("svg-sharpen-filter")) return;
  
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "svg-sharpen-filter";
  svg.style.cssText = "position:absolute; width:0; height:0; pointer-events:none; overflow:hidden;";
  svg.innerHTML = `
    <defs>
      <filter id="css-sharpen">
        <feConvolveMatrix id="sharpen-matrix" order="3" kernelMatrix="0 0 0 0 1 0 0 0 0"/>
      </filter>
    </defs>
  `;
  document.body.appendChild(svg);
};

/**
 * Updates the CSS filter string on the original image element
 * based on the real-time values of the configuration sliders.
 */
const updateLivePreview = () => {
  if (!currentFile) return;

  const sharpness = parseFloat(sharpnessInput.value);
  const contrast = contrastInput.value;
  const vibrancy = vibrancyInput.value;

  // Calculate the sharpening kernel matrix dynamically
  // Baseline is 1.0 (identity matrix). Values above 1.0 subtract neighboring pixel weights.
  const matrix = document.getElementById("sharpen-matrix");
  if (matrix) {
    const s = Math.max(0, sharpness - 1); 
    const edge = -s;
    const center = 1 + (4 * s);
    matrix.setAttribute("kernelMatrix", `0 ${edge} 0 ${edge} ${center} ${edge} 0 ${edge} 0`);
  }

  // Combine the SVG sharpening filter with native CSS contrast and saturation adjustments
  originalImg.style.filter = `url(#css-sharpen) contrast(${contrast}) saturate(${vibrancy})`;
};

/* Show native filename on hover for the custom Upload button */
document.querySelector(".file-control").addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const f = fileInput.files[0];
  if (!f) return;
  currentFile = f;
  
  injectSvgFilter();
  
  const url = URL.createObjectURL(f);
  originalImg.src = url;
  originalImg.onload = () => URL.revokeObjectURL(url);
  
  comparison.hidden = false;
  settingsPanel.style.display = "block"; 
  enhancedImg.src = ""; 
  downloadLink.removeAttribute("href");
  statusEl.textContent = "Ready to enhance";
  
  // Initialize the preview matching the default slider positions
  updateLivePreview();
});

// Attach performance-optimized real-time input listeners to all sliders
[sharpnessInput, contrastInput, vibrancyInput].forEach(input => {
  input.addEventListener("input", updateLivePreview);
});

enhanceBtn.addEventListener("click", async () => {
  if (!currentFile) { 
    statusEl.textContent = "Please upload an image first."; 
    return; 
  }
  
  statusEl.textContent = "Uploading & enhancing...";
  enhanceBtn.disabled = true;
  
  try {
    const fd = new FormData();
    fd.append("image", currentFile);
    fd.append("sharpness", sharpnessInput.value);
    fd.append("contrast", contrastInput.value);
    fd.append("vibrancy", vibrancyInput.value);

    const res = await fetch("/upload", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Enhancement failed");
    
    const resultUrl = json.url;
    enhancedImg.src = resultUrl;
    enhancedImg.onload = () => { statusEl.textContent = "Done"; };
    
    downloadLink.href = resultUrl;
    downloadLink.setAttribute("download", `enhanced-${currentFile.name.replace(/\s+/g, "_")}`);
  } catch (err) {
    statusEl.textContent = "Error: " + (err.message || "unknown");
  } finally {
    enhanceBtn.disabled = false;
  }
});
