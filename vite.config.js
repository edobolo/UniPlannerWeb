import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Custom plugin to reliably serve large binary .exe downloads with proper attachment headers
function serveExeDownloads() {
  const handleFileDownload = (req, res, next, baseDir) => {
    if (req.url && req.url.startsWith('/downloads/')) {
      const cleanUrl = req.url.split('?')[0];
      const fileName = path.basename(cleanUrl);
      const filePath = path.resolve(process.cwd(), baseDir, fileName);
      
      if (fs.existsSync(filePath)) {
        try {
          const stat = fs.statSync(filePath);
          const totalSize = stat.size;
          const range = req.headers.range;

          if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
            const chunkSize = (end - start) + 1;

            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${fileName}"`,
              'Cache-Control': 'no-cache',
            });

            const stream = fs.createReadStream(filePath, { start, end });
            stream.pipe(res);
            stream.on('error', (err) => {
              console.error('Download stream error:', err);
              if (!res.headersSent) res.writeHead(500);
              res.end();
            });
            return;
          } else {
            res.writeHead(200, {
              'Content-Length': totalSize,
              'Accept-Ranges': 'bytes',
              'Content-Type': 'application/octet-stream',
              'Content-Disposition': `attachment; filename="${fileName}"`,
              'Cache-Control': 'no-cache',
            });

            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
            stream.on('error', (err) => {
              console.error('Download stream error:', err);
              if (!res.headersSent) res.writeHead(500);
              res.end();
            });
            return;
          }
        } catch (e) {
          console.error('Error serving download:', e);
        }
      }
    }
    next();
  };

  return {
    name: 'serve-exe-downloads',
    configureServer(server) {
      server.middlewares.use((req, res, next) => handleFileDownload(req, res, next, 'public/downloads'));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => handleFileDownload(req, res, next, 'dist/downloads'));
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), serveExeDownloads()],
})
