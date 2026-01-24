import React from "react";

const ResourcePanel = ({
  resources,
  selectedResourceId,
  activeDetail,
  onSelectResource,
  onAddResource,
}) => {
  return (
    <>
      <div className="panel-header">
        <div className="panel-title">Resources</div>
        <button className="button ghost" type="button" onClick={onAddResource}>
          + Add Resource
        </button>
      </div>
      <div className="resource-list">
        {resources?.length ? (
          resources.map((resource) => (
            <div
              key={resource._id}
              className={`resource-item ${
                activeDetail === "resource" && resource._id === selectedResourceId
                  ? "active"
                  : ""
              }`}
              onClick={() => onSelectResource(resource._id)}
            >
              <div className="resource-title">{resource.title}</div>
              {resource.purpose && (
                <div className="resource-description">{resource.purpose}</div>
              )}
            </div>
          ))
        ) : (
          <div className="empty-state">No resources yet.</div>
        )}
      </div>
    </>
  );
};

export default ResourcePanel;
