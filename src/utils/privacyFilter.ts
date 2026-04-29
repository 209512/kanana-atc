export const applyPrivacyMasking = (text: string): string => {
  if (typeof text !== 'string') return text;
  if (!text) return text;
  
  let maskedText = text;
  const phoneRegex = /(^|[^0-9])(01[016789]|02|0[3-9][0-9])\s*[-.]?\s*([0-9]{3,4})\s*[-.]?\s*([0-9]{4})([^0-9]|$)/g;
  maskedText = maskedText.replace(phoneRegex, '$1$2-****-****$5');
  const rrnRegex = /(^|[^0-9])([0-9]{6})\s*[-]*\s*([1-8][0-9]{6})([^0-9]|$)/g;
  maskedText = maskedText.replace(rrnRegex, '$1******-*******$4');
  const emailRegex = /([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
  maskedText = maskedText.replace(emailRegex, (_match, p1, p2) => {
    if (p1.length <= 2) return `***@${p2}`;
    return `${p1.charAt(0)}${'*'.repeat(p1.length - 2)}${p1.charAt(p1.length - 1)}@${p2}`;
  });

  return maskedText;
};
