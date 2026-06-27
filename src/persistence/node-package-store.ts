// Node implementation of PackageStore — for the verification harness and a possible
// desktop (Tauri/Electron) build. Mirrors the browser FileSystemAccessPackageStore layout.
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { PackageShards, Manifest } from "../domain/package";
import type { PackageStore } from "./package-store";

export class NodeDirectoryPackageStore implements PackageStore {
  constructor(private dir: string) {}

  async save(pkg: PackageShards): Promise<void> {
    await mkdir(join(this.dir, "events"), { recursive: true });
    await writeFile(join(this.dir, "manifest.json"), JSON.stringify(pkg.manifest, null, 2), "utf8");
    for (const node of Object.keys(pkg.shards)) {
      await writeFile(join(this.dir, "events", `${node}.ndjson`), pkg.shards[node], "utf8");
    }
  }

  async load(): Promise<PackageShards> {
    const manifest = JSON.parse(await readFile(join(this.dir, "manifest.json"), "utf8")) as Manifest;
    const shards: Record<string, string> = {};
    for (const f of await readdir(join(this.dir, "events"))) {
      if (f.endsWith(".ndjson")) {
        shards[f.replace(/\.ndjson$/, "")] = await readFile(join(this.dir, "events", f), "utf8");
      }
    }
    return { manifest, shards };
  }
}
