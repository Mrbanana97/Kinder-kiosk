import * as React from 'react'

export interface IconProps extends React.SVGProps<SVGSVGElement> { size?: number | string }

function IconBase({size=20, children, className='', ...rest}: React.PropsWithChildren<IconProps>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconRecords = (p:IconProps)=> (
  <IconBase {...p}>
    <rect x={4} y={4} width={16} height={16} rx={2} />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </IconBase>
)
export const IconStudents = (p:IconProps)=> (
  <IconBase {...p}>
    <circle cx={9} cy={9} r={3} />
    <circle cx={15} cy={9} r={3} />
    <path d="M4 18c0-2.5 2-4.5 4.5-4.5h1c2.5 0 4.5 2 4.5 4.5" />
    <path d="M14 18c0-1.6.9-3 2.4-3.7" />
  </IconBase>
)
export const IconHistory = (p:IconProps)=> (
  <IconBase {...p}>
    <path d="M5 12a7 7 0 1 1 2.05 4.95" />
    <path d="M5 12H2m3 0v-3" />
    <path d="M12 8v5l3 2" />
  </IconBase>
)
export const IconManageStudents = (p:IconProps)=> (
  <IconBase {...p}>
    <circle cx={12} cy={8} r={3} />
    <path d="M6 18c.4-2.5 2.7-4 6-4s5.6 1.5 6 4" />
    <path d="M4 4l4 4M8 4L4 8" />
  </IconBase>
)
export const IconHome = (p:IconProps)=> (
  <IconBase {...p}>
    <path d="M4 11.5 12 4l8 7.5" />
    <path d="M6 10v9h12v-9" />
  </IconBase>
)
export const IconReset = (p:IconProps)=> (
  <IconBase {...p}>
    <path d="M3 10v4" />
    <path d="M12 6v6l3 2" />
    <path d="M6 10a7 7 0 1 1 2 4.9" />
  </IconBase>
)
export const IconExport = (p:IconProps)=> (
  <IconBase {...p}>
    <path d="M12 16V4" />
    <path d="M8 8l4-4 4 4" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </IconBase>
)
export const IconMetricSignedOut = (p:IconProps)=> (
  <IconBase {...p}>
    <circle cx={12} cy={8} r={3} />
    <path d="M5 19c1-3.5 5-5 7-5 1.5 0 4 .5 6 2" />
    <path d="M18 8h3m0 0-2-2m2 2-2 2" />
  </IconBase>
)
export const IconMetricTodays = (p:IconProps)=> (
  <IconBase {...p}>
    <rect x={4} y={5} width={16} height={14} rx={2} />
    <path d="M8 3v4M16 3v4" />
    <path d="M8 11h8M8 15h5" />
  </IconBase>
)
export const IconMetricStudents = (p:IconProps)=> (
  <IconBase {...p}>
    <circle cx={9} cy={9} r={3} />
    <circle cx={15} cy={9} r={3} />
    <path d="M3 19c0-3.5 3-6 6-6h2" />
    <path d="M21 19c0-3.5-3-6-6-6h-2" />
  </IconBase>
)
export const IconMetricRecords = (p:IconProps)=> (
  <IconBase {...p}>
    <rect x={5} y={4} width={14} height={16} rx={2} />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </IconBase>
)
export const IconBreadcrumbHome = IconHome

export const icons = {
  records: IconRecords,
  students: IconStudents,
  history: IconHistory,
  manageStudents: IconManageStudents,
  home: IconHome,
  reset: IconReset,
  export: IconExport,
  metricSignedOut: IconMetricSignedOut,
  metricTodays: IconMetricTodays,
  metricStudents: IconMetricStudents,
  metricRecords: IconMetricRecords,
  breadcrumbHome: IconBreadcrumbHome,
}

export type IconKey = keyof typeof icons
export function AppIcon({name, size=18, className}: {name: IconKey; size?: number | string; className?: string}) {
  const C = icons[name]
  return <C size={size} className={className} />
}
