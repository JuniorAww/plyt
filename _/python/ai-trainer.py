import io
from fastapi import FastAPI, Response
from fastapi.responses import StreamingResponse
import uvicorn
from TTS.api import TTS

# https://tts.readthedocs.io/en/latest/models.html
model_name = "tts_models/es/css10/vits"
tts = TTS(model_name)

app = FastAPI()

@app.post("/tts")
async def text_to_speech(text: str):
    """
    Преобразует испанский текст в речь и возвращает аудиофайл.
    """
    wav_buffer = io.BytesIO()
    
    tts.tts_to_file(text=text, file_path=wav_buffer)
    
    wav_buffer.seek(0)
    
    return StreamingResponse(wav_buffer, media_type="audio/wav")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8104)
