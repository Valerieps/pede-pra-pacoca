// PreToolUse hook: refuses file edits on a checkout whose branch is `main`.
// Every change starts in its own worktree and branch (see CLAUDE.md); this makes
// that rule hold even when a session was opened on the main checkout.
// Files outside a git repository (scratchpad, memory) are never blocked.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (!target) process.exit(0);

// A new file's folder may not exist yet: check from the nearest one that does.
let dir = dirname(resolve(input.cwd ?? process.cwd(), target));
while (!existsSync(dir) && dirname(dir) !== dir) dir = dirname(dir);

let branch;
try {
  branch = execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  process.exit(0);
}

if (branch === 'main') {
  console.error(
    `Blocked: ${target} is on the main checkout. Every change starts in a new git worktree, ` +
      'on its own branch cut from origin/main (git worktree add .claude/worktrees/<name> ' +
      '-b claude/<name> origin/main), and is edited there.',
  );
  process.exit(2);
}
