type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const decoder = new TextDecoder();
const WEB_URL = Bun.env.WEB_URL ?? "http://localhost:3001";
const EMAIL = Bun.env.HARNESS_TEST_EMAIL ?? "harness@test.local";
const PASSWORD = Bun.env.HARNESS_TEST_PASSWORD ?? "harness-test-password";
const EVIDENCE_DIR = Bun.env.EVIDENCE_DIR ?? "evidence/auth";
let AGENT_BROWSER_BIN = "agent-browser";

async function resolveAgentBrowserBin(): Promise<string> {
  if (Bun.env.AGENT_BROWSER_BIN) {
    return Bun.env.AGENT_BROWSER_BIN;
  }

  const localBinary = "./node_modules/.bin/agent-browser";
  if (await Bun.file(localBinary).exists()) {
    return localBinary;
  }

  return "agent-browser";
}
function decode(output: Uint8Array | null | undefined): string {
  return decoder.decode(output ?? new Uint8Array()).replaceAll("\r", "");
}

function runAgentBrowser(label: string, args: string[], allowFailure = false): CommandResult {
  console.error(`  [${label}] ${args.join(" ")}`);

  const proc = Bun.spawnSync({
    cmd: [AGENT_BROWSER_BIN, ...args],
    stdout: "pipe",
    stderr: "pipe",
  });

  const result: CommandResult = {
    exitCode: proc.exitCode,
    stdout: decode(proc.stdout),
    stderr: decode(proc.stderr),
  };

  if (!allowFailure && result.exitCode !== 0) {
    const details = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
    throw new Error(`agent-browser command failed: ${args.join(" ")}${details ? `\n${details}` : ""}`);
  }

  return result;
}

function run(label: string, ...args: string[]): void {
  runAgentBrowser(label, args);
}

function runCapture(label: string, ...args: string[]): string {
  return runAgentBrowser(label, args).stdout;
}

function tryRun(label: string, ...args: string[]): boolean {
  return runAgentBrowser(label, args, true).exitCode === 0;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function hasErrorToast(snapshot: string): boolean {
  const normalized = snapshot.toLowerCase();
  const mentionsError =
    normalized.includes("error") || normalized.includes("failed") || normalized.includes("invalid");
  const looksToast =
    normalized.includes('role="alert"') ||
    normalized.includes("toast") ||
    normalized.includes("something went wrong");

  return mentionsError && looksToast;
}

function trimUrl(value: string): string {
  return value.trim().replace(/^"/, "").replace(/"$/, "");
}

function fillFirst(label: string, value: string, selectors: string[]): void {
  for (const selector of selectors) {
    if (tryRun(`${label}: ${selector}`, "fill", selector, value)) {
      return;
    }
  }

  throw new Error(`Unable to fill ${label} using selectors: ${selectors.join(", ")}`);
}

function clickFirst(label: string, selectors: string[]): void {
  for (const selector of selectors) {
    if (tryRun(`${label}: ${selector}`, "click", selector)) {
      return;
    }
  }

  throw new Error(`Unable to click ${label} using selectors: ${selectors.join(", ")}`);
}

function ensureDir(path: string): void {
  const proc = Bun.spawnSync({
    cmd: ["mkdir", "-p", path],
    stdout: "ignore",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    throw new Error(`Failed to create directory ${path}: ${decode(proc.stderr).trim()}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFile(path: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const file = Bun.file(path);
    if (await file.exists() && file.size > 0) {
      return true;
    }

    await sleep(250);
  }

  return false;
}

async function getFileSize(path: string): Promise<number> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return 0;
  }

  return file.size;
}

async function main(): Promise<void> {
  ensureDir(EVIDENCE_DIR);
  AGENT_BROWSER_BIN = await resolveAgentBrowserBin();

  const normalizedWebUrl = WEB_URL.replace(/\/$/, "");
  const videoPath = `${EVIDENCE_DIR}/recording.webm`;
  const loginUrl = `${normalizedWebUrl}/login`;

  console.log("=== Auth Browser Test ===");
  console.log(`URL: ${WEB_URL}`);
  console.log(`Evidence dir: ${EVIDENCE_DIR}`);

  try {
    run("start recording", "record", "start", videoPath);
    run("start HAR", "network", "har", "start");

    console.log("\n--- Step 0: Capture initial browser state ---");
    const initialCookies = runCapture("initial cookies", "cookies", "get");
    console.log(`Initial cookies:\n${initialCookies}`);
    run("save initial state", "state", "save", `${EVIDENCE_DIR}/state-initial.json`);

    console.log("\n--- Step 1: Open /login ---");
    run("navigate", "open", loginUrl);
    run("wait for load", "wait", "--load", "networkidle");
    run("settle", "wait", "2000");
    run("screenshot login", "screenshot", `${EVIDENCE_DIR}/login-form.png`);

    console.log("\n--- Step 2: Verify form fields ---");
    const loginSnapshot = runCapture("snapshot login", "snapshot", "-i");
    const loginSnapshotLower = loginSnapshot.toLowerCase();
    assert(loginSnapshotLower.includes("email"), "Expected email field on login page");
    assert(loginSnapshotLower.includes("password"), "Expected password field on login page");
    assert(!hasErrorToast(loginSnapshot), "Unexpected error toast on login page");

    console.log("\n--- Step 3: Sign in ---");
    fillFirst("fill email", EMAIL, ["#email", "input[type=email]", "input[name=email]", "input[autocomplete=email]"]);
    fillFirst("fill password", PASSWORD, [
      "#password",
      "input[type=password]",
      "input[name=password]",
      "input[autocomplete=current-password]",
    ]);
    clickFirst("submit", ["button[type=submit]", "form button", "button"]);
    run("wait for redirect", "wait", "8000");

    const urlAfterLogin = trimUrl(runCapture("current url", "get", "url"));
    const cookiesAfterLogin = runCapture("cookies after sign-in", "cookies", "get");
    const consoleAfterLogin = runCapture("console after sign-in", "console");
    const pageErrors = runCapture("page errors", "errors");
    const requests = runCapture("network requests", "network", "requests");
    const postLoginSnapshot = runCapture("snapshot after sign-in", "snapshot", "-i");

    console.log(`URL after sign-in: ${urlAfterLogin}`);
    console.log(`Cookies after sign-in:\n${cookiesAfterLogin}`);
    console.log(`Console after sign-in:\n${consoleAfterLogin}`);
    console.log(`Page errors:\n${pageErrors}`);
    console.log(`Network requests:\n${requests}`);
    console.log(`Page after sign-in:\n${postLoginSnapshot}`);

    run("screenshot post-login", "screenshot", `${EVIDENCE_DIR}/post-login-redirect.png`);
    run("save state after sign-in", "state", "save", `${EVIDENCE_DIR}/state-after-signin.json`);

    const debugCookiesUrl = `${normalizedWebUrl}/api/debug/cookies`;
    if (tryRun("open debug cookies", "open", debugCookiesUrl)) {
      run("wait for debug cookies load", "wait", "--load", "networkidle");
      const debugCookiesSnapshot = runCapture("snapshot debug cookies", "snapshot", "-i");
      console.log(`Debug cookies page:\n${debugCookiesSnapshot}`);
      run("screenshot debug cookies", "screenshot", `${EVIDENCE_DIR}/debug-cookies.png`);
      run("return to post-login url", "open", urlAfterLogin);
      run("wait after return", "wait", "--load", "networkidle");
    } else {
      console.log(`Debug cookies page not available at ${debugCookiesUrl}`);
    }

    console.log("\n--- Step 4: Verify authenticated redirect ---");
    assert(!urlAfterLogin.includes("/login"), `Expected redirect away from /login after sign-in, got ${urlAfterLogin}`);
    assert(!hasErrorToast(postLoginSnapshot), "Unexpected error toast after sign-in");

    console.log("\n--- Step 5: Clear cookies ---");
    run("clear cookies", "cookies", "clear");
    run("settle after clear", "wait", "1000");

    console.log("\n--- Step 6: Verify logged-out redirect ---");
    run("reload", "reload");
    run("wait for auth redirect", "wait", "5000");

    const urlAfterLogout = trimUrl(runCapture("url after clear", "get", "url"));
    const cookiesAfterLogout = runCapture("cookies after clear", "cookies", "get");
    const postLogoutSnapshot = runCapture("snapshot after clear", "snapshot", "-i");

    run("screenshot post-logout", "screenshot", `${EVIDENCE_DIR}/post-logout-redirect.png`);
    run("save state after logout", "state", "save", `${EVIDENCE_DIR}/state-after-logout.json`);

    console.log(`Cookies after clear:\n${cookiesAfterLogout}`);

    assert(urlAfterLogout.includes("/login"), `Expected redirect to /login after clearing session, got ${urlAfterLogout}`);
    assert(!hasErrorToast(postLogoutSnapshot), "Unexpected error toast after logout redirect");

    console.log("\n=== PASSED: Auth flow works ===");
  } finally {
    tryRun("save HAR", "network", "har", "stop", `${EVIDENCE_DIR}/network.har`);
    tryRun("stop recording", "record", "stop");
    const recordingReady = await waitForFile(videoPath, 5000);
    if (recordingReady) {
      console.log(`Recording saved: ${videoPath} (${await getFileSize(videoPath)} bytes)`);
    } else {
      console.log(`Recording not found after stop: ${videoPath}`);
    }
    tryRun("close browser", "close");
  }
}

main().then(() => {
  console.log("All done!");
  process.exit(0);
})
.catch((error) => {
  console.error("=== TEST FAILED ===");
  console.error(error);
  process.exit(1);
});
