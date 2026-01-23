import React from "react";
import { useNavigate } from "react-router-dom";

const SearchBar = ({ label = "Search (shell only)" }) => {
  const navigate = useNavigate();

  return (
    <div className="search-bar" onClick={() => navigate("/search")}>
      {label}
    </div>
  );
};

export default SearchBar;
