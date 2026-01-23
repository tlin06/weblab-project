import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { GoogleLogin, googleLogout } from "@react-oauth/google";

import { get, post } from "../../utilities";
import { UserContext } from "../App";

const Project = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, authReady, handleLogin, handleLogout } = useContext(UserContext);
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [projectDraft, setProjectDraft] = useState({ title: "", description: "" });
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState(null);
  const [resourceDraft, setResourceDraft] = useState({
    title: "",
    purpose: "",
    notes: "",
    url: "",
  });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingPurpose, setIsEditingPurpose] = useState(false);
  const [saveError, setSaveError] = useState("");
  const notesSaveTimer = useRef(null);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProjects([]);
      return;
    }
    get("/api/projects").then((data) => setProjects(data));
  }, [user, authReady]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProject(null);
      setSelectedResourceId(null);
      return;
    }
    get(`/api/projects/${projectId}`).then((data) => {
      setProject(data);
      setProjectDraft({
        title: data.title || "",
        description: data.description || "",
      });
      setIsEditingProject(false);
      if (data.resources && data.resources.length > 0) {
        setSelectedResourceId(String(data.resources[0]._id));
      } else {
        setSelectedResourceId(null);
      }
    });
  }, [projectId, user, authReady]);

  const handleSaveProject = () => {
    if (!projectId) return;
    post(`/api/projects/${projectId}`, {
      title: projectDraft.title,
      description: projectDraft.description,
    }).then((updated) => {
      setProject(updated);
      setProjects((prev) =>
        prev.map((item) => (item._id === updated._id ? updated : item))
      );
      setProjectDraft({
        title: updated.title || "",
        description: updated.description || "",
      });
      setIsEditingProject(false);
    });
  };

  const selectedResource = useMemo(() => {
    if (!project || !selectedResourceId) return null;
    return (
      project.resources.find(
        (resource) => String(resource._id) === String(selectedResourceId)
      ) || null
    );
  }, [project, selectedResourceId]);

  useEffect(() => {
    if (selectedResource) {
      setResourceDraft({
        title: selectedResource.title || "",
        purpose: selectedResource.purpose || "",
        notes: selectedResource.notes || "",
        url: selectedResource.url || "",
      });
      setIsEditingTitle(false);
      setIsEditingPurpose(false);
      setSaveError("");
    }
  }, [selectedResource]);

  useEffect(() => {
    return () => {
      if (notesSaveTimer.current) {
        clearTimeout(notesSaveTimer.current);
      }
    };
  }, []);

  const handleAddResource = () => {
    if (!project) return;
    post(`/api/projects/${projectId}/resources`, {
      title: "New Resource",
      url: "https://",
    }).then((resource) => {
      setProject((prev) => ({
        ...prev,
        resources: [resource, ...(prev?.resources || [])],
      }));
      setSelectedResourceId(String(resource._id));
    });
  };

  const saveResource = (updates) => {
    if (!selectedResourceId) return Promise.resolve();
    setSaveError("");
    return post(`/api/resources/${selectedResourceId}`, updates)
      .then((updated) => {
        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            resources: (prev.resources || []).map((resource) =>
              String(resource._id) === String(updated._id) ? updated : resource
            ),
          };
        });
        return updated;
      })
      .catch((err) => {
        console.log(err);
        setSaveError("Save failed. Please sign in and try again.");
      });
  };

  const handleAddTabGroup = () => {
    if (!project) return;
    const title = window.prompt("Tab group title");
    if (!title) return;
    post(`/api/projects/${projectId}/tabgroups`, { title }).then((tabGroup) => {
      setProject((prev) => ({
        ...prev,
        tabGroups: [...(prev?.tabGroups || []), tabGroup],
      }));
    });
  };

  const handleAddTab = (tabGroupId) => {
    if (!project) return;
    const title = window.prompt("Tab title");
    const url = window.prompt("Tab URL");
    if (!title || !url) return;
    post(`/api/tabgroups/${tabGroupId}/links`, { title, url }).then((tabGroup) => {
      setProject((prev) => ({
        ...prev,
        tabGroups: prev.tabGroups.map((group) =>
          group._id === tabGroup._id ? tabGroup : group
        ),
      }));
    });
  };

  const handleOpenAllTabs = (tabGroup) => {
    (tabGroup.links || []).forEach((link) => {
      if (link.url) {
        window.open(link.url, "_blank", "noopener,noreferrer");
      }
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
            <div className="sidebar-reminder">Project view</div>
          </div>
        </div>

        <div>
          <div className="section-title">Projects</div>
          <div className="sidebar-list">
            {projects.map((item) => (
              <button
                type="button"
                key={item._id}
                className={`sidebar-item ${item._id === projectId ? "active" : ""}`}
                onClick={() => navigate(`/project/${item._id}`)}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="section-title">Reminders</div>
          <div className="sidebar-list">
            {(project?.reminders || []).length === 0 && (
              <div className="sidebar-reminder">No reminders yet.</div>
            )}
            {(project?.reminders || []).map((reminder, idx) => (
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
            {isEditingProject ? (
              <div className="project-edit">
                <input
                  className="project-edit-title"
                  value={projectDraft.title}
                  onChange={(e) =>
                    setProjectDraft((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Project title"
                />
                <input
                  className="project-edit-description"
                  value={projectDraft.description}
                  onChange={(e) =>
                    setProjectDraft((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Project description"
                />
              </div>
            ) : (
              <>
                <div className="topbar-title">{project?.title || "Project"}</div>
                <div className="sidebar-reminder">{project?.description}</div>
              </>
            )}
          </div>
          <div className="topbar-actions">
            {user && (
              <button
                className="button ghost"
                type="button"
                onClick={() => {
                  if (isEditingProject) {
                    handleSaveProject();
                  } else {
                    setIsEditingProject(true);
                  }
                }}
              >
                {isEditingProject ? "Save Project" : "Edit Project"}
              </button>
            )}
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

        {!user && authReady ? (
          <div className="empty-state" style={{ padding: "16px 18px" }}>
            Sign in to view this project.
          </div>
        ) : (
          <div className="content-columns">
            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">Resources</div>
                <button className="button ghost" type="button" onClick={handleAddResource}>
                  + Add Resource
                </button>
              </div>
              {project?.resources?.length ? (
                project.resources.map((resource) => (
                  <div
                    key={resource._id}
                    className={`resource-item ${
                      resource._id === selectedResourceId ? "active" : ""
                    }`}
                    onClick={() => setSelectedResourceId(resource._id)}
                  >
                <div className="resource-title">{resource.title}</div>
              </div>
            ))
          ) : (
            <div className="empty-state">No resources yet.</div>
          )}

              <div className="tabgroup">
                <div className="panel-header">
                  <div className="panel-title">Tab Groups</div>
                  <button className="button ghost" type="button" onClick={handleAddTabGroup}>
                    + Add Group
                  </button>
                </div>
                {(project?.tabGroups || []).length === 0 && (
                  <div className="empty-state">No tab groups yet.</div>
                )}
                {(project?.tabGroups || []).map((tabGroup) => (
                  <div key={tabGroup._id} style={{ marginBottom: "12px" }}>
                    <div className="resource-title">{tabGroup.title}</div>
                    {(tabGroup.links || []).map((link, idx) => (
                      <div className="tab-link" key={`${link.title}-${idx}`}>
                        <span>{link.title}</span>
                        <span>{link.url}</span>
                      </div>
                    ))}
                    <div className="tab-actions">
                      <button
                        className="button ghost"
                        type="button"
                        onClick={() => handleOpenAllTabs(tabGroup)}
                      >
                        Open All Tabs
                      </button>
                      <button
                        className="button ghost"
                        type="button"
                        onClick={() => handleAddTab(tabGroup._id)}
                      >
                        + Add Tab
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
            <div className="panel-header">
              <div className="panel-title">Resource Details</div>
            </div>
            {saveError && <div className="empty-state">{saveError}</div>}
            {!selectedResource && <div className="empty-state">Select a resource.</div>}
            {selectedResource && (
              <>
                <div className="field">
                  <div className="field-header">
                    <label>Title</label>
                    <button
                      className="button ghost small"
                      type="button"
                      onClick={() => {
                        if (isEditingTitle) {
                          saveResource({ title: resourceDraft.title });
                        }
                        setIsEditingTitle((prev) => !prev);
                      }}
                    >
                      {isEditingTitle ? "Done" : "Edit"}
                    </button>
                  </div>
                  <input
                    value={resourceDraft.title}
                    disabled={!isEditingTitle}
                    onChange={(e) =>
                      setResourceDraft((prev) => ({ ...prev, title: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <div className="field-header">
                    <label>Purpose</label>
                    <button
                      className="button ghost small"
                      type="button"
                      onClick={() => {
                        if (isEditingPurpose) {
                          saveResource({ purpose: resourceDraft.purpose });
                        }
                        setIsEditingPurpose((prev) => !prev);
                      }}
                    >
                      {isEditingPurpose ? "Done" : "Edit"}
                    </button>
                  </div>
                  <input
                    value={resourceDraft.purpose}
                    disabled={!isEditingPurpose}
                    onChange={(e) =>
                      setResourceDraft((prev) => ({ ...prev, purpose: e.target.value }))
                    }
                  />
                  </div>
                  <div className="field">
                    <label>Notes</label>
                  <textarea
                    rows="5"
                    value={resourceDraft.notes}
                    onChange={(e) => {
                      const nextNotes = e.target.value;
                      setResourceDraft((prev) => ({ ...prev, notes: nextNotes }));
                      if (notesSaveTimer.current) {
                        clearTimeout(notesSaveTimer.current);
                      }
                      notesSaveTimer.current = setTimeout(() => {
                        saveResource({ notes: nextNotes });
                      }, 500);
                    }}
                  />
                </div>
                  <div className="actions-row">
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        if (resourceDraft.url) {
                          window.open(resourceDraft.url, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      Open Link
                    </button>
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => window.alert("Reminder feature coming soon.")}
                    >
                      Set Reminder
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default Project;
