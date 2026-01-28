import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get } from "../../utilities";
import { UserContext } from "../App";
import Brand from "../modules/Brand";
import SearchBar from "../modules/SearchBar";

const Search = () => {
  const navigate = useNavigate();
  const { user, authReady } = useContext(UserContext);
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProjects([]);
      return;
    }
    get("/api/projects/search")
      .then((data) => setProjects(data))
      .catch((err) => {
        console.log(err);
        setError("Could not load projects. Is the server running?");
      });
  }, [user, authReady]);

  const normalizedQuery = query.trim().toLowerCase();
  const tokens = normalizedQuery ? normalizedQuery.split(/\s+/) : [];
  const normalizeUrlForSearch = (value) => {
    if (!value) return "";
    const trimmed = String(value).trim().toLowerCase();
    if (!trimmed) return "";
    const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
    return withoutProtocol.replace(/^www\./, "");
  };
  const matchesTokens = (text) => {
    if (!tokens.length) return false;
    const haystack = String(text || "").toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  };

  const projectResults = useMemo(() => {
    if (!tokens.length) return [];
    return projects.filter((project) =>
      matchesTokens(`${project.title || ""} ${project.description || ""}`)
    );
  }, [projects, tokens]);

  const resourceResults = useMemo(() => {
    if (!tokens.length) return [];
    const results = [];
    projects.forEach((project) => {
      (project.resources || []).forEach((resource) => {
        const normalizedUrl = normalizeUrlForSearch(resource.url);
        const haystack = `${resource.title || ""} ${resource.purpose || ""} ${
          resource.notes || ""
        } ${resource.url || ""} ${normalizedUrl}`;
        if (matchesTokens(haystack)) {
          results.push({
            ...resource,
            projectId: project._id,
            projectTitle: project.title,
          });
        }
      });
    });
    return results;
  }, [projects, tokens]);

  const linkResults = useMemo(() => {
    if (!tokens.length) return [];
    const results = [];
    projects.forEach((project) => {
      (project.tabGroups || []).forEach((group) => {
        (group.links || []).forEach((link) => {
          const normalizedUrl = normalizeUrlForSearch(link.url);
          const haystack = `${link.title || ""} ${link.url || ""} ${normalizedUrl} ${
            link.description || ""
          }`;
          if (matchesTokens(haystack)) {
            results.push({
              ...link,
              projectId: project._id,
              projectTitle: project.title,
            });
          }
        });
      });
    });
    return results;
  }, [projects, tokens]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <Brand subtitle="Search" />
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="topbar-title">Search</div>
            <div className="topbar-description">Find projects, resources, and links.</div>
          </div>
          <SearchBar value={query} onChange={setQuery} placeholder="Search projects and notes..." autoFocus />
        </header>

        {!user && authReady ? (
          <div className="empty-state" style={{ padding: "16px 18px" }}>
            Sign in to search your projects.
          </div>
        ) : (
          <div className="search-results">
            {error && <div className="empty-state">{error}</div>}
            {!tokens.length && (
              <div className="empty-state">Type above to search your projects and notes.</div>
            )}
            {tokens.length > 0 && (
              <>
                <section className="panel search-panel search-panel-top">
                  <div className="panel-header">
                    <div className="panel-title">Projects</div>
                  </div>
                  <div className="search-panel-body">
                    {projectResults.length === 0 ? (
                      <div className="empty-state">No matching projects.</div>
                    ) : (
                      projectResults.map((project) => (
                        <div
                          key={project._id}
                          className="search-item"
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(`/project/${project._id}`)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") navigate(`/project/${project._id}`);
                          }}
                        >
                          <div className="search-item-title">{project.title}</div>
                          <div className="search-item-subtitle">
                            {project.description || "No description."}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <div className="search-results-bottom">
                  <section className="panel search-panel">
                    <div className="panel-header">
                      <div className="panel-title">Resources</div>
                    </div>
                    <div className="search-panel-body">
                      {resourceResults.length === 0 ? (
                        <div className="empty-state">No matching resources.</div>
                      ) : (
                        resourceResults.map((resource) => (
                          <div
                            key={resource._id}
                            className="search-item"
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              navigate(`/project/${resource.projectId}`, {
                                state: { resourceId: resource._id },
                              })
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter")
                                navigate(`/project/${resource.projectId}`, {
                                  state: { resourceId: resource._id },
                                });
                            }}
                          >
                            <div className="search-item-title">{resource.title}</div>
                            <div className="search-item-subtitle">
                              {resource.purpose || "No purpose."}
                            </div>
                            <div className="search-item-meta">
                              Project: {resource.projectTitle || "Untitled"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="panel search-panel">
                    <div className="panel-header">
                      <div className="panel-title">Tabs</div>
                    </div>
                    <div className="search-panel-body">
                      {linkResults.length === 0 ? (
                        <div className="empty-state">No matching tabs.</div>
                      ) : (
                        linkResults.map((link) => (
                          <div
                            key={link._id}
                            className="search-item"
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              navigate(`/project/${link.projectId}`, {
                                state: { tabId: link._id },
                              })
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter")
                                navigate(`/project/${link.projectId}`, {
                                  state: { tabId: link._id },
                                });
                            }}
                          >
                            <div className="search-item-title">{link.title || "Untitled link"}</div>
                            <div className="search-item-subtitle">{link.url || "No URL."}</div>
                            <div className="search-item-meta">
                              Project: {link.projectTitle || "Untitled"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Search;
