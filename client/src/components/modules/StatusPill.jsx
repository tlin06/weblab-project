import React from "react";

const StatusPill = ({ text }) => {
  if (!text) return null;
  return <div className="status-pill">{text}</div>;
};

export default StatusPill;
