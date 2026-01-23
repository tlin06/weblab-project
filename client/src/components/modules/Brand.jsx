import React from "react";
import { useNavigate } from "react-router-dom";

const Brand = ({ subtitle }) => {
  const navigate = useNavigate();

  return (
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
        <div className="sidebar-reminder">{subtitle}</div>
      </div>
    </div>
  );
};

export default Brand;
