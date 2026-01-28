/*
|--------------------------------------------------------------------------
| api.js -- server routes
|--------------------------------------------------------------------------
|
| This file defines the routes for your server.
|
*/

const express = require("express");
const mongoose = require("mongoose");

// import models so we can interact with the database
const User = require("./models/user");
const Project = require("./models/project");
const Resource = require("./models/resource");
const TabGroup = require("./models/tabgroup");

// import authentication library
const auth = require("./auth");

// api endpoints: all these paths will be prefixed with "/api/"
const router = express.Router();

//initialize socket
const socketManager = require("./server-socket");

router.post("/login", auth.login);
router.post("/logout", auth.logout);
router.get("/whoami", (req, res) => {
  if (!req.user) {
    // not logged in
    return res.send({});
  }

  res.send(req.user);
});

router.post("/initsocket", (req, res) => {
  // do nothing if user not logged in
  if (req.user)
    socketManager.addUser(req.user, socketManager.getSocketFromSocketID(req.body.socketid));
  res.send({});
});

// |------------------------------|
// | write your API methods below!|
// |------------------------------|
router.get("/projects", auth.ensureLoggedIn, (req, res) => {
  Project.find({ creator: req.user._id })
    .sort({ createdAt: -1 })
    .then((projects) => res.send(projects));
});

router.get("/projects/search", auth.ensureLoggedIn, (req, res) => {
  Project.find({ creator: req.user._id })
    .sort({ createdAt: -1 })
    .populate("resources")
    .populate("tabGroups")
    .then((projects) => res.send(projects));
});

router.get("/projects/:projectId", auth.ensureLoggedIn, (req, res) => {
  Project.findOne({ _id: req.params.projectId, creator: req.user._id })
    .populate("resources")
    .populate("tabGroups")
    .then((project) => {
      if (!project) {
        return res.status(404).send({ msg: "Project not found" });
      }
      res.send(project);
    });
});

router.post("/projects", auth.ensureLoggedIn, (req, res) => {
  const newProject = new Project({
    creator: req.user._id,
    title: req.body.title || "Untitled Project",
    description: req.body.description || "",
    reminders: req.body.reminders || [],
  });

  newProject.save().then((project) => res.send(project));
});

router.patch("/projects/:projectId", auth.ensureLoggedIn, (req, res) => {
  Project.findOneAndUpdate({ _id: req.params.projectId, creator: req.user._id }, req.body, {
    new: true,
  })
    .then((project) => res.send(project))
    .catch(() => res.status(404).send({ msg: "Project not found" }));
});

router.post("/projects/:projectId", auth.ensureLoggedIn, (req, res) => {
  Project.findById(req.params.projectId)
    .then((project) => {
      if (!project) {
        return res.status(404).send({ msg: "Project not found" });
      }

      if (project.creator && String(project.creator) !== String(req.user._id)) {
        return res.status(403).send({ msg: "Project not found" });
      }

      //if (!project.creator) {
      project.creator = req.user._id;
      return project.save().then(() =>
        Project.findByIdAndUpdate(req.params.projectId, req.body, {
          new: true,
        }).then((updated) => res.send(updated))
      );
      //}

      // return Project.findByIdAndUpdate(req.params.projectId, req.body, {
      //   new: true,
      // }).then((updated) => res.send(updated));
    })
    .catch(() => res.status(404).send({ msg: "Project not found" }));
});

router.post("/projects/:projectId/reminders", auth.ensureLoggedIn, (req, res) => {
  const { resourceId, dueAt, note } = req.body;
  if (!resourceId || !dueAt) {
    return res.status(400).send({ msg: "Missing reminder data" });
  }
  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) {
    return res.status(400).send({ msg: "Invalid due date" });
  }

  Project.findOne({ _id: req.params.projectId, creator: req.user._id })
    .then((project) => {
      if (!project) {
        return res.status(404).send({ msg: "Project not found" });
      }

      return Resource.findById(resourceId).then((resource) => {
        if (!resource) {
          return res.status(404).send({ msg: "Resource not found" });
        }

        if (String(resource.projectId) !== String(project._id)) {
          return res.status(403).send({ msg: "Resource not found" });
        }

        const reminder = {
          _id: new mongoose.Types.ObjectId(),
          resourceId: resource._id,
          resourceTitle: resource.title || "Untitled Resource",
          resourceUrl: resource.url || "",
          note: typeof note === "string" ? note.trim() : "",
          dueAt: dueDate,
          createdAt: new Date(),
          dismissedAt: null,
        };

        project.reminders = project.reminders || [];
        project.reminders.push(reminder);
        project.markModified("reminders");

        return project.save().then(() => {
          const socket = socketManager.getSocketFromUserID(req.user._id);
          if (socket) {
            socket.emit("reminder:updated", {
              projectId: project._id,
              reminder,
            });
          }
          const delay = reminder.dueAt ? new Date(reminder.dueAt).getTime() - Date.now() : 0;
          if (Number.isFinite(delay)) {
            setTimeout(() => {
              const liveSocket = socketManager.getSocketFromUserID(req.user._id);
              if (liveSocket) {
                liveSocket.emit("reminder:due", {
                  projectId: project._id,
                  reminder,
                });
              }
            }, Math.max(0, delay));
          }
          return res.send(reminder);
        });
      });
    })
    .catch(() => res.status(404).send({ msg: "Project not found" }));
});

router.post(
  "/projects/:projectId/reminders/:reminderId/dismiss",
  auth.ensureLoggedIn,
  (req, res) => {
    Project.findOne({ _id: req.params.projectId, creator: req.user._id })
      .then((project) => {
        if (!project) {
          return res.status(404).send({ msg: "Project not found" });
        }

        const reminders = project.reminders || [];
        const reminder = reminders.find(
          (item) => item && String(item._id) === String(req.params.reminderId)
        );
        if (!reminder) {
          return res.status(404).send({ msg: "Reminder not found" });
        }

        reminder.dismissedAt = new Date();
        project.markModified("reminders");
        return project.save().then(() => {
          const socket = socketManager.getSocketFromUserID(req.user._id);
          if (socket) {
            socket.emit("reminder:updated", {
              projectId: project._id,
              reminder,
            });
          }
          return res.send(reminder);
        });
      })
      .catch(() => res.status(404).send({ msg: "Project not found" }));
  }
);

router.post("/projects/:projectId/delete", auth.ensureLoggedIn, (req, res) => {
  Project.findById(req.params.projectId)
    .then((project) => {
      if (!project) {
        return res.status(404).send({ msg: "Project not found" });
      }

      if (project.creator && String(project.creator) !== String(req.user._id)) {
        return res.status(403).send({ msg: "Project not found" });
      }

      return Project.findByIdAndDelete(req.params.projectId).then(() =>
        res.send({ success: true })
      );
    })
    .catch(() => res.status(404).send({ msg: "Project not found" }));
});

router.post("/projects/:projectId/resources", auth.ensureLoggedIn, (req, res) => {
  Project.findOne({ _id: req.params.projectId, creator: req.user._id }).then((project) => {
    if (!project) {
      return res.status(404).send({ msg: "Project not found" });
    }

    const newResource = new Resource({
      projectId: req.params.projectId,
      title: req.body.title || "New Resource",
      description: req.body.description || "",
      url: req.body.url || "",
      purpose: req.body.purpose || "",
      notes: req.body.notes || "",
    });

    newResource.save().then((resource) => {
      Project.findByIdAndUpdate(
        req.params.projectId,
        { $push: { resources: resource._id } },
        { new: true }
      ).then(() => res.send(resource));
    });
  });
});

router.post("/resources/:resourceId", auth.ensureLoggedIn, (req, res) => {
  Resource.findById(req.params.resourceId)
    .then((resource) => {
      if (!resource) {
        return res.status(404).send({ msg: "Resource not found" });
      }

      return Project.findById(resource.projectId).then((project) => {
        if (!project) {
          return res.status(404).send({ msg: "Project not found" });
        }

        if (project.creator && String(project.creator) !== String(req.user._id)) {
          return res.status(403).send({ msg: "Project not found" });
        }

        //if (!project.creator) {
        project.creator = req.user._id;
        return project.save().then(() =>
          Resource.findByIdAndUpdate(req.params.resourceId, req.body, {
            new: true,
          }).then((updated) => res.send(updated))
        );
        //}

        // return Resource.findByIdAndUpdate(req.params.resourceId, req.body, {
        //   new: true,
        // }).then((updated) => res.send(updated));
      });
    })
    .catch(() => res.status(404).send({ msg: "Resource not found" }));
});

router.post("/resources/:resourceId/delete", auth.ensureLoggedIn, (req, res) => {
  Resource.findById(req.params.resourceId)
    .then((resource) => {
      if (!resource) {
        return res.status(404).send({ msg: "Resource not found" });
      }

      return Project.findById(resource.projectId).then((project) => {
        if (!project) {
          return res.status(404).send({ msg: "Project not found" });
        }

        if (project.creator && String(project.creator) !== String(req.user._id)) {
          return res.status(403).send({ msg: "Project not found" });
        }

        return Resource.findByIdAndDelete(req.params.resourceId).then(() =>
          Project.findByIdAndUpdate(
            resource.projectId,
            { $pull: { resources: req.params.resourceId } },
            { new: true }
          ).then(() => res.send({ success: true }))
        );
      });
    })
    .catch(() => res.status(404).send({ msg: "Resource not found" }));
});

router.post("/projects/:projectId/tabgroups", auth.ensureLoggedIn, (req, res) => {
  Project.findOne({ _id: req.params.projectId, creator: req.user._id }).then((project) => {
    if (!project) {
      return res.status(404).send({ msg: "Project not found" });
    }

    const newTabGroup = new TabGroup({
      projectId: req.params.projectId,
      title: req.body.title || "New Tab Group",
      links: req.body.links || [],
    });

    newTabGroup.save().then((tabGroup) => {
      Project.findByIdAndUpdate(
        req.params.projectId,
        { $push: { tabGroups: tabGroup._id } },
        { new: true }
      ).then(() => res.send(tabGroup));
    });
  });
});

router.post("/tabgroups/:tabGroupId/links", auth.ensureLoggedIn, (req, res) => {
  const newLink = {
    title: req.body.title || "New Tab",
    description: req.body.description || "",
    url: req.body.url || "",
  };

  TabGroup.findById(req.params.tabGroupId)
    .then((tabGroup) => {
      if (!tabGroup) {
        return res.status(404).send({ msg: "Tab group not found" });
      }

      return Project.findOne({
        _id: tabGroup.projectId,
        creator: req.user._id,
      }).then((project) => {
        if (!project) {
          return res.status(404).send({ msg: "Project not found" });
        }

        return TabGroup.findByIdAndUpdate(
          req.params.tabGroupId,
          { $push: { links: newLink } },
          { new: true }
        ).then((updated) => res.send(updated));
      });
    })
    .catch(() => res.status(404).send({ msg: "Tab group not found" }));
});

router.post("/tabgroups/:tabGroupId/links/:linkId", auth.ensureLoggedIn, (req, res) => {
  TabGroup.findById(req.params.tabGroupId)
    .then((tabGroup) => {
      if (!tabGroup) {
        return res.status(404).send({ msg: "Tab group not found" });
      }

      return Project.findOne({
        _id: tabGroup.projectId,
        creator: req.user._id,
      }).then((project) => {
        if (!project) {
          return res.status(404).send({ msg: "Project not found" });
        }

        const updates = {};
        if (req.body.title !== undefined) updates["links.$.title"] = req.body.title;
        if (req.body.url !== undefined) updates["links.$.url"] = req.body.url;
        if (req.body.description !== undefined)
          updates["links.$.description"] = req.body.description;

        return TabGroup.findOneAndUpdate(
          { _id: req.params.tabGroupId, "links._id": req.params.linkId },
          { $set: updates },
          { new: true }
        ).then((updated) => res.send(updated));
      });
    })
    .catch(() => res.status(404).send({ msg: "Tab group not found" }));
});

router.post("/tabgroups/:tabGroupId/links/:linkId/delete", auth.ensureLoggedIn, (req, res) => {
  TabGroup.findById(req.params.tabGroupId)
    .then((tabGroup) => {
      if (!tabGroup) {
        return res.status(404).send({ msg: "Tab group not found" });
      }

      return Project.findOne({
        _id: tabGroup.projectId,
        creator: req.user._id,
      }).then((project) => {
        if (!project) {
          return res.status(404).send({ msg: "Project not found" });
        }

        return TabGroup.findByIdAndUpdate(
          req.params.tabGroupId,
          { $pull: { links: { _id: req.params.linkId } } },
          { new: true }
        ).then((updated) => res.send(updated));
      });
    })
    .catch(() => res.status(404).send({ msg: "Tab group not found" }));
});

// anything else falls to this "not found" case
router.all("*", (req, res) => {
  console.log(`API route not found: ${req.method} ${req.url}`);
  res.status(404).send({ msg: "API route not found" });
});

module.exports = router;
