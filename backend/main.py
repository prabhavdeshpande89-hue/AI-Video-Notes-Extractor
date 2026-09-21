import os
import re
import json
import shutil
import tempfile
from datetime import datetime, timedelta, timezone

import yt_dlp
import whisper
import bcrypt
import jwt

from fastapi import (
    FastAPI,
    HTTPException,
    Depends
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI
from pymongo import MongoClient


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
JWT_SECRET = os.getenv("JWT_SECRET")


if not OPENROUTER_API_KEY:
    raise RuntimeError("OPENROUTER_API_KEY is missing in .env")

if not MONGO_URI:
    raise RuntimeError("MONGO_URI is missing in .env")

if not ADMIN_EMAIL:
    raise RuntimeError("ADMIN_EMAIL is missing in .env")

if not ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD is missing in .env")

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is missing in .env")


# ============================================================
# OPENROUTER
# ============================================================

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY
)


# ============================================================
# MONGODB
# ============================================================

mongo_client = MongoClient(MONGO_URI)

db = mongo_client["video_notes_db"]

notes_collection = db["notes"]
users_collection = db["users"]


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="AI Video Notes Extractor",
    description="Extract YouTube audio, transcribe using Whisper and generate AI notes.",
    version="3.2.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# AUTHENTICATION CONFIGURATION
# ============================================================

security = HTTPBearer()

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


# ============================================================
# REQUEST MODELS
# ============================================================

class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


# ============================================================
# PASSWORD HASHING
# ============================================================

def hash_password(password: str) -> str:

    password_bytes = password.encode("utf-8")

    hashed = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt()
    )

    return hashed.decode("utf-8")


def verify_password(
    password: str,
    password_hash: str
) -> bool:

    return bcrypt.checkpw(
        password.encode("utf-8"),
        password_hash.encode("utf-8")
    )


# ============================================================
# JWT TOKEN
# ============================================================

def create_access_token(
    email: str,
    role: str
):

    expire = datetime.now(timezone.utc) + timedelta(
        hours=JWT_EXPIRATION_HOURS
    )

    payload = {
        "email": email,
        "role": role,
        "exp": expire
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )


# ============================================================
# GET CURRENT USER
# ============================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    try:

        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )

        email = payload.get("email")
        role = payload.get("role")

        if not email or not role:

            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token."
            )

        return {
            "email": email,
            "role": role
        }

    except jwt.ExpiredSignatureError:

        raise HTTPException(
            status_code=401,
            detail="Authentication token has expired."
        )

    except jwt.InvalidTokenError:

        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token."
        )


# ============================================================
# ADMIN CHECK
# ============================================================

def require_admin(
    current_user: dict = Depends(get_current_user)
):

    if current_user["role"] != "admin":

        raise HTTPException(
            status_code=403,
            detail="Admin access required."
        )

    return current_user


# ============================================================
# CREATE ADMIN ACCOUNT
# ============================================================

def create_admin_if_not_exists():

    existing_admin = users_collection.find_one({
        "role": "admin"
    })

    if existing_admin:

        print(
            "Admin account already exists:",
            existing_admin.get("email")
        )

        return

    admin_document = {
        "email": ADMIN_EMAIL.lower().strip(),
        "password_hash": hash_password(
            ADMIN_PASSWORD
        ),
        "role": "admin",
        "created_at": datetime.now(timezone.utc)
    }

    users_collection.insert_one(
        admin_document
    )

    print(
        "Admin account created:",
        ADMIN_EMAIL
    )


# ============================================================
# WHISPER MODEL
# ============================================================

print("Loading Whisper model...")

whisper_model = whisper.load_model("base")

print("Whisper model loaded successfully!")


# ============================================================
# CREATE ADMIN
# ============================================================

create_admin_if_not_exists()


# ============================================================
# DATA DIRECTORY
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

DATA_DIR = os.path.join(
    BASE_DIR,
    "data",
    "transcripts"
)

os.makedirs(
    DATA_DIR,
    exist_ok=True
)


# ============================================================
# ROOT ROUTE
# ============================================================

@app.get("/")
def home():

    return {
        "message": "Backend is running 🚀",
        "service": "AI Video Notes Extractor",
        "version": "3.2.0"
    }


# ============================================================
# REGISTER USER
# ============================================================

@app.post("/auth/register")
def register_user(
    data: RegisterRequest
):

    email = data.email.lower().strip()

    if not email:

        raise HTTPException(
            status_code=400,
            detail="Email is required."
        )

    if len(data.password) < 6:

        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters."
        )

    existing_user = users_collection.find_one({
        "email": email
    })

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists."
        )

    user_document = {
        "email": email,
        "password_hash": hash_password(
            data.password
        ),
        "role": "user",
        "created_at": datetime.now(timezone.utc)
    }

    users_collection.insert_one(
        user_document
    )

    return {
        "success": True,
        "message": "Account created successfully.",
        "role": "user"
    }


# ============================================================
# LOGIN
# ============================================================

@app.post("/auth/login")
def login(
    data: LoginRequest
):

    email = data.email.lower().strip()

    user = users_collection.find_one({
        "email": email
    })

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    if not verify_password(
        data.password,
        user["password_hash"]
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    token = create_access_token(
        email=user["email"],
        role=user["role"]
    )

    return {
        "success": True,
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "email": user["email"]
    }


# ============================================================
# CURRENT USER
# ============================================================

@app.get("/auth/me")
def get_me(
    current_user: dict = Depends(get_current_user)
):

    return {
        "success": True,
        "email": current_user["email"],
        "role": current_user["role"]
    }


# ============================================================
# ADMIN TEST
# ============================================================

@app.get("/admin/test")
def admin_test(
    current_admin: dict = Depends(require_admin)
):

    return {
        "success": True,
        "message": "Admin authentication is working.",
        "email": current_admin["email"],
        "role": current_admin["role"]
    }


# ============================================================
# ADMIN - LIST USERS
# ============================================================

@app.get("/admin/users")
def get_users(
    current_admin: dict = Depends(require_admin)
):

    try:

        users = list(
            users_collection.find(
                {},
                {
                    "_id": 0,
                    "email": 1,
                    "role": 1,
                    "created_at": 1
                }
            ).sort(
                "created_at",
                -1
            )
        )

        return {
            "success": True,
            "count": len(users),
            "users": users
        }

    except Exception as e:

        print(
            "Admin users error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Could not retrieve users."
        )


# ============================================================
# YOUTUBE VIDEO ID
# ============================================================

def extract_video_id(url: str):

    patterns = [
        r"(?:youtube\.com/watch\?v=)([^&]+)",
        r"(?:youtu\.be/)([^?&]+)",
        r"(?:youtube\.com/shorts/)([^?&]+)",
        r"(?:youtube\.com/embed/)([^?&]+)"
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            url
        )

        if match:
            return match.group(1)

    return None


# ============================================================
# DOWNLOAD YOUTUBE AUDIO
# ============================================================

def download_audio(
    youtube_url: str,
    output_directory: str
):

    print("\nDownloading YouTube audio...")
    print("URL:", youtube_url)

    output_template = os.path.join(
        output_directory,
        "%(id)s.%(ext)s"
    )

    ydl_options = {
        "format": "bestaudio/best",

        "outtmpl": output_template,

        "noplaylist": True,

        "quiet": False,

        "no_warnings": False,

        # YouTube authentication cookies
        "cookiefile": "/home/ubuntu/cookies.txt",

        # JavaScript runtime required by current YouTube extraction
        "js_runtimes": {
            "node": {}
        },

        # Use the same client that worked from the terminal
        "extractor_args": {
            "youtube": {
                "player-client": ["web_embedded"]
            },
            "youtubepot-bgutilhttp": {
                "base_url": ["http://127.0.0.1:4416"]
            }
        },

        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
    }

    try:

        with yt_dlp.YoutubeDL(
            ydl_options
        ) as ydl:

            info = ydl.extract_info(
                youtube_url,
                download=False
            )

            video_title = info.get(
                "title",
                "YouTube Video"
            )

            video_id = info.get(
                "id",
                extract_video_id(youtube_url)
            )

            print(
                "Video title:",
                video_title
            )

            ydl.download([
                youtube_url
            ])

        audio_path = os.path.join(
            output_directory,
            f"{video_id}.mp3"
        )

        if not os.path.exists(
            audio_path
        ):

            possible_files = [
                file
                for file in os.listdir(
                    output_directory
                )
                if file.endswith(".mp3")
            ]

            if possible_files:

                audio_path = os.path.join(
                    output_directory,
                    possible_files[0]
                )

        if not os.path.exists(
            audio_path
        ):

            raise FileNotFoundError(
                "Audio file was not created by yt-dlp."
            )

        print(
            "Audio downloaded successfully:"
        )

        print(audio_path)

        return (
            audio_path,
            video_title,
            video_id
        )

    except Exception as e:

        print(
            "YouTube download error:",
            str(e)
        )

        raise Exception(
            f"Could not download YouTube audio: {str(e)}"
        )


# ============================================================
# WHISPER TRANSCRIPTION
# ============================================================

def transcribe_audio(
    audio_path: str
):

    print("\n" + "=" * 60)
    print("WHISPER TRANSCRIPTION")
    print("=" * 60)

    print("Audio path:", audio_path)

    try:

        # --------------------------------------------------------
        # STEP 1: Verify audio file
        # --------------------------------------------------------

        if not os.path.exists(audio_path):

            raise FileNotFoundError(
                f"Audio file does not exist: {audio_path}"
            )

        file_size = os.path.getsize(audio_path)

        print(
            "Audio file size:",
            file_size,
            "bytes"
        )

        if file_size == 0:

            raise Exception(
                "Audio file is empty."
            )

        # --------------------------------------------------------
        # STEP 2: Load audio through Whisper/FFmpeg
        # --------------------------------------------------------

        print(
            "Loading audio with Whisper..."
        )

        audio = whisper.load_audio(
            audio_path
        )

        print(
            "Audio samples:",
            len(audio)
        )

        print(
            "Audio duration:",
            len(audio) / 16000,
            "seconds"
        )

        if len(audio) == 0:

            raise Exception(
                "Whisper loaded zero audio samples."
            )

        # --------------------------------------------------------
        # STEP 3: Transcribe
        # --------------------------------------------------------

        print(
            "Starting Whisper transcription..."
        )

        result = whisper_model.transcribe(
            audio,
            fp16=False
        )

        transcript = result.get(
            "text",
            ""
        ).strip()

        if not transcript:

            raise Exception(
                "Whisper returned an empty transcript."
            )

        print(
            "Transcription completed."
        )

        print(
            "Transcript length:",
            len(transcript),
            "characters"
        )

        print("=" * 60)

        return transcript

    except Exception as e:

        print(
            "Whisper transcription error:",
            repr(e)
        )

        raise Exception(
            f"Whisper transcription failed: {str(e)}"
        )


# ============================================================
# AI NOTES GENERATION
# ============================================================

def generate_notes(
    transcript: str,
    video_title: str
):

    print(
        "\nGenerating AI notes..."
    )

    prompt = f"""
You are an expert educational note-taking assistant.

Create clear, useful and well-structured notes from the following
video transcript.

Video title:
{video_title}

Transcript:
{transcript}

Follow this structure:

# {video_title}

## Summary
Give a concise overview of the video.

## Key Points
List the most important concepts and ideas.

## Detailed Notes
Explain the important topics clearly.

## Important Terms
List important technical terms, definitions and concepts.

## Examples
Include useful examples mentioned in the transcript.

## Key Takeaways
Give the most important things the learner should remember.

Rules:
- Do not invent information.
- Use only information present in the transcript.
- Remove unnecessary repetition.
- Make the notes easy for a student to study.
- Use Markdown formatting.
- Keep the explanation concise but useful.
"""

    try:

        response = client.chat.completions.create(
            model="deepseek/deepseek-v3.2",

            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert AI assistant "
                        "specialized in creating educational notes."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],

            temperature=0.3
        )

        notes = response.choices[0].message.content

        if not notes:

            raise Exception(
                "AI returned empty notes."
            )

        print(
            "AI notes generated successfully."
        )

        return notes

    except Exception as e:

        print(
            "OpenRouter error:",
            str(e)
        )

        raise Exception(
            f"AI note generation failed: {str(e)}"
        )


# ============================================================
# SAVE TRANSCRIPT LOCALLY
# ============================================================

def save_transcript_locally(
    video_id: str,
    video_title: str,
    youtube_url: str,
    transcript: str,
    notes: str,
    user_email: str
):

    safe_video_id = re.sub(
        r"[^a-zA-Z0-9_-]",
        "_",
        video_id
    )

    file_path = os.path.join(
        DATA_DIR,
        f"{safe_video_id}.json"
    )

    data = {
        "video_id": video_id,
        "video_title": video_title,
        "youtube_url": youtube_url,
        "transcript": transcript,
        "notes": notes,
        "user_email": user_email,
        "created_at": datetime.now(
            timezone.utc
        ).isoformat()
    }

    with open(
        file_path,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=4
        )

    print(
        "Saved local transcript:",
        file_path
    )


# ============================================================
# SAVE TO MONGODB
# ============================================================

def save_to_mongodb(
    video_id: str,
    video_title: str,
    youtube_url: str,
    transcript: str,
    notes: str,
    user_email: str
):

    document = {
        "video_id": video_id,
        "video_title": video_title,
        "youtube_url": youtube_url,
        "transcript": transcript,
        "notes": notes,
        "user_email": user_email,
        "created_at": datetime.now(
            timezone.utc
        )
    }

    try:

        result = notes_collection.insert_one(
            document
        )

        print(
            "Saved to MongoDB:",
            result.inserted_id
        )

    except Exception as e:

        print(
            "MongoDB save error:",
            str(e)
        )

        print(
            "Continuing without MongoDB save..."
        )


# ============================================================
# GET TRANSCRIPT + GENERATE NOTES
# ============================================================

@app.get("/get-transcript")
def get_transcript(
    youtube_url: str,
    current_user: dict = Depends(get_current_user)
):

    if not youtube_url:

        raise HTTPException(
            status_code=400,
            detail="YouTube URL is required."
        )

    video_id = extract_video_id(
        youtube_url
    )

    if not video_id:

        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL."
        )

    user_email = current_user["email"]

    print(
        "\n" + "=" * 60
    )

    print(
        "Processing video:",
        youtube_url
    )

    print(
        "Authenticated user:",
        user_email
    )

    print(
        "=" * 60
    )

    temp_directory = tempfile.mkdtemp(
        prefix="video_notes_"
    )

    try:

        # STEP 1
        audio_path, video_title, video_id = download_audio(
            youtube_url,
            temp_directory
        )

        # STEP 2
        transcript = transcribe_audio(
            audio_path
        )

        # STEP 3
        notes = generate_notes(
            transcript,
            video_title
        )

        # STEP 4
        save_transcript_locally(
            video_id,
            video_title,
            youtube_url,
            transcript,
            notes,
            user_email
        )

        # STEP 5
        save_to_mongodb(
            video_id,
            video_title,
            youtube_url,
            transcript,
            notes,
            user_email
        )

        print(
            "\nProcessing completed successfully!"
        )

        return {
            "success": True,
            "video_id": video_id,
            "video_title": video_title,
            "youtube_url": youtube_url,
            "transcript": transcript,
            "notes": notes,
            "user_email": user_email,
            "message": "Video processed successfully."
        }

    except HTTPException:

        raise

    except Exception as e:

        print(
            "\nProcessing failed:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:

        try:

            if os.path.exists(
                temp_directory
            ):

                shutil.rmtree(
                    temp_directory,
                    ignore_errors=True
                )

                print(
                    "Temporary files cleaned."
                )

        except Exception as e:

            print(
                "Cleanup error:",
                str(e)
            )


# ============================================================
# HISTORY
# ============================================================

@app.get("/history")
def get_history(
    current_user: dict = Depends(get_current_user)
):

    try:

        # ----------------------------------------------------
        # ADMIN
        # Admin can see ALL notes
        # ----------------------------------------------------

        if current_user["role"] == "admin":

            query = {}

        # ----------------------------------------------------
        # NORMAL USER
        # User can see ONLY their own notes
        # ----------------------------------------------------

        else:

            query = {
                "user_email": current_user["email"]
            }

        history = list(
            notes_collection.find(
                query,
                {
                    "_id": 0
                }
            ).sort(
                "created_at",
                -1
            )
        )

        return {
            "success": True,
            "count": len(history),
            "history": history
        }

    except Exception as e:

        print(
            "History error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Could not retrieve history."
        )


# ============================================================
# DELETE NOTE
# ============================================================

@app.delete("/notes/{video_id}")
def delete_note(
    video_id: str,
    current_user: dict = Depends(get_current_user)
):

    try:

        # ----------------------------------------------------
        # VALIDATE VIDEO ID
        # ----------------------------------------------------

        if not video_id:

            raise HTTPException(
                status_code=400,
                detail="Video ID is required."
            )

        # ----------------------------------------------------
        # ADMIN
        # Admin can delete any note
        # ----------------------------------------------------

        if current_user["role"] == "admin":

            result = notes_collection.delete_one({
                "video_id": video_id
            })

        # ----------------------------------------------------
        # NORMAL USER
        # User can delete ONLY their own note
        # ----------------------------------------------------

        else:

            result = notes_collection.delete_one({
                "video_id": video_id,
                "user_email": current_user["email"]
            })

        # ----------------------------------------------------
        # NOT FOUND
        # ----------------------------------------------------

        if result.deleted_count == 0:

            raise HTTPException(
                status_code=404,
                detail=(
                    "Note not found or you do not "
                    "have permission to delete it."
                )
            )

        # ----------------------------------------------------
        # SUCCESS
        # ----------------------------------------------------

        print(
            "Note deleted:",
            video_id,
            "by",
            current_user["email"]
        )

        return {
            "success": True,
            "message": "Note deleted successfully.",
            "video_id": video_id
        }

    except HTTPException:

        raise

    except Exception as e:

        print(
            "Delete note error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail="Could not delete note."
        )


# ============================================================
# RUN DIRECTLY
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )