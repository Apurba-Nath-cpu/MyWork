'use server';

/**
 * @fileOverview A flow for suggesting context-sensitive reactions (emojis) to tasks.
 *
 * - reactToTask - A function that suggests an emoji reaction to a given task description.
 * - ReactToTaskInput - The input type for the reactToTask function.
 * - ReactToTaskOutput - The return type for the reactToTask function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ReactToTaskInputSchema = z.object({
  taskDescription: z.string().describe('The description of the task.'),
});
export type ReactToTaskInput = z.infer<typeof ReactToTaskInputSchema>;

const ReactToTaskOutputSchema = z.object({
  suggestedEmoji: z
    .string()
    .describe(
      'An emoji that represents a relevant reaction to the task. Example: 🎉, 🤔, 👍, 😕.'
    ),
});
export type ReactToTaskOutput = z.infer<typeof ReactToTaskOutputSchema>;

export async function reactToTask(input: ReactToTaskInput): Promise<ReactToTaskOutput> {
  return reactToTaskFlow(input);
}

const prompt = ai.definePrompt({
  name: 'reactToTaskPrompt',
  input: {schema: ReactToTaskInputSchema},
  output: {schema: ReactToTaskOutputSchema},
  prompt: `Given the following task description, suggest a single emoji that would be a relevant reaction to the task.

Task Description: {{{taskDescription}}}

Emoji: `,
});

const reactToTaskFlow = ai.defineFlow(
  {
    name: 'reactToTaskFlow',
    inputSchema: ReactToTaskInputSchema,
    outputSchema: ReactToTaskOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
