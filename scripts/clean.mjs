import { rm } from "node:fs/promises";
// Clean before TypeScript emits: stale artifacts must never leak into publication.
await rm("dist", { recursive: true, force: true });
