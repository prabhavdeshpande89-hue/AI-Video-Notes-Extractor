import os
import re
import json
import shutil
import tempfile
from datetime import datetime

import yt_dlp
import whisper

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI
from pymongo import MongoClient


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")

if not OPENROUTER_API_KEY:
    raise RuntimeError("OPENROUTER_API_KEY is missing in .env")

if not MONGO_URI:
    raise RuntimeError("MONGO_URI is missing in .env")


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


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="AI Video Notes Extractor",
    description="Extract YouTube audio, transcribe using Whisper and generate AI notes.",
    version="2.0.0"
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
# WHISPER MODEL
# ============================================================

print("Loading Whisper model...")

whisper_model = whisper.load_model("base")

print("Whisper model loaded successfully!")


# ============================================================
# DATA DIRECTORY
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(
    BASE_DIR,
    "data",
    "transcripts"
)

os.makedirs(DATA_DIR, exist_ok=True)


# ============================================================
# ROOT ROUTE
# ============================================================

@app.get("/")
def home():
    return {
        "message": "Backend is running 🚀",
        "service": "AI Video Notes Extractor",
        "version": "2.0.0"
    }


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

        match = re.search(pattern, url)

        if match:
            return match.group(1)

    return None


# ============================================================
# DOWNLOAD YOUTUBE AUDIO
# ============================================================

def download_audio(youtube_url: str, output_directory: str):

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

        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
    }

    try:

        with yt_dlp.YoutubeDL(ydl_options) as ydl:

            # Get video information first
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

            print("Video title:", video_title)

            # Download audio
            ydl.download([youtube_url])

        # Expected MP3 file
        audio_path = os.path.join(
            output_directory,
            f"{video_id}.mp3"
        )

        # Sometimes extension/name can differ,
        # so search the directory if needed.
        if not os.path.exists(audio_path):

            possible_files = [
                file
                for file in os.listdir(output_directory)
                if file.endswith(".mp3")
            ]

            if possible_files:

                audio_path = os.path.join(
                    output_directory,
                    possible_files[0]
                )

        if not os.path.exists(audio_path):

            raise FileNotFoundError(
                "Audio file was not created by yt-dlp."
            )

        print("Audio downloaded successfully:")
        print(audio_path)

        return audio_path, video_title, video_id

    except Exception as e:

        print("YouTube download error:", str(e))

        raise Exception(
            f"Could not download YouTube audio: {str(e)}"
        )


# ============================================================
# WHISPER TRANSCRIPTION
# ============================================================

def transcribe_audio(audio_path: str):

    print("\nStarting Whisper transcription...")
    print("Audio:", audio_path)

    try:

        result = whisper_model.transcribe(
            audio_path,
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

        print("\nTranscription completed.")

        print(
            "Transcript length:",
            len(transcript),
            "characters"
        )

        return transcript

    except Exception as e:

        print(
            "Whisper transcription error:",
            str(e)
        )

        raise Exception(
            f"Whisper transcription failed: {str(e)}"
        )


# ============================================================
# AI NOTES GENERATION
# ============================================================

def generate_notes(transcript: str, video_title: str):

    print("\nGenerating AI notes...")

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

        print("AI notes generated successfully.")

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
    notes: str
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
        "created_at": datetime.utcnow().isoformat()
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
    notes: str
):

    document = {
        "video_id": video_id,
        "video_title": video_title,
        "youtube_url": youtube_url,
        "transcript": transcript,
        "notes": notes,
        "created_at": datetime.utcnow()
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

        # Don't stop note generation if MongoDB
        # happens to fail.
        print(
            "Continuing without MongoDB save..."
        )


# ============================================================
# GET TRANSCRIPT + GENERATE NOTES
# ============================================================

@app.get("/get-transcript")
def get_transcript(youtube_url: str):

    if not youtube_url:

        raise HTTPException(
            status_code=400,
            detail="YouTube URL is required."
        )

    # Validate YouTube URL
    video_id = extract_video_id(
        youtube_url
    )

    if not video_id:

        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL."
        )

    print("\n" + "=" * 60)

    print(
        "Processing video:",
        youtube_url
    )

    print("=" * 60)

    # Temporary directory for audio
    temp_directory = tempfile.mkdtemp(
        prefix="video_notes_"
    )

    try:

        # ----------------------------------------------------
        # STEP 1: DOWNLOAD AUDIO
        # ----------------------------------------------------

        audio_path, video_title, video_id = download_audio(
            youtube_url,
            temp_directory
        )

        # ----------------------------------------------------
        # STEP 2: TRANSCRIBE USING WHISPER
        # ----------------------------------------------------

        transcript = transcribe_audio(
            audio_path
        )

        # ----------------------------------------------------
        # STEP 3: GENERATE AI NOTES
        # ----------------------------------------------------

        notes = generate_notes(
            transcript,
            video_title
        )

        # ----------------------------------------------------
        # STEP 4: SAVE LOCALLY
        # ----------------------------------------------------

        save_transcript_locally(
            video_id,
            video_title,
            youtube_url,
            transcript,
            notes
        )

        # ----------------------------------------------------
        # STEP 5: SAVE TO MONGODB
        # ----------------------------------------------------

        save_to_mongodb(
            video_id,
            video_title,
            youtube_url,
            transcript,
            notes
        )

        print("\nProcessing completed successfully!")

        # ----------------------------------------------------
        # RESPONSE TO FRONTEND
        # ----------------------------------------------------

        return {
            "success": True,
            "video_id": video_id,
            "video_title": video_title,
            "youtube_url": youtube_url,
            "transcript": transcript,
            "notes": notes,
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

        # ----------------------------------------------------
        # CLEAN TEMPORARY AUDIO
        # ----------------------------------------------------

        try:

            if os.path.exists(temp_directory):

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
def get_history():

    try:

        history = list(
            notes_collection.find(
                {},
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