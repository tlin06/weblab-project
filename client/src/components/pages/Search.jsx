import React from "react";
import Brand from "../modules/Brand";
import SearchBar from "../modules/SearchBar";

const Search = () => {
  return (
    <div className="layout">
      <aside className="sidebar">
        <Brand subtitle="Search" />
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="topbar-title">Search</div>
            <div className="topbar-description">Search page placeholder.</div>
          </div>
          <SearchBar />
        </header>

        <section className="panel">
          <div className="empty-state">Search results will go here.</div>
        </section>
      </main>
    </div>
  );
};

export default Search;
