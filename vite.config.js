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
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    // Terser: minificazione più aggressiva di esbuild (rimuove console.log in prod, comprime meglio)
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,    // Rimuove tutti i console.log/warn in produzione
        drop_debugger: true,
        passes: 2,             // Due passaggi di compressione
        pure_funcs: ['console.info', 'console.debug'],
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,       // Rimuove tutti i commenti
      },
    },
    // Non inline le immagini piccole — meglio lasciarle come asset separati con cache headers
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // pdfjs-dist usa eval internamente — va in chunk separato con minificazione disabilitata
          if (id.includes('pdfjs-dist')) return 'vendor-pdfjs';
          if (id.includes('date-fns')) return 'vendor-datefns';
          if (id.includes('framer-motion')) return 'vendor-framer';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'vendor-charts';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
          if (id.includes('xlsx')) return 'vendor-xlsx';
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'vendor-react';
        }
      }
    },
    chunkSizeWarningLimit: 650
  }
})
