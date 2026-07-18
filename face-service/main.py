import base64
import numpy as np
import cv2
import face_recognition
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI(title="AxesAI Face Recognition Service")

# Enable CORS for the Node backend (and browser if needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RegisterFaceRequest(BaseModel):
    frames: List[str]

class VerifyFaceRequest(BaseModel):
    frame: str
    storedEmbedding: List[float]

def decode_base64_image(base64_str: str) -> np.ndarray:
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    except Exception as e:
        print(f"Error decoding base64 image: {e}")
        return None

@app.post("/register-face")
async def register_face(payload: RegisterFaceRequest):
    encodings = []
    for frame in payload.frames:
        img = decode_base64_image(frame)
        if img is not None:
            face_encs = face_recognition.face_encodings(img)
            if len(face_encs) > 0:
                encodings.append(face_encs[0])
    
    if not encodings:
        raise HTTPException(status_code=400, detail="No face detected in any of the provided frames.")
    
    # Average the face encodings
    avg_encoding = np.mean(encodings, axis=0).tolist()
    return {"embedding": avg_encoding}

@app.post("/verify-face")
async def verify_face(payload: VerifyFaceRequest):
    img = decode_base64_image(payload.frame)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid frame image format.")
    
    face_encs = face_recognition.face_encodings(img)
    if len(face_encs) == 0:
        return {"match": False, "distance": 1.0, "error": "No face detected in the webcam stream."}
    
    live_encoding = face_encs[0]
    stored_array = np.array(payload.storedEmbedding)
    
    # Compute Euclidean distance
    distance = float(np.linalg.norm(live_encoding - stored_array))
    
    # Standard threshold is 0.6
    match = bool(distance <= 0.6)
    return {"match": match, "distance": distance}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
