import { EmptyState } from "@/components/shell/page-scaffold";

export default function NotFound() {
  return <EmptyState title="Page not found" description="This page does not exist." primaryLabel="Go to dashboard" primaryTo="/" />;
}
