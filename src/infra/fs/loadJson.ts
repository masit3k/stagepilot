import fs from "node:fs/promises";

const BYTE_ORDER_MARK = "﻿";

export async function loadJsonFile<T>(path: string): Promise<T> {
  const raw = await fs.readFile(path, "utf8");
  // Editory na Windows ukládají UTF-8 s BOM; JSON.parse ho neumí přeskočit.
  const text = raw.startsWith(BYTE_ORDER_MARK) ? raw.slice(1) : raw;
  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    // `cause` se přiřazuje dodatečně: desktop se překládá se starší `lib`,
    // která dvouargumentový konstruktor `Error` nezná.
    throw Object.assign(new Error(`Invalid JSON in ${path}: ${reason}`), {
      cause,
    });
  }
}
