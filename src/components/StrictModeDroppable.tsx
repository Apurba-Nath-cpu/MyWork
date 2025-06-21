
"use client";

import { useEffect, useState } from "react";
import { Droppable, type DroppableProps } from "react-beautiful-dnd";

const StrictModeDroppable = ({ children, ...props }: DroppableProps) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // A one-time effect to enable the Droppable only on the client,
    // after the initial render cycle.
    const animation = requestAnimationFrame(() => setEnabled(true));

    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return <Droppable {...props}>{children}</Droppable>;
};

export default StrictModeDroppable;
