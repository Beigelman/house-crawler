export function PageHeading(
  { title, description, kicker = 'SEU RADAR' }: {
    title: string;
    description: string;
    kicker?: string;
  },
) {
  return (
    <div className='page-heading'>
      <span className='eyebrow'>{kicker}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
