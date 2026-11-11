import { useState } from "react";

const fallback = "/brand/project-default.png";

/** GitHub owner image; no community identity or collector credentials involved. */
export default function RepositoryAvatar({ fullName, demo = false, className = "", eager = false }: {
  fullName: string;
  demo?: boolean;
  className?: string;
  eager?: boolean;
}) {
  const owner = fullName.split("/")[0];
  const source = !demo && /^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(owner)
    ? `https://github.com/${encodeURIComponent(owner)}.png?size=128`
    : fallback;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const src = failedSource === source ? fallback : source;
  return (
    <img
      className={`repository-avatar ${className}`}
      src={src}
      alt=""
      aria-hidden="true"
      width={70}
      height={70}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={src === fallback ? undefined : () => setFailedSource(source)}
    />
  );
}
