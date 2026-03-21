import type { FamilyMember } from '../types/index';

type Listener = () => void;

class FamilyStore {
  private _members: FamilyMember[] = [];
  private _listeners: Listener[] = [];

  get members(): FamilyMember[] {
    return this._members;
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

  setMembers(members: FamilyMember[]): void {
    this._members = members;
    this.notify();
  }

  updateMember(updated: FamilyMember): void {
    this._members = this._members.map(m => m.id === updated.id ? updated : m);
    this.notify();
  }

  removeMember(id: string): void {
    this._members = this._members.filter(m => m.id !== id);
    this.notify();
  }
}

export const familyStore = new FamilyStore();
