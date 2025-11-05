'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useBreadcrumb } from './breadcrumb-context';

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const { customName } = useBreadcrumb();

  // Parse the pathname to determine breadcrumb segments
  const segments = pathname.split('/').filter(Boolean);

  // Remove 'home' prefix since we always show "Home" as root
  const pathSegments = segments.slice(1);

  const isUUID = (str: string) => {
    // Check if string looks like a UUID (8-4-4-4-12 pattern)
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  };

  const getBreadcrumbLabel = (segment: string, index: number) => {
    const isLast = index === pathSegments.length - 1;

    // Use custom name ONLY for UUID segments
    if (isUUID(segment) && customName) {
      return customName;
    }

    // Special case: "project" should show as "Projects"
    if (segment === 'project') return 'Projects';

    // Capitalize first letter for segments
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  const getBreadcrumbPath = (index: number) => {
    const segment = pathSegments[index];

    // Special case: "project" should link to "projects"
    if (segment === 'project') {
      return '/home/projects';
    }

    return '/home/' + pathSegments.slice(0, index + 1).join('/');
  };

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/home">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {pathSegments.map((segment, index) => {
          const isLast = index === pathSegments.length - 1;
          const label = getBreadcrumbLabel(segment, index);

          // Skip UUID segments in breadcrumb display unless they have a custom name
          if (isUUID(segment) && !customName) {
            return null;
          }

          return (
            <div key={`${segment}-${index}`} className="flex items-center gap-2">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={getBreadcrumbPath(index)}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
