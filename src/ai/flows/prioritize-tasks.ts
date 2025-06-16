// prioritize-tasks.ts
'use server';
/**
 * @fileOverview AI-powered task prioritization flow.
 *
 * - prioritizeTasks - A function that takes a list of tasks and returns a prioritized list.
 * - Task - The interface for a task object.
 * - PrioritizedTask - The interface for a prioritized task object.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TaskSchema = z.object({
  id: z.string().describe('Unique identifier for the task.'),
  title: z.string().describe('Title of the task.'),
  deadline: z.string().optional().describe('Deadline of the task (ISO format).'),
  importance: z.enum(['high', 'medium', 'low']).describe('Importance level of the task.'),
  description: z.string().optional().describe('Description of the task.'),
});
export type Task = z.infer<typeof TaskSchema>;

const PrioritizedTaskSchema = TaskSchema.extend({
  priorityScore: z.number().describe('A numerical score indicating the task priority.'),
  reason: z.string().describe('Explanation for the assigned priority score.'),
});
export type PrioritizedTask = z.infer<typeof PrioritizedTaskSchema>;

const PrioritizeTasksInputSchema = z.array(TaskSchema);
export type PrioritizeTasksInput = z.infer<typeof PrioritizeTasksInputSchema>;

const PrioritizeTasksOutputSchema = z.array(PrioritizedTaskSchema);
export type PrioritizeTasksOutput = z.infer<typeof PrioritizeTasksOutputSchema>;

export async function prioritizeTasks(tasks: PrioritizeTasksInput): Promise<PrioritizeTasksOutput> {
  return prioritizeTasksFlow(tasks);
}

const prompt = ai.definePrompt({
  name: 'prioritizeTasksPrompt',
  input: {schema: PrioritizeTasksInputSchema},
  output: {schema: PrioritizeTasksOutputSchema},
  prompt: `You are an AI task prioritization expert. Given a list of tasks with their deadlines, importance, and descriptions, you will rank them based on which ones are the most urgent and important. You will return a list of the same tasks, but with a "priorityScore" (higher is more important) and a "reason" field explaining the score.

Here are the tasks:

{{#each this}}
Task ID: {{id}}
Title: {{title}}
Deadline: {{deadline}}
Importance: {{importance}}
Description: {{description}}
---
{{/each}}
`,
});

const prioritizeTasksFlow = ai.defineFlow(
  {
    name: 'prioritizeTasksFlow',
    inputSchema: PrioritizeTasksInputSchema,
    outputSchema: PrioritizeTasksOutputSchema,
  },
  async tasks => {
    const {output} = await prompt(tasks);
    return output!;
  }
);
