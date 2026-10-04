const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const iterations = 600000;

function toBase64(bytes) {
  let result = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    result += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(result);
}

function fromBase64(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error("バックアップの形式が正しくありません。");
  }
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveKey(password, salt, rounds) {
  const material = await crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: rounds, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBackup(payload, password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("12文字以上のパスワードを入力してください。");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, plaintext,
  ));
  return {
    format: "people-notebook-encrypted-backup",
    version: 1,
    kdf: "PBKDF2-HMAC-SHA256",
    iterations,
    cipher: "AES-256-GCM",
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}

export async function decryptBackup(envelope, password) {
  if (
    !envelope || envelope.format !== "people-notebook-encrypted-backup" ||
    envelope.version !== 1 || envelope.kdf !== "PBKDF2-HMAC-SHA256" ||
    envelope.cipher !== "AES-256-GCM" || envelope.iterations !== iterations
  ) throw new Error("対応していないバックアップ形式です。");
  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const ciphertext = fromBase64(envelope.ciphertext);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17) {
    throw new Error("バックアップの形式が正しくありません。");
  }
  try {
    const key = await deriveKey(password, salt, iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv }, key, ciphertext,
    );
    const payload = JSON.parse(decoder.decode(plaintext));
    validateBackupPayload(payload);
    return payload;
  } catch (error) {
    if (error?.message === "バックアップの内容が正しくありません。" || error?.message?.startsWith("バックアップの写真")) throw error;
    throw new Error("パスワードが違うか、ファイルが破損しています。");
  }
}

export function validateBackupPayload(payload) {
  const tables = [
    "people", "assignments", "conversations", "family_members",
    "events", "follow_up_items", "topic_preferences",
  ];
  if (!payload || ![1, 2].includes(payload.version) || !payload.tables || !payload.counts) {
    throw new Error("バックアップの内容が正しくありません。");
  }
  for (const table of tables) {
    if (!Array.isArray(payload.tables[table]) ||
      payload.tables[table].length !== payload.counts[table]) {
      throw new Error("バックアップの内容が正しくありません。");
    }
  }
  if (payload.version === 2) {
    if (!Array.isArray(payload.media)) throw new Error("バックアップの写真が含まれていません。");
    const paths = new Set();
    for (const item of payload.media) {
      if (!item || typeof item.path !== "string" || !/^[A-Za-z0-9_-]{1,180}\/[0-9a-f-]{36}\.jpg$/i.test(item.path) ||
          item.mime !== "image/jpeg" || paths.has(item.path) || typeof item.base64 !== "string" ||
          item.base64.length > 1400000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(item.base64))
        throw new Error("バックアップの写真の形式が正しくありません。");
      let bytes;
      try { bytes = fromBase64(item.base64); } catch {throw new Error("バックアップの写真の形式が正しくありません。");}
      validateJpegBytes(bytes);
      paths.add(item.path);
    }
    for (const person of payload.tables.people) {
      if (person.card_image?.mode === "photo" && !paths.has(person.card_image.path))
        throw new Error("バックアップの写真が不足しています。");
    }
  }
  return true;
}
import {validateJpegBytes} from './jpeg.js';
