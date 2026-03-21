import type { UserInfo } from '../types/index';
import { saveOpenId, loadOpenId, clearOpenId } from '../utils/storage';

// 用户认证状态 Store
// 老王注：轻量 Observer 模式，不引第三方，能用就行，别他妈过度设计

type Listener = () => void;

class AuthStore {
  private _userInfo: UserInfo | null = null;
  private _isLoggedIn: boolean = false;
  private _listeners: Listener[] = [];

  constructor() {
    // 初始化时从缓存恢复登录态
    const openId = loadOpenId();
    if (openId) {
      this._isLoggedIn = true;
    }
  }

  get userInfo(): UserInfo | null {
    return this._userInfo;
  }

  get isLoggedIn(): boolean {
    return this._isLoggedIn;
  }

  subscribe(listener: Listener): () => void {
    this._listeners.push(listener);
    return () => this.unsubscribe(listener);
  }

  unsubscribe(listener: Listener): void {
    this._listeners = this._listeners.filter(l => l !== listener);
  }

  private notify(): void {
    this._listeners.forEach(l => l());
  }

  setUserInfo(info: UserInfo): void {
    this._userInfo = info;
    this._isLoggedIn = true;
    saveOpenId(info.openId);
    this.notify();
  }

  logout(): void {
    this._userInfo = null;
    this._isLoggedIn = false;
    clearOpenId();
    this.notify();
  }
}

export const authStore = new AuthStore();
