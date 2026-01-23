import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin, googleLogout } from "@react-oauth/google";

import { get, post } from "../../utilities";
import { UserContext } from "../App";

const Home = () => {
  const navigate = useNavigate();
  const { user, authReady, handleLogin, handleLogout } = useContext(UserContext);
  const [projects, setProjects] = useState([]);
  const [formState, setFormState] = useState({ title: "", description: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProjects([]);
      setError("");
      return;
    }
    get("/api/projects")
      .then((data) => setProjects(data))
      .catch((err) => {
        console.log(err);
        setError("Could not load projects. Is the server running?");
      });
  }, [user, authReady]);

  const reminders = projects.flatMap((project) => project.reminders || []);

  const handleCreateProject = () => {
    if (!user) {
      setError("Please sign in to create a project.");
      return;
    }
    const payload = {
      title: formState.title.trim() || "Untitled Project",
      description: formState.description,
    };
    post("/api/projects", payload)
      .then((project) => {
        setProjects((prev) => [project, ...prev]);
        setFormState({ title: "", description: "" });
        setError("");
      })
      .catch((err) => {
        console.log(err);
        setError("Create project failed. Check the server and database connection.");
      });
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div
          className="brand"
          role="button"
          tabIndex={0}
          onClick={() => navigate("/")}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate("/");
          }}
        >
          <div className="brand-mark">LT</div>
          <div>
            <div className="brand-title">LinkTracker</div>
            <div className="sidebar-reminder">Project hub</div>
          </div>
        </div>

        <div>
          <div className="section-title">Reminders</div>
          <div className="sidebar-list">
            {reminders.length === 0 && (
              <div className="sidebar-reminder">No reminders yet.</div>
            )}
            {reminders.map((reminder, idx) => (
              <div className="sidebar-item" key={`${reminder}-${idx}`}>
                {reminder}
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="topbar-title">Projects</div>
            <div className="sidebar-reminder">Track resources, tabs, and notes.</div>
          </div>
          <div className="topbar-actions">
            <div className="search-bar" onClick={() => navigate("/search")}>
              Search (shell only)
            </div>
            {user ? (
              <div className="auth-chip">
                <span className="auth-name">{user.name}</span>
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => {
                    googleLogout();
                    handleLogout();
                  }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleLogin}
                onError={(err) => console.log(err)}
                useOneTap
              />
            )}
          </div>
        </header>

        <section className="panel" style={{ marginBottom: "16px" }}>
          <div className="panel-header">
            <div className="panel-title">Add a new project</div>
            <button
              className="button"
              type="button"
              onClick={handleCreateProject}
              disabled={!user}
            >
              Create
            </button>
          </div>
          {error && <div className="empty-state">{error}</div>}
          {!user && (
            <div className="empty-state">Sign in to view and create projects.</div>
          )}
          <div className="field">
            <label>Project title</label>
            <input
              value={formState.title}
              onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. 6.9620 - Final build"
            />
          </div>
          <div className="field">
            <label>Short description</label>
            <input
              value={formState.description}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="What are you working on?"
            />
          </div>
        </section>

        <section className="grid">
          {!user && <div className="empty-state">Sign in to see your projects.</div>}
          {user && projects.length === 0 && (
            <div className="empty-state">No projects yet. Create one above.</div>
          )}
          {user &&
            projects.map((project) => (
              <div
                key={project._id}
                className="card"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/project/${project._id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(`/project/${project._id}`);
                }}
              >
                <div className="card-title">{project.title}</div>
                <div className="card-description">
                  {project.description || "No description yet."}
                </div>
              </div>
            ))}
        </section>
      </main>
    </div>
  );
};

export default Home;
