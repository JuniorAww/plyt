from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import io
import torch
from torch.nn import functional as F
import timm
import csv
from huggingface_hub import hf_hub_download
from huggingface_hub.utils import HfHubHTTPError
from PIL import Image
from timm.data import create_transform, resolve_data_config

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def pil_ensure_rgb(image: Image.Image) -> Image.Image:
    if image.mode not in ["RGB", "RGBA"]:
        image = image.convert("RGBA") if "transparency" in image.info else image.convert("RGB")
    if image.mode == "RGBA":
        canvas = Image.new("RGBA", image.size, (255, 255, 255))
        canvas.alpha_composite(image)
        image = canvas.convert("RGB")
    return image

def pil_pad_square(image: Image.Image) -> Image.Image:
    w, h = image.size
    px = max(w, h)
    canvas = Image.new("RGB", (px, px), (255, 255, 255))
    canvas.paste(image, ((px - w) // 2, (px - h) // 2))
    return canvas

def load_labels_hf(repo_id: str):
    try:
        csv_path = hf_hub_download(repo_id=repo_id, filename="selected_tags.csv")
    except HfHubHTTPError as e:
        raise FileNotFoundError(f"selected_tags.csv not found in {repo_id}") from e

    names, rating_idx, general_idx, character_idx = [], [], [], []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            name = row["name"].strip()
            category = row["category"].strip()

            names.append(name)
            if category == "9":
                rating_idx.append(i)
            elif category == "0":
                general_idx.append(i)
            elif category == "4":
                character_idx.append(i)

    return names, rating_idx, general_idx, character_idx

def get_tags(probs, names, rating_idx):
    probs = list(zip(names, probs.numpy()))
    rating_labels = {names[i]: float(probs[i][1]) for i in rating_idx}
    return rating_labels

def run_inference(image: Image.Image):
    global model
    image = pil_ensure_rgb(image)
    image = pil_pad_square(image)
    inputs = transform(image).unsqueeze(0)
    inputs = inputs[:, [2, 1, 0]]

    with torch.inference_mode():
        if torch_device.type != "cpu":
            model = model.to(torch_device)
            inputs = inputs.to(torch_device)

        outputs = F.sigmoid(model.forward(inputs))

        if torch_device.type != "cpu":
            outputs = outputs.cpu()
            model = model.cpu()

    ratings = get_tags(outputs.squeeze(0), label_names, rating_idx)
    return ratings

# --- Модель и лейблы ---
torch_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

repo_id = "SmilingWolf/wd-swinv2-tagger-v3"
print(f"Loading model from '{repo_id}'...")
model = timm.create_model("hf-hub:" + repo_id, pretrained=True).eval()

print("Loading tag list...")
label_names, rating_idx, _, _ = load_labels_hf(repo_id)

print("Creating transform...")
transform = create_transform(**resolve_data_config(model.pretrained_cfg, model=model))

@app.post("/check_nsfw")
async def check_nsfw(file: UploadFile = File(...)):
    try:
        img_bytes = await file.read()
        image = Image.open(io.BytesIO(img_bytes))
        data = run_inference(image)
        return {"result": data}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8100)

