// Per-tab drafts. No conversation content is sent anywhere by this store.
export class ConversationDrafts {
  constructor(storage) {
    this.storage = storage;
    this.memory = new Map();
    this.volatile = new Set();
  }
  prefix(project, user) {
    return `people-notebook:conversation-draft:v1:${encodeURIComponent(project)}:${encodeURIComponent(user)}:`;
  }
  key([project, user, person, record]) {
    return `${this.prefix(project, user)}${encodeURIComponent(person)}:${encodeURIComponent(record)}`;
  }
  read(scope) {
    const key = this.key(scope);
    let raw;
    try { raw = this.volatile.has(key) ? this.memory.get(key) : this.storage().getItem(key); }
    catch { raw = this.memory.get(key); }
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return value && typeof value.note === 'string' ? value : null;
    } catch { return null; }
  }
  write(scope, value) {
    const key = this.key(scope), raw = JSON.stringify(value);
    this.memory.set(key, raw);
    try {
      this.storage().setItem(key, raw);
      this.volatile.delete(key);
      return true;
    } catch { this.volatile.add(key); return false; }
  }
  remove(scope) { return this.removeKey(this.key(scope)); }
  removeKey(key) {
    this.memory.delete(key);
    try { this.storage().removeItem(key); this.volatile.delete(key); return true; }
    catch { this.volatile.add(key); return false; }
  }
  clearAccount(project, user) {
    const prefix = this.prefix(project, user), keys = new Set(this.memory.keys());
    try {
      const disk = this.storage();
      for (let i = 0; i < disk.length; i++) keys.add(disk.key(i));
    } catch { /* Memory drafts can still be cleared. */ }
    for (const key of keys) if (key?.startsWith(prefix)) this.removeKey(key);
  }
}
