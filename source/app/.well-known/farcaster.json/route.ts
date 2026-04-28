import { NextResponse } from 'next/server'

// Public URL of the deployed app. Must match the canonicalDomain below.
const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

const canonicalDomain = new URL(ROOT_URL).host

export async function GET() {
  return NextResponse.json({
    // Paste the signed accountAssociation generated from
    // base.dev → Preview → Account Association (or farcaster.xyz Manifest Tool).
    // Without these three signed values, dashboard.base.org will not verify
    // ownership of the domain.
    accountAssociation: {
      header: '',
      payload: '',
      signature: '',
    },
    miniapp: {
      version: '1',
      name: 'Zombie FPS Game',
      subtitle: 'Survive the apocalypse',
      description: 'Play and earn with blockchain FPS gameplay on Base.',
      iconUrl: `${ROOT_URL}/icon.png`,
      splashImageUrl: `${ROOT_URL}/splash.png`,
      splashBackgroundColor: '#12100e',
      homeUrl: ROOT_URL,
      heroImageUrl: `${ROOT_URL}/hero.png`,
      ogTitle: 'Zombie FPS Game',
      ogDescription: 'Play and earn with blockchain FPS gameplay.',
      ogImageUrl: `${ROOT_URL}/hero.png`,
      canonicalDomain,
      primaryCategory: 'games',
      tags: ['game', 'fps', 'zombie', 'base', 'mint'],
      requiredChains: ['eip155:8453'],
      requiredCapabilities: ['actions.ready', 'actions.signIn'],
    },
  })
}
