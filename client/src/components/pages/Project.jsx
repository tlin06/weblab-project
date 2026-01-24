import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, post } from "../../utilities";
import { UserContext } from "../App";
import Brand from "../modules/Brand";
import SearchBar from "../modules/SearchBar";
import LabeledInput from "../modules/LabeledInput";
import ResourcePanel from "../modules/ResourcePanel";
import TabPanel from "../modules/TabPanel";
import AuthControls from "../modules/AuthControls";
import ConfirmModal from "../modules/ConfirmModal";

const Project = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { userId } = useContext(UserContext);
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
  const [saveError, setSaveError] = useState("");
  const notesSaveTimer = useRef(null);
  const resourceSaveTimers = useRef({
    title: null,
    purpose: null,
    url: null,
  });
  const [resourceSaveStatus, setResourceSaveStatus] = useState("");
  const resourceStatusTimer = useRef(null);
  const [selectedTabKey, setSelectedTabKey] = useState(null);
  const [activeDetail, setActiveDetail] = useState("resource");
  const [tabDraft, setTabDraft] = useState({ title: "", url: "" });
  const tabSaveTimers = useRef({
    title: null,
    url: null,
  });
  const [tabSaveStatus, setTabSaveStatus] = useState("");
  const tabStatusTimer = useRef(null);
  const [confirmState, setConfirmState] = useState(null);

  useEffect(() => {
    if (!userId) {
      setProjects([]);
      return;
    }
    get("/api/projects").then((data) => setProjects(data));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
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
        setActiveDetail("resource");
      } else {
        setSelectedResourceId(null);
      }
      const firstTab = (data.tabGroups || [])[0]?.links?.[0];
      setSelectedTabKey(firstTab?._id ? String(firstTab._id) : null);
    });
  }, [projectId, userId]);

  const handleSaveProject = () => {
    if (!projectId) return;
    post(`/api/projects/${projectId}`, {
      title: projectDraft.title,
      description: projectDraft.description,
    })
      .then((updated) => {
        setProjects((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
        return get(`/api/projects/${projectId}`);
      })
      .then((fresh) => {
        setProject(fresh);
        setProjectDraft({
          title: fresh.title || "",
          description: fresh.description || "",
        });
        setIsEditingProject(false);
      });
  };

  const handleDeleteProject = () => {
    if (!projectId) return;
    setConfirmState({
      message: "Delete this project? This cannot be undone.",
      onConfirm: () => {
        post(`/api/projects/${projectId}/delete`).then(() => {
          setProjects((prev) => prev.filter((item) => item._id !== projectId));
          navigate("/");
        });
      },
    });
  };

  const selectedResource = useMemo(() => {
    if (!project || !selectedResourceId) return null;
    return (
      project.resources.find((resource) => String(resource._id) === String(selectedResourceId)) ||
      null
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
      setSaveError("");
      setResourceSaveStatus("");
    }
  }, [selectedResource]);

  const tabGroup = project?.tabGroups?.[0] || null;
  const tabs = tabGroup?.links || [];
  const getTabKey = (link) => (link?._id ? String(link._id) : null);
  const selectedTab = useMemo(() => {
    if (!selectedTabKey) return null;
    return tabs.find((link) => String(link._id) === String(selectedTabKey)) || null;
  }, [tabs, selectedTabKey]);

  useEffect(() => {
    if (selectedTab) {
      setTabDraft({
        title: selectedTab.title || "",
        url: selectedTab.url || "",
      });
      setTabSaveStatus("");
    }
  }, [selectedTab]);

  useEffect(() => {
    return () => {
      if (notesSaveTimer.current) {
        clearTimeout(notesSaveTimer.current);
      }
      if (resourceStatusTimer.current) {
        clearTimeout(resourceStatusTimer.current);
      }
      if (tabStatusTimer.current) {
        clearTimeout(tabStatusTimer.current);
      }
      Object.values(resourceSaveTimers.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      Object.values(tabSaveTimers.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const markResourceSaving = () => {
    setResourceSaveStatus("Saving...");
    if (resourceStatusTimer.current) clearTimeout(resourceStatusTimer.current);
  };

  const markResourceSaved = () => {
    setResourceSaveStatus("Saved");
    if (resourceStatusTimer.current) clearTimeout(resourceStatusTimer.current);
    resourceStatusTimer.current = setTimeout(() => {
      setResourceSaveStatus("");
    }, 1200);
  };

  const markTabSaving = () => {
    setTabSaveStatus("Saving...");
    if (tabStatusTimer.current) clearTimeout(tabStatusTimer.current);
  };

  const markTabSaved = () => {
    setTabSaveStatus("Saved");
    if (tabStatusTimer.current) clearTimeout(tabStatusTimer.current);
    tabStatusTimer.current = setTimeout(() => {
      setTabSaveStatus("");
    }, 1200);
  };

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
        markResourceSaved();
        return updated;
      })
      .catch((err) => {
        console.log(err);
        setSaveError("Save failed. Please sign in and try again.");
      });
  };

  const handleAddTab = () => {
    if (!project) return;
    const existingGroup = (project.tabGroups || [])[0];
    const ensureGroup = existingGroup
      ? Promise.resolve(existingGroup)
      : post(`/api/projects/${projectId}/tabgroups`, { title: "Tabs" });

    ensureGroup.then((tabGroup) => {
      post(`/api/tabgroups/${tabGroup._id}/links`, {
        title: "New Tab",
        url: "https://",
      }).then((updated) => {
        setProject((prev) => {
          const currentGroups = prev?.tabGroups || [];
          const hasGroup = currentGroups.some((group) => group._id === updated._id);
          const nextGroups = hasGroup
            ? currentGroups.map((group) => (group._id === updated._id ? updated : group))
            : [...currentGroups, updated];
          return {
            ...prev,
            tabGroups: nextGroups,
          };
        });
        const newLink = updated.links?.[updated.links.length - 1];
        if (newLink?._id) {
          setSelectedTabKey(String(newLink._id));
          setActiveDetail("tab");
        }
      });
    });
  };

  const saveTab = (updates) => {
    if (!tabGroup?._id || !selectedTabKey) return Promise.resolve();
    return post(`/api/tabgroups/${tabGroup._id}/links/${selectedTabKey}`, updates).then(
      (updated) => {
        setProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            tabGroups: (prev.tabGroups || []).map((group) =>
              group._id === updated._id ? updated : group
            ),
          };
        });
        markTabSaved();
        return updated;
      }
    );
  };

  const handleDeleteResource = () => {
    if (!selectedResourceId) return;
    setConfirmState({
      message: "Delete this resource?",
      onConfirm: () => {
        post(`/api/resources/${selectedResourceId}/delete`).then(() => {
          setProject((prev) => {
            if (!prev) return prev;
            const nextResources = (prev.resources || []).filter(
              (resource) => String(resource._id) !== String(selectedResourceId)
            );
            return {
              ...prev,
              resources: nextResources,
            };
          });
          setSelectedResourceId((prevId) => {
            const remaining = project?.resources?.filter(
              (resource) => String(resource._id) !== String(prevId)
            );
            const next = remaining?.[0]?._id;
            if (next) {
              setActiveDetail("resource");
              return String(next);
            }
            return null;
          });
        });
      },
    });
  };

  const handleDeleteTab = () => {
    if (!tabGroup?._id || !selectedTabKey) return;
    setConfirmState({
      message: "Delete this tab?",
      onConfirm: () => {
        const endpoint = `/api/tabgroups/${tabGroup._id}/links/${selectedTabKey}/delete`;
        post(endpoint).then((updated) => {
          setProject((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              tabGroups: (prev.tabGroups || []).map((group) =>
                group._id === updated._id ? updated : group
              ),
            };
          });
          const nextLinks = updated.links || [];
          if (nextLinks.length > 0 && nextLinks[0]?._id) {
            setSelectedTabKey(String(nextLinks[0]._id));
            setActiveDetail("tab");
          } else {
            setSelectedTabKey(null);
            setActiveDetail("resource");
          }
        });
      },
    });
  };

  const handleOpenAllTabs = (tabGroup) => {
    (tabGroup.links || []).forEach((link) => {
      if (link.url) {
        const normalized = normalizeUrl(link.url);
        if (normalized) {
          window.open(normalized, "_blank", "noopener,noreferrer");
        }
      }
    });
  };

  const normalizeUrl = (rawUrl) => {
    const trimmed = (rawUrl || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  return (
    <div className="layout">
      <ConfirmModal
        isOpen={Boolean(confirmState)}
        message={confirmState?.message}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          const action = confirmState?.onConfirm;
          setConfirmState(null);
          if (action) action();
        }}
      />
      <aside className="sidebar">
        <Brand subtitle="Project view" />

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
                  onChange={(e) => setProjectDraft((prev) => ({ ...prev, title: e.target.value }))}
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
            {userId && (
              <>
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
                <button className="button ghost" type="button" onClick={handleDeleteProject}>
                  Delete Project
                </button>
              </>
            )}
            <SearchBar />
            <AuthControls />
          </div>
        </header>

        {!userId ? (
          <div className="empty-state" style={{ padding: "16px 18px" }}>
            Sign in to view this project.
          </div>
        ) : (
          <div className="content-columns">
            <section className="panel">
              <ResourcePanel
                resources={project?.resources || []}
                selectedResourceId={selectedResourceId}
                activeDetail={activeDetail}
                onAddResource={handleAddResource}
                onSelectResource={(id) => {
                  setSelectedResourceId(id);
                  setActiveDetail("resource");
                }}
              />

              <TabPanel
                tabs={tabs}
                selectedTabKey={selectedTabKey}
                activeDetail={activeDetail}
                getTabKey={getTabKey}
                onAddTab={handleAddTab}
                onSelectTab={(link, idx) => {
                  const key = getTabKey(link);
                  if (!key) return;
                  setSelectedTabKey(key);
                  setActiveDetail("tab");
                }}
                onOpenAllTabs={() =>
                  handleOpenAllTabs({
                    links: tabs,
                  })
                }
              />
            </section>

            <section className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  {activeDetail === "tab" ? "Tab Details" : "Resource Details"}
                </div>
                {activeDetail === "resource" && resourceSaveStatus && (
                  <div className="status-pill">{resourceSaveStatus}</div>
                )}
                {activeDetail === "tab" && tabSaveStatus && (
                  <div className="status-pill">{tabSaveStatus}</div>
                )}
                {activeDetail === "resource" && selectedResource && (
                  <button className="button ghost" type="button" onClick={handleDeleteResource}>
                    Delete
                  </button>
                )}
                {activeDetail === "tab" && selectedTab && (
                  <button className="button ghost" type="button" onClick={handleDeleteTab}>
                    Delete
                  </button>
                )}
              </div>
              {saveError && activeDetail === "resource" && (
                <div className="empty-state">{saveError}</div>
              )}
              {activeDetail === "resource" && !selectedResource && (
                <div className="empty-state">Select a resource.</div>
              )}
              {activeDetail === "resource" && selectedResource && (
                <>
                  <LabeledInput
                    label="Title"
                    value={resourceDraft.title}
                    onChange={(e) => {
                      const nextTitle = e.target.value;
                      setResourceDraft((prev) => ({ ...prev, title: nextTitle }));
                      if (resourceSaveTimers.current.title) {
                        clearTimeout(resourceSaveTimers.current.title);
                      }
                      markResourceSaving();
                      resourceSaveTimers.current.title = setTimeout(() => {
                        saveResource({ title: nextTitle });
                      }, 500);
                    }}
                  />
                  <LabeledInput
                    label="Purpose"
                    value={resourceDraft.purpose}
                    onChange={(e) => {
                      const nextPurpose = e.target.value;
                      setResourceDraft((prev) => ({ ...prev, purpose: nextPurpose }));
                      if (resourceSaveTimers.current.purpose) {
                        clearTimeout(resourceSaveTimers.current.purpose);
                      }
                      markResourceSaving();
                      resourceSaveTimers.current.purpose = setTimeout(() => {
                        saveResource({ purpose: nextPurpose });
                      }, 500);
                    }}
                  />
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
                        markResourceSaving();
                        notesSaveTimer.current = setTimeout(() => {
                          saveResource({ notes: nextNotes });
                        }, 500);
                      }}
                    />
                  </div>
                  <LabeledInput
                    label="Link URL"
                    value={resourceDraft.url}
                    placeholder="https://"
                    onChange={(e) => {
                      const nextUrl = e.target.value;
                      setResourceDraft((prev) => ({ ...prev, url: nextUrl }));
                      if (resourceSaveTimers.current.url) {
                        clearTimeout(resourceSaveTimers.current.url);
                      }
                      markResourceSaving();
                      resourceSaveTimers.current.url = setTimeout(() => {
                        saveResource({ url: nextUrl });
                      }, 500);
                    }}
                  />
                  <div className="actions-row">
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        const urlToOpen = normalizeUrl(resourceDraft.url);
                        if (urlToOpen) {
                          window.open(urlToOpen, "_blank", "noopener,noreferrer");
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
              {activeDetail === "tab" && !selectedTab && (
                <div className="empty-state">Select a tab.</div>
              )}
              {activeDetail === "tab" && selectedTab && (
                <>
                  <LabeledInput
                    label="Title"
                    value={tabDraft.title}
                    onChange={(e) => {
                      const nextTitle = e.target.value;
                      setTabDraft((prev) => ({ ...prev, title: nextTitle }));
                      if (tabSaveTimers.current.title) {
                        clearTimeout(tabSaveTimers.current.title);
                      }
                      markTabSaving();
                      tabSaveTimers.current.title = setTimeout(() => {
                        saveTab({ title: nextTitle });
                      }, 500);
                    }}
                  />
                  <LabeledInput
                    label="Link URL"
                    value={tabDraft.url}
                    placeholder="https://"
                    onChange={(e) => {
                      const nextUrl = e.target.value;
                      setTabDraft((prev) => ({ ...prev, url: nextUrl }));
                      if (tabSaveTimers.current.url) {
                        clearTimeout(tabSaveTimers.current.url);
                      }
                      markTabSaving();
                      tabSaveTimers.current.url = setTimeout(() => {
                        saveTab({ url: nextUrl });
                      }, 500);
                    }}
                  />
                  <div className="actions-row">
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        const urlToOpen = normalizeUrl(tabDraft.url || selectedTab?.url);
                        if (urlToOpen) {
                          window.open(urlToOpen, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      Open Link
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
