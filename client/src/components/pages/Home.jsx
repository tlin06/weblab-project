import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, post } from "../../utilities";
import { UserContext } from "../App";
import Brand from "../modules/Brand";
import SearchBar from "../modules/SearchBar";
import AuthControls from "../modules/AuthControls";

const Home = () => {
  const navigate = useNavigate();
  const { userId } = useContext(UserContext);
  const [projects, setProjects] = useState([]);
  const [formState, setFormState] = useState({ title: "", description: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) {
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
  }, [userId]);

  const reminders = projects.flatMap((project) => project.reminders || []);

  const handleCreateProject = () => {
    if (!userId) {
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
        <Brand subtitle="Project hub" />

        <div>
          <div className="section-title">Reminders</div>
          <div className="sidebar-list">
            {reminders.length === 0 && <div className="sidebar-reminder">No reminders yet.</div>}
            {reminders.map((reminder, idx) => (
              <div className="sidebar-item" key={`${reminder}-${idx}`}>
                {reminder}
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="main main-scroll">
        <header className="topbar">
          <div>
            <div className="topbar-title">Projects</div>
            <div className="sidebar-reminder">Track resources, tabs, and notes.</div>
          </div>
          <div className="topbar-actions">
            <SearchBar />
            <AuthControls />
          </div>
        </header>

        <section className="panel" style={{ marginBottom: "16px" }}>
          <div className="panel-header">
            <div className="panel-title">Add a new project</div>
            <button
              className="button"
              type="button"
              onClick={handleCreateProject}
              disabled={!userId}
            >
              Create
            </button>
          </div>
          {error && <div className="empty-state">{error}</div>}
          {!userId && <div className="empty-state">Sign in to view and create projects.</div>}
          <div className="field">
            <label>Project title</label>
            <input
              value={formState.title}
              onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. 6.1210"
            />
          </div>
          <div className="field">
            <label>Short description</label>
            <input
              value={formState.description}
              onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="What is this for?"
            />
          </div>
        </section>

        <div className="grid-scroll">
          <section className="grid">
            {!userId && <div className="empty-state">Sign in to see your projects.</div>}
            {userId && projects.length === 0 && (
              <div className="empty-state">No projects yet. Create one above.</div>
            )}
            {userId &&
              projects.map((project) => (
                <div
                  key={project._id}
                  className="card"
                  onClick={() => navigate(`/project/${project._id}`)}
                >
                  <div className="card-title">{project.title}</div>
                  <div className="card-description">
                    {project.description || "No description yet."}
                  </div>
                </div>
              ))}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Home;
