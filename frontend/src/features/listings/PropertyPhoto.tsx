import { useEffect, useState } from 'react';

export function PropertyPhoto({ url }: { url: string | null | undefined }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div className='photo'>
      {url && !failed
        ? (
          <img
            src={url}
            alt=''
            loading='lazy'
            onError={() => setFailed(true)}
          />
        )
        : (
          <span>
            ⌂<small>Sem foto</small>
          </span>
        )}
    </div>
  );
}
