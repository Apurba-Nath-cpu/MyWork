"use client";

import { useState, useEffect, DragEvent } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Column as ColumnType, Task as TaskType, TaskImportance } from "@/types";
import { Column } from "@/components/column";
import { CreateColumnDialog } from "@/components/create-column-dialog";
import { CreateTaskDialog, TaskFormData } from "@/components/create-task-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { reactToTask as aiReactToTask } from "@/ai/flows/react-to-task";
import { prioritizeTasks as aiPrioritizeTasks } from "@/ai/flows/prioritize-tasks";

const initialColumnsData: ColumnType[] = [
  {
    id: "col-todo",
    title: "To Do",
    tasks: [
      { id: uuidv4(), title: "Brainstorm new features", description: "Think about next-gen ideas for TaskFlow.", importance: "medium", order: 0, deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
      { id: uuidv4(), title: "Design landing page", description: "Create mockups for the new marketing website.", importance: "high", order: 1, deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: "col-inprogress",
    title: "In Progress",
    tasks: [
      { id: uuidv4(), title: "Develop core D&D logic", description: "Implement task dragging and dropping.", importance: "high", order: 0 },
    ],
  },
  {
    id: "col-done",
    title: "Done",
    tasks: [
      { id: uuidv4(), title: "Setup project structure", description: "Initialize Next.js app with TypeScript.", importance: "low", order: 0 },
    ],
  },
];


export function Board() {
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<{ task?: TaskType; columnId?: string; columnTitle?: string } | null>(null);
  const [draggedTaskInfo, setDraggedTaskInfo] = useState<{ taskId: string; sourceColumnId: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate loading data or use initial data
    // In a real app, this would fetch from a backend or localStorage
    const storedColumns = localStorage.getItem("taskFlowColumns");
    if (storedColumns) {
      setColumns(JSON.parse(storedColumns));
    } else {
      setColumns(initialColumnsData);
    }
  }, []);

  useEffect(() => {
    // Persist columns to localStorage whenever they change
    if (columns.length > 0) { // Avoid saving empty array on initial load if initialColumnsData is not ready
        localStorage.setItem("taskFlowColumns", JSON.stringify(columns));
    }
  }, [columns]);


  const handleAddColumn = (title: string) => {
    const newColumn: ColumnType = { id: uuidv4(), title, tasks: [] };
    setColumns((prevColumns) => [...prevColumns, newColumn]);
    toast({ title: "Column Created", description: `Column "${title}" has been added.` });
  };

  const handleEditColumnTitle = (columnId: string, newTitle: string) => {
    setColumns(prev => prev.map(col => col.id === columnId ? {...col, title: newTitle} : col));
    toast({ title: "Column Updated", description: `Column title changed to "${newTitle}".` });
  };

  const handleDeleteColumn = (columnId: string) => {
    setColumns(prev => prev.filter(col => col.id !== columnId));
    toast({ title: "Column Deleted", description: "The column has been removed.", variant: "destructive" });
  };

  const handleOpenCreateTaskDialog = (columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    setEditingTask({ columnId, columnTitle: column?.title });
    setIsTaskDialogOpen(true);
  };

  const handleOpenEditTaskDialog = (task: TaskType, columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    setEditingTask({ task, columnId, columnTitle: column?.title });
    setIsTaskDialogOpen(true);
  };

  const handleTaskFormSubmit = (data: TaskFormData) => {
    if (editingTask?.task && editingTask.columnId) { // Editing existing task
      const updatedTask: TaskType = {
        ...editingTask.task,
        ...data,
        deadline: data.deadline?.toISOString(),
      };
      setColumns((prevColumns) =>
        prevColumns.map((col) =>
          col.id === editingTask.columnId
            ? { ...col, tasks: col.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)) }
            : col
        )
      );
      toast({ title: "Task Updated", description: `Task "${updatedTask.title}" has been updated.` });
    } else if (editingTask?.columnId) { // Creating new task
      const newTask: TaskType = {
        id: uuidv4(),
        ...data,
        deadline: data.deadline?.toISOString(),
        importance: data.importance as TaskImportance,
        order: columns.find(c => c.id === editingTask.columnId)?.tasks.length || 0,
      };
      setColumns((prevColumns) =>
        prevColumns.map((col) =>
          col.id === editingTask.columnId
            ? { ...col, tasks: [...col.tasks, newTask] }
            : col
        )
      );
      toast({ title: "Task Created", description: `Task "${newTask.title}" has been added.` });
    }
    setEditingTask(null);
    setIsTaskDialogOpen(false);
  };

  const handleDeleteTask = (columnId: string, taskId: string) => {
    setColumns((prevColumns) =>
      prevColumns.map((col) =>
        col.id === columnId
          ? { ...col, tasks: col.tasks.filter((t) => t.id !== taskId).map((t, i) => ({...t, order: i})) } // Re-index order
          : col
      )
    );
    toast({ title: "Task Deleted", description: "The task has been removed.", variant: "destructive" });
  };

  const handleDragStartTask = (e: DragEvent<HTMLDivElement>, taskId: string, sourceColumnId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.setData("sourceColumnId", sourceColumnId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedTaskInfo({ taskId, sourceColumnId });
  };

  const handleDragOverColumn = (e: DragEvent<HTMLDivElement>, columnId: string) => {
    e.preventDefault(); // Necessary to allow drop
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropInColumn = (e: DragEvent<HTMLDivElement>, targetColumnId: string) => {
    e.preventDefault();
    if (!draggedTaskInfo) return;

    const { taskId, sourceColumnId } = draggedTaskInfo;
    
    let taskToMove: TaskType | undefined;
    let sourceColIndex = -1;
    let taskIndexInSourceCol = -1;

    // Find and remove task from source column
    const tempColumns = columns.map((col, idx) => {
      if (col.id === sourceColumnId) {
        sourceColIndex = idx;
        taskIndexInSourceCol = col.tasks.findIndex(t => t.id === taskId);
        if (taskIndexInSourceCol > -1) {
          taskToMove = { ...col.tasks[taskIndexInSourceCol] };
          return { ...col, tasks: col.tasks.filter(t => t.id !== taskId) };
        }
      }
      return col;
    });
    
    if (!taskToMove) {
      setDraggedTaskInfo(null);
      return;
    }

    // Add task to target column and re-order
    const finalColumns = tempColumns.map(col => {
      if (col.id === targetColumnId) {
        // Determine drop position logic (simplified: add to end)
        // More complex logic would involve finding the exact drop index based on mouse position
        const targetTasks = [...col.tasks];
        
        // A more precise drop might involve finding the element being hovered over.
        // For this example, tasks are added to the end of the target column or reordered.
        // The `order` property helps in maintaining a visual order.
        // For now, simple append. More advanced would calculate specific index on drop.
        let newOrder = targetTasks.length;
        
        // If dropping on a task card, try to insert before/after
        const dropTargetElement = e.target as HTMLElement;
        const taskCardElement = dropTargetElement.closest('[draggable="true"]');

        if (taskCardElement && taskCardElement.parentElement) {
            const siblingTasks = Array.from(taskCardElement.parentElement.children) as HTMLElement[];
            const dropIndex = siblingTasks.findIndex(el => el === taskCardElement);
            
            const rect = taskCardElement.getBoundingClientRect();
            const isDropInUpperHalf = e.clientY < rect.top + rect.height / 2;

            if (isDropInUpperHalf) {
                newOrder = col.tasks[dropIndex].order - 0.5; // insert before
            } else {
                newOrder = col.tasks[dropIndex].order + 0.5; // insert after
            }
        }
        
        taskToMove!.order = newOrder;
        const updatedTasks = [...targetTasks, taskToMove!].sort((a, b) => a.order - b.order);
        return { ...col, tasks: updatedTasks.map((t, i) => ({ ...t, order: i })) }; // Re-index order
      }
      return col;
    }).map(col => ({ // Re-index order for source column if it changed
        ...col,
        tasks: col.tasks.sort((a,b) => a.order - b.order).map((t, i) => ({ ...t, order: i }))
    }));


    setColumns(finalColumns);
    setDraggedTaskInfo(null);
    toast({ title: "Task Moved", description: `Task "${taskToMove.title}" moved.` });
  };
  
  const handleReactToTask = async (columnId: string, taskId: string, taskDescription: string) => {
    try {
      const result = await aiReactToTask({ taskDescription });
      if (result.suggestedEmoji) {
        setColumns(prev => prev.map(col => 
          col.id === columnId 
            ? { ...col, tasks: col.tasks.map(t => t.id === taskId ? { ...t, emoji: result.suggestedEmoji } : t) } 
            : col
        ));
        toast({ title: "Reaction Added!", description: `AI suggested: ${result.suggestedEmoji}` });
      }
    } catch (error) {
      console.error("Error reacting to task:", error);
      toast({ title: "AI Error", description: "Could not get emoji reaction.", variant: "destructive" });
    }
  };

  const handlePrioritizeTasks = async (columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (!column || column.tasks.length === 0) {
      toast({ title: "No Tasks", description: "Cannot prioritize an empty column or column with no tasks.", variant: "default" });
      return;
    }

    try {
      const tasksToPrioritize = column.tasks.map(({ id, title, deadline, importance, description }) => ({
        id, title, deadline, importance, description
      }));
      
      const prioritizedTasks = await aiPrioritizeTasks(tasksToPrioritize);
      
      setColumns(prev => prev.map(col => {
        if (col.id === columnId) {
          const updatedTasks = col.tasks.map(originalTask => {
            const aiData = prioritizedTasks.find(pt => pt.id === originalTask.id);
            return aiData ? { ...originalTask, priorityScore: aiData.priorityScore, reason: aiData.reason } : originalTask;
          }).sort((a, b) => (b.priorityScore ?? -1) - (a.priorityScore ?? -1)) // Sort by score, descending
            .map((t, i) => ({ ...t, order: i })); // Re-index order
          return { ...col, tasks: updatedTasks };
        }
        return col;
      }));
      toast({ title: "Tasks Prioritized!", description: `AI has prioritized tasks in "${column.title}".` });
    } catch (error) {
      console.error("Error prioritizing tasks:", error);
      toast({ title: "AI Error", description: "Could not prioritize tasks.", variant: "destructive" });
    }
  };


  return (
    <div className="flex flex-col h-screen p-4 overflow-hidden">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold font-headline text-primary">TaskFlow</h1>
        <CreateColumnDialog onAddColumn={handleAddColumn} />
      </header>
      
      <ScrollArea className="flex-grow pb-4">
        <div className="flex gap-4 h-full items-start">
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              onDragStartTask={handleDragStartTask}
              onDragOverColumn={handleDragOverColumn}
              onDropInColumn={handleDropInColumn}
              onAddTask={() => handleOpenCreateTaskDialog(column.id)}
              onEditTask={handleOpenEditTaskDialog}
              onDeleteTask={handleDeleteTask}
              onReactToTask={handleReactToTask}
              onPrioritizeTasks={handlePrioritizeTasks}
              onEditColumnTitle={handleEditColumnTitle}
              onDeleteColumn={handleDeleteColumn}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <CreateTaskDialog
        isOpen={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        onSubmit={handleTaskFormSubmit}
        initialData={editingTask?.task}
        columnTitle={editingTask?.columnTitle}
      />
    </div>
  );
}
