export type RestorePoint = {
  id: string;
  documentId: string;
  createdAt: string;
  label: string;
  title: string;
  body: string;
};

const STORAGE_KEY = "leitmotif-restore-points";
const MAX_POINTS = 24;

export function loadRestorePoints(): RestorePoint[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as RestorePoint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRestorePoints(points: RestorePoint[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(points.slice(0, 200)));
}

export function addRestorePoint(
  points: RestorePoint[],
  next: Omit<RestorePoint, "id" | "createdAt">,
) {
  const last = points.find((item) => item.documentId === next.documentId);
  if (last && last.body === next.body && last.title === next.title) return points;
  const point: RestorePoint = {
    ...next,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const others = points.filter((item) => item.documentId !== next.documentId);
  const own = [point, ...points.filter((item) => item.documentId === next.documentId)].slice(
    0,
    MAX_POINTS,
  );
  return [...own, ...others];
}
