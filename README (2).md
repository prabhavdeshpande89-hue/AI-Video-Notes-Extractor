# 🎥 AI Video Notes Extractor

An AI-powered full-stack web application that extracts YouTube transcripts, generates smart summarized notes using AI, exports notes as PDF, and stores note history in MongoDB Atlas.

---

# 🚀 Features

## ✅ AI Transcript Summarization

* Extracts YouTube video transcripts automatically
* Uses AI to generate:

  * Key Points
  * Important Concepts
  * Easy-to-understand Notes
  * Summaries

## ✅ Modern Frontend UI

* Premium glassmorphism UI
* Dark neon AI theme
* Animated gradients
* Responsive design
* Drag & drop upload UI

## ✅ PDF Export

* Download generated notes as professional PDF reports

## ✅ MongoDB Atlas Integration

* Saves generated notes permanently
* Stores:

  * Video Title
  * YouTube URL
  * Generated Notes
  * Timestamp

## ✅ History API

* Fetch previously generated notes
* Cloud-based storage

---

# 🛠 Tech Stack

## Frontend

* React.js
* CSS3
* React Markdown
* jsPDF

## Backend

* FastAPI
* Python
* OpenRouter API
* YouTube Transcript API

## Database

* MongoDB Atlas

## Deployment (Planned)

* Vercel (Frontend)
* Render (Backend)

---

# 📂 Project Structure

```bash
video-note-extractor/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── data/
│
└── README.md
```

---

# ⚙️ Installation & Setup

# 1️⃣ Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/AI-Video-Notes-Extractor.git

cd AI-Video-Notes-Extractor
```

---

# 2️⃣ Backend Setup

## Navigate to Backend

```bash
cd backend
```

## Create Virtual Environment

```bash
python -m venv venv
```

## Activate Environment

### Windows

```bash
venv\Scripts\activate
```

### Mac/Linux

```bash
source venv/bin/activate
```

---

## Install Dependencies

```bash
pip install -r requirements.txt
```

---

# 3️⃣ Configure Environment Variables

Create a `.env` file inside backend:

```env
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
```

---

# 4️⃣ MongoDB Atlas Setup

## Create MongoDB Atlas Cluster

* Create free cluster
* Create database user
* Allow network access

## Add MongoDB Connection String

Inside `main.py`:

```python
MONGO_URI = "YOUR_MONGODB_CONNECTION_STRING"
```

---

# 5️⃣ Run Backend

```bash
uvicorn main:app --reload
```

Backend runs at:

```bash
http://127.0.0.1:8000
```

---

# 6️⃣ Frontend Setup

## Navigate to Frontend

```bash
cd frontend
```

## Install Dependencies

```bash
npm install
```

---

# 7️⃣ Run Frontend

```bash
npm start
```

Frontend runs at:

```bash
http://localhost:3000
```

---

# 🔑 API Endpoints

## Home Route

```http
GET /
```

## Generate Notes

```http
GET /get-transcript?youtube_url=VIDEO_URL
```

## Get History

```http
GET /history
```

---

# 🧠 AI Model Used

```text
DeepSeek Chat via OpenRouter API
```

---

# 📸 Screenshots

Add screenshots here after deployment.

Example:

* Homepage
* AI Notes Generation
* PDF Export
* MongoDB History

---

# 🌟 Future Improvements

* AI Quiz Generator
* Chat With Video
* Timestamped Notes
* Playlist Support
* Voice Assistant
* Multi-language Notes
* Authentication System
* History Dashboard

---

# 🔒 Environment Variables

Never upload:

```text
.env
MongoDB URI
API Keys
```

Add `.env` to `.gitignore`.

---

# 📦 Requirements

## Backend Requirements

```text
fastapi
uvicorn
openai
python-dotenv
youtube-transcript-api
pymongo
```

## Frontend Requirements

```text
react
react-markdown
jspdf
```

---

# 🚀 Deployment

## Frontend

Deploy using:

* Vercel

## Backend

Deploy using:

* Render

## Database

* MongoDB Atlas

---

# 👨‍💻 Author

## Prabhav Deshpande

AI & Full Stack Developer

---

# 📄 License

This project is for educational and portfolio purposes.
