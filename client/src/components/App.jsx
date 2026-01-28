import React, { createContext, useEffect, useMemo, useRef, useState } from "react";
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
  const swReadyRef = useRef(null);

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
    if (!("serviceWorker" in navigator)) return;
    if (swReadyRef.current) return;
    swReadyRef.current = navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!socket?.connected || !socket?.id) return;
    post("/api/initsocket", { socketid: socket.id });
  }, [user]);

  useEffect(() => {
    if (!authReady || !user) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {
        // ignore permission errors
      });
    }
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !user) return;
    let isActive = true;
    let timer = null;
    const notifyReminder = (reminder, projectTitle) => {
      const reminderId = getReminderId(reminder);
      if (!reminderId || hasAlertedReminder(reminderId)) return;
      const title = formatReminderTitle(reminder, projectTitle);
      const dueAt = formatReminderDueAt(reminder);
      const note = reminder?.note ? `Note: ${reminder.note}` : "";
      const lines = [`Reminder: ${title}`];
      if (note) lines.push(note);
      if (dueAt) lines.push(`Due: ${dueAt}`);
      const message = lines.join("\n");

      if ("Notification" in window && Notification.permission === "granted") {
        const payload = {
          body: message,
          tag: reminderId,
          data: {
            url: "/",
          },
        };
        if ("serviceWorker" in navigator) {
          const readyPromise =
            swReadyRef.current || navigator.serviceWorker.ready.catch(() => null);
          readyPromise.then((registration) => {
            if (registration) {
              registration.showNotification("LinkTracker Reminder", payload);
              markReminderAlerted(reminderId);
              window.alert(message);
            } else {
              new Notification("LinkTracker Reminder", payload);
              markReminderAlerted(reminderId);
              window.alert(message);
            }
          });
          return;
        }
        new Notification("LinkTracker Reminder", payload);
        markReminderAlerted(reminderId);
        window.alert(message);
        return;
      }

      window.alert(message);
      markReminderAlerted(reminderId);
    };
    const handleReminderDue = (payload) => {
      if (!payload?.reminder) return;
      notifyReminder(payload.reminder, payload.projectTitle);
    };

    const pollReminders = () => {
      get("/api/projects")
        .then((projects) => {
          if (!isActive) return;
          const now = new Date();
          projects.forEach((project) => {
            (project.reminders || []).forEach((reminder) => {
              if (!isReminderDue(reminder, now)) return;
              notifyReminder(reminder, project.title);
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
