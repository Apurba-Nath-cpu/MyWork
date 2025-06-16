"use client";

import { useState }from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Edit3, MoreVertical, SmilePlus, Trash2, Zap, Loader2, Info } from "lucide-react";
import type { Task } from "@/types";
import { format, parseISO } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TaskCardProps {
  task: Task;
  columnId: string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string, columnId: string) => void;
  onEditTask: () => void; // Opens dialog with this task's data
  onDeleteTask: (columnId: string, taskId: string) => void;
  onReactToTask: (columnId: string, taskId: string, taskDescription: string) => Promise<void>;
}

export function TaskCard({ task, columnId, onDragStart, onEditTask, onDeleteTask, onReactToTask }: TaskCardProps) {
  const [isReacting, setIsReacting] = useState(false);

  const handleReact = async () => {
    setIsReacting(true);
    await onReactToTask(columnId, task.id, task.description || task.title);
    setIsReacting(false);
  };

  const importanceColors: Record<Task["importance"], string> = {
    low: "bg-green-500 hover:bg-green-600",
    medium: "bg-yellow-500 hover:bg-yellow-600",
    high: "bg-red-500 hover:bg-red-600",
  };
  
  const importanceTextColors: Record<Task["importance"], string> = {
    low: "text-white",
    medium: "text-white",
    high: "text-white",
  };


  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, task.id, columnId)}
      className="mb-3 cursor-grab active:cursor-grabbing bg-card shadow-md hover:shadow-lg transition-shadow duration-150 ease-in-out"
      aria-label={`Task: ${task.title}`}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-headline leading-tight">{task.title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2 -mt-1">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Task options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEditTask}>
                <Edit3 className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeleteTask(columnId, task.id)} className="text-destructive hover:!bg-destructive hover:!text-destructive-foreground focus:!bg-destructive focus:!text-destructive-foreground">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {task.description && (
          <CardDescription className="text-sm mt-1">{task.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0 pb-2">
        <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
          <Badge variant="outline" className={`${importanceColors[task.importance]} ${importanceTextColors[task.importance]} border-transparent`}>
            {task.importance.charAt(0).toUpperCase() + task.importance.slice(1)}
          </Badge>
          {task.deadline && (
            <span>Deadline: {format(parseISO(task.deadline), "MMM d, yyyy")}</span>
          )}
          {task.priorityScore !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="cursor-default">
                    <Zap className="mr-1 h-3 w-3 text-yellow-500" /> AI Priority: {task.priorityScore}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-bold">AI Reason:</p>
                  <p>{task.reason || "No reason provided."}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <div className="flex items-center justify-between w-full">
            {task.emoji && <span className="text-2xl" aria-label="Task reaction emoji">{task.emoji}</span>}
            <Button
                variant="ghost"
                size="sm"
                onClick={handleReact}
                disabled={isReacting}
                className="ml-auto text-muted-foreground hover:text-accent-foreground"
                aria-label="React to task with emoji"
            >
                {isReacting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                <SmilePlus className="mr-2 h-4 w-4" />
                )}
                React
            </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
