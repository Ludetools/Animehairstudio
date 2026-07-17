const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".obj": "text/plain; charset=utf-8"
};

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify(value));
}

function writeProjectFile(destination, content, callback) {
  const temporary = `${destination}.saving-${process.pid}`;
  fs.writeFile(temporary, content, "utf8", (writeError) => {
    if (writeError) {
      callback(writeError);
      return;
    }
    fs.rename(temporary, destination, (renameError) => {
      if (!renameError) {
        callback(null);
        return;
      }
      fs.unlink(destination, (unlinkError) => {
        if (unlinkError && unlinkError.code !== "ENOENT") {
          fs.unlink(temporary, () => callback(unlinkError));
          return;
        }
        fs.rename(temporary, destination, callback);
      });
    });
  });
}

function saveProjectWithNativeDialog(request, response) {
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
    if (typeof payload.content !== "string" || typeof payload.suggestedName !== "string") {
      sendJson(response, 400, { error: "Project content and filename are required" });
      return;
    }
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.SaveFileDialog",
      "$dialog.Title = 'Save Anime Hair Studio Project'",
      "$dialog.Filter = 'Anime Hair Studio Project (*.animehair.json)|*.animehair.json|JSON File (*.json)|*.json'",
      "$dialog.DefaultExt = 'animehair.json'",
      "$dialog.AddExtension = $true",
      "$dialog.FileName = $env:ANIME_HAIR_SUGGESTED_NAME",
      "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
      "  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "  Write-Output $dialog.FileName",
      "}"
    ].join("\n");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-STA", "-Command", script],
      { env: { ...process.env, ANIME_HAIR_SUGGESTED_NAME: path.basename(payload.suggestedName) }, windowsHide: true },
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
        writeProjectFile(destination, payload.content, (writeError) => {
          if (writeError) {
            sendJson(response, 500, { error: "Could not write the project file" });
            return;
          }
          sendJson(response, 200, { saved: true, fileName: path.basename(destination) });
        });
      }
    );
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end();
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { app: "anime-hair-studio", saveAs: true });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/save-project") {
    saveProjectWithNativeDialog(request, response);
    return;
  }
  const decoded = decodeURIComponent(url.pathname);
  const requested = decoded === "/" ? "/index.html" : decoded;
  const filePath = path.normalize(path.join(root, requested));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Anime Hair Studio running at http://127.0.0.1:${port}/`);
});
