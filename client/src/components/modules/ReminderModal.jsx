import React, { useEffect } from "react";

const ReminderModal = ({
  isOpen,
  title,
  subtitle,
  note,
  onOpenResource,
  onDismiss,
  onClose,
  openLabel = "Open Resource",
  dismissLabel = "Dismiss",
}) => {
  if (!isOpen) return null;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal">
        <div className="modal-title">{title || "Reminder"}</div>
        {subtitle && <div className="modal-body">{subtitle}</div>}
        {note && <div className="modal-body">{note}</div>}
        <div className="modal-actions">
          <button className="button ghost" type="button" onClick={onClose}>
            Close
          </button>
          <button className="button ghost" type="button" onClick={onDismiss}>
            {dismissLabel}
          </button>
          <button className="button" type="button" onClick={onOpenResource}>
            {openLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReminderModal;
