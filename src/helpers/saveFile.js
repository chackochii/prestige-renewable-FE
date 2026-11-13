// Hands a file the app fetched (a Blob) to the browser as a download.

/** Saves `blob` as `filename` through a temporary link; the object URL is released afterwards. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers start reading the file after click() returns; give them time.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
