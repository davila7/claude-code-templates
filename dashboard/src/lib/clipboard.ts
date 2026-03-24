/**
 * Universal clipboard copy utility with fallback support
 * Works in both secure (HTTPS) and insecure contexts
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Modern Clipboard API (requires HTTPS or localhost)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for non-secure contexts
    return fallbackCopy(text);
  } catch (error) {
    console.warn('Clipboard API failed, using fallback:', error);
    return fallbackCopy(text);
  }
}

/**
 * Fallback copy method using textarea
 * Works in all contexts including HTTP
 */
function fallbackCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    
    textarea.focus();
    textarea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    } catch (err) {
      document.body.removeChild(textarea);
      return false;
    }
  } catch (error) {
    console.error('Fallback copy failed:', error);
    return false;
  }
}

/**
 * Copy with visual feedback
 * Returns a promise that resolves when copy is complete
 */
export async function copyWithFeedback(
  text: string,
  button: HTMLElement,
  originalText: string = 'Copy',
  successText: string = 'Copied!',
  duration: number = 2000
): Promise<boolean> {
  const success = await copyToClipboard(text);
  
  if (success) {
    button.textContent = successText;
    setTimeout(() => {
      button.textContent = originalText;
    }, duration);
  } else {
    button.textContent = 'Failed';
    setTimeout(() => {
      button.textContent = originalText;
    }, duration);
  }
  
  return success;
}
