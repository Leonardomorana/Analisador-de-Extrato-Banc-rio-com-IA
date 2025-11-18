export interface PositiveEntry {
  description: string;
  amount: number;
  date: string;
}

export interface GeminiResponse {
    positiveEntries: PositiveEntry[];
    clientName: string;
}