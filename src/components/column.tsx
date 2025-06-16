"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/task-card";
import type { Column as ColumnType, Task as TaskType } from "@/types";
import { Plus, Brain, MoreHorizontal, Edit2, Trash2, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ColumnProps {
  column: ColumnType;
  onDragStartTask: (e: React.DragEvent<HTMLDivElement>, taskId: string, columnId: string) => void;
  onDragOverColumn: (e: React.DragEvent<HTMLDivElement>, columnId: string) => void;
  onDropInColumn: (e: React.DragEvent<HTMLDivElement>, columnId: string) => void;
  onAddTask: (columnId: string) => void;
  onEditTask: (task: TaskType, columnId: string) => void;
  onDeleteTask: (columnId: string, taskId: string) => void;
  onReactToTask: (columnId: string, taskId: string, taskDescription: string) => Promise<void>;
  onPrioritizeTasks: (columnId: string) => Promise<void>;
  onEditColumnTitle: (columnId: string, newTitle: string) => void;
  onDeleteColumn: (columnId: string) => void;
}

export function Column({
  column,
  onDragStartTask,
  onDragOverColumn,
  onDropInColumn,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onReactToTask,
  onPrioritizeTasks,
  onEditColumnTitle,
  onDeleteColumn,
}: ColumnProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(column.title);
  const [isPrioritizing, setIsPrioritizing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTitle(e.target.value);
  };

  const handleTitleSubmit = () => {
    if (newTitle.trim() && newTitle.trim() !== column.title) {
      onEditColumnTitle(column.id, newTitle.trim());
    }
    setIsEditingTitle(false);
  };
  
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setNewTitle(column.title);
      setIsEditingTitle(false);
    }
  };

  const handlePrioritize = async () => {
    setIsPrioritizing(true);
    await onPrioritizeTasks(column.id);
    setIsPrioritizing(false);
  };

  return (
    <div
      className={`flex flex-col w-80 min-w-80 bg-secondary/50 rounded-lg shadow-sm p-1 transition-all duration-150 ease-in-out ${dragOver ? 'ring-2 ring-primary' : ''}`}
      onDragOver={(e) => {
        onDragOverColumn(e, column.id);
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        onDropInColumn(e, column.id);
        setDragOver(false);
      }}
      aria-label={`Column: ${column.title}`}
    >
      <div className="flex justify-between items-center p-3 sticky top-0 bg-secondary/50 z-10 rounded-t-md">
        {isEditingTitle ? (
          <Input
            type="text"
            value={newTitle}
            onChange={handleTitleChange}
            onBlur={handleTitleSubmit}
            onKeyDown={handleTitleKeyDown}
            className="text-lg font-headline font-semibold h-9 flex-grow mr-2 bg-background"
            autoFocus
            aria-label="Edit column title"
          />
        ) : (
          <h2
            className="text-lg font-headline font-semibold cursor-pointer hover:text-primary"
            onClick={() => setIsEditingTitle(true)}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(true)}
            aria-label={`Column title: ${column.title}. Click to edit.`}
          >
            {column.title} ({column.tasks.length})
          </h2>
        )}
        <div className="flex items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handlePrioritize} disabled={isPrioritizing || column.tasks.length === 0} className="h-8 w-8">
                  {isPrioritizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  <span className="sr-only">Prioritize tasks with AI</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Prioritize tasks with AI</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Column options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
                <Edit2 className="mr-2 h-4 w-4" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteColumn(column.id)} className="text-destructive hover:!bg-destructive hover:!text-destructive-foreground focus:!bg-destructive focus:!text-destructive-foreground">
                <Trash2 className="mr-2 h-4 w-4" /> Delete Column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-grow p-3 min-h-[100px]" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {column.tasks.length === 0 && !dragOver && (
          <div className="text-center text-muted-foreground py-4">
            Drag tasks here or click "Add Task"
          </div>
        )}
        {column.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            columnId={column.id}
            onDragStart={onDragStartTask}
            onEditTask={() => onEditTask(task, column.id)}
            onDeleteTask={onDeleteTask}
            onReactToTask={onReactToTask}
          />
        ))}
      </ScrollArea>

      <Button
        variant="ghost"
        onClick={() => onAddTask(column.id)}
        className="w-full mt-2 p-3 justify-start text-muted-foreground hover:text-primary hover:bg-primary/10"
      >
        <Plus className="mr-2 h-4 w-4" /> Add Task
      </Button>
    </div>
  );
}
