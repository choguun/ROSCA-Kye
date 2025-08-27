import { ethers } from 'ethers';
import crypto from 'crypto';

/**
 * Hash LINE Group ID to bytes32 for smart contract storage
 * Matches the implementation in the web app
 */
export function hashLineGroupId(groupId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(groupId));
}

/**
 * Hash LINE User ID to bytes32 for smart contract storage  
 * Matches the implementation in the web app
 */
export function hashLineUserId(userId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(userId));
}

/**
 * Generate invite code for circle joining
 */
export function generateInviteCode(circleAddress: string, timestamp: number): string {
  const data = `${circleAddress}-${timestamp}`;
  return ethers.keccak256(ethers.toUtf8Bytes(data)).slice(2, 12); // Take first 10 chars after 0x
}

/**
 * Verify invite code
 */
export function verifyInviteCode(code: string, circleAddress: string, maxAge: number = 86400000): boolean {
  const now = Date.now();
  const maxTimestamp = now - maxAge; // Max age in milliseconds
  
  // Try different timestamps within the valid range
  for (let timestamp = now; timestamp >= maxTimestamp; timestamp -= 60000) { // Check every minute
    const expectedCode = generateInviteCode(circleAddress, timestamp);
    if (expectedCode === code) {
      return true;
    }
  }
  
  return false;
}

/**
 * Encrypt sensitive data for database storage
 */
export function encrypt(text: string, key: string): string {
  const algorithm = 'aes-256-cbc';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data from database
 */
export function decrypt(encryptedText: string, key: string): string {
  const algorithm = 'aes-256-cbc';
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedData = textParts.join(':');
  
  const decipher = crypto.createDecipher(algorithm, key);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate secure random string
 */
export function generateRandomString(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash password or sensitive string with salt
 */
export function hashWithSalt(input: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(input, actualSalt, 10000, 64, 'sha512').toString('hex');
  
  return { hash, salt: actualSalt };
}

/**
 * Verify hashed value
 */
export function verifyHash(input: string, hash: string, salt: string): boolean {
  const inputHash = crypto.pbkdf2Sync(input, salt, 10000, 64, 'sha512').toString('hex');
  return inputHash === hash;
}