import React from "react";
import { useNavigate } from "react-router-dom";

const SearchBar = ({
  label = "Search (shell only)",
  value,
  onChange,
  placeholder = "Search...",
  autoFocus = false,
}) => {
  const navigate = useNavigate();
  const isInteractive = typeof onChange === "function";

  if (isInteractive) {
    return (
      <div className="search-bar search-input">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-label="Search"
        />
      </div>
    );
  }

  return (
    <div className="search-bar" onClick={() => navigate("/search")}>
      {label}
    </div>
  );
};

export default SearchBar;
