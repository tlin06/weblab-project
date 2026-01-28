import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get, post } from "../../utilities";
import { UserContext } from "../App";
import Brand from "../modules/Brand";
import SearchBar from "../modules/SearchBar";
import AuthControls from "../modules/AuthControls";
import {
  applyProjectOrder,
  insertProjectOrder,
  reorderProjectOrder,
} from "../modules/projectOrder";

const Home = () => {
  const navigate = useNavigate();
  const { user, authReady } = useContext(UserContext);
  const [projects, setProjects] = useState([]);
  const [formState, setFormState] = useState({ title: "", description: "" });
  const [error, setError] = useState("");
  const [draggingProjectId, setDraggingProjectId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragPlaceholderHeight, setDragPlaceholderHeight] = useState(null);
  const [dragHiddenProjectId, setDragHiddenProjectId] = useState(null);
  const cardRefs = useRef(new Map());
  const prevPositions = useRef(new Map());
  const didDropRef = useRef(false);
  const dragOverRaf = useRef(null);
  const pendingDragOverIndex = useRef(null);
  const dragOverIndexRef = useRef(null);
  const orderedIdsRef = useRef([]);
  const dragHiddenRaf = useRef(null);
  const lastPointerRef = useRef({ x: null, y: null });

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProjects([]);
      setError("");
      return;
    }
    get("/api/projects")
      .then((data) => setProjects(applyProjectOrder(data)))
      .catch((err) => {
        console.log(err);
        setError("Could not load projects. Is the server running?");
      });
  }, [user, authReady]);

  const reminders = projects.flatMap((project) => project.reminders || []);
  const placeholderId = "__placeholder__";
  const renderProjects = useMemo(() => {
    if (!draggingProjectId || dragOverIndex === null) {
      return projects;
    }
    const orderedIds = orderedIdsRef.current;
    const beforeId = orderedIds[dragOverIndex] || null;
    let insertIndex = beforeId
      ? projects.findIndex((project) => String(project._id) === String(beforeId))
      : projects.length;
    if (insertIndex === -1) insertIndex = projects.length;
    const withPlaceholder = [...projects];
    withPlaceholder.splice(insertIndex, 0, {
      _id: placeholderId,
      __placeholder: true,
    });
    return withPlaceholder;
  }, [projects, draggingProjectId, dragOverIndex]);

  useLayoutEffect(() => {
    if (draggingProjectId) return;
    const nextPositions = new Map();
    cardRefs.current.forEach((node, id) => {
      if (!node) return;
      nextPositions.set(id, node.getBoundingClientRect());
    });
    prevPositions.current.forEach((prevRect, id) => {
      const nextRect = nextPositions.get(id);
      if (!prevRect || !nextRect) return;
      const dx = prevRect.left - nextRect.left;
      const dy = prevRect.top - nextRect.top;
      if (dx || dy) {
        const node = cardRefs.current.get(id);
        if (!node) return;
        node.style.transform = `translate(${dx}px, ${dy}px)`;
        node.style.transition = "transform 0s";
        requestAnimationFrame(() => {
          node.style.transform = "";
          node.style.transition = "";
        });
      }
    });
    prevPositions.current = nextPositions;
  }, [renderProjects, draggingProjectId]);

  useEffect(() => {
    dragOverIndexRef.current = dragOverIndex;
  }, [dragOverIndex]);

  const getInsertionIndex = (clientX, clientY) => {
    const items = [];
    projects.forEach((project) => {
      const id = String(project._id);
      if (id === String(draggingProjectId)) return;
      const node = cardRefs.current.get(id);
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      items.push({ id, rect });
    });
    items.sort((a, b) => {
      const topDiff = a.rect.top - b.rect.top;
      if (Math.abs(topDiff) > 8) return topDiff;
      return a.rect.left - b.rect.left;
    });
    orderedIdsRef.current = items.map((item) => item.id);
    const last = lastPointerRef.current;
    const movingDown = last.y !== null && clientY > last.y + 1;
    const movingUp = last.y !== null && clientY < last.y - 1;
    const movingRight = last.x !== null && clientX > last.x + 1;
    const movingLeft = last.x !== null && clientX < last.x - 1;
    lastPointerRef.current = { x: clientX, y: clientY };

    for (let i = 0; i < items.length; i += 1) {
      const rect = items[i].rect;
      const rowThresholdDown = rect.top + rect.height * 0.7;
      const rowThresholdUp = rect.top + rect.height * 0.3;
      const rowThreshold = movingDown
        ? rowThresholdDown
        : movingUp
        ? rowThresholdUp
        : rect.top + rect.height / 2;
      if (clientY < rowThreshold) {
        const colThresholdRight = rect.left + rect.width * 0.7;
        const colThresholdLeft = rect.left + rect.width * 0.3;
        const colThreshold = movingRight
          ? colThresholdRight
          : movingLeft
          ? colThresholdLeft
          : rect.left + rect.width / 2;
        return clientX < colThreshold ? i : i + 1;
      }
    }
    return items.length;
  };

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
        insertProjectOrder(project._id, 0);
        setProjects((prev) => applyProjectOrder([project, ...prev]));
        setFormState({ title: "", description: "" });
        setError("");
      })
      .catch((err) => {
        console.log(err);
        setError("Create project failed. Check the server and database connection.");
      });
  };

  const handleDragStart = (projectId) => (event) => {
    setDraggingProjectId(String(projectId));
    didDropRef.current = false;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(projectId));
    const height = event.currentTarget.getBoundingClientRect().height;
    setDragPlaceholderHeight(height);
    if (dragHiddenRaf.current) {
      cancelAnimationFrame(dragHiddenRaf.current);
    }
    dragHiddenRaf.current = requestAnimationFrame(() => {
      setDragHiddenProjectId(String(projectId));
      dragHiddenRaf.current = null;
    });
  };

  const queueDragOver = (nextIndex) => {
    if (nextIndex === null || Number.isNaN(nextIndex)) return;
    if (
      pendingDragOverIndex.current === nextIndex &&
      dragOverIndexRef.current === nextIndex
    ) {
      return;
    }
    pendingDragOverIndex.current = nextIndex;
    if (dragOverRaf.current) return;
    dragOverRaf.current = requestAnimationFrame(() => {
      dragOverRaf.current = null;
      const index = pendingDragOverIndex.current;
      if (index !== dragOverIndexRef.current) {
        setDragOverIndex(index);
      }
    });
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const nextIndex = getInsertionIndex(event.clientX, event.clientY);
    queueDragOver(nextIndex);
  };

  const handleDrop = (targetProjectId) => (event) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") || draggingProjectId;
    const fromId = String(sourceId);
    const orderedIds = orderedIdsRef.current;
    const beforeId =
      dragOverIndex !== null && dragOverIndex < orderedIds.length
        ? orderedIds[dragOverIndex]
        : null;
    let insertIndex = beforeId
      ? projects.findIndex((project) => String(project._id) === String(beforeId))
      : projects.length;
    if (insertIndex === -1) insertIndex = projects.length;
    if (!fromId) {
      setDraggingProjectId(null);
      setDragOverIndex(null);
      setDragPlaceholderHeight(null);
      setDragHiddenProjectId(null);
      pendingDragOverIndex.current = null;
      if (dragOverRaf.current) {
        cancelAnimationFrame(dragOverRaf.current);
        dragOverRaf.current = null;
      }
      if (dragHiddenRaf.current) {
        cancelAnimationFrame(dragHiddenRaf.current);
        dragHiddenRaf.current = null;
      }
      return;
    }
    didDropRef.current = true;
    setProjects((prev) => {
      const next = [...prev];
      const fromIndex = next.findIndex((project) => String(project._id) === fromId);
      if (fromIndex === -1) return prev;
      const [moved] = next.splice(fromIndex, 1);
      let targetIndex = insertIndex;
      if (fromIndex < targetIndex) targetIndex -= 1;
      targetIndex = Math.max(0, Math.min(next.length, targetIndex));
      next.splice(targetIndex, 0, moved);
      reorderProjectOrder(next.map((project) => project._id));
      return next;
    });
    setDraggingProjectId(null);
    setDragOverIndex(null);
    setDragPlaceholderHeight(null);
    setDragHiddenProjectId(null);
    lastPointerRef.current = { x: null, y: null };
    pendingDragOverIndex.current = null;
    if (dragOverRaf.current) {
      cancelAnimationFrame(dragOverRaf.current);
      dragOverRaf.current = null;
    }
    if (dragHiddenRaf.current) {
      cancelAnimationFrame(dragHiddenRaf.current);
      dragHiddenRaf.current = null;
    }
  };

  const handleDragEnd = () => {
    if (!didDropRef.current) {
      setDragOverIndex(null);
    }
    setDraggingProjectId(null);
    setDragOverIndex(null);
    setDragPlaceholderHeight(null);
    setDragHiddenProjectId(null);
    lastPointerRef.current = { x: null, y: null };
    pendingDragOverIndex.current = null;
    if (dragOverRaf.current) {
      cancelAnimationFrame(dragOverRaf.current);
      dragOverRaf.current = null;
    }
    if (dragHiddenRaf.current) {
      cancelAnimationFrame(dragHiddenRaf.current);
      dragHiddenRaf.current = null;
    }
  };

  const setCardRef = (id) => (node) => {
    if (!node) {
      cardRefs.current.delete(String(id));
      return;
    }
    cardRefs.current.set(String(id), node);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <Brand subtitle="Project hub" />

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

      <main className="main main-scroll">
        <header className="topbar">
          <div>
            <div className="topbar-title">Projects</div>
            <div className="topbar-description">Track resources, tabs, and notes.</div>
          </div>
          <div className="topbar-actions">
            <SearchBar />
            <AuthControls />
          </div>
        </header>

        <section className="panel panel-aligned">
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

        <div className="grid-scroll">
          <section className="grid" onDragOver={handleDragOver} onDrop={handleDrop(null)}>
            {!user && <div className="empty-state">Sign in to see your projects.</div>}
            {user && projects.length === 0 && (
              <div className="empty-state">No projects yet. Create one above.</div>
            )}
            {user &&
              renderProjects.map((project) => {
                if (project.__placeholder) {
                  return (
                    <div
                      key={placeholderId}
                      className="card drag-placeholder"
                      style={
                        dragPlaceholderHeight ? { height: dragPlaceholderHeight } : undefined
                      }
                    />
                  );
                }
                const isDragging = draggingProjectId === String(project._id);
                const isDragOver = dragOverIndex === projects.indexOf(project);
                const isDragHidden = dragHiddenProjectId === String(project._id);
                return (
                  <div
                    key={project._id}
                    ref={setCardRef(project._id)}
                    className={`card ${isDragging ? "dragging" : ""} ${
                      isDragHidden ? "drag-hidden" : ""
                    } ${
                      isDragOver ? "drag-over" : ""
                    }`}
                    role="button"
                    tabIndex={0}
                    draggable
                    data-project-id={project._id}
                    onDragStart={handleDragStart(project._id)}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop(project._id)}
                    onDragEnd={handleDragEnd}
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
                );
              })}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Home;
