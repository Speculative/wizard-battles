import { DuckDBInstance } from "@duckdb/node-api";
import { readFileSync } from "node:fs";

interface Args {
  sql: string;
  format: "table" | "json";
  limit: number | null;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { sql: "", format: "table", limit: null };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.format = "json";
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a === "--file" || a === "-f") {
      out.sql = readFileSync(argv[++i], "utf8");
    } else if (a === "--stdin") {
      out.sql = readFileSync(0, "utf8");
    } else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else {
      positional.push(a);
    }
  }
  if (!out.sql && positional.length > 0) {
    out.sql = positional.join(" ");
  }
  if (!out.sql && !process.stdin.isTTY) {
    out.sql = readFileSync(0, "utf8");
  }
  return out;
}

function printHelp(): void {
  console.log(`Usage:
  npm run q -- "SELECT ..."
  npm run q -- --file query.sql
  echo "SELECT ..." | npm run q -- --stdin
  npm run q -- --json "SELECT ..."

Common helpers:
  read_json_auto('runs/<id>/events.jsonl')   -- one row per event, meta is a struct
  read_json_auto('runs/<id>/frames.jsonl')   -- one row per sampled frame
  read_json_auto('runs/*/events.jsonl', union_by_name=true)  -- all runs at once
`);
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(4);
  }
  return String(v);
}

function printTable(columnNames: string[], rows: unknown[][]): void {
  if (rows.length === 0) {
    console.log("(0 rows)");
    return;
  }
  const widths = columnNames.map((n) => n.length);
  const stringRows = rows.map((row) =>
    row.map((cell, i) => {
      const s = formatCell(cell);
      if (s.length > widths[i]) widths[i] = s.length;
      return s;
    })
  );
  const border = widths.map((w) => "-".repeat(w + 2)).join("+");
  const fmt = (cells: string[]): string =>
    cells.map((c, i) => " " + c.padEnd(widths[i] + 1)).join("|");
  console.log(fmt(columnNames));
  console.log(border);
  for (const row of stringRows) console.log(fmt(row));
  console.log(`(${rows.length} row${rows.length === 1 ? "" : "s"})`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.sql.trim()) {
    printHelp();
    process.exit(2);
  }

  const db = await DuckDBInstance.create(":memory:");
  const conn = await db.connect();
  let sql = args.sql.trim();
  if (args.limit !== null && !/\blimit\s+\d+\b/i.test(sql)) {
    sql = sql.replace(/;?\s*$/, "") + ` LIMIT ${args.limit}`;
  }

  try {
    const result = await conn.run(sql);
    const columnNames = result.columnNames();
    const rows = await result.getRows();
    if (args.format === "json") {
      const out = rows.map((r) => {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < columnNames.length; i++) obj[columnNames[i]] = r[i];
        return obj;
      });
      console.log(JSON.stringify(out, null, 2));
    } else {
      printTable(columnNames, rows);
    }
  } finally {
    conn.disconnectSync();
  }
}

main().catch((err) => {
  console.error(`duckq error: ${err.message ?? err}`);
  process.exit(1);
});
