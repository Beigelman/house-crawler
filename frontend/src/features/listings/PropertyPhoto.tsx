import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';

export function PropertyPhoto(
  { url, alt = '', eager = false }: {
    url: string | null | undefined;
    alt?: string;
    eager?: boolean;
  },
) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div className='photo'>
      {url && !failed
        ? (
          <img
            src={url}
            alt={alt}
            loading={eager ? 'eager' : 'lazy'}
            onError={() => setFailed(true)}
          />
        )
        : (
          <span className='photo-placeholder'>
            <span className='icon-tile'>
              <Icon name='home' />
            </span>
            <small>Sem foto</small>
          </span>
        )}
    </div>
  );
}
