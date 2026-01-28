import React, {
  useContext,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { get, post } from "../../utilities";
import { UserContext } from "../App";
import Brand from "../modules/Brand";
import SearchBar from "../modules/SearchBar";
import LabeledInput from "../modules/LabeledInput";
import ResourcePanel from "../modules/ResourcePanel";
import TabPanel from "../modules/TabPanel";
import AuthControls from "../modules/AuthControls";
import ConfirmModal from "../modules/ConfirmModal";
import StatusPill from "../modules/StatusPill";
import ReminderModal from "../modules/ReminderModal";
import { socket } from "../../client-socket";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  formatReminderDueAt,
  formatReminderTitle,
  getReminderId,
  isReminderDue,
  parseReminderDate,
} from "../../utilities/reminders";
import {
  applyProjectOrder,
  applyResourceOrder,
  applyTabOrder,
  insertResourceOrder,
  insertTabOrder,
  removeProjectOrder,
  removeResourceOrder,
  removeTabOrder,
  reorderProjectOrder,
  reorderResourceOrder,
  reorderTabOrder,
} from "../modules/projectOrder";

const Project = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authReady } = useContext(UserContext);
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
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [isNotesPreview, setIsNotesPreview] = useState(false);
  const [isNotesMarkdownEnabled, setIsNotesMarkdownEnabled] = useState(() => {
    try {
      return localStorage.getItem("lt_notes_markdown_enabled") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("lt_notes_markdown_enabled", String(isNotesMarkdownEnabled));
    } catch {
      // ignore storage errors
    }
  }, [isNotesMarkdownEnabled]);
  const [saveError, setSaveError] = useState("");
  const notesSaveTimer = useRef(null);
  const resourceSaveTimers = useRef({
    title: null,
    purpose: null,
    url: null,
  });
  const [resourceSaveStatus, setResourceSaveStatus] = useState("Saved");
  const [selectedTabKey, setSelectedTabKey] = useState(null);
  const [activeDetail, setActiveDetail] = useState("resource");
  const [tabDraft, setTabDraft] = useState({ title: "", url: "" });
  const tabSaveTimers = useRef({
    title: null,
    url: null,
  });
  const [tabSaveStatus, setTabSaveStatus] = useState("Saved");
  const [confirmState, setConfirmState] = useState(null);
  const [resourceCreateState, setResourceCreateState] = useState({
    isOpen: false,
    title: "",
    purpose: "",
  });
  const [tabCreateState, setTabCreateState] = useState({
    isOpen: false,
    title: "",
  });
  const [reminderCreateState, setReminderCreateState] = useState({
    isOpen: false,
    mode: "exact",
    exactTime: "",
    offsetDays: 0,
    offsetHours: 0,
    offsetMinutes: 0,
    offsetSeconds: 0,
    note: "",
    error: "",
  });
  const [reminderModalState, setReminderModalState] = useState(null);
  const [showScheduled, setShowScheduled] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [draggingProjectId, setDraggingProjectId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragPlaceholderHeight, setDragPlaceholderHeight] = useState(null);
  const [dragHiddenProjectId, setDragHiddenProjectId] = useState(null);
  const sidebarRefs = useRef(new Map());
  const prevSidebarPositions = useRef(new Map());
  const didDropRef = useRef(false);
  const dragOverRaf = useRef(null);
  const pendingDragOverIndex = useRef(null);
  const dragOverIndexRef = useRef(null);
  const orderedIdsRef = useRef([]);
  const dragHiddenRaf = useRef(null);
  const lastPointerYRef = useRef(null);
  const prevSelectedResourceId = useRef(null);
  const prevSelectedTabKey = useRef(null);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProjects([]);
      return;
    }
    get("/api/projects").then((data) => setProjects(applyProjectOrder(data)));
  }, [user, authReady]);

  useEffect(() => {
    if (!user) return;
    const handleReminderUpdate = (payload) => {
      if (!payload?.projectId || !payload?.reminder) return;
      const mergeReminder = (reminders) => {
        const next = [...(reminders || [])];
        const id = payload.reminder?._id ? String(payload.reminder._id) : null;
        if (!id) return next;
        const existingIndex = next.findIndex(
          (reminder) => reminder && String(reminder._id) === id
        );
        if (existingIndex >= 0) {
          next[existingIndex] = payload.reminder;
          return next.filter((reminder, index) => {
            if (!reminder || String(reminder._id) !== id) return true;
            return index === existingIndex;
          });
        }
        return [...next, payload.reminder];
      };
      setProjects((prev) =>
        prev.map((item) => {
          if (String(item._id) !== String(payload.projectId)) return item;
          return { ...item, reminders: mergeReminder(item.reminders) };
        })
      );
      setProject((prev) => {
        if (!prev || String(prev._id) !== String(payload.projectId)) return prev;
        return { ...prev, reminders: mergeReminder(prev.reminders) };
      });
    };
    const handleReminderDue = () => {
      setNow(new Date());
    };

    socket.on("reminder:updated", handleReminderUpdate);
    socket.on("reminder:due", handleReminderDue);
    return () => {
      socket.off("reminder:updated", handleReminderUpdate);
      socket.off("reminder:due", handleReminderDue);
    };
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

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
    sidebarRefs.current.forEach((node, id) => {
      if (!node) return;
      nextPositions.set(id, node.getBoundingClientRect());
    });
    prevSidebarPositions.current.forEach((prevRect, id) => {
      const nextRect = nextPositions.get(id);
      if (!prevRect || !nextRect) return;
      const dx = prevRect.left - nextRect.left;
      const dy = prevRect.top - nextRect.top;
      if (dx || dy) {
        const node = sidebarRefs.current.get(id);
        if (!node) return;
        node.style.transform = `translate(${dx}px, ${dy}px)`;
        node.style.transition = "transform 0s";
        requestAnimationFrame(() => {
          node.style.transform = "";
          node.style.transition = "";
        });
      }
    });
    prevSidebarPositions.current = nextPositions;
  }, [renderProjects, draggingProjectId]);

  useEffect(() => {
    dragOverIndexRef.current = dragOverIndex;
  }, [dragOverIndex]);

  const getInsertionIndex = (clientX, clientY) => {
    const items = [];
    projects.forEach((project) => {
      const id = String(project._id);
      if (id === String(draggingProjectId)) return;
      const node = sidebarRefs.current.get(id);
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      items.push({ id, rect });
    });
    items.sort((a, b) => a.rect.top - b.rect.top);
    orderedIdsRef.current = items.map((item) => item.id);
    const buffer = 10;
    const lastY = lastPointerYRef.current ?? clientY;
    const movingDown = clientY > lastY + 1;
    const movingUp = clientY < lastY - 1;
    lastPointerYRef.current = clientY;
    for (let i = 0; i < items.length; i += 1) {
      const rect = items[i].rect;
      const midY = rect.top + rect.height / 2;
      const hysteresisZone = Math.max(buffer, rect.height * 0.25);
      const downThreshold = rect.top + rect.height * 0.7 + hysteresisZone * 0.1;
      const upThreshold = rect.top + rect.height * 0.3 - hysteresisZone * 0.1;
      const threshold = movingDown
        ? downThreshold
        : movingUp
        ? upThreshold
        : midY;
      if (clientY < threshold) return i;
    }
    return items.length;
  };

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProject(null);
      setSelectedResourceId(null);
      return;
    }
    get(`/api/projects/${projectId}`).then((data) => {
      const orderedResources = applyResourceOrder(projectId, data.resources || []);
      const nextTabGroups = (data.tabGroups || []).map((group, index) => {
        if (index !== 0) return group;
        return {
          ...group,
          links: applyTabOrder(projectId, group.links || []),
        };
      });
      setProject({
        ...data,
        resources: orderedResources,
        tabGroups: nextTabGroups,
      });
      setProjectDraft({
        title: data.title || "",
        description: data.description || "",
      });
      setIsEditingProject(false);
      if (orderedResources.length > 0) {
        setSelectedResourceId(String(orderedResources[0]._id));
        setActiveDetail("resource");
      } else {
        setSelectedResourceId(null);
      }
      const requestedResourceId = location?.state?.resourceId;
      if (requestedResourceId) {
        const match = orderedResources.find(
          (resource) => String(resource._id) === String(requestedResourceId)
        );
        if (match) {
          setSelectedResourceId(String(match._id));
          setActiveDetail("resource");
        }
      }
      const firstTab = nextTabGroups[0]?.links?.[0];
      setSelectedTabKey(firstTab?._id ? String(firstTab._id) : null);
    });
  }, [projectId, user, authReady, location?.state?.resourceId]);

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
          removeProjectOrder(projectId);
          navigate("/");
        });
      },
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
    lastPointerYRef.current = null;
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
    lastPointerYRef.current = null;
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

  const setSidebarRef = (id) => (node) => {
    if (!node) {
      sidebarRefs.current.delete(String(id));
      return;
    }
    sidebarRefs.current.set(String(id), node);
  };

  const selectedResource = useMemo(() => {
    if (!project || !selectedResourceId) return null;
    return (
      project.resources.find((resource) => String(resource._id) === String(selectedResourceId)) ||
      null
    );
  }, [project, selectedResourceId]);

  const dueReminders = useMemo(() => {
    const toTimestamp = (reminder) =>
      parseReminderDate(reminder?.dueAt)?.getTime() ||
      parseReminderDate(reminder?.createdAt)?.getTime() ||
      0;
    return projects
      .flatMap((item) =>
        (item.reminders || []).map((reminder) => ({
          reminder,
          projectId: item._id,
          projectTitle: item.title,
        }))
      )
      .filter(({ reminder }) => isReminderDue(reminder, now))
      .sort((a, b) => toTimestamp(b.reminder) - toTimestamp(a.reminder));
  }, [projects, now]);

  const scheduledReminders = useMemo(() => {
    const toTimestamp = (reminder) =>
      parseReminderDate(reminder?.dueAt)?.getTime() ||
      parseReminderDate(reminder?.createdAt)?.getTime() ||
      0;
    return projects
      .flatMap((item) =>
        (item.reminders || []).map((reminder) => ({
          reminder,
          projectId: item._id,
          projectTitle: item.title,
        }))
      )
      .filter(({ reminder }) => !isReminderDue(reminder, now) && !reminder?.dismissedAt)
      .sort((a, b) => toTimestamp(a.reminder) - toTimestamp(b.reminder));
  }, [projects, now]);

  const orderedResources = useMemo(
    () => applyResourceOrder(projectId, project?.resources || []),
    [projectId, project?.resources]
  );

  useEffect(() => {
    if (selectedResource) {
      setResourceDraft({
        title: selectedResource.title || "",
        purpose: selectedResource.purpose || "",
        notes: selectedResource.notes || "",
        url: selectedResource.url || "",
      });
      setSaveError("");
      if (prevSelectedResourceId.current !== selectedResourceId) {
        setResourceSaveStatus("Saved");
      }
    }
    prevSelectedResourceId.current = selectedResourceId;
  }, [selectedResource]);

  const tabGroup = project?.tabGroups?.[0] || null;
  const tabs = useMemo(
    () => applyTabOrder(projectId, tabGroup?.links || []),
    [projectId, tabGroup]
  );
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
      if (prevSelectedTabKey.current !== selectedTabKey) {
        setTabSaveStatus("Saved");
      }
    }
    prevSelectedTabKey.current = selectedTabKey;
  }, [selectedTab]);

  useEffect(() => {
    return () => {
      if (notesSaveTimer.current) {
        clearTimeout(notesSaveTimer.current);
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
  };

  const markResourceSaved = () => {
    setResourceSaveStatus("Saved");
  };

  const markTabSaving = () => {
    setTabSaveStatus("Saving...");
  };

  const markTabSaved = () => {
    setTabSaveStatus("Saved");
  };

  const handleAddResource = () => {
    if (!project) return;
    setResourceCreateState({
      isOpen: true,
      title: "",
      purpose: "",
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
    setTabCreateState({
      isOpen: true,
      title: "",
    });
  };

  const handleNotesChange = (value) => {
    setResourceDraft((prev) => ({ ...prev, notes: value }));
    if (notesSaveTimer.current) {
      clearTimeout(notesSaveTimer.current);
    }
    markResourceSaving();
    notesSaveTimer.current = setTimeout(() => {
      saveResource({ notes: value });
    }, 500);
  };

  const normalizedNotes = useMemo(() => {
    const raw = resourceDraft.notes || "";
    if (!raw.includes("$$")) return raw;
    return raw.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
      const trimmed = String(expr).trim();
      return `\n\n$$\n${trimmed}\n$$\n\n`;
    });
  }, [resourceDraft.notes]);

  useEffect(() => {
    if (!isNotesExpanded) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsNotesExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNotesExpanded]);

  useEffect(() => {
    if (!reminderCreateState.isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setReminderCreateState((prev) => ({ ...prev, isOpen: false, error: "" }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reminderCreateState.isOpen]);

  const handleConfirmAddResource = () => {
    if (!project) return;
    const title = resourceCreateState.title.trim() || "New Resource";
    const purpose = resourceCreateState.purpose.trim();
    post(`/api/projects/${projectId}/resources`, {
      title,
      purpose,
      url: "https://",
    }).then((resource) => {
      setProject((prev) => ({
        ...prev,
        resources: [resource, ...(prev?.resources || [])],
      }));
      insertResourceOrder(projectId, resource._id, 0);
      setSelectedResourceId(String(resource._id));
      setActiveDetail("resource");
      setResourceCreateState({ isOpen: false, title: "", purpose: "" });
    });
  };

  const handleConfirmAddTab = () => {
    if (!project) return;
    const title = tabCreateState.title.trim() || "New Tab";
    const existingGroup = (project.tabGroups || [])[0];
    const ensureGroup = existingGroup
      ? Promise.resolve(existingGroup)
      : post(`/api/projects/${projectId}/tabgroups`, { title: "Tabs" });

    ensureGroup.then((tabGroup) => {
      post(`/api/tabgroups/${tabGroup._id}/links`, {
        title,
        url: "https://",
      }).then((updated) => {
        setProject((prev) => {
          const currentGroups = prev?.tabGroups || [];
          const hasGroup = currentGroups.some((group) => group._id === updated._id);
          const nextGroups = hasGroup
            ? currentGroups.map((group) => (group._id === updated._id ? updated : group))
            : [...currentGroups, updated];
          const updatedLinks = updated.links || [];
          reorderTabOrder(projectId, updatedLinks.map((link) => link._id));
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
        setTabCreateState({ isOpen: false, title: "" });
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
            removeResourceOrder(projectId, selectedResourceId);
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
            removeTabOrder(projectId, selectedTabKey);
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
    if (trimmed === "https://" || trimmed === "http://") return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const openReminderResource = (entry) => {
    const reminder = entry?.reminder || entry;
    if (!reminder?.resourceId) return;
    const targetProjectId = entry?.projectId || projectId;
    if (String(targetProjectId) !== String(projectId)) {
      navigate(`/project/${targetProjectId}`, {
        state: { resourceId: reminder.resourceId },
      });
      setReminderModalState(null);
      return;
    }
    setSelectedResourceId(String(reminder.resourceId));
    setActiveDetail("resource");
    setReminderModalState(null);
  };

  const formatLocalDateTime = (date) => {
    const pad = (value) => String(value).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const openReminderCreate = () => {
    if (!selectedResource) return;
    const defaultDate = new Date(Date.now() + 30 * 60 * 1000);
    setReminderCreateState({
      isOpen: true,
      mode: "exact",
      exactTime: formatLocalDateTime(defaultDate),
      offsetDays: 0,
      offsetHours: 0,
      offsetMinutes: 0,
      offsetSeconds: 0,
      note: "",
      error: "",
    });
  };

  const handleConfirmReminder = () => {
    if (!projectId || !selectedResource) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {
        // ignore permission errors
      });
    }
    let dueDate = null;
    if (reminderCreateState.mode === "exact") {
      dueDate = new Date(reminderCreateState.exactTime);
    } else {
      const days = Number(reminderCreateState.offsetDays) || 0;
      const hours = Number(reminderCreateState.offsetHours) || 0;
      const minutes = Number(reminderCreateState.offsetMinutes) || 0;
      const seconds = Number(reminderCreateState.offsetSeconds) || 0;
      const totalMs =
        days * 24 * 60 * 60 * 1000 +
        hours * 60 * 60 * 1000 +
        minutes * 60 * 1000 +
        seconds * 1000;
      if (totalMs <= 0) {
        setReminderCreateState((prev) => ({
          ...prev,
          error: "Enter a positive time amount.",
        }));
        return;
      }
      dueDate = new Date(Date.now() + totalMs);
    }
    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      setReminderCreateState((prev) => ({
        ...prev,
        error: "Pick a valid reminder time.",
      }));
      return;
    }

    post(`/api/projects/${projectId}/reminders`, {
      resourceId: selectedResource._id,
      dueAt: dueDate,
      note: reminderCreateState.note,
    })
      .then((reminder) => {
        const mergeReminder = (reminders) => {
          const next = [...(reminders || [])];
          const id = reminder?._id ? String(reminder._id) : null;
          if (!id) return next;
          const existingIndex = next.findIndex(
            (item) => item && String(item._id) === id
          );
          if (existingIndex >= 0) {
            next[existingIndex] = reminder;
            return next;
          }
          return [...next, reminder];
        };
        setProject((prev) =>
          prev
            ? { ...prev, reminders: mergeReminder(prev.reminders) }
            : prev
        );
        setProjects((prev) =>
          prev.map((item) => {
            if (String(item._id) !== String(projectId)) return item;
            return { ...item, reminders: mergeReminder(item.reminders) };
          })
        );
        setReminderCreateState({
          isOpen: false,
          mode: "exact",
          exactTime: "",
          offsetDays: 0,
          offsetHours: 0,
          offsetMinutes: 0,
          offsetSeconds: 0,
          note: "",
          error: "",
        });
      })
      .catch(() => {
        setReminderCreateState((prev) => ({
          ...prev,
          error: "Reminder save failed. Try again.",
        }));
      });
  };

  const handleDismissReminder = (entry) => {
    if (!entry?.reminder || !entry?.projectId) return;
    const reminderId = getReminderId(entry.reminder);
    if (!reminderId) return;
    post(`/api/projects/${entry.projectId}/reminders/${reminderId}/dismiss`)
      .then((updated) => {
        setProject((prev) => {
          if (!prev || String(prev._id) !== String(entry.projectId)) return prev;
          const reminders = (prev.reminders || []).map((item) => {
            if (!item || String(item._id) !== String(updated._id)) return item;
            return { ...item, dismissedAt: updated.dismissedAt };
          });
          return { ...prev, reminders };
        });
        setProjects((prev) =>
          prev.map((item) => {
            if (String(item._id) !== String(entry.projectId)) return item;
            const reminders = (item.reminders || []).map((reminder) => {
              if (!reminder || String(reminder._id) !== String(updated._id)) return reminder;
              return { ...reminder, dismissedAt: updated.dismissedAt };
            });
            return { ...item, reminders };
          })
        );
      })
      .finally(() => setReminderModalState(null));
  };

  const handleReorderResources = (nextResources) => {
    setProject((prev) => (prev ? { ...prev, resources: nextResources } : prev));
    reorderResourceOrder(projectId, nextResources.map((resource) => resource._id));
  };

  const handleReorderTabs = (nextTabs) => {
    setProject((prev) => {
      if (!prev) return prev;
      const nextGroups = (prev.tabGroups || []).map((group, index) => {
        if (index !== 0) return group;
        return { ...group, links: nextTabs };
      });
      return { ...prev, tabGroups: nextGroups };
    });
    reorderTabOrder(projectId, nextTabs.map((tab) => tab._id));
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
      {isNotesExpanded && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsNotesExpanded(false);
            }
          }}
        >
          <div className="modal notes-modal">
            <div className="modal-title">
              Notes: {resourceDraft.title || selectedResource?.title || "Untitled Resource"}
            </div>
            <div className="modal-body notes-modal-body">
              <div
                className={`notes-split ${
                  isNotesMarkdownEnabled ? "" : "notes-split-single"
                }`}
              >
                <div className="notes-pane">
                  <div className="notes-pane-title">Markdown</div>
                  <textarea
                    className="notes-textarea"
                    value={resourceDraft.notes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                  />
                </div>
                {isNotesMarkdownEnabled && (
                  <div className="notes-pane">
                    <div className="notes-pane-title">Preview Markdown</div>
                    <div className="notes-preview">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {normalizedNotes || "Nothing to preview yet."}
                    </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              {resourceSaveStatus && <StatusPill text={resourceSaveStatus} />}
              <button
                className="button ghost"
                type="button"
                onClick={() => setIsNotesMarkdownEnabled((prev) => !prev)}
              >
                {isNotesMarkdownEnabled ? "Disable Markdown" : "Enable Markdown"}
              </button>
              <button className="button ghost" type="button" onClick={() => setIsNotesExpanded(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {resourceCreateState.isOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-title">Add Resource</div>
            <div className="modal-body">
              <div className="field" style={{ marginTop: 0 }}>
                <label>Title</label>
                <input
                  value={resourceCreateState.title}
                  onChange={(e) =>
                    setResourceCreateState((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Resource title"
                />
              </div>
              <div className="field">
                <label>Purpose</label>
                <input
                  value={resourceCreateState.purpose}
                  onChange={(e) =>
                    setResourceCreateState((prev) => ({ ...prev, purpose: e.target.value }))
                  }
                  placeholder="What is this for?"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="button ghost"
                type="button"
                onClick={() => setResourceCreateState({ isOpen: false, title: "", purpose: "" })}
              >
                Cancel
              </button>
              <button className="button" type="button" onClick={handleConfirmAddResource}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      {tabCreateState.isOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-title">Add Link</div>
            <div className="modal-body">
              <div className="field" style={{ marginTop: 0 }}>
                <label>Title</label>
                <input
                  value={tabCreateState.title}
                  onChange={(e) =>
                    setTabCreateState((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Link title"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="button ghost"
                type="button"
                onClick={() => setTabCreateState({ isOpen: false, title: "" })}
              >
                Cancel
              </button>
              <button className="button" type="button" onClick={handleConfirmAddTab}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      {reminderCreateState.isOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-title">
              Set Reminder{selectedResource?.title ? `: ${selectedResource.title}` : ""}
            </div>
            <div className="modal-body">
              <div className="field" style={{ marginTop: 0 }}>
                <label>Reminder type</label>
                <select
                  value={reminderCreateState.mode}
                  onChange={(e) =>
                    setReminderCreateState((prev) => ({
                      ...prev,
                      mode: e.target.value,
                      error: "",
                    }))
                  }
                >
                  <option value="exact">Exact time</option>
                  <option value="relative">In...</option>
                </select>
              </div>
              {reminderCreateState.mode === "exact" ? (
                <div className="field">
                  <label>Exact time</label>
                  <input
                    type="datetime-local"
                    value={reminderCreateState.exactTime}
                    onChange={(e) =>
                      setReminderCreateState((prev) => ({
                        ...prev,
                        exactTime: e.target.value,
                        error: "",
                      }))
                    }
                  />
                </div>
              ) : (
                <div className="field">
                  <label>In</label>
                  <div className="actions-row reminder-offset-row" style={{ marginTop: 0 }}>
                    <label className="reminder-offset-field">
                      <input
                        className="reminder-offset-input"
                        type="number"
                        min="0"
                        value={reminderCreateState.offsetDays}
                        onChange={(e) =>
                          setReminderCreateState((prev) => ({
                            ...prev,
                            offsetDays: e.target.value,
                            error: "",
                          }))
                        }
                      />
                      <span className="reminder-offset-label">Days</span>
                    </label>
                    <label className="reminder-offset-field">
                      <input
                        className="reminder-offset-input"
                        type="number"
                        min="0"
                        value={reminderCreateState.offsetHours}
                        onChange={(e) =>
                          setReminderCreateState((prev) => ({
                            ...prev,
                            offsetHours: e.target.value,
                            error: "",
                          }))
                        }
                      />
                      <span className="reminder-offset-label">Hours</span>
                    </label>
                    <label className="reminder-offset-field">
                      <input
                        className="reminder-offset-input"
                        type="number"
                        min="0"
                        value={reminderCreateState.offsetMinutes}
                        onChange={(e) =>
                          setReminderCreateState((prev) => ({
                            ...prev,
                            offsetMinutes: e.target.value,
                            error: "",
                          }))
                        }
                      />
                      <span className="reminder-offset-label">Minutes</span>
                    </label>
                    <label className="reminder-offset-field">
                      <input
                        className="reminder-offset-input"
                        type="number"
                        min="0"
                        value={reminderCreateState.offsetSeconds}
                        onChange={(e) =>
                          setReminderCreateState((prev) => ({
                            ...prev,
                            offsetSeconds: e.target.value,
                            error: "",
                          }))
                        }
                      />
                      <span className="reminder-offset-label">Seconds</span>
                    </label>
                  </div>
                </div>
              )}
              <div className="field">
                <label>Note</label>
                <textarea
                  className="reminder-note"
                  rows="3"
                  value={reminderCreateState.note}
                  onChange={(e) =>
                    setReminderCreateState((prev) => ({
                      ...prev,
                      note: e.target.value,
                    }))
                  }
                  placeholder="Add a quick note..."
                />
              </div>
              {reminderCreateState.error && (
                <div className="empty-state">{reminderCreateState.error}</div>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="button ghost"
                type="button"
                onClick={() =>
                  setReminderCreateState((prev) => ({ ...prev, isOpen: false, error: "" }))
                }
              >
                Cancel
              </button>
              <button className="button" type="button" onClick={handleConfirmReminder}>
                Set Reminder
              </button>
            </div>
          </div>
        </div>
      )}
      <ReminderModal
        isOpen={Boolean(reminderModalState)}
        title={
          reminderModalState
            ? formatReminderTitle(
                reminderModalState.reminder,
                reminderModalState.projectTitle
              )
            : ""
        }
        subtitle={
          reminderModalState
            ? formatReminderDueAt(reminderModalState.reminder)
            : ""
        }
        note={reminderModalState?.reminder?.note}
        onClose={() => setReminderModalState(null)}
        onDismiss={() => handleDismissReminder(reminderModalState)}
        onOpenResource={() => {
          if (!reminderModalState) return;
          openReminderResource(reminderModalState);
        }}
      />
      <aside className="sidebar">
        <Brand subtitle="Project view" />

        <div className="sidebar-section sidebar-projects">
          <div className="section-title">Projects</div>
          <div
            className="sidebar-list sidebar-scroll"
            onDragOver={handleDragOver}
            onDrop={handleDrop(null)}
          >
            {renderProjects.map((item) => {
              if (item.__placeholder) {
                return (
                  <div
                    key={placeholderId}
                    className="sidebar-item drag-placeholder"
                    style={dragPlaceholderHeight ? { height: dragPlaceholderHeight } : undefined}
                  />
                );
              }
              const isDragging = draggingProjectId === String(item._id);
              const isDragOver = dragOverIndex === projects.indexOf(item);
              const isDragHidden = dragHiddenProjectId === String(item._id);
              return (
                <button
                  type="button"
                  key={item._id}
                  ref={setSidebarRef(item._id)}
                  className={`sidebar-item ${item._id === projectId ? "active" : ""} ${
                    isDragging ? "dragging" : ""
                  } ${isDragHidden ? "drag-hidden" : ""} ${
                    isDragOver ? "drag-over" : ""
                  }`}
                  draggable
                  data-project-id={item._id}
                  onDragStart={handleDragStart(item._id)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(item._id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => navigate(`/project/${item._id}`)}
                >
                  {item.title}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sidebar-section sidebar-reminders">
          <div className="section-header">
            <div className="section-title">Reminders</div>
            <button
              className="button ghost small"
              type="button"
              onClick={() => setShowScheduled((prev) => !prev)}
            >
              {showScheduled ? "Hide Scheduled" : "Show Scheduled"}
            </button>
          </div>
          <div className="sidebar-list sidebar-scroll">
            {dueReminders.length === 0 && !showScheduled && (
              <div className="sidebar-reminder">No reminders yet.</div>
            )}
            {dueReminders.map((entry, idx) => {
              const reminderId = getReminderId(
                entry.reminder,
                `${entry.projectId}-${idx}`
              );
              return (
                <div className="sidebar-item reminder-item" key={reminderId}>
                  <div className="reminder-content">
                    <div className="reminder-title">
                      {formatReminderTitle(entry.reminder, entry.projectTitle)}
                    </div>
                    <div className="reminder-meta">
                      {formatReminderDueAt(entry.reminder)}
                    </div>
                  </div>
                  <div className="reminder-actions">
                    <button
                      className="button ghost small"
                      type="button"
                      onClick={() => setReminderModalState(entry)}
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
            {showScheduled && scheduledReminders.length === 0 && (
              <div className="sidebar-reminder">No scheduled reminders.</div>
            )}
            {showScheduled &&
              scheduledReminders.map((entry, idx) => {
                const reminderId = getReminderId(
                  entry.reminder,
                  `scheduled-${entry.projectId}-${idx}`
                );
                return (
                  <div className="sidebar-item reminder-item reminder-scheduled" key={reminderId}>
                    <div className="reminder-content">
                      <div className="reminder-title">
                        {formatReminderTitle(entry.reminder, entry.projectTitle)}
                      </div>
                      <div className="reminder-meta">
                        Scheduled • {formatReminderDueAt(entry.reminder)}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-info">
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
                <div className="topbar-description">{project?.description}</div>
              </>
            )}
          </div>
          <div className="topbar-actions">
            {user && (
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

        {!user && authReady ? (
          <div className="empty-state" style={{ padding: "16px 18px" }}>
            Sign in to view this project.
          </div>
        ) : (
          <div className="content-columns">
            <section className="panel">
              <ResourcePanel
                resources={orderedResources}
                selectedResourceId={selectedResourceId}
                activeDetail={activeDetail}
                onAddResource={handleAddResource}
                onReorderResources={handleReorderResources}
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
                onReorderTabs={handleReorderTabs}
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
                <div className="panel-actions">
                  {activeDetail === "resource" && resourceSaveStatus && (
                    <StatusPill text={resourceSaveStatus} />
                  )}
                  {activeDetail === "tab" && tabSaveStatus && <StatusPill text={tabSaveStatus} />}
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
                    <div className="field-header">
                      <label>Notes</label>
                      <div className="field-actions">
                        <button
                          className="button ghost small"
                          type="button"
                          onClick={() => setIsNotesPreview((prev) => !prev)}
                        >
                          {isNotesPreview ? "Edit" : "Preview Markdown"}
                        </button>
                        <button
                          className="button ghost small"
                          type="button"
                          onClick={() => setIsNotesExpanded(true)}
                        >
                          Expand
                        </button>
                      </div>
                    </div>
                    {isNotesPreview ? (
                      <div className="notes-preview">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {normalizedNotes || "Nothing to preview yet."}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <textarea
                        className="notes-textarea notes-textarea-inline"
                        rows="8"
                        value={resourceDraft.notes}
                        onChange={(e) => handleNotesChange(e.target.value)}
                      />
                    )}
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
                  className="button"
                  type="button"
                  onClick={openReminderCreate}
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
