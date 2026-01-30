import type { SRPClientSessionStep1 } from 'tssrp6a'
import { createVerifierAndSalt, SRPClientSession, SRPParameters, SRPRoutines } from 'tssrp6a'

// Use same parameters as server (SHA-256 with 2048-bit group)
const srpParams = new SRPParameters()
const srpRoutines = new SRPRoutines(srpParams)

/**
 * Generate salt and verifier for registration
 * These are computed client-side - the password never leaves the browser
 */
export async function generateSRPCredentials(username: string, password: string): Promise<{
  salt: string
  verifier: string
}> {
  // Generate random salt and compute verifier using the utility function
  const { s: salt, v: verifier } = await createVerifierAndSalt(
    srpRoutines,
    username.toLowerCase(),
    password,
  )

  return {
    salt: salt.toString(16),
    verifier: verifier.toString(16),
  }
}

/**
 * SRP Client Session for login flow
 */
export interface SRPLoginSession {
  username: string
  step1Result: SRPClientSessionStep1
}

/**
 * Start SRP login - prepares client session with username/password
 * Returns session data needed for the login flow
 */
export async function startSRPLogin(username: string, password: string): Promise<SRPLoginSession> {
  const client = new SRPClientSession(srpRoutines)

  // Step 1: Hash username and password (no A generated yet)
  const step1Result = await client.step1(username.toLowerCase(), password)

  return {
    username: username.toLowerCase(),
    step1Result,
  }
}

/**
 * Complete SRP login - computes A, session key and proof M1
 * Call this after receiving salt and B from server
 */
export async function completeSRPLogin(
  session: SRPLoginSession,
  salt: string,
  serverPublicEphemeral: string,
): Promise<{
  clientPublicEphemeral: string
  clientProof: string
}> {
  // Step 2: Generate A and compute session key and client proof M1
  const step2Result = await session.step1Result.step2(
    BigInt(`0x${salt}`),
    BigInt(`0x${serverPublicEphemeral}`),
  )

  return {
    clientPublicEphemeral: step2Result.A.toString(16),
    clientProof: step2Result.M1.toString(16),
  }
}
