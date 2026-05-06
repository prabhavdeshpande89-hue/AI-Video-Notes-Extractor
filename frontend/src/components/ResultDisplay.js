import React from "react";

function ResultDisplay({ show }) {
  if (!show) return null;

  return (
    <div style={{ marginTop: "30px", textAlign: "left" }}>
      <h2>📌 Notes</h2>
      <p>• AI is transforming industries</p>

      <h2>✅ Action Items</h2>
      <p>• Learn Python</p>

      <h2>⏱️ Timestamps</h2>
      <p>[00:10] Introduction</p>
    </div>
  );
}

export default ResultDisplay;