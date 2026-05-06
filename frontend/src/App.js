import React, { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";
import "./App.css";

function App() {

  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [videoTitle, setVideoTitle] = useState("");

  const inputRef = useRef(null);

  // 📂 Handle File Selection
  const handleFile = (selectedFile) => {
    setFile(selectedFile);
  };

  const handleChange = (e) => {

    if (e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // 🖱 Drag Events
  const handleDrag = (e) => {

    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {

      setDragActive(true);

    } else {

      setDragActive(false);
    }
  };

  // 📥 Handle Drop
  const handleDrop = (e) => {

    e.preventDefault();
    e.stopPropagation();

    setDragActive(false);

    if (e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // 📋 Copy Notes
  const copyNotes = () => {

    navigator.clipboard.writeText(notes);

    alert("Notes copied successfully!");
  };

  // 📄 Download Professional PDF
  const downloadPDF = () => {

    const doc = new jsPDF();

    // Remove markdown symbols
    const cleanText = notes
      .replace(/#/g, "")
      .replace(/\*\*/g, "")
      .replace(/---/g, "")
      .replace(/`/g, "");

    // Split lines
    const lines = doc.splitTextToSize(cleanText, 180);

    // ===== PDF TITLE =====

    doc.setFontSize(22);
    doc.setTextColor(0, 102, 204);

    doc.text("AI Video Notes Report", 10, 20);

    // ===== VIDEO TITLE =====

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);

    doc.text(`Video Title: ${videoTitle}`, 10, 32);

    // Divider line
    doc.line(10, 38, 200, 38);

    // ===== CONTENT =====

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    let y = 50;

    lines.forEach((line) => {

      // Auto new page
      if (y > 280) {

        doc.addPage();

        y = 20;
      }

      doc.text(line, 10, y);

      y += 8;
    });

    // Safe filename
    const safeTitle = videoTitle
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "_");

    // Save PDF
    doc.save(`${safeTitle}_AI_Notes.pdf`);
  };

  // 🚀 MAIN FUNCTION
  const handleGenerate = async () => {

    if (!youtubeLink && !file) {

      alert("Please upload a file or paste YouTube link!");
      return;
    }

    try {

      setLoading(true);
      setNotes("");

      // 🔗 YouTube Processing
      if (youtubeLink) {

        const response = await fetch(
          `http://127.0.0.1:8000/get-transcript?youtube_url=${youtubeLink}`
        );

        const data = await response.json();

        console.log(data);

        if (data.status === "success") {

          setNotes(data.notes);

          // Save video title
          setVideoTitle(
            data.video_title || "YouTube Video"
          );

        } else {

          setNotes("❌ Error: " + data.message);
        }
      }

      // 📂 File Upload Placeholder
      else if (file) {

        setTimeout(() => {

          setNotes("📂 File processing feature coming soon...");

        }, 2000);
      }

    } catch (error) {

      console.log(error);

      setNotes("❌ Error connecting to backend");

    } finally {

      setLoading(false);
    }
  };

  return (

    <div className="container">

      <div className="card">

        <h1>🎥 AI Video Text Extractor</h1>

        <p className="subtitle">
          Upload your video or paste YouTube link
        </p>

        {/* 🔗 YouTube Input */}
        <input
          type="text"
          placeholder="🔗 Paste YouTube link here..."
          value={youtubeLink}
          onChange={(e) => setYoutubeLink(e.target.value)}
          className="input"
        />

        {/* 📂 Upload Box */}
        <div
          className={`upload-box ${dragActive ? "active" : ""}`}
          onClick={() => inputRef.current.click()}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >

          <input
            ref={inputRef}
            type="file"
            onChange={handleChange}
            hidden
          />

          <p>
            {file
              ? `📄 ${file.name}`
              : "📂 Click or Drag Video Here"}
          </p>

        </div>

        {/* 🔘 Generate Button */}
        <button
          className="btn"
          onClick={handleGenerate}
        >

          {loading
            ? "🤖 AI Generating..."
            : "Generate Notes"}

        </button>

        {/* 📄 Result */}
        {notes && (

          <div className="result-box">

            <div className="result-header">

              <h3>📝 AI Generated Notes</h3>

              <div className="action-buttons">

                <button
                  className="copy-btn"
                  onClick={copyNotes}
                >
                  📋 Copy
                </button>

                <button
                  className="pdf-btn"
                  onClick={downloadPDF}
                >
                  📄 Download PDF
                </button>

              </div>

            </div>

            <div className="markdown-content">

              <ReactMarkdown>
                {notes}
              </ReactMarkdown>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}

export default App;