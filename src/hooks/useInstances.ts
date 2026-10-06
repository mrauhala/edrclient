import { useEffect, useState } from 'react';
import { useService } from '../contexts/ServiceContext';
import { fetchInstances } from '../api/instances';
import type { Instance } from '../query/instances';

export interface InstancesState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  instances: Instance[];
  error: string | null;
}

const IDLE: InstancesState = { status: 'idle', instances: [], error: null };

// The instances behind an instances query's URL, loaded when there is one (null: none wanted)
export function useInstances(url: string | null): InstancesState {
  const { getAuthCredentials } = useService();
  const [state, setState] = useState<InstancesState>(IDLE);

  useEffect(() => {
    if (!url) {
      setState(IDLE);
      return;
    }
    let cancelled = false;
    setState({ status: 'loading', instances: [], error: null });
    fetchInstances(url, getAuthCredentials(url))
      .then(instances => !cancelled && setState({ status: 'ready', instances, error: null }))
      .catch(error => !cancelled && setState({ status: 'error', instances: [], error: error instanceof Error ? error.message : String(error) }));
    return () => {
      cancelled = true;
    };
  }, [url, getAuthCredentials]);

  return state;
}
