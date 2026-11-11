import { z } from "zod";

export const idSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const timestampSchema = z.number().int().nonnegative().max(8.64e15);
export const segmentSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[\w.-]+$/)
  .refine((s) => s !== "." && s !== "..");
export const fullNameSchema = z
  .string()
  .max(201)
  .refine((s) => {
    const parts = s.split("/");
    return (
      parts.length === 2 &&
      parts.every((p) => segmentSchema.safeParse(p).success)
    );
  });
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const delta = z
  .number()
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
export const repositorySchema = z.object({
  id: idSchema,
  fullName: fullNameSchema,
  description: z.string().max(10000),
  language: z.string().max(100).nullable(),
  stars: count,
  forks: count,
  license: z.string().max(100),
  topics: z.array(z.string().min(1).max(100)).max(100),
  createdAt: z.iso.datetime({ offset: true }),
  pushedAt: z.iso.datetime({ offset: true }),
  checkedAt: timestampSchema,
  firstSeen: timestampSchema,
  tracking: z.boolean(),
  hour: delta,
  sixHours: delta,
  day: delta,
  acceleration: z.number().nullable(),
  score: z.number(),
  signal: z.enum(["emerging", "growing", "watching", "new", "stale"]),
  reason: z.string().max(2000),
});
export type Repository = z.infer<typeof repositorySchema>;
export const catalogSchema = z.object({
  mode: z.enum(["demo", "live"]),
  fetchedAt: timestampSchema,
  lastCollectionAt: timestampSchema,
  scoringVersion: z.literal("collector-v1"),
  collection: z.object({
    state: z.enum(["available", "delayed"]),
    intervalMinutes: z.number().positive().max(1440),
  }),
  coverage: z.object({
    observed: count,
    rankedHourly: count,
    measured6h: count,
    measured24h: count,
  }),
  items: z.array(repositorySchema).max(20000),
});
export type Catalog = z.infer<typeof catalogSchema>;
export const pointSchema = z.object({
  at: timestampSchema,
  stars: count,
  forks: count,
});
export const historyWindowSchema = z.enum(["24h", "7d"]);
export type HistoryWindow = z.infer<typeof historyWindowSchema>;
export const historyDuration = (window: HistoryWindow) =>
  window === "7d" ? 7 * 86_400_000 : 86_400_000;
export const historyPointLimit = (window: HistoryWindow) => window === "7d" ? 2000 : 200;
export const historySchema = z.object({
  repositoryId: idSchema,
  window: historyWindowSchema,
  fetchedAt: timestampSchema,
  points: z.array(pointSchema).max(2000),
  availability: z.enum(["available", "insufficient", "unavailable"]),
}).refine(history => history.points.length <= historyPointLimit(history.window), "Too many observations for this window");
export type History = z.infer<typeof historySchema>;
export const repoPath = (repo: Pick<Repository, "fullName">) =>
  "/repo/" + repo.fullName.split("/").map(encodeURIComponent).join("/");

export const historyBatchSchema = z.object({
  items: z
    .array(
      z.object({
        repositoryId: idSchema,
        history: historySchema.nullable(),
        availability: z.enum([
          "available",
          "insufficient",
          "unavailable",
          "missing",
        ]),
      }),
    )
    .max(25),
});
export type HistoryPreview = z.infer<
  typeof historyBatchSchema
>["items"][number];
