import { Link } from 'react-router';

interface BreadcrumbSegment {
  label: string;
  path: string;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

export function Breadcrumb({ segments }: BreadcrumbProps) {
  return (
    <nav className="mb-3 text-xs text-muted-foreground">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={segment.path}>
            {index > 0 && <span className="mx-1.5">&gt;</span>}
            {isLast ? (
              <span className="text-foreground">{segment.label}</span>
            ) : (
              <Link to={segment.path} className="text-primary hover:underline">
                {segment.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
