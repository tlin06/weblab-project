import React, { createContext, useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";

import { get, post } from "../utilities";
import "../utilities.css";
import "../styles/app.css";

export const UserContext = createContext({
  user: null,
  authReady: false,
  handleLogin: () => Promise.resolve(),
  handleLogout: () => Promise.resolve(),
});

/**
 * Define the "App" component
 */
const App = () => {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    get("/api/whoami")
      .then((data) => {
        setUser(data && data._id ? data : null);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setAuthReady(true);
      });
  }, []);

  const handleLogin = (credentialResponse) => {
    const token = credentialResponse?.credential;
    if (!token) {
      return Promise.reject("Missing Google credential.");
    }
    return post("/api/login", { token }).then((loggedInUser) => {
      setUser(loggedInUser);
      return loggedInUser;
    });
  };

  const handleLogout = () => {
    return post("/api/logout").then(() => {
      setUser(null);
    });
  };

  const value = useMemo(
    () => ({
      user,
      authReady,
      handleLogin,
      handleLogout,
    }),
    [user, authReady]
  );

  return (
    <UserContext.Provider value={value}>
      <div className="app-shell">
        <Outlet />
      </div>
    </UserContext.Provider>
  );
};

export default App;
