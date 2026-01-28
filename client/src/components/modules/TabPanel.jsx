import React, { useEffect, useMemo, useRef, useState } from "react";

const TabPanel = ({
  tabs,
  selectedTabKey,
  activeDetail,
  onSelectTab,
  onAddTab,
  onOpenAllTabs,
  getTabKey,
  onReorderTabs,
}) => {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragHiddenId, setDragHiddenId] = useState(null);
  const [dragPlaceholderHeight, setDragPlaceholderHeight] = useState(null);
  const itemRefs = useRef(new Map());
  const dragOverRaf = useRef(null);
  const pendingDragOverIndex = useRef(null);
  const dragOverIndexRef = useRef(null);
  const orderedIdsRef = useRef([]);
  const dragHiddenRaf = useRef(null);
  const lastPointerYRef = useRef(null);
  const placeholderId = "__tab_placeholder__";

  const renderTabs = useMemo(() => {
    if (!draggingId || dragOverIndex === null) return tabs;
    const orderedIds = orderedIdsRef.current;
    const beforeId = orderedIds[dragOverIndex] || null;
    let insertIndex = beforeId
      ? tabs.findIndex((tab) => String(getTabKey(tab)) === String(beforeId))
      : tabs.length;
    if (insertIndex === -1) insertIndex = tabs.length;
    const withPlaceholder = [...tabs];
    withPlaceholder.splice(insertIndex, 0, { _id: placeholderId, __placeholder: true });
    return withPlaceholder;
  }, [tabs, draggingId, dragOverIndex, getTabKey]);

  useEffect(() => {
    dragOverIndexRef.current = dragOverIndex;
  }, [dragOverIndex]);

  const getInsertionIndex = (clientY) => {
    const items = [];
    tabs.forEach((tab, idx) => {
      const id = String(getTabKey(tab, idx));
      if (!id || id === String(draggingId)) return;
      const node = itemRefs.current.get(id);
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      items.push({ id, rect });
    });
    items.sort((a, b) => a.rect.top - b.rect.top);
    orderedIdsRef.current = items.map((item) => item.id);
    const lastY = lastPointerYRef.current ?? clientY;
    const movingDown = clientY > lastY + 1;
    const movingUp = clientY < lastY - 1;
    lastPointerYRef.current = clientY;
    for (let i = 0; i < items.length; i += 1) {
      const rect = items[i].rect;
      const threshold = movingDown
        ? rect.top + rect.height * 0.7
        : movingUp
        ? rect.top + rect.height * 0.3
        : rect.top + rect.height / 2;
      if (clientY < threshold) return i;
    }
    return items.length;
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

  const handleDragStart = (tabId) => (event) => {
    setDraggingId(String(tabId));
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(tabId));
    const height = event.currentTarget.getBoundingClientRect().height;
    setDragPlaceholderHeight(height);
    if (dragHiddenRaf.current) {
      cancelAnimationFrame(dragHiddenRaf.current);
    }
    dragHiddenRaf.current = requestAnimationFrame(() => {
      setDragHiddenId(String(tabId));
      dragHiddenRaf.current = null;
    });
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    queueDragOver(getInsertionIndex(event.clientY));
  };

  const handleDrop = () => (event) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") || draggingId;
    const fromId = String(sourceId);
    const orderedIds = orderedIdsRef.current;
    const beforeId =
      dragOverIndex !== null && dragOverIndex < orderedIds.length
        ? orderedIds[dragOverIndex]
        : null;
    let insertIndex = beforeId
      ? tabs.findIndex((tab, idx) => String(getTabKey(tab, idx)) === String(beforeId))
      : tabs.length;
    if (insertIndex === -1) insertIndex = tabs.length;
    if (!fromId) {
      setDraggingId(null);
      setDragOverIndex(null);
      setDragHiddenId(null);
      setDragPlaceholderHeight(null);
      pendingDragOverIndex.current = null;
      lastPointerYRef.current = null;
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
    const next = [...tabs];
    const fromIndex = next.findIndex(
      (tab, idx) => String(getTabKey(tab, idx)) === fromId
    );
    if (fromIndex === -1) {
      handleDragEnd();
      return;
    }
    const [moved] = next.splice(fromIndex, 1);
    let targetIndex = insertIndex;
    if (fromIndex < targetIndex) targetIndex -= 1;
    targetIndex = Math.max(0, Math.min(next.length, targetIndex));
    next.splice(targetIndex, 0, moved);
    onReorderTabs(next);
    setDraggingId(null);
    setDragOverIndex(null);
    setDragHiddenId(null);
    setDragPlaceholderHeight(null);
    pendingDragOverIndex.current = null;
    lastPointerYRef.current = null;
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
    setDraggingId(null);
    setDragOverIndex(null);
    setDragHiddenId(null);
    setDragPlaceholderHeight(null);
    pendingDragOverIndex.current = null;
    lastPointerYRef.current = null;
    if (dragOverRaf.current) {
      cancelAnimationFrame(dragOverRaf.current);
      dragOverRaf.current = null;
    }
    if (dragHiddenRaf.current) {
      cancelAnimationFrame(dragHiddenRaf.current);
      dragHiddenRaf.current = null;
    }
  };

  const setItemRef = (id) => (node) => {
    if (!node) {
      itemRefs.current.delete(String(id));
      return;
    }
    itemRefs.current.set(String(id), node);
  };

  return (
    <div className="tabgroup">
      <div className="panel-header">
        <div className="panel-title">Tabs</div>
        <button className="button ghost" type="button" onClick={onAddTab}>
          + Add Tab
        </button>
      </div>
      {tabs.length === 0 ? (
        <div className="empty-state">No tabs yet.</div>
      ) : (
        <>
          <div className="tab-list" onDragOver={handleDragOver} onDrop={handleDrop()}>
            {renderTabs.map((link, idx) => {
              if (link.__placeholder) {
                return (
                  <div
                    key={placeholderId}
                    className="resource-item drag-placeholder"
                    style={dragPlaceholderHeight ? { height: dragPlaceholderHeight } : undefined}
                  />
                );
              }
              const key = getTabKey(link, idx);
              const isActive = activeDetail === "tab" && key === selectedTabKey;
              const isDragging = draggingId === String(key);
              const isDragHidden = dragHiddenId === String(key);
              const isDragOver = dragOverIndex !== null && tabs.indexOf(link) === dragOverIndex;
              return (
                <div
                  key={link._id || `${link.title}-${idx}`}
                  ref={setItemRef(key)}
                  className={`resource-item ${isActive ? "active" : ""} ${
                    isDragging ? "dragging" : ""
                  } ${isDragHidden ? "drag-hidden" : ""} ${isDragOver ? "drag-over" : ""}`}
                  draggable
                  onDragStart={handleDragStart(key)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop()}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelectTab(link, idx)}
                >
                  <div className="resource-title">{link.title}</div>
                </div>
              );
            })}
          </div>
          <div className="tab-actions">
            <button className="button ghost" type="button" onClick={onOpenAllTabs}>
              Open All Tabs
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TabPanel;
