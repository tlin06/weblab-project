import React from "react";
import { Link, useNavigate } from "react-router-dom";

const Brand = ({ subtitle }) => {
  const navigate = useNavigate();

  return (
    <div className="brand" onClick={() => navigate("/")}>
      <div className="brand-mark">
        <img src="/link_logo.svg" alt="LinkTracker logo" className="brand-logo" />
      </div>
      <div>
        <div className="brand-title">LinkTracker</div>
        <div className="sidebar-reminder">{subtitle}</div>
      </div>
    </div>
  );
};

export default Brand;
