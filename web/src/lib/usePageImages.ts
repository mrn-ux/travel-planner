import { useEffect, useMemo } from 'react';
import { pickOne, setBackdropContext } from './destinationPhoto';

/**
 * Pictures for a page that is about something other than the destination (lodging, vehicles). Returns the names for the banner and
 * shows the same kind of picture behind the whole app while the page is open. With no list the chosen country is shown.
 */
export function usePageImages(list: string[] | null): string[] {
  const key = list ? list.join('|') : '';
  const one = useMemo(() => (list ? [pickOne(list)] : []), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setBackdropContext(one.length > 0 ? one : null);
    return () => setBackdropContext(null);
  }, [one]);
  return one;
}
