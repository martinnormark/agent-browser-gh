const authEnv = {
  ...Bun.env,
  AUTH_PORT: Bun.env.AUTH_PORT ?? "3000",
  APP_ORIGIN: Bun.env.APP_ORIGIN ?? "http://localhost:3001",
};

const appEnv = {
  ...Bun.env,
  AUTH_PORT: Bun.env.AUTH_PORT ?? authEnv.AUTH_PORT,
  APP_PORT: Bun.env.APP_PORT ?? "3001",
  AUTH_ORIGIN: Bun.env.AUTH_ORIGIN ?? `http://localhost:${authEnv.AUTH_PORT}`,
};

const authServer = Bun.spawn({
  cmd: ["bun", "run", "./server-3000.ts"],
  env: authEnv,
  stdout: "inherit",
  stderr: "inherit",
});

const appServer = Bun.spawn({
  cmd: ["bun", "run", "./server-3001.ts"],
  env: appEnv,
  stdout: "inherit",
  stderr: "inherit",
});

function stopServers() {
  authServer.kill();
  appServer.kill();
}

process.on("SIGINT", () => {
  stopServers();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopServers();
  process.exit(0);
});

console.log("Starting auth server on http://localhost:" + authEnv.AUTH_PORT);
console.log("Starting app server on http://localhost:" + appEnv.APP_PORT);

const exits = await Promise.all([authServer.exited, appServer.exited]);
const exitCode = exits.find((code) => code !== 0) ?? 0;

process.exit(exitCode);
