import type { ReactNode } from 'react';

export function PageHeading(
  { title, description, kicker, action }: {
    title: string;
    description: string;
    kicker?: string;
    action?: ReactNode;
  },
) {
  return (
    <div className='page-intro'>
      <div className='page-heading'>
        {kicker && <span className='kicker'>{kicker}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
