// Save/Load a Project Package to/from a folder the user picks (browser).
// Uses the File System Access API; no server, no cloud — purely local in Phase 1.
// (The same folder can later live inside a cloud-synced directory for Phase 2.)
import type { PackageShards, Manifest } from "../domain/package";

export interface PackageStore {
  save(pkg: PackageShards): Promise<void>;
  load(): Promise<PackageShards>;
}

async function writeTextFile(dir: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
}

async function readTextFile(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  const fh = await dir.getFileHandle(name);
  const file = await fh.getFile();
  return file.text();
}

/** Browser implementation backed by a FileSystemDirectoryHandle (from showDirectoryPicker). */
export class FileSystemAccessPackageStore implements PackageStore {
  constructor(private dir: FileSystemDirectoryHandle) {}

  async save(pkg: PackageShards): Promise<void> {
    await writeTextFile(this.dir, "manifest.json", JSON.stringify(pkg.manifest, null, 2));
    const events = await this.dir.getDirectoryHandle("events", { create: true });
    for (const node of Object.keys(pkg.shards)) {
      await writeTextFile(events, `${node}.ndjson`, pkg.shards[node]);
    }
  }

  async load(): Promise<PackageShards> {
    const manifest = JSON.parse(await readTextFile(this.dir, "manifest.json")) as Manifest;
    const shards: Record<string, string> = {};
    const events = await this.dir.getDirectoryHandle("events");
    // @ts-expect-error: async iterator on directory handle (lib types lag the spec)
    for await (const [name, handle] of events.entries()) {
      if (name.endsWith(".ndjson") && handle.kind === "file") {
        const file = await (handle as FileSystemFileHandle).getFile();
        shards[name.replace(/\.ndjson$/, "")] = await file.text();
      }
    }
    return { manifest, shards };
  }
}
