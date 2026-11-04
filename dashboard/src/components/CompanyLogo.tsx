import { useState } from 'react';

interface Props {
  company: string;
  icon?: string;
  /** Classes for the <img> (size, object-fit). */
  imgClassName: string;
  /** Classes for the initial shown when there is no icon or it fails. */
  initialClassName: string;
}

/**
 * A job's company logo, or its initial when the job has no icon or the icon
 * fails to load. No third-party fallback: Clearbit's free logo API, which
 * this used to guess from, shut down on 2025-12-08.
 */
export default function CompanyLogo({ company, icon, imgClassName, initialClassName }: Props) {
  const [failed, setFailed] = useState(false);
  if (!icon || failed) {
    return <span className={initialClassName}>{company.charAt(0).toUpperCase()}</span>;
  }
  return <img src={icon} alt="" className={imgClassName} onError={() => setFailed(true)} />;
}
