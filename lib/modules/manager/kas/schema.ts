import { z } from 'zod';

// Schema of defintion of KAS project files see, https://kas.readthedocs.io/en/latest/userguide/project-configuration.html

/*
const KasDefaults = z.object({
  repos: z
    .object({
      branch: z.string().optional(),
      tag: z.string().optional(),
    })
    .optional(),
});
*/

export const KasRepo = z.object({
  name: z.string().optional(),

  url: z.string().optional(),
  commit: z.string().optional(),
  branch: z.string().optional(),
  tag: z.string().optional(),
});

export const KasProject = z
  .object({
    header: z.object({ version: z.number() }),
    //defaults: KasDefaults.optional(), // TODO: Not implemented yet
    repos: z.record(KasRepo),
  })
  .catchall(z.unknown());

export type KasProject = z.infer<typeof KasProject>;
export type KasRepo = z.infer<typeof KasRepo>;
