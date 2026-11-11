"use strict";

// Apenas o desbloqueio desta aba; dados financeiros continuam no Firestore.
class IdleSession {
  constructor({ storage, now = () => Date.now(), schedule = (callback, delay) => setTimeout(callback, delay),
    cancel = timer => clearTimeout(timer), onExpire, timeout = 5 * 60 * 1000 }) {
    this.storage = storage;
    this.now = now;
    this.schedule = schedule;
    this.cancel = cancel;
    this.onExpire = onExpire;
    this.timeout = timeout;
    this.key = "financonta_unlock_session_v1";
    this.uid = null;
    this.lastActivity = null;
    this.timer = null;
  }
  restore(uid) {
    let saved;
    try { saved = JSON.parse(this.storage.getItem(this.key)); } catch {}
    if (!saved || saved.uid !== uid || !Number.isFinite(saved.lastActivity)
      || saved.lastActivity > this.now() || this.now() - saved.lastActivity >= this.timeout) {
      this.clear();
      return false;
    }
    this.uid = uid;
    this.lastActivity = saved.lastActivity;
    this.arm();
    return true;
  }
  unlock(uid) {
    this.uid = uid;
    this.lastActivity = this.now();
    this.persist();
    this.arm();
  }
  persist() {
    try { this.storage.setItem(this.key, JSON.stringify({ uid: this.uid, lastActivity: this.lastActivity })); } catch {}
  }
  check() {
    if (!this.uid) return false;
    const elapsed = this.now() - this.lastActivity;
    if (elapsed < 0 || elapsed >= this.timeout) {
      this.clear();
      this.onExpire();
      return false;
    }
    return true;
  }
  activity() {
    // Uma ação após o prazo não pode ressuscitar o desbloqueio expirado.
    if (!this.check()) return;
    this.lastActivity = this.now();
    this.persist();
    this.arm();
  }
  arm() {
    this.cancel(this.timer);
    this.timer = this.schedule(() => {
      if (this.check()) this.arm();
    }, Math.max(0, this.timeout - (this.now() - this.lastActivity)));
  }
  clear() {
    this.cancel(this.timer);
    this.timer = null;
    this.uid = null;
    this.lastActivity = null;
    try { this.storage.removeItem(this.key); } catch {}
  }
}
