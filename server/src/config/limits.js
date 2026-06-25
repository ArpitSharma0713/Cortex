export const LIMITS = {
  free: {
    queriesPerDay: 10,
    documentsPerMonth: 5,
    chunksPerDocument: 100,
  },
  pro: {
    queriesPerDay: 100,
    documentsPerMonth: 50,
    chunksPerDocument: 500,
  },
};

export function getPlanLimits(plan = "free") {
  return LIMITS[plan] || LIMITS.free;
}
