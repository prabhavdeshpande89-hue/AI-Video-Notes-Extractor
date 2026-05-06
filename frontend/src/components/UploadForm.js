import React, { useState } from "react";

function UploadForm() {

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const generateNotes = async () => {

    if (!youtubeUrl) {
      alert("Please enter YouTube URL");
      return;
    }

    try {

      setLoading(true);

      const response = await fetch(
        `http://127.0.0.1:8000/get-transcript?youtube_url=${youtubeUrl}`
      );

      const data = await response.json();

      console.log(data);

      if (data.status === "success") {
        setNotes(data.notes);
      } else {
        setNotes(data.message);
      }

    } catch (error) {

      console.log(error);

      setNotes("Something went wrong");

    } finally {

      setLoading(false);
    }
  };

  return (
    <div className="container">

      <h1>AI Video Text Extractor 🚀</h1>

      <input
        type="text"
        placeholder="Paste YouTube URL"
        value={youtubeUrl}
        onChange={(e) => setYoutubeUrl(e.target.value)}
      />

      <button onClick={generateNotes}>
        Generate Notes
      </button>

      {loading && <p>Generating AI Notes...</p>}

      {notes && (
        <div className="notes-box">
          <h2>AI Notes</h2>
          <pre>{notes}</pre>
        </div>
      )}

    </div>
  );
}

export default UploadForm;