import React, { createContext, useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";

import { get, post } from "../utilities";
import { socket } from "../client-socket";
import {
  formatReminderDueAt,
  formatReminderTitle,
  getReminderId,
  hasAlertedReminder,
  isReminderDue,
  markReminderAlerted,
} from "../utilities/reminders";
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

  useEffect(() => {
    if (!user) return;
    if (!socket?.connected || !socket?.id) return;
    post("/api/initsocket", { socketid: socket.id });
  }, [user]);

  useEffect(() => {
    if (!authReady || !user) return;
    let isActive = true;
    let timer = null;
    const handleReminderDue = (payload) => {
      if (!payload?.reminder) return;
      if (hasAlertedReminder(getReminderId(payload.reminder))) return;
      markReminderAlerted(getReminderId(payload.reminder));
      const title = formatReminderTitle(payload.reminder, payload.projectTitle);
      const dueAt = formatReminderDueAt(payload.reminder);
      const note = payload.reminder?.note ? `Note: ${payload.reminder.note}` : "";
      const lines = [`Reminder: ${title}`];
      if (note) lines.push(note);
      if (dueAt) lines.push(`Due: ${dueAt}`);
      window.alert(lines.join("\n"));
    };

    const pollReminders = () => {
      get("/api/projects")
        .then((projects) => {
          if (!isActive) return;
          const now = new Date();
          projects.forEach((project) => {
            (project.reminders || []).forEach((reminder) => {
              if (!isReminderDue(reminder, now)) return;
              const reminderId = getReminderId(reminder);
              if (!reminderId || hasAlertedReminder(reminderId)) return;
              markReminderAlerted(reminderId);
              const title = formatReminderTitle(reminder, project.title);
              const dueAt = formatReminderDueAt(reminder);
              const note = reminder?.note ? `Note: ${reminder.note}` : "";
              const lines = [`Reminder: ${title}`];
              if (note) lines.push(note);
              if (dueAt) lines.push(`Due: ${dueAt}`);
              const message = lines.join("\n");
              window.alert(message);
            });
          });
        })
        .catch(() => {
          // ignore polling errors
        });
    };

    socket.on("reminder:due", handleReminderDue);
    pollReminders();
    timer = setInterval(pollReminders, 30000);
    return () => {
      isActive = false;
      if (timer) clearInterval(timer);
      socket.off("reminder:due", handleReminderDue);
    };
  }, [authReady, user]);

  const handleLogin = (credentialResponse) => {
    const token = credentialResponse?.credential;
    if (!token) {
      return Promise.reject("Missing Google credential.");
    }
    localStorage.setItem("lt_token", token);
    return post("/api/login", { token }).then((loggedInUser) => {
      setUser(loggedInUser);
      if (socket?.connected && socket?.id) {
        post("/api/initsocket", { socketid: socket.id });
      }
      return loggedInUser;
    });
  };

  const handleLogout = () => {
    return post("/api/logout").then(() => {
      localStorage.removeItem("lt_token");
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
