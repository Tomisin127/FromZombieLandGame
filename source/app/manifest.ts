import type { MetadataRoute } from 'next'

/**
 * Web App Manifest.
 *
 * dashboard.base.org's "standard web app" validator requires the page to
 * link to a valid Web App Manifest containing at minimum `name`, `icons`,
 * `start_url`, and `display`. When this is missing it surfaces the generic
 * error "web resource must have metadata".
 *
 * Next.js (App Router) exposes any default-exported MetadataRoute.Manifest
 * function from `app/manifest.ts` at `/manifest.webmanifest`, and also
 * automatically injects `<link rel="manifest" href="/manifest.webmanifest">`
 * into the <head> of every page — no further wiring required.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zombie FPS Game',
    short_name: 'Zombie FPS',
    description: 'Play and earn with blockchain FPS gameplay on Base.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#12100e',
    theme_color: '#12100e',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
