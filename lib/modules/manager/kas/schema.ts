import { z } from 'zod';
import { Json } from '../../../util/schema-utils';

export const KasRepo = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  commit: z.string().optional(),
  branch: z.string().nullable().optional(),
  tag: z.string().nullable().optional(),
  type: z.enum(['git', 'hg']).default('git').optional(),
});

export const KasInclude = z.union([
  z.string(),
  z.object({
    repo: z.string(),
    file: z.string(),
  }),
]);

export const KasProject = z
  .object({
    header: z.object({
      version: z.number(),
      includes: z.array(KasInclude).optional(),
    }),
    repos: z.record(z.string(), KasRepo.nullable().optional()).optional(),
  })
  .catchall(z.unknown());

export const KasLockFile = z.object({
  overrides: z
    .object({
      repos: z
        .record(
          z.string(),
          z.object({
            commit: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export const KasDump = Json.pipe(
  z.object(KasProject.shape).merge(z.object(KasLockFile.shape)),
);

export type KasRepo = z.infer<typeof KasRepo>;
export type KasProject = z.infer<typeof KasProject>;
export type KasLockFile = z.infer<typeof KasLockFile>;
export type KasDump = z.infer<typeof KasDump>;
