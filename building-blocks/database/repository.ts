// repository.ts — Generic typed repository helper over a Prisma model delegate.
// Dest: src/lib/db/repository.ts
//
// Usage:
//   import { prisma } from "./client";
//   import { createRepository } from "./repository";
//   const users = createRepository(prisma.user);
//   const all = await users.list();
//   const one = await users.findById("ckxyz...");
//   const created = await users.create({ email, passwordHash });

/**
 * Minimal structural type describing the subset of a Prisma model delegate
 * (e.g. `prisma.user`) that this repository relies on. Generic over the model
 * entity `T`, the create input `C` and the update input `U`.
 */
interface PrismaDelegate<T, C, U> {
  findMany: (args?: { skip?: number; take?: number }) => Promise<T[]>;
  findUnique: (args: { where: { id: string } }) => Promise<T | null>;
  create: (args: { data: C }) => Promise<T>;
  update: (args: { where: { id: string }; data: U }) => Promise<T>;
  delete: (args: { where: { id: string } }) => Promise<T>;
}

export interface Repository<T, C, U> {
  list: (options?: { skip?: number; take?: number }) => Promise<T[]>;
  findById: (id: string) => Promise<T | null>;
  create: (data: C) => Promise<T>;
  update: (id: string, data: U) => Promise<T>;
  delete: (id: string) => Promise<T>;
}

/**
 * Wrap a Prisma model delegate in a small, uniform CRUD interface.
 * The entity, create-input and update-input types are inferred from the
 * delegate, so call sites stay fully typed without any `any`.
 */
export function createRepository<T, C, U>(
  delegate: PrismaDelegate<T, C, U>,
): Repository<T, C, U> {
  return {
    list: (options) => delegate.findMany(options),
    findById: (id) => delegate.findUnique({ where: { id } }),
    create: (data) => delegate.create({ data }),
    update: (id, data) => delegate.update({ where: { id }, data }),
    delete: (id) => delegate.delete({ where: { id } }),
  };
}
