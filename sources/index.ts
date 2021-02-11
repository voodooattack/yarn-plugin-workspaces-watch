import {
  CommandContext,
  Configuration,
  Manifest,
  MessageName,
  Plugin,
  Project,
  StreamReport,
  Workspace
} from '@yarnpkg/core';
import {Command} from 'clipanion';
import {Filename, PortablePath, ppath, Watcher, xfs} from "@yarnpkg/fslib";
import {stringifyIdent} from "@yarnpkg/core/lib/structUtils";
import {split as cmdSplit} from "split-cmd";
import * as process from "process";
import {convertPath} from "@yarnpkg/fslib/lib/path";

function getManifestPath(ws: Workspace, fileName: Filename = Filename.manifest) {
  return ppath.join(ws.cwd, fileName);
}

class WorkspacesWatch extends Command<CommandContext> {
  static usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `Watch for changes in all workspaces. Installing, updating, and removing packages on demand`,
    details: `
      This command is similar to \`yarn install\`, but it doesn't exit and keeps watching for any changes to ${Manifest.fileName} files, updating project dependencies as necessary.
    `,
    examples: [[
      `Watch all workspaces`,
      `$0 workspaces watch`,
    ], [
      `Run a command after every update in the affected workspace's directory`,
      `$0 workspaces watch --exec "echo Hello world!"`,
    ]]
  });

  @Command.Boolean("--json", {description: "Format the output as an NDJSON stream"})
  json!: boolean;

  @Command.Boolean("--inline-builds", {
    description: "Verbosely print the output of the build steps of dependencies"
  })
  inlineBuilds!: boolean;

  @Command.Boolean("--skip-builds", {description: "Skip the build step altogether"})
  skipBuilds!: boolean;

  @Command.String("--exec", {description: "Command to execute on changes"})
  exec?: string;

  @Command.String("--pid-file", {description: "PID file to use"})
  pidFile?: string;

  proxied: string[] = [];

  report!: StreamReport;
  watchList: Map<PortablePath, {
    watcher: Watcher,
    workspace: Workspace,
    timeout: NodeJS.Timeout | null
  }> = new Map();

  @Command.Path("workspaces", "watch")
  execute() {
    if (this.pidFile) {
      const p = convertPath(ppath, this.pidFile);
      if (xfs.existsSync(p)) {
        throw new Error(`A workspaces watch is already running. PID file ${p} already exists.`);
      }
      xfs.writeFileSync(p, process.pid.toString());
    }
    if (this.json)
      this.proxied.push("--json");
    if (this.inlineBuilds)
      this.proxied.push("--inline-builds");
    if (this.skipBuilds)
      this.proxied.push("--skip-builds");
    this.setupSignals();
    return this.start();
  }

  setupSignals() {
    let exiting = false;
    const handleSignal = (signal) => {
      if (exiting) return;
      exiting = true;
      this.clearWatches();
      if (this.report)
        this.report.reportInfo(MessageName.UNNAMED, `Received ${signal}, exiting gracefully.`);
      if (this.pidFile)
        xfs.unlinkSync(convertPath(ppath, this.pidFile));
      process.exit(0);
    }
    process.on("SIGTERM", handleSignal);
    process.on("SIGINT", handleSignal);
  }

  runInstall(workspace: Workspace) {
    return xfs.lockPromise(getManifestPath(workspace.project.topLevelWorkspace, Filename.lockfile), async () => {
      await this.cli.run(["workspace",
        stringifyIdent(workspace.manifest.name!),
        "install", ...this.proxied], this.context);
    }).then(async () => {
      if (this.exec)
        await this.cli.run(["workspace",
          stringifyIdent(workspace.manifest.name!), "exec", ...cmdSplit(this.exec)]);
    }).catch(e => {
      this.report.reportError(MessageName.EXCEPTION, e.message);
    });
  }

  async onWatch(workspace: Workspace, manifestPath: PortablePath, eventType: string, filename: string) {
    const watchEntry = this.watchList.get(manifestPath);
    if (!watchEntry)
      return;
    if (!xfs.existsSync(manifestPath)) {
      watchEntry.watcher.close();
      this.watchList.delete(manifestPath);
      this.report.reportInfo(MessageName.UNNAMED, `Workspace closed: ${manifestPath}`);
      return;
    }
    if (watchEntry.timeout)
      clearTimeout(watchEntry.timeout);
    else
      this.report.reportInfo(MessageName.UNNAMED, `Workspace changed ${workspace.cwd}`);
    watchEntry.timeout = setTimeout(() => {
      this.runInstall(workspace).finally(() => {
        this.report.reportInfo(MessageName.UNNAMED, `Workspace updated ${workspace.cwd}`);
        watchEntry.timeout = null;
      });
    }, 300);
  };

  createWatchCallback(workspace: Workspace, manifestPath: PortablePath) {
    return (eventType: string, filename: string) =>
      this.onWatch(workspace, manifestPath, eventType, filename);
  }

  addWorkspace(workspace: Workspace) {
    const manifestPath = getManifestPath(workspace);
    this.report.reportInfo(MessageName.UNNAMED, `Watching workspace: ${stringifyIdent(workspace.manifest.name!)}`);
    const watcher = xfs.watch(manifestPath, this.createWatchCallback(workspace, manifestPath));
    this.watchList.set(manifestPath, {workspace, watcher, timeout: null});
  }

  clearWatches() {
    for (const [, entry] of this.watchList) {
      entry.watcher.close();
      if (entry.timeout)
        clearTimeout(entry.timeout);
      entry.timeout = null;
    }
    this.watchList.clear();
  }

  async addProject(project: Project, configuration: Configuration) {
    this.clearWatches();
    await this.runInstall(project.topLevelWorkspace);
    for (const ws of project.workspaces) {
      const manifestPath = ppath.join(ws.cwd, Manifest.fileName);
      if (xfs.existsSync(manifestPath)) {
        this.addWorkspace(ws);
      }
    }
  }

  async start() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);
    await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
      includeLogs: true,
    }, async (report: StreamReport) => {
      this.report = report;
      report.reportInfo(MessageName.UNNAMED, `Starting in watch mode: ${
        stringifyIdent(project.topLevelWorkspace.manifest.name!)}`);
      await this.addProject(project, configuration);
    });
  }

}

const WatchPluginDesc: Plugin = {
  commands: [
    WorkspacesWatch,
  ],
};

export default WatchPluginDesc;
