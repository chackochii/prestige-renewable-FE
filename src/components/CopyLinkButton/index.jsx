// Copy-to-clipboard button that confirms in place for a couple of seconds.

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/helpers/clipboard";
import { useNotifications } from "@/hooks/useNotifications";

export default function CopyLinkButton({
  value,
  label = "Copy link",
  copiedLabel = "Copied",
  className = "btn btn-ghost btn-sm",
  title,
  toast,
}) {
  const [copied, setCopied] = useState(false);
  const { notify } = useNotifications();
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await copyText(value);
    if (!ok) {
      notify("Couldn't copy automatically — select the link and copy it.", "danger");
      return;
    }
    setCopied(true);
    if (toast) notify(toast);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button type="button" className={className} onClick={onClick} title={title || value} aria-live="polite">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? copiedLabel : label}
    </button>
  );
}
