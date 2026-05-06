from fastapi import FastAPI
from youtube_transcript_api import YouTubeTranscriptApi
from fastapi.middleware.cors import CORSMiddleware

# OpenRouter Imports
from openai import OpenAI
from dotenv import load_dotenv
import os
import json

# 🍃 MongoDB Imports
from pymongo import MongoClient
from datetime import datetime

# Load .env
load_dotenv()

# Get API Key
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# OpenRouter Client
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY
)

# FastAPI App
app = FastAPI()

# 🍃 MongoDB Connection
MONGO_URI = "mongodb+srv://video_notes_admin:VideoNotes%402026@cluster0.nxyp8o0.mongodb.net/?appName=Cluster0"

mongo_client = MongoClient(MONGO_URI)

db = mongo_client["video_notes_db"]

notes_collection = db["notes"]

# 📁 Create folders automatically
os.makedirs("data/transcripts", exist_ok=True)
os.makedirs("data/pdfs", exist_ok=True)

# 🌐 Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Home Route
@app.get("/")
def home():
    return {"message": "Backend is running 🚀"}


# 🔗 Extract YouTube Video ID
def extract_video_id(url):

    if "v=" in url:
        return url.split("v=")[-1].split("&")[0]

    elif "youtu.be/" in url:
        return url.split("youtu.be/")[-1].split("?")[0]

    return None


# 🧠 AI Summarizer using OpenRouter
def summarize_text(text):

    response = client.chat.completions.create(

        model="deepseek/deepseek-chat",

        messages=[
            {
                "role": "system",
                "content": """
                You are an AI assistant that analyzes YouTube transcripts.

                Give:
                1. Key Points
                2. Important Concepts
                3. Short Summary
                4. Easy-to-understand Notes
                """
            },

            {
                "role": "user",
                "content": f"""
                Analyze this transcript:

                {text}
                """
            }
        ],

        temperature=0.7,
        max_tokens=800
    )

    return response.choices[0].message.content


# 🚀 Main API Endpoint
@app.get("/get-transcript")
def get_transcript(youtube_url: str):

    try:

        # Extract Video ID
        video_id = extract_video_id(youtube_url)

        if not video_id:

            return {
                "status": "error",
                "message": "Invalid YouTube URL"
            }

        # Fetch Transcript
        transcript = YouTubeTranscriptApi().fetch(
            video_id,
            languages=['en', 'hi']
        )

        # Combine Transcript
        full_text = " ".join(
            [item.text for item in transcript]
        )

        # Temporary Video Title
        video_title = "YouTube Video"

        # 📁 Save Transcript Locally
        transcript_data = {
            "video_id": video_id,
            "video_title": video_title,
            "transcript": full_text
        }

        with open(
            f"data/transcripts/{video_id}.json",
            "w",
            encoding="utf-8"
        ) as f:

            json.dump(
                transcript_data,
                f,
                indent=4,
                ensure_ascii=False
            )

        # 🧠 Generate AI Notes
        notes = summarize_text(full_text)

        # 🍃 Save Notes To MongoDB
        notes_collection.insert_one({

            "video_id": video_id,

            "video_title": video_title,

            "youtube_url": youtube_url,

            "notes": notes,

            "created_at": datetime.now()

        })

        # 📁 Save Notes Locally
        notes_data = {
            "video_id": video_id,
            "video_title": video_title,
            "notes": notes
        }

        with open(
            f"data/transcripts/{video_id}_notes.json",
            "w",
            encoding="utf-8"
        ) as f:

            json.dump(
                notes_data,
                f,
                indent=4,
                ensure_ascii=False
            )

        # ✅ Return Response
        return {
            "status": "success",
            "video_id": video_id,
            "video_title": video_title,
            "notes": notes
        }

    except Exception as e:

        return {
            "status": "error",
            "message": str(e)
        }


# 📜 History API
@app.get("/history")
def get_history():

    history = []

    for item in notes_collection.find().sort(
        "created_at",
        -1
    ):

        history.append({

            "title": item.get("video_title"),

            "youtube_url": item.get("youtube_url"),

            "notes": item.get("notes"),

            "date": str(item.get("created_at"))

        })

    return history