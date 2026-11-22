const paths = {
  home: 'M3 10.5 12 3l9 7.5M5 9v11h14V9M10 20v-6h4v6',
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  search: 'M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  history: 'M3 12a9 9 0 1 1 2.64 6.36M3 4v8h8m1-5v5l3 2',
  pin:
    'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0ZM14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  refresh:
    'M20 7v5h-5M4 17v-5h5m-3.4-4a7 7 0 0 1 11.76-2.36L20 8m-16 8 2.64 2.36A7 7 0 0 0 18.4 16',
  logout: 'M10 17l5-5-5-5m5 5H3m10-8h7v16h-7',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  back: 'M20 12H5m6-6-6 6 6 6',
  external: 'M13 5h6v6M19 5l-9 9m8-1v6H5V6h6',
  pulse: 'M3 12h4l3-6 4 12 3-6h4',
  spark: 'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z',
  sliders: 'M4 7h8m4 0h4M4 17h4m4 0h8m-8-12v4m-4 6v4',
  area: 'M8 4H4v4m12-4h4v4m0 8v4h-4M4 16v4h4m0-4 8-8m-4 0h4v4',
  bed: 'M3 18v3m18-3v3M3 9v9h18v-3a3 3 0 0 0-3-3h-6v6m-9-6h5a2 2 0 0 1 2 2v4',
  plus: 'M12 5v14M5 12h14',
  chevron: 'm6 9 6 6 6-6',
  alert: 'M12 8v5m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
} as const;

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className='icon'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      focusable='false'
    >
      <path d={paths[name]} />
    </svg>
  );
}
