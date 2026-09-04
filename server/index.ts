import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

// NOTE: For any future API routes, always validate and sanitize user input.
// Use server-side validation in addition to any client-side checks.


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from the Vite build output
  const staticPath = path.resolve(__dirname, "..", "dist");

  // Set caching headers for static assets (but not for index.html)
  app.use((req, res, next) => {
    const ext = path.extname(req.path).toLowerCase();
    if (req.path === "/" || req.path === "/index.html") {
      res.setHeader("Cache-Control", "no-cache");
    } else if (
      [".js", ".css", ".svg", ".glb", ".png", ".jpg", ".jpeg", ".gif", ".woff", ".woff2", ".ico"].includes(ext)
    ) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    next();
  });

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    const indexPath = path.join(staticPath, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(500).send("Server error: index.html not found");
      }
    });
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  const shutdown = () => {
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch(console.error);
