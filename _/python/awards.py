from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from diffusers import StableDiffusionPipeline
import uvicorn
import torch
import uuid
import os

app = FastAPI()

model_id = "runwayml/stable-diffusion-v1-5"
pipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch.float32)
pipe = pipe.to("cpu")

OUTPUT_DIR = "generated"
os.makedirs(OUTPUT_DIR, exist_ok=True)

@app.get("/generate")
async def generate_icon(prompt: str = Query(..., description="Описание награды")):
    image = pipe(prompt, height=256, width=256, guidance_scale=7.5, num_inference_steps=30, generator=torch.manual_seed(42)).images[0]

    file_name = f"{uuid.uuid4().hex}.png"
    file_path = os.path.join(OUTPUT_DIR, file_name)
    image.save(file_path)

    return FileResponse(file_path, media_type="image/png")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8102)
