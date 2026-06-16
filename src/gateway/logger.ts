import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";

export type Direction = "in" | "out" | "system";

export interface LogEntry {
  ts: string;
  server: string;
  direction: Direction;
  /** JSON-RPC method, if the message was a request/notification. */
  method?: string;
  /** JSON-RPC id, if present. Strings or numbers in JSON-RPC. */
  id?: string | number | null;
  /** True if the message is a JSON-RPC response (has result or error). */
  isResponse?: boolean;
  /** True if the response carries a JSON-RPC error. */
  isError?: boolean;
  /** Top-level param keys, captured for triage without leaking values. */
  paramKeys?: string[];
  /** Truncated raw line, only used when the message didn't parse as JSON. */
  raw?: string;
  /** Free-form message used for "system" direction entries. */
  message?: string;
  /** For responses: how long the matching request was outstanding. */
  durationMs?: number;
}

function defaultLogFile(): string {
  const home = process.env.WARDN_HOME ?? path.join(os.homedir(), ".wardn");
  return path.join(home, "gateway.log");
}

/**
 * Append-only NDJSON event log. Emits `entry` for every line written so
 * in-process subscribers (the daemon) can stream events without tailing the
 * file. Cross-process consumers must tail the file directly.
 */
export class Logger extends EventEmitter {
  private readonly file: string;
  private stream?: fs.WriteStream;

  constructor(file?: string) {
    super();
    this.file = file ?? defaultLogFile();
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
  }

  append(entry: LogEntry): void {
    if (!this.stream) {
      this.stream = fs.createWriteStream(this.file, { flags: "a" });
    }
    this.stream.write(JSON.stringify(entry) + "\n");
    this.emit("entry", entry);
  }

  filePath(): string {
    return this.file;
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.stream) {
        resolve();
        return;
      }
      this.stream.end(() => resolve());
      this.stream = undefined;
    });
  }
}
