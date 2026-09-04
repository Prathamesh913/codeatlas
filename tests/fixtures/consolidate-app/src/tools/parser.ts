// Tool-scoped parser with the same exported name.
export function parse(input: string): string[] {
  return input.split("|");
}
