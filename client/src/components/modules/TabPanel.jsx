import React from "react";

const TabPanel = ({
  tabs,
  selectedTabKey,
  activeDetail,
  onSelectTab,
  onAddTab,
  onOpenAllTabs,
  getTabKey,
}) => {
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
          <div className="tab-list">
            {tabs.map((link, idx) => {
              const key = getTabKey(link, idx);
              const isActive = activeDetail === "tab" && key === selectedTabKey;
              return (
                <div
                  key={link._id || `${link.title}-${idx}`}
                  className={`resource-item ${isActive ? "active" : ""}`}
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
