const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { writeProjectFile } = require("./server/write-project.cjs");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ahs": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".obj": "text/plain; charset=utf-8"
};

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(value));
}

function saveFileWithNativeDialog(request, response) {
  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 50 * 1024 * 1024) request.destroy();
  });
  request.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      sendJson(response, 400, { error: "Invalid project payload" });
      return;
    }
    if (typeof payload?.content !== "string" || typeof payload?.suggestedName !== "string") {
      sendJson(response, 400, { error: "Project content and filename are required" });
      return;
    }
    const exportKind = ["obj", "usda"].includes(payload.kind) ? payload.kind : "project";
    const dialogFilter = exportKind === "obj"
      ? "Wavefront OBJ (*.obj)|*.obj|All Files (*.*)|*.*"
      : exportKind === "usda"
        ? "Universal Scene Description ASCII (*.usda)|*.usda|All Files (*.*)|*.*"
      : "Anime Hair Studio Project (*.ahs)|*.ahs|Legacy Anime Hair Project (*.animehair.json)|*.animehair.json|JSON File (*.json)|*.json";
    const defaultExtension = exportKind === "project"
      ? "ahs"
      : exportKind;
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -Namespace AnimeHairStudio -Name NativeWindow -MemberDefinition '[System.Runtime.InteropServices.DllImport(\"user32.dll\", CharSet=System.Runtime.InteropServices.CharSet.Unicode)] public static extern System.IntPtr FindWindow(string className, string windowName); [System.Runtime.InteropServices.DllImport(\"user32.dll\")] public static extern bool ShowWindow(System.IntPtr window, int command); [System.Runtime.InteropServices.DllImport(\"user32.dll\")] public static extern bool SetWindowPos(System.IntPtr window, System.IntPtr insertAfter, int x, int y, int width, int height, uint flags); [System.Runtime.InteropServices.DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(System.IntPtr window); public static void RaiseSaveDialog() { System.IntPtr window = FindWindow(null, \"Save Anime Hair Studio File\"); if (window == System.IntPtr.Zero) return; ShowWindow(window, 9); SetWindowPos(window, new System.IntPtr(-1), 0, 0, 0, 0, 0x0043); SetForegroundWindow(window); }'",
      "$dialog = New-Object System.Windows.Forms.SaveFileDialog",
      "$dialog.Title = 'Save Anime Hair Studio File'",
      "$dialog.Filter = $env:ANIME_HAIR_FILE_FILTER",
      "$dialog.DefaultExt = $env:ANIME_HAIR_DEFAULT_EXTENSION",
      "$dialog.AddExtension = $true",
      "$dialog.RestoreDirectory = $true",
      "$dialog.FileName = $env:ANIME_HAIR_SUGGESTED_NAME",
      "$owner = New-Object System.Windows.Forms.Form",
      "$owner.Text = 'Anime Hair Studio'",
      "$owner.ShowInTaskbar = $false",
      "$owner.TopMost = $true",
      "$owner.Opacity = 0",
      "$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen",
      "$owner.Size = New-Object System.Drawing.Size(1, 1)",
      "$raiseTimer = New-Object System.Windows.Forms.Timer",
      "$raiseTimer.Interval = 100",
      "$raiseTimer.Add_Tick({ [AnimeHairStudio.NativeWindow]::RaiseSaveDialog() })",
      "try {",
      "  $owner.Show()",
      "  $owner.Activate()",
      "  $raiseTimer.Start()",
      "  if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {",
      "    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "    Write-Output $dialog.FileName",
      "  }",
      "} finally {",
      "  $raiseTimer.Stop()",
      "  $raiseTimer.Dispose()",
      "  $owner.Close()",
      "  $owner.Dispose()",
      "  $dialog.Dispose()",
      "}"
    ].join("\n");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-STA", "-Command", script],
      {
        env: {
          ...process.env,
          ANIME_HAIR_SUGGESTED_NAME: path.basename(payload.suggestedName),
          ANIME_HAIR_FILE_FILTER: dialogFilter,
          ANIME_HAIR_DEFAULT_EXTENSION: defaultExtension
        },
        windowsHide: true
      },
      (error, stdout) => {
        if (error) {
          sendJson(response, 500, { error: "Could not open the Save As dialog" });
          return;
        }
        const destination = stdout.trim();
        if (!destination) {
          sendJson(response, 200, { saved: false, cancelled: true });
          return;
        }
        writeProjectFile(destination, payload.content).then(() => {
          sendJson(response, 200, { saved: true, fileName: path.basename(destination) });
        }, (writeError) => {
          sendJson(response, 500, {
            error: writeError.recoveryPath
              ? `Could not replace the selected file. Recovery copy: ${writeError.recoveryPath}`
              : "Could not write the selected file; the existing file was not removed."
          });
        });
      }
    );
  });
}

function createAppServer({ rootDirectory = root, saveHandler = saveFileWithNativeDialog } = {}) {
  const server = http.createServer((request, response) => {
    const listeningPort = server.address()?.port;
    const allowedHosts = new Set([`127.0.0.1:${listeningPort}`, `localhost:${listeningPort}`]);
    if (!allowedHosts.has(request.headers.host)) {
      sendJson(response, 403, { error: "Invalid local host" });
      return;
    }
    const origin = request.headers.origin;
    if (origin && ![...allowedHosts].some((host) => origin === `http://${host}`)) {
      sendJson(response, 403, { error: "Open Anime Hair Studio through its local launcher to use this service." });
      return;
    }
    if (origin) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }
    let url, decoded;
    try {
      url = new URL(request.url, `http://${request.headers.host}`);
      decoded = decodeURIComponent(url.pathname);
      if (decoded.includes("\0")) throw new Error("Invalid path");
    } catch {
      sendJson(response, 400, { error: "Invalid URL" });
      return;
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      response.end();
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { app: "anime-hair-studio", saveAs: true, usdaExport: true });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/save-project") {
      saveHandler(request, response);
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    const requested = decoded === "/" ? "/index.html" : decoded;
    const filePath = path.resolve(rootDirectory, `.${requested}`);
    const relative = path.relative(rootDirectory, filePath);
    const publicRootFiles = new Set(["index.html", "app.js", "styles.css", "favicon.svg"]);
    const publicDirectory = ["modules", "assets"].includes(relative.split(path.sep)[0]);

    if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)
      || relative.split(path.sep).some((part) => part.startsWith("."))
      || (!publicDirectory && !publicRootFiles.has(relative))) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.realpath(filePath, (realError, realPath) => {
      const realRelative = !realError && path.relative(rootDirectory, realPath);
      if (realError || path.isAbsolute(realRelative) || realRelative === ".." || realRelative.startsWith(`..${path.sep}`)) {
        response.writeHead(realError ? 404 : 403);
        response.end("Not found");
        return;
      }
      fs.readFile(realPath, (error, data) => {
        if (error) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }
        response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
        response.end(request.method === "HEAD" ? undefined : data);
      });
    });
  });
  return server;
}

if (require.main === module) {
  const server = createAppServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Anime Hair Studio running at http://127.0.0.1:${port}/`);
  });
}
module.exports = { createAppServer };
