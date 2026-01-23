import React from "react";
import { useNavigate } from "react-router-dom";

const Search = () => {
  const navigate = useNavigate();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">LT</div>
          <div>
            <div className="brand-title">LinkTracker</div>
            <div className="sidebar-reminder">Search</div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="topbar-title">Search</div>
            <div className="sidebar-reminder">Search page placeholder.</div>
          </div>
          <div className="search-bar" onClick={() => navigate("/search")}>
            Search (shell only)
          </div>
        </header>

        <section className="panel">
          <div className="empty-state">Search results will go here.</div>
        </section>
      </main>
    </div>
  );
};

export default Search;
