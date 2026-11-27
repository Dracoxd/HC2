export function normalizePhilippinePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  const subscriberDigits = value.trim().startsWith('+63')
    ? digits.slice(2)
    : digits.startsWith('63') && digits.length === 12
      ? digits.slice(2)
      : digits.startsWith('09') && digits.length === 11
        ? digits.slice(1)
        : digits;
  return subscriberDigits.slice(0, 10);
}

export function isValidPhilippinePhoneNumber(value: string) {
  return /^9\d{9}$/.test(value);
}

export function formatPhilippinePhoneNumber(value: string) {
  return `+63${value}`;
}
