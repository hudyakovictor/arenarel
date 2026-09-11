import type { ProtocolId } from './data';

export interface JournalEntryPublic {
  caseName: string;
  chosen: ProtocolId;
  required: ProtocolId;
  success: boolean;
  verdict: string;
  lesson: string;
}
