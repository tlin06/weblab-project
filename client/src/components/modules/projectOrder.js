const STORAGE_KEY = "lt_project_order";
const RESOURCE_KEY_PREFIX = "lt_resource_order_";
const TAB_KEY_PREFIX = "lt_tab_order_";

const getOrder = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const setOrder = (key, order) => {
  try {
    localStorage.setItem(key, JSON.stringify(order));
  } catch {
    // ignore storage errors
  }
};

const applyOrder = (items, order) => {
  if (!order.length) return items;
  const map = new Map(items.map((item) => [String(item._id), item]));
  const ordered = order.map((id) => map.get(String(id))).filter(Boolean);
  const remaining = items.filter((item) => !order.includes(String(item._id)));
  return [...ordered, ...remaining];
};

export const getProjectOrder = () => {
  return getOrder(STORAGE_KEY);
};

export const setProjectOrder = (order) => {
  setOrder(STORAGE_KEY, order);
};

export const applyProjectOrder = (projects) => {
  const order = getProjectOrder();
  return applyOrder(projects, order);
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

export const getResourceOrder = (projectId) =>
  getOrder(`${RESOURCE_KEY_PREFIX}${projectId}`);

export const applyResourceOrder = (projectId, resources) =>
  applyOrder(resources, getResourceOrder(projectId));

export const insertResourceOrder = (projectId, resourceId, index = 0) => {
  const order = getResourceOrder(projectId).filter((id) => String(id) !== String(resourceId));
  order.splice(index, 0, String(resourceId));
  setOrder(`${RESOURCE_KEY_PREFIX}${projectId}`, order);
  return order;
};

export const removeResourceOrder = (projectId, resourceId) => {
  const order = getResourceOrder(projectId).filter((id) => String(id) !== String(resourceId));
  setOrder(`${RESOURCE_KEY_PREFIX}${projectId}`, order);
  return order;
};

export const reorderResourceOrder = (projectId, resourceIds) => {
  const order = resourceIds.map((id) => String(id));
  setOrder(`${RESOURCE_KEY_PREFIX}${projectId}`, order);
  return order;
};

export const getTabOrder = (projectId) => getOrder(`${TAB_KEY_PREFIX}${projectId}`);

export const applyTabOrder = (projectId, tabs) =>
  applyOrder(tabs, getTabOrder(projectId));

export const insertTabOrder = (projectId, tabId, index = 0) => {
  const order = getTabOrder(projectId).filter((id) => String(id) !== String(tabId));
  order.splice(index, 0, String(tabId));
  setOrder(`${TAB_KEY_PREFIX}${projectId}`, order);
  return order;
};

export const removeTabOrder = (projectId, tabId) => {
  const order = getTabOrder(projectId).filter((id) => String(id) !== String(tabId));
  setOrder(`${TAB_KEY_PREFIX}${projectId}`, order);
  return order;
};

export const reorderTabOrder = (projectId, tabIds) => {
  const order = tabIds.map((id) => String(id));
  setOrder(`${TAB_KEY_PREFIX}${projectId}`, order);
  return order;
};
