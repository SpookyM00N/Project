from flask import Flask, request, send_file, jsonify, render_template, url_for
from PIL import Image, ImageFilter, ImageEnhance, ImageOps
import io, os, uuid

app = Flask(__name__, static_folder="static", template_folder="templates")
OUT_DIR = "outputs"
os.makedirs(OUT_DIR, exist_ok=True)
ALLOWED = {"png","jpg","jpeg","webp"}

def allowed_filename(fn):
    return "." in fn and fn.rsplit(".",1)[1].lower() in ALLOWED

def strip_exif(img):
    data = list(img.getdata())
    clean = Image.new(img.mode, img.size)
    clean.putdata(data)
    return clean

def enhance_image(img, sharpness_factor, contrast_factor, vibrancy_factor):
    img = img.convert("RGB")
    img = strip_exif(img)
    
    # 1. Advanced Histogram Equalization (Stretches contrast dynamically)
    img = ImageOps.autocontrast(img, cutoff=0.5)
    
    # 2. Apply user-defined Contrast adjustments
    if contrast_factor != 1.0:
        img = ImageEnhance.Contrast(img).enhance(contrast_factor)
        
    # 3. Apply user-defined Vibrancy/Color saturation adjustments
    if vibrancy_factor != 1.0:
        img = ImageEnhance.Color(img).enhance(vibrancy_factor)
        
    # 4. Smart Multi-pass Sharpening
    if sharpness_factor != 1.0:
        img = ImageEnhance.Sharpness(img).enhance(sharpness_factor)
    
    # Unsharp mask fine-tuned to prevent severe halo artifacts
    img = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=120, threshold=4))
    return img

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
def upload():
    f = request.files.get("image")
    if not f or not allowed_filename(f.filename):
        return jsonify({"error":"invalid or missing file"}), 400
        
    # Extract user configurations with safe default fallbacks
    try:
        sharpness = float(request.form.get("sharpness", 1.2))
        contrast = float(request.form.get("contrast", 1.0))
        vibrancy = float(request.form.get("vibrancy", 1.3))
    except ValueError:
        return jsonify({"error":"invalid slider parameter parameters"}), 400

    try:
        img = Image.open(f.stream)
    except Exception:
        return jsonify({"error":"cannot open image"}), 400
        
    out = enhance_image(img, sharpness, contrast, vibrancy)
    fname = f"{uuid.uuid4().hex}.jpg"
    path = os.path.join(OUT_DIR, fname)
    out.save(path, "JPEG", quality=90)
    return jsonify({"url": url_for("result", filename=fname)}), 200

@app.route("/result/<filename>")
def result(filename):
    path = os.path.join(OUT_DIR, filename)
    if not os.path.exists(path):
        return jsonify({"error":"not found"}), 404
    return send_file(path, mimetype="image/jpeg")

if __name__ == "__main__":
    app.run(debug=True, port=5000)