// EventContext.tsx
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type EventData<T = unknown> = {
  type: string;
  payload: T;
};

type EventCallback<T = unknown> = (payload: T) => void;

type EventContextType = {
  emitEvent: <T = unknown>(event: EventData<T>) => void;
  subscribeToEvent: <T = unknown>(type: string, callback: EventCallback<T>) => () => void;
};

const EventContext = createContext<EventContextType | null>(null);

export function EventProvider({ children }: { children: ReactNode }): JSX.Element {
  const [listeners, setListeners] = useState<Map<string, Set<EventCallback>>>(new Map());

  const emitEvent = useCallback(<T,>({ type, payload }: EventData<T>): void => {
    const callbacks = listeners.get(type);
    callbacks?.forEach((callback: EventCallback) => callback(payload));
  }, [listeners]);

  const subscribeToEvent = useCallback(<T,>(type: string, callback: EventCallback<T>): (() => void) => {
    setListeners((prev: Map<string, Set<EventCallback>>) => {
      const newListeners = new Map(prev);
      if (!newListeners.has(type)) {
        newListeners.set(type, new Set());
      }
      newListeners.get(type)!.add(callback as EventCallback);
      return newListeners;
    });

    return (): void => {
      setListeners((prev: Map<string, Set<EventCallback>>) => {
        const newListeners = new Map(prev);
        newListeners.get(type)?.delete(callback as EventCallback);
        return newListeners;
      });
    };
  }, []);

  const value: EventContextType = {
    emitEvent,
    subscribeToEvent
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
}

export function useEventBus(): EventContextType {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEventBus doit être utilisé dans EventProvider');
  }
  return context;
}


    // types/events.ts
export interface UserClickedPayload {
  id: number;
  name: string;
}

export interface DataUpdatedPayload {
  data: string[];
  timestamp: number;
}

export const EventTypes = {
  USER_CLICKED: 'USER_CLICKED',
  DATA_UPDATED: 'DATA_UPDATED',
} as const;


    // ComposantA.tsx
import { useEventBus } from './EventContext';
import { EventTypes, UserClickedPayload } from './types/events';

export function ComposantA(): JSX.Element {
  const { emitEvent } = useEventBus();
  
  const handleClick = (): void => {
    emitEvent<UserClickedPayload>({ 
      type: EventTypes.USER_CLICKED, 
      payload: { id: 123, name: 'John' } 
    });
  };
  
  return (
    <button onClick={handleClick}>
      Envoyer Event
    </button>
  );
}
