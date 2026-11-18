import { DfImoveisProvider } from './df-imoveis.ts';
import { WimoveisProvider } from './wimoveis.ts';
import type { Dependencies } from '../ports.ts';

export const createProvider: Dependencies['providers'] = (
  id,
  params,
  signal,
) => {
  const provider = id === 'dfimoveis'
    ? new DfImoveisProvider(params, signal)
    : new WimoveisProvider(params, signal);
  return {
    collect: () => provider.collectOutcome(),
    verify: (url) => provider.verify(url),
  };
};
