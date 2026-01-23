const STORAGE_KEY = "lt_project_order";

export const getProjectOrder = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const setProjectOrder = (order) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // ignore storage errors
  }
};

export const applyProjectOrder = (projects) => {
  const order = getProjectOrder();
  if (!order.length) return projects;
  const map = new Map(projects.map((project) => [String(project._id), project]));
  const ordered = order.map((id) => map.get(String(id))).filter(Boolean);
  const remaining = projects.filter((project) => !order.includes(String(project._id)));
  return [...ordered, ...remaining];
};

export const insertProjectOrder = (projectId, index = 0) => {
  const order = getProjectOrder().filter((id) => String(id) !== String(projectId));
  order.splice(index, 0, String(projectId));
  setProjectOrder(order);
  return order;
};

export const removeProjectOrder = (projectId) => {
  const order = getProjectOrder().filter((id) => String(id) !== String(projectId));
  setProjectOrder(order);
  return order;
};

export const reorderProjectOrder = (projectIds) => {
  const order = projectIds.map((id) => String(id));
  setProjectOrder(order);
  return order;
};
