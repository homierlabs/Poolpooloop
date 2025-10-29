// FILE: lib/env.ts
// PURPOSE: Validate environment variables at build/runtime
// USAGE: Imported by lib/spotify.ts to ensure all required env vars exist

const requiredEnvVars = [
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'NEXT_PUBLIC_REDIRECT_URI',
] as const

type EnvVar = typeof requiredEnvVars[number]

interface ValidationResult {
  valid: boolean
  missing: EnvVar[]
  values: Record<EnvVar, string>
}

export function validateEnv(): ValidationResult {
  const missing: EnvVar[] = []
  const values = {} as Record<EnvVar, string>

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar]
    if (!value) {
      missing.push(envVar)
      console.error(`❌ Missing required environment variable: ${envVar}`)
    } else {
      values[envVar] = value
      // Log first 4 chars for debugging (don't log full secrets)
      const preview = envVar.includes('SECRET') 
        ? value.substring(0, 4) + '...' 
        : value.substring(0, 20) + (value.length > 20 ? '...' : '')
      console.log(`✅ ${envVar}: ${preview}`)
    }
  }

  const valid = missing.length === 0

  if (!valid) {
    console.error('\n⚠️  Environment variables validation failed!')
    console.error('Missing variables:', missing.join(', '))
    console.error('\nCreate a .env.local file with:')
    missing.forEach(varName => {
      console.error(`${varName}=your_value_here`)
    })
    console.error('\nSee README.md for setup instructions.\n')
  }

  return { valid, missing, values }
}

// Validate on module load (server-side only)
if (typeof window === 'undefined') {
  const result = validateEnv()
  
  if (!result.valid) {
    // In development, throw error immediately
    if (process.env.NODE_ENV === 'development') {
      throw new Error(
        `Missing required environment variables: ${result.missing.join(', ')}\n` +
        'See README.md for setup instructions.'
      )
    }
    // In production, just log (let routes handle the error)
    console.error('Environment validation failed, app may not work correctly')
  }
}
