import React, { useEffect, useMemo, useRef, useState } from "react";

const ResourcePanel = ({
  resources,
  selectedResourceId,
  activeDetail,
  onSelectResource,
  onAddResource,
  onReorderResources,
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
  const placeholderId = "__resource_placeholder__";

  const renderResources = useMemo(() => {
    if (!draggingId || dragOverIndex === null) return resources;
    const orderedIds = orderedIdsRef.current;
    const beforeId = orderedIds[dragOverIndex] || null;
    let insertIndex = beforeId
      ? resources.findIndex((resource) => String(resource._id) === String(beforeId))
      : resources.length;
    if (insertIndex === -1) insertIndex = resources.length;
    const withPlaceholder = [...resources];
    withPlaceholder.splice(insertIndex, 0, { _id: placeholderId, __placeholder: true });
    return withPlaceholder;
  }, [resources, draggingId, dragOverIndex]);

  useEffect(() => {
    dragOverIndexRef.current = dragOverIndex;
  }, [dragOverIndex]);

  const getInsertionIndex = (clientY) => {
    const items = [];
    resources.forEach((resource) => {
      const id = String(resource._id);
      if (id === String(draggingId)) return;
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

  const handleDragStart = (resourceId) => (event) => {
    setDraggingId(String(resourceId));
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(resourceId));
    const height = event.currentTarget.getBoundingClientRect().height;
    setDragPlaceholderHeight(height);
    if (dragHiddenRaf.current) {
      cancelAnimationFrame(dragHiddenRaf.current);
    }
    dragHiddenRaf.current = requestAnimationFrame(() => {
      setDragHiddenId(String(resourceId));
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
      ? resources.findIndex((resource) => String(resource._id) === String(beforeId))
      : resources.length;
    if (insertIndex === -1) insertIndex = resources.length;
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
    const next = [...resources];
    const fromIndex = next.findIndex((resource) => String(resource._id) === fromId);
    if (fromIndex === -1) {
      handleDragEnd();
      return;
    }
    const [moved] = next.splice(fromIndex, 1);
    let targetIndex = insertIndex;
    if (fromIndex < targetIndex) targetIndex -= 1;
    targetIndex = Math.max(0, Math.min(next.length, targetIndex));
    next.splice(targetIndex, 0, moved);
    onReorderResources(next);
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
    <>
      <div className="panel-header">
        <div className="panel-title">Resources</div>
        <button className="button ghost" type="button" onClick={onAddResource}>
          + Add Resource
        </button>
      </div>
      <div className="resource-list" onDragOver={handleDragOver} onDrop={handleDrop()}>
        {renderResources?.length ? (
          renderResources.map((resource) => {
            if (resource.__placeholder) {
              return (
                <div
                  key={placeholderId}
                  className="resource-item drag-placeholder"
                  style={dragPlaceholderHeight ? { height: dragPlaceholderHeight } : undefined}
                />
              );
            }
            const isDragging = draggingId === String(resource._id);
            const isDragHidden = dragHiddenId === String(resource._id);
            const isDragOver =
              dragOverIndex !== null && resources.indexOf(resource) === dragOverIndex;
            return (
            <div
              key={resource._id}
              ref={setItemRef(resource._id)}
              className={`resource-item ${
                activeDetail === "resource" && resource._id === selectedResourceId
                  ? "active"
                  : ""
              } ${isDragging ? "dragging" : ""} ${isDragHidden ? "drag-hidden" : ""} ${
                isDragOver ? "drag-over" : ""
              }`}
              draggable
              onDragStart={handleDragStart(resource._id)}
              onDragOver={handleDragOver}
              onDrop={handleDrop()}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectResource(resource._id)}
            >
              <div className="resource-title">{resource.title}</div>
              {resource.purpose && (
                <div className="resource-description">{resource.purpose}</div>
              )}
            </div>
            );
          })
        ) : (
          <div className="empty-state">No resources yet.</div>
        )}
      </div>
    </>
  );
};

export default ResourcePanel;
