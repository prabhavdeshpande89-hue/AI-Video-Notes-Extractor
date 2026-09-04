import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";
import "./App.css";

function App() {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [copied, setCopied] = useState(false);

  // HISTORY
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);

  // ============================================================
  // COPY NOTES
  // ============================================================

  const copyNotes = async () => {
    try {
      await navigator.clipboard.writeText(notes);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Copy error:", error);
    }
  };

  // ============================================================
  // DOWNLOAD PDF
  // ============================================================

  const downloadPDF = () => {
    if (!notes) return;

    const doc = new jsPDF();

    const cleanText = notes
      .replace(/#/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/---/g, "")
      .replace(/`/g, "");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);

    doc.text("VideoNote AI", 15, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);

    doc.text("AI Generated Study Notes", 15, 28);

    doc.setDrawColor(226, 232, 240);
    doc.line(15, 35, 195, 35);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);

    const titleLines = doc.splitTextToSize(
      videoTitle || "YouTube Video",
      175
    );

    doc.text(titleLines, 15, 48);

    let y = 48 + titleLines.length * 7 + 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);

    const lines = doc.splitTextToSize(cleanText, 175);

    lines.forEach((line) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }

      doc.text(line, 15, y);
      y += 6;
    });

    const safeTitle = (videoTitle || "Video")
      .replace(/[^\w\s-]/gi, "")
      .replace(/\s+/g, "_");

    doc.save(`${safeTitle}_AI_Notes.pdf`);
  };

  // ============================================================
  // GENERATE NOTES
  // ============================================================

  const handleGenerate = async () => {
    if (!youtubeLink.trim()) {
      alert("Please paste a YouTube video URL!");
      return;
    }

    try {
      setLoading(true);
      setNotes("");
      setVideoTitle("");
      setSelectedHistory(null);

      const encodedURL = encodeURIComponent(
        youtubeLink.trim()
      );

      const response = await fetch(
        `http://127.0.0.1:8000/get-transcript?youtube_url=${encodedURL}`
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setNotes(
          data.notes || "No notes generated."
        );

        setVideoTitle(
          data.video_title || "YouTube Video"
        );

        setShowHistory(false);
      } else {
        const errorMessage =
          data.detail ||
          data.message ||
          "Failed to process the video.";

        setNotes(`❌ Error: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Frontend error:", error);

      setNotes(
        "❌ Error connecting to backend. Please make sure the FastAPI server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FETCH HISTORY
  // ============================================================

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);

      const response = await fetch(
        "http://127.0.0.1:8000/history"
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setHistory(data.history || []);
      } else {
        console.error("Failed to load history:", data);
        setHistory([]);
      }
    } catch (error) {
      console.error("History error:", error);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ============================================================
  // OPEN HISTORY
  // ============================================================

  const openHistory = () => {
    setShowHistory(true);
    setSelectedHistory(null);
    setNotes("");
    setVideoTitle("");
    setCopied(false);

    fetchHistory();

    setTimeout(() => {
      document
        .getElementById("history")
        ?.scrollIntoView({
          behavior: "smooth",
        });
    }, 100);
  };

  // ============================================================
  // VIEW SAVED NOTES
  // ============================================================

  const viewHistoryNotes = (item) => {
    setSelectedHistory(item);

    setNotes(
      item.notes || "No notes available."
    );

    setVideoTitle(
      item.video_title || "Video Notes"
    );

    setYoutubeLink(
      item.youtube_url || ""
    );

    setShowHistory(false);
    setCopied(false);

    setTimeout(() => {
      document
        .getElementById("notes")
        ?.scrollIntoView({
          behavior: "smooth",
        });
    }, 100);
  };

  // ============================================================
  // CLEAR
  // ============================================================

  const clearInput = () => {
    setYoutubeLink("");
    setNotes("");
    setVideoTitle("");
    setCopied(false);
    setSelectedHistory(null);
  };

  // ============================================================
  // HOME
  // ============================================================

  const goHome = () => {
    setShowHistory(false);
    setSelectedHistory(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ============================================================
  // ABOUT
  // ============================================================

  const showAbout = () => {
    alert(
      "VideoNote AI transforms YouTube videos into clear, structured study notes using AI-powered transcription and note generation."
    );
  };

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="app">

      {/* ======================================================
          NAVBAR
      ====================================================== */}

      <header className="navbar">

        <div
          className="brand"
          onClick={goHome}
        >
          <div className="brand-icon">
            V
          </div>

          <div>
            <div className="brand-name">
              VideoNote AI
            </div>

            <div className="brand-tagline">
              Learn smarter
            </div>
          </div>
        </div>

        <nav className="nav-links">

          <button
            className={`nav-link ${
              !showHistory ? "active" : ""
            }`}
            onClick={goHome}
          >
            Home
          </button>

          <button
            className={`nav-link ${
              showHistory ? "active" : ""
            }`}
            onClick={openHistory}
          >
            Notes
          </button>

          <button
            className="nav-link"
            onClick={showAbout}
          >
            About
          </button>

        </nav>

        <div className="nav-status">
          <span className="status-dot"></span>
          AI Ready
        </div>

      </header>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="main-content">

        {/* ====================================================
            HOME
        ==================================================== */}

        {!showHistory && (
          <>

            {/* HERO */}

            <section className="hero">

              <div className="hero-badge">
                <span>✦</span>
                AI-powered video learning
              </div>

              <h1>
                Turn videos into
                <span> smart notes.</span>
              </h1>

              <p>
                Transform YouTube videos into clear,
                structured study notes in minutes.
              </p>

            </section>

            {/* =================================================
                YOUTUBE INPUT
            ================================================= */}

            <section className="workspace-card">

              <div className="section-label">

                <span className="label-number">
                  01
                </span>

                Add your YouTube video

              </div>

              <div className="input-wrapper">

                <div className="input-icon">
                  ▶
                </div>

                <input
                  type="text"
                  placeholder="Paste a YouTube video URL"
                  value={youtubeLink}
                  onChange={(e) =>
                    setYoutubeLink(e.target.value)
                  }
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !loading
                    ) {
                      handleGenerate();
                    }
                  }}
                />

                {youtubeLink && !loading && (
                  <button
                    className="input-clear"
                    onClick={() =>
                      setYoutubeLink("")
                    }
                    aria-label="Clear URL"
                  >
                    ×
                  </button>
                )}

              </div>

              {/* GENERATE */}

              <div className="generate-area">

                <button
                  className="generate-btn"
                  onClick={handleGenerate}
                  disabled={loading}
                >

                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Processing video...
                    </>
                  ) : (
                    <>
                      Generate notes
                      <span className="arrow">
                        →
                      </span>
                    </>
                  )}

                </button>

                {(youtubeLink || notes) &&
                  !loading && (
                    <button
                      className="clear-link"
                      onClick={clearInput}
                    >
                      Clear
                    </button>
                  )}

              </div>

            </section>

            {/* =================================================
                FEATURES
            ================================================= */}

            <div className="feature-row">

              <div className="feature">
                <span>✦</span>
                AI-powered summaries
              </div>

              <div className="feature">
                <span>◉</span>
                Whisper transcription
              </div>

              <div className="feature">
                <span>✓</span>
                Structured study notes
              </div>

            </div>

            {/* =================================================
                PROCESSING
            ================================================= */}

            {loading && (
              <section className="processing-card">

                <div className="processing-header">

                  <div>

                    <div className="processing-title">
                      Creating your notes
                    </div>

                    <div className="processing-description">
                      This may take a few minutes depending
                      on the video length.
                    </div>

                  </div>

                  <div className="processing-spinner"></div>

                </div>

                <div className="processing-steps">

                  <div className="processing-step completed">
                    <span>✓</span>
                    Video received
                  </div>

                  <div className="processing-step active-step">
                    <span className="step-loader"></span>
                    Transcribing with Whisper
                  </div>

                  <div className="processing-step">
                    <span>3</span>
                    Generating AI notes
                  </div>

                </div>

              </section>
            )}

            {/* =================================================
                NOTES
            ================================================= */}

            {notes &&
              !loading && (

                <section
                  className="notes-section"
                  id="notes"
                >

                  <div className="section-label">

                    <span className="label-number">
                      02
                    </span>

                    {selectedHistory
                      ? "Saved notes"
                      : "Your notes"}

                  </div>

                  <div className="notes-card">

                    <div className="notes-header">

                      <div className="notes-heading">

                        <div className="notes-icon">
                          ✦
                        </div>

                        <div>

                          <div className="notes-label">
                            AI GENERATED NOTES
                          </div>

                          <h2>
                            {videoTitle ||
                              "Video Notes"}
                          </h2>

                        </div>

                      </div>

                      <div className="notes-actions">

                        <button
                          className="secondary-btn"
                          onClick={copyNotes}
                        >
                          {copied
                            ? "✓ Copied"
                            : "Copy"}
                        </button>

                        <button
                          className="primary-small-btn"
                          onClick={downloadPDF}
                        >
                          ↓ PDF
                        </button>

                      </div>

                    </div>

                    <div className="notes-divider"></div>

                    <article className="markdown-content">

                      <ReactMarkdown>
                        {notes}
                      </ReactMarkdown>

                    </article>

                  </div>

                </section>

              )}

          </>
        )}

        {/* ====================================================
            HISTORY / NOTES PAGE
        ==================================================== */}

        {showHistory && (
          <section
            className="history-section"
            id="history"
          >

            <div className="history-header">

              <div>

                <div className="hero-badge">
                  <span>✦</span>
                  Your learning library
                </div>

                <h1 className="history-title">
                  Your <span>saved notes.</span>
                </h1>

                <p className="history-description">
                  Access your previously generated
                  YouTube study notes anytime.
                </p>

              </div>

              <button
                className="history-back-btn"
                onClick={goHome}
              >
                ← Back to Home
              </button>

            </div>

            {/* LOADING */}

            {historyLoading && (
              <div className="history-loading">

                <span className="processing-spinner"></span>

                <p>
                  Loading your saved notes...
                </p>

              </div>
            )}

            {/* EMPTY */}

            {!historyLoading &&
              history.length === 0 && (

                <div className="history-empty">

                  <div className="history-empty-icon">
                    ✦
                  </div>

                  <h2>
                    No saved notes yet
                  </h2>

                  <p>
                    Generate notes from a YouTube
                    video and they will appear here.
                  </p>

                  <button
                    className="generate-btn history-create-btn"
                    onClick={goHome}
                  >
                    Generate your first notes →
                  </button>

                </div>

              )}

            {/* HISTORY LIST */}

            {!historyLoading &&
              history.length > 0 && (

                <div className="history-list">

                  <div className="history-count">
                    {history.length} saved{" "}
                    {history.length === 1
                      ? "video"
                      : "videos"}
                  </div>

                  {history.map((item, index) => (

                    <div
                      className="history-card"
                      key={
                        item.video_id ||
                        `${item.video_title}-${index}`
                      }
                    >

                      <div className="history-card-icon">
                        ▶
                      </div>

                      <div className="history-card-content">

                        <h2>
                          {item.video_title ||
                            "Untitled YouTube Video"}
                        </h2>

                        <p>
                          YouTube video •
                          AI-generated study notes
                        </p>

                        {item.youtube_url && (
                          <a
                            href={item.youtube_url}
                            target="_blank"
                            rel="noreferrer"
                            className="youtube-link"
                            onClick={(e) =>
                              e.stopPropagation()
                            }
                          >
                            Open YouTube video ↗
                          </a>
                        )}

                      </div>

                      <button
                        className="view-notes-btn"
                        onClick={() =>
                          viewHistoryNotes(item)
                        }
                      >
                        View Notes
                        <span>→</span>
                      </button>

                    </div>

                  ))}

                </div>

              )}

          </section>
        )}

      </main>

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="footer">

        <div className="footer-inner">

          <div
            className="footer-brand"
            onClick={goHome}
          >

            <div className="footer-logo">
              V
            </div>

            <div>

              <div className="footer-name">
                VideoNote AI
              </div>

              <div className="footer-tagline">
                Turn videos into knowledge.
              </div>

            </div>

          </div>

          <div className="footer-center">

            <span>
              AI-powered learning
            </span>

            <span className="footer-dot">
              •
            </span>

            <span>
              Built with Whisper & AI
            </span>

          </div>

          <div className="footer-right">
            © 2026 VideoNote AI
          </div>

        </div>

      </footer>

    </div>
  );
}

export default App;