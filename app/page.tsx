import { 
  createContext, 
  useContext, 
  useRef,
  ReactNode
} from 'react';

export interface EventData<T = unknown> {
  type: string;
  payload: T;
}

type EventCallback = (payload: unknown) => void;

interface EventContextValue {
  emitEvent<T>(event: EventData<T>): void;
  subscribeToEvent<T>(type: string, callback: (payload: T) => void): () => void;
}

const EventContext = createContext<EventContextValue | undefined>(undefined);

export function EventProvider({ children }: { children: ReactNode }): JSX.Element {
  const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map());

  const emitEvent = <T,>(event: EventData<T>): void => {
    const callbacks = listenersRef.current.get(event.type);
    if (callbacks) {
      callbacks.forEach((callback) => {
        callback(event.payload);
      });
    }
  };

  const subscribeToEvent = <T,>(
    type: string, 
    callback: (payload: T) => void
  ): (() => void) => {
    const listeners = listenersRef.current;
    
    if (!listeners.has(type)) {
      listeners.set(type, new Set());
    }
    
    const typeListeners = listeners.get(type)!;
    typeListeners.add(callback as EventCallback);

    return (): void => {
      typeListeners.delete(callback as EventCallback);
    };
  };

  const value: EventContextValue = {
    emitEvent,
    subscribeToEvent
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
}

export function useEventBus(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEventBus must be used within EventProvider');
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
