import { create } from 'zustand'
import type { FamilyMember } from '../types/index'

interface FamilyState {
  members: FamilyMember[]
  setMembers: (members: FamilyMember[]) => void
  updateMember: (updated: FamilyMember) => void
  removeMember: (id: string) => void
}

export const useFamilyStore = create<FamilyState>((set) => ({
  members: [],

  setMembers: (members) => set({ members }),

  updateMember: (updated) => set((s) => ({
    members: s.members.map(m => m.id === updated.id ? updated : m),
  })),

  removeMember: (id) => set((s) => ({
    members: s.members.filter(m => m.id !== id),
  })),
}))
