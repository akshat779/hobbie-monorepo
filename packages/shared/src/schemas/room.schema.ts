import { z } from 'zod';

export const SendMessageSchema = z.object({
  activityId: z.string().uuid(),
  content: z.string().min(1).max(500),
});

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  activityId: z.string().uuid(),
  senderId: z.string().uuid(),
  senderName: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
  isHost: z.boolean(),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
