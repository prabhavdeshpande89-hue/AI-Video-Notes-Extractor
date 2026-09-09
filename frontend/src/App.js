import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";
import "./App.css";

const API_URL = "http://15.252.182.106:8000";

function App() {
  // ============================================================
  // AUTHENTICATION
  // ============================================================

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoadingAction, setAuthLoadingAction] = useState(false);

  // ============================================================
  // MAIN APP STATE
  // ============================================================

  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [copied, setCopied] = useState(false);

  // ============================================================
  // HISTORY
  // ============================================================

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);

  // ============================================================
  // ADMIN
  // ============================================================

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminHistory, setAdminHistory] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // ============================================================
  // DARK MODE
  // ============================================================

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("videonote_dark_mode") === "true";
  });

  const [deleteLoading, setDeleteLoading] = useState(null);

  useEffect(() => {
    localStorage.setItem(
      "videonote_dark_mode",
      darkMode ? "true" : "false"
    );

    document.body.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  // ============================================================
  // CHECK EXISTING LOGIN SESSION
  // ============================================================

  useEffect(() => {
    const token = sessionStorage.getItem("access_token");

    if (!token) {
      setAuthLoading(false);
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Session expired");
        }

        return response.json();
      })
      .then((data) => {
        if (data.success) {
          setUser(data);
        } else {
          throw new Error("Invalid session");
        }
      })
      .catch(() => {
        sessionStorage.removeItem("access_token");
        setUser(null);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  // ============================================================
  // LOGIN
  // ============================================================

  const handleLogin = async (e) => {
    e.preventDefault();

    setAuthError("");
    setAuthMessage("");

    if (!authEmail.trim() || !authPassword) {
      setAuthError("Please enter your email and password.");
      return;
    }

    try {
      setAuthLoadingAction(true);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setAuthError(
          data.detail ||
            data.message ||
            "Invalid email or password."
        );
        return;
      }

      sessionStorage.setItem(
        "access_token",
        data.access_token
      );

      setUser({
        success: true,
        email: data.email,
        role: data.role,
      });

      setAuthEmail("");
      setAuthPassword("");
      setAuthError("");

      if (data.role === "admin") {
        setShowAdmin(true);
        setShowHistory(false);
        loadAdminDashboard(data.access_token);
      } else {
        setShowAdmin(false);
        setShowHistory(false);
      }
    } catch (error) {
      console.error("Login error:", error);

      setAuthError(
        "Unable to connect to the backend. Make sure FastAPI is running."
      );
    } finally {
      setAuthLoadingAction(false);
    }
  };

  // ============================================================
  // REGISTER
  // ============================================================

  const handleRegister = async (e) => {
    e.preventDefault();

    setAuthError("");
    setAuthMessage("");

    if (!authEmail.trim() || !authPassword) {
      setAuthError("Please enter an email and password.");
      return;
    }

    if (authPassword.length < 6) {
      setAuthError(
        "Password must be at least 6 characters long."
      );
      return;
    }

    try {
      setAuthLoadingAction(true);

      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setAuthError(
          data.detail ||
            data.message ||
            "Registration failed."
        );
        return;
      }

      setAuthMessage(
        "Account created successfully. Please login."
      );

      setAuthMode("login");
      setAuthPassword("");
    } catch (error) {
      console.error("Registration error:", error);

      setAuthError(
        "Unable to connect to the backend. Make sure FastAPI is running."
      );
    } finally {
      setAuthLoadingAction(false);
    }
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = () => {
    sessionStorage.removeItem("access_token");

    setUser(null);

    setNotes("");
    setYoutubeLink("");
    setVideoTitle("");
    setHistory([]);
    setAdminUsers([]);
    setAdminHistory([]);

    setShowHistory(false);
    setShowAdmin(false);
    setSelectedHistory(null);

    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
    setAuthMessage("");
    setAuthMode("login");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ============================================================
  // AUTH HEADERS
  // ============================================================

  const getAuthHeaders = () => {
    const token = sessionStorage.getItem("access_token");

    return {
      Authorization: `Bearer ${token}`,
    };
  };

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

    const token = sessionStorage.getItem("access_token");

    if (!token) {
      setAuthError("Please login to generate notes.");
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
        `${API_URL}/get-transcript?youtube_url=${encodedURL}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

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
  // FETCH USER HISTORY
  // ============================================================

  const fetchHistory = async () => {
    const token = sessionStorage.getItem("access_token");

    if (!token) {
      handleLogout();
      return;
    }

    try {
      setHistoryLoading(true);

      const response = await fetch(
        `${API_URL}/history`,
        {
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (response.ok && data.success) {
        setHistory(data.history || []);
      } else {
        console.error(
          "Failed to load history:",
          data
        );

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
  // FETCH ADMIN DATA
  // ============================================================

  const loadAdminDashboard = async (
    token = sessionStorage.getItem("access_token")
  ) => {
    if (!token) {
      handleLogout();
      return;
    }

    try {
      setAdminLoading(true);

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [usersResponse, historyResponse] =
        await Promise.all([
          fetch(`${API_URL}/admin/users`, {
            headers,
          }),
          fetch(`${API_URL}/history`, {
            headers,
          }),
        ]);

      if (
        usersResponse.status === 401 ||
        historyResponse.status === 401
      ) {
        handleLogout();
        return;
      }

      if (usersResponse.ok) {
        const usersData =
          await usersResponse.json();

        setAdminUsers(
          usersData.users || []
        );
      }

      if (historyResponse.ok) {
        const historyData =
          await historyResponse.json();

        setAdminHistory(
          historyData.history || []
        );
      }
    } catch (error) {
      console.error(
        "Admin dashboard error:",
        error
      );
    } finally {
      setAdminLoading(false);
    }
  };

  // ============================================================
  // DELETE NOTE
  // ============================================================

  const deleteNote = async (item) => {
    if (!item?.video_id) {
      alert("Unable to identify this note.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${item.video_title || "this note"}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    const token =
      sessionStorage.getItem("access_token");

    if (!token) {
      handleLogout();
      return;
    }

    try {
      setDeleteLoading(item.video_id);

      const response = await fetch(
        `${API_URL}/notes/${encodeURIComponent(
          item.video_id
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok || data.success === false) {
        alert(
          data.detail ||
            data.message ||
            "Could not delete the note."
        );
        return;
      }

      setHistory((previous) =>
        previous.filter(
          (note) =>
            note.video_id !== item.video_id
        )
      );

      setAdminHistory((previous) =>
        previous.filter(
          (note) =>
            note.video_id !== item.video_id
        )
      );

      if (
        selectedHistory?.video_id ===
        item.video_id
      ) {
        setSelectedHistory(null);
        setNotes("");
        setVideoTitle("");
        setYoutubeLink("");
      }
    } catch (error) {
      console.error("Delete error:", error);

      alert(
        "Could not connect to the backend."
      );
    } finally {
      setDeleteLoading(null);
    }
  };

  // ============================================================
  // OPEN HISTORY
  // ============================================================

  const openHistory = () => {
    setShowHistory(true);
    setShowAdmin(false);
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
  // OPEN ADMIN
  // ============================================================

  const openAdmin = () => {
    if (!user || user.role !== "admin") {
      return;
    }

    setShowAdmin(true);
    setShowHistory(false);
    setNotes("");
    setSelectedHistory(null);

    loadAdminDashboard();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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
    setShowAdmin(false);
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
    setShowAdmin(false);
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
  // AUTH LOADING SCREEN
  // ============================================================

  if (authLoading) {
    return (
      <div
        style={styles.authPage}
        className={
          darkMode ? "dark-mode" : ""
        }
      >
        <div style={styles.authCard}>
          <div style={styles.authLogo}>
            V
          </div>

          <h1 style={styles.authTitle}>
            VideoNote AI
          </h1>

          <p style={styles.authSubtitle}>
            Checking your session...
          </p>

          <div
            className="processing-spinner"
            style={{
              margin: "25px auto 0",
            }}
          ></div>
        </div>
      </div>
    );
  }

  // ============================================================
  // LOGIN / REGISTER SCREEN
  // ============================================================

  if (!user) {
    return (
      <div
        style={styles.authPage}
        className={
          darkMode ? "dark-mode" : ""
        }
      >
        <div style={styles.authCard}>

          <div style={styles.authLogo}>
            V
          </div>

          <div style={styles.authBrand}>
            VideoNote AI
          </div>

          <h1 style={styles.authTitle}>
            {authMode === "login"
              ? "Welcome back"
              : "Create your account"}
          </h1>

          <p style={styles.authSubtitle}>
            {authMode === "login"
              ? "Sign in to continue learning smarter."
              : "Start turning YouTube videos into smart notes."}
          </p>

          {authError && (
            <div style={styles.authError}>
              {authError}
            </div>
          )}

          {authMessage && (
            <div style={styles.authSuccess}>
              {authMessage}
            </div>
          )}

          <form
            onSubmit={
              authMode === "login"
                ? handleLogin
                : handleRegister
            }
          >
            <label style={styles.authLabel}>
              Email
            </label>

            <input
              type="email"
              placeholder="you@example.com"
              value={authEmail}
              onChange={(e) =>
                setAuthEmail(e.target.value)
              }
              style={styles.authInput}
              disabled={authLoadingAction}
              autoComplete="email"
            />

            <label style={styles.authLabel}>
              Password
            </label>

            <input
              type="password"
              placeholder="Enter your password"
              value={authPassword}
              onChange={(e) =>
                setAuthPassword(e.target.value)
              }
              style={styles.authInput}
              disabled={authLoadingAction}
              autoComplete={
                authMode === "login"
                  ? "current-password"
                  : "new-password"
              }
            />

            <button
              type="submit"
              style={styles.authButton}
              disabled={authLoadingAction}
            >
              {authLoadingAction ? (
                <>
                  <span
                    className="spinner"
                    style={{
                      display: "inline-block",
                      marginRight: "9px",
                    }}
                  ></span>

                  {authMode === "login"
                    ? "Signing in..."
                    : "Creating account..."}
                </>
              ) : authMode === "login" ? (
                "Sign in →"
              ) : (
                "Create account →"
              )}
            </button>
          </form>

          <div style={styles.authSwitch}>
            {authMode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}

            <button
              type="button"
              onClick={() => {
                setAuthMode(
                  authMode === "login"
                    ? "register"
                    : "login"
                );

                setAuthError("");
                setAuthMessage("");
                setAuthPassword("");
              }}
              style={styles.authSwitchButton}
            >
              {authMode === "login"
                ? " Register"
                : " Login"}
            </button>
          </div>

          <div style={styles.authFooter}>
            AI-powered learning • Built with Whisper & AI
          </div>

          <button
            type="button"
            className="auth-theme-toggle"
            onClick={() =>
              setDarkMode(
                (previous) => !previous
              )
            }
            aria-label="Toggle dark mode"
          >
            {darkMode
              ? "☀ Light mode"
              : "☾ Dark mode"}
          </button>

        </div>
      </div>
    );
  }

  // ============================================================
  // ADMIN DASHBOARD
  // ============================================================

  if (
    showAdmin &&
    user.role === "admin"
  ) {
    return (
      <div
        className={
          darkMode
            ? "app dark-mode-app"
            : "app"
        }
      >

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
                Admin Console
              </div>
            </div>
          </div>

          <nav className="nav-links">

            <button
              className="nav-link"
              onClick={goHome}
            >
              Home
            </button>

            <button
              className="nav-link"
              onClick={() => {
                setShowAdmin(false);
                openHistory();
              }}
            >
              Notes
            </button>

            <button
              className="nav-link active"
              onClick={openAdmin}
            >
              Admin
            </button>

          </nav>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >

            <div className="nav-status">
              <span className="status-dot"></span>
              Admin
            </div>

            <button
              className="theme-toggle"
              onClick={() =>
                setDarkMode(
                  (previous) => !previous
                )
              }
              title={
                darkMode
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              aria-label="Toggle dark mode"
            >
              {darkMode ? "☀" : "☾"}
            </button>

            <button
              onClick={handleLogout}
              style={styles.logoutButton}
            >
              Logout
            </button>

          </div>

        </header>

        <main
          style={{
            width: "min(1100px, 92%)",
            margin: "0 auto",
            padding: "70px 0",
            flex: 1,
          }}
        >

          <div
            className="hero"
            style={{
              textAlign: "left",
            }}
          >

            <div className="hero-badge">
              <span>✦</span>
              Administrator dashboard
            </div>

            <h1
              style={{
                marginLeft: 0,
                marginRight: 0,
              }}
            >
              Manage your
              <span> platform.</span>
            </h1>

            <p
              style={{
                marginLeft: 0,
              }}
            >
              Monitor registered users and all
              generated learning notes.
            </p>

          </div>

          {adminLoading ? (
            <div className="history-loading">
              <span className="processing-spinner"></span>

              <p>
                Loading admin dashboard...
              </p>
            </div>
          ) : (
            <>
              {/* ADMIN STATS */}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "16px",
                  marginBottom: "30px",
                }}
              >

                <div style={styles.adminStat}>
                  <div style={styles.adminStatLabel}>
                    TOTAL USERS
                  </div>

                  <div style={styles.adminStatValue}>
                    {adminUsers.length}
                  </div>
                </div>

                <div style={styles.adminStat}>
                  <div style={styles.adminStatLabel}>
                    TOTAL NOTES
                  </div>

                  <div style={styles.adminStatValue}>
                    {adminHistory.length}
                  </div>
                </div>

                <div style={styles.adminStat}>
                  <div style={styles.adminStatLabel}>
                    ADMIN ACCOUNTS
                  </div>

                  <div style={styles.adminStatValue}>
                    {
                      adminUsers.filter(
                        (u) =>
                          u.role === "admin"
                      ).length
                    }
                  </div>
                </div>

              </div>

              {/* USERS */}

              <section
                style={styles.adminSection}
              >

                <div
                  style={
                    styles.adminSectionHeader
                  }
                >
                  <div>

                    <div
                      style={
                        styles.adminSectionLabel
                      }
                    >
                      USERS
                    </div>

                    <h2
                      style={
                        styles.adminSectionTitle
                      }
                    >
                      Registered accounts
                    </h2>

                  </div>
                </div>

                {adminUsers.length === 0 ? (
                  <div
                    style={
                      styles.adminEmpty
                    }
                  >
                    No users found.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >

                    {adminUsers.map(
                      (
                        account,
                        index
                      ) => (
                        <div
                          key={
                            account.email ||
                            index
                          }
                          style={
                            styles.adminUserRow
                          }
                        >

                          <div
                            style={
                              styles.adminAvatar
                            }
                          >
                            {account.email
                              ?.charAt(0)
                              .toUpperCase() ||
                              "U"}
                          </div>

                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                            }}
                          >

                            <div
                              style={
                                styles.adminUserEmail
                              }
                            >
                              {account.email}
                            </div>

                            <div
                              style={
                                styles.adminUserDate
                              }
                            >
                              Created{" "}
                              {account.created_at
                                ? new Date(
                                    account.created_at
                                  ).toLocaleString()
                                : "—"}
                            </div>

                          </div>

                          <span
                            style={{
                              ...styles.roleBadge,
                              ...(account.role ===
                              "admin"
                                ? styles.adminRole
                                : styles.userRole),
                            }}
                          >
                            {account.role}
                          </span>

                        </div>
                      )
                    )}

                  </div>
                )}

              </section>

              {/* ALL NOTES */}

              <section
                style={{
                  ...styles.adminSection,
                  marginTop: "24px",
                }}
              >

                <div
                  style={
                    styles.adminSectionHeader
                  }
                >

                  <div>

                    <div
                      style={
                        styles.adminSectionLabel
                      }
                    >
                      NOTES
                    </div>

                    <h2
                      style={
                        styles.adminSectionTitle
                      }
                    >
                      All generated notes
                    </h2>

                  </div>

                </div>

                {adminHistory.length === 0 ? (
                  <div
                    style={
                      styles.adminEmpty
                    }
                  >
                    No generated notes yet.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >

                    {adminHistory.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          key={
                            item.video_id ||
                            `${item.video_title}-${index}`
                          }
                          style={
                            styles.adminNoteRow
                          }
                        >

                          <div
                            style={
                              styles.adminNoteIcon
                            }
                          >
                            ▶
                          </div>

                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                            }}
                          >

                            <div
                              style={
                                styles.adminNoteTitle
                              }
                            >
                              {item.video_title ||
                                "YouTube Video"}
                            </div>

                            <div
                              style={
                                styles.adminNoteMeta
                              }
                            >
                              {item.user_email
                                ? `Created by ${item.user_email}`
                                : "User information unavailable"}

                              {" • "}

                              {item.created_at
                                ? new Date(
                                    item.created_at
                                  ).toLocaleString()
                                : "Date unavailable"}
                            </div>

                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexShrink: 0,
                            }}
                          >

                            <button
                              style={
                                styles.adminViewButton
                              }
                              onClick={() =>
                                viewHistoryNotes(
                                  item
                                )
                              }
                            >
                              View →
                            </button>

                            <button
                              style={
                                styles.adminDeleteButton
                              }
                              onClick={() =>
                                deleteNote(item)
                              }
                              disabled={
                                deleteLoading ===
                                item.video_id
                              }
                            >
                              {deleteLoading ===
                              item.video_id
                                ? "Deleting..."
                                : "Delete"}
                            </button>

                          </div>

                        </div>
                      )
                    )}

                  </div>
                )}

              </section>

            </>
          )}

        </main>

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
                Admin Console
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

  // ============================================================
  // NORMAL USER / MAIN APP
  // ============================================================

  return (
    <div
      className={
        darkMode
          ? "app dark-mode-app"
          : "app"
      }
    >

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

          {user.role === "admin" && (
            <button
              className="nav-link"
              onClick={openAdmin}
            >
              Admin
            </button>
          )}

        </nav>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >

          <div className="nav-status">

            <span className="status-dot"></span>

            {user.role === "admin"
              ? "Admin"
              : "AI Ready"}

          </div>

          <button
            className="theme-toggle"
            onClick={() =>
              setDarkMode(
                (previous) => !previous
              )
            }
            title={
              darkMode
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            aria-label="Toggle dark mode"
          >
            {darkMode ? "☀" : "☾"}
          </button>

          <button
            onClick={handleLogout}
            style={styles.logoutButton}
          >
            Logout
          </button>

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

                <span>
                  smart notes.
                </span>

              </h1>

              <p>
                Transform YouTube videos into clear,
                structured study notes in minutes.
              </p>

              <div
                style={{
                  marginTop: "14px",
                  color: "#98a2b3",
                  fontSize: "12px",
                }}
              >
                Signed in as{" "}
                <strong
                  style={{
                    color: "#667085",
                  }}
                >
                  {user.email}
                </strong>
              </div>

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
                    setYoutubeLink(
                      e.target.value
                    )
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

                {youtubeLink &&
                  !loading && (
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

                {(youtubeLink ||
                  notes) &&
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

                    <span>
                      ✓
                    </span>

                    Video received

                  </div>

                  <div className="processing-step active-step">

                    <span className="step-loader"></span>

                    Transcribing with Whisper

                  </div>

                  <div className="processing-step">

                    <span>
                      3
                    </span>

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

                        {selectedHistory && (
                          <button
                            className="delete-note-btn"
                            onClick={() =>
                              deleteNote(
                                selectedHistory
                              )
                            }
                            disabled={
                              deleteLoading ===
                              selectedHistory.video_id
                            }
                          >
                            {deleteLoading ===
                            selectedHistory.video_id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        )}

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

                  <span>
                    ✦
                  </span>

                  Your learning library

                </div>

                <h1 className="history-title">

                  Your{" "}

                  <span>
                    saved notes.
                  </span>

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

                  {history.map(
                    (item, index) => (

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
                              href={
                                item.youtube_url
                              }
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

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >

                          <button
                            className="view-notes-btn"
                            onClick={() =>
                              viewHistoryNotes(
                                item
                              )
                            }
                          >
                            View Notes

                            <span>
                              →
                            </span>

                          </button>

                          <button
                            className="delete-note-btn"
                            onClick={() =>
                              deleteNote(item)
                            }
                            disabled={
                              deleteLoading ===
                              item.video_id
                            }
                          >
                            {deleteLoading ===
                            item.video_id
                              ? "Deleting..."
                              : "Delete"}
                          </button>

                        </div>

                      </div>

                    )
                  )}

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

// ============================================================
// AUTH / ADMIN INLINE STYLES
// ============================================================

const styles = {

  authPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "30px 20px",
    background:
      "radial-gradient(circle at 50% -20%, rgba(79, 70, 229, 0.10), transparent 40%), #f7f8fc",
    fontFamily: '"DM Sans", sans-serif',
  },

  authCard: {
    width: "min(430px, 100%)",
    background: "#ffffff",
    border: "1px solid #e6e9ef",
    borderRadius: "20px",
    padding: "38px",
    boxShadow:
      "0 20px 60px rgba(15, 23, 42, 0.10)",
  },

  authLogo: {
    width: "48px",
    height: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#111827",
    color: "#ffffff",
    borderRadius: "13px",
    fontFamily: '"Manrope", sans-serif',
    fontSize: "20px",
    fontWeight: 800,
    marginBottom: "14px",
  },

  authBrand: {
    color: "#344054",
    fontFamily: '"Manrope", sans-serif',
    fontSize: "14px",
    fontWeight: 700,
    marginBottom: "30px",
  },

  authTitle: {
    margin: 0,
    color: "#101828",
    fontFamily: '"Manrope", sans-serif',
    fontSize: "30px",
    lineHeight: 1.2,
    letterSpacing: "-1px",
    fontWeight: 800,
  },

  authSubtitle: {
    margin: "10px 0 28px",
    color: "#667085",
    fontSize: "14px",
    lineHeight: 1.6,
  },

  authLabel: {
    display: "block",
    color: "#344054",
    fontSize: "12px",
    fontWeight: 700,
    marginBottom: "7px",
  },

  authInput: {
    width: "100%",
    height: "50px",
    border: "1px solid #d9dee8",
    borderRadius: "10px",
    outline: "none",
    padding: "0 14px",
    color: "#111827",
    background: "#ffffff",
    fontSize: "14px",
    marginBottom: "18px",
    fontFamily: '"DM Sans", sans-serif',
  },

  authButton: {
    width: "100%",
    height: "50px",
    border: "none",
    borderRadius: "10px",
    background: "#111827",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: "5px",
  },

  authError: {
    padding: "11px 13px",
    marginBottom: "18px",
    borderRadius: "9px",
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#be123c",
    fontSize: "12px",
    lineHeight: 1.5,
  },

  authSuccess: {
    padding: "11px 13px",
    marginBottom: "18px",
    borderRadius: "9px",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    fontSize: "12px",
    lineHeight: 1.5,
  },

  authSwitch: {
    marginTop: "22px",
    textAlign: "center",
    color: "#98a2b3",
    fontSize: "12px",
  },

  authSwitchButton: {
    border: "none",
    background: "transparent",
    color: "#4f46e5",
    fontWeight: 700,
    fontSize: "12px",
    cursor: "pointer",
  },

  authFooter: {
    marginTop: "30px",
    paddingTop: "20px",
    borderTop: "1px solid #eef0f4",
    textAlign: "center",
    color: "#98a2b3",
    fontSize: "10px",
  },

  logoutButton: {
    border: "1px solid #e6e9ef",
    background: "#ffffff",
    color: "#475467",
    borderRadius: "8px",
    padding: "7px 11px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },

  adminStat: {
    background: "#ffffff",
    border: "1px solid #e6e9ef",
    borderRadius: "15px",
    padding: "22px",
    boxShadow:
      "0 8px 30px rgba(15, 23, 42, 0.04)",
  },

  adminStatLabel: {
    color: "#98a2b3",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "1px",
    marginBottom: "10px",
  },

  adminStatValue: {
    color: "#101828",
    fontFamily: '"Manrope", sans-serif',
    fontSize: "30px",
    fontWeight: 800,
  },

  adminSection: {
    background: "#ffffff",
    border: "1px solid #e6e9ef",
    borderRadius: "17px",
    padding: "24px",
    boxShadow:
      "0 8px 30px rgba(15, 23, 42, 0.04)",
  },

  adminSectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "20px",
  },

  adminSectionLabel: {
    color: "#98a2b3",
    fontSize: "9px",
    fontWeight: 800,
    letterSpacing: "1.1px",
    marginBottom: "5px",
  },

  adminSectionTitle: {
    margin: 0,
    color: "#101828",
    fontFamily: '"Manrope", sans-serif',
    fontSize: "18px",
    fontWeight: 700,
  },

  adminUserRow: {
    display: "flex",
    alignItems: "center",
    gap: "13px",
    padding: "13px",
    border: "1px solid #eef0f4",
    borderRadius: "11px",
    background: "#fafbfc",
  },

  adminAvatar: {
    width: "38px",
    height: "38px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px",
    background: "#eef2ff",
    color: "#4f46e5",
    fontWeight: 800,
    fontSize: "13px",
  },

  adminUserEmail: {
    color: "#344054",
    fontSize: "13px",
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  adminUserDate: {
    color: "#98a2b3",
    fontSize: "10px",
    marginTop: "3px",
  },

  roleBadge: {
    flexShrink: 0,
    padding: "5px 9px",
    borderRadius: "100px",
    fontSize: "9px",
    fontWeight: 800,
    textTransform: "uppercase",
  },

  adminRole: {
    background: "#eef2ff",
    color: "#4f46e5",
  },

  userRole: {
    background: "#f2f4f7",
    color: "#667085",
  },

  adminNoteRow: {
    display: "flex",
    alignItems: "center",
    gap: "13px",
    padding: "14px",
    border: "1px solid #eef0f4",
    borderRadius: "11px",
    background: "#fafbfc",
  },

  adminNoteIcon: {
    width: "40px",
    height: "40px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px",
    background: "#fff1f2",
    color: "#ef4444",
    fontSize: "14px",
  },

  adminNoteTitle: {
    color: "#344054",
    fontSize: "13px",
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  adminNoteMeta: {
    color: "#98a2b3",
    fontSize: "10px",
    marginTop: "4px",
  },

  adminViewButton: {
    flexShrink: 0,
    border: "1px solid #d9dee8",
    background: "#ffffff",
    color: "#475467",
    borderRadius: "8px",
    padding: "8px 11px",
    fontSize: "10px",
    fontWeight: 700,
    cursor: "pointer",
  },

  adminDeleteButton: {
    flexShrink: 0,
    border: "1px solid #fecdd3",
    background: "#fff1f2",
    color: "#be123c",
    borderRadius: "8px",
    padding: "8px 11px",
    fontSize: "10px",
    fontWeight: 700,
    cursor: "pointer",
  },

  adminEmpty: {
    padding: "30px",
    textAlign: "center",
    color: "#98a2b3",
    fontSize: "13px",
    background: "#fafbfc",
    borderRadius: "10px",
  },
};

export default App;