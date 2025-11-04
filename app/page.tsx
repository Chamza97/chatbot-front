import { 
  createContext, 
  useContext, 
  useState, 
  ReactNode, 
  useMemo 
} from 'react';

export interface EventData<T = unknown> {
  type: string;
  payload: T;
}

type EventCallback<T = unknown> = (payload: T) => void;

interface EventContextValue {
  emitEvent: <T = unknown>(event: EventData<T>) => void;
  subscribeToEvent: <T = unknown>(
    type: string, 
    callback: EventCallback<T>
  ) => () => void;
}

const EventContext = createContext<EventContextValue | undefined>(undefined);

export function EventProvider({ children }: { children: ReactNode }): JSX.Element {
  const [listeners] = useState<Map<string, Set<EventCallback>>>(
    () => new Map()
  );

  const contextValue = useMemo<EventContextValue>(() => {
    const emitEvent = <T,>(event: EventData<T>): void => {
      const callbacks = listeners.get(event.type);
      if (callbacks) {
        callbacks.forEach((callback: EventCallback) => {
          callback(event.payload);
        });
      }
    };

    const subscribeToEvent = <T,>(
      type: string, 
      callback: EventCallback<T>
    ): (() => void) => {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      
      const typeListeners = listeners.get(type);
      typeListeners?.add(callback as EventCallback);

      return (): void => {
        typeListeners?.delete(callback as EventCallback);
      };
    };

    return {
      emitEvent,
      subscribeToEvent
    };
  }, [listeners]);

  return (
    <EventContext.Provider value={contextValue}>
      {children}
    </EventContext.Provider>
  );
}

export function useEventBus(): EventContextValue {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEventBus doit être utilisé dans un EventProvider');
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
