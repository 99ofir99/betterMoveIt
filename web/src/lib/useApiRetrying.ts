import { useEffect, useState } from 'react';
import { onApiRetry } from './api';

/** True while a core API request is quietly retrying (server restarting / waking up). */
export function useApiRetrying(): boolean {
  const [retrying, setRetrying] = useState(false);
  useEffect(() => onApiRetry(setRetrying), []);
  return retrying;
}
