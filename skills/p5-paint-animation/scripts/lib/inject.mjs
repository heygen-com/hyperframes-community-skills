const NAME = /^[A-Z][A-Z0-9_]*$/;
const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

function splitAssignments(raw) {
  const assignments = [];
  let current = "";
  let quoted = false;
  let escaped = false;

  for (const char of raw) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (quoted && char === "\\") {
      current += char;
      escaped = true;
    } else if (char === '"') {
      current += char;
      quoted = !quoted;
    } else if (char === ";" && !quoted) {
      if (current.trim()) assignments.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (quoted) throw new Error("--inject contains an unterminated string");
  if (current.trim()) assignments.push(current.trim());
  return assignments;
}

function parseValue(raw) {
  if (raw.startsWith('"')) {
    if (!raw.endsWith('"')) throw new Error("--inject contains an invalid string");
    return JSON.parse(raw);
  }
  if (NUMBER.test(raw)) return Number(raw);
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error("--inject values must be JSON strings, numbers, or booleans");
}

export function buildInjectDeclarations(raw) {
  if (!raw) return "";

  return splitAssignments(raw)
    .map((assignment) => {
      const separator = assignment.indexOf("=");
      if (separator < 1) throw new Error(`invalid --inject assignment: ${assignment}`);

      const name = assignment.slice(0, separator).trim();
      if (!NAME.test(name)) throw new Error(`invalid --inject name: ${name}`);

      const value = parseValue(assignment.slice(separator + 1).trim());
      return `var ${name} = ${JSON.stringify(value)};`;
    })
    .join("\n");
}
