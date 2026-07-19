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

class ProctorRequest(BaseModel):
    frame: str
    storedEmbedding: List[float] = []   # optional: verify it's the same enrolled student


@app.post("/proctor-check")
async def proctor_check(payload: ProctorRequest):
    """
    Analyses one webcam frame during an exam and reports integrity signals:
      - no_face        : student left the frame
      - multiple_faces : someone else is in the room / helping
      - looking_away   : head turned away from the screen
      - identity_mismatch : the face isn't the enrolled student (if embedding given)
    """
    img = decode_base64_image(payload.frame)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid frame image format.")

    locations = face_recognition.face_locations(img)
    face_count = len(locations)

    violations = []
    if face_count == 0:
        violations.append("no_face")
    elif face_count > 1:
        violations.append("multiple_faces")

    looking_away = False
    if face_count >= 1:
        landmarks_list = face_recognition.face_landmarks(img, face_locations=[locations[0]])
        if landmarks_list:
            lm = landmarks_list[0]
            try:
                left_eye = np.mean(lm["left_eye"], axis=0)
                right_eye = np.mean(lm["right_eye"], axis=0)
                nose = np.mean(lm["nose_tip"], axis=0)

                eye_center_x = (left_eye[0] + right_eye[0]) / 2.0
                eye_distance = abs(right_eye[0] - left_eye[0]) or 1.0

                # How far the nose sits from the midpoint between the eyes,
                # normalised by eye separation → robust to distance from camera.
                horizontal_ratio = (nose[0] - eye_center_x) / eye_distance
                # Vertical: nose far below/above the eye line means head tilted down/up
                eye_center_y = (left_eye[1] + right_eye[1]) / 2.0
                vertical_ratio = (nose[1] - eye_center_y) / eye_distance

                if abs(horizontal_ratio) > 0.42 or vertical_ratio > 1.35 or vertical_ratio < 0.25:
                    looking_away = True
                    violations.append("looking_away")
            except Exception as e:
                print(f"Landmark analysis failed: {e}")

    identity_ok = True
    if payload.storedEmbedding and face_count >= 1:
        encs = face_recognition.face_encodings(img, known_face_locations=[locations[0]])
        if encs:
            distance = float(np.linalg.norm(encs[0] - np.array(payload.storedEmbedding)))
            identity_ok = bool(distance <= 0.6)
            if not identity_ok:
                violations.append("identity_mismatch")

    return {
        "faceCount": face_count,
        "lookingAway": looking_away,
        "identityOk": identity_ok,
        "violations": violations,
        "clean": len(violations) == 0,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
