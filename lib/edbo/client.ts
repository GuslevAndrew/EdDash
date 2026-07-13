import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { EDBO_BASE_URL, EDBO_USER_AGENT } from "./constants";
import type { ApiProbeResult } from "./types";

type RequestOptions = {
  params?: Record<string, string | undefined>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  saveRawTo?: string;
};

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const url = new URL(path, EDBO_BASE_URL);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detectKind(contentType: string | null, rawText: string): ApiProbeResult["kind"] {
  const lower = contentType?.toLowerCase() ?? "";
  const trimmed = rawText.trimStart();
  if (lower.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (lower.includes("html") || trimmed.startsWith("<!doctype") || trimmed.startsWith("<html")) return "html";
  if (lower.startsWith("text/") || rawText.length > 0) return "text";
  return "binary";
}

export async function probeEdbo(path: string, options: RequestOptions = {}): Promise<ApiProbeResult> {
  const url = buildUrl(path, options.params);
  const timeoutMs = options.timeoutMs ?? 12_000;
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 1_000;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": EDBO_USER_AGENT,
          Accept: "application/json,text/plain,*/*"
        },
        signal: controller.signal
      });
      const rawText = await response.text();
      const contentType = response.headers.get("content-type");
      const kind = detectKind(contentType, rawText);
      let body: unknown = rawText;

      if (kind === "json") {
        try {
          body = JSON.parse(rawText);
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Невалідний JSON";
          body = rawText;
        }
      }

      const result: ApiProbeResult = {
        url,
        status: response.status,
        ok: response.ok && kind === "json",
        contentType,
        durationMs: Math.round(performance.now() - started),
        kind,
        body,
        rawText,
        errorMessage: response.ok ? lastError : `HTTP ${response.status}`
      };

      if (options.saveRawTo) {
        await mkdir(options.saveRawTo, { recursive: true });
        const extension = kind === "json" ? "json" : kind === "html" ? "html" : "txt";
        const safeName = new URL(url).pathname.replace(/\W+/g, "-").replace(/^-|-$/g, "");
        await writeFile(
          join(options.saveRawTo, `${Date.now()}-${safeName}.${extension}`),
          kind === "json" ? JSON.stringify(body, null, 2) : rawText,
          "utf8"
        );
      }

      if (result.ok || attempt === retries) return result;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Невідома помилка запиту";
      if (attempt === retries) {
        return {
          url,
          status: null,
          ok: false,
          contentType: null,
          durationMs: Math.round(performance.now() - started),
          kind: "error",
          body: null,
          rawText: "",
          errorMessage: lastError
        };
      }
    } finally {
      clearTimeout(timeout);
    }

    await delay(retryDelayMs);
  }

  throw new Error("Недосяжний стан клієнта ЄДЕБО");
}

export async function fetchEdboJson(path: string, options: RequestOptions = {}): Promise<unknown> {
  const result = await probeEdbo(path, options);
  if (!result.ok) {
    throw new Error(result.errorMessage ?? "ЄДЕБО не повернув коректний JSON");
  }
  return result.body;
}

export async function fetchEdboSpreadsheetRows(path: string, options: RequestOptions = {}): Promise<Record<string, unknown>[]> {
  const url = buildUrl(path, options.params);
  const timeoutMs = options.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": EDBO_USER_AGENT,
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], { defval: "" });
  } finally {
    clearTimeout(timeout);
  }
}
