import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        https: {
          key: fs.readFileSync('./cert/key.pem'),
          cert: fs.readFileSync('./cert/cert.pem'),
        }
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.svg', 'icons/*.png'],
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            runtimeCaching: [
              {
                // Match any request that ends with .png, .jpg, .jpeg or .svg.
                urlPattern: /\.(?:png|jpg|jpeg|svg)$/,
                // Apply a cache-first strategy.
                handler: 'CacheFirst',
                options: {
                  cacheName: 'images',
                  expiration: {
                    // Cache up to 50 images.
                    maxEntries: 50,
                  },
                },
              },
            ],
          },
          manifest: {
            name: 'Laboratory Inventory Management',
            short_name: 'Lab Inventory',
            start_url: '.',
            scope: '.',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#0d6efd', 
            description: 'A PWA for managing laboratory inventory, tracking supplies, and monitoring usage.',
            permissions: ['camera'],
            icons: [
              {
                src: 'icons/icon-192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'icons/icon-512.png',
                sizes: '512x512',
                type: 'image/png'
              },
              {
                src: 'icons/maskable-icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
