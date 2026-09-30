// Bootstrap the FIRST Super Admin. Explicit owner action only.
//
// Usage:
//   corepack pnpm db:bootstrap -- --email owner@example.com [--password "..."]
//   BOOTSTRAP_ADMIN_EMAIL=owner@example.com BOOTSTRAP_ADMIN_PASSWORD="..." corepack pnpm db:bootstrap
//
// Rules:
// - Email is required (arg or env). Password may come from env/arg; when
//   absent, the script prompts on stdin (not echoed where supported).
// - Idempotent: if the user exists, it is activated (ACTIVE) and granted
//   SUPER_ADMIN; nothing is duplicated.
// - Refuses weak/missing credentials. Never prints passwords or hashes.
// - Creates NO demo data. Run `db:seed` first so roles exist.
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline';
import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../lib/core/password';
import {
  isValidEmail,
  normalizeEmail,
  validatePasswordStrength,
} from '../lib/core/validation';

const db = new PrismaClient();

// pnpm forwards a bare `--` separator into argv
// (tsx scripts/bootstrap-admin.ts "--" "--email" "..."), so ignore it.
const CLI_ARGS = process.argv.slice(2).filter((arg) => arg !== '--');

function argValue(flag: string): string | undefined {
  const index = CLI_ARGS.indexOf(flag);
  const value = index >= 0 ? CLI_ARGS[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : undefined;
}

const PASSWORD_PROMPT = 'Bootstrap admin password (6-8 chars): ';

// Secure interactive prompt: typed characters are masked with `*` and the
// password never appears on screen. Uses stdin raw mode (supported by
// Windows PowerShell / Windows Terminal / conhost and POSIX terminals).
// No CLI framework, no new dependencies. When stdin is NOT a TTY
// (piped automation), falls back to a single line read with echo disabled.
async function promptPassword(): Promise<string> {
  if (!input.isTTY) {
    const rl = createInterface({ input, output, terminal: false });
    return new Promise((resolve) => {
      rl.question(PASSWORD_PROMPT, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
  return new Promise((resolve) => {
    output.write(PASSWORD_PROMPT);
    let password = '';
    input.setRawMode(true);
    input.resume();
    const onData = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      if (text === '\r' || text === '\n' || text === '') {
        input.setRawMode(false);
        input.pause();
        input.removeListener('data', onData);
        output.write('\n');
        resolve(password);
      } else if (text === '') {
        output.write('\n');
        process.exit(130);
      } else if (text === '' || text === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          output.write('\b \b');
        }
      } else if (
        text.length === 1 &&
        text >= ' ' &&
        !text.startsWith('') &&
        password.length < 256
      ) {
        password += text;
        output.write('*');
      }
      // All other control/escape sequences are ignored.
    };
    input.on('data', onData);
  });
}

async function main(): Promise<void> {
  const emailRaw =
    argValue('--email') ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? '';
  const email = emailRaw.trim();
  if (!isValidEmail(email)) {
    console.error(
      'Refusing: set a valid --email or BOOTSTRAP_ADMIN_EMAIL.',
    );
    process.exitCode = 2;
    return;
  }
  let password =
    argValue('--password') ?? process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
  if (!password) {
    password = (await promptPassword()).trim();
  }
  const weakness = validatePasswordStrength(password);
  if (weakness) {
    console.error(`Refusing: ${weakness}`);
    process.exitCode = 2;
    return;
  }
  const role = await db.role.findUnique({ where: { key: 'SUPER_ADMIN' } });
  if (!role) {
    console.error('Refusing: SUPER_ADMIN role missing. Run db:seed first.');
    process.exitCode = 2;
    return;
  }
  const emailNormalized = normalizeEmail(email);
  const passwordHash = await hashPassword(password);
  const user = await db.user.upsert({
    where: { emailNormalized },
    update: {
      email,
      passwordHash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      emailNormalized,
      passwordHash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    select: { id: true, email: true },
  });
  await db.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id, assignedBy: 'bootstrap' },
  });
  console.log(`Super Admin ready: ${user.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
