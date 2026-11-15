import { MorpheusChat } from "lx_client/js/components/MorpheusChat";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";

/** Full-page Morpheus chat. */
export default function MorpheusPage() {
  usePageTitle("Morpheus");
  return <MorpheusChat variant="page" />;
}
