import { notFound } from 'next/navigation';

// This catch-all route will match any unmatched paths under /home
// and trigger the not-found.tsx page
export default function CatchAllPage() {
  notFound();
}
